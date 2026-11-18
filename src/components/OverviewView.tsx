import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FilePlus2,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import type { AuthUser, ClinicalEncounter, PatientRecord } from '../types/clinical';

export interface DashboardAlert {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  type: 'missing_info' | 'coding_inconsistency' | 'unverified_draft';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

interface OverviewViewProps {
  user: AuthUser;
  metrics: {
    totalPatients: number;
    totalEncounters: number;
    pendingReview: number;
    finalizedCount: number;
    openAlertsCount: number;
  };
  alerts: DashboardAlert[];
  recentEncounters: ClinicalEncounter[];
  patients: PatientRecord[];
  onNavigateDocumentation: (patientId?: string, encounterId?: string) => void;
  onNavigatePatients: (patientId?: string) => void;
  onNavigateCoding: (encounterId?: string) => void;
}

function StatusLabel({ status }: { status: ClinicalEncounter['status'] }) {
  if (status === 'finalized') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Finalized</span>
      </span>
    );
  }
  if (status === 'pending_review') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Pending Review</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Draft</span>
    </span>
  );
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  user,
  metrics,
  alerts,
  recentEncounters,
  onNavigateDocumentation,
  onNavigatePatients,
  onNavigateCoding,
}) => {
  const canCreate = user.role === 'physician' || user.role === 'nurse';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Clinical Operations Overview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Signed in as {user.name} · {user.roleLabel} · {user.department}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {canCreate && (
            <>
              <button
                type="button"
                onClick={() => onNavigatePatients()}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Patient</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateDocumentation()}
                className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>New Clinical Note</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4-Column Tabular KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Total Patient Records</p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-slate-900 mt-2">
            {metrics.totalPatients}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            {metrics.totalEncounters} documented visits
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Pending Human Review</p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-amber-700 mt-2">
            {metrics.pendingReview}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Require clinician attestation
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Open Alerts &amp; Gaps</p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-red-700 mt-2">
            {metrics.openAlertsCount}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Missing fields or code mismatches
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Finalized &amp; Coded</p>
          <p className="font-mono tabular-nums text-3xl font-semibold text-emerald-700 mt-2">
            {metrics.finalizedCount}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Verified by physician &amp; coder
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Patient Records Table */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Clinical Encounters
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any visit to open structured SOAP documentation or coding review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigatePatients()}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              All Records
            </button>
          </div>

          {recentEncounters.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No clinical encounters recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">Patient</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Assessment / Visit</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {recentEncounters.map((enc) => (
                    <tr key={enc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{enc.patientName}</div>
                        <div className="font-mono tabular-nums text-xs text-slate-500">
                          {enc.patientId} · {enc.patientAge}y {enc.patientGender}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {enc.encounterDate}
                      </td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="text-xs font-medium text-slate-800 truncate">
                          {enc.diagnosisDetails || enc.chiefComplaint}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {enc.suggestedCodes.length} code(s) · {enc.visitType}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusLabel status={enc.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            user.role === 'coder'
                              ? onNavigateCoding(enc.id)
                              : onNavigateDocumentation(enc.patientRecordId, enc.id)
                          }
                          className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{user.role === 'coder' ? 'Review Codes' : 'Open Chart'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Notifications & Documentation Alerts */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Notifications &amp; Integrity Alerts
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Missing clinical data, unverified AI drafts, and coding conflicts.
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-medium text-slate-600">
              {alerts.length} active
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-800">All charts verified</p>
              <p className="text-xs text-slate-500 mt-1">
                No missing documentation alerts or pending coding discrepancies.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[460px] overflow-y-auto">
              {alerts.map((alert) => {
                const isHigh = alert.severity === 'high';
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() =>
                      alert.type === 'coding_inconsistency'
                        ? onNavigateCoding(alert.encounterId)
                        : onNavigateDocumentation(undefined, alert.encounterId)
                    }
                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start gap-3 cursor-pointer"
                  >
                    {isHigh ? (
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {alert.title}
                        </span>
                        <span
                          className={`text-[11px] font-medium whitespace-nowrap shrink-0 ${
                            isHigh ? 'text-red-700' : 'text-amber-700'
                          }`}
                        >
                          {isHigh ? 'High Priority' : 'Review Needed'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        {alert.patientName} · {alert.patientId}
                      </p>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {alert.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
