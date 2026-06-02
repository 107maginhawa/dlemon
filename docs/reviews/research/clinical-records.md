# Clinical Records — Industry, Clinical & Legal Standards Research

Scope: prescriptions, informed consent, lab orders/case management, medical history, and record amendments for a dental practice-management application. Compiled 2026-06-02. Evidence-backed; inline source URLs per claim.

---

## Industry-standard benchmark

### 1. Prescriptions

**Required elements (all prescriptions).** Federal law (21 CFR Part 1306) requires every controlled-substance prescription to be dated as of and signed on the day issued, and to bear: issue date; patient full name and address; drug name, strength, dosage form, quantity prescribed; directions for use (sig); and the prescriber's name, address, and DEA registration number. (https://www.ecfr.gov/current/title-21/chapter-II/part-1306, https://pmc.ncbi.nlm.nih.gov/articles/PMC3847977/) Best-practice prescription content in dentistry additionally captures prescriber license number and NPI alongside the DEA number. (https://pocketdentistry.com/2-the-prescription-and-drug-names/)

**Drug-drug / drug-allergy interaction & allergy checking.** Mature PM systems gate prescribing on the patient's medication, problem, and allergy lists. Open Dental lets users attach Problem / Medication / Allergy entries to an Rx "Alerts" field so a warning fires at prescribe time when the patient's chart matches; alerts can carry a custom message and an "Is High Significance" flag (so low-priority alerts can be suppressed under EHR settings). Correct firing depends on de-duplicated Problem/Medication/Allergy master lists. (https://www.opendental.com/manual/rxinteractionchecks.html) Full drug-drug/drug-allergy interaction checking is provided through the certified eRx integration (NewCrop/Ensora), and notably the patient's allergy + medication list must be present in the eRx system or checks are incomplete. (https://www.opendental.com/manual/newcropdruginteraction.html)

**Controlled-substance handling & e-prescribing (EPCS/Surescripts).** DEA requires an EPCS to be transmitted in its electronic form and never converted to another format (e.g., fax) for transmission. (https://www.deadiversion.usdoj.gov/faq/epcs-faq.html) EPCS-compliant software must enforce prescriber identity proofing, multifactor authentication, and access controls before any controlled-substance Rx can be sent, and the application itself must pass a DEA-required third-party audit/certification before it can transmit EPCS messages over the Surescripts network. (https://surescripts.com/what-we-do/e-prescribing-for-controlled-substances) E-prescribing of controlled substances is now mandated federally (Medicare Part D, effective 2021) and by ~35 states. (https://www.agd.org/constituent/news/2020/08/10/don-t-panic-over-mandated-e-prescribing-of-controlled-substances-laws, https://www.cms.gov/medicare/e-health/eprescribing/cms-eprescribing-for-controlled-substances-program, https://www.modental.org/member-resources/practice-topics-faq/practice-topics-faq-members/eprescribe-controlled-substances) CMS measures compliance as a percentage threshold (e.g., ≥70% of qualifying Schedule II–V prescriptions e-prescribed for MY 2024), implying the system must track e-prescribed vs. paper denominators. (https://www.cms.gov/medicare/e-health/eprescribing/cms-eprescribing-for-controlled-substances-program)

**Prescriber authorization.** EPCS access is per-prescriber: identity-proofed, MFA-enrolled, with access-control permissions set per provider before they may prescribe controlled substances. (https://surescripts.com/what-we-do/e-prescribing-for-controlled-substances)

### 2. Informed consent

**Legal/clinical requirement (ADA).** The ADA recognizes three tiers — implied, general, and informed consent — and requires informed consent for *every procedure beyond those covered by general consent*; the dentist (not staff) must personally have the informed-consent discussion. (https://www.ada.org/resources/practice/practice-management/types-of-consent)

**What must be captured.** The consent discussion must cover: the observed problem; nature of the proposed treatment; benefits and risks of treatment; treatment alternatives; and risks/benefits of alternatives including *non-treatment* — with an opportunity for the patient to ask questions. A note must be made in the record *at the time of the conversation* recording whether informed consent was granted or whether *informed refusal* occurred; consent forms should be *specific to the procedure*; and the patient signature must be obtained before treatment begins. Complex treatment consent should be obtained in advance of the treatment appointment. (https://www.ada.org/resources/practice/practice-management/types-of-consent) A written, signed informed consent before any invasive/risky procedure is the documented ethical/legal standard. (https://pmc.ncbi.nlm.nih.gov/articles/PMC4005206/)

**E-signature validity & immutability.** Electronic informed consent is accepted and is "here to stay"; consent can be captured electronically prior to the visit when incorporated into the practice's EHR. (https://decisionsindentistry.com/article/electronic-consent-is-here-to-stay/) FDA/HHS guidance recommends the subject receive a copy of the *signed* consent, and signatures must be reliably attributed and the signed document preserved. (https://www.hhs.gov/ohrp/regulations-and-policy/guidance/use-electronic-informed-consent-questions-and-answers/index.html, https://dimensionsofdentalhygiene.com/article/securing-informed-consent/) The medico-legal implication (see §5) is that a signed consent record must be immutable after signature — preserved as-signed with attribution and timestamp.

### 3. Lab orders / case management

**Lifecycle / state machine.** Cases move through discrete stages — typically *sent/submitted → in production (at lab) → received → seated/delivered* — with date capture at each milestone. Lab software exposes customizable workflow stages and moves cases through them. (https://www.seazonasupport.net/tutorial/case-management, https://www.dentallabguru.com/dental-lab-case-management-software) CareStack tracks the case "from sending impressions to receiving completed restorations," with sent/received status and date tracking per milestone. (https://carestack.com/dental-software/features/lab-case-management)

**Information labs need.** Industry standard order fields: doctor/prescriber, tooth number(s), tooth shade, material, due date, lab assignment, cost, and patient + appointment linkage. (https://www.instagram.com/reel/DTjV5RrjlOd/, https://carestack.com/dental-software/features/lab-case-management)

**Tracking & due-date safety.** Best practice is a dashboard with filters by due date and by lab, multi-lab visibility so no order is overlooked, and proactive status checks 2–3 days before the patient appointment. (https://www.dentallabguru.com/dental-lab-case-management-software, https://www.nextdentallab.com/handle-dental-lab-rush-case/) Linking the case to the patient appointment enables alerts/reminders for case readiness and prevents cancelled appointments for patients awaiting restorations; the module maintains an audit trail of every step. (https://carestack.com/dental-software/features/lab-case-management)

### 4. Medical history

**Questionnaire content.** A standard dental health-history questionnaire captures medical conditions/problems, current medications, and allergies — the three lists that also drive prescription interaction alerts. (https://www.opendental.com/manual/rxinteractionchecks.html, https://yapi.zendesk.com/hc/en-us/articles/4410340993939) These lists are configurable masters that flow onto the patient-facing medical history form and into chart-level medical alerts. (https://help.nexhealth.com/en/articles/10428479)

**ASA Physical Status classification.** The ASA PS system (ASA I = healthy; II = mild systemic disease; III = severe systemic disease; IV = severe disease that is a constant threat to life; V = moribund, not expected to survive without surgery; VI = brain-dead organ donor; suffix "E" = emergency) is widely used in dentistry as the basis for medical risk stratification and sedation eligibility. (https://www.ncbi.nlm.nih.gov/books/NBK441940/, https://my.clevelandclinic.org/health/articles/12976-anesthesia-physical-classification-system, https://emedicine.medscape.com/article/2172425-overview, https://pubmed.ncbi.nlm.nih.gov/26868794/) Many sedation guidelines reference ASA PS for risk. (https://www.researchgate.net/publication/294285074_Medical_risk_assessment_in_dentistry)

**Periodic re-confirmation.** The medical history questionnaire must be updated/re-confirmed regularly — approximately every 3 to 6 months, or after any prolonged lapse in treatment. (https://www.sciencedirect.com/topics/medicine-and-dentistry/asa-physical-status-classification-system [search snippet])

**Alerts / contraindications at point of care.** Conditions/allergies/medications surface as chart-level *medical alerts* and feed prescribing interaction checks, so contraindications are visible at the point of care; alert significance can be tiered (high vs. low) to reduce alert fatigue. (https://help.nexhealth.com/en/articles/10428479, https://www.opendental.com/manual/rxinteractionchecks.html)

### 5. Record amendments / corrections (medico-legal)

**Append-only, never delete (HIPAA).** Under HIPAA 45 CFR §164.526, amendment does not erase original data — entities are *not* required (or permitted, as practice) to delete from the designated record set; they *append* the correction and must establish a clear link between the amendment and the original entry, noting the date and the reason for the error. The entity must document who is responsible for processing amendment requests, and must notify the individual, prior recipients who relied on erroneous data, future recipients (with any denial/disagreement statements), and business associates. (https://www.bricker.com/insights/.../164-526-f, https://www.ahima.org/media/r2dc4xhg/amendments-in-the-electronic-health-record_axs.pdf)

**Addenda vs. late entries; timestamp & attribution (CMS).** Original entries must remain visible and must not be obscured. New later-known information is added as an *Addendum* (clearly labeled, current date/time, referencing the original); recalled omitted information is a *Late Entry* (clearly labeled, current date/time, referencing the original, **never backdated**). Every modification carries the *current* date/time (not the service date) and the author's signature/identity. Systems must keep tamper-proof audit trails that track the user who made changes, log date/time, and preserve the original entry. Timeliness matters: gold standard 24–72 hours; edits after 30–90 days face high scrutiny; modifications after 90 days are presumed fraudulent. (https://www.tainoconsultants.com/blog/navigating-cms-medical-records-modifications) Making corrections after records are requested for review/denial is treated as illegitimate. (https://www.aapc.com/discuss/threads/...181112/)

### Competitor handling (summary)
- **Open Dental** — Problem/Medication/Allergy master lists drive both the medical history form and Rx alerts; high-significance alert tiering; certified eRx (NewCrop/Ensora) for drug-drug/drug-allergy and EPCS. (https://www.opendental.com/manual/rxinteractionchecks.html, https://www.opendental.com/manual/newcropdruginteraction.html)
- **CareStack** — dedicated Lab Case Management module: full sent→received lifecycle, tooth/shade/material/cost capture, multi-lab dashboard, appointment linkage + reminders, audit trail. (https://carestack.com/dental-software/features/lab-case-management)
- **Dentrix / NexHealth / YAPI** — medical-alert and medical-history-form integrations layered on Open Dental's condition/allergy/medication lists. (https://help.nexhealth.com/en/articles/10428479, https://yapi.zendesk.com/hc/en-us/articles/4410340993939)

---

## Completeness gaps to check in our product

Use as an audit checklist; verify each against our schema, handlers, and UI.

**Prescriptions**
- [ ] Rx captures all legally required fields: issue date, patient name+address, drug name/strength/form, quantity, sig/directions, prescriber name+address+DEA (and license/NPI).
- [ ] **Drug-drug interaction checking** at prescribe time against the patient's active medication list.
- [ ] **Drug-allergy checking** at prescribe time against the patient's allergy list, with a hard/soft block.
- [ ] **Allergy alerts surfaced at point of care** (chart-level), not only inside the Rx flow.
- [ ] Controlled-substance schedule recorded; **e-prescribing/EPCS** support (electronic-only transmission, identity proofing, MFA, per-prescriber authorization).
- [ ] Tracking of e-prescribed vs. paper for CMS-style compliance reporting (if in scope).
- [ ] Alert-significance tiering to manage alert fatigue.

**Informed consent**
- [ ] **Per-procedure consent** forms (procedure-specific, not a single blanket form).
- [ ] Consent record captures: nature, benefits, risks, alternatives, and risks of non-treatment.
- [ ] Records both **granted consent and informed refusal**, timestamped at the conversation.
- [ ] Attributes the consenting dentist (provider identity).
- [ ] **E-signature captured and immutable after signature** (preserved as-signed, tamper-evident); patient can receive a copy.
- [ ] Support for obtaining consent in advance of the treatment appointment.

**Lab orders / case management**
- [ ] **Lab order lifecycle/state machine** (sent → in production → received → seated/delivered) with per-stage timestamps.
- [ ] Order captures shade, material, tooth number(s), due date, lab assignment, prescriber, cost.
- [ ] **Due-date tracking** with dashboard/filtering and overdue/upcoming alerts.
- [ ] Case linked to the patient appointment; readiness reminders before appointment.
- [ ] Multi-lab visibility; per-case audit trail.

**Medical history**
- [ ] Structured capture of conditions, medications, and allergies (drives alerts + interaction checks).
- [ ] **ASA Physical Status** classification field (I–VI, +E) for risk stratification / sedation eligibility.
- [ ] **Periodic re-confirmation** prompt (every 3–6 months / after lapse in treatment) with re-attestation timestamp.
- [ ] **Medical alerts / contraindications surfaced at point of care** across chart, prescribing, and treatment planning.

**Record amendments / corrections**
- [ ] **Append-only** records — original entries never deleted or obscured.
- [ ] Amendments/addenda/late entries clearly labeled, with current (non-backdated) timestamp and author attribution, linked to the original entry, and reason captured.
- [ ] Immutable signed artifacts (consent, prescriptions) cannot be edited in place after signature.
- [ ] Tamper-proof **audit trail** (who/when/what) with version/history retention.
- [ ] HIPAA §164.526 amendment-request workflow (accept/deny, individual + recipient notification) — verify scope.
