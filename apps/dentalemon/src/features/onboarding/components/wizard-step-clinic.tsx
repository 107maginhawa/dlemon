import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui';

interface ClinicStepProps {
  clinicName: string;
  onClinicNameChange: (v: string) => void;
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  clinicPhone: string;
  onClinicPhoneChange: (v: string) => void;
}

export function ClinicStep({
  clinicName, onClinicNameChange,
  countryCode, onCountryCodeChange,
  address, onAddressChange,
  clinicPhone, onClinicPhoneChange,
}: ClinicStepProps) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Clinic Name *
        </label>
        <Input
          type="text"
          value={clinicName}
          onChange={e => onClinicNameChange(e.target.value)}
          placeholder="e.g. Smile Dental Clinic"
          aria-label="Clinic Name"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Country *
        </label>
        <Select value={countryCode} onValueChange={onCountryCodeChange}>
          <SelectTrigger
            aria-label="Country"
            className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PH">Philippines</SelectItem>
            <SelectItem value="AU">Australia</SelectItem>
            <SelectItem value="US">United States</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Address
        </label>
        <Input
          type="text"
          value={address}
          onChange={e => onAddressChange(e.target.value)}
          aria-label="Address"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Phone
        </label>
        <Input
          type="text"
          value={clinicPhone}
          onChange={e => onClinicPhoneChange(e.target.value)}
          aria-label="Phone"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
      </div>
    </>
  );
}
