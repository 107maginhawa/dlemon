# Open Health Specs Platform — Reference Catalog
Companion to: `misty-spinning-muffin.md` (architecture doc)
Date: 2026-04-16 | Status: Living document — update as verticals are authored

This catalog lists the universe of facility types, standards, domains, stakeholders, and integrations the Hub must eventually be able to describe. It is NOT a build list — it is a scope reference. Use it to:
- Decide what's in vs out at each milestone
- Confirm whether a domain, standard, or facility type is already covered
- Identify gaps when authoring new vertical specs

---

## Section 1: Health Facility Types (100+)

Organized by care setting. [CORE] = relevant to all verticals; [VERT] = vertical-specific; [LOC] = localization-specific; [EXT] = ecosystem/external; [BACKLOG] = acknowledged, not scoped.

### Acute care (hospitals)

- General hospital (community / district / tertiary / quaternary)
- Academic medical center / teaching hospital
- Specialty hospital: cardiac, cancer, orthopedic, pediatric, psychiatric, rehabilitation, women's, eye & ENT
- Children's hospital
- Trauma center (Level I–IV)
- Burn center
- Rehabilitation hospital (inpatient rehab facility / IRF)
- Long-term acute care hospital (LTACH)
- Critical access hospital (rural)
- Military / VA / tribal hospital
- Correctional health facility
- Maternity / birthing center

### Ambulatory

- Physician office (solo, group, multi-specialty)
- Federally qualified / community health center (FQHC; PH equivalent: BHS / RHU)
- Urgent care / walk-in / retail clinic
- Rural health clinic
- Mobile health / van
- School-based / student health
- Occupational / worksite health
- Corporate wellness clinic
- Telehealth-only / virtual-first clinic
- Concierge / direct primary care
- Free / charity clinic
- Refugee / humanitarian (MSF-class)
- Maritime / cruise ship / oil rig / aviation medical

### Ambulatory specialty

- Dental: general, ortho, endo, perio, prostho, oral surgery, pediatric, DSO, dental school, mobile dental
- Optometry / ophthalmology
- Chiropractic
- Physical / occupational / speech therapy
- Mental health / counseling / psychiatry / psychology
- Substance use treatment (inpatient, outpatient, MAT)
- Podiatry
- Dermatology / aesthetics / med spa
- Fertility / IVF / reproductive
- Sleep clinic
- Pain management / interventional
- Wound care center
- Dialysis center (ESRD)
- Ambulatory surgery center (ASC)
- Endoscopy center
- Cath lab / EP (standalone)
- Radiation oncology / infusion / chemotherapy center
- Imaging center (standalone radiology, mammography, mobile MRI)
- Audiology
- Allergy / immunotherapy
- Weight management
- Integrative / TCM / Ayurveda / acupuncture

### Post-acute & long-term care

- Skilled nursing facility (SNF)
- Nursing home / long-term care (LTC)
- Assisted living
- Memory care
- Adult day care / PACE
- Continuing care retirement community
- Hospice (inpatient + home)
- Palliative care
- Adult foster care

### Home & virtual

- Home health agency
- Personal care / caregiver agency
- Hospital-at-home
- Remote patient monitoring (RPM)
- Telemedicine platform
- Async / store-and-forward care
- Digital therapeutics (DTx)
- Consumer wearable platform (Apple, Fitbit, Oura, Whoop)

### Emergency & pre-hospital

- EMS / ambulance (ground)
- Air medical (rotor, fixed-wing)
- 911 / emergency dispatch / PSAP
- Disaster medical response
- Mobile integrated health / community paramedicine
- Poison control center

### Diagnostic & ancillary

- Independent reference lab (Quest / LabCorp class)
- Hospital-based clinical lab
- Pathology lab (anatomic, molecular, genomics)
- Point-of-care testing
- Blood bank / donor center
- Tissue bank / organ procurement org (OPO)
- Non-emergency medical transport (NEMT)

### Pharmacy

- Community / retail
- Hospital inpatient
- Specialty pharmacy
- Compounding pharmacy
- Mail-order / online
- Long-term-care pharmacy
- Nuclear pharmacy
- PBM (pharmacy benefit manager)

### Public health / population

- Local / state / national health departments
- Disease surveillance centers (CDC, WHO equivalents)
- Immunization clinics / IIS
- STI / HIV clinics
- TB clinics
- Maternal-child programs (WIC-class)
- School health / vaccination
- Environmental health
- Vital statistics / vital records
- Biodefense / bioterrorism response
- National and sub-national registries

### Research & academic

- Clinical trial sites
- Biorepositories / biobanks
- Disease / device / procedure registries
- Pharma / biotech R&D
- CROs (contract research organizations)
- Academic research (NIH, EU Horizon, national equivalents)

### Veterinary (adjacent, shares infra)

- Companion animal / mixed / large / equine / exotic
- Vet emergency / specialty / teaching
- Shelter / rescue / animal control

### Payers & financial institutions

- Commercial insurance carriers
- Medicare Advantage / Medicaid MCOs (US)
- National health schemes (PhilHealth, NHS, SUS, Ayushman Bharat, etc.)
- Self-insured employers / TPAs
- Workers' comp / auto-casualty
- Dental / vision insurance (standalone)

### Regulators & accreditors

- Licensing boards (medical, dental, nursing, pharmacy, behavioral, lab CLIA, radiology ACR)
- Accreditation bodies (Joint Commission, DNV, URAC, AAAHC, HIMSS EMRAM, Magnet, CAP, COLA, ISO 15189, NABH/NABL India, PhilHealth accreditation)
- Drug & device regulators (FDA, EMA, PMDA, FDA-PH, NMPA, ANVISA, TGA, CDSCO India, MHRA UK)
- Environmental / occupational safety (OSHA, DOLE-PH)
- Radiation safety boards (NRC, PNRI-PH)
- Tax / fiscal authorities (IRS, BIR-PH)

