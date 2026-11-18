import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  ShieldAlert,
} from 'lucide-react';
import type {
  AuthUser,
  BenchmarkCase,
  BenchmarkSuiteReport,
} from '../types/clinical';
import { apiRequest } from '../lib/api';

interface EvaluationViewProps {
  user: AuthUser;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const EvaluationView: React.FC<EvaluationViewProps> = ({ user, onNotify }) => {
  const canRun = user.role === 'physician' || user.role === 'coder' || user.role === 'auditor';
  const [cases, setCases] = useState<BenchmarkCase[]>([]);
  const [report, setReport] = useState<BenchmarkSuiteReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await apiRequest<{
          cases: BenchmarkCase[];
          lastReport: BenchmarkSuiteReport | null;
        }>('/api/benchmarks');
        if (active) {
          setCases(res.cases);
          setReport(res.lastReport);
        }
      } catch (err) {
        onNotify(
          err instanceof Error ? err.message : 'Unable to load evaluation benchmarks.',
          'error',
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [onNotify]);

  async function handleRunSuite() {
    setRunning(true);
    try {
      const res = await apiRequest<{ report: BenchmarkSuiteReport }>('/api/benchmarks/run', {
        method: 'POST',
      });
      setReport(res.report);
      onNotify(
        `Evaluated ${res.report.casesEvaluated} verified clinical vignettes using ${res.report.modelUsed}.`,
        'success',
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Benchmark evaluation failed.',
        'error',
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Clinical Documentation &amp; Coding Evaluation
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Measure ICD-10-CM / CPT coding precision, recall, error rate, and missing-information
            detection against verified synthetic clinical examples.
          </p>
        </div>

        {canRun && (
          <button
            type="button"
            disabled={running}
            onClick={handleRunSuite}
            className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating {cases.length} Clinical Cases...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Live Benchmark Suite</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Explicit Clinical Validation Notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 flex items-start gap-3 text-xs text-slate-700">
        <AlertCircle className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Clinical Validation Governance:</strong> Automated AI documentation and coding
          assistance does not achieve 100% accuracy or zero error rates. Reported metrics reflect
          live model evaluation on curated synthetic vignettes and must be paired with mandatory
          human clinician and certified coder review prior to clinical use or billing submission.
        </p>
      </div>

      {/* Aggregate Metrics Strip */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-5 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Coding Precision</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1.5">
              {(report.macroPrecision * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Exact code match ratio</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Coding Recall</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1.5">
              {(report.macroRecall * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Reference code coverage</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Macro F1 Score</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-teal-700 mt-1.5">
              {(report.macroF1 * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Harmonic precision/recall</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Coding Error Rate</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-amber-700 mt-1.5">
              {(report.overallErrorRate * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">(FP + FN) / Total union codes</p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">No-Hallucination Guard</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-1.5">
              {report.groundingPassCount}/{report.casesEvaluated}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              SOAP completeness {(report.avgSoapCompleteness * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {/* Results Table or Unrun Benchmark Case List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Verified Synthetic Clinical Test Suite ({cases.length} Cases)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {report
                ? `Last evaluated ${new Date(report.runAt).toLocaleString()} · Model: ${report.modelUsed}`
                : 'Click "Run Live Benchmark Suite" to compute real-time precision, recall, and error rates.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading benchmark suite...</div>
        ) : report ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Case</th>
                  <th className="py-3 px-4">Expected Codes</th>
                  <th className="py-3 px-4">Predicted Codes</th>
                  <th className="py-3 px-4 text-right">Precision</th>
                  <th className="py-3 px-4 text-right">Recall</th>
                  <th className="py-3 px-4 text-right">Error Rate</th>
                  <th className="py-3 px-4">Grounding</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {report.results.map((r) => (
                  <tr key={r.caseId} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 max-w-[230px]">
                      <div className="font-semibold text-slate-900">
                        <span className="font-mono text-slate-500 mr-1.5">{r.caseId}</span>
                        {r.title}
                      </div>
                      <div className="text-slate-500 mt-0.5">{r.specialty}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                      {r.expectedCodes.join(', ')}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                      {r.predictedCodes.join(', ') || 'None'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {(r.precision * 100).toFixed(0)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {(r.recall * 100).toFixed(0)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {(r.errorRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.groundingPassed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Grounded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5" /> Ungrounded
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {(r.latencyMs / 1000).toFixed(2)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {cases.map((c) => (
              <div key={c.id} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <div className="text-sm font-semibold text-slate-900">
                    <span className="font-mono text-xs text-slate-500 mr-2">{c.id}</span>
                    {c.title}
                  </div>
                  <p className="text-xs text-slate-500">
                    {c.specialty} · {c.patientProfile}
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed mt-1">{c.clinicalInput}</p>
                </div>
                <div className="shrink-0 text-xs space-y-1 md:text-right">
                  <div className="font-semibold text-slate-700">Reference Codes</div>
                  <div className="font-mono tabular-nums text-slate-600">
                    {c.expectedCodes.map((ec) => ec.code).join(' · ')}
                  </div>
                  {c.expectedMissingInfoFields.length > 0 && (
                    <div className="text-amber-700">
                      Expected Gap Traps: {c.expectedMissingInfoFields.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
