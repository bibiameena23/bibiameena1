import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LogOut,
  Menu,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import type { AuthUser, ClinicalEncounter, PatientRecord } from './types/clinical';
import { apiRequest, setStoredToken } from './lib/api';
import { LoginView } from './components/LoginView';
import { OverviewView, type DashboardAlert } from './components/OverviewView';
import { PatientsView } from './components/PatientsView';
import { DocumentationView } from './components/DocumentationView';
import { CodingAssistantView } from './components/CodingAssistantView';
import { EvaluationView } from './components/EvaluationView';

type ActiveSection = 'overview' | 'patients' | 'documentation' | 'coding' | 'evaluation';

const NAV_ITEMS: Array<{ id: ActiveSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'patients', label: 'Patient Records', icon: Users },
  { id: 'documentation', label: 'Clinical Documentation', icon: FileText },
  { id: 'coding', label: 'Medical Coding', icon: ClipboardCheck },
  { id: 'evaluation', label: 'Quality Evaluation', icon: BarChart3 },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Shared Clinical Data
  const [metrics, setMetrics] = useState({
    totalPatients: 0,
    totalEncounters: 0,
    pendingReview: 0,
    finalizedCount: 0,
    openAlertsCount: 0,
  });
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [encounters, setEncounters] = useState<ClinicalEncounter[]>([]);

  // Deep-link context between views
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  // Inline notification banner (replaces window.alert)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadWorkspaceData = useCallback(async () => {
    const [summaryRes, encountersRes] = await Promise.all([
      apiRequest<{
        metrics: typeof metrics;
        alerts: DashboardAlert[];
        patients: PatientRecord[];
      }>('/api/dashboard/summary'),
      apiRequest<{ encounters: ClinicalEncounter[] }>('/api/encounters'),
    ]);
    setMetrics(summaryRes.metrics);
    setAlerts(summaryRes.alerts);
    setPatients(summaryRes.patients);
    setEncounters(encountersRes.encounters);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await apiRequest<{ user: AuthUser }>('/api/auth/me');
        if (active) {
          setUser(res.user);
          await loadWorkspaceData();
        }
      } catch {
        // Not signed in
      } finally {
        if (active) setCheckingAuth(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [loadWorkspaceData]);

  async function handleLoginSuccess(loggedInUser: AuthUser) {
    setUser(loggedInUser);
    try {
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load clinical data.', 'error');
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout error
    }
    setStoredToken(null);
    setUser(null);
    setActiveSection('overview');
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Initializing VeraChart clinical workspace...
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const activeNavItem = NAV_ITEMS.find((n) => n.id === activeSection)!;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-teal-700 text-white flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap">
            VeraChart
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-800">{user.name}</p>
          <p>
            {user.roleLabel} · {user.credentials}
          </p>
          <p className="text-[11px] text-slate-400 pt-1">
            Synthetic demo environment
          </p>
        </div>
      </aside>

      {/* Mobile Slide-Over Navigation */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-teal-700 text-white flex items-center justify-center">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <span className="font-display text-lg font-semibold text-slate-900">
                  VeraChart
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md ${
                      active ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
              <span className="hidden sm:inline">VeraChart</span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">{activeNavItem.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden md:inline text-xs text-slate-600 whitespace-nowrap">
              {user.name} · {user.roleLabel}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="px-4 sm:px-8 pt-4">
            <div
              role="status"
              className={`max-w-[1320px] mx-auto px-4 py-3 rounded-md border text-xs flex items-center justify-between gap-3 ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-current opacity-70 hover:opacity-100 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <div className="max-w-[1320px] mx-auto">
            {activeSection === 'overview' && (
              <OverviewView
                user={user}
                metrics={metrics}
                alerts={alerts}
                recentEncounters={encounters.slice(0, 8)}
                patients={patients}
                onNavigateDocumentation={(patientId, encounterId) => {
                  setSelectedPatientId(patientId ?? patients[0]?.id ?? null);
                  setSelectedEncounterId(encounterId ?? null);
                  setActiveSection('documentation');
                }}
                onNavigatePatients={(patientId) => {
                  if (patientId) setSelectedPatientId(patientId);
                  setActiveSection('patients');
                }}
                onNavigateCoding={(encounterId) => {
                  if (encounterId) setSelectedEncounterId(encounterId);
                  setActiveSection('coding');
                }}
              />
            )}

            {activeSection === 'patients' && (
              <PatientsView
                user={user}
                patients={patients}
                encounters={encounters}
                selectedPatientId={selectedPatientId}
                onSelectPatient={setSelectedPatientId}
                onPatientCreated={loadWorkspaceData}
                onOpenEncounter={(patientRecordId, encounterId) => {
                  setSelectedPatientId(patientRecordId);
                  setSelectedEncounterId(encounterId ?? null);
                  setActiveSection('documentation');
                }}
                onNotify={notify}
              />
            )}

            {activeSection === 'documentation' && (
              <DocumentationView
                user={user}
                patients={patients}
                encounters={encounters}
                initialPatientId={selectedPatientId}
                initialEncounterId={selectedEncounterId}
                onSaved={async (enc) => {
                  setSelectedEncounterId(enc.id);
                  await loadWorkspaceData();
                }}
                onNotify={notify}
              />
            )}

            {activeSection === 'coding' && (
              <CodingAssistantView
                user={user}
                encounters={encounters}
                initialEncounterId={selectedEncounterId}
                onEncounterUpdated={async () => {
                  await loadWorkspaceData();
                }}
                onNotify={notify}
              />
            )}

            {activeSection === 'evaluation' && (
              <EvaluationView user={user} onNotify={notify} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
