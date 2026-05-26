/**
 * Critical-path performance scenarios for the perf ratchet.
 *
 * Each scenario is an autocannon-style request descriptor. The runner picks
 * the base URL from `API_URL` (default http://localhost:7213) and substitutes
 * `:id` segments with `PERF_PATIENT_ID` / `PERF_VISIT_ID` / `PERF_CHART_ID`
 * env vars when present.
 */

export interface PerfScenario {
  /** Key used in baseline.json — must remain stable across runs. */
  key: string;
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Path relative to API_URL (no host). */
  path: string;
  /** Optional JSON body for write paths. */
  body?: unknown;
}

export const scenarios: PerfScenario[] = [
  {
    key: 'GET /dental/patients',
    method: 'GET',
    path: '/dental/patients',
  },
  {
    key: 'GET /dental/patients/:id',
    method: 'GET',
    path: '/dental/patients/:id',
  },
  {
    key: 'POST /dental/visits',
    method: 'POST',
    path: '/dental/visits',
    body: {
      patientId: ':patientId',
      visitType: 'consultation',
    },
  },
  {
    key: 'GET /dental/visits/:id',
    method: 'GET',
    path: '/dental/visits/:id',
  },
  {
    key: 'GET /dental/perio-charts/:id',
    method: 'GET',
    path: '/dental/perio-charts/:id',
  },
];