### Professional associations & standards bodies [EXT — Memberry target market]

- Global: WHO, WMA, FDI (World Dental Federation), FIP (pharmacy), ICN (nursing), WONCA, IMIA/HIMSS
- US: AMA, ADA, ANA, APhA, ACP, ACC, ACOG, AAP, AAFP, ACS; ABMS + 24 specialty boards; FSMB, NPDB, CAQH, ECFMG
- PH: PMA, PDA, PNA, PPA, PPPS, PAFP, POGS, PPS, PCP, PSP, PhilOTA, PhilPTA, PCHRD
- Asia-Pacific: JMA (Japan), KMA (Korea), IMA (India), MMA (Malaysia), SMA (Singapore), AMA (Australia)
- Europe: BMA (UK), GMC (UK), Ordre des Médecins (FR), Bundesärztekammer (DE)
- Dental specialty: AAE, AAP, AAPD, AAO, AAOMS, ACP, AGD, AAPHD
- CPD/CME bodies: ACCME, EACCME, PRC-PH, AMA PRA, NBCRNA — plus many profession-specific equivalents

### Multi-tenant / shared health real estate [VERT/EXT]

- Medical arts building / MOB — multi-tenant with shared lobby, imaging, lab draw, common-area scheduling
- Ambulatory care campus / multi-specialty campus — single owner, multiple practices
- Retail health (CVS MinuteClinic, Walmart Health, Walgreens Village Medical model)
- Mobile health units at shared locations (school, factory, church, LGU)
- Hospital-owned ambulatory network — satellite clinics with consolidated MPI

### Hospital departments — clinical [VERT — hospital]

Emergency Department, OR / Surgical Services, Anesthesiology, ICU (MICU/SICU/CVICU/NICU/PICU/Burn), Cardiology / Cath Lab / EP, Cardiothoracic Surgery, Oncology / Infusion, Radiology / Diagnostic Imaging, Interventional Radiology, Nuclear Medicine, Radiation Oncology, Laboratory / Pathology, Blood Bank, Pharmacy (inpatient + outpatient + investigational), Respiratory Therapy, Rehab Services (PT/OT/SLP), Nutrition & Dietary, OB / L&D / Postpartum, Newborn Nursery / NICU, Pediatrics / PICU, Psychiatry / Behavioral Health, Dialysis, Endoscopy / GI Lab, Urology, Neurology / Neurosurgery, Orthopedic Surgery, Pain Management, Palliative Care / Hospice, Hospitalist / Internal Medicine, Family Medicine, Geriatrics, Dermatology, Ophthalmology, ENT, Dental / Oral Surgery (hospital-based), Plastic / Reconstructive, Wound Care, Transplant, Bariatrics, Sleep Medicine, Allergy & Immunology, Genetics, Infection Prevention & Control, Antimicrobial Stewardship.

### Hospital departments — administrative [CORE]

Admitting / Registration, Medical Records / HIM, Case Management / Discharge Planning, Social Services, Chaplaincy, Patient Relations, Quality & Safety, Risk Management, Compliance, Legal, Privacy, Medical Staff / Credentialing, Education / GME / CME, Research / IRB, Finance / Revenue Cycle, Billing, Coding, HR, Marketing, Philanthropy / Development, Volunteer Services, IT / Clinical Informatics, Biomedical Engineering, Facilities, EVS, Laundry / Linen, CSSD / Sterile Processing, Supply Chain / Materials Management, Security, Patient Transport, Food & Nutrition Services, Parking, Telecommunications.

### Niche & emerging facility types [BACKLOG]

Medical tourism hospitals, genomics / DTC genetic testing labs, forensic services, travel medicine, sports medicine, bariatric centers, cosmetic surgery centers, laser / aesthetic clinics, hair transplant, fertility preservation, cord blood banks, stem cell / regenerative clinics, medical cannabis dispensaries (where legal), psychedelic-assisted therapy clinics (ketamine, MDMA trials), gender-affirming care centers, LGBTQ+ community health centers, harm reduction / needle exchange, cruise ship infirmaries, oil rig / remote industrial medical, aviation medical examiners, space medicine (emerging), disaster deployable field hospitals, military field medical.

### Government, institutional & special-population facilities [VERT/LOC]

Correctional health (jail, prison, juvenile detention; NCCHC/ACA standards), tribal health (IHS / tribal 638; RPMS/VistA lineage), military health (Role 1/2/3/4; MHS Genesis; NATO STANAGs), veterans health (VA, community care networks, VetPro), religious / denominational health systems (Catholic Health Association, Adventist, Shriners), indigenous / First Nations / Aboriginal health, refugee / IDP camp health (UNHCR, MSF, ICRC), shelter-based health, migrant / seasonal worker health, campus / university student health.

---

## Section 2: Standards, Codesets & Frameworks

### Clinical content standards

- FHIR R4, R4B, R5, R6 (draft) — primary
- FHIR Bulk Data Access — `$export` (extract) AND `$import` (ingest); Flat FHIR
- FHIR Genomics IG, Workflow IG, Subscriptions (R5 topic-based)
- FHIR Core profiles: US Core, AU Core, UK Core, CA Baseline, International Patient Summary (IPS)
- HL7 v2.3 / 2.4 / 2.5 / 2.5.1 / 2.6 / 2.7 / 2.8
- HL7 v3 (legacy), CDA R2 / C-CDA R2.1
- openEHR archetypes + templates + AQL; ISO 13606
- DICOM (all parts, WADO-RS, QIDO-RS, STOW-RS, UPS-RS, DICOM-SR, DICOM-RT, DICOMweb)
- IDMP (ISO 11615/11616/11238/11239/11240 — medicinal products)

### IHE profiles (cross-enterprise exchange)

