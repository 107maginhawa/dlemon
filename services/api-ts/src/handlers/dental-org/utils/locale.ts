export interface LocaleConfig {
  countryCode: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  taxLabel: string;
  retentionYears: number;
  regulatoryNotes: string[];
  toothNotationDefault: 'FDI' | 'Universal' | 'Palmer';
}

export interface DiscountRule {
  name: string;
  rate: number;
  regulation: string;
}

const LOCALE_CONFIGS: Record<string, LocaleConfig> = {
  PH: {
    countryCode: 'PH', currency: 'PHP', currencySymbol: '₱',
    taxRate: 0.12, taxLabel: 'VAT 12%', retentionYears: 15,
    regulatoryNotes: ['RA 10173 — Data Privacy Act', 'RA 7277 — PWD Discount', 'RA 9994 — Senior Discount'],
    toothNotationDefault: 'FDI',
  },
  AU: {
    countryCode: 'AU', currency: 'AUD', currencySymbol: 'A$',
    taxRate: 0.10, taxLabel: 'GST 10%', retentionYears: 7,
    regulatoryNotes: ['Health Records Act'],
    toothNotationDefault: 'FDI',
  },
  US: {
    countryCode: 'US', currency: 'USD', currencySymbol: '$',
    taxRate: 0, taxLabel: 'N/A', retentionYears: 7,
    regulatoryNotes: ['HIPAA'],
    toothNotationDefault: 'Universal',
  },
};

const DEFAULT_LOCALE: LocaleConfig = {
  countryCode: 'XX', currency: 'USD', currencySymbol: '$',
  taxRate: 0, taxLabel: 'N/A', retentionYears: 7,
  regulatoryNotes: [], toothNotationDefault: 'FDI',
};

const PH_DISCOUNTS: DiscountRule[] = [
  { name: 'PWD Discount', rate: 20, regulation: 'RA 7277' },
  { name: 'Senior Citizen Discount', rate: 20, regulation: 'RA 9994' },
];

export function getLocaleConfig(countryCode: string): LocaleConfig {
  return LOCALE_CONFIGS[countryCode] ?? DEFAULT_LOCALE;
}

export function validatePRCLicense(license: string): boolean {
  return /^\d{7}$/.test(license);
}

export function getApplicableDiscounts(countryCode: string, patientTags: string[]): DiscountRule[] {
  if (countryCode !== 'PH') return [];
  return PH_DISCOUNTS.filter(d => {
    if (d.name === 'PWD Discount') return patientTags.includes('pwd');
    if (d.name === 'Senior Citizen Discount') return patientTags.includes('senior');
    return false;
  });
}

export function formatAmount(cents: number, countryCode: string): string {
  const config = getLocaleConfig(countryCode);
  return `${config.currencySymbol}${(cents / 100).toFixed(2)}`;
}
