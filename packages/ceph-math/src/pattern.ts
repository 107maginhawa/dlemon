/**
 * Skeletal/dental pattern read-out derived from cephalometric measurements.
 *
 * This is an INFORMATIONAL summary (the universal orthodontic Class I/II/III + divergence
 * vocabulary), intended for the clinician's working view — NOT a diagnosis and NOT placed in
 * the frozen exported report (which stays conservative per D-H/D-O). The clinician confirms.
 */

export interface SkeletalPattern {
  /** Sagittal jaw relationship from ANB. */
  sagittal: string | null;
  /** Vertical growth pattern from SN-GoMe. */
  vertical: string | null;
  /** Upper-incisor inclination from U1-SN. */
  dental: string | null;
  /** True when at least one dimension could be classified. */
  hasAny: boolean;
}

type Measurements = Record<string, number | null | undefined>;

export function classifySkeletalPattern(measurements: Measurements): SkeletalPattern {
  const anb = measurements['anb'];
  const snGoMe = measurements['sn_gome'];
  const u1sn = measurements['u1_sn'];

  // Sagittal — ANB norm ~2±2: Class I ≈ 0–4, Class II >4, Class III <0.
  const sagittal =
    typeof anb === 'number' ? (anb > 4 ? 'Class II' : anb < 0 ? 'Class III' : 'Class I') : null;

  // Vertical — SN-GoMe norm ~32±5: hyper >38, hypo <26.
  const vertical =
    typeof snGoMe === 'number'
      ? snGoMe > 38
        ? 'Hyperdivergent'
        : snGoMe < 26
          ? 'Hypodivergent'
          : 'Normodivergent'
      : null;

  // Upper-incisor inclination — U1-SN norm ~103±5: proclined >107, retroclined <99.
  const dental =
    typeof u1sn === 'number'
      ? u1sn > 107
        ? 'Proclined upper incisors'
        : u1sn < 99
          ? 'Retroclined upper incisors'
          : 'Normal incisor inclination'
      : null;

  return {
    sagittal,
    vertical,
    dental,
    hasAny: sagittal != null || vertical != null || dental != null,
  };
}
