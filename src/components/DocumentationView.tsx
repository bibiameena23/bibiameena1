import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Info,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AuthUser,
  ClinicalEncounter,
  MedicalCodeSuggestion,
  MissingInfoAlert,
  PatientRecord,
  SoapNote,
  UploadedDocMeta,
} from '../types/clinical';
import { apiRequest } from '../lib/api';

interface DocumentationViewProps {
  user: AuthUser;
  patients: PatientRecord[];
  encounters: ClinicalEncounter[];
  initialPatientId: string | null;
  initialEncounterId: string | null;
  onSaved: (encounter: ClinicalEncounter) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const SAMPLE_VIGNETTES = [
  {
    label: 'Load Complete Note (T2DM + Nephropathy)',
    visitType: 'Endocrinology Follow-up',
    symptoms: 'Mild bilateral ankle edema for 2 weeks; denies chest pain or dyspnea.',
    doctorNotes:
      '64yo male presents for 3-month diabetes follow-up. Adherent to metformin 1000 mg BID and lisinopril 20 mg daily. BP 138/84 mmHg, HR 76 bpm, 1+ pitting pedal edema bilaterally. Lungs clear.',
    diagnosisDetails: 'Type 2 diabetes mellitus with diabetic stage 3a chronic kidney disease; controlled hypertension',
    treatmentPlan: 'Continue metformin 1000 mg BID and lisinopril 20 mg daily; add empagliflozin 10 mg daily; recheck BMP and HbA1c in 3 months.',
    labResults: 'HbA1c 8.1%, eGFR 48 mL/min/1.73m2, Urine ACR 145 mg/g, K+ 4.4 mEq/L',
  },
  {
    label: 'Load Incomplete Note (Missing Vitals & Laterality)',
    visitType: 'Urgent Outpatient Visit',
    symptoms: 'Productive cough with yellow sputum for 4 days, subjective chills, pleuritic chest pain.',
    doctorNotes:
      'Patient has crackles on lung exam and SpO2 94% on room air. Preliminary chest X-ray shows pulmonary infiltrate, lobe side not dictated yet. Temperature not recorded at intake.',
    diagnosisDetails: 'Community-acquired pneumonia',
    treatmentPlan: 'Start amoxicillin-clavulanate 875/125 mg BID and azithromycin (dose not specified yet).',
    labResults: 'CXR preliminary: infiltrate present; WBC pending.',
  },
];

export const DocumentationView: React.FC<DocumentationViewProps> = ({
  user,
  patients,
  encounters,
  initialPatientId,
  initialEncounterId,
  onSaved,
  onNotify,
}) => {
  const canAuthor = user.role === 'physician' || user.role === 'nurse';
  const canFinalize = user.role === 'physician';
  const canApproveCodes = user.role === 'physician' || user.role === 'coder';

  const [editingEncounterId, setEditingEncounterId] = useState<string | null>(initialEncounterId);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || patients[0]?.id || '',
  );

  // Input clinical form state
  const [visitType, setVisitType] = useState('Outpatient Consultation');
  const [symptoms, setSymptoms] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [diagnosisDetails, setDiagnosisDetails] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [labResults, setLabResults] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocMeta[]>([]);

  // AI / Editable clinical output state
  const [soapNote, setSoapNote] = useState<SoapNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [patientMedicalSummary, setPatientMedicalSummary] = useState('');
  const [clinicalVisitSummary, setClinicalVisitSummary] = useState('');
  const [medicationSummary, setMedicationSummary] = useState('');
  const [historyHighlights, setHistoryHighlights] = useState<string[]>([]);
  const [extractedTerms, setExtractedTerms] = useState<string[]>([]);
  const [missingInfoAlerts, setMissingInfoAlerts] = useState<MissingInfoAlert[]>([]);
  const [suggestedCodes, setSuggestedCodes] = useState<MedicalCodeSuggestion[]>([]);
  const [aiGenerated, setAiGenerated] = useState(false);

  // Human review attestation
  const [clinicianAttested, setClinicianAttested] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const activePatient = patients.find((p) => p.id === selectedPatientId) ?? null;

