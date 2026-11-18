import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuthUser,
  BenchmarkSuiteReport,
  ClinicalEncounter,
  PatientRecord,
  UserRole,
} from '../src/types/clinical.ts';

interface StoredUser extends AuthUser {
  passwordHash: string;
  passwordSalt: string;
}

interface SessionEntry {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface DatabaseSchema {
  users: StoredUser[];
  patients: PatientRecord[];
  encounters: ClinicalEncounter[];
  lastBenchmarkReport: BenchmarkSuiteReport | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'verachart-db.json');

const sessions = new Map<string, SessionEntry>();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function makeUser(
  id: string,
  name: string,
  email: string,
  role: UserRole,
  roleLabel: string,
  credentials: string,
  department: string,
  plainPassword: string,
): StoredUser {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  return {
    id,
    name,
    email,
    role,
    roleLabel,
    credentials,
    department,
    passwordSalt,
    passwordHash: hashPassword(plainPassword, passwordSalt),
  };
}

function createInitialData(): DatabaseSchema {
  const users: StoredUser[] = [
    makeUser(
      'usr-phys-1',
      'Dr. Elena Vance',
      'elena.vance@verachart.demo',
      'physician',
      'Attending Physician',
      'MD, FACP',
      'Internal Medicine',
      'Physician123!',
    ),
    makeUser(
      'usr-coder-1',
      'Marcus Chen',
      'marcus.chen@verachart.demo',
      'coder',
      'Certified Medical Coder',
      'CPC, CCS',
      'Health Information Management',
      'Coder123!',
    ),
    makeUser(
      'usr-nurse-1',
      'Priya Nair',
      'priya.nair@verachart.demo',
      'nurse',
      'Registered Nurse',
      'RN, BSN',
      'Outpatient Clinical Triage',
      'Nurse123!',
    ),
    makeUser(
      'usr-audit-1',
      'David Thorne',
      'david.thorne@verachart.demo',
      'auditor',
      'Compliance & Quality Officer',
      'RHIA, CHC',
      'Clinical Documentation Integrity',
      'Auditor123!',
    ),
  ];

  const patients: PatientRecord[] = [
    {
      id: 'pat-rec-101',
      patientId: 'PT-4012',
      fullName: 'Arthur Pendelton',
      age: 64,
      gender: 'Male',
      syntheticNote: 'Synthetic demonstration record',
      allergies: ['Sulfa drugs (rash)'],
      chronicConditions: ['Type 2 diabetes mellitus', 'Essential hypertension', 'Hyperlipidemia'],
      currentMedications: ['Metformin 1000 mg BID', 'Lisinopril 20 mg daily', 'Atorvastatin 40 mg nightly'],
      baselineVitals: 'BP 136/82 mmHg · HR 74 bpm · BMI 29.1',
      createdAt: '2026-08-14T09:30:00.000Z',
      updatedAt: '2026-11-16T14:20:00.000Z',
      createdBy: 'Dr. Elena Vance',
    },
    {
      id: 'pat-rec-102',
      patientId: 'PT-4019',
      fullName: 'Clara Morales',
      age: 52,
      gender: 'Female',
      syntheticNote: 'Synthetic demonstration record',
      allergies: ['No known drug allergies'],
      chronicConditions: ['Mild intermittent asthma', 'Seasonal allergic rhinitis'],
      currentMedications: ['Albuterol HFA 90 mcg PRN', 'Fluticasone nasal spray daily'],
      baselineVitals: 'BP 118/76 mmHg · HR 82 bpm · SpO2 97% RA',
      createdAt: '2026-09-02T11:15:00.000Z',
      updatedAt: '2026-11-17T10:05:00.000Z',
      createdBy: 'Priya Nair',
    },
    {
      id: 'pat-rec-103',
      patientId: 'PT-4025',
      fullName: 'Samuel Okafor',
      age: 39,
      gender: 'Male',
      syntheticNote: 'Synthetic demonstration record',
      allergies: ['Ibuprofen (gastric upset)'],
      chronicConditions: ['None reported'],
      currentMedications: ['None'],
      baselineVitals: 'BP 122/78 mmHg · HR 64 bpm · BMI 24.3',
      createdAt: '2026-10-18T15:40:00.000Z',
      updatedAt: '2026-11-15T16:10:00.000Z',
      createdBy: 'Dr. Elena Vance',
    },
    {
      id: 'pat-rec-104',
      patientId: 'PT-4031',
      fullName: 'Evelyn Lindqvist',
      age: 71,
      gender: 'Female',
      syntheticNote: 'Synthetic demonstration record',
      allergies: ['Penicillin (anaphylaxis)', 'Latex'],
      chronicConditions: ['Atrial fibrillation (paroxysmal)', 'Osteoarthritis, bilateral knees', 'Hypothyroidism'],
      currentMedications: ['Apixaban 5 mg BID', 'Levothyroxine 75 mcg daily', 'Metoprolol succinate 50 mg daily'],
      baselineVitals: 'BP 128/74 mmHg · HR 68 bpm · SpO2 98% RA',
      createdAt: '2026-07-21T08:50:00.000Z',
      updatedAt: '2026-11-17T16:45:00.000Z',
      createdBy: 'Dr. Elena Vance',
    },
    {
      id: 'pat-rec-105',
      patientId: 'PT-4038',
      fullName: 'Mateo Alvarez',
      age: 46,
      gender: 'Male',
      syntheticNote: 'Synthetic demonstration record',
      allergies: ['No known drug allergies'],
      chronicConditions: ['Gastroesophageal reflux disease (GERD)', 'Generalized anxiety disorder'],
      currentMedications: ['Omeprazole 20 mg daily', 'Sertraline 50 mg daily'],
      baselineVitals: 'BP 130/84 mmHg · HR 78 bpm · BMI 27.6',
      createdAt: '2026-10-29T13:10:00.000Z',
      updatedAt: '2026-11-12T11:30:00.000Z',
      createdBy: 'Priya Nair',
    },
  ];

  const encounters: ClinicalEncounter[] = [
    {
      id: 'enc-2001',
      patientRecordId: 'pat-rec-101',
      patientId: 'PT-4012',
      patientName: 'Arthur Pendelton',
      patientAge: 64,
      patientGender: 'Male',
      encounterDate: '2026-11-16',
      visitType: 'Follow-up Outpatient Visit',
      chiefComplaint: 'Quarterly diabetes and renal function follow-up with mild ankle edema',
      rawClinicalNotes:
        'Patient presents for 3-month diabetes follow-up. Takes metformin 1000 mg BID and lisinopril 20 mg daily consistently. Reports mild bilateral ankle swelling over 2 weeks without orthopnea or chest pain. Exam: BP 138/84, HR 76, 1+ pitting pedal edema bilaterally, lungs clear. Labs: HbA1c 8.1%, eGFR 48 mL/min/1.73m2, urine ACR 145 mg/g. Add empagliflozin 10 mg daily for cardiorenal protection.',
      diagnosisDetails: 'Type 2 diabetes mellitus with diabetic stage 3a CKD; controlled essential hypertension',
      treatmentPlan: 'Continue metformin and lisinopril; start empagliflozin 10 mg PO daily; repeat BMP and HbA1c in 3 months',
      labResultsText: 'HbA1c: 8.1% (H) | eGFR: 48 mL/min/1.73m2 (L) | Urine ACR: 145 mg/g (H) | K+: 4.4 mEq/L',
      uploadedDocuments: [
        {
          id: 'doc-1',
          fileName: 'pendelton_renal_metabolic_panel_nov2026.txt',
          mimeType: 'text/plain',
          sizeBytes: 1420,
          uploadedAt: '2026-11-16T14:00:00.000Z',
          extractedSummary: 'HbA1c 8.1%, eGFR 48, Urine ACR 145 mg/g indicating stage 3a CKD.',
        },
      ],
      soapNote: {
        subjective:
          '64-year-old male presents for scheduled 3-month diabetes follow-up. Reports consistent adherence to metformin 1000 mg BID and lisinopril 20 mg daily. Endorses mild bilateral ankle swelling for 2 weeks. Denies chest pain, dyspnea on exertion, or orthopnea.',
        objective:
          'BP 138/84 mmHg, HR 76 bpm. Cardiovascular: regular rate and rhythm without murmurs. Pulmonary: lungs clear to auscultation bilaterally. Extremities: 1+ pitting edema bilaterally at ankles. Labs: HbA1c 8.1%, eGFR 48 mL/min/1.73m2, Urine ACR 145 mg/g, Potassium 4.4 mEq/L.',
        assessment:
          '1. Type 2 diabetes mellitus with diabetic chronic kidney disease (stage 3a, eGFR 48, elevated urine ACR 145 mg/g).\n2. Essential hypertension, adequately controlled on lisinopril.',
        plan:
          '1. Initiate empagliflozin 10 mg PO once daily for glycemic control and nephroprotection.\n2. Continue metformin 1000 mg BID and lisinopril 20 mg daily.\n3. Order repeat basic metabolic panel and HbA1c in 3 months.\n4. Counsel patient to monitor ankle swelling and report sudden weight gain or dyspnea.',
      },
      patientMedicalSummary:
        '64-year-old male with Type 2 diabetes complicated by stage 3a diabetic CKD (eGFR 48, albuminuria) and essential hypertension, currently managed on metformin, lisinopril, and atorvastatin.',
      clinicalVisitSummary:
        'Outpatient chronic disease follow-up demonstrating suboptimal glycemic control (HbA1c 8.1%) and progression to stage 3a diabetic nephropathy. Empagliflozin added for dual glycemic and renal protection.',
      medicationSummary:
        'Active: Metformin 1000 mg BID, Lisinopril 20 mg daily, Atorvastatin 40 mg nightly. Added: Empagliflozin 10 mg daily.',
      historyHighlights: [
        'Sulfa drug allergy (cutaneous rash)',
        'Stage 3a CKD (eGFR 48 mL/min/1.73m2) with microalbuminuria (ACR 145 mg/g)',
        'HbA1c above target at 8.1%',
      ],
      extractedTerms: ['Type 2 diabetes mellitus', 'diabetic chronic kidney disease', 'stage 3a', 'albuminuria', 'ankle edema', 'empagliflozin'],
      missingInfoAlerts: [],
      suggestedCodes: [
        {
          id: 'code-2001-1',
          system: 'ICD-10-CM',
          code: 'E11.22',
          description: 'Type 2 diabetes mellitus with diabetic chronic kidney disease',
          category: 'Diagnosis',
          evidenceSnippet: 'Type 2 diabetes mellitus with diabetic stage 3a CKD; Urine ACR 145 mg/g',
          guidelineNote: 'ICD-10-CM instructs causal linkage between T2DM and CKD plus secondary N18.x stage code.',
          specificityStatus: 'specific',
          approvalStatus: 'approved',
          reviewedBy: 'Marcus Chen, CPC',
          reviewedAt: '2026-11-16T15:10:00.000Z',
        },
        {
          id: 'code-2001-2',
          system: 'ICD-10-CM',
          code: 'N18.31',
          description: 'Chronic kidney disease, stage 3a',
          category: 'Diagnosis',
          evidenceSnippet: 'eGFR 48 mL/min/1.73m2',
          guidelineNote: 'Required additional code with E11.22 to specify CKD stage 3a (eGFR 45–59).',
          specificityStatus: 'specific',
          approvalStatus: 'approved',
          reviewedBy: 'Marcus Chen, CPC',
          reviewedAt: '2026-11-16T15:10:00.000Z',
        },
        {
          id: 'code-2001-3',
          system: 'ICD-10-CM',
          code: 'I10',
          description: 'Essential (primary) hypertension',
          category: 'Diagnosis',
          evidenceSnippet: 'controlled essential hypertension; BP 138/84',
          guidelineNote: 'Code I10 as co-existing chronic condition addressed with lisinopril continuation.',
          specificityStatus: 'specific',
          approvalStatus: 'approved',
          reviewedBy: 'Marcus Chen, CPC',
          reviewedAt: '2026-11-16T15:10:00.000Z',
        },
        {
          id: 'code-2001-4',
          system: 'CPT',
          code: '99214',
          description: 'Office or other outpatient visit, established patient, moderate MDM',
          category: 'Procedure',
          evidenceSnippet: '3-month follow-up, chronic illness with progression, prescription drug management (empagliflozin)',
          guidelineNote: 'Moderate MDM supported by >=2 stable/worsening chronic illnesses and new Rx initiation.',
          specificityStatus: 'specific',
          approvalStatus: 'approved',
          reviewedBy: 'Marcus Chen, CPC',
          reviewedAt: '2026-11-16T15:10:00.000Z',
        },
      ],
      status: 'finalized',
      clinicianAttested: true,
      attestedBy: 'Dr. Elena Vance, MD',
      attestedAt: '2026-11-16T14:25:00.000Z',
      coderVerified: true,
      coderVerifiedBy: 'Marcus Chen, CPC',
      coderVerifiedAt: '2026-11-16T15:12:00.000Z',
      aiGenerated: true,
      createdBy: 'Dr. Elena Vance',
      updatedAt: '2026-11-16T15:12:00.000Z',
    },
    {
      id: 'enc-2002',
      patientRecordId: 'pat-rec-102',
      patientId: 'PT-4019',
      patientName: 'Clara Morales',
      patientAge: 52,
      patientGender: 'Female',
      encounterDate: '2026-11-17',
      visitType: 'Urgent Outpatient Consultation',
      chiefComplaint: 'Productive cough for 4 days and pleuritic chest discomfort',
      rawClinicalNotes:
        '52yo female with 4-day history of productive cough, yellowish sputum, chills, and right-sided pleuritic chest pain. SpO2 94% on room air, crackles on auscultation. Preliminary CXR shows pulmonary infiltrate, lobe laterality not dictated yet. Temperature not logged in triage. Start amoxicillin-clavulanate and azithromycin.',
      diagnosisDetails: 'Suspected community-acquired pneumonia',
      treatmentPlan: 'Oral amoxicillin-clavulanate 875/125 mg BID and azithromycin; return precautions reviewed',
      labResultsText: 'CXR preliminary: focal pulmonary infiltrate (laterality pending final radiology read). WBC not ordered.',
      uploadedDocuments: [],
      soapNote: {
        subjective:
          '52-year-old female reports 4 days of cough productive of yellowish sputum, chills, and right-sided pleuritic chest discomfort. History of mild intermittent asthma.',
        objective:
          'SpO2 94% on room air. Pulmonary exam notable for crackles on auscultation (exact lung zone not specified). Temperature: [Not documented in source]. Preliminary chest X-ray demonstrates pulmonary infiltrate; final lobar localization pending.',
        assessment:
          'Community-acquired pneumonia, organism unspecified. Underlying mild intermittent asthma.',
        plan:
          '1. Start empiric outpatient antibiotic therapy: amoxicillin-clavulanate 875/125 mg PO BID plus azithromycin (duration and azithromycin strength not specified in source note).\n2. Confirm baseline temperature and final radiology report for lobar localization.\n3. Advise prompt return for worsening dyspnea, hypoxia, or persistent fever.',
      },
      patientMedicalSummary:
        '52-year-old female with mild intermittent asthma presenting acutely with productive cough, pleuritic pain, borderline SpO2 (94%), and preliminary radiographic infiltrate consistent with community-acquired pneumonia.',
      clinicalVisitSummary:
        'Urgent respiratory visit for suspected community-acquired pneumonia. Empiric dual oral antibiotics initiated; temperature reading and final radiographic lobe localization remain pending.',
      medicationSummary:
        'Prescribed: Amoxicillin-clavulanate 875/125 mg BID, Azithromycin (dose/duration missing). Home meds: Albuterol HFA PRN, Fluticasone nasal spray.',
      historyHighlights: [
        'Mild intermittent asthma increases respiratory monitoring priority',
        'No known drug allergies documented on profile',
        'SpO2 94% on room air (borderline oxygenation)',
      ],
      extractedTerms: ['community-acquired pneumonia', 'productive cough', 'pleuritic chest pain', 'crackles', 'pulmonary infiltrate', 'amoxicillin-clavulanate', 'azithromycin'],
      missingInfoAlerts: [
        {
          id: 'alert-2002-1',
          field: 'Vital Signs (Temperature & Respiratory Rate)',
          severity: 'high',
          message: 'Fever/chills reported subjectively, but objective temperature and respiratory rate are missing from the encounter record.',
          clarifyingQuestion: 'What were the patient’s measured temperature and respiratory rate during triage?',
          resolved: false,
        },
        {
          id: 'alert-2002-2',
          field: 'Radiographic Laterality & Azithromycin Dosing',
          severity: 'medium',
          message: 'Chest X-ray infiltrate laterality/lobe and azithromycin dose/duration are omitted from the treatment plan.',
          clarifyingQuestion: 'Which lung lobe showed infiltrate on final CXR, and what exact azithromycin regimen (e.g., 500 mg day 1 then 250 mg x4d) was ordered?',
          resolved: false,
        },
      ],
      suggestedCodes: [
        {
          id: 'code-2002-1',
          system: 'ICD-10-CM',
          code: 'J18.9',
          description: 'Pneumonia, unspecified organism',
          category: 'Diagnosis',
          evidenceSnippet: 'Suspected community-acquired pneumonia; preliminary CXR pulmonary infiltrate',
          guidelineNote: 'Use J18.9 when causative organism and lobar pneumonia pattern are not confirmed.',
          specificityStatus: 'unspecified',
          inconsistencyReason: 'Preliminary infiltrate noted without lobar specificity; update if final radiology confirms lobar pneumonia (J18.1).',
          approvalStatus: 'pending',
        },
        {
          id: 'code-2002-2',
          system: 'ICD-10-CM',
          code: 'J45.20',
          description: 'Mild intermittent asthma, uncomplicated',
          category: 'Diagnosis',
          evidenceSnippet: 'Chronic condition: Mild intermittent asthma (patient history)',
          guidelineNote: 'Only code chronic asthma if actively evaluated or impacting treatment (e.g., bronchodilator adjustment).',
          specificityStatus: 'inconsistent',
          inconsistencyReason: 'Listed in chronic history, but acute clinical note does not explicitly document whether asthma was exacerbated or actively managed during this visit.',
          approvalStatus: 'pending',
        },
        {
          id: 'code-2002-3',
          system: 'CPT',
          code: '99213',
          description: 'Office or other outpatient visit, established patient, low MDM',
          category: 'Procedure',
          evidenceSnippet: 'Urgent outpatient consultation; prescription antibiotic management',
          guidelineNote: 'Verify whether moderate MDM (99214) applies given acute illness with systemic symptoms + prescription drug management.',
          specificityStatus: 'inconsistent',
          inconsistencyReason: 'Acute illness with systemic symptoms + prescription drug management may support CPT 99214 instead of 99213 if documented thoroughly.',
          approvalStatus: 'pending',
        },
      ],
      status: 'pending_review',
      clinicianAttested: false,
      coderVerified: false,
      aiGenerated: true,
      createdBy: 'Priya Nair',
      updatedAt: '2026-11-17T10:15:00.000Z',
    },
    {
      id: 'enc-2003',
      patientRecordId: 'pat-rec-104',
      patientId: 'PT-4031',
      patientName: 'Evelyn Lindqvist',
      patientAge: 71,
      patientGender: 'Female',
      encounterDate: '2026-11-17',
      visitType: 'Cardiology & Anticoagulation Review',
      chiefComplaint: 'Routine atrial fibrillation rate control check and left knee pain flare',
      rawClinicalNotes:
        '71yo female with paroxysmal AFib on apixaban 5 mg BID and metoprolol 50 mg. Feels well, no palpitations or bleeding. Also notes worsening left knee stiffness over 3 weeks. BP 126/72, HR 66 regular. Penicillin allergy (anaphylaxis) verified. Avoid NSAIDs due to apixaban + prior GI sensitivity; recommend topical diclofenac gel or acetaminophen.',
      diagnosisDetails: 'Paroxysmal atrial fibrillation; primary osteoarthritis of left knee',
      treatmentPlan: 'Continue apixaban 5 mg BID and metoprolol succinate 50 mg daily; initiate topical diclofenac 1% gel to left knee TID',
      labResultsText: 'Serum creatinine: 0.92 mg/dL | eGFR: 64 mL/min | Hemoglobin: 12.8 g/dL',
      uploadedDocuments: [],
      soapNote: {
        subjective:
          '71-year-old female presents for routine paroxysmal atrial fibrillation review. Denies palpitations, syncope, epistaxis, or melena. Reports 3 weeks of worsening left knee stiffness and aching.',
        objective:
          'BP 126/72 mmHg, HR 66 bpm regular, SpO2 98% on room air. Labs: Serum creatinine 0.92 mg/dL, eGFR 64 mL/min, Hemoglobin 12.8 g/dL.',
        assessment:
          '1. Paroxysmal atrial fibrillation, rate-controlled and stable on apixaban and metoprolol.\n2. Unilateral primary osteoarthritis, left knee.',
        plan:
          '1. Continue apixaban 5 mg PO BID (renal function stable, Cr 0.92) and metoprolol succinate 50 mg daily.\n2. Prescribe topical diclofenac 1% gel to left knee TID; counsel to avoid oral NSAIDs due to bleeding risk with anticoagulation.\n3. Routine follow-up in 6 months.',
      },
      patientMedicalSummary:
        '71-year-old female with paroxysmal atrial fibrillation on apixaban, hypothyroidism, and bilateral knee OA, presenting with stable rhythm and localized left knee OA flare.',
      clinicalVisitSummary:
        'Anticoagulation and rate control confirmed stable with preserved renal function. Left knee OA flare managed safely with topical therapy to avoid oral NSAID-anticoagulant interaction.',
      medicationSummary:
        'Continued: Apixaban 5 mg BID, Metoprolol succinate 50 mg daily, Levothyroxine 75 mcg daily. Added: Topical diclofenac 1% gel TID.',
      historyHighlights: [
        'Severe penicillin allergy (anaphylaxis) & latex allergy',
        'Concurrent anticoagulation (apixaban) precludes oral NSAIDs',
        'Renal function stable (Cr 0.92, eGFR 64)',
      ],
      extractedTerms: ['paroxysmal atrial fibrillation', 'apixaban', 'left knee', 'primary osteoarthritis', 'topical diclofenac'],
      missingInfoAlerts: [],
      suggestedCodes: [
        {
          id: 'code-2003-1',
          system: 'ICD-10-CM',
          code: 'I48.0',
          description: 'Paroxysmal atrial fibrillation',
          category: 'Diagnosis',
          evidenceSnippet: 'paroxysmal atrial fibrillation, rate-controlled and stable',
          guidelineNote: 'Specific code I48.0 matches documented paroxysmal subtype.',
          specificityStatus: 'specific',
          approvalStatus: 'approved',
          reviewedBy: 'Marcus Chen, CPC',
          reviewedAt: '2026-11-17T17:05:00.000Z',
        },
        {
          id: 'code-2003-2',
          system: 'ICD-10-CM',
          code: 'M17.12',
          description: 'Unilateral primary osteoarthritis, left knee',
          category: 'Diagnosis',
          evidenceSnippet: 'worsening left knee stiffness over 3 weeks; primary osteoarthritis of left knee',
          guidelineNote: 'Laterality specified (left knee -> M17.12). Note: patient history lists bilateral OA, update to M17.0 if both knees actively treated.',
          specificityStatus: 'specific',
          approvalStatus: 'pending',
        },
        {
          id: 'code-2003-3',
          system: 'ICD-10-CM',
          code: 'Z79.01',
          description: 'Long term (current) use of anticoagulants',
          category: 'Diagnosis',
          evidenceSnippet: 'Long-term apixaban 5 mg BID management with renal monitoring',
          guidelineNote: 'Secondary status code required alongside chronic anticoagulation management.',
          specificityStatus: 'specific',
          approvalStatus: 'pending',
        },
      ],
      status: 'pending_review',
      clinicianAttested: false,
      coderVerified: false,
      aiGenerated: true,
      createdBy: 'Dr. Elena Vance',
      updatedAt: '2026-11-17T17:05:00.000Z',
    },
    {
      id: 'enc-2004',
      patientRecordId: 'pat-rec-103',
      patientId: 'PT-4025',
      patientName: 'Samuel Okafor',
      patientAge: 39,
      patientGender: 'Male',
      encounterDate: '2026-11-15',
      visitType: 'Orthopedic Consultation',
      chiefComplaint: 'Acute right knee pain and mechanical locking 5 days post soccer injury',
      rawClinicalNotes:
        '39yo male with right knee pain and locking after twisting injury 5 days ago. Exam: joint effusion, medial joint line tenderness, positive McMurray test. MRI right knee confirms bucket-handle tear of medial meniscus, initial encounter. Plan knee arthroscopy consult and naproxen? Wait—patient has ibuprofen gastric upset allergy! Needs GI-safe analgesia review.',
      diagnosisDetails: 'Bucket-handle tear of medial meniscus, right knee, initial encounter',
      treatmentPlan: 'Orthopedic arthroscopy scheduling; knee immobilizer; acetaminophen 650 mg q6h PRN (avoid oral NSAIDs given ibuprofen intolerance)',
      labResultsText: 'MRI Right Knee: Displaced bucket-handle tear of the medial meniscus; ACL/PCL intact.',
      uploadedDocuments: [],
      soapNote: {
        subjective:
          '39-year-old male presents 5 days after acute twisting injury of right knee during soccer with persistent medial knee pain and mechanical locking. Documented gastric upset with ibuprofen.',
        objective:
          'Right knee exam: mild joint effusion, medial joint line tenderness, positive McMurray maneuver. MRI right knee confirms bucket-handle tear of medial meniscus with intact cruciate ligaments.',
        assessment:
          'Acute bucket-handle tear of medial meniscus, right knee, initial encounter.',
        plan:
          '1. Refer to orthopedic surgery for arthroscopic meniscal repair evaluation.\n2. Place right knee in immobilizer and advise protected weight-bearing.\n3. Recommend acetaminophen 650 mg PO q6h PRN pain; avoid ibuprofen/NSAIDs due to prior gastric intolerance.',
      },
      patientMedicalSummary:
        '39-year-old healthy male with MRI-confirmed acute right medial meniscal bucket-handle tear and documented NSAID gastric intolerance.',
      clinicalVisitSummary:
        'Orthopedic injury evaluation confirming right medial bucket-handle meniscal tear. Referred for arthroscopic evaluation with non-NSAID analgesia.',
      medicationSummary:
        'Recommended: Acetaminophen 650 mg q6h PRN. Contraindicated/Avoid: Ibuprofen/oral NSAIDs.',
      historyHighlights: [
        'Documented ibuprofen gastric upset intolerance',
        'MRI-confirmed bucket-handle tear of right medial meniscus',
      ],
      extractedTerms: ['right knee', 'bucket-handle tear', 'medial meniscus', 'McMurray test', 'MRI'],
      missingInfoAlerts: [],
      suggestedCodes: [
        {
          id: 'code-2004-1',
          system: 'ICD-10-CM',
          code: 'S83.211A',
          description: 'Bucket-handle tear of medial meniscus, current injury, right knee, initial encounter',
          category: 'Diagnosis',
          evidenceSnippet: 'MRI right knee confirms bucket-handle tear of medial meniscus, initial encounter',
          guidelineNote: 'Includes laterality (right knee) and 7th character A for initial encounter.',
          specificityStatus: 'specific',
          approvalStatus: 'approved',
          reviewedBy: 'Marcus Chen, CPC',
          reviewedAt: '2026-11-15T17:00:00.000Z',
        },
        {
          id: 'code-2004-2',
          system: 'CPT',
          code: '99204',
          description: 'Office or other outpatient visit, new patient, moderate MDM',
          category: 'Procedure',
          evidenceSnippet: 'New orthopedic injury consultation with external MRI review and surgical referral',
          guidelineNote: 'Supports moderate MDM via independent imaging review and decision regarding surgical intervention.',
          specificityStatus: 'specific',
          approvalStatus: 'approved',
          reviewedBy: 'Marcus Chen, CPC',
          reviewedAt: '2026-11-15T17:00:00.000Z',
        },
      ],
      status: 'finalized',
      clinicianAttested: true,
      attestedBy: 'Dr. Elena Vance, MD',
      attestedAt: '2026-11-15T16:40:00.000Z',
      coderVerified: true,
      coderVerifiedBy: 'Marcus Chen, CPC',
      coderVerifiedAt: '2026-11-15T17:02:00.000Z',
      aiGenerated: true,
      createdBy: 'Dr. Elena Vance',
      updatedAt: '2026-11-15T17:02:00.000Z',
    },
    {
      id: 'enc-2005',
      patientRecordId: 'pat-rec-105',
      patientId: 'PT-4038',
      patientName: 'Mateo Alvarez',
      patientAge: 46,
      patientGender: 'Male',
      encounterDate: '2026-11-12',
      visitType: 'Primary Care Follow-up',
      chiefComplaint: 'Persistent epigastric burning despite daily omeprazole',
      rawClinicalNotes:
        '46yo male with GERD taking omeprazole 20 mg daily before breakfast, still having nocturnal reflux 3x/week. No dysphagia, weight loss, or hematemesis. BP 130/84. Consider H. pylori stool antigen test and step-up PPI timing counseling.',
      diagnosisDetails: 'Gastroesophageal reflux disease without esophagitis',
      treatmentPlan: 'Ensure omeprazole taken 30–60 min pre-meal; order H. pylori stool antigen; elevate head of bed',
      labResultsText: 'Pending H. pylori stool antigen order.',
      uploadedDocuments: [],
      soapNote: {
        subjective:
          '46-year-old male reports nocturnal reflux 3 times weekly despite omeprazole 20 mg daily. Denies dysphagia, odynophagia, unintentional weight loss, or hematemesis.',
        objective: 'BP 130/84 mmHg, HR 78 bpm. Abdominal exam: [Not documented in source].',
        assessment: 'Gastroesophageal reflux disease without documented esophagitis, partially responsive to PPI.',
        plan:
          '1. Counsel to take omeprazole 20 mg 30–60 minutes prior to first meal.\n2. Order Helicobacter pylori stool antigen test.\n3. Recommend lifestyle measures (elevate head of bed, avoid late evening meals).',
      },
      patientMedicalSummary:
        '46-year-old male with GERD and generalized anxiety disorder experiencing breakthrough nocturnal reflux symptoms.',
      clinicalVisitSummary:
        'Primary care GERD follow-up addressing nocturnal breakthrough symptoms via PPI timing optimization and H. pylori rule-out.',
      medicationSummary: 'Active: Omeprazole 20 mg daily, Sertraline 50 mg daily.',
      historyHighlights: ['No red-flag GI alarm symptoms reported', 'Concurrent SSRI therapy (sertraline 50 mg)'],
      extractedTerms: ['GERD', 'nocturnal reflux', 'omeprazole', 'H. pylori'],
      missingInfoAlerts: [
        {
          id: 'alert-2005-1',
          field: 'Abdominal Physical Examination',
          severity: 'low',
          message: 'Focused abdominal exam findings (tenderness, bowel sounds, guarding) were not documented for a GI complaint.',
          clarifyingQuestion: 'Was an abdominal exam performed, and were epigastric tenderness or masses absent?',
          resolved: false,
        },
      ],
      suggestedCodes: [
        {
          id: 'code-2005-1',
          system: 'ICD-10-CM',
          code: 'K21.9',
          description: 'Gastro-esophageal reflux disease without esophagitis',
          category: 'Diagnosis',
          evidenceSnippet: 'GERD without documented esophagitis',
          guidelineNote: 'Use K21.9 when endoscopy has not confirmed esophagitis.',
          specificityStatus: 'specific',
          approvalStatus: 'pending',
        },
      ],
      status: 'draft',
      clinicianAttested: false,
      coderVerified: false,
      aiGenerated: true,
      createdBy: 'Priya Nair',
      updatedAt: '2026-11-12T11:45:00.000Z',
    },
  ];

  return {
    users,
    patients,
    encounters,
    lastBenchmarkReport: null,
  };
}

let dbCache: DatabaseSchema | null = null;

function ensureLoaded(): DatabaseSchema {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw) as DatabaseSchema;
      return dbCache;
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }
  dbCache = createInitialData();
  persistDb();
  return dbCache;
}

