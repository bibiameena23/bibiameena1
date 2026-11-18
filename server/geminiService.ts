import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import crypto from 'node:crypto';
import type {
  BenchmarkCase,
  BenchmarkCaseResult,
  MedicalCodeSuggestion,
  MissingInfoAlert,
  SoapNote,
} from '../src/types/clinical.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ProcessEncounterInput {
  patientName: string;
  patientId: string;
  age: number;
  gender: string;
  allergies: string;
  medicalHistory: string;
  medications: string;
  symptoms: string;
  doctorNotes: string;
  diagnosisDetails: string;
  treatmentPlan: string;
  labResults: string;
  visitType: string;
  uploadedFile?: {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
  };
}

export interface ProcessedEncounterOutput {
  soapNote: SoapNote;
  patientMedicalSummary: string;
  clinicalVisitSummary: string;
  medicationSummary: string;
  historyHighlights: string[];
  extractedTerms: string[];
  missingInfoAlerts: MissingInfoAlert[];
  suggestedCodes: MedicalCodeSuggestion[];
  uploadedDocumentSummary?: string;
}

const CLINICAL_SYSTEM_INSTRUCTION = `You are a clinical documentation integrity and medical coding specialist assistant supporting licensed healthcare professionals.

STRICT CLINICAL GROUNDING RULES:
1. NEVER invent, fabricate, or assume missing clinical values (such as vital signs, lab numbers, anatomical laterality, symptom duration, medication dosages, or test results) that are not explicitly present in the provided notes or attached document.
2. When clinical information required for complete documentation or specific ICD-10-CM/CPT coding is absent or ambiguous, explicitly write "[Not documented in source]" inside the relevant SOAP section and create a clear entry in missingInfoAlerts.
3. Structure the SOAP note using formal, objective medical terminology:
   - Subjective: Patient-reported symptoms, complaints, duration, and relevant history.
   - Objective: Documented vitals, physical exam observations, and laboratory/imaging findings.
   - Assessment: Clinician-documented diagnoses, differential considerations, and clinical status.
   - Plan: Medications, diagnostic orders, patient education, and follow-up plan.
4. For Medical Coding (ICD-10-CM and CPT):
   - Extract exact evidenceSnippet text from the source justifying each suggested code.
   - Evaluate specificityStatus:
     * "specific": Fully supported with required specificity (e.g., laterality, stage, encounter type).
     * "unspecified": Valid general code, but source omits details needed for higher specificity (explain in inconsistencyReason).
     * "inconsistent": Potential conflict, demographic mismatch, missing linkage, or undocumented clinical justification (explain in inconsistencyReason).
   - Provide concise guidelineNote explaining the applicable ICD-10-CM or CPT coding rule.
5. Output strictly valid JSON matching the requested schema.`;

const ENCOUNTER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    soapNote: {
      type: Type.OBJECT,
      properties: {
        subjective: { type: Type.STRING },
        objective: { type: Type.STRING },
        assessment: { type: Type.STRING },
        plan: { type: Type.STRING },
      },
      required: ['subjective', 'objective', 'assessment', 'plan'],
    },
    patientMedicalSummary: { type: Type.STRING },
    clinicalVisitSummary: { type: Type.STRING },
    medicationSummary: { type: Type.STRING },
    uploadedDocumentSummary: { type: Type.STRING },
    historyHighlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    extractedTerms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    missingInfoAlerts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING },
          severity: { type: Type.STRING },
          message: { type: Type.STRING },
          clarifyingQuestion: { type: Type.STRING },
        },
        required: ['field', 'severity', 'message', 'clarifyingQuestion'],
      },
    },
    suggestedCodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          system: { type: Type.STRING },
          code: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          evidenceSnippet: { type: Type.STRING },
          guidelineNote: { type: Type.STRING },
          specificityStatus: { type: Type.STRING },
          inconsistencyReason: { type: Type.STRING },
        },
        required: [
          'system',
          'code',
          'description',
          'category',
          'evidenceSnippet',
          'guidelineNote',
          'specificityStatus',
        ],
      },
    },
  },
  required: [
    'soapNote',
    'patientMedicalSummary',
    'clinicalVisitSummary',
    'medicationSummary',
    'historyHighlights',
    'extractedTerms',
    'missingInfoAlerts',
    'suggestedCodes',
  ],
};

