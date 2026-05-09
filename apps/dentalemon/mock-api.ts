// Mock API Server for Dentalemon Dev Preview
// Run: bun mock-api.ts
// Port: 7213 (matches VITE_API_BASE_URL)

const PORT = 7213;
const DELAY_MS = 150;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin || "http://localhost:3003",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
});

// json() is called inside fetch() where `origin` is in scope via closure
let _origin = "http://localhost:3003";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(_origin), "Content-Type": "application/json" },
  });

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PATIENTS = [
  {
    id: "p1",
    displayName: "Maria Santos",
    person: { firstName: "Maria", lastName: "Santos", dateOfBirth: "1985-03-12", gender: "female", phone: "+639171234567", email: "maria.santos@email.ph" },
    visitCount: 2,
    lastVisit: "2026-04-28",
    nextAppointment: "2026-05-12T09:00:00",
    needsFollowUp: true,
    hasBalance: true,
    hasActivePaymentPlan: false,
    balanceCents: 350000,
    status: "active",
    latestChartTeeth: [
      { toothNumber: 16, state: "caries" },
      { toothNumber: 26, state: "filled" },
      { toothNumber: 36, state: "caries" },
    ],
  },
  {
    id: "p2",
    displayName: "Juan dela Cruz",
    person: { firstName: "Juan", lastName: "dela Cruz", dateOfBirth: "1978-07-22", gender: "male", phone: "+639209876543", email: "juan.delacruz@email.ph" },
    visitCount: 1,
    lastVisit: "2026-05-02",
    nextAppointment: null,
    needsFollowUp: false,
    hasBalance: true,
    hasActivePaymentPlan: true,
    balanceCents: 1200000,
    status: "active",
    latestChartTeeth: [
      { toothNumber: 14, state: "crown" },
      { toothNumber: 24, state: "missing" },
    ],
  },
  {
    id: "p3",
    displayName: "Ana Reyes",
    person: { firstName: "Ana", lastName: "Reyes", dateOfBirth: "1992-11-05", gender: "female", phone: "+639351112222", email: "ana.reyes@email.ph" },
    visitCount: 1,
    lastVisit: "2026-03-15",
    nextAppointment: null,
    needsFollowUp: false,
    hasBalance: false,
    hasActivePaymentPlan: false,
    balanceCents: 0,
    status: "archived",
    latestChartTeeth: [],
  },
];

const VISITS: Record<string, object[]> = {
  p1: [
    { id: "v1a", patientId: "p1", status: "active", chiefComplaint: "Toothache upper left molar", createdAt: "2026-04-28T08:30:00", activatedAt: "2026-04-28T09:00:00", completedAt: null, lockedAt: null },
    { id: "v1b", patientId: "p1", status: "completed", chiefComplaint: "Routine checkup and cleaning", createdAt: "2026-02-10T10:00:00", activatedAt: "2026-02-10T10:15:00", completedAt: "2026-02-10T11:00:00", lockedAt: "2026-02-10T11:05:00" },
  ],
  p2: [
    { id: "v2a", patientId: "p2", status: "completed", chiefComplaint: "Crown preparation #14", createdAt: "2026-05-02T14:00:00", activatedAt: "2026-05-02T14:10:00", completedAt: "2026-05-02T15:30:00", lockedAt: null },
  ],
  p3: [
    { id: "v3a", patientId: "p3", status: "locked", chiefComplaint: "Annual dental exam", createdAt: "2026-03-15T09:00:00", activatedAt: "2026-03-15T09:10:00", completedAt: "2026-03-15T09:45:00", lockedAt: "2026-03-15T09:50:00" },
  ],
};

