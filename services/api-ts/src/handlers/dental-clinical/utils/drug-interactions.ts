/**
 * Curated drug-drug interaction reference for dental prescribing.
 *
 * LIMITATION: This is a small, manually curated table of clinically relevant
 * interactions for the dental setting. It is NOT a comprehensive drug interaction
 * database. For full clinical use, integrate a certified drug interaction service
 * (e.g. First Databank, Multum, or DrugBank API). This table covers the most
 * common and highest-risk interactions a dental prescriber is likely to encounter.
 *
 * Matching: case-insensitive substring match on displayName from the patient's
 * active medication entries. This mirrors the existing allergy-check approach.
 *
 * Sources: ADA Drug Information Handbook for Dentistry; BNF Dental Formulary;
 * FDA drug label interaction summaries.
 */

export type InteractionSeverity = 'major' | 'moderate' | 'minor';

export interface DrugInteractionRule {
  /** Drug A — name or class token (case-insensitive substring) */
  drugA: string;
  /** Drug B — name or class token (case-insensitive substring) */
  drugB: string;
  severity: InteractionSeverity;
  description: string;
}

/**
 * Known interaction pairs. Each entry is bidirectional (A↔B).
 * When adding pairs: be conservative — only add interactions with strong
 * clinical evidence at dental-relevant doses.
 */
export const KNOWN_INTERACTIONS: DrugInteractionRule[] = [
  // ── Warfarin interactions (anticoagulant — common in dental patients) ──────
  {
    drugA: 'warfarin',
    drugB: 'aspirin',
    severity: 'major',
    description: 'Aspirin potentiates anticoagulant effect of Warfarin; increased bleeding risk.',
  },
  {
    drugA: 'warfarin',
    drugB: 'ibuprofen',
    severity: 'major',
    description: 'NSAIDs may potentiate Warfarin anticoagulation and increase GI bleeding risk.',
  },
  {
    drugA: 'warfarin',
    drugB: 'naproxen',
    severity: 'major',
    description: 'NSAIDs may potentiate Warfarin anticoagulation and increase GI bleeding risk.',
  },
  {
    drugA: 'warfarin',
    drugB: 'metronidazole',
    severity: 'major',
    description: 'Metronidazole inhibits Warfarin metabolism (CYP2C9); significantly raises INR.',
  },
  {
    drugA: 'warfarin',
    drugB: 'clarithromycin',
    severity: 'major',
    description: 'Clarithromycin inhibits Warfarin metabolism; may raise INR substantially.',
  },
  {
    drugA: 'warfarin',
    drugB: 'erythromycin',
    severity: 'moderate',
    description: 'Erythromycin may inhibit Warfarin metabolism; monitor INR closely.',
  },
  {
    drugA: 'warfarin',
    drugB: 'fluconazole',
    severity: 'major',
    description: 'Fluconazole strongly inhibits CYP2C9; can cause dangerous Warfarin elevation.',
  },
  // ── SSRIs + bleeding risk ───────────────────────────────────────────────────
  {
    drugA: 'ssri',
    drugB: 'aspirin',
    severity: 'moderate',
    description: 'SSRIs + aspirin increase risk of GI bleeding.',
  },
  {
    drugA: 'ssri',
    drugB: 'ibuprofen',
    severity: 'moderate',
    description: 'SSRIs + NSAIDs increase risk of GI bleeding.',
  },
  // Specific SSRI entries as substring-matchable names
  {
    drugA: 'fluoxetine',
    drugB: 'aspirin',
    severity: 'moderate',
    description: 'SSRIs + aspirin increase risk of GI bleeding.',
  },
  {
    drugA: 'sertraline',
    drugB: 'aspirin',
    severity: 'moderate',
    description: 'SSRIs + aspirin increase risk of GI bleeding.',
  },
  // ── Bisphosphonates (dental risk: BRONJ) ─────────────────────────────────
  {
    drugA: 'bisphosphonate',
    drugB: 'corticosteroid',
    severity: 'moderate',
    description: 'Bisphosphonates + corticosteroids: elevated risk of osteonecrosis of the jaw (ONJ).',
  },
  {
    drugA: 'alendronate',
    drugB: 'corticosteroid',
    severity: 'moderate',
    description: 'Bisphosphonates + corticosteroids: elevated risk of osteonecrosis of the jaw (ONJ).',
  },
  // ── Metronidazole interactions ─────────────────────────────────────────────
  {
    drugA: 'metronidazole',
    drugB: 'alcohol',
    severity: 'major',
    description: 'Metronidazole + alcohol causes disulfiram-like reaction (flushing, nausea, vomiting).',
  },
  {
    drugA: 'metronidazole',
    drugB: 'lithium',
    severity: 'moderate',
    description: 'Metronidazole may increase Lithium levels; risk of toxicity.',
  },
  // ── Macrolide antibiotics ─────────────────────────────────────────────────
  {
    drugA: 'clarithromycin',
    drugB: 'simvastatin',
    severity: 'major',
    description: 'Clarithromycin inhibits CYP3A4; can cause myopathy or rhabdomyolysis with statins.',
  },
  {
    drugA: 'clarithromycin',
    drugB: 'atorvastatin',
    severity: 'moderate',
    description: 'Clarithromycin inhibits CYP3A4; may increase statin levels.',
  },
  {
    drugA: 'erythromycin',
    drugB: 'simvastatin',
    severity: 'major',
    description: 'Erythromycin inhibits CYP3A4; can cause myopathy or rhabdomyolysis with statins.',
  },
  // ── Tramadol / opioid interactions ────────────────────────────────────────
  {
    drugA: 'tramadol',
    drugB: 'ssri',
    severity: 'major',
    description: 'Tramadol + SSRIs may cause serotonin syndrome.',
  },
  {
    drugA: 'tramadol',
    drugB: 'fluoxetine',
    severity: 'major',
    description: 'Tramadol + SSRIs may cause serotonin syndrome.',
  },
  {
    drugA: 'tramadol',
    drugB: 'sertraline',
    severity: 'major',
    description: 'Tramadol + SSRIs may cause serotonin syndrome.',
  },
  // ── Local anaesthetic (epinephrine) + beta-blockers ───────────────────────
  {
    drugA: 'epinephrine',
    drugB: 'beta-blocker',
    severity: 'moderate',
    description: 'Epinephrine in local anaesthetics + non-selective beta-blockers may cause hypertensive episode.',
  },
  {
    drugA: 'epinephrine',
    drugB: 'propranolol',
    severity: 'moderate',
    description: 'Propranolol + epinephrine may cause hypertensive crisis.',
  },
  // ── Corticosteroids ───────────────────────────────────────────────────────
  {
    drugA: 'dexamethasone',
    drugB: 'nsaid',
    severity: 'moderate',
    description: 'Corticosteroids + NSAIDs increase GI bleeding risk.',
  },
  {
    drugA: 'prednisolone',
    drugB: 'aspirin',
    severity: 'moderate',
    description: 'Corticosteroids + aspirin increase GI bleeding risk.',
  },
];

