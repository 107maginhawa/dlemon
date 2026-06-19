import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui';

interface PatientStepProps {
  patientName: string;
  onPatientNameChange: (v: string) => void;
  birthDate: string;
  onBirthDateChange: (v: string) => void;
  gender: string;
  onGenderChange: (v: string) => void;
  patientPhone: string;
  onPatientPhoneChange: (v: string) => void;
}

export function PatientStep({
  patientName, onPatientNameChange,
  birthDate, onBirthDateChange,
  gender, onGenderChange,
  patientPhone, onPatientPhoneChange,
}: PatientStepProps) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Full Name *
        </label>
        <Input
          type="text"
          value={patientName}
          onChange={e => onPatientNameChange(e.target.value)}
          placeholder="Juan dela Cruz"
          aria-label="Full Name"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Date of Birth *
        </label>
        <Input
          type="date"
          value={birthDate}
          onChange={e => onBirthDateChange(e.target.value)}
          aria-label="Date of Birth"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Gender
        </label>
        <Select value={gender} onValueChange={onGenderChange}>
          <SelectTrigger
            aria-label="Gender"
            className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Phone
        </label>
        <Input
          type="text"
          value={patientPhone}
          onChange={e => onPatientPhoneChange(e.target.value)}
          aria-label="Patient Phone"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
      </div>
    </>
  );
}