const CHARTS: Record<string, object> = {
  v1a: {
    teeth: [
      { toothNumber: 16, state: "caries", surfaces: ["O", "M"], note: "Deep caries, needs RCT eval" },
      { toothNumber: 26, state: "filled", surfaces: ["O"], note: "Composite filling 2024" },
      { toothNumber: 36, state: "caries", surfaces: ["O", "D"], note: "Moderate caries" },
      { toothNumber: 11, state: "healthy", surfaces: [], note: null },
      { toothNumber: 21, state: "healthy", surfaces: [], note: null },
    ],
  },
  v1b: {
    teeth: [
      { toothNumber: 16, state: "healthy", surfaces: [], note: null },
      { toothNumber: 26, state: "healthy", surfaces: [], note: null },
      { toothNumber: 36, state: "healthy", surfaces: [], note: null },
      { toothNumber: 11, state: "healthy", surfaces: [], note: null },
      { toothNumber: 21, state: "healthy", surfaces: [], note: null },
    ],
  },
  v2a: {
    teeth: [
      { toothNumber: 14, state: "crown", surfaces: [], note: "Porcelain fused to metal crown prep" },
      { toothNumber: 24, state: "missing", surfaces: [], note: "Extracted 2023" },
      { toothNumber: 34, state: "healthy", surfaces: [], note: null },
      { toothNumber: 44, state: "healthy", surfaces: [], note: null },
      { toothNumber: 11, state: "healthy", surfaces: [], note: null },
    ],
  },
  v3a: {
    teeth: [
      { toothNumber: 11, state: "healthy", surfaces: [], note: null },
      { toothNumber: 21, state: "healthy", surfaces: [], note: null },
      { toothNumber: 31, state: "healthy", surfaces: [], note: null },
      { toothNumber: 41, state: "healthy", surfaces: [], note: null },
      { toothNumber: 16, state: "healthy", surfaces: [], note: null },
    ],
  },
};

const TREATMENTS: Record<string, object[]> = {
  v1a: [
    { id: "t1a1", visitId: "v1a", toothNumber: 16, surfaces: ["O", "M"], procedureCode: "D3310", procedureName: "Root Canal Therapy - Anterior", cdtCode: "D3310", description: "RCT upper left first molar", status: "planned", priceAmount: 8500, currency: "PHP", conditionCode: "K02.1", note: "Refer to endo if needed", createdAt: "2026-04-28T09:30:00" },
    { id: "t1a2", visitId: "v1a", toothNumber: 26, surfaces: ["O"], procedureCode: "D2391", procedureName: "Resin Composite - Posterior", cdtCode: "D2391", description: "Composite filling UL6 occlusal", status: "completed", priceAmount: 2500, currency: "PHP", conditionCode: null, note: null, createdAt: "2026-04-28T09:45:00" },
    { id: "t1a3", visitId: "v1a", toothNumber: 36, surfaces: ["O", "D"], procedureCode: "D2392", procedureName: "Resin Composite - 2 surfaces", cdtCode: "D2392", description: "Composite filling LL6 OD", status: "diagnosed", priceAmount: 3500, currency: "PHP", conditionCode: "K02.1", note: null, createdAt: "2026-04-28T10:00:00" },
  ],
  v1b: [
    { id: "t1b1", visitId: "v1b", toothNumber: null, surfaces: [], procedureCode: "D1110", procedureName: "Prophylaxis - Adult", cdtCode: "D1110", description: "Full mouth prophylaxis and scaling", status: "completed", priceAmount: 1500, currency: "PHP", conditionCode: null, note: null, createdAt: "2026-02-10T10:20:00" },
  ],
  v2a: [
    { id: "t2a1", visitId: "v2a", toothNumber: 14, surfaces: [], procedureCode: "D2710", procedureName: "Crown - Resin-Based Composite", cdtCode: "D2710", description: "PFM crown preparation UL4", status: "in_progress", priceAmount: 15000, currency: "PHP", conditionCode: null, note: "Impression taken, lab order sent", createdAt: "2026-05-02T14:20:00" },
    { id: "t2a2", visitId: "v2a", toothNumber: 24, surfaces: [], procedureCode: "D6010", procedureName: "Implant Placement", cdtCode: "D6010", description: "Implant consultation UL4 site", status: "planned", priceAmount: 50000, currency: "PHP", conditionCode: null, note: "Patient considering implant", createdAt: "2026-05-02T15:00:00" },
    { id: "t2a3", visitId: "v2a", toothNumber: null, surfaces: [], procedureCode: "D1110", procedureName: "Prophylaxis - Adult", cdtCode: "D1110", description: "Oral prophylaxis", status: "completed", priceAmount: 1500, currency: "PHP", conditionCode: null, note: null, createdAt: "2026-05-02T14:15:00" },
  ],
  v3a: [
    { id: "t3a1", visitId: "v3a", toothNumber: null, surfaces: [], procedureCode: "D0120", procedureName: "Periodic Oral Evaluation", cdtCode: "D0120", description: "Annual dental examination", status: "completed", priceAmount: 500, currency: "PHP", conditionCode: null, note: "All teeth healthy, no issues", createdAt: "2026-03-15T09:15:00" },
  ],
};