export interface DetectedInteraction {
  interactingDrug: string;
  severity: InteractionSeverity;
  description: string;
}

/**
 * Check the drug being prescribed against the patient's active medications for
 * known interactions.
 *
 * @param prescribedDrug - The drug name being prescribed
 * @param activeMedications - Display names of the patient's active medications
 * @returns Array of detected interactions (empty = no known interactions)
 */
export function checkDrugInteractions(
  prescribedDrug: string,
  activeMedications: string[],
): DetectedInteraction[] {
  const prescribed = prescribedDrug.toLowerCase();
  const detected: DetectedInteraction[] = [];

  for (const rule of KNOWN_INTERACTIONS) {
    const ruleA = rule.drugA.toLowerCase();
    const ruleB = rule.drugB.toLowerCase();

    // For each rule, the prescribed drug could be either drugA or drugB
    let matchedSide: 'a' | 'b' | null = null;
    if (prescribed.includes(ruleA) || ruleA.includes(prescribed)) {
      matchedSide = 'a'; // prescribed drug matches side A — check patient meds for side B
    } else if (prescribed.includes(ruleB) || ruleB.includes(prescribed)) {
      matchedSide = 'b'; // prescribed drug matches side B — check patient meds for side A
    }

    if (!matchedSide) continue;

    const interactsWith = matchedSide === 'a' ? ruleB : ruleA;

    const conflictingMed = activeMedications.find(med => {
      const medLower = med.toLowerCase();
      return medLower.includes(interactsWith) || interactsWith.includes(medLower);
    });

    if (conflictingMed) {
      // Avoid duplicates if multiple rules match the same interacting drug
      const alreadyDetected = detected.some(d =>
        d.interactingDrug.toLowerCase() === conflictingMed.toLowerCase()
      );
      if (!alreadyDetected) {
        detected.push({
          interactingDrug: conflictingMed,
          severity: rule.severity,
          description: rule.description,
        });
      }
    }
  }

  return detected;
}