  // Load existing encounter if initialEncounterId is provided
  useEffect(() => {
    if (!initialEncounterId) {
      setEditingEncounterId(null);
      if (initialPatientId) {
        setSelectedPatientId(initialPatientId);
      }
      return;
    }
    const enc = encounters.find((e) => e.id === initialEncounterId);
    if (!enc) return;
    setEditingEncounterId(enc.id);
    setSelectedPatientId(enc.patientRecordId);
    setVisitType(enc.visitType);
    setSymptoms(enc.chiefComplaint);
    setDoctorNotes(enc.rawClinicalNotes);
    setDiagnosisDetails(enc.diagnosisDetails);
    setTreatmentPlan(enc.treatmentPlan);
    setLabResults(enc.labResultsText);
    setUploadedDocs(enc.uploadedDocuments);
    setSoapNote(enc.soapNote);
    setPatientMedicalSummary(enc.patientMedicalSummary);
    setClinicalVisitSummary(enc.clinicalVisitSummary);
    setMedicationSummary(enc.medicationSummary);
    setHistoryHighlights(enc.historyHighlights);
    setExtractedTerms(enc.extractedTerms);
    setMissingInfoAlerts(enc.missingInfoAlerts);
    setSuggestedCodes(enc.suggestedCodes);
    setAiGenerated(enc.aiGenerated);
    setClinicianAttested(enc.clinicianAttested);
  }, [initialEncounterId, initialPatientId, encounters]);

  function handleResetNew() {
    setEditingEncounterId(null);
    setVisitType('Outpatient Consultation');
    setSymptoms('');
    setDoctorNotes('');
    setDiagnosisDetails('');
    setTreatmentPlan('');
    setLabResults('');
    setSelectedFile(null);
    setUploadedDocs([]);
    setSoapNote({ subjective: '', objective: '', assessment: '', plan: '' });
    setPatientMedicalSummary('');
    setClinicalVisitSummary('');
    setMedicationSummary('');
    setHistoryHighlights([]);
    setExtractedTerms([]);
    setMissingInfoAlerts([]);
    setSuggestedCodes([]);
    setAiGenerated(false);
    setClinicianAttested(false);
  }

