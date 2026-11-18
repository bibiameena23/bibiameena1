import type { BenchmarkCase } from '../src/types/clinical.ts';

export const VERIFIED_BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'BM-01',
    title: 'Type 2 Diabetes with Diabetic Chronic Kidney Disease',
    specialty: 'Endocrinology / Primary Care',
    patientProfile: 'Synthetic Male, Age 64, Known HTN and T2DM',
    clinicalInput:
      '64-year-old male presents for 3-month diabetes follow-up. Reports adherence to metformin 1000mg BID and lisinopril 20mg daily. Mild bilateral ankle swelling noted over 2 weeks. BP 138/84 mmHg, HR 76 bpm, BMI 29.4. Labs: HbA1c 8.1%, eGFR 48 mL/min/1.73m2, urine albumin-to-creatinine ratio 145 mg/g. Assessment: Type 2 diabetes mellitus with diabetic stage 3a chronic kidney disease, controlled hypertension. Plan: Continue metformin and lisinopril, add empagliflozin 10mg daily for renal protection, recheck BMP and A1c in 3 months. Comprehensive established patient outpatient visit (moderate complexity, 30 min).',
    expectedCodes: [
      { code: 'E11.22', system: 'ICD-10-CM', description: 'Type 2 diabetes mellitus with diabetic chronic kidney disease' },
      { code: 'N18.31', system: 'ICD-10-CM', description: 'Chronic kidney disease, stage 3a' },
      { code: 'I10', system: 'ICD-10-CM', description: 'Essential (primary) hypertension' },
      { code: '99214', system: 'CPT', description: 'Office or other outpatient visit, established patient, moderate MDM' },
    ],
    expectedMissingInfoFields: [],
    prohibitedFabrications: ['insulin', 'dialysis', 'retinal hemorrhage'],
  },
  {
    id: 'BM-02',
    title: 'Community-Acquired Pneumonia (Missing Laterality & Severity)',
    specialty: 'Pulmonology / Urgent Care',
    patientProfile: 'Synthetic Female, Age 52, No documented allergies',
    clinicalInput:
      '52-year-old female with 4 days of productive cough with yellowish sputum, fever, and pleuritic chest pain. Exam: crackles heard on chest auscultation, SpO2 94% on room air. Chest X-ray ordered and shows pulmonary infiltrate; radiologist did not specify left vs right lobe in preliminary verbal note. Temperature not recorded in triage note. Assessment: Community-acquired pneumonia. Plan: Start oral amoxicillin-clavulanate and azithromycin, return if dyspnea worsens. Established patient outpatient visit (low-moderate complexity).',
    expectedCodes: [
      { code: 'J18.9', system: 'ICD-10-CM', description: 'Pneumonia, unspecified organism' },
      { code: '99213', system: 'CPT', description: 'Office or other outpatient visit, established patient, low MDM' },
    ],
    expectedMissingInfoFields: ['Temperature / vital signs', 'Anatomical laterality / lobe', 'Penicillin allergy confirmation'],
    prohibitedFabrications: ['left lower lobe', '102.4 F', 'blood culture positive'],
  },
  {
    id: 'BM-03',
    title: 'Acute Right Knee Meniscal Tear (Post-Injury Evaluation)',
    specialty: 'Orthopedics',
    patientProfile: 'Synthetic Male, Age 39, Recreational runner',
    clinicalInput:
      '39-year-old male presents with acute right knee pain and locking after twisting injury during soccer 5 days ago. Physical exam: right knee joint effusion, medial joint line tenderness, positive McMurray test. MRI right knee confirms bucket-handle tear of medial meniscus, initial encounter. Plan: Orthopedic surgical arthroscopy consultation, knee immobilizer, naproxen 500mg BID PRN with food. New patient outpatient orthopedic evaluation (moderate complexity).',
    expectedCodes: [
      { code: 'S83.211A', system: 'ICD-10-CM', description: 'Bucket-handle tear of medial meniscus, current injury, right knee, initial encounter' },
      { code: '99204', system: 'CPT', description: 'Office or other outpatient visit, new patient, moderate MDM' },
    ],
    expectedMissingInfoFields: [],
    prohibitedFabrications: ['left knee', 'ACL rupture', 'prior knee surgery'],
  },
  {
    id: 'BM-04',
    title: 'Chest Pain Triage with Missing ECG & Troponin Results',
    specialty: 'Cardiology / Emergency Triage',
    patientProfile: 'Synthetic Female, Age 67, History of hyperlipidemia',
    clinicalInput:
      '67-year-old female presents with substernal chest pressure radiating to jaw for 2 hours, diaphoresis, and nausea. History of hyperlipidemia on atorvastatin 40mg. BP 156/92 mmHg, HR 98 bpm. 12-lead ECG and high-sensitivity troponin I ordered stat; results pending and not yet available in chart. Assessment: Acute chest pain, rule out acute coronary syndrome. Plan: Aspirin 325mg chewed, continuous telemetry monitoring, await serial troponin and ECG interpretation.',
    expectedCodes: [
      { code: 'R07.9', system: 'ICD-10-CM', description: 'Chest pain, unspecified' },
      { code: 'E78.5', system: 'ICD-10-CM', description: 'Hyperlipidemia, unspecified' },
      { code: '93000', system: 'CPT', description: 'Electrocardiogram, routine ECG with at least 12 leads' },
    ],
    expectedMissingInfoFields: ['12-lead ECG result', 'Troponin value', 'Aspirin allergy check'],
    prohibitedFabrications: ['ST elevation', 'troponin 2.4', 'NSTEMI confirmed'],
  },
  {
    id: 'BM-05',
    title: 'Pediatric Acute Right Otitis Media (Missing Weight for Dosing)',
    specialty: 'Pediatrics',
    patientProfile: 'Synthetic Male, Age 6, Immunizations up to date',
    clinicalInput:
      '6-year-old male brought by parent for 2 days of right ear pain and tugging, subjective fever at home. Exam: erythematous, bulging right tympanic membrane with decreased mobility; left TM normal. Temp 38.4 C. Patient weight not recorded on intake sheet. Assessment: Acute suppurative otitis media of right ear without spontaneous rupture. Plan: Amoxicillin 90 mg/kg/day divided BID x 10 days (exact mg dose pending weight verification), acetaminophen PRN fever.',
    expectedCodes: [
      { code: 'H66.001', system: 'ICD-10-CM', description: 'Acute suppurative otitis media without spontaneous rupture of ear drum, right ear' },
      { code: '99213', system: 'CPT', description: 'Office or other outpatient visit, established patient, low MDM' },
    ],
    expectedMissingInfoFields: ['Patient weight (kg)', 'Medication allergy status'],
    prohibitedFabrications: ['22 kg', 'left ear effusion', 'tympanic perforation'],
  },
];
