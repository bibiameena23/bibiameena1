export type UserRole = 'physician' | 'coder' | 'nurse' | 'auditor';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  credentials: string;
  department: string;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface MissingInfoAlert {
  id: string;
  field: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  clarifyingQuestion: string;
  resolved: boolean;
}

export interface MedicalCodeSuggestion {
  id: string;
  system: 'ICD-10-CM' | 'CPT';
  code: string;
  description: string;
  category: 'Diagnosis' | 'Procedure' | 'Symptom';
  evidenceSnippet: string;
  guidelineNote: string;
  specificityStatus: 'specific' | 'unspecified' | 'inconsistent';
  inconsistencyReason?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface UploadedDocMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  extractedSummary?: string;
}

export interface PatientRecord {
  id: string;
  patientId: string;
  fullName: string;
  age: number;
  gender: 'Female' | 'Male' | 'Non-binary' | 'Other';
  syntheticNote: string;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  baselineVitals: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type EncounterStatus = 'draft' | 'pending_review' | 'finalized';

export interface ClinicalEncounter {
  id: string;
  patientRecordId: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  encounterDate: string;
  visitType: string;
  chiefComplaint: string;
  rawClinicalNotes: string;
  diagnosisDetails: string;
  treatmentPlan: string;
  labResultsText: string;
  uploadedDocuments: UploadedDocMeta[];
  soapNote: SoapNote;
  patientMedicalSummary: string;
  clinicalVisitSummary: string;
  medicationSummary: string;
  historyHighlights: string[];
  extractedTerms: string[];
  missingInfoAlerts: MissingInfoAlert[];
  suggestedCodes: MedicalCodeSuggestion[];
  status: EncounterStatus;
  clinicianAttested: boolean;
  attestedBy?: string;
  attestedAt?: string;
  coderVerified: boolean;
  coderVerifiedBy?: string;
  coderVerifiedAt?: string;
  aiGenerated: boolean;
  createdBy: string;
  updatedAt: string;
}

export interface BenchmarkCase {
  id: string;
  title: string;
  specialty: string;
  patientProfile: string;
  clinicalInput: string;
  expectedCodes: { code: string; system: 'ICD-10-CM' | 'CPT'; description: string }[];
  expectedMissingInfoFields: string[];
  prohibitedFabrications: string[];
}

export interface BenchmarkCaseResult {
  caseId: string;
  title: string;
  specialty: string;
  predictedCodes: string[];
  expectedCodes: string[];
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  errorRate: number;
  missingAlertsDetected: string[];
  expectedMissingInfoFields: string[];
  missingDetectionRate: number;
  soapCompleteness: number;
  groundingPassed: boolean;
  latencyMs: number;
  summaryNote: string;
}

export interface BenchmarkSuiteReport {
  runAt: string;
  modelUsed: string;
  casesEvaluated: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  overallErrorRate: number;
  avgMissingDetectionRate: number;
  avgSoapCompleteness: number;
  groundingPassCount: number;
  results: BenchmarkCaseResult[];
}
