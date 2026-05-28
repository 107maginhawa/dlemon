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
        <input
          type="text"
          value={patientName}
          onChange={e => onPatientNameChange(e.target.value)}
          placeholder="Juan dela Cruz"
          aria-label="Full Name"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Date of Birth *
        </label>
        <input
          type="date"
          value={birthDate}
          onChange={e => onBirthDateChange(e.target.value)}
          aria-label="Date of Birth"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Gender
        </label>
        <select
          value={gender}
          onChange={e => onGenderChange(e.target.value)}
          aria-label="Gender"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
          Phone
        </label>
        <input
          type="text"
          value={patientPhone}
          onChange={e => onPatientPhoneChange(e.target.value)}
          aria-label="Patient Phone"
          className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
        />
      </div>
    </>
  );
}