- ITI: XDS.b, XCA, PIX, PIXm, PDQ, PDQm, ATNA, BPPC, CT, NTP, DSG, XDR, XDM, MHD, mACM, SVCM, IUA, RID
- PCC: XDS-MS, XPHR, APS, XDS-SD, TOC, QED
- RAD: SWF, PIR, REM, PAC, XDS-I.b
- LAB: LCC, LTW, LDA, LBL
- PHARM: PRE, DIS, PADV, COMM, PML
- CARD: ECG, CIRC; PAT; DENT; EYECARE
- PCD: DEC, ACM, RTM, PIV; QRPH; ITI-XDW; MHD

### Terminologies / vocabularies

- SNOMED CT (international + national editions)
- LOINC (labs, observations, assessments)
- ICD-10-CM / ICD-10-PCS (US); ICD-11 (WHO); ICD-O (oncology)
- CPT (procedures, AMA-licensed); HCPCS Level II
- CDT (dental, ADA-licensed); SNODENT (dental nomenclature)
- RxNorm; NDC (national drug codes); ATC (WHO drug classification)
- ICPC-2 (primary care); NANDA-I, NIC, NOC (nursing)
- OMOP CDM (research)
- DRG / MS-DRG / AP-DRG / APR-DRG / IR-DRG; HCC / RxHCC (risk adjustment); APC
- UCUM (units of measure); UMLS metathesaurus; MeSH
- GMDN / UMDNS / UDI / GUDID (medical devices)
- NCI Thesaurus; OMIM (genetic); HGNC (genes); HGVS (genome variation)
- CVX / MVX (vaccines); HL7 v2 tables (0001..0999); X12 code sets
- ISO 3166 (country codes), ISO 639 (languages), ISO 8601 (dates)
- PH-specific: PH-ICD, PhilPEN, PCS, Pagibig, SSS, PRC codes

### Security, identity & access

- SMART on FHIR v2 (OAuth 2.0, OIDC, App Launch); SMART Backend Services
- CDS Hooks; UDAP Trust Model; HEART profile
- DirectTrust / Direct Project; SAML 2.0; WebAuthn / passkeys; S/MIME
- X.509 / direct trust anchors; PDMP (US state drug monitoring)

### Interoperability networks & frameworks

- US: TEFCA / QHIN, Carequality, CommonWell, eHealth Exchange, Sequoia Project, Argonaut, Da Vinci (payer-provider FHIR), FAST (FHIR at Scale), HL7 Accelerators (Vulcan, CodeX, Helios, Gravity SDOH)
- Australia: My Health Record; Estonia e-Health; Denmark Sundhed; NHS Spine / GP Connect; Finnish Kanta; Sweden NPÖ
- India: ABDM, HPR, HFR, ABHA, Unified Health Interface (UHI)
- Japan: SS-MIX2, MEDIS-DC, JLAC10; Korea: M-FHIR, MyData Healthcare
- Brazil: RNDS, DATASUS; China: WS standards family, HL7 China
- Saudi Arabia: NPHIES; Singapore: NEHR, HealthHub; Malaysia: MyHDW
- Thailand: 43-Files; Indonesia: SatuSehat, BPJS Kesehatan; Vietnam: eHealth Vietnam
- Canada: CA:FeX, PrescribeIT, Infoway; Germany: KV-Connect, gematik TI, MIOs, ePA
- France: DMP, Mon Espace Santé, INS; Netherlands: Nictiz, MedMij, ZIBs; Nordic: Helsenorge (NO), Icelandic Heilsuvera
- Africa / MENA: DHIS2, Egypt Universal Health Insurance, Kenya Integrated Health IS
- LATAM: Mexico SICRES, Colombia HCE, Chile Sistema Integrado
- SureScripts / national e-prescribing

### Financial / revenue cycle

- X12 5010: 270/271 (eligibility), 276/277 (claim status), 278 (auth), 820 (premium), 834 (enrollment), 835 (remittance), 837P/I/D (claims), 999, 277CA
- NCPDP: Telecom D.0, SCRIPT, Batch, Formulary, Medicaid Subrogation, Post Adjudication
- EDIFACT (international); DSRIP / value-based care payment models
- National insurance card formats (PhilHealth, Medicare, Aadhaar-linked, NHS Number, CPF, BSN)

### Quality, reporting & measures

- QRDA Category I / III; eCQMs + CQL; NCQA HEDIS; CMS MIPS / MACRA / APM
- UDS (FQHC Uniform Data System); NHSN (healthcare-associated infections); PAMA (lab reporting)

### Public health & surveillance

- NEDSS (CDC); ELR (Electronic Lab Reporting); eCR (Electronic Case Reporting)
- IIS / MIIS (immunization); Syndromic surveillance (BioSense, ESSENCE); VAERS
- EDRS (electronic death reporting); NNDSS (notifiable diseases)
- WHO ICD / GHSC / SCORE / IHR 2005; PIDSR / SPEED / ESR (PH); GISAID (genomic surveillance)

### Emergency management & disaster

- EDXL family (DE, HAVE, RM, SitRep, TEP); NIMS / ICS / HICS; SALT / START / JumpSTART triage
- ESF-8 (US); NDMS; 9-1-1 / NG911 / PSAP standards; 112, 999, 000, 119 (international)
- NEMSIS (National EMS Information System); National trauma data standards (NTDB, TARN, AusTQIP)

### Health equity & social determinants

- REaL data standards (Race, Ethnicity, Language; OMB 1997 + 2024 revision)
- SOGI (sexual orientation, gender identity) — ONC + HL7 FHIR IG
- Gravity Accelerator (FHIR SDOH IG); PRAPARE; AHC HRSN; SIREN
- Health-related social needs (HRSN) ICD-10-CM Z-codes; ADI, SVI; WHO ICF (disability)

### Device, IoT & sensors

