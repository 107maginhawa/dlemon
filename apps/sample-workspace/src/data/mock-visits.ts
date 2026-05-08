export type ConditionType = 'caries' | 'decayed' | 'crown' | 'extract' | 'filling' | 'fracture'

export interface ToothCondition {
  type: ConditionType
  surface?: string
}

export interface TreatmentNote {
  tooth: string          // e.g. '#18'
  toothNum: number       // 1-32
  surface: string        // 'M' | 'O' | 'B' | 'D' | 'L' etc.
  surfaceType: 'Multi' | 'Single'
  condition: string      // human-readable
  treatment: string      // treatment plan
  done: boolean
  total: number | null   // in PHP pesos
}

export interface Visit {
  id: string
  date: string           // display date
  isoDate: string        // for sorting
  conditions: Record<number, ConditionType>
  notes: TreatmentNote[]
}

export interface SurfaceCondition {
  toothNumber: number
  surfaces: string[]        // e.g. ['mesial', 'occlusal']
  condition: ConditionType
  treatment?: string
  cdtCode?: string
  notes?: string
  cost?: number
}

export const visits: Visit[] = [
  // ─────────────────────────────────────
  // Visit 1 — March 2025 — Initial Exam
  // ─────────────────────────────────────
  {
    id: 'v1',
    date: 'March 8, 2025',
    isoDate: '2025-03-08',
    conditions: {
      18: 'decayed',
      2:  'caries',
      30: 'caries',
    },
    notes: [
      { tooth: '#18', toothNum: 18, surface: 'MOD', surfaceType: 'Multi',  condition: 'Deep Caries',     treatment: 'Root Canal',    done: false, total: 5500  },
      { tooth: '#2',  toothNum: 2,  surface: 'O',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Filling',       done: false, total: 1500  },
      { tooth: '#30', toothNum: 30, surface: 'MO',  surfaceType: 'Multi',  condition: 'Caries',          treatment: 'Filling',       done: false, total: 1200  },
    ],
  },

  // ─────────────────────────────────────
  // Visit 2 — May 2025 — Root Canal + Filling
  // ─────────────────────────────────────
  {
    id: 'v2',
    date: 'May 14, 2025',
    isoDate: '2025-05-14',
    conditions: {
      18: 'decayed',
      2:  'filling',
      30: 'caries',
      6:  'caries',
    },
    notes: [
      { tooth: '#18', toothNum: 18, surface: 'MOD', surfaceType: 'Multi',  condition: 'Root Canal Tx',   treatment: 'RCT Cont.',     done: true,  total: 3000  },
      { tooth: '#2',  toothNum: 2,  surface: 'O',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Composite',     done: true,  total: 1500  },
      { tooth: '#6',  toothNum: 6,  surface: 'L',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Filling',       done: false, total: 1200  },
    ],
  },

  // ─────────────────────────────────────
  // Visit 3 — July 2025 — RCT Done, New Caries
  // ─────────────────────────────────────
  {
    id: 'v3',
    date: 'July 22, 2025',
    isoDate: '2025-07-22',
    conditions: {
      18: 'crown',
      2:  'filling',
      30: 'caries',
      6:  'filling',
      14: 'decayed',
    },
    notes: [
      { tooth: '#18', toothNum: 18, surface: 'MOD', surfaceType: 'Multi',  condition: 'Post-RCT',        treatment: 'Crown Prep',    done: true,  total: 8500  },
      { tooth: '#6',  toothNum: 6,  surface: 'L',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Composite',     done: true,  total: 1200  },
      { tooth: '#14', toothNum: 14, surface: 'OB',  surfaceType: 'Multi',  condition: 'Caries',          treatment: 'Root Canal',    done: false, total: 5500  },
    ],
  },

  // ─────────────────────────────────────
  // Visit 4 — September 2025 — Crown Delivery
  // ─────────────────────────────────────
  {
    id: 'v4',
    date: 'September 10, 2025',
    isoDate: '2025-09-10',
    conditions: {
      18: 'crown',
      2:  'filling',
      6:  'filling',
      14: 'decayed',
      30: 'filling',
      8:  'caries',
    },
    notes: [
      { tooth: '#18', toothNum: 18, surface: 'MOD', surfaceType: 'Multi',  condition: 'Crown Prep',      treatment: 'PFM Crown',     done: true,  total: null  },
      { tooth: '#14', toothNum: 14, surface: 'OB',  surfaceType: 'Multi',  condition: 'Root Canal Tx',   treatment: 'RCT Cont.',     done: true,  total: 3000  },
      { tooth: '#30', toothNum: 30, surface: 'MO',  surfaceType: 'Multi',  condition: 'Caries',          treatment: 'Amalgam',       done: true,  total: 1200  },
      { tooth: '#8',  toothNum: 8,  surface: 'L',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Filling',       done: false, total: 1200  },
    ],
  },

  // ─────────────────────────────────────
  // Visit 5 — November 2025 — More Work
  // ─────────────────────────────────────
  {
    id: 'v5',
    date: 'November 5, 2025',
    isoDate: '2025-11-05',
    conditions: {
      18: 'crown',
      14: 'crown',
      2:  'filling',
      6:  'filling',
      30: 'filling',
      8:  'filling',
      3:  'decayed',
    },
    notes: [
      { tooth: '#14', toothNum: 14, surface: 'OB',  surfaceType: 'Multi',  condition: 'Post-RCT',        treatment: 'Crown Prep',    done: true,  total: 8500  },
      { tooth: '#8',  toothNum: 8,  surface: 'L',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Composite',     done: true,  total: 1200  },
      { tooth: '#3',  toothNum: 3,  surface: 'MOD', surfaceType: 'Multi',  condition: 'Decayed',         treatment: 'Extraction',    done: false, total: 2500  },
    ],
  },

  // ─────────────────────────────────────
  // Visit 6 — January 2026 — Maintenance
  // ─────────────────────────────────────
  {
    id: 'v6',
    date: 'January 15, 2026',
    isoDate: '2026-01-15',
    conditions: {
      18: 'crown',
      14: 'crown',
      2:  'filling',
      6:  'filling',
      8:  'filling',
      30: 'filling',
      3:  'extract',
      19: 'decayed',
      20: 'caries',
    },
    notes: [
      { tooth: '#3',  toothNum: 3,  surface: 'MOD', surfaceType: 'Multi',  condition: 'Non-Restorable',  treatment: 'Extraction',    done: true,  total: 2500  },
      { tooth: '#19', toothNum: 19, surface: 'OBL', surfaceType: 'Multi',  condition: 'Decayed',         treatment: 'Filling',       done: false, total: 1500  },
      { tooth: '#20', toothNum: 20, surface: 'O',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Filling',       done: false, total: 1200  },
    ],
  },

  // ─────────────────────────────────────
  // Visit 7 — February 2026 — More Fillings
  // ─────────────────────────────────────
  {
    id: 'v7',
    date: 'February 20, 2026',
    isoDate: '2026-02-20',
    conditions: {
      18: 'crown',
      14: 'crown',
      2:  'filling',
      6:  'filling',
      8:  'filling',
      30: 'filling',
      3:  'extract',
      19: 'filling',
      20: 'filling',
      15: 'caries',
      28: 'decayed',
      1:  'caries',
    },
    notes: [
      { tooth: '#19', toothNum: 19, surface: 'OBL', surfaceType: 'Multi',  condition: 'Decayed',         treatment: 'Composite',     done: true,  total: 1500  },
      { tooth: '#20', toothNum: 20, surface: 'O',   surfaceType: 'Single', condition: 'Caries',          treatment: 'Composite',     done: true,  total: 1200  },
      { tooth: '#15', toothNum: 15, surface: 'OD',  surfaceType: 'Multi',  condition: 'Caries',          treatment: 'Filling',       done: false, total: 1200  },
      { tooth: '#28', toothNum: 28, surface: 'MOD', surfaceType: 'Multi',  condition: 'Decayed',         treatment: 'Root Canal',    done: false, total: 5500  },
    ],
  },

  // ─────────────────────────────────────
  // Visit 8 — March 2026 — Current Visit
  // ─────────────────────────────────────
  {
    id: 'v8',
    date: 'March 5, 2026',
    isoDate: '2026-03-05',
    conditions: {
      18: 'crown',
      14: 'crown',
      2:  'filling',
      6:  'filling',
      8:  'filling',
      30: 'filling',
      3:  'extract',
      19: 'filling',
      20: 'filling',
      15: 'filling',
      28: 'decayed',
      1:  'caries',
      9:  'caries',
      21: 'decayed',
    },
    notes: [
      { tooth: '#1',  toothNum: 1,  surface: 'M',   surfaceType: 'Single', condition: 'Fractured',       treatment: 'Cleaning',      done: false, total: 300   },
      { tooth: '#9',  toothNum: 9,  surface: 'MO',  surfaceType: 'Multi',  condition: 'Caries',          treatment: 'Composite',     done: false, total: 1500  },
      { tooth: '#21', toothNum: 21, surface: 'MOD', surfaceType: 'Multi',  condition: 'Decayed',         treatment: 'Crown',         done: false, total: 8500  },
      { tooth: '#28', toothNum: 28, surface: 'MOD', surfaceType: 'Multi',  condition: 'Root Canal Tx',   treatment: 'RCT + Crown',   done: false, total: 13000 },
    ],
  },
]