function normalizeSeverity(val: string): 'high' | 'medium' | 'low' {
  const lower = val.toLowerCase();
  if (lower === 'high') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

function normalizeSpecificity(val: string): 'specific' | 'unspecified' | 'inconsistent' {
  const lower = val.toLowerCase();
  if (lower === 'inconsistent') return 'inconsistent';
  if (lower === 'unspecified') return 'unspecified';
  return 'specific';
}

export async function processClinicalEncounter(
  input: ProcessEncounterInput,
): Promise<ProcessedEncounterOutput> {
  const ai = getAiClient();

  let uploadedTextAppendix = '';
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (input.uploadedFile) {
    const { originalname, mimetype, buffer } = input.uploadedFile;
    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: buffer.toString('base64'),
        },
      });
      uploadedTextAppendix = `\nAttached PDF Medical Document: ${originalname} (analyze its clinical contents alongside the structured input below).`;
    } else {
      const decodedText = buffer.toString('utf-8').slice(0, 40000);
      uploadedTextAppendix = `\n--- ATTACHED MEDICAL DOCUMENT (${originalname}) ---\n${decodedText}\n--- END ATTACHED DOCUMENT ---`;
    }
  }

  const promptText = `Analyze the following synthetic clinical encounter and generate structured SOAP documentation, summaries, missing documentation alerts, and validated ICD-10-CM / CPT code suggestions.

PATIENT PROFILE:
- Name: ${input.patientName || '[Not documented]'}
- Patient ID: ${input.patientId || '[Not documented]'}
- Age: ${Number.isFinite(input.age) && input.age > 0 ? input.age : '[Not documented]'}
- Gender: ${input.gender || '[Not documented]'}
- Visit Type: ${input.visitType || 'Outpatient Consultation'}
- Allergies: ${input.allergies || '[Not documented]'}
- Medical History: ${input.medicalHistory || '[Not documented]'}
- Current Medications: ${input.medications || '[Not documented]'}

CLINICAL INPUT:
- Symptoms & Chief Complaints: ${input.symptoms || '[Not documented]'}
- Doctor Consultation & Clinical Notes: ${input.doctorNotes || '[Not documented]'}
- Diagnosis Details: ${input.diagnosisDetails || '[Not documented]'}
- Treatment & Medication Plan: ${input.treatmentPlan || '[Not documented]'}
- Laboratory / Diagnostic Test Reports: ${input.labResults || '[Not documented]'}
${uploadedTextAppendix}`;

  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts },
    config: {
      systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: ENCOUNTER_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    soapNote: SoapNote;
    patientMedicalSummary: string;
    clinicalVisitSummary: string;
    medicationSummary: string;
    uploadedDocumentSummary?: string;
    historyHighlights: string[];
    extractedTerms: string[];
    missingInfoAlerts: Array<{
      field: string;
      severity: string;
      message: string;
      clarifyingQuestion: string;
    }>;
    suggestedCodes: Array<{
      system: string;
      code: string;
      description: string;
      category: string;
      evidenceSnippet: string;
      guidelineNote: string;
      specificityStatus: string;
      inconsistencyReason?: string;
    }>;
  };

  return {
    soapNote: parsed.soapNote,
    patientMedicalSummary: parsed.patientMedicalSummary,
    clinicalVisitSummary: parsed.clinicalVisitSummary,
    medicationSummary: parsed.medicationSummary,
    uploadedDocumentSummary: parsed.uploadedDocumentSummary,
    historyHighlights: parsed.historyHighlights ?? [],
    extractedTerms: parsed.extractedTerms ?? [],
    missingInfoAlerts: (parsed.missingInfoAlerts ?? []).map((a) => ({
      id: `alert-${crypto.randomUUID().slice(0, 8)}`,
      field: a.field,
      severity: normalizeSeverity(a.severity),
      message: a.message,
      clarifyingQuestion: a.clarifyingQuestion,
      resolved: false,
    })),
    suggestedCodes: (parsed.suggestedCodes ?? []).map((c) => ({
      id: `code-${crypto.randomUUID().slice(0, 8)}`,
      system: c.system.toUpperCase().includes('CPT') ? 'CPT' : 'ICD-10-CM',
      code: c.code.trim().toUpperCase(),
      description: c.description,
      category:
        c.category === 'Procedure'
          ? 'Procedure'
          : c.category === 'Symptom'
            ? 'Symptom'
            : 'Diagnosis',
      evidenceSnippet: c.evidenceSnippet,
      guidelineNote: c.guidelineNote,
      specificityStatus: normalizeSpecificity(c.specificityStatus),
      inconsistencyReason: c.inconsistencyReason || undefined,
      approvalStatus: 'pending',
    })),
  };
}

