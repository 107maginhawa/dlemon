# Dental Imaging & Cephalometric Analysis — Industry/Clinical Standards Research

Research date: 2026-06-02. Scope: cephalometric analysis standards, landmark-placement UX in
leading ceph software, intraoral/radiograph imaging workflows, DICOM + image comparison/superimposition
over time. Evidence is web-sourced with inline URLs per claim.

## Industry-standard benchmark

### Cephalometric analyses (named systems, landmarks, norms)

- **Multiple named analyses are the clinical baseline — a product should support more than one.** The canonical set is Steiner, Downs, Ricketts, McNamara, Tweed, Jarabak, and the Wits appraisal; each derives angles/distances/ratios from 2-D coordinates of anatomical landmarks. (https://en.wikipedia.org/wiki/Cephalometric_analysis)
- **Standard hard-tissue landmarks** used across analyses: Sella (S), Nasion (N), A-point (subspinale), B-point (supramentale), Gonion (Go), Menton (Me), Pogonion (Pog), Orbitale (Or), Porion (Po), Articulare (Ar), ANS/PNS, Gnathion (Gn). (https://en.wikipedia.org/wiki/Cephalometric_analysis ; https://www.researchgate.net/figure/Cephalometric-tracing-done-using-Dolphin-Imaging-technology_fig2_361379426)
- **Steiner (1953)** — registered on the Sella–Nasion (SN) plane. Norms: SNA 82°±2°, SNB 80°±2°, ANB 2°±2° (ANB = SNA−SNB; 0–4° Class I, >4° Class II, <0° Class III); U1–NA 22°±2° and 4 mm±2 mm; L1–NB 25°±2° and 4 mm±2 mm; interincisal angle 131°±6°; Pg–NB 1–4 mm. (https://www.bceph.com/steiner-analysis ; https://pmc.ncbi.nlm.nih.gov/articles/PMC7491964/)
- **Downs** — Facial angle 87.8°±3.6°, mandibular plane angle 21.9°±5°, interincisal angle 135.4°±5.8°. (https://en.wikipedia.org/wiki/Cephalometric_analysis)
- **Ricketts** — Facial axis 90°±3.5°, mandibular plane to FH ~24°±4.5°, convexity (A-point to facial plane) 0 mm±2 mm. (https://en.wikipedia.org/wiki/Cephalometric_analysis)
- **Tweed triangle** — FMA 25°, IMPA 90°±5°, FMIA 65°. (https://en.wikipedia.org/wiki/Cephalometric_analysis)
- **McNamara** — A-point to Nasion-perpendicular ~0 to +1 mm; Pog to Nasion-perpendicular males −4–0 mm / females −4 to −2 mm; effective maxillary length Co-A males 95–100 / females 91–96 mm; effective mandibular length Co-Gn males 125–135 / females 118–128 mm; lower anterior facial height ANS-Me males 65–75 / females 60–70 mm; well-balanced Class I mandible exceeds maxilla by ~25–30 mm. McNamara measurements are designed to map directly to the magnitude of correction needed. (https://www.bceph.com/mcnamara-analysis ; https://media.dent.umich.edu/labs/mcnamara/files/A%20method%20of%20cephalometric%20evaluation.pdf)
- **Jarabak** — uses Nasion, Sella, Menton, Gonion, Articulare; posterior/anterior facial-height ratio ~62–65% (commonly cited ~56%/44% growth-direction split). (https://en.wikipedia.org/wiki/Cephalometric_analysis)
- **Wits appraisal (1975)** — projects A-point and B-point onto the occlusal plane (AO, BO); norm ≈ −1 mm (males), 0 mm (females); used as a denominator-independent supplement to ANB. (https://en.wikipedia.org/wiki/Cephalometric_analysis)
- **Ethnicity affects norms** — published studies derive population-specific mean values for Steiner/Tweed/Ricketts/McNamara, confirming norms should be presentable per reference population rather than a single hardcoded set. (https://apospublications.com/mean-values-of-steiner-tweed-ricketts-and-mcnamara-analysis-in-maratha-ethnic-population-a-cephalometric-study/)

### Landmark-placement UX in leading ceph software

- **Dolphin Imaging Ceph Tracing** advertises: simple x-ray calibration, per-landmark illustrations + descriptions of each location, voice prompts during digitizing, and auto-generated anatomical structures — i.e., guided, location-by-location landmark entry. (https://www.dolphinimaging.com/Product/Imaging?Subcategory_OS_Safe_Name=Ceph_Tracing)
- **AI / fully automated landmarking is now table-stakes** in modern competitors: WebCeph (AssembleCircle, Korea), Ceph Assistant (Hungary), AudaxCeph (Slovenia) all do fully automatic landmark detection from an imported digital radiograph; AudaxCeph showed excellent skeletal agreement (ICC>0.90) but weak soft-tissue detection, while WebCeph/Ceph Assistant had higher variance on linear measures (ICC<0.50). Angular measures are more reliable than linear across all tools, and expert oversight/manual correction is still required. (https://pmc.ncbi.nlm.nih.gov/articles/PMC12544317/ ; https://www.jcpsp.pk/article-detail/paccuracy-and-reliability-of-the-artificial-intelligenceassisted-webceph-application-for-lateral-cephalometric-analysis-in-comparison-with-the-conventional-methodorp)
- **AudaxCeph** positions itself around turning X-rays into measurements plus growth projections, treatment prediction, and simulation/VTO — confirming prediction/simulation as expected adjacent features. (https://www.audaxceph.com/)
- **Calibration is mandatory for valid linear measurements.** Standard method: identify two endpoints of a known distance (a metal mm calibration ruler imaged with the patient) and scale pixel distance to true mm to correct radiographic magnification; absent a ruler, a known magnification percentage must be applied. (https://journals.lww.com/njcp/fulltext/2019/22120/distortion_and_magnification_of_four_digital.3.aspx ; https://journals.sagepub.com/doi/10.1177/03015742211044864 ; https://blog.peekmed.com/x-ray-calibration)

### Intraoral / radiograph imaging workflows

- **FMX (full-mouth series)** is a defined mounted set combining periapicals + bitewings to show all crowns and roots; it is the standard comprehensive intraoral exam and is laid out in an anatomical mount/template. (https://hellopearl.com/glossary/full-mouth-series-fmx-radiograph ; https://texasstardental.com/wp-content/uploads/2023/10/Texas-Star-Dental-Diagnostic-X-ray-Protocol.pdf)
- **Modalities each serve distinct purposes**: bitewing (interproximal caries, bone levels), periapical (root/apex/periapical pathology), panoramic (single image of maxilla/mandible/teeth/TMJ/sinuses), CBCT (3-D). A product should handle each modality's geometry and use case distinctly. (https://lovethatsmile.com/dental-articles/types-of-x-rays ; https://pmc.ncbi.nlm.nih.gov/articles/PMC4330237/)
- **Findings are linked to specific teeth/locations** — the diagnostic value of FMX/bitewings is detecting caries between teeth, periapical infection, and bone level per site, implying findings annotation tied to tooth numbering. (https://hellopearl.com/glossary/full-mouth-series-fmx-radiograph)

### DICOM & comparison/superimposition over time

- **DICOM is the technical image/file standard; PACS is the storage/retrieval/distribution system.** Dental enterprise imaging expects DICOM with PACS, though dental PACS may store internally in vendor formats. Panoramic files can reach ~50 MB, affecting storage/transmission design. (https://radsource.us/difference-between-dicom-pacs/ ; https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/resources/practice/dental-standards/aip-review/proposed_1114_aip.pdf ; https://dcmsys.com/project/dental-radiology-and-enterprise-imaging/)
- **Superimposition = comparing tracings of the same patient at different times to measure skeletal/dental change** (growth + treatment effect/tooth movement amount & direction). This is the clinical analog of a snapshot/timeline feature. (https://ijodr.com/archive/volume/8/issue/1/article/4895 ; https://www2.americanboardortho.com/orthodontists/become-certified/clinical-exam/mail-in-cre-submission-procedure/case-record-preparation/superimpositions/)
- **The ABO standard requires three structural superimpositions**, each registered on stable structures (Björk/Melsen/Enlow research): (1) cranial base, (2) maxillary, (3) mandibular — registered on true anatomical outlines, not single points. A comparison/overlay feature should support multiple registration references, not a single global align. (https://www2.americanboardortho.com/orthodontists/become-certified/clinical-exam/mail-in-cre-submission-procedure/case-record-preparation/superimpositions/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC8088383/)

## Completeness gaps to check in our product

- [ ] **Analysis types beyond Ricketts** — verify support (or roadmap) for Steiner, Downs, McNamara, Tweed, Jarabak, and Wits appraisal, not Ricketts alone. The clinical baseline is multi-analysis.
- [ ] **Normative-value display** — each measurement should show the norm + SD (e.g., SNA 82°±2°) and flag out-of-range; consider population/ethnicity-specific norm sets rather than one hardcoded table.
- [ ] **Calibration UX** — must support known-distance (two-point ruler) mm-per-pixel calibration and/or a magnification % entry; without it, linear measurements (mm) are invalid. Confirm linear measures are blocked or warned until calibrated.
- [ ] **AI / auto-landmarking** — competitors (WebCeph, AudaxCeph, Ceph Assistant) do fully automatic detection with manual correction. Check whether we have auto-landmarking, and if not, whether guided manual placement (per-landmark description/illustration, like Dolphin's voice prompts) is present. Note: linear/soft-tissue AI accuracy is weaker — surface confidence/let users correct.
- [ ] **Superimposition / comparison over time** — verify multi-timepoint overlay with multiple registration references (cranial base + maxillary + mandibular structural), aligned to our snapshot/timeline model; a single global image align is below the ABO standard.
- [ ] **FMX mounts/templates** — confirm an anatomical full-mouth mount layout (periapicals + bitewings in standard positions), not just a flat image gallery.
- [ ] **Modality handling** — distinct handling/metadata for bitewing vs PA vs panoramic vs CBCT (different geometry, file sizes up to ~50 MB for pano, 3-D for CBCT).
- [ ] **Findings-to-tooth linkage** — confirm radiograph findings (caries, periapical lesion, bone loss) can be annotated and linked to specific tooth numbers/surfaces.
- [ ] **DICOM interoperability** — check whether images are DICOM-conformant (import/export) and whether storage/transmission accounts for large panoramic/CBCT payloads.
- [ ] **Treatment simulation / VTO & growth projection** — AudaxCeph and Dolphin offer prediction/simulation; check whether this is in scope or explicitly deferred.