const APPOINTMENTS = [
  { id: "a1", patientId: "p1", patientName: "Maria Santos", dentistMemberId: "m1", dentistName: "Dr. Ricardo Dela Vega", branchId: "b1", date: "2026-05-07", startTime: "09:00", endTime: "10:00", type: "checkup", status: "scheduled", chiefComplaint: "Follow-up on #16 caries", createdAt: "2026-05-01T10:00:00" },
  { id: "a2", patientId: "p2", patientName: "Juan dela Cruz", dentistMemberId: "m1", dentistName: "Dr. Ricardo Dela Vega", branchId: "b1", date: "2026-05-07", startTime: "10:30", endTime: "12:00", type: "procedure", status: "checked_in", chiefComplaint: "Crown cementation #14", createdAt: "2026-05-02T16:00:00" },
  { id: "a3", patientId: "p3", patientName: "Ana Reyes", dentistMemberId: "m2", dentistName: "Dr. Liza Manalo", branchId: "b1", date: "2026-05-07", startTime: "13:00", endTime: "13:30", type: "consultation", status: "scheduled", chiefComplaint: "Teeth whitening inquiry", createdAt: "2026-05-05T09:00:00" },
  { id: "a4", patientId: "p1", patientName: "Maria Santos", dentistMemberId: "m2", dentistName: "Dr. Liza Manalo", branchId: "b1", date: "2026-05-07", startTime: "15:00", endTime: "16:00", type: "procedure", status: "scheduled", chiefComplaint: "Composite filling #36", createdAt: "2026-05-06T14:00:00" },
];

const INVOICES = [
  { id: "inv1", invoiceNumber: "INV-2026-001", patientId: "p1", patientName: "Maria Santos", visitId: "v1a", visitDate: "2026-04-28", dueDate: "2026-05-28", totalCents: 1450000, paidCents: 1100000, balanceCents: 350000, status: "partial", createdAt: "2026-04-28T11:00:00" },
  { id: "inv2", invoiceNumber: "INV-2026-002", patientId: "p1", patientName: "Maria Santos", visitId: "v1b", visitDate: "2026-02-10", dueDate: "2026-03-10", totalCents: 150000, paidCents: 150000, balanceCents: 0, status: "paid", createdAt: "2026-02-10T11:30:00" },
  { id: "inv3", invoiceNumber: "INV-2026-003", patientId: "p2", patientName: "Juan dela Cruz", visitId: "v2a", visitDate: "2026-05-02", dueDate: "2026-06-02", totalCents: 1650000, paidCents: 450000, balanceCents: 1200000, status: "partial", createdAt: "2026-05-02T16:00:00" },
  { id: "inv4", invoiceNumber: "INV-2026-004", patientId: "p3", patientName: "Ana Reyes", visitId: "v3a", visitDate: "2026-03-15", dueDate: "2026-03-15", totalCents: 50000, paidCents: 50000, balanceCents: 0, status: "paid", createdAt: "2026-03-15T10:00:00" },
];

