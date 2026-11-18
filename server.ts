import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { VERIFIED_BENCHMARK_CASES } from './server/benchmarks.ts';
import {
  authenticateUser,
  createEncounter,
  createPatient,
  destroySession,
  getEncounterById,
  getLastBenchmarkReport,
  getPatientById,
  getSessionUser,
  listEncounters,
  listPatients,
  saveBenchmarkReport,
  updateEncounter,
  updatePatient,
} from './server/db.ts';
import {
  auditEncounterCoding,
  processClinicalEncounter,
  runSingleBenchmarkCase,
} from './server/geminiService.ts';
import type {
  AuthUser,
  BenchmarkSuiteReport,
  ClinicalEncounter,
  EncounterStatus,
  UserRole,
} from './src/types/clinical.ts';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionToken?: string;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/octet-stream',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ['.pdf', '.txt', '.md', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Upload PDF, TXT, MD, or CSV clinical documents.'));
    }
  },
});

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.verachart_session;
  return typeof cookieToken === 'string' ? cookieToken : undefined;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const user = getSessionUser(token);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access restricted. Role "${req.user.roleLabel}" does not have permission for this action.`,
      });
      return;
    }
    next();
  };
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('GEMINI_API_KEY') || message.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'Gemini API key is missing or invalid. Check Settings > Secrets.',
    };
  }
  if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
    return {
      status: 403,
      message: 'Gemini API permission denied. Verify your API key in Settings > Secrets.',
    };
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please retry shortly or check quota.',
    };
  }
  return { status: 500, message };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));

  // --- Authentication Endpoints ---
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const authResult = authenticateUser(email, password);
    if (!authResult) {
      res.status(401).json({ error: 'Invalid clinical credentials.' });
      return;
    }
    res.cookie('verachart_session', authResult.token, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: 1000 * 60 * 60 * 12,
    });
    res.json({ user: authResult.user, token: authResult.token });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req);
    destroySession(token);
    res.clearCookie('verachart_session');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // --- Dashboard Overview ---
  app.get('/api/dashboard/summary', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const patients = listPatients();
    const encounters = listEncounters();
    const pendingReview = encounters.filter((e) => e.status !== 'finalized').length;
    const finalizedCount = encounters.filter((e) => e.status === 'finalized').length;

    const alerts: Array<{
      id: string;
      encounterId: string;
      patientId: string;
      patientName: string;
      type: 'missing_info' | 'coding_inconsistency' | 'unverified_draft';
      severity: 'high' | 'medium' | 'low';
      title: string;
      detail: string;
    }> = [];

    for (const enc of encounters) {
      for (const m of enc.missingInfoAlerts) {
        if (!m.resolved) {
          alerts.push({
            id: m.id,
            encounterId: enc.id,
            patientId: enc.patientId,
            patientName: enc.patientName,
            type: 'missing_info',
            severity: m.severity,
            title: `Missing Documentation: ${m.field}`,
            detail: m.message,
          });
        }
      }
      for (const c of enc.suggestedCodes) {
        if (c.specificityStatus === 'inconsistent' && c.approvalStatus === 'pending') {
          alerts.push({
            id: c.id,
            encounterId: enc.id,
            patientId: enc.patientId,
            patientName: enc.patientName,
            type: 'coding_inconsistency',
            severity: 'high',
            title: `Coding Inconsistency: ${c.system} ${c.code}`,
            detail: c.inconsistencyReason || c.guidelineNote,
          });
        }
      }
      if (enc.aiGenerated && !enc.clinicianAttested) {
        alerts.push({
          id: `att-${enc.id}`,
          encounterId: enc.id,
          patientId: enc.patientId,
          patientName: enc.patientName,
          type: 'unverified_draft',
          severity: 'medium',
          title: 'Awaiting Clinician Review & Attestation',
          detail: `${enc.visitType} (${enc.encounterDate}) contains AI-drafted SOAP notes pending sign-off.`,
        });
      }
    }

    res.json({
      metrics: {
        totalPatients: patients.length,
        totalEncounters: encounters.length,
        pendingReview,
        finalizedCount,
        openAlertsCount: alerts.length,
      },
      alerts,
      recentEncounters: encounters.slice(0, 8),
      patients,
    });
  });

  // --- Patient Records CRUD ---
  app.get('/api/patients', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const query = String(req.query.q ?? '').trim().toLowerCase();
    const patients = listPatients();
    const encounters = listEncounters();

    const enriched = patients.map((p) => {
      const patientEncounters = encounters.filter((e) => e.patientRecordId === p.id);
      const latestEncounter = patientEncounters[0] ?? null;
      const openAlerts = patientEncounters.reduce(
        (sum, e) => sum + e.missingInfoAlerts.filter((a) => !a.resolved).length,
        0,
      );
      return {
        ...p,
        encounterCount: patientEncounters.length,
        latestEncounterDate: latestEncounter?.encounterDate ?? null,
        latestStatus: latestEncounter?.status ?? null,
        latestDiagnosis: latestEncounter?.diagnosisDetails ?? null,
        openAlerts,
      };
    });

    const filtered = query
      ? enriched.filter(
          (p) =>
            p.fullName.toLowerCase().includes(query) ||
            p.patientId.toLowerCase().includes(query) ||
            p.chronicConditions.some((c) => c.toLowerCase().includes(query)) ||
            (p.latestDiagnosis ?? '').toLowerCase().includes(query),
        )
      : enriched;

    res.json({ patients: filtered });
  });

  app.get('/api/patients/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const patient = getPatientById(String(req.params.id));
    if (!patient) {
      res.status(404).json({ error: 'Patient record not found.' });
      return;
    }
    const encounters = listEncounters(patient.id);
    res.json({ patient, encounters });
  });

  app.post(
    '/api/patients',
    requireAuth,
    requireRole(['physician', 'nurse']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body as {
          patientId?: string;
          fullName?: string;
          age?: number;
          gender?: 'Female' | 'Male' | 'Non-binary' | 'Other';
          allergies?: string[] | string;
          chronicConditions?: string[] | string;
          currentMedications?: string[] | string;
          baselineVitals?: string;
        };

        if (!body.fullName || !body.patientId || !body.age || !body.gender) {
          res.status(400).json({
            error: 'Patient Name, Patient ID, Age, and Gender are required.',
          });
          return;
        }

        const toList = (val: string[] | string | undefined): string[] => {
          if (Array.isArray(val)) return val.map((v) => v.trim()).filter(Boolean);
          if (typeof val === 'string') {
            return val
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
          }
          return [];
        };

        const created = createPatient({
          patientId: body.patientId.trim().toUpperCase(),
          fullName: body.fullName.trim(),
          age: Number(body.age),
          gender: body.gender,
          syntheticNote: 'Synthetic demonstration record',
          allergies: toList(body.allergies),
          chronicConditions: toList(body.chronicConditions),
          currentMedications: toList(body.currentMedications),
          baselineVitals: (body.baselineVitals ?? '').trim() || 'Not recorded at registration',
          createdBy: req.user!.name,
        });

        res.status(201).json({ patient: created });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to register patient.';
        res.status(400).json({ error: msg });
      }
    },
  );

  app.patch(
    '/api/patients/:id',
    requireAuth,
    requireRole(['physician', 'nurse']),
    (req: AuthenticatedRequest, res: Response) => {
      const updated = updatePatient(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Patient record not found.' });
        return;
      }
      res.json({ patient: updated });
    },
  );

  // --- Clinical Encounters ---
  app.get('/api/encounters', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const patientRecordId = req.query.patientRecordId
      ? String(req.query.patientRecordId)
      : undefined;
    const encounters = listEncounters(patientRecordId);
    res.json({ encounters });
  });

  app.get('/api/encounters/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const encounter = getEncounterById(String(req.params.id));
    if (!encounter) {
      res.status(404).json({ error: 'Clinical encounter not found.' });
      return;
    }
    res.json({ encounter });
  });

  app.post(
    '/api/encounters',
    requireAuth,
    requireRole(['physician', 'nurse']),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as Partial<ClinicalEncounter>;
      if (!body.patientRecordId || !body.soapNote) {
        res.status(400).json({ error: 'Patient record and SOAP note are required.' });
        return;
      }
      const patient = getPatientById(body.patientRecordId);
      if (!patient) {
        res.status(404).json({ error: 'Referenced patient record does not exist.' });
        return;
      }

      // Enforce human verification before finalizing
      const requestedStatus: EncounterStatus = body.status ?? 'pending_review';
      if (requestedStatus === 'finalized') {
        if (req.user!.role !== 'physician') {
          res.status(403).json({
            error: 'Only an Attending Physician can finalize and attest a clinical encounter.',
          });
          return;
        }
        if (!body.clinicianAttested) {
          res.status(400).json({
            error: 'Clinician review attestation is required before finalizing the record.',
          });
          return;
        }
      }

      const now = new Date().toISOString();
      const created = createEncounter({
        patientRecordId: patient.id,
        patientId: patient.patientId,
        patientName: patient.fullName,
        patientAge: patient.age,
        patientGender: patient.gender,
        encounterDate: body.encounterDate || now.slice(0, 10),
        visitType: body.visitType || 'Outpatient Consultation',
        chiefComplaint: body.chiefComplaint || '',
        rawClinicalNotes: body.rawClinicalNotes || '',
        diagnosisDetails: body.diagnosisDetails || '',
        treatmentPlan: body.treatmentPlan || '',
        labResultsText: body.labResultsText || '',
        uploadedDocuments: body.uploadedDocuments ?? [],
        soapNote: body.soapNote,
        patientMedicalSummary: body.patientMedicalSummary || '',
        clinicalVisitSummary: body.clinicalVisitSummary || '',
        medicationSummary: body.medicationSummary || '',
        historyHighlights: body.historyHighlights ?? [],
        extractedTerms: body.extractedTerms ?? [],
        missingInfoAlerts: body.missingInfoAlerts ?? [],
        suggestedCodes: body.suggestedCodes ?? [],
        status: requestedStatus,
        clinicianAttested: Boolean(body.clinicianAttested),
        attestedBy: body.clinicianAttested ? `${req.user!.name}, ${req.user!.credentials}` : undefined,
        attestedAt: body.clinicianAttested ? now : undefined,
        coderVerified: Boolean(body.coderVerified),
        coderVerifiedBy: body.coderVerified ? `${req.user!.name}, ${req.user!.credentials}` : undefined,
        coderVerifiedAt: body.coderVerified ? now : undefined,
        aiGenerated: Boolean(body.aiGenerated),
        createdBy: req.user!.name,
      });

      res.status(201).json({ encounter: created });
    },
  );

  app.patch(
    '/api/encounters/:id',
    requireAuth,
    requireRole(['physician', 'nurse', 'coder']),
    (req: AuthenticatedRequest, res: Response) => {
      const existing = getEncounterById(String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: 'Clinical encounter not found.' });
        return;
      }

      const body = req.body as Partial<ClinicalEncounter>;
      const role = req.user!.role;
      const now = new Date().toISOString();

      // Enforce RBAC rules per role
      if (role === 'nurse') {
        if (body.status === 'finalized' || body.clinicianAttested) {
          res.status(403).json({
            error: 'Registered Nurses can save drafts for review, but cannot finalize or sign physician encounters.',
          });
          return;
        }
      }

      if (role === 'coder') {
        if (body.soapNote || body.clinicianAttested || body.status === 'finalized') {
          res.status(403).json({
            error: 'Certified Coders can review, edit, and verify medical codes, but cannot alter physician SOAP prose or attest encounters.',
          });
          return;
        }
      }

      if (body.status === 'finalized' && !body.clinicianAttested && !existing.clinicianAttested) {
        res.status(400).json({
          error: 'Explicit human verification attestation is required before finalizing.',
        });
        return;
      }

      const patch: Partial<ClinicalEncounter> = { ...body };
      if (body.clinicianAttested && !existing.clinicianAttested) {
        patch.attestedBy = `${req.user!.name}, ${req.user!.credentials}`;
        patch.attestedAt = now;
      }
      if (body.coderVerified && !existing.coderVerified) {
        patch.coderVerifiedBy = `${req.user!.name}, ${req.user!.credentials}`;
        patch.coderVerifiedAt = now;
      }

      const updated = updateEncounter(existing.id, patch);
      res.json({ encounter: updated });
    },
  );

  // --- AI Clinical Documentation & Document Upload Endpoint ---
  app.post(
    '/api/ai/process-encounter',
    requireAuth,
    requireRole(['physician', 'nurse', 'coder']),
    upload.single('document'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body as Record<string, string | undefined>;
        const file = req.file;

        const hasClinicalText = Boolean(
          (body.doctorNotes && body.doctorNotes.trim()) ||
            (body.symptoms && body.symptoms.trim()) ||
            (body.diagnosisDetails && body.diagnosisDetails.trim()) ||
            (body.labResults && body.labResults.trim()) ||
            file,
        );

        if (!hasClinicalText) {
          res.status(400).json({
            error: 'Provide clinical notes, symptoms, lab reports, or upload a medical document before running AI analysis.',
          });
          return;
        }

        const result = await processClinicalEncounter({
          patientName: body.patientName || '',
          patientId: body.patientId || '',
          age: Number(body.age || 0),
          gender: body.gender || '',
          allergies: body.allergies || '',
          medicalHistory: body.medicalHistory || '',
          medications: body.medications || '',
          symptoms: body.symptoms || '',
          doctorNotes: body.doctorNotes || '',
          diagnosisDetails: body.diagnosisDetails || '',
          treatmentPlan: body.treatmentPlan || '',
          labResults: body.labResults || '',
          visitType: body.visitType || 'Outpatient Consultation',
          uploadedFile: file
            ? {
                originalname: file.originalname,
                mimetype: file.mimetype,
                buffer: file.buffer,
              }
            : undefined,
        });

        res.json({
          analysis: result,
          uploadedDocument: file
            ? {
                id: `doc-${Date.now()}`,
                fileName: file.originalname,
                mimeType: file.mimetype || 'text/plain',
                sizeBytes: file.size,
                uploadedAt: new Date().toISOString(),
                extractedSummary: result.uploadedDocumentSummary || 'Analyzed by Gemini clinical engine.',
              }
            : null,
        });
      } catch (err) {
        const formatted = formatGeminiError(err);
        res.status(formatted.status).json({ error: formatted.message });
      }
    },
  );

  // --- AI Coding Audit Endpoint ---
  app.post(
    '/api/ai/audit-coding',
    requireAuth,
    requireRole(['physician', 'coder', 'auditor']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { encounterId } = req.body as { encounterId?: string };
        if (!encounterId) {
          res.status(400).json({ error: 'encounterId is required.' });
          return;
        }
        const encounter = getEncounterById(encounterId);
        if (!encounter) {
          res.status(404).json({ error: 'Encounter not found.' });
          return;
        }

        const auditResult = await auditEncounterCoding({
          patientAge: encounter.patientAge,
          patientGender: encounter.patientGender,
          soapNote: encounter.soapNote,
          existingCodes: encounter.suggestedCodes,
        });

        res.json(auditResult);
      } catch (err) {
        const formatted = formatGeminiError(err);
        res.status(formatted.status).json({ error: formatted.message });
      }
    },
  );

  // --- Verified Clinical Evaluation Benchmark Endpoints ---
  app.get('/api/benchmarks', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      cases: VERIFIED_BENCHMARK_CASES,
      lastReport: getLastBenchmarkReport(),
    });
  });

  app.post(
    '/api/benchmarks/run',
    requireAuth,
    requireRole(['physician', 'coder', 'auditor']),
    async (_req: AuthenticatedRequest, res: Response) => {
      try {
        const results = [];
        for (const benchCase of VERIFIED_BENCHMARK_CASES) {
          const caseResult = await runSingleBenchmarkCase(benchCase);
          results.push(caseResult);
        }

        const n = results.length || 1;
        const totalTp = results.reduce((s, r) => s + r.truePositives, 0);
        const totalFp = results.reduce((s, r) => s + r.falsePositives, 0);
        const totalFn = results.reduce((s, r) => s + r.falseNegatives, 0);
        const macroPrecision = results.reduce((s, r) => s + r.precision, 0) / n;
        const macroRecall = results.reduce((s, r) => s + r.recall, 0) / n;
        const macroF1 = results.reduce((s, r) => s + r.f1Score, 0) / n;
        const unionTotal = totalTp + totalFp + totalFn;
        const overallErrorRate = unionTotal > 0 ? (totalFp + totalFn) / unionTotal : 0;
        const avgMissingDetectionRate =
          results.reduce((s, r) => s + r.missingDetectionRate, 0) / n;
        const avgSoapCompleteness =
          results.reduce((s, r) => s + r.soapCompleteness, 0) / n;
        const groundingPassCount = results.filter((r) => r.groundingPassed).length;

        const report: BenchmarkSuiteReport = {
          runAt: new Date().toISOString(),
          modelUsed: 'gemini-4-hydrogen',
          casesEvaluated: results.length,
          macroPrecision: Number(macroPrecision.toFixed(3)),
          macroRecall: Number(macroRecall.toFixed(3)),
          macroF1: Number(macroF1.toFixed(3)),
          overallErrorRate: Number(overallErrorRate.toFixed(3)),
          avgMissingDetectionRate: Number(avgMissingDetectionRate.toFixed(3)),
          avgSoapCompleteness: Number(avgSoapCompleteness.toFixed(3)),
          groundingPassCount,
          results,
        };

        saveBenchmarkReport(report);
        res.json({ report });
      } catch (err) {
        const formatted = formatGeminiError(err);
        res.status(formatted.status).json({ error: formatted.message });
      }
    },
  );

  // --- Error Handler for Multer / JSON ---
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: err.message || 'Invalid request payload.' });
  });

  // --- Vite Dev Middleware or Production Static Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`VeraChart Clinical Assistant server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
