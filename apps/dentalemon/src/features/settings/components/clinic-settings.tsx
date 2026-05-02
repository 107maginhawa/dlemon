import React, { useState } from 'react';

const API = 'http://localhost:7213';

export function ClinicSettings() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function validate(): string[] {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Clinic name is required');
    if (!address.trim()) errs.push('Address is required');
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass = 'w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none';
  const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block';

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {errors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {errors.map(e => <p key={e}>{e}</p>)}
        </div>
      )}
      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Settings saved</div>
      )}
      <div><label className={labelClass}>Clinic Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Address *</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Phone</label><input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Logo URL</label><input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>License Number</label><input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className={inputClass} /></div>
      <button type="button" onClick={handleSave} className="h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors">
        Save Settings
      </button>
    </div>
  );
}
