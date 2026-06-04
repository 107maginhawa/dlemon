import { Input } from '@monobase/ui';

interface DentistStepProps {
  dentistName: string;
  onDentistNameChange: (v: string) => void;
  licenseNumber: string;
  onLicenseNumberChange: (v: string) => void;
  specialization: string;
  onSpecializationChange: (v: string) => void;
  pin: string;
  onPinChange: (v: string) => void;
}

export function DentistStep({
  dentistName, onDentistNameChange,
  licenseNumber, onLicenseNumberChange,
  specialization, onSpecializationChange,
  pin, onPinChange,
}: DentistStepProps) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Full Name *
        </label>
        <Input
          type="text"
          value={dentistName}
          onChange={e => onDentistNameChange(e.target.value)}
          placeholder="Dr. Juan dela Cruz"
          aria-label="Full Name"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          License Number
        </label>
        <Input
          type="text"
          value={licenseNumber}
          onChange={e => onLicenseNumberChange(e.target.value)}
          placeholder="PRC License #"
          aria-label="License Number"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Specialization
        </label>
        <Input
          type="text"
          value={specialization}
          onChange={e => onSpecializationChange(e.target.value)}
          placeholder="e.g. General Dentistry"
          aria-label="Specialization"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
        />
      </div>
      {/* FR9.1: User-defined 6-digit PIN — never hardcoded */}
      <div>
        <label
          htmlFor="dentist-pin"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
        >
          Your 6-digit PIN *
        </label>
        <Input
          id="dentist-pin"
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={e => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          aria-label="6-digit PIN"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none tracking-widest"
        />
        <p className="text-xs text-muted-foreground mt-1">
          You'll use this PIN to sign in to the app
        </p>
      </div>
    </>
  );
}