- IEEE 11073 Personal Health Data; Continua Health Alliance; Bluetooth Health Device Profile
- HL7 FHIR Device / DeviceMetric / Observation; MDR / MedWatch (adverse events); GUDID / UDI
- Apple HealthKit / ResearchKit / CareKit; Google Fit / Health Connect; Samsung Health
- Fitbit / Garmin / Oura / Whoop APIs

### Patient-facing / consumer

- Blue Button / CMS Patient Access API; Carin Blue Button
- SMART Health Cards (vaccination, lab results); International Patient Access (IPA)

### Clinical research

- CDISC: SDTM, ADaM, CDASH, ODM, Define-XML, Dataset-JSON
- REDCap; 21 CFR Part 11; ICH / GCP; HL7 FHIR for Research (Vulcan)

### Compliance & regulatory frameworks

- HIPAA (Privacy, Security, Breach Notification) + HITECH; 21st Century Cures Act / ONC HTI-1
- No Surprises Act + Good Faith Estimates + IDR; CMS Hospital Price Transparency; Transparency in Coverage
- Ryan Haight Act (DEA telehealth); SUPPORT Act; Interstate licensure compacts (IMLC, NLC, PT Compact, PSYPACT, etc.)
- GDPR (EU) + ePrivacy; PIPEDA (Canada) / PHIPA (Ontario); LGPD (Brazil); PIPL (China)
- RA 10173 / Data Privacy Act (PH); RA 11223 / UHC Act (PH); POPIA (South Africa); PDPA (SG, MY, TH)
- CCPA / CPRA / CMIA / 42 CFR Part 2 (SUD); APPI (Japan); DPDP Act (India)
- FDA SaMD + ISO 14971 + IEC 62304 + ISO 13485; FDA 21 CFR Part 820; IVDR / MDR (EU)
- DEA: CSOS, ARCOS, Form 222, EPCS; CLIA + CAP + COLA + ISO 15189
- OSHA (bloodborne pathogens, hazard communication); Title VI (language access); ADA; Section 1557

### AI governance, accountability & transparency

- EU AI Act (health AI = high-risk); FDA PCCP (Predetermined Change Control Plan for AI/ML SaMD)
- FDA GMLP (Good Machine Learning Practice); ONC HTI-1 algorithm transparency (DSI criteria)
- NIST AI Risk Management Framework (AI RMF 1.0); WHO Ethics & Governance of AI for Health
- Coalition for Health AI (CHAI) model cards; HIPAA + AI guidance (de-identification for training)
- C2PA 2.0 (content provenance, AI-output signing)

---

## Section 3: Domain Universe

Every domain any health app might need. Not all ship Day-1. Use milestone tags.

### Identity & demographics [CORE]

Patient / MPI, patient matching / deduplication, family / household relationships, guardian / POA / surrogate, emergency contacts, preferred language / communication preferences / accessibility needs, pronouns / gender identity / sexual orientation, race / ethnicity, veteran status, occupation / employer, housing status / SDOH.

### Care delivery — clinical core [CORE/VERT]

Encounter / visit / episode of care, problem list, allergies & intolerances, medication list (active / historical / reconciled), immunization record, family history, social history / lifestyle / SDOH, vitals & measurements (incl. pediatric growth, fetal), flowsheets / assessments (pain, fall, PHQ-9, GAD-7, CIWA, Braden, Morse), clinical notes (SOAP, H&P, progress, consult, discharge summary, op note), templates & dot-phrases, orders / CPOE / order sets / protocols, results (lab, imaging, procedure, referral), care plan / goals / interventions, care team, care coordination / handoffs (I-PASS, SBAR), referrals (inbound / outbound), discharge / transition planning, advance directives / POLST / DNR, consent (treatment, research, data sharing, marketing), risk scores & clinical screeners, triage / acuity / ESI, HPI / ROS / exam / A&P, procedure records & op notes, anesthesia records, surgical timeout / WHO safe surgery checklist, pathology records, genomics / genetic testing & consent.

### Ancillary services [CORE/VERT]

Laboratory (LIS): chemistry, hematology, microbiology, molecular, toxicology, coag, blood gas, transfusion. Specimen management / collection / transport. Pathology: surgical, cytology, autopsy, IHC, molecular. Radiology (RIS + PACS + reporting), radiation dose tracking, critical results. Pharmacy: dispensing, eMAR, BCMA, controlled substances, IV compounding, TPN, automation cabinets, 340B. Blood bank. Respiratory therapy. PT / OT / SLP. Dietary / nutrition / TPN. Diabetes education. Wound care.

### Emergency & acute [CORE/VERT]

ED triage / rooming / flow / boarding, code blue / rapid response / MET, disaster / MCI (HICS activation, surge capacity), EMS integration / ePCR, pre-hospital handoff, psychiatric emergency / ED boarding, forensic evidence handling (SANE, chain of custody).

### Surgical & procedural [CORE/VERT]

OR scheduling / block time, perioperative (pre-op, intra-op, PACU), anesthesia info management, surgical preference cards, tissue tracking / implant registry, endoscopy / scope tracking, sterile processing (CSSD), surgical counts, procedural sedation.

### Inpatient [VERT — hospital]

ADT (admission, discharge, transfer), census / bed management / throughput, nursing assignments / acuity / staffing, fall / pressure ulcer / restraints / suicide watch, infection prevention / contact precautions, hospital-acquired condition tracking, readmission risk, length-of-stay / utilization, hospitalist handoff.

### Intensive & specialty [VERT]

ICU (ventilator, pressors, CRRT, IABP/ECMO), L&D / OB (partogram, fetal monitoring), NICU, Oncology (regimens, cycles, staging, tumor board, infusion), Dialysis (inpatient + outpatient), Behavioral health (milieu, seclusion / restraint), Rehab (FIM / IRF-PAI), Hospice / palliative, Cardiology (cath, echo, stress, EP), Neurology (stroke, EEG), Pulmonology (PFT, BiPAP, sleep), GI / endoscopy, Transplant (UNOS), Pain management (opioid agreements, PDMP).

