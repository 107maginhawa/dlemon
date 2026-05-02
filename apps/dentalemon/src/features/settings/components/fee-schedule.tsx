import React, { useState } from 'react';

interface FeeEntry {
  cdtCode: string;
  description: string;
  priceCents: number;
}

const DEFAULT_FEES: FeeEntry[] = [
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 0 },
  { cdtCode: 'D0274', description: 'Bitewings (4 films)', priceCents: 0 },
  { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 0 },
  { cdtCode: 'D2391', description: 'Composite (1 surface)', priceCents: 0 },
  { cdtCode: 'D2710', description: 'Crown (porcelain)', priceCents: 0 },
  { cdtCode: 'D7140', description: 'Simple Extraction', priceCents: 0 },
  { cdtCode: 'D7210', description: 'Surgical Extraction', priceCents: 0 },
];

export function FeeSchedule() {
  const [fees, setFees] = useState<FeeEntry[]>(DEFAULT_FEES);
  const [saved, setSaved] = useState(false);

  function updateFee(index: number, priceCents: number) {
    const updated = [...fees];
    const existing = updated[index];
    if (existing) updated[index] = { ...existing, priceCents };
    setFees(updated);
  }

  function addRow() {
    setFees([...fees, { cdtCode: '', description: '', priceCents: 0 }]);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Fee schedule saved</div>
      )}
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
              <tr key={`${fee.cdtCode}-${i}`} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {fee.cdtCode ? (
                    <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{fee.cdtCode}</span>
                  ) : (
                    <input type="text" placeholder="D0000" value={fee.cdtCode}
                      onChange={e => { const u = [...fees]; u[i] = { ...fee, cdtCode: e.target.value }; setFees(u); }}
                      className="w-20 h-8 rounded-lg border border-border px-2 text-sm font-mono bg-background focus:border-[#FFE97D] outline-none" />
                  )}
                </td>
                <td className="px-4 py-2">
                  {fee.description || (
                    <input type="text" placeholder="Description" value={fee.description}
                      onChange={e => { const u = [...fees]; u[i] = { ...fee, description: e.target.value }; setFees(u); }}
                      className="w-full h-8 rounded-lg border border-border px-2 text-sm bg-background focus:border-[#FFE97D] outline-none" />
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" min="0" step="0.01" value={fee.priceCents / 100 || ''}
                    onChange={e => updateFee(i, Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-24 h-8 rounded-lg border border-border px-2 text-sm text-right bg-background focus:border-[#FFE97D] outline-none" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="h-9 px-4 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
          + Add Row
        </button>
        <button type="button" onClick={handleSave} className="h-9 px-6 rounded-lg bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors">
          Save
        </button>
      </div>
    </div>
  );
}
