import { Input } from '@monobase/ui';

export interface FeeEntry { cdtCode: string; description: string; priceCents: number; }

export const DEFAULT_FEES: FeeEntry[] = [
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 0 },
  { cdtCode: 'D0274', description: 'Bitewings (4 films)', priceCents: 0 },
  { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 0 },
  { cdtCode: 'D2391', description: 'Composite (1 surface)', priceCents: 0 },
  { cdtCode: 'D2710', description: 'Crown (porcelain)', priceCents: 0 },
  { cdtCode: 'D7140', description: 'Simple Extraction', priceCents: 0 },
];

interface FeesStepProps {
  fees: FeeEntry[];
  onFeesChange: (fees: FeeEntry[]) => void;
}

export function FeesStep({ fees, onFeesChange }: FeesStepProps) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
            <th className="px-4 py-2">CDT Code</th>
            <th className="px-4 py-2">Procedure</th>
            <th className="px-4 py-2 text-right">Price (₱)</th>
          </tr>
        </thead>
        <tbody>
          {fees.map((fee, i) => (
            <tr key={fee.cdtCode} className="border-b last:border-0">
              <td className="px-4 py-2 font-mono text-xs">{fee.cdtCode}</td>
              <td className="px-4 py-2">{fee.description}</td>
              <td className="px-4 py-2 text-right">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fee.priceCents / 100 || ''}
                  onChange={e => {
                    const updated = [...fees];
                    updated[i] = { ...fee, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) };
                    onFeesChange(updated);
                  }}
                  className="w-24 h-8 rounded-lg border border-border px-2 text-sm text-right bg-background focus:border-lemon outline-none"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