### Dental [VERT]

Dental charting (FDI / Universal / Palmer), periodontal charting (pocket, BOP, CAL, mobility, furcation, recession), treatment planning (phases, acceptance, carry-over), orthodontics (aligners, brackets, stages, cephalometric), endodontics (canals, working lengths, obturation), prosthodontics (crowns, bridges, dentures, implant-supported), oral surgery (extractions, impactions, grafts), pediatric dentistry (eruption, sealant, behavior), cosmetic (whitening, veneers, smile design), clinical imaging (intraoral, pano, periapical, CBCT), implant registry, lab orders / cases, recall / hygiene, dental insurance / CDT claims, consent per procedure.

### Other clinical verticals [VERT/BACKLOG]

Optometry (refraction, CL fitting, retinal imaging, dispensing), Veterinary (species-aware vitals, breed genetics), Chiropractic (spinal adjustments, SOAP), Mental health / psychiatry (MSE, therapy notes [extra-protected], SUD), Physical therapy (functional assessments, exercise Rx), Audiology (tests, hearing-aid fitting), Podiatry, Allergy / immunotherapy (testing, build-ups), Reproductive / IVF (cycle, stim, embryo inventory), Obstetrics / prenatal, Pediatrics (growth charts, milestones, Bright Futures), Geriatrics (frailty, CGA, polypharmacy), Sleep medicine, Palliative / hospice, Integrative / TCM / Ayurveda.

### Post-acute, LTC, home [VERT]

SNF (MDS 3.0, RAI, restorative nursing), home health (OASIS, 485, visit notes), hospice (IDT, terminal diagnosis), rehab (IRF-PAI), assisted living (ADL tracking, activity programs), PACE.

### Public health & population [VERT/EXT]

Immunization registry / IIS, vital records (birth, death, fetal death), reportable conditions / communicable disease, STI / HIV / hepatitis, TB / DOT, maternal-child / WIC, cancer registry (SEER, state), trauma registry (NTDB), poison control / NPDS, birth defects / rare disease registry, chronic disease registry, lead poisoning, environmental health (water, air, foodborne outbreak), newborn screening, school health, occupational health surveillance, travel medicine, pandemic / outbreak response (PHEIC, contact tracing, quarantine).

### Prevention & wellness [VERT]

Lifestyle / health coaching, smoking cessation, nutrition counseling, weight management, exercise prescription, mindfulness, digital therapeutics (DTx), wearable integration (BYOD health data), femtech (cycle tracking, fertility, menopause), men's health (hormone replacement, sexual health).

### Social determinants & community care [CORE/VERT]

SDOH screening (PRAPARE, AHC HRSN) + Z-code assignment, closed-loop referrals to CBOs, food insecurity (food bank networks, meal delivery, produce prescriptions), housing (navigation, shelter placement, permanent supportive housing, medical respite), transportation (NEMT brokers, ride-share Uber Health / Lyft Healthcare), employment / benefits navigation (SSI, SSDI, SNAP), legal aid / medical-legal partnerships, community health worker (CHW) programs, integration with SDOH platforms (Unite Us, findhelp, NowPow, Healthify, Signify Health).

### Compliance, audit & governance [CORE]

Compliance program management (policies, attestations, exceptions), Sunshine Act / Open Payments, Anti-Kickback / Stark Law monitoring, OIG / SAM.gov / OFAC sanctions screening, compliance hotline / whistleblower intake, policy library / document control / attestation ledger, training compliance tracking (HIPAA, OSHA, bloodborne pathogens), BAA / DPA lifecycle, downstream / subprocessor registries, consent artifact vault, incident reporting (clinical, security, privacy), RCA + FMEA, peer review / M&M, sentinel event reporting, breach risk assessment + notification, privacy complaint intake + OCR response, information blocking exceptions, access investigations, break-glass / emergency access logs, record amendment requests, accounting of disclosures, data retention schedule + legal holds, litigation hold (eDiscovery), subpoena / legal request intake, chain of custody (forensic), regulatory inspection records, CAPA tracking, contract lifecycle (physician, payer, vendor), 340B compliance, DEA controlled substance records, CLIA records, OSHA logs (300/300A/301).

### Audit trails & evidence [CORE]

Immutable access logs (who read what, when, from where), change logs (before/after values), authentication logs (login, MFA, failed attempts, lockouts), authorization logs (permission grants/revocations), break-glass / emergency override logs, consent capture/revocation audit, export / download logs, print logs, API / integration logs (payload hashes), webhook delivery receipts + retry history, background job / worker execution logs, admin action logs, data integrity checks (hash ledger, tamper detection), retention / purge evidence, audit query/export for regulators.

### Reporting & analytics [CORE]

Operational (daily census, admissions, ED throughput, clinic no-show rate), clinical (outcome measures, mortality, morbidity, readmission, LOS, HACs), financial (AR aging, denial rate, collection rate, gross-to-net, contractual adjustments), payer-specific (STAR, HEDIS, P4P), quality (eCQMs, NHSN, MIPS, UDS), regulatory (state-required, CMS cost reports, CDC, PhilHealth quality), population health analytics (risk stratification, care gap reports), patient experience (HCAHPS, NPS), research / de-identified cohort extracts, executive dashboards, service line P&L, capacity & forecasting, provider productivity (RVUs, panel size), coding accuracy / compliance, transparency reports (pricing, outcomes — where mandated). Export formats: PDF, CSV, XLSX, JSON, FHIR Bundle, HL7 v2, QRDA. Scheduled delivery: email, SFTP, S3, webhook.

### Practice & business operations [CORE]

