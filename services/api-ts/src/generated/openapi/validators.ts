import { z } from 'zod';
import ISO6391 from 'iso-639-1';
import countries from 'i18n-iso-countries';
import { getTimeZones } from '@vvo/tzdb';
import { isValidPhoneNumber } from 'libphonenumber-js';

// Generated Zod validators from OpenAPI spec

// Healthcare validation helpers
const validateNPI = (npi: string): boolean => {
  // NPI validation algorithm (Luhn algorithm)
  const digits = npi.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = digits[i];
    if (digit === undefined) return false; // Type guard for undefined
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const lastDigit = digits[9];
  if (lastDigit === undefined) return false; // Type guard for undefined
  return (10 - (sum % 10)) % 10 === lastDigit;
};

const containsPHI = (value: string): boolean => {
  // Basic PHI detection patterns
  const phiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
    /\b[A-Z]{2}\d{6}[A-Z]\b/, // Medical record patterns
  ];
  return phiPatterns.some(pattern => pattern.test(value));
};

// International data validation helpers
const validateLanguageCode = (code: string): boolean => {
  return ISO6391.validate(code);
};

const validateCountryCode = (code: string): boolean => {
  return countries.isValid(code);
};

const validatePhoneNumber = (phone: string): boolean => {
  try {
    // libphonenumber-js validates E.164 format and country-specific rules
    return isValidPhoneNumber(phone);
  } catch {
    return false;
  }
};

const timezoneNames = getTimeZones().map(tz => tz.name);
const validateTimezone = (tz: string): boolean => {
  return timezoneNames.includes(tz);
};

export const UUIDSchema = z.string().uuid();

export const AcceptTreatmentPlanRequestSchema = z.object({
  consentFormId: UUIDSchema.optional()
});

export const AddressSchema = z.object({
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
}).optional()
});

export const AddressPatchInputSchema = z.object({
  street1: z.string().min(1).max(100).optional(),
  street2: z.union([z.string().max(100), z.null()]).optional(),
  city: z.string().min(1).max(50).optional(),
  state: z.string().min(1).max(50).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }).optional(),
  coordinates: z.union([z.object({
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().gte(0).optional()
}), z.null()]).optional()
});

export const AmendmentSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  authorMemberId: UUIDSchema,
  originalRecordType: z.string(),
  originalRecordId: UUIDSchema,
  reason: z.string(),
  content: z.string()
});

export const ApplyDentalDiscountRequestSchema = z.object({
  reason: z.string(),
  percentageRate: z.number()
});

export const ToothSurfaceCodeSchema = z.enum(["mesial", "distal", "buccal", "lingual", "occlusal", "incisal", "cervical"]);

export const DentalTreatmentStatusSchema = z.enum(["diagnosed", "planned", "performed", "verified", "dismissed", "declined"]);

export const DentalTreatmentSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  toothNumber: z.number().int().optional(),
  surfaces: z.array(ToothSurfaceCodeSchema).optional(),
  cdtCode: z.string(),
  description: z.string(),
  conditionCode: z.string().optional(),
  status: DentalTreatmentStatusSchema,
  dismissReason: z.string().optional(),
  refusalReason: z.string().optional(),
  priceCents: z.number().int(),
  carriedOver: z.boolean(),
  sourceVisitId: UUIDSchema.optional(),
  autoDismissed: z.boolean().optional(),
  clinicalNotes: z.string().optional(),
  phase: z.enum(["systemic", "disease_control", "re_evaluation", "definitive", "maintenance"]).optional(),
  priority: z.number().int(),
  appointmentId: z.string().uuid().optional()
});

export const ApplyTemplateResponseSchema = z.object({
  applied: z.array(DentalTreatmentSchema),
  count: z.number().int()
});

export const AppointmentStatusSchema = z.enum(["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"]);

export const ArAgingPatientRowSchema = z.object({
  patientId: UUIDSchema,
  patientName: z.string(),
  currentCents: z.number().int(),
  days30Cents: z.number().int(),
  days60Cents: z.number().int(),
  days90PlusCents: z.number().int(),
  totalOutstandingCents: z.number().int(),
  oldestInvoiceDays: z.number().int()
});

export const ArAgingSummarySchema = z.object({
  currentCents: z.number().int(),
  days30Cents: z.number().int(),
  days60Cents: z.number().int(),
  days90PlusCents: z.number().int(),
  totalOutstandingCents: z.number().int(),
  patientCount: z.number().int()
});

export const ArAgingResponseSchema = z.object({
  asOf: z.string().datetime().transform((str) => new Date(str)),
  summary: ArAgingSummarySchema,
  patients: z.array(ArAgingPatientRowSchema)
});

export const AsaClassificationSchema = z.enum(["I", "II", "III", "IV", "V", "VI"]);

export const AuditActionSchema = z.enum(["create", "read", "update", "delete", "login", "logout"]);

export const AuditCategorySchema = z.enum(["regulatory", "security", "privacy", "administrative", "domain", "financial"]);

export const AuditEventTypeSchema = z.enum(["authentication", "data-access", "data-modification", "system-config", "security", "compliance"]);

export const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  eventType: z.enum(["authentication", "data-access", "data-modification", "system-config", "security", "compliance"]),
  category: z.enum(["regulatory", "security", "privacy", "administrative", "domain", "financial"]),
  user: z.string().uuid().optional(),
  userType: z.enum(["client", "service_provider", "admin", "system"]).optional(),
  resourceType: z.string(),
  resource: z.string(),
  action: z.enum(["create", "read", "update", "delete", "login", "logout"]),
  outcome: z.enum(["success", "failure", "partial", "denied"]),
  description: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  session: z.string().optional(),
  request: z.string().optional(),
  integrityHash: z.string().optional(),
  retentionStatus: z.enum(["active", "archived", "pending-purge"]),
  archivedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  archivedBy: z.string().uuid().optional(),
  purgeAfter: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const AuditOutcomeSchema = z.enum(["success", "failure", "partial", "denied"]);

export const AuditRetentionStatusSchema = z.enum(["active", "archived", "pending-purge"]);

export const AuthenticationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional(),
  scheme: z.enum(["bearer", "api-key", "oauth2"]).optional(),
  supportedSchemes: z.array(z.string()).optional()
});

export const AuthorizationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional(),
  requiredPermission: z.string().optional(),
  userPermissions: z.array(z.string()).optional(),
  resource: z.string().optional()
});

export const AvailableTimeSchema = z.object({
  daysOfWeek: z.array(z.string()).optional(),
  allDay: z.boolean().optional(),
  availableStartTime: z.string().optional(),
  availableEndTime: z.string().optional()
});

export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional()
});

export const BillingConfigSchema = z.object({
  price: z.number().int().gte(0),
  currency: z.string(),
  cancellationThresholdMinutes: z.number().int().gte(0).lte(10080)
});

export const BillingConfigUpdateSchema = z.object({
  price: z.number().int().gte(0).optional(),
  currency: z.string().optional(),
  cancellationThresholdMinutes: z.number().int().gte(0).lte(10080).optional()
});

export const LanguageCodeSchema = z.string().regex(/^[a-z]{2}$/).refine(val => validateLanguageCode(val), { message: "Invalid ISO 639-1 language code" });

export const PersonSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50).optional(),
  middleName: z.string().max(50).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  gender: z.enum(["male", "female", "non-binary", "other", "prefer-not-to-say"]).optional(),
  primaryAddress: z.object({
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
}).optional()
}).optional(),
  contactInfo: z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
}).optional(),
  avatar: z.object({
  file: z.string().uuid().optional(),
  url: z.string().url()
}).optional(),
  languagesSpoken: z.array(LanguageCodeSchema).optional(),
  timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/).refine(val => validateTimezone(val), { message: "Invalid IANA timezone identifier" }).optional()
});

export const LocationTypeSchema = z.enum(["video", "phone", "in-person"]);

export const FormFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string()
});

export const FormFieldConfigSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "textarea", "email", "phone", "number", "date", "datetime", "url", "select", "multiselect", "checkbox", "display"]),
  label: z.string(),
  required: z.boolean().optional(),
  options: z.array(FormFieldOptionSchema).optional(),
  validation: z.object({
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  pattern: z.string().optional()
}).optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional()
});

export const TimeBlockSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  slotDuration: z.number().int().gte(15).lte(480).optional(),
  bufferTime: z.number().int().gte(0).lte(120).optional()
});

export const DailyConfigSchema = z.object({
  enabled: z.boolean(),
  timeBlocks: z.array(TimeBlockSchema)
});

export const BookingEventSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  owner: z.union([z.string(), PersonSchema]),
  context: z.union([z.string(), z.null()]).optional(),
  title: z.string(),
  description: z.union([z.string(), z.null()]).optional(),
  keywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  timezone: z.string(),
  locationTypes: z.array(LocationTypeSchema),
  maxBookingDays: z.number().int().gte(0).lte(365),
  minBookingMinutes: z.number().int().gte(0).lte(4320),
  formConfig: z.union([z.object({
  fields: z.array(FormFieldConfigSchema).optional()
}), z.null()]).optional(),
  billingConfig: z.union([z.object({
  price: z.number().int().gte(0),
  currency: z.string(),
  cancellationThresholdMinutes: z.number().int().gte(0).lte(10080)
}), z.null()]).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]),
  effectiveFrom: z.string().datetime().transform((str) => new Date(str)),
  effectiveTo: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]).optional(),
  dailyConfigs: z.record(z.string(), z.unknown())
});

export const TimeSlotSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  owner: z.string().uuid(),
  event: z.union([z.string(), BookingEventSchema]),
  context: z.string().optional(),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)),
  locationTypes: z.array(LocationTypeSchema),
  status: z.enum(["available", "booked", "blocked"]),
  billingConfig: z.object({
  price: z.number().int().gte(0),
  currency: z.string(),
  cancellationThresholdMinutes: z.number().int().gte(0).lte(10080)
}).optional(),
  booking: z.string().uuid().optional()
});

export const BookingSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  client: z.union([z.string(), PersonSchema]),
  host: z.union([z.string(), PersonSchema]),
  slot: z.union([z.string(), TimeSlotSchema]),
  locationType: z.enum(["video", "phone", "in-person"]),
  reason: z.string().max(500),
  status: z.enum(["pending", "confirmed", "rejected", "cancelled", "completed", "no_show_client", "no_show_host"]),
  bookedAt: z.string().datetime().transform((str) => new Date(str)),
  confirmationTimestamp: z.string().datetime().transform((str) => new Date(str)).optional(),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)),
  durationMinutes: z.number().int().gte(15).lte(480),
  cancellationReason: z.string().optional(),
  cancelledBy: z.string().optional(),
  cancelledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  noShowMarkedBy: z.string().optional(),
  noShowMarkedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  formResponses: z.object({
  data: z.record(z.string(), z.unknown()),
  metadata: z.object({
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completionTimeSeconds: z.number().int().optional(),
  ipAddress: z.string().optional()
}).optional()
}).optional(),
  invoice: z.string().uuid().optional()
});

export const BookingActionRequestSchema = z.object({
  reason: z.string().max(500)
});

export const BookingCreateRequestSchema = z.object({
  slot: z.string().uuid(),
  locationType: z.enum(["video", "phone", "in-person"]).optional(),
  reason: z.string().max(500).optional(),
  formResponses: z.object({
  data: z.record(z.string(), z.unknown())
}).optional()
});

export const BookingEventCreateRequestSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  context: z.string().optional(),
  timezone: z.string().optional(),
  locationTypes: z.array(LocationTypeSchema).optional(),
  maxBookingDays: z.number().int().gte(0).lte(365).optional(),
  minBookingMinutes: z.number().int().gte(0).lte(4320).optional(),
  formConfig: z.object({
  fields: z.array(FormFieldConfigSchema).optional()
}).optional(),
  billingConfig: z.object({
  price: z.number().int().gte(0),
  currency: z.string(),
  cancellationThresholdMinutes: z.number().int().gte(0).lte(10080)
}).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  effectiveFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  effectiveTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  dailyConfigs: z.record(z.string(), z.unknown())
});

export const BookingEventStatusSchema = z.enum(["draft", "active", "paused", "archived"]);

export const DailyConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  timeBlocks: z.array(TimeBlockSchema).optional()
});

export const BookingEventUpdateRequestSchema = z.object({
  title: z.string().optional(),
  description: z.union([z.string(), z.null()]).optional(),
  keywords: z.union([z.array(z.string()), z.null()]).optional(),
  tags: z.union([z.array(z.string()), z.null()]).optional(),
  timezone: z.string().optional(),
  locationTypes: z.array(LocationTypeSchema).optional(),
  maxBookingDays: z.number().int().optional(),
  minBookingMinutes: z.number().int().optional(),
  formConfig: z.union([z.object({
  fields: z.array(FormFieldConfigSchema).optional()
}), z.null()]).optional(),
  billingConfig: z.union([z.object({
  price: z.number().int().gte(0).optional(),
  currency: z.string().optional(),
  cancellationThresholdMinutes: z.number().int().gte(0).lte(10080).optional()
}), z.null()]).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  effectiveTo: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]).optional(),
  dailyConfigs: z.record(z.string(), z.unknown()).optional()
});

export const VisitTypeSchema = z.enum(["checkup", "treatment", "emergency", "recall", "hygiene"]);

export const BookingLookupResponseSchema = z.object({
  confirmationCode: z.string(),
  branchId: UUIDSchema,
  branchName: z.string(),
  providerName: z.string(),
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  visitType: VisitTypeSchema,
  status: AppointmentStatusSchema,
  confirmationState: z.string()
});

export const BookingStatusSchema = z.enum(["pending", "confirmed", "rejected", "cancelled", "completed", "no_show_client", "no_show_host"]);

export const CallParticipantSchema = z.object({
  user: z.string().uuid(),
  displayName: z.string().max(100),
  joinedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  leftAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  audioEnabled: z.boolean(),
  videoEnabled: z.boolean()
});

export const CancelEmailRequestSchema = z.object({
  reason: z.string().max(500)
});

export const CaptureMethodSchema = z.enum(["automatic", "manual"]);

export const CarryOverTreatmentsRequestSchema = z.object({
  sourceVisitId: z.string().uuid().optional(),
  restoreDismissedIds: z.array(UUIDSchema).optional()
});

export const CarryOverTreatmentsResponseSchema = z.object({
  carriedOver: z.array(DentalTreatmentSchema),
  restoredDismissed: z.array(DentalTreatmentSchema),
  message: z.string()
});

export const ToothStateSchema = z.enum(["healthy", "caries", "fractured", "filled", "crown", "missing", "implant", "extracted", "watchlist"]);

export const ChartEntryClassificationSchema = z.enum(["existing", "existing_other", "treatment_plan", "condition"]);

export const ToothChartStateSchema = z.object({
  toothNumber: z.number().int(),
  state: ToothStateSchema,
  surfaces: z.array(ToothSurfaceCodeSchema).optional(),
  conditionCode: z.string().optional(),
  note: z.string().optional(),
  surfaceConditionMap: z.record(z.string(), z.unknown()).optional(),
  entryClassification: ChartEntryClassificationSchema.optional(),
  clock: z.number().int().optional()
});

export const ChartConflictSchema = z.object({
  chartId: UUIDSchema,
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  reason: z.string(),
  rejectedTeeth: z.array(ToothChartStateSchema),
  detectedAt: z.string().datetime().transform((str) => new Date(str))
});

export const ChartConflictResolutionSchema = z.enum(["accept", "dismiss"]);

export const DentalVisitStatusSchema = z.enum(["draft", "active", "completed", "locked", "discarded"]);

export const ChartExportToothSchema = z.object({
  toothNumber: z.number().int(),
  state: z.string(),
  layer: z.string(),
  surfaces: z.array(z.string()).optional(),
  conditionCode: z.string().optional(),
  entryClassification: ChartEntryClassificationSchema.optional(),
  note: z.string().optional()
});

export const ChartExportTreatmentSchema = z.object({
  toothNumber: z.number().int().optional(),
  cdtCode: z.string(),
  description: z.string(),
  surfaces: z.array(z.string()).optional(),
  status: DentalTreatmentStatusSchema,
  priceCents: z.number().int()
});

export const ChartExportSummarySchema = z.object({
  proposedCount: z.number().int(),
  completedCount: z.number().int(),
  declinedCount: z.number().int(),
  totalProposedCents: z.number().int()
});

export const ChartExportLegendEntrySchema = z.object({
  key: z.string(),
  label: z.string()
});

export const ChartExportSchema = z.object({
  patientId: UUIDSchema,
  patientName: z.string(),
  patientDateOfBirth: z.string().optional(),
  visitId: UUIDSchema,
  visitDate: z.string().datetime().transform((str) => new Date(str)),
  visitStatus: DentalVisitStatusSchema,
  providerMemberId: UUIDSchema.optional(),
  providerName: z.string().optional(),
  branchId: UUIDSchema,
  branchName: z.string().optional(),
  notation: z.string(),
  generatedAt: z.string().datetime().transform((str) => new Date(str)),
  teeth: z.array(ChartExportToothSchema),
  treatments: z.array(ChartExportTreatmentSchema),
  summary: ChartExportSummarySchema,
  legend: z.array(ChartExportLegendEntrySchema)
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  chatRoom: z.string().uuid(),
  sender: z.string().uuid(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  messageType: z.enum(["text", "system", "video_call"]),
  message: z.string().max(5000).optional(),
  videoCallData: z.object({
  status: z.enum(["starting", "active", "ended", "cancelled"]),
  roomUrl: z.string().optional(),
  token: z.string().optional(),
  startedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  startedBy: z.string().uuid().optional(),
  endedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  endedBy: z.string().uuid().optional(),
  durationMinutes: z.number().int().optional(),
  participants: z.array(CallParticipantSchema)
}).optional()
});

export const ChatRoomSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  participants: z.array(UUIDSchema),
  admins: z.array(UUIDSchema),
  context: z.string().uuid().optional(),
  status: z.enum(["active", "archived"]),
  lastMessageAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  messageCount: z.number().int(),
  activeVideoCallMessage: z.string().uuid().optional()
});

export const ChatRoomStatusSchema = z.enum(["active", "archived"]);

export const DentalAppointmentSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  patientId: UUIDSchema,
  providerId: UUIDSchema,
  branchId: UUIDSchema,
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  visitType: VisitTypeSchema,
  operatoryId: UUIDSchema.optional(),
  walkIn: z.boolean(),
  status: AppointmentStatusSchema,
  confirmedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  confirmedVia: z.string().optional(),
  checkInTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  visitId: UUIDSchema.optional(),
  notes: z.string().optional(),
  cancelledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  cancellationReason: z.string().optional(),
  noShowAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  warnings: z.array(z.string()).optional()
});

export const CheckInResponseSchema = z.object({
  appointment: DentalAppointmentSchema,
  visitId: UUIDSchema
});

export const ClaimLineStatusSchema = z.enum(["pending", "covered", "partial", "disallowed"]);

export const CollectionsSummaryResponseSchema = z.object({
  totalCollectedCents: z.number().int(),
  period: z.string(),
  invoiceCount: z.number().int()
});

export const CompletePerioChartRequestSchema = z.object({
  toothLossCount: z.number().int().optional(),
  remainingTeeth: z.number().int().optional(),
  biteCollapse: z.boolean().optional(),
  bonelossPercent: z.number().optional(),
  ageYears: z.number().int().optional(),
  fiveYearProgressionMm: z.number().optional(),
  cigarettesPerDay: z.number().int().optional(),
  hasDiabetes: z.boolean().optional(),
  hba1cPercent: z.number().optional(),
  molarIncisorPattern: z.boolean().optional()
});

export const PerioChartStatusSchema = z.enum(["draft", "completed", "locked"]);

export const CompletePerioChartResponseSchema = z.object({
  id: UUIDSchema,
  status: PerioChartStatusSchema,
  completedAt: z.string().datetime().transform((str) => new Date(str)),
  summaryBopPercent: z.number(),
  summaryMeanDepth: z.number(),
  summaryDeepPocketCount: z.number().int(),
  stage: z.union([z.enum(["I", "II", "III", "IV"]), z.null()]).optional(),
  grade: z.union([z.enum(["A", "B", "C"]), z.null()]).optional(),
  extent: z.union([z.enum(["localized", "generalized", "molar_incisor"]), z.null()]).optional()
});

export const ConditionCodeSchema = z.enum(["caries", "abscess", "calculus", "gingival_recession", "impacted_unerupted", "retained_root", "sensitive_dentin", "fracture_crack", "wear_erosion", "developmental_anomaly", "other"]);

export const ConflictErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional(),
  conflictingResource: z.string().optional(),
  reason: z.enum(["duplicate", "version-mismatch", "state-conflict", "dependency"]).optional(),
  currentState: z.record(z.string(), z.unknown()).optional(),
  resolution: z.array(z.string()).optional()
});

export const ConsentFormSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  templateId: z.string(),
  templateName: z.string(),
  procedureNature: z.string().optional(),
  benefits: z.string().optional(),
  risks: z.string().optional(),
  alternatives: z.string().optional(),
  risksOfNonTreatment: z.string().optional(),
  signedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  signatureData: z.string().optional(),
  signed: z.boolean(),
  revoked: z.boolean(),
  revokedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  revokedBy: z.string().uuid().optional()
});

export const PrescriptionDataSchema = z.object({
  id: z.string().optional(),
  medication: z.string(),
  dosageAmount: z.number().optional(),
  dosageUnit: z.string().optional(),
  frequency: z.string().optional(),
  durationDays: z.number().int().optional(),
  instructions: z.string().optional(),
  notes: z.string().optional()
});

export const ConsultationNoteSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patient: z.string().uuid(),
  provider: z.string().uuid(),
  context: z.string().max(255).optional(),
  chiefComplaint: z.string().min(1).max(500).optional(),
  assessment: z.string().min(1).max(2000).optional(),
  plan: z.string().min(1).max(2000).optional(),
  vitals: z.object({
  temperatureCelsius: z.number().optional(),
  systolicBp: z.number().int().optional(),
  diastolicBp: z.number().int().optional(),
  heartRate: z.number().int().optional(),
  weightKg: z.number().optional(),
  heightCm: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  oxygenSaturation: z.number().int().optional(),
  notes: z.string().optional()
}).optional(),
  symptoms: z.object({
  onset: z.string().datetime().transform((str) => new Date(str)).optional(),
  durationHours: z.number().int().optional(),
  severity: z.union([z.string(), z.enum(["mild", "moderate", "severe"])]).optional(),
  description: z.string().optional(),
  associated: z.array(z.string()).optional(),
  denies: z.array(z.string()).optional()
}).optional(),
  prescriptions: z.array(PrescriptionDataSchema).optional(),
  followUp: z.object({
  needed: z.boolean(),
  timeframeDays: z.number().int().optional(),
  instructions: z.string().optional(),
  specialistReferral: z.string().optional()
}).optional(),
  externalDocumentation: z.record(z.string(), z.unknown()).optional(),
  status: z.union([z.string(), z.enum(["draft", "finalized", "amended"])]),
  finalizedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  finalizedBy: z.string().uuid().optional()
});

export const ConsultationStatusSchema = z.union([z.string(), z.enum(["draft", "finalized", "amended"])]);

export const ContactInfoSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
});

export const ControlledSubstanceScheduleSchema = z.enum(["none", "II", "III", "IV", "V"]);

export const ConvertFindingToTreatmentRequestSchema = z.object({
  cdtCode: z.string(),
  description: z.string(),
  priceCents: z.number().int().optional()
});

export const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" });

export const CoverageEstimateLineSchema = z.object({
  cdtCode: z.string().min(1),
  billedAmountCents: z.number().int().gte(0),
  description: z.string().optional()
});

export const CoverageEstimateLineResultSchema = z.object({
  cdtCode: z.string(),
  description: z.string().optional(),
  billedAmountCents: z.number().int(),
  coveredCents: z.number().int(),
  patientPortionCents: z.number().int(),
  uncovered: z.boolean()
});

export const CoverageEstimateRequestSchema = z.object({
  patientId: UUIDSchema.optional(),
  insuranceProfileId: UUIDSchema.optional(),
  authorizationId: UUIDSchema.optional(),
  lines: z.array(CoverageEstimateLineSchema)
});

export const CoverageEstimateResultSchema = z.object({
  estimatedCoveredCents: z.number().int(),
  estimatedPatientPortionCents: z.number().int(),
  estimatedBilledCents: z.number().int(),
  perLine: z.array(CoverageEstimateLineResultSchema),
  cappedByAnnualLimit: z.boolean(),
  uncoveredProcedures: z.array(z.string())
});

export const CreateAmendmentRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  originalRecordType: z.string(),
  originalRecordId: UUIDSchema,
  reason: z.string(),
  content: z.string()
});

export const CreateAppointmentRequestSchema = z.object({
  patientId: UUIDSchema,
  providerId: UUIDSchema,
  branchId: UUIDSchema,
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  visitType: VisitTypeSchema,
  operatoryId: UUIDSchema.optional(),
  walkIn: z.boolean().optional(),
  notes: z.string().max(500).optional()
});

export const CreateChatRoomRequestSchema = z.object({
  participants: z.array(UUIDSchema),
  admins: z.array(UUIDSchema).optional(),
  context: z.string().uuid().optional(),
  upsert: z.boolean().optional()
});

export const CreateConsentFormRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  templateId: z.string(),
  templateName: z.string(),
  procedureNature: z.string().optional(),
  benefits: z.string().optional(),
  risks: z.string().optional(),
  alternatives: z.string().optional(),
  risksOfNonTreatment: z.string().optional()
});

export const CreateConsultationRequestSchema = z.object({
  patient: z.string().uuid(),
  provider: z.string().uuid(),
  context: z.string().max(255).optional(),
  chiefComplaint: z.string().min(1).max(500).optional(),
  assessment: z.string().min(1).max(2000).optional(),
  plan: z.string().min(1).max(2000).optional(),
  vitals: z.object({
  temperatureCelsius: z.number().optional(),
  systolicBp: z.number().int().optional(),
  diastolicBp: z.number().int().optional(),
  heartRate: z.number().int().optional(),
  weightKg: z.number().optional(),
  heightCm: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  oxygenSaturation: z.number().int().optional(),
  notes: z.string().optional()
}).optional(),
  symptoms: z.object({
  onset: z.string().datetime().transform((str) => new Date(str)).optional(),
  durationHours: z.number().int().optional(),
  severity: z.union([z.string(), z.enum(["mild", "moderate", "severe"])]).optional(),
  description: z.string().optional(),
  associated: z.array(z.string()).optional(),
  denies: z.array(z.string()).optional()
}).optional(),
  prescriptions: z.array(PrescriptionDataSchema).optional(),
  followUp: z.object({
  needed: z.boolean(),
  timeframeDays: z.number().int().optional(),
  instructions: z.string().optional(),
  specialistReferral: z.string().optional()
}).optional(),
  externalDocumentation: z.record(z.string(), z.unknown()).optional()
});

export const DentalAttachmentImageTypeSchema = z.enum(["xray", "photo", "scan", "document", "other"]);

export const CreateDentalAttachmentRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  imageType: DentalAttachmentImageTypeSchema,
  toothNumbers: z.array(z.number().int()).optional(),
  fileName: z.string(),
  filePath: z.string(),
  fileSizeBytes: z.number().int(),
  mimeType: z.string(),
  note: z.string().optional()
});

export const CreateDentalChartRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  teeth: z.array(ToothChartStateSchema),
  localId: z.string().optional()
});

export const CreateDentalInvoiceRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  branchId: UUIDSchema,
  dentistMemberId: UUIDSchema,
  taxRate: z.number().optional(),
  dueDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  localId: z.string().optional()
});

export const PlanFrequencySchema = z.enum(["weekly", "biweekly", "monthly"]);

export const CreateDentalPaymentPlanRequestSchema = z.object({
  patientId: UUIDSchema,
  numberOfInstallments: z.number().int(),
  frequency: PlanFrequencySchema,
  startDate: z.string().datetime().transform((str) => new Date(str))
});

export const CreateDentalTreatmentRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  toothNumber: z.number().int().optional(),
  surfaces: z.array(ToothSurfaceCodeSchema).optional(),
  cdtCode: z.string(),
  description: z.string(),
  conditionCode: z.string().optional(),
  priceCents: z.number().int().optional(),
  clinicalNotes: z.string().optional(),
  phase: z.enum(["systemic", "disease_control", "re_evaluation", "definitive", "maintenance"]).optional(),
  priority: z.number().int().gte(0).optional(),
  localId: z.string().optional()
});

export const CreateDentalVisitRequestSchema = z.object({
  patientId: UUIDSchema,
  branchId: UUIDSchema,
  dentistMemberId: UUIDSchema,
  chiefComplaint: z.string().optional(),
  visitType: z.enum(["general", "hygiene"]).optional(),
  localId: z.string().optional()
});

export const CreateFindingRequestSchema = z.object({
  toothNumber: z.number().int(),
  surface: ToothSurfaceCodeSchema.optional(),
  conditionCode: ConditionCodeSchema,
  note: z.string().optional(),
  localId: z.string().optional()
});

export const CreateHoldRequestSchema = z.object({
  providerId: UUIDSchema,
  startAt: z.string().datetime().transform((str) => new Date(str)),
  visitType: VisitTypeSchema
});

export const CreateInsuranceClaimLineRequestSchema = z.object({
  treatmentId: UUIDSchema.optional(),
  invoiceLineItemId: UUIDSchema.optional(),
  cdtCode: z.string().min(1),
  description: z.string().min(1),
  billedAmountCents: z.number().int().gte(0)
});

export const SubmissionChannelSchema = z.enum(["portal", "email", "fax", "in_person", "other"]);

export const CreateInsuranceClaimRequestSchema = z.object({
  patientId: UUIDSchema,
  insuranceProfileId: UUIDSchema,
  invoiceId: z.string().uuid().optional(),
  visitId: UUIDSchema.optional(),
  authorizationId: z.string().uuid().optional(),
  submissionChannel: SubmissionChannelSchema.optional(),
  lines: z.array(CreateInsuranceClaimLineRequestSchema).optional()
});

export const CreateLineItemRequestSchema = z.object({
  description: z.string().max(500),
  quantity: z.number().int().gte(1).optional(),
  unitPrice: z.number().int().gte(0),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const CreateInvoiceRequestSchema = z.object({
  customer: z.string().uuid(),
  merchant: z.string().uuid(),
  context: z.string().max(255).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  paymentCaptureMethod: z.enum(["automatic", "manual"]).optional(),
  paymentDueAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  voidThresholdMinutes: z.number().int().optional(),
  lineItems: z.array(CreateLineItemRequestSchema),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const CreateLabOrderRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  toothFdi: z.string().optional(),
  labName: z.string(),
  description: z.string(),
  shade: z.string().optional(),
  material: z.string().optional(),
  dueDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  expectedDeliveryDate: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const MedicalHistoryEntryTypeSchema = z.enum(["condition", "medication", "allergy", "procedure", "vaccination", "family_history"]);

export const CreateMedicalHistoryEntryRequestSchema = z.object({
  patientId: UUIDSchema,
  entryType: MedicalHistoryEntryTypeSchema,
  codeSystem: z.string().optional(),
  code: z.string().optional(),
  displayName: z.string(),
  notes: z.string().optional(),
  onsetDate: z.string().optional(),
  resolvedDate: z.string().optional()
});

export const CreateMerchantAccountRequestSchema = z.object({
  person: z.string().uuid().optional(),
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const CreateOnlineBookingRequestSchema = z.object({
  providerId: UUIDSchema,
  startAt: z.string().datetime().transform((str) => new Date(str)),
  visitType: VisitTypeSchema,
  sessionToken: z.string().optional(),
  firstName: z.string().max(120),
  lastName: z.string().max(120).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  dateOfBirth: z.string().optional(),
  notes: z.string().max(500).optional()
});

export const HealthcareCoreHumanNameSchema = z.object({
  use: z.enum(["usual", "official", "temp", "nickname", "anonymous", "old", "maiden"]).optional(),
  text: z.string().optional(),
  family: z.string().optional(),
  given: z.array(z.string()).optional(),
  prefix: z.array(z.string()).optional(),
  suffix: z.array(z.string()).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const HealthcareCoreCodingSchema = z.object({
  system: z.string().url(),
  code: z.string(),
  display: z.string().optional(),
  version: z.string().optional(),
  userSelected: z.boolean().optional()
});

export const HealthcareCoreContactPointSchema = z.object({
  system: z.enum(["phone", "fax", "email", "pager", "url", "sms", "other"]),
  value: z.string(),
  use: z.enum(["home", "work", "temp", "old", "mobile"]).optional(),
  rank: z.number().int().gte(1).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const PatientCommunicationSchema = z.object({
  language: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  preferred: z.boolean().optional()
});

export const HealthcareCoreReferenceSchema = z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
});

export const HealthcareCoreAttachmentSchema = z.object({
  contentType: z.string().optional(),
  language: z.string().optional(),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  title: z.string().optional(),
  size: z.number().int().gte(0).optional(),
  hash: z.string().optional(),
  creation: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareCoreCodeableConceptSchema = z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
});

export const EmergencyContactSchema = z.object({
  relationship: z.array(HealthcareCoreCodeableConceptSchema),
  name: z.object({
  use: z.enum(["usual", "official", "temp", "nickname", "anonymous", "old", "maiden"]).optional(),
  text: z.string().optional(),
  family: z.string().optional(),
  given: z.array(z.string()).optional(),
  prefix: z.array(z.string()).optional(),
  suffix: z.array(z.string()).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
}).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional()
});

export const CreatePatientRequestSchema = z.object({
  name: z.array(HealthcareCoreHumanNameSchema),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  gender: z.enum(["male", "female", "other", "unknown"]),
  active: z.boolean().optional(),
  genderIdentity: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  pronouns: z.string().optional(),
  maritalStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  deceased: z.boolean().optional(),
  deceasedDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  address: z.array(AddressSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  language: z.string().optional(),
  communication: z.array(PatientCommunicationSchema).optional(),
  generalPractitioner: z.array(HealthcareCoreReferenceSchema).optional(),
  managingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  photo: z.array(HealthcareCoreAttachmentSchema).optional(),
  emergencyContact: z.array(EmergencyContactSchema).optional(),
  mrn: z.string().optional(),
  insuranceCoverage: z.array(HealthcareCoreReferenceSchema).optional(),
  preferredBranchId: z.string().uuid().optional(),
  dentalHistorySummary: z.string().optional()
});

export const CreatePerioChartRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  notes: z.string().optional()
});

export const HealthcareCoreIdentifierSchema = z.object({
  use: z.enum(["usual", "official", "temp", "secondary", "old"]).optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  system: z.string().url().optional(),
  value: z.string(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  assigner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const PractitionerQualificationSchema = z.object({
  identifier: z.array(HealthcareCoreIdentifierSchema).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  issuer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const PractitionerCredentialSchema = z.object({
  type: z.enum(["npi", "dea", "state-license", "board-certification", "cme", "other"]),
  number: z.string(),
  state: z.string().optional(),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  verifiedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  verifiedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  status: z.enum(["active", "expired", "suspended", "revoked", "pending"])
});

export const CreatePractitionerRequestSchema = z.object({
  providerId: z.string().uuid(),
  name: z.array(HealthcareCoreHumanNameSchema),
  active: z.boolean().optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  address: z.array(AddressSchema).optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  photo: z.array(HealthcareCoreAttachmentSchema).optional(),
  qualification: z.array(PractitionerQualificationSchema).optional(),
  credential: z.array(PractitionerCredentialSchema).optional(),
  specialties: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  languages: z.array(HealthcareCoreCodeableConceptSchema).optional()
});

export const NotAvailableTimeSchema = z.object({
  description: z.string(),
  during: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const CreatePractitionerRoleRequestSchema = z.object({
  practitionerId: z.string().uuid(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  code: z.array(HealthcareCoreCodeableConceptSchema),
  specialty: z.array(HealthcareCoreCodeableConceptSchema),
  active: z.boolean().optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  location: z.array(HealthcareCoreReferenceSchema).optional(),
  healthcareService: z.array(HealthcareCoreReferenceSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  availableTime: z.array(AvailableTimeSchema).optional(),
  notAvailable: z.array(NotAvailableTimeSchema).optional()
});

export const CreatePrescriptionRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  prescriberMemberId: UUIDSchema,
  rxNormCode: z.string().optional(),
  drugName: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string().optional(),
  quantity: z.string().optional(),
  instructions: z.string().optional(),
  dispenseAsWritten: z.boolean().optional(),
  controlledSubstanceSchedule: ControlledSubstanceScheduleSchema.optional(),
  prescriberDea: z.string().optional(),
  prescriberNpi: z.string().optional()
});

export const CreateProviderRequestSchema = z.object({
  providerType: z.enum(["dentist", "hygienist", "orthodontist", "endodontist", "periodontist", "oral_surgeon", "pediatric_dentist", "pharmacist", "other"]),
  yearsOfExperience: z.number().int().gte(0).lte(70).optional(),
  biography: z.string().max(2000).optional(),
  minorAilmentsSpecialties: z.array(z.string()).optional(),
  minorAilmentsPracticeLocations: z.array(z.string()).optional()
});

export const CreateReviewRequestSchema = z.object({
  context: z.string().uuid(),
  reviewType: z.string().max(50),
  reviewedEntity: z.string().uuid().optional(),
  npsScore: z.number().int().gte(0).lte(10),
  comment: z.string().max(1000).optional()
});

export const TemplateVariableSchema = z.object({
  id: z.string().max(100),
  type: z.enum(["string", "number", "boolean", "date", "datetime", "url", "email", "array"]),
  label: z.string().max(255).optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().optional(),
  minLength: z.number().int().gte(0).optional(),
  maxLength: z.number().int().lte(10000).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().max(500).optional(),
  options: z.array(z.string()).optional()
});

export const CreateTemplateRequestSchema = z.object({
  tags: z.array(z.string()).optional(),
  name: z.string().max(255),
  description: z.string().max(500).optional(),
  subject: z.string().max(500),
  bodyHtml: z.string(),
  bodyText: z.string().optional(),
  variables: z.array(TemplateVariableSchema).optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  replyToEmail: z.string().email().optional(),
  replyToName: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional()
});

export const TemplateTreatmentItemSchema = z.object({
  cdtCode: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  toothNumber: z.number().int().optional(),
  surfaces: z.array(z.string()).optional()
});

export const CreateTreatmentTemplateRequestSchema = z.object({
  name: z.string(),
  branchId: UUIDSchema,
  description: z.string().optional(),
  items: z.array(TemplateTreatmentItemSchema)
});

export const CreateVisitNoteAddendumRequestSchema = z.object({
  reason: z.string(),
  content: z.string()
});

export const CredentialStatusSchema = z.enum(["active", "expired", "suspended", "revoked", "pending"]);

export const CredentialTypeSchema = z.enum(["npi", "dea", "state-license", "board-certification", "cme", "other"]);

export const CurrencyAmountSchema = z.number().int().gte(0);

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

export const DashboardResponseSchema = z.object({
  dashboardUrl: z.string().url(),
  expiresAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalAttachmentSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  imageType: DentalAttachmentImageTypeSchema,
  toothNumbers: z.array(z.number().int()).optional(),
  fileName: z.string(),
  filePath: z.string(),
  fileSizeBytes: z.number().int(),
  mimeType: z.string(),
  note: z.string().optional()
});

export const DentalAuditModuleDentalAuditEventSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  branchId: z.union([z.string().uuid(), z.null()]),
  tenantId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.union([z.string(), z.null()]),
  eventType: z.union([z.enum(["authentication", "data-access", "data-modification", "security", "compliance", "system-config"]), z.null()]),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.union([z.string().uuid(), z.null()]),
  reason: z.union([z.string(), z.null()]),
  ipAddress: z.union([z.string(), z.null()]),
  userAgent: z.union([z.string(), z.null()]),
  metadata: z.union([z.record(z.string(), z.unknown()), z.null()]),
  timestamp: z.string().datetime().transform((str) => new Date(str))
});

export const DentalAuditModuleDentalAuditEventTypeSchema = z.enum(["authentication", "data-access", "data-modification", "security", "compliance", "system-config"]);

export const DentalAuditModuleDentalAuditEventsMetaSchema = z.object({
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int()
});

export const DentalAuditModuleDentalAuditEventsResponseSchema = z.object({
  data: z.array(DentalAuditModuleDentalAuditEventSchema),
  meta: z.object({
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int()
})
});

export const DentalChartSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  teeth: z.array(ToothChartStateSchema)
});

export const DentalClinicalOpsModuleAdjustmentTypeSchema = z.enum(["restock", "usage", "disposal", "correction"]);

export const DentalClinicalOpsModuleCreateInventoryAdjustmentRequestSchema = z.object({
  adjustmentType: DentalClinicalOpsModuleAdjustmentTypeSchema,
  quantity: z.number().int(),
  reason: z.string().optional()
});

export const DentalClinicalOpsModuleInventoryCategorySchema = z.enum(["consumable", "instrument", "medication", "equipment", "other"]);

export const DentalClinicalOpsModuleCreateInventoryItemRequestSchema = z.object({
  name: z.string().min(1),
  category: DentalClinicalOpsModuleInventoryCategorySchema,
  unit: z.string().min(1),
  quantityOnHand: z.number().int().gte(0).optional(),
  reorderLevel: z.number().int().gte(0).optional(),
  notes: z.string().optional()
});

export const DentalClinicalOpsModuleOcclusionClassSchema = z.enum(["class_i", "class_ii_div1", "class_ii_div2", "class_iii", "edge_to_edge"]);

export const DentalClinicalOpsModuleCreateOcclusionScreeningRequestSchema = z.object({
  angleClass: DentalClinicalOpsModuleOcclusionClassSchema.optional(),
  overbiteMm: z.number().int().optional(),
  overjetMm: z.number().int().optional(),
  crossbite: z.boolean().optional(),
  crowding: z.boolean().optional(),
  spacing: z.boolean().optional(),
  midlineDeviation: z.string().optional(),
  visitId: UUIDSchema.optional(),
  notes: z.string().optional()
});

export const DentalClinicalOpsModulePostopCategorySchema = z.enum(["extraction", "implant", "root_canal", "filling", "crown", "cleaning", "surgery", "orthodontic", "other"]);

export const DentalClinicalOpsModuleCreatePostopTemplateRequestSchema = z.object({
  category: DentalClinicalOpsModulePostopCategorySchema,
  title: z.string().min(1),
  content: z.string().min(1)
});

export const DentalClinicalOpsModuleInventoryAdjustmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  itemId: z.string().uuid(),
  adjustmentType: z.enum(["restock", "usage", "disposal", "correction"]),
  quantity: z.number().int(),
  reason: z.union([z.string(), z.null()])
});

export const DentalClinicalOpsModuleInventoryItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  name: z.string(),
  category: z.enum(["consumable", "instrument", "medication", "equipment", "other"]),
  unit: z.string(),
  status: z.enum(["active", "depleted", "discontinued"]),
  quantityOnHand: z.number().int(),
  reorderLevel: z.number().int(),
  notes: z.union([z.string(), z.null()])
});

export const DentalClinicalOpsModuleInventoryStatusSchema = z.enum(["active", "depleted", "discontinued"]);

export const DentalClinicalOpsModuleOcclusionScreeningSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  visitId: z.union([z.string().uuid(), z.null()]),
  angleClass: z.union([z.enum(["class_i", "class_ii_div1", "class_ii_div2", "class_iii", "edge_to_edge"]), z.null()]),
  overbiteMm: z.union([z.number().int(), z.null()]),
  overjetMm: z.union([z.number().int(), z.null()]),
  crossbite: z.union([z.boolean(), z.null()]),
  crowding: z.union([z.boolean(), z.null()]),
  spacing: z.union([z.boolean(), z.null()]),
  midlineDeviation: z.union([z.string(), z.null()]),
  notes: z.union([z.string(), z.null()])
});

export const DentalClinicalOpsModulePostopTemplateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  category: z.enum(["extraction", "implant", "root_canal", "filling", "crown", "cleaning", "surgery", "orthodontic", "other"]),
  title: z.string(),
  content: z.string(),
  active: z.boolean()
});

export const DentalClinicalOpsModuleUpdateInventoryItemRequestSchema = z.object({
  name: z.string().min(1).optional(),
  category: DentalClinicalOpsModuleInventoryCategorySchema.optional(),
  unit: z.string().min(1).optional(),
  status: DentalClinicalOpsModuleInventoryStatusSchema.optional(),
  quantityOnHand: z.number().int().gte(0).optional(),
  reorderLevel: z.number().int().gte(0).optional(),
  notes: z.string().optional()
});

export const DentalClinicalOpsModuleUpdatePostopTemplateRequestSchema = z.object({
  category: DentalClinicalOpsModulePostopCategorySchema.optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  active: z.boolean().optional()
});

export const DentalErasureModuleApproveErasureRequestSchema = z.object({
  legalHold: z.boolean().optional()
});

export const DentalErasureModuleErasureRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  subjectPersonId: z.string().uuid(),
  subjectPatientId: z.union([z.string().uuid(), z.null()]),
  tenantId: z.string().uuid(),
  branchId: z.union([z.string().uuid(), z.null()]),
  status: z.enum(["requested", "approved", "anonymized", "rejected"]),
  reason: z.string(),
  requestedBy: z.string().uuid(),
  reviewedBy: z.union([z.string().uuid(), z.null()]),
  reviewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  processedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  rejectionReason: z.union([z.string(), z.null()]),
  legalHoldBlocked: z.boolean()
});

export const DentalErasureModuleErasureRequestListSchema = z.object({
  data: z.array(DentalErasureModuleErasureRequestSchema)
});

export const DentalErasureModuleErasureRequestStatusSchema = z.enum(["requested", "approved", "anonymized", "rejected"]);

export const DentalErasureModuleRejectErasureRequestSchema = z.object({
  rejectionReason: z.string()
});

export const DentalErasureModuleRequestErasureRequestSchema = z.object({
  subjectPersonId: UUIDSchema,
  subjectPatientId: UUIDSchema.optional(),
  tenantId: UUIDSchema,
  branchId: UUIDSchema.optional(),
  reason: z.string()
});

export const DentalFeeScheduleModuleFeeScheduleEntrySchema = z.object({
  cdtCode: z.string(),
  description: z.string(),
  priceCents: z.number().int(),
  currency: z.string()
});

export const DentalFeeScheduleModuleFeeScheduleEntryResponseSchema = z.object({
  data: DentalFeeScheduleModuleFeeScheduleEntrySchema
});

export const DentalFeeScheduleModuleFeeScheduleListSchema = z.object({
  data: z.array(DentalFeeScheduleModuleFeeScheduleEntrySchema)
});

export const DentalFeeScheduleModuleUpdateFeeScheduleEntryRequestSchema = z.object({
  branchId: z.string().uuid(),
  priceCents: z.number().int()
});

export const FindingStatusSchema = z.enum(["active", "resolved"]);

export const DentalFindingSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  toothNumber: z.number().int(),
  surface: ToothSurfaceCodeSchema.optional(),
  conditionCode: ConditionCodeSchema,
  note: z.string().optional(),
  status: FindingStatusSchema,
  linkedTreatmentId: z.string().uuid().optional()
});

export const DentalImagingModuleCephLandmarkCodeSchema = z.enum(["S", "N", "A", "B", "ANS", "PNS", "Go", "Po", "Me", "Or", "Pog", "Gn", "U1T", "U1A", "L1T", "L1A"]);

export const DentalImagingModuleCephLandmarkSourceSchema = z.enum(["manual", "ai", "ai_corrected"]);

export const DentalImagingModuleCephLandmarkStatusSchema = z.enum(["placed", "confirmed", "locked"]);

export const DentalImagingModuleCephLandmarkInputSchema = z.object({
  landmarkCode: DentalImagingModuleCephLandmarkCodeSchema,
  x: z.number(),
  y: z.number(),
  source: DentalImagingModuleCephLandmarkSourceSchema.optional(),
  confidence: z.number().optional(),
  status: DentalImagingModuleCephLandmarkStatusSchema.optional()
});

export const DentalImagingModuleBatchUpsertLandmarksBodySchema = z.object({
  landmarks: z.array(DentalImagingModuleCephLandmarkInputSchema)
});

export const DentalImagingModuleCalibrationPointSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const DentalImagingModuleCbctViewerLinkResponseSchema = z.object({
  viewerKind: z.enum(["download"]),
  downloadUrl: z.string(),
  expiresAt: z.string().datetime().transform((str) => new Date(str)),
  isVolume: z.boolean(),
  frameCount: z.union([z.number().int(), z.null()])
});

export const DentalImagingModuleCephAnalysisSchema = z.object({
  imageId: z.string(),
  analysisType: z.string(),
  measurements: z.record(z.string(), z.unknown()),
  missing: z.array(z.string()),
  uncalibrated: z.boolean(),
  calibrationValue: z.union([z.number(), z.null()]),
  calibrationMethod: z.union([z.enum(["dicom_tag", "manual_ruler", "assumed_default", "not_calibrated"]), z.null()]),
  calibratedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  calibratedBy: z.union([z.string(), z.null()]),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalImagingModuleCephCalibrationMethodSchema = z.enum(["dicom_tag", "manual_ruler", "assumed_default", "not_calibrated"]);

export const DentalImagingModuleCephDetectionStatusSchema = z.enum(["pending", "succeeded", "failed"]);

export const DentalImagingModuleCephLandmarkSchema = z.object({
  id: z.string(),
  imageId: z.string(),
  landmarkCode: DentalImagingModuleCephLandmarkCodeSchema,
  x: z.number(),
  y: z.number(),
  source: DentalImagingModuleCephLandmarkSourceSchema,
  confidence: z.union([z.number(), z.null()]),
  status: DentalImagingModuleCephLandmarkStatusSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalImagingModuleCephLandmarkDeltaSchema = z.object({
  landmarkCode: z.string(),
  dxPx: z.number(),
  dyPx: z.number(),
  magnitudePx: z.number(),
  dxMm: z.union([z.number(), z.null()]),
  dyMm: z.union([z.number(), z.null()]),
  magnitudeMm: z.union([z.number(), z.null()]),
  directionDeg: z.number()
});

export const DentalImagingModuleCephLandmarkPredictionSchema = z.object({
  landmarkCode: DentalImagingModuleCephLandmarkCodeSchema,
  x: z.number(),
  y: z.number(),
  confidence: z.number()
});

export const DentalImagingModuleCephLandmarkDetectionResultSchema = z.object({
  jobId: z.string(),
  status: DentalImagingModuleCephDetectionStatusSchema,
  modelVersion: z.string(),
  provider: z.string(),
  predictions: z.array(DentalImagingModuleCephLandmarkPredictionSchema),
  items: z.array(DentalImagingModuleCephLandmarkSchema),
  analysis: DentalImagingModuleCephAnalysisSchema,
  error: z.string().optional()
});

export const DentalImagingModuleCephLandmarkListResponseSchema = z.object({
  items: z.array(DentalImagingModuleCephLandmarkSchema),
  analysis: DentalImagingModuleCephAnalysisSchema
});

export const DentalImagingModuleCephMetricDeltaSchema = z.object({
  metric: z.string(),
  from: z.union([z.number(), z.null()]),
  to: z.union([z.number(), z.null()]),
  delta: z.union([z.number(), z.null()])
});

export const DentalImagingModuleCephReportSchema = z.object({
  id: z.string(),
  imageId: z.string(),
  version: z.number().int(),
  snapshot: z.record(z.string(), z.unknown()),
  revisionOf: z.union([z.string(), z.null()]),
  revisionReason: z.union([z.string(), z.null()]),
  createdAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalImagingModuleCephSimilarityTransformSchema = z.object({
  scale: z.number(),
  rotationRad: z.number(),
  tx: z.number(),
  ty: z.number(),
  basis: z.array(z.string())
});

export const DentalImagingModuleCephSuperimpositionReferenceSchema = z.enum(["cranial_base", "maxillary", "mandibular"]);

export const DentalImagingModuleCephSuperimpositionSchema = z.object({
  id: z.union([z.string(), z.null()]),
  patientId: z.string(),
  reportFromId: z.string(),
  reportToId: z.string(),
  reference: DentalImagingModuleCephSuperimpositionReferenceSchema,
  transform: DentalImagingModuleCephSimilarityTransformSchema,
  landmarkDeltas: z.array(DentalImagingModuleCephLandmarkDeltaSchema),
  metricDeltas: z.array(DentalImagingModuleCephMetricDeltaSchema),
  uncalibrated: z.boolean(),
  calibrationBasis: z.record(z.string(), z.unknown()),
  label: z.string(),
  createdAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalImagingModuleCephSuperimpositionInputSchema = z.object({
  reportFromId: z.string(),
  reportToId: z.string(),
  reference: DentalImagingModuleCephSuperimpositionReferenceSchema
});

export const DentalImagingModuleCephSuperimpositionListResponseSchema = z.object({
  items: z.array(DentalImagingModuleCephSuperimpositionSchema)
});

export const DentalImagingModuleCreateCephReportBodySchema = z.object({
  analysisType: z.string().optional(),
  normPopulation: z.string().optional(),
  revisionReason: z.string().optional()
});

export const DentalImagingModuleImagingFindingTypeSchema = z.enum(["caries", "secondary_caries", "bone_loss", "furcation_involvement", "periapical_lesion", "root_resorption", "calculus", "crown_fracture", "root_fracture", "impacted_tooth", "over_eruption", "open_contact", "overhang", "crown_needed", "implant_needed"]);

export const DentalImagingModuleImagingFindingStatusSchema = z.enum(["draft", "confirmed", "resolved"]);

export const DentalImagingModuleCreateFindingBodySchema = z.object({
  type: DentalImagingModuleImagingFindingTypeSchema,
  status: DentalImagingModuleImagingFindingStatusSchema.optional(),
  toothNumber: z.number().int().optional(),
  surfaces: z.array(z.string()).optional(),
  note: z.string().optional(),
  annotationId: z.string().optional(),
  treatmentId: z.string().optional(),
  visitId: z.string().optional(),
  patientId: z.string().optional(),
  branchId: z.string().optional(),
  frameIndex: z.number().int().optional()
});

export const DentalImagingModuleCreateImagingLinkBodySchema = z.object({
  linkType: z.enum(["treatment_plan", "ortho_case", "report"]),
  targetId: z.string()
});

export const DentalImagingModuleModalityEnumSchema = z.enum(["periapical", "bitewing", "panoramic", "cephalometric", "cbct", "intraoral_photo", "extraoral_photo", "other"]);

export const DentalImagingModuleCreateImagingStudyBodySchema = z.object({
  patientId: z.string(),
  visitId: z.string().optional(),
  branchId: z.string(),
  modality: DentalImagingModuleModalityEnumSchema.optional(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  toothNumbers: z.array(z.number().int()).optional(),
  sequenceNumber: z.number().int().optional(),
  pixelSpacingMm: z.number().optional()
});

export const DentalImagingModuleImagingStudySchema = z.object({
  id: z.string(),
  patientId: z.string(),
  visitId: z.union([z.string(), z.null()]),
  branchId: z.string(),
  acquiredBy: z.string(),
  modality: DentalImagingModuleModalityEnumSchema,
  status: z.enum(["active", "archived"]),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalImagingModuleImagingStudyImageSchema = z.object({
  id: z.string(),
  studyId: z.string(),
  fileId: z.string(),
  pixelSpacingMm: z.union([z.number(), z.null()]),
  sequenceNumber: z.number().int(),
  dicomMetadata: z.union([z.record(z.string(), z.unknown()), z.null()]),
  modality: DentalImagingModuleModalityEnumSchema,
  status: z.enum(["active", "archived"]),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  isVolume: z.boolean().optional(),
  sliceThicknessMm: z.union([z.number(), z.null()]).optional(),
  frameCount: z.union([z.number().int(), z.null()]).optional(),
  seriesInstanceUid: z.union([z.string(), z.null()]).optional(),
  studyInstanceUid: z.union([z.string(), z.null()]).optional(),
  viewerKind: z.enum(["image", "volume"]).optional(),
  isDiagnostic: z.boolean().optional(),
  qualityStatus: z.enum(["ok", "retake"]).optional(),
  retakeReason: z.union([z.string(), z.null()]).optional(),
  tags: z.array(z.string()).optional()
});

export const DentalImagingModuleCreateImagingStudyResponseSchema = z.object({
  study: DentalImagingModuleImagingStudySchema,
  image: DentalImagingModuleImagingStudyImageSchema,
  uploadUrl: z.string(),
  uploadMethod: z.string(),
  fileId: z.string(),
  expiresAt: z.string().datetime().transform((str) => new Date(str)),
  uploadId: z.string().optional(),
  partSize: z.number().int().optional(),
  partCount: z.number().int().optional(),
  partUrls: z.array(z.string()).optional()
});

export const DentalImagingModuleCreateMeasurementBodySchema = z.object({
  type: z.enum(["distance", "angle", "area"]),
  geometry: z.record(z.string(), z.unknown()),
  measurementValue: z.number().optional(),
  measurementUnit: z.string().optional()
});

export const DentalImagingModuleFinalizeCbctStudyBodySchema = z.object({
  imageId: z.string(),
  dicomBase64: z.string()
});

export const DentalImagingModuleFinalizeCbctStudyResponseSchema = z.object({
  image: DentalImagingModuleImagingStudyImageSchema
});

export const DentalImagingModuleImagingAnnotationSchema = z.object({
  id: z.string(),
  imageId: z.string(),
  type: z.enum(["line", "angle", "area", "label", "arrow", "freehand", "shape", "tooth"]),
  geometry: z.record(z.string(), z.unknown()),
  measurementValue: z.union([z.number(), z.null()]),
  measurementUnit: z.union([z.string(), z.null()]),
  toothNumber: z.union([z.number().int(), z.null()]),
  visible: z.boolean(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalImagingModuleImagingFindingSchema = z.object({
  id: z.string(),
  imageId: z.string(),
  annotationId: z.union([z.string(), z.null()]),
  treatmentId: z.union([z.string(), z.null()]),
  visitId: z.string(),
  patientId: z.string(),
  branchId: z.string(),
  type: DentalImagingModuleImagingFindingTypeSchema,
  status: DentalImagingModuleImagingFindingStatusSchema,
  toothNumber: z.union([z.number().int(), z.null()]),
  surfaces: z.union([z.array(z.string()), z.null()]),
  note: z.union([z.string(), z.null()]),
  frameIndex: z.union([z.number().int(), z.null()]).optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalImagingModuleImagingFindingListResponseSchema = z.object({
  items: z.array(DentalImagingModuleImagingFindingSchema)
});

export const DentalImagingModuleImagingLinkSchema = z.object({
  id: z.string(),
  imageId: z.string(),
  linkType: z.enum(["treatment_plan", "ortho_case", "report"]),
  targetId: z.string(),
  createdAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalImagingModuleImagingLinkListResponseSchema = z.object({
  items: z.array(DentalImagingModuleImagingLinkSchema)
});

export const DentalImagingModuleImagingStudyWithImagesSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  visitId: z.union([z.string(), z.null()]),
  branchId: z.string(),
  acquiredBy: z.string(),
  modality: DentalImagingModuleModalityEnumSchema,
  status: z.enum(["active", "archived"]),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  images: z.array(DentalImagingModuleImagingStudyImageSchema)
});

export const DentalImagingModulePatientImageItemSchema = z.object({
  id: z.string(),
  source: z.enum(["imaging", "legacy"]),
  modality: DentalImagingModuleModalityEnumSchema,
  fileName: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int(),
  studyId: z.union([z.string(), z.null()]),
  visitId: z.union([z.string(), z.null()]),
  toothNumbers: z.array(z.number().int()),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  downloadUrl: z.union([z.string(), z.null()]),
  isVolume: z.boolean().optional(),
  frameCount: z.union([z.number().int(), z.null()]).optional(),
  viewerKind: z.enum(["image", "volume"]).optional(),
  isDiagnostic: z.boolean().optional(),
  qualityStatus: z.enum(["ok", "retake"]).optional(),
  retakeReason: z.union([z.string(), z.null()]).optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(DentalImagingModuleImagingLinkSchema).optional()
});

export const DentalImagingModuleListPatientImagesResponseSchema = z.object({
  items: z.array(DentalImagingModulePatientImageItemSchema),
  total: z.number().int()
});

export const DentalImagingModuleMeasurementListResponseSchema = z.object({
  items: z.array(DentalImagingModuleImagingAnnotationSchema)
});

export const DentalImagingModuleUpdateCalibrationBodySchema = z.object({
  pixelSpacingMm: z.number(),
  pointA: DentalImagingModuleCalibrationPointSchema.optional(),
  pointB: DentalImagingModuleCalibrationPointSchema.optional(),
  knownDistanceMm: z.number().optional()
});

export const DentalImagingModuleUpdateFindingBodySchema = z.object({
  type: DentalImagingModuleImagingFindingTypeSchema.optional(),
  status: DentalImagingModuleImagingFindingStatusSchema.optional(),
  toothNumber: z.number().int().optional(),
  surfaces: z.array(z.string()).optional(),
  note: z.string().optional(),
  treatmentId: z.string().optional()
});

export const DentalImagingModuleUpdateImageMetadataBodySchema = z.object({
  isDiagnostic: z.boolean().optional(),
  qualityStatus: z.enum(["ok", "retake"]).optional(),
  retakeReason: z.union([z.string(), z.null()]).optional(),
  tags: z.array(z.string()).optional()
});

export const DentalImagingModuleUpdateImageModalityBodySchema = z.object({
  modality: DentalImagingModuleModalityEnumSchema
});

export const DentalImagingModuleUpdateLandmarkBodySchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  status: DentalImagingModuleCephLandmarkStatusSchema.optional()
});

export const DentalInvoiceStatusSchema = z.enum(["draft", "issued", "partial", "paid", "overdue", "voided", "uncollectible"]);

export const DentalInvoiceSchema = z.object({
  id: UUIDSchema,
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  branchId: UUIDSchema,
  dentistMemberId: UUIDSchema,
  invoiceNumber: z.string(),
  status: DentalInvoiceStatusSchema,
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  taxCents: z.number().int(),
  taxRate: z.number(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceCents: z.number().int(),
  dueDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  issuedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  paidAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  voidedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalLegalHoldModuleLegalHoldSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  branchId: z.union([z.string().uuid(), z.null()]),
  subjectPersonId: z.string().uuid(),
  name: z.string(),
  reason: z.string(),
  status: z.enum(["active", "released"]),
  initiatedBy: z.string().uuid(),
  releasedBy: z.union([z.string().uuid(), z.null()]),
  releasedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  note: z.union([z.string(), z.null()])
});

export const DentalLegalHoldModuleLegalHoldStatusSchema = z.enum(["active", "released"]);

export const DentalLegalHoldModulePlaceLegalHoldRequestSchema = z.object({
  tenantId: UUIDSchema,
  subjectPersonId: UUIDSchema,
  branchId: UUIDSchema.optional(),
  name: z.string(),
  reason: z.string(),
  note: z.string().optional()
});

export const DentalOrgModuleDentalBranchSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120),
  address: z.string().max(255).optional(),
  city: z.string().max(80).optional(),
  timezone: z.string().max(64),
  workingHours: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean()
});

export const DentalOrgModuleBranchListSchema = z.object({
  items: z.array(DentalOrgModuleDentalBranchSchema),
  total: z.number().int()
});

export const DentalOrgModuleCreateBranchRequestSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string(),
  workingHours: z.string().optional(),
  phone: z.string().optional()
});

export const DentalOrgModuleCreateDentalConsentTemplateRequestSchema = z.object({
  name: z.string(),
  body: z.string(),
  requiresWitnessSignature: z.boolean().optional()
});

export const DentalOrgModuleCreateFlatMemberRequestSchema = z.object({
  displayName: z.string(),
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]),
  personId: z.string().uuid().optional(),
  avatarUrl: z.string().optional()
});

export const DentalOrgModuleCreateMembershipRequestSchema = z.object({
  personId: z.string().uuid().optional(),
  displayName: z.string(),
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]),
  avatarUrl: z.string().optional()
});

export const DentalOrgModuleCreateOrganizationRequestSchema = z.object({
  name: z.string(),
  tier: z.enum(["solo", "clinic", "group", "enterprise"]),
  countryCode: z.string()
});

export const DentalOrgModuleDashboardLabOrderSummarySchema = z.object({
  totalPending: z.number().int(),
  ordered: z.number().int(),
  inFabrication: z.number().int(),
  overdueDelivery: z.number().int()
});

export const DentalOrgModuleDashboardPaymentPlanSummarySchema = z.object({
  count: z.number().int(),
  behindCount: z.number().int(),
  totalOutstandingCents: z.number().int()
});

export const DentalOrgModuleDashboardSummaryResponseSchema = z.object({
  activePaymentPlans: z.object({
  count: z.number().int(),
  behindCount: z.number().int(),
  totalOutstandingCents: z.number().int()
}),
  labOrders: z.object({
  totalPending: z.number().int(),
  ordered: z.number().int(),
  inFabrication: z.number().int(),
  overdueDelivery: z.number().int()
})
});

export const DentalOrgModuleDeactivateMembershipRequestSchema = z.object({
  reason: z.string().optional()
});

export const DentalOrgModuleDentalBranchSettingsSchema = z.object({
  branchId: z.string().uuid(),
  settings: z.record(z.string(), z.unknown())
});

export const DentalOrgModuleDentalConsentTemplateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  name: z.string(),
  body: z.string(),
  requiresWitnessSignature: z.boolean(),
  active: z.boolean()
});

export const DentalOrgModuleDentalMembershipSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(80),
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]),
  pinHash: z.string().optional(),
  pinLockedUntil: z.string().datetime().transform((str) => new Date(str)).optional(),
  pinFailedAttempts: z.number().int(),
  status: z.enum(["active", "inactive"]),
  avatarUrl: z.string().optional(),
  licenseNumber: z.string().max(64).optional(),
  npi: z.string().regex(/^\d{10}$/).optional(),
  credentialType: z.string().max(32).optional(),
  licenseExpiry: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const DentalOrgModuleDentalOrganizationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  tier: z.enum(["solo", "clinic", "group", "enterprise"]),
  ownerPersonId: z.string().uuid(),
  countryCode: z.string().max(2),
  active: z.boolean(),
  status: z.enum(["provisional", "live", "suspended"])
});

export const DentalOrgModuleDentalWorkingHoursDaySchema = z.object({
  enabled: z.boolean(),
  open: z.string().optional(),
  close: z.string().optional()
});

export const DentalOrgModuleDentalWorkingHoursSchema = z.object({
  monday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  tuesday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  wednesday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  thursday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  friday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  saturday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  sunday: DentalOrgModuleDentalWorkingHoursDaySchema.optional()
});

export const DentalOrgModuleDentalWorkingHoursResponseSchema = z.object({
  branchId: z.string().uuid(),
  workingHours: z.union([z.object({
  monday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  tuesday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  wednesday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  thursday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  friday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  saturday: DentalOrgModuleDentalWorkingHoursDaySchema.optional(),
  sunday: DentalOrgModuleDentalWorkingHoursDaySchema.optional()
}), z.null()])
});

export const DentalOrgModuleImagingTierSchema = z.enum(["free", "basic", "addon"]);

export const DentalOrgModuleMemberRoleSchema = z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]);

export const DentalOrgModuleMemberStatusSchema = z.enum(["active", "inactive"]);

export const DentalOrgModuleOnboardingRequestSchema = z.object({
  organizationName: z.string().min(1).max(120),
  tier: z.enum(["solo", "clinic", "group", "enterprise"]),
  countryCode: z.string().max(2),
  branchName: z.string().max(120).optional(),
  timezone: z.string().max(64).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  ownerDisplayName: z.string().max(80).optional()
});

export const DentalOrgModuleOnboardingResponseSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  membershipId: z.string().uuid()
});

export const DentalOrgModuleOrgContextBranchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  timezone: z.string()
});

export const DentalOrgModuleOrgContextMemberSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]),
  displayName: z.string()
});

export const DentalOrgModuleOrgContextOrgSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tier: z.string(),
  status: z.enum(["provisional", "live", "suspended"])
});

export const DentalOrgModuleOrgContextResponseSchema = z.object({
  org: z.union([z.object({
  id: z.string().uuid(),
  name: z.string(),
  tier: z.string(),
  status: z.enum(["provisional", "live", "suspended"])
}), z.null()]),
  branch: z.union([z.object({
  id: z.string().uuid(),
  name: z.string(),
  timezone: z.string()
}), z.null()]),
  member: z.union([z.object({
  id: z.string().uuid(),
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]),
  displayName: z.string()
}), z.null()])
});

export const DentalOrgModuleOrgStatusSchema = z.enum(["provisional", "live", "suspended"]);

export const DentalOrgModuleOrgTierSchema = z.enum(["solo", "clinic", "group", "enterprise"]);

export const DentalOrgModulePermissionCatalogEntrySchema = z.object({
  feature: z.string(),
  label: z.string(),
  category: z.string(),
  defaultAllowedRoles: z.array(DentalOrgModuleMemberRoleSchema)
});

export const DentalOrgModulePermissionGridCellSchema = z.object({
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]),
  feature: z.string(),
  allowed: z.boolean(),
  source: z.string()
});

export const DentalOrgModulePermissionGridResponseSchema = z.object({
  organizationId: z.string().uuid(),
  catalog: z.array(DentalOrgModulePermissionCatalogEntrySchema),
  cells: z.array(DentalOrgModulePermissionGridCellSchema)
});

export const DentalOrgModulePermissionOverrideInputSchema = z.object({
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]),
  feature: z.string(),
  allowed: z.boolean()
});

export const DentalOrgModuleRecoverPinRequestSchema = z.object({
  securityQuestion: z.string(),
  answer: z.string()
});

export const DentalOrgModuleRecoverPinResponseSchema = z.object({
  success: z.boolean(),
  temporaryPin: z.string().optional()
});

export const DentalOrgModuleResetMemberPinRequestSchema = z.object({
  newPin: z.string().regex(/^\d{6}$/).min(6).max(6)
});

export const DentalOrgModuleSetPinRequestSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/).min(4).max(8)
});

export const DentalOrgModuleSetSecurityQuestionRequestSchema = z.object({
  question: z.string(),
  answer: z.string()
});

export const DentalOrgModuleUpdateDentalBranchSettingsRequestSchema = z.record(z.string(), z.unknown());

export const DentalOrgModuleUpdateDentalConsentTemplateRequestSchema = z.object({
  name: z.string().optional(),
  body: z.string().optional(),
  requiresWitnessSignature: z.boolean().optional()
});

export const DentalOrgModuleUpdateMemberRequestSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  role: z.enum(["dentist_owner", "dentist_associate", "hygienist", "staff_full", "staff_scheduling", "dental_assistant", "front_desk", "billing_staff", "treatment_coordinator", "read_only"]).optional(),
  avatarUrl: z.union([z.string(), z.null()]).optional(),
  licenseNumber: z.union([z.string().max(64), z.null()]).optional(),
  npi: z.union([z.string().regex(/^\d{10}$/), z.null()]).optional(),
  credentialType: z.union([z.string().max(32), z.null()]).optional(),
  licenseExpiry: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]).optional()
});

export const DentalOrgModuleUpdateOrganizationRequestSchema = z.object({
  name: z.string().optional(),
  tier: z.enum(["solo", "clinic", "group", "enterprise"]).optional(),
  countryCode: z.string().optional(),
  imagingTier: z.enum(["free", "basic", "addon"]).optional()
});

export const DentalOrgModuleUpdatePermissionsRequestSchema = z.object({
  overrides: z.array(DentalOrgModulePermissionOverrideInputSchema)
});

export const DentalOrgModuleUpdateWorkingHoursRequestSchema = z.object({
  workingHours: DentalOrgModuleDentalWorkingHoursSchema
});

export const DentalOrgModuleVerifyPinRequestSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/).min(4).max(8)
});

export const DentalOrgModuleVerifyPinResponseSchema = z.object({
  success: z.boolean(),
  failedAttempts: z.number().int(),
  lockedUntil: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const DentalPatientEngagementModuleCreateDentalAlertRequestSchema = z.object({
  alertType: z.enum(["gag_reflex", "latex_allergy", "needle_phobia", "dental_anxiety", "tmj_disorder", "excessive_salivation", "dry_socket_history", "bisphosphonate_use", "bleeding_disorder", "other"]),
  severity: z.enum(["low", "medium", "high"]).optional(),
  description: z.string().optional()
});

export const DentalPatientEngagementModuleCreatePatientContactRequestSchema = z.object({
  name: z.string(),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isGuardian: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  notes: z.string().optional()
});

export const DentalPatientEngagementModuleCreateRecallRequestSchema = z.object({
  type: z.enum(["cleaning", "checkup", "treatment", "other"]),
  dueDate: z.string(),
  intervalMonths: z.number().int().optional(),
  notes: z.string().optional()
});

export const DentalPatientEngagementModuleCreateTaskRequestSchema = z.object({
  title: z.string(),
  taskType: z.enum(["follow_up", "lab_order", "referral", "prescription", "other"]),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().uuid().optional()
});

export const DentalPatientEngagementModuleDentalAlertSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  alertType: z.enum(["gag_reflex", "latex_allergy", "needle_phobia", "dental_anxiety", "tmj_disorder", "excessive_salivation", "dry_socket_history", "bisphosphonate_use", "bleeding_disorder", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  description: z.union([z.string(), z.null()]),
  active: z.boolean()
});

export const DentalPatientEngagementModuleDentalAlertSeveritySchema = z.enum(["low", "medium", "high"]);

export const DentalPatientEngagementModuleDentalAlertTypeSchema = z.enum(["gag_reflex", "latex_allergy", "needle_phobia", "dental_anxiety", "tmj_disorder", "excessive_salivation", "dry_socket_history", "bisphosphonate_use", "bleeding_disorder", "other"]);

export const DentalPatientEngagementModulePatientContactSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  name: z.string(),
  relationship: z.union([z.string(), z.null()]),
  phone: z.union([z.string(), z.null()]),
  email: z.union([z.string(), z.null()]),
  isGuardian: z.boolean(),
  isEmergencyContact: z.boolean(),
  notes: z.union([z.string(), z.null()]),
  deletedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalPatientEngagementModulePatientTaskSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  title: z.string(),
  description: z.union([z.string(), z.null()]),
  taskType: z.enum(["follow_up", "lab_order", "referral", "prescription", "other"]),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
  dueDate: z.union([z.string(), z.null()]),
  assignedTo: z.union([z.string().uuid(), z.null()]),
  completedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalPatientEngagementModuleRecallSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  type: z.enum(["cleaning", "checkup", "treatment", "other"]),
  dueDate: z.string(),
  status: z.enum(["pending", "sent", "completed", "cancelled"]),
  notes: z.union([z.string(), z.null()]),
  intervalMonths: z.union([z.number().int(), z.null()]),
  sentAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  lastSentAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  sendAttempts: z.number().int(),
  completedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalPatientEngagementModuleRecallDueItemSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  patientName: z.string(),
  type: z.enum(["cleaning", "checkup", "treatment", "other"]),
  dueDate: z.string(),
  status: z.enum(["pending", "sent", "completed", "cancelled"]),
  intervalMonths: z.union([z.number().int(), z.null()]),
  sendAttempts: z.number().int(),
  lastSentAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalPatientEngagementModuleRecallStatusSchema = z.enum(["pending", "sent", "completed", "cancelled"]);

export const DentalPatientEngagementModuleRecallTypeSchema = z.enum(["cleaning", "checkup", "treatment", "other"]);

export const DentalPatientEngagementModuleTaskStatusSchema = z.enum(["open", "in_progress", "done", "cancelled"]);

export const DentalPatientEngagementModuleTaskTypeSchema = z.enum(["follow_up", "lab_order", "referral", "prescription", "other"]);

export const DentalPatientEngagementModuleUpdateDentalAlertRequestSchema = z.object({
  alertType: z.enum(["gag_reflex", "latex_allergy", "needle_phobia", "dental_anxiety", "tmj_disorder", "excessive_salivation", "dry_socket_history", "bisphosphonate_use", "bleeding_disorder", "other"]).optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  description: z.string().optional(),
  active: z.boolean().optional()
});

export const DentalPatientEngagementModuleUpdatePatientContactRequestSchema = z.object({
  name: z.string().optional(),
  relationship: z.union([z.string(), z.null()]).optional(),
  phone: z.union([z.string(), z.null()]).optional(),
  email: z.union([z.string(), z.null()]).optional(),
  isGuardian: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  notes: z.union([z.string(), z.null()]).optional()
});

export const DentalPatientEngagementModuleUpdateRecallRequestSchema = z.object({
  type: z.enum(["cleaning", "checkup", "treatment", "other"]).optional(),
  dueDate: z.string().optional(),
  intervalMonths: z.number().int().optional(),
  status: z.enum(["pending", "sent", "completed", "cancelled"]).optional(),
  notes: z.string().optional()
});

export const DentalPatientEngagementModuleUpdateTaskRequestSchema = z.object({
  title: z.string().optional(),
  taskType: z.enum(["follow_up", "lab_order", "referral", "prescription", "other"]).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional()
});

export const DentalPatientFinanceModuleAcceptCasePresentationRequestSchema = z.object({
  signerName: z.string().min(1),
  signatureData: z.string().min(1)
});

export const DentalPatientFinanceModuleAcceptCasePresentationResultSchema = z.object({
  presentation: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  treatmentPlanId: z.string().uuid(),
  planVersionId: z.union([z.string().uuid(), z.null()]),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired", "revoked"]),
  decision: z.union([z.enum(["accepted", "rejected"]), z.null()]),
  decisionAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  signerName: z.union([z.string(), z.null()]),
  consentFormId: z.union([z.string().uuid(), z.null()]),
  rejectionReason: z.union([z.string(), z.null()]),
  firstViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  lastViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
}),
  plan: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  status: z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]),
  totalEstimateCents: z.number().int(),
  notes: z.union([z.string(), z.null()]),
  cdtCodeSetYear: z.number().int(),
  presentedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  approvedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
}),
  consentFormId: z.string().uuid()
});

export const DentalPatientFinanceModuleAcceptTreatmentOptionRequestSchema = z.object({
  chosenTreatmentId: z.string().uuid()
});

export const DentalPatientFinanceModuleTreatmentOptionSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  recommended: z.boolean()
});

export const DentalPatientFinanceModuleAcceptTreatmentOptionResultSchema = z.object({
  optionGroupId: z.string().uuid(),
  chosenTreatmentId: z.string().uuid(),
  options: z.array(DentalPatientFinanceModuleTreatmentOptionSchema)
});

export const DentalPatientFinanceModuleAddHouseholdMemberRequestSchema = z.object({
  patientId: z.string().uuid(),
  relationship: z.string().optional()
});

export const DentalPatientFinanceModuleApproveTreatmentPlanRequestSchema = z.object({
  approvedByPersonId: z.string().uuid(),
  method: z.enum(["signature", "verbal", "portal"]),
  consentFormId: z.string().uuid().optional(),
  planVersionId: z.string().uuid().optional(),
  signatureData: z.string().optional()
});

export const DentalPatientFinanceModuleAttachTreatmentAppointmentRequestSchema = z.object({
  appointmentId: z.string().uuid()
});

export const DentalPatientFinanceModuleCasePresentationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  treatmentPlanId: z.string().uuid(),
  planVersionId: z.union([z.string().uuid(), z.null()]),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired", "revoked"]),
  decision: z.union([z.enum(["accepted", "rejected"]), z.null()]),
  decisionAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  signerName: z.union([z.string(), z.null()]),
  consentFormId: z.union([z.string().uuid(), z.null()]),
  rejectionReason: z.union([z.string(), z.null()]),
  firstViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  lastViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalPatientFinanceModuleCasePresentationLineItemSchema = z.object({
  id: z.string().uuid(),
  toothNumber: z.union([z.number().int(), z.null()]),
  surfaces: z.union([z.array(z.string()), z.null()]),
  description: z.string(),
  cdtCode: z.string(),
  status: z.string(),
  priceCents: z.number().int(),
  optionGroupId: z.union([z.string().uuid(), z.null()]),
  recommended: z.boolean()
});

export const DentalPatientFinanceModuleCasePresentationPhaseSchema = z.object({
  phase: z.union([z.string(), z.null()]),
  items: z.array(DentalPatientFinanceModuleCasePresentationLineItemSchema),
  subtotalCents: z.number().int()
});

export const DentalPatientFinanceModuleCasePresentationOptionGroupSchema = z.object({
  optionGroupId: z.string().uuid(),
  options: z.array(DentalPatientFinanceModuleCasePresentationLineItemSchema)
});

export const DentalPatientFinanceModuleCasePresentationImageRefSchema = z.object({
  id: z.string().uuid(),
  imageType: z.string(),
  toothNumber: z.union([z.number().int(), z.null()]),
  findingCount: z.number().int()
});

export const DentalPatientFinanceModuleCasePresentationAggregateSchema = z.object({
  presentation: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  treatmentPlanId: z.string().uuid(),
  planVersionId: z.union([z.string().uuid(), z.null()]),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired", "revoked"]),
  decision: z.union([z.enum(["accepted", "rejected"]), z.null()]),
  decisionAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  signerName: z.union([z.string(), z.null()]),
  consentFormId: z.union([z.string().uuid(), z.null()]),
  rejectionReason: z.union([z.string(), z.null()]),
  firstViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  lastViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
}),
  plan: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  status: z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]),
  totalEstimateCents: z.number().int(),
  notes: z.union([z.string(), z.null()]),
  cdtCodeSetYear: z.number().int(),
  presentedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  approvedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
}),
  patientFirstName: z.string(),
  phases: z.array(DentalPatientFinanceModuleCasePresentationPhaseSchema),
  optionGroups: z.array(DentalPatientFinanceModuleCasePresentationOptionGroupSchema),
  images: z.array(DentalPatientFinanceModuleCasePresentationImageRefSchema),
  grandTotalCents: z.number().int()
});

export const DentalPatientFinanceModuleCasePresentationDecisionSchema = z.enum(["accepted", "rejected"]);

export const DentalPatientFinanceModuleCasePresentationStatusSchema = z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired", "revoked"]);

export const DentalPatientFinanceModuleClaimDraftSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  insuranceProfileId: z.string().uuid(),
  visitId: z.union([z.string().uuid(), z.null()]),
  cdtCode: z.string(),
  icd10Code: z.union([z.string(), z.null()]),
  diagnosisDescription: z.union([z.string(), z.null()]),
  feeAmountCents: z.number().int(),
  status: z.enum(["draft", "ready", "submitted", "accepted", "rejected"]),
  submittedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  notes: z.union([z.string(), z.null()])
});

export const DentalPatientFinanceModuleClaimDraftStatusSchema = z.enum(["draft", "ready", "submitted", "accepted", "rejected"]);

export const DentalPatientFinanceModuleClaimReadinessSchema = z.object({
  claimId: z.string().uuid(),
  hasCdtCode: z.boolean(),
  hasIcd10Code: z.boolean(),
  hasInsuranceProfile: z.boolean(),
  hasFee: z.boolean(),
  ready: z.boolean()
});

export const DentalPatientFinanceModuleCoverageAuthStatusSchema = z.enum(["requested", "approved", "partial", "denied", "expired"]);

export const DentalPatientFinanceModuleCoveredProcedureSchema = z.object({
  cdtCode: z.string(),
  approvedAmountCents: z.number().int().optional(),
  note: z.string().optional()
});

export const DentalPatientFinanceModuleCoverageAuthorizationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  insuranceProfileId: z.string().uuid(),
  branchId: z.string().uuid(),
  visitId: z.union([z.string().uuid(), z.null()]),
  treatmentPlanId: z.union([z.string().uuid(), z.null()]),
  loaNumber: z.union([z.string(), z.null()]),
  status: z.enum(["requested", "approved", "partial", "denied", "expired"]),
  approvedAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }), z.null()]),
  validUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }), z.null()]),
  approvedAmountCents: z.union([z.number().int(), z.null()]),
  coveredProcedures: z.union([z.array(DentalPatientFinanceModuleCoveredProcedureSchema), z.null()]),
  attachmentFileId: z.union([z.string().uuid(), z.null()]),
  notes: z.union([z.string(), z.null()])
});

export const DentalPatientFinanceModuleCreateCasePresentationRequestSchema = z.object({
  treatmentPlanId: z.string().uuid(),
  planVersionId: z.string().uuid().optional()
});

export const DentalPatientFinanceModuleCreateClaimDraftRequestSchema = z.object({
  insuranceProfileId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  cdtCode: z.string().min(1),
  icd10Code: z.string().optional(),
  diagnosisDescription: z.string().optional(),
  feeAmountCents: z.number().int().gte(0),
  notes: z.string().optional()
});

export const DentalPatientFinanceModuleCreateCoverageAuthorizationRequestSchema = z.object({
  insuranceProfileId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  treatmentPlanId: z.string().uuid().optional(),
  loaNumber: z.string().optional(),
  status: z.enum(["requested", "approved", "partial", "denied", "expired"]).optional(),
  approvedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  approvedAmountCents: z.number().int().gte(0).optional(),
  coveredProcedures: z.array(DentalPatientFinanceModuleCoveredProcedureSchema).optional(),
  attachmentFileId: z.string().uuid().optional(),
  notes: z.string().optional()
});

export const DentalPatientFinanceModuleCreateHouseholdRequestSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  guarantorPatientId: z.string().uuid(),
  notes: z.string().optional()
});

export const DentalPatientFinanceModuleCreateInsuranceProfileRequestSchema = z.object({
  insurerName: z.string().min(1),
  policyNumber: z.string().min(1),
  groupNumber: z.string().optional(),
  subscriberName: z.string().min(1),
  subscriberDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relationship: z.enum(["self", "spouse", "child", "other"]).optional(),
  notes: z.string().optional(),
  payerType: z.enum(["hmo", "philhealth", "corporate", "self_pay_assist", "other"]).optional(),
  accredited: z.boolean().optional(),
  annualLimitCents: z.number().int().gte(0).optional(),
  annualLimitUsedCents: z.number().int().gte(0).optional()
});

export const DentalPatientFinanceModuleCreateSyncLogRequestSchema = z.object({
  localId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  serverId: z.string().optional(),
  branchId: z.string().optional()
});

export const DentalPatientFinanceModuleCreateTreatmentPlanRequestSchema = z.object({
  providerId: z.string().uuid(),
  totalEstimateCents: z.number().int().gte(0).optional(),
  notes: z.string().optional(),
  cdtCodeSetYear: z.number().int().gte(2000).lte(2100).optional()
});

export const DentalPatientFinanceModuleHouseholdSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  name: z.string(),
  guarantorPatientId: z.string().uuid(),
  notes: z.union([z.string(), z.null()])
});

export const DentalPatientFinanceModuleHouseholdMemberSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  householdId: z.string().uuid(),
  patientId: z.string().uuid(),
  relationship: z.string(),
  isGuarantor: z.boolean()
});

export const DentalPatientFinanceModuleHouseholdWithMembersSchema = z.object({
  household: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  name: z.string(),
  guarantorPatientId: z.string().uuid(),
  notes: z.union([z.string(), z.null()])
}),
  members: z.array(DentalPatientFinanceModuleHouseholdMemberSchema)
});

export const DentalPatientFinanceModuleInsuranceProfileSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  insurerName: z.string(),
  policyNumber: z.string(),
  groupNumber: z.union([z.string(), z.null()]),
  subscriberName: z.string(),
  subscriberDob: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }), z.null()]),
  relationship: z.string(),
  active: z.boolean(),
  notes: z.union([z.string(), z.null()]),
  payerType: z.enum(["hmo", "philhealth", "corporate", "self_pay_assist", "other"]),
  accredited: z.union([z.boolean(), z.null()]),
  annualLimitCents: z.union([z.number().int(), z.null()]),
  annualLimitUsedCents: z.union([z.number().int(), z.null()])
});

export const DentalPatientFinanceModuleInsuranceRelationshipSchema = z.enum(["self", "spouse", "child", "other"]);

export const DentalPatientFinanceModulePayerTypeSchema = z.enum(["hmo", "philhealth", "corporate", "self_pay_assist", "other"]);

export const DentalPatientFinanceModuleRejectCasePresentationRequestSchema = z.object({
  rejectionReason: z.string().optional()
});

export const DentalPatientFinanceModuleRejectCasePresentationResultSchema = z.object({
  presentation: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  treatmentPlanId: z.string().uuid(),
  planVersionId: z.union([z.string().uuid(), z.null()]),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired", "revoked"]),
  decision: z.union([z.enum(["accepted", "rejected"]), z.null()]),
  decisionAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  signerName: z.union([z.string(), z.null()]),
  consentFormId: z.union([z.string().uuid(), z.null()]),
  rejectionReason: z.union([z.string(), z.null()]),
  firstViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  lastViewedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
}),
  plan: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  status: z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]),
  totalEstimateCents: z.number().int(),
  notes: z.union([z.string(), z.null()]),
  cdtCodeSetYear: z.number().int(),
  presentedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  approvedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
})
});

export const DentalPatientFinanceModuleSyncLogSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  localId: z.string(),
  serverId: z.union([z.string(), z.null()]),
  entityType: z.string(),
  entityId: z.string(),
  branchId: z.union([z.string(), z.null()]),
  syncStatus: z.enum(["pending", "syncing", "synced", "failed"]),
  lastSyncAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  error: z.union([z.string(), z.null()])
});

export const DentalPatientFinanceModuleSyncStatusSchema = z.enum(["pending", "syncing", "synced", "failed"]);

export const DentalPatientFinanceModuleTreatmentAppointmentLinkSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.union([z.string().uuid(), z.null()])
});

export const DentalPatientFinanceModuleTreatmentOptionGroupSchema = z.object({
  optionGroupId: z.string().uuid(),
  options: z.array(DentalPatientFinanceModuleTreatmentOptionSchema)
});

export const DentalPatientFinanceModuleTreatmentPlanSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  status: z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]),
  totalEstimateCents: z.number().int(),
  notes: z.union([z.string(), z.null()]),
  cdtCodeSetYear: z.number().int(),
  presentedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  approvedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalPatientFinanceModuleTreatmentPlanApprovalSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  treatmentPlanId: z.string().uuid(),
  planVersionId: z.union([z.string().uuid(), z.null()]),
  approvedByPersonId: z.string().uuid(),
  method: z.enum(["signature", "verbal", "portal"]),
  consentFormId: z.union([z.string().uuid(), z.null()]),
  signatureData: z.union([z.string(), z.null()]),
  approvedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalPatientFinanceModuleTreatmentPlanApprovalMethodSchema = z.enum(["signature", "verbal", "portal"]);

export const DentalPatientFinanceModuleTreatmentPlanApprovalResultSchema = z.object({
  approval: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  treatmentPlanId: z.string().uuid(),
  planVersionId: z.union([z.string().uuid(), z.null()]),
  approvedByPersonId: z.string().uuid(),
  method: z.enum(["signature", "verbal", "portal"]),
  consentFormId: z.union([z.string().uuid(), z.null()]),
  signatureData: z.union([z.string(), z.null()]),
  approvedAt: z.string().datetime().transform((str) => new Date(str))
}),
  plan: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  status: z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]),
  totalEstimateCents: z.number().int(),
  notes: z.union([z.string(), z.null()]),
  cdtCodeSetYear: z.number().int(),
  presentedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  approvedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
})
});

export const DentalPatientFinanceModuleTreatmentPlanStatusSchema = z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]);

export const DentalPatientFinanceModuleTreatmentPlanStatusHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  treatmentPlanId: z.string().uuid(),
  fromStatus: z.union([z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]), z.null()]),
  toStatus: z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]),
  changedByPersonId: z.string().uuid(),
  changedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalPatientFinanceModuleUpdateClaimStatusRequestSchema = z.object({
  status: z.enum(["draft", "ready", "submitted", "accepted", "rejected"])
});

export const DentalPatientFinanceModuleUpdateCoverageAuthorizationStatusRequestSchema = z.object({
  status: z.enum(["requested", "approved", "partial", "denied", "expired"]),
  approvedAmountCents: z.number().int().gte(0).optional(),
  coveredProcedures: z.array(DentalPatientFinanceModuleCoveredProcedureSchema).optional()
});

export const DentalPatientFinanceModuleUpdateInsuranceProfileRequestSchema = z.object({
  insurerName: z.string().min(1).optional(),
  policyNumber: z.string().min(1).optional(),
  groupNumber: z.string().optional(),
  subscriberName: z.string().min(1).optional(),
  subscriberDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relationship: z.enum(["self", "spouse", "child", "other"]).optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
  payerType: z.enum(["hmo", "philhealth", "corporate", "self_pay_assist", "other"]).optional(),
  accredited: z.boolean().optional(),
  annualLimitCents: z.number().int().gte(0).optional(),
  annualLimitUsedCents: z.number().int().gte(0).optional()
});

export const DentalPatientFinanceModuleUpdateSyncLogRequestSchema = z.object({
  syncStatus: z.enum(["pending", "syncing", "synced", "failed"]).optional(),
  serverId: z.string().optional(),
  error: z.string().optional(),
  version: z.number().int().optional()
});

export const DentalPatientFinanceModuleUpdateTreatmentPlanRequestSchema = z.object({
  status: z.enum(["draft", "presented", "approved", "rejected", "scheduled", "partially_completed", "completed", "cancelled"]).optional(),
  totalEstimateCents: z.number().int().gte(0).optional(),
  notes: z.string().optional()
});

export const DentalPatientModuleAddFollowUpNoteRequestSchema = z.object({
  text: z.string().min(1)
});

export const DentalPatientModuleFollowUpNoteSchema = z.object({
  id: UUIDSchema,
  text: z.string(),
  createdAt: z.string(),
  createdBy: z.string()
});

export const DentalPatientModuleAddFollowUpNoteResponseSchema = z.object({
  note: DentalPatientModuleFollowUpNoteSchema,
  total: z.number().int()
});

export const DentalPatientModuleBulkArchiveDentalPatientsRequestSchema = z.object({
  ids: z.array(UUIDSchema).min(1).max(50),
  reason: z.string().min(5).max(500)
});

export const DentalPatientModuleBulkArchiveResultSchema = z.object({
  id: UUIDSchema,
  success: z.boolean(),
  reason: z.string().optional()
});

export const DentalPatientModuleBulkArchiveDentalPatientsResponseSchema = z.object({
  results: z.array(DentalPatientModuleBulkArchiveResultSchema),
  successCount: z.number().int(),
  failCount: z.number().int()
});

export const DentalPatientModuleCommunicationChannelConsentSchema = z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  marketing: z.boolean().optional()
});

export const DentalPatientModuleCommunicationConsentResponseSchema = z.object({
  registrationConsent: z.boolean(),
  channels: z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  marketing: z.boolean().optional()
}),
  channelsUpdatedAt: z.union([z.string(), z.null()])
});

export const DentalPatientModuleCreateDentalPatientRequestSchema = z.object({
  displayName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  consentGiven: z.boolean(),
  branchId: z.string().uuid()
});

export const DentalPatientModuleDentalPatientStatusSchema = z.enum(["active", "archived"]);

export const DentalPatientModuleDentalPatientPersonSchema = z.object({
  id: UUIDSchema,
  firstName: z.string(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  contactInfo: z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
}).optional()
});

export const DentalPatientModuleDuplicateWarningSchema = z.object({
  hasDuplicates: z.boolean(),
  count: z.number().int(),
  duplicateIds: z.array(UUIDSchema)
});

export const DentalPatientModuleCreateDentalPatientResponseSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  status: DentalPatientModuleDentalPatientStatusSchema,
  needsFollowUp: z.boolean(),
  hasActivePaymentPlan: z.boolean(),
  preferredBranchId: UUIDSchema.optional(),
  dentalHistorySummary: z.string().optional(),
  recallDate: z.string().optional(),
  recallNote: z.string().optional(),
  emergencyContact: z.record(z.string(), z.unknown()).optional(),
  communicationPreferences: z.record(z.string(), z.unknown()).optional(),
  person: DentalPatientModuleDentalPatientPersonSchema.optional(),
  displayName: z.string().optional(),
  safetyFloor: z.object({
  hasAlerts: z.boolean(),
  allergyCount: z.number().int(),
  medicationCount: z.number().int(),
  conditionCount: z.number().int()
}).optional(),
  followUpNotes: z.array(DentalPatientModuleFollowUpNoteSchema).optional(),
  consent: z.object({
  registrationConsent: z.boolean(),
  capturedAt: z.string(),
  channels: z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  marketing: z.boolean().optional()
}).optional(),
  channelsUpdatedAt: z.string().optional()
}).optional(),
  warning: DentalPatientModuleDuplicateWarningSchema.optional()
});

export const DentalPatientModuleDentalPatientSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  status: DentalPatientModuleDentalPatientStatusSchema,
  needsFollowUp: z.boolean(),
  hasActivePaymentPlan: z.boolean(),
  preferredBranchId: UUIDSchema.optional(),
  dentalHistorySummary: z.string().optional(),
  recallDate: z.string().optional(),
  recallNote: z.string().optional(),
  emergencyContact: z.record(z.string(), z.unknown()).optional(),
  communicationPreferences: z.record(z.string(), z.unknown()).optional(),
  person: DentalPatientModuleDentalPatientPersonSchema.optional(),
  displayName: z.string().optional(),
  safetyFloor: z.object({
  hasAlerts: z.boolean(),
  allergyCount: z.number().int(),
  medicationCount: z.number().int(),
  conditionCount: z.number().int()
}).optional(),
  followUpNotes: z.array(DentalPatientModuleFollowUpNoteSchema).optional(),
  consent: z.object({
  registrationConsent: z.boolean(),
  capturedAt: z.string(),
  channels: z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  marketing: z.boolean().optional()
}).optional(),
  channelsUpdatedAt: z.string().optional()
}).optional()
});

export const DentalPatientModuleDentalPatientContactInfoSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
});

export const DentalPatientModuleSafetyEntrySchema = z.object({
  id: UUIDSchema,
  displayName: z.string(),
  code: z.string().optional(),
  codeSystem: z.string().optional(),
  notes: z.string().optional(),
  onsetDate: z.string().optional()
});

export const DentalPatientModuleDentalPatientSafetyFloorSchema = z.object({
  patientId: UUIDSchema,
  hasAlerts: z.boolean(),
  allergies: z.array(DentalPatientModuleSafetyEntrySchema),
  medications: z.array(DentalPatientModuleSafetyEntrySchema),
  conditions: z.array(DentalPatientModuleSafetyEntrySchema),
  retrievedAt: z.string()
});

export const DentalPatientModuleDentalPatientSafetyFloorSummarySchema = z.object({
  hasAlerts: z.boolean(),
  allergyCount: z.number().int(),
  medicationCount: z.number().int(),
  conditionCount: z.number().int()
});

export const DentalPatientModuleStatementSummarySchema = z.object({
  totalVisits: z.number().int(),
  totalInvoices: z.number().int(),
  totalPayments: z.number().int(),
  totalBilledCents: z.number().int(),
  totalPaidCents: z.number().int(),
  outstandingBalanceCents: z.number().int()
});

export const DentalPatientModuleStatementVisitSchema = z.object({
  id: UUIDSchema,
  status: z.string(),
  chiefComplaint: z.string().optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalPatientModuleStatementInvoiceSchema = z.object({
  id: UUIDSchema,
  invoiceNumber: z.string().optional(),
  status: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceCents: z.number().int(),
  issuedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  lineItems: z.array(z.record(z.string(), z.unknown()))
});

export const DentalPatientModuleStatementPaymentSchema = z.object({
  id: UUIDSchema,
  amountCents: z.number().int(),
  method: z.string(),
  isVoid: z.boolean(),
  receiptNumber: z.string().optional(),
  recordedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalPatientModuleDentalPatientStatementSchema = z.object({
  patientId: UUIDSchema,
  patientName: z.string(),
  generatedAt: z.string(),
  summary: DentalPatientModuleStatementSummarySchema,
  visits: z.array(DentalPatientModuleStatementVisitSchema),
  invoices: z.array(DentalPatientModuleStatementInvoiceSchema),
  payments: z.array(DentalPatientModuleStatementPaymentSchema)
});

export const DentalPatientModuleDuplicateCandidatePatientSchema = z.object({
  id: UUIDSchema,
  displayName: z.string(),
  dateOfBirth: z.union([z.string(), z.null()]),
  email: z.union([z.string(), z.null()]),
  phone: z.union([z.string(), z.null()]),
  createdAt: z.string()
});

export const DentalPatientModuleDuplicateCandidateGroupSchema = z.object({
  matchType: z.string(),
  matchKey: z.string(),
  patients: z.array(DentalPatientModuleDuplicateCandidatePatientSchema)
});

export const DentalPatientModuleDuplicateCandidatesResponseSchema = z.object({
  groups: z.array(DentalPatientModuleDuplicateCandidateGroupSchema),
  groupCount: z.number().int()
});

export const DentalPatientModuleExportDentalPatientsResponseSchema = z.object({
  patients: z.array(DentalPatientModuleDentalPatientSchema),
  exportedAt: z.string(),
  total: z.number().int()
});

export const DentalPatientModuleImportPatientRowSchema = z.object({
  firstName: z.string(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  branchId: z.string()
});

export const DentalPatientModuleImportPatientsRequestSchema = z.object({
  patients: z.array(DentalPatientModuleImportPatientRowSchema)
});

export const DentalPatientModuleImportedPatientRecordSchema = z.object({
  id: UUIDSchema,
  personId: UUIDSchema,
  firstName: z.string(),
  lastName: z.string().optional(),
  branchId: z.string()
});

export const DentalPatientModuleImportPatientsResponseSchema = z.object({
  success: z.boolean(),
  imported: z.number().int(),
  total: z.number().int(),
  patients: z.array(DentalPatientModuleImportedPatientRecordSchema)
});

export const DentalPatientModuleInitDentitionToothSchema = z.object({
  toothNumber: z.number().int(),
  state: z.string(),
  note: z.string().optional()
});

export const DentalPatientModuleInitializeDentitionRequestSchema = z.object({
  dateOfBirth: z.string(),
  visitId: z.string().uuid()
});

export const DentalPatientModuleInitializeDentitionResponseSchema = z.object({
  chartId: UUIDSchema,
  patientId: UUIDSchema,
  dentitionType: z.string(),
  toothCount: z.number().int(),
  teeth: z.array(DentalPatientModuleInitDentitionToothSchema)
});

export const DentalPatientModuleListFollowUpNotesResponseSchema = z.object({
  notes: z.array(DentalPatientModuleFollowUpNoteSchema),
  total: z.number().int()
});

export const DentalPatientModulePersonConsentInfoSchema = z.object({
  registrationConsent: z.boolean(),
  capturedAt: z.string(),
  channels: z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  marketing: z.boolean().optional()
}).optional(),
  channelsUpdatedAt: z.string().optional()
});

export const DentalPatientModuleUpdateCommunicationConsentRequestSchema = z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  phone: z.boolean().optional(),
  marketing: z.boolean().optional()
});

export const DentalPatientModuleUpdateDentalPatientRequestSchema = z.object({
  needsFollowUp: z.boolean().optional(),
  dentalHistorySummary: z.string().optional(),
  preferredBranchId: UUIDSchema.optional(),
  status: DentalPatientModuleDentalPatientStatusSchema.optional(),
  emergencyContact: z.record(z.string(), z.unknown()).optional(),
  communicationPreferences: z.record(z.string(), z.unknown()).optional(),
  recallDate: z.string().optional(),
  recallNote: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  contactInfo: z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
}).optional()
});

export const PaymentMethodSchema = z.enum(["cash", "card", "bank_transfer"]);

export const DentalPaymentSchema = z.object({
  id: UUIDSchema,
  invoiceId: UUIDSchema,
  patientId: UUIDSchema,
  branchId: UUIDSchema,
  amountCents: z.number().int(),
  method: PaymentMethodSchema,
  receiptNumber: z.string(),
  recordedByMemberId: UUIDSchema,
  notes: z.string().optional(),
  isVoid: z.boolean(),
  voidedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  voidReason: z.string().optional(),
  voidedByMemberId: UUIDSchema.optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str))
});

export const PaymentPlanStatusSchema = z.enum(["on_track", "behind", "completed", "defaulted"]);

export const InstallmentStatusSchema = z.enum(["pending", "paid", "overdue", "waived"]);

export const DentalPaymentPlanInstallmentSchema = z.object({
  id: UUIDSchema,
  planId: UUIDSchema,
  installmentNumber: z.number().int(),
  dueDate: z.string().datetime().transform((str) => new Date(str)),
  amountCents: z.number().int(),
  paidCents: z.number().int(),
  paidDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: InstallmentStatusSchema
});

export const DentalPaymentPlanSchema = z.object({
  id: UUIDSchema,
  invoiceId: UUIDSchema,
  patientId: UUIDSchema,
  totalCents: z.number().int(),
  numberOfInstallments: z.number().int(),
  frequency: PlanFrequencySchema,
  startDate: z.string().datetime().transform((str) => new Date(str)),
  amountPerInstallmentCents: z.number().int(),
  status: PaymentPlanStatusSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  installments: z.array(DentalPaymentPlanInstallmentSchema)
});

export const DentalPaymentReceiptInvoiceSchema = z.object({
  id: UUIDSchema,
  invoiceNumber: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceCents: z.number().int(),
  status: z.string()
});

export const DentalPaymentReceiptPatientSchema = z.object({
  id: UUIDSchema,
  name: z.string()
});

export const DentalPaymentReceiptPaymentSchema = z.object({
  id: UUIDSchema,
  amountCents: z.number().int(),
  method: PaymentMethodSchema,
  recordedAt: z.string().datetime().transform((str) => new Date(str)),
  notes: z.union([z.string(), z.null()])
});

export const DentalPaymentReceiptResponseSchema = z.object({
  receiptNumber: z.string(),
  isVoid: z.boolean(),
  voidedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  voidReason: z.union([z.string(), z.null()]),
  payment: DentalPaymentReceiptPaymentSchema,
  invoice: DentalPaymentReceiptInvoiceSchema,
  patient: DentalPaymentReceiptPatientSchema,
  generatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const DentalPortalModuleMyAppointmentSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  visitType: z.string(),
  status: z.string(),
  confirmedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalPortalModuleMyBalanceSchema = z.object({
  totalBilledCents: z.number().int(),
  totalPaidCents: z.number().int(),
  outstandingBalanceCents: z.number().int(),
  overdueAmountCents: z.number().int(),
  invoiceCount: z.number().int()
});

export const DentalPortalModuleMyInvoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  status: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceCents: z.number().int(),
  dueDate: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  issuedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalQueueModuleCreateQueueItemRequestSchema = z.object({
  notes: z.string().optional()
});

export const DentalQueueModuleQueueItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  appointmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  branchId: z.string().uuid(),
  status: z.enum(["waiting", "called", "in_progress", "completed", "cancelled"]),
  calledAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  startedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  completedAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  notes: z.union([z.string(), z.null()])
});

export const DentalQueueModuleQueueItemStatusSchema = z.enum(["waiting", "called", "in_progress", "completed", "cancelled"]);

export const DentalQueueModuleUpdateQueueItemStatusRequestSchema = z.object({
  status: z.enum(["waiting", "called", "in_progress", "completed", "cancelled"]),
  notes: z.string().optional()
});

export const DentalRetentionModuleRetentionRunModeSchema = z.enum(["enforced", "dry-run"]);

export const DentalRetentionModuleRetentionStatusSchema = z.object({
  enforcementEnabled: z.boolean(),
  lastRunAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  lastRunMode: z.union([z.enum(["enforced", "dry-run"]), z.null()]),
  runsObserved: z.number().int(),
  lastActionedCount: z.number().int(),
  lastEligibleCount: z.number().int()
});

export const DentalTreatmentPhaseSchema = z.enum(["systemic", "disease_control", "re_evaluation", "definitive", "maintenance"]);

export const DentalVisitSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  patientId: UUIDSchema,
  branchId: UUIDSchema,
  dentistMemberId: UUIDSchema,
  status: DentalVisitStatusSchema,
  visitType: z.enum(["general", "hygiene"]),
  activatedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  lockedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  chiefComplaint: z.string().optional()
});

export const DentalVisitModuleDiscardVisitRequestSchema = z.object({
  reason: z.string().min(5).max(500)
});

export const DentalVisitTypeSchema = z.enum(["general", "hygiene"]);

export const DentalWaitlistModuleWaitlistUrgencySchema = z.enum(["routine", "soon", "asap"]);

export const DentalWaitlistModuleCreateWaitlistEntryRequestSchema = z.object({
  patientId: UUIDSchema,
  preferredProviderId: UUIDSchema.optional(),
  visitType: z.string().optional(),
  urgency: DentalWaitlistModuleWaitlistUrgencySchema.optional(),
  notes: z.string().max(500).optional()
});

export const DentalWaitlistModulePromoteWaitlistEntryRequestSchema = z.object({
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  providerId: z.string().uuid().optional(),
  visitType: z.string().optional(),
  operatoryId: z.string().uuid().optional()
});

export const DentalWaitlistModuleWaitlistEntrySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  branchId: z.string().uuid(),
  preferredProviderId: z.union([z.string().uuid(), z.null()]),
  visitType: z.union([z.string(), z.null()]),
  urgency: z.enum(["routine", "soon", "asap"]),
  status: z.enum(["active", "scheduled", "cancelled"]),
  notes: z.union([z.string(), z.null()]),
  promotedAppointmentId: z.union([z.string().uuid(), z.null()]),
  scheduledAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]),
  cancelledAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()])
});

export const DentalWaitlistModulePromoteWaitlistEntryResponseSchema = z.object({
  entry: DentalWaitlistModuleWaitlistEntrySchema,
  appointment: DentalAppointmentSchema
});

export const DentalWaitlistModuleWaitlistEntryStatusSchema = z.enum(["active", "scheduled", "cancelled"]);

export const HealthcareCoreResourceExtensionSchema = z.object({
  url: z.string().url(),
  valueString: z.string().optional(),
  valueInteger: z.number().int().optional(),
  valueDecimal: z.number().optional(),
  valueBoolean: z.boolean().optional(),
  valueDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  valueCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareCoreSensitivityLabelSchema = z.object({
  category: z.enum(["mental-health", "substance-use-disorder", "hiv-aids", "sti", "reproductive-health", "genetic-data", "sogi", "psychotherapy-notes", "adolescent-confidential", "domestic-violence", "workers-compensation", "vip-record"]),
  legalBasis: z.string().optional(),
  breakGlassPermitted: z.boolean(),
  additionalConsentRequired: z.boolean()
});

export const DepartmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  head: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  active: z.boolean()
});

export const EmailSchema = z.string().email();

export const EmailProviderSchema = z.enum(["smtp", "postmark"]);

export const EmailQueueItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  template: z.string().uuid().optional(),
  templateTags: z.array(z.string()).optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(255).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["pending", "processing", "sent", "failed", "cancelled"]),
  priority: z.number().int().gte(1).lte(10),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  attempts: z.number().int().gte(0),
  lastAttemptAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  nextRetryAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  lastError: z.string().optional(),
  sentAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  provider: z.enum(["smtp", "postmark"]).optional(),
  providerMessageId: z.string().max(255).optional(),
  cancelledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  cancelledBy: z.string().uuid().optional(),
  cancellationReason: z.string().max(500).optional()
});

export const EmailQueueStatusSchema = z.enum(["pending", "processing", "sent", "failed", "cancelled"]);

export const EmailTemplateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().gte(1),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  name: z.string().max(255),
  description: z.string().max(500).optional(),
  subject: z.string().max(500),
  bodyHtml: z.string(),
  bodyText: z.string().optional(),
  variables: z.array(TemplateVariableSchema).optional(),
  fromName: z.string().max(255).optional(),
  fromEmail: z.string().email().optional(),
  replyToEmail: z.string().email().optional(),
  replyToName: z.string().max(255).optional(),
  status: z.enum(["draft", "active", "archived"])
});

export const ErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional()
});

export const ErrorResponseSchema = z.object({
  error: z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional()
})
});

export const FieldErrorSchema = z.object({
  field: z.string(),
  value: z.unknown().optional(),
  code: z.string(),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional()
});

export const FileDownloadResponseSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: z.string().datetime().transform((str) => new Date(str)),
  file: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  filename: z.string().max(255),
  mimeType: z.string().max(100),
  size: z.number().int().gte(0),
  status: z.enum(["uploading", "processing", "available", "failed"]),
  owner: z.string().uuid(),
  uploadedAt: z.string().datetime().transform((str) => new Date(str))
})
});

export const FileStatusSchema = z.enum(["uploading", "processing", "available", "failed"]);

export const FileUploadRequestSchema = z.object({
  filename: z.string().max(255),
  size: z.number().int().gte(1),
  mimeType: z.string().max(100)
});

export const FileUploadResponseSchema = z.object({
  file: z.string().uuid(),
  uploadUrl: z.string().url(),
  uploadMethod: z.enum(["PUT"]),
  expiresAt: z.string().datetime().transform((str) => new Date(str))
});

export const FollowUpDataSchema = z.object({
  needed: z.boolean(),
  timeframeDays: z.number().int().optional(),
  instructions: z.string().optional(),
  specialistReferral: z.string().optional()
});

export const FollowUpDataUpdateSchema = z.object({
  needed: z.boolean().optional(),
  timeframeDays: z.number().int().optional(),
  instructions: z.string().optional(),
  specialistReferral: z.string().optional()
});

export const FormConfigSchema = z.object({
  fields: z.array(FormFieldConfigSchema).optional()
});

export const FormFieldTypeSchema = z.enum(["text", "textarea", "email", "phone", "number", "date", "datetime", "url", "select", "multiselect", "checkbox", "display"]);

export const FormFieldValidationSchema = z.object({
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  pattern: z.string().optional()
});

export const FormResponseDataSchema = z.object({
  data: z.record(z.string(), z.unknown())
});

export const FormResponseMetaDataSchema = z.object({
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completionTimeSeconds: z.number().int().optional(),
  ipAddress: z.string().optional()
});

export const FormResponsesSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  metadata: z.object({
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completionTimeSeconds: z.number().int().optional(),
  ipAddress: z.string().optional()
}).optional()
});

export const GenderSchema = z.enum(["male", "female", "non-binary", "other", "prefer-not-to-say"]);

export const GeneratePMDRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema
});

export const GenerateStatementBatchRequestSchema = z.object({
  branchId: UUIDSchema.optional(),
  patientIds: z.array(UUIDSchema).optional(),
  asOf: z.string().datetime().transform((str) => new Date(str)).optional(),
  includeZeroBalance: z.boolean().optional()
});

export const PatientStatementSchema = z.object({
  patientId: UUIDSchema,
  patientName: z.string(),
  statementNumber: z.string(),
  asOf: z.string().datetime().transform((str) => new Date(str)),
  totalChargedCents: z.number().int(),
  totalPaidCents: z.number().int(),
  totalDiscountCents: z.number().int(),
  balanceCents: z.number().int(),
  invoiceCount: z.number().int(),
  oldestUnpaidInvoiceDays: z.number().int()
});

export const GenerateStatementBatchResponseSchema = z.object({
  batchId: UUIDSchema,
  asOf: z.string().datetime().transform((str) => new Date(str)),
  statementCount: z.number().int(),
  totalBalanceCents: z.number().int(),
  statements: z.array(PatientStatementSchema)
});

export const GeoCoordinatesSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
});

export const GeoCoordinatesUpdateSchema = z.object({
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().gte(0).optional()
});

export const HealthcareAdministrativeBedManagementBedSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  identifier: z.string().min(1).max(50),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["icu", "general", "surgical", "maternity", "pediatric", "psychiatric", "isolation", "stepDown"]),
  status: z.enum(["available", "occupied", "housekeeping", "contaminated", "closed", "blocked"]),
  features: z.array(z.string()).optional(),
  currentOccupant: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeBedManagementBedStatusSchema = z.enum(["available", "occupied", "housekeeping", "contaminated", "closed", "blocked"]);

export const HealthcareAdministrativeBedManagementBedTypeSchema = z.enum(["icu", "general", "surgical", "maternity", "pediatric", "psychiatric", "isolation", "stepDown"]);

export const HealthcareAdministrativeChargeCaptureChargeComponentSchema = z.object({
  type: z.string(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  factor: z.number().optional(),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional()
});

export const HealthcareAdministrativeChargeCaptureChargeDefinitionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  description: z.string(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  status: z.enum(["active", "retired", "draft"]),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  unitPrice: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  component: z.array(HealthcareAdministrativeChargeCaptureChargeComponentSchema).optional()
});

export const HealthcareAdministrativeChargeCaptureChargeDefinitionStatusSchema = z.enum(["active", "retired", "draft"]);

export const HealthcareCoreAnnotationSchema = z.object({
  authorReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  authorString: z.string().optional(),
  time: z.string().datetime().transform((str) => new Date(str)).optional(),
  text: z.string()
});

export const HealthcareAdministrativeChargeCaptureChargeItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["planned", "billable", "notBillable", "aborted", "billed", "enteredInError"]),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  occurrenceDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  performer: z.array(HealthcareCoreReferenceSchema).optional(),
  performingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  unitPrice: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  factorOverride: z.number().optional(),
  totalPrice: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  bodysite: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  account: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reason: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  service: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAdministrativeChargeCaptureChargeItemStatusSchema = z.enum(["planned", "billable", "notBillable", "aborted", "billed", "enteredInError"]);

export const HealthcareAdministrativeClaimsClaimCareTeamSchema = z.object({
  sequence: z.number().int().gte(1),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  responsible: z.boolean().optional(),
  role: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  qualification: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeClaimsClaimSupportingInfoSchema = z.object({
  sequence: z.number().int().gte(1),
  category: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  timingDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  timingPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  valueString: z.string().max(1000).optional(),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  valueAttachment: z.object({
  contentType: z.string().optional(),
  language: z.string().optional(),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  title: z.string().optional(),
  size: z.number().int().gte(0).optional(),
  hash: z.string().optional(),
  creation: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeClaimsClaimDiagnosisSchema = z.object({
  sequence: z.number().int().gte(1),
  diagnosisCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  type: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  onAdmission: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  packageCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeClaimsClaimProcedureSchema = z.object({
  sequence: z.number().int().gte(1),
  type: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  date: z.string().datetime().transform((str) => new Date(str)).optional(),
  procedureCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
})
});

export const HealthcareAdministrativeClaimsClaimInsuranceSchema = z.object({
  sequence: z.number().int().gte(1),
  focal: z.boolean(),
  coverage: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  preAuthRef: z.string().max(50).optional()
});

export const HealthcareAdministrativeClaimsClaimItemSchema = z.object({
  sequence: z.number().int().gte(1),
  careTeamSequence: z.array(z.number().int()).optional(),
  diagnosisSequence: z.array(z.number().int()).optional(),
  procedureSequence: z.array(z.number().int()).optional(),
  revenue: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  category: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  productOrService: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  modifier: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  servicedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  servicedPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  locationCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  unitPrice: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  factor: z.number().optional(),
  net: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional()
});

export const HealthcareAdministrativeClaimsClaimSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "cancelled", "draft", "enteredInError"]),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  use: z.enum(["claim", "preauthorization", "predetermination"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  billablePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  created: z.string().datetime().transform((str) => new Date(str)),
  enterer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  insurer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  priority: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  prescription: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  originalPrescription: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  referral: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  careTeam: z.array(HealthcareAdministrativeClaimsClaimCareTeamSchema).optional(),
  supportingInfo: z.array(HealthcareAdministrativeClaimsClaimSupportingInfoSchema).optional(),
  diagnosis: z.array(HealthcareAdministrativeClaimsClaimDiagnosisSchema),
  procedure: z.array(HealthcareAdministrativeClaimsClaimProcedureSchema).optional(),
  insurance: z.array(HealthcareAdministrativeClaimsClaimInsuranceSchema),
  item: z.array(HealthcareAdministrativeClaimsClaimItemSchema),
  total: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional()
});

export const HealthcareAdministrativeClaimsClaimAdjudicationSchema = z.object({
  category: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  value: z.number().optional()
});

export const HealthcareAdministrativeClaimsClaimOutcomeSchema = z.enum(["queued", "complete", "error", "partial"]);

export const HealthcareAdministrativeClaimsClaimPaymentSchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  adjustment: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  adjustmentReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  date: z.string().datetime().transform((str) => new Date(str)).optional(),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  identifier: z.string().max(50).optional()
});

export const HealthcareAdministrativeClaimsClaimProcessNoteSchema = z.object({
  number: z.number().int().gte(1).optional(),
  type: z.string().max(20).optional(),
  text: z.string().max(2000),
  language: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeClaimsClaimResponseItemSchema = z.object({
  itemSequence: z.number().int().gte(1),
  adjudication: z.array(HealthcareAdministrativeClaimsClaimAdjudicationSchema)
});

export const HealthcareAdministrativeClaimsClaimResponseTotalSchema = z.object({
  category: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
})
});

export const HealthcareAdministrativeClaimsClaimResponseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "cancelled", "draft", "enteredInError"]),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  use: z.enum(["claim", "preauthorization", "predetermination"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  created: z.string().datetime().transform((str) => new Date(str)),
  insurer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  request: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  outcome: z.enum(["queued", "complete", "error", "partial"]),
  disposition: z.string().max(1000).optional(),
  preAuthRef: z.string().max(50).optional(),
  payeeType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  item: z.array(HealthcareAdministrativeClaimsClaimResponseItemSchema).optional(),
  payment: z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  adjustment: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  adjustmentReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  date: z.string().datetime().transform((str) => new Date(str)).optional(),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  identifier: z.string().max(50).optional()
}).optional(),
  processNote: z.array(HealthcareAdministrativeClaimsClaimProcessNoteSchema).optional(),
  total: z.array(HealthcareAdministrativeClaimsClaimResponseTotalSchema).optional()
});

export const HealthcareAdministrativeClaimsClaimStatusSchema = z.enum(["active", "cancelled", "draft", "enteredInError"]);

export const HealthcareAdministrativeClaimsClaimUseSchema = z.enum(["claim", "preauthorization", "predetermination"]);

export const HealthcareAdministrativeCredentialingClinicalPrivilegeSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  category: z.enum(["medical", "surgical", "anesthesia", "radiology", "pathology", "emergency", "obstetrics", "pediatrics", "psychiatry", "other"]),
  procedures: z.array(HealthcareCoreCodeableConceptSchema),
  level: z.enum(["independent", "supervised", "provisional", "temporary", "emergency"]),
  grantedDate: z.string().datetime().transform((str) => new Date(str)),
  expirationDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["pending", "underReview", "approved", "denied", "expired", "suspended", "revoked"]),
  supervisor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  conditions: z.array(z.string()).optional(),
  caseRequirements: z.string().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAdministrativeCredentialingCredentialingRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["pending", "underReview", "approved", "denied", "expired", "suspended", "revoked"]),
  applicationDate: z.string().datetime().transform((str) => new Date(str)),
  reviewDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  approvalDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  expirationDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  denialReason: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
  reviewCommittee: z.string().optional(),
  nextReviewDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  documents: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAdministrativeCredentialingCredentialingStatusSchema = z.enum(["pending", "underReview", "approved", "denied", "expired", "suspended", "revoked"]);

export const HealthcareAdministrativeCredentialingPrivilegeCategorySchema = z.enum(["medical", "surgical", "anesthesia", "radiology", "pathology", "emergency", "obstetrics", "pediatrics", "psychiatry", "other"]);

export const HealthcareAdministrativeCredentialingPrivilegeLevelSchema = z.enum(["independent", "supervised", "provisional", "temporary", "emergency"]);

export const HealthcareAdministrativeFeeScheduleDiscountSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(200),
  type: z.enum(["percentage", "fixedAmount", "seniorCitizen", "pwd", "employee", "charity"]),
  value: z.number(),
  conditions: z.string().max(500).optional(),
  status: z.enum(["draft", "active", "retired", "unknown"])
});

export const HealthcareAdministrativeFeeScheduleDiscountTypeSchema = z.enum(["percentage", "fixedAmount", "seniorCitizen", "pwd", "employee", "charity"]);

export const HealthcareAdministrativeFeeScheduleFeeScheduleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(200),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  description: z.string().max(500).optional()
});

export const HealthcareAdministrativeFeeScheduleFeeScheduleItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  feeSchedule: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  description: z.string().max(500),
  unitPrice: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  modifier: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  facility: z.boolean().optional(),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const HealthcareAdministrativeFeeScheduleInsuranceContractRateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  feeSchedule: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  payer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  allowedAmount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  copay: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  coinsurancePercent: z.number().optional(),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
})
});

export const HealthcareAdministrativeHospitalCostAccountingCostBreakdownItemSchema = z.object({
  category: z.string(),
  description: z.string(),
  charges: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  costs: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  quantity: z.number().int().optional()
});

export const HealthcareAdministrativeHospitalCostAccountingCaseCostingSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  totalCharges: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  totalCosts: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  totalPayments: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  profitLoss: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  costBreakdown: z.array(HealthcareAdministrativeHospitalCostAccountingCostBreakdownItemSchema),
  drgCode: z.string().optional(),
  los: z.number().int(),
  status: z.enum(["preliminary", "final"])
});

export const HealthcareAdministrativeHospitalCostAccountingCostAllocationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  costCenter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  directCosts: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  indirectCosts: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  overhead: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  totalCost: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  revenueGenerated: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  allocationMethod: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareAdministrativeHospitalCostAccountingCostCenterSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  code: z.string(),
  name: z.string(),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  type: z.enum(["revenue", "expense", "overhead", "administrative"]),
  parentCostCenter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  active: z.boolean()
});

export const HealthcareAdministrativeHospitalCostAccountingCostCenterTypeSchema = z.enum(["revenue", "expense", "overhead", "administrative"]);

export const HealthcareAdministrativeHospitalCostAccountingCostingStatusSchema = z.enum(["preliminary", "final"]);

export const HealthcareAdministrativeHospitalCostAccountingGLEntrySchema = z.object({
  accountCode: z.string(),
  costCenter: z.string(),
  debit: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  credit: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  description: z.string(),
  reference: z.string().optional()
});

export const HealthcareAdministrativeHospitalCostAccountingGLExportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  status: z.enum(["pending", "generated", "exported", "reconciled"]),
  entries: z.array(HealthcareAdministrativeHospitalCostAccountingGLEntrySchema),
  generatedAt: z.string().datetime().transform((str) => new Date(str)),
  exportedAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAdministrativeHospitalCostAccountingGLExportStatusSchema = z.enum(["pending", "generated", "exported", "reconciled"]);

export const HealthcareAdministrativeHospitalGMEAccreditationStatusSchema = z.enum(["fullAccreditation", "provisionalAccreditation", "warning", "probation", "withdrawn"]);

export const HealthcareAdministrativeHospitalGMECompetencyScoreSchema = z.object({
  competency: z.enum(["patientCare", "medicalKnowledge", "practiceLearning", "interpersonalSkills", "professionalism", "systemsPractice"]),
  score: z.number().int(),
  comment: z.string().optional()
});

export const HealthcareAdministrativeHospitalGMEEvaluationStatusSchema = z.enum(["draft", "submitted", "reviewed", "acknowledged"]);

export const HealthcareAdministrativeHospitalGMEGMECompetencySchema = z.enum(["patientCare", "medicalKnowledge", "practiceLearning", "interpersonalSkills", "professionalism", "systemsPractice"]);

export const HealthcareAdministrativeHospitalGMEProcedureLogSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  resident: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  procedureCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  date: z.string().datetime().transform((str) => new Date(str)),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  supervisingAttending: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  role: z.enum(["primary", "assistant", "observer"]),
  complexity: z.string().optional(),
  complications: z.string().optional(),
  verified: z.boolean(),
  verifiedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeHospitalGMEProcedureRoleSchema = z.enum(["primary", "assistant", "observer"]);

export const HealthcareAdministrativeHospitalGMEResidencyProgramSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  specialty: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  accreditationBody: z.string().optional(),
  accreditationStatus: z.enum(["fullAccreditation", "provisionalAccreditation", "warning", "probation", "withdrawn"]),
  programDirector: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  institution: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  duration: z.number().int(),
  maxResidents: z.number().int(),
  active: z.boolean()
});

export const HealthcareAdministrativeHospitalGMEResidentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  program: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  pgyLevel: z.number().int().gte(1).lte(8),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  expectedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  status: z.enum(["active", "leave", "probation", "graduated", "dismissed", "transferred"]),
  supervisor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeHospitalGMEResidentEvaluationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  resident: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  evaluator: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  rotation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  competencyScores: z.array(HealthcareAdministrativeHospitalGMECompetencyScoreSchema),
  overallRating: z.number().int().optional(),
  strengths: z.string().optional(),
  areasForImprovement: z.string().optional(),
  milestoneLevel: z.number().int().optional(),
  status: z.enum(["draft", "submitted", "reviewed", "acknowledged"])
});

export const HealthcareAdministrativeHospitalGMEResidentStatusSchema = z.enum(["active", "leave", "probation", "graduated", "dismissed", "transferred"]);

export const HealthcareAdministrativeHospitalGMERotationAssignmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  resident: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  supervisor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  evaluationDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["scheduled", "active", "completed", "cancelled"])
});

export const HealthcareAdministrativeHospitalGMERotationStatusSchema = z.enum(["scheduled", "active", "completed", "cancelled"]);

export const HealthcareAdministrativeHospitalHIMROICodingReviewSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  coder: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reviewDate: z.string().datetime().transform((str) => new Date(str)),
  primaryDiagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  secondaryDiagnoses: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  procedures: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  drgCode: z.string().optional(),
  drgWeight: z.number().optional(),
  status: z.enum(["draft", "coded", "querySent", "queryResolved", "finalized"]),
  cdiQuery: z.string().optional(),
  queryResponse: z.string().optional()
});

export const HealthcareAdministrativeHospitalHIMROICodingReviewStatusSchema = z.enum(["draft", "coded", "querySent", "queryResolved", "finalized"]);

export const HealthcareAdministrativeHospitalHIMROIDeliveryMethodSchema = z.enum(["mail", "fax", "electronicPortal", "secureEmail", "inPerson"]);

export const HealthcareAdministrativeHospitalHIMROIMedicalRecordRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  requestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestType: z.enum(["copy", "amendment", "restriction", "accounting"]),
  records: z.array(z.string()),
  status: z.enum(["submitted", "inProgress", "completed", "denied"]),
  completedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAdministrativeHospitalHIMROIROIRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestor: z.string(),
  requestorType: z.enum(["patient", "attorney", "insurance", "employer", "otherProvider", "lawEnforcement", "government", "other"]),
  requestDate: z.string().datetime().transform((str) => new Date(str)),
  purpose: z.enum(["TREAT", "HPAYMT", "HOPERAT", "SYSADMIN", "FRAUD", "PSYCHOTHERAPY", "TRAIN", "HLEGAL", "HMARKT", "HDIR", "HDISCL", "ETREAT", "HRESCH"]),
  recordsRequested: z.array(z.string()),
  dateRangeFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateRangeTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["received", "inReview", "authorizationPending", "processing", "readyForRelease", "released", "denied", "cancelled"]),
  authorization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  releasedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  releasedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  deliveryMethod: z.enum(["mail", "fax", "electronicPortal", "secureEmail", "inPerson"]).optional(),
  fee: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAdministrativeHospitalHIMROIROIRequestorTypeSchema = z.enum(["patient", "attorney", "insurance", "employer", "otherProvider", "lawEnforcement", "government", "other"]);

export const HealthcareAdministrativeHospitalHIMROIROIStatusSchema = z.enum(["received", "inReview", "authorizationPending", "processing", "readyForRelease", "released", "denied", "cancelled"]);

export const HealthcareAdministrativeHospitalHIMROIRecordRequestStatusSchema = z.enum(["submitted", "inProgress", "completed", "denied"]);

export const HealthcareAdministrativeHospitalHIMROIRecordRequestTypeSchema = z.enum(["copy", "amendment", "restriction", "accounting"]);

export const HealthcareAdministrativeInsuranceCostExceptionSchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const HealthcareAdministrativeInsuranceCoverageClassSchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  value: z.string().min(1).max(100),
  name: z.string().max(255).optional()
});

export const HealthcareAdministrativeInsuranceCoverageCostToBeneficiarySchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  valueMoney: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  exception: z.array(HealthcareAdministrativeInsuranceCostExceptionSchema).optional()
});

export const HealthcareAdministrativeInsuranceCoverageSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "cancelled", "draft", "enteredInError"]),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  policyHolder: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  subscriber: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  subscriberId: z.string().max(100).optional(),
  beneficiary: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  dependent: z.string().max(25).optional(),
  relationship: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  payor: z.array(HealthcareCoreReferenceSchema),
  coverageClass: z.array(HealthcareAdministrativeInsuranceCoverageClassSchema).optional(),
  order: z.number().int().gte(1).optional(),
  network: z.string().max(100).optional(),
  costToBeneficiary: z.array(HealthcareAdministrativeInsuranceCoverageCostToBeneficiarySchema).optional()
});

export const HealthcareAdministrativeInsuranceCoverageStatusSchema = z.enum(["active", "cancelled", "draft", "enteredInError"]);

export const HealthcareAdministrativePatientFinancialCounselingOutcomeSchema = z.enum(["paymentArranged", "financialAssistance", "selfPay", "referred"]);

export const HealthcareAdministrativePatientFinancialFinancialCounselingSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  counselor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  date: z.string().datetime().transform((str) => new Date(str)),
  estimatedCharges: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  insuranceCoverage: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  patientResponsibility: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  assistanceProgramsDiscussed: z.array(z.string()).optional(),
  outcome: z.enum(["paymentArranged", "financialAssistance", "selfPay", "referred"])
});

export const HealthcareAdministrativePatientFinancialInstallmentSchema = z.object({
  sequence: z.number().int(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  paidDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["pending", "paid", "overdue", "waived"])
});

export const HealthcareAdministrativePatientFinancialInstallmentStatusSchema = z.enum(["pending", "paid", "overdue", "waived"]);

export const HealthcareAdministrativePatientFinancialPaymentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "cancelled", "enteredInError"]),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  paymentMethod: z.enum(["cash", "card", "check", "bankTransfer", "insurance", "other"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  paidAt: z.string().datetime().transform((str) => new Date(str)),
  paidBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  receiptNumber: z.string().max(50).optional(),
  invoiceReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.string().max(1000).optional()
});

export const HealthcareAdministrativePatientFinancialPaymentFrequencySchema = z.enum(["weekly", "biweekly", "monthly"]);

export const HealthcareAdministrativePatientFinancialPaymentMethodSchema = z.enum(["cash", "card", "check", "bankTransfer", "insurance", "other"]);

export const HealthcareAdministrativePatientFinancialPaymentPlanSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  totalAmount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  downPayment: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  installmentCount: z.number().int(),
  installmentAmount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  status: z.enum(["active", "completed", "defaulted", "cancelled"]),
  installments: z.array(HealthcareAdministrativePatientFinancialInstallmentSchema)
});

export const HealthcareAdministrativePatientFinancialPaymentPlanStatusSchema = z.enum(["active", "completed", "defaulted", "cancelled"]);

export const HealthcareAdministrativePatientFinancialPaymentStatusSchema = z.enum(["active", "cancelled", "enteredInError"]);

export const HealthcareAdministrativePatientFinancialPromissoryNoteSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  terms: z.string().max(2000),
  signedAt: z.string().datetime().transform((str) => new Date(str)),
  signedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  witnessedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["active", "paid", "voided", "defaulted"])
});

export const HealthcareAdministrativePatientFinancialPromissoryNoteStatusSchema = z.enum(["active", "paid", "voided", "defaulted"]);

export const HealthcareAdministrativePatientFinancialReceiptSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  receiptNumber: z.string().max(50),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  payments: z.array(HealthcareCoreReferenceSchema),
  totalAmount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  issuedAt: z.string().datetime().transform((str) => new Date(str)),
  issuedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  voided: z.boolean().optional(),
  voidReason: z.string().max(500).optional()
});

export const HealthcareAdministrativePriorAuthPriorAuthDecisionSchema = z.enum(["approved", "partiallyApproved", "denied", "deferred"]);

export const HealthcareAdministrativePriorAuthPriorAuthStatusSchema = z.enum(["draft", "submitted", "pending", "approved", "partiallyApproved", "denied", "cancelled", "expired"]);

export const HealthcareAdministrativePriorAuthPriorAuthorizationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["draft", "submitted", "pending", "approved", "partiallyApproved", "denied", "cancelled", "expired"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  requestedService: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  requestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  insurer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  coverage: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  clinicalNotes: z.string().max(5000).optional(),
  supportingDocuments: z.array(HealthcareCoreReferenceSchema).optional(),
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  responseReceivedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  decision: z.enum(["approved", "partiallyApproved", "denied", "deferred"]).optional(),
  decisionReason: z.string().max(2000).optional(),
  authorizationNumber: z.string().max(50).optional(),
  validPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  approvedQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  notes: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAdministrativeSchedulingAppointmentParticipantSchema = z.object({
  type: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  actor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  required: z.enum(["required", "optional", "informationOnly"]).optional(),
  status: z.enum(["accepted", "declined", "tentative", "needsAction"]),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const HealthcareCorePeriodSchema = z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAdministrativeSchedulingAppointmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["proposed", "pending", "booked", "arrived", "fulfilled", "cancelled", "noShow", "enteredInError", "waitlist", "checkedIn"]),
  cancellationReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  serviceCategory: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  serviceType: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  specialty: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  appointmentType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  priority: z.number().int().gte(0).optional(),
  description: z.string().optional(),
  supportingInformation: z.array(HealthcareCoreReferenceSchema).optional(),
  start: z.string().datetime().transform((str) => new Date(str)).optional(),
  end: z.string().datetime().transform((str) => new Date(str)).optional(),
  minutesDuration: z.number().int().gte(1).optional(),
  slot: z.array(HealthcareCoreReferenceSchema).optional(),
  created: z.string().datetime().transform((str) => new Date(str)),
  comment: z.string().optional(),
  patientInstruction: z.string().optional(),
  basedOn: z.array(HealthcareCoreReferenceSchema).optional(),
  participant: z.array(HealthcareAdministrativeSchedulingAppointmentParticipantSchema),
  requestedPeriod: z.array(HealthcareCorePeriodSchema).optional(),
  visitType: z.enum(["inPerson", "virtual", "homeVisit", "phone"]).optional(),
  telemedicineUrl: z.string().url().optional()
});

export const HealthcareAdministrativeSchedulingAppointmentStatusSchema = z.enum(["proposed", "pending", "booked", "arrived", "fulfilled", "cancelled", "noShow", "enteredInError", "waitlist", "checkedIn"]);

export const HealthcareAdministrativeSchedulingParticipantRequiredSchema = z.enum(["required", "optional", "informationOnly"]);

export const HealthcareAdministrativeSchedulingParticipantStatusSchema = z.enum(["accepted", "declined", "tentative", "needsAction"]);

export const HealthcareAdministrativeSchedulingScheduleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  active: z.boolean(),
  serviceCategory: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  serviceType: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  specialty: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  actor: z.array(HealthcareCoreReferenceSchema),
  planningHorizon: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  comment: z.string().optional()
});

export const HealthcareAdministrativeSchedulingSlotSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  serviceCategory: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  serviceType: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  specialty: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  appointmentType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  schedule: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["busy", "free", "busyUnavailable", "busyTentative", "enteredInError"]),
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)),
  overbooked: z.boolean().optional(),
  comment: z.string().optional()
});

export const HealthcareAdministrativeSchedulingSlotStatusSchema = z.enum(["busy", "free", "busyUnavailable", "busyTentative", "enteredInError"]);

export const HealthcareAdministrativeSchedulingVisitTypeSchema = z.enum(["inPerson", "virtual", "homeVisit", "phone"]);

export const HealthcareAdministrativeWorkforceSchedulingOnCallScheduleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)),
  type: z.enum(["primary", "secondary", "backup"]),
  contactNumber: z.string().max(20)
});

export const HealthcareAdministrativeWorkforceSchedulingOnCallTypeSchema = z.enum(["primary", "secondary", "backup"]);

export const HealthcareAdministrativeWorkforceSchedulingSchedulePatternSchema = z.object({
  dayOfWeek: z.string().max(10),
  startTime: z.string().max(5),
  endTime: z.string().max(5),
  shiftType: z.enum(["day", "evening", "night", "oncall", "split"])
});

export const HealthcareAdministrativeWorkforceSchedulingShiftAssignmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  shiftType: z.enum(["day", "evening", "night", "oncall", "split"]),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["scheduled", "confirmed", "inProgress", "completed", "noShow", "swapped", "cancelled"]),
  swappedWith: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.string().max(500).optional()
});

export const HealthcareAdministrativeWorkforceSchedulingShiftStatusSchema = z.enum(["scheduled", "confirmed", "inProgress", "completed", "noShow", "swapped", "cancelled"]);

export const HealthcareAdministrativeWorkforceSchedulingShiftTypeSchema = z.enum(["day", "evening", "night", "oncall", "split"]);

export const HealthcareAdministrativeWorkforceSchedulingTimeOffRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["vacation", "sick", "personal", "bereavement", "education", "maternity", "paternity", "other"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  status: z.enum(["pending", "approved", "denied", "cancelled"]),
  reason: z.string().max(500).optional(),
  approvedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  approvedAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAdministrativeWorkforceSchedulingTimeOffStatusSchema = z.enum(["pending", "approved", "denied", "cancelled"]);

export const HealthcareAdministrativeWorkforceSchedulingTimeOffTypeSchema = z.enum(["vacation", "sick", "personal", "bereavement", "education", "maternity", "paternity", "other"]);

export const HealthcareAdministrativeWorkforceSchedulingWorkScheduleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  pattern: z.array(HealthcareAdministrativeWorkforceSchedulingSchedulePatternSchema)
});

export const HealthcareAnalyticsAIMetadataEvidenceSourceSchema = z.object({
  type: z.enum(["clinicalGuideline", "peerReviewedStudy", "clinicalTrial", "expertConsensus", "realWorldEvidence", "other"]),
  title: z.string(),
  url: z.string().url().optional(),
  citation: z.string().optional(),
  relevanceScore: z.number().gte(0).lte(1).optional()
});

export const HealthcareAnalyticsAIMetadataAIOutputMetadataSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  modelName: z.string(),
  modelVersion: z.string(),
  modelProvider: z.string().optional(),
  outputType: z.enum(["prediction", "classification", "recommendation", "summary", "extraction", "translation", "riskScore", "other"]),
  confidence: z.number().gte(0).lte(1).optional(),
  inputReferences: z.array(HealthcareCoreReferenceSchema).optional(),
  outputReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  executedAt: z.string().datetime().transform((str) => new Date(str)),
  latencyMs: z.number().int().optional(),
  evidenceSources: z.array(HealthcareAnalyticsAIMetadataEvidenceSourceSchema).optional(),
  humanReviewed: z.boolean().optional(),
  reviewedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reviewedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  reviewOutcome: z.enum(["accepted", "modified", "rejected", "pending"]).optional(),
  explanation: z.string().optional(),
  biasAssessment: z.string().optional(),
  regulatoryStatus: z.enum(["researchOnly", "clinicalDecisionSupport", "fdaCleared", "fdaApproved", "ceMarked", "notRegulated"]).optional(),
  disclaimers: z.array(z.string()).optional()
});

export const HealthcareAnalyticsAIMetadataAIOutputTypeSchema = z.enum(["prediction", "classification", "recommendation", "summary", "extraction", "translation", "riskScore", "other"]);

export const HealthcareAnalyticsAIMetadataAIRegulatoryStatusSchema = z.enum(["researchOnly", "clinicalDecisionSupport", "fdaCleared", "fdaApproved", "ceMarked", "notRegulated"]);

export const HealthcareAnalyticsAIMetadataEvidenceTypeSchema = z.enum(["clinicalGuideline", "peerReviewedStudy", "clinicalTrial", "expertConsensus", "realWorldEvidence", "other"]);

export const HealthcareAnalyticsAIMetadataReviewOutcomeSchema = z.enum(["accepted", "modified", "rejected", "pending"]);

export const HealthcareAnalyticsCohortsCohortCriteriaSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains", "in", "between", "exists", "notExists"]),
  value: z.string().optional(),
  valueList: z.array(z.string()).optional(),
  conjunction: z.enum(["and", "or"])
});

export const HealthcareAnalyticsCohortsCohortDefinitionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "retired"]),
  subjectType: z.string(),
  criteria: z.array(HealthcareAnalyticsCohortsCohortCriteriaSchema),
  estimatedSize: z.number().int().optional(),
  lastEvaluated: z.string().datetime().transform((str) => new Date(str)).optional(),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  purpose: z.string().optional()
});

export const HealthcareAnalyticsCohortsCohortStatusSchema = z.enum(["draft", "active", "retired"]);

export const HealthcareAnalyticsCohortsCriteriaConjunctionSchema = z.enum(["and", "or"]);

export const HealthcareAnalyticsCohortsCriteriaOperatorSchema = z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains", "in", "between", "exists", "notExists"]);

export const HealthcareAnalyticsCohortsDataLineageRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  source: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  target: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  transformationType: z.enum(["copy", "aggregate", "derive", "filter", "merge", "deIdentify", "pseudonymize", "enrich"]),
  description: z.string().optional(),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  performedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  parameters: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareAnalyticsCohortsExportFormatSchema = z.enum(["csv", "ndjson", "parquet", "fhirBundle"]);

export const HealthcareAnalyticsCohortsExtractStatusSchema = z.enum(["requested", "inProgress", "completed", "failed", "cancelled"]);

export const HealthcareAnalyticsCohortsResearchExtractSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  cohort: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  deIdentificationProfile: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  status: z.enum(["requested", "inProgress", "completed", "failed", "cancelled"]),
  format: z.enum(["csv", "ndjson", "parquet", "fhirBundle"]),
  requestedAt: z.string().datetime().transform((str) => new Date(str)),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  requestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  recordCount: z.number().int().optional(),
  fileReference: z.string().optional(),
  purpose: z.enum(["TREAT", "HPAYMT", "HOPERAT", "SYSADMIN", "FRAUD", "PSYCHOTHERAPY", "TRAIN", "HLEGAL", "HMARKT", "HDIR", "HDISCL", "ETREAT", "HRESCH"]),
  irbApproval: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareAnalyticsCohortsTransformationTypeSchema = z.enum(["copy", "aggregate", "derive", "filter", "merge", "deIdentify", "pseudonymize", "enrich"]);

export const HealthcareAnalyticsDeIdentificationDeIdActionSchema = z.enum(["remove", "generalize", "pseudonymize", "dateShift", "mask", "truncate", "noise", "suppress", "redact"]);

export const HealthcareAnalyticsDeIdentificationDeIdMethodSchema = z.enum(["safeHarbor", "expertDetermination", "kAnonymity", "lDiversity", "tCloseness", "custom"]);

export const HealthcareAnalyticsDeIdentificationDeIdRuleSchema = z.object({
  field: z.string(),
  action: z.enum(["remove", "generalize", "pseudonymize", "dateShift", "mask", "truncate", "noise", "suppress", "redact"]),
  parameters: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareAnalyticsDeIdentificationDeIdentificationProfileSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  description: z.string().optional(),
  method: z.enum(["safeHarbor", "expertDetermination", "kAnonymity", "lDiversity", "tCloseness", "custom"]),
  status: z.enum(["draft", "active", "retired"]),
  rules: z.array(HealthcareAnalyticsDeIdentificationDeIdRuleSchema),
  retainedElements: z.array(z.string()).optional(),
  removedElements: z.array(z.string()).optional()
});

export const HealthcareAnalyticsDeIdentificationProfileStatusSchema = z.enum(["draft", "active", "retired"]);

export const HealthcareAnalyticsDeIdentificationPseudonymizationMapSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  profile: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  sourceIdentifier: z.string(),
  pseudonym: z.string(),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAnalyticsReportingDashboardWidgetSchema = z.object({
  title: z.string().max(200),
  type: z.enum(["chart", "table", "metric", "gauge", "map", "list"]),
  dataSource: z.string().max(200),
  configuration: z.record(z.string(), z.unknown()),
  position: z.object({
  row: z.number().int().gte(0),
  column: z.number().int().gte(0),
  width: z.number().int().gte(1),
  height: z.number().int().gte(1)
})
});

export const HealthcareAnalyticsReportingDashboardSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(250),
  description: z.string().max(1000).optional(),
  category: z.enum(["clinical", "financial", "operational", "quality", "compliance", "research", "custom"]),
  widgets: z.array(HealthcareAnalyticsReportingDashboardWidgetSchema),
  owner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  shared: z.boolean(),
  status: z.enum(["draft", "active", "retired", "unknown"])
});

export const HealthcareAnalyticsReportingReportCategorySchema = z.enum(["clinical", "financial", "operational", "quality", "compliance", "research", "custom"]);

export const HealthcareAnalyticsReportingReportParameterSchema = z.object({
  name: z.string().max(100),
  type: z.string().max(50),
  required: z.boolean(),
  defaultValue: z.string().max(500).optional(),
  description: z.string().max(300).optional()
});

export const HealthcareAnalyticsReportingReportDefinitionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(250),
  description: z.string().max(1000).optional(),
  category: z.enum(["clinical", "financial", "operational", "quality", "compliance", "research", "custom"]),
  dataSource: z.string().max(200),
  parameters: z.array(HealthcareAnalyticsReportingReportParameterSchema),
  outputFormat: z.enum(["pdf", "csv", "xlsx", "json", "html"]),
  schedule: z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
  dayOfWeek: z.string().max(20).optional(),
  dayOfMonth: z.number().int().gte(1).lte(31).optional(),
  time: z.string().max(5).optional(),
  recipients: z.array(z.string()).optional(),
  active: z.boolean()
}).optional(),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareAnalyticsReportingReportFormatSchema = z.enum(["pdf", "csv", "xlsx", "json", "html"]);

export const HealthcareAnalyticsReportingReportRunSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  definition: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  parameters: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  startedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  requestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  outputUrl: z.string().max(2048).optional(),
  outputSize: z.number().int().gte(0).optional(),
  errorMessage: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAnalyticsReportingReportRunStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);

export const HealthcareAnalyticsReportingReportScheduleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
  dayOfWeek: z.string().max(20).optional(),
  dayOfMonth: z.number().int().gte(1).lte(31).optional(),
  time: z.string().max(5).optional(),
  recipients: z.array(z.string()).optional(),
  active: z.boolean()
});

export const HealthcareAnalyticsReportingScheduleFrequencySchema = z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]);

export const HealthcareAnalyticsReportingWidgetPositionSchema = z.object({
  row: z.number().int().gte(0),
  column: z.number().int().gte(0),
  width: z.number().int().gte(1),
  height: z.number().int().gte(1)
});

export const HealthcareAnalyticsReportingWidgetTypeSchema = z.enum(["chart", "table", "metric", "gauge", "map", "list"]);

export const HealthcareAncillaryBloodBankBloodGroupSchema = z.enum(["A", "B", "AB", "O"]);

export const HealthcareAncillaryBloodBankBloodProductSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  productType: z.enum(["wholeBlood", "packedRBC", "platelets", "freshFrozenPlasma", "cryoprecipitate", "albumin", "immunoglobulin"]),
  bloodGroup: z.enum(["A", "B", "AB", "O"]),
  rhFactor: z.enum(["positive", "negative"]),
  unitNumber: z.string(),
  collectionDate: z.string().datetime().transform((str) => new Date(str)),
  expirationDate: z.string().datetime().transform((str) => new Date(str)),
  volume: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  status: z.enum(["available", "reserved", "crossmatched", "issued", "transfused", "expired", "recalled", "discarded", "quarantine"]),
  donorReference: z.string().optional(),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  irradiated: z.boolean().optional(),
  leukocyteReduced: z.boolean().optional(),
  cmvNegative: z.boolean().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryBloodBankBloodProductStatusSchema = z.enum(["available", "reserved", "crossmatched", "issued", "transfused", "expired", "recalled", "discarded", "quarantine"]);

export const HealthcareAncillaryBloodBankBloodProductTypeSchema = z.enum(["wholeBlood", "packedRBC", "platelets", "freshFrozenPlasma", "cryoprecipitate", "albumin", "immunoglobulin"]);

export const HealthcareAncillaryBloodBankCrossmatchRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  bloodProduct: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestedAt: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["ordered", "testing", "compatible", "incompatible", "cancelled"]),
  testMethod: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  result: z.string().optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareAncillaryBloodBankCrossmatchStatusSchema = z.enum(["ordered", "testing", "compatible", "incompatible", "cancelled"]);

export const HealthcareAncillaryBloodBankRhFactorSchema = z.enum(["positive", "negative"]);

export const HealthcareAncillaryBloodBankTransfusionReactionSeveritySchema = z.enum(["none", "mild", "moderate", "severe", "lifeThreatening"]);

export const HealthcareAncillaryBloodBankTransfusionRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  bloodProduct: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  orderedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  administeredBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  volumeAdministered: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  vitalSignsBeforeTransfusion: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  vitalSignsDuringTransfusion: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  vitalSignsAfterTransfusion: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reactionSeverity: z.enum(["none", "mild", "moderate", "severe", "lifeThreatening"]),
  reactionType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reactionOnset: z.string().datetime().transform((str) => new Date(str)).optional(),
  interventions: z.string().optional(),
  stopped: z.boolean(),
  stoppedReason: z.string().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryCosmeticDentalBeforeAfterPhotoSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  cosmeticCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  photoType: z.enum(["before", "during", "after"]),
  photoReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  capturedAt: z.string().datetime().transform((str) => new Date(str)),
  capturedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  description: z.string().optional()
});

export const HealthcareAncillaryCosmeticDentalCosmeticCaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["consultation", "designApproved", "inTreatment", "completed", "cancelled"]),
  consultationDate: z.string().datetime().transform((str) => new Date(str)),
  procedures: z.array(HealthcareCoreCodeableConceptSchema),
  description: z.string().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryCosmeticDentalCosmeticCaseStatusSchema = z.enum(["consultation", "designApproved", "inTreatment", "completed", "cancelled"]);

export const HealthcareAncillaryCosmeticDentalPhotoTypeSchema = z.enum(["before", "during", "after"]);

export const HealthcareAncillaryCosmeticDentalSmileDesignSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  cosmeticCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  designDocument: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  waxUpReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  digitalMockup: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  patientApproved: z.boolean().optional(),
  approvedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.string().optional()
});

export const HealthcareAncillaryCosmeticDentalVeneerRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  cosmeticCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toothNumber: z.number().int(),
  shade: z.string(),
  material: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  prepDesign: z.string().optional(),
  status: z.enum(["planned", "prepped", "temporaryPlaced", "bonded", "completed"])
});

export const HealthcareAncillaryCosmeticDentalVeneerStatusSchema = z.enum(["planned", "prepped", "temporaryPlaced", "bonded", "completed"]);

export const HealthcareAncillaryCosmeticDentalWhiteningMethodSchema = z.enum(["inOffice", "takeHome", "combined"]);

export const HealthcareAncillaryCosmeticDentalWhiteningRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  cosmeticCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  sessionDate: z.string().datetime().transform((str) => new Date(str)),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  product: z.string(),
  method: z.enum(["inOffice", "takeHome", "combined"]),
  baselineShade: z.string(),
  resultShade: z.string().optional(),
  sensitivityScore: z.number().int().gte(0).lte(10).optional(),
  note: z.string().optional()
});

export const HealthcareAncillaryDentalToothSurfaceSchema = z.enum(["mesial", "distal", "buccal", "lingual", "occlusal", "incisal", "facial", "cervical"]);

export const HealthcareAncillaryDentalDentalTreatmentPlanItemSchema = z.object({
  sequence: z.number().int(),
  tooth: z.number().int().optional(),
  surface: z.array(HealthcareAncillaryDentalToothSurfaceSchema).optional(),
  procedure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  status: z.enum(["planned", "scheduled", "inProgress", "completed", "cancelled"]),
  priority: z.number().int().optional(),
  estimatedCost: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  performedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  notes: z.string().optional()
});

export const HealthcareAncillaryDentalDentalTreatmentPlanSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["draft", "proposed", "accepted", "inProgress", "completed", "cancelled"]),
  description: z.string().optional(),
  items: z.array(HealthcareAncillaryDentalDentalTreatmentPlanItemSchema),
  totalEstimate: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  insuranceEstimate: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  patientEstimate: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  notes: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryDentalToothConditionSchema = z.object({
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  status: z.string(),
  surface: z.array(HealthcareAncillaryDentalToothSurfaceSchema).optional(),
  notes: z.string().optional()
});

export const HealthcareAncillaryDentalToothRestorationSchema = z.object({
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  material: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  datePerformed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  surface: z.array(HealthcareAncillaryDentalToothSurfaceSchema).optional()
});

export const HealthcareAncillaryDentalToothRecordSchema = z.object({
  toothNumber: z.number().int(),
  notation: z.enum(["fdi", "universal", "palmer"]),
  surfaces: z.array(HealthcareAncillaryDentalToothSurfaceSchema).optional(),
  conditions: z.array(HealthcareAncillaryDentalToothConditionSchema).optional(),
  restorations: z.array(HealthcareAncillaryDentalToothRestorationSchema).optional(),
  missing: z.boolean().optional(),
  implant: z.boolean().optional(),
  notes: z.string().optional()
});

export const HealthcareAncillaryDentalOdontogramSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  capturedAt: z.string().datetime().transform((str) => new Date(str)),
  capturedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  teeth: z.array(HealthcareAncillaryDentalToothRecordSchema)
});

export const HealthcareAncillaryDentalToothNotationSystemSchema = z.enum(["fdi", "universal", "palmer"]);

export const HealthcareAncillaryDentalTreatmentItemStatusSchema = z.enum(["planned", "scheduled", "inProgress", "completed", "cancelled"]);

export const HealthcareAncillaryDentalTreatmentPlanStatusSchema = z.enum(["draft", "proposed", "accepted", "inProgress", "completed", "cancelled"]);

export const HealthcareAncillaryDentalLabDentalLabCaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  labProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  treatmentPlanItem: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  type: z.enum(["crown", "bridge", "denture", "partial", "veneer", "implantAbutment", "nightGuard", "retainer", "splint", "other"]),
  status: z.enum(["draft", "sent", "inFabrication", "shippedToClinic", "received", "delivered", "returned"]),
  shade: z.string().optional(),
  material: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  units: z.number().int(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  sentDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  receivedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  deliveredDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  cost: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryDentalLabDentalLabCaseStatusSchema = z.enum(["draft", "sent", "inFabrication", "shippedToClinic", "received", "delivered", "returned"]);

export const HealthcareAncillaryDentalLabDentalLabProviderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  address: z.object({
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
}).optional()
}).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  specialties: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  active: z.boolean(),
  avgTurnaroundDays: z.number().int().optional()
});

export const HealthcareAncillaryDentalLabLabCaseReturnSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  labCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  returnedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  returnedDate: z.string().datetime().transform((str) => new Date(str)),
  reason: z.string(),
  remakeRequired: z.boolean()
});

export const HealthcareAncillaryDentalLabLabCaseTypeSchema = z.enum(["crown", "bridge", "denture", "partial", "veneer", "implantAbutment", "nightGuard", "retainer", "splint", "other"]);

export const HealthcareAncillaryDentalLabLabCommunicationNoteSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  labCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  message: z.string(),
  sentAt: z.string().datetime().transform((str) => new Date(str)),
  readAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  attachments: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareAncillaryEndodonticCanalRecordSchema = z.object({
  canalName: z.string(),
  workingLength: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  apexLocatorReading: z.string().optional(),
  radiographicConfirmation: z.boolean().optional(),
  masterApicalFile: z.string().optional(),
  obturated: z.boolean().optional(),
  obturationMethod: z.enum(["lateralCondensation", "warmVertical", "singleCone", "carrierBased"]).optional(),
  material: z.string().optional(),
  fillLength: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareAncillaryEndodonticEndoRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  toothNumber: z.number().int(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["initiated", "accessOpened", "canalsShaped", "obturated", "completed", "referredOut"]),
  startDate: z.string().datetime().transform((str) => new Date(str)),
  completionDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  canals: z.array(HealthcareAncillaryEndodonticCanalRecordSchema),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryEndodonticEndoRecordStatusSchema = z.enum(["initiated", "accessOpened", "canalsShaped", "obturated", "completed", "referredOut"]);

export const HealthcareAncillaryEndodonticEndoRetreatmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  originalEndoRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reason: z.string(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startDate: z.string().datetime().transform((str) => new Date(str))
});

export const HealthcareAncillaryEndodonticIrrigationRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  endoRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  irrigant: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  concentration: z.string().optional(),
  volume: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  technique: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareAncillaryEndodonticObturationMethodSchema = z.enum(["lateralCondensation", "warmVertical", "singleCone", "carrierBased"]);

export const HealthcareAncillaryLaboratoryDiagnosticReportMediaSchema = z.object({
  comment: z.string().optional(),
  link: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareAncillaryLaboratoryDiagnosticReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  basedOn: z.array(HealthcareCoreReferenceSchema).optional(),
  status: z.enum(["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "enteredInError", "unknown"]),
  category: z.array(HealthcareCoreCodeableConceptSchema),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  effectiveDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  issued: z.string().datetime().transform((str) => new Date(str)).optional(),
  performer: z.array(HealthcareCoreReferenceSchema).optional(),
  resultsInterpreter: z.array(HealthcareCoreReferenceSchema).optional(),
  specimen: z.array(HealthcareCoreReferenceSchema).optional(),
  result: z.array(HealthcareCoreReferenceSchema).optional(),
  imagingStudy: z.array(HealthcareCoreReferenceSchema).optional(),
  media: z.array(HealthcareAncillaryLaboratoryDiagnosticReportMediaSchema).optional(),
  conclusion: z.string().optional(),
  conclusionCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  presentedForm: z.array(HealthcareCoreAttachmentSchema).optional()
});

export const HealthcareAncillaryLaboratoryDiagnosticReportStatusSchema = z.enum(["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "enteredInError", "unknown"]);

export const HealthcareAncillaryLaboratoryLabResultVerificationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  report: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["unverified", "preliminaryReview", "verified", "amended", "corrected"]),
  verifiedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  verifiedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  verificationMethod: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  comments: z.string().optional(),
  previousStatus: z.enum(["unverified", "preliminaryReview", "verified", "amended", "corrected"]).optional()
});

export const HealthcareAncillaryLaboratoryResultPanelSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  name: z.string(),
  members: z.array(HealthcareCoreReferenceSchema),
  status: z.enum(["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "enteredInError", "unknown"]),
  orderedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performedAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAncillaryLaboratorySpecimenProcessingSchema = z.object({
  description: z.string().optional(),
  procedure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  additive: z.array(HealthcareCoreReferenceSchema).optional(),
  timeDateTime: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAncillaryLaboratorySpecimenContainerSchema = z.object({
  identifier: z.string().optional(),
  description: z.string().optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  capacity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  specimenQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareAncillaryLaboratorySpecimenSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  accessionIdentifier: z.string().optional(),
  status: z.enum(["available", "unavailable", "unsatisfactory", "enteredInError"]).optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  receivedTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  parent: z.array(HealthcareCoreReferenceSchema).optional(),
  request: z.array(HealthcareCoreReferenceSchema).optional(),
  collection: z.object({
  collector: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  collectedDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  method: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  bodySite: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  fastingStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
}).optional(),
  processing: z.array(HealthcareAncillaryLaboratorySpecimenProcessingSchema).optional(),
  container: z.array(HealthcareAncillaryLaboratorySpecimenContainerSchema).optional(),
  condition: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryLaboratorySpecimenCollectionSchema = z.object({
  collector: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  collectedDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  method: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  bodySite: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  fastingStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareAncillaryLaboratorySpecimenStatusSchema = z.enum(["available", "unavailable", "unsatisfactory", "enteredInError"]);

export const HealthcareAncillaryLaboratoryVerificationStatusSchema = z.enum(["unverified", "preliminaryReview", "verified", "amended", "corrected"]);

export const HealthcareAncillaryMedicationAdministrationsMedicationAdministrationPerformerSchema = z.object({
  function: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  actor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareAncillaryMedicationAdministrationsMedicationAdministrationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["inProgress", "notDone", "onHold", "completed", "enteredInError", "stopped", "unknown"]),
  statusReason: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  category: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  medicationCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  medicationReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  supportingInformation: z.array(HealthcareCoreReferenceSchema).optional(),
  effectiveDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  performer: z.array(HealthcareAncillaryMedicationAdministrationsMedicationAdministrationPerformerSchema).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  request: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  device: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  dosage: z.object({
  text: z.string().optional(),
  site: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  route: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  method: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  dose: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  rateRatio: z.object({
  numerator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  denominator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  rateQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  eventHistory: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareAncillaryMedicationAdministrationsMedicationAdministrationDosageSchema = z.object({
  text: z.string().optional(),
  site: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  route: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  method: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  dose: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  rateRatio: z.object({
  numerator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  denominator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  rateQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareAncillaryMedicationsFormularyItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  medication: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["active", "inactive", "enteredInError"]),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  tier: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  priorAuthRequired: z.boolean().optional(),
  quantityLimit: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  stepTherapyRequired: z.boolean().optional(),
  genericAvailable: z.boolean().optional(),
  notes: z.string().optional()
});

export const HealthcareAncillaryMedicationsFormularyItemStatusSchema = z.enum(["active", "inactive", "enteredInError"]);

export const HealthcareAncillaryMedicationsMedicationIngredientSchema = z.object({
  itemCodeableConcept: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  itemReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  isActive: z.boolean().optional(),
  strength: z.object({
  numerator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  denominator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional()
});

export const HealthcareAncillaryMedicationsMedicationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  status: z.enum(["active", "inactive", "enteredInError"]).optional(),
  manufacturer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  form: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  amount: z.object({
  numerator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  denominator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  ingredient: z.array(HealthcareAncillaryMedicationsMedicationIngredientSchema).optional(),
  batch: z.object({
  lotNumber: z.string().optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
}).optional()
});

export const HealthcareAncillaryMedicationsMedicationBatchSchema = z.object({
  lotNumber: z.string().optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareAncillaryMedicationsMedicationStatusSchema = z.enum(["active", "inactive", "enteredInError"]);

export const HealthcareAncillaryOralSurgeryDentalDentalPathologySpecimenSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  extractionRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  specimenType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  collectedAt: z.string().datetime().transform((str) => new Date(str)),
  collectedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  sentToLab: z.boolean(),
  labReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  labReceivedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  result: z.string().optional(),
  malignancyDetected: z.boolean().optional()
});

export const HealthcareAncillaryOralSurgeryDentalExtractionRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toothNumber: z.number().int(),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  extractionType: z.enum(["simple", "surgical"]),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  rootTipRetained: z.boolean().optional(),
  socketPreservation: z.boolean().optional(),
  preservationMaterial: z.string().optional(),
  hemostasisAchieved: z.boolean(),
  specimenCollected: z.boolean().optional(),
  specimenReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryOralSurgeryDentalExtractionTypeSchema = z.enum(["simple", "surgical"]);

export const HealthcareAncillaryOralSurgeryDentalHealingFollowUpSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  relatedProcedure: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  actualDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  healingStatus: z.enum(["normal", "delayed", "complication", "referred"]),
  findings: z.string().optional(),
  nextFollowUp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  note: z.string().optional()
});

export const HealthcareAncillaryOralSurgeryDentalHealingStatusSchema = z.enum(["normal", "delayed", "complication", "referred"]);

export const HealthcareAncillaryOralSurgeryDentalPostOpInstructionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  procedure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  issueDate: z.string().datetime().transform((str) => new Date(str)),
  issuedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  instructions: z.array(z.string()),
  medications: z.array(HealthcareCoreReferenceSchema).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  emergencyContact: z.string().optional(),
  signedByPatient: z.boolean().optional()
});

export const HealthcareAncillaryOrthodonticAlignerTraySchema = z.object({
  trayNumber: z.number().int(),
  status: z.enum(["pending", "active", "completed", "skipped"]),
  startDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  endDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  wearHoursPerDay: z.number().int().optional(),
  notes: z.string().optional()
});

export const HealthcareAncillaryOrthodonticAlignerSeriesSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  orthoCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  totalTrays: z.number().int(),
  currentTray: z.number().int(),
  trays: z.array(HealthcareAncillaryOrthodonticAlignerTraySchema)
});

export const HealthcareAncillaryOrthodonticApplianceTypeSchema = z.enum(["fixedBraces", "clearAligners", "functionalAppliance", "retainer", "other"]);

export const HealthcareAncillaryOrthodonticOrthoCaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["assessment", "activeTreatment", "retention", "completed", "discontinued"]),
  startDate: z.string().datetime().transform((str) => new Date(str)),
  estimatedEndDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  actualEndDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  diagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  treatmentObjectives: z.array(z.string()).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryOrthodonticOrthoCaseStatusSchema = z.enum(["assessment", "activeTreatment", "retention", "completed", "discontinued"]);

export const HealthcareAncillaryOrthodonticOrthoProgressRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  orthoCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  date: z.string().datetime().transform((str) => new Date(str)),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  findings: z.string(),
  photosReference: z.array(HealthcareCoreReferenceSchema).optional(),
  adjustmentsMade: z.string().optional(),
  nextVisitPlan: z.string().optional()
});

export const HealthcareAncillaryOrthodonticOrthoStageSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  orthoCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  name: z.string(),
  sequence: z.number().int(),
  startDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  endDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  description: z.string().optional(),
  applianceType: z.enum(["fixedBraces", "clearAligners", "functionalAppliance", "retainer", "other"]).optional()
});

export const HealthcareAncillaryOrthodonticTrayStatusSchema = z.enum(["pending", "active", "completed", "skipped"]);

export const HealthcareAncillaryPediatricDentalBehaviorAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  scale: z.enum(["frankl", "adpbrs"]),
  score: z.number().int(),
  description: z.string().optional(),
  assessedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessedAt: z.string().datetime().transform((str) => new Date(str)),
  managementTechniques: z.array(z.string()).optional()
});

export const HealthcareAncillaryPediatricDentalBehaviorScaleSchema = z.enum(["frankl", "adpbrs"]);

export const HealthcareAncillaryPediatricDentalEruptionRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toothNumber: z.number().int(),
  notation: z.enum(["fdi", "universal", "palmer"]),
  eruptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  recordedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  notes: z.string().optional()
});

export const HealthcareAncillaryPediatricDentalExfoliationRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toothNumber: z.number().int(),
  notation: z.enum(["fdi", "universal", "palmer"]),
  exfoliationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  recordedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareAncillaryPediatricDentalFluorideApplicationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  product: z.string(),
  concentration: z.string().optional(),
  method: z.enum(["varnish", "tray", "rinse", "foam"]),
  performedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  note: z.string().optional()
});

export const HealthcareAncillaryPediatricDentalFluorideMethodSchema = z.enum(["varnish", "tray", "rinse", "foam"]);

export const HealthcareAncillaryPediatricDentalSealantRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toothNumber: z.number().int(),
  surface: z.string(),
  status: z.enum(["placed", "intact", "repaired", "lost"]),
  placedDate: z.string().datetime().transform((str) => new Date(str)),
  placedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  material: z.string().optional()
});

export const HealthcareAncillaryPediatricDentalSealantStatusSchema = z.enum(["placed", "intact", "repaired", "lost"]);

export const HealthcareAncillaryPediatricDentalSpaceMaintainerSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  type: z.enum(["bandAndLoop", "distalShoe", "lingual", "nance", "transpalatal"]),
  extractedTooth: z.number().int(),
  status: z.enum(["placed", "active", "removed"]),
  placedDate: z.string().datetime().transform((str) => new Date(str)),
  placedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  removedDate: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAncillaryPediatricDentalSpaceMaintainerStatusSchema = z.enum(["placed", "active", "removed"]);

export const HealthcareAncillaryPediatricDentalSpaceMaintainerTypeSchema = z.enum(["bandAndLoop", "distalShoe", "lingual", "nance", "transpalatal"]);

export const HealthcareAncillaryPediatricDentalToothNotationSystemSchema = z.enum(["fdi", "universal", "palmer"]);

export const HealthcareAncillaryPeriodontalFurcationGradeSchema = z.enum(["gradeI", "gradeII", "gradeIII"]);

export const HealthcareAncillaryPeriodontalFurcationRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  perioExam: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  toothNumber: z.number().int(),
  grade: z.enum(["gradeI", "gradeII", "gradeIII"]),
  location: z.string().optional()
});

export const HealthcareAncillaryPeriodontalMobilityGradeSchema = z.enum(["grade0", "gradeI", "gradeII", "gradeIII"]);

export const HealthcareAncillaryPeriodontalMobilityRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  perioExam: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  toothNumber: z.number().int(),
  grade: z.enum(["grade0", "gradeI", "gradeII", "gradeIII"])
});

export const HealthcareAncillaryPeriodontalPerioSiteSchema = z.object({
  toothNumber: z.number().int(),
  site: z.enum(["mesialBuccal", "buccal", "distalBuccal", "mesialLingual", "lingual", "distalLingual"]),
  pocketDepth: z.number().int(),
  recession: z.number().int().optional(),
  clinicalAttachmentLevel: z.number().int().optional(),
  bleedingOnProbing: z.boolean(),
  suppuration: z.boolean().optional(),
  plaque: z.boolean().optional()
});

export const HealthcareAncillaryPeriodontalPerioExamSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  examDate: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["inProgress", "completed", "locked"]),
  sites: z.array(HealthcareAncillaryPeriodontalPerioSiteSchema),
  summary: z.string().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryPeriodontalPerioExamStatusSchema = z.enum(["inProgress", "completed", "locked"]);

export const HealthcareAncillaryPeriodontalPerioSiteLocationSchema = z.enum(["mesialBuccal", "buccal", "distalBuccal", "mesialLingual", "lingual", "distalLingual"]);

export const HealthcareAncillaryPharmacyAdherenceRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  medication: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  adherenceRate: z.number().optional(),
  missedDoses: z.number().int().optional(),
  totalDoses: z.number().int().optional(),
  source: z.enum(["selfReport", "deviceMonitoring", "pharmacyRefill", "clinicianAssessment"]),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryPharmacyAdherenceSourceSchema = z.enum(["selfReport", "deviceMonitoring", "pharmacyRefill", "clinicianAssessment"]);

export const HealthcareAncillaryPharmacyDispenseSubstitutionSchema = z.object({
  wasSubstituted: z.boolean(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reason: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  responsibleParty: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareAncillaryPharmacyMedicationDispensePerformerSchema = z.object({
  function: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  actor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareCoreDoseAndRateSchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  doseQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  doseRange: z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  rateQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  rateRange: z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  rateRatio: z.object({
  numerator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  denominator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional()
});

export const HealthcareCoreDosageSchema = z.object({
  sequence: z.number().int().optional(),
  text: z.string().optional(),
  patientInstruction: z.string().optional(),
  timing: z.object({
  event: z.array(z.string().datetime().transform((str) => new Date(str))).optional(),
  repeat: z.object({
  count: z.number().int().gte(0).optional(),
  duration: z.number().gte(0).optional(),
  durationUnit: z.string().optional(),
  frequency: z.number().int().gte(1).optional(),
  period: z.number().gte(0).optional(),
  periodUnit: z.string().optional(),
  dayOfWeek: z.array(z.string()).optional(),
  timeOfDay: z.array(z.string()).optional()
}).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
}).optional(),
  site: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  route: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  method: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  doseAndRate: z.array(HealthcareCoreDoseAndRateSchema).optional()
});

export const HealthcareAncillaryPharmacyMedicationDispenseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["preparation", "inProgress", "cancelled", "onHold", "completed", "enteredInError", "stopped", "declined", "unknown"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  category: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  medicationCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  medicationReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.array(HealthcareAncillaryPharmacyMedicationDispensePerformerSchema).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  authorizingPrescription: z.array(HealthcareCoreReferenceSchema).optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  daysSupply: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  whenPrepared: z.string().datetime().transform((str) => new Date(str)).optional(),
  whenHandedOver: z.string().datetime().transform((str) => new Date(str)).optional(),
  destination: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  receiver: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  dosageInstruction: z.array(HealthcareCoreDosageSchema).optional(),
  substitution: z.object({
  wasSubstituted: z.boolean(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reason: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  responsibleParty: z.array(HealthcareCoreReferenceSchema).optional()
}).optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  copayAmount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional()
});

export const HealthcareAncillaryPharmacyMedicationDispenseStatusSchema = z.enum(["preparation", "inProgress", "cancelled", "onHold", "completed", "enteredInError", "stopped", "declined", "unknown"]);

export const HealthcareAncillaryPharmacyReconciliationItemSchema = z.object({
  medication: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  priorStatus: z.enum(["active", "discontinued", "changed", "noChange", "new"]),
  action: z.enum(["continue", "discontinue", "modify", "add", "hold"]),
  newMedicationRequest: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reason: z.string().optional()
});

export const HealthcareAncillaryPharmacyMedicationReconciliationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["inProgress", "completed", "cancelled"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  type: z.enum(["admission", "discharge", "transfer"]),
  items: z.array(HealthcareAncillaryPharmacyReconciliationItemSchema),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryPharmacyReconciliationActionSchema = z.enum(["continue", "discontinue", "modify", "add", "hold"]);

export const HealthcareAncillaryPharmacyReconciliationMedStatusSchema = z.enum(["active", "discontinued", "changed", "noChange", "new"]);

export const HealthcareAncillaryPharmacyReconciliationStatusSchema = z.enum(["inProgress", "completed", "cancelled"]);

export const HealthcareAncillaryPharmacyReconciliationTypeSchema = z.enum(["admission", "discharge", "transfer"]);

export const HealthcareAncillaryProsthodonticImpressionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  prosthoRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["conventional", "digital", "alginate", "pvs", "polyether"]),
  material: z.string().optional(),
  date: z.string().datetime().transform((str) => new Date(str)),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareAncillaryProsthodonticImpressionTypeSchema = z.enum(["conventional", "digital", "alginate", "pvs", "polyether"]);

export const HealthcareAncillaryProsthodonticLabCaseLinkSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  prosthoRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  labCaseId: z.string(),
  labProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  sentDate: z.string().datetime().transform((str) => new Date(str)),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  receivedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["pending", "inFabrication", "shipped", "received", "returned"])
});

export const HealthcareAncillaryProsthodonticLabCaseLinkStatusSchema = z.enum(["pending", "inFabrication", "shipped", "received", "returned"]);

export const HealthcareAncillaryProsthodonticProsthoRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toothNumber: z.number().int().optional(),
  type: z.enum(["crown", "bridge", "denture", "partialDenture", "veneer", "inlay", "onlay", "implantSupported"]),
  status: z.enum(["planned", "impressionTaken", "labSent", "tryIn", "delivered", "remade"]),
  material: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareAncillaryProsthodonticProsthoStatusSchema = z.enum(["planned", "impressionTaken", "labSent", "tryIn", "delivered", "remade"]);

export const HealthcareAncillaryProsthodonticProsthoTypeSchema = z.enum(["crown", "bridge", "denture", "partialDenture", "veneer", "inlay", "onlay", "implantSupported"]);

export const HealthcareAncillaryProsthodonticShadeGuideSystemSchema = z.enum(["vitaClassical", "vita3dMaster", "chromascop", "other"]);

export const HealthcareAncillaryProsthodonticShadeSelectionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  prosthoRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  guideSystem: z.enum(["vitaClassical", "vita3dMaster", "chromascop", "other"]),
  shadeValue: z.string(),
  selectedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  selectedDate: z.string().datetime().transform((str) => new Date(str)),
  notes: z.string().optional()
});

export const HealthcareAncillaryRadiologyImagingStudyPerformerSchema = z.object({
  function: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  actor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareAncillaryRadiologyImagingStudyInstanceSchema = z.object({
  uid: z.string(),
  sopClass: z.string(),
  number: z.number().int().optional(),
  title: z.string().optional()
});

export const HealthcareAncillaryRadiologyImagingStudySeriesSchema = z.object({
  uid: z.string(),
  number: z.number().int().optional(),
  modality: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  description: z.string().optional(),
  numberOfInstances: z.number().int().optional(),
  endpoint: z.array(z.string()).optional(),
  bodySite: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  laterality: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  started: z.string().datetime().transform((str) => new Date(str)).optional(),
  performer: z.array(HealthcareAncillaryRadiologyImagingStudyPerformerSchema).optional(),
  instance: z.array(HealthcareAncillaryRadiologyImagingStudyInstanceSchema).optional()
});

export const HealthcareAncillaryRadiologyImagingStudySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["registered", "available", "cancelled", "enteredInError", "unknown"]),
  modality: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  started: z.string().datetime().transform((str) => new Date(str)).optional(),
  basedOn: z.array(HealthcareCoreReferenceSchema).optional(),
  referrer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  interpreter: z.array(HealthcareCoreReferenceSchema).optional(),
  endpoint: z.array(z.string()).optional(),
  numberOfSeries: z.number().int().optional(),
  numberOfInstances: z.number().int().optional(),
  procedureReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  procedureCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  description: z.string().optional(),
  series: z.array(HealthcareAncillaryRadiologyImagingStudySeriesSchema).optional(),
  pacsUrl: z.string().optional(),
  reportReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareAncillaryRadiologyImagingStudyStatusSchema = z.enum(["registered", "available", "cancelled", "enteredInError", "unknown"]);

export const HealthcareAncillaryRadiologyRadiologyAddendumSchema = z.object({
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  date: z.string().datetime().transform((str) => new Date(str)),
  text: z.string()
});

export const HealthcareAncillaryRadiologyRadiologyFindingSchema = z.object({
  bodySite: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  description: z.string(),
  severity: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  relatedObservation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareAncillaryRadiologyRadiologyReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "enteredInError", "unknown"]),
  study: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  issued: z.string().datetime().transform((str) => new Date(str)),
  performer: z.array(HealthcareCoreReferenceSchema),
  resultsInterpreter: z.array(HealthcareCoreReferenceSchema).optional(),
  impression: z.string().optional(),
  findings: z.array(HealthcareAncillaryRadiologyRadiologyFindingSchema),
  conclusion: z.string().optional(),
  conclusionCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  presentedForm: z.array(HealthcareCoreAttachmentSchema).optional(),
  addendum: z.array(HealthcareAncillaryRadiologyRadiologyAddendumSchema).optional()
});

export const HealthcareClinicalADTEventsADTEventSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  eventType: z.enum(["preAdmit", "admit", "transfer", "discharge", "cancelAdmit", "cancelTransfer", "cancelDischarge", "updatePatient", "mergePatient", "swapPatient", "registerOutpatient", "cancelRegistration", "leaveOfAbsence", "returnFromLeave"]),
  eventDateTime: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["completed", "cancelled", "enteredInError"]),
  fromLocation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  toLocation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  fromBed: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  toBed: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  admittingProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  attendingProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  referringProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  admitSource: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  dischargeDisposition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  dischargeDestination: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  previousEncounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  triggerEvent: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareClinicalADTEventsADTEventStatusSchema = z.enum(["completed", "cancelled", "enteredInError"]);

export const HealthcareClinicalADTEventsADTEventTypeSchema = z.enum(["preAdmit", "admit", "transfer", "discharge", "cancelAdmit", "cancelTransfer", "cancelDischarge", "updatePatient", "mergePatient", "swapPatient", "registerOutpatient", "cancelRegistration", "leaveOfAbsence", "returnFromLeave"]);

export const HealthcareClinicalAllergiesAllergyCategorySchema = z.enum(["food", "medication", "environment", "biologic"]);

export const HealthcareClinicalAllergiesAllergyCriticalitySchema = z.enum(["low", "high", "unableToAssess"]);

export const HealthcareClinicalAllergiesAllergyReactionSchema = z.object({
  substance: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  manifestation: z.array(HealthcareCoreCodeableConceptSchema),
  description: z.string().optional(),
  onset: z.string().datetime().transform((str) => new Date(str)).optional(),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
  exposureRoute: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalAllergiesAllergyIntoleranceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  clinicalStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  verificationStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  type: z.enum(["allergy", "intolerance"]).optional(),
  category: z.array(HealthcareClinicalAllergiesAllergyCategorySchema).optional(),
  criticality: z.enum(["low", "high", "unableToAssess"]).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  onsetDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  recordedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  recorder: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  asserter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  lastOccurrence: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  reaction: z.array(HealthcareClinicalAllergiesAllergyReactionSchema).optional()
});

export const HealthcareClinicalAllergiesAllergyTypeSchema = z.enum(["allergy", "intolerance"]);

export const HealthcareClinicalAllergiesReactionSeveritySchema = z.enum(["mild", "moderate", "severe"]);

export const HealthcareClinicalCommunicationClinicalHandoffSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  fromProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  handoffTime: z.string().datetime().transform((str) => new Date(str)),
  type: z.enum(["shiftChange", "transfer", "discharge", "escalation", "procedural"]),
  situation: z.string(),
  background: z.string(),
  assessment: z.string(),
  recommendation: z.string(),
  tasksOutstanding: z.array(z.string()).optional(),
  criticalValues: z.array(z.string()).optional(),
  isolationStatus: z.string().optional(),
  fallRisk: z.boolean().optional(),
  codeStatus: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalCommunicationClinicalMessageSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  sender: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  recipient: z.array(HealthcareCoreReferenceSchema),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  priority: z.enum(["routine", "urgent", "stat"]),
  category: z.enum(["order", "result", "consultation", "administrative", "referral", "safety"]),
  subject: z.string(),
  body: z.string(),
  sentAt: z.string().datetime().transform((str) => new Date(str)),
  readAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  acknowledgedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  requiresAcknowledgment: z.boolean().optional(),
  relatedResource: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalCommunicationHandoffTypeSchema = z.enum(["shiftChange", "transfer", "discharge", "escalation", "procedural"]);

export const HealthcareClinicalCommunicationMessageCategorySchema = z.enum(["order", "result", "consultation", "administrative", "referral", "safety"]);

export const HealthcareClinicalCommunicationMessagePrioritySchema = z.enum(["routine", "urgent", "stat"]);

export const HealthcareClinicalCompositionsAttesterModeSchema = z.enum(["personal", "professional", "legal", "official"]);

export const HealthcareClinicalCompositionsCompositionAttesterSchema = z.object({
  mode: z.enum(["personal", "professional", "legal", "official"]),
  time: z.string().datetime().transform((str) => new Date(str)).optional(),
  party: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalCompositionsCompositionRelatesToSchema = z.object({
  code: z.enum(["replaces", "transforms", "signs", "appends"]),
  target: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareClinicalCompositionsCompositionEventSchema = z.object({
  code: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  detail: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareClinicalCompositionsCompositionSectionSchema: z.ZodTypeAny = z.object({
  title: z.string().optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  author: z.array(HealthcareCoreReferenceSchema).optional(),
  focus: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  text: z.string().optional(),
  mode: z.enum(["working", "snapshot", "changes"]).optional(),
  orderedBy: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  entry: z.array(HealthcareCoreReferenceSchema).optional(),
  emptyReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  section: z.array(z.lazy(() => HealthcareClinicalCompositionsCompositionSectionSchema)).optional()
});

export const HealthcareClinicalCompositionsCompositionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["preliminary", "final", "amended", "enteredInError"]),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  date: z.string().datetime().transform((str) => new Date(str)),
  author: z.array(HealthcareCoreReferenceSchema),
  title: z.string(),
  confidentiality: z.enum(["U", "L", "M", "N", "R", "V"]).optional(),
  attester: z.array(HealthcareClinicalCompositionsCompositionAttesterSchema).optional(),
  custodian: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  relatesTo: z.array(HealthcareClinicalCompositionsCompositionRelatesToSchema).optional(),
  event: z.array(HealthcareClinicalCompositionsCompositionEventSchema).optional(),
  section: z.array(z.lazy(() => HealthcareClinicalCompositionsCompositionSectionSchema))
});

export const HealthcareClinicalCompositionsCompositionStatusSchema = z.enum(["preliminary", "final", "amended", "enteredInError"]);

export const HealthcareClinicalCompositionsDocumentRelationshipTypeSchema = z.enum(["replaces", "transforms", "signs", "appends"]);

export const HealthcareClinicalCompositionsSectionModeSchema = z.enum(["working", "snapshot", "changes"]);

export const HealthcareClinicalConditionsConditionStageSchema = z.object({
  summary: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  assessment: z.array(HealthcareCoreReferenceSchema).optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareClinicalConditionsConditionEvidenceSchema = z.object({
  code: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  detail: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareClinicalConditionsConditionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  clinicalStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  verificationStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  category: z.array(HealthcareCoreCodeableConceptSchema),
  severity: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  bodySite: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  onsetDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  onsetAge: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  onsetString: z.string().optional(),
  abatementDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  abatementString: z.string().optional(),
  recordedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  recorder: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  asserter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  stage: z.array(HealthcareClinicalConditionsConditionStageSchema).optional(),
  evidence: z.array(HealthcareClinicalConditionsConditionEvidenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalDocumentReferencesClinicalNoteTypeSchema = z.enum(["soapNote", "progressNote", "admissionNote", "dischargeNote", "consultNote", "operativeNote", "nursingNote", "therapyNote"]);

export const HealthcareClinicalDocumentReferencesDocumentContentSchema = z.object({
  attachment: z.object({
  contentType: z.string().optional(),
  language: z.string().optional(),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  title: z.string().optional(),
  size: z.number().int().gte(0).optional(),
  hash: z.string().optional(),
  creation: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  format: z.string().optional()
});

export const HealthcareClinicalDocumentReferencesDocumentContextSchema = z.object({
  encounter: z.array(HealthcareCoreReferenceSchema).optional(),
  event: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  facilityType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  practiceSetting: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareClinicalDocumentReferencesDocumentReferenceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["current", "superseded", "enteredInError"]),
  docStatus: z.string().optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  date: z.string().datetime().transform((str) => new Date(str)),
  author: z.array(HealthcareCoreReferenceSchema),
  authenticator: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  custodian: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  description: z.string().optional(),
  securityLabel: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  content: z.array(HealthcareClinicalDocumentReferencesDocumentContentSchema),
  context: z.object({
  encounter: z.array(HealthcareCoreReferenceSchema).optional(),
  event: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  facilityType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  practiceSetting: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
}).optional(),
  noteType: z.enum(["soapNote", "progressNote", "admissionNote", "dischargeNote", "consultNote", "operativeNote", "nursingNote", "therapyNote"]).optional(),
  soapSection: z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional()
}).optional()
});

export const HealthcareClinicalDocumentReferencesDocumentReferenceStatusSchema = z.enum(["current", "superseded", "enteredInError"]);

export const HealthcareClinicalDocumentReferencesSoapNoteContentSchema = z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional()
});

export const HealthcareClinicalEncountersEncounterStatusHistorySchema = z.object({
  status: z.enum(["planned", "arrived", "triaged", "inProgress", "onLeave", "finished", "cancelled", "enteredInError", "unknown"]),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
})
});

export const HealthcareClinicalEncountersEncounterParticipantSchema = z.object({
  type: z.array(HealthcareCoreCodeableConceptSchema),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  individual: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  isPrimary: z.boolean().optional()
});

export const HealthcareClinicalEncountersEncounterDiagnosisSchema = z.object({
  condition: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  use: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  rank: z.number().int().optional()
});

export const HealthcareClinicalEncountersEncounterLocationSchema = z.object({
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["planned", "active", "reserved", "completed"]).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const HealthcareClinicalEncountersEncounterSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["planned", "arrived", "triaged", "inProgress", "onLeave", "finished", "cancelled", "enteredInError", "unknown"]),
  statusHistory: z.array(HealthcareClinicalEncountersEncounterStatusHistorySchema).optional(),
  class: z.enum(["ambulatory", "inpatient", "emergency", "observation", "home", "virtual", "fieldVisit"]),
  type: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  serviceType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  priority: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  basedOn: z.array(HealthcareCoreReferenceSchema).optional(),
  participant: z.array(HealthcareClinicalEncountersEncounterParticipantSchema),
  appointment: z.array(HealthcareCoreReferenceSchema).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  length: z.string().optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  diagnosis: z.array(HealthcareClinicalEncountersEncounterDiagnosisSchema),
  hospitalization: z.object({
  admitSource: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reAdmission: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  dietPreference: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  dischargeDisposition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  destination: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dischargeInstruction: z.string().optional()
}).optional(),
  location: z.array(HealthcareClinicalEncountersEncounterLocationSchema),
  serviceProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  partOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  chiefComplaint: z.string().optional(),
  notes: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalEncountersEncounterHospitalizationSchema = z.object({
  admitSource: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reAdmission: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  dietPreference: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  dischargeDisposition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  destination: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dischargeInstruction: z.string().optional()
});

export const HealthcareClinicalEncountersEncounterLocationStatusSchema = z.enum(["planned", "active", "reserved", "completed"]);

export const HealthcareClinicalEncountersEncounterStatusSchema = z.enum(["planned", "arrived", "triaged", "inProgress", "onLeave", "finished", "cancelled", "enteredInError", "unknown"]);

export const HealthcareClinicalEpisodesOfCareEpisodeOfCareStatusHistorySchema = z.object({
  status: z.enum(["planned", "waitlist", "active", "onhold", "finished", "cancelled", "enteredInError"]),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
})
});

export const HealthcareClinicalEpisodesOfCareEpisodeOfCareDiagnosisSchema = z.object({
  condition: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  role: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  rank: z.number().int().optional()
});

export const HealthcareClinicalEpisodesOfCareEpisodeOfCareSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["planned", "waitlist", "active", "onhold", "finished", "cancelled", "enteredInError"]),
  statusHistory: z.array(HealthcareClinicalEpisodesOfCareEpisodeOfCareStatusHistorySchema).optional(),
  type: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  diagnosis: z.array(HealthcareClinicalEpisodesOfCareEpisodeOfCareDiagnosisSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  managingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  referralRequest: z.array(HealthcareCoreReferenceSchema).optional(),
  careManager: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  team: z.array(HealthcareCoreReferenceSchema).optional(),
  account: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareClinicalFamilyHistoryFamilyHistoryStatusSchema = z.enum(["partial", "completed", "enteredInError", "healthUnknown"]);

export const HealthcareClinicalFamilyHistoryFamilyMemberConditionSchema = z.object({
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  outcome: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  onsetAge: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  onsetString: z.string().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalFamilyHistoryFamilyMemberHistorySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["partial", "completed", "enteredInError", "healthUnknown"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  date: z.string().datetime().transform((str) => new Date(str)).optional(),
  name: z.string().optional(),
  relationship: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  sex: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  bornDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  ageAge: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  ageString: z.string().optional(),
  deceasedBoolean: z.boolean().optional(),
  deceasedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  deceasedAge: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  condition: z.array(HealthcareClinicalFamilyHistoryFamilyMemberConditionSchema).optional()
});

export const HealthcareClinicalFlagsFlagSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "inactive", "enteredInError"]),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  description: z.string().optional(),
  mitigation: z.string().optional()
});

export const HealthcareClinicalHospitalBehavioralHealthBehavioralHealthPlanSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  goals: z.array(z.string()).optional(),
  interventions: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
  privileges: z.enum(["openWard", "groundPrivileges", "offUnit", "passes"]),
  contactRestrictions: z.string().optional(),
  status: z.string()
});

export const HealthcareClinicalHospitalBehavioralHealthHoldStatusSchema = z.enum(["active", "extended", "expired", "discharged", "converted"]);

export const HealthcareClinicalHospitalBehavioralHealthHoldTypeSchema = z.enum(["emergencyHold", "seventyTwoHour", "courtOrdered"]);

export const HealthcareClinicalHospitalBehavioralHealthInvoluntaryHoldSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["emergencyHold", "seventyTwoHour", "courtOrdered"]),
  initiatedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  initiatedAt: z.string().datetime().transform((str) => new Date(str)),
  expiresAt: z.string().datetime().transform((str) => new Date(str)),
  extendedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  dischargedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  reason: z.string(),
  status: z.enum(["active", "extended", "expired", "discharged", "converted"]),
  courtOrderRef: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalHospitalBehavioralHealthLegalStatusSchema = z.enum(["voluntary", "involuntary", "emergencyHold"]);

export const HealthcareClinicalHospitalBehavioralHealthPatientPrivilegesSchema = z.enum(["openWard", "groundPrivileges", "offUnit", "passes"]);

export const HealthcareClinicalHospitalBehavioralHealthPsychiatricAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessmentDate: z.string().datetime().transform((str) => new Date(str)),
  presentingProblem: z.string(),
  mentalStatusExam: z.string().optional(),
  riskAssessment: z.object({
  suicideRisk: z.string(),
  homicideRisk: z.string(),
  selfHarmRisk: z.string(),
  elopementRisk: z.string()
}),
  safetyPlan: z.string().optional(),
  legalStatus: z.enum(["voluntary", "involuntary", "emergencyHold"]),
  diagnoses: z.array(HealthcareCoreCodeableConceptSchema).optional()
});

export const HealthcareClinicalHospitalBehavioralHealthRiskAssessmentSchema = z.object({
  suicideRisk: z.string(),
  homicideRisk: z.string(),
  selfHarmRisk: z.string(),
  elopementRisk: z.string()
});

export const HealthcareClinicalHospitalBehavioralHealthSubstanceScreeningToolSchema = z.enum(["audit", "dast", "cage", "assist"]);

export const HealthcareClinicalHospitalBehavioralHealthSubstanceUseDetailSchema = z.object({
  substance: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  frequency: z.string().optional(),
  lastUse: z.string().datetime().transform((str) => new Date(str)).optional(),
  route: z.string().optional(),
  quantity: z.string().optional()
});

export const HealthcareClinicalHospitalBehavioralHealthSubstanceUseAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessmentDate: z.string().datetime().transform((str) => new Date(str)),
  substances: z.array(HealthcareClinicalHospitalBehavioralHealthSubstanceUseDetailSchema),
  screeningTool: z.enum(["audit", "dast", "cage", "assist"]),
  score: z.number(),
  riskLevel: z.string(),
  briefIntervention: z.boolean().optional(),
  referral: z.boolean().optional()
});

export const HealthcareClinicalHospitalCodeBlueCodeBlueDebriefSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  event: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  debriefDate: z.string().datetime().transform((str) => new Date(str)),
  facilitator: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  attendees: z.array(HealthcareCoreReferenceSchema),
  protocolFollowed: z.boolean(),
  equipmentFunctioned: z.boolean(),
  improvements: z.array(z.string()).optional(),
  commendations: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional()
});

export const HealthcareClinicalHospitalCodeBlueCodeBlueMedicationSchema = z.object({
  medication: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  dose: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  route: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  administeredAt: z.string().datetime().transform((str) => new Date(str)),
  administeredBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalHospitalCodeBlueCodeBlueEventSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  calledAt: z.string().datetime().transform((str) => new Date(str)),
  calledBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["codeBlue", "rapidResponse", "codeStroke", "codeSepsis", "codeSTEMI", "codePink", "codeOrange", "mrt"]),
  responseTeam: z.array(HealthcareCoreReferenceSchema).optional(),
  arrivedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  resolvedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  outcome: z.enum(["rosc", "expired", "transferredToICU", "stabilized", "falseAlarm"]),
  cprInitiated: z.boolean().optional(),
  aedUsed: z.boolean().optional(),
  intubated: z.boolean().optional(),
  medications: z.array(HealthcareClinicalHospitalCodeBlueCodeBlueMedicationSchema).optional(),
  defibrillations: z.number().int().gte(0).optional(),
  duration: z.number().int().gte(0).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalHospitalCodeBlueCodeBlueOutcomeSchema = z.enum(["rosc", "expired", "transferredToICU", "stabilized", "falseAlarm"]);

export const HealthcareClinicalHospitalCodeBlueCodeBlueRoleSchema = z.enum(["teamLeader", "airway", "compressions", "medications", "recorder", "other"]);

export const HealthcareClinicalHospitalCodeBlueCodeBlueTeamMemberSchema = z.object({
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  role: z.enum(["teamLeader", "airway", "compressions", "medications", "recorder", "other"])
});

export const HealthcareClinicalHospitalCodeBlueCodeBlueTeamRosterSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(200),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  members: z.array(HealthcareClinicalHospitalCodeBlueCodeBlueTeamMemberSchema),
  active: z.boolean()
});

export const HealthcareClinicalHospitalCodeBlueEmergencyCodeTypeSchema = z.enum(["codeBlue", "rapidResponse", "codeStroke", "codeSepsis", "codeSTEMI", "codePink", "codeOrange", "mrt"]);

export const HealthcareClinicalHospitalDialysisAccessStatusSchema = z.enum(["functional", "malfunctioning", "infected", "removed"]);

export const HealthcareClinicalHospitalDialysisAccessTypeSchema = z.enum(["avFistula", "avGraft", "centralCatheter", "peritonealCatheter"]);

export const HealthcareClinicalHospitalDialysisDialysisAccessRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  accessType: z.enum(["avFistula", "avGraft", "centralCatheter", "peritonealCatheter"]),
  location: z.string(),
  placedDate: z.string().datetime().transform((str) => new Date(str)),
  placedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["functional", "malfunctioning", "infected", "removed"]),
  lastAssessment: z.string().datetime().transform((str) => new Date(str)).optional(),
  maturityDate: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareClinicalHospitalDialysisDialysisOrderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  dialysisType: z.enum(["hemodialysis", "peritonealDialysis", "crrt"]),
  frequency: z.string(),
  duration: z.string(),
  accessType: z.enum(["avFistula", "avGraft", "centralCatheter", "peritonealCatheter"]),
  status: z.enum(["active", "onHold", "completed", "discontinued"])
});

export const HealthcareClinicalHospitalDialysisDialysisOrderStatusSchema = z.enum(["active", "onHold", "completed", "discontinued"]);

export const HealthcareClinicalHospitalDialysisDialysisSessionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  order: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  sessionDate: z.string().datetime().transform((str) => new Date(str)),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  machineId: z.string().optional(),
  accessSite: z.string(),
  preWeight: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  postWeight: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  ufGoal: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  ufAchieved: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  preBP: z.string().optional(),
  postBP: z.string().optional(),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  performedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["scheduled", "inProgress", "completed", "interrupted"])
});

export const HealthcareClinicalHospitalDialysisDialysisTypeSchema = z.enum(["hemodialysis", "peritonealDialysis", "crrt"]);

export const HealthcareClinicalHospitalDialysisSessionStatusSchema = z.enum(["scheduled", "inProgress", "completed", "interrupted"]);

export const HealthcareClinicalHospitalEmergencyDepartmentAcuityLevelSchema = z.enum(["resuscitation", "emergent", "urgent", "lessUrgent", "nonUrgent"]);

export const HealthcareClinicalHospitalEmergencyDepartmentArrivalModeSchema = z.enum(["ambulance", "walkIn", "transferIn", "policeEscort", "other"]);

export const HealthcareClinicalHospitalEmergencyDepartmentEDDispositionSchema = z.enum(["admitted", "discharged", "transferred", "lwbs", "lama", "expired", "observation"]);

export const HealthcareClinicalHospitalEmergencyDepartmentEDVisitSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  arrivalMode: z.enum(["ambulance", "walkIn", "transferIn", "policeEscort", "other"]),
  arrivalTime: z.string().datetime().transform((str) => new Date(str)),
  triageTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  providerAssignedTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  dispositionTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  departureTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  acuityLevel: z.enum(["resuscitation", "emergent", "urgent", "lessUrgent", "nonUrgent"]),
  chiefComplaint: z.string().max(500),
  triageNurse: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  attendingProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  disposition: z.enum(["admitted", "discharged", "transferred", "lwbs", "lama", "expired", "observation"]).optional(),
  bed: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  status: z.enum(["registered", "triaged", "inTreatment", "pendingDisposition", "discharged", "admitted"])
});

export const HealthcareClinicalHospitalEmergencyDepartmentEDVisitStatusSchema = z.enum(["registered", "triaged", "inTreatment", "pendingDisposition", "discharged", "admitted"]);

export const HealthcareClinicalHospitalEmergencyDepartmentTriageAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  edVisit: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  acuityLevel: z.enum(["resuscitation", "emergent", "urgent", "lessUrgent", "nonUrgent"]),
  chiefComplaint: z.string().max(500),
  painScore: z.number().int().gte(0).lte(10).optional(),
  vitalSigns: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  allergiesReviewed: z.boolean(),
  medicationsReviewed: z.boolean(),
  isolationRequired: z.boolean().optional(),
  fallRisk: z.boolean().optional(),
  notes: z.string().max(2000).optional()
});

export const HealthcareClinicalHospitalICUCriticalCareFlowsheetSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  recordedAt: z.string().datetime().transform((str) => new Date(str)),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  hemodynamics: z.object({
  MAP: z.number().optional(),
  CVP: z.number().optional(),
  CO: z.number().optional(),
  SVR: z.number().optional()
}).optional(),
  ventilatoryParams: z.object({
  mode: z.enum(["AC", "SIMV", "CPAP", "BiPAP", "pressureSupport", "highFlow"]).optional(),
  peakPressure: z.number().optional(),
  plateauPressure: z.number().optional(),
  spO2: z.number().optional(),
  etCO2: z.number().optional()
}).optional(),
  intakeOutput: z.object({
  totalIntakeMl: z.number().optional(),
  urineOutputMl: z.number().optional(),
  otherOutputMl: z.number().optional(),
  netBalanceMl: z.number().optional()
}).optional(),
  sedationScore: z.object({
  RASS: z.number().int().optional(),
  GCS: z.number().int().optional()
}).optional(),
  neurovascularChecks: z.string().optional(),
  drainOutput: z.string().optional()
});

export const HealthcareClinicalHospitalICUHemodynamicParametersSchema = z.object({
  MAP: z.number().optional(),
  CVP: z.number().optional(),
  CO: z.number().optional(),
  SVR: z.number().optional()
});

export const HealthcareClinicalHospitalICUICUAdmissionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  admissionTime: z.string().datetime().transform((str) => new Date(str)),
  dischargeTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  ventilatorRequired: z.boolean(),
  isolationRequired: z.boolean(),
  acuityScore: z.number().int().optional(),
  primaryDiagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  attendingIntensivist: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  bed: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["admitted", "stabilized", "weaning", "readyForTransfer", "transferred", "expired"])
});

export const HealthcareClinicalHospitalICUICUAdmissionStatusSchema = z.enum(["admitted", "stabilized", "weaning", "readyForTransfer", "transferred", "expired"]);

export const HealthcareClinicalHospitalICUIntakeOutputRecordSchema = z.object({
  totalIntakeMl: z.number().optional(),
  urineOutputMl: z.number().optional(),
  otherOutputMl: z.number().optional(),
  netBalanceMl: z.number().optional()
});

export const HealthcareClinicalHospitalICUSedationScoreSchema = z.object({
  RASS: z.number().int().optional(),
  GCS: z.number().int().optional()
});

export const HealthcareClinicalHospitalICUSeverityScoreSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  tool: z.enum(["APACHE", "SOFA", "SAPS", "NEWS2", "qSOFA", "GCS"]),
  score: z.number(),
  calculatedAt: z.string().datetime().transform((str) => new Date(str)),
  components: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareClinicalHospitalICUSeverityScoringToolSchema = z.enum(["APACHE", "SOFA", "SAPS", "NEWS2", "qSOFA", "GCS"]);

export const HealthcareClinicalHospitalICUVentilatorModeSchema = z.enum(["AC", "SIMV", "CPAP", "BiPAP", "pressureSupport", "highFlow"]);

export const HealthcareClinicalHospitalICUVentilatorRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  mode: z.enum(["AC", "SIMV", "CPAP", "BiPAP", "pressureSupport", "highFlow"]),
  settings: z.object({
  FiO2: z.number(),
  PEEP: z.number(),
  tidalVolume: z.number().optional(),
  rate: z.number().int().optional(),
  pressureSupport: z.number().optional()
}),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  weaningProtocol: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalHospitalICUVentilatorSettingsSchema = z.object({
  FiO2: z.number(),
  PEEP: z.number(),
  tidalVolume: z.number().optional(),
  rate: z.number().int().optional(),
  pressureSupport: z.number().optional()
});

export const HealthcareClinicalHospitalICUVentilatoryParametersSchema = z.object({
  mode: z.enum(["AC", "SIMV", "CPAP", "BiPAP", "pressureSupport", "highFlow"]).optional(),
  peakPressure: z.number().optional(),
  plateauPressure: z.number().optional(),
  spO2: z.number().optional(),
  etCO2: z.number().optional()
});

export const HealthcareClinicalHospitalLaborDeliveryApgarScoresSchema = z.object({
  oneMinute: z.number().int().gte(0).lte(10),
  fiveMinute: z.number().int().gte(0).lte(10),
  tenMinute: z.number().int().gte(0).lte(10).optional()
});

export const HealthcareClinicalHospitalLaborDeliveryContractionPatternSchema = z.object({
  frequencyPer10Min: z.number().optional(),
  durationSeconds: z.number().int().optional(),
  intensity: z.string().optional()
});

export const HealthcareClinicalHospitalLaborDeliveryDeliveryMethodSchema = z.enum(["vaginal", "cesarean", "vacuumAssisted", "forcepsAssisted", "vbac"]);

export const HealthcareClinicalHospitalLaborDeliveryLaborRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  pregnancyRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  laborOnset: z.string().datetime().transform((str) => new Date(str)),
  deliveryTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  laborType: z.enum(["spontaneous", "induced", "augmented"]),
  deliveryMethod: z.enum(["vaginal", "cesarean", "vacuumAssisted", "forcepsAssisted", "vbac"]),
  cervicalDilation: z.number().gte(0).lte(10).optional(),
  effacement: z.number().gte(0).lte(100).optional(),
  station: z.number().int().gte(-5).lte(5).optional(),
  fetalHeartRate: z.number().int().optional(),
  contractionPattern: z.object({
  frequencyPer10Min: z.number().optional(),
  durationSeconds: z.number().int().optional(),
  intensity: z.string().optional()
}).optional(),
  epidural: z.boolean().optional(),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional()
});

export const HealthcareClinicalHospitalLaborDeliveryLaborTypeSchema = z.enum(["spontaneous", "induced", "augmented"]);

export const HealthcareClinicalHospitalLaborDeliveryNewbornRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  mother: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  deliveryEncounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  birthTime: z.string().datetime().transform((str) => new Date(str)),
  birthWeight: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  gestationalAge: z.number().int(),
  apgarScores: z.object({
  oneMinute: z.number().int().gte(0).lte(10),
  fiveMinute: z.number().int().gte(0).lte(10),
  tenMinute: z.number().int().gte(0).lte(10).optional()
}),
  gender: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  nicu: z.boolean(),
  breastfeedingInitiated: z.boolean().optional()
});

export const HealthcareClinicalHospitalLaborDeliveryPostpartumAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  fundusHeight: z.number().optional(),
  lochia: z.string().optional(),
  perinealAssessment: z.string().optional(),
  breastfeedingAssessment: z.string().optional(),
  emotionalScreening: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalLaborDeliveryPregnancyRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  edd: z.string().datetime().transform((str) => new Date(str)),
  lmp: z.string().datetime().transform((str) => new Date(str)).optional(),
  gravida: z.number().int(),
  para: z.number().int(),
  gestationalAge: z.number().int().optional(),
  prenatalVisits: z.array(HealthcareCoreReferenceSchema).optional(),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  status: z.enum(["antepartum", "inLabor", "delivered", "postpartum"])
});

export const HealthcareClinicalHospitalLaborDeliveryPregnancyStatusSchema = z.enum(["antepartum", "inLabor", "delivered", "postpartum"]);

export const HealthcareClinicalHospitalNursingAssessmentAssessmentStatusSchema = z.enum(["inProgress", "completed", "amended"]);

export const HealthcareClinicalHospitalNursingAssessmentFallRiskAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  tool: z.enum(["morse", "hendrich", "humptyDumpty", "stratify"]),
  score: z.number().int(),
  riskLevel: z.enum(["low", "moderate", "high"]),
  interventions: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.string().max(1000).optional()
});

export const HealthcareClinicalHospitalNursingAssessmentFallRiskToolSchema = z.enum(["morse", "hendrich", "humptyDumpty", "stratify"]);

export const HealthcareClinicalHospitalNursingAssessmentNursingAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessmentType: z.enum(["admission", "shift", "focused", "discharge", "transfer", "fall", "pain", "skin", "nutrition", "functional"]),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["inProgress", "completed", "amended"]),
  findings: z.record(z.string(), z.unknown()),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalHospitalNursingAssessmentNursingAssessmentTypeSchema = z.enum(["admission", "shift", "focused", "discharge", "transfer", "fall", "pain", "skin", "nutrition", "functional"]);

export const HealthcareClinicalHospitalNursingAssessmentPainAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  scale: z.enum(["numeric", "vas", "faces", "flacc", "cpot"]),
  score: z.number().int(),
  location: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  characteristics: z.string().max(500).optional(),
  interventionsProvided: z.string().max(500).optional(),
  reassessmentDue: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareClinicalHospitalNursingAssessmentPainScaleSchema = z.enum(["numeric", "vas", "faces", "flacc", "cpot"]);

export const HealthcareClinicalHospitalNursingAssessmentWoundRecordSchema = z.object({
  location: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  stage: z.number().int().optional(),
  length: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  width: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  depth: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  drainage: z.string().max(200).optional(),
  appearance: z.string().max(500).optional(),
  treatment: z.string().max(500).optional()
});

export const HealthcareClinicalHospitalNursingAssessmentPressureInjuryRiskSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  tool: z.enum(["braden", "norton", "waterlow"]),
  score: z.number().int(),
  riskLevel: z.enum(["low", "moderate", "high"]),
  skinAssessment: z.string().max(1000).optional(),
  interventions: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  existingInjuries: z.array(HealthcareClinicalHospitalNursingAssessmentWoundRecordSchema).optional()
});

export const HealthcareClinicalHospitalNursingAssessmentPressureInjuryToolSchema = z.enum(["braden", "norton", "waterlow"]);

export const HealthcareClinicalHospitalNursingAssessmentRiskLevelSchema = z.enum(["low", "moderate", "high"]);

export const HealthcareClinicalHospitalOncologyCancerDiagnosisSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  condition: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  cancerType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  stage: z.object({
  edition: z.string().optional(),
  T: z.string().optional(),
  N: z.string().optional(),
  M: z.string().optional(),
  groupStage: z.string().optional()
}),
  grade: z.string().optional(),
  histology: z.string().optional(),
  biomarkers: z.record(z.string(), z.unknown()).optional(),
  diagnosisDate: z.string().datetime().transform((str) => new Date(str)),
  diagnosedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareClinicalHospitalOncologyChemoDrugSchema = z.object({
  medication: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  dose: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  route: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  schedule: z.string(),
  premedications: z.array(HealthcareCoreCodeableConceptSchema).optional()
});

export const HealthcareClinicalHospitalOncologyChemoDrugAdministrationSchema = z.object({
  drug: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  dose: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  route: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  administeredBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reactionNoted: z.boolean().optional()
});

export const HealthcareClinicalHospitalOncologyChemotherapyCycleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  protocol: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  cycleNumber: z.number().int(),
  totalCycles: z.number().int(),
  startDate: z.string().datetime().transform((str) => new Date(str)),
  endDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["planned", "inProgress", "completed", "delayed", "cancelled", "toxicityHold"]),
  drugs: z.array(HealthcareClinicalHospitalOncologyChemoDrugAdministrationSchema),
  preChemoLabs: z.array(HealthcareCoreReferenceSchema).optional(),
  adverseEvents: z.array(HealthcareCoreCodeableConceptSchema).optional()
});

export const HealthcareClinicalHospitalOncologyChemotherapyProtocolSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  cancerType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  drugs: z.array(HealthcareClinicalHospitalOncologyChemoDrugSchema),
  cycleLength: z.number().int(),
  totalCycles: z.number().int(),
  description: z.string(),
  status: z.enum(["active", "retired", "draft"])
});

export const HealthcareClinicalHospitalOncologyCycleStatusSchema = z.enum(["planned", "inProgress", "completed", "delayed", "cancelled", "toxicityHold"]);

export const HealthcareClinicalHospitalOncologyProtocolStatusSchema = z.enum(["active", "retired", "draft"]);

export const HealthcareClinicalHospitalOncologyRadiationModalitySchema = z.enum(["externalBeam", "brachytherapy", "proton", "stereotactic"]);

export const HealthcareClinicalHospitalOncologyRadiationStatusSchema = z.enum(["planned", "inProgress", "completed"]);

export const HealthcareClinicalHospitalOncologyRadiationTherapySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  cancerType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  modality: z.enum(["externalBeam", "brachytherapy", "proton", "stereotactic"]),
  site: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  totalDose: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  fractions: z.number().int().optional(),
  status: z.enum(["planned", "inProgress", "completed"])
});

export const HealthcareClinicalHospitalOncologyTNMStageSchema = z.object({
  edition: z.string().optional(),
  T: z.string().optional(),
  N: z.string().optional(),
  M: z.string().optional(),
  groupStage: z.string().optional()
});

export const HealthcareClinicalHospitalOrderManagementClinicalOrderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  orderedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  orderType: z.enum(["medication", "laboratory", "imaging", "diet", "activity", "nursing", "respiratory", "consultation", "procedure", "supply"]),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  priority: z.enum(["routine", "urgent", "asap", "stat"]),
  status: z.enum(["draft", "pending", "active", "onHold", "completed", "cancelled", "discontinued", "enteredInError"]),
  authoredOn: z.string().datetime().transform((str) => new Date(str)),
  start: z.string().datetime().transform((str) => new Date(str)).optional(),
  end: z.string().datetime().transform((str) => new Date(str)).optional(),
  frequency: z.string().max(100).optional(),
  instructions: z.string().max(2000).optional(),
  reason: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  coSignRequired: z.boolean().optional(),
  coSignedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  coSignedAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareClinicalHospitalOrderManagementClinicalOrderStatusSchema = z.enum(["draft", "pending", "active", "onHold", "completed", "cancelled", "discontinued", "enteredInError"]);

export const HealthcareClinicalHospitalOrderManagementClinicalOrderTypeSchema = z.enum(["medication", "laboratory", "imaging", "diet", "activity", "nursing", "respiratory", "consultation", "procedure", "supply"]);

export const HealthcareClinicalHospitalOrderManagementOrderSetItemSchema = z.object({
  sequence: z.number().int(),
  orderType: z.enum(["medication", "laboratory", "imaging", "diet", "activity", "nursing", "respiratory", "consultation", "procedure", "supply"]),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  defaultPriority: z.enum(["routine", "urgent", "asap", "stat"]).optional(),
  defaultInstructions: z.string().max(1000).optional(),
  required: z.boolean(),
  groupName: z.string().max(100).optional()
});

export const HealthcareClinicalHospitalOrderManagementOrderSetSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(200),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  description: z.string().max(1000).optional(),
  purpose: z.string().max(500).optional(),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  applicableCondition: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  items: z.array(HealthcareClinicalHospitalOrderManagementOrderSetItemSchema)
});

export const HealthcareClinicalHospitalOrderManagementOrderVerificationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  order: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  verifiedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  verifiedAt: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["verified", "modified", "rejected", "held"]),
  reason: z.string().max(500).optional(),
  modifications: z.string().max(1000).optional()
});

export const HealthcareClinicalHospitalOrderManagementVerificationDecisionSchema = z.enum(["verified", "modified", "rejected", "held"]);

export const HealthcareClinicalHospitalSpecialtyCardiologyCathFindingSchema = z.object({
  vessel: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  stenosisPercent: z.number().int().gte(0).lte(100).optional(),
  description: z.string(),
  significance: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyCardiologyStentRecordSchema = z.object({
  vessel: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  stentType: z.string(),
  diameter: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  length: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  manufacturer: z.string(),
  lotNumber: z.string().optional(),
  deploymentPressure: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareClinicalHospitalSpecialtyCardiologyCardiacCathRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  procedure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  cathType: z.enum(["diagnostic", "interventional", "electrophysiology"]),
  accessSite: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  operator: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assistants: z.array(HealthcareCoreReferenceSchema).optional(),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  contrastUsed: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  fluoroscopyTime: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  findings: z.array(HealthcareClinicalHospitalSpecialtyCardiologyCathFindingSchema),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  hemodynamics: z.object({
  lvedp: z.number().int().optional(),
  cardiacOutput: z.number().optional(),
  ejectionFraction: z.number().gte(0).lte(100).optional(),
  pulmonaryWedgePressure: z.number().int().optional(),
  rightAtrialPressure: z.number().int().optional()
}).optional(),
  stentsPlaced: z.array(HealthcareClinicalHospitalSpecialtyCardiologyStentRecordSchema).optional(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyCardiologyCardiacRehabSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  referral: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  phase: z.enum(["phaseI", "phaseII", "phaseIII", "phaseIV"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  sessions: z.number().int(),
  completedSessions: z.number().int(),
  baselineFunctionalCapacity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  currentFunctionalCapacity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  riskStratification: z.enum(["low", "moderate", "high"]),
  status: z.enum(["enrolled", "active", "completed", "withdrawn"])
});

export const HealthcareClinicalHospitalSpecialtyCardiologyCardiacRehabPhaseSchema = z.enum(["phaseI", "phaseII", "phaseIII", "phaseIV"]);

export const HealthcareClinicalHospitalSpecialtyCardiologyCardiacRehabRiskSchema = z.enum(["low", "moderate", "high"]);

export const HealthcareClinicalHospitalSpecialtyCardiologyCardiacRehabStatusSchema = z.enum(["enrolled", "active", "completed", "withdrawn"]);

export const HealthcareClinicalHospitalSpecialtyCardiologyCathTypeSchema = z.enum(["diagnostic", "interventional", "electrophysiology"]);

export const HealthcareClinicalHospitalSpecialtyCardiologyEPIntervalsSchema = z.object({
  prInterval: z.number().int().optional(),
  qrsWidth: z.number().int().optional(),
  qtInterval: z.number().int().optional(),
  ahInterval: z.number().int().optional(),
  hvInterval: z.number().int().optional(),
  snrt: z.number().int().optional(),
  csnrt: z.number().int().optional()
});

export const HealthcareClinicalHospitalSpecialtyCardiologyEPStudyRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  procedure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  operator: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  accessSites: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  baselineIntervals: z.object({
  prInterval: z.number().int().optional(),
  qrsWidth: z.number().int().optional(),
  qtInterval: z.number().int().optional(),
  ahInterval: z.number().int().optional(),
  hvInterval: z.number().int().optional(),
  snrt: z.number().int().optional(),
  csnrt: z.number().int().optional()
}).optional(),
  inducedArrhythmias: z.array(z.string()).optional(),
  ablationPerformed: z.boolean().optional(),
  ablationTarget: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  ablationEnergy: z.enum(["RF", "cryo"]).optional(),
  ablationSuccessful: z.boolean().optional(),
  deviceImplanted: z.boolean().optional(),
  deviceType: z.string().optional(),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyCardiologyEchoTypeSchema = z.enum(["transthoracic", "transesophageal", "stress", "contrast"]);

export const HealthcareClinicalHospitalSpecialtyCardiologyValvularFindingSchema = z.object({
  valve: z.string(),
  stenosis: z.string().optional(),
  regurgitation: z.enum(["none", "trace", "mild", "moderate", "severe"]).optional(),
  gradient: z.number().optional(),
  area: z.number().optional(),
  notes: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyCardiologyEchocardiogramReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  type: z.enum(["transthoracic", "transesophageal", "stress", "contrast"]),
  ejectionFraction: z.number().gte(0).lte(100).optional(),
  lvDiastolicDimension: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  lvSystolicDimension: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  wallMotionAbnormalities: z.array(z.string()).optional(),
  valvularFindings: z.array(HealthcareClinicalHospitalSpecialtyCardiologyValvularFindingSchema),
  pericardialEffusion: z.string().optional(),
  rightHeartFindings: z.string().optional(),
  conclusion: z.string(),
  imagingStudy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalHospitalSpecialtyCardiologyHemodynamicDataSchema = z.object({
  lvedp: z.number().int().optional(),
  cardiacOutput: z.number().optional(),
  ejectionFraction: z.number().gte(0).lte(100).optional(),
  pulmonaryWedgePressure: z.number().int().optional(),
  rightAtrialPressure: z.number().int().optional()
});

export const HealthcareClinicalHospitalSpecialtyNeonatalApgarScoreSchema = z.object({
  oneMinute: z.number().int(),
  fiveMinute: z.number().int(),
  tenMinute: z.number().int().optional()
});

export const HealthcareClinicalHospitalSpecialtyNeonatalFeedingRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  recordedAt: z.string().datetime().transform((str) => new Date(str)),
  type: z.enum(["breastMilk", "formula", "totalParenteralNutrition", "combinedBreastFormula"]),
  volume: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  duration: z.number().int().optional(),
  tolerance: z.string().optional(),
  residual: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  route: z.enum(["oral", "orogastric", "nasogastric", "gastrostomy", "intravenous"])
});

export const HealthcareClinicalHospitalSpecialtyNeonatalFeedingRouteSchema = z.enum(["oral", "orogastric", "nasogastric", "gastrostomy", "intravenous"]);

export const HealthcareClinicalHospitalSpecialtyNeonatalFeedingTypeSchema = z.enum(["breastMilk", "formula", "totalParenteralNutrition", "combinedBreastFormula"]);

export const HealthcareClinicalHospitalSpecialtyNeonatalNICUAdmissionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  motherPatient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  admissionTime: z.string().datetime().transform((str) => new Date(str)),
  gestationalAge: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  birthWeight: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  apgarScores: z.object({
  oneMinute: z.number().int(),
  fiveMinute: z.number().int(),
  tenMinute: z.number().int().optional()
}),
  admissionReason: z.array(HealthcareCoreCodeableConceptSchema),
  levelOfCare: z.enum(["levelI", "levelII", "levelIII", "levelIV"]),
  status: z.enum(["admitted", "stable", "critical", "improving", "readyForTransfer", "discharged"])
});

export const HealthcareClinicalHospitalSpecialtyNeonatalNICUAdmissionStatusSchema = z.enum(["admitted", "stable", "critical", "improving", "readyForTransfer", "discharged"]);

export const HealthcareClinicalHospitalSpecialtyNeonatalNICULevelOfCareSchema = z.enum(["levelI", "levelII", "levelIII", "levelIV"]);

export const HealthcareClinicalHospitalSpecialtyNeonatalNeonatalBPSchema = z.object({
  systolic: z.number().int(),
  diastolic: z.number().int(),
  mean: z.number().int().optional(),
  cuffSize: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyNeonatalNeonatalVitalsSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  recordedAt: z.string().datetime().transform((str) => new Date(str)),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  temperature: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  heartRate: z.number().int().optional(),
  respiratoryRate: z.number().int().optional(),
  oxygenSaturation: z.number().int().optional(),
  bloodPressure: z.object({
  systolic: z.number().int(),
  diastolic: z.number().int(),
  mean: z.number().int().optional(),
  cuffSize: z.string().optional()
}).optional(),
  weight: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  headCircumference: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  fiO2: z.number().optional(),
  incubatorTemp: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareClinicalHospitalSpecialtyNeonatalNewbornScreeningResultSchema = z.object({
  test: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  result: z.string(),
  normalRange: z.string().optional(),
  abnormal: z.boolean(),
  referralNeeded: z.boolean()
});

export const HealthcareClinicalHospitalSpecialtyNeonatalNewbornScreeningSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  screeningDate: z.string().datetime().transform((str) => new Date(str)),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  sampleCollectedAt: z.string().datetime().transform((str) => new Date(str)),
  sampleType: z.enum(["heelStick", "venipuncture"]),
  testsOrdered: z.array(HealthcareCoreCodeableConceptSchema),
  results: z.array(HealthcareClinicalHospitalSpecialtyNeonatalNewbornScreeningResultSchema).optional(),
  status: z.enum(["collected", "sentToLab", "resultsReceived", "normal", "abnormalReferral"])
});

export const HealthcareClinicalHospitalSpecialtyNeonatalNewbornScreeningSampleTypeSchema = z.enum(["heelStick", "venipuncture"]);

export const HealthcareClinicalHospitalSpecialtyNeonatalNewbornScreeningStatusSchema = z.enum(["collected", "sentToLab", "resultsReceived", "normal", "abnormalReferral"]);

export const HealthcareClinicalHospitalSpecialtyPalliativeHospiceCodeStatusSchema = z.enum(["fullCode", "dnrDni", "dniOnly", "comfortCareOnly", "other"]);

export const HealthcareClinicalHospitalSpecialtyPalliativeHospiceTreatmentPreferenceSchema = z.object({
  treatment: z.string(),
  preference: z.enum(["wantTreatment", "doNotWant", "unsure", "deferToSurrogate"]),
  conditions: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyPalliativeHospiceGoalsOfCareDiscussionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  facilitator: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  participants: z.array(HealthcareCoreReferenceSchema),
  discussionDate: z.string().datetime().transform((str) => new Date(str)),
  prognosis: z.string().optional(),
  patientValues: z.array(z.string()).optional(),
  treatmentPreferences: z.array(HealthcareClinicalHospitalSpecialtyPalliativeHospiceTreatmentPreferenceSchema),
  codeStatus: z.enum(["fullCode", "dnrDni", "dniOnly", "comfortCareOnly", "other"]),
  advanceDirectiveReviewed: z.boolean().optional(),
  advanceDirectiveReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  surrogatDecisionMaker: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyPalliativeHospiceHospiceEligibilitySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  certifyingPhysician: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  certificationDate: z.string().datetime().transform((str) => new Date(str)),
  terminalDiagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  prognosis: z.string(),
  benefitPeriod: z.number().int(),
  recertificationDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["certified", "recertified", "revoked", "discharged", "expired"])
});

export const HealthcareClinicalHospitalSpecialtyPalliativeHospiceHospiceIDTMeetingSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  meetingDate: z.string().datetime().transform((str) => new Date(str)),
  attendees: z.array(HealthcareCoreReferenceSchema),
  carePlanReviewed: z.boolean(),
  symptomManagementDiscussed: z.boolean(),
  psychosocialAssessment: z.string().optional(),
  spiritualCareNeeds: z.string().optional(),
  familySupportNeeds: z.string().optional(),
  planUpdates: z.array(z.string()).optional(),
  nextMeetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareClinicalHospitalSpecialtyPalliativeHospicePreferenceDecisionSchema = z.enum(["wantTreatment", "doNotWant", "unsure", "deferToSurrogate"]);

export const HealthcareClinicalHospitalSpecialtyPalliativeHospiceSymptomEntrySchema = z.object({
  symptom: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  severity: z.number().int().gte(0).lte(10),
  frequency: z.string().optional(),
  intervention: z.string().optional(),
  responseToIntervention: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyPalliativeHospiceSymptomAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  assessedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessedAt: z.string().datetime().transform((str) => new Date(str)),
  symptoms: z.array(HealthcareClinicalHospitalSpecialtyPalliativeHospiceSymptomEntrySchema),
  overallDistressScore: z.number().int().gte(0).lte(10).optional(),
  palliativePerformanceScale: z.number().int().gte(0).lte(100).optional(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareADLAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessedAt: z.string().datetime().transform((str) => new Date(str)),
  bathing: z.enum(["independent", "setupOnly", "supervision", "limitedAssistance", "extensiveAssistance", "maximalAssistance", "totalDependence"]),
  dressing: z.enum(["independent", "setupOnly", "supervision", "limitedAssistance", "extensiveAssistance", "maximalAssistance", "totalDependence"]),
  eating: z.enum(["independent", "setupOnly", "supervision", "limitedAssistance", "extensiveAssistance", "maximalAssistance", "totalDependence"]),
  toileting: z.enum(["independent", "setupOnly", "supervision", "limitedAssistance", "extensiveAssistance", "maximalAssistance", "totalDependence"]),
  transferring: z.enum(["independent", "setupOnly", "supervision", "limitedAssistance", "extensiveAssistance", "maximalAssistance", "totalDependence"]),
  continence: z.enum(["independent", "setupOnly", "supervision", "limitedAssistance", "extensiveAssistance", "maximalAssistance", "totalDependence"]),
  totalScore: z.number().int(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareADLLevelSchema = z.enum(["independent", "setupOnly", "supervision", "limitedAssistance", "extensiveAssistance", "maximalAssistance", "totalDependence"]);

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareCareLevelSchema = z.enum(["skilledNursing", "subAcute", "longTermCare", "assistedLiving", "homeHealth", "hospice", "inpatientRehab"]);

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareHomeHealthCertificationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  certifyingPhysician: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startOfCare: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  certificationPeriod: z.number().int(),
  recertificationNumber: z.number().int().optional(),
  homebound: z.boolean(),
  primaryDiagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  disciplines: z.array(z.string()),
  frequency: z.string(),
  status: z.enum(["certified", "recertified", "discharged", "transferred"])
});

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareHomeHealthCertificationStatusSchema = z.enum(["certified", "recertified", "discharged", "transferred"]);

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareMDSAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessmentType: z.enum(["admission", "quarterly", "annual", "significantChange", "significantCorrection", "discharge"]),
  assessmentReferenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  completedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  completedDate: z.string().datetime().transform((str) => new Date(str)),
  section: z.record(z.string(), z.unknown()).optional(),
  casesMixGroup: z.string().optional(),
  rugVersion: z.string().optional(),
  status: z.enum(["inProgress", "completed", "submitted", "corrected"])
});

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareMDSAssessmentStatusSchema = z.enum(["inProgress", "completed", "submitted", "corrected"]);

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareMDSAssessmentTypeSchema = z.enum(["admission", "quarterly", "annual", "significantChange", "significantCorrection", "discharge"]);

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareOASISAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessmentType: z.enum(["startOfCare", "recertification", "resumption", "followUp", "transferToInpatient", "discharge", "deathAtHome"]),
  assessmentDate: z.string().datetime().transform((str) => new Date(str)),
  completedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  oasisVersion: z.string().optional(),
  clinicalData: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["inProgress", "completed", "transmitted"])
});

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareOASISAssessmentStatusSchema = z.enum(["inProgress", "completed", "transmitted"]);

export const HealthcareClinicalHospitalSpecialtyPostAcuteCareOASISAssessmentTypeSchema = z.enum(["startOfCare", "recertification", "resumption", "followUp", "transferToInpatient", "discharge", "deathAtHome"]);

export const HealthcareClinicalHospitalSpecialtyPostAcuteCarePostAcuteAdmissionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  dischargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  careLevel: z.enum(["skilledNursing", "subAcute", "longTermCare", "assistedLiving", "homeHealth", "hospice", "inpatientRehab"]),
  admittingDiagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  functionalStatus: z.string().optional(),
  status: z.enum(["active", "discharged", "transferred", "expired"])
});

export const HealthcareClinicalHospitalSpecialtyPostAcuteCarePostAcuteAdmissionStatusSchema = z.enum(["active", "discharged", "transferred", "expired"]);

export const HealthcareClinicalHospitalSpecialtyRehabTherapyAssistanceLevelSchema = z.enum(["independent", "supervised", "minAssist", "modAssist", "maxAssist", "dependent"]);

export const HealthcareClinicalHospitalSpecialtyRehabTherapyFunctionalOutcomeMeasureSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  discipline: z.enum(["physicalTherapy", "occupationalTherapy", "speechLanguagePathology"]),
  tool: z.enum(["fim", "barthel", "berg", "tinettiBalance", "tinettiGait", "sixMinuteWalk", "tugTest", "dashScore", "gripStrength", "rangeOfMotion", "amputeeMobility", "other"]),
  score: z.number(),
  maxScore: z.number().optional(),
  assessedAt: z.string().datetime().transform((str) => new Date(str)),
  assessedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  interpretation: z.string().optional(),
  comparedToBaseline: z.number().optional()
});

export const HealthcareClinicalHospitalSpecialtyRehabTherapyFunctionalToolSchema = z.enum(["fim", "barthel", "berg", "tinettiBalance", "tinettiGait", "sixMinuteWalk", "tugTest", "dashScore", "gripStrength", "rangeOfMotion", "amputeeMobility", "other"]);

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabDisciplineSchema = z.enum(["physicalTherapy", "occupationalTherapy", "speechLanguagePathology"]);

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabGoalSchema = z.object({
  description: z.string(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  measurableOutcome: z.string(),
  status: z.enum(["notStarted", "inProgress", "met", "partiallyMet", "notMet", "discontinued"])
});

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabEvaluationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  therapist: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  discipline: z.enum(["physicalTherapy", "occupationalTherapy", "speechLanguagePathology"]),
  evaluationDate: z.string().datetime().transform((str) => new Date(str)),
  diagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  functionalLimitations: z.array(z.string()),
  priorLevel: z.string(),
  currentLevel: z.string(),
  goals: z.array(HealthcareClinicalHospitalSpecialtyRehabTherapyRehabGoalSchema),
  treatmentPlan: z.string(),
  frequencyRecommended: z.string(),
  durationRecommended: z.string(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabGoalStatusSchema = z.enum(["notStarted", "inProgress", "met", "partiallyMet", "notMet", "discontinued"]);

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabInterventionSchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  description: z.string(),
  sets: z.number().int().optional(),
  reps: z.number().int().optional(),
  duration: z.number().int().optional(),
  assistanceLevel: z.enum(["independent", "supervised", "minAssist", "modAssist", "maxAssist", "dependent"]).optional()
});

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabReferralSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  referringProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  discipline: z.enum(["physicalTherapy", "occupationalTherapy", "speechLanguagePathology"]),
  diagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  reason: z.string(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  precautions: z.array(z.string()).optional(),
  status: z.enum(["pending", "accepted", "inProgress", "completed", "discharged", "cancelled"])
});

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabReferralStatusSchema = z.enum(["pending", "accepted", "inProgress", "completed", "discharged", "cancelled"]);

export const HealthcareClinicalHospitalSpecialtyRehabTherapyRehabSessionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  therapist: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  discipline: z.enum(["physicalTherapy", "occupationalTherapy", "speechLanguagePathology"]),
  sessionDate: z.string().datetime().transform((str) => new Date(str)),
  duration: z.number().int(),
  interventions: z.array(HealthcareClinicalHospitalSpecialtyRehabTherapyRehabInterventionSchema),
  patientResponse: z.string().optional(),
  progressTowardGoals: z.string().optional(),
  homeExerciseProvided: z.boolean().optional(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyABGCollectionSiteSchema = z.enum(["radialArtery", "femoralArtery", "brachialArtery", "arterialLine"]);

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyABGResultSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  collectedAt: z.string().datetime().transform((str) => new Date(str)),
  collectedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  site: z.enum(["radialArtery", "femoralArtery", "brachialArtery", "arterialLine"]),
  pH: z.number(),
  pCO2: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  pO2: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  hco3: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  baseExcess: z.number().optional(),
  sO2: z.number().optional(),
  lactate: z.number().optional(),
  fiO2AtCollection: z.number().optional(),
  interpretation: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyPulmonaryFunctionTestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  fvc: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  fev1: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  fev1FvcRatio: z.number().optional(),
  peakFlow: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  dlco: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  tlc: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  interpretation: z.string().optional(),
  referenceValues: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyRespiratoryAssessmentSchema = z.object({
  spO2: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  lungSounds: z.string().optional(),
  workOfBreathing: z.string().optional()
});

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyRespiratoryOrderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  orderedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  therapyType: z.enum(["oxygenTherapy", "nebulizer", "chestPhysiotherapy", "incentiveSpirometry", "bipap", "cpap", "ventilatorManagement", "bronchoscopyAssist", "pulmonaryFunctionTest", "arterialBloodGas"]),
  instructions: z.string().optional(),
  frequency: z.string(),
  status: z.enum(["active", "completed", "discontinued"]),
  startDate: z.string().datetime().transform((str) => new Date(str)),
  endDate: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyRespiratoryOrderStatusSchema = z.enum(["active", "completed", "discontinued"]);

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyRespiratoryTherapyTypeSchema = z.enum(["oxygenTherapy", "nebulizer", "chestPhysiotherapy", "incentiveSpirometry", "bipap", "cpap", "ventilatorManagement", "bronchoscopyAssist", "pulmonaryFunctionTest", "arterialBloodGas"]);

export const HealthcareClinicalHospitalSpecialtyRespiratoryTherapyRespiratoryTreatmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  order: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  therapyType: z.enum(["oxygenTherapy", "nebulizer", "chestPhysiotherapy", "incentiveSpirometry", "bipap", "cpap", "ventilatorManagement", "bronchoscopyAssist", "pulmonaryFunctionTest", "arterialBloodGas"]),
  preTreatmentAssessment: z.object({
  spO2: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  lungSounds: z.string().optional(),
  workOfBreathing: z.string().optional()
}).optional(),
  postTreatmentAssessment: z.object({
  spO2: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  lungSounds: z.string().optional(),
  workOfBreathing: z.string().optional()
}).optional(),
  medicationAdministered: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  duration: z.number().int().optional(),
  oxygenFlow: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  fiO2: z.number().optional(),
  patientResponse: z.string().optional(),
  adverseReaction: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareClinicalHospitalWoundCareClinicalOrderStatusSchema = z.enum(["draft", "active", "completed", "discontinued"]);

export const HealthcareClinicalHospitalWoundCareExudateDescriptionSchema = z.enum(["none", "scant", "small", "moderate", "large"]);

export const HealthcareClinicalHospitalWoundCareWoundAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessedAt: z.string().datetime().transform((str) => new Date(str)),
  location: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  type: z.enum(["pressure", "surgical", "traumatic", "venous", "arterial", "diabetic", "burn", "other"]),
  stage: z.enum(["stageI", "stageII", "stageIII", "stageIV", "unstageable", "deepTissue"]).optional(),
  length: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  width: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  depth: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  tunneling: z.string().max(500).optional(),
  undermining: z.string().max(500).optional(),
  woundBed: z.enum(["granulation", "slough", "eschar", "epithelialization", "mixed"]).optional(),
  exudate: z.enum(["none", "scant", "small", "moderate", "large"]).optional(),
  exudateType: z.string().max(50).optional(),
  periWoundSkin: z.string().max(500).optional(),
  odor: z.boolean().optional(),
  painLevel: z.number().int().gte(0).lte(10).optional(),
  photographRef: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalHospitalWoundCareWoundBedDescriptionSchema = z.enum(["granulation", "slough", "eschar", "epithelialization", "mixed"]);

export const HealthcareClinicalHospitalWoundCareWoundCareOrderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  orderedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  woundLocation: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  dressingType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  frequency: z.string().max(100),
  cleansingInstructions: z.string().max(500).optional(),
  specialInstructions: z.string().max(1000).optional(),
  status: z.enum(["draft", "active", "completed", "discontinued"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareClinicalHospitalWoundCareWoundStageSchema = z.enum(["stageI", "stageII", "stageIII", "stageIV", "unstageable", "deepTissue"]);

export const HealthcareClinicalHospitalWoundCareWoundTreatmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  woundAssessment: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performedAt: z.string().datetime().transform((str) => new Date(str)),
  cleansingMethod: z.string().max(200).optional(),
  debrided: z.boolean().optional(),
  debridementType: z.string().max(50).optional(),
  dressing: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  dressingChangeFrequency: z.string().max(100).optional(),
  topicalAgents: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  offloadingDevice: z.string().max(200).optional(),
  note: z.string().max(1000).optional()
});

export const HealthcareClinicalHospitalWoundCareWoundTypeSchema = z.enum(["pressure", "surgical", "traumatic", "venous", "arterial", "diabetic", "burn", "other"]);

export const HealthcareClinicalImmunizationsImmunizationPerformerSchema = z.object({
  function: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  actor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareClinicalImmunizationsImmunizationProtocolSchema = z.object({
  series: z.string().optional(),
  authority: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  targetDisease: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  doseNumber: z.number().int(),
  seriesDoses: z.number().int().optional()
});

export const HealthcareClinicalImmunizationsImmunizationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["completed", "enteredInError", "notDone"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  vaccineCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  occurrenceDateTime: z.string().datetime().transform((str) => new Date(str)),
  recorded: z.string().datetime().transform((str) => new Date(str)).optional(),
  primarySource: z.boolean(),
  reportOrigin: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  manufacturer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  site: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  route: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  doseQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  performer: z.array(HealthcareClinicalImmunizationsImmunizationPerformerSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  isSubpotent: z.boolean().optional(),
  protocolApplied: z.array(HealthcareClinicalImmunizationsImmunizationProtocolSchema).optional()
});

export const HealthcareClinicalImmunizationsImmunizationStatusSchema = z.enum(["completed", "enteredInError", "notDone"]);

export const HealthcareClinicalMedicationRequestsMedicationDispenseRequestSchema = z.object({
  validityPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  numberOfRepeatsAllowed: z.number().int().optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  expectedSupplyDuration: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalMedicationRequestsMedicationRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "onHold", "cancelled", "completed", "enteredInError", "stopped", "draft", "unknown"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  intent: z.enum(["proposal", "plan", "order", "originalOrder", "reflexOrder", "fillerOrder", "instanceOrder", "option"]),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  priority: z.enum(["routine", "urgent", "asap", "stat"]).optional(),
  doNotPerform: z.boolean().optional(),
  medicationCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  medicationReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  authoredOn: z.string().datetime().transform((str) => new Date(str)),
  requester: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  recorder: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  insurance: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  dosageInstruction: z.array(HealthcareCoreDosageSchema),
  dispenseRequest: z.object({
  validityPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  numberOfRepeatsAllowed: z.number().int().optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  expectedSupplyDuration: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
}).optional(),
  substitution: z.object({
  allowed: z.boolean(),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
}).optional(),
  priorPrescription: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  pharmacyReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalMedicationRequestsMedicationRequestIntentSchema = z.enum(["proposal", "plan", "order", "originalOrder", "reflexOrder", "fillerOrder", "instanceOrder", "option"]);

export const HealthcareClinicalMedicationRequestsMedicationRequestStatusSchema = z.enum(["active", "onHold", "cancelled", "completed", "enteredInError", "stopped", "draft", "unknown"]);

export const HealthcareClinicalMedicationRequestsMedicationSubstitutionSchema = z.object({
  allowed: z.boolean(),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareClinicalMedicationRequestsRequestPrioritySchema = z.enum(["routine", "urgent", "asap", "stat"]);

export const HealthcareClinicalObservationsObservationReferenceRangeSchema = z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  appliesTo: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  age: z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  text: z.string().optional()
});

export const HealthcareClinicalObservationsObservationComponentSchema = z.object({
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  valueCodeableConcept: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().int().optional(),
  interpretation: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  referenceRange: z.array(HealthcareClinicalObservationsObservationReferenceRangeSchema).optional()
});

export const HealthcareClinicalObservationsObservationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  basedOn: z.array(HealthcareCoreReferenceSchema).optional(),
  partOf: z.array(HealthcareCoreReferenceSchema).optional(),
  status: z.enum(["registered", "preliminary", "final", "amended", "corrected", "cancelled", "enteredInError", "unknown"]),
  category: z.array(HealthcareCoreCodeableConceptSchema),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  focus: z.array(HealthcareCoreReferenceSchema).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  effectiveDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  effectivePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  issued: z.string().datetime().transform((str) => new Date(str)).optional(),
  performer: z.array(HealthcareCoreReferenceSchema),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  valueCodeableConcept: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().int().optional(),
  valueRange: z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  dataAbsentReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  interpretation: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  bodySite: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  method: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  specimen: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  device: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  referenceRange: z.array(HealthcareClinicalObservationsObservationReferenceRangeSchema).optional(),
  hasMember: z.array(HealthcareCoreReferenceSchema).optional(),
  component: z.array(HealthcareClinicalObservationsObservationComponentSchema).optional()
});

export const HealthcareClinicalObservationsObservationStatusSchema = z.enum(["registered", "preliminary", "final", "amended", "corrected", "cancelled", "enteredInError", "unknown"]);

export const HealthcareClinicalProceduresProcedurePerformerSchema = z.object({
  function: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  actor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  onBehalfOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareClinicalProceduresProcedureSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["preparation", "inProgress", "notDone", "onHold", "stopped", "completed", "enteredInError", "unknown"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  category: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performedDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  performedPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  recorder: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  asserter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.array(HealthcareClinicalProceduresProcedurePerformerSchema).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  bodySite: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  outcome: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  report: z.array(HealthcareCoreReferenceSchema).optional(),
  complication: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  followUp: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  usedCode: z.array(HealthcareCoreCodeableConceptSchema).optional()
});

export const HealthcareClinicalProceduresProcedureStatusSchema = z.enum(["preparation", "inProgress", "notDone", "onHold", "stopped", "completed", "enteredInError", "unknown"]);

export const HealthcareClinicalRelatedPersonsRelatedPersonCommunicationSchema = z.object({
  language: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  preferred: z.boolean().optional()
});

export const HealthcareClinicalRelatedPersonsRelatedPersonSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  active: z.boolean(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  relationship: z.array(HealthcareCoreCodeableConceptSchema),
  name: z.array(HealthcareCoreHumanNameSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  address: z.array(AddressSchema).optional(),
  photo: z.array(HealthcareCoreAttachmentSchema).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  communication: z.array(HealthcareClinicalRelatedPersonsRelatedPersonCommunicationSchema).optional()
});

export const HealthcareClinicalServiceRequestsServiceRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["draft", "active", "onHold", "revoked", "completed", "enteredInError", "unknown"]),
  intent: z.enum(["proposal", "plan", "directive", "order", "originalOrder", "reflexOrder", "fillerOrder", "instanceOrder", "option"]),
  category: z.array(HealthcareCoreCodeableConceptSchema),
  priority: z.enum(["routine", "urgent", "asap", "stat"]).optional(),
  doNotPerform: z.boolean().optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  orderDetail: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  quantityQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  occurrenceDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  occurrencePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  asNeeded: z.boolean().optional(),
  authoredOn: z.string().datetime().transform((str) => new Date(str)),
  requester: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performerType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  performer: z.array(HealthcareCoreReferenceSchema).optional(),
  locationCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  locationReference: z.array(HealthcareCoreReferenceSchema).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  insurance: z.array(HealthcareCoreReferenceSchema).optional(),
  supportingInfo: z.array(HealthcareCoreReferenceSchema).optional(),
  specimen: z.array(HealthcareCoreReferenceSchema).optional(),
  bodySite: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  patientInstruction: z.string().optional()
});

export const HealthcareClinicalServiceRequestsServiceRequestIntentSchema = z.enum(["proposal", "plan", "directive", "order", "originalOrder", "reflexOrder", "fillerOrder", "instanceOrder", "option"]);

export const HealthcareClinicalServiceRequestsServiceRequestStatusSchema = z.enum(["draft", "active", "onHold", "revoked", "completed", "enteredInError", "unknown"]);

export const HealthcareClinicalSurgicalAnesthesiaRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  surgicalCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  anesthesiologist: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["general", "regional", "local", "sedation", "combined"]),
  asaClassification: z.number().int().gte(1).lte(6).optional(),
  agents: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  airwayManagement: z.string().optional(),
  monitoringNotes: z.string().optional(),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalSurgicalAnesthesiaTypeSchema = z.enum(["general", "regional", "local", "sedation", "combined"]);

export const HealthcareClinicalSurgicalLateralityTypeSchema = z.enum(["left", "right", "bilateral", "notApplicable"]);

export const HealthcareClinicalSurgicalOperatingRoomSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["general", "cardiac", "neuro", "ortho", "ophthalmology", "obstetric", "ent", "urology"]),
  status: z.enum(["available", "inUse", "cleaning", "maintenance", "closed"]),
  equipment: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  features: z.array(z.string()).optional()
});

export const HealthcareClinicalSurgicalOperatingRoomStatusSchema = z.enum(["available", "inUse", "cleaning", "maintenance", "closed"]);

export const HealthcareClinicalSurgicalOperatingRoomTypeSchema = z.enum(["general", "cardiac", "neuro", "ortho", "ophthalmology", "obstetric", "ent", "urology"]);

export const HealthcareClinicalSurgicalSurgicalCaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  procedure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  surgeon: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assistants: z.array(HealthcareCoreReferenceSchema).optional(),
  anesthesiologist: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  nurses: z.array(HealthcareCoreReferenceSchema).optional(),
  scheduledDateTime: z.string().datetime().transform((str) => new Date(str)),
  estimatedDurationMinutes: z.number().int().optional(),
  actualStartTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  actualEndTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["scheduled", "inPrep", "inProgress", "inRecovery", "completed", "cancelled", "postponed"]),
  operatingRoom: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  laterality: z.enum(["left", "right", "bilateral", "notApplicable"]).optional(),
  implants: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  preferenceCard: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  preOpDiagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  postOpDiagnosis: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  specimenCollected: z.boolean().optional(),
  bloodLossEstimate: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareClinicalSurgicalSurgicalCaseStatusSchema = z.enum(["scheduled", "inPrep", "inProgress", "inRecovery", "completed", "cancelled", "postponed"]);

export const HealthcareClinicalSurgicalSurgicalPreferenceCardSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  surgeon: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  procedure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  instruments: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  supplies: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  equipment: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  positioning: z.string().optional(),
  skinPrep: z.string().optional(),
  draping: z.string().optional(),
  specialInstructions: z.string().optional()
});

export const HealthcareComplianceComplianceProgramBAARecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  businessAssociate: z.string(),
  baaType: z.enum(["businessAssociateAgreement", "dataProcessingAgreement", "dataUseAgreement", "subcontractorAgreement"]),
  executedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["active", "expired", "terminated", "underReview"]),
  documentReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareComplianceComplianceProgramBAAStatusSchema = z.enum(["active", "expired", "terminated", "underReview"]);

export const HealthcareComplianceComplianceProgramBAATypeSchema = z.enum(["businessAssociateAgreement", "dataProcessingAgreement", "dataUseAgreement", "subcontractorAgreement"]);

export const HealthcareComplianceComplianceProgramCAPAActionSchema = z.object({
  description: z.string(),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["pending", "inProgress", "completed", "verified"])
});

export const HealthcareComplianceComplianceProgramCAPAActionStatusSchema = z.enum(["pending", "inProgress", "completed", "verified"]);

export const HealthcareComplianceComplianceProgramCAPARecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  title: z.string(),
  type: z.enum(["corrective", "preventive"]),
  sourceType: z.enum(["incident", "audit", "complaint", "regulatoryFinding", "internalReview"]),
  source: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  description: z.string(),
  rootCause: z.string().optional(),
  correctiveActions: z.array(HealthcareComplianceComplianceProgramCAPAActionSchema),
  preventiveActions: z.array(HealthcareComplianceComplianceProgramCAPAActionSchema).optional(),
  status: z.enum(["open", "investigating", "actionInProgress", "awaitingVerification", "closed", "overdue"]),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  closedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  closedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareComplianceComplianceProgramCAPASourceTypeSchema = z.enum(["incident", "audit", "complaint", "regulatoryFinding", "internalReview"]);

export const HealthcareComplianceComplianceProgramCAPAStatusSchema = z.enum(["open", "investigating", "actionInProgress", "awaitingVerification", "closed", "overdue"]);

export const HealthcareComplianceComplianceProgramCAPATypeSchema = z.enum(["corrective", "preventive"]);

export const HealthcareComplianceComplianceProgramCompliancePolicySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  title: z.string(),
  code: z.string().optional(),
  category: z.enum(["hipaa", "privacy", "security", "fraud", "coding", "clinicalSafety", "infectionControl", "osha", "other"]),
  policyVersion: z.string(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["draft", "approved", "active", "underReview", "retired"]),
  owner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  approvedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  document: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  description: z.string().optional()
});

export const HealthcareComplianceComplianceProgramDataRetentionScheduleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  resourceType: z.string(),
  category: z.string(),
  retentionPeriod: z.number().int(),
  legalBasis: z.string(),
  jurisdiction: z.string().optional(),
  afterAction: z.enum(["archive", "anonymize", "delete"]),
  active: z.boolean()
});

export const HealthcareComplianceComplianceProgramLegalHoldScopeSchema = z.object({
  resourceType: z.string(),
  criteria: z.record(z.string(), z.unknown())
});

export const HealthcareComplianceComplianceProgramLegalHoldSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  reason: z.string(),
  status: z.enum(["active", "released"]),
  initiatedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  releasedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  releasedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  scope: z.array(HealthcareComplianceComplianceProgramLegalHoldScopeSchema),
  note: z.string().optional()
});

export const HealthcareComplianceComplianceProgramLegalHoldStatusSchema = z.enum(["active", "released"]);

export const HealthcareComplianceComplianceProgramPolicyAttestationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  policy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  attestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  attestedAt: z.string().datetime().transform((str) => new Date(str)),
  acknowledged: z.boolean(),
  signature: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareComplianceComplianceProgramPolicyCategorySchema = z.enum(["hipaa", "privacy", "security", "fraud", "coding", "clinicalSafety", "infectionControl", "osha", "other"]);

export const HealthcareComplianceComplianceProgramPolicyStatusSchema = z.enum(["draft", "approved", "active", "underReview", "retired"]);

export const HealthcareComplianceComplianceProgramRetentionActionSchema = z.enum(["archive", "anonymize", "delete"]);

export const HealthcareCompliancePrivacyWorkflowAccountingOfDisclosuresSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  disclosureDate: z.string().datetime().transform((str) => new Date(str)),
  recipient: z.string(),
  recipientOrganization: z.string().optional(),
  purpose: z.enum(["treatment", "payment", "operations", "publicHealth", "research", "legal", "marketing", "other"]),
  resourcesDisclosed: z.array(z.string()),
  method: z.enum(["electronic", "fax", "mail", "inPerson", "verbal"]),
  disclosedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  legalAuthority: z.string().optional(),
  note: z.string().optional()
});

export const HealthcareCompliancePrivacyWorkflowAmendmentRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestDate: z.string().datetime().transform((str) => new Date(str)),
  requestedBy: z.string(),
  description: z.string(),
  fieldToAmend: z.string(),
  currentValue: z.string().optional(),
  proposedValue: z.string().optional(),
  status: z.enum(["received", "underReview", "approved", "denied", "completed"]),
  reviewedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reviewedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  denialReason: z.string().optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.string().optional()
});

export const HealthcareCompliancePrivacyWorkflowAmendmentStatusSchema = z.enum(["received", "underReview", "approved", "denied", "completed"]);

export const HealthcareCompliancePrivacyWorkflowBreachAssessmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  incidentReport: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  discoveryDate: z.string().datetime().transform((str) => new Date(str)),
  assessedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  phiInvolved: z.boolean(),
  individualsAffected: z.number().int(),
  dataElements: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  mitigatingFactors: z.array(z.string()).optional(),
  notificationRequired: z.boolean(),
  notificationDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["assessing", "notificationRequired", "notifying", "notified", "closed", "noBreachDetermined"])
});

export const HealthcareCompliancePrivacyWorkflowBreachAssessmentStatusSchema = z.enum(["assessing", "notificationRequired", "notifying", "notified", "closed", "noBreachDetermined"]);

export const HealthcareCompliancePrivacyWorkflowBreachNotificationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  breachAssessment: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  notificationType: z.enum(["individual", "hhsSecretary", "media", "stateAttorneyGeneral"]),
  notifiedAt: z.string().datetime().transform((str) => new Date(str)),
  notifiedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  method: z.enum(["letter", "email", "substitute", "media"]),
  recipientCount: z.number().int().optional(),
  contentSummary: z.string().optional(),
  proofOfNotification: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareCompliancePrivacyWorkflowBreachNotificationMethodSchema = z.enum(["letter", "email", "substitute", "media"]);

export const HealthcareCompliancePrivacyWorkflowBreachNotificationTypeSchema = z.enum(["individual", "hhsSecretary", "media", "stateAttorneyGeneral"]);

export const HealthcareCompliancePrivacyWorkflowBreachRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const HealthcareCompliancePrivacyWorkflowComplainantTypeSchema = z.enum(["patient", "employee", "external", "anonymous"]);

export const HealthcareCompliancePrivacyWorkflowDisclosureMethodSchema = z.enum(["electronic", "fax", "mail", "inPerson", "verbal"]);

export const HealthcareCompliancePrivacyWorkflowPrivacyComplaintSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  complainant: z.string(),
  complainantType: z.enum(["patient", "employee", "external", "anonymous"]),
  receivedDate: z.string().datetime().transform((str) => new Date(str)),
  description: z.string(),
  category: z.enum(["inappropriateAccess", "inappropriateDisclosure", "minimumNecessary", "safeguards", "rightsDenial", "retaliation", "other"]),
  status: z.enum(["received", "investigating", "substantiated", "unsubstantiated", "resolved", "referredToOCR"]),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  resolution: z.string().optional(),
  resolvedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  referralAgency: z.string().optional()
});

export const HealthcareCompliancePrivacyWorkflowPrivacyComplaintCategorySchema = z.enum(["inappropriateAccess", "inappropriateDisclosure", "minimumNecessary", "safeguards", "rightsDenial", "retaliation", "other"]);

export const HealthcareCompliancePrivacyWorkflowPrivacyComplaintStatusSchema = z.enum(["received", "investigating", "substantiated", "unsubstantiated", "resolved", "referredToOCR"]);

export const HealthcareCompliancePrivacyWorkflowPurposeOfUseSchema = z.enum(["treatment", "payment", "operations", "publicHealth", "research", "legal", "marketing", "other"]);

export const HealthcareConformanceSubscriptionsChannelTypeSchema = z.enum(["restHook", "websocket", "email"]);

export const HealthcareConformanceSubscriptionsSubscriptionFilterBySchema = z.object({
  resourceType: z.string().optional(),
  filterParameter: z.string(),
  comparator: z.string().optional(),
  modifier: z.string().optional(),
  value: z.string()
});

export const HealthcareConformanceSubscriptionsSubscriptionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["requested", "active", "error", "off", "enteredInError"]),
  topic: z.string().url(),
  contact: z.array(HealthcareCoreContactPointSchema).optional(),
  end: z.string().datetime().transform((str) => new Date(str)).optional(),
  reason: z.string().optional(),
  filterBy: z.array(HealthcareConformanceSubscriptionsSubscriptionFilterBySchema).optional(),
  channel: z.object({
  type: z.enum(["restHook", "websocket", "email"]),
  endpoint: z.string().url(),
  header: z.array(z.string()).optional(),
  heartbeatPeriod: z.number().int().optional(),
  timeout: z.number().int().optional(),
  contentType: z.string().optional(),
  content: z.string().optional()
}),
  maxCount: z.number().int().optional()
});

export const HealthcareConformanceSubscriptionsSubscriptionChannelSchema = z.object({
  type: z.enum(["restHook", "websocket", "email"]),
  endpoint: z.string().url(),
  header: z.array(z.string()).optional(),
  heartbeatPeriod: z.number().int().optional(),
  timeout: z.number().int().optional(),
  contentType: z.string().optional(),
  content: z.string().optional()
});

export const HealthcareConformanceSubscriptionsSubscriptionStatusSchema = z.enum(["requested", "active", "error", "off", "enteredInError"]);

export const HealthcareConformanceSubscriptionsSubscriptionTopicResourceTriggerSchema = z.object({
  description: z.string().optional(),
  resource: z.string(),
  supportedInteraction: z.array(z.string()).optional(),
  queryCriteria: z.string().optional()
});

export const HealthcareConformanceSubscriptionsSubscriptionTopicCanFilterBySchema = z.object({
  description: z.string().optional(),
  resource: z.string().optional(),
  filterParameter: z.string(),
  modifier: z.array(z.string()).optional()
});

export const HealthcareConformanceSubscriptionsSubscriptionTopicSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  url: z.string().url(),
  title: z.string(),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  description: z.string().optional(),
  resourceTrigger: z.array(HealthcareConformanceSubscriptionsSubscriptionTopicResourceTriggerSchema).optional(),
  canFilterBy: z.array(HealthcareConformanceSubscriptionsSubscriptionTopicCanFilterBySchema).optional()
});

export const HealthcareConformanceTerminologyDesignationSchema = z.object({
  language: z.string().optional(),
  use: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  value: z.string()
});

export const HealthcareConformanceTerminologyConceptPropertySchema = z.object({
  code: z.string(),
  valueCode: z.string().optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().int().optional()
});

export const HealthcareConformanceTerminologyCodeSystemConceptSchema: z.ZodTypeAny = z.object({
  code: z.string(),
  display: z.string().optional(),
  definition: z.string().optional(),
  designation: z.array(HealthcareConformanceTerminologyDesignationSchema).optional(),
  property: z.array(HealthcareConformanceTerminologyConceptPropertySchema).optional(),
  concept: z.array(z.lazy(() => HealthcareConformanceTerminologyCodeSystemConceptSchema)).optional()
});

export const HealthcareConformanceTerminologyCodeSystemResourceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  url: z.string().url(),
  name: z.string(),
  title: z.string().optional(),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  description: z.string().optional(),
  content: z.string(),
  count: z.number().int().optional(),
  concept: z.array(z.lazy(() => HealthcareConformanceTerminologyCodeSystemConceptSchema)).optional()
});

export const HealthcareConformanceTerminologyConceptMapTargetSchema = z.object({
  code: z.string(),
  display: z.string().optional(),
  equivalence: z.string()
});

export const HealthcareConformanceTerminologyConceptMapElementSchema = z.object({
  code: z.string(),
  display: z.string().optional(),
  target: z.array(HealthcareConformanceTerminologyConceptMapTargetSchema)
});

export const HealthcareConformanceTerminologyConceptMapGroupSchema = z.object({
  source: z.string().url().optional(),
  target: z.string().url().optional(),
  element: z.array(HealthcareConformanceTerminologyConceptMapElementSchema)
});

export const HealthcareConformanceTerminologyConceptMapResourceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  url: z.string().url(),
  name: z.string(),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  sourceUri: z.string().url().optional(),
  targetUri: z.string().url().optional(),
  group: z.array(HealthcareConformanceTerminologyConceptMapGroupSchema)
});

export const HealthcareConformanceTerminologyValueSetConceptSchema = z.object({
  code: z.string(),
  display: z.string().optional()
});

export const HealthcareConformanceTerminologyValueSetFilterSchema = z.object({
  property: z.string(),
  operator: z.string(),
  value: z.string()
});

export const HealthcareConformanceTerminologyValueSetIncludeSchema = z.object({
  system: z.string().url().optional(),
  version: z.string().optional(),
  concept: z.array(HealthcareConformanceTerminologyValueSetConceptSchema).optional(),
  filter: z.array(HealthcareConformanceTerminologyValueSetFilterSchema).optional()
});

export const HealthcareConformanceTerminologyValueSetComposeSchema = z.object({
  include: z.array(HealthcareConformanceTerminologyValueSetIncludeSchema)
});

export const HealthcareConformanceTerminologyValueSetExpansionContainsSchema = z.object({
  system: z.string().url().optional(),
  code: z.string(),
  display: z.string().optional()
});

export const HealthcareConformanceTerminologyValueSetExpansionSchema = z.object({
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  total: z.number().int().optional(),
  contains: z.array(HealthcareConformanceTerminologyValueSetExpansionContainsSchema)
});

export const HealthcareConformanceTerminologyValueSetResourceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  url: z.string().url(),
  name: z.string(),
  title: z.string().optional(),
  status: z.enum(["draft", "active", "retired", "unknown"]),
  description: z.string().optional(),
  compose: z.object({
  include: z.array(HealthcareConformanceTerminologyValueSetIncludeSchema)
}).optional(),
  expansion: z.object({
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  total: z.number().int().optional(),
  contains: z.array(HealthcareConformanceTerminologyValueSetExpansionContainsSchema)
}).optional()
});

export const HealthcareCoreCodeableConceptUpdateSchema = z.object({
  coding: z.array(HealthcareCoreCodingSchema).optional(),
  text: z.string().optional()
});

export const HealthcareCoreConfidentialityClassificationSchema = z.enum(["U", "L", "M", "N", "R", "V"]);

export const HealthcareCoreContactSystemSchema = z.enum(["phone", "fax", "email", "pager", "url", "sms", "other"]);

export const HealthcareCoreContactUseSchema = z.enum(["home", "work", "temp", "old", "mobile"]);

export const HealthcareCoreHealthcareBaseEntitySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional()
});

export const HealthcareCoreIdentifierUseSchema = z.enum(["usual", "official", "temp", "secondary", "old"]);

export const HealthcareCoreMoneySchema = z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
});

export const HealthcareCoreNameUseSchema = z.enum(["usual", "official", "temp", "nickname", "anonymous", "old", "maiden"]);

export const HealthcareCorePeriodUpdateSchema = z.object({
  start: z.string().datetime().transform((str) => new Date(str)).optional(),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareCorePurposeOfUseSchema = z.enum(["TREAT", "HPAYMT", "HOPERAT", "SYSADMIN", "FRAUD", "PSYCHOTHERAPY", "TRAIN", "HLEGAL", "HMARKT", "HDIR", "HDISCL", "ETREAT", "HRESCH"]);

export const HealthcareCoreQuantitySchema = z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
});

export const HealthcareCoreRangeSchema = z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareCoreRatioSchema = z.object({
  numerator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  denominator: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareCoreReferenceUpdateSchema = z.object({
  resourceType: z.string().optional(),
  id: z.string().uuid().optional(),
  display: z.string().optional()
});

export const HealthcareCoreSensitiveDataCategorySchema = z.enum(["mental-health", "substance-use-disorder", "hiv-aids", "sti", "reproductive-health", "genetic-data", "sogi", "psychotherapy-notes", "adolescent-confidential", "domestic-violence", "workers-compensation", "vip-record"]);

export const HealthcareCoreTerminologyAdministrativeGenderSchema = z.enum(["male", "female", "other", "unknown"]);

export const HealthcareCoreTerminologyCarePlanStatusSchema = z.enum(["draft", "active", "onHold", "revoked", "completed", "enteredInError", "unknown"]);

export const HealthcareCoreTerminologyConsentStatusSchema = z.enum(["draft", "proposed", "active", "rejected", "inactive", "enteredInError"]);

export const HealthcareCoreTerminologyDeviceStatusSchema = z.enum(["active", "inactive", "enteredInError", "unknown"]);

export const HealthcareCoreTerminologyDiagnosticReportStatusSchema = z.enum(["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "enteredInError", "unknown"]);

export const HealthcareCoreTerminologyEncounterClassSchema = z.enum(["ambulatory", "inpatient", "emergency", "observation", "home", "virtual", "fieldVisit"]);

export const HealthcareCoreTerminologyEpisodeOfCareStatusSchema = z.enum(["planned", "waitlist", "active", "onhold", "finished", "cancelled", "enteredInError"]);

export const HealthcareCoreTerminologyFlagPrioritySchema = z.enum(["high", "medium", "low"]);

export const HealthcareCoreTerminologyFlagStatusSchema = z.enum(["active", "inactive", "enteredInError"]);

export const HealthcareCoreTerminologyInventoryItemStatusSchema = z.enum(["active", "inactive", "enteredInError"]);

export const HealthcareCoreTerminologyMedicationAdministrationStatusSchema = z.enum(["inProgress", "notDone", "onHold", "completed", "enteredInError", "stopped", "unknown"]);

export const HealthcareCoreTerminologyPublicationStatusSchema = z.enum(["draft", "active", "retired", "unknown"]);

export const HealthcareCoreTerminologyRequestPrioritySchema = z.enum(["routine", "urgent", "asap", "stat"]);

export const HealthcareCoreTerminologyTaskIntentSchema = z.enum(["proposal", "plan", "order", "originalOrder", "reflexOrder", "fillerOrder", "instanceOrder", "option"]);

export const HealthcareCoreTerminologyTaskPrioritySchema = z.enum(["routine", "urgent", "asap", "stat"]);

export const HealthcareCoreTerminologyTaskStatusSchema = z.enum(["draft", "requested", "received", "accepted", "rejected", "ready", "cancelled", "inProgress", "onHold", "failed", "completed", "enteredInError"]);

export const HealthcareCoreTimingSchema = z.object({
  event: z.array(z.string().datetime().transform((str) => new Date(str))).optional(),
  repeat: z.object({
  count: z.number().int().gte(0).optional(),
  duration: z.number().gte(0).optional(),
  durationUnit: z.string().optional(),
  frequency: z.number().int().gte(1).optional(),
  period: z.number().gte(0).optional(),
  periodUnit: z.string().optional(),
  dayOfWeek: z.array(z.string()).optional(),
  timeOfDay: z.array(z.string()).optional()
}).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareCoreTimingRepeatSchema = z.object({
  count: z.number().int().gte(0).optional(),
  duration: z.number().gte(0).optional(),
  durationUnit: z.string().optional(),
  frequency: z.number().int().gte(1).optional(),
  period: z.number().gte(0).optional(),
  periodUnit: z.string().optional(),
  dayOfWeek: z.array(z.string()).optional(),
  timeOfDay: z.array(z.string()).optional()
});

export const HealthcareOperationalDevicesAssignmentStatusSchema = z.enum(["active", "returned", "lost", "damaged"]);

export const HealthcareOperationalDevicesCalibrationStateSchema = z.enum(["notCalibrated", "calibrationRequired", "calibrated", "unspecified"]);

export const HealthcareOperationalDevicesCalibrationTypeSchema = z.enum(["unspecified", "offset", "gain", "twoPoint"]);

export const HealthcareOperationalDevicesDeviceNameSchema = z.object({
  name: z.string(),
  type: z.enum(["userFriendlyName", "patientReportedName", "manufacturerName", "modelName", "other"])
});

export const HealthcareOperationalDevicesDeviceVersionSchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  component: z.string().optional(),
  value: z.string()
});

export const HealthcareOperationalDevicesDeviceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "inactive", "enteredInError", "unknown"]),
  statusReason: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  distinctIdentifier: z.string().optional(),
  manufacturer: z.string().optional(),
  manufactureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  modelNumber: z.string().optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  deviceName: z.array(HealthcareOperationalDevicesDeviceNameSchema).optional(),
  deviceVersion: z.array(HealthcareOperationalDevicesDeviceVersionSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  owner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  url: z.string().url().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  safety: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  parent: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareOperationalDevicesDeviceAssignmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  device: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  assignedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assignedAt: z.string().datetime().transform((str) => new Date(str)),
  returnedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["active", "returned", "lost", "damaged"]),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  note: z.string().optional()
});

export const HealthcareOperationalDevicesDeviceMetricCalibrationSchema = z.object({
  type: z.enum(["unspecified", "offset", "gain", "twoPoint"]).optional(),
  state: z.enum(["notCalibrated", "calibrationRequired", "calibrated", "unspecified"]).optional(),
  time: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareOperationalDevicesDeviceMetricSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  device: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  unit: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  source: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  category: z.enum(["measurement", "setting", "calculation", "unspecified"]),
  operationalStatus: z.enum(["on", "off", "standby", "enteredInError"]).optional(),
  color: z.string().optional(),
  measurementPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  calibration: z.array(HealthcareOperationalDevicesDeviceMetricCalibrationSchema).optional()
});

export const HealthcareOperationalDevicesDeviceMetricCategorySchema = z.enum(["measurement", "setting", "calculation", "unspecified"]);

export const HealthcareOperationalDevicesDeviceMetricOperationalStatusSchema = z.enum(["on", "off", "standby", "enteredInError"]);

export const HealthcareOperationalDevicesDeviceNameTypeSchema = z.enum(["userFriendlyName", "patientReportedName", "manufacturerName", "modelName", "other"]);

export const HealthcareOperationalExternalConnectorsConnectorSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(200),
  type: z.enum(["paymentGateway", "smsProvider", "emailProvider", "imagingPacs", "ePrescribing", "clearinghouse", "videoConference", "laboratoryLis", "hl7Interface", "fhirEndpoint", "cloudStorage", "other"]),
  status: z.enum(["configured", "testing", "active", "degraded", "disabled", "error"]),
  endpoint: z.string().max(2048).optional(),
  authMethod: z.enum(["apiKey", "oauth2", "basicAuth", "certificate", "none"]).optional(),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  lastHealthCheck: z.string().datetime().transform((str) => new Date(str)).optional(),
  healthStatus: z.enum(["healthy", "degraded", "unreachable", "unknown"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareOperationalExternalConnectorsConnectorAuthMethodSchema = z.enum(["apiKey", "oauth2", "basicAuth", "certificate", "none"]);

export const HealthcareOperationalExternalConnectorsConnectorCredentialSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  connector: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  credentialType: z.string().max(100),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  rotatedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.string().max(500).optional()
});

export const HealthcareOperationalExternalConnectorsConnectorHealthStatusSchema = z.enum(["healthy", "degraded", "unreachable", "unknown"]);

export const HealthcareOperationalExternalConnectorsConnectorStatusSchema = z.enum(["configured", "testing", "active", "degraded", "disabled", "error"]);

export const HealthcareOperationalExternalConnectorsConnectorSyncLogSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  connector: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  syncType: z.string().max(100),
  startedAt: z.string().datetime().transform((str) => new Date(str)),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["running", "completed", "failed", "cancelled"]),
  recordsProcessed: z.number().int().gte(0).optional(),
  recordsFailed: z.number().int().gte(0).optional(),
  errorDetails: z.string().max(5000).optional()
});

export const HealthcareOperationalExternalConnectorsConnectorTypeSchema = z.enum(["paymentGateway", "smsProvider", "emailProvider", "imagingPacs", "ePrescribing", "clearinghouse", "videoConference", "laboratoryLis", "hl7Interface", "fhirEndpoint", "cloudStorage", "other"]);

export const HealthcareOperationalExternalConnectorsSyncStatusSchema = z.enum(["running", "completed", "failed", "cancelled"]);

export const HealthcareOperationalHospitalDietaryDietOrderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  orderedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  dietType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  texture: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  fluidRestriction: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  allergies: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  supplements: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  feedingAssistance: z.boolean().optional(),
  specialInstructions: z.string().optional(),
  status: z.enum(["active", "onHold", "completed", "discontinued"])
});

export const HealthcareOperationalHospitalDietaryDietOrderStatusSchema = z.enum(["active", "onHold", "completed", "discontinued"]);

export const HealthcareOperationalHospitalDietaryMealServiceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  dietOrder: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)),
  servedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  consumptionPercent: z.number().int().gte(0).lte(100).optional(),
  refused: z.boolean().optional(),
  intakeRecordedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.string().optional()
});

export const HealthcareOperationalHospitalDietaryMealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const HealthcareOperationalHospitalDietaryNutritionRiskLevelSchema = z.enum(["low", "moderate", "high"]);

export const HealthcareOperationalHospitalDietaryNutritionScreeningSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  screenedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  screenedAt: z.string().datetime().transform((str) => new Date(str)),
  tool: z.enum(["mst", "must", "nrs2002", "sga"]),
  score: z.number(),
  riskLevel: z.enum(["low", "moderate", "high"]),
  referToNutritionist: z.boolean().optional()
});

export const HealthcareOperationalHospitalDietaryNutritionScreeningToolSchema = z.enum(["mst", "must", "nrs2002", "sga"]);

export const HealthcareOperationalHospitalEVSCleaningFrequencySchema = z.enum(["daily", "twiceDaily", "afterEachPatient", "weekly"]);

export const HealthcareOperationalHospitalEVSCleaningPrioritySchema = z.enum(["routine", "urgent", "stat"]);

export const HealthcareOperationalHospitalEVSCleaningScheduleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  frequency: z.enum(["daily", "twiceDaily", "afterEachPatient", "weekly"]),
  dayOfWeek: z.array(z.string()).optional(),
  time: z.string().optional(),
  type: z.enum(["discharge", "daily", "terminal", "isolation", "stat"]),
  active: z.boolean()
});

export const HealthcareOperationalHospitalEVSCleaningTaskSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["discharge", "daily", "terminal", "isolation", "stat"]),
  priority: z.enum(["routine", "urgent", "stat"]),
  status: z.enum(["pending", "assigned", "inProgress", "completed", "verified"]),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  requestedAt: z.string().datetime().transform((str) => new Date(str)),
  startedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  verifiedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  verifiedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  isolationPrecautions: z.string().optional(),
  products: z.array(z.string()).optional(),
  note: z.string().optional()
});

export const HealthcareOperationalHospitalEVSCleaningTaskStatusSchema = z.enum(["pending", "assigned", "inProgress", "completed", "verified"]);

export const HealthcareOperationalHospitalEVSCleaningTypeSchema = z.enum(["discharge", "daily", "terminal", "isolation", "stat"]);

export const HealthcareOperationalHospitalEmergencyPreparednessActivationLevelSchema = z.enum(["advisory", "partial", "full"]);

export const HealthcareOperationalHospitalEmergencyPreparednessActivationStatusSchema = z.enum(["active", "standDown", "deactivated"]);

export const HealthcareOperationalHospitalEmergencyPreparednessDrillTypeSchema = z.enum(["tabletop", "functional", "fullScale"]);

export const HealthcareOperationalHospitalEmergencyPreparednessEmergencyActivationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  plan: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  activatedAt: z.string().datetime().transform((str) => new Date(str)),
  activatedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  level: z.enum(["advisory", "partial", "full"]),
  status: z.enum(["active", "standDown", "deactivated"]),
  incidentCommander: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  deactivatedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  deactivatedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  afterActionReportDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareOperationalHospitalEmergencyPreparednessEmergencyDrillSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  plan: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  actualDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  type: z.enum(["tabletop", "functional", "fullScale"]),
  participants: z.number().int(),
  duration: z.number().int(),
  objectives: z.array(z.string()),
  lessonsLearned: z.array(z.string()).optional(),
  score: z.number().int().optional(),
  passedObjectives: z.array(z.string()).optional(),
  failedObjectives: z.array(z.string()).optional(),
  correctiveActions: z.array(z.string()).optional()
});

export const HealthcareOperationalHospitalEmergencyPreparednessEmergencyPlanSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  type: z.enum(["massCasualty", "pandemic", "naturalDisaster", "hazmat", "activeThreat", "infrastructure", "evacuation", "other"]),
  status: z.enum(["draft", "approved", "active", "superseded", "retired"]),
  approvedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  approvedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  lastDrillDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  nextDrillDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  description: z.string(),
  activationCriteria: z.string().optional(),
  deactivationCriteria: z.string().optional()
});

export const HealthcareOperationalHospitalEmergencyPreparednessEmergencyPlanTypeSchema = z.enum(["massCasualty", "pandemic", "naturalDisaster", "hazmat", "activeThreat", "infrastructure", "evacuation", "other"]);

export const HealthcareOperationalHospitalEmergencyPreparednessPlanStatusSchema = z.enum(["draft", "approved", "active", "superseded", "retired"]);

export const HealthcareOperationalHospitalEmergencyPreparednessSurgeCapacitySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  activation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  assessedAt: z.string().datetime().transform((str) => new Date(str)),
  totalBeds: z.number().int(),
  availableBeds: z.number().int(),
  icuBeds: z.number().int(),
  icuAvailable: z.number().int(),
  edCapacity: z.number().int(),
  edCurrent: z.number().int(),
  ventilators: z.number().int(),
  ventilatorsAvailable: z.number().int(),
  staffOnDuty: z.number().int(),
  additionalStaffAvailable: z.number().int(),
  bloodSupplyStatus: z.string().optional(),
  supplyStatus: z.string().optional()
});

export const HealthcareOperationalHospitalMortuaryBodyReleaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  deceasedRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  releasedTo: z.string(),
  relationship: z.string(),
  funeralHome: z.string().optional(),
  releasedAt: z.string().datetime().transform((str) => new Date(str)),
  releasedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  deathCertificateIssued: z.boolean(),
  identificationVerified: z.boolean(),
  personalEffectsReleased: z.boolean(),
  signatures: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareOperationalHospitalMortuaryDeceasedRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  deathDateTime: z.string().datetime().transform((str) => new Date(str)),
  pronouncedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  causeOfDeath: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  mannerOfDeath: z.enum(["natural", "accident", "suicide", "homicide", "undetermined", "pending"]),
  autopsyRequested: z.boolean().optional(),
  autopsyPerformed: z.boolean().optional(),
  coronerNotified: z.boolean().optional(),
  organDonor: z.boolean().optional()
});

export const HealthcareOperationalHospitalMortuaryMannerOfDeathSchema = z.enum(["natural", "accident", "suicide", "homicide", "undetermined", "pending"]);

export const HealthcareOperationalHospitalMortuaryMortuaryStorageSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  unit: z.string(),
  compartment: z.string(),
  status: z.enum(["available", "occupied", "reserved", "maintenance"]),
  deceasedRecord: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  admittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  releasedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  temperature: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareOperationalHospitalMortuaryStorageStatusSchema = z.enum(["available", "occupied", "reserved", "maintenance"]);

export const HealthcareOperationalHospitalPeerReviewActionStatusSchema = z.enum(["pending", "inProgress", "completed", "overdue"]);

export const HealthcareOperationalHospitalPeerReviewPeerReviewActionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  peerReviewCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  actionType: z.enum(["educationRequired", "proctoring", "restrictionImposed", "privilegeSuspended", "privilegeRevoked", "noActionRequired", "commendation", "processImprovement"]),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  completedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["pending", "inProgress", "completed", "overdue"]),
  note: z.string().optional()
});

export const HealthcareOperationalHospitalPeerReviewPeerReviewActionTypeSchema = z.enum(["educationRequired", "proctoring", "restrictionImposed", "privilegeSuspended", "privilegeRevoked", "noActionRequired", "commendation", "processImprovement"]);

export const HealthcareOperationalHospitalPeerReviewPeerReviewCaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  referredBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  referralDate: z.string().datetime().transform((str) => new Date(str)),
  category: z.enum(["mortality", "complication", "readmission", "qualityConcern", "sentinel", "routine"]),
  status: z.enum(["referred", "underReview", "committeeReview", "actionRequired", "resolved", "closed"]),
  priority: z.enum(["routine", "urgent", "immediate"]),
  description: z.string(),
  isConfidential: z.boolean(),
  protectedUnderStatute: z.boolean().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareOperationalHospitalPeerReviewPeerReviewCategorySchema = z.enum(["mortality", "complication", "readmission", "qualityConcern", "sentinel", "routine"]);

export const HealthcareOperationalHospitalPeerReviewPeerReviewPanelSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  peerReviewCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  panelMembers: z.array(HealthcareCoreReferenceSchema),
  chairperson: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  scheduledDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  meetingDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  findings: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
  actionPlan: z.string().optional(),
  votedDate: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareOperationalHospitalPeerReviewPeerReviewPrioritySchema = z.enum(["routine", "urgent", "immediate"]);

export const HealthcareOperationalHospitalPeerReviewPeerReviewStatusSchema = z.enum(["referred", "underReview", "committeeReview", "actionRequired", "resolved", "closed"]);

export const HealthcareOperationalHospitalSterileProcessingBiologicalIndicatorSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  sterilizationCycle: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["sporeTest", "chemicalIndicator"]),
  lotNumber: z.string(),
  incubationStart: z.string().datetime().transform((str) => new Date(str)).optional(),
  incubationEnd: z.string().datetime().transform((str) => new Date(str)).optional(),
  result: z.enum(["pass", "fail", "pending"]).optional(),
  readBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareOperationalHospitalSterileProcessingBiologicalIndicatorResultSchema = z.enum(["pass", "fail", "pending"]);

export const HealthcareOperationalHospitalSterileProcessingBiologicalIndicatorTypeSchema = z.enum(["sporeTest", "chemicalIndicator"]);

export const HealthcareOperationalHospitalSterileProcessingCycleStatusSchema = z.enum(["running", "completed", "failed"]);

export const HealthcareOperationalHospitalSterileProcessingInstrumentItemSchema = z.object({
  name: z.string(),
  code: z.string().optional(),
  quantity: z.number().int(),
  serialNumber: z.string().optional()
});

export const HealthcareOperationalHospitalSterileProcessingInstrumentSetSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  code: z.string().optional(),
  instruments: z.array(HealthcareOperationalHospitalSterileProcessingInstrumentItemSchema),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  status: z.enum(["available", "inUse", "decontamination", "sterilization", "quarantine", "retired"])
});

export const HealthcareOperationalHospitalSterileProcessingInstrumentSetStatusSchema = z.enum(["available", "inUse", "decontamination", "sterilization", "quarantine", "retired"]);

export const HealthcareOperationalHospitalSterileProcessingSterilizationCycleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  autoclave: z.string(),
  cycleNumber: z.string(),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  temperature: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  pressure: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  duration: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  instrumentSets: z.array(HealthcareCoreReferenceSchema),
  status: z.enum(["running", "completed", "failed"]),
  operatedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  parameters: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareOperationalHospitalSterileProcessingSterilizationLogSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  instrumentSet: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  cycle: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  biologicalIndicator: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  status: z.enum(["sterilized", "failed", "quarantined"]),
  sterilizedAt: z.string().datetime().transform((str) => new Date(str)),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  releasedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareOperationalHospitalSterileProcessingSterilizationLogStatusSchema = z.enum(["sterilized", "failed", "quarantined"]);

export const HealthcareOperationalHospitalTransportTransportModeSchema = z.enum(["ambulatory", "wheelchair", "stretcher", "bed", "isolationBed"]);

export const HealthcareOperationalHospitalTransportTransportPrioritySchema = z.enum(["routine", "urgent", "stat"]);

export const HealthcareOperationalHospitalTransportTransportRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  fromLocation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toLocation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestedAt: z.string().datetime().transform((str) => new Date(str)),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  priority: z.enum(["routine", "urgent", "stat"]),
  transportMode: z.enum(["ambulatory", "wheelchair", "stretcher", "bed", "isolationBed"]),
  status: z.enum(["requested", "assigned", "inTransit", "completed", "cancelled"]),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  departedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  arrivedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  specialRequirements: z.array(z.string()).optional()
});

export const HealthcareOperationalHospitalTransportTransportStatusSchema = z.enum(["requested", "assigned", "inTransit", "completed", "cancelled"]);

export const HealthcareOperationalHospitalTransportTransportTeamSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  members: z.array(HealthcareCoreReferenceSchema),
  department: z.string().optional(),
  active: z.boolean()
});

export const HealthcareOperationalImplantRegistryImplantSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  toothNumber: z.number().int(),
  fixture: z.object({
  manufacturer: z.string(),
  system: z.string(),
  lotNumber: z.string(),
  diameter: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  length: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  platform: z.string().optional(),
  surface: z.string().optional(),
  torqueAtPlacement: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}),
  abutment: z.object({
  manufacturer: z.string().optional(),
  type: z.string(),
  material: z.string().optional(),
  height: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  angulation: z.number().int().optional()
}).optional(),
  status: z.enum(["placed", "osseointegrating", "restored", "failed", "explanted"]),
  placedDate: z.string().datetime().transform((str) => new Date(str)),
  placedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  restoredDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  failedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareOperationalImplantRegistryImplantAbutmentSchema = z.object({
  manufacturer: z.string().optional(),
  type: z.string(),
  material: z.string().optional(),
  height: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  angulation: z.number().int().optional()
});

export const HealthcareOperationalImplantRegistryImplantFixtureSchema = z.object({
  manufacturer: z.string(),
  system: z.string(),
  lotNumber: z.string(),
  diameter: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  length: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  platform: z.string().optional(),
  surface: z.string().optional(),
  torqueAtPlacement: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareOperationalImplantRegistryImplantRecallSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  implant: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  lotNumber: z.string(),
  manufacturer: z.string(),
  reason: z.string(),
  recallDate: z.string().datetime().transform((str) => new Date(str)),
  affectedPatients: z.number().int().optional()
});

export const HealthcareOperationalImplantRegistryImplantStatusSchema = z.enum(["placed", "osseointegrating", "restored", "failed", "explanted"]);

export const HealthcareOperationalImplantRegistryOsseointegrationCheckSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  implant: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  checkDate: z.string().datetime().transform((str) => new Date(str)),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  stabilityValue: z.number().optional(),
  method: z.string().optional(),
  xrayReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  outcome: z.string(),
  nextCheckDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareOperationalInventoryBatchStatusSchema = z.enum(["available", "quarantine", "expired", "recalled", "consumed"]);

export const HealthcareOperationalInventoryInventoryBatchSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  item: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  lotNumber: z.string(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["available", "quarantine", "expired", "recalled", "consumed"])
});

export const HealthcareOperationalInventoryInventoryItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "inactive", "enteredInError"]),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  name: z.string(),
  description: z.string().optional(),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  manufacturer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  unitOfMeasure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  currentQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  reorderLevel: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  reorderQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  storageLocation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  cost: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional()
});

export const HealthcareOperationalInventoryStorageLocationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  type: z.enum(["warehouse", "pharmacy", "clinic", "operatingRoom", "laboratory", "bloodBank", "other"]),
  parentLocation: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  managingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  temperatureRange: z.string().optional(),
  specialConditions: z.array(z.string()).optional()
});

export const HealthcareOperationalInventoryStorageLocationTypeSchema = z.enum(["warehouse", "pharmacy", "clinic", "operatingRoom", "laboratory", "bloodBank", "other"]);

export const HealthcareOperationalInventorySupplyConsumptionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  item: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  batch: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  quantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  consumedAt: z.string().datetime().transform((str) => new Date(str)),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  note: z.string().optional()
});

export const HealthcareOperationalOperatoryChairBlockStatusSchema = z.enum(["scheduled", "checkedIn", "inProgress", "completed", "noShow"]);

export const HealthcareOperationalOperatoryChairTimeBlockSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  operatory: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  appointment: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["scheduled", "checkedIn", "inProgress", "completed", "noShow"])
});

export const HealthcareOperationalOperatoryOperatorySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["general", "hygiene", "surgical", "pediatric", "orthodontic"]),
  status: z.enum(["available", "occupied", "turnover", "maintenance", "closed"]),
  equipment: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  features: z.array(z.string()).optional()
});

export const HealthcareOperationalOperatoryOperatoryAssignmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  operatory: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  startTime: z.string(),
  endTime: z.string(),
  shiftType: z.string().optional()
});

export const HealthcareOperationalOperatoryOperatoryStatusSchema = z.enum(["available", "occupied", "turnover", "maintenance", "closed"]);

export const HealthcareOperationalOperatoryOperatoryTypeSchema = z.enum(["general", "hygiene", "surgical", "pediatric", "orthodontic"]);

export const HealthcareOperationalOperatoryTurnoverEventSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  operatory: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  previousAppointment: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  startTime: z.string().datetime().transform((str) => new Date(str)),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  performedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareOperationalPatientPortalIntakeFormStatusSchema = z.enum(["sent", "inProgress", "submitted", "expired"]);

export const HealthcareOperationalPatientPortalOnlineBookingRequestSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  appointmentType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  preferredProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  preferredTimeRange: z.string().max(100).optional(),
  reason: z.string().max(500).optional(),
  status: z.enum(["pending", "confirmed", "declined", "expired", "cancelled"]),
  confirmedAppointment: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareOperationalPatientPortalOnlineBookingStatusSchema = z.enum(["pending", "confirmed", "declined", "expired", "cancelled"]);

export const HealthcareOperationalPatientPortalPatientIntakeFormSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  questionnaire: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["sent", "inProgress", "submitted", "expired"]),
  sentAt: z.string().datetime().transform((str) => new Date(str)),
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  response: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareOperationalPatientPortalPortalAccountSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  email: z.string().max(254),
  status: z.enum(["pending", "active", "locked", "deactivated"]),
  registeredAt: z.string().datetime().transform((str) => new Date(str)),
  lastLoginAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  mfaEnabled: z.boolean().optional(),
  termsAcceptedAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareOperationalPatientPortalPortalAccountStatusSchema = z.enum(["pending", "active", "locked", "deactivated"]);

export const HealthcareOperationalPatientPortalPortalMessageSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  sender: z.string().max(200),
  senderType: z.enum(["patient", "provider", "system"]),
  recipient: z.string().max(200),
  recipientType: z.enum(["patient", "provider", "system"]),
  subject: z.string().max(300),
  body: z.string().max(10000),
  sentAt: z.string().datetime().transform((str) => new Date(str)),
  readAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  category: z.enum(["general", "billing", "appointment", "prescription", "results", "referral"]),
  attachments: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareOperationalPatientPortalPortalMessageCategorySchema = z.enum(["general", "billing", "appointment", "prescription", "results", "referral"]);

export const HealthcareOperationalPatientPortalPortalPaymentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  amount: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}),
  paymentMethod: z.string().max(100),
  transactionId: z.string().max(200).optional(),
  status: z.enum(["pending", "completed", "failed", "refunded"]),
  paidAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  invoiceReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareOperationalPatientPortalPortalPaymentStatusSchema = z.enum(["pending", "completed", "failed", "refunded"]);

export const HealthcareOperationalPatientPortalPortalSenderTypeSchema = z.enum(["patient", "provider", "system"]);

export const HealthcareOperationalRecallCampaignStatusSchema = z.enum(["draft", "active", "paused", "completed"]);

export const HealthcareOperationalRecallRecallCampaignSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(200),
  targetCriteria: z.record(z.string(), z.unknown()),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]),
  patientsTargeted: z.number().int(),
  patientsContacted: z.number().int().optional(),
  patientsBooked: z.number().int().optional()
});

export const HealthcareOperationalRecallRecallPrioritySchema = z.enum(["routine", "urgent"]);

export const HealthcareOperationalRecallRecallRuleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(200),
  procedureCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  intervalMonths: z.number().int(),
  priority: z.enum(["routine", "urgent"]),
  description: z.string().max(500).optional(),
  active: z.boolean()
});

export const HealthcareOperationalRecallRecallScheduleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  rule: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  status: z.enum(["scheduled", "contacted", "booked", "completed", "dismissed", "overdue", "unresponsive"]),
  lastContactDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  contactAttempts: z.number().int(),
  bookedAppointment: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.string().max(500).optional()
});

export const HealthcareOperationalRecallRecallStatusSchema = z.enum(["scheduled", "contacted", "booked", "completed", "dismissed", "overdue", "unresponsive"]);

export const HealthcareSupportBreakGlassBreakGlassOverrideSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reason: z.enum(["emergencyTreatment", "immediateThreatToLife", "patientUnavailableForConsent", "publicHealthEmergency", "other"]),
  justification: z.string(),
  activatedAt: z.string().datetime().transform((str) => new Date(str)),
  expiresAt: z.string().datetime().transform((str) => new Date(str)),
  expiredAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  resourcesAccessed: z.array(HealthcareCoreReferenceSchema).optional(),
  sensitivityOverrides: z.array(HealthcareCoreSensitiveDataCategorySchema).optional(),
  status: z.enum(["active", "expired", "reviewed", "flaggedForReview"]),
  reviewedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  reviewedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reviewOutcome: z.string().optional(),
  auditEventRef: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareSupportBreakGlassBreakGlassReasonSchema = z.enum(["emergencyTreatment", "immediateThreatToLife", "patientUnavailableForConsent", "publicHealthEmergency", "other"]);

export const HealthcareSupportBreakGlassBreakGlassStatusSchema = z.enum(["active", "expired", "reviewed", "flaggedForReview"]);

export const HealthcareSupportCarePlanningCarePlanActivitySchema = z.object({
  outcomeCodeableConcept: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  outcomeReference: z.array(HealthcareCoreReferenceSchema).optional(),
  progress: z.array(HealthcareCoreAnnotationSchema).optional(),
  reference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  detail: z.object({
  kind: z.string().optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  goal: z.array(HealthcareCoreReferenceSchema).optional(),
  status: z.enum(["notStarted", "scheduled", "inProgress", "onHold", "completed", "cancelled", "stopped", "unknown", "enteredInError"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  doNotPerform: z.boolean().optional(),
  scheduledPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.array(HealthcareCoreReferenceSchema).optional(),
  description: z.string().optional()
}).optional()
});

export const HealthcareSupportCarePlanningCarePlanSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["draft", "active", "onHold", "revoked", "completed", "enteredInError", "unknown"]),
  intent: z.enum(["proposal", "plan", "order", "option"]),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  created: z.string().datetime().transform((str) => new Date(str)),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  contributor: z.array(HealthcareCoreReferenceSchema).optional(),
  careTeam: z.array(HealthcareCoreReferenceSchema).optional(),
  addresses: z.array(HealthcareCoreReferenceSchema).optional(),
  supportingInfo: z.array(HealthcareCoreReferenceSchema).optional(),
  goal: z.array(HealthcareCoreReferenceSchema).optional(),
  activity: z.array(HealthcareSupportCarePlanningCarePlanActivitySchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportCarePlanningCarePlanActivityDetailSchema = z.object({
  kind: z.string().optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  goal: z.array(HealthcareCoreReferenceSchema).optional(),
  status: z.enum(["notStarted", "scheduled", "inProgress", "onHold", "completed", "cancelled", "stopped", "unknown", "enteredInError"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  doNotPerform: z.boolean().optional(),
  scheduledPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.array(HealthcareCoreReferenceSchema).optional(),
  description: z.string().optional()
});

export const HealthcareSupportCarePlanningCarePlanActivityStatusSchema = z.enum(["notStarted", "scheduled", "inProgress", "onHold", "completed", "cancelled", "stopped", "unknown", "enteredInError"]);

export const HealthcareSupportCarePlanningCarePlanIntentSchema = z.enum(["proposal", "plan", "order", "option"]);

export const HealthcareSupportCarePlanningCareTeamParticipantSchema = z.object({
  role: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  member: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  onBehalfOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
});

export const HealthcareSupportCarePlanningCareTeamSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["proposed", "active", "suspended", "inactive", "enteredInError"]),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  name: z.string().optional(),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  participant: z.array(HealthcareSupportCarePlanningCareTeamParticipantSchema),
  reasonCode: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  reasonReference: z.array(HealthcareCoreReferenceSchema).optional(),
  managingOrganization: z.array(HealthcareCoreReferenceSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportCarePlanningCareTeamStatusSchema = z.enum(["proposed", "active", "suspended", "inactive", "enteredInError"]);

export const HealthcareSupportCarePlanningGoalTargetSchema = z.object({
  measure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  detailQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  detailRange: z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional(),
  detailCodeableConcept: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  detailString: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareSupportCarePlanningGoalSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  lifecycleStatus: z.enum(["proposed", "planned", "accepted", "active", "onHold", "completed", "cancelled", "enteredInError", "rejected"]),
  achievementStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  priority: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  description: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  target: z.array(HealthcareSupportCarePlanningGoalTargetSchema).optional(),
  statusDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  statusReason: z.string().optional(),
  expressedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  addresses: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportCarePlanningGoalLifecycleStatusSchema = z.enum(["proposed", "planned", "accepted", "active", "onHold", "completed", "cancelled", "enteredInError", "rejected"]);

export const HealthcareSupportClinicalOutcomesClinicalBenchmarkSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(250),
  procedureCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  metric: z.string().max(100),
  targetValue: z.number(),
  unit: z.string().max(50).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  source: z.string().max(200).optional(),
  status: z.enum(["draft", "active", "retired", "unknown"])
});

export const HealthcareSupportClinicalOutcomesComplicationSeveritySchema = z.enum(["mild", "moderate", "severe"]);

export const HealthcareSupportClinicalOutcomesOutcomeRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  procedure: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  procedureCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  outcomeDate: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["successful", "partialSuccess", "failure", "complication", "unknown"]),
  followUpInterval: z.number().int().gte(0).optional(),
  complicationCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  complicationSeverity: z.enum(["mild", "moderate", "severe"]).optional(),
  readmission: z.boolean().optional(),
  readmissionReason: z.string().max(500).optional(),
  patientSatisfactionScore: z.number().int().gte(0).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportClinicalOutcomesOutcomeReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  procedureCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  totalCases: z.number().int().gte(0),
  successRate: z.number().gte(0).lte(1),
  complicationRate: z.number().gte(0).lte(1),
  readmissionRate: z.number().gte(0).lte(1).optional(),
  averageSatisfaction: z.number().optional(),
  benchmarkComparison: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareSupportClinicalOutcomesOutcomeStatusSchema = z.enum(["successful", "partialSuccess", "failure", "complication", "unknown"]);

export const HealthcareSupportConsentManagementConsentPolicySchema = z.object({
  authority: z.string().optional(),
  uri: z.string().optional()
});

export const HealthcareSupportConsentManagementConsentVerificationSchema = z.object({
  verified: z.boolean(),
  verifiedWith: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  verificationDate: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareSupportConsentManagementConsentProvisionActorSchema = z.object({
  role: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  reference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareSupportConsentManagementConsentProvisionDataSchema = z.object({
  meaning: z.enum(["instance", "related", "dependents", "authoredby"]),
  reference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareSupportConsentManagementConsentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["draft", "proposed", "active", "rejected", "inactive", "enteredInError"]),
  scope: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  category: z.array(HealthcareCoreCodeableConceptSchema),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  dateTime: z.string().datetime().transform((str) => new Date(str)),
  performer: z.array(HealthcareCoreReferenceSchema).optional(),
  organization: z.array(HealthcareCoreReferenceSchema).optional(),
  sourceAttachment: z.object({
  contentType: z.string().optional(),
  language: z.string().optional(),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  title: z.string().optional(),
  size: z.number().int().gte(0).optional(),
  hash: z.string().optional(),
  creation: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  sourceReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  policy: z.array(HealthcareSupportConsentManagementConsentPolicySchema).optional(),
  policyRule: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  verification: z.array(HealthcareSupportConsentManagementConsentVerificationSchema).optional(),
  provision: z.object({
  type: z.enum(["deny", "permit"]).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  actor: z.array(HealthcareSupportConsentManagementConsentProvisionActorSchema).optional(),
  action: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  securityLabel: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  purpose: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  class: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  code: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  dataPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  data: z.array(HealthcareSupportConsentManagementConsentProvisionDataSchema).optional()
}).optional()
});

export const HealthcareSupportConsentManagementConsentDataMeaningSchema = z.enum(["instance", "related", "dependents", "authoredby"]);

export const HealthcareSupportConsentManagementConsentProvisionSchema = z.object({
  type: z.enum(["deny", "permit"]).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  actor: z.array(HealthcareSupportConsentManagementConsentProvisionActorSchema).optional(),
  action: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  securityLabel: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  purpose: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  class: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  code: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  dataPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  data: z.array(HealthcareSupportConsentManagementConsentProvisionDataSchema).optional()
});

export const HealthcareSupportConsentManagementConsentProvisionTypeSchema = z.enum(["deny", "permit"]);

export const HealthcareSupportDataImportFieldMappingSchema = z.object({
  sourceField: z.string().max(200),
  targetField: z.string().max(200),
  required: z.boolean(),
  defaultValue: z.string().max(500).optional(),
  transformRule: z.string().max(100).optional()
});

export const HealthcareSupportDataImportImportFormatSchema = z.enum(["csv", "json", "ndjson", "hl7v2", "fhir", "xml"]);

export const HealthcareSupportDataImportImportJobSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(250),
  type: z.enum(["patient", "encounter", "observation", "medication", "claim", "custom"]),
  sourceFormat: z.enum(["csv", "json", "ndjson", "hl7v2", "fhir", "xml"]),
  status: z.enum(["created", "validating", "validated", "importing", "completed", "failed", "cancelled"]),
  uploadedFile: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  totalRecords: z.number().int().gte(0).optional(),
  processedRecords: z.number().int().gte(0).optional(),
  failedRecords: z.number().int().gte(0).optional(),
  startedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  requestedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  dryRun: z.boolean(),
  errorReport: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareSupportDataImportImportJobStatusSchema = z.enum(["created", "validating", "validated", "importing", "completed", "failed", "cancelled"]);

export const HealthcareSupportDataImportTransformRuleSchema = z.object({
  name: z.string().max(100),
  sourceField: z.string().max(200),
  rule: z.string().max(1000),
  parameters: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareSupportDataImportImportMappingSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string().max(250),
  sourceFormat: z.enum(["csv", "json", "ndjson", "hl7v2", "fhir", "xml"]),
  targetResourceType: z.string().max(100),
  fieldMappings: z.array(HealthcareSupportDataImportFieldMappingSchema),
  transformRules: z.array(HealthcareSupportDataImportTransformRuleSchema).optional(),
  status: z.enum(["draft", "active", "retired", "unknown"])
});

export const HealthcareSupportDataImportImportTypeSchema = z.enum(["patient", "encounter", "observation", "medication", "claim", "custom"]);

export const HealthcareSupportIncidentReportingIncidentReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  type: z.enum(["adverseEvent", "nearMiss", "medicationError", "fall", "infectionControl", "equipmentFailure", "securityBreach", "patientComplaint", "other"]),
  severity: z.enum(["minor", "moderate", "major", "sentinel"]),
  status: z.enum(["reported", "underReview", "investigating", "actionPlan", "resolved", "closed"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reportedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reportedAt: z.string().datetime().transform((str) => new Date(str)),
  description: z.string(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  witnesses: z.array(HealthcareCoreReferenceSchema).optional(),
  contributingFactors: z.array(z.string()).optional(),
  immediateActions: z.string().optional(),
  rootCauseAnalysis: z.string().optional(),
  correctiveActions: z.array(z.string()).optional(),
  preventiveActions: z.array(z.string()).optional(),
  followUpDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  followUpNotes: z.string().optional(),
  isReportableToAuthority: z.boolean().optional(),
  reportedToAuthority: z.boolean().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportIncidentReportingIncidentSeveritySchema = z.enum(["minor", "moderate", "major", "sentinel"]);

export const HealthcareSupportIncidentReportingIncidentStatusSchema = z.enum(["reported", "underReview", "investigating", "actionPlan", "resolved", "closed"]);

export const HealthcareSupportIncidentReportingIncidentTypeSchema = z.enum(["adverseEvent", "nearMiss", "medicationError", "fall", "infectionControl", "equipmentFailure", "securityBreach", "patientComplaint", "other"]);

export const HealthcareSupportIncidentReportingQualityMeasureSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  type: z.enum(["process", "outcome", "structure", "patientReported"]),
  status: z.enum(["active", "inactive", "draft"]),
  description: z.string(),
  rationale: z.string().optional(),
  numeratorDescription: z.string().optional(),
  denominatorDescription: z.string().optional(),
  measurePeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  score: z.number().optional(),
  target: z.number().optional(),
  improvementNotation: z.string().optional(),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportIncidentReportingQualityMeasureStatusSchema = z.enum(["active", "inactive", "draft"]);

export const HealthcareSupportIncidentReportingQualityMeasureTypeSchema = z.enum(["process", "outcome", "structure", "patientReported"]);

export const HealthcareSupportInfectionControlAntibioticSensitivitySchema = z.object({
  antibiotic: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  result: z.enum(["sensitive", "intermediate", "resistant", "notTested"]),
  mic: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  zone: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareSupportInfectionControlAntibiogramSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  organism: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  sampleSize: z.number().int().gte(1),
  sensitivities: z.array(HealthcareSupportInfectionControlAntibioticSensitivitySchema),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportInfectionControlIsolationPrecautionSchema = z.enum(["standard", "contact", "droplet", "airborne", "protectiveEnvironment"]);

export const HealthcareSupportInfectionControlInfectionSurveillanceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  infectionType: z.enum(["surgicalSiteInfection", "catheterAssociatedUTI", "centralLineAssociatedBSI", "ventilatorAssociatedPneumonia", "cDifficile", "mrsa", "vre", "multiDrugResistant", "other"]),
  organism: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  site: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  onsetDate: z.string().datetime().transform((str) => new Date(str)),
  cultureDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  cultureResult: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  isolationPrecautions: z.array(HealthcareSupportInfectionControlIsolationPrecautionSchema).optional(),
  isNotifiable: z.boolean(),
  reportedToPublicHealth: z.boolean().optional(),
  reportedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  relatedProcedure: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  relatedDevice: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  outcome: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportInfectionControlInfectionTypeSchema = z.enum(["surgicalSiteInfection", "catheterAssociatedUTI", "centralLineAssociatedBSI", "ventilatorAssociatedPneumonia", "cDifficile", "mrsa", "vre", "multiDrugResistant", "other"]);

export const HealthcareSupportInfectionControlSensitivityResultSchema = z.enum(["sensitive", "intermediate", "resistant", "notTested"]);

export const HealthcareSupportMandatoryReportingMandatoryReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reportType: z.enum(["childAbuse", "elderAbuse", "domesticViolence", "gunShotWound", "stabWound", "communicableDisease", "sexualAssault", "suspectedDeath", "occupationalInjury", "adverseDrugReaction", "deviceMalfunction", "birthCertificate", "deathCertificate", "fetalDeath", "cancerDiagnosis", "traumaCase", "poisoning", "dogBite", "other"]),
  reportedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reportedAt: z.string().datetime().transform((str) => new Date(str)),
  recipientAgency: z.string(),
  status: z.enum(["drafted", "submitted", "acknowledged", "followUpRequested", "closed"]),
  submissionMethod: z.enum(["electronic", "phone", "fax", "inPerson"]),
  submissionReference: z.string().optional(),
  description: z.string(),
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  acknowledgedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.string().optional()
});

export const HealthcareSupportMandatoryReportingMandatoryReportTypeSchema = z.enum(["childAbuse", "elderAbuse", "domesticViolence", "gunShotWound", "stabWound", "communicableDisease", "sexualAssault", "suspectedDeath", "occupationalInjury", "adverseDrugReaction", "deviceMalfunction", "birthCertificate", "deathCertificate", "fetalDeath", "cancerDiagnosis", "traumaCase", "poisoning", "dogBite", "other"]);

export const HealthcareSupportMandatoryReportingReportStatusSchema = z.enum(["drafted", "submitted", "acknowledged", "followUpRequested", "closed"]);

export const HealthcareSupportMandatoryReportingSubmissionMethodSchema = z.enum(["electronic", "phone", "fax", "inPerson"]);

export const HealthcareSupportProvenanceProvenanceActivityTypeSchema = z.enum(["create", "update", "delete", "access", "transmit", "verify", "sign", "amend", "merge", "deidentify", "reidentify"]);

export const HealthcareSupportProvenanceProvenanceAgentSchema = z.object({
  role: z.enum(["author", "performer", "verifier", "approver", "custodian", "assembler", "informant", "onBehalfOf"]),
  who: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  onBehalfOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareSupportProvenanceProvenanceAgentRoleSchema = z.enum(["author", "performer", "verifier", "approver", "custodian", "assembler", "informant", "onBehalfOf"]);

export const HealthcareSupportProvenanceProvenanceEntitySchema = z.object({
  role: z.enum(["derivation", "revision", "quotation", "source", "removal"]),
  what: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareSupportProvenanceProvenanceEntityRoleSchema = z.enum(["derivation", "revision", "quotation", "source", "removal"]);

export const HealthcareSupportProvenanceProvenanceRecordSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  target: z.array(HealthcareCoreReferenceSchema),
  occurredDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  occurredPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  recorded: z.string().datetime().transform((str) => new Date(str)),
  policy: z.array(z.string()).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reason: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  activity: z.enum(["create", "update", "delete", "access", "transmit", "verify", "sign", "amend", "merge", "deidentify", "reidentify"]).optional(),
  agent: z.array(HealthcareSupportProvenanceProvenanceAgentSchema),
  entity: z.array(HealthcareSupportProvenanceProvenanceEntitySchema).optional(),
  signature: z.array(HealthcareCoreReferenceSchema).optional(),
  purposeOfUse: z.array(HealthcareCorePurposeOfUseSchema).optional(),
  confidentiality: z.enum(["U", "L", "M", "N", "R", "V"]).optional()
});

export const HealthcareSupportProxyAccessProxyAccessGrantSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  proxy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  relationship: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  scope: z.enum(["full", "limited", "emergencyOnly", "readOnly"]),
  status: z.enum(["pending", "active", "suspended", "expired", "revoked"]),
  grantedAt: z.string().datetime().transform((str) => new Date(str)),
  grantedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  revokedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  revokedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  revokedReason: z.string().optional(),
  excludedCategories: z.array(HealthcareCoreSensitiveDataCategorySchema).optional(),
  adolescentAge: z.number().int().optional(),
  consentReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.string().optional()
});

export const HealthcareSupportProxyAccessProxyAccessScopeSchema = z.enum(["full", "limited", "emergencyOnly", "readOnly"]);

export const HealthcareSupportProxyAccessProxyAccessStatusSchema = z.enum(["pending", "active", "suspended", "expired", "revoked"]);

export const HealthcareSupportPublicHealthCancerRegistryCancerAbstractSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  registryCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  abstractor: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  abstractedDate: z.string().datetime().transform((str) => new Date(str)),
  treatmentSummary: z.string().optional(),
  firstCourseChemo: z.boolean().optional(),
  firstCourseRadiation: z.boolean().optional(),
  firstCourseSurgery: z.boolean().optional(),
  firstCourseHormone: z.boolean().optional(),
  firstCourseImmuno: z.boolean().optional(),
  followUpStatus: z.string().optional(),
  vitalStatus: z.string().optional(),
  lastContactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareSupportPublicHealthCancerRegistryCancerCaseStatusSchema = z.enum(["abstracted", "submitted", "acknowledged", "qualityReview"]);

export const HealthcareSupportPublicHealthCancerRegistryCancerRegistryCaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  primarySite: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  histology: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  behavior: z.enum(["benign", "uncertain", "inSitu", "malignant"]),
  grade: z.string().optional(),
  stage: z.object({
  clinicalT: z.string().optional(),
  clinicalN: z.string().optional(),
  clinicalM: z.string().optional(),
  pathologicT: z.string().optional(),
  pathologicN: z.string().optional(),
  pathologicM: z.string().optional(),
  stageGroup: z.string().optional(),
  stagingSystem: z.enum(["ajcc8th", "ajcc7th"])
}).optional(),
  diagnosisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  reportingPathologist: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reportedToRegistry: z.boolean().optional(),
  registrySubmissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  registryType: z.enum(["state", "seer", "npcr"]),
  accessionNumber: z.string().optional(),
  status: z.enum(["abstracted", "submitted", "acknowledged", "qualityReview"])
});

export const HealthcareSupportPublicHealthCancerRegistryRegistryTypeSchema = z.enum(["state", "seer", "npcr"]);

export const HealthcareSupportPublicHealthCancerRegistryTNMStageDataSchema = z.object({
  clinicalT: z.string().optional(),
  clinicalN: z.string().optional(),
  clinicalM: z.string().optional(),
  pathologicT: z.string().optional(),
  pathologicN: z.string().optional(),
  pathologicM: z.string().optional(),
  stageGroup: z.string().optional(),
  stagingSystem: z.enum(["ajcc8th", "ajcc7th"])
});

export const HealthcareSupportPublicHealthCancerRegistryTNMStagingSystemSchema = z.enum(["ajcc8th", "ajcc7th"]);

export const HealthcareSupportPublicHealthCancerRegistryTumourBehaviourSchema = z.enum(["benign", "uncertain", "inSitu", "malignant"]);

export const HealthcareSupportPublicHealthECRECRStatusSchema = z.enum(["triggered", "generated", "submitted", "acknowledged", "notReportable"]);

export const HealthcareSupportPublicHealthECRECRTriggerTypeSchema = z.enum(["diagnosis", "labResult", "medication", "procedure"]);

export const HealthcareSupportPublicHealthECRElectronicCaseReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reportingFacility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  triggeredBy: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  triggerType: z.enum(["diagnosis", "labResult", "medication", "procedure"]),
  condition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  reportableIndicator: z.boolean(),
  reportingJurisdiction: z.string(),
  status: z.enum(["triggered", "generated", "submitted", "acknowledged", "notReportable"]),
  generatedAt: z.string().datetime().transform((str) => new Date(str)),
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  submittedTo: z.string().optional(),
  reportabilityResponse: z.object({
  determination: z.enum(["reportable", "mayBeReportable", "noRuleTriggered", "notReportable"]),
  condition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  jurisdiction: z.string(),
  receivedAt: z.string().datetime().transform((str) => new Date(str))
}).optional(),
  note: z.string().optional()
});

export const HealthcareSupportPublicHealthECRReportabilityDeterminationSchema = z.enum(["reportable", "mayBeReportable", "noRuleTriggered", "notReportable"]);

export const HealthcareSupportPublicHealthECRReportabilityResponseSchema = z.object({
  determination: z.enum(["reportable", "mayBeReportable", "noRuleTriggered", "notReportable"]),
  condition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  jurisdiction: z.string(),
  receivedAt: z.string().datetime().transform((str) => new Date(str))
});

export const HealthcareSupportPublicHealthImmunizationRegistryIISQuerySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  queryDate: z.string().datetime().transform((str) => new Date(str)),
  queriedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  registryQueried: z.string(),
  status: z.enum(["submitted", "responseReceived", "noRecordFound", "error"]),
  immunizationsReturned: z.number().int().optional(),
  note: z.string().optional()
});

export const HealthcareSupportPublicHealthImmunizationRegistryIISQueryStatusSchema = z.enum(["submitted", "responseReceived", "noRecordFound", "error"]);

export const HealthcareSupportPublicHealthImmunizationRegistryIISStatusSchema = z.enum(["pending", "submitted", "accepted", "rejected", "duplicate"]);

export const HealthcareSupportPublicHealthImmunizationRegistryIISSubmissionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  immunization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  submittingFacility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  submittedAt: z.string().datetime().transform((str) => new Date(str)),
  status: z.enum(["pending", "submitted", "accepted", "rejected", "duplicate"]),
  responseMessage: z.string().optional(),
  registryId: z.string().optional(),
  hl7MessageId: z.string().optional()
});

export const HealthcareSupportPublicHealthSurveillanceELRResultInterpretationSchema = z.enum(["positive", "negative", "indeterminate"]);

export const HealthcareSupportPublicHealthSurveillanceElectronicLabReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  performingLab: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reportedCondition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  specimenCollectedDate: z.string().datetime().transform((str) => new Date(str)),
  resultDate: z.string().datetime().transform((str) => new Date(str)),
  testCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  result: z.string(),
  resultInterpretation: z.enum(["positive", "negative", "indeterminate"]),
  organism: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reportableToJurisdiction: z.string(),
  status: z.enum(["generated", "submitted", "acknowledged"])
});

export const HealthcareSupportPublicHealthSurveillanceInjuryIntentSchema = z.enum(["unintentional", "assault", "selfHarm", "undetermined", "legalIntervention"]);

export const HealthcareSupportPublicHealthSurveillanceSurveillanceStatusSchema = z.enum(["generated", "submitted", "acknowledged"]);

export const HealthcareSupportPublicHealthSurveillanceSyndromeCategorySchema = z.enum(["influenzaLikeIllness", "gi", "rash", "respiratory", "neurological", "hemorrhagic", "botulismLike", "other"]);

export const HealthcareSupportPublicHealthSurveillanceSyndromicSurveillanceReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reportDate: z.string().datetime().transform((str) => new Date(str)),
  edVisit: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  chiefComplaint: z.string(),
  syndromeCategory: z.enum(["influenzaLikeIllness", "gi", "rash", "respiratory", "neurological", "hemorrhagic", "botulismLike", "other"]),
  triage: z.object({
  acuityLevel: z.number().int(),
  temperature: z.number().optional(),
  chiefComplaintCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
}).optional(),
  disposition: z.string().optional(),
  status: z.enum(["generated", "submitted", "acknowledged"])
});

export const HealthcareSupportPublicHealthSurveillanceTraumaCaseStatusSchema = z.enum(["open", "abstracted", "submitted", "qualityReview"]);

export const HealthcareSupportPublicHealthSurveillanceTraumaOutcomeSchema = z.enum(["survived", "expired"]);

export const HealthcareSupportPublicHealthSurveillanceTraumaRegistryCaseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  injuryDate: z.string().datetime().transform((str) => new Date(str)),
  injuryMechanism: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  injuryIntent: z.enum(["unintentional", "assault", "selfHarm", "undetermined", "legalIntervention"]),
  injurySeverityScore: z.number().int().optional(),
  glasgowComaScore: z.number().int().optional(),
  revisedTraumaScore: z.number().optional(),
  edDisposition: z.string().optional(),
  icuAdmission: z.boolean().optional(),
  ventilatorDays: z.number().int().optional(),
  hospitalLOS: z.number().int().optional(),
  outcome: z.enum(["survived", "expired"]),
  status: z.enum(["open", "abstracted", "submitted", "qualityReview"])
});

export const HealthcareSupportPublicHealthSurveillanceTriageDataSchema = z.object({
  acuityLevel: z.number().int(),
  temperature: z.number().optional(),
  chiefComplaintCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareSupportPublicHealthVitalRecordsApgarScoresDataSchema = z.object({
  oneMinute: z.number().int(),
  fiveMinute: z.number().int(),
  tenMinute: z.number().int().optional()
});

export const HealthcareSupportPublicHealthVitalRecordsBirthCertificateDataSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  newborn: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  mother: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  father: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  facilityOfBirth: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  birthDateTime: z.string().datetime().transform((str) => new Date(str)),
  attendingProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  birthWeight: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  gestationalAge: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  deliveryMethod: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  plurality: z.number().int().optional(),
  birthOrder: z.number().int().optional(),
  apgarScores: z.object({
  oneMinute: z.number().int(),
  fiveMinute: z.number().int(),
  tenMinute: z.number().int().optional()
}).optional(),
  complications: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  status: z.enum(["draft", "submitted", "registered", "amended"])
});

export const HealthcareSupportPublicHealthVitalRecordsCauseOfDeathChainSchema = z.object({
  cause: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  interval: z.string(),
  sequence: z.number().int()
});

export const HealthcareSupportPublicHealthVitalRecordsDeathCertificateDataSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  deceased: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  dateOfDeath: z.string().datetime().transform((str) => new Date(str)),
  placeOfDeath: z.string().optional(),
  mannerOfDeath: z.enum(["natural", "accident", "suicide", "homicide", "pending", "undetermined"]),
  causeOfDeath: z.array(HealthcareSupportPublicHealthVitalRecordsCauseOfDeathChainSchema),
  contributingConditions: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  autopsyPerformed: z.boolean().optional(),
  tobaccoContributed: z.string().optional(),
  pregnancyStatus: z.string().optional(),
  certifyingPhysician: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  pronouncedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  status: z.enum(["draft", "submitted", "registered", "amended"])
});

export const HealthcareSupportPublicHealthVitalRecordsFetalDeathReportSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  mother: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  facility: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  deliveryDate: z.string().datetime().transform((str) => new Date(str)),
  gestationalAge: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}),
  estimatedWeight: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  causeOfDeath: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  status: z.enum(["draft", "submitted", "registered"])
});

export const HealthcareSupportPublicHealthVitalRecordsFetalDeathReportStatusSchema = z.enum(["draft", "submitted", "registered"]);

export const HealthcareSupportPublicHealthVitalRecordsMannerOfDeathSchema = z.enum(["natural", "accident", "suicide", "homicide", "pending", "undetermined"]);

export const HealthcareSupportPublicHealthVitalRecordsVitalRecordStatusSchema = z.enum(["draft", "submitted", "registered", "amended"]);

export const HealthcareSupportQuestionnairesEnableBehaviorSchema = z.enum(["all", "any"]);

export const HealthcareSupportQuestionnairesEnableWhenOperatorSchema = z.enum(["exists", "equals", "notEquals", "greaterThan", "lessThan", "greaterOrEquals", "lessOrEquals"]);

export const HealthcareSupportQuestionnairesQuestionnaireAnswerOptionSchema = z.object({
  valueInteger: z.number().int().optional(),
  valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  valueString: z.string().optional(),
  valueCoding: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareSupportQuestionnairesQuestionnaireInitialValueSchema = z.object({
  valueBoolean: z.boolean().optional(),
  valueDecimal: z.number().optional(),
  valueInteger: z.number().int().optional(),
  valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  valueDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  valueString: z.string().optional(),
  valueCoding: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  valueReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareSupportQuestionnairesQuestionnaireEnableWhenSchema = z.object({
  question: z.string(),
  operator: z.enum(["exists", "equals", "notEquals", "greaterThan", "lessThan", "greaterOrEquals", "lessOrEquals"]),
  answerBoolean: z.boolean().optional(),
  answerDecimal: z.number().optional(),
  answerInteger: z.number().int().optional(),
  answerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  answerString: z.string().optional(),
  answerCoding: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareSupportQuestionnairesQuestionnaireItemSchema: z.ZodTypeAny = z.object({
  linkId: z.string(),
  definition: z.string().url().optional(),
  code: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  prefix: z.string().optional(),
  text: z.string(),
  type: z.enum(["group", "display", "boolean", "decimal", "integer", "date", "dateTime", "time", "string", "text", "url", "choice", "openChoice", "attachment", "reference", "quantity"]),
  required: z.boolean().optional(),
  repeats: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  maxLength: z.number().int().optional(),
  answerValueSet: z.string().optional(),
  answerOption: z.array(HealthcareSupportQuestionnairesQuestionnaireAnswerOptionSchema).optional(),
  initial: z.array(HealthcareSupportQuestionnairesQuestionnaireInitialValueSchema).optional(),
  enableWhen: z.array(HealthcareSupportQuestionnairesQuestionnaireEnableWhenSchema).optional(),
  enableBehavior: z.enum(["all", "any"]).optional(),
  item: z.array(z.lazy(() => HealthcareSupportQuestionnairesQuestionnaireItemSchema)).optional()
});

export const HealthcareSupportQuestionnairesQuestionnaireSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  url: z.string().url().optional(),
  name: z.string().optional(),
  title: z.string(),
  status: z.enum(["draft", "active", "retired", "enteredInError"]),
  description: z.string().optional(),
  purpose: z.string().optional(),
  subjectType: z.array(z.string()).optional(),
  code: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  item: z.array(z.lazy(() => HealthcareSupportQuestionnairesQuestionnaireItemSchema))
});

export const HealthcareSupportQuestionnairesQuestionnaireItemTypeSchema = z.enum(["group", "display", "boolean", "decimal", "integer", "date", "dateTime", "time", "string", "text", "url", "choice", "openChoice", "attachment", "reference", "quantity"]);

export const HealthcareSupportQuestionnairesQuestionnaireResponseAnswerSchema = z.object({
  valueBoolean: z.boolean().optional(),
  valueDecimal: z.number().optional(),
  valueInteger: z.number().int().optional(),
  valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  valueDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  valueString: z.string().optional(),
  valueCoding: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  valueReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  item: z.array(z.lazy(() => HealthcareSupportQuestionnairesQuestionnaireResponseItemSchema)).optional()
});

export const HealthcareSupportQuestionnairesQuestionnaireResponseItemSchema: z.ZodTypeAny = z.object({
  linkId: z.string(),
  definition: z.string().url().optional(),
  text: z.string().optional(),
  answer: z.array(HealthcareSupportQuestionnairesQuestionnaireResponseAnswerSchema).optional(),
  item: z.array(z.lazy(() => HealthcareSupportQuestionnairesQuestionnaireResponseItemSchema)).optional()
});

export const HealthcareSupportQuestionnairesQuestionnaireResponseSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  questionnaire: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["inProgress", "completed", "amended", "enteredInError", "stopped"]),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  authored: z.string().datetime().transform((str) => new Date(str)).optional(),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  source: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  item: z.array(z.lazy(() => HealthcareSupportQuestionnairesQuestionnaireResponseItemSchema)).optional()
});

export const HealthcareSupportQuestionnairesQuestionnaireResponseStatusSchema = z.enum(["inProgress", "completed", "amended", "enteredInError", "stopped"]);

export const HealthcareSupportQuestionnairesQuestionnaireStatusSchema = z.enum(["draft", "active", "retired", "enteredInError"]);

export const HealthcareSupportSDOHSDOHCategorySchema = z.enum(["housingInstability", "foodInsecurity", "transportationInsecurity", "utilityDifficulties", "interpersonalViolence", "education", "employment", "financialStrain", "veteranStatus", "socialIsolation", "stressAndMentalHealth"]);

export const HealthcareSupportSDOHSDOHGoalSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  lifecycleStatus: z.enum(["proposed", "planned", "accepted", "active", "onHold", "completed", "cancelled", "enteredInError", "rejected"]),
  category: z.enum(["housingInstability", "foodInsecurity", "transportationInsecurity", "utilityDifficulties", "interpersonalViolence", "education", "employment", "financialStrain", "veteranStatus", "socialIsolation", "stressAndMentalHealth"]),
  description: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  subject: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  target: z.object({
  measure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  detailString: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
}).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportSDOHSDOHGoalLifecycleStatusSchema = z.enum(["proposed", "planned", "accepted", "active", "onHold", "completed", "cancelled", "enteredInError", "rejected"]);

export const HealthcareSupportSDOHSDOHGoalTargetSchema = z.object({
  measure: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  detailString: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareSupportSDOHSDOHReferralSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["draft", "active", "onHold", "completed", "cancelled", "enteredInError"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  screening: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  category: z.enum(["housingInstability", "foodInsecurity", "transportationInsecurity", "utilityDifficulties", "interpersonalViolence", "education", "employment", "financialStrain", "veteranStatus", "socialIsolation", "stressAndMentalHealth"]),
  serviceType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  recipient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  requester: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  authoredOn: z.string().datetime().transform((str) => new Date(str)),
  description: z.string().optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  outcome: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  outcomeNote: z.string().optional()
});

export const HealthcareSupportSDOHSDOHReferralStatusSchema = z.enum(["draft", "active", "onHold", "completed", "cancelled", "enteredInError"]);

export const HealthcareSupportSDOHSDOHRiskLevelSchema = z.enum(["noRisk", "low", "medium", "high"]);

export const HealthcareSupportSDOHSDOHScreeningResponseSchema = z.object({
  question: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  answer: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  score: z.number().int().optional(),
  category: z.enum(["housingInstability", "foodInsecurity", "transportationInsecurity", "utilityDifficulties", "interpersonalViolence", "education", "employment", "financialStrain", "veteranStatus", "socialIsolation", "stressAndMentalHealth"]).optional()
});

export const HealthcareSupportSDOHSDOHScreeningSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["planned", "inProgress", "completed", "cancelled", "enteredInError"]),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performer: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  date: z.string().datetime().transform((str) => new Date(str)),
  instrument: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  category: z.array(HealthcareSupportSDOHSDOHCategorySchema),
  responses: z.array(HealthcareSupportSDOHSDOHScreeningResponseSchema),
  riskLevel: z.enum(["noRisk", "low", "medium", "high"]).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportSDOHSDOHScreeningStatusSchema = z.enum(["planned", "inProgress", "completed", "cancelled", "enteredInError"]);

export const HealthcareSupportSignaturesSignatureTypeSchema = z.enum(["1.2.840.10065.1.12.1.1", "1.2.840.10065.1.12.1.2", "1.2.840.10065.1.12.1.3", "1.2.840.10065.1.12.1.4", "1.2.840.10065.1.12.1.5", "1.2.840.10065.1.12.1.6", "1.2.840.10065.1.12.1.7", "1.2.840.10065.1.12.1.8", "1.2.840.10065.1.12.1.9", "1.2.840.10065.1.12.1.10", "1.2.840.10065.1.12.1.14", "1.2.840.10065.1.12.1.15", "1.2.840.10065.1.12.1.16"]);

export const HealthcareSupportSignaturesElectronicSignatureSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  type: z.array(HealthcareSupportSignaturesSignatureTypeSchema),
  when: z.string().datetime().transform((str) => new Date(str)),
  who: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  onBehalfOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  targetFormat: z.string().optional(),
  sigFormat: z.string().optional(),
  data: z.string().optional(),
  target: z.array(HealthcareCoreReferenceSchema),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  verified: z.boolean().optional(),
  verifiedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  verifiedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HealthcareSupportTasksTaskParameterSchema = z.object({
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().int().optional(),
  valueReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  valueCodeableConcept: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  valueQuantity: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
});

export const HealthcareSupportTasksTaskSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["draft", "requested", "received", "accepted", "rejected", "ready", "cancelled", "inProgress", "onHold", "failed", "completed", "enteredInError"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  businessStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  intent: z.enum(["proposal", "plan", "order", "originalOrder", "reflexOrder", "fillerOrder", "instanceOrder", "option"]),
  priority: z.enum(["routine", "urgent", "asap", "stat"]).optional(),
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  description: z.string().optional(),
  focus: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  for: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  executionPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  authoredOn: z.string().datetime().transform((str) => new Date(str)).optional(),
  lastModified: z.string().datetime().transform((str) => new Date(str)).optional(),
  requester: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  performerType: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  owner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  reasonCode: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  reasonReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  insurance: z.array(HealthcareCoreReferenceSchema).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  restriction: z.object({
  repetitions: z.number().int().optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  recipient: z.array(HealthcareCoreReferenceSchema).optional()
}).optional(),
  input: z.array(HealthcareSupportTasksTaskParameterSchema).optional(),
  output: z.array(HealthcareSupportTasksTaskParameterSchema).optional()
});

export const HealthcareSupportTasksTaskRestrictionSchema = z.object({
  repetitions: z.number().int().optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  recipient: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareSupportTelehealthAlertThresholdSchema = z.object({
  parameter: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  operator: z.string().max(10),
  value: z.number(),
  severity: z.string().max(50)
});

export const HealthcareSupportTelehealthAsyncConsultationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  requestingProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  respondingProvider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  status: z.enum(["submitted", "inReview", "responded", "escalatedToSync", "closed"]),
  chiefComplaint: z.string().max(500),
  clinicalHistory: z.string().max(5000).optional(),
  attachments: z.array(HealthcareCoreReferenceSchema).optional(),
  response: z.string().max(5000).optional(),
  respondedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  escalationReason: z.string().max(500).optional()
});

export const HealthcareSupportTelehealthAsyncStatusSchema = z.enum(["submitted", "inReview", "responded", "escalatedToSync", "closed"]);

export const HealthcareSupportTelehealthEnrollmentStatusSchema = z.enum(["active", "paused", "completed", "withdrawn"]);

export const HealthcareSupportTelehealthMonitoringParameterSchema = z.object({
  code: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  frequency: z.string().max(100),
  targetRange: z.object({
  low: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional(),
  high: z.object({
  value: z.number(),
  unit: z.string(),
  system: z.string().url().optional(),
  code: z.string().optional()
}).optional()
}).optional()
});

export const HealthcareSupportTelehealthRemoteMonitoringEnrollmentSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  condition: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  devices: z.array(HealthcareCoreReferenceSchema),
  monitoringParameters: z.array(HealthcareSupportTelehealthMonitoringParameterSchema),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  status: z.enum(["active", "paused", "completed", "withdrawn"]),
  alertThresholds: z.array(HealthcareSupportTelehealthAlertThresholdSchema).optional()
});

export const HealthcareSupportTelehealthTelehealthSessionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  startedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  endedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["scheduled", "waiting", "inProgress", "completed", "cancelled", "noShow", "technicalFailure"]),
  sessionType: z.enum(["synchronousVideo", "synchronousAudio", "asynchronous", "remoteMonitoring"]),
  platform: z.string().max(100).optional(),
  meetingUrl: z.string().max(2048).optional(),
  consentObtained: z.boolean(),
  technicalIssues: z.string().max(500).optional(),
  note: z.array(HealthcareCoreAnnotationSchema).optional()
});

export const HealthcareSupportTelehealthTelehealthSessionTypeSchema = z.enum(["synchronousVideo", "synchronousAudio", "asynchronous", "remoteMonitoring"]);

export const HealthcareSupportTelehealthTelehealthStatusSchema = z.enum(["scheduled", "waiting", "inProgress", "completed", "cancelled", "noShow", "technicalFailure"]);

export const HealthcareSupportWorkflowAutomationExecutionStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);

export const HealthcareSupportWorkflowAutomationQueueItemStatusSchema = z.enum(["waiting", "claimed", "inProgress", "completed", "returned"]);

export const HealthcareSupportWorkflowAutomationTaskQueueSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  description: z.string().optional(),
  assignedRole: z.string().optional(),
  department: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  maxItems: z.number().int().optional(),
  active: z.boolean()
});

export const HealthcareSupportWorkflowAutomationTaskQueueItemSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  queue: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  task: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  position: z.number().int(),
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  claimedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["waiting", "claimed", "inProgress", "completed", "returned"])
});

export const HealthcareSupportWorkflowAutomationWorkflowActionSchema = z.object({
  type: z.enum(["createTask", "sendNotification", "sendEmail", "updateField", "callWebhook", "createAuditEvent", "assignToQueue"]),
  configuration: z.record(z.string(), z.unknown()),
  delayMinutes: z.number().int().optional()
});

export const HealthcareSupportWorkflowAutomationWorkflowActionTypeSchema = z.enum(["createTask", "sendNotification", "sendEmail", "updateField", "callWebhook", "createAuditEvent", "assignToQueue"]);

export const HealthcareSupportWorkflowAutomationWorkflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains", "in", "exists"]),
  value: z.string()
});

export const HealthcareSupportWorkflowAutomationWorkflowConditionOperatorSchema = z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains", "in", "exists"]);

export const HealthcareSupportWorkflowAutomationWorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  rule: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  triggerEventId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "skipped"]),
  startedAt: z.string().datetime().transform((str) => new Date(str)),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  actionsExecuted: z.number().int(),
  actionsFailed: z.number().int(),
  error: z.string().optional(),
  chainDepth: z.number().int()
});

export const HealthcareSupportWorkflowAutomationWorkflowRuleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  name: z.string(),
  description: z.string().optional(),
  triggerEvent: z.string(),
  conditions: z.array(HealthcareSupportWorkflowAutomationWorkflowConditionSchema),
  actions: z.array(HealthcareSupportWorkflowAutomationWorkflowActionSchema),
  enabled: z.boolean(),
  priority: z.number().int(),
  maxChainDepth: z.number().int().optional(),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional()
});

export const HoldResponseSchema = z.object({
  holdId: UUIDSchema,
  sessionToken: z.string(),
  providerId: UUIDSchema,
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  expiresAt: z.string().datetime().transform((str) => new Date(str))
});

export const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional()
});

export const IceServersResponseSchema = z.object({
  iceServers: z.array(IceServerSchema)
});

export const ImportPMDRequestSchema = z.object({
  patientId: UUIDSchema,
  sourceFacility: z.string(),
  sourceReference: z.string().optional(),
  sourceDescription: z.string().max(200),
  content: z.string(),
  checksum: z.string().optional()
});

export const ImportedPMDSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  patientId: UUIDSchema,
  sourceFacility: z.string(),
  sourceReference: z.string().optional(),
  sourceDescription: z.string().max(200),
  content: z.string(),
  importedAt: z.string().datetime().transform((str) => new Date(str)),
  safetyFloorMerged: z.boolean()
});

export const InformedRefusalSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  refusingMemberId: z.string().uuid(),
  procedureDescription: z.string(),
  refusalReason: z.string(),
  patientAcknowledgement: z.string(),
  refusedAt: z.string().datetime().transform((str) => new Date(str))
});

export const InsuranceClaimStatusSchema = z.enum(["draft", "ready", "submitted", "under_review", "approved", "partially_paid", "paid", "denied", "appealed", "written_off"]);

export const InsuranceClaimSchema = z.object({
  id: UUIDSchema,
  patientId: UUIDSchema,
  insuranceProfileId: UUIDSchema,
  branchId: UUIDSchema,
  invoiceId: UUIDSchema.optional(),
  visitId: UUIDSchema.optional(),
  authorizationId: UUIDSchema.optional(),
  claimNumber: z.string(),
  payerReference: z.string().optional(),
  status: InsuranceClaimStatusSchema,
  submissionChannel: SubmissionChannelSchema.optional(),
  billedAmountCents: z.number().int(),
  approvedAmountCents: z.number().int().optional(),
  paidByPayerCents: z.number().int(),
  disallowedCents: z.number().int().optional(),
  patientPortionCents: z.number().int(),
  denialReason: z.string().optional(),
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  decisionAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  paidAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const InsuranceClaimLineSchema = z.object({
  id: UUIDSchema,
  claimId: UUIDSchema,
  treatmentId: UUIDSchema.optional(),
  invoiceLineItemId: UUIDSchema.optional(),
  cdtCode: z.string(),
  description: z.string(),
  billedAmountCents: z.number().int(),
  approvedAmountCents: z.number().int().optional(),
  paidAmountCents: z.number().int(),
  status: ClaimLineStatusSchema
});

export const InsuranceClaimListSchema = z.object({
  items: z.array(InsuranceClaimSchema),
  total: z.number().int()
});

export const InsuranceClaimWithLinesSchema = z.object({
  id: UUIDSchema,
  patientId: UUIDSchema,
  insuranceProfileId: UUIDSchema,
  branchId: UUIDSchema,
  invoiceId: UUIDSchema.optional(),
  visitId: UUIDSchema.optional(),
  authorizationId: UUIDSchema.optional(),
  claimNumber: z.string(),
  payerReference: z.string().optional(),
  status: InsuranceClaimStatusSchema,
  submissionChannel: SubmissionChannelSchema.optional(),
  billedAmountCents: z.number().int(),
  approvedAmountCents: z.number().int().optional(),
  paidByPayerCents: z.number().int(),
  disallowedCents: z.number().int().optional(),
  patientPortionCents: z.number().int(),
  denialReason: z.string().optional(),
  submittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  decisionAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  paidAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  lines: z.array(InsuranceClaimLineSchema)
});

export const InternalServerErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional(),
  trackingId: z.string().optional(),
  reported: z.boolean().optional()
});

export const MerchantAccountSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  person: z.union([z.string(), PersonSchema]),
  active: z.boolean(),
  metadata: z.record(z.string(), z.unknown())
});

export const InvoiceLineItemSchema = z.object({
  description: z.string().max(500),
  quantity: z.number().int().gte(1),
  unitPrice: z.number().int().gte(0),
  amount: z.number().int().gte(0),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  invoiceNumber: z.string().max(50),
  customer: z.union([z.string(), PersonSchema]),
  merchant: z.union([z.string(), PersonSchema]),
  merchantAccount: z.union([z.string(), MerchantAccountSchema]).optional(),
  context: z.string().max(255).optional(),
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]),
  subtotal: z.number().int().gte(0),
  tax: z.number().int().gte(0).optional(),
  total: z.number().int().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paymentCaptureMethod: z.enum(["automatic", "manual"]),
  issuedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  paymentDueAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  lineItems: z.array(InvoiceLineItemSchema),
  paymentStatus: z.enum(["pending", "requires_capture", "processing", "succeeded", "failed", "canceled"]).optional(),
  paidAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  paidBy: z.string().uuid().optional(),
  voidedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  voidedBy: z.string().uuid().optional(),
  voidThresholdMinutes: z.number().int().optional(),
  authorizedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  authorizedBy: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const InvoiceStatusSchema = z.enum(["draft", "open", "paid", "void", "uncollectible"]);

export const JoinVideoCallRequestSchema = z.object({
  displayName: z.string().max(100),
  audioEnabled: z.boolean(),
  videoEnabled: z.boolean()
});

export const LabOrderStatusSchema = z.enum(["ordered", "in_fabrication", "delivered", "fitted", "cancelled"]);

export const LabOrderSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  toothFdi: z.string().optional(),
  labName: z.string(),
  description: z.string(),
  shade: z.string().optional(),
  material: z.string().optional(),
  dueDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: LabOrderStatusSchema,
  orderedAt: z.string().datetime().transform((str) => new Date(str)),
  expectedDeliveryDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  deliveredAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  fittedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  cancelledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  cancelReason: z.string().optional(),
  isDefective: z.boolean(),
  replacedByOrderId: UUIDSchema.optional()
});

export const LeaveVideoCallResponseSchema = z.object({
  message: z.string(),
  callStillActive: z.boolean(),
  remainingParticipants: z.number().int()
});

export const TreatmentTemplateSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  branchId: UUIDSchema,
  name: z.string(),
  description: z.string().optional(),
  items: z.array(TemplateTreatmentItemSchema),
  active: z.boolean()
});

export const ListTreatmentTemplatesResponseSchema = z.object({
  templates: z.array(TreatmentTemplateSchema)
});

export const LocationHoursSchema = z.object({
  daysOfWeek: z.array(z.string()).optional(),
  allDay: z.boolean().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional()
});

export const LocationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  status: z.enum(["active", "suspended", "inactive"]),
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  description: z.string().optional(),
  mode: z.enum(["instance", "kind"]),
  type: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  address: z.object({
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
}).optional()
}).optional(),
  physicalType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  position: z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
}).optional(),
  managingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  partOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  hoursOfOperation: z.array(LocationHoursSchema).optional()
});

export const LocationModeSchema = z.enum(["instance", "kind"]);

export const LocationStatusSchema = z.enum(["active", "suspended", "inactive"]);

export const MaybeStoredFileSchema = z.object({
  file: z.string().uuid().optional(),
  url: z.string().url()
});

export const MaybeStoredFileUpdateSchema = z.object({
  file: z.union([z.string().uuid(), z.null()]).optional(),
  url: z.string().url().optional()
});

export const MedicalHistoryEntrySchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  patientId: UUIDSchema,
  entryType: MedicalHistoryEntryTypeSchema,
  codeSystem: z.string().optional(),
  code: z.string().optional(),
  displayName: z.string(),
  notes: z.string().optional(),
  onsetDate: z.string().optional(),
  resolvedDate: z.string().optional(),
  active: z.boolean()
});

export const MedicalHistoryReviewSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  patientId: UUIDSchema,
  asaClassification: z.enum(["I", "II", "III", "IV", "V", "VI"]).optional(),
  asaEmergency: z.boolean(),
  reviewedAt: z.string().datetime().transform((str) => new Date(str))
});

export const MergeImportedPMDSafetyFloorResultSchema = z.object({
  importedPmdId: UUIDSchema,
  safetyFloorMerged: z.boolean(),
  mergedEntryCount: z.number().int(),
  mergedAt: z.string().datetime().transform((str) => new Date(str))
});

export const MessageTypeSchema = z.enum(["text", "system", "video_call"]);

export const MultipartPartSchema = z.object({
  partNumber: z.number().int().gte(1),
  etag: z.string()
});

export const MultipartCompleteRequestSchema = z.object({
  parts: z.array(MultipartPartSchema)
});

export const MultipartInitiateRequestSchema = z.object({
  filename: z.string().max(255),
  mimeType: z.string().max(100),
  size: z.number().int().gte(1)
});

export const MultipartInitiateResponseSchema = z.object({
  fileId: z.string().uuid(),
  uploadId: z.string()
});

export const MultipartPartUrlResponseSchema = z.object({
  partUrl: z.string().url(),
  partNumber: z.number().int()
});

export const NotFoundErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional(),
  resourceType: z.string().optional(),
  resource: z.string().optional(),
  suggestions: z.array(z.string()).optional()
});

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  recipient: z.string().uuid(),
  type: z.enum(["billing", "security", "system", "booking.created", "booking.confirmed", "booking.rejected", "booking.cancelled", "booking.no-show-client", "booking.no-show-host", "comms.video-call-started", "comms.video-call-joined", "comms.video-call-left", "comms.video-call-ended", "comms.chat-message", "appointment.reminder", "appointment.confirmation-request", "recall.due", "recall.reminder"]),
  channel: z.enum(["email", "push", "in-app", "sms"]),
  title: z.string().max(200),
  message: z.string().max(1000),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntity: z.string().uuid().optional(),
  status: z.enum(["queued", "sent", "delivered", "read", "failed", "expired", "unread"]),
  sentAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  readAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  consentValidated: z.boolean()
});

export const NotificationChannelSchema = z.enum(["email", "push", "in-app", "sms"]);

export const NotificationStatusSchema = z.enum(["queued", "sent", "delivered", "read", "failed", "expired", "unread"]);

export const NotificationTypeSchema = z.enum(["billing", "security", "system", "booking.created", "booking.confirmed", "booking.rejected", "booking.cancelled", "booking.no-show-client", "booking.no-show-host", "comms.video-call-started", "comms.video-call-joined", "comms.video-call-left", "comms.video-call-ended", "comms.chat-message", "appointment.reminder", "appointment.confirmation-request", "recall.due", "recall.reminder"]);

export const OffsetPaginationMetaSchema = z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
});

export const OnboardingRequestSchema = z.object({
  refreshUrl: z.string().url(),
  returnUrl: z.string().url()
});

export const OnboardingResponseSchema = z.object({
  onboardingUrl: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const OnlineBookingResponseSchema = z.object({
  confirmationCode: z.string(),
  appointmentId: UUIDSchema,
  branchId: UUIDSchema,
  providerId: UUIDSchema,
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  visitType: VisitTypeSchema,
  status: AppointmentStatusSchema
});

export const OrganizationContactSchema = z.object({
  purpose: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  name: z.object({
  use: z.enum(["usual", "official", "temp", "nickname", "anonymous", "old", "maiden"]).optional(),
  text: z.string().optional(),
  family: z.string().optional(),
  given: z.array(z.string()).optional(),
  prefix: z.array(z.string()).optional(),
  suffix: z.array(z.string()).optional(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional()
}).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  address: z.object({
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
}).optional()
}).optional()
});

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  active: z.boolean(),
  type: z.array(HealthcareCoreCodeableConceptSchema),
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  address: z.array(AddressSchema).optional(),
  partOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  contact: z.array(OrganizationContactSchema).optional(),
  endpoint: z.array(z.string()).optional()
});

export const PMDDocumentStatusSchema = z.enum(["generated", "signed", "superseded"]);

export const PMDDocumentSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  authorMemberId: UUIDSchema,
  branchId: UUIDSchema,
  status: PMDDocumentStatusSchema,
  content: z.string(),
  signature: z.string().optional(),
  signedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  supersedesId: z.string().uuid().optional(),
  checksum: z.string()
});

export const PatientLinkSchema = z.object({
  other: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["replaced-by", "replaces", "refer", "seealso"])
});

export const PatientSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  active: z.boolean(),
  name: z.array(HealthcareCoreHumanNameSchema),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  gender: z.enum(["male", "female", "other", "unknown"]),
  genderIdentity: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  pronouns: z.string().optional(),
  maritalStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  deceased: z.boolean().optional(),
  deceasedDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  address: z.array(AddressSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  language: z.string().optional(),
  communication: z.array(PatientCommunicationSchema).optional(),
  generalPractitioner: z.array(HealthcareCoreReferenceSchema).optional(),
  managingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  link: z.array(PatientLinkSchema).optional(),
  photo: z.array(HealthcareCoreAttachmentSchema).optional(),
  emergencyContact: z.array(EmergencyContactSchema).optional(),
  mrn: z.string().optional(),
  insuranceCoverage: z.array(HealthcareCoreReferenceSchema).optional(),
  primaryProvider: z.object({
  name: z.string().min(1).max(100),
  specialty: z.string().max(100).optional(),
  phone: z.string().optional()
}).optional(),
  primaryPharmacy: z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  phone: z.string().optional()
}).optional(),
  preferredBranchId: z.string().uuid().optional(),
  dentalHistorySummary: z.string().optional(),
  needsFollowUp: z.boolean().optional(),
  hasActivePaymentPlan: z.boolean().optional()
});

export const PatientBalanceResponseSchema = z.object({
  patientId: UUIDSchema,
  balanceCents: z.number().int(),
  overdueInvoices: z.number().int()
});

export const PatientCareRecordBundleSchema = z.object({
  resourceType: z.string(),
  type: z.string()
}).passthrough();

export const PatientConditionEntrySchema = z.object({
  id: z.string(),
  visitId: UUIDSchema,
  toothNumber: z.number().int().optional(),
  status: z.string(),
  surfaces: z.array(z.string()).optional(),
  conditionCode: z.string().optional(),
  state: z.string().optional(),
  cdtCode: z.string().optional(),
  description: z.string().optional(),
  priceCents: z.number().int().optional()
});

export const PatientLinkTypeSchema = z.enum(["replaced-by", "replaces", "refer", "seealso"]);

export const PatientMergeRequestSchema = z.object({
  targetPatientId: z.string().uuid(),
  sourcePatientId: z.string().uuid(),
  reason: z.string(),
  dryRun: z.boolean().optional()
});

export const PatientMergeResultSchema = z.object({
  success: z.boolean(),
  targetPatient: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  active: z.boolean(),
  name: z.array(HealthcareCoreHumanNameSchema),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  gender: z.enum(["male", "female", "other", "unknown"]),
  genderIdentity: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  pronouns: z.string().optional(),
  maritalStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  deceased: z.boolean().optional(),
  deceasedDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  address: z.array(AddressSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  language: z.string().optional(),
  communication: z.array(PatientCommunicationSchema).optional(),
  generalPractitioner: z.array(HealthcareCoreReferenceSchema).optional(),
  managingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  link: z.array(PatientLinkSchema).optional(),
  photo: z.array(HealthcareCoreAttachmentSchema).optional(),
  emergencyContact: z.array(EmergencyContactSchema).optional(),
  mrn: z.string().optional(),
  insuranceCoverage: z.array(HealthcareCoreReferenceSchema).optional(),
  primaryProvider: z.object({
  name: z.string().min(1).max(100),
  specialty: z.string().max(100).optional(),
  phone: z.string().optional()
}).optional(),
  primaryPharmacy: z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  phone: z.string().optional()
}).optional(),
  preferredBranchId: z.string().uuid().optional(),
  dentalHistorySummary: z.string().optional(),
  needsFollowUp: z.boolean().optional(),
  hasActivePaymentPlan: z.boolean().optional()
}),
  recordsUpdated: z.number().int(),
  details: z.string().optional()
});

export const PatientToothEntrySchema = z.object({
  toothNumber: z.number().int(),
  state: z.string().optional(),
  status: z.string().optional(),
  entryClassification: ChartEntryClassificationSchema.optional(),
  surfaces: z.array(z.string()).optional(),
  conditionCode: z.string().optional()
});

export const PatientUnmergeRequestSchema = z.object({
  targetPatientId: z.string().uuid(),
  sourcePatientId: z.string().uuid(),
  reason: z.string()
});

export const PatientVisitRecordSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  patientId: UUIDSchema,
  branchId: UUIDSchema,
  status: DentalVisitStatusSchema,
  chiefComplaint: z.string().optional(),
  teeth: z.array(PatientToothEntrySchema).optional()
});

export const PayerArSummarySchema = z.object({
  currentCents: z.number().int(),
  days30Cents: z.number().int(),
  days60Cents: z.number().int(),
  days90PlusCents: z.number().int(),
  totalOutstandingCents: z.number().int(),
  payerCount: z.number().int(),
  claimCount: z.number().int()
});

export const PayerArRowSchema = z.object({
  insuranceProfileId: UUIDSchema,
  payerName: z.string(),
  currentCents: z.number().int(),
  days30Cents: z.number().int(),
  days60Cents: z.number().int(),
  days90PlusCents: z.number().int(),
  totalOutstandingCents: z.number().int(),
  claimCount: z.number().int(),
  oldestClaimDays: z.number().int()
});

export const PayerArAgingResponseSchema = z.object({
  asOf: z.string().datetime().transform((str) => new Date(str)),
  summary: PayerArSummarySchema,
  payers: z.array(PayerArRowSchema)
});

export const PayerPaymentMethodSchema = z.enum(["bank_transfer", "check", "portal"]);

export const PayerPaymentSchema = z.object({
  id: UUIDSchema,
  claimId: UUIDSchema,
  insuranceProfileId: UUIDSchema,
  branchId: UUIDSchema,
  invoiceId: UUIDSchema.optional(),
  amountCents: z.number().int(),
  remittanceReference: z.string().optional(),
  method: PayerPaymentMethodSchema,
  disallowanceCents: z.number().int().optional(),
  disallowanceReason: z.string().optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str))
});

export const PaymentRequestSchema = z.object({
  paymentMethod: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const PaymentResponseSchema = z.object({
  checkoutUrl: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const PaymentStatusSchema = z.enum(["pending", "requires_capture", "processing", "succeeded", "failed", "canceled"]);

export const PerioToothReadingSchema = z.object({
  id: UUIDSchema,
  chartId: UUIDSchema,
  toothNumber: z.number().int(),
  depthBM: z.number().int().gte(0).lte(20).optional(),
  depthBC: z.number().int().gte(0).lte(20).optional(),
  depthBD: z.number().int().gte(0).lte(20).optional(),
  depthLM: z.number().int().gte(0).lte(20).optional(),
  depthLC: z.number().int().gte(0).lte(20).optional(),
  depthLD: z.number().int().gte(0).lte(20).optional(),
  bopBM: z.boolean().optional(),
  bopBC: z.boolean().optional(),
  bopBD: z.boolean().optional(),
  bopLM: z.boolean().optional(),
  bopLC: z.boolean().optional(),
  bopLD: z.boolean().optional(),
  recession: z.number().int().gte(-5).lte(20).optional(),
  gmBM: z.number().int().gte(-5).lte(20).optional(),
  gmBC: z.number().int().gte(-5).lte(20).optional(),
  gmBD: z.number().int().gte(-5).lte(20).optional(),
  gmLM: z.number().int().gte(-5).lte(20).optional(),
  gmLC: z.number().int().gte(-5).lte(20).optional(),
  gmLD: z.number().int().gte(-5).lte(20).optional(),
  calBM: z.union([z.number().int(), z.null()]).optional(),
  calBC: z.union([z.number().int(), z.null()]).optional(),
  calBD: z.union([z.number().int(), z.null()]).optional(),
  calLM: z.union([z.number().int(), z.null()]).optional(),
  calLC: z.union([z.number().int(), z.null()]).optional(),
  calLD: z.union([z.number().int(), z.null()]).optional(),
  mobility: z.number().int(),
  furcation: z.number().int(),
  plaque: z.boolean(),
  suppuration: z.boolean(),
  notes: z.string().optional(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const PerioChartSchema = z.object({
  id: UUIDSchema,
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  branchId: UUIDSchema,
  examinerMemberId: UUIDSchema,
  status: PerioChartStatusSchema,
  notes: z.string().optional(),
  completedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  summaryBopPercent: z.number().optional(),
  summaryMeanDepth: z.number().optional(),
  summaryDeepPocketCount: z.number().int().optional(),
  stage: z.union([z.enum(["I", "II", "III", "IV"]), z.null()]).optional(),
  grade: z.union([z.enum(["A", "B", "C"]), z.null()]).optional(),
  extent: z.union([z.enum(["localized", "generalized", "molar_incisor"]), z.null()]).optional(),
  riskFactors: z.union([z.object({
  toothLossCount: z.number().int().optional(),
  remainingTeeth: z.number().int().optional(),
  biteCollapse: z.boolean().optional(),
  bonelossPercent: z.number().optional(),
  ageYears: z.number().int().optional(),
  fiveYearProgressionMm: z.number().optional(),
  cigarettesPerDay: z.number().int().optional(),
  hasDiabetes: z.boolean().optional(),
  hba1cPercent: z.number().optional(),
  molarIncisorPattern: z.boolean().optional()
}), z.null()]).optional(),
  readings: z.array(PerioToothReadingSchema),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
});

export const PerioChartHistorySchema = z.object({
  data: z.array(PerioChartSchema)
});

export const PerioExtentSchema = z.enum(["localized", "generalized", "molar_incisor"]);

export const PerioGradeSchema = z.enum(["A", "B", "C"]);

export const PerioRiskFactorsSchema = z.object({
  toothLossCount: z.number().int().optional(),
  remainingTeeth: z.number().int().optional(),
  biteCollapse: z.boolean().optional(),
  bonelossPercent: z.number().optional(),
  ageYears: z.number().int().optional(),
  fiveYearProgressionMm: z.number().optional(),
  cigarettesPerDay: z.number().int().optional(),
  hasDiabetes: z.boolean().optional(),
  hba1cPercent: z.number().optional(),
  molarIncisorPattern: z.boolean().optional()
});

export const PerioStageSchema = z.enum(["I", "II", "III", "IV"]);

export const PersonCreateRequestSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50).optional(),
  middleName: z.string().max(50).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  gender: z.enum(["male", "female", "non-binary", "other", "prefer-not-to-say"]).optional(),
  primaryAddress: z.object({
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().gte(0).optional()
}).optional()
}).optional(),
  contactInfo: z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
}).optional(),
  avatar: z.object({
  file: z.string().uuid().optional(),
  url: z.string().url()
}).optional(),
  languagesSpoken: z.array(LanguageCodeSchema).optional(),
  timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/).refine(val => validateTimezone(val), { message: "Invalid IANA timezone identifier" }).optional()
});

export const PersonUpdateRequestSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.union([z.string().min(1).max(50), z.null()]).optional(),
  middleName: z.union([z.string().max(50), z.null()]).optional(),
  dateOfBirth: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }), z.null()]).optional(),
  gender: z.union([z.enum(["male", "female", "non-binary", "other", "prefer-not-to-say"]), z.null()]).optional(),
  primaryAddress: z.union([z.object({
  street1: z.string().min(1).max(100).optional(),
  street2: z.union([z.string().max(100), z.null()]).optional(),
  city: z.string().min(1).max(50).optional(),
  state: z.string().min(1).max(50).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }).optional(),
  coordinates: z.union([z.object({
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().gte(0).optional()
}), z.null()]).optional()
}), z.null()]).optional(),
  contactInfo: z.union([z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
}), z.null()]).optional(),
  avatar: z.union([z.object({
  file: z.union([z.string().uuid(), z.null()]).optional(),
  url: z.string().url().optional()
}), z.null()]).optional(),
  languagesSpoken: z.union([z.array(LanguageCodeSchema), z.null()]).optional(),
  timezone: z.union([z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/).refine(val => validateTimezone(val), { message: "Invalid IANA timezone identifier" }), z.null()]).optional()
});

export const PhoneNumberSchema = z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" });

export const PractitionerSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  active: z.boolean(),
  name: z.array(HealthcareCoreHumanNameSchema),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  address: z.array(AddressSchema).optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  photo: z.array(HealthcareCoreAttachmentSchema).optional(),
  qualification: z.array(PractitionerQualificationSchema),
  credential: z.array(PractitionerCredentialSchema),
  specialties: z.array(HealthcareCoreCodeableConceptSchema),
  languages: z.array(HealthcareCoreCodeableConceptSchema).optional()
});

export const PractitionerRoleSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  active: z.boolean(),
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  practitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  organization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  code: z.array(HealthcareCoreCodeableConceptSchema),
  specialty: z.array(HealthcareCoreCodeableConceptSchema),
  location: z.array(HealthcareCoreReferenceSchema).optional(),
  healthcareService: z.array(HealthcareCoreReferenceSchema).optional(),
  telecom: z.array(HealthcareCoreContactPointSchema).optional(),
  availableTime: z.array(AvailableTimeSchema).optional(),
  notAvailable: z.array(NotAvailableTimeSchema).optional()
});

export const PrescriptionSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  version: z.number().int(),
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  prescriberMemberId: UUIDSchema,
  rxNormCode: z.string().optional(),
  drugName: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string().optional(),
  quantity: z.string().optional(),
  instructions: z.string().optional(),
  dispenseAsWritten: z.boolean(),
  status: z.enum(["pending", "dispensed", "cancelled"]),
  controlledSubstanceSchedule: z.enum(["none", "II", "III", "IV", "V"]).optional(),
  prescriberDea: z.string().optional(),
  prescriberNpi: z.string().optional()
});

export const PrescriptionStatusSchema = z.enum(["pending", "dispensed", "cancelled"]);

export const PrimaryPharmacyInfoSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  phone: z.string().optional()
});

export const PrimaryProviderInfoSchema = z.object({
  name: z.string().min(1).max(100),
  specialty: z.string().max(100).optional(),
  phone: z.string().optional()
});

export const ProviderSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  person: z.union([UUIDSchema, PersonSchema]),
  providerType: z.enum(["dentist", "hygienist", "orthodontist", "endodontist", "periodontist", "oral_surgeon", "pediatric_dentist", "pharmacist", "other"]),
  yearsOfExperience: z.number().int().gte(0).lte(70).optional(),
  biography: z.string().max(2000).optional(),
  minorAilmentsSpecialties: z.array(z.string()).optional(),
  minorAilmentsPracticeLocations: z.array(z.string()).optional()
});

export const ProviderTypeSchema = z.enum(["dentist", "hygienist", "orthodontist", "endodontist", "periodontist", "oral_surgeon", "pediatric_dentist", "pharmacist", "other"]);

export const PublicAvailabilitySlotSchema = z.object({
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  providerId: UUIDSchema,
  visitType: VisitTypeSchema
});

export const PublicAvailabilityResponseSchema = z.object({
  branchId: UUIDSchema,
  visitType: VisitTypeSchema,
  slots: z.array(PublicAvailabilitySlotSchema)
});

export const PublicBookingProviderSchema = z.object({
  providerId: UUIDSchema,
  displayName: z.string()
});

export const PublicBookingConfigSchema = z.object({
  branchId: UUIDSchema,
  branchName: z.string(),
  timezone: z.string(),
  enabled: z.boolean(),
  bookableVisitTypes: z.array(VisitTypeSchema),
  leadTimeMinutes: z.number().int(),
  horizonDays: z.number().int(),
  slotStepMinutes: z.number().int(),
  requirePatientAuth: z.boolean(),
  providers: z.array(PublicBookingProviderSchema)
});

export const PublicConfirmResponseSchema = z.object({
  appointmentId: UUIDSchema,
  status: AppointmentStatusSchema,
  startAt: z.string().datetime().transform((str) => new Date(str)),
  endAt: z.string().datetime().transform((str) => new Date(str)),
  confirmedAt: z.string().datetime().transform((str) => new Date(str))
});

export const RateLimitErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional(),
  limitType: z.enum(["requests", "bandwidth", "concurrent"]),
  limit: z.number().int(),
  usage: z.number().int(),
  resetTime: z.number().int(),
  windowSize: z.number().int()
});

export const RecordConsentRefusalRequestSchema = z.object({
  visitId: UUIDSchema,
  patientId: UUIDSchema,
  refusingMemberId: UUIDSchema,
  procedureDescription: z.string(),
  refusalReason: z.string(),
  patientAcknowledgement: z.string()
});

export const RecordDentalPaymentRequestSchema = z.object({
  amountCents: z.number().int().gte(1),
  method: PaymentMethodSchema,
  receiptNumber: z.string().optional(),
  recordedByMemberId: UUIDSchema,
  paymentDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  notes: z.string().optional()
});

export const RecordMedicalHistoryReviewRequestSchema = z.object({
  patientId: UUIDSchema,
  asaClassification: AsaClassificationSchema.optional(),
  asaEmergency: z.boolean().optional()
});

export const RecordRemittanceRequestSchema = z.object({
  amountCents: z.number().int().gte(0),
  remittanceReference: z.string().optional(),
  remittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  method: PayerPaymentMethodSchema.optional(),
  disallowanceCents: z.number().int().gte(0).optional(),
  disallowanceReason: z.string().optional()
});

export const RecordRemittanceResultSchema = z.object({
  payerPayment: PayerPaymentSchema,
  claim: InsuranceClaimSchema
});

export const RecurrencePatternSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().gte(1).optional(),
  daysOfWeek: z.array(z.number().int()).optional(),
  dayOfMonth: z.number().int().gte(1).lte(31).optional(),
  monthOfYear: z.number().int().gte(1).lte(12).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  maxOccurrences: z.number().int().gte(1).optional()
});

export const RecurrenceTypeSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

export const RefundRequestSchema = z.object({
  amount: z.number().int().gte(0).optional(),
  reason: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const RefundResponseSchema = z.object({
  refundedAmount: z.number().int().gte(0),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const ResolveChartConflictRequestSchema = z.object({
  resolution: ChartConflictResolutionSchema,
  reason: z.string().min(5).max(500).optional()
});

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  context: z.string().uuid(),
  reviewer: z.string().uuid(),
  reviewType: z.string().max(50),
  reviewedEntity: z.string().uuid().optional(),
  npsScore: z.number().int().gte(0).lte(10),
  comment: z.string().max(1000).optional()
});

export const SafeQueryStringSchema = z.string().regex(/^[^\u0000]*$/).max(500);

export const ScheduleExceptionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  event: z.string().uuid(),
  owner: z.string().uuid(),
  context: z.string().optional(),
  timezone: z.string(),
  startDatetime: z.string().datetime().transform((str) => new Date(str)),
  endDatetime: z.string().datetime().transform((str) => new Date(str)),
  reason: z.string().max(500),
  recurring: z.boolean(),
  recurrencePattern: z.object({
  type: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().gte(1).optional(),
  daysOfWeek: z.array(z.number().int()).optional(),
  dayOfMonth: z.number().int().gte(1).lte(31).optional(),
  monthOfYear: z.number().int().gte(1).lte(12).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  maxOccurrences: z.number().int().gte(1).optional()
}).optional()
});

export const ScheduleExceptionCreateRequestSchema = z.object({
  timezone: z.string().optional(),
  startDatetime: z.string().datetime().transform((str) => new Date(str)),
  endDatetime: z.string().datetime().transform((str) => new Date(str)),
  reason: z.string().max(500),
  recurring: z.boolean().optional(),
  recurrencePattern: z.object({
  type: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().gte(1).optional(),
  daysOfWeek: z.array(z.number().int()).optional(),
  dayOfMonth: z.number().int().gte(1).lte(31).optional(),
  monthOfYear: z.number().int().gte(1).lte(12).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  maxOccurrences: z.number().int().gte(1).optional()
}).optional()
});

export const SendTextMessageRequestSchema = z.object({
  messageType: z.enum(["text"]),
  message: z.string().max(5000)
});

export const SignConsentFormRequestSchema = z.object({
  signatureData: z.string()
});

export const SignVisitNotesRequestSchema = z.record(z.string(), z.unknown());

export const SlotStatusSchema = z.enum(["available", "booked", "blocked"]);

export const StartVideoCallDataSchema = z.object({
  status: z.enum(["starting"]),
  participants: z.array(CallParticipantSchema)
});

export const StartVideoCallRequestSchema = z.object({
  messageType: z.enum(["video_call"]),
  videoCallData: z.object({
  status: z.enum(["starting"]),
  participants: z.array(CallParticipantSchema)
})
});

export const StoredFileSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  filename: z.string().max(255),
  mimeType: z.string().max(100),
  size: z.number().int().gte(0),
  status: z.enum(["uploading", "processing", "available", "failed"]),
  owner: z.string().uuid(),
  uploadedAt: z.string().datetime().transform((str) => new Date(str))
});

export const StrictUtcDateTimeSchema = z.string().datetime().transform((str) => new Date(str));

export const SymptomSeveritySchema = z.union([z.string(), z.enum(["mild", "moderate", "severe"])]);

export const SymptomsDataSchema = z.object({
  onset: z.string().datetime().transform((str) => new Date(str)).optional(),
  durationHours: z.number().int().optional(),
  severity: z.union([z.string(), z.enum(["mild", "moderate", "severe"])]).optional(),
  description: z.string().optional(),
  associated: z.array(z.string()).optional(),
  denies: z.array(z.string()).optional()
});

export const TemplateStatusSchema = z.enum(["draft", "active", "archived"]);

export const TestTemplateRequestSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().max(255).optional(),
  variables: z.record(z.string(), z.unknown()).optional()
});

export const TestTemplateResultSchema = z.object({
  queue: z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: z.string().uuid().optional(),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  updatedBy: z.string().uuid().optional(),
  template: z.string().uuid().optional(),
  templateTags: z.array(z.string()).optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(255).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["pending", "processing", "sent", "failed", "cancelled"]),
  priority: z.number().int().gte(1).lte(10),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  attempts: z.number().int().gte(0),
  lastAttemptAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  nextRetryAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  lastError: z.string().optional(),
  sentAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  provider: z.enum(["smtp", "postmark"]).optional(),
  providerMessageId: z.string().max(255).optional(),
  cancelledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  cancelledBy: z.string().uuid().optional(),
  cancellationReason: z.string().max(500).optional()
})
});

export const TimezoneIdSchema = z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$/).refine(val => validateTimezone(val), { message: "Invalid IANA timezone identifier" });

export const ToothHistoryEntrySchema = z.object({
  visitId: UUIDSchema,
  visitDate: z.string().datetime().transform((str) => new Date(str)),
  toothNumber: z.number().int(),
  state: ToothStateSchema,
  conditionCode: z.string().optional(),
  treatmentCdtCode: z.string().optional(),
  treatmentDescription: z.string().optional(),
  surfaces: z.array(ToothSurfaceCodeSchema).optional(),
  treatmentStatus: DentalTreatmentStatusSchema.optional(),
  treatmentPriceCents: z.number().int().optional()
});

export const TreatmentPlanItemSchema = z.object({
  id: UUIDSchema,
  toothNumber: z.number().int().optional(),
  cdtCode: z.string(),
  description: z.string(),
  surfaces: z.array(ToothSurfaceCodeSchema).optional(),
  priceCents: z.number().int(),
  status: DentalTreatmentStatusSchema,
  conditionCode: z.string().optional(),
  visitId: UUIDSchema,
  carriedOver: z.boolean().optional(),
  phase: DentalTreatmentPhaseSchema.optional(),
  priority: z.number().int(),
  reason: z.string().optional()
});

export const TreatmentPlanResponseSchema = z.object({
  patientId: UUIDSchema,
  version: z.number().int(),
  totalEstimateCents: z.number().int(),
  treatmentCount: z.number().int().optional(),
  toothCount: z.number().int(),
  byTooth: z.record(z.string(), z.unknown()).optional(),
  treatments: z.array(TreatmentPlanItemSchema),
  completedToothNumbers: z.array(z.number().int()).optional()
});

export const TreatmentPlanVersionSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: UUIDSchema.optional(),
  version: z.number().int(),
  patientId: UUIDSchema,
  snapshot: z.record(z.string(), z.unknown())
});

export const UpdateAppointmentRequestSchema = z.object({
  startAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  endAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  providerId: UUIDSchema.optional(),
  visitType: VisitTypeSchema.optional(),
  operatoryId: UUIDSchema.optional(),
  notes: z.string().max(500).optional(),
  status: AppointmentStatusSchema.optional(),
  cancellationReason: z.string().optional()
});

export const UpdateConsultationRequestSchema = z.object({
  chiefComplaint: z.union([z.string().max(500), z.null()]).optional(),
  assessment: z.union([z.string().max(2000), z.null()]).optional(),
  plan: z.union([z.string().max(2000), z.null()]).optional(),
  vitals: z.union([z.object({
  temperatureCelsius: z.number().optional(),
  systolicBp: z.number().int().optional(),
  diastolicBp: z.number().int().optional(),
  heartRate: z.number().int().optional(),
  weightKg: z.number().optional(),
  heightCm: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  oxygenSaturation: z.number().int().optional(),
  notes: z.string().optional()
}), z.null()]).optional(),
  symptoms: z.union([z.object({
  onset: z.string().datetime().transform((str) => new Date(str)).optional(),
  durationHours: z.number().int().optional(),
  severity: z.union([z.string(), z.enum(["mild", "moderate", "severe"])]).optional(),
  description: z.string().optional(),
  associated: z.array(z.string()).optional(),
  denies: z.array(z.string()).optional()
}), z.null()]).optional(),
  prescriptions: z.union([z.array(PrescriptionDataSchema), z.null()]).optional(),
  followUp: z.union([z.object({
  needed: z.boolean().optional(),
  timeframeDays: z.number().int().optional(),
  instructions: z.string().optional(),
  specialistReferral: z.string().optional()
}), z.null()]).optional(),
  externalDocumentation: z.union([z.record(z.string(), z.unknown()), z.null()]).optional()
});

export const UpdateDentalTreatmentRequestSchema = z.object({
  status: DentalTreatmentStatusSchema.optional(),
  dismissReason: z.string().optional(),
  refusalReason: z.string().optional(),
  toothNumber: z.number().int().optional(),
  surfaces: z.array(ToothSurfaceCodeSchema).optional(),
  cdtCode: z.string().optional(),
  description: z.string().optional(),
  conditionCode: z.string().optional(),
  priceCents: z.number().int().optional(),
  clinicalNotes: z.string().optional(),
  phase: z.enum(["systemic", "disease_control", "re_evaluation", "definitive", "maintenance"]).optional(),
  priority: z.number().int().gte(0).optional()
});

export const UpdateDentalVisitRequestSchema = z.object({
  status: DentalVisitStatusSchema.optional(),
  chiefComplaint: z.string().optional()
});

export const UpdateFindingRequestSchema = z.object({
  conditionCode: ConditionCodeSchema.optional(),
  surface: ToothSurfaceCodeSchema.optional(),
  note: z.string().optional(),
  status: FindingStatusSchema.optional()
});

export const UpdateInsuranceClaimLineRequestSchema = z.object({
  approvedAmountCents: z.number().int().gte(0).optional(),
  paidAmountCents: z.number().int().gte(0).optional(),
  status: ClaimLineStatusSchema.optional(),
  description: z.string().optional(),
  billedAmountCents: z.number().int().gte(0).optional()
});

export const UpdateInsuranceClaimStatusRequestSchema = z.object({
  status: InsuranceClaimStatusSchema,
  payerReference: z.string().optional(),
  submissionChannel: SubmissionChannelSchema.optional(),
  denialReason: z.string().optional()
});

export const UpdateInvoiceRequestSchema = z.object({
  paymentCaptureMethod: z.enum(["automatic", "manual"]).optional(),
  paymentDueAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]).optional(),
  voidThresholdMinutes: z.number().int().optional(),
  lineItems: z.array(CreateLineItemRequestSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const UpdateLabOrderRequestSchema = z.object({
  status: LabOrderStatusSchema.optional(),
  shade: z.string().optional(),
  material: z.string().optional(),
  dueDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  expectedDeliveryDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  cancelReason: z.string().optional(),
  isDefective: z.boolean().optional()
});

export const UpdateMedicalHistoryEntryRequestSchema = z.object({
  displayName: z.string().optional(),
  notes: z.string().optional(),
  resolvedDate: z.string().optional(),
  active: z.boolean().optional()
});

export const UpdateParticipantRequestSchema = z.object({
  audioEnabled: z.boolean().optional(),
  videoEnabled: z.boolean().optional()
});

export const UpdatePatientRequestSchema = z.object({
  name: z.union([z.array(HealthcareCoreHumanNameSchema), z.null()]).optional(),
  birthDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }), z.null()]).optional(),
  gender: z.union([z.enum(["male", "female", "other", "unknown"]), z.null()]).optional(),
  active: z.union([z.boolean(), z.null()]).optional(),
  genderIdentity: z.union([z.object({
  coding: z.array(HealthcareCoreCodingSchema).optional(),
  text: z.string().optional()
}), z.null()]).optional(),
  pronouns: z.union([z.string(), z.null()]).optional(),
  maritalStatus: z.union([z.object({
  coding: z.array(HealthcareCoreCodingSchema).optional(),
  text: z.string().optional()
}), z.null()]).optional(),
  deceased: z.union([z.boolean(), z.null()]).optional(),
  deceasedDateTime: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]).optional(),
  address: z.union([z.array(AddressSchema), z.null()]).optional(),
  telecom: z.union([z.array(HealthcareCoreContactPointSchema), z.null()]).optional(),
  language: z.union([z.string(), z.null()]).optional(),
  communication: z.union([z.array(PatientCommunicationSchema), z.null()]).optional(),
  generalPractitioner: z.union([z.array(HealthcareCoreReferenceSchema), z.null()]).optional(),
  managingOrganization: z.union([z.object({
  resourceType: z.string().optional(),
  id: z.string().uuid().optional(),
  display: z.string().optional()
}), z.null()]).optional(),
  photo: z.union([z.array(HealthcareCoreAttachmentSchema), z.null()]).optional(),
  emergencyContact: z.union([z.array(EmergencyContactSchema), z.null()]).optional(),
  mrn: z.union([z.string(), z.null()]).optional(),
  insuranceCoverage: z.union([z.array(HealthcareCoreReferenceSchema), z.null()]).optional(),
  preferredBranchId: z.union([z.string().uuid(), z.null()]).optional(),
  dentalHistorySummary: z.union([z.string(), z.null()]).optional(),
  needsFollowUp: z.union([z.boolean(), z.null()]).optional()
});

export const UpdatePractitionerRequestSchema = z.object({
  name: z.union([z.array(HealthcareCoreHumanNameSchema), z.null()]).optional(),
  active: z.union([z.boolean(), z.null()]).optional(),
  telecom: z.union([z.array(HealthcareCoreContactPointSchema), z.null()]).optional(),
  address: z.union([z.array(AddressSchema), z.null()]).optional(),
  gender: z.union([z.enum(["male", "female", "other", "unknown"]), z.null()]).optional(),
  birthDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }), z.null()]).optional(),
  photo: z.union([z.array(HealthcareCoreAttachmentSchema), z.null()]).optional(),
  qualification: z.union([z.array(PractitionerQualificationSchema), z.null()]).optional(),
  credential: z.union([z.array(PractitionerCredentialSchema), z.null()]).optional(),
  specialties: z.union([z.array(HealthcareCoreCodeableConceptSchema), z.null()]).optional(),
  languages: z.union([z.array(HealthcareCoreCodeableConceptSchema), z.null()]).optional()
});

export const UpdatePractitionerRoleRequestSchema = z.object({
  active: z.union([z.boolean(), z.null()]).optional(),
  period: z.union([z.object({
  start: z.string().datetime().transform((str) => new Date(str)).optional(),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}), z.null()]).optional(),
  code: z.union([z.array(HealthcareCoreCodeableConceptSchema), z.null()]).optional(),
  specialty: z.union([z.array(HealthcareCoreCodeableConceptSchema), z.null()]).optional(),
  location: z.union([z.array(HealthcareCoreReferenceSchema), z.null()]).optional(),
  healthcareService: z.union([z.array(HealthcareCoreReferenceSchema), z.null()]).optional(),
  telecom: z.union([z.array(HealthcareCoreContactPointSchema), z.null()]).optional(),
  availableTime: z.union([z.array(AvailableTimeSchema), z.null()]).optional(),
  notAvailable: z.union([z.array(NotAvailableTimeSchema), z.null()]).optional()
});

export const UpdatePrescriptionRequestSchema = z.object({
  rxNormCode: z.string().optional(),
  drugName: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  quantity: z.string().optional(),
  instructions: z.string().optional(),
  status: z.enum(["pending", "dispensed", "cancelled"]).optional(),
  controlledSubstanceSchedule: ControlledSubstanceScheduleSchema.optional(),
  prescriberDea: z.string().optional(),
  prescriberNpi: z.string().optional()
});

export const UpdateTemplateRequestSchema = z.object({
  tags: z.array(z.string()).optional(),
  name: z.string().max(255).optional(),
  description: z.string().max(500).optional(),
  subject: z.string().max(500).optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  variables: z.array(TemplateVariableSchema).optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  replyToEmail: z.string().email().optional(),
  replyToName: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional()
});

export const UpdateToothRequestSchema = z.object({
  toothNumber: z.number().int().optional(),
  state: ToothStateSchema.optional(),
  surfaces: z.array(ToothSurfaceCodeSchema).optional(),
  conditionCode: z.string().optional(),
  note: z.string().optional(),
  surfaceConditionMap: z.record(z.string(), z.unknown()).optional(),
  entryClassification: ChartEntryClassificationSchema.optional()
});

export const UpdateTreatmentTemplateRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  items: z.array(TemplateTreatmentItemSchema).optional(),
  active: z.boolean().optional()
});

export const UpsertToothReadingRequestSchema = z.object({
  depthBM: z.number().int().gte(0).lte(20).optional(),
  depthBC: z.number().int().gte(0).lte(20).optional(),
  depthBD: z.number().int().gte(0).lte(20).optional(),
  depthLM: z.number().int().gte(0).lte(20).optional(),
  depthLC: z.number().int().gte(0).lte(20).optional(),
  depthLD: z.number().int().gte(0).lte(20).optional(),
  bopBM: z.boolean().optional(),
  bopBC: z.boolean().optional(),
  bopBD: z.boolean().optional(),
  bopLM: z.boolean().optional(),
  bopLC: z.boolean().optional(),
  bopLD: z.boolean().optional(),
  recession: z.number().int().gte(-5).lte(20).optional(),
  gmBM: z.number().int().gte(-5).lte(20).optional(),
  gmBC: z.number().int().gte(-5).lte(20).optional(),
  gmBD: z.number().int().gte(-5).lte(20).optional(),
  gmLM: z.number().int().gte(-5).lte(20).optional(),
  gmLC: z.number().int().gte(-5).lte(20).optional(),
  gmLD: z.number().int().gte(-5).lte(20).optional(),
  mobility: z.number().int().optional(),
  furcation: z.number().int().optional(),
  plaque: z.boolean().optional(),
  suppuration: z.boolean().optional(),
  notes: z.string().optional()
});

export const UpsertVisitNotesRequestSchema = z.object({
  visitId: UUIDSchema,
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  notes: z.string().optional()
});

export const UrlSchema = z.string().url();

export const ValidationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
  timestamp: z.string().datetime().transform((str) => new Date(str)),
  path: z.string(),
  method: z.string(),
  statusCode: z.number().int(),
  helpUrl: z.string().url().optional(),
  fieldErrors: z.array(FieldErrorSchema).optional(),
  globalErrors: z.array(z.string()).optional()
});

export const VariableTypeSchema = z.enum(["string", "number", "boolean", "date", "datetime", "url", "email", "array"]);

export const VideoCallDataSchema = z.object({
  status: z.enum(["starting", "active", "ended", "cancelled"]),
  roomUrl: z.string().optional(),
  token: z.string().optional(),
  startedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  startedBy: z.string().uuid().optional(),
  endedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  endedBy: z.string().uuid().optional(),
  durationMinutes: z.number().int().optional(),
  participants: z.array(CallParticipantSchema)
});

export const VideoCallEndResponseSchema = z.object({
  message: z.string(),
  callDuration: z.number().int().optional()
});

export const VideoCallJoinResponseSchema = z.object({
  roomUrl: z.string(),
  token: z.string(),
  callStatus: z.enum(["starting", "active", "ended", "cancelled"]),
  participants: z.array(CallParticipantSchema)
});

export const VideoCallStatusSchema = z.enum(["starting", "active", "ended", "cancelled"]);

export const VisitNoteVersionSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  createdBy: UUIDSchema.optional(),
  version: z.number().int(),
  noteId: UUIDSchema,
  snapshot: z.record(z.string(), z.unknown())
});

export const VisitNotesSchema = z.object({
  id: UUIDSchema,
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str)),
  visitId: UUIDSchema,
  authorMemberId: UUIDSchema,
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  notes: z.string().optional(),
  signed: z.boolean(),
  signedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  signedBy: UUIDSchema.optional(),
  lockedAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const VitalsDataSchema = z.object({
  temperatureCelsius: z.number().optional(),
  systolicBp: z.number().int().optional(),
  diastolicBp: z.number().int().optional(),
  heartRate: z.number().int().optional(),
  weightKg: z.number().optional(),
  heightCm: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  oxygenSaturation: z.number().int().optional(),
  notes: z.string().optional()
});

export const VoidDentalInvoiceRequestSchema = z.object({
  reason: z.string().min(5).max(500)
});

export const VoidDentalPaymentRequestSchema = z.object({
  voidReason: z.string()
});

export const ListAuditLogsQuery = z.object({
  resourceType: SafeQueryStringSchema.optional(),
  resource: UUIDSchema.optional(),
  user: UUIDSchema.optional(),
  action: AuditActionSchema.optional(),
  startDate: StrictUtcDateTimeSchema.optional(),
  endDate: StrictUtcDateTimeSchema.optional(),
  orderBy: SafeQueryStringSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuery>;

export const ListAuditLogsResponse = z.object({
  data: z.array(AuditLogEntrySchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const CreateInvoiceBody = CreateInvoiceRequestSchema;
export type CreateInvoiceBody = z.infer<typeof CreateInvoiceBody>;

export const CreateInvoiceResponse = InvoiceSchema;

export const ListInvoicesQuery = z.object({
  customer: UUIDSchema.optional(),
  merchant: UUIDSchema.optional(),
  status: InvoiceStatusSchema.optional(),
  context: SafeQueryStringSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListInvoicesQuery = z.infer<typeof ListInvoicesQuery>;

export const ListInvoicesResponse = z.object({
  data: z.array(InvoiceSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetInvoiceParams = z.object({
  invoice: UUIDSchema,
});
export type GetInvoiceParams = z.infer<typeof GetInvoiceParams>;

export const GetInvoiceQuery = z.object({
  expand: z.string().optional(),
});
export type GetInvoiceQuery = z.infer<typeof GetInvoiceQuery>;

export const GetInvoiceResponse = InvoiceSchema;

export const UpdateInvoiceParams = z.object({
  invoice: UUIDSchema,
});
export type UpdateInvoiceParams = z.infer<typeof UpdateInvoiceParams>;

export const UpdateInvoiceBody = UpdateInvoiceRequestSchema;
export type UpdateInvoiceBody = z.infer<typeof UpdateInvoiceBody>;

export const UpdateInvoiceResponse = InvoiceSchema;

export const DeleteInvoiceParams = z.object({
  invoice: UUIDSchema,
});
export type DeleteInvoiceParams = z.infer<typeof DeleteInvoiceParams>;

export const DeleteInvoiceResponse = z.void();

export const CaptureInvoicePaymentParams = z.object({
  invoice: UUIDSchema,
});
export type CaptureInvoicePaymentParams = z.infer<typeof CaptureInvoicePaymentParams>;

export const CaptureInvoicePaymentResponse = InvoiceSchema;

export const FinalizeInvoiceParams = z.object({
  invoice: UUIDSchema,
});
export type FinalizeInvoiceParams = z.infer<typeof FinalizeInvoiceParams>;

export const FinalizeInvoiceResponse = InvoiceSchema;

export const MarkInvoiceUncollectibleParams = z.object({
  invoice: UUIDSchema,
});
export type MarkInvoiceUncollectibleParams = z.infer<typeof MarkInvoiceUncollectibleParams>;

export const MarkInvoiceUncollectibleResponse = InvoiceSchema;

export const PayInvoiceParams = z.object({
  invoice: UUIDSchema,
});
export type PayInvoiceParams = z.infer<typeof PayInvoiceParams>;

export const PayInvoiceBody = PaymentRequestSchema;
export type PayInvoiceBody = z.infer<typeof PayInvoiceBody>;

export const PayInvoiceResponse = PaymentResponseSchema;

export const RefundInvoicePaymentParams = z.object({
  invoice: UUIDSchema,
});
export type RefundInvoicePaymentParams = z.infer<typeof RefundInvoicePaymentParams>;

export const RefundInvoicePaymentBody = RefundRequestSchema;
export type RefundInvoicePaymentBody = z.infer<typeof RefundInvoicePaymentBody>;

export const RefundInvoicePaymentResponse = RefundResponseSchema;

export const VoidInvoiceParams = z.object({
  invoice: UUIDSchema,
});
export type VoidInvoiceParams = z.infer<typeof VoidInvoiceParams>;

export const VoidInvoiceResponse = InvoiceSchema;

export const CreateMerchantAccountBody = CreateMerchantAccountRequestSchema;
export type CreateMerchantAccountBody = z.infer<typeof CreateMerchantAccountBody>;

export const CreateMerchantAccountResponse = MerchantAccountSchema;

export const GetMerchantAccountParams = z.object({
  merchantAccount: z.union([UUIDSchema, z.enum(["me"])]),
});
export type GetMerchantAccountParams = z.infer<typeof GetMerchantAccountParams>;

export const GetMerchantAccountQuery = z.object({
  expand: z.string().optional(),
});
export type GetMerchantAccountQuery = z.infer<typeof GetMerchantAccountQuery>;

export const GetMerchantAccountResponse = MerchantAccountSchema;

export const GetMerchantDashboardParams = z.object({
  merchantAccount: z.union([UUIDSchema, z.enum(["me"])]),
});
export type GetMerchantDashboardParams = z.infer<typeof GetMerchantDashboardParams>;

export const GetMerchantDashboardResponse = DashboardResponseSchema;

export const OnboardMerchantAccountParams = z.object({
  merchantAccount: UUIDSchema,
});
export type OnboardMerchantAccountParams = z.infer<typeof OnboardMerchantAccountParams>;

export const OnboardMerchantAccountBody = OnboardingRequestSchema;
export type OnboardMerchantAccountBody = z.infer<typeof OnboardMerchantAccountBody>;

export const OnboardMerchantAccountResponse = OnboardingResponseSchema;

export const HandleStripeWebhookBody = z.unknown();
export type HandleStripeWebhookBody = z.infer<typeof HandleStripeWebhookBody>;

export const HandleStripeWebhookResponse = z.unknown();

export const CreateBookingBody = BookingCreateRequestSchema;
export type CreateBookingBody = z.infer<typeof CreateBookingBody>;

export const CreateBookingResponse = BookingSchema;

export const ListBookingsQuery = z.object({
  host: UUIDSchema.optional(),
  client: UUIDSchema.optional(),
  status: BookingStatusSchema.optional(),
  startDate: StrictUtcDateTimeSchema.optional(),
  endDate: StrictUtcDateTimeSchema.optional(),
  expand: z.string().optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListBookingsQuery = z.infer<typeof ListBookingsQuery>;

export const ListBookingsResponse = z.object({
  data: z.array(BookingSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetBookingParams = z.object({
  booking: UUIDSchema,
});
export type GetBookingParams = z.infer<typeof GetBookingParams>;

export const GetBookingQuery = z.object({
  expand: z.string().optional(),
});
export type GetBookingQuery = z.infer<typeof GetBookingQuery>;

export const GetBookingResponse = BookingSchema;

export const CancelBookingParams = z.object({
  booking: UUIDSchema,
});
export type CancelBookingParams = z.infer<typeof CancelBookingParams>;

export const CancelBookingBody = BookingActionRequestSchema;
export type CancelBookingBody = z.infer<typeof CancelBookingBody>;

export const CancelBookingResponse = BookingSchema;

export const ConfirmBookingParams = z.object({
  booking: UUIDSchema,
});
export type ConfirmBookingParams = z.infer<typeof ConfirmBookingParams>;

export const ConfirmBookingBody = BookingActionRequestSchema;
export type ConfirmBookingBody = z.infer<typeof ConfirmBookingBody>;

export const ConfirmBookingResponse = BookingSchema;

export const MarkNoShowBookingParams = z.object({
  booking: UUIDSchema,
});
export type MarkNoShowBookingParams = z.infer<typeof MarkNoShowBookingParams>;

export const MarkNoShowBookingBody = BookingActionRequestSchema;
export type MarkNoShowBookingBody = z.infer<typeof MarkNoShowBookingBody>;

export const MarkNoShowBookingResponse = BookingSchema;

export const RejectBookingParams = z.object({
  booking: UUIDSchema,
});
export type RejectBookingParams = z.infer<typeof RejectBookingParams>;

export const RejectBookingBody = BookingActionRequestSchema;
export type RejectBookingBody = z.infer<typeof RejectBookingBody>;

export const RejectBookingResponse = BookingSchema;

export const ListBookingEventsQuery = z.object({
  owner: UUIDSchema.optional(),
  context: SafeQueryStringSchema.optional(),
  locationType: LocationTypeSchema.optional(),
  status: BookingEventStatusSchema.optional(),
  availableFrom: StrictUtcDateTimeSchema.optional(),
  availableTo: StrictUtcDateTimeSchema.optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  expand: z.string().optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListBookingEventsQuery = z.infer<typeof ListBookingEventsQuery>;

export const ListBookingEventsResponse = z.object({
  data: z.array(BookingEventSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const CreateBookingEventBody = BookingEventCreateRequestSchema;
export type CreateBookingEventBody = z.infer<typeof CreateBookingEventBody>;

export const CreateBookingEventResponse = BookingEventSchema;

export const GetBookingEventParams = z.object({
  event: z.union([UUIDSchema, z.enum(["me"])]),
});
export type GetBookingEventParams = z.infer<typeof GetBookingEventParams>;

export const GetBookingEventQuery = z.object({
  expand: z.string().optional(),
});
export type GetBookingEventQuery = z.infer<typeof GetBookingEventQuery>;

export const GetBookingEventResponse = BookingEventSchema;

export const UpdateBookingEventParams = z.object({
  event: UUIDSchema,
});
export type UpdateBookingEventParams = z.infer<typeof UpdateBookingEventParams>;

export const UpdateBookingEventBody = BookingEventUpdateRequestSchema;
export type UpdateBookingEventBody = z.infer<typeof UpdateBookingEventBody>;

export const UpdateBookingEventResponse = BookingEventSchema;

export const DeleteBookingEventParams = z.object({
  event: UUIDSchema,
});
export type DeleteBookingEventParams = z.infer<typeof DeleteBookingEventParams>;

export const DeleteBookingEventResponse = z.void();

export const CreateScheduleExceptionParams = z.object({
  event: UUIDSchema,
});
export type CreateScheduleExceptionParams = z.infer<typeof CreateScheduleExceptionParams>;

export const CreateScheduleExceptionBody = ScheduleExceptionCreateRequestSchema;
export type CreateScheduleExceptionBody = z.infer<typeof CreateScheduleExceptionBody>;

export const CreateScheduleExceptionResponse = ScheduleExceptionSchema;

export const ListScheduleExceptionsParams = z.object({
  event: UUIDSchema,
});
export type ListScheduleExceptionsParams = z.infer<typeof ListScheduleExceptionsParams>;

export const ListScheduleExceptionsQuery = z.object({
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListScheduleExceptionsQuery = z.infer<typeof ListScheduleExceptionsQuery>;

export const ListScheduleExceptionsResponse = z.object({
  data: z.array(ScheduleExceptionSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetScheduleExceptionParams = z.object({
  event: UUIDSchema,
  exception: UUIDSchema,
});
export type GetScheduleExceptionParams = z.infer<typeof GetScheduleExceptionParams>;

export const GetScheduleExceptionResponse = ScheduleExceptionSchema;

export const DeleteScheduleExceptionParams = z.object({
  event: UUIDSchema,
  exception: UUIDSchema,
});
export type DeleteScheduleExceptionParams = z.infer<typeof DeleteScheduleExceptionParams>;

export const DeleteScheduleExceptionResponse = z.void();

export const ListEventSlotsParams = z.object({
  event: UUIDSchema,
});
export type ListEventSlotsParams = z.infer<typeof ListEventSlotsParams>;

export const ListEventSlotsQuery = z.object({
  startTime: StrictUtcDateTimeSchema.optional(),
  endTime: StrictUtcDateTimeSchema.optional(),
  status: SlotStatusSchema.optional(),
});
export type ListEventSlotsQuery = z.infer<typeof ListEventSlotsQuery>;

export const ListEventSlotsResponse = z.array(TimeSlotSchema);

export const GetTimeSlotParams = z.object({
  slotId: UUIDSchema,
});
export type GetTimeSlotParams = z.infer<typeof GetTimeSlotParams>;

export const GetTimeSlotQuery = z.object({
  expand: z.string().optional(),
});
export type GetTimeSlotQuery = z.infer<typeof GetTimeSlotQuery>;

export const GetTimeSlotResponse = TimeSlotSchema;

export const CreateChatRoomBody = CreateChatRoomRequestSchema;
export type CreateChatRoomBody = z.infer<typeof CreateChatRoomBody>;

export const CreateChatRoomResponse = ChatRoomSchema;

export const ListChatRoomsQuery = z.object({
  status: ChatRoomStatusSchema.optional(),
  context: UUIDSchema.optional(),
  withParticipant: UUIDSchema.optional(),
  hasActiveCall: z.coerce.boolean().optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListChatRoomsQuery = z.infer<typeof ListChatRoomsQuery>;

export const ListChatRoomsResponse = z.object({
  data: z.array(ChatRoomSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetChatRoomParams = z.object({
  room: UUIDSchema,
});
export type GetChatRoomParams = z.infer<typeof GetChatRoomParams>;

export const GetChatRoomResponse = ChatRoomSchema;

export const GetChatMessagesParams = z.object({
  room: UUIDSchema,
});
export type GetChatMessagesParams = z.infer<typeof GetChatMessagesParams>;

export const GetChatMessagesQuery = z.object({
  messageType: MessageTypeSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type GetChatMessagesQuery = z.infer<typeof GetChatMessagesQuery>;

export const GetChatMessagesResponse = z.object({
  data: z.array(ChatMessageSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const SendChatMessageParams = z.object({
  room: UUIDSchema,
});
export type SendChatMessageParams = z.infer<typeof SendChatMessageParams>;

export const SendChatMessageBody = z.union([SendTextMessageRequestSchema, StartVideoCallRequestSchema]);
export type SendChatMessageBody = z.infer<typeof SendChatMessageBody>;

export const SendChatMessageResponse = ChatMessageSchema;

export const EndVideoCallParams = z.object({
  room: UUIDSchema,
});
export type EndVideoCallParams = z.infer<typeof EndVideoCallParams>;

export const EndVideoCallResponse = VideoCallEndResponseSchema;

export const JoinVideoCallParams = z.object({
  room: UUIDSchema,
});
export type JoinVideoCallParams = z.infer<typeof JoinVideoCallParams>;

export const JoinVideoCallBody = JoinVideoCallRequestSchema;
export type JoinVideoCallBody = z.infer<typeof JoinVideoCallBody>;

export const JoinVideoCallResponse = VideoCallJoinResponseSchema;

export const LeaveVideoCallParams = z.object({
  room: UUIDSchema,
});
export type LeaveVideoCallParams = z.infer<typeof LeaveVideoCallParams>;

export const LeaveVideoCallResponse = LeaveVideoCallResponseSchema;

export const UpdateVideoCallParticipantParams = z.object({
  room: UUIDSchema,
});
export type UpdateVideoCallParticipantParams = z.infer<typeof UpdateVideoCallParticipantParams>;

export const UpdateVideoCallParticipantBody = UpdateParticipantRequestSchema;
export type UpdateVideoCallParticipantBody = z.infer<typeof UpdateVideoCallParticipantBody>;

export const UpdateVideoCallParticipantResponse = CallParticipantSchema;

export const GetIceServersResponse = IceServersResponseSchema;

export const CreateAppointmentBody = CreateAppointmentRequestSchema;
export type CreateAppointmentBody = z.infer<typeof CreateAppointmentBody>;

export const CreateAppointmentResponse = DentalAppointmentSchema;

export const ListAppointmentsQuery = z.object({
  branchId: UUIDSchema,
  date_from: z.string(),
  date_to: z.string(),
  providerId: UUIDSchema.optional(),
  patientId: UUIDSchema.optional(),
  status: AppointmentStatusSchema.optional(),
  page: z.coerce.number().int().gte(1).optional(),
  per_page: z.coerce.number().int().gte(1).lte(200).optional(),
});
export type ListAppointmentsQuery = z.infer<typeof ListAppointmentsQuery>;

export const ListAppointmentsResponse = z.array(DentalAppointmentSchema);

export const GetAppointmentParams = z.object({
  appointmentId: UUIDSchema,
});
export type GetAppointmentParams = z.infer<typeof GetAppointmentParams>;

export const GetAppointmentResponse = DentalAppointmentSchema;

export const UpdateAppointmentParams = z.object({
  appointmentId: UUIDSchema,
});
export type UpdateAppointmentParams = z.infer<typeof UpdateAppointmentParams>;

export const UpdateAppointmentBody = UpdateAppointmentRequestSchema;
export type UpdateAppointmentBody = z.infer<typeof UpdateAppointmentBody>;

export const UpdateAppointmentResponse = DentalAppointmentSchema;

export const CancelAppointmentParams = z.object({
  appointmentId: UUIDSchema,
});
export type CancelAppointmentParams = z.infer<typeof CancelAppointmentParams>;

export const CancelAppointmentQuery = z.object({
  reason: z.string().optional(),
});
export type CancelAppointmentQuery = z.infer<typeof CancelAppointmentQuery>;

export const CancelAppointmentResponse = z.void();

export const CheckInAppointmentParams = z.object({
  appointmentId: UUIDSchema,
});
export type CheckInAppointmentParams = z.infer<typeof CheckInAppointmentParams>;

export const CheckInAppointmentResponse = CheckInResponseSchema;

export const ConfirmAppointmentParams = z.object({
  appointmentId: UUIDSchema,
});
export type ConfirmAppointmentParams = z.infer<typeof ConfirmAppointmentParams>;

export const ConfirmAppointmentResponse = DentalAppointmentSchema;

export const CreateQueueItemParams = z.object({
  appointmentId: UUIDSchema,
});
export type CreateQueueItemParams = z.infer<typeof CreateQueueItemParams>;

export const CreateQueueItemBody = DentalQueueModuleCreateQueueItemRequestSchema;
export type CreateQueueItemBody = z.infer<typeof CreateQueueItemBody>;

export const CreateQueueItemResponse = ErrorResponseSchema;

export const GetAuditEventsQuery = z.object({
  branchId: UUIDSchema,
  actorId: UUIDSchema.optional(),
  eventType: DentalAuditModuleDentalAuditEventTypeSchema.optional(),
  action: SafeQueryStringSchema.optional(),
  targetType: SafeQueryStringSchema.optional(),
  targetId: UUIDSchema.optional(),
  from: StrictUtcDateTimeSchema.optional(),
  to: StrictUtcDateTimeSchema.optional(),
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});
export type GetAuditEventsQuery = z.infer<typeof GetAuditEventsQuery>;

export const GetAuditEventsResponse = z.union([DentalAuditModuleDentalAuditEventsResponseSchema, ErrorResponseSchema]);

export const CreateInsuranceClaimBody = CreateInsuranceClaimRequestSchema;
export type CreateInsuranceClaimBody = z.infer<typeof CreateInsuranceClaimBody>;

export const CreateInsuranceClaimResponse = ErrorResponseSchema;

export const ListInsuranceClaimsQuery = z.object({
  branchId: UUIDSchema.optional(),
  status: InsuranceClaimStatusSchema.optional(),
  insuranceProfileId: UUIDSchema.optional(),
  patientId: UUIDSchema.optional(),
});
export type ListInsuranceClaimsQuery = z.infer<typeof ListInsuranceClaimsQuery>;

export const ListInsuranceClaimsResponse = z.union([InsuranceClaimListSchema, ErrorResponseSchema]);

export const GetPayerArAgingQuery = z.object({
  branchId: UUIDSchema.optional(),
  asOf: z.string().datetime().transform((str) => new Date(str)).optional(),
});
export type GetPayerArAgingQuery = z.infer<typeof GetPayerArAgingQuery>;

export const GetPayerArAgingResponse = z.union([PayerArAgingResponseSchema, ErrorResponseSchema]);

export const GetInsuranceClaimParams = z.object({
  claimId: UUIDSchema,
});
export type GetInsuranceClaimParams = z.infer<typeof GetInsuranceClaimParams>;

export const GetInsuranceClaimResponse = z.union([InsuranceClaimWithLinesSchema, ErrorResponseSchema]);

export const AddInsuranceClaimLineParams = z.object({
  claimId: UUIDSchema,
});
export type AddInsuranceClaimLineParams = z.infer<typeof AddInsuranceClaimLineParams>;

export const AddInsuranceClaimLineBody = CreateInsuranceClaimLineRequestSchema;
export type AddInsuranceClaimLineBody = z.infer<typeof AddInsuranceClaimLineBody>;

export const AddInsuranceClaimLineResponse = ErrorResponseSchema;

export const UpdateInsuranceClaimLineParams = z.object({
  claimId: UUIDSchema,
  lineId: UUIDSchema,
});
export type UpdateInsuranceClaimLineParams = z.infer<typeof UpdateInsuranceClaimLineParams>;

export const UpdateInsuranceClaimLineBody = UpdateInsuranceClaimLineRequestSchema;
export type UpdateInsuranceClaimLineBody = z.infer<typeof UpdateInsuranceClaimLineBody>;

export const UpdateInsuranceClaimLineResponse = z.union([InsuranceClaimLineSchema, ErrorResponseSchema]);

export const RecordClaimRemittanceParams = z.object({
  claimId: UUIDSchema,
});
export type RecordClaimRemittanceParams = z.infer<typeof RecordClaimRemittanceParams>;

export const RecordClaimRemittanceBody = RecordRemittanceRequestSchema;
export type RecordClaimRemittanceBody = z.infer<typeof RecordClaimRemittanceBody>;

export const RecordClaimRemittanceResponse = ErrorResponseSchema;

export const UpdateInsuranceClaimStatusParams = z.object({
  claimId: UUIDSchema,
});
export type UpdateInsuranceClaimStatusParams = z.infer<typeof UpdateInsuranceClaimStatusParams>;

export const UpdateInsuranceClaimStatusBody = UpdateInsuranceClaimStatusRequestSchema;
export type UpdateInsuranceClaimStatusBody = z.infer<typeof UpdateInsuranceClaimStatusBody>;

export const UpdateInsuranceClaimStatusResponse = z.union([InsuranceClaimSchema, ErrorResponseSchema]);

export const GetArAgingQuery = z.object({
  branchId: UUIDSchema.optional(),
  asOf: z.string().datetime().transform((str) => new Date(str)).optional(),
});
export type GetArAgingQuery = z.infer<typeof GetArAgingQuery>;

export const GetArAgingResponse = ArAgingResponseSchema;

export const GetCollectionsSummaryQuery = z.object({
  branchId: UUIDSchema.optional(),
  period: z.string().optional(),
});
export type GetCollectionsSummaryQuery = z.infer<typeof GetCollectionsSummaryQuery>;

export const GetCollectionsSummaryResponse = CollectionsSummaryResponseSchema;

export const EstimateClaimCoverageBody = CoverageEstimateRequestSchema;
export type EstimateClaimCoverageBody = z.infer<typeof EstimateClaimCoverageBody>;

export const EstimateClaimCoverageResponse = z.union([CoverageEstimateResultSchema, ErrorResponseSchema]);

export const CreateDentalInvoiceBody = CreateDentalInvoiceRequestSchema;
export type CreateDentalInvoiceBody = z.infer<typeof CreateDentalInvoiceBody>;

export const CreateDentalInvoiceResponse = DentalInvoiceSchema;

export const ListDentalInvoicesQuery = z.object({
  patientId: UUIDSchema.optional(),
  branchId: UUIDSchema.optional(),
  status: DentalInvoiceStatusSchema.optional(),
});
export type ListDentalInvoicesQuery = z.infer<typeof ListDentalInvoicesQuery>;

export const ListDentalInvoicesResponse = z.object({
  data: z.array(DentalInvoiceSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetDentalInvoiceParams = z.object({
  invoiceId: UUIDSchema,
});
export type GetDentalInvoiceParams = z.infer<typeof GetDentalInvoiceParams>;

export const GetDentalInvoiceResponse = DentalInvoiceSchema;

export const ApplyDentalDiscountParams = z.object({
  invoiceId: UUIDSchema,
});
export type ApplyDentalDiscountParams = z.infer<typeof ApplyDentalDiscountParams>;

export const ApplyDentalDiscountBody = ApplyDentalDiscountRequestSchema;
export type ApplyDentalDiscountBody = z.infer<typeof ApplyDentalDiscountBody>;

export const ApplyDentalDiscountResponse = DentalInvoiceSchema;

export const IssueDentalInvoiceParams = z.object({
  invoiceId: UUIDSchema,
});
export type IssueDentalInvoiceParams = z.infer<typeof IssueDentalInvoiceParams>;

export const IssueDentalInvoiceResponse = DentalInvoiceSchema;

export const RecordDentalPaymentParams = z.object({
  invoiceId: UUIDSchema,
});
export type RecordDentalPaymentParams = z.infer<typeof RecordDentalPaymentParams>;

export const RecordDentalPaymentBody = RecordDentalPaymentRequestSchema;
export type RecordDentalPaymentBody = z.infer<typeof RecordDentalPaymentBody>;

export const RecordDentalPaymentResponse = DentalPaymentSchema;

export const ListDentalPaymentsParams = z.object({
  invoiceId: UUIDSchema,
});
export type ListDentalPaymentsParams = z.infer<typeof ListDentalPaymentsParams>;

export const ListDentalPaymentsResponse = z.object({
  data: z.array(DentalPaymentSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetDentalPaymentReceiptParams = z.object({
  invoiceId: UUIDSchema,
  paymentId: UUIDSchema,
});
export type GetDentalPaymentReceiptParams = z.infer<typeof GetDentalPaymentReceiptParams>;

export const GetDentalPaymentReceiptResponse = DentalPaymentReceiptResponseSchema;

export const VoidDentalPaymentParams = z.object({
  invoiceId: UUIDSchema,
  paymentId: UUIDSchema,
});
export type VoidDentalPaymentParams = z.infer<typeof VoidDentalPaymentParams>;

export const VoidDentalPaymentBody = VoidDentalPaymentRequestSchema;
export type VoidDentalPaymentBody = z.infer<typeof VoidDentalPaymentBody>;

export const VoidDentalPaymentResponse = DentalPaymentSchema;

export const CreateDentalPaymentPlanParams = z.object({
  invoiceId: UUIDSchema,
});
export type CreateDentalPaymentPlanParams = z.infer<typeof CreateDentalPaymentPlanParams>;

export const CreateDentalPaymentPlanBody = CreateDentalPaymentPlanRequestSchema;
export type CreateDentalPaymentPlanBody = z.infer<typeof CreateDentalPaymentPlanBody>;

export const CreateDentalPaymentPlanResponse = DentalPaymentPlanSchema;

export const GetDentalPaymentPlanParams = z.object({
  invoiceId: UUIDSchema,
});
export type GetDentalPaymentPlanParams = z.infer<typeof GetDentalPaymentPlanParams>;

export const GetDentalPaymentPlanResponse = DentalPaymentPlanSchema;

export const MarkUncollectibleParams = z.object({
  invoiceId: UUIDSchema,
});
export type MarkUncollectibleParams = z.infer<typeof MarkUncollectibleParams>;

export const MarkUncollectibleResponse = DentalInvoiceSchema;

export const VoidDentalInvoiceParams = z.object({
  invoiceId: UUIDSchema,
});
export type VoidDentalInvoiceParams = z.infer<typeof VoidDentalInvoiceParams>;

export const VoidDentalInvoiceBody = VoidDentalInvoiceRequestSchema;
export type VoidDentalInvoiceBody = z.infer<typeof VoidDentalInvoiceBody>;

export const VoidDentalInvoiceResponse = DentalInvoiceSchema;

export const GetPatientBalanceParams = z.object({
  patientId: UUIDSchema,
});
export type GetPatientBalanceParams = z.infer<typeof GetPatientBalanceParams>;

export const GetPatientBalanceResponse = PatientBalanceResponseSchema;

export const GenerateStatementBatchBody = GenerateStatementBatchRequestSchema;
export type GenerateStatementBatchBody = z.infer<typeof GenerateStatementBatchBody>;

export const GenerateStatementBatchResponse = GenerateStatementBatchResponseSchema;

export const GetBranchesByUserResponse = z.union([DentalOrgModuleBranchListSchema, ErrorResponseSchema]);

export const ListConsentTemplatesParams = z.object({
  branchId: UUIDSchema,
});
export type ListConsentTemplatesParams = z.infer<typeof ListConsentTemplatesParams>;

export const ListConsentTemplatesResponse = z.array(DentalOrgModuleDentalConsentTemplateSchema);

export const CreateConsentTemplateParams = z.object({
  branchId: UUIDSchema,
});
export type CreateConsentTemplateParams = z.infer<typeof CreateConsentTemplateParams>;

export const CreateConsentTemplateBody = DentalOrgModuleCreateDentalConsentTemplateRequestSchema;
export type CreateConsentTemplateBody = z.infer<typeof CreateConsentTemplateBody>;

export const CreateConsentTemplateResponse = DentalOrgModuleDentalConsentTemplateSchema;

export const UpdateConsentTemplateParams = z.object({
  branchId: UUIDSchema,
  id: UUIDSchema,
});
export type UpdateConsentTemplateParams = z.infer<typeof UpdateConsentTemplateParams>;

export const UpdateConsentTemplateBody = DentalOrgModuleUpdateDentalConsentTemplateRequestSchema;
export type UpdateConsentTemplateBody = z.infer<typeof UpdateConsentTemplateBody>;

export const UpdateConsentTemplateResponse = DentalOrgModuleDentalConsentTemplateSchema;

export const DeleteConsentTemplateParams = z.object({
  branchId: UUIDSchema,
  id: UUIDSchema,
});
export type DeleteConsentTemplateParams = z.infer<typeof DeleteConsentTemplateParams>;

export const DeleteConsentTemplateResponse = z.record(z.string(), z.unknown());

export const CreateInventoryItemParams = z.object({
  branchId: UUIDSchema,
});
export type CreateInventoryItemParams = z.infer<typeof CreateInventoryItemParams>;

export const CreateInventoryItemBody = DentalClinicalOpsModuleCreateInventoryItemRequestSchema;
export type CreateInventoryItemBody = z.infer<typeof CreateInventoryItemBody>;

export const CreateInventoryItemResponse = ErrorResponseSchema;

export const ListInventoryItemsParams = z.object({
  branchId: UUIDSchema,
});
export type ListInventoryItemsParams = z.infer<typeof ListInventoryItemsParams>;

export const ListInventoryItemsResponse = z.union([z.object({
  data: z.array(DentalClinicalOpsModuleInventoryItemSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
}), ErrorResponseSchema]);

export const UpdateInventoryItemParams = z.object({
  branchId: UUIDSchema,
  itemId: UUIDSchema,
});
export type UpdateInventoryItemParams = z.infer<typeof UpdateInventoryItemParams>;

export const UpdateInventoryItemBody = DentalClinicalOpsModuleUpdateInventoryItemRequestSchema;
export type UpdateInventoryItemBody = z.infer<typeof UpdateInventoryItemBody>;

export const UpdateInventoryItemResponse = z.union([DentalClinicalOpsModuleInventoryItemSchema, ErrorResponseSchema]);

export const CreateInventoryAdjustmentParams = z.object({
  branchId: UUIDSchema,
  itemId: UUIDSchema,
});
export type CreateInventoryAdjustmentParams = z.infer<typeof CreateInventoryAdjustmentParams>;

export const CreateInventoryAdjustmentBody = DentalClinicalOpsModuleCreateInventoryAdjustmentRequestSchema;
export type CreateInventoryAdjustmentBody = z.infer<typeof CreateInventoryAdjustmentBody>;

export const CreateInventoryAdjustmentResponse = ErrorResponseSchema;

export const ListInventoryAdjustmentsParams = z.object({
  branchId: UUIDSchema,
  itemId: UUIDSchema,
});
export type ListInventoryAdjustmentsParams = z.infer<typeof ListInventoryAdjustmentsParams>;

export const ListInventoryAdjustmentsResponse = z.union([z.object({
  data: z.array(DentalClinicalOpsModuleInventoryAdjustmentSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
}), ErrorResponseSchema]);

export const CreatePostopTemplateParams = z.object({
  branchId: UUIDSchema,
});
export type CreatePostopTemplateParams = z.infer<typeof CreatePostopTemplateParams>;

export const CreatePostopTemplateBody = DentalClinicalOpsModuleCreatePostopTemplateRequestSchema;
export type CreatePostopTemplateBody = z.infer<typeof CreatePostopTemplateBody>;

export const CreatePostopTemplateResponse = ErrorResponseSchema;

export const ListPostopTemplatesParams = z.object({
  branchId: UUIDSchema,
});
export type ListPostopTemplatesParams = z.infer<typeof ListPostopTemplatesParams>;

export const ListPostopTemplatesQuery = z.object({
  category: DentalClinicalOpsModulePostopCategorySchema.optional(),
});
export type ListPostopTemplatesQuery = z.infer<typeof ListPostopTemplatesQuery>;

export const ListPostopTemplatesResponse = z.union([z.object({
  data: z.array(DentalClinicalOpsModulePostopTemplateSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
}), ErrorResponseSchema]);

export const UpdatePostopTemplateParams = z.object({
  branchId: UUIDSchema,
  templateId: UUIDSchema,
});
export type UpdatePostopTemplateParams = z.infer<typeof UpdatePostopTemplateParams>;

export const UpdatePostopTemplateBody = DentalClinicalOpsModuleUpdatePostopTemplateRequestSchema;
export type UpdatePostopTemplateBody = z.infer<typeof UpdatePostopTemplateBody>;

export const UpdatePostopTemplateResponse = z.union([DentalClinicalOpsModulePostopTemplateSchema, ErrorResponseSchema]);

export const ListQueueBoardParams = z.object({
  branchId: UUIDSchema,
});
export type ListQueueBoardParams = z.infer<typeof ListQueueBoardParams>;

export const ListQueueBoardResponse = z.union([z.array(DentalQueueModuleQueueItemSchema), ErrorResponseSchema]);

export const GetBranchSettingsParams = z.object({
  branchId: UUIDSchema,
});
export type GetBranchSettingsParams = z.infer<typeof GetBranchSettingsParams>;

export const GetBranchSettingsResponse = DentalOrgModuleDentalBranchSettingsSchema;

export const UpdateBranchSettingsParams = z.object({
  branchId: UUIDSchema,
});
export type UpdateBranchSettingsParams = z.infer<typeof UpdateBranchSettingsParams>;

export const UpdateBranchSettingsBody = DentalOrgModuleUpdateDentalBranchSettingsRequestSchema;
export type UpdateBranchSettingsBody = z.infer<typeof UpdateBranchSettingsBody>;

export const UpdateBranchSettingsResponse = DentalOrgModuleDentalBranchSettingsSchema;

export const CreateWaitlistEntryParams = z.object({
  branchId: UUIDSchema,
});
export type CreateWaitlistEntryParams = z.infer<typeof CreateWaitlistEntryParams>;

export const CreateWaitlistEntryBody = DentalWaitlistModuleCreateWaitlistEntryRequestSchema;
export type CreateWaitlistEntryBody = z.infer<typeof CreateWaitlistEntryBody>;

export const CreateWaitlistEntryResponse = ErrorResponseSchema;

export const ListWaitlistParams = z.object({
  branchId: UUIDSchema,
});
export type ListWaitlistParams = z.infer<typeof ListWaitlistParams>;

export const ListWaitlistQuery = z.object({
  status: DentalWaitlistModuleWaitlistEntryStatusSchema.optional(),
});
export type ListWaitlistQuery = z.infer<typeof ListWaitlistQuery>;

export const ListWaitlistResponse = z.union([z.array(DentalWaitlistModuleWaitlistEntrySchema), ErrorResponseSchema]);

export const GetWorkingHoursParams = z.object({
  branchId: UUIDSchema,
});
export type GetWorkingHoursParams = z.infer<typeof GetWorkingHoursParams>;

export const GetWorkingHoursResponse = DentalOrgModuleDentalWorkingHoursResponseSchema;

export const UpdateWorkingHoursParams = z.object({
  branchId: UUIDSchema,
});
export type UpdateWorkingHoursParams = z.infer<typeof UpdateWorkingHoursParams>;

export const UpdateWorkingHoursBody = DentalOrgModuleUpdateWorkingHoursRequestSchema;
export type UpdateWorkingHoursBody = z.infer<typeof UpdateWorkingHoursBody>;

export const UpdateWorkingHoursResponse = DentalOrgModuleDentalWorkingHoursResponseSchema;

export const CreateMedicalHistoryEntryBody = CreateMedicalHistoryEntryRequestSchema;
export type CreateMedicalHistoryEntryBody = z.infer<typeof CreateMedicalHistoryEntryBody>;

export const CreateMedicalHistoryEntryResponse = MedicalHistoryEntrySchema;

export const ListMedicalHistoryQuery = z.object({
  patientId: UUIDSchema,
});
export type ListMedicalHistoryQuery = z.infer<typeof ListMedicalHistoryQuery>;

export const ListMedicalHistoryResponse = z.object({
  data: z.array(MedicalHistoryEntrySchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const RecordMedicalHistoryReviewBody = RecordMedicalHistoryReviewRequestSchema;
export type RecordMedicalHistoryReviewBody = z.infer<typeof RecordMedicalHistoryReviewBody>;

export const RecordMedicalHistoryReviewResponse = MedicalHistoryReviewSchema;

export const GetMedicalHistoryReviewQuery = z.object({
  patientId: UUIDSchema,
});
export type GetMedicalHistoryReviewQuery = z.infer<typeof GetMedicalHistoryReviewQuery>;

export const GetMedicalHistoryReviewResponse = MedicalHistoryReviewSchema;

export const UpdateMedicalHistoryEntryParams = z.object({
  entryId: UUIDSchema,
});
export type UpdateMedicalHistoryEntryParams = z.infer<typeof UpdateMedicalHistoryEntryParams>;

export const UpdateMedicalHistoryEntryBody = UpdateMedicalHistoryEntryRequestSchema;
export type UpdateMedicalHistoryEntryBody = z.infer<typeof UpdateMedicalHistoryEntryBody>;

export const UpdateMedicalHistoryEntryResponse = MedicalHistoryEntrySchema;

export const GetDashboardSummaryQuery = z.object({
  branchId: UUIDSchema.optional(),
});
export type GetDashboardSummaryQuery = z.infer<typeof GetDashboardSummaryQuery>;

export const GetDashboardSummaryResponse = DentalOrgModuleDashboardSummaryResponseSchema;

export const RequestErasureBody = DentalErasureModuleRequestErasureRequestSchema;
export type RequestErasureBody = z.infer<typeof RequestErasureBody>;

export const RequestErasureResponse = ErrorResponseSchema;

export const ListErasureRequestsQuery = z.object({
  status: DentalErasureModuleErasureRequestStatusSchema.optional(),
  subjectPersonId: UUIDSchema.optional(),
  tenantId: UUIDSchema.optional(),
});
export type ListErasureRequestsQuery = z.infer<typeof ListErasureRequestsQuery>;

export const ListErasureRequestsResponse = z.union([DentalErasureModuleErasureRequestListSchema, ErrorResponseSchema]);

export const GetErasureRequestParams = z.object({
  id: UUIDSchema,
});
export type GetErasureRequestParams = z.infer<typeof GetErasureRequestParams>;

export const GetErasureRequestResponse = z.union([DentalErasureModuleErasureRequestSchema, ErrorResponseSchema]);

export const ApproveErasureParams = z.object({
  id: UUIDSchema,
});
export type ApproveErasureParams = z.infer<typeof ApproveErasureParams>;

export const ApproveErasureBody = DentalErasureModuleApproveErasureRequestSchema;
export type ApproveErasureBody = z.infer<typeof ApproveErasureBody>;

export const ApproveErasureResponse = z.union([DentalErasureModuleErasureRequestSchema, ErrorResponseSchema]);

export const RejectErasureParams = z.object({
  id: UUIDSchema,
});
export type RejectErasureParams = z.infer<typeof RejectErasureParams>;

export const RejectErasureBody = DentalErasureModuleRejectErasureRequestSchema;
export type RejectErasureBody = z.infer<typeof RejectErasureBody>;

export const RejectErasureResponse = z.union([DentalErasureModuleErasureRequestSchema, ErrorResponseSchema]);

export const GetFeeScheduleQuery = z.object({
  branchId: UUIDSchema.optional(),
});
export type GetFeeScheduleQuery = z.infer<typeof GetFeeScheduleQuery>;

export const GetFeeScheduleResponse = z.union([DentalFeeScheduleModuleFeeScheduleListSchema, ErrorResponseSchema]);

export const UpdateFeeScheduleEntryParams = z.object({
  cdt: z.string(),
});
export type UpdateFeeScheduleEntryParams = z.infer<typeof UpdateFeeScheduleEntryParams>;

export const UpdateFeeScheduleEntryBody = DentalFeeScheduleModuleUpdateFeeScheduleEntryRequestSchema;
export type UpdateFeeScheduleEntryBody = z.infer<typeof UpdateFeeScheduleEntryBody>;

export const UpdateFeeScheduleEntryResponse = z.union([DentalFeeScheduleModuleFeeScheduleEntryResponseSchema, ErrorResponseSchema]);

export const CreateHouseholdBody = DentalPatientFinanceModuleCreateHouseholdRequestSchema;
export type CreateHouseholdBody = z.infer<typeof CreateHouseholdBody>;

export const CreateHouseholdResponse = ErrorResponseSchema;

export const GetHouseholdParams = z.object({
  householdId: UUIDSchema,
});
export type GetHouseholdParams = z.infer<typeof GetHouseholdParams>;

export const GetHouseholdResponse = z.union([DentalPatientFinanceModuleHouseholdWithMembersSchema, ErrorResponseSchema]);

export const AddHouseholdMemberParams = z.object({
  householdId: UUIDSchema,
});
export type AddHouseholdMemberParams = z.infer<typeof AddHouseholdMemberParams>;

export const AddHouseholdMemberBody = DentalPatientFinanceModuleAddHouseholdMemberRequestSchema;
export type AddHouseholdMemberBody = z.infer<typeof AddHouseholdMemberBody>;

export const AddHouseholdMemberResponse = ErrorResponseSchema;

export const RemoveHouseholdMemberParams = z.object({
  householdId: UUIDSchema,
  patientId: UUIDSchema,
});
export type RemoveHouseholdMemberParams = z.infer<typeof RemoveHouseholdMemberParams>;

export const RemoveHouseholdMemberResponse = z.union([DentalPatientFinanceModuleHouseholdMemberSchema, ErrorResponseSchema]);

export const CephMgmt_createCephSuperimpositionBody = DentalImagingModuleCephSuperimpositionInputSchema;
export type CephMgmt_createCephSuperimpositionBody = z.infer<typeof CephMgmt_createCephSuperimpositionBody>;

export const CephMgmt_createCephSuperimpositionResponse = z.union([DentalImagingModuleCephSuperimpositionSchema, ErrorResponseSchema]);

export const CephMgmt_previewCephSuperimpositionBody = DentalImagingModuleCephSuperimpositionInputSchema;
export type CephMgmt_previewCephSuperimpositionBody = z.infer<typeof CephMgmt_previewCephSuperimpositionBody>;

export const CephMgmt_previewCephSuperimpositionResponse = z.union([DentalImagingModuleCephSuperimpositionSchema, ErrorResponseSchema]);

export const CephMgmt_getCephSuperimpositionParams = z.object({
  superimpositionId: z.string(),
});
export type CephMgmt_getCephSuperimpositionParams = z.infer<typeof CephMgmt_getCephSuperimpositionParams>;

export const CephMgmt_getCephSuperimpositionResponse = z.union([DentalImagingModuleCephSuperimpositionSchema, ErrorResponseSchema]);

export const ImagingFindingsMgmt_updateFindingParams = z.object({
  findingId: z.string(),
});
export type ImagingFindingsMgmt_updateFindingParams = z.infer<typeof ImagingFindingsMgmt_updateFindingParams>;

export const ImagingFindingsMgmt_updateFindingBody = DentalImagingModuleUpdateFindingBodySchema;
export type ImagingFindingsMgmt_updateFindingBody = z.infer<typeof ImagingFindingsMgmt_updateFindingBody>;

export const ImagingFindingsMgmt_updateFindingResponse = z.union([DentalImagingModuleImagingFindingSchema, ErrorResponseSchema]);

export const ImagingFindingsMgmt_deleteFindingParams = z.object({
  findingId: z.string(),
});
export type ImagingFindingsMgmt_deleteFindingParams = z.infer<typeof ImagingFindingsMgmt_deleteFindingParams>;

export const ImagingFindingsMgmt_deleteFindingResponse = ErrorResponseSchema;

export const ImagingMgmt_deleteImageParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_deleteImageParams = z.infer<typeof ImagingMgmt_deleteImageParams>;

export const ImagingMgmt_deleteImageResponse = ErrorResponseSchema;

export const ImagingMgmt_updateImageCalibrationParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_updateImageCalibrationParams = z.infer<typeof ImagingMgmt_updateImageCalibrationParams>;

export const ImagingMgmt_updateImageCalibrationBody = DentalImagingModuleUpdateCalibrationBodySchema;
export type ImagingMgmt_updateImageCalibrationBody = z.infer<typeof ImagingMgmt_updateImageCalibrationBody>;

export const ImagingMgmt_updateImageCalibrationResponse = z.union([DentalImagingModuleImagingStudyImageSchema, ErrorResponseSchema]);

export const CephMgmt_getCephAnalysisParams = z.object({
  imageId: z.string(),
});
export type CephMgmt_getCephAnalysisParams = z.infer<typeof CephMgmt_getCephAnalysisParams>;

export const CephMgmt_getCephAnalysisQuery = z.object({
  analysisType: z.string().optional(),
});
export type CephMgmt_getCephAnalysisQuery = z.infer<typeof CephMgmt_getCephAnalysisQuery>;

export const CephMgmt_getCephAnalysisResponse = z.union([DentalImagingModuleCephLandmarkListResponseSchema, ErrorResponseSchema]);

export const CephMgmt_recomputeCephAnalysisParams = z.object({
  imageId: z.string(),
});
export type CephMgmt_recomputeCephAnalysisParams = z.infer<typeof CephMgmt_recomputeCephAnalysisParams>;

export const CephMgmt_recomputeCephAnalysisQuery = z.object({
  analysisType: z.string().optional(),
});
export type CephMgmt_recomputeCephAnalysisQuery = z.infer<typeof CephMgmt_recomputeCephAnalysisQuery>;

export const CephMgmt_recomputeCephAnalysisResponse = z.union([DentalImagingModuleCephAnalysisSchema, ErrorResponseSchema]);

export const CephMgmt_batchUpsertCephLandmarksParams = z.object({
  imageId: z.string(),
});
export type CephMgmt_batchUpsertCephLandmarksParams = z.infer<typeof CephMgmt_batchUpsertCephLandmarksParams>;

export const CephMgmt_batchUpsertCephLandmarksBody = DentalImagingModuleBatchUpsertLandmarksBodySchema;
export type CephMgmt_batchUpsertCephLandmarksBody = z.infer<typeof CephMgmt_batchUpsertCephLandmarksBody>;

export const CephMgmt_batchUpsertCephLandmarksResponse = z.union([DentalImagingModuleCephLandmarkListResponseSchema, ErrorResponseSchema]);

export const CephMgmt_listCephLandmarksParams = z.object({
  imageId: z.string(),
});
export type CephMgmt_listCephLandmarksParams = z.infer<typeof CephMgmt_listCephLandmarksParams>;

export const CephMgmt_listCephLandmarksResponse = z.union([DentalImagingModuleCephLandmarkListResponseSchema, ErrorResponseSchema]);

export const CephMgmt_detectCephLandmarksParams = z.object({
  imageId: z.string(),
});
export type CephMgmt_detectCephLandmarksParams = z.infer<typeof CephMgmt_detectCephLandmarksParams>;

export const CephMgmt_detectCephLandmarksResponse = z.union([DentalImagingModuleCephLandmarkDetectionResultSchema, ErrorResponseSchema]);

export const CephMgmt_getCephLandmarkDetectionJobParams = z.object({
  imageId: z.string(),
  jobId: z.string(),
});
export type CephMgmt_getCephLandmarkDetectionJobParams = z.infer<typeof CephMgmt_getCephLandmarkDetectionJobParams>;

export const CephMgmt_getCephLandmarkDetectionJobResponse = z.union([DentalImagingModuleCephLandmarkDetectionResultSchema, ErrorResponseSchema]);

export const CephMgmt_updateCephLandmarkParams = z.object({
  imageId: z.string(),
  landmarkCode: DentalImagingModuleCephLandmarkCodeSchema,
});
export type CephMgmt_updateCephLandmarkParams = z.infer<typeof CephMgmt_updateCephLandmarkParams>;

export const CephMgmt_updateCephLandmarkBody = DentalImagingModuleUpdateLandmarkBodySchema;
export type CephMgmt_updateCephLandmarkBody = z.infer<typeof CephMgmt_updateCephLandmarkBody>;

export const CephMgmt_updateCephLandmarkResponse = z.union([DentalImagingModuleCephLandmarkListResponseSchema, ErrorResponseSchema]);

export const CephMgmt_deleteCephLandmarkParams = z.object({
  imageId: z.string(),
  landmarkCode: DentalImagingModuleCephLandmarkCodeSchema,
});
export type CephMgmt_deleteCephLandmarkParams = z.infer<typeof CephMgmt_deleteCephLandmarkParams>;

export const CephMgmt_deleteCephLandmarkResponse = ErrorResponseSchema;

export const CephMgmt_createCephReportParams = z.object({
  imageId: z.string(),
});
export type CephMgmt_createCephReportParams = z.infer<typeof CephMgmt_createCephReportParams>;

export const CephMgmt_createCephReportBody = DentalImagingModuleCreateCephReportBodySchema;
export type CephMgmt_createCephReportBody = z.infer<typeof CephMgmt_createCephReportBody>;

export const CephMgmt_createCephReportResponse = z.union([DentalImagingModuleCephReportSchema, ErrorResponseSchema]);

export const CephMgmt_getCephReportParams = z.object({
  imageId: z.string(),
});
export type CephMgmt_getCephReportParams = z.infer<typeof CephMgmt_getCephReportParams>;

export const CephMgmt_getCephReportQuery = z.object({
  version: z.coerce.number().int().optional(),
});
export type CephMgmt_getCephReportQuery = z.infer<typeof CephMgmt_getCephReportQuery>;

export const CephMgmt_getCephReportResponse = z.union([DentalImagingModuleCephReportSchema, ErrorResponseSchema]);

export const ImagingFindingsMgmt_createFindingParams = z.object({
  imageId: z.string(),
});
export type ImagingFindingsMgmt_createFindingParams = z.infer<typeof ImagingFindingsMgmt_createFindingParams>;

export const ImagingFindingsMgmt_createFindingBody = DentalImagingModuleCreateFindingBodySchema;
export type ImagingFindingsMgmt_createFindingBody = z.infer<typeof ImagingFindingsMgmt_createFindingBody>;

export const ImagingFindingsMgmt_createFindingResponse = z.union([DentalImagingModuleImagingFindingSchema, ErrorResponseSchema]);

export const ImagingFindingsMgmt_listFindingsParams = z.object({
  imageId: z.string(),
});
export type ImagingFindingsMgmt_listFindingsParams = z.infer<typeof ImagingFindingsMgmt_listFindingsParams>;

export const ImagingFindingsMgmt_listFindingsResponse = z.union([DentalImagingModuleImagingFindingListResponseSchema, ErrorResponseSchema]);

export const ImagingMgmt_createImageLinkParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_createImageLinkParams = z.infer<typeof ImagingMgmt_createImageLinkParams>;

export const ImagingMgmt_createImageLinkBody = DentalImagingModuleCreateImagingLinkBodySchema;
export type ImagingMgmt_createImageLinkBody = z.infer<typeof ImagingMgmt_createImageLinkBody>;

export const ImagingMgmt_createImageLinkResponse = z.union([DentalImagingModuleImagingLinkSchema, ErrorResponseSchema]);

export const ImagingMgmt_listImageLinksParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_listImageLinksParams = z.infer<typeof ImagingMgmt_listImageLinksParams>;

export const ImagingMgmt_listImageLinksResponse = z.union([DentalImagingModuleImagingLinkListResponseSchema, ErrorResponseSchema]);

export const ImagingMgmt_createMeasurementParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_createMeasurementParams = z.infer<typeof ImagingMgmt_createMeasurementParams>;

export const ImagingMgmt_createMeasurementBody = DentalImagingModuleCreateMeasurementBodySchema;
export type ImagingMgmt_createMeasurementBody = z.infer<typeof ImagingMgmt_createMeasurementBody>;

export const ImagingMgmt_createMeasurementResponse = z.union([DentalImagingModuleImagingAnnotationSchema, ErrorResponseSchema]);

export const ImagingMgmt_listMeasurementsParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_listMeasurementsParams = z.infer<typeof ImagingMgmt_listMeasurementsParams>;

export const ImagingMgmt_listMeasurementsResponse = z.union([DentalImagingModuleMeasurementListResponseSchema, ErrorResponseSchema]);

export const ImagingMgmt_updateImageMetadataParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_updateImageMetadataParams = z.infer<typeof ImagingMgmt_updateImageMetadataParams>;

export const ImagingMgmt_updateImageMetadataBody = DentalImagingModuleUpdateImageMetadataBodySchema;
export type ImagingMgmt_updateImageMetadataBody = z.infer<typeof ImagingMgmt_updateImageMetadataBody>;

export const ImagingMgmt_updateImageMetadataResponse = z.union([DentalImagingModuleImagingStudyImageSchema, ErrorResponseSchema]);

export const ImagingMgmt_updateImageModalityParams = z.object({
  imageId: z.string(),
});
export type ImagingMgmt_updateImageModalityParams = z.infer<typeof ImagingMgmt_updateImageModalityParams>;

export const ImagingMgmt_updateImageModalityBody = DentalImagingModuleUpdateImageModalityBodySchema;
export type ImagingMgmt_updateImageModalityBody = z.infer<typeof ImagingMgmt_updateImageModalityBody>;

export const ImagingMgmt_updateImageModalityResponse = z.union([DentalImagingModuleImagingStudyImageSchema, ErrorResponseSchema]);

export const ImagingMgmt_deleteImageLinkParams = z.object({
  linkId: z.string(),
});
export type ImagingMgmt_deleteImageLinkParams = z.infer<typeof ImagingMgmt_deleteImageLinkParams>;

export const ImagingMgmt_deleteImageLinkResponse = ErrorResponseSchema;

export const ImagingMgmt_deleteMeasurementParams = z.object({
  measurementId: z.string(),
});
export type ImagingMgmt_deleteMeasurementParams = z.infer<typeof ImagingMgmt_deleteMeasurementParams>;

export const ImagingMgmt_deleteMeasurementResponse = ErrorResponseSchema;

export const CephMgmt_listCephSuperimpositionsParams = z.object({
  patientId: z.string(),
});
export type CephMgmt_listCephSuperimpositionsParams = z.infer<typeof CephMgmt_listCephSuperimpositionsParams>;

export const CephMgmt_listCephSuperimpositionsResponse = z.union([DentalImagingModuleCephSuperimpositionListResponseSchema, ErrorResponseSchema]);

export const ImagingMgmt_createImagingStudyBody = DentalImagingModuleCreateImagingStudyBodySchema;
export type ImagingMgmt_createImagingStudyBody = z.infer<typeof ImagingMgmt_createImagingStudyBody>;

export const ImagingMgmt_createImagingStudyResponse = z.union([DentalImagingModuleCreateImagingStudyResponseSchema, ErrorResponseSchema]);

export const ImagingMgmt_getImagingStudyParams = z.object({
  studyId: z.string(),
});
export type ImagingMgmt_getImagingStudyParams = z.infer<typeof ImagingMgmt_getImagingStudyParams>;

export const ImagingMgmt_getImagingStudyResponse = z.union([DentalImagingModuleImagingStudyWithImagesSchema, ErrorResponseSchema]);

export const ImagingMgmt_finalizeCbctStudyParams = z.object({
  studyId: z.string(),
});
export type ImagingMgmt_finalizeCbctStudyParams = z.infer<typeof ImagingMgmt_finalizeCbctStudyParams>;

export const ImagingMgmt_finalizeCbctStudyBody = DentalImagingModuleFinalizeCbctStudyBodySchema;
export type ImagingMgmt_finalizeCbctStudyBody = z.infer<typeof ImagingMgmt_finalizeCbctStudyBody>;

export const ImagingMgmt_finalizeCbctStudyResponse = z.union([DentalImagingModuleFinalizeCbctStudyResponseSchema, ErrorResponseSchema]);

export const ImagingMgmt_getCbctViewerLinkParams = z.object({
  studyId: z.string(),
});
export type ImagingMgmt_getCbctViewerLinkParams = z.infer<typeof ImagingMgmt_getCbctViewerLinkParams>;

export const ImagingMgmt_getCbctViewerLinkResponse = z.union([DentalImagingModuleCbctViewerLinkResponseSchema, ErrorResponseSchema]);

export const PlaceLegalHoldBody = DentalLegalHoldModulePlaceLegalHoldRequestSchema;
export type PlaceLegalHoldBody = z.infer<typeof PlaceLegalHoldBody>;

export const PlaceLegalHoldResponse = ErrorResponseSchema;

export const ListLegalHoldsQuery = z.object({
  status: DentalLegalHoldModuleLegalHoldStatusSchema.optional(),
  subjectPersonId: UUIDSchema.optional(),
  tenantId: UUIDSchema.optional(),
});
export type ListLegalHoldsQuery = z.infer<typeof ListLegalHoldsQuery>;

export const ListLegalHoldsResponse = z.union([z.array(DentalLegalHoldModuleLegalHoldSchema), ErrorResponseSchema]);

export const ReleaseLegalHoldParams = z.object({
  id: UUIDSchema,
});
export type ReleaseLegalHoldParams = z.infer<typeof ReleaseLegalHoldParams>;

export const ReleaseLegalHoldResponse = z.union([DentalLegalHoldModuleLegalHoldSchema, ErrorResponseSchema]);

export const CreateOnboardingBody = DentalOrgModuleOnboardingRequestSchema;
export type CreateOnboardingBody = z.infer<typeof CreateOnboardingBody>;

export const CreateOnboardingResponse = ErrorResponseSchema;

export const GetOrgContextResponse = DentalOrgModuleOrgContextResponseSchema;

export const ListMembersQuery = z.object({
  branchId: UUIDSchema.optional(),
});
export type ListMembersQuery = z.infer<typeof ListMembersQuery>;

export const ListMembersResponse = z.object({
  data: z.array(DentalOrgModuleDentalMembershipSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const CreateMemberQuery = z.object({
  branchId: UUIDSchema.optional(),
});
export type CreateMemberQuery = z.infer<typeof CreateMemberQuery>;

export const CreateMemberBody = DentalOrgModuleCreateFlatMemberRequestSchema;
export type CreateMemberBody = z.infer<typeof CreateMemberBody>;

export const CreateMemberResponse = DentalOrgModuleDentalMembershipSchema;

export const UpdateMemberParams = z.object({
  memberId: UUIDSchema,
});
export type UpdateMemberParams = z.infer<typeof UpdateMemberParams>;

export const UpdateMemberBody = DentalOrgModuleUpdateMemberRequestSchema;
export type UpdateMemberBody = z.infer<typeof UpdateMemberBody>;

export const UpdateMemberResponse = DentalOrgModuleDentalMembershipSchema;

export const DeactivateMemberParams = z.object({
  memberId: UUIDSchema,
});
export type DeactivateMemberParams = z.infer<typeof DeactivateMemberParams>;

export const DeactivateMemberResponse = z.void();

export const RecoverPinParams = z.object({
  memberId: UUIDSchema,
});
export type RecoverPinParams = z.infer<typeof RecoverPinParams>;

export const RecoverPinBody = DentalOrgModuleRecoverPinRequestSchema;
export type RecoverPinBody = z.infer<typeof RecoverPinBody>;

export const RecoverPinResponse = DentalOrgModuleRecoverPinResponseSchema;

export const ResetMemberPinParams = z.object({
  memberId: UUIDSchema,
});
export type ResetMemberPinParams = z.infer<typeof ResetMemberPinParams>;

export const ResetMemberPinBody = DentalOrgModuleResetMemberPinRequestSchema;
export type ResetMemberPinBody = z.infer<typeof ResetMemberPinBody>;

export const ResetMemberPinResponse = DentalOrgModuleDentalMembershipSchema;

export const SetSecurityQuestionParams = z.object({
  memberId: UUIDSchema,
});
export type SetSecurityQuestionParams = z.infer<typeof SetSecurityQuestionParams>;

export const SetSecurityQuestionBody = DentalOrgModuleSetSecurityQuestionRequestSchema;
export type SetSecurityQuestionBody = z.infer<typeof SetSecurityQuestionBody>;

export const SetSecurityQuestionResponse = z.record(z.string(), z.unknown());

export const GetPermissionGridQuery = z.object({
  organizationId: UUIDSchema.optional(),
});
export type GetPermissionGridQuery = z.infer<typeof GetPermissionGridQuery>;

export const GetPermissionGridResponse = DentalOrgModulePermissionGridResponseSchema;

export const UpdatePermissionsQuery = z.object({
  organizationId: UUIDSchema.optional(),
});
export type UpdatePermissionsQuery = z.infer<typeof UpdatePermissionsQuery>;

export const UpdatePermissionsBody = DentalOrgModuleUpdatePermissionsRequestSchema;
export type UpdatePermissionsBody = z.infer<typeof UpdatePermissionsBody>;

export const UpdatePermissionsResponse = DentalOrgModulePermissionGridResponseSchema;

export const DentalOrganizationManagement_createBody = DentalOrgModuleCreateOrganizationRequestSchema;
export type DentalOrganizationManagement_createBody = z.infer<typeof DentalOrganizationManagement_createBody>;

export const DentalOrganizationManagement_createResponse = ErrorResponseSchema;

export const DentalOrganizationManagement_getParams = z.object({
  id: UUIDSchema,
});
export type DentalOrganizationManagement_getParams = z.infer<typeof DentalOrganizationManagement_getParams>;

export const DentalOrganizationManagement_getResponse = z.union([DentalOrgModuleDentalOrganizationSchema, NotFoundErrorSchema, ErrorResponseSchema]);

export const DentalOrganizationManagement_updateParams = z.object({
  id: UUIDSchema,
});
export type DentalOrganizationManagement_updateParams = z.infer<typeof DentalOrganizationManagement_updateParams>;

export const DentalOrganizationManagement_updateBody = DentalOrgModuleUpdateOrganizationRequestSchema;
export type DentalOrganizationManagement_updateBody = z.infer<typeof DentalOrganizationManagement_updateBody>;

export const DentalOrganizationManagement_updateResponse = z.union([DentalOrgModuleDentalOrganizationSchema, NotFoundErrorSchema, ErrorResponseSchema]);

export const ActivateOrganizationParams = z.object({
  id: UUIDSchema,
});
export type ActivateOrganizationParams = z.infer<typeof ActivateOrganizationParams>;

export const ActivateOrganizationResponse = z.union([DentalOrgModuleDentalOrganizationSchema, NotFoundErrorSchema, ErrorResponseSchema]);

export const DentalBranchManagement_createParams = z.object({
  orgId: UUIDSchema,
});
export type DentalBranchManagement_createParams = z.infer<typeof DentalBranchManagement_createParams>;

export const DentalBranchManagement_createBody = DentalOrgModuleCreateBranchRequestSchema;
export type DentalBranchManagement_createBody = z.infer<typeof DentalBranchManagement_createBody>;

export const DentalBranchManagement_createResponse = ErrorResponseSchema;

export const DentalBranchManagement_listParams = z.object({
  orgId: UUIDSchema,
});
export type DentalBranchManagement_listParams = z.infer<typeof DentalBranchManagement_listParams>;

export const DentalBranchManagement_listResponse = z.union([DentalOrgModuleBranchListSchema, ErrorResponseSchema]);

export const DentalBranchManagement_getParams = z.object({
  orgId: UUIDSchema,
  branchId: UUIDSchema,
});
export type DentalBranchManagement_getParams = z.infer<typeof DentalBranchManagement_getParams>;

export const DentalBranchManagement_getResponse = z.union([DentalOrgModuleDentalBranchSchema, NotFoundErrorSchema, ErrorResponseSchema]);

export const DentalMembershipManagement_createParams = z.object({
  orgId: UUIDSchema,
  branchId: UUIDSchema,
});
export type DentalMembershipManagement_createParams = z.infer<typeof DentalMembershipManagement_createParams>;

export const DentalMembershipManagement_createBody = DentalOrgModuleCreateMembershipRequestSchema;
export type DentalMembershipManagement_createBody = z.infer<typeof DentalMembershipManagement_createBody>;

export const DentalMembershipManagement_createResponse = ErrorResponseSchema;

export const DentalMembershipManagement_listParams = z.object({
  orgId: UUIDSchema,
  branchId: UUIDSchema,
});
export type DentalMembershipManagement_listParams = z.infer<typeof DentalMembershipManagement_listParams>;

export const DentalMembershipManagement_listResponse = z.union([z.object({
  data: z.array(DentalOrgModuleDentalMembershipSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
}), ErrorResponseSchema]);

export const DentalMembershipManagement_deactivateParams = z.object({
  orgId: UUIDSchema,
  branchId: UUIDSchema,
  membershipId: UUIDSchema,
});
export type DentalMembershipManagement_deactivateParams = z.infer<typeof DentalMembershipManagement_deactivateParams>;

export const DentalMembershipManagement_deactivateBody = DentalOrgModuleDeactivateMembershipRequestSchema;
export type DentalMembershipManagement_deactivateBody = z.infer<typeof DentalMembershipManagement_deactivateBody>;

export const DentalMembershipManagement_deactivateResponse = z.union([DentalOrgModuleDentalMembershipSchema, NotFoundErrorSchema, ErrorResponseSchema]);

export const DentalMembershipManagement_setPinParams = z.object({
  orgId: UUIDSchema,
  branchId: UUIDSchema,
  membershipId: UUIDSchema,
});
export type DentalMembershipManagement_setPinParams = z.infer<typeof DentalMembershipManagement_setPinParams>;

export const DentalMembershipManagement_setPinBody = DentalOrgModuleSetPinRequestSchema;
export type DentalMembershipManagement_setPinBody = z.infer<typeof DentalMembershipManagement_setPinBody>;

export const DentalMembershipManagement_setPinResponse = z.union([DentalOrgModuleDentalMembershipSchema, NotFoundErrorSchema, ErrorResponseSchema]);

export const DentalMembershipManagement_verifyPinParams = z.object({
  orgId: UUIDSchema,
  branchId: UUIDSchema,
  membershipId: UUIDSchema,
});
export type DentalMembershipManagement_verifyPinParams = z.infer<typeof DentalMembershipManagement_verifyPinParams>;

export const DentalMembershipManagement_verifyPinBody = DentalOrgModuleVerifyPinRequestSchema;
export type DentalMembershipManagement_verifyPinBody = z.infer<typeof DentalMembershipManagement_verifyPinBody>;

export const DentalMembershipManagement_verifyPinResponse = z.union([DentalOrgModuleVerifyPinResponseSchema, NotFoundErrorSchema, ErrorResponseSchema]);

export const CreateDentalPatientBody = DentalPatientModuleCreateDentalPatientRequestSchema;
export type CreateDentalPatientBody = z.infer<typeof CreateDentalPatientBody>;

export const CreateDentalPatientResponse = DentalPatientModuleCreateDentalPatientResponseSchema;

export const ListDentalPatientsQuery = z.object({
  q: z.string().optional(),
  needsFollowUp: z.coerce.boolean().optional(),
  status: z.string().optional(),
  branchId: UUIDSchema,
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});
export type ListDentalPatientsQuery = z.infer<typeof ListDentalPatientsQuery>;

export const ListDentalPatientsResponse = z.object({
  data: z.array(DentalPatientModuleDentalPatientSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const BulkArchiveDentalPatientsBody = DentalPatientModuleBulkArchiveDentalPatientsRequestSchema;
export type BulkArchiveDentalPatientsBody = z.infer<typeof BulkArchiveDentalPatientsBody>;

export const BulkArchiveDentalPatientsResponse = DentalPatientModuleBulkArchiveDentalPatientsResponseSchema;

export const DetectDuplicatePatientsQuery = z.object({
  branchId: UUIDSchema,
});
export type DetectDuplicatePatientsQuery = z.infer<typeof DetectDuplicatePatientsQuery>;

export const DetectDuplicatePatientsResponse = DentalPatientModuleDuplicateCandidatesResponseSchema;

export const ExportDentalPatientsQuery = z.object({
  branchId: UUIDSchema.optional(),
  format: z.string().optional(),
  status: z.string().optional(),
});
export type ExportDentalPatientsQuery = z.infer<typeof ExportDentalPatientsQuery>;

export const ExportDentalPatientsResponse = DentalPatientModuleExportDentalPatientsResponseSchema;

export const ImportPatientsBody = DentalPatientModuleImportPatientsRequestSchema;
export type ImportPatientsBody = z.infer<typeof ImportPatientsBody>;

export const ImportPatientsResponse = DentalPatientModuleImportPatientsResponseSchema;

export const GetDentalPatientParams = z.object({
  id: UUIDSchema,
});
export type GetDentalPatientParams = z.infer<typeof GetDentalPatientParams>;

export const GetDentalPatientResponse = DentalPatientModuleDentalPatientSchema;

export const UpdateDentalPatientParams = z.object({
  id: UUIDSchema,
});
export type UpdateDentalPatientParams = z.infer<typeof UpdateDentalPatientParams>;

export const UpdateDentalPatientBody = DentalPatientModuleUpdateDentalPatientRequestSchema;
export type UpdateDentalPatientBody = z.infer<typeof UpdateDentalPatientBody>;

export const UpdateDentalPatientResponse = DentalPatientModuleDentalPatientSchema;

export const ArchiveDentalPatientParams = z.object({
  id: UUIDSchema,
});
export type ArchiveDentalPatientParams = z.infer<typeof ArchiveDentalPatientParams>;

export const ArchiveDentalPatientResponse = DentalPatientModuleDentalPatientSchema;

export const ListFollowUpNotesParams = z.object({
  id: UUIDSchema,
});
export type ListFollowUpNotesParams = z.infer<typeof ListFollowUpNotesParams>;

export const ListFollowUpNotesResponse = DentalPatientModuleListFollowUpNotesResponseSchema;

export const AddFollowUpNoteParams = z.object({
  id: UUIDSchema,
});
export type AddFollowUpNoteParams = z.infer<typeof AddFollowUpNoteParams>;

export const AddFollowUpNoteBody = DentalPatientModuleAddFollowUpNoteRequestSchema;
export type AddFollowUpNoteBody = z.infer<typeof AddFollowUpNoteBody>;

export const AddFollowUpNoteResponse = DentalPatientModuleAddFollowUpNoteResponseSchema;

export const RestoreDentalPatientParams = z.object({
  id: UUIDSchema,
});
export type RestoreDentalPatientParams = z.infer<typeof RestoreDentalPatientParams>;

export const RestoreDentalPatientResponse = DentalPatientModuleDentalPatientSchema;

export const GetDentalPatientSafetyFloorParams = z.object({
  id: UUIDSchema,
});
export type GetDentalPatientSafetyFloorParams = z.infer<typeof GetDentalPatientSafetyFloorParams>;

export const GetDentalPatientSafetyFloorResponse = DentalPatientModuleDentalPatientSafetyFloorSchema;

export const GetDentalPatientStatementParams = z.object({
  id: UUIDSchema,
});
export type GetDentalPatientStatementParams = z.infer<typeof GetDentalPatientStatementParams>;

export const GetDentalPatientStatementResponse = DentalPatientModuleDentalPatientStatementSchema;

export const CreateCoverageAuthorizationParams = z.object({
  patientId: UUIDSchema,
});
export type CreateCoverageAuthorizationParams = z.infer<typeof CreateCoverageAuthorizationParams>;

export const CreateCoverageAuthorizationBody = DentalPatientFinanceModuleCreateCoverageAuthorizationRequestSchema;
export type CreateCoverageAuthorizationBody = z.infer<typeof CreateCoverageAuthorizationBody>;

export const CreateCoverageAuthorizationResponse = ErrorResponseSchema;

export const ListCoverageAuthorizationsParams = z.object({
  patientId: UUIDSchema,
});
export type ListCoverageAuthorizationsParams = z.infer<typeof ListCoverageAuthorizationsParams>;

export const ListCoverageAuthorizationsResponse = z.union([z.array(DentalPatientFinanceModuleCoverageAuthorizationSchema), ErrorResponseSchema]);

export const UpdateCoverageAuthorizationStatusParams = z.object({
  patientId: UUIDSchema,
  authorizationId: UUIDSchema,
});
export type UpdateCoverageAuthorizationStatusParams = z.infer<typeof UpdateCoverageAuthorizationStatusParams>;

export const UpdateCoverageAuthorizationStatusBody = DentalPatientFinanceModuleUpdateCoverageAuthorizationStatusRequestSchema;
export type UpdateCoverageAuthorizationStatusBody = z.infer<typeof UpdateCoverageAuthorizationStatusBody>;

export const UpdateCoverageAuthorizationStatusResponse = z.union([DentalPatientFinanceModuleCoverageAuthorizationSchema, ErrorResponseSchema]);

export const CreateCasePresentationParams = z.object({
  patientId: UUIDSchema,
});
export type CreateCasePresentationParams = z.infer<typeof CreateCasePresentationParams>;

export const CreateCasePresentationBody = DentalPatientFinanceModuleCreateCasePresentationRequestSchema;
export type CreateCasePresentationBody = z.infer<typeof CreateCasePresentationBody>;

export const CreateCasePresentationResponse = ErrorResponseSchema;

export const ListCasePresentationsParams = z.object({
  patientId: UUIDSchema,
});
export type ListCasePresentationsParams = z.infer<typeof ListCasePresentationsParams>;

export const ListCasePresentationsResponse = z.union([z.array(DentalPatientFinanceModuleCasePresentationSchema), ErrorResponseSchema]);

export const GetCasePresentationParams = z.object({
  patientId: UUIDSchema,
  presentationId: UUIDSchema,
});
export type GetCasePresentationParams = z.infer<typeof GetCasePresentationParams>;

export const GetCasePresentationResponse = z.union([DentalPatientFinanceModuleCasePresentationAggregateSchema, ErrorResponseSchema]);

export const AcceptCasePresentationParams = z.object({
  patientId: UUIDSchema,
  presentationId: UUIDSchema,
});
export type AcceptCasePresentationParams = z.infer<typeof AcceptCasePresentationParams>;

export const AcceptCasePresentationBody = DentalPatientFinanceModuleAcceptCasePresentationRequestSchema;
export type AcceptCasePresentationBody = z.infer<typeof AcceptCasePresentationBody>;

export const AcceptCasePresentationResponse = z.union([DentalPatientFinanceModuleAcceptCasePresentationResultSchema, ErrorResponseSchema]);

export const RejectCasePresentationParams = z.object({
  patientId: UUIDSchema,
  presentationId: UUIDSchema,
});
export type RejectCasePresentationParams = z.infer<typeof RejectCasePresentationParams>;

export const RejectCasePresentationBody = DentalPatientFinanceModuleRejectCasePresentationRequestSchema;
export type RejectCasePresentationBody = z.infer<typeof RejectCasePresentationBody>;

export const RejectCasePresentationResponse = z.union([DentalPatientFinanceModuleRejectCasePresentationResultSchema, ErrorResponseSchema]);

export const CreateClaimDraftParams = z.object({
  patientId: UUIDSchema,
});
export type CreateClaimDraftParams = z.infer<typeof CreateClaimDraftParams>;

export const CreateClaimDraftBody = DentalPatientFinanceModuleCreateClaimDraftRequestSchema;
export type CreateClaimDraftBody = z.infer<typeof CreateClaimDraftBody>;

export const CreateClaimDraftResponse = ErrorResponseSchema;

export const ListPatientClaimsParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientClaimsParams = z.infer<typeof ListPatientClaimsParams>;

export const ListPatientClaimsResponse = z.union([z.array(DentalPatientFinanceModuleClaimDraftSchema), ErrorResponseSchema]);

export const GetClaimReadinessParams = z.object({
  patientId: UUIDSchema,
  claimId: UUIDSchema,
});
export type GetClaimReadinessParams = z.infer<typeof GetClaimReadinessParams>;

export const GetClaimReadinessResponse = z.union([DentalPatientFinanceModuleClaimReadinessSchema, ErrorResponseSchema]);

export const UpdateClaimStatusParams = z.object({
  patientId: UUIDSchema,
  claimId: UUIDSchema,
});
export type UpdateClaimStatusParams = z.infer<typeof UpdateClaimStatusParams>;

export const UpdateClaimStatusBody = DentalPatientFinanceModuleUpdateClaimStatusRequestSchema;
export type UpdateClaimStatusBody = z.infer<typeof UpdateClaimStatusBody>;

export const UpdateClaimStatusResponse = z.union([DentalPatientFinanceModuleClaimDraftSchema, ErrorResponseSchema]);

export const GetPatientCommunicationConsentParams = z.object({
  patientId: UUIDSchema,
});
export type GetPatientCommunicationConsentParams = z.infer<typeof GetPatientCommunicationConsentParams>;

export const GetPatientCommunicationConsentResponse = DentalPatientModuleCommunicationConsentResponseSchema;

export const UpdatePatientCommunicationConsentParams = z.object({
  patientId: UUIDSchema,
});
export type UpdatePatientCommunicationConsentParams = z.infer<typeof UpdatePatientCommunicationConsentParams>;

export const UpdatePatientCommunicationConsentBody = DentalPatientModuleUpdateCommunicationConsentRequestSchema;
export type UpdatePatientCommunicationConsentBody = z.infer<typeof UpdatePatientCommunicationConsentBody>;

export const UpdatePatientCommunicationConsentResponse = DentalPatientModuleCommunicationConsentResponseSchema;

export const CreatePatientContactParams = z.object({
  patientId: UUIDSchema,
});
export type CreatePatientContactParams = z.infer<typeof CreatePatientContactParams>;

export const CreatePatientContactBody = DentalPatientEngagementModuleCreatePatientContactRequestSchema;
export type CreatePatientContactBody = z.infer<typeof CreatePatientContactBody>;

export const CreatePatientContactResponse = ErrorResponseSchema;

export const ListPatientContactsParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientContactsParams = z.infer<typeof ListPatientContactsParams>;

export const ListPatientContactsResponse = z.union([z.array(DentalPatientEngagementModulePatientContactSchema), ErrorResponseSchema]);

export const UpdatePatientContactParams = z.object({
  patientId: UUIDSchema,
  contactId: UUIDSchema,
});
export type UpdatePatientContactParams = z.infer<typeof UpdatePatientContactParams>;

export const UpdatePatientContactBody = DentalPatientEngagementModuleUpdatePatientContactRequestSchema;
export type UpdatePatientContactBody = z.infer<typeof UpdatePatientContactBody>;

export const UpdatePatientContactResponse = z.union([DentalPatientEngagementModulePatientContactSchema, ErrorResponseSchema]);

export const DeletePatientContactParams = z.object({
  patientId: UUIDSchema,
  contactId: UUIDSchema,
});
export type DeletePatientContactParams = z.infer<typeof DeletePatientContactParams>;

export const DeletePatientContactResponse = ErrorResponseSchema;

export const CreateDentalAlertParams = z.object({
  patientId: UUIDSchema,
});
export type CreateDentalAlertParams = z.infer<typeof CreateDentalAlertParams>;

export const CreateDentalAlertBody = DentalPatientEngagementModuleCreateDentalAlertRequestSchema;
export type CreateDentalAlertBody = z.infer<typeof CreateDentalAlertBody>;

export const CreateDentalAlertResponse = ErrorResponseSchema;

export const ListDentalAlertsParams = z.object({
  patientId: UUIDSchema,
});
export type ListDentalAlertsParams = z.infer<typeof ListDentalAlertsParams>;

export const ListDentalAlertsResponse = z.union([z.array(DentalPatientEngagementModuleDentalAlertSchema), ErrorResponseSchema]);

export const UpdateDentalAlertParams = z.object({
  patientId: UUIDSchema,
  alertId: UUIDSchema,
});
export type UpdateDentalAlertParams = z.infer<typeof UpdateDentalAlertParams>;

export const UpdateDentalAlertBody = DentalPatientEngagementModuleUpdateDentalAlertRequestSchema;
export type UpdateDentalAlertBody = z.infer<typeof UpdateDentalAlertBody>;

export const UpdateDentalAlertResponse = z.union([DentalPatientEngagementModuleDentalAlertSchema, ErrorResponseSchema]);

export const InitializeDentitionParams = z.object({
  patientId: UUIDSchema,
});
export type InitializeDentitionParams = z.infer<typeof InitializeDentitionParams>;

export const InitializeDentitionBody = DentalPatientModuleInitializeDentitionRequestSchema;
export type InitializeDentitionBody = z.infer<typeof InitializeDentitionBody>;

export const InitializeDentitionResponse = DentalPatientModuleInitializeDentitionResponseSchema;

export const GetPatientHouseholdParams = z.object({
  patientId: UUIDSchema,
});
export type GetPatientHouseholdParams = z.infer<typeof GetPatientHouseholdParams>;

export const GetPatientHouseholdResponse = z.union([DentalPatientFinanceModuleHouseholdWithMembersSchema, ErrorResponseSchema]);

export const PatientImageMgmt_listPatientImagesParams = z.object({
  patientId: z.string(),
});
export type PatientImageMgmt_listPatientImagesParams = z.infer<typeof PatientImageMgmt_listPatientImagesParams>;

export const PatientImageMgmt_listPatientImagesQuery = z.object({
  branchId: z.string(),
  isDiagnostic: z.coerce.boolean().optional(),
  qualityStatus: z.enum(["ok", "retake"]).optional(),
  tag: z.string().optional(),
  linkTargetId: z.string().optional(),
  linkType: z.enum(["treatment_plan", "ortho_case", "report"]).optional(),
});
export type PatientImageMgmt_listPatientImagesQuery = z.infer<typeof PatientImageMgmt_listPatientImagesQuery>;

export const PatientImageMgmt_listPatientImagesResponse = z.union([DentalImagingModuleListPatientImagesResponseSchema, ErrorResponseSchema]);

export const CreateInsuranceProfileParams = z.object({
  patientId: UUIDSchema,
});
export type CreateInsuranceProfileParams = z.infer<typeof CreateInsuranceProfileParams>;

export const CreateInsuranceProfileBody = DentalPatientFinanceModuleCreateInsuranceProfileRequestSchema;
export type CreateInsuranceProfileBody = z.infer<typeof CreateInsuranceProfileBody>;

export const CreateInsuranceProfileResponse = ErrorResponseSchema;

export const ListPatientInsuranceProfilesParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientInsuranceProfilesParams = z.infer<typeof ListPatientInsuranceProfilesParams>;

export const ListPatientInsuranceProfilesResponse = z.union([z.array(DentalPatientFinanceModuleInsuranceProfileSchema), ErrorResponseSchema]);

export const UpdateInsuranceProfileParams = z.object({
  patientId: UUIDSchema,
  profileId: UUIDSchema,
});
export type UpdateInsuranceProfileParams = z.infer<typeof UpdateInsuranceProfileParams>;

export const UpdateInsuranceProfileBody = DentalPatientFinanceModuleUpdateInsuranceProfileRequestSchema;
export type UpdateInsuranceProfileBody = z.infer<typeof UpdateInsuranceProfileBody>;

export const UpdateInsuranceProfileResponse = z.union([DentalPatientFinanceModuleInsuranceProfileSchema, ErrorResponseSchema]);

export const CreateOcclusionScreeningParams = z.object({
  patientId: UUIDSchema,
});
export type CreateOcclusionScreeningParams = z.infer<typeof CreateOcclusionScreeningParams>;

export const CreateOcclusionScreeningBody = DentalClinicalOpsModuleCreateOcclusionScreeningRequestSchema;
export type CreateOcclusionScreeningBody = z.infer<typeof CreateOcclusionScreeningBody>;

export const CreateOcclusionScreeningResponse = ErrorResponseSchema;

export const ListOcclusionScreeningsParams = z.object({
  patientId: UUIDSchema,
});
export type ListOcclusionScreeningsParams = z.infer<typeof ListOcclusionScreeningsParams>;

export const ListOcclusionScreeningsResponse = z.union([z.object({
  data: z.array(DentalClinicalOpsModuleOcclusionScreeningSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
}), ErrorResponseSchema]);

export const CreateRecallParams = z.object({
  patientId: UUIDSchema,
});
export type CreateRecallParams = z.infer<typeof CreateRecallParams>;

export const CreateRecallBody = DentalPatientEngagementModuleCreateRecallRequestSchema;
export type CreateRecallBody = z.infer<typeof CreateRecallBody>;

export const CreateRecallResponse = ErrorResponseSchema;

export const ListPatientRecallsParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientRecallsParams = z.infer<typeof ListPatientRecallsParams>;

export const ListPatientRecallsResponse = z.union([z.array(DentalPatientEngagementModuleRecallSchema), ErrorResponseSchema]);

export const UpdateRecallParams = z.object({
  patientId: UUIDSchema,
  recallId: UUIDSchema,
});
export type UpdateRecallParams = z.infer<typeof UpdateRecallParams>;

export const UpdateRecallBody = DentalPatientEngagementModuleUpdateRecallRequestSchema;
export type UpdateRecallBody = z.infer<typeof UpdateRecallBody>;

export const UpdateRecallResponse = z.union([DentalPatientEngagementModuleRecallSchema, ErrorResponseSchema]);

export const CreateTaskParams = z.object({
  patientId: UUIDSchema,
});
export type CreateTaskParams = z.infer<typeof CreateTaskParams>;

export const CreateTaskBody = DentalPatientEngagementModuleCreateTaskRequestSchema;
export type CreateTaskBody = z.infer<typeof CreateTaskBody>;

export const CreateTaskResponse = ErrorResponseSchema;

export const ListPatientTasksParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientTasksParams = z.infer<typeof ListPatientTasksParams>;

export const ListPatientTasksResponse = z.union([z.array(DentalPatientEngagementModulePatientTaskSchema), ErrorResponseSchema]);

export const UpdateTaskParams = z.object({
  patientId: UUIDSchema,
  taskId: UUIDSchema,
});
export type UpdateTaskParams = z.infer<typeof UpdateTaskParams>;

export const UpdateTaskBody = DentalPatientEngagementModuleUpdateTaskRequestSchema;
export type UpdateTaskBody = z.infer<typeof UpdateTaskBody>;

export const UpdateTaskResponse = z.union([DentalPatientEngagementModulePatientTaskSchema, ErrorResponseSchema]);

export const ListTreatmentOptionGroupParams = z.object({
  patientId: UUIDSchema,
  optionGroupId: UUIDSchema,
});
export type ListTreatmentOptionGroupParams = z.infer<typeof ListTreatmentOptionGroupParams>;

export const ListTreatmentOptionGroupResponse = z.union([DentalPatientFinanceModuleTreatmentOptionGroupSchema, ErrorResponseSchema]);

export const AcceptTreatmentOptionParams = z.object({
  patientId: UUIDSchema,
  optionGroupId: UUIDSchema,
});
export type AcceptTreatmentOptionParams = z.infer<typeof AcceptTreatmentOptionParams>;

export const AcceptTreatmentOptionBody = DentalPatientFinanceModuleAcceptTreatmentOptionRequestSchema;
export type AcceptTreatmentOptionBody = z.infer<typeof AcceptTreatmentOptionBody>;

export const AcceptTreatmentOptionResponse = z.union([DentalPatientFinanceModuleAcceptTreatmentOptionResultSchema, ErrorResponseSchema]);

export const GetTreatmentPlanParams = z.object({
  patientId: UUIDSchema,
});
export type GetTreatmentPlanParams = z.infer<typeof GetTreatmentPlanParams>;

export const GetTreatmentPlanQuery = z.object({
  branchId: UUIDSchema,
});
export type GetTreatmentPlanQuery = z.infer<typeof GetTreatmentPlanQuery>;

export const GetTreatmentPlanResponse = TreatmentPlanResponseSchema;

export const AcceptTreatmentPlanParams = z.object({
  patientId: UUIDSchema,
});
export type AcceptTreatmentPlanParams = z.infer<typeof AcceptTreatmentPlanParams>;

export const AcceptTreatmentPlanBody = AcceptTreatmentPlanRequestSchema;
export type AcceptTreatmentPlanBody = z.infer<typeof AcceptTreatmentPlanBody>;

export const AcceptTreatmentPlanResponse = TreatmentPlanVersionSchema;

export const GetTreatmentPlanVersionParams = z.object({
  patientId: UUIDSchema,
  versionId: UUIDSchema,
});
export type GetTreatmentPlanVersionParams = z.infer<typeof GetTreatmentPlanVersionParams>;

export const GetTreatmentPlanVersionResponse = TreatmentPlanVersionSchema;

export const CreateTreatmentPlanParams = z.object({
  patientId: UUIDSchema,
});
export type CreateTreatmentPlanParams = z.infer<typeof CreateTreatmentPlanParams>;

export const CreateTreatmentPlanBody = DentalPatientFinanceModuleCreateTreatmentPlanRequestSchema;
export type CreateTreatmentPlanBody = z.infer<typeof CreateTreatmentPlanBody>;

export const CreateTreatmentPlanResponse = ErrorResponseSchema;

export const ListPatientTreatmentPlansParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientTreatmentPlansParams = z.infer<typeof ListPatientTreatmentPlansParams>;

export const ListPatientTreatmentPlansResponse = z.union([z.array(DentalPatientFinanceModuleTreatmentPlanSchema), ErrorResponseSchema]);

export const UpdateTreatmentPlanParams = z.object({
  patientId: UUIDSchema,
  planId: UUIDSchema,
});
export type UpdateTreatmentPlanParams = z.infer<typeof UpdateTreatmentPlanParams>;

export const UpdateTreatmentPlanBody = DentalPatientFinanceModuleUpdateTreatmentPlanRequestSchema;
export type UpdateTreatmentPlanBody = z.infer<typeof UpdateTreatmentPlanBody>;

export const UpdateTreatmentPlanResponse = z.union([DentalPatientFinanceModuleTreatmentPlanSchema, ErrorResponseSchema]);

export const ApproveTreatmentPlanParams = z.object({
  patientId: UUIDSchema,
  planId: UUIDSchema,
});
export type ApproveTreatmentPlanParams = z.infer<typeof ApproveTreatmentPlanParams>;

export const ApproveTreatmentPlanBody = DentalPatientFinanceModuleApproveTreatmentPlanRequestSchema;
export type ApproveTreatmentPlanBody = z.infer<typeof ApproveTreatmentPlanBody>;

export const ApproveTreatmentPlanResponse = ErrorResponseSchema;

export const ListTreatmentPlanStatusHistoryParams = z.object({
  patientId: UUIDSchema,
  planId: UUIDSchema,
});
export type ListTreatmentPlanStatusHistoryParams = z.infer<typeof ListTreatmentPlanStatusHistoryParams>;

export const ListTreatmentPlanStatusHistoryResponse = z.union([z.array(DentalPatientFinanceModuleTreatmentPlanStatusHistoryEntrySchema), ErrorResponseSchema]);

export const ListPatientConditionsParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientConditionsParams = z.infer<typeof ListPatientConditionsParams>;

export const ListPatientConditionsQuery = z.object({
  branchId: UUIDSchema.optional(),
});
export type ListPatientConditionsQuery = z.infer<typeof ListPatientConditionsQuery>;

export const ListPatientConditionsResponse = z.object({
  data: z.array(PatientConditionEntrySchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const AttachTreatmentAppointmentParams = z.object({
  patientId: UUIDSchema,
  treatmentId: UUIDSchema,
});
export type AttachTreatmentAppointmentParams = z.infer<typeof AttachTreatmentAppointmentParams>;

export const AttachTreatmentAppointmentBody = DentalPatientFinanceModuleAttachTreatmentAppointmentRequestSchema;
export type AttachTreatmentAppointmentBody = z.infer<typeof AttachTreatmentAppointmentBody>;

export const AttachTreatmentAppointmentResponse = z.union([DentalPatientFinanceModuleTreatmentAppointmentLinkSchema, ErrorResponseSchema]);

export const DetachTreatmentAppointmentParams = z.object({
  patientId: UUIDSchema,
  treatmentId: UUIDSchema,
});
export type DetachTreatmentAppointmentParams = z.infer<typeof DetachTreatmentAppointmentParams>;

export const DetachTreatmentAppointmentResponse = z.union([DentalPatientFinanceModuleTreatmentAppointmentLinkSchema, ErrorResponseSchema]);

export const ListPatientVisitsParams = z.object({
  patientId: UUIDSchema,
});
export type ListPatientVisitsParams = z.infer<typeof ListPatientVisitsParams>;

export const ListPatientVisitsQuery = z.object({
  branchId: UUIDSchema.optional(),
});
export type ListPatientVisitsQuery = z.infer<typeof ListPatientVisitsQuery>;

export const ListPatientVisitsResponse = z.object({
  data: z.array(PatientVisitRecordSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const CreatePerioChartBody = CreatePerioChartRequestSchema;
export type CreatePerioChartBody = z.infer<typeof CreatePerioChartBody>;

export const CreatePerioChartResponse = PerioChartSchema;

export const ListPerioChartsForPatientQuery = z.object({
  patientId: UUIDSchema,
});
export type ListPerioChartsForPatientQuery = z.infer<typeof ListPerioChartsForPatientQuery>;

export const ListPerioChartsForPatientResponse = PerioChartHistorySchema;

export const GetPerioChartParams = z.object({
  chartId: UUIDSchema,
});
export type GetPerioChartParams = z.infer<typeof GetPerioChartParams>;

export const GetPerioChartResponse = PerioChartSchema;

export const CompletePerioChartParams = z.object({
  chartId: UUIDSchema,
});
export type CompletePerioChartParams = z.infer<typeof CompletePerioChartParams>;

export const CompletePerioChartBody = CompletePerioChartRequestSchema;
export type CompletePerioChartBody = z.infer<typeof CompletePerioChartBody>;

export const CompletePerioChartResponse = CompletePerioChartResponseSchema;

export const UpsertToothReadingParams = z.object({
  chartId: UUIDSchema,
  toothNumber: z.coerce.number().int().gte(11).lte(85),
});
export type UpsertToothReadingParams = z.infer<typeof UpsertToothReadingParams>;

export const UpsertToothReadingBody = UpsertToothReadingRequestSchema;
export type UpsertToothReadingBody = z.infer<typeof UpsertToothReadingBody>;

export const UpsertToothReadingResponse = PerioToothReadingSchema;

export const ImportPMDBody = ImportPMDRequestSchema;
export type ImportPMDBody = z.infer<typeof ImportPMDBody>;

export const ImportPMDResponse = ImportedPMDSchema;

export const ListImportedPMDsQuery = z.object({
  patientId: UUIDSchema,
});
export type ListImportedPMDsQuery = z.infer<typeof ListImportedPMDsQuery>;

export const ListImportedPMDsResponse = z.object({
  data: z.array(ImportedPMDSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetImportedPMDParams = z.object({
  id: UUIDSchema,
});
export type GetImportedPMDParams = z.infer<typeof GetImportedPMDParams>;

export const GetImportedPMDResponse = ImportedPMDSchema;

export const MergeImportedPMDSafetyFloorParams = z.object({
  id: UUIDSchema,
});
export type MergeImportedPMDSafetyFloorParams = z.infer<typeof MergeImportedPMDSafetyFloorParams>;

export const MergeImportedPMDSafetyFloorResponse = MergeImportedPMDSafetyFloorResultSchema;

export const ExportPatientCareRecordParams = z.object({
  patientId: UUIDSchema,
});
export type ExportPatientCareRecordParams = z.infer<typeof ExportPatientCareRecordParams>;

export const ExportPatientCareRecordResponse = PatientCareRecordBundleSchema;

export const ConfirmAppointmentByTokenParams = z.object({
  appointmentId: UUIDSchema,
  token: UUIDSchema,
});
export type ConfirmAppointmentByTokenParams = z.infer<typeof ConfirmAppointmentByTokenParams>;

export const ConfirmAppointmentByTokenResponse = PublicConfirmResponseSchema;

export const GetOnlineBookingParams = z.object({
  confirmationCode: z.string(),
});
export type GetOnlineBookingParams = z.infer<typeof GetOnlineBookingParams>;

export const GetOnlineBookingResponse = BookingLookupResponseSchema;

export const GetPublicAvailabilityParams = z.object({
  branchId: UUIDSchema,
});
export type GetPublicAvailabilityParams = z.infer<typeof GetPublicAvailabilityParams>;

export const GetPublicAvailabilityQuery = z.object({
  visitType: VisitTypeSchema,
  date_from: z.string(),
  date_to: z.string(),
  providerId: UUIDSchema.optional(),
});
export type GetPublicAvailabilityQuery = z.infer<typeof GetPublicAvailabilityQuery>;

export const GetPublicAvailabilityResponse = PublicAvailabilityResponseSchema;

export const GetPublicBookingConfigParams = z.object({
  branchId: UUIDSchema,
});
export type GetPublicBookingConfigParams = z.infer<typeof GetPublicBookingConfigParams>;

export const GetPublicBookingConfigResponse = PublicBookingConfigSchema;

export const CreateOnlineBookingParams = z.object({
  branchId: UUIDSchema,
});
export type CreateOnlineBookingParams = z.infer<typeof CreateOnlineBookingParams>;

export const CreateOnlineBookingBody = CreateOnlineBookingRequestSchema;
export type CreateOnlineBookingBody = z.infer<typeof CreateOnlineBookingBody>;

export const CreateOnlineBookingResponse = OnlineBookingResponseSchema;

export const CreateBookingHoldParams = z.object({
  branchId: UUIDSchema,
});
export type CreateBookingHoldParams = z.infer<typeof CreateBookingHoldParams>;

export const CreateBookingHoldBody = CreateHoldRequestSchema;
export type CreateBookingHoldBody = z.infer<typeof CreateBookingHoldBody>;

export const CreateBookingHoldResponse = HoldResponseSchema;

export const UpdateQueueItemStatusParams = z.object({
  itemId: UUIDSchema,
});
export type UpdateQueueItemStatusParams = z.infer<typeof UpdateQueueItemStatusParams>;

export const UpdateQueueItemStatusBody = DentalQueueModuleUpdateQueueItemStatusRequestSchema;
export type UpdateQueueItemStatusBody = z.infer<typeof UpdateQueueItemStatusBody>;

export const UpdateQueueItemStatusResponse = z.union([DentalQueueModuleQueueItemSchema, ErrorResponseSchema]);

export const ListDueRecallsQuery = z.object({
  branchId: UUIDSchema,
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().gte(1).optional(),
  per_page: z.coerce.number().int().gte(1).lte(200).optional(),
});
export type ListDueRecallsQuery = z.infer<typeof ListDueRecallsQuery>;

export const ListDueRecallsResponse = z.union([z.array(DentalPatientEngagementModuleRecallDueItemSchema), ErrorResponseSchema]);

export const GetRetentionStatusQuery = z.object({
  tenantId: UUIDSchema.optional(),
});
export type GetRetentionStatusQuery = z.infer<typeof GetRetentionStatusQuery>;

export const GetRetentionStatusResponse = z.union([DentalRetentionModuleRetentionStatusSchema, ErrorResponseSchema]);

export const CreateSyncLogBody = DentalPatientFinanceModuleCreateSyncLogRequestSchema;
export type CreateSyncLogBody = z.infer<typeof CreateSyncLogBody>;

export const CreateSyncLogResponse = ErrorResponseSchema;

export const ListSyncLogsResponse = z.union([z.array(DentalPatientFinanceModuleSyncLogSchema), ErrorResponseSchema]);

export const UpdateSyncLogParams = z.object({
  logId: UUIDSchema,
});
export type UpdateSyncLogParams = z.infer<typeof UpdateSyncLogParams>;

export const UpdateSyncLogBody = DentalPatientFinanceModuleUpdateSyncLogRequestSchema;
export type UpdateSyncLogBody = z.infer<typeof UpdateSyncLogBody>;

export const UpdateSyncLogResponse = z.union([DentalPatientFinanceModuleSyncLogSchema, ErrorResponseSchema]);

export const ListTreatmentTemplatesQuery = z.object({
  branchId: UUIDSchema,
});
export type ListTreatmentTemplatesQuery = z.infer<typeof ListTreatmentTemplatesQuery>;

export const ListTreatmentTemplatesResponse = ListTreatmentTemplatesResponseSchema;

export const CreateTreatmentTemplateBody = CreateTreatmentTemplateRequestSchema;
export type CreateTreatmentTemplateBody = z.infer<typeof CreateTreatmentTemplateBody>;

export const CreateTreatmentTemplateResponse = TreatmentTemplateSchema;

export const UpdateTreatmentTemplateParams = z.object({
  id: UUIDSchema,
});
export type UpdateTreatmentTemplateParams = z.infer<typeof UpdateTreatmentTemplateParams>;

export const UpdateTreatmentTemplateBody = UpdateTreatmentTemplateRequestSchema;
export type UpdateTreatmentTemplateBody = z.infer<typeof UpdateTreatmentTemplateBody>;

export const UpdateTreatmentTemplateResponse = TreatmentTemplateSchema;

export const DeleteTreatmentTemplateParams = z.object({
  id: UUIDSchema,
});
export type DeleteTreatmentTemplateParams = z.infer<typeof DeleteTreatmentTemplateParams>;

export const DeleteTreatmentTemplateResponse = z.record(z.string(), z.unknown());

export const CreateDentalVisitBody = CreateDentalVisitRequestSchema;
export type CreateDentalVisitBody = z.infer<typeof CreateDentalVisitBody>;

export const CreateDentalVisitResponse = DentalVisitSchema;

export const ListDentalVisitsQuery = z.object({
  patientId: UUIDSchema.optional(),
  branchId: UUIDSchema.optional(),
  status: DentalVisitStatusSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListDentalVisitsQuery = z.infer<typeof ListDentalVisitsQuery>;

export const ListDentalVisitsResponse = z.object({
  data: z.array(DentalVisitSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const ListChartConflictsParams = z.object({
  patientId: UUIDSchema,
});
export type ListChartConflictsParams = z.infer<typeof ListChartConflictsParams>;

export const ListChartConflictsResponse = z.array(ChartConflictSchema);

export const GetToothHistoryParams = z.object({
  patientId: UUIDSchema,
  toothNumber: z.coerce.number().int(),
});
export type GetToothHistoryParams = z.infer<typeof GetToothHistoryParams>;

export const GetToothHistoryResponse = z.object({
  data: z.array(ToothHistoryEntrySchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const ListPMDsQuery = z.object({
  patientId: UUIDSchema,
});
export type ListPMDsQuery = z.infer<typeof ListPMDsQuery>;

export const ListPMDsResponse = z.object({
  data: z.array(PMDDocumentSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetDentalVisitParams = z.object({
  visitId: UUIDSchema,
});
export type GetDentalVisitParams = z.infer<typeof GetDentalVisitParams>;

export const GetDentalVisitResponse = DentalVisitSchema;

export const UpdateDentalVisitParams = z.object({
  visitId: UUIDSchema,
});
export type UpdateDentalVisitParams = z.infer<typeof UpdateDentalVisitParams>;

export const UpdateDentalVisitBody = UpdateDentalVisitRequestSchema;
export type UpdateDentalVisitBody = z.infer<typeof UpdateDentalVisitBody>;

export const UpdateDentalVisitResponse = DentalVisitSchema;

export const CreateAmendmentParams = z.object({
  visitId: UUIDSchema,
});
export type CreateAmendmentParams = z.infer<typeof CreateAmendmentParams>;

export const CreateAmendmentBody = CreateAmendmentRequestSchema;
export type CreateAmendmentBody = z.infer<typeof CreateAmendmentBody>;

export const CreateAmendmentResponse = AmendmentSchema;

export const ListAmendmentsParams = z.object({
  visitId: UUIDSchema,
});
export type ListAmendmentsParams = z.infer<typeof ListAmendmentsParams>;

export const ListAmendmentsResponse = z.object({
  data: z.array(AmendmentSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const ApproveAmendmentParams = z.object({
  visitId: UUIDSchema,
  amendmentId: UUIDSchema,
});
export type ApproveAmendmentParams = z.infer<typeof ApproveAmendmentParams>;

export const ApproveAmendmentResponse = AmendmentSchema;

export const ApplyTemplateParams = z.object({
  visitId: UUIDSchema,
  templateId: UUIDSchema,
});
export type ApplyTemplateParams = z.infer<typeof ApplyTemplateParams>;

export const ApplyTemplateResponse = ApplyTemplateResponseSchema;

export const CreateAttachmentParams = z.object({
  visitId: UUIDSchema,
});
export type CreateAttachmentParams = z.infer<typeof CreateAttachmentParams>;

export const CreateAttachmentBody = CreateDentalAttachmentRequestSchema;
export type CreateAttachmentBody = z.infer<typeof CreateAttachmentBody>;

export const CreateAttachmentResponse = DentalAttachmentSchema;

export const ListAttachmentsParams = z.object({
  visitId: UUIDSchema,
});
export type ListAttachmentsParams = z.infer<typeof ListAttachmentsParams>;

export const ListAttachmentsResponse = z.object({
  data: z.array(DentalAttachmentSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const DeleteAttachmentParams = z.object({
  visitId: UUIDSchema,
  attachmentId: UUIDSchema,
});
export type DeleteAttachmentParams = z.infer<typeof DeleteAttachmentParams>;

export const DeleteAttachmentResponse = z.void();

export const CarryOverTreatmentsParams = z.object({
  visitId: UUIDSchema,
});
export type CarryOverTreatmentsParams = z.infer<typeof CarryOverTreatmentsParams>;

export const CarryOverTreatmentsBody = CarryOverTreatmentsRequestSchema;
export type CarryOverTreatmentsBody = z.infer<typeof CarryOverTreatmentsBody>;

export const CarryOverTreatmentsResponse = CarryOverTreatmentsResponseSchema;

export const UpsertDentalChartParams = z.object({
  visitId: UUIDSchema,
});
export type UpsertDentalChartParams = z.infer<typeof UpsertDentalChartParams>;

export const UpsertDentalChartBody = CreateDentalChartRequestSchema;
export type UpsertDentalChartBody = z.infer<typeof UpsertDentalChartBody>;

export const UpsertDentalChartResponse = DentalChartSchema;

export const GetDentalChartParams = z.object({
  visitId: UUIDSchema,
});
export type GetDentalChartParams = z.infer<typeof GetDentalChartParams>;

export const GetDentalChartResponse = DentalChartSchema;

export const ExportDentalChartParams = z.object({
  visitId: UUIDSchema,
});
export type ExportDentalChartParams = z.infer<typeof ExportDentalChartParams>;

export const ExportDentalChartResponse = ChartExportSchema;

export const ResolveChartConflictParams = z.object({
  visitId: UUIDSchema,
});
export type ResolveChartConflictParams = z.infer<typeof ResolveChartConflictParams>;

export const ResolveChartConflictBody = ResolveChartConflictRequestSchema;
export type ResolveChartConflictBody = z.infer<typeof ResolveChartConflictBody>;

export const ResolveChartConflictResponse = DentalChartSchema;

export const UpdateToothParams = z.object({
  visitId: UUIDSchema,
  toothNumber: z.coerce.number().int(),
});
export type UpdateToothParams = z.infer<typeof UpdateToothParams>;

export const UpdateToothBody = UpdateToothRequestSchema;
export type UpdateToothBody = z.infer<typeof UpdateToothBody>;

export const UpdateToothResponse = DentalChartSchema;

export const RecordConsentRefusalParams = z.object({
  visitId: UUIDSchema,
});
export type RecordConsentRefusalParams = z.infer<typeof RecordConsentRefusalParams>;

export const RecordConsentRefusalBody = RecordConsentRefusalRequestSchema;
export type RecordConsentRefusalBody = z.infer<typeof RecordConsentRefusalBody>;

export const RecordConsentRefusalResponse = InformedRefusalSchema;

export const ListConsentRefusalsParams = z.object({
  visitId: UUIDSchema,
});
export type ListConsentRefusalsParams = z.infer<typeof ListConsentRefusalsParams>;

export const ListConsentRefusalsResponse = z.object({
  data: z.array(InformedRefusalSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const CreateConsentFormParams = z.object({
  visitId: UUIDSchema,
});
export type CreateConsentFormParams = z.infer<typeof CreateConsentFormParams>;

export const CreateConsentFormBody = CreateConsentFormRequestSchema;
export type CreateConsentFormBody = z.infer<typeof CreateConsentFormBody>;

export const CreateConsentFormResponse = ConsentFormSchema;

export const ListConsentFormsParams = z.object({
  visitId: UUIDSchema,
});
export type ListConsentFormsParams = z.infer<typeof ListConsentFormsParams>;

export const ListConsentFormsResponse = z.object({
  data: z.array(ConsentFormSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const RevokeConsentFormParams = z.object({
  visitId: UUIDSchema,
  cid: UUIDSchema,
});
export type RevokeConsentFormParams = z.infer<typeof RevokeConsentFormParams>;

export const RevokeConsentFormResponse = ConsentFormSchema;

export const SignConsentFormParams = z.object({
  visitId: UUIDSchema,
  consentId: UUIDSchema,
});
export type SignConsentFormParams = z.infer<typeof SignConsentFormParams>;

export const SignConsentFormBody = SignConsentFormRequestSchema;
export type SignConsentFormBody = z.infer<typeof SignConsentFormBody>;

export const SignConsentFormResponse = ConsentFormSchema;

export const DiscardVisitParams = z.object({
  visitId: UUIDSchema,
});
export type DiscardVisitParams = z.infer<typeof DiscardVisitParams>;

export const DiscardVisitBody = DentalVisitModuleDiscardVisitRequestSchema;
export type DiscardVisitBody = z.infer<typeof DiscardVisitBody>;

export const DiscardVisitResponse = DentalVisitSchema;

export const CreateDentalFindingParams = z.object({
  visitId: UUIDSchema,
});
export type CreateDentalFindingParams = z.infer<typeof CreateDentalFindingParams>;

export const CreateDentalFindingBody = CreateFindingRequestSchema;
export type CreateDentalFindingBody = z.infer<typeof CreateDentalFindingBody>;

export const CreateDentalFindingResponse = DentalFindingSchema;

export const ListDentalFindingsParams = z.object({
  visitId: UUIDSchema,
});
export type ListDentalFindingsParams = z.infer<typeof ListDentalFindingsParams>;

export const ListDentalFindingsResponse = z.object({
  data: z.array(DentalFindingSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const UpdateDentalFindingParams = z.object({
  visitId: UUIDSchema,
  findingId: UUIDSchema,
});
export type UpdateDentalFindingParams = z.infer<typeof UpdateDentalFindingParams>;

export const UpdateDentalFindingBody = UpdateFindingRequestSchema;
export type UpdateDentalFindingBody = z.infer<typeof UpdateDentalFindingBody>;

export const UpdateDentalFindingResponse = DentalFindingSchema;

export const ConvertFindingToTreatmentParams = z.object({
  visitId: UUIDSchema,
  findingId: UUIDSchema,
});
export type ConvertFindingToTreatmentParams = z.infer<typeof ConvertFindingToTreatmentParams>;

export const ConvertFindingToTreatmentBody = ConvertFindingToTreatmentRequestSchema;
export type ConvertFindingToTreatmentBody = z.infer<typeof ConvertFindingToTreatmentBody>;

export const ConvertFindingToTreatmentResponse = DentalTreatmentSchema;

export const CreateLabOrderParams = z.object({
  visitId: UUIDSchema,
});
export type CreateLabOrderParams = z.infer<typeof CreateLabOrderParams>;

export const CreateLabOrderBody = CreateLabOrderRequestSchema;
export type CreateLabOrderBody = z.infer<typeof CreateLabOrderBody>;

export const CreateLabOrderResponse = LabOrderSchema;

export const ListLabOrdersParams = z.object({
  visitId: UUIDSchema,
});
export type ListLabOrdersParams = z.infer<typeof ListLabOrdersParams>;

export const ListLabOrdersResponse = z.object({
  data: z.array(LabOrderSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const UpdateLabOrderParams = z.object({
  visitId: UUIDSchema,
  orderId: UUIDSchema,
});
export type UpdateLabOrderParams = z.infer<typeof UpdateLabOrderParams>;

export const UpdateLabOrderBody = UpdateLabOrderRequestSchema;
export type UpdateLabOrderBody = z.infer<typeof UpdateLabOrderBody>;

export const UpdateLabOrderResponse = LabOrderSchema;

export const UpsertVisitNotesParams = z.object({
  visitId: UUIDSchema,
});
export type UpsertVisitNotesParams = z.infer<typeof UpsertVisitNotesParams>;

export const UpsertVisitNotesBody = UpsertVisitNotesRequestSchema;
export type UpsertVisitNotesBody = z.infer<typeof UpsertVisitNotesBody>;

export const UpsertVisitNotesResponse = VisitNotesSchema;

export const GetVisitNotesParams = z.object({
  visitId: UUIDSchema,
});
export type GetVisitNotesParams = z.infer<typeof GetVisitNotesParams>;

export const GetVisitNotesResponse = VisitNotesSchema;

export const CreateVisitNoteAddendumParams = z.object({
  visitId: UUIDSchema,
});
export type CreateVisitNoteAddendumParams = z.infer<typeof CreateVisitNoteAddendumParams>;

export const CreateVisitNoteAddendumBody = CreateVisitNoteAddendumRequestSchema;
export type CreateVisitNoteAddendumBody = z.infer<typeof CreateVisitNoteAddendumBody>;

export const CreateVisitNoteAddendumResponse = VisitNoteVersionSchema;

export const GetVisitNoteHistoryParams = z.object({
  visitId: UUIDSchema,
});
export type GetVisitNoteHistoryParams = z.infer<typeof GetVisitNoteHistoryParams>;

export const GetVisitNoteHistoryResponse = z.array(VisitNoteVersionSchema);

export const SignVisitNotesParams = z.object({
  visitId: UUIDSchema,
});
export type SignVisitNotesParams = z.infer<typeof SignVisitNotesParams>;

export const SignVisitNotesBody = SignVisitNotesRequestSchema;
export type SignVisitNotesBody = z.infer<typeof SignVisitNotesBody>;

export const SignVisitNotesResponse = VisitNotesSchema;

export const GetVisitPerioChartParams = z.object({
  visitId: UUIDSchema,
});
export type GetVisitPerioChartParams = z.infer<typeof GetVisitPerioChartParams>;

export const GetVisitPerioChartResponse = PerioChartSchema;

export const GeneratePMDParams = z.object({
  visitId: UUIDSchema,
});
export type GeneratePMDParams = z.infer<typeof GeneratePMDParams>;

export const GeneratePMDBody = GeneratePMDRequestSchema;
export type GeneratePMDBody = z.infer<typeof GeneratePMDBody>;

export const GeneratePMDResponse = PMDDocumentSchema;

export const GetPMDForVisitParams = z.object({
  visitId: UUIDSchema,
});
export type GetPMDForVisitParams = z.infer<typeof GetPMDForVisitParams>;

export const GetPMDForVisitResponse = PMDDocumentSchema;

export const ExportPMDParams = z.object({
  visitId: UUIDSchema,
});
export type ExportPMDParams = z.infer<typeof ExportPMDParams>;

export const ExportPMDResponse = PMDDocumentSchema;

export const CreatePrescriptionParams = z.object({
  visitId: UUIDSchema,
});
export type CreatePrescriptionParams = z.infer<typeof CreatePrescriptionParams>;

export const CreatePrescriptionBody = CreatePrescriptionRequestSchema;
export type CreatePrescriptionBody = z.infer<typeof CreatePrescriptionBody>;

export const CreatePrescriptionResponse = PrescriptionSchema;

export const ListPrescriptionsParams = z.object({
  visitId: UUIDSchema,
});
export type ListPrescriptionsParams = z.infer<typeof ListPrescriptionsParams>;

export const ListPrescriptionsResponse = z.object({
  data: z.array(PrescriptionSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const UpdatePrescriptionParams = z.object({
  visitId: UUIDSchema,
  prescriptionId: UUIDSchema,
});
export type UpdatePrescriptionParams = z.infer<typeof UpdatePrescriptionParams>;

export const UpdatePrescriptionBody = UpdatePrescriptionRequestSchema;
export type UpdatePrescriptionBody = z.infer<typeof UpdatePrescriptionBody>;

export const UpdatePrescriptionResponse = PrescriptionSchema;

export const CreateDentalTreatmentParams = z.object({
  visitId: UUIDSchema,
});
export type CreateDentalTreatmentParams = z.infer<typeof CreateDentalTreatmentParams>;

export const CreateDentalTreatmentBody = CreateDentalTreatmentRequestSchema;
export type CreateDentalTreatmentBody = z.infer<typeof CreateDentalTreatmentBody>;

export const CreateDentalTreatmentResponse = DentalTreatmentSchema;

export const ListDentalTreatmentsParams = z.object({
  visitId: UUIDSchema,
});
export type ListDentalTreatmentsParams = z.infer<typeof ListDentalTreatmentsParams>;

export const ListDentalTreatmentsResponse = z.object({
  data: z.array(DentalTreatmentSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const UpdateDentalTreatmentParams = z.object({
  visitId: UUIDSchema,
  treatmentId: UUIDSchema,
});
export type UpdateDentalTreatmentParams = z.infer<typeof UpdateDentalTreatmentParams>;

export const UpdateDentalTreatmentBody = UpdateDentalTreatmentRequestSchema;
export type UpdateDentalTreatmentBody = z.infer<typeof UpdateDentalTreatmentBody>;

export const UpdateDentalTreatmentResponse = DentalTreatmentSchema;

export const PromoteWaitlistEntryParams = z.object({
  entryId: UUIDSchema,
});
export type PromoteWaitlistEntryParams = z.infer<typeof PromoteWaitlistEntryParams>;

export const PromoteWaitlistEntryBody = DentalWaitlistModulePromoteWaitlistEntryRequestSchema;
export type PromoteWaitlistEntryBody = z.infer<typeof PromoteWaitlistEntryBody>;

export const PromoteWaitlistEntryResponse = ErrorResponseSchema;

export const ListEmailQueueItemsQuery = z.object({
  status: z.union([EmailQueueStatusSchema, z.array(EmailQueueStatusSchema), z.string().transform(val => val.split(",").map(s => s.trim())).pipe(z.array(EmailQueueStatusSchema))]).optional(),
  recipientEmail: EmailSchema.optional(),
  dateFrom: StrictUtcDateTimeSchema.optional(),
  dateTo: StrictUtcDateTimeSchema.optional(),
  priority: z.coerce.number().int().optional(),
  scheduledOnly: z.coerce.boolean().optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListEmailQueueItemsQuery = z.infer<typeof ListEmailQueueItemsQuery>;

export const ListEmailQueueItemsResponse = z.object({
  data: z.array(EmailQueueItemSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetEmailQueueItemParams = z.object({
  queue: UUIDSchema,
});
export type GetEmailQueueItemParams = z.infer<typeof GetEmailQueueItemParams>;

export const GetEmailQueueItemResponse = EmailQueueItemSchema;

export const CancelEmailQueueItemParams = z.object({
  queue: UUIDSchema,
});
export type CancelEmailQueueItemParams = z.infer<typeof CancelEmailQueueItemParams>;

export const CancelEmailQueueItemBody = CancelEmailRequestSchema;
export type CancelEmailQueueItemBody = z.infer<typeof CancelEmailQueueItemBody>;

export const CancelEmailQueueItemResponse = EmailQueueItemSchema;

export const RetryEmailQueueItemParams = z.object({
  queue: UUIDSchema,
});
export type RetryEmailQueueItemParams = z.infer<typeof RetryEmailQueueItemParams>;

export const RetryEmailQueueItemResponse = EmailQueueItemSchema;

export const ListEmailTemplatesQuery = z.object({
  status: TemplateStatusSchema.optional(),
  tags: z.string().transform(val => val.split(",").filter(Boolean)).optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListEmailTemplatesQuery = z.infer<typeof ListEmailTemplatesQuery>;

export const ListEmailTemplatesResponse = z.object({
  data: z.array(EmailTemplateSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const CreateEmailTemplateBody = CreateTemplateRequestSchema;
export type CreateEmailTemplateBody = z.infer<typeof CreateEmailTemplateBody>;

export const CreateEmailTemplateResponse = EmailTemplateSchema;

export const GetEmailTemplateParams = z.object({
  template: UUIDSchema,
});
export type GetEmailTemplateParams = z.infer<typeof GetEmailTemplateParams>;

export const GetEmailTemplateResponse = EmailTemplateSchema;

export const UpdateEmailTemplateParams = z.object({
  template: UUIDSchema,
});
export type UpdateEmailTemplateParams = z.infer<typeof UpdateEmailTemplateParams>;

export const UpdateEmailTemplateBody = UpdateTemplateRequestSchema;
export type UpdateEmailTemplateBody = z.infer<typeof UpdateEmailTemplateBody>;

export const UpdateEmailTemplateResponse = EmailTemplateSchema;

export const TestEmailTemplateParams = z.object({
  template: UUIDSchema,
});
export type TestEmailTemplateParams = z.infer<typeof TestEmailTemplateParams>;

export const TestEmailTemplateBody = TestTemplateRequestSchema;
export type TestEmailTemplateBody = z.infer<typeof TestEmailTemplateBody>;

export const TestEmailTemplateResponse = TestTemplateResultSchema;

export const CreateConsultationBody = CreateConsultationRequestSchema;
export type CreateConsultationBody = z.infer<typeof CreateConsultationBody>;

export const CreateConsultationResponse = ConsultationNoteSchema;

export const ListConsultationsQuery = z.object({
  patient: UUIDSchema.optional(),
  status: ConsultationStatusSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListConsultationsQuery = z.infer<typeof ListConsultationsQuery>;

export const ListConsultationsResponse = z.object({
  data: z.array(ConsultationNoteSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetConsultationParams = z.object({
  consultation: UUIDSchema,
});
export type GetConsultationParams = z.infer<typeof GetConsultationParams>;

export const GetConsultationResponse = ConsultationNoteSchema;

export const UpdateConsultationParams = z.object({
  consultation: UUIDSchema,
});
export type UpdateConsultationParams = z.infer<typeof UpdateConsultationParams>;

export const UpdateConsultationBody = UpdateConsultationRequestSchema;
export type UpdateConsultationBody = z.infer<typeof UpdateConsultationBody>;

export const UpdateConsultationResponse = ConsultationNoteSchema;

export const FinalizeConsultationParams = z.object({
  consultation: UUIDSchema,
});
export type FinalizeConsultationParams = z.infer<typeof FinalizeConsultationParams>;

export const FinalizeConsultationResponse = ConsultationNoteSchema;

export const ListEMRPatientsQuery = z.object({
  expand: z.string().optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListEMRPatientsQuery = z.infer<typeof ListEMRPatientsQuery>;

export const ListEMRPatientsResponse = z.object({
  data: z.array(PatientSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const ListMyAppointmentsResponse = z.array(DentalPortalModuleMyAppointmentSchema);

export const GetMyBalanceResponse = DentalPortalModuleMyBalanceSchema;

export const ListMyInvoicesResponse = z.array(DentalPortalModuleMyInvoiceSchema);

export const ListNotificationsQuery = z.object({
  type: NotificationTypeSchema.optional(),
  channel: NotificationChannelSchema.optional(),
  status: NotificationStatusSchema.optional(),
  startDate: StrictUtcDateTimeSchema.optional(),
  endDate: StrictUtcDateTimeSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuery>;

export const ListNotificationsResponse = z.object({
  data: z.array(NotificationSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const MarkAllNotificationsAsReadQuery = z.object({
  type: NotificationTypeSchema.optional(),
});
export type MarkAllNotificationsAsReadQuery = z.infer<typeof MarkAllNotificationsAsReadQuery>;

export const MarkAllNotificationsAsReadResponse = z.object({
  markedCount: z.number().int()
});

export const GetNotificationParams = z.object({
  notif: UUIDSchema,
});
export type GetNotificationParams = z.infer<typeof GetNotificationParams>;

export const GetNotificationResponse = NotificationSchema;

export const MarkNotificationAsReadParams = z.object({
  notif: UUIDSchema,
});
export type MarkNotificationAsReadParams = z.infer<typeof MarkNotificationAsReadParams>;

export const MarkNotificationAsReadResponse = NotificationSchema;

export const CreatePatientBody = CreatePatientRequestSchema;
export type CreatePatientBody = z.infer<typeof CreatePatientBody>;

export const CreatePatientResponse = PatientSchema;

export const ListPatientsQuery = z.object({
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
  name: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  mrn: z.string().optional(),
  active: z.coerce.boolean().optional(),
  branchId: UUIDSchema.optional(),
  needsFollowUp: z.coerce.boolean().optional(),
});
export type ListPatientsQuery = z.infer<typeof ListPatientsQuery>;

export const ListPatientsResponse = z.object({
  data: z.array(PatientSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const MergePatientsBody = PatientMergeRequestSchema;
export type MergePatientsBody = z.infer<typeof MergePatientsBody>;

export const MergePatientsResponse = PatientMergeResultSchema;

export const UnmergePatientsBody = PatientUnmergeRequestSchema;
export type UnmergePatientsBody = z.infer<typeof UnmergePatientsBody>;

export const UnmergePatientsResponse = PatientMergeResultSchema;

export const GetPatientParams = z.object({
  id: UUIDSchema,
});
export type GetPatientParams = z.infer<typeof GetPatientParams>;

export const GetPatientResponse = PatientSchema;

export const UpdatePatientParams = z.object({
  id: UUIDSchema,
});
export type UpdatePatientParams = z.infer<typeof UpdatePatientParams>;

export const UpdatePatientBody = UpdatePatientRequestSchema;
export type UpdatePatientBody = z.infer<typeof UpdatePatientBody>;

export const UpdatePatientResponse = PatientSchema;

export const DeactivatePatientParams = z.object({
  id: UUIDSchema,
});
export type DeactivatePatientParams = z.infer<typeof DeactivatePatientParams>;

export const DeactivatePatientResponse = z.void();

export const CreatePersonBody = PersonCreateRequestSchema;
export type CreatePersonBody = z.infer<typeof CreatePersonBody>;

export const CreatePersonResponse = PersonSchema;

export const ListPersonsQuery = z.object({
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListPersonsQuery = z.infer<typeof ListPersonsQuery>;

export const ListPersonsResponse = z.object({
  data: z.array(PersonSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetPersonParams = z.object({
  person: z.union([UUIDSchema, z.enum(["me"])]),
});
export type GetPersonParams = z.infer<typeof GetPersonParams>;

export const GetPersonResponse = PersonSchema;

export const UpdatePersonParams = z.object({
  person: UUIDSchema,
});
export type UpdatePersonParams = z.infer<typeof UpdatePersonParams>;

export const UpdatePersonBody = PersonUpdateRequestSchema;
export type UpdatePersonBody = z.infer<typeof UpdatePersonBody>;

export const UpdatePersonResponse = PersonSchema;

export const CreateProviderBody = CreateProviderRequestSchema;
export type CreateProviderBody = z.infer<typeof CreateProviderBody>;

export const CreateProviderResponse = ProviderSchema;

export const CreatePractitionerRoleBody = CreatePractitionerRoleRequestSchema;
export type CreatePractitionerRoleBody = z.infer<typeof CreatePractitionerRoleBody>;

export const CreatePractitionerRoleResponse = PractitionerRoleSchema;

export const ListPractitionerRolesQuery = z.object({
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
  practitioner: UUIDSchema.optional(),
  organization: UUIDSchema.optional(),
  specialty: z.string().optional(),
  location: UUIDSchema.optional(),
  active: z.coerce.boolean().optional(),
});
export type ListPractitionerRolesQuery = z.infer<typeof ListPractitionerRolesQuery>;

export const ListPractitionerRolesResponse = z.object({
  data: z.array(PractitionerRoleSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetPractitionerRoleParams = z.object({
  id: UUIDSchema,
});
export type GetPractitionerRoleParams = z.infer<typeof GetPractitionerRoleParams>;

export const GetPractitionerRoleResponse = PractitionerRoleSchema;

export const UpdatePractitionerRoleParams = z.object({
  id: UUIDSchema,
});
export type UpdatePractitionerRoleParams = z.infer<typeof UpdatePractitionerRoleParams>;

export const UpdatePractitionerRoleBody = UpdatePractitionerRoleRequestSchema;
export type UpdatePractitionerRoleBody = z.infer<typeof UpdatePractitionerRoleBody>;

export const UpdatePractitionerRoleResponse = PractitionerRoleSchema;

export const DeactivatePractitionerRoleParams = z.object({
  id: UUIDSchema,
});
export type DeactivatePractitionerRoleParams = z.infer<typeof DeactivatePractitionerRoleParams>;

export const DeactivatePractitionerRoleResponse = z.void();

export const CreatePractitionerBody = CreatePractitionerRequestSchema;
export type CreatePractitionerBody = z.infer<typeof CreatePractitionerBody>;

export const CreatePractitionerResponse = PractitionerSchema;

export const ListPractitionersQuery = z.object({
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
  name: z.string().optional(),
  specialty: z.string().optional(),
  npi: z.string().optional(),
  active: z.coerce.boolean().optional(),
});
export type ListPractitionersQuery = z.infer<typeof ListPractitionersQuery>;

export const ListPractitionersResponse = z.object({
  data: z.array(PractitionerSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetPractitionerParams = z.object({
  id: UUIDSchema,
});
export type GetPractitionerParams = z.infer<typeof GetPractitionerParams>;

export const GetPractitionerResponse = PractitionerSchema;

export const UpdatePractitionerParams = z.object({
  id: UUIDSchema,
});
export type UpdatePractitionerParams = z.infer<typeof UpdatePractitionerParams>;

export const UpdatePractitionerBody = UpdatePractitionerRequestSchema;
export type UpdatePractitionerBody = z.infer<typeof UpdatePractitionerBody>;

export const UpdatePractitionerResponse = PractitionerSchema;

export const DeactivatePractitionerParams = z.object({
  id: UUIDSchema,
});
export type DeactivatePractitionerParams = z.infer<typeof DeactivatePractitionerParams>;

export const DeactivatePractitionerResponse = z.void();

export const CreateReviewBody = CreateReviewRequestSchema;
export type CreateReviewBody = z.infer<typeof CreateReviewBody>;

export const CreateReviewResponse = ReviewSchema;

export const ListReviewsQuery = z.object({
  context: UUIDSchema.optional(),
  reviewer: UUIDSchema.optional(),
  reviewType: SafeQueryStringSchema.optional(),
  reviewedEntity: UUIDSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListReviewsQuery = z.infer<typeof ListReviewsQuery>;

export const ListReviewsResponse = z.object({
  data: z.array(ReviewSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const GetReviewParams = z.object({
  review: UUIDSchema,
});
export type GetReviewParams = z.infer<typeof GetReviewParams>;

export const GetReviewResponse = ReviewSchema;

export const DeleteReviewParams = z.object({
  review: UUIDSchema,
});
export type DeleteReviewParams = z.infer<typeof DeleteReviewParams>;

export const DeleteReviewResponse = z.void();

export const ListFilesQuery = z.object({
  status: FileStatusSchema.optional(),
  owner: UUIDSchema.optional(),
  offset: z.coerce.number().int().gte(0).lte(2147483647).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).lte(2147483647).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: SafeQueryStringSchema.optional(),
  sort: SafeQueryStringSchema.optional(),
});
export type ListFilesQuery = z.infer<typeof ListFilesQuery>;

export const ListFilesResponse = z.object({
  data: z.array(StoredFileSchema),
  pagination: z.object({
  offset: z.number().int(),
  limit: z.number().int(),
  count: z.number().int(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
})
});

export const UploadFileBody = FileUploadRequestSchema;
export type UploadFileBody = z.infer<typeof UploadFileBody>;

export const UploadFileResponse = FileUploadResponseSchema;

export const GetFileParams = z.object({
  file: UUIDSchema,
});
export type GetFileParams = z.infer<typeof GetFileParams>;

export const GetFileResponse = StoredFileSchema;

export const DeleteFileParams = z.object({
  file: UUIDSchema,
});
export type DeleteFileParams = z.infer<typeof DeleteFileParams>;

export const DeleteFileResponse = z.void();

export const CompleteFileUploadParams = z.object({
  file: UUIDSchema,
});
export type CompleteFileUploadParams = z.infer<typeof CompleteFileUploadParams>;

export const CompleteFileUploadResponse = StoredFileSchema;

export const GetFileDownloadParams = z.object({
  file: UUIDSchema,
});
export type GetFileDownloadParams = z.infer<typeof GetFileDownloadParams>;

export const GetFileDownloadResponse = FileDownloadResponseSchema;

export const InitiateMultipartUploadBody = MultipartInitiateRequestSchema;
export type InitiateMultipartUploadBody = z.infer<typeof InitiateMultipartUploadBody>;

export const InitiateMultipartUploadResponse = MultipartInitiateResponseSchema;

export const AbortMultipartUploadParams = z.object({
  file: UUIDSchema,
});
export type AbortMultipartUploadParams = z.infer<typeof AbortMultipartUploadParams>;

export const AbortMultipartUploadResponse = z.void();

export const CompleteMultipartUploadParams = z.object({
  file: UUIDSchema,
});
export type CompleteMultipartUploadParams = z.infer<typeof CompleteMultipartUploadParams>;

export const CompleteMultipartUploadBody = MultipartCompleteRequestSchema;
export type CompleteMultipartUploadBody = z.infer<typeof CompleteMultipartUploadBody>;

export const CompleteMultipartUploadResponse = StoredFileSchema;

export const GenerateMultipartPartUrlParams = z.object({
  file: UUIDSchema,
});
export type GenerateMultipartPartUrlParams = z.infer<typeof GenerateMultipartPartUrlParams>;

export const GenerateMultipartPartUrlQuery = z.object({
  partNumber: z.coerce.number().int(),
});
export type GenerateMultipartPartUrlQuery = z.infer<typeof GenerateMultipartPartUrlQuery>;

export const GenerateMultipartPartUrlResponse = MultipartPartUrlResponseSchema;
