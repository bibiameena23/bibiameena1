import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FilePlus2,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import type { AuthUser, ClinicalEncounter, PatientRecord } from '../types/clinical';
import { apiRequest } from '../lib/api';

interface EnrichedPatient extends PatientRecord {
  encounterCount?: number;
  latestEncounterDate?: string | null;
  latestStatus?: ClinicalEncounter['status'] | null;
  latestDiagnosis?: string | null;
  openAlerts?: number;
}

interface PatientsViewProps {
  user: AuthUser;
  patients: EnrichedPatient[];
  encounters: ClinicalEncounter[];
  selectedPatientId: string | null;
  onSelectPatient: (id: string | null) => void;
  onPatientCreated: () => Promise<void>;
  onOpenEncounter: (patientRecordId: string, encounterId?: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  user,
  patients,
  encounters,
  selectedPatientId,
  onSelectPatient,
  onPatientCreated,
  onOpenEncounter,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'finalized'>('all');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Registration form fields
  const [fullName, setFullName] = useState('');
  const [patientId, setPatientId] = useState(`PT-${Math.floor(4100 + Math.random() * 800)}`);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Non-binary' | 'Other'>('Female');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [baselineVitals, setBaselineVitals] = useState('');

  const canRegister = user.role === 'physician' || user.role === 'nurse';

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      const pEncs = encounters.filter((e) => e.patientRecordId === p.id);
      const latestStatus = pEncs[0]?.status ?? null;
      if (statusFilter === 'pending' && latestStatus === 'finalized') return false;
      if (statusFilter === 'finalized' && latestStatus !== 'finalized') return false;
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.patientId.toLowerCase().includes(q) ||
        p.chronicConditions.some((c) => c.toLowerCase().includes(q)) ||
        pEncs.some(
          (e) =>
            e.diagnosisDetails.toLowerCase().includes(q) ||
            e.suggestedCodes.some((c) => c.code.toLowerCase().includes(q)),
        )
      );
    });
  }, [patients, encounters, searchQuery, statusFilter]);

  const activePatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? filteredPatients[0] ?? null,
    [patients, filteredPatients, selectedPatientId],
  );

  const activeHistory = useMemo(() => {
    if (!activePatient) return [];
    return encounters
      .filter((e) => e.patientRecordId === activePatient.id)
      .sort((a, b) => b.encounterDate.localeCompare(a.encounterDate));
  }, [encounters, activePatient]);

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ patient: PatientRecord }>('/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          patientId,
          age: Number(age),
          gender,
          allergies,
          chronicConditions,
          currentMedications,
          baselineVitals,
        }),
      });
      await onPatientCreated();
      onSelectPatient(res.patient.id);
      setShowRegisterForm(false);
      setFullName('');
      setAge('');
      setAllergies('');
      setChronicConditions('');
      setCurrentMedications('');
      setBaselineVitals('');
      setPatientId(`PT-${Math.floor(4100 + Math.random() * 800)}`);
      onNotify(`Registered synthetic patient ${res.patient.fullName} (${res.patient.patientId}).`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to register patient.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Patient Record Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Search synthetic patient charts, register new patients, and review chronological visit
            histories.
          </p>
        </div>

        {canRegister && (
          <button
            type="button"
            onClick={() => setShowRegisterForm((v) => !v)}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showRegisterForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            <span>{showRegisterForm ? 'Close Registration' : 'New Patient Registration'}</span>
          </button>
        )}
      </div>

      {/* Patient Registration Form */}
      {showRegisterForm && canRegister && (
        <form
          onSubmit={handleRegisterSubmit}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Patient Registration Form (Synthetic Demonstration Data Only)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter fictional patient demographics and baseline medical history.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Hannah Sterling"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Patient ID *
              </label>
              <input
                type="text"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="PT-4105"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Age *</label>
              <input
                type="number"
                required
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="45"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
              <select
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as 'Female' | 'Male' | 'Non-binary' | 'Other')
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Known Allergies (comma-separated)
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g., Penicillin (hives), Sulfa"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Baseline Vitals
              </label>
              <input
                type="text"
                value={baselineVitals}
                onChange={(e) => setBaselineVitals(e.target.value)}
                placeholder="e.g., BP 124/78 mmHg · HR 72 bpm · SpO2 98%"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Chronic Medical History (comma-separated)
              </label>
              <input
                type="text"
                value={chronicConditions}
                onChange={(e) => setChronicConditions(e.target.value)}
                placeholder="e.g., Essential hypertension, Hypothyroidism"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current Medications (comma-separated)
              </label>
              <input
                type="text"
                value={currentMedications}
                onChange={(e) => setCurrentMedications(e.target.value)}
                placeholder="e.g., Lisinopril 10 mg daily, Levothyroxine 50 mcg"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowRegisterForm(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Saving Record...' : 'Save Patient Record'}
            </button>
          </div>
        </form>
      )}

      {/* Search + Directory & History Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Searchable Patient Directory */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name, Patient ID, diagnosis, or ICD-10..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(
                [
                  { id: 'all', label: 'All Records' },
                  { id: 'pending', label: 'Needs Review' },
                  { id: 'finalized', label: 'Finalized' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex-1 py-1.5 px-2.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPatients.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No matching patient records found.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
              {filteredPatients.map((p) => {
                const isSelected = activePatient?.id === p.id;
                const pEncs = encounters.filter((e) => e.patientRecordId === p.id);
                const openAlerts = pEncs.reduce(
                  (acc, e) => acc + e.missingInfoAlerts.filter((a) => !a.resolved).length,
                  0,
                );
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPatient(p.id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{p.fullName}</span>
                      <span className="font-mono tabular-nums text-xs text-slate-500">
                        {p.patientId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {p.age} yrs · {p.gender} · {pEncs.length} visit(s)
                    </div>
                    <div className="text-xs text-slate-600 mt-1.5 truncate">
                      {p.chronicConditions.length > 0
                        ? p.chronicConditions.join(', ')
                        : 'No chronic conditions logged'}
                    </div>
                    {openAlerts > 0 && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{openAlerts} missing documentation alert(s)</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Patient Medical History & Visit Timeline */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg">
          {!activePatient ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Select a patient record to view medical history and consultation summaries.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-xl font-semibold text-slate-900">
                      {activePatient.fullName}
                    </h2>
                    <span className="font-mono tabular-nums text-xs text-slate-600">
                      {activePatient.patientId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Age {activePatient.age} · {activePatient.gender} · {activePatient.syntheticNote}
                  </p>
                </div>

                {canRegister && (
                  <button
                    type="button"
                    onClick={() => onOpenEncounter(activePatient.id)}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>Start New Consultation</span>
                  </button>
                )}
              </div>

              {/* Clinical Profile Grid */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                    Known Allergies
                  </h3>
                  <p className="text-sm text-slate-900">
                    {activePatient.allergies.length > 0
                      ? activePatient.allergies.join(', ')
                      : 'None documented'}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                    Baseline Vitals
                  </h3>
                  <p className="text-sm font-mono tabular-nums text-slate-800">
                    {activePatient.baselineVitals}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                    Medical History
                  </h3>
                  <p className="text-sm text-slate-900">
                    {activePatient.chronicConditions.length > 0
                      ? activePatient.chronicConditions.join(' · ')
                      : 'None recorded'}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                    Active Medications
                  </h3>
                  <p className="text-sm text-slate-900">
                    {activePatient.currentMedications.length > 0
                      ? activePatient.currentMedications.join(' · ')
                      : 'None recorded'}
                  </p>
                </div>
              </div>

              {/* Chronological Visit History */}
              <div className="p-6">
                <h3 className="font-display text-sm font-semibold text-slate-900 mb-4">
                  Previous Visit Summaries &amp; Encounter History ({activeHistory.length})
                </h3>

                {activeHistory.length === 0 ? (
                  <div className="p-6 rounded-md bg-slate-50 border border-slate-200 text-center">
                    <p className="text-sm text-slate-600">
                      No clinical consultations have been documented for this patient yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeHistory.map((enc) => (
                      <div
                        key={enc.id}
                        className="border border-slate-200 rounded-md p-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="font-mono tabular-nums font-medium text-slate-900">
                              {enc.encounterDate}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{enc.visitType}</span>
                            <span aria-hidden="true">·</span>
                            <span>Author: {enc.createdBy}</span>
                          </div>
                          {enc.status === 'finalized' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Finalized
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                              <Clock className="w-3.5 h-3.5" /> Pending Verification
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-slate-900">
                          {enc.diagnosisDetails || enc.chiefComplaint}
                        </p>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          {enc.clinicalVisitSummary || enc.soapNote.assessment}
                        </p>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs font-mono tabular-nums text-slate-600">
                            Codes:{' '}
                            {enc.suggestedCodes.length > 0
                              ? enc.suggestedCodes.map((c) => `${c.code} (${c.approvalStatus})`).join(' · ')
                              : 'None assigned'}
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenEncounter(activePatient.id, enc.id)}
                            className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                          >
                            Open Full SOAP &amp; Codes
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
