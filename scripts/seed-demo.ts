/**
 * seed-demo.ts — Comprehensive demo seed for Dentalemon
 *
 * All modules, all workflows, all user journeys have data.
 * Run via: bun run db:reseed
 *
 * Demo login: demo@dentalemon.com / DemoClinic1!  →  PIN 1 2 3 4 5 6
 */

import { S3Client } from 'bun'

const API = 'http://localhost:7213'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`  ${msg}`) }
function section(title: string) { console.log(`\n▶ ${title}`) }

async function req(
  method: string, path: string, body: unknown | null, cookie: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== null ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

const post  = (p: string, b: unknown, c: string) => req('POST',  p, b, c)
const get   = (p: string, c: string)              => req('GET',   p, null, c)
const patch = (p: string, b: unknown, c: string) => req('PATCH', p, b, c)

function must<T>(r: { ok: boolean; status: number; data: T }, label: string): T {
  if (!r.ok) throw new Error(`${label} → ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`)
  return r.data
}

// ─── Demo imaging upload ──────────────────────────────────────────────────────
// POST /dental/imaging/studies persists an imaging_study_image whose `fileId` IS the
// S3 object key (no stored_file row, no /complete step — that's the generic storage
// flow, not imaging). The image is served via a presigned GET on the key, so all the
// viewer needs is the bytes present. We PutObject directly (no SSE) because the API's
// presigned PUT signs ServerSideEncryption:AES256, which this dev MinIO (no KMS) 501s.
const DEMO_CEPH_IMAGE = `${import.meta.dir}/seed-assets/imaging/ceph-lateral-demo.jpg`
let demoImageBytes: ArrayBuffer | null = null

const seedS3 = new S3Client({
  accessKeyId: process.env['STORAGE_ACCESS_KEY_ID'] ?? 'minioadmin',
  secretAccessKey: process.env['STORAGE_SECRET_ACCESS_KEY'] ?? 'minioadmin',
  bucket: process.env['STORAGE_BUCKET'] ?? 'monobase-files',
  endpoint: process.env['STORAGE_ENDPOINT'] ?? 'http://localhost:9000',
  region: process.env['STORAGE_REGION'] ?? 'us-east-1',
  virtualHostedStyle: false, // path-style: required for MinIO
})

async function uploadDemoImage(fileId: string, mimeType: string): Promise<void> {
  if (!demoImageBytes) demoImageBytes = await Bun.file(DEMO_CEPH_IMAGE).arrayBuffer()
  await seedS3.write(fileId, demoImageBytes, { type: mimeType })
}

// Seeds a complete cephalometric chain (study + uploaded image + 14 landmarks with
// A/B/Go/Po confirmed + S locked + analysis + report). Visit-independent so it never
// gets blocked by the visit-completion cascade. Landmarks are placed on the REAL
// lateral cephalogram seed asset (ceph-lateral-demo.jpg, 1000×800) at anatomically
// estimated positions → SNA≈79.5/SNB≈75.9/ANB≈3.6 (a mild Class II reading;
// CEPH_EXPECTED in _journey-helpers → B02/B04). U1A/L1A apices are left unplaced
// (not visible without expert annotation) so the panel shows them as "missing".
// Throws on failure.
async function seedCephChain(patientId: string, branchId: string, visitId: string | null, cookie: string): Promise<string> {
  const studyR = await post('/dental/imaging/studies', {
    patientId, ...(visitId ? { visitId } : {}), branchId,
    modality: 'cephalometric', filename: 'torres-miguel-ceph-lateral.jpg',
    mimeType: 'image/jpeg', size: 2048000,
  }, cookie)
  if (!studyR.ok) throw new Error(`ceph study POST → ${studyR.status}: ${JSON.stringify(studyR.data).slice(0, 160)}`)
  const imageId: string | undefined = studyR.data.image?.id ?? studyR.data.imageId
  if (!imageId) throw new Error(`ceph study missing imageId: ${JSON.stringify(studyR.data).slice(0, 160)}`)
  await uploadDemoImage(studyR.data.fileId, 'image/jpeg')
  log(`  ✓ Ceph imaging study + image uploaded (imageId: ${imageId.slice(0, 8)}…)`)

  // Image-space pixel coords on the 1000×800 real cephalogram (face pointing right).
  const landmarks = [
    { landmarkCode: 'S', x: 560, y: 380 }, { landmarkCode: 'N', x: 815, y: 295 },
    { landmarkCode: 'A', x: 845, y: 510 }, { landmarkCode: 'B', x: 840, y: 622 },
    { landmarkCode: 'Pog', x: 865, y: 668 }, { landmarkCode: 'Me', x: 835, y: 702 },
    { landmarkCode: 'Gn', x: 850, y: 690 }, { landmarkCode: 'Go', x: 560, y: 635 },
    { landmarkCode: 'ANS', x: 855, y: 475 }, { landmarkCode: 'PNS', x: 700, y: 478 },
    { landmarkCode: 'Po', x: 515, y: 400 }, { landmarkCode: 'Or', x: 805, y: 365 },
    { landmarkCode: 'U1T', x: 865, y: 575 }, { landmarkCode: 'L1T', x: 858, y: 582 },
  ].map(lm => ({ ...lm, status: 'placed' }))
  const lmBatchR = await post(`/dental/imaging/images/${imageId}/ceph/landmarks`, { landmarks }, cookie)
  if (!lmBatchR.ok) throw new Error(`ceph landmarks → ${lmBatchR.status}: ${JSON.stringify(lmBatchR.data).slice(0, 160)}`)
  for (const code of ['A', 'B', 'Go', 'Po']) {
    const r = await patch(`/dental/imaging/images/${imageId}/ceph/landmarks/${code}`, { status: 'confirmed' }, cookie)
    if (!r.ok) throw new Error(`ceph confirm ${code} → ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`)
  }
  // B03 precondition: confirm then lock S (placed→confirmed→locked)
  const cS = await patch(`/dental/imaging/images/${imageId}/ceph/landmarks/S`, { status: 'confirmed' }, cookie)
  if (!cS.ok) throw new Error(`ceph confirm S → ${cS.status}`)
  const lS = await patch(`/dental/imaging/images/${imageId}/ceph/landmarks/S`, { status: 'locked' }, cookie)
  if (!lS.ok) throw new Error(`ceph lock S → ${lS.status}`)
  // Calibrate (within the 0.05–0.50 mm/px guard) so recompute succeeds and mm-metrics
  // (overjet/overbite) populate. Analysis already exists from the landmark write, so
  // calibration + recompute are best-effort; the report is the required artifact.
  const calR = await patch(`/dental/imaging/images/${imageId}/calibration`, { pixelSpacingMm: 0.25 }, cookie)
  if (!calR.ok) log(`  ⚠ ceph calibration → ${calR.status} (continuing)`)
  const rc = await post(`/dental/imaging/images/${imageId}/ceph/analysis/recompute`, {}, cookie)
  if (!rc.ok) log(`  ⚠ ceph recompute → ${rc.status} (analysis already computed on write; continuing)`)
  const rep = await post(`/dental/imaging/images/${imageId}/ceph/reports`, {}, cookie)
  if (!rep.ok) throw new Error(`ceph report → ${rep.status}: ${JSON.stringify(rep.data).slice(0, 120)}`)
  log(`  ✓ Ceph: 14 landmarks, A/B/Go/Po confirmed, S locked, calibrated, analysis + report v1`)
  return imageId
}

function getCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? ''
  return raw.split(',').map((c: string) => c.split(';')[0]).filter(Boolean).join('; ')
}

