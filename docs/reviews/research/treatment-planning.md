# Treatment Planning — Industry & Clinical Standards Research

Research scope: clinical sequencing/phasing, CDT coding + insurance estimation, case-presentation/acceptance UX, competitor PMS patterns (Dentrix, Open Dental, Curve, CareStack, tab32, Pearl/Overjet), and scheduling/charting linkage. All claims carry inline source URLs.

Date: 2026-06-02

---

## Industry-standard benchmark

### Clinical sequencing / phasing

- **Complex plans are sequenced into discrete phases**, the canonical model being: **(0) Systemic/medical → (1) Urgent/acute → (2) Disease Control → (3) Re-evaluation → (4) Definitive/corrective → (5) Maintenance.** Each phase must be substantially complete before the next begins. (https://pmc.ncbi.nlm.nih.gov/articles/PMC3467905/)
- **Systemic phase** addresses the patient's general health (medical conditions, medications, premedication, host risk) so subsequent dentistry is safe — it is a prerequisite, not optional, for medically complex patients. (https://pocketdentistry.com/5-the-systemic-phase-of-treatment/)
- **Urgent/acute phase**: pain, infection, swelling, bleeding, or broken teeth are managed first — "certainly before initiation of subsequent phases." (https://pmc.ncbi.nlm.nih.gov/articles/PMC3467905/ ; https://www.overjet.com/blog/how-to-achieve-consistent-treatment-planning-in-your-dental-practice)
- **Disease-control phase** stabilizes active disease before any definitive work: caries excavation + temporary/interim restorations, scaling & root planing, extraction of hopeless teeth, endo/perio therapy, replacing defective restorations, occlusal adjustment, and preventive measures. (https://www.overjet.com/blog/how-to-achieve-consistent-treatment-planning-in-your-dental-practice ; https://www.teero.com/blog/dental-treatment-plan-phases)
- **Re-evaluation phase** is an explicit holding/assessment step: re-probe perio, confirm healing, and revise the plan — "probing depths may improve... eliminating the need for surgical intervention, or they may reveal persistent disease." (https://www.overjet.com/blog/how-to-achieve-consistent-treatment-planning-in-your-dental-practice)
- **Definitive phase** placement of permanent restorations/prosthetics follows functional priority — "posterior teeth before anterior, foundation before superstructure," integrating operative/endo/perio/ortho/prostho. (https://www.overjet.com/blog/how-to-achieve-consistent-treatment-planning-in-your-dental-practice ; https://pmc.ncbi.nlm.nih.gov/articles/PMC3467905/)
- **Maintenance phase**: risk-based recall (≈3–4 months high-risk → 9–12 months stable), home-care protocols, monitoring. (https://pmc.ncbi.nlm.nih.gov/articles/PMC3467905/ ; https://www.overjet.com/blog/how-to-achieve-consistent-treatment-planning-in-your-dental-practice)
- **Ordering follows a priority hierarchy**: biological priority (infection/active disease) → functional priority (occlusion/chewing) → esthetic priority (cosmetic) → financial phasing (budget-aware staging that still respects biological logic). (https://www.overjet.com/blog/how-to-achieve-consistent-treatment-planning-in-your-dental-practice)
- A widely used reference is **Stefanac's "Guidelines for Sequencing Dental Treatment"** which formalizes Phase 1 (acute/urgent) → disease control → definitive → maintenance into a structured box. (http://www-personal.umich.edu/~stefanac/Sequencing_Guide.pdf)

### CDT coding, fees, and insurance estimation

- Each procedure maps to an **ADA CDT (Current Dental Terminology) code**; CDT is versioned annually (e.g., CDT 2024/2025 with new codes, revisions, and a new sleep-apnea category) and codes determine claim submission and benefit level. (https://www1.deltadentalins.com/content/dam/ddins/en/pdf/dentists/cdt-dcusa-summary.pdf ; https://deltadentalnc.com/dentists/2025cdtcodes/)
- **Least Expensive Alternative Treatment (LEAT)** clause: when multiple viable options exist, the plan pays only the least expensive option, regardless of which is performed — the patient covers the difference. (https://www.ada.org/resources/practice/dental-insurance/least-expensive-alternative-treatment-clause)
- **Alternate-benefit / downgrade**: insurers may reimburse a posterior composite at the **amalgam** rate; estimation must compute patient portion off the downgraded benefit, not the billed fee (e.g., $64 benefit on a $100 composite → $36 patient even at "80% coverage"). (https://www.withwisdom.com/resources/dental-insurance-downgrades-they-dont-have-to-be-a-mystery ; https://www.dentistrysupport.com/post/understanding-dental-downgrades)
- **Procedure-code bundling** by payers (combining procedures into one reduced benefit) is a real estimation hazard the ADA explicitly flags. (https://www.ada.org/resources/practice/dental-insurance/bundling-of-procedure-codes)
- Patient-facing **cost estimators** are now table stakes: they estimate fee, plan coverage, and out-of-pocket — explicitly *estimates*, not guarantees. (https://www.deltadental.com/member/cost-estimator/)
- Open Dental's plan grid shows **PPO fee, allowed amount, primary + secondary insurance estimates, patient portion, and discount-plan amounts**, plus an "Estimates as of [date]" projection that accounts for benefit-frequency/renewal timing. (https://www.opendental.com/manual/treatmentplan.html)

### Case presentation & acceptance UX

- **Visual/photo-driven presentation drives acceptance**: before/after images, annotated radiographs, and diagrams that highlight areas of concern materially improve patient understanding and case acceptance. (https://smileadvantage.com/resources/10-features-to-look-for-in-dental-treatment-plan-software/ ; https://clinicalmastery.com/mastering-dental-treatment-planning-case-acceptance-proven-strategies-for-success/)
- The three primary barriers to large-case acceptance are **communication clarity, financial clarity, and trust** — addressed by AI-consistent diagnosis + annotated imaging + clear financial breakdown. (https://www.overjet.com/blog/how-to-boost-large-treatment-plan-acceptance-in-your-dental-practice)
- **Flexible payment plans** and online payment options lift acceptance, especially for multi-stage/complex plans. (https://www.dentalintel.com/blog-posts/effective-strategies-to-boost-treatment-case-acceptance ; https://carestack.com/dental-software/features/payment-plans)
- Vendor benchmark: Curve markets **up to 30% more "yeses"** from clear personalized plans + flexible payment. (https://www.curvedental.com/blog/how-curve-boosts-case-acceptances)
- **E-signature acceptance** is standard: CareStack patients view presented plans (with or without fees) in the patient portal and **sign or reject** them online; treatment planning with e-signatures is a marketed feature. (https://carestack.zendesk.com/hc/en-us/articles/34479997316628-All-About-Patient-Portal ; https://carestack.com/dental-software/features/payment-plans)
- Open Dental supports **signing a saved treatment plan** ("Sign TP") and delivering it via eClipboard, email, or print with customizable layouts. (https://www.opendental.com/manual/treatmentplan.html)

### Status lifecycle & plan versioning

- **Status lifecycle is first-class.** Dentrix tracks case status (presented → accepted → rejected → completed) with a **Case Status History** audit trail. (https://blog.dentrix.com/blog/2018/10/16/viewing-case-status-history-in-the-treatment-planner/ ; https://learn.dentrixascend.com/courses/clinical-essentials-for-teams/lessons/treatment-planning/topic/updating-a-case-status-2/)
- **Procedure-level status** in Open Dental: Treatment Planned (TP), Treatment Planned Inactive (TPi), and Complete; one **Active** plan per patient (procedures attached to scheduled appts, removed as completed), multiple **Inactive** plans, and **Saved** permanent snapshots. (https://www.opendental.com/manual/treatmentplan.html)
- **Versioning via multiple/saved plans**: Open Dental's "Saved" plans are permanent records that can be signed; multiple inactive plans let you keep historical/alternative versions. (https://www.opendental.com/manual/treatmentplan.html)

### Alternative / optional treatment options

- **Alternate cases** are the standard pattern for presenting multiple options (e.g., "Implant Option" vs "Bridge Option"). Dentrix lets you mark one as the **Recommended Case**; only the recommended case posts to the chart, and **accepting one auto-rejects its linked alternates**. (https://magazine.dentrix.com/simplify-treatment-planning-with-alternate-cases/ ; https://blog.dentrixenterprise.com/presenting-multiple-treatment-options/)
- Alternates are **visually linked** (matching color icons) and shared procedures (e.g., extractions needed regardless of option) can be duplicated/moved across linked cases; each can be printed separately. (https://hsps.pro/DentrixCanada/Help/mergedProjects/Treatment%20Planner/desktop/Treatment_Plan_Case_Setup/Linking_alternate_cases.htm)

### Scheduling & charting linkage

- **Priorities sequence the plan**; Open Dental assigns customizable priority labels (numbers/letters/words), groups same-priority procedures, and **drives the order treatment is scheduled**. (https://www.opendental.com/site/0_treatmentplan.html ; https://opendental.blog/treatment-plan-module-faqs-answered/)
- **Planned procedures link to appointments/visits**: Open Dental's Appt column flags each procedure as attached to a Scheduled (X), Planned (P), or Unscheduled (U) appointment — the bridge from plan to calendar. (https://www.opendental.com/manual/treatmentplan.html)
- **Plan ↔ chart are bidirectional**: TP procedures originate in the Chart module and flow into the plan; completing them removes them from the active plan. (https://www.opendental.com/manual/treatmentplan.html)

### AI-assisted treatment planning (emerging standard)

- **Overjet/Pearl** analyze radiographs to detect caries and measure bone levels in real time, producing **annotated imaging** that feeds consistent, evidence-backed plans across providers. (https://www.overjet.com/blog/dental-treatment-planning-ai-guide ; https://hellopearl.com/blog/why-you-should-customize-dental-treatment-plans-using-ai-technology)
- AI surfaces data-driven suggestions to help build comprehensive plans, but academic review **cautions against over-reliance on technical metrics alone** — clinical judgment remains the arbiter. (https://www.coastalkidsdo.com/post/pearl-overjet-ai-software-to-analyze-x-rays ; https://pmc.ncbi.nlm.nih.gov/articles/PMC11937414/)

---

## Completeness gaps to check in our product

Use this checklist to audit DentaLemon's treatment-planning implementation against the benchmark above.

- [ ] **Phasing / sequencing** — Does the plan support explicit phases (systemic/urgent → disease control → re-evaluation → definitive → maintenance)? Is there a priority field that orders procedures and drives scheduling order? (Open Dental "Set Priority"; Overjet 5-phase model)
- [ ] **Re-evaluation gate** — Is there an explicit re-evaluation/holding step between control and definitive phases (not just a flat procedure list)?
- [ ] **CDT codes** — Is every planned procedure mapped to an ADA CDT code, with support for annual CDT version updates?
- [ ] **Fee + insurance estimation** — Does the plan compute fee, primary + secondary insurance estimate, and **patient out-of-pocket**? Does it model **LEAT/alternate-benefit downgrades** (e.g., composite→amalgam) and **payer bundling** rather than naive %-of-fee?
- [ ] **"Estimates as of" / benefit timing** — Are estimates aware of annual maximums, deductibles, frequency limits, and benefit-year renewal?
- [ ] **Alternative / optional options** — Can clinicians present **alternate cases** (implant vs bridge), mark one **recommended**, link alternates, and **auto-reject siblings on acceptance**?
- [ ] **Case-presentation view** — Is there a patient-facing presentation surface with **annotated radiographs / before-after photos / diagrams** and a clear financial breakdown?
- [ ] **E-signature acceptance** — Can patients **review and e-sign (or reject)** a presented plan, with or without fees, in a portal?
- [ ] **Versioning** — Can multiple plan versions / saved snapshots coexist (active vs inactive vs saved permanent record)?
- [ ] **Status lifecycle** — Is there a tracked lifecycle (**proposed → presented → accepted/rejected → scheduled → completed**) at both case and procedure level, with **status-history audit trail**?
- [ ] **Scheduling linkage** — Do planned procedures link to appointments/visits with a visible scheduled/planned/unscheduled state, and feed the calendar?
- [ ] **Charting linkage** — Is the plan bidirectionally tied to the odontogram/chart (TP procedures flow in; completion updates both)?
- [ ] **Multi-visit grouping** — Can procedures be grouped into visits/appointments so a multi-appointment plan maps onto distinct scheduled sessions?
- [ ] **AI assist (optional/differentiator)** — Are detected pathologies (caries/bone loss from imaging) surfaced as suggested plan items with annotated evidence?
