import React, { useState, useEffect } from 'react';
import { useBranchSettings, useUpdateBranchSettings } from '../hooks/use-branch-settings';
import { useOrgContextStore } from '@/stores/org-context.store';

export function ClinicSettings() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { settings, isLoading, isError } = useBranchSettings(branchId);
  const { update, isPending, error: saveError, isSuccess, reset } = useUpdateBranchSettings(branchId);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Populate form when settings load
  useEffect(() => {
    if (!settings) return;
    setName(settings.clinicName ?? '');
    setAddress(settings.clinicAddress ?? '');
    setPhone(settings.clinicPhone ?? '');
    setEmail(settings.clinicEmail ?? '');
    setLogoUrl(settings.logoUrl ?? '');
    setLicenseNumber(settings.dentistLicenseNumber ?? '');
  }, [settings]);

  function validate(): string[] {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Clinic name is required');
    if (!address.trim()) errs.push('Address is required');
    if (phone.trim() && !/^[\d+\-() ]{7,}$/.test(phone.trim())) errs.push('Invalid phone format');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.push('Invalid email format');
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (errs.length > 0) { setValidationErrors(errs); return; }
    setValidationErrors([]);
    reset();

    if (!branchId) { setValidationErrors(['No branch selected']); return; }

    try {
      await update({
        clinicName: name.trim(),
        clinicAddress: address.trim(),
        clinicPhone: phone.trim() || undefined,
        clinicEmail: email.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        dentistLicenseNumber: licenseNumber.trim() || undefined,
      });
    } catch {
      // error is exposed via saveError
    }
  }

  const inputClass = 'w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none';
  const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block';

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load clinic settings. Please try again.</div>;

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {validationErrors.map(e => <p key={e}>{e}</p>)}
        </div>
      )}
      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Settings saved</div>
      )}
      <div><label className={labelClass}>Clinic Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Address *</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Phone</label><input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>Logo URL</label><input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>License Number</label><input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className={inputClass} /></div>
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}