Revenue cycle (eligibility, pre-reg, coding, scrubbing, claim submission, denial management, AR, collections), patient billing / statements / payment plans / financial assistance, chargemaster / price transparency, prior authorization, coordination of benefits, medical necessity, HIM (ROI, chart deficiency, coding audits, transcription), patient portal, online scheduling / booking, patient intake / digital forms / PROMs, marketing / acquisition, reputation / reviews, referral management, satisfaction surveys, grievance / complaints / appeals, credentialing / privileging / OPPE / FPPE, medical staff office, staff scheduling / acuity-based staffing, staff competency / training / CE / CME, patient safety events (AHRQ PSI), infection prevention (NHSN), quality measures / eCQMs, value-based care / ACO / MSSP / capitation, asset management / biomedical equipment, supply chain (GPO, contracts, PAR levels, reorder points), inventory (clinical, non-clinical), pharmacy purchasing / 340B, capital equipment lifecycle, facilities / engineering / work orders, EVS / laundry / transport, food service, retail (pharmacy, gift shop, cafeteria), volunteer / auxiliary management, donor / philanthropy / CRM (with HIPAA firewall), grants management, forms lifecycle management, kiosk / self-service check-in.

### Interoperability & exchange [CORE/EXT]

HL7 v2 interface engine (inbound / outbound), FHIR server / facade / gateway, CDA / C-CDA generation + consumption, Direct messaging, TEFCA / Carequality / CommonWell participation, SMART App launch + CDS Hooks service, Bulk Data `$export` + `$import`, terminology service (tx.fhir.org-class), master data management (MDM), HL7 v2 to FHIR bridge, document / record locator (XDS query, DocumentReference), consent directive exchange, IHE XDS repository / registry, PDMP integration, e-prescribing (SureScripts / national), patient matching / MPI, HIE membership / participation.

### Commercial EHR integrations [EXT — adapter pattern]

Epic (App Orchard, Epic on FHIR, Interconnect, Care Everywhere), Oracle Health / Cerner (Millennium, HealtheIntent), Meditech (Expanse, Traverse Exchange), Athenahealth (marketplace, athenaOne FHIR), NextGen, eClinicalWorks, Allscripts/Veradigm, Greenway, Practice Fusion, Kareo/Tebra, DrChrono, Elation, Healthie, Canvas, Osmind, Nextech, ModMed, CareCloud, AdvancedMD, OpenEMR, OpenMRS, Bahmni.

### Interoperability brokers / data networks [EXT — adapter pattern]

Redox, Health Gorilla, Particle Health, 1upHealth, Zus Health, Metriport, Commure, Datavant, Rhapsody, InterSystems HealthShare + IRIS for Health, Mirth Connect / NextGen Connect.

### Non-health integrations [EXT — adapter pattern]

Identity verification (Jumio, Onfido, Persona, Socure), payment gateways (Stripe, Adyen, Braintree; PayMongo-PH, Razorpay-IN, GCash, GrabPay, Maya), SMS/email/voice (Twilio, Sinch, SendGrid, Postmark, Resend), video (Zoom, Teams, Doxy.me, VSee, Amwell), e-signature (DocuSign, HelloSign, Adobe Sign), cloud storage (S3, GCS, Azure Blob, Cloudflare R2), CRM (HubSpot, Salesforce Health Cloud), ERP (SAP, Oracle, Odoo, Workday), accounting (QuickBooks, Xero, Zoho Books), marketing automation (Klaviyo, Customer.io, Intercom), calendar (Google, Outlook, Apple, Cronofy), maps / geocoding (Google, Mapbox, HERE), BI / data warehouse (Snowflake, BigQuery, Databricks, Redshift), observability / SIEM (Datadog, Splunk, Elastic, Sentry), helpdesk (Zendesk, Freshdesk), procurement (Coupa, Ariba, GHX), consumer health platforms (Apple HealthKit, Google Health Connect, Samsung Health, Fitbit, Oura, Dexcom, Abbott Libre, Omron), LLM providers (OpenAI, Anthropic, Google, Meta, Mistral, Together, local deployments), translation services (Google Translate, DeepL, Languageline, Cyracom), fax (Concord, eFax, Documo/mFax).

### Localization & regional [LOC]

National ID systems (PhilSys, Aadhaar, SSN, NINO, BSN, CPF, MyKad-MY, NRIC-SG), national insurance / payer schemes (PhilHealth, Medicare, NHS, SUS, Ayushman Bharat, NHIF-KE), national provider / facility registries (NHFR-PH, NPPES-US, CQC-UK, HPR-IN), national drug formularies / pricing, national immunization registries, national disease registries, currency / tax / VAT / GST / e-invoicing, language / script / RTL / multi-script (Arabic, Chinese, Thai, Hebrew, Urdu, Amharic), holidays / work-week / calendar (Hijri, Thai Buddhist, Ethiopian, Persian Jalali), cultural / religious care preferences (halal meds, kosher, fasting, modesty/chaperone rules), country-specific data residency / sovereignty.

---

## Section 4: Stakeholder Map

### Direct care providers

Physicians (MD/DO), dentists (DDS/DMD), NPs/PAs, RNs/LPNs/CNAs, pharmacists/techs, therapists (PT/OT/SLP/RT), dietitians, social workers, case managers, chaplains, dental hygienists/assistants, medical assistants, rad/lab/surg techs, EMTs/paramedics, midwives/doulas, mental health counselors/psychologists, community health workers, peer support, optometrists/opticians, chiropractors, home health aides, certified recovery peer specialists, harm-reduction workers, doulas (birth, death, abortion), lactation consultants, genetic counselors, diabetes educators (CDCES).

### Patients & patient-adjacent

Patients, family caregivers / surrogates, pediatric guardians, advance-directive agents, emergency contacts, support groups, patient advocacy organizations.

### Administrative & operational

Practice managers, clinic admins, hospital C-suite (CEO/COO/CMO/CNO/CFO/CIO/CISO/CMIO/CNIO), billers/coders, HIM staff, schedulers, receptionists, call-center staff, compliance officers, privacy officers, quality/safety officers, risk managers, credentialing/medical staff office, revenue cycle, procurement/supply chain, sterile processing, EVS, dietary, biomedical/clinical engineering, plant ops.

