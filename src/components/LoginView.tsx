import React, { useState } from 'react';
import { Lock, ShieldCheck, Stethoscope, UserCheck } from 'lucide-react';
import type { AuthUser } from '../types/clinical';
import { apiRequest, setStoredToken } from '../lib/api';

interface LoginViewProps {
  onLoginSuccess: (user: AuthUser) => void;
}

const DEMO_ACCOUNTS = [
  {
    role: 'Attending Physician',
    name: 'Dr. Elena Vance, MD',
    email: 'elena.vance@verachart.demo',
    pass: 'Physician123!',
    access: 'Full clinical authoring, AI SOAP generation, code review, and final encounter attestation.',
  },
  {
    role: 'Certified Medical Coder',
    name: 'Marcus Chen, CPC',
    email: 'marcus.chen@verachart.demo',
    pass: 'Coder123!',
    access: 'ICD-10-CM / CPT code review, inconsistency audit, and coder verification.',
  },
  {
    role: 'Registered Nurse',
    name: 'Priya Nair, RN',
    email: 'priya.nair@verachart.demo',
    pass: 'Nurse123!',
    access: 'Patient registration, document upload, triage notes, and preliminary AI drafts.',
  },
  {
    role: 'Compliance Officer',
    name: 'David Thorne, RHIA',
    email: 'david.thorne@verachart.demo',
    pass: 'Auditor123!',
    access: 'Read-only record audit, coding quality checks, and clinical benchmark evaluation.',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('elena.vance@verachart.demo');
  const [password, setPassword] = useState('Physician123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ user: AuthUser; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-md bg-teal-700 text-white flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-slate-900">
              VeraChart
            </span>
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Clinical Documentation &amp; Medical Coding Assistant
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-teal-700 mb-2">
                Authorized Healthcare Workspace
              </p>
              <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight mb-2">
                Sign in to VeraChart
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Role-based access controls govern clinical documentation authoring, medical code
                approval, and final physician attestation.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Clinician Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    placeholder="name@verachart.demo"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-md bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{loading ? 'Verifying Credentials...' : 'Sign In'}</span>
                </button>
              </form>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 flex items-start gap-2.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Synthetic Demonstration Environment: All sample records are fictional. Do not enter
                real patient Protected Health Information (PHI). AI outputs require authorized
                clinician review before finalizing.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-8 flex flex-col justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 mb-1">
                Role-Based Demonstration Accounts
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Select any authorized role below to populate credentials and inspect RBAC
                permissions.
              </p>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                {DEMO_ACCOUNTS.map((acct) => {
                  const selected = email === acct.email;
                  return (
                    <button
                      key={acct.email}
                      type="button"
                      onClick={() => {
                        setEmail(acct.email);
                        setPassword(acct.pass);
                        setError(null);
                      }}
                      className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-4 cursor-pointer ${
                        selected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                          <span>{acct.role}</span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-normal text-slate-600">{acct.name}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{acct.access}</p>
                        <p className="font-mono text-xs text-slate-600 mt-1.5">{acct.email}</p>
                      </div>
                      <span
                        className={`text-xs font-medium whitespace-nowrap shrink-0 mt-0.5 ${
                          selected ? 'text-teal-700' : 'text-slate-400'
                        }`}
                      >
                        {selected ? (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Selected
                          </span>
                        ) : (
                          'Use Role'
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Server-enforced session &amp; role verification</span>
              <span className="font-mono">ICD-10-CM · CPT · SOAP</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
