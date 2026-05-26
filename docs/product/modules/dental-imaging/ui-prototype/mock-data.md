# Mock Data — dental-imaging
<!-- oli: v3-dentalemon | dental-imaging | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Studies (patient `p-001`):
- `{ id: "s-101", study_type: "OPG", study_date: "2026-03-15", dentist: "Dr. Chen", image_count: 1, findings_count: 2, has_ceph_analysis: false, notes: "Routine panoramic — recall." }`
- `{ id: "s-102", study_type: "Ceph", study_date: "2026-03-15", dentist: "Dr. Chen", image_count: 1, findings_count: 0, has_ceph_analysis: true }`
- `{ id: "s-103", study_type: "PA", study_date: "2026-04-02", dentist: "Dr. Patel", image_count: 2, tooth_region: "11, 21", findings_count: 1, has_ceph_analysis: false }`

Findings for `s-101`:
- `{ id: "f-1", finding_type: "bone_loss", severity: "high", tooth_region: "46", description: "Vertical bony defect distal to 46, approximately 4 mm." }`
- `{ id: "f-2", finding_type: "periapical", severity: "moderate", tooth_region: "11", description: "Periapical radiolucency consistent with chronic apical periodontitis." }`

Annotations for `s-101`:
- `{ id: "a-1", type: "polygon", label: "Bone loss zone", color: "#FF453A", coordinates: [...] }`
- `{ id: "a-2", type: "point", label: "PA lesion", color: "#FFE97D", coordinates: { x: 412, y: 198 } }`

Ceph analysis for `s-102`:
- Placed 8/14 landmarks (S, N, A, B, Pog, Go, Me, Or). Pending: Po, ANS, PNS, U1-tip, L1-tip, Wits-reference.
- Measurements (partial):
  - `{ name: "SNA", value: 81, unit: "°", normal_low: 80, normal_high: 84 }` → within range
  - `{ name: "SNB", value: 79, unit: "°", normal_low: 78, normal_high: 82 }` → within range
  - `{ name: "ANB", value: 2, unit: "°", normal_low: 1, normal_high: 5 }` → within range

Tier flag: `org.imagingTier === true` for the demo org; toggle to `false` to demo the gated state.