### Payers

Claims processors, utilization reviewers, care/case managers, prior-auth teams, provider-network teams, actuaries, FWA investigators, medical directors (payer-side).

### Regulators & accreditors

Licensing boards, accreditation surveyors, public health investigators, FDA/EMA/PMDA/FDA-PH inspectors, OCR privacy investigators, state AGs, CMS surveyors, DEA inspectors, CLIA inspectors, radiation safety inspectors.

### Auditors — internal & external

- Internal: compliance auditor, HIM/coding auditor, CDI specialist, privacy auditor, security auditor, quality auditor, infection-control auditor, pharmacy auditor (340B, controlled substances).
- External payer: RAC, MAC, SMRC, CERT, UPIC, QIC, ALJ, OIG, DOJ FCA investigators, payer pre/post-payment review.
- External clinical: Joint Commission surveyor, DNV / HFAP / AAAHC surveyors, CMS validation surveyor, state licensure surveyor, PhilHealth quality audit team.
- External IT/security: HITRUST assessor, SOC 2 auditor, ISO 27001 auditor, PCI-DSS auditor, penetration tester.
- External privacy: OCR investigator (HIPAA), NPC investigator (PH DPA), ICO investigator (GDPR).
- External financial: external CPA, Medicare cost report auditor, tax auditor (IRS, BIR).
- Research / IRB: FDA BIMO inspector, sponsor / CRO monitor, IRB auditor, OHRP investigator.
- Corporate Integrity Agreement monitor (if under CIA).

### Compliance & privacy professionals

CCO, CPO, HIPAA Privacy Officer, HIPAA Security Officer, DPO (GDPR/DPA), Information Blocking Officer.

### Researchers & analysts

Principal investigators, research coordinators, sponsors, biostatisticians, epidemiologists, public health researchers, health economists, population health analysts, data scientists.

### External ecosystem

Reference labs, imaging centers, pharmacies, DME suppliers, HIEs, device manufacturers, pharma reps, med-legal (plaintiff/defense, expert witnesses), public health departments, law enforcement (warrants, reportable events), courts (custody, guardianship, competency), employers / HR, schools, camps / sports, insurance adjusters (auto / workers comp), government benefit admins, health-tech vendors, third-party integrators.

### Death, forensic & disposition chain

Coroner / medical examiner, forensic pathologist, death investigator, autopsy technician, funeral director / mortician, crematory operator, cemetery sexton, grief counselor, clergy, organ procurement coordinator (OPO), tissue recovery coordinator, eye bank coordinator, body donation program coordinator, vital records registrar, Social Security notification.

### Protective services & legal custody

CPS caseworker, APS caseworker, foster care caseworker, public guardian, court-appointed guardian / conservator, guardian ad litem, competency evaluator, probate / family court clerk, sexual assault forensic examiner (SAFE/SANE), domestic violence advocate, human trafficking response team, mandated-reporting intake hotline.

### SDOH & community

Transportation providers (NEMT brokers: LogistiCare/MTM/ModivCare; Uber Health, Lyft Healthcare), housing navigators, food banks / meal delivery, employment services, legal aid, DV shelters, CHW networks (promotoras), harm reduction organizations, refugee resettlement caseworkers.

### Language, culture & accessibility

Medical interpreter (CHI/CMI certified), ASL interpreter, cultural broker / patient navigator, disability advocate, religious / spiritual advisor, dietary consultant (halal/kosher/vegan/diabetic).

---

## Section 5: Representative Use Cases (by stakeholder)

One-liners only — full workflows live in spec `@workflow` primitives.

**Patient** — book appointment; complete intake; pay bill; request refill; view results; message clinician; authorize record share; enroll in trial; monitor vitals at home; receive reminder; update emergency contact; revoke consent; request records (ROI).

**Family caregiver** — view parent's chart with proxy access; coordinate home health visits; reconcile meds; attend telehealth on patient's behalf.

**Physician / NP** — chart visit; place orders; review results; sign/co-sign; e-prescribe (incl. EPCS); refer; handoff; search knowledge / CDS; document for billing; review AI scribe draft; respond to prior auth; submit reportable condition; attest quality measures.

**Dentist** — chart teeth; plan treatment in phases; submit CDT claim with X-ray; order lab case; send prescription; complete perio exam.

**Nurse** — triage; med pass (BCMA); admission assessment; flowsheet entry; discharge teaching; care plan updates; nurse-to-nurse handoff.

**Pharmacist** — verify order; check interactions; counsel patient; manage controlled substance inventory; adjudicate insurance; perform MTM; refill sync.

**Biller / coder** — code visit; scrub claim; resolve denial; appeal; post payment; manage AR.

**Scheduler** — book / reschedule; manage waitlist; fill cancellations; block management.

**Compliance officer** — manage policy library; track attestations; run sanctions screening; investigate hotline reports; manage BAA lifecycle; respond to subpoena; coordinate breach risk assessment; report to board compliance committee.

**Privacy officer / DPO** — process patient access requests; handle amendment requests; produce accounting of disclosures; investigate complaints; coordinate DPIA (GDPR); review new data-sharing contracts; coordinate with NPC-PH / OCR investigations.

**Auditor (internal or external)** — pull chart sample by criteria; review coding / documentation standards; produce audit findings report; track remediation; re-audit; generate chain-of-custody export; validate log integrity; verify retention / purge records; confirm BAA coverage for vendor access.

**Association / professional body staff** — maintain member directory; track CE/CPD credits; renew membership; run elections; manage committees; host events with CE credit; run certification exams; manage board certification status; respond to ethics complaints.

**HIM / medical records staff** — process ROI requests; manage chart deficiency lists; track unsigned notes; manage transcription queue; coordinate subpoena requests; manage record destruction after retention period.