async function signUpOrIn(email: string, password: string, name: string) {
  const res = await fetch(`${API}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  if (res.ok || res.status === 200) {
    const body = await res.json() as any
    return { cookie: getCookie(res), userId: body.user?.id ?? body.id, created: true }
  }
  const res2 = await fetch(`${API}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res2.ok) throw new Error(`Sign-in failed ${res2.status}: ${await res2.text().catch(() => '')}`)
  const body2 = await res2.json() as any
  return { cookie: getCookie(res2), userId: body2.user?.id ?? body2.id, created: false }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const daysAgo = (n: number, h = 9) => {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString()
}
const daysFromNow = (n: number, h = 10) => {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString()
}
const atToday = (h: number, m = 0) => {
  const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString()
}

let _receiptSeq = 0
const receipt = () => `OR-2026-${String(++_receiptSeq).padStart(4, '0')}`

// ─── Visit content templates ─────────────────────────────────────────────────

const TEMPLATES = {
  checkup(focusTooth = 46) {
    return {
      complaint: 'Comprehensive oral exam — new patient',
      teeth: [
        { toothNumber: 18, state: 'watchlist', surfaces: ['occlusal'], note: 'Partially erupted, monitor' },
        { toothNumber: 36, state: 'filled',    surfaces: ['mesial', 'occlusal'] },
        { toothNumber: focusTooth, state: 'watchlist', surfaces: ['buccal'], note: 'Early caries suspected' },
      ],
      treatments: [
        { cdtCode: 'D0150', description: 'Comprehensive oral evaluation — new patient', priceCents: 150000 },
        { cdtCode: 'D0210', description: 'Full-mouth X-ray series', priceCents: 250000 },
      ],
      soap: {
        subjective: 'Patient presents for initial exam. No acute pain. Reports occasional cold sensitivity.',
        objective: 'Extra-oral exam WNL. Moderate plaque and calculus. Gingival inflammation grade I. Pocket depths 2-3mm.',
        assessment: 'Mild gingivitis. Early caries suspected on posterior teeth. Occlusion Class I.',
        plan: 'Full-mouth X-rays taken. Prophylaxis and fluoride recommended. 6-month recall scheduled.',
      },
    }
  },
  cleaning(watch1 = 16, filled1 = 36) {
    return {
      complaint: 'Routine cleaning and oral hygiene maintenance',
      teeth: [
        { toothNumber: watch1,  state: 'watchlist', surfaces: ['occlusal'], note: 'Monitor caries' },
        { toothNumber: filled1, state: 'filled',    surfaces: ['mesial', 'distal'] },
      ],
      treatments: [
        { cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 100000 },
        { cdtCode: 'D1110', description: 'Adult prophylaxis (cleaning)', priceCents: 250000 },
      ],
      soap: {
        subjective: 'Routine cleaning. No pain. Denies sensitivity.',
        objective: 'Good oral hygiene. Mild supragingival calculus on lower anteriors. Gingiva pink. BOP minimal.',
        assessment: 'Healthy dentition. Mild calculus. Existing restorations intact.',
        plan: 'Scaling and polishing. Fluoride varnish. Reinforce interdental cleaning. 6-month recall.',
      },
    }
  },
  filling(tooth: number, surface: string, condCode = 'K02.1') {
    return {
      complaint: `Caries on tooth #${tooth} — requires restoration`,
      teeth: [{ toothNumber: tooth, state: 'caries', surfaces: [surface], conditionCode: condCode, note: 'Active caries, restorable' }],
      treatments: [
        { cdtCode: 'D0220', description: `Periapical X-ray (#${tooth})`, priceCents: 80000, toothNumber: tooth },
        { cdtCode: 'D2391', description: `Resin composite 1 surface (#${tooth})`, priceCents: 400000, toothNumber: tooth, surfaces: [surface], conditionCode: condCode },
      ],
      soap: {
        subjective: `Pain on tooth #${tooth}. Cold sensitivity 2 weeks.`,
        objective: `Caries #${tooth} ${surface}. PA X-ray confirms. Pulp test: vital.`,
        assessment: `Active caries #${tooth} — restorable. No periapical pathology.`,
        plan: `Resin composite placed #${tooth}. Occlusion adjusted. Follow up if persists.`,
      },
    }
  },
  extraction(tooth: number) {
    return {
      complaint: `Tooth #${tooth} — non-restorable, severe pain`,
      teeth: [{ toothNumber: tooth, state: 'extracted', note: 'Extracted this visit' }],
      treatments: [
        { cdtCode: 'D0220', description: `Periapical X-ray (#${tooth})`, priceCents: 80000, toothNumber: tooth },
        { cdtCode: 'D7210', description: `Surgical extraction (#${tooth})`, priceCents: 800000, toothNumber: tooth },
      ],
      soap: {
        subjective: `Severe pain and swelling around tooth #${tooth}. Unable to chew.`,
        objective: `Tooth #${tooth}: gross caries, non-restorable. Periapical radiolucency. Grade III mobility.`,
        assessment: `Non-restorable #${tooth}. Extraction indicated.`,
        plan: `Surgical extraction under LA. Sutures placed. Post-op instructions. Review 7 days.`,
      },
    }
  },
  rct(tooth: number, cdtCode = 'D3330') {
    return {
      complaint: `Severe toothache on tooth #${tooth} — root canal indicated`,
      teeth: [{ toothNumber: tooth, state: 'crown', surfaces: ['mesial', 'distal'], note: 'RCT completed, crown pending' }],
      treatments: [
        { cdtCode: 'D0220', description: `Periapical X-ray (#${tooth})`, priceCents: 80000, toothNumber: tooth },
        { cdtCode, description: `Root canal treatment (#${tooth})`, priceCents: 1200000, toothNumber: tooth },
      ],
      soap: {
        subjective: `Severe spontaneous pain on #${tooth} for 3 days. Worsens with heat.`,
        objective: `Tooth #${tooth}: deep caries. Positive to percussion. Periapical radiolucency.`,
        assessment: `Necrotic pulp / symptomatic apical periodontitis #${tooth}.`,
        plan: `RCT performed — canals instrumented, NaOCl/EDTA, obturated with gutta-percha. Crown recommended.`,
      },
    }
  },
  crown(tooth: number) {
    return {
      complaint: `Crown placement on tooth #${tooth} following root canal`,
      teeth: [{ toothNumber: tooth, state: 'crown', note: 'Permanent porcelain crown cemented this visit' }],
      treatments: [
        { cdtCode: 'D2740', description: `Crown — porcelain/ceramic (#${tooth})`, priceCents: 1800000, toothNumber: tooth },
      ],
      soap: {
        subjective: 'Returns for permanent crown. No pain since RCT. Comfortable bite.',
        objective: `Tooth #${tooth}: temporary crown intact. Tissue healthy. Occlusion WNL.`,
        assessment: `Tooth #${tooth} ready for permanent crown.`,
        plan: `Porcelain crown cemented. Occlusion checked and adjusted. Annual recall.`,
      },
    }
  },
  perio(quads = 'upper right and upper left') {
    return {
      complaint: 'Bleeding gums, bad breath and gum swelling — periodontal evaluation',
      teeth: [
        { toothNumber: 16, state: 'watchlist', surfaces: ['buccal'],  note: '5mm pocket' },
        { toothNumber: 26, state: 'watchlist', surfaces: ['lingual'], note: '4mm pocket' },
        { toothNumber: 36, state: 'caries',    surfaces: ['mesial'] },
        { toothNumber: 46, state: 'watchlist', surfaces: ['distal'],  note: '4mm pocket' },
      ],
      treatments: [
        { cdtCode: 'D0120', description: 'Periodontal evaluation', priceCents: 100000 },
        { cdtCode: 'D4341', description: `Scaling and root planing — ${quads}`, priceCents: 500000 },
      ],
      soap: {
        subjective: 'Bleeding when brushing for months. Persistent bad breath. Gums swollen.',
        objective: 'Generalized erythema/edema. BOP 60%. Pocketing 4-5mm. Subgingival calculus.',
        assessment: 'Generalized moderate periodontitis (Stage II, Grade B).',
        plan: `SRP on ${quads} under LA. Waterpik recommended. Re-evaluation 6 weeks.`,
      },
    }
  },
  sensitivity(tooth = 24) {
    return {
      complaint: `Sharp sensitivity to cold on tooth #${tooth}`,
      teeth: [{ toothNumber: tooth, state: 'watchlist', surfaces: ['cervical'], conditionCode: 'K03.1', note: 'Cervical erosion' }],
      treatments: [
        { cdtCode: 'D0220', description: `Periapical X-ray (#${tooth})`, priceCents: 80000, toothNumber: tooth },
        { cdtCode: 'D9910', description: `Desensitizing treatment (#${tooth})`, priceCents: 180000, toothNumber: tooth, conditionCode: 'K03.1' },
      ],
      soap: {
        subjective: `Sharp pain on #${tooth} with cold/sweet. No spontaneous pain.`,
        objective: `Tooth #${tooth}: exposed cervical dentin. Cold positive, subsides immediately.`,
        assessment: `Dentin hypersensitivity #${tooth} secondary to cervical erosion.`,
        plan: `Desensitizing agent applied. Sensitive toothpaste. Avoid acidic drinks. Re-evaluate 4 weeks.`,
      },
    }
  },
  ortho(tooth = 11) {
    return {
      complaint: `Orthodontic consultation — crowding and spacing concern`,
      teeth: [
        { toothNumber: tooth, state: 'watchlist', surfaces: ['labial'], note: 'Crowding, rotation noted' },
        { toothNumber: 21, state: 'watchlist', surfaces: ['labial'], note: 'Diastema present' },
      ],
      treatments: [
        { cdtCode: 'D0340', description: 'Panoramic radiographic image', priceCents: 250000 },
        { cdtCode: 'D0350', description: 'Oral/facial photographic images', priceCents: 120000 },
        { cdtCode: 'D8080', description: 'Comprehensive orthodontic treatment — adolescent dentition', priceCents: 8500000 },
      ],
      soap: {
        subjective: 'Concern about tooth alignment and spacing. Parents seeking orthodontic evaluation.',
        objective: 'Class II div 1 malocclusion. Moderate crowding upper arch. 3mm diastema #11-21. Skeletal pattern: mild Class II.',
        assessment: 'Orthodontic treatment indicated. Cephalometric analysis reviewed. Growth phase favorable.',
        plan: 'Cephalometric and panoramic radiographs taken. Fixed braces initiated. Review monthly.',
      },
    }
  },
}

// ─── Low-level visit building blocks ─────────────────────────────────────────

async function activateVisit(
  patientId: string, branchId: string, memberId: string,
  daysBack: number, complaint: string, cookie: string,
): Promise<string | null> {
  const r = await post('/dental/visits', {
    patientId, branchId, dentistMemberId: memberId,
    chiefComplaint: complaint,
    visitDate: daysAgo(daysBack),
  }, cookie)
  if (!r.ok) { log(`  ⚠ Visit create (${r.status}): ${JSON.stringify(r.data).slice(0,100)}`); return null }
  await patch(`/dental/visits/${r.data.id}`, { status: 'active' }, cookie)
  return r.data.id
}

async function addChart(visitId: string, patientId: string, teeth: any[], cookie: string) {
  if (teeth.length) await post(`/dental/visits/${visitId}/chart`, { visitId, patientId, teeth }, cookie)
}

async function addTreatments(
  visitId: string, patientId: string, treatments: any[], cookie: string,
  // 'mixed': first treatment stays at diagnosed (visible in Breakdown default), rest → performed (billing)
  mode: 'performed' | 'planned' | 'diagnosed' | 'verified-first' | 'mixed' = 'mixed',
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < treatments.length; i++) {
    const r = await post(`/dental/visits/${visitId}/treatments`, { visitId, patientId, ...treatments[i] }, cookie)
    if (!r.ok) continue
    const id = r.data.id; ids.push(id)
    const m = (mode === 'mixed' && i === 0) ? 'diagnosed' : mode
    if (m === 'diagnosed') continue
    await patch(`/dental/visits/${visitId}/treatments/${id}`, { status: 'planned' }, cookie)
    if (m === 'planned') continue
    await patch(`/dental/visits/${visitId}/treatments/${id}`, { status: 'performed' }, cookie)
    if (m === 'verified-first' && i === 0) {
      await patch(`/dental/visits/${visitId}/treatments/${id}`, { status: 'verified' }, cookie)
    }
  }
  return ids
}

async function addNotes(visitId: string, soap: any, cookie: string): Promise<string | null> {
  if (!soap?.subjective) return null
  const r = await post(`/dental/visits/${visitId}/notes`, {
    visitId, subjective: soap.subjective, objective: soap.objective ?? '',
    assessment: soap.assessment ?? '', plan: soap.plan ?? '',
  }, cookie)
  return r.ok ? (r.data?.id ?? null) : null
}

// Set once the branch consent templates are created (section 5). completeVisit
// signs a consent per visit so the completion gate (and treatment→performed,
// which also requires consent) is satisfied.
let SEED_GENERAL_CONSENT_TPL_ID: string | null = null

/** Create + sign a general treatment consent for a visit (idempotent enough for seed). */
async function ensureSignedConsent(visitId: string, patientId: string, cookie: string) {
  if (!SEED_GENERAL_CONSENT_TPL_ID || SEED_GENERAL_CONSENT_TPL_ID === 'general') return
  const consentR = await post(`/dental/visits/${visitId}/consents`, {
    visitId, patientId,
    templateId: SEED_GENERAL_CONSENT_TPL_ID, templateName: 'General Treatment Consent',
  }, cookie)
  if (consentR.ok) {
    await post(
      `/dental/visits/${visitId}/consents/${consentR.data.id}/sign`,
      { signatureData: 'data:image/png;base64,iVBORw0KGgo=' },
      cookie,
    )
  }
}

async function completeVisit(visitId: string, patientId: string, cookie: string) {
  // The completion gate (updateDentalVisit §completed) rejects the transition
  // unless: (a) NO treatment is left at diagnosed/planned, (b) a signed consent
  // exists, (c) a notes row exists (createDentalVisit auto-seeds one). If it
  // rejects, the PATCH 422s and the visit stays ACTIVE — which makes every later
  // visit for this patient 409 (ACTIVE_VISIT_EXISTS) and collapses the patient's
  // whole timeline to a single card. Satisfy the gate here so historical visits
  // actually persist as `completed`.
  //
  // Consent must be signed BEFORE advancing treatments to `performed` — the
  // treatment FSM also enforces TREATMENT_CONSENT_REQUIRED on planned→performed.
  await ensureSignedConsent(visitId, patientId, cookie)

  const listR = await get(`/dental/visits/${visitId}/treatments`, cookie)
  const treatments: any[] = listR.ok ? (listR.data?.data ?? listR.data ?? []) : []
  for (const t of treatments) {
    // FSM is two-step: diagnosed→planned→performed (single jump 422s).
    if (t.status === 'diagnosed') {
      await patch(`/dental/visits/${visitId}/treatments/${t.id}`, { status: 'planned' }, cookie)
      await patch(`/dental/visits/${visitId}/treatments/${t.id}`, { status: 'performed' }, cookie)
    } else if (t.status === 'planned') {
      await patch(`/dental/visits/${visitId}/treatments/${t.id}`, { status: 'performed' }, cookie)
    }
  }

  const r = await patch(`/dental/visits/${visitId}`, { status: 'completed' }, cookie)
  if (!r.ok) log(`  ⚠ Complete visit (${r.status}): ${JSON.stringify(r.data).slice(0, 120)}`)
  await post(`/dental/visits/${visitId}/pmd`, { visitId, patientId }, cookie)
}

interface OpenTreatment { cdtCode: string; description: string; priceCents: number; toothNumber?: number; plan?: boolean }

/**
 * Add an ACTIVE "current" visit carrying an OPEN treatment plan — the realistic
 * in-progress visit a clinician is working in. Deliberately NOT completed: the
 * workspace carousel needs an editable active card with a chart to click and
 * pending treatments to plan/decline. Items with `plan:true` advance to
 * `planned` (accepted, awaiting delivery); the rest stay `diagnosed` (new
 * finding). A signed consent is attached so accepted items CAN be marked
 * performed from the UI (revenue-chain demo) without forcing them performed.
 *
 * Chart teeth are layered on the patient's cumulative snapshot, so the active
 * card shows prior conditions PLUS this visit's new findings — coherent with the
 * carousel's cumulative-snapshot model.
 */
async function addCurrentVisit(
  patientId: string, branchId: string, memberId: string,
  complaint: string, chartTeeth: any[], openTreatments: OpenTreatment[],
  cookie: string, opts: { soap?: any; signConsent?: boolean } = {},
): Promise<string | null> {
  const vid = await activateVisit(patientId, branchId, memberId, 0, complaint, cookie)
  if (!vid) return null
  await addChart(vid, patientId, chartTeeth, cookie)
  for (const t of openTreatments) {
    const { plan, ...body } = t
    const r = await post(`/dental/visits/${vid}/treatments`, { visitId: vid, patientId, ...body }, cookie)
    // New treatments POST at `diagnosed`. `plan:true` → advance to `planned`.
    if (r.ok && plan) await patch(`/dental/visits/${vid}/treatments/${r.data.id}`, { status: 'planned' }, cookie)
  }
  if (opts.soap) await addNotes(vid, opts.soap, cookie)
  if (opts.signConsent) await ensureSignedConsent(vid, patientId, cookie)
  return vid
}

