import React, { useState, useEffect } from 'react';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

interface LocaleOption {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  taxLabel: string;
  toothNotation: string;
  regulatoryNotes: string[];
}

const LOCALES: LocaleOption[] = [
  { code: 'PH', name: 'Philippines', currency: 'PHP', currencySymbol: '₱', taxRate: 0.12, taxLabel: 'VAT 12%', toothNotation: 'FDI', regulatoryNotes: ['RA 10173 — Data Privacy Act', 'RA 7277 — PWD Discount (20%)', 'RA 9994 — Senior Citizen Discount (20%)', '15-year record retention'] },
  { code: 'AU', name: 'Australia', currency: 'AUD', currencySymbol: 'A$', taxRate: 0.10, taxLabel: 'GST 10%', toothNotation: 'FDI', regulatoryNotes: ['Health Records Act', '7-year record retention'] },
  { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$', taxRate: 0, taxLabel: 'N/A (state-dependent)', toothNotation: 'Universal', regulatoryNotes: ['HIPAA', '7-year record retention'] },
];

export function LocaleSettings() {
  const [selectedCode, setSelectedCode] = useState('PH');
  const [notation, setNotation] = useState('FDI');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const branchId = typeof localStorage !== 'undefined' ? localStorage.getItem('currentBranchId') : null;

  useEffect(() => {
    if (!branchId) { setLoading(false); return; }
    fetch(`${API}/dental/branches/${branchId}/settings`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        const s = data?.settings ?? {};
        if (s.locale) {
          // locale stored as country code e.g. 'PH', 'AU', 'US'
          const match = LOCALES.find(l => l.code === s.locale || s.locale?.startsWith(l.code));
          if (match) {
            setSelectedCode(match.code);
            setNotation(s.toothNotation ?? match.toothNotation);
          }
        }
        if (s.toothNotation) setNotation(s.toothNotation);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [branchId]);

  async function handleSave() {
    if (!branchId) return;
    const locale = LOCALES.find(l => l.code === selectedCode) ?? LOCALES[0]!;

    await fetch(`${API}/dental/branches/${branchId}/settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: selectedCode,
        currency: locale.currency,
        toothNotation: notation,
      }),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const locale = LOCALES.find(l => l.code === selectedCode) ?? LOCALES[0]!;

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Locale settings saved</div>
      )}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Country / Region</label>
        <select value={selectedCode} onChange={e => { setSelectedCode(e.target.value); const l = LOCALES.find(x => x.code === e.target.value); if (l) setNotation(l.toothNotation); }}
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none">
          {LOCALES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Currency</p>
          <p className="text-lg font-semibold mt-1">{locale.currencySymbol} {locale.currency}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Tax</p>
          <p className="text-lg font-semibold mt-1">{locale.taxLabel}</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Tooth Notation System</label>
        <div className="flex gap-2">
          {(['FDI', 'Universal', 'Palmer'] as const).map(n => (
            <button key={n} type="button" onClick={() => setNotation(n)}
              className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${notation === n ? 'bg-[#FFE97D] text-[#4A4018]' : 'border border-border hover:bg-secondary'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Regulatory Notes</h4>
        <div className="rounded-xl border border-border divide-y">
          {locale.regulatoryNotes.map(note => (
            <div key={note} className="px-4 py-2.5 text-sm">{note}</div>
          ))}
        </div>
      </div>

      <button type="button" onClick={handleSave} className="h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors">
        Save Locale Settings
      </button>
    </div>
  );
}