const INVOICE_DETAILS: Record<string, object> = {
  inv1: {
    id: "inv1", invoiceNumber: "INV-2026-001", patientId: "p1", patientName: "Maria Santos",
    visitId: "v1a", visitDate: "2026-04-28", status: "partial",
    subtotalCents: 1450000, discountCents: 0, totalCents: 1450000, paidCents: 1100000, balanceCents: 350000,
    createdAt: "2026-04-28T11:00:00",
    lineItems: [
      { id: "li1", description: "RCT upper left first molar (D3310)", quantity: 1, unitPriceCents: 850000, totalCents: 850000, cdtCode: "D3310", toothNumber: 16 },
      { id: "li2", description: "Composite filling UL6 occlusal (D2391)", quantity: 1, unitPriceCents: 250000, totalCents: 250000, cdtCode: "D2391", toothNumber: 26 },
      { id: "li3", description: "Composite filling LL6 OD (D2392)", quantity: 1, unitPriceCents: 350000, totalCents: 350000, cdtCode: "D2392", toothNumber: 36 },
    ],
    payments: [
      { id: "pay1", amountCents: 1100000, method: "cash", receiptNumber: "OR-2026-0428", recordedAt: "2026-04-28T11:30:00" },
    ],
  },
  inv2: {
    id: "inv2", invoiceNumber: "INV-2026-002", patientId: "p1", patientName: "Maria Santos",
    visitId: "v1b", visitDate: "2026-02-10", status: "paid",
    subtotalCents: 150000, discountCents: 0, totalCents: 150000, paidCents: 150000, balanceCents: 0,
    createdAt: "2026-02-10T11:30:00",
    lineItems: [
      { id: "li4", description: "Full mouth prophylaxis and scaling (D1110)", quantity: 1, unitPriceCents: 150000, totalCents: 150000, cdtCode: "D1110", toothNumber: null },
    ],
    payments: [
      { id: "pay2", amountCents: 150000, method: "gcash", receiptNumber: "OR-2026-0210", recordedAt: "2026-02-10T12:00:00" },
    ],
  },
  inv3: {
    id: "inv3", invoiceNumber: "INV-2026-003", patientId: "p2", patientName: "Juan dela Cruz",
    visitId: "v2a", visitDate: "2026-05-02", status: "partial",
    subtotalCents: 1650000, discountCents: 0, totalCents: 1650000, paidCents: 450000, balanceCents: 1200000,
    createdAt: "2026-05-02T16:00:00",
    lineItems: [
      { id: "li5", description: "PFM Crown preparation UL4 (D2710)", quantity: 1, unitPriceCents: 1500000, totalCents: 1500000, cdtCode: "D2710", toothNumber: 14 },
      { id: "li6", description: "Oral prophylaxis (D1110)", quantity: 1, unitPriceCents: 150000, totalCents: 150000, cdtCode: "D1110", toothNumber: null },
    ],
    payments: [
      { id: "pay3", amountCents: 450000, method: "bank_transfer", receiptNumber: "OR-2026-0502", recordedAt: "2026-05-02T17:00:00" },
    ],
  },
  inv4: {
    id: "inv4", invoiceNumber: "INV-2026-004", patientId: "p3", patientName: "Ana Reyes",
    visitId: "v3a", visitDate: "2026-03-15", status: "paid",
    subtotalCents: 50000, discountCents: 0, totalCents: 50000, paidCents: 50000, balanceCents: 0,
    createdAt: "2026-03-15T10:00:00",
    lineItems: [
      { id: "li7", description: "Annual dental examination (D0120)", quantity: 1, unitPriceCents: 50000, totalCents: 50000, cdtCode: "D0120", toothNumber: null },
    ],
    payments: [
      { id: "pay4", amountCents: 50000, method: "cash", receiptNumber: "OR-2026-0315", recordedAt: "2026-03-15T10:30:00" },
    ],
  },
};

// visitId → patientId lookup
const VISIT_PATIENT: Record<string, string> = {
  v1a: "p1", v1b: "p1", v2a: "p2", v3a: "p3",
};