function persistDb(): void {
  if (!dbCache) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(dbCache, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_FILE);
}

export function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel,
    credentials: user.credentials,
    department: user.department,
  };
}

export function authenticateUser(email: string, password: string): { user: AuthUser; token: string } | null {
  const db = ensureLoaded();
  const normalized = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === normalized);
  if (!user) return null;
  const computed = hashPassword(password, user.passwordSalt);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    token,
    userId: user.id,
    createdAt: now,
    expiresAt: now + 1000 * 60 * 60 * 12,
  });
  return { user: sanitizeUser(user), token };
}

export function getSessionUser(token: string | undefined): AuthUser | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  const db = ensureLoaded();
  const user = db.users.find((u) => u.id === session.userId);
  return user ? sanitizeUser(user) : null;
}

export function destroySession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function listPatients(): PatientRecord[] {
  const db = ensureLoaded();
  return [...db.patients].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPatientById(id: string): PatientRecord | undefined {
  const db = ensureLoaded();
  return db.patients.find((p) => p.id === id || p.patientId === id);
}

export function createPatient(
  input: Omit<PatientRecord, 'id' | 'createdAt' | 'updatedAt'>,
): PatientRecord {
  const db = ensureLoaded();
  const duplicate = db.patients.find(
    (p) => p.patientId.toLowerCase() === input.patientId.trim().toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`Patient ID "${input.patientId}" already exists.`);
  }
  const now = new Date().toISOString();
  const record: PatientRecord = {
    ...input,
    id: `pat-rec-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  db.patients.unshift(record);
  persistDb();
  return record;
}

export function updatePatient(
  id: string,
  patch: Partial<Omit<PatientRecord, 'id' | 'createdAt'>>,
): PatientRecord | null {
  const db = ensureLoaded();
  const idx = db.patients.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  db.patients[idx] = {
    ...db.patients[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  persistDb();
  return db.patients[idx];
}

export function listEncounters(patientRecordId?: string): ClinicalEncounter[] {
  const db = ensureLoaded();
  const rows = patientRecordId
    ? db.encounters.filter((e) => e.patientRecordId === patientRecordId)
    : db.encounters;
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEncounterById(id: string): ClinicalEncounter | undefined {
  const db = ensureLoaded();
  return db.encounters.find((e) => e.id === id);
}

export function createEncounter(
  input: Omit<ClinicalEncounter, 'id' | 'updatedAt'>,
): ClinicalEncounter {
  const db = ensureLoaded();
  const now = new Date().toISOString();
  const encounter: ClinicalEncounter = {
    ...input,
    id: `enc-${crypto.randomUUID().slice(0, 8)}`,
    updatedAt: now,
  };
  db.encounters.unshift(encounter);
  const patIdx = db.patients.findIndex((p) => p.id === input.patientRecordId);
  if (patIdx !== -1) {
    db.patients[patIdx].updatedAt = now;
  }
  persistDb();
  return encounter;
}

export function updateEncounter(
  id: string,
  patch: Partial<Omit<ClinicalEncounter, 'id'>>,
): ClinicalEncounter | null {
  const db = ensureLoaded();
  const idx = db.encounters.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  db.encounters[idx] = {
    ...db.encounters[idx],
    ...patch,
    updatedAt: now,
  };
  persistDb();
  return db.encounters[idx];
}

export function getLastBenchmarkReport(): BenchmarkSuiteReport | null {
  return ensureLoaded().lastBenchmarkReport;
}

export function saveBenchmarkReport(report: BenchmarkSuiteReport): void {
  const db = ensureLoaded();
  db.lastBenchmarkReport = report;
  persistDb();
}