  async function handleGenerateAi() {
    if (!activePatient) {
      onNotify('Select a patient record before generating clinical documentation.', 'error');
      return;
    }
    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append('patientName', activePatient.fullName);
      formData.append('patientId', activePatient.patientId);
      formData.append('age', String(activePatient.age));
      formData.append('gender', activePatient.gender);
      formData.append('allergies', activePatient.allergies.join(', '));
      formData.append('medicalHistory', activePatient.chronicConditions.join(', '));
      formData.append('medications', activePatient.currentMedications.join(', '));
      formData.append('visitType', visitType);
      formData.append('symptoms', symptoms);
      formData.append('doctorNotes', doctorNotes);
      formData.append('diagnosisDetails', diagnosisDetails);
      formData.append('treatmentPlan', treatmentPlan);
      formData.append('labResults', labResults);
      if (selectedFile) {
        formData.append('document', selectedFile);
      }

      const data = await apiRequest<{
        analysis: {
          soapNote: SoapNote;
          patientMedicalSummary: string;
          clinicalVisitSummary: string;
          medicationSummary: string;
          historyHighlights: string[];
          extractedTerms: string[];
          missingInfoAlerts: MissingInfoAlert[];
          suggestedCodes: MedicalCodeSuggestion[];
        };
        uploadedDocument: UploadedDocMeta | null;
      }>('/api/ai/process-encounter', {
        method: 'POST',
        body: formData,
      });

      setSoapNote(data.analysis.soapNote);
      setPatientMedicalSummary(data.analysis.patientMedicalSummary);
      setClinicalVisitSummary(data.analysis.clinicalVisitSummary);
      setMedicationSummary(data.analysis.medicationSummary);
      setHistoryHighlights(data.analysis.historyHighlights);
      setExtractedTerms(data.analysis.extractedTerms);
      setMissingInfoAlerts(data.analysis.missingInfoAlerts);
      setSuggestedCodes(data.analysis.suggestedCodes);
      setAiGenerated(true);
      setClinicianAttested(false);

      if (data.uploadedDocument) {
        setUploadedDocs((prev) => [data.uploadedDocument!, ...prev]);
        setSelectedFile(null);
      }

      onNotify(
        'AI draft generated. Review all SOAP sections, alerts, and codes before saving.',
        'success',
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'AI clinical processing failed.',
        'error',
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleCodeDecision(codeId: string, decision: 'approved' | 'rejected') {
    if (!canApproveCodes) return;
    setSuggestedCodes((prev) =>
      prev.map((c) =>
        c.id === codeId
          ? {
              ...c,
              approvalStatus: decision,
              reviewedBy: `${user.name}, ${user.credentials}`,
              reviewedAt: new Date().toISOString(),
            }
          : c,
      ),
    );
  }

  function handleToggleAlertResolved(alertId: string) {
    setMissingInfoAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: !a.resolved } : a)),
    );
  }

  async function handleSaveEncounter(targetStatus: 'draft' | 'pending_review' | 'finalized') {
    if (!activePatient) {
      onNotify('Please select a patient record.', 'error');
      return;
    }
    if (!soapNote.subjective && !soapNote.objective && !soapNote.assessment && !soapNote.plan) {
      onNotify('Generate or enter SOAP documentation before saving.', 'error');
      return;
    }
    if (targetStatus === 'finalized' && !clinicianAttested) {
      onNotify(
        'Check the human verification attestation box before finalizing the encounter.',
        'error',
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        patientRecordId: activePatient.id,
        visitType,
        chiefComplaint: symptoms,
        rawClinicalNotes: doctorNotes,
        diagnosisDetails,
        treatmentPlan,
        labResultsText: labResults,
        uploadedDocuments: uploadedDocs,
        soapNote,
        patientMedicalSummary,
        clinicalVisitSummary,
        medicationSummary,
        historyHighlights,
        extractedTerms,
        missingInfoAlerts,
        suggestedCodes,
        status: targetStatus,
        clinicianAttested,
        aiGenerated,
      };

      const res = editingEncounterId
        ? await apiRequest<{ encounter: ClinicalEncounter }>(
            `/api/encounters/${editingEncounterId}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiRequest<{ encounter: ClinicalEncounter }>('/api/encounters', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setEditingEncounterId(res.encounter.id);
      await onSaved(res.encounter);
      onNotify(
        targetStatus === 'finalized'
          ? 'Clinical record attested, finalized, and saved.'
          : 'Encounter saved to pending review queue.',
        'success',
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to save encounter.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const hasSoapContent = Boolean(
    soapNote.subjective || soapNote.objective || soapNote.assessment || soapNote.plan,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Clinical Documentation &amp; Document Upload
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Convert unstructured clinical notes and PDF/text reports into verified SOAP records
            without fabricating missing facts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetNew}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            Reset / New Note
          </button>
        </div>
      </div>

      {/* Patient Selection & Sample Vignette Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Active Patient Record
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              disabled={Boolean(editingEncounterId)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patientId} — {p.fullName} ({p.age}y {p.gender})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Encounter / Visit Type
            </label>
            <input
              type="text"
              value={visitType}
              onChange={(e) => setVisitType(e.target.value)}
              disabled={!canAuthor}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
            />
          </div>
        </div>

        {canAuthor && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {SAMPLE_VIGNETTES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setVisitType(sample.visitType);
                  setSymptoms(sample.symptoms);
                  setDoctorNotes(sample.doctorNotes);
                  setDiagnosisDetails(sample.diagnosisDetails);
                  setTreatmentPlan(sample.treatmentPlan);
                  setLabResults(sample.labResults);
                }}
                className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activePatient && (
        <div className="bg-slate-100/80 border border-slate-200 rounded-md px-4 py-2.5 text-xs text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-900">{activePatient.fullName}</span>
          <span>Allergies: {activePatient.allergies.join(', ') || 'None'}</span>
          <span aria-hidden="true">·</span>
          <span>History: {activePatient.chronicConditions.join(', ') || 'None'}</span>
          <span aria-hidden="true">·</span>
          <span>Active Meds: {activePatient.currentMedications.join(', ') || 'None'}</span>
        </div>
      )}

      {/* Main Split Workbench: Left Inputs / Right Editable AI Output */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Clinical Inputs & Document Upload */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-slate-900">
              1. Clinical Input &amp; Medical Documents
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter doctor consultation notes or upload a clinical report (PDF, TXT, CSV).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Current Symptoms &amp; Chief Complaints
            </label>
            <textarea
              rows={2}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              disabled={!canAuthor}
              placeholder="Patient's presenting complaints, duration, and symptom severity..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Doctor Consultation &amp; Clinical Notes
            </label>
            <textarea
              rows={5}
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              disabled={!canAuthor}
              placeholder="Paste unstructured consultation notes, exam findings, vitals, and clinical reasoning..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Diagnosis Details
              </label>
              <textarea
                rows={2}
                value={diagnosisDetails}
                onChange={(e) => setDiagnosisDetails(e.target.value)}
                disabled={!canAuthor}
                placeholder="Working or confirmed diagnoses..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Treatment &amp; Medications
              </label>
              <textarea
                rows={2}
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                disabled={!canAuthor}
                placeholder="Prescribed drugs, dosages, follow-up..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Laboratory &amp; Diagnostic Test Reports
            </label>
            <textarea
              rows={2}
              value={labResults}
              onChange={(e) => setLabResults(e.target.value)}
              disabled={!canAuthor}
              placeholder="Lab values, reference ranges, imaging impressions..."
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
            />
          </div>

          {/* Document Upload Box */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Upload Medical Document (PDF, TXT, MD, CSV · Max 10 MB)
            </label>
            <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-md p-4 bg-slate-50/70 hover:bg-slate-100/70 transition-colors cursor-pointer">
              <FileUp className="w-5 h-5 text-teal-700 mb-1.5" />
              <span className="text-xs font-medium text-slate-800">
                {selectedFile ? selectedFile.name : 'Choose PDF or text clinical report'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB ready for AI extraction`
                  : 'Lab panels, discharge summaries, or consultation transcripts'}
              </span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,application/pdf,text/plain"
                disabled={!canAuthor}
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600 px-2">
                <span className="truncate">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            )}

            {uploadedDocs.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {uploadedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5"
                  >
                    <span className="inline-flex items-center gap-1.5 text-slate-700 truncate">
                      <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span className="truncate">{doc.fileName}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {(doc.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canAuthor && (
            <button
              type="button"
              onClick={handleGenerateAi}
              disabled={generating}
              className="w-full py-2.5 px-4 rounded-md bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Clinical Data with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Structured SOAP &amp; Medical Codes</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Column: Editable AI Documentation, Warnings, & Human Approval Gate */}
        <div className="xl:col-span-7 space-y-6">
          {/* Missing or Incomplete Documentation Warnings */}
          {missingInfoAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-900 font-display text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Missing or Incomplete Documentation Alerts ({missingInfoAlerts.length})</span>
                </div>
                <span className="text-xs text-amber-800">
                  AI refused to fabricate unstated clinical facts
                </span>
              </div>

              <div className="divide-y divide-amber-200/80 border border-amber-200 rounded-md bg-white">
                {missingInfoAlerts.map((alert) => (
                  <div key={alert.id} className="p-3.5 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {alert.severity === 'high' ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-slate-900">
                          {alert.field}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          · {alert.severity.toUpperCase()} priority
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{alert.message}</p>
                      <p className="text-xs text-teal-800">
                        Clarifying Prompt: {alert.clarifyingQuestion}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleAlertResolved(alert.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap shrink-0 cursor-pointer ${
                        alert.resolved
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {alert.resolved ? 'Addressed' : 'Mark Addressed'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editable SOAP Note Panel */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  2. Structured SOAP Clinical Note (Editable)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify and edit every section prior to clinical attestation.
                </p>
              </div>
              {aiGenerated && !clinicianAttested && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <Info className="w-3.5 h-3.5" />
                  <span>Unverified AI Draft — Human Review Required</span>
                </span>
              )}
            </div>

            {!hasSoapContent && !generating ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-md bg-slate-50/50 px-6">
                <p className="text-sm font-medium text-slate-700">
                  No structured SOAP note generated yet
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Enter clinical consultation notes or upload a PDF/text report on the left, then
                  click &ldquo;Generate Structured SOAP &amp; Medical Codes&rdquo;.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    { key: 'subjective', label: 'Subjective (Symptoms & Chief Complaints)' },
                    { key: 'objective', label: 'Objective (Exam Observations & Test Results)' },
                    { key: 'assessment', label: 'Assessment (Documented Clinical Diagnosis)' },
                    { key: 'plan', label: 'Plan (Treatment, Medications & Follow-up)' },
                  ] as const
                ).map((section) => (
                  <div key={section.key}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {section.label}
                    </label>
                    <textarea
                      rows={3}
                      value={soapNote[section.key]}
                      disabled={!canAuthor}
                      onChange={(e) =>
                        setSoapNote((prev) => ({ ...prev, [section.key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm leading-relaxed border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
                    />
                  </div>
                ))}

                {/* Summaries & Highlights */}
                <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Patient Medical Summary
                    </label>
                    <textarea
                      rows={3}
                      value={patientMedicalSummary}
                      disabled={!canAuthor}
                      onChange={(e) => setPatientMedicalSummary(e.target.value)}
                      className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Clinical Visit &amp; Medication Summary
                    </label>
                    <textarea
                      rows={3}
                      value={clinicalVisitSummary}
                      disabled={!canAuthor}
                      onChange={(e) => setClinicalVisitSummary(e.target.value)}
                      className="w-full px-3 py-2 text-xs leading-relaxed border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {medicationSummary && (
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Medication Summary: </span>
                    {medicationSummary}
                  </div>
                )}

                {historyHighlights.length > 0 && (
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">
                      Medical History Highlights:{' '}
                    </span>
                    {historyHighlights.join(' · ')}
                  </div>
                )}

                {extractedTerms.length > 0 && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Extracted Clinical Terms: </span>
                    {extractedTerms.join(' · ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inline Suggested Codes + Human Review Attestation */}
          {hasSoapContent && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    3. Suggested Medical Codes &amp; Human Approval
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review suggested ICD-10-CM / CPT codes before signing or saving.
                  </p>
                </div>
                <span className="font-mono tabular-nums text-xs text-slate-600">
                  {suggestedCodes.filter((c) => c.approvalStatus === 'approved').length}/
                  {suggestedCodes.length} approved
                </span>
              </div>

              {suggestedCodes.length === 0 ? (
                <p className="text-xs text-slate-500">No medical codes suggested yet.</p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {suggestedCodes.map((code) => (
                    <div
                      key={code.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {code.system} {code.code}
                          </span>
                          <span className="text-xs font-medium text-slate-800">
                            — {code.description}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Evidence: &ldquo;{code.evidenceSnippet}&rdquo;
                        </p>
                        {code.inconsistencyReason && (
                          <p className="text-xs text-red-700 font-medium">
                            Guideline Warning: {code.inconsistencyReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canApproveCodes ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCodeDecision(code.id, 'approved')}
                              className={`px-2.5 py-1 text-xs font-medium rounded border inline-flex items-center gap-1 cursor-pointer ${
                                code.approvalStatus === 'approved'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCodeDecision(code.id, 'rejected')}
                              className={`px-2.5 py-1 text-xs font-medium rounded border inline-flex items-center gap-1 cursor-pointer ${
                                code.approvalStatus === 'rejected'
                                  ? 'bg-red-50 border-red-300 text-red-800'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-slate-600">
                            Status: {code.approvalStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mandatory Human Review Gate */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clinicianAttested}
                    disabled={!canFinalize}
                    onChange={(e) => setClinicianAttested(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span className="leading-relaxed">
                    <strong>Human Verification Attestation:</strong> I confirm that I have reviewed
                    and edited all AI-assisted SOAP documentation, checked for missing clinical
                    information, and verified medical accuracy against source evidence.
                    {!canFinalize &&
                      ' (Final attestation is restricted to Attending Physicians.)'}
                  </span>
                </label>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {canAuthor && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveEncounter('pending_review')}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save for Review'}</span>
                    </button>
                  )}

                  {canFinalize && (
                    <button
                      type="button"
                      disabled={saving || !clinicianAttested}
                      onClick={() => handleSaveEncounter('finalized')}
                      className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{saving ? 'Finalizing...' : 'Approve & Finalize Record'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