**Credentialing / medical staff office** — primary source verification; track license expirations; DEA registration renewals; board certification tracking; OPPE/FPPE reviews; re-appointment cycles.

**Mandatory reporter** — file suspected child abuse to CPS; elder abuse to APS; domestic violence screening + referral; gunshot/stab-wound reporting to law enforcement; communicable disease reporting; cancer case reporting; birth defect reporting; opioid overdose reporting.

**SAFE/SANE forensic examiner** — complete sexual assault kit with chain of custody; document injuries with photography protocol; preserve evidence; coordinate with law enforcement; testify in court.

**Downtime scenarios** — scheduled downtime: notify users, print downtime forms + census, switch to read-only kiosk, capture paper, reconcile on restore. Unscheduled outage: activate downtime command, paper orders with downtime ID, verbal order protocol, pharmacy override key, restore with timestamped backfill.

**Record merge / unmerge** — identify duplicate MRN; validate identity; merge with audit preservation; alert all subscribing systems (HIE, pharmacy, labs); handle merge reversal if error discovered.

**Provider leaving group** — generate patient notification letters (Stark compliant); reassign open orders / pending results / care plans; transfer chart access; handle non-compete + data portability; retain provider's documentation for liability window.

**Adolescent confidentiality workflow** — configure confidential zones (reproductive health, SUD, mental health); redact from proxy access; release to patient only at age of majority; handle state-by-state variation in minor-consent laws.

---

## Section 6: Scope Decision Table

When each catalog area is addressed across milestones.

| Catalog Item | M0–M3 | M4–M6 | M7–M8 | Post-GA |
|---|---|---|---|---|
| 22 Core Shared Domains | Partial (8, Dental-needed subset) | Full 22 | Stable | Extended |
| Dental vertical | Ship | Iterate | Stable | Extended |
| Hospital vertical | Out | Ship Tier 1–2 (ADT, Encounter, Orders, Pharmacy, Bed Mgmt, ED) | Tier 3+ | Full |
| Association vertical | Out | Ship | Stable | — |
| Optometry / Vet / Mental Health / Pharmacy-Retail / Home Care / Public Health | Out | Out | Community submissions | Community-owned |
| PH localization adapter | Architecture reserved (M1) | Ship | Stable | Extended |
| US / EU / ASEAN / LATAM / Africa adapters | Out | Out | Community | Community-owned |
| FHIR R4 mapping | In (presence + round-trip) | Extended | Full semantic review | Certified |
| HL7 v2 bridge | Out | Partial (ADT/ORM/ORU/SIU) | Full | Extended |
| DICOM / DICOMweb | Out | Partial (hospital imaging) | Full | Extended |
| IHE profiles | Out | Partial (XDS, ATNA, PIX) | Extended | Certified |
| X12 EDI claims | Out | Partial (837/835 via adapter) | Extended | — |
| NCPDP e-prescribing | Out | Out | Via adapter | Extended |
| TEFCA / QHIN participation | Out | Out | Out | Consider |
| Clinical research (CDISC) | Out | Out | Out | Community |
| Device / IoT / wearables | Out | Via adapter | Extended | — |
| AI scribe / ambient doc | Out (LLM adapter only) | Out | Consider as reference impl | — |
| National EHR connectors | Out | PH-only | Extended | Community |
| Trust Kernel — slot types (Layer 1.5) | Declared as typed holes (M1), visible in Dental spec (M3) | `did:web` live (M5); PhilHealth VC (M6) | Selective disclosure + confidential compute (M7); PQC hybrid (M8) | Pure PQ; chain-backed DID adapters |
| AI Governance primitives | All 7 declared as no-op metadata (M1) | `@requiresApproval` + `@aiDisclosure` runtime in Dentalemon (M5); AI-BOM generation (M6) | Full runtime for all 7; EU AI Act compliance export (M7); BOM by counsel (M8) | Ongoing evolution tracking |
| HealthEMR-Bench | Scoring schema + `@workflow` primitives (M3); zero scenarios | 50 Dental scenarios (M4); 150 cross-vertical private leaderboard (M5); equity/accessibility/disaster batteries (M6) | Public leaderboard (M7); Benchmark 1.0 frozen (M8) | Community verticals; external certification body possible |
| Runbooks-as-Code | Typed shapes declared (M1); no authoring | No active authoring (M4–M7) | Seed runbooks for Dentalemon + Ospitalis; `health-ops` CLI (M8) | Full 12-item catalog community-contributed |

---

## Section 7: Open Catalog Gaps

Flagged for team discussion — items to accept, reject, or reshape when authoring vertical specs:

- **Psychotherapy notes** (42 CFR Part 2-class extra-protected data): separate slot or vertical extension? (Current plan: vertical extension.)
- **Sensitive data categories** (HIV status, gender affirmation, SUD, abortion care): needs a dedicated `sensitivity` primitive for query-time filtering.
- **Pediatric adolescent confidentiality**: parental proxy with confidential-zone redaction. Real engineering — not free.
- **Genetic data**: separate consent, family implications, research use. Needs distinct domain or slot.
- **Deceased patient handling**: billing estate, ROI, research workflows change. Needs explicit state.
- **Dental-medical crossover** (oral-systemic health, sleep apnea): does Dental vertical talk to a Medical vertical? Needs cross-vertical pattern.
- **Veterinary**: explicitly adjacent but not clinical health. Sister project or forever out-of-scope?
- **SDOH data**: Gravity Accelerator exists. Adopt it or replicate?
- **Clinical trials management**: own vertical or integration with external CTMS?
- **Cross-border care** (medical tourism, teleconsults across borders): regulatory complexity — suggest deferred post-GA.
- **Patient-generated health data (PGHD) at scale**: adapter handles ingestion but storage/semantics needs thought.
- **Multi-entity consolidation** (health system with 10 hospitals): how does billing, scheduling, and records roll up? Needs enterprise primitives.
