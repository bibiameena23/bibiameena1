import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AuthUser, ClinicalEncounter, MedicalCodeSuggestion } from '../types/clinical';
import { apiRequest } from '../lib/api';

interface CodingAssistantViewProps {
  user: AuthUser;
  encounters: ClinicalEncounter[];
  initialEncounterId: string | null;
  onEncounterUpdated: (encounter: ClinicalEncounter) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const CodingAssistantView: React.FC<CodingAssistantViewProps> = ({
  user,
  encounters,
  initialEncounterId,
  onEncounterUpdated,
  onNotify,
}) => {
  const canReviewCodes = user.role === 'physician' || user.role === 'coder';
  const canRunAudit = user.role === 'physician' || user.role === 'coder' || user.role === 'auditor';

  const [selectedId, setSelectedId] = useState<string>(
    initialEncounterId || encounters[0]?.id || '',
  );
  const [auditing, setAuditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [auditSummary, setAuditSummary] = useState<string | null>(null);

  // Manual add code form
  const [showAddCode, setShowAddCode] = useState(false);
  const [newSystem, setNewSystem] = useState<'ICD-10-CM' | 'CPT'>('ICD-10-CM');
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRationale, setNewRationale] = useState('');

  useEffect(() => {
    if (initialEncounterId) {
      setSelectedId(initialEncounterId);
      setAuditSummary(null);
    }
  }, [initialEncounterId]);

  const activeEncounter = encounters.find((e) => e.id === selectedId) ?? encounters[0] ?? null;

  async function handleRunCodingAudit() {
    if (!activeEncounter) return;
    setAuditing(true);
    setAuditSummary(null);
    try {
      const res = await apiRequest<{
        auditSummary: string;
        suggestedCodes: MedicalCodeSuggestion[];
        missingInfoAlerts: ClinicalEncounter['missingInfoAlerts'];
      }>('/api/ai/audit-coding', {
        method: 'POST',
        body: JSON.stringify({ encounterId: activeEncounter.id }),
      });

      setAuditSummary(res.auditSummary);
      if (canReviewCodes) {
        const updated = await apiRequest<{ encounter: ClinicalEncounter }>(
          `/api/encounters/${activeEncounter.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              suggestedCodes: res.suggestedCodes,
              missingInfoAlerts: res.missingInfoAlerts,
            }),
          },
        );
        await onEncounterUpdated(updated.encounter);
      }
      onNotify('AI coding guideline audit completed.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Coding audit failed.', 'error');
    } finally {
      setAuditing(false);
    }
  }

  async function handleCodeAction(codeId: string, status: 'approved' | 'rejected') {
    if (!activeEncounter || !canReviewCodes) return;
    setSaving(true);
    try {
      const nextCodes = activeEncounter.suggestedCodes.map((c) =>
        c.id === codeId
          ? {
              ...c,
              approvalStatus: status,
              reviewedBy: `${user.name}, ${user.credentials}`,
              reviewedAt: new Date().toISOString(),
            }
          : c,
      );

      const res = await apiRequest<{ encounter: ClinicalEncounter }>(
        `/api/encounters/${activeEncounter.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ suggestedCodes: nextCodes }),
        },
      );
      await onEncounterUpdated(res.encounter);
      onNotify(`Code marked as ${status}.`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update code.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyAllCoding() {
    if (!activeEncounter || !canReviewCodes) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ encounter: ClinicalEncounter }>(
        `/api/encounters/${activeEncounter.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            coderVerified: true,
          }),
        },
      );
      await onEncounterUpdated(res.encounter);
      onNotify('Medical coding verification recorded.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to verify coding.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddManualCode(e: React.FormEvent) {
    e.preventDefault();
    if (!activeEncounter || !newCode.trim() || !newDescription.trim()) return;
    setSaving(true);
    try {
      const added: MedicalCodeSuggestion = {
        id: `code-man-${Date.now()}`,
        system: newSystem,
        code: newCode.trim().toUpperCase(),
        description: newDescription.trim(),
        category: newSystem === 'CPT' ? 'Procedure' : 'Diagnosis',
        evidenceSnippet: 'Added by authorized reviewer during coding audit',
        guidelineNote: newRationale.trim() || 'Manual clinician/coder entry',
        specificityStatus: 'specific',
        approvalStatus: 'approved',
        reviewedBy: `${user.name}, ${user.credentials}`,
        reviewedAt: new Date().toISOString(),
      };

      const res = await apiRequest<{ encounter: ClinicalEncounter }>(
        `/api/encounters/${activeEncounter.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            suggestedCodes: [...activeEncounter.suggestedCodes, added],
          }),
        },
      );
      await onEncounterUpdated(res.encounter);
      setNewCode('');
      setNewDescription('');
      setNewRationale('');
      setShowAddCode(false);
      onNotify(`Added ${added.system} ${added.code}.`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to add code.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Medical Coding Assistant (ICD-10-CM &amp; CPT)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Validate AI-suggested diagnosis and procedure codes against clinical evidence,
            specificity rules, and coding guidelines.
          </p>
        </div>

        {activeEncounter && canRunAudit && (
          <button
            type="button"
            disabled={auditing}
            onClick={handleRunCodingAudit}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {auditing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Guideline Audit...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Run AI Coding Guideline Audit</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Encounter Queue */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Coding Review Queue ({encounters.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-200 max-h-[640px] overflow-y-auto">
            {encounters.map((enc) => {
              const selected = activeEncounter?.id === enc.id;
              const flaggedCount = enc.suggestedCodes.filter(
                (c) => c.specificityStatus === 'inconsistent' || c.specificityStatus === 'unspecified',
              ).length;
              const pendingCount = enc.suggestedCodes.filter(
                (c) => c.approvalStatus === 'pending',
              ).length;

              return (
                <button
                  key={enc.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(enc.id);
                    setAuditSummary(null);
                  }}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    selected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {enc.patientName}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-slate-500">
                      {enc.patientId}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 truncate">
                    {enc.diagnosisDetails || enc.chiefComplaint}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="font-mono text-slate-500">{enc.encounterDate}</span>
                    {pendingCount > 0 ? (
                      <span className="text-amber-700 font-medium">
                        {pendingCount} pending review
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">All codes reviewed</span>
                    )}
                    {flaggedCount > 0 && (
                      <span className="text-red-700 font-medium">
                        {flaggedCount} guideline alert(s)
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coding Workbench */}
        <div className="lg:col-span-8 space-y-6">
          {!activeEncounter ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500">
              No encounters available for coding review.
            </div>
          ) : (
            <>
              {/* Source Evidence Context */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      {activeEncounter.patientName} ·{' '}
                      <span className="font-mono text-sm font-normal text-slate-600">
                        {activeEncounter.patientId}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeEncounter.patientAge}y {activeEncounter.patientGender} ·{' '}
                      {activeEncounter.visitType} · {activeEncounter.encounterDate}
                    </p>
                  </div>

                  {activeEncounter.coderVerified ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Coder Verified ({activeEncounter.coderVerifiedBy})</span>
                    </span>
                  ) : (
                    canReviewCodes && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleVerifyAllCoding}
                        className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                      >
                        Confirm Coder Verification
                      </button>
                    )
                  )}
                </div>

                {auditSummary && (
                  <div className="p-3.5 rounded-md bg-teal-50 border border-teal-200 text-xs text-teal-900 leading-relaxed">
                    <strong>AI Guideline Audit Finding: </strong>
                    {auditSummary}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200">
                    <p className="font-semibold text-slate-800 mb-1">SOAP Assessment</p>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {activeEncounter.soapNote.assessment || '[Not documented]'}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200">
                    <p className="font-semibold text-slate-800 mb-1">SOAP Plan &amp; Procedures</p>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {activeEncounter.soapNote.plan || '[Not documented]'}
                    </p>
                  </div>
                </div>

                {activeEncounter.extractedTerms.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      Extracted Medical Terminology:{' '}
                    </span>
                    {activeEncounter.extractedTerms.join(' · ')}
                  </div>
                )}
              </div>

              {/* Suggested Codes Table & Actions */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Suggested Codes &amp; Guideline Validation
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Codes must be validated against clinical documentation before billing or
                      finalization.
                    </p>
                  </div>
                  {canReviewCodes && (
                    <button
                      type="button"
                      onClick={() => setShowAddCode((v) => !v)}
                      className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Code</span>
                    </button>
                  )}
                </div>

                {showAddCode && canReviewCodes && (
                  <form
                    onSubmit={handleAddManualCode}
                    className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                  >
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        System
                      </label>
                      <select
                        value={newSystem}
                        onChange={(e) => setNewSystem(e.target.value as 'ICD-10-CM' | 'CPT')}
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="ICD-10-CM">ICD-10-CM</option>
                        <option value="CPT">CPT</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                      <input
                        type="text"
                        required
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="e.g., E11.9"
                        className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Official Description
                      </label>
                      <input
                        type="text"
                        required
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Code description..."
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Rationale
                      </label>
                      <input
                        type="text"
                        value={newRationale}
                        onChange={(e) => setNewRationale(e.target.value)}
                        placeholder="Guideline note"
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2 px-3 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 cursor-pointer"
                      >
                        Save Code
                      </button>
                    </div>
                  </form>
                )}

                <div className="divide-y divide-slate-200">
                  {activeEncounter.suggestedCodes.map((code) => (
                    <div key={code.id} className="p-5 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                            {code.system} {code.code}
                          </span>
                          <span className="text-sm font-medium text-slate-800">
                            {code.description}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {code.specificityStatus === 'inconsistent' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                              <ShieldAlert className="w-3.5 h-3.5" /> Inconsistency Flagged
                            </span>
                          )}
                          {code.specificityStatus === 'unspecified' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5" /> Unspecified
                            </span>
                          )}
                          {code.specificityStatus === 'specific' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Specific
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <p>
                          <span className="font-medium text-slate-800">Clinical Evidence: </span>
                          &ldquo;{code.evidenceSnippet}&rdquo;
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">Guideline Rule: </span>
                          {code.guidelineNote}
                        </p>
                        {code.inconsistencyReason && (
                          <p className="text-red-700 font-medium">
                            Coding Alert: {code.inconsistencyReason}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">
                          Review Status:{' '}
                          <strong className="text-slate-800 capitalize">
                            {code.approvalStatus}
                          </strong>
                          {code.reviewedBy ? ` · by ${code.reviewedBy}` : ''}
                        </span>

                        {canReviewCodes && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleCodeAction(code.id, 'approved')}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer ${
                                code.approvalStatus === 'approved'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" /> Approve Code
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleCodeAction(code.id, 'rejected')}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md border inline-flex items-center gap-1 cursor-pointer ${
                                code.approvalStatus === 'rejected'
                                  ? 'bg-red-50 border-red-300 text-red-800'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