async function makeInvoice(
  visitId: string, patientId: string, branchId: string, memberId: string, cookie: string,
  opts: { state: 'paid' | 'partial' | 'overdue' | 'draft'; withPlan?: boolean; totalCents: number },
) {
  const createBody: any = { visitId, patientId, branchId, dentistMemberId: memberId }
  if (opts.state === 'overdue') createBody.dueDate = daysAgo(30)
  const invR = await post('/dental/billing/invoices', createBody, cookie)
  if (!invR.ok) { log(`  ⚠ Invoice (${invR.status}): ${JSON.stringify(invR.data).slice(0,100)}`); return }
  const inv = invR.data
  if (opts.state === 'draft') { log(`  ₱ Draft invoice`); return }
  await post(`/dental/billing/invoices/${inv.id}/issue`, {}, cookie)
  if (opts.state === 'overdue') { log(`  ₱ Overdue invoice issued (unpaid)`); return }
  if (opts.withPlan) {
    const planR = await post(`/dental/billing/invoices/${inv.id}/plan`, {
      patientId, numberOfInstallments: 3, frequency: 'monthly',
      startDate: new Date().toISOString(),
    }, cookie)
    if (planR.ok) log(`  ₱ Payment plan 3×monthly`)
  }
  const payAmt = opts.state === 'paid' ? opts.totalCents : Math.round(opts.totalCents * 0.5)
  const payR = await post(`/dental/billing/invoices/${inv.id}/payments`, {
    amountCents: payAmt, method: opts.state === 'paid' ? 'card' : 'cash',
    receiptNumber: receipt(), recordedByMemberId: memberId,
  }, cookie)
  if (payR.ok) log(`  ₱ ${opts.state === 'paid' ? 'Paid in full' : 'Partial'} ₱${(payAmt/100).toFixed(0)}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   Dentalemon Comprehensive Seed Script   ║')
  console.log('╚══════════════════════════════════════════╝')

  // ── 0. Health check ──────────────────────────────────────────────────────
  section('0. API health check')
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) })
    log(`✓ API up at ${API} (${r.status})`)
  } catch {
    try { await fetch(`${API}/dental/org/context`, { signal: AbortSignal.timeout(4000) }); log(`✓ API up`) }
    catch { throw new Error(`API not reachable at ${API}.\nStart: cd services/api-ts && bun dev`) }
  }

  // MinIO (storage) preflight — imaging/ceph need it; never fail silently.
  if (process.env['SEED_SKIP_STORAGE'] === '1') {
    log('⚠ SEED_SKIP_STORAGE=1 — imaging/ceph image uploads will be skipped')
  } else {
    try {
      const m = await fetch('http://localhost:9000/minio/health/live', { signal: AbortSignal.timeout(4000) })
      log(`✓ MinIO up at http://localhost:9000 (${m.status})`)
    } catch {
      log('⚠⚠ MinIO NOT reachable at http://localhost:9000 — imaging/ceph images will NOT load.')
      log('    Fix: cd services/api-ts && bun run dev:deps:up   (or SEED_SKIP_STORAGE=1 to silence)')
    }
  }

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  section('1. Auth')
  const { cookie, userId, created: userCreated } = await signUpOrIn(
    'demo@dentalemon.com', 'DemoClinic1!', 'Dr. Maria Reyes'
  )
  log(`${userCreated ? '✓ Created' : '→ Existing'} demo@dentalemon.com`)

  // ── 2. Person ────────────────────────────────────────────────────────────
  section('2. Person profile')
  const personR = await post('/persons', { firstName: 'Maria', lastName: 'Reyes', gender: 'female', timezone: 'Asia/Manila' }, cookie)
  if (!personR.ok && personR.status !== 409) must(personR, 'create person profile')
  log('✓ Person profile')

  // ── 3. Org + Branch ──────────────────────────────────────────────────────
  section('3. Clinic setup')
  let org: any, branch: any, ownerMember: any
  const ctxR = await get('/dental/org/context', cookie)
  if (ctxR.ok && ctxR.data?.branch?.id) {
    org = ctxR.data.org; branch = ctxR.data.branch; ownerMember = ctxR.data.member
    log(`→ Existing: ${org.name} / ${branch.name}`)
  } else {
    // Self-service onboarding — the demo owner provisions org + default branch +
    // their dentist_owner membership in ONE call, exactly as a real clinic owner
    // does (demo@dentalemon.com is NOT a platform admin; org creation is admin-only,
    // EM-ORG-002). Proves the real onboarding path end-to-end on every db:reseed.
    const onb = must(await post('/dental/onboarding', {
      organizationName: 'Reyes Family Dental', tier: 'clinic', countryCode: 'PH',
      branchName: 'Main Clinic', timezone: 'Asia/Manila',
      address: '123 Bonifacio Ave', city: 'Makati', phone: '+63 2 8123 4567',
      ownerDisplayName: 'Dr. Maria Reyes',
    }, cookie), 'self-service onboarding')
    org = { id: onb.organizationId, name: 'Reyes Family Dental' }
    branch = { id: onb.branchId, name: 'Main Clinic' }
    ownerMember = { id: onb.membershipId, displayName: 'Dr. Maria Reyes', role: 'dentist_owner' }
    log(`✓ Onboarded: ${org.name} / ${branch.name} (owner membership ${ownerMember.id})`)
  }

  // ── 4. Staff ─────────────────────────────────────────────────────────────
  section('4. Staff')
  if (!ownerMember) {
    ownerMember = must(await post(`/dental/organizations/${org.id}/branches/${branch.id}/members`, {
      displayName: 'Dr. Maria Reyes', role: 'dentist_owner', personId: userId,
    }, cookie), 'create owner member')
    log(`✓ ${ownerMember.displayName} (dentist_owner)`)
  } else {
    log(`→ ${ownerMember.displayName} (${ownerMember.role})`)
  }
  must(await post(`/dental/organizations/${org.id}/branches/${branch.id}/members/${ownerMember.id}/set-pin`, { pin: '123456' }, cookie), 'owner set-pin')
  log('  PIN: 1 2 3 4 5 6')

  // Check if Ana Santos already exists (seed idempotency — avoids duplicates on re-run)
  const membersR = await get(`/dental/organizations/${org.id}/branches/${branch.id}/members`, cookie)
  const existingStaff = membersR.ok
    ? (membersR.data?.data ?? membersR.data?.members ?? membersR.data ?? []).find((m: any) => m.displayName === 'Ana Santos' && m.role === 'staff_full')
    : null
  if (existingStaff) {
    log(`→ Ana Santos (staff_full) already exists`)
  } else {
    const staffR = await post(`/dental/organizations/${org.id}/branches/${branch.id}/members`, {
      displayName: 'Ana Santos', role: 'staff_full',
    }, cookie)
    if (staffR.ok) {
      must(await post(`/dental/organizations/${org.id}/branches/${branch.id}/members/${staffR.data.id}/set-pin`, { pin: '654321' }, cookie), 'staff set-pin')
      log('✓ Ana Santos (staff_full) PIN: 6 5 4 3 2 1')
    } else {
      log(`⚠ Ana Santos creation failed (${staffR.status})`)
    }
  }

  // ── 5. Org setup: imagingTier + templates ────────────────────────────────
  section('5. Org setup')

  const tierR = await patch(`/dental/organizations/${org.id}`, { imagingTier: 'addon' }, cookie)
  log(tierR.ok ? '✓ imagingTier: addon (ceph unlocked)' : `⚠ imagingTier (${tierR.status})`)

  // Note: generated validator requires `treatments:string`; handler reads raw body with `items:array`.
  // Pass both so the middleware passes and the handler gets the real shape.
  const tplDefs = [
    { name: 'New Patient Exam', treatments: 'stub', branchId: branch.id, description: 'Standard comprehensive exam', items: [
      { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 150000 },
      { cdtCode: 'D0210', description: 'Full-mouth X-ray series', priceCents: 250000 },
    ]},
    { name: 'Adult Prophylaxis + Fluoride', treatments: 'stub', branchId: branch.id, description: 'Routine cleaning', items: [
      { cdtCode: 'D1110', description: 'Adult prophylaxis', priceCents: 250000 },
      { cdtCode: 'D1206', description: 'Fluoride varnish', priceCents: 80000 },
    ]},
    { name: 'Crown Workflow', treatments: 'stub', branchId: branch.id, description: 'RCT + crown (lab)', items: [
      { cdtCode: 'D3330', description: 'Root canal — molar', priceCents: 1200000 },
      { cdtCode: 'D2740', description: 'Crown — porcelain/ceramic', priceCents: 1800000 },
    ]},
  ]
  const treatmentTemplateIds: string[] = []
  for (const tpl of tplDefs) {
    const r = await post('/dental/treatment-templates', tpl, cookie)
    if (r.ok) treatmentTemplateIds.push(r.data.id)
    log(r.ok ? `✓ Template: ${tpl.name}` : `⚠ Template: ${tpl.name} (${r.status})`)
  }

  const consentNames = ['General Treatment Consent', 'Extraction / Surgical Consent', 'Root Canal Consent']
  const consentBodies = [
    'I consent to dental treatment including examination, radiographs, and procedures as recommended.',
    'I consent to tooth extraction under local anesthesia. I understand risks including swelling and bleeding.',
    'I consent to endodontic (root canal) treatment. A crown may be required afterwards.',
  ]
  const consentTemplateIds: string[] = []
  for (let i = 0; i < consentNames.length; i++) {
    // Generated validator requires `title`+`content`; handler reads raw body using `name`+`body`.
    const r = await post(`/dental/branches/${branch.id}/consent-templates`, {
      title: consentNames[i], content: consentBodies[i],
      name: consentNames[i], body: consentBodies[i],
    }, cookie)
    // Create returns { template: { id, … } } — NOT a bare { id }. Reading r.data.id
    // (undefined) silently left every consent template unusable, so generalConsentTplId
    // fell back to 'general', no consent was ever signed, and every visit completion
    // 422'd (VISIT_CONSENT_REQUIRED) → visits stuck active → timeline collapse.
    const tplId = r.data?.template?.id ?? r.data?.id
    if (r.ok && tplId) { consentTemplateIds.push(tplId); log(`✓ Consent template: ${consentNames[i]}`) }
    else log(`⚠ Consent template (${r.status}): ${consentNames[i]} ${r.ok ? '(no id in response)' : ''}`)
  }
  const generalConsentTplId = consentTemplateIds[0] ?? 'general'
  const extractionConsentTplId = consentTemplateIds[1] ?? 'extraction'
  const rctConsentTplId = consentTemplateIds[2] ?? 'rct'
  // Expose to completeVisit so every historical visit gets a signed consent
  // (required by both the visit-completion gate and treatment→performed).
  SEED_GENERAL_CONSENT_TPL_ID = generalConsentTplId

  // ── 6. Patients ──────────────────────────────────────────────────────────
  section('6. Patients')
  const patientDefs = [
    { displayName: 'Juan dela Cruz',  dateOfBirth: '1985-03-15', gender: 'male'   }, // P0
    { displayName: 'Maria Santos',    dateOfBirth: '1992-07-22', gender: 'female' }, // P1 active
    { displayName: 'Roberto Lim',     dateOfBirth: '1978-11-08', gender: 'male'   }, // P2 crown+lab
    { displayName: 'Elena Garcia',    dateOfBirth: '2010-05-30', gender: 'female' }, // P3 pediatric
    { displayName: 'Carlos Mendoza',  dateOfBirth: '1965-01-19', gender: 'male'   }, // P4 open plan
    { displayName: 'Ana Reyes',       dateOfBirth: '1988-04-12', gender: 'female' }, // P5 carry-over
    { displayName: 'Miguel Torres',   dateOfBirth: '2001-09-05', gender: 'male'   }, // P6 imaging+ceph
    { displayName: 'Sofia Cruz',      dateOfBirth: '1975-12-20', gender: 'female' }, // P7 amendment+overdue
    { displayName: 'Diego Ramos',     dateOfBirth: '1995-06-15', gender: 'male'   }, // P8 check-in
    { displayName: 'Isabel Flores',   dateOfBirth: '1960-08-25', gender: 'female' }, // P9 PMD import
    // GAP-007: expand to 20+ patients per IDEAL §10.1
    { displayName: 'Lorenzo Delos Santos', dateOfBirth: '1998-02-14', gender: 'male'   }, // P10 ortho candidate 2
    { displayName: 'Claudia Bautista',     dateOfBirth: '1972-09-03', gender: 'female' }, // P11 periodontal
    { displayName: 'Enrique Villanueva',   dateOfBirth: '1955-04-20', gender: 'male'   }, // P12 full denture
    { displayName: 'Melissa Castro',       dateOfBirth: '2005-11-18', gender: 'female' }, // P13 pediatric braces
    { displayName: 'Ramon Aquino',         dateOfBirth: '1982-07-07', gender: 'male'   }, // P14 implant
    { displayName: 'Patricia Gomez',       dateOfBirth: '1990-01-25', gender: 'female' }, // P15 cosmetic
    { displayName: 'Ferdinand Navarro',    dateOfBirth: '1968-06-11', gender: 'male'   }, // P16 multi-crown
    { displayName: 'Carla Pascual',        dateOfBirth: '1945-12-08', gender: 'female' }, // P17 geriatric
    { displayName: 'Benjamin Uy',          dateOfBirth: '2014-03-22', gender: 'male'   }, // P18 pediatric minor
    { displayName: 'Angela Reyes',         dateOfBirth: '1979-08-30', gender: 'female' }, // P19 insurance + ceph
  ]
  const patients: any[] = []
  for (const pd of patientDefs) {
    const r = await post('/dental/patients', { ...pd, consentGiven: true, branchId: branch.id }, cookie)
    if (r.ok) {
      patients.push(r.data); log(`✓ ${pd.displayName}`)
    } else {
      const listR = await get(`/dental/patients?branchId=${branch.id}`, cookie)
      const existing = (listR.data?.data ?? listR.data?.patients ?? listR.data ?? [])
        .find((p: any) => (p.displayName ?? p.name ?? '') === pd.displayName)
      if (existing) { patients.push(existing); log(`→ Existing: ${pd.displayName}`) }
      else { log(`⚠ Skipped ${pd.displayName} (${r.status})`); patients.push(null) }
    }
  }
  if (!patients.some(Boolean)) throw new Error('No patients created')

  const P = patients  // alias for readability

  // ── 7. Patient-level extras (medical history, recall, follow-up) ─────────
  section('7. Patient-level extras')

  // Medical history — spread enum values across patients
  const medHistDefs = [
    { p: P[0], entryType: 'allergy',         displayName: 'Penicillin allergy', notes: 'Rash and hives on first exposure' },
    { p: P[1], entryType: 'medication',       displayName: 'Amlodipine 5mg', notes: 'For hypertension, taken daily' },
    { p: P[3], entryType: 'family_history',   displayName: 'Diabetes mellitus (father)', notes: 'Father diagnosed age 55' },
    { p: P[4], entryType: 'condition',        displayName: 'Type 2 Diabetes', notes: 'Controlled with metformin. HbA1c 7.2%' },
    { p: P[6], entryType: 'vaccination',      displayName: 'Hepatitis B vaccination', notes: 'Complete series, last dose 2019' },
    { p: P[9], entryType: 'procedure',        displayName: 'Multiple extractions (2018)', notes: 'Extracted #46, #36 at external clinic' },
  ]
  for (const mh of medHistDefs) {
    if (!mh.p) continue
    const r = await post('/dental/clinical/medical-history', {
      patientId: mh.p.id, entryType: mh.entryType, displayName: mh.displayName, notes: mh.notes,
    }, cookie)
    if (r.ok) log(`✓ MedHx ${mh.p.displayName}: ${mh.displayName}`)
    else log(`⚠ MedHx (${r.status}): ${mh.p.displayName}`)
  }

  // Recall dates
  if (P[0]) {
    await patch(`/dental/patients/${P[0].id}`, { recallDate: daysFromNow(90).slice(0, 10), recallNote: '6-month recall — routine cleaning' }, cookie)
    log('✓ Recall: Juan (future, 90 days)')
  }
  if (P[9]) {
    await patch(`/dental/patients/${P[9].id}`, { recallDate: daysAgo(30).slice(0, 10), recallNote: 'Overdue — perio review needed', needsFollowUp: true }, cookie)
    log('✓ Recall: Isabel (overdue)')
  }
  if (P[3]) await patch(`/dental/patients/${P[3].id}`, { needsFollowUp: true }, cookie)

  // GAP-007: guardian contact for P3 (Elena Garcia, dob 2010 — minor, PAT-BR-002)
  if (P[3]) {
    const r = await post(`/dental/patients/${P[3].id}/contacts`, {
      name: 'Rosario Garcia', relationship: 'parent',
      phone: '+63 912 345 6789', email: 'rosario.garcia@email.com',
      isGuardian: true, isEmergencyContact: true,
    }, cookie)
    if (r.ok) log('✓ Guardian: Elena Garcia (P3) → Rosario Garcia')
    else log(`⚠ Guardian contact (${r.status}): ${JSON.stringify(r.data).slice(0, 100)}`)
  }

  // Follow-up notes
  for (const { p, text } of [
    { p: P[3], text: 'Mom reports child is brushing well. Rinse with fluoride mouthwash recommended.' },
    { p: P[9], text: 'Patient missed last recall. Called to remind — confirmed for next available slot.' },
  ]) {
    if (!p) continue
    const r = await post(`/dental/patients/${p.id}/follow-up-notes`, { text }, cookie)
    if (r.ok) log(`✓ Follow-up note: ${p.displayName}`)
  }

  // PMD import for P9
  if (P[9]) {
    const pmdR = await post('/dental/pmd/import', {
      patientId: P[9].id,
      sourceFacility: 'Metro Manila General Hospital Dental Dept',
      sourceReference: 'MMGH-2018-04-12',
      content: 'External dental records from 2018. Multiple extractions performed. Patient reported penicillin allergy. No post-operative complications noted.',
    }, cookie)
    log(pmdR.ok ? '✓ PMD import: Isabel' : `⚠ PMD import (${pmdR.status})`)
  }

  // ── 8. Clinical visits ───────────────────────────────────────────────────
  section('8. Clinical visits')

  let p7AmendmentNoteId: string | null = null
  let completedCount = 0, activeCount = 0

  // ═══════════════════════════════════════════════════════════════════════
  // P0 — Juan dela Cruz: 5 visits, all completed, last with PAID invoice
  // ═══════════════════════════════════════════════════════════════════════
  if (P[0]) {
    log(`\n── ${P[0].displayName}`)
    const p0 = P[0]

    for (const [daysBack, tpl] of [
      [200, TEMPLATES.checkup(46)],
      [150, TEMPLATES.cleaning(16, 36)],
      [90,  TEMPLATES.filling(36, 'occlusal')],
      [45,  TEMPLATES.cleaning(26, 46)],
    ] as [number, any][]) {
      const vid = await activateVisit(p0.id, branch.id, ownerMember.id, daysBack, tpl.complaint, cookie)
      if (!vid) continue
      await addChart(vid, p0.id, tpl.teeth, cookie)
      await addTreatments(vid, p0.id, tpl.treatments, cookie, 'mixed')
      await addNotes(vid, tpl.soap, cookie)
      await completeVisit(vid, p0.id, cookie)
      completedCount++
    }

    // V5 — with PAID invoice
    const v5tpl = TEMPLATES.cleaning(16, 36)
    const v5id = await activateVisit(p0.id, branch.id, ownerMember.id, 10, v5tpl.complaint, cookie)
    if (v5id) {
      await addChart(v5id, p0.id, v5tpl.teeth, cookie)
      await addTreatments(v5id, p0.id, v5tpl.treatments, cookie, 'performed')
      await addNotes(v5id, v5tpl.soap, cookie)
      await completeVisit(v5id, p0.id, cookie)
      completedCount++
      const totalCents = v5tpl.treatments.reduce((s: number, t: any) => s + t.priceCents, 0)
      await makeInvoice(v5id, p0.id, branch.id, ownerMember.id, cookie, { state: 'paid', totalCents })
    }
    log(`  ✓ 5 visits (4 completed + 1 paid invoice)`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P1 — Maria Santos: 3 completed, 1 ACTIVE (Rx + unsigned consent + partial invoice on V3)
  // ═══════════════════════════════════════════════════════════════════════
  if (P[1]) {
    log(`\n── ${P[1].displayName}`)
    const p1 = P[1]

    for (const [daysBack, tpl] of [
      [180, TEMPLATES.checkup(24)],
      [120, TEMPLATES.cleaning(16, 26)],
    ] as [number, any][]) {
      const vid = await activateVisit(p1.id, branch.id, ownerMember.id, daysBack, tpl.complaint, cookie)
      if (!vid) continue
      await addChart(vid, p1.id, tpl.teeth, cookie)
      await addTreatments(vid, p1.id, tpl.treatments, cookie, 'mixed')
      await addNotes(vid, tpl.soap, cookie)
      await completeVisit(vid, p1.id, cookie)
      completedCount++
    }

    // V3 — sensitivity + PARTIAL invoice
    const v3tpl = TEMPLATES.sensitivity(24)
    const v3id = await activateVisit(p1.id, branch.id, ownerMember.id, 60, v3tpl.complaint, cookie)
    if (v3id) {
      await addChart(v3id, p1.id, v3tpl.teeth, cookie)
      await addTreatments(v3id, p1.id, v3tpl.treatments, cookie, 'mixed')
      await addNotes(v3id, v3tpl.soap, cookie)
      await completeVisit(v3id, p1.id, cookie)
      completedCount++
      const totalCents = v3tpl.treatments.reduce((s: number, t: any) => s + t.priceCents, 0)
      await makeInvoice(v3id, p1.id, branch.id, ownerMember.id, cookie, { state: 'partial', totalCents })
    }

    // V4 — ACTIVE (in-progress) + Rx + unsigned consent
    const v4tpl = TEMPLATES.sensitivity(24)
    const v4id = await activateVisit(p1.id, branch.id, ownerMember.id, 0, 'Follow-up: persistent sensitivity #24', cookie)
    if (v4id) {
      await addChart(v4id, p1.id, [{ toothNumber: 24, state: 'watchlist', surfaces: ['cervical'], note: 'Progressing erosion' }], cookie)
      await addTreatments(v4id, p1.id, [
        { cdtCode: 'D0220', description: 'Periapical X-ray (#24)', priceCents: 80000, toothNumber: 24 },
        { cdtCode: 'D2140', description: 'Amalgam restoration — 1 surface (#24)', priceCents: 350000, toothNumber: 24 },
      ], cookie, 'diagnosed') // leave at diagnosed for active visit treatment plan view
      // Rx
      const rxR = await post(`/dental/visits/${v4id}/prescriptions`, {
        visitId: v4id, patientId: p1.id, prescriberMemberId: ownerMember.id,
        drugName: 'Ibuprofen 400mg', dosage: '400mg', frequency: 'TID with meals',
        duration: '5 days', instructions: 'Take with food. Avoid if stomach upset.',
      }, cookie)
      if (rxR.ok) log(`  ✓ Rx: Ibuprofen 400mg`)
      // Signed consent (revenue chain requires signed consent before performed)
      if (generalConsentTplId !== 'general') {
        const consentR = await post(`/dental/visits/${v4id}/consents`, {
          visitId: v4id, patientId: p1.id,
          templateId: generalConsentTplId, templateName: 'General Treatment Consent',
        }, cookie)
        if (consentR.ok) {
          await post(`/dental/visits/${v4id}/consents/${consentR.data.id}/sign`, { signatureData: 'data:image/png;base64,iVBORw0KGgo=' }, cookie)
          log(`  ✓ Signed consent (Maria Santos v4 — revenue chain enabled)`)
        } else {
          log(`  ⚠ Consent create (${consentR.status})`)
        }
      }
      await addNotes(v4id, { subjective: 'Follow-up sensitivity #24. Sensitive toothpaste not helping.', objective: 'Cervical erosion progressing. Cold test positive, 3s.' }, cookie)
      activeCount++
      log(`  ◎ Active visit: ${P[1].displayName}`)
    }
    log(`  ✓ 3 completed + 1 active + partial invoice`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P2 — Roberto Lim: crown via lab, payment plan, verified treatment
  // ═══════════════════════════════════════════════════════════════════════
  if (P[2]) {
    log(`\n── ${P[2].displayName}`)
    const p2 = P[2]

    for (const [daysBack, tpl] of [
      [300, TEMPLATES.checkup(46)],
      [250, TEMPLATES.cleaning(36, 46)],
    ] as [number, any][]) {
      const vid = await activateVisit(p2.id, branch.id, ownerMember.id, daysBack, tpl.complaint, cookie)
      if (!vid) continue
      await addChart(vid, p2.id, tpl.teeth, cookie)
      await addTreatments(vid, p2.id, tpl.treatments, cookie, 'mixed')
      await addNotes(vid, tpl.soap, cookie)
      await completeVisit(vid, p2.id, cookie)
      completedCount++
    }

    // V3 — RCT + xray attachment
    const v3tpl = TEMPLATES.rct(46)
    const v3id = await activateVisit(p2.id, branch.id, ownerMember.id, 180, v3tpl.complaint, cookie)
    if (v3id) {
      await addChart(v3id, p2.id, v3tpl.teeth, cookie)
      await addTreatments(v3id, p2.id, v3tpl.treatments, cookie, 'mixed')
      await addNotes(v3id, v3tpl.soap, cookie)
      // Attachment (xray, metadata only)
      await post(`/dental/visits/${v3id}/attachments`, {
        visitId: v3id, patientId: p2.id, imageType: 'xray',
        fileName: 'tooth46-rct-preop.jpg', filePath: '/uploads/p2/tooth46-rct.jpg',
        fileSizeBytes: 512000, mimeType: 'image/jpeg', toothNumbers: [46],
        note: 'Pre-RCT periapical — shows periapical radiolucency #46',
      }, cookie)
      log(`  ✓ Xray attachment`)
      await completeVisit(v3id, p2.id, cookie)
      completedCount++
    }

    // V4 — crown prep + lab order (→ fitted) + signed consent
    const v4tpl = TEMPLATES.crown(46)
    // Override — crown PREP, not seat
    const v4id = await activateVisit(p2.id, branch.id, ownerMember.id, 120, 'Crown preparation #46 — tooth reduction and impression', cookie)
    if (v4id) {
      await addChart(v4id, p2.id, [{ toothNumber: 46, state: 'crown', note: 'Crown prep this visit' }], cookie)
      await addTreatments(v4id, p2.id, [
        { cdtCode: 'D0220', description: 'Periapical X-ray (#46)', priceCents: 80000, toothNumber: 46 },
        { cdtCode: 'D2750', description: 'Crown prep — full cast metal (#46)', priceCents: 900000, toothNumber: 46 },
      ], cookie, 'mixed')
      // Lab order — drive to fitted (create while active)
      const labR = await post(`/dental/visits/${v4id}/lab-orders`, {
        visitId: v4id, patientId: p2.id,
        labName: 'Crown Lab Philippines Inc.',
        description: 'Full porcelain crown #46. Shade A2. Expected 10 business days.',
        expectedDeliveryDate: daysFromNow(10),
      }, cookie)
      let labOrderId: string | null = null
      if (labR.ok) { labOrderId = labR.data.id; log(`  ✓ Lab order created`) }
      // Signed consent (extraction template for surgical-adjacent)
      if (rctConsentTplId !== 'rct') {
        const consentR = await post(`/dental/visits/${v4id}/consents`, {
          visitId: v4id, patientId: p2.id,
          templateId: rctConsentTplId, templateName: 'Root Canal Consent',
        }, cookie)
        if (consentR.ok) {
          await post(`/dental/visits/${v4id}/consents/${consentR.data.id}/sign`, { signatureData: 'data:image/png;base64,iVBORw0KGgo=' }, cookie)
          log(`  ✓ Signed consent`)
        }
      }
      await addNotes(v4id, { subjective: 'Crown prep visit. Temporary crown placed.', objective: 'Tooth #46 reduced, impression taken. Temporary cemented.' }, cookie)
      await completeVisit(v4id, p2.id, cookie)
      completedCount++
      // Progress lab order after completion: ordered → in_fabrication → delivered → fitted
      if (labOrderId) {
        for (const s of ['in_fabrication', 'delivered', 'fitted'] as const) {
          await patch(`/dental/visits/${v4id}/lab-orders/${labOrderId}`, { status: s }, cookie)
        }
        log(`  ✓ Lab order → fitted`)
      }
    }

    // V5 — crown seat, verified treatment, PARTIAL invoice + payment plan
    const v5id = await activateVisit(p2.id, branch.id, ownerMember.id, 60, 'Crown cementation #46 — permanent crown delivery', cookie)
    if (v5id) {
      await addChart(v5id, p2.id, [{ toothNumber: 46, state: 'crown', note: 'Permanent crown cemented' }], cookie)
      // Two treatments — first one goes to verified
      const tids = await addTreatments(v5id, p2.id, [
        { cdtCode: 'D2740', description: 'Crown — porcelain/ceramic (#46)', priceCents: 1800000, toothNumber: 46 },
        { cdtCode: 'D0120', description: 'Post-crown delivery evaluation', priceCents: 80000 },
      ], cookie, 'verified-first')
      await addNotes(v5id, { subjective: 'Crown delivery visit. Bite feels comfortable.', objective: 'Crown seated, margins sealed. Occlusion checked.' }, cookie)
      await completeVisit(v5id, p2.id, cookie)
      completedCount++
      const totalCents = 1800000 + 80000
      await makeInvoice(v5id, p2.id, branch.id, ownerMember.id, cookie, { state: 'partial', withPlan: true, totalCents })
    }
    log(`  ✓ 5 visits, lab→fitted, signed consent, payment plan, verified treatment`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P3 — Elena Garcia (pediatric): 3 visits + carry-over
  // ═══════════════════════════════════════════════════════════════════════
  if (P[3]) {
    log(`\n── ${P[3].displayName}`)
    const p3 = P[3]

    // V1 — checkup
    const p3v1tpl = TEMPLATES.checkup(46)
    const p3v1id = await activateVisit(p3.id, branch.id, ownerMember.id, 180, p3v1tpl.complaint, cookie)
    if (p3v1id) {
      await addChart(p3v1id, p3.id, p3v1tpl.teeth, cookie)
      await addTreatments(p3v1id, p3.id, p3v1tpl.treatments, cookie, 'mixed')
      await addNotes(p3v1id, p3v1tpl.soap, cookie)
      await completeVisit(p3v1id, p3.id, cookie)
      completedCount++
    }

    // V2 — cleaning: eval → performed; prophylaxis → planned (carry-over source)
    const p3v2id = await activateVisit(p3.id, branch.id, ownerMember.id, 90, 'Routine cleaning — prophylaxis deferred', cookie)
    if (p3v2id) {
      await addChart(p3v2id, p3.id, [{ toothNumber: 36, state: 'filled', surfaces: ['mesial', 'distal'] }], cookie)
      const p3e = await post(`/dental/visits/${p3v2id}/treatments`, {
        visitId: p3v2id, patientId: p3.id, cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 100000,
      }, cookie)
      if (p3e.ok) {
        await patch(`/dental/visits/${p3v2id}/treatments/${p3e.data.id}`, { status: 'planned' }, cookie)
        await patch(`/dental/visits/${p3v2id}/treatments/${p3e.data.id}`, { status: 'performed' }, cookie)
      }
      const p3c = await post(`/dental/visits/${p3v2id}/treatments`, {
        visitId: p3v2id, patientId: p3.id, cdtCode: 'D1110', description: 'Adult prophylaxis — deferred', priceCents: 250000,
      }, cookie)
      if (p3c.ok) await patch(`/dental/visits/${p3v2id}/treatments/${p3c.data.id}`, { status: 'planned' }, cookie)
      await addNotes(p3v2id, { subjective: 'Patient anxious — prophylaxis deferred to next visit.', objective: 'Eval done. Calculus noted. Prophylaxis scheduled.' }, cookie)
      await completeVisit(p3v2id, p3.id, cookie)
      completedCount++
      log(`  ✓ V2 — D1110 at planned (carry-over source)`)
    }

    // V3 — filling + carry-over D1110 from V2
    const p3v3tpl = TEMPLATES.filling(36, 'occlusal')
    const p3v3id = await activateVisit(p3.id, branch.id, ownerMember.id, 20, p3v3tpl.complaint, cookie)
    if (p3v3id) {
      await addChart(p3v3id, p3.id, p3v3tpl.teeth, cookie)
      const p3co = await post(`/dental/visits/${p3v3id}/carry-over`, {}, cookie)
      if (p3co.ok) log(`  ✓ Carry-over — D1110 carried (carriedOver=true)`)
      else log(`  ⚠ Carry-over (${p3co.status}): ${JSON.stringify(p3co.data).slice(0, 100)}`)
      await addTreatments(p3v3id, p3.id, p3v3tpl.treatments, cookie, 'mixed')
      await addNotes(p3v3id, p3v3tpl.soap, cookie)
      await completeVisit(p3v3id, p3.id, cookie)
      completedCount++
    }
    log(`  ✓ 3 visits + carry-over + needsFollowUp + follow-up note`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P4 — Carlos Mendoza (older): V4 leaves treatments at planned → Treatment Plan view
  // ═══════════════════════════════════════════════════════════════════════
  if (P[4]) {
    log(`\n── ${P[4].displayName}`)
    const p4 = P[4]

    for (const [daysBack, tpl] of [
      [240, TEMPLATES.extraction(48)],
      [180, TEMPLATES.checkup(47)],
      [120, TEMPLATES.perio('lower left and lower right')],
    ] as [number, any][]) {
      const vid = await activateVisit(p4.id, branch.id, ownerMember.id, daysBack, tpl.complaint, cookie)
      if (!vid) continue
      await addChart(vid, p4.id, tpl.teeth, cookie)
      await addTreatments(vid, p4.id, tpl.treatments, cookie, 'mixed')
      await addNotes(vid, tpl.soap, cookie)
      await completeVisit(vid, p4.id, cookie)
      completedCount++
    }

    // V4 — consult, treatments LEFT AT PLANNED (no invoice → feeds Treatment Plan view)
    const v4id = await activateVisit(p4.id, branch.id, ownerMember.id, 5, 'Implant consultation — #48 site and missing teeth evaluation', cookie)
    if (v4id) {
      await addChart(v4id, p4.id, [
        { toothNumber: 47, state: 'watchlist', surfaces: ['distal'], note: 'Drifted, implant-adjacent', entryClassification: 'existing' },
        { toothNumber: 48, state: 'extracted', note: 'Previously extracted', entryClassification: 'existing_other' },
      ], cookie)
      // Treatments at PLANNED — feeds Treatment Plan tab
      await addTreatments(v4id, p4.id, [
        { cdtCode: 'D6010', description: 'Implant body placement #48 site', priceCents: 5000000, toothNumber: 48 },
        { cdtCode: 'D6065', description: 'Implant supported crown #48', priceCents: 2500000, toothNumber: 48 },
        { cdtCode: 'D2740', description: 'Crown — porcelain #47 (drifted, reshape)', priceCents: 1800000, toothNumber: 47 },
      ], cookie, 'planned') // keepPlanned — stays in Treatment Plan view
      // Panoramic attachment
      await post(`/dental/visits/${v4id}/attachments`, {
        visitId: v4id, patientId: p4.id, imageType: 'xray',
        fileName: 'p4-panoramic-implant-eval.jpg', filePath: '/uploads/p4/panoramic.jpg',
        fileSizeBytes: 1024000, mimeType: 'image/jpeg',
        note: 'Pre-implant panoramic — #47 drifted, #48 healed extraction site',
      }, cookie)
      log(`  ✓ Panoramic attachment`)
      await addNotes(v4id, {
        subjective: 'Consultation for implant and crown plan. Patient aware of costs and timeline.',
        objective: 'Panoramic reviewed. Bone height adequate at #48 site. #47 mesially drifted.',
      }, cookie)
      // Complete — allowed even with treatments at planned
      await completeVisit(v4id, p4.id, cookie)
      completedCount++
      log(`  ✓ V4 treatments left at planned → populates Treatment Plan view`)
    }
    log(`  ✓ 4 visits + open treatment plan`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P5 — Ana Reyes: carry-over case
  // ═══════════════════════════════════════════════════════════════════════
  if (P[5]) {
    log(`\n── ${P[5].displayName}`)
    const p5 = P[5]

    // V1 — checkup, all performed
    const v1tpl = TEMPLATES.checkup(16)
    const v1id = await activateVisit(p5.id, branch.id, ownerMember.id, 160, v1tpl.complaint, cookie)
    if (v1id) {
      await addChart(v1id, p5.id, v1tpl.teeth, cookie)
      await addTreatments(v1id, p5.id, v1tpl.treatments, cookie, 'mixed')
      await addNotes(v1id, v1tpl.soap, cookie)
      await completeVisit(v1id, p5.id, cookie)
      completedCount++
    }

    // V2 — cleaning: D0120 → performed, D1110 → PLANNED (carry-over source)
    const v2id = await activateVisit(p5.id, branch.id, ownerMember.id, 100, 'Routine cleaning — unable to complete, rescheduled', cookie)
    if (v2id) {
      await addChart(v2id, p5.id, [{ toothNumber: 36, state: 'filled', surfaces: ['mesial'] }], cookie)
      // D0120: performed; D1110: planned (left pending — source for carry-over)
      const evalR = await post(`/dental/visits/${v2id}/treatments`, { visitId: v2id, patientId: p5.id,
        cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 100000 }, cookie)
      if (evalR.ok) {
        await patch(`/dental/visits/${v2id}/treatments/${evalR.data.id}`, { status: 'planned' }, cookie)
        await patch(`/dental/visits/${v2id}/treatments/${evalR.data.id}`, { status: 'performed' }, cookie)
      }
      const cleanR = await post(`/dental/visits/${v2id}/treatments`, { visitId: v2id, patientId: p5.id,
        cdtCode: 'D1110', description: 'Adult prophylaxis (cleaning) — deferred', priceCents: 250000 }, cookie)
      if (cleanR.ok) {
        // Advance to planned but NOT performed — carry-over source
        await patch(`/dental/visits/${v2id}/treatments/${cleanR.data.id}`, { status: 'planned' }, cookie)
      }
      await addNotes(v2id, { subjective: 'Cleaning started but patient had to leave. Scaling deferred.', objective: 'Evaluation complete. Calculus noted. Scaling planned.' }, cookie)
      // Complete V2 (allowed with 1 treatment at planned)
      await completeVisit(v2id, p5.id, cookie)
      completedCount++
      log(`  ✓ V2 completed — D1110 left at planned (carry-over source)`)
    }

    // V3 — carry-over target
    const v3id = await activateVisit(p5.id, branch.id, ownerMember.id, 40, 'Completing deferred cleaning — carried over from last visit', cookie)
    if (v3id) {
      await addChart(v3id, p5.id, [{ toothNumber: 36, state: 'filled' }, { toothNumber: 16, state: 'watchlist' }], cookie)
      // Carry-over — copies D1110 (planned) from V2, carriedOver=true
      const coR = await post(`/dental/visits/${v3id}/carry-over`, {}, cookie)
      if (coR.ok) log(`  ✓ Carry-over triggered — D1110 carried (carriedOver=true, planned)`)
      else log(`  ⚠ Carry-over (${coR.status}): ${JSON.stringify(coR.data).slice(0,100)}`)
      // Add a new filling treatment to V3 (gets performed)
      const fillR = await post(`/dental/visits/${v3id}/treatments`, { visitId: v3id, patientId: p5.id,
        cdtCode: 'D2391', description: 'Resin composite #36 — occlusal', priceCents: 400000, toothNumber: 36 }, cookie)
      if (fillR.ok) {
        await patch(`/dental/visits/${v3id}/treatments/${fillR.data.id}`, { status: 'planned' }, cookie)
        await patch(`/dental/visits/${v3id}/treatments/${fillR.data.id}`, { status: 'performed' }, cookie)
      }
      // Leave carried D1110 at planned — shows in Treatment Plan + carried section
      await addNotes(v3id, { subjective: 'Completed deferred cleaning. Filling done.', objective: 'Scaling complete. Resin #36 placed. Occlusion adjusted.' }, cookie)
      await completeVisit(v3id, p5.id, cookie)
      completedCount++
      log(`  ✓ V3 completed — carried D1110 stays at planned`)
    }
    log(`  ✓ 3 visits + carry-over coverage`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P6 — Miguel Torres: full imaging + ceph chain, lab (in_fabrication)
  // ═══════════════════════════════════════════════════════════════════════
  if (P[6]) {
    log(`\n── ${P[6].displayName}`)
    const p6 = P[6]

    // V1 — checkup
    const v1tpl = TEMPLATES.checkup(11)
    const v1id = await activateVisit(p6.id, branch.id, ownerMember.id, 200, v1tpl.complaint, cookie)
    if (v1id) {
      await addChart(v1id, p6.id, v1tpl.teeth, cookie)
      await addTreatments(v1id, p6.id, v1tpl.treatments, cookie, 'mixed')
      await addNotes(v1id, v1tpl.soap, cookie)
      await completeVisit(v1id, p6.id, cookie)
      completedCount++
      // Ceph chain seeds off V1 (always created) so it never gets blocked by the
      // V2 visit-completion cascade (see seedCephChain). Non-fatal if storage is down.
      try { await seedCephChain(p6.id, branch.id, v1id, cookie) }
      catch (e: any) { log(`  ⚠ P6 ceph skipped: ${String(e?.message).slice(0, 140)}`) }
    }

    // V2 — ortho + imaging + ceph + lab order (while active)
    const v2tpl = TEMPLATES.ortho(11)
    const v2id = await activateVisit(p6.id, branch.id, ownerMember.id, 90, v2tpl.complaint, cookie)
    if (v2id) {
      await addChart(v2id, p6.id, v2tpl.teeth, cookie)
      await addTreatments(v2id, p6.id, v2tpl.treatments, cookie, 'mixed')

      // Ceph chain seeds off V1 above (seedCephChain) — kept out of V2 so it isn't
      // blocked by the visit-completion cascade and Miguel can't get a duplicate study.

      // Lab order for ortho appliance — stays at in_fabrication
      const labR = await post(`/dental/visits/${v2id}/lab-orders`, {
        visitId: v2id, patientId: p6.id,
        labName: 'Ortho Appliance Lab PH',
        description: 'Upper fixed braces — standard metal brackets. Impressions taken.',
        expectedDeliveryDate: daysFromNow(14),
      }, cookie)
      let labId: string | null = null
      if (labR.ok) { labId = labR.data.id; log(`  ✓ Lab order (ortho appliance)`) }

      await addNotes(v2id, v2tpl.soap, cookie)
      await completeVisit(v2id, p6.id, cookie)
      completedCount++

      // Progress lab order to in_fabrication (1 step only)
      if (labId) {
        await patch(`/dental/visits/${v2id}/lab-orders/${labId}`, { status: 'in_fabrication' }, cookie)
        log(`  ✓ Lab order → in_fabrication`)
      }
    }

    // V3 — cleaning
    const v3tpl = TEMPLATES.cleaning(16, 46)
    const v3id = await activateVisit(p6.id, branch.id, ownerMember.id, 30, v3tpl.complaint, cookie)
    if (v3id) {
      await addChart(v3id, p6.id, v3tpl.teeth, cookie)
      await addTreatments(v3id, p6.id, v3tpl.treatments, cookie, 'mixed')
      await addNotes(v3id, v3tpl.soap, cookie)
      await completeVisit(v3id, p6.id, cookie)
      completedCount++
    }
    log(`  ✓ 3 visits + full imaging/ceph chain`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P7 — Sofia Cruz: amendment on V3 notes, overdue invoice on V4
  // ═══════════════════════════════════════════════════════════════════════
  if (P[7]) {
    log(`\n── ${P[7].displayName}`)
    const p7 = P[7]

    for (const [daysBack, tpl] of [
      [365, TEMPLATES.checkup(11)],
      [300, TEMPLATES.perio('upper right and upper left')],
    ] as [number, any][]) {
      const vid = await activateVisit(p7.id, branch.id, ownerMember.id, daysBack, tpl.complaint, cookie)
      if (!vid) continue
      await addChart(vid, p7.id, tpl.teeth, cookie)
      await addTreatments(vid, p7.id, tpl.treatments, cookie, 'mixed')
      await addNotes(vid, tpl.soap, cookie)
      await completeVisit(vid, p7.id, cookie)
      completedCount++
    }

    // V3 — RCT — capture noteId for amendment
    const v3tpl = TEMPLATES.rct(11, 'D3310')
    const v3id = await activateVisit(p7.id, branch.id, ownerMember.id, 240, v3tpl.complaint, cookie)
    if (v3id) {
      await addChart(v3id, p7.id, v3tpl.teeth, cookie)
      await addTreatments(v3id, p7.id, v3tpl.treatments, cookie, 'mixed')
      const noteId = await addNotes(v3id, v3tpl.soap, cookie)
      p7AmendmentNoteId = noteId
      await completeVisit(v3id, p7.id, cookie)
      completedCount++
      // Amendment on the SOAP note
      if (noteId) {
        const amendR = await post(`/dental/visits/${v3id}/amendments`, {
          visitId: v3id, patientId: p7.id,
          originalRecordType: 'visit_note', originalRecordId: noteId,
          reason: 'Clinical correction: anesthetic dosage updated after chart review',
          content: 'Amended: lidocaine 2% with epi 1:100k administered — 1.8mL (1 carpule). Original entry omitted dosage details.',
        }, cookie)
        log(amendR.ok ? `  ✓ Amendment on V3 note` : `  ⚠ Amendment (${amendR.status}): ${JSON.stringify(amendR.data).slice(0,100)}`)
      }
    }

    // V4 — crown + OVERDUE invoice (past dueDate)
    const v4tpl = TEMPLATES.crown(11)
    const v4id = await activateVisit(p7.id, branch.id, ownerMember.id, 180, v4tpl.complaint, cookie)
    if (v4id) {
      await addChart(v4id, p7.id, v4tpl.teeth, cookie)
      await addTreatments(v4id, p7.id, v4tpl.treatments, cookie, 'performed')
      await addNotes(v4id, v4tpl.soap, cookie)
      await completeVisit(v4id, p7.id, cookie)
      completedCount++
      const totalCents = v4tpl.treatments.reduce((s: number, t: any) => s + t.priceCents, 0)
      await makeInvoice(v4id, p7.id, branch.id, ownerMember.id, cookie, { state: 'overdue', totalCents })
    }

    // V5 — cleaning (newest visit — J10 requires signed:true on newest)
    const v5tpl = TEMPLATES.cleaning(16, 36)
    const v5id = await activateVisit(p7.id, branch.id, ownerMember.id, 60, v5tpl.complaint, cookie)
    if (v5id) {
      await addChart(v5id, p7.id, v5tpl.teeth, cookie)
      await addTreatments(v5id, p7.id, v5tpl.treatments, cookie, 'mixed')
      await addNotes(v5id, v5tpl.soap, cookie)
      const signR = await post(`/dental/visits/${v5id}/notes/sign`, {}, cookie)
      log(signR.ok ? `  ✓ V5 note signed (signed:true for J10)` : `  ⚠ V5 sign (${signR.status}): ${JSON.stringify(signR.data).slice(0,100)}`)
      await completeVisit(v5id, p7.id, cookie)
      completedCount++
    }
    log(`  ✓ 5 visits + amendment + overdue invoice`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P8 — Diego Ramos: ALL visits completed (check-in done in Phase 9)
  // ═══════════════════════════════════════════════════════════════════════
  if (P[8]) {
    log(`\n── ${P[8].displayName}`)
    const p8 = P[8]
    for (const [daysBack, tpl] of [
      [120, TEMPLATES.checkup(46)],
      [60,  TEMPLATES.cleaning(26, 46)],
      [20,  TEMPLATES.filling(36, 'mesial')],
    ] as [number, any][]) {
      const vid = await activateVisit(p8.id, branch.id, ownerMember.id, daysBack, tpl.complaint, cookie)
      if (!vid) continue
      await addChart(vid, p8.id, tpl.teeth, cookie)
      await addTreatments(vid, p8.id, tpl.treatments, cookie, 'mixed')
      await addNotes(vid, tpl.soap, cookie)
      await completeVisit(vid, p8.id, cookie) // MUST all be completed before check-in
      completedCount++
    }
    log(`  ✓ 3 visits (all completed — check-in available in Phase 9)`)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // P9 — Isabel Flores: Rx, signed consent, DRAFT invoice, PMD import (done)
  // ═══════════════════════════════════════════════════════════════════════
  if (P[9]) {
    log(`\n── ${P[9].displayName}`)
    const p9 = P[9]

    // V1 — checkup
    const v1tpl = TEMPLATES.checkup(46)
    const v1id = await activateVisit(p9.id, branch.id, ownerMember.id, 400, v1tpl.complaint, cookie)
    if (v1id) {
      await addChart(v1id, p9.id, v1tpl.teeth, cookie)
      await addTreatments(v1id, p9.id, v1tpl.treatments, cookie, 'mixed')
      await addNotes(v1id, v1tpl.soap, cookie)
      await completeVisit(v1id, p9.id, cookie)
      completedCount++
    }

    // V2 — extraction + signed consent + Rx
    const v2tpl = TEMPLATES.extraction(46)
    const v2id = await activateVisit(p9.id, branch.id, ownerMember.id, 350, v2tpl.complaint, cookie)
    if (v2id) {
      await addChart(v2id, p9.id, v2tpl.teeth, cookie)
      await addTreatments(v2id, p9.id, v2tpl.treatments, cookie, 'mixed')
      // Signed extraction consent
      if (extractionConsentTplId !== 'extraction') {
        const consentR = await post(`/dental/visits/${v2id}/consents`, {
          visitId: v2id, patientId: p9.id,
          templateId: extractionConsentTplId, templateName: 'Extraction / Surgical Consent',
        }, cookie)
        if (consentR.ok) {
          await post(`/dental/visits/${v2id}/consents/${consentR.data.id}/sign`, { signatureData: 'data:image/png;base64,iVBORw0KGgo=' }, cookie)
          log(`  ✓ Signed extraction consent`)
        }
      }
      // Rx — antibiotic + analgesic
      for (const rx of [
        { drugName: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'TID', duration: '7 days', instructions: 'Take until finished. Avoid if allergic.' },
        { drugName: 'Mefenamic Acid 500mg', dosage: '500mg', frequency: 'TID PRN pain', duration: '5 days', instructions: 'Take with food.' },
      ]) {
        await post(`/dental/visits/${v2id}/prescriptions`, {
          visitId: v2id, patientId: p9.id, prescriberMemberId: ownerMember.id, ...rx,
        }, cookie)
      }
      log(`  ✓ Rx: Amoxicillin + Mefenamic Acid`)
      await addNotes(v2id, v2tpl.soap, cookie)
      await completeVisit(v2id, p9.id, cookie)
      completedCount++
    }

    // V3 — perio
    const v3tpl = TEMPLATES.perio('all four quadrants')
    const v3id = await activateVisit(p9.id, branch.id, ownerMember.id, 270, v3tpl.complaint, cookie)
    if (v3id) {
      await addChart(v3id, p9.id, v3tpl.teeth, cookie)
      await addTreatments(v3id, p9.id, v3tpl.treatments, cookie, 'mixed')
      await addNotes(v3id, v3tpl.soap, cookie)
      await completeVisit(v3id, p9.id, cookie)
      completedCount++
    }

    // V4 — cleaning + DRAFT invoice
    const v4tpl = TEMPLATES.cleaning(16, 26)
    const v4id = await activateVisit(p9.id, branch.id, ownerMember.id, 90, v4tpl.complaint, cookie)
    if (v4id) {
      await addChart(v4id, p9.id, v4tpl.teeth, cookie)
      await addTreatments(v4id, p9.id, v4tpl.treatments, cookie, 'mixed')
      await addNotes(v4id, v4tpl.soap, cookie)
      await completeVisit(v4id, p9.id, cookie)
      completedCount++
      const totalCents = v4tpl.treatments.reduce((s: number, t: any) => s + t.priceCents, 0)
      await makeInvoice(v4id, p9.id, branch.id, ownerMember.id, cookie, { state: 'draft', totalCents })
    }
    log(`  ✓ 4 visits + signed consent + Rx + draft invoice`)
  }

  log(`\n  ✓ Total: ${completedCount} completed visits, ${activeCount} active`)

  // ── 8.6 Current open visits (one active in-progress visit per patient) ───────
  // Every demo patient EXCEPT Maria (already has active V4) and Diego (checked in
  // via today's appointment in §9) gets ONE active "current" visit with an OPEN
  // plan, so the workspace carousel always opens on an editable card: a chart to
  // click + pending treatments to plan/decline/bill. Teeth layer on the cumulative
  // snapshot (prior conditions + this visit's new findings).
  section('8.6 Current open visits')

  const currentVisitSpecs: Array<{
    p: any; complaint: string; teeth: any[]; plan: OpenTreatment[]; soap?: any
  }> = [
    { p: P[0], complaint: 'Recall exam — sensitivity upper right',
      teeth: [{ toothNumber: 17, state: 'caries', surfaces: ['occlusal'], conditionCode: 'K02.1', note: 'Occlusal caries — restorable' }],
      plan: [
        { cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 100000 },
        { cdtCode: 'D2392', description: 'Resin composite #17 — two surfaces', priceCents: 450000, toothNumber: 17, plan: true },
      ],
      soap: { subjective: 'Sensitivity upper right when chewing.', objective: 'Occlusal caries #17. Cold test positive, subsides quickly.' } },
    { p: P[2], complaint: 'Crown review + new interproximal finding #15',
      teeth: [{ toothNumber: 15, state: 'caries', surfaces: ['mesial'], note: 'Interproximal caries' }],
      plan: [
        { cdtCode: 'D0140', description: 'Limited oral evaluation — problem focused', priceCents: 120000 },
        { cdtCode: 'D2391', description: 'Resin composite #15 — one surface', priceCents: 350000, toothNumber: 15, plan: true },
      ],
      soap: { subjective: 'Crown comfortable. New cold sensitivity #15.', objective: '#46 crown well seated. #15 mesial caries on bitewing.' } },
    { p: P[3], complaint: 'Pediatric recall — fluoride + watch #46',
      teeth: [{ toothNumber: 46, state: 'watchlist', surfaces: ['occlusal'], note: 'Deep fissure — monitor' }],
      plan: [
        { cdtCode: 'D1206', description: 'Topical fluoride varnish', priceCents: 80000 },
        { cdtCode: 'D1351', description: 'Sealant #46', priceCents: 150000, toothNumber: 46, plan: true },
      ],
      soap: { subjective: 'Routine pediatric recall. No complaints.', objective: 'Good OH. Deep occlusal fissure #46 — sealant indicated.' } },
    { p: P[4], complaint: 'Implant planning — #46 site + caries #37',
      teeth: [{ toothNumber: 37, state: 'caries', surfaces: ['distal'], note: 'Distal caries' }],
      plan: [
        { cdtCode: 'D6010', description: 'Surgical placement implant body #46', priceCents: 6500000, toothNumber: 46, plan: true },
        { cdtCode: 'D2393', description: 'Resin composite #37 — three surfaces', priceCents: 550000, toothNumber: 37 },
      ],
      soap: { subjective: 'Ready to proceed with implant. Mild sensitivity #37.', objective: '#46 edentulous site healed. #37 distal caries.' } },
    { p: P[5], complaint: 'Recall — endo evaluation #36',
      teeth: [
        { toothNumber: 16, state: 'watchlist', surfaces: ['cervical'], note: 'Cervical abrasion — monitor' },
        { toothNumber: 36, state: 'caries', surfaces: ['mesial', 'occlusal'], conditionCode: 'K04.0', note: 'Deep caries → pulpitis' },
      ],
      plan: [
        { cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 100000 },
        { cdtCode: 'D3330', description: 'Endodontic therapy — molar #36 (RCT)', priceCents: 1800000, toothNumber: 36 },
        { cdtCode: 'D2950', description: 'Core buildup #36', priceCents: 350000, toothNumber: 36, plan: true },
      ],
      soap: { subjective: 'Lingering pain #36 to hot. Considering options.', objective: 'Deep mesio-occlusal caries #36, irreversible pulpitis. RCT vs extraction discussed.' } },
    { p: P[6], complaint: 'Ortho review + restorative #25',
      teeth: [{ toothNumber: 25, state: 'caries', surfaces: ['occlusal'], note: 'Occlusal caries' }],
      plan: [
        { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 180000 },
        { cdtCode: 'D2391', description: 'Resin composite #25 — one surface', priceCents: 350000, toothNumber: 25, plan: true },
      ],
      soap: { subjective: 'Ortho progressing. Sensitivity #25.', objective: 'Alignment improving. #25 occlusal caries.' } },
    { p: P[7], complaint: 'Follow-up — perio maintenance + #44 finding',
      teeth: [{ toothNumber: 44, state: 'caries', surfaces: ['buccal'], note: 'Cervical caries' }],
      plan: [
        { cdtCode: 'D4910', description: 'Periodontal maintenance', priceCents: 250000 },
        { cdtCode: 'D2391', description: 'Resin composite #44 — one surface', priceCents: 350000, toothNumber: 44, plan: true },
      ],
      soap: { subjective: 'Here for perio maintenance. Notes #44 sensitivity.', objective: 'Stable perio. #44 buccal cervical caries.' } },
    { p: P[9], complaint: 'New patient transfer — comprehensive plan',
      teeth: [
        { toothNumber: 26, state: 'caries', surfaces: ['occlusal'], note: 'Occlusal caries' },
        { toothNumber: 47, state: 'watchlist', surfaces: ['occlusal'], note: 'Stained fissure — monitor' },
      ],
      plan: [
        { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 180000 },
        { cdtCode: 'D2392', description: 'Resin composite #26 — two surfaces', priceCents: 450000, toothNumber: 26, plan: true },
      ],
      soap: { subjective: 'Transferred from previous clinic. Wants full plan.', objective: 'Generalized good OH. #26 occlusal caries. #47 watch.' } },
  ]

  for (const s of currentVisitSpecs) {
    if (!s.p) continue
    const vid = await addCurrentVisit(
      s.p.id, branch.id, ownerMember.id, s.complaint, s.teeth, s.plan, cookie,
      { soap: s.soap, signConsent: true },
    )
    if (vid) { activeCount++; log(`  ◎ Current visit: ${s.p.displayName} (open plan: ${s.plan.length} items)`) }
  }
  log(`\n  ✓ Current open visits added (carousel now opens on an editable active card)`)

  // ── 8.5 Imaging studies (all patients) ──────────────────────────────────────
  section('8.5 Imaging studies')

  const imagingDefs = [
    { p: P[0], modality: 'panoramic',  filename: 'delacruz-juan-panoramic.jpg' },
    { p: P[1], modality: 'periapical', filename: 'santos-maria-pa-tooth24.jpg' },
    { p: P[2], modality: 'panoramic',  filename: 'lim-roberto-crown-series.jpg' },
    { p: P[3], modality: 'periapical', filename: 'garcia-elena-pa-pediatric.jpg' },
    { p: P[4], modality: 'panoramic',  filename: 'mendoza-carlos-implant-pano.jpg' },
    { p: P[5], modality: 'periapical', filename: 'reyes-ana-bitewing.jpg' },
    // P[6] Miguel: cephalometric study with full ceph chain already seeded in Phase 8
    { p: P[7], modality: 'panoramic',  filename: 'cruz-sofia-multiyr-pano.jpg' },
    { p: P[8], modality: 'periapical', filename: 'ramos-diego-emergency-pa.jpg' },
    { p: P[9], modality: 'panoramic',  filename: 'flores-isabel-senior-pano.jpg' },
  ]
  for (const def of imagingDefs) {
    if (!def.p) continue
    const r = await post('/dental/imaging/studies', {
      patientId: def.p.id, branchId: branch.id,
      modality: def.modality, filename: def.filename,
      mimeType: 'image/jpeg', size: 1024000,
    }, cookie)
    if (r.ok) {
      try {
        await uploadDemoImage(r.data.fileId, 'image/jpeg')
        log(`  ✓ ${def.p.displayName}: ${def.modality} (image available)`)
      } catch (e: any) {
        log(`  ⚠ ${def.p.displayName} ${def.modality} upload skipped: ${String(e?.message).slice(0, 80)}`)
      }
    } else log(`  ⚠ ${def.p.displayName} imaging (${r.status}): ${JSON.stringify(r.data).slice(0, 100)}`)
  }

  // ── 8.5b CBCT volume (P2-7) — seed one cone-beam study so the volume card +
  // finalize + viewer-link routes are actually exercised (avoid the ceph
  // "untested because unseeded" gap). Routes through multipart + server-side
  // DICOM parse via the synthetic fixture; finalize flips is_volume=true.
  if (P[4]) {
    try {
      const { buildSyntheticDicom } = await import(
        '../services/api-ts/src/handlers/dental-imaging/repos/dicom-fixture'
      )
      const dicomBytes = buildSyntheticDicom()
      // 6 MB so it routes through the multipart envelope (DICOM > 5 MB threshold).
      const cbctR = await post('/dental/imaging/studies', {
        patientId: P[4].id, branchId: branch.id,
        modality: 'cbct', filename: 'mendoza-carlos-cbct-volume.dcm',
        mimeType: 'application/dicom', size: 6 * 1024 * 1024,
      }, cookie)
      if (cbctR.ok) {
        const imageId: string | undefined = cbctR.data.image?.id ?? cbctR.data.imageId
        // Write the DICOM bytes straight to the object store (same direct-PutObject
        // approach as uploadDemoImage; the presigned multipart parts aren't needed
        // for a local seed). The fileId IS the object key.
        await seedS3.write(cbctR.data.fileId, dicomBytes.buffer as ArrayBuffer, { type: 'application/dicom' })
        const finR = await post(`/dental/imaging/studies/${cbctR.data.study.id}/cbct/finalize`, {
          imageId,
          dicomBase64: Buffer.from(dicomBytes).toString('base64'),
        }, cookie)
        if (finR.ok) {
          log(`  ✓ ${P[4].displayName}: CBCT volume (is_volume=${finR.data.image?.isVolume}, frames=${finR.data.image?.frameCount})`)
        } else {
          log(`  ⚠ ${P[4].displayName} CBCT finalize (${finR.status}): ${JSON.stringify(finR.data).slice(0, 100)}`)
        }
      } else {
        log(`  ⚠ ${P[4].displayName} CBCT study (${cbctR.status}): ${JSON.stringify(cbctR.data).slice(0, 100)}`)
      }
    } catch (e: any) {
      log(`  ⚠ CBCT seed skipped: ${String(e?.message).slice(0, 100)}`)
    }
  }

  // 8.6 Longitudinal multi-visit patients: seeded in seed-supplement.ts (Section 4)

  // ── 8.7 Free-tier clinic (B01 ceph free-tier gate) ──────────────────────────
  // A SEPARATE org whose imagingTier is left at the default (NULL = 'free'), with a
  // patient + cephalometric image. Ceph analysis on this org's image must 403
  // (IMAGING_TIER_REQUIRED). The demo org is 'addon' (paid), so the free-tier gate
  // can ONLY be exercised against this dedicated free clinic. Fully self-contained:
  // its own account + org + member PIN — it never touches the demo org.
  section('8.7 Free-tier clinic (ceph gate)')
  try {
    const free = await signUpOrIn('free@dentalemon.com', 'FreeClinic1!', 'Dr. Ben Tan')
    await post('/persons', { firstName: 'Ben', lastName: 'Tan', gender: 'male', timezone: 'Asia/Manila' }, free.cookie)
    let fOrgId: string, fBranchId: string, fMemberId: string
    const fctx = await get('/dental/org/context', free.cookie)
    if (fctx.ok && fctx.data?.branch?.id) {
      fOrgId = fctx.data.org.id; fBranchId = fctx.data.branch.id; fMemberId = fctx.data.member.id
      log(`→ Existing free clinic: ${fctx.data.org.name}`)
    } else {
      const onb = must(await post('/dental/onboarding', {
        organizationName: 'Budget Dental Clinic', tier: 'solo', countryCode: 'PH',
        branchName: 'Free Branch', timezone: 'Asia/Manila', ownerDisplayName: 'Dr. Ben Tan',
      }, free.cookie), 'free-clinic onboarding')
      fOrgId = onb.organizationId; fBranchId = onb.branchId; fMemberId = onb.membershipId
      log('✓ Onboarded free clinic: Budget Dental Clinic')
    }
    await post(`/dental/organizations/${fOrgId}/branches/${fBranchId}/members/${fMemberId}/set-pin`, { pin: '111111' }, free.cookie)
    const fPatient = must(await post('/dental/patients', {
      displayName: 'Free Patient', dateOfBirth: '1990-01-01', gender: 'male',
      consentGiven: true, branchId: fBranchId,
    }, free.cookie), 'free patient')
    const fVisit = await activateVisit(fPatient.id, fBranchId, fMemberId, 0, 'Cephalometric consult', free.cookie)
    // Cephalometric study CREATE is itself addon-gated (createImagingStudy V-IMG-001),
    // so a free org can never normally hold a ceph image. Reproduce the realistic
    // DOWNGRADE scenario: a clinic that HAD the add-on (uploaded a ceph), then dropped
    // to free. Temporarily enable addon → create the ceph image → revert to free, so
    // the image exists but ceph ANALYSIS is gated to 403 (CIMG-001/002).
    await patch(`/dental/organizations/${fOrgId}`, { imagingTier: 'addon' }, free.cookie)
    const studyR = await post('/dental/imaging/studies', {
      patientId: fPatient.id, ...(fVisit ? { visitId: fVisit } : {}), branchId: fBranchId,
      modality: 'cephalometric', filename: 'free-ceph-lateral.jpg', mimeType: 'image/jpeg', size: 2048000,
    }, free.cookie)
    if (studyR.ok) {
      const imageId = studyR.data.image?.id ?? studyR.data.imageId
      if (studyR.data.fileId) await uploadDemoImage(studyR.data.fileId, 'image/jpeg').catch(() => {})
      // Downgrade back to free — image stays, ceph analysis now 403s.
      const downR = await patch(`/dental/organizations/${fOrgId}`, { imagingTier: 'free' }, free.cookie)
      log(downR.ok
        ? `  ✓ Free-tier ceph image (imageId ${String(imageId).slice(0, 8)}… — downgraded to free → analysis 403). Login free@dentalemon.com / FreeClinic1! · PIN 1 1 1 1 1 1`
        : `  ⚠ Free-tier downgrade failed (${downR.status}) — org may still be addon`)
    } else {
      log(`  ⚠ Free-tier ceph study (${studyR.status}): ${JSON.stringify(studyR.data).slice(0, 120)}`)
    }
  } catch (e: any) {
    log(`  ⚠ Free-tier clinic seed skipped: ${String(e?.message).slice(0, 140)}`)
  }

  // ── 9. Appointments ──────────────────────────────────────────────────────
  section('9. Appointments')

  // Map a free-text service description to the appointment visitType enum.
  const apptVisitType = (service: string): 'checkup' | 'treatment' | 'emergency' | 'recall' => {
    const s = service.toLowerCase()
    if (/emergency|acute|toothache|\bpain\b|urgent|walk.?in/.test(s)) return 'emergency'
    if (/recall|periodic|annual|maintenance|\breview\b|follow.?up|hygiene/.test(s)) return 'recall'
    if (/exam|checkup|check-up|cleaning|consult|screening/.test(s)) return 'checkup'
    return 'treatment'
  }

  const apptDefs: Array<{ pidx: number; at: string; dur: number; service: string; status?: string; reason?: string }> = [
    // Today
    { pidx: 0, at: atToday(9),    dur: 60,  service: 'Annual Checkup + X-rays' },
    { pidx: 1, at: atToday(10, 30), dur: 30, service: 'Follow-up: Dental Sensitivity' },
    { pidx: 8, at: atToday(14),   dur: 45,  service: 'Emergency: Acute Toothache' }, // → check-in
    // Tomorrow
    { pidx: 3, at: daysFromNow(1, 9),  dur: 45, service: 'Pediatric Cleaning' },
    { pidx: 4, at: daysFromNow(1, 11), dur: 60, service: 'Implant Consultation Follow-up' },
    // Future
    { pidx: 6, at: daysFromNow(7, 10), dur: 30, service: 'Orthodontic Adjustment #1' },
    // Past completed — P0
    { pidx: 0, at: daysAgo(30, 9), dur: 60, service: 'Periodic Exam + Cleaning', status: 'completed' },
    // Cancelled — P7
    { pidx: 7, at: daysFromNow(2, 13), dur: 30, service: 'Crown Check', status: 'cancelled', reason: 'Patient requested reschedule' },
    // No-show — P9
    { pidx: 9, at: daysAgo(10, 10), dur: 60, service: 'Perio Review', status: 'no_show' },
  ]

  const apptIds: Record<number, string[]> = {}
  for (const a of apptDefs) {
    const p = P[a.pidx]; if (!p) continue
    // CreateAppointmentRequestSchema: providerId/startAt/endAt/visitType (+ notes),
    // NOT the legacy dentistMemberId/scheduledAt/durationMinutes/serviceType.
    const endAt = new Date(new Date(a.at).getTime() + a.dur * 60_000).toISOString()
    const r = await post('/dental/appointments', {
      patientId: p.id, providerId: ownerMember.id, branchId: branch.id,
      startAt: a.at, endAt, visitType: apptVisitType(a.service), notes: a.service,
    }, cookie)
    if (!r.ok) { log(`⚠ Appt ${p.displayName} (${r.status})`); continue }
    const apptId = r.data.id
    if (!apptIds[a.pidx]) apptIds[a.pidx] = []
    apptIds[a.pidx].push(apptId)

    if (a.status === 'completed') {
      // Step through: scheduled → checked_in → completed (PATCH, not check-in endpoint)
      await patch(`/dental/appointments/${apptId}`, { status: 'checked_in' }, cookie)
      await patch(`/dental/appointments/${apptId}`, { status: 'completed' }, cookie)
      log(`  ✓ ${p.displayName} — ${a.service} (completed)`)
    } else if (a.status === 'cancelled') {
      await patch(`/dental/appointments/${apptId}`, { status: 'cancelled', cancellationReason: a.reason }, cookie)
      log(`  ✓ ${p.displayName} — ${a.service} (cancelled)`)
    } else if (a.status === 'no_show') {
      await patch(`/dental/appointments/${apptId}`, { status: 'no_show' }, cookie)
      log(`  ✓ ${p.displayName} — ${a.service} (no_show)`)
    } else {
      log(`  ✓ ${p.displayName} — ${a.service}`)
    }
  }

  // Check-in P8 (Diego Ramos — today's appointment, no active/draft visit)
  if (P[8] && apptIds[8]?.length) {
    const p8ApptId = apptIds[8][0]
    const ciR = await post(`/dental/appointments/${p8ApptId}/check-in`, {}, cookie)
    if (ciR.ok) log(`  ✓ Diego Ramos checked in — new draft visit auto-created`)
    else log(`  ⚠ Check-in (${ciR.status}): ${JSON.stringify(ciR.data).slice(0,150)}`)
  }

  // ── 10. Reviews (NPS) ────────────────────────────────────────────────────
  section('10. Reviews (NPS)')
  // Unique constraint: (context, reviewer, reviewType). Use distinct types for each review.
  const reviewDefs = [
    { p: P[0], npsScore: 10, reviewType: 'nps',          comment: 'Excellent care! Dr. Reyes is very gentle and thorough. Highly recommend.' },
    { p: P[7], npsScore: 7,  reviewType: 'service',       comment: 'Good clinic. Waiting time was a bit long but treatment was professional.' },
    { p: P[9], npsScore: 4,  reviewType: 'billing',       comment: 'Billing was confusing. Dentist was fine but admin process needs improvement.' },
  ]
  for (const rv of reviewDefs) {
    if (!rv.p) continue
    const r = await post('/reviews/', {
      context: org.id,
      reviewType: rv.reviewType,
      npsScore: rv.npsScore,
      comment: rv.comment,
    }, cookie)
    log(r.ok ? `  ✓ Review ${rv.npsScore}/10 (${rv.reviewType}) — ${rv.p.displayName}` : `  ⚠ Review (${r.status}): ${rv.p.displayName}`)
  }

  // ── Post-seed DB patches (status transitions not exposed via API) ─────────
  section('Post-seed patches')
  const DB_URL = process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase'
  const patchSQL = `
    UPDATE dental_invoice
    SET status = 'overdue'
    FROM patient p
    JOIN person pe ON pe.id = p.person_id
    WHERE dental_invoice.patient_id = p.id
      AND dental_invoice.status = 'issued'
      AND dental_invoice.due_date < NOW()
      AND pe.last_name = 'Cruz' AND pe.first_name = 'Sofia';
  `
  const r = Bun.spawnSync(['psql', DB_URL, '-c', patchSQL])
  if (r.exitCode === 0) log('✓ Sofia Cruz invoice → overdue')
  else log(`⚠ overdue patch failed: ${new TextDecoder().decode(r.stderr).trim()}`)

  // GAP-007: seed one pending sync-log row
  section('11. Sync log demo row (GAP-007)')
  if (P[0]?.id && branch?.id) {
    await seedSyncLog(cookie, branch.id, P[0].id)
  }

  // IDEAL Wave 5 — explicit audit log seed rows (P1-001 + P2-003/P2-004)
  section('12. Audit log seed rows (IDEAL Wave 5)')
  await seedAuditLogRows()

  // P2-005 — one visit with syncStatus='pending' for offline-first demo
  section('13. Offline visit demo row (P2-005)')
  await patchVisitForOfflineDemo()

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║           Comprehensive Seed Complete!               ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log('║  Login: demo@dentalemon.com / DemoClinic1!           ║')
  console.log('║  PIN:   Dr. Maria Reyes → 1 2 3 4 5 6               ║')
  console.log('║  App:   http://localhost:3003                        ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log('║  Coverage:                                           ║')
  console.log('║  • 20 patients, full clinical data                   ║')
  console.log('║  • Treatment Breakdown: visible on EVERY patient     ║')
  console.log('║  • Treatment Plan: P3/P4/P5 (planned/carried)        ║')
  console.log('║  • Carry-over: P3 (Elena) + P5 (Ana)                 ║')
  console.log('║  • Imaging: all 10 patients; P6 full ceph chain      ║')
  console.log('║  • Invoices: paid/partial/overdue/draft + plan       ║')
  console.log('║  • Appointments: today/tomorrow/past/cancel/no_show  ║')
  console.log('║  • Lab orders: Roberto (fitted), Miguel (in_fab)     ║')
  console.log('║  • Rx, consents (signed/unsigned), amendments        ║')
  console.log('║  • Medical history, recall, follow-up, NPS reviews   ║')
  console.log('║  • Guardian: Elena Garcia (P3) → Rosario Garcia      ║')
  console.log('║  • Sync log: demo pending row (GAP-007)               ║')
  console.log('║  • Longitudinal multi-visit: see seed-supplement.ts  ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')
}

// GAP-007: seed one dental_sync_log row with syncStatus='pending' for demo dashboards
async function seedSyncLog(cookie: string, branchId: string, entityId: string) {
  const r = await post('/dental/sync-logs', {
    localId: 'demo-offline-visit-001',
    entityType: 'dental_visit',
    entityId,
    branchId,
  }, cookie)
  if (r.ok) log('✓ Sync log: demo pending row (localId=demo-offline-visit-001)')
  else log(`⚠ Sync log (${r.status})`)
}

// IDEAL Wave 5 — P1-001: insert 5+ explicit audit log rows (covers role.changed which has no handler)
async function seedAuditLogRows() {
  const DB_URL = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase'
  const sql = new Bun.SQL(DB_URL)
  try {
    // API-created visits leave dental_visit.created_by NULL, so fall back to a
    // branch membership's person_id for a valid (non-null) audit actor — the
    // actor_id column is NOT NULL.
    const rows = await sql`
      SELECT v.id, v.branch_id,
             COALESCE(v.created_by, m.person_id) as actor_id,
             b.organization_id as tenant_id
      FROM dental_visit v
      JOIN dental_branch b ON b.id = v.branch_id
      LEFT JOIN dental_membership m ON m.branch_id = v.branch_id AND m.person_id IS NOT NULL
      WHERE v.status = 'completed'
      ORDER BY v.created_at
      LIMIT 1
    `
    if (!rows.length) { log('⚠ Audit seed: no completed visit found'); return }
    const { id: visitId, branch_id: branchId, actor_id: actorId, tenant_id: tenantId } = rows[0]
    if (!actorId) { log('⚠ Audit seed: no valid actor (created_by + membership.person_id both null)'); return }
    const events = [
      { action: 'visit.complete',      target_type: 'dental_visit',      target_id: visitId },
      { action: 'treatment.performed', target_type: 'dental_treatment',   target_id: visitId },
      { action: 'discount.applied',    target_type: 'dental_invoice',     target_id: visitId },
      { action: 'invoice.voided',      target_type: 'dental_invoice',     target_id: visitId },
      { action: 'role.changed',        target_type: 'dental_membership',  target_id: null    },
    ]
    for (const ev of events) {
      await sql`
        INSERT INTO dental_audit_log
          (id, tenant_id, branch_id, actor_id, action, target_type, target_id, created_by, updated_by)
        VALUES (gen_random_uuid(), ${tenantId}, ${branchId}, ${actorId}, ${ev.action}, ${ev.target_type}, ${ev.target_id}, ${actorId}, ${actorId})
      `
    }
    log(`✓ Audit log: 5 demo rows (visit.complete, treatment.performed, discount.applied, invoice.voided, role.changed)`)
  } finally {
    await sql.close()
  }
}

// IDEAL Wave 5 — P2-005: one visit with syncStatus='pending' + localId for offline-first demo
async function patchVisitForOfflineDemo() {
  const DB_URL = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase'
  const sql = new Bun.SQL(DB_URL)
  try {
    const result = await sql`
      UPDATE dental_visit
      SET local_id = 'demo-offline-001', sync_status = 'pending'
      WHERE id = (SELECT id FROM dental_visit ORDER BY created_at LIMIT 1)
    `
    if (result.count) log('✓ P2-005: visit patched — syncStatus=pending, localId=demo-offline-001')
    else log('⚠ P2-005: no visit found to patch')
  } finally {
    await sql.close()
  }
}

seed().catch(err => {
  console.error('\n✗ Seed failed:', err.message)
  process.exit(1)
})