export async function auditEncounterCoding(params: {
  patientAge: number;
  patientGender: string;
  soapNote: SoapNote;
  existingCodes: MedicalCodeSuggestion[];
}): Promise<{
  auditSummary: string;
  suggestedCodes: MedicalCodeSuggestion[];
  missingInfoAlerts: MissingInfoAlert[];
}> {
  const ai = getAiClient();

  const auditSchema = {
    type: Type.OBJECT,
    properties: {
      auditSummary: { type: Type.STRING },
      missingInfoAlerts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            field: { type: Type.STRING },
            severity: { type: Type.STRING },
            message: { type: Type.STRING },
            clarifyingQuestion: { type: Type.STRING },
          },
          required: ['field', 'severity', 'message', 'clarifyingQuestion'],
        },
      },
      suggestedCodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            system: { type: Type.STRING },
            code: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            evidenceSnippet: { type: Type.STRING },
            guidelineNote: { type: Type.STRING },
            specificityStatus: { type: Type.STRING },
            inconsistencyReason: { type: Type.STRING },
          },
          required: [
            'system',
            'code',
            'description',
            'category',
            'evidenceSnippet',
            'guidelineNote',
            'specificityStatus',
          ],
        },
      },
    },
    required: ['auditSummary', 'missingInfoAlerts', 'suggestedCodes'],
  };

  const prompt = `Perform a strict ICD-10-CM and CPT coding compliance audit on the following clinical SOAP documentation and current candidate codes.

Patient Demographics: Age ${params.patientAge}, Gender ${params.patientGender}

SOAP NOTE:
- Subjective: ${params.soapNote.subjective}
- Objective: ${params.soapNote.objective}
- Assessment: ${params.soapNote.assessment}
- Plan: ${params.soapNote.plan}

CURRENT CODES UNDER REVIEW:
${params.existingCodes.map((c) => `- ${c.system} ${c.code}: ${c.description} (Status: ${c.approvalStatus})`).join('\n') || 'None'}

Check for:
1. Gender or age-to-diagnosis incompatibilities.
2. Unspecified codes where SOAP note contains greater specificity (laterality, stage, initial vs subsequent encounter).
3. Symptom codes listed alongside confirmed definitive etiology without separate justification.
4. E/M CPT level alignment with documented Medical Decision Making (MDM).
5. Missing documentation preventing final code assignment.

Return the complete audited list of recommended codes and any documentation alerts.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: auditSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    auditSummary: string;
    missingInfoAlerts: Array<{
      field: string;
      severity: string;
      message: string;
      clarifyingQuestion: string;
    }>;
    suggestedCodes: Array<{
      system: string;
      code: string;
      description: string;
      category: string;
      evidenceSnippet: string;
      guidelineNote: string;
      specificityStatus: string;
      inconsistencyReason?: string;
    }>;
  };

  return {
    auditSummary: parsed.auditSummary,
    missingInfoAlerts: (parsed.missingInfoAlerts ?? []).map((a) => ({
      id: `alert-${crypto.randomUUID().slice(0, 8)}`,
      field: a.field,
      severity: normalizeSeverity(a.severity),
      message: a.message,
      clarifyingQuestion: a.clarifyingQuestion,
      resolved: false,
    })),
    suggestedCodes: (parsed.suggestedCodes ?? []).map((c) => ({
      id: `code-${crypto.randomUUID().slice(0, 8)}`,
      system: c.system.toUpperCase().includes('CPT') ? 'CPT' : 'ICD-10-CM',
      code: c.code.trim().toUpperCase(),
      description: c.description,
      category:
        c.category === 'Procedure'
          ? 'Procedure'
          : c.category === 'Symptom'
            ? 'Symptom'
            : 'Diagnosis',
      evidenceSnippet: c.evidenceSnippet,
      guidelineNote: c.guidelineNote,
      specificityStatus: normalizeSpecificity(c.specificityStatus),
      inconsistencyReason: c.inconsistencyReason || undefined,
      approvalStatus: 'pending',
    })),
  };
}

export async function runSingleBenchmarkCase(
  bench: BenchmarkCase,
): Promise<BenchmarkCaseResult> {
  const start = Date.now();
  const output = await processClinicalEncounter({
    patientName: `Benchmark ${bench.id}`,
    patientId: bench.id,
    age: 0,
    gender: 'Not specified in profile',
    allergies: '',
    medicalHistory: bench.patientProfile,
    medications: '',
    symptoms: '',
    doctorNotes: bench.clinicalInput,
    diagnosisDetails: '',
    treatmentPlan: '',
    labResults: '',
    visitType: bench.specialty,
  });
  const latencyMs = Date.now() - start;

  const expectedSet = new Set(bench.expectedCodes.map((c) => c.code.toUpperCase()));
  const predictedCodes = Array.from(new Set(output.suggestedCodes.map((c) => c.code.toUpperCase())));
  const predictedSet = new Set(predictedCodes);

  let tp = 0;
  for (const code of predictedSet) {
    if (expectedSet.has(code)) {
      tp += 1;
    }
  }
  const fp = Math.max(0, predictedSet.size - tp);
  const fn = Math.max(0, expectedSet.size - tp);

  const precision = predictedSet.size > 0 ? tp / predictedSet.size : 0;
  const recall = expectedSet.size > 0 ? tp / expectedSet.size : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const unionSize = new Set([...expectedSet, ...predictedSet]).size;
  const errorRate = unionSize > 0 ? (fp + fn) / unionSize : 0;

  // Evaluate missing info detection
  const alertBlob = output.missingInfoAlerts
    .map((a) => `${a.field} ${a.message} ${a.clarifyingQuestion}`.toLowerCase())
    .join(' ');
  let detectedCount = 0;
  for (const expectedField of bench.expectedMissingInfoFields) {
    const tokens = expectedField
      .toLowerCase()
      .split(/[\s/(),]+/)
      .filter((t) => t.length >= 4);
    if (tokens.some((tok) => alertBlob.includes(tok))) {
      detectedCount += 1;
    }
  }
  const missingDetectionRate =
    bench.expectedMissingInfoFields.length === 0
      ? 1
      : detectedCount / bench.expectedMissingInfoFields.length;

  // Evaluate SOAP completeness (non-empty sections)
  const sections = [
    output.soapNote.subjective,
    output.soapNote.objective,
    output.soapNote.assessment,
    output.soapNote.plan,
  ];
  const filledCount = sections.filter((s) => s && s.trim().length > 15).length;
  const soapCompleteness = filledCount / 4;

  // Grounding check against prohibited fabrications
  const combinedSoap = sections.join(' ').toLowerCase();
  const fabricated = bench.prohibitedFabrications.some((phrase) =>
    combinedSoap.includes(phrase.toLowerCase()),
  );

  return {
    caseId: bench.id,
    title: bench.title,
    specialty: bench.specialty,
    predictedCodes,
    expectedCodes: Array.from(expectedSet),
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1Score: Number(f1Score.toFixed(3)),
    errorRate: Number(errorRate.toFixed(3)),
    missingAlertsDetected: output.missingInfoAlerts.map((a) => a.field),
    expectedMissingInfoFields: bench.expectedMissingInfoFields,
    missingDetectionRate: Number(missingDetectionRate.toFixed(3)),
    soapCompleteness: Number(soapCompleteness.toFixed(3)),
    groundingPassed: !fabricated,
    latencyMs,
    summaryNote: fabricated
      ? 'Flagged ungrounded phrase in generated SOAP text.'
      : `Matched ${tp}/${expectedSet.size} reference codes; ${output.missingInfoAlerts.length} gap alert(s) surfaced.`,
  };
}
