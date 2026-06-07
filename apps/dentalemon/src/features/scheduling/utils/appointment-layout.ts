/**
 * appointment-layout — side-by-side column packing for overlapping appointments.
 *
 * The day/week grids position appointments vertically by start time + duration.
 * When two or more appointments overlap in time they must not stack on top of
 * each other; this computes, for each appointment, which horizontal column it
 * occupies and how many columns its overlap-cluster needs, so callers can split
 * the available width evenly.
 *
 * Algorithm (classic interval-graph packing, à la calendar UIs):
 *   1. sort by start, then end
 *   2. group transitively-overlapping appointments into clusters
 *   3. within a cluster, place each appointment in the first column whose last
 *      appointment has already ended (back-to-back is NOT an overlap)
 *   4. every appointment in a cluster shares that cluster's peak column count,
 *      so their rendered widths line up
 */

import type { Appointment } from '../components/appointment-card';

export interface AppointmentColumn {
  /** Zero-based column index within the overlap cluster. */
  col: number;
  /** Total columns the cluster needs (every member shares this). */
  cols: number;
}

interface Interval {
  id: string;
  start: number;
  end: number;
}

/**
 * Map each appointment id to its { col, cols } placement. Non-overlapping
 * appointments resolve to { col: 0, cols: 1 } (full width).
 */
export function computeAppointmentColumns(
  appointments: Appointment[],
): Map<string, AppointmentColumn> {
  const result = new Map<string, AppointmentColumn>();
  if (appointments.length === 0) return result;

  const items: Interval[] = appointments
    .map((a) => {
      const start = new Date(a.scheduledAt).getTime();
      const end = start + Math.max(a.durationMinutes, 1) * 60_000;
      return { id: a.id, start, end };
    })
    .sort((x, y) => x.start - y.start || x.end - y.end);

  let cluster: Interval[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    // columnEnds[k] = end time of the last appointment placed in column k.
    const columnEnds: number[] = [];
    const placed: { id: string; col: number }[] = [];
    for (const it of cluster) {
      // first column free at this appointment's start (its last appt has ended)
      let c = 0;
      while (c < columnEnds.length) {
        const end = columnEnds[c];
        if (end === undefined || end <= it.start) break;
        c++;
      }
      columnEnds[c] = it.end;
      placed.push({ id: it.id, col: c });
    }
    const cols = columnEnds.length;
    for (const p of placed) result.set(p.id, { col: p.col, cols });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const it of items) {
    // A new appointment that starts at/after every clustered appointment has
    // ended begins a fresh cluster (no overlap with any current member).
    if (cluster.length > 0 && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length > 0) flush();

  return result;
}