// ─── Router ───────────────────────────────────────────────────────────────────

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    _origin = req.headers.get("origin") || "http://localhost:3003";

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    await delay(DELAY_MS);

    // GET /dental/patients
    if (method === "GET" && path === "/dental/patients") {
      const q = url.searchParams.get("q")?.toLowerCase() ?? "";
      const status = url.searchParams.get("status") ?? "";
      let patients = PATIENTS;
      if (q) patients = patients.filter((p) => p.displayName.toLowerCase().includes(q));
      if (status) patients = patients.filter((p) => p.status === status);
      return json(patients);
    }

    // GET /dental/patients/:id
    const patientMatch = path.match(/^\/dental\/patients\/([^/]+)$/);
    if (method === "GET" && patientMatch) {
      const p = PATIENTS.find((x) => x.id === patientMatch[1]);
      if (!p) return json({ error: "not found" }, 404);
      return json(p);
    }

    // GET /dental/patients/:id/treatment-plan
    const tplanMatch = path.match(/^\/dental\/patients\/([^/]+)\/treatment-plan$/);
    if (method === "GET" && tplanMatch) {
      const pid = tplanMatch[1];
      const allVisits = VISITS[pid] ?? [];
      const allTreatments = allVisits.flatMap((v: any) => TREATMENTS[v.id] ?? []);
      const planned = (allTreatments as any[]).filter((t) => t.status === "planned" || t.status === "diagnosed");
      const byTooth: Record<string, object[]> = {};
      for (const t of planned as any[]) {
        const key = String(t.toothNumber ?? "general");
        if (!byTooth[key]) byTooth[key] = [];
        byTooth[key].push({ id: t.id, toothNumber: t.toothNumber, cdtCode: t.cdtCode, description: t.description, surfaces: t.surfaces, priceCents: t.priceAmount * 100, status: t.status, conditionCode: t.conditionCode, visitId: t.visitId, carriedOver: false });
      }
      return json({ patientId: pid, totalEstimateCents: planned.reduce((s: number, t: any) => s + t.priceAmount * 100, 0), treatmentCount: planned.length, toothCount: Object.keys(byTooth).length, byTooth, treatments: planned });
    }

    // GET /dental/visits
    if (method === "GET" && path === "/dental/visits") {
      const pid = url.searchParams.get("patientId");
      if (pid) return json(VISITS[pid] ?? []);
      return json(Object.values(VISITS).flat());
    }

    // POST /dental/visits
    if (method === "POST" && path === "/dental/visits") {
      const body = await req.json().catch(() => ({}));
      const newVisit = { id: `v_${Date.now()}`, ...body, status: "draft", createdAt: new Date().toISOString(), activatedAt: null, completedAt: null, lockedAt: null };
      return json(newVisit, 201);
    }

    // GET /dental/visits/:id/chart
    const chartGetMatch = path.match(/^\/dental\/visits\/([^/]+)\/chart$/);
    if (method === "GET" && chartGetMatch) {
      const chart = CHARTS[chartGetMatch[1]];
      if (!chart) return json({ teeth: [] });
      return json(chart);
    }

    // POST /dental/visits/:id/chart
    const chartPostMatch = path.match(/^\/dental\/visits\/([^/]+)\/chart$/);
    if (method === "POST" && chartPostMatch) {
      return json({ ok: true });
    }

    // GET /dental/visits/:id/treatments
    const txGetMatch = path.match(/^\/dental\/visits\/([^/]+)\/treatments$/);
    if (method === "GET" && txGetMatch) {
      return json(TREATMENTS[txGetMatch[1]] ?? []);
    }

    // POST /dental/visits/:id/treatments
    const txPostMatch = path.match(/^\/dental\/visits\/([^/]+)\/treatments$/);
    if (method === "POST" && txPostMatch) {
      return json({ ok: true }, 201);
    }

    // GET /dental/appointments
    if (method === "GET" && path === "/dental/appointments") {
      const date = url.searchParams.get("date") ?? url.searchParams.get("weekStart");
      const branchId = url.searchParams.get("branchId");
      let appts = APPOINTMENTS;
      if (date) appts = appts.filter((a) => a.date === date || a.date.startsWith(date));
      if (branchId) appts = appts.filter((a) => a.branchId === branchId);
      return json(appts);
    }

    // GET /dental/dashboard/summary
    if (method === "GET" && path === "/dental/dashboard/summary") {
      return json({ activePaymentPlans: { count: 2 }, labOrders: { totalPending: 1 } });
    }

    // GET /dental/billing/invoices
    if (method === "GET" && path === "/dental/billing/invoices") {
      const pid = url.searchParams.get("patientId");
      const status = url.searchParams.get("status");
      const branchId = url.searchParams.get("branchId");
      let invs = INVOICES;
      if (pid) invs = invs.filter((i) => i.patientId === pid);
      if (status) invs = invs.filter((i) => i.status === status);
      return json(invs);
    }

    // GET /dental/billing/invoices/:id
    const invDetailMatch = path.match(/^\/dental\/billing\/invoices\/([^/]+)$/);
    if (method === "GET" && invDetailMatch) {
      const detail = INVOICE_DETAILS[invDetailMatch[1]];
      if (!detail) return json({ error: "not found" }, 404);
      return json(detail);
    }

    // POST /dental/billing/invoices (create)
    if (method === "POST" && path === "/dental/billing/invoices") {
      const body = await req.json().catch(() => ({}));
      return json({ id: `inv_${Date.now()}`, invoiceNumber: `INV-MOCK-${Date.now()}`, ...body, status: "draft", totalCents: 0, paidCents: 0, balanceCents: 0, createdAt: new Date().toISOString() }, 201);
    }

    // POST invoice actions (issue, void, payments, plan) — return ok
    if (method === "POST" && /^\/dental\/billing\/invoices\/[^/]+(\/issue|\/void|\/payments|\/plan)$/.test(path)) {
      return json({ ok: true }, 201);
    }

    // Better-Auth session endpoints — return no session so app treats user as guest
    if (path === "/auth/get-session" || path === "/api/auth/get-session") {
      return json(null);
    }
    if (path.startsWith("/auth/") || path.startsWith("/api/auth/")) {
      return json({ error: "auth not mocked" }, 401);
    }

    // Catch-all 501
    console.error(`[mock-api] 501 not mocked: ${method} ${path}`);
    return json({ error: "not mocked", path, method }, 501);
  },
});

console.log(`Mock API listening on http://localhost:${PORT}`);
