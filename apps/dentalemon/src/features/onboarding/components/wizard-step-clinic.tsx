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
        <input
          type="text"
          value={clinicName}
          onChange={e => onClinicNameChange(e.target.value)}
          placeholder="e.g. Smile Dental Clinic"
          aria-label="Clinic Name"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Country *
        </label>
        <select
          value={countryCode}
          onChange={e => onCountryCodeChange(e.target.value)}
          aria-label="Country"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        >
          <option value="PH">Philippines</option>
          <option value="AU">Australia</option>
          <option value="US">United States</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Address
        </label>
        <input
          type="text"
          value={address}
          onChange={e => onAddressChange(e.target.value)}
          aria-label="Address"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Phone
        </label>
        <input
          type="text"
          value={clinicPhone}
          onChange={e => onClinicPhoneChange(e.target.value)}
          aria-label="Phone"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        />
      </div>
    </>
  );
}
