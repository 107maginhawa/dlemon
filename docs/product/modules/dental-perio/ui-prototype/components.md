# dental-perio — Components

All components TypeScript + Radix; styled with Tailwind tokens; lemon accent `#FFE97D`.

## PerioChartGrid

**Props**
```ts
interface PerioChartGridProps {
  readings: PerioToothReading[];        // server data
  arches?: 'both' | 'maxillary' | 'mandibular';  // default both
  readonly?: boolean;                   // true when chart status !== 'draft'
  onSelectTooth: (toothNumber: number) => void;
}
```

**Behavior**
- Renders 32 tooth cells in FDI order. Each cell shows abbreviated PD (largest of 6 sites) and BoP dot.
- Empty cell = no reading. Tap → `onSelectTooth(toothNumber)`.
- `readonly` disables tap + applies muted styling.

## ToothReadingPanel (drawer)

**Props**
```ts
interface ToothReadingPanelProps {
  chartId: string;
  toothNumber: number;
  existing?: PerioToothReading | null;
  onSaved: (reading: PerioToothReading) => void;
  onClose: () => void;
}
```

**Behavior**
- Radix Dialog drawer (right side, 480px).
- Renders 6 site inputs (BM, BC, BD, LM, LC, LD) — depth (0–20) + BoP toggle each.
- Extras: recession, mobility (0–3), furcation (0–3), plaque toggle, suppuration toggle, notes.
- Submit triggers PUT `/dental/perio-charts/{chartId}/readings/{toothNumber}` then `onSaved`.

## SummaryStats

**Props**
```ts
interface SummaryStatsProps {
  bopPercent: number | null;
  meanDepth: number | null;
  deepPocketCount: number | null;
  readingCount: number;
  expectedCount?: number;     // default 28 (adult dentition)
  onComplete?: () => void;    // visible while status === 'draft'
}
```

**Behavior**
- Three large stat tiles. `onComplete` CTA disabled until `readingCount >= 16`.

## PerioHistoryCard

**Props**
```ts
interface PerioHistoryCardProps {
  chart: PerioChartSummary;
  onOpen: () => void;
}
```

**Behavior**
- Compact card for list rows: date, dentist, BoP %, mean PD, deep pocket count, status pill.
- Lemon accent left border when latest.
