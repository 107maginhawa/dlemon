// Generated file. Recursive Zod schemas (e.g. CompositionSection,
// QuestionnaireItem) reference themselves via z.lazy() and carry an explicit
// `: z.ZodTypeAny` annotation so TypeScript can break the cycle.
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

export const AddressUpdateSchema = z.object({
  street1: z.string().min(1).max(100).optional(),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50).optional(),
  state: z.string().min(1).max(50).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }).optional(),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().gte(0).optional()
}).optional()
});

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
  context: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  timezone: z.string(),
  locationTypes: z.array(LocationTypeSchema),
  maxBookingDays: z.number().int().gte(0).lte(365),
  minBookingMinutes: z.number().int().gte(0).lte(4320),
  formConfig: z.object({
  fields: z.array(FormFieldConfigSchema).optional()
}).optional(),
  billingConfig: z.object({
  price: z.number().int().gte(0),
  currency: z.string(),
  cancellationThresholdMinutes: z.number().int().gte(0).lte(10080)
}).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]),
  effectiveFrom: z.string().datetime().transform((str) => new Date(str)),
  effectiveTo: z.string().datetime().transform((str) => new Date(str)).optional(),
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

export const UUIDSchema = z.string().uuid();

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

export const ContactInfoSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).refine(val => validatePhoneNumber(val), { message: "Invalid phone number in E.164 format" }).optional()
});

export const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" });

export const CreateChatRoomRequestSchema = z.object({
  participants: z.array(UUIDSchema),
  admins: z.array(UUIDSchema).optional(),
  context: z.string().uuid().optional(),
  upsert: z.boolean().optional()
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

export const HealthcareCoreCodeableConceptSchema = z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
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

export const LocationHoursSchema = z.object({
  daysOfWeek: z.array(z.string()).optional(),
  allDay: z.boolean().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional()
});

export const CreateLocationRequestSchema = z.object({
  name: z.string(),
  managingOrganization: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  status: z.enum(["active", "suspended", "inactive"]).optional(),
  mode: z.enum(["instance", "kind"]).optional(),
  aliases: z.array(z.string()).optional(),
  description: z.string().optional(),
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
  partOf: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  hoursOfOperation: z.array(LocationHoursSchema).optional()
});

export const CreateMerchantAccountRequestSchema = z.object({
  person: z.string().uuid().optional(),
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
  metadata: z.record(z.string(), z.unknown()).optional()
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

export const CreateOrganizationRequestSchema = z.object({
  name: z.string(),
  type: z.array(HealthcareCoreCodeableConceptSchema),
  active: z.boolean().optional(),
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
  insuranceCoverage: z.array(HealthcareCoreReferenceSchema).optional()
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

export const CredentialStatusSchema = z.enum(["active", "expired", "suspended", "revoked", "pending"]);

export const CredentialTypeSchema = z.enum(["npi", "dea", "state-license", "board-certification", "cme", "other"]);

export const CurrencyAmountSchema = z.number().int().gte(0);

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

export const DashboardResponseSchema = z.object({
  dashboardUrl: z.string().url(),
  expiresAt: z.string().datetime().transform((str) => new Date(str))
});

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

export const HealthcareAdministrativeBedManagementBedAssignRequestSchema = z.object({
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  encounter: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareAdministrativeBedManagementBedOccupancySchema = z.object({
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
  bed: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAdministrativeBedManagementBedStatusSchema = z.enum(["available", "occupied", "housekeeping", "contaminated", "closed", "blocked"]);

export const HealthcareAdministrativeBedManagementBedTypeSchema = z.enum(["icu", "general", "surgical", "maternity", "pediatric", "psychiatric", "isolation", "stepDown"]);

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

export const HealthcareAdministrativeChargeCaptureChargeBulkCreateRequestSchema = z.object({
  items: z.array(HealthcareAdministrativeChargeCaptureChargeItemSchema)
});

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

export const HealthcareAdministrativeChargeCaptureChargeItemStatusSchema = z.enum(["planned", "billable", "notBillable", "aborted", "billed", "enteredInError"]);

export const HealthcareAdministrativeChargeCaptureChargeVerificationRequestSchema = z.object({
  encounterIds: z.array(z.string()).optional(),
  dateRange: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
  status: z.string().optional()
});

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

export const HealthcareAdministrativeClaimsClaimSubmitRequestSchema = z.object({
  claimId: z.string()
});

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

export const HealthcareAdministrativeFeeScheduleFeeScheduleItemBulkImportRequestSchema = z.object({
  feeScheduleId: z.string(),
  items: z.array(HealthcareAdministrativeFeeScheduleFeeScheduleItemSchema),
  replaceExisting: z.boolean().optional()
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

export const HealthcareAdministrativeHospitalCostAccountingGLGenerateRequestSchema = z.object({
  period: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}),
  costCenters: z.array(HealthcareCoreReferenceSchema).optional()
});

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

export const HealthcareAdministrativeHospitalHIMROIROIDenyParamsSchema = z.object({
  reason: z.string(),
  policyReference: z.string().optional()
});

export const HealthcareAdministrativeHospitalHIMROIROIReleaseParamsSchema = z.object({
  releasedDate: z.string().datetime().transform((str) => new Date(str)),
  releasedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  deliveryMethod: z.enum(["mail", "fax", "electronicPortal", "secureEmail", "inPerson"]),
  note: z.string().optional()
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

export const HealthcareAdministrativeInsuranceEligibilityRequestSchema = z.object({
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  coverage: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  serviceDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  serviceType: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

export const HealthcareAdministrativeInsuranceEligibilityResponseSchema = z.object({
  status: z.string(),
  eligible: z.boolean(),
  coverage: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  inNetwork: z.boolean(),
  copay: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  deductible: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  deductibleRemaining: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  outOfPocketMax: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  outOfPocketRemaining: z.object({
  value: z.number().gte(0),
  currency: z.string().regex(/^[A-Z]{3}$/)
}).optional(),
  notes: z.string().max(2000).optional()
});

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

export const HealthcareAdministrativePriorAuthPriorAuthStatusTransitionRequestSchema = z.object({
  status: z.enum(["draft", "submitted", "pending", "approved", "partiallyApproved", "denied", "cancelled", "expired"]),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
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
}).optional()
});

export const HealthcareAdministrativePriorAuthPriorAuthSubmitRequestSchema = z.object({
  priorAuthorizationId: z.string()
});

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

export const HealthcareAdministrativeSchedulingAppointmentStatusTransitionRequestSchema = z.object({
  status: z.enum(["proposed", "pending", "booked", "arrived", "fulfilled", "cancelled", "noShow", "enteredInError", "waitlist", "checkedIn"]),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

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

export const HealthcareAdministrativeWorkforceSchedulingShiftSwapRequestSchema = z.object({
  fromShiftId: z.string(),
  swapWithPractitioner: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reason: z.string().max(500).optional()
});

export const HealthcareAdministrativeWorkforceSchedulingShiftTypeSchema = z.enum(["day", "evening", "night", "oncall", "split"]);

export const HealthcareAdministrativeWorkforceSchedulingTimeOffDecisionRequestSchema = z.object({
  decision: z.enum(["pending", "approved", "denied", "cancelled"]),
  reason: z.string().max(500).optional()
});

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

export const HealthcareAnalyticsAIMetadataAIOutputReviewRequestSchema = z.object({
  reviewOutcome: z.enum(["accepted", "modified", "rejected", "pending"]),
  reviewedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  reviewNote: z.string().optional()
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

export const HealthcareAnalyticsCohortsCohortEvaluateRequestSchema = z.object({
  includeSubjectIds: z.boolean().optional(),
  maxResults: z.number().int().optional()
});

export const HealthcareAnalyticsCohortsCohortEvaluateResponseSchema = z.object({
  count: z.number().int(),
  subjectIds: z.array(z.string()).optional(),
  evaluatedAt: z.string().datetime().transform((str) => new Date(str))
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

export const HealthcareAnalyticsDeIdentificationDeIdentificationExecuteRequestSchema = z.object({
  profileId: z.string(),
  resourceType: z.string(),
  resource: z.record(z.string(), z.unknown()),
  persistMappings: z.boolean().optional()
});

export const HealthcareAnalyticsDeIdentificationDeIdentificationExecuteResponseSchema = z.object({
  resource: z.record(z.string(), z.unknown()),
  pseudonymizationMapIds: z.array(z.string()).optional(),
  summary: z.object({
  fieldsProcessed: z.number().int(),
  fieldsRemoved: z.number().int(),
  fieldsTransformed: z.number().int(),
  mappingsCreated: z.number().int()
})
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

export const HealthcareAnalyticsDeIdentificationDeIdentificationSummarySchema = z.object({
  fieldsProcessed: z.number().int(),
  fieldsRemoved: z.number().int(),
  fieldsTransformed: z.number().int(),
  mappingsCreated: z.number().int()
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

export const HealthcareAnalyticsReportingCancelReportRunRequestSchema = z.object({
  reason: z.string().max(500).optional()
});

export const HealthcareAnalyticsReportingCreateReportRunRequestSchema = z.object({
  definitionId: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional()
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

export const HealthcareAncillaryCosmeticDentalCosmeticCaseStatusTransitionRequestSchema = z.object({
  status: z.enum(["consultation", "designApproved", "inTreatment", "completed", "cancelled"]),
  note: z.string().optional()
});

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

export const HealthcareAncillaryDentalDentalTreatmentPlanCreateRequestSchema = z.object({
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
  notes: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryDentalTreatmentPlanStatusSchema = z.enum(["draft", "proposed", "accepted", "inProgress", "completed", "cancelled"]);

export const HealthcareAncillaryDentalDentalTreatmentPlanSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  status: HealthcareAncillaryDentalTreatmentPlanStatusSchema.optional(),
  providerId: z.string().optional()
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

export const HealthcareAncillaryDentalOdontogramCreateRequestSchema = z.object({
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
  teeth: z.array(HealthcareAncillaryDentalToothRecordSchema),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryDentalOdontogramSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAncillaryDentalToothNotationSystemSchema = z.enum(["fdi", "universal", "palmer"]);

export const HealthcareAncillaryDentalTreatmentItemStatusSchema = z.enum(["planned", "scheduled", "inProgress", "completed", "cancelled"]);

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

export const HealthcareAncillaryDentalLabDentalLabCaseCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryDentalLabLabCaseTypeSchema = z.enum(["crown", "bridge", "denture", "partial", "veneer", "implantAbutment", "nightGuard", "retainer", "splint", "other"]);

export const HealthcareAncillaryDentalLabDentalLabCaseStatusSchema = z.enum(["draft", "sent", "inFabrication", "shippedToClinic", "received", "delivered", "returned"]);

export const HealthcareAncillaryDentalLabDentalLabCaseSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  providerId: z.string().optional(),
  labProviderId: z.string().optional(),
  type: HealthcareAncillaryDentalLabLabCaseTypeSchema.optional(),
  status: HealthcareAncillaryDentalLabDentalLabCaseStatusSchema.optional(),
  dueDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  dueDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

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

export const HealthcareAncillaryDentalLabDentalLabProviderCreateRequestSchema = z.object({
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
  avgTurnaroundDays: z.number().int().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryDentalLabDentalLabProviderSearchParamsSchema = z.object({
  name: z.string().optional(),
  active: z.boolean().optional(),
  specialty: z.string().optional()
});

export const HealthcareAncillaryDentalLabLabCaseReceiveRequestSchema = z.object({
  receivedDate: z.string().datetime().transform((str) => new Date(str)),
  note: z.string().optional()
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

export const HealthcareAncillaryDentalLabLabCaseReturnCreateRequestSchema = z.object({
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
  remakeRequired: z.boolean(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

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

export const HealthcareAncillaryDentalLabLabCommunicationNoteCreateRequestSchema = z.object({
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
  attachments: z.array(HealthcareCoreReferenceSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryEndodonticEndoRecordCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryEndodonticEndoRecordStatusSchema = z.enum(["initiated", "accessOpened", "canalsShaped", "obturated", "completed", "referredOut"]);

export const HealthcareAncillaryEndodonticEndoRecordSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  providerId: z.string().optional(),
  status: HealthcareAncillaryEndodonticEndoRecordStatusSchema.optional(),
  toothNumber: z.number().int().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareAncillaryEndodonticEndoRetreatmentCreateRequestSchema = z.object({
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
  startDate: z.string().datetime().transform((str) => new Date(str)),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryEndodonticEndoRetreatmentSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  providerId: z.string().optional(),
  originalEndoRecordId: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAncillaryEndodonticEndoStatusTransitionRequestSchema = z.object({
  status: HealthcareAncillaryEndodonticEndoRecordStatusSchema,
  note: z.string().optional()
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

export const HealthcareAncillaryEndodonticIrrigationRecordCreateRequestSchema = z.object({
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
  note: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryLaboratoryDiagnosticReportCreateRequestSchema = z.object({
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
  presentedForm: z.array(HealthcareCoreAttachmentSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryLaboratoryDiagnosticReportStatusSchema = z.enum(["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "enteredInError", "unknown"]);

export const HealthcareAncillaryLaboratoryDiagnosticReportSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  category: z.string().optional(),
  code: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: HealthcareAncillaryLaboratoryDiagnosticReportStatusSchema.optional()
});

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

export const HealthcareAncillaryLaboratoryLabResultVerificationRequestSchema = z.object({
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
  previousStatus: z.enum(["unverified", "preliminaryReview", "verified", "amended", "corrected"]).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryLaboratorySpecimenCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryLaboratorySpecimenStatusSchema = z.enum(["available", "unavailable", "unsatisfactory", "enteredInError"]);

export const HealthcareAncillaryLaboratorySpecimenSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  type: z.string().optional(),
  status: HealthcareAncillaryLaboratorySpecimenStatusSchema.optional(),
  receivedFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  receivedTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareAncillaryMedicationAdministrationsMedicationAdministrationCreateRequestSchema = z.object({
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
  eventHistory: z.array(HealthcareCoreReferenceSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryMedicationAdministrationsMedicationAdministrationSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  medication: z.string().optional(),
  status: z.enum(["inProgress", "notDone", "onHold", "completed", "enteredInError", "stopped", "unknown"]).optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  performer: z.string().optional()
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

export const HealthcareAncillaryMedicationsFormularyItemCreateRequestSchema = z.object({
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
  notes: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryMedicationsFormularyItemSearchParamsSchema = z.object({
  medication: z.string().optional(),
  organization: z.string().optional(),
  status: z.enum(["active", "inactive", "enteredInError"]).optional(),
  tier: z.string().optional()
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

export const HealthcareAncillaryMedicationsMedicationCreateRequestSchema = z.object({
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
}).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryMedicationsMedicationSearchParamsSchema = z.object({
  code: z.string().optional(),
  form: z.string().optional(),
  manufacturer: z.string().optional(),
  status: z.enum(["active", "inactive", "enteredInError"]).optional()
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

export const HealthcareAncillaryOrthodonticAdvanceTrayRequestSchema = z.object({
  notes: z.string().optional()
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

export const HealthcareAncillaryOrthodonticAlignerSeriesCreateRequestSchema = z.object({
  orthoCase: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  totalTrays: z.number().int(),
  currentTray: z.number().int(),
  trays: z.array(HealthcareAncillaryOrthodonticAlignerTraySchema),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryOrthodonticOrthoCaseCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryOrthodonticOrthoCaseStatusSchema = z.enum(["assessment", "activeTreatment", "retention", "completed", "discontinued"]);

export const HealthcareAncillaryOrthodonticOrthoCaseSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  providerId: z.string().optional(),
  status: HealthcareAncillaryOrthodonticOrthoCaseStatusSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAncillaryOrthodonticOrthoCaseStatusTransitionRequestSchema = z.object({
  status: HealthcareAncillaryOrthodonticOrthoCaseStatusSchema,
  reason: z.string().optional()
});

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

export const HealthcareAncillaryOrthodonticOrthoProgressRecordCreateRequestSchema = z.object({
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
  nextVisitPlan: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryOrthodonticOrthoStageCreateRequestSchema = z.object({
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
  applianceType: z.enum(["fixedBraces", "clearAligners", "functionalAppliance", "retainer", "other"]).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryPediatricDentalBehaviorAssessmentCreateRequestSchema = z.object({
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
  managementTechniques: z.array(z.string()).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryPediatricDentalBehaviorScaleSchema = z.enum(["frankl", "adpbrs"]);

export const HealthcareAncillaryPediatricDentalBehaviorAssessmentSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  scale: HealthcareAncillaryPediatricDentalBehaviorScaleSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareAncillaryPediatricDentalEruptionRecordCreateRequestSchema = z.object({
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
  notes: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryPediatricDentalExfoliationRecordCreateRequestSchema = z.object({
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
}),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryPediatricDentalFluorideApplicationCreateRequestSchema = z.object({
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
  note: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryPediatricDentalFluorideMethodSchema = z.enum(["varnish", "tray", "rinse", "foam"]);

export const HealthcareAncillaryPediatricDentalFluorideApplicationSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  method: HealthcareAncillaryPediatricDentalFluorideMethodSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareAncillaryPediatricDentalSealantRecordCreateRequestSchema = z.object({
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
  material: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryPediatricDentalSealantStatusSchema = z.enum(["placed", "intact", "repaired", "lost"]);

export const HealthcareAncillaryPediatricDentalSealantSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  toothNumber: z.number().int().optional(),
  status: HealthcareAncillaryPediatricDentalSealantStatusSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareAncillaryPediatricDentalSpaceMaintainerCreateRequestSchema = z.object({
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
  removedDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryPediatricDentalSpaceMaintainerTypeSchema = z.enum(["bandAndLoop", "distalShoe", "lingual", "nance", "transpalatal"]);

export const HealthcareAncillaryPediatricDentalSpaceMaintainerStatusSchema = z.enum(["placed", "active", "removed"]);

export const HealthcareAncillaryPediatricDentalSpaceMaintainerSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  type: HealthcareAncillaryPediatricDentalSpaceMaintainerTypeSchema.optional(),
  status: HealthcareAncillaryPediatricDentalSpaceMaintainerStatusSchema.optional(),
  extractedTooth: z.number().int().optional()
});

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

export const HealthcareAncillaryPeriodontalFurcationRecordCreateRequestSchema = z.object({
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
  location: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryPeriodontalMobilityRecordCreateRequestSchema = z.object({
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
  grade: z.enum(["grade0", "gradeI", "gradeII", "gradeIII"]),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryPeriodontalPerioExamCompareParamsSchema = z.object({
  examIdA: z.string(),
  examIdB: z.string()
});

export const HealthcareAncillaryPeriodontalPerioExamCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryPeriodontalPerioExamStatusSchema = z.enum(["inProgress", "completed", "locked"]);

export const HealthcareAncillaryPeriodontalPerioExamSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  performerId: z.string().optional(),
  status: HealthcareAncillaryPeriodontalPerioExamStatusSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareAncillaryPharmacyDrugInteractionSchema = z.object({
  drugA: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  drugB: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  severity: z.enum(["contraindicated", "major", "moderate", "minor", "unknown"]),
  description: z.string(),
  clinicalSignificance: z.string(),
  managementRecommendation: z.string().optional()
});

export const HealthcareAncillaryPharmacyDrugInteractionCheckSchema = z.object({
  medications: z.array(HealthcareCoreCodeableConceptSchema),
  interactions: z.array(HealthcareAncillaryPharmacyDrugInteractionSchema),
  checkedAt: z.string().datetime().transform((str) => new Date(str)),
  checkedBy: z.string()
});

export const HealthcareAncillaryPharmacyDrugInteractionCheckRequestSchema = z.object({
  medications: z.array(HealthcareCoreCodeableConceptSchema)
});

export const HealthcareAncillaryPharmacyInteractionSeveritySchema = z.enum(["contraindicated", "major", "moderate", "minor", "unknown"]);

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

export const HealthcareAncillaryPharmacyMedicationDispenseCreateRequestSchema = z.object({
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
}).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryPharmacyMedicationDispenseStatusSchema = z.enum(["preparation", "inProgress", "cancelled", "onHold", "completed", "enteredInError", "stopped", "declined", "unknown"]);

export const HealthcareAncillaryPharmacyMedicationDispenseSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  medication: z.string().optional(),
  status: HealthcareAncillaryPharmacyMedicationDispenseStatusSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareAncillaryPharmacyMedicationReconciliationCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryPharmacyMedicationReconciliationSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  type: z.enum(["admission", "discharge", "transfer"]).optional(),
  status: z.enum(["inProgress", "completed", "cancelled"]).optional()
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

export const HealthcareAncillaryProsthodonticImpressionCreateRequestSchema = z.object({
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
}),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryProsthodonticLabCaseLinkCreateRequestSchema = z.object({
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
  status: z.enum(["pending", "inFabrication", "shipped", "received", "returned"]),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryProsthodonticLabCaseLinkStatusSchema = z.enum(["pending", "inFabrication", "shipped", "received", "returned"]);

export const HealthcareAncillaryProsthodonticLabCaseLinkSearchParamsSchema = z.object({
  prosthoRecordId: z.string().optional(),
  labProviderId: z.string().optional(),
  status: HealthcareAncillaryProsthodonticLabCaseLinkStatusSchema.optional(),
  dueDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  dueDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

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

export const HealthcareAncillaryProsthodonticProsthoRecordCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryProsthodonticProsthoTypeSchema = z.enum(["crown", "bridge", "denture", "partialDenture", "veneer", "inlay", "onlay", "implantSupported"]);

export const HealthcareAncillaryProsthodonticProsthoStatusSchema = z.enum(["planned", "impressionTaken", "labSent", "tryIn", "delivered", "remade"]);

export const HealthcareAncillaryProsthodonticProsthoRecordSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  providerId: z.string().optional(),
  type: HealthcareAncillaryProsthodonticProsthoTypeSchema.optional(),
  status: HealthcareAncillaryProsthodonticProsthoStatusSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareAncillaryProsthodonticProsthoStatusTransitionRequestSchema = z.object({
  status: HealthcareAncillaryProsthodonticProsthoStatusSchema,
  note: z.string().optional()
});

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

export const HealthcareAncillaryProsthodonticShadeSelectionCreateRequestSchema = z.object({
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
  notes: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareAncillaryRadiologyImagingStudyCreateRequestSchema = z.object({
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
}).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryRadiologyImagingStudyStatusSchema = z.enum(["registered", "available", "cancelled", "enteredInError", "unknown"]);

export const HealthcareAncillaryRadiologyImagingStudySearchParamsSchema = z.object({
  patientId: z.string().optional(),
  modality: z.string().optional(),
  status: HealthcareAncillaryRadiologyImagingStudyStatusSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  bodySite: z.string().optional()
});

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

export const HealthcareAncillaryRadiologyRadiologyReportCreateRequestSchema = z.object({
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
  addendum: z.array(HealthcareAncillaryRadiologyRadiologyAddendumSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareAncillaryRadiologyRadiologyReportSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  studyId: z.string().optional(),
  status: z.enum(["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "enteredInError", "unknown"]).optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
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

export const HealthcareClinicalAllergiesAllergySearchParamsSchema = z.object({
  patient: z.string().optional(),
  code: z.string().optional(),
  type: z.enum(["allergy", "intolerance"]).optional(),
  category: z.enum(["food", "medication", "environment", "biologic"]).optional(),
  criticality: z.enum(["low", "high", "unableToAssess"]).optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
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

export const HealthcareClinicalCompositionsCompositionSearchParamsSchema = z.object({
  patient: z.string().optional(),
  type: z.string().optional(),
  encounter: z.string().optional(),
  status: z.enum(["preliminary", "final", "amended", "enteredInError"]).optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  author: z.string().optional(),
  custodian: z.string().optional(),
  confidentiality: z.enum(["U", "L", "M", "N", "R", "V"]).optional()
});

export const HealthcareClinicalCompositionsCompositionStatusSchema = z.enum(["preliminary", "final", "amended", "enteredInError"]);

export const HealthcareClinicalCompositionsCreateCompositionRequestSchema = z.object({
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

export const HealthcareClinicalCompositionsDocumentRelationshipTypeSchema = z.enum(["replaces", "transforms", "signs", "appends"]);

export const HealthcareClinicalCompositionsSectionModeSchema = z.enum(["working", "snapshot", "changes"]);

export const HealthcareClinicalCompositionsUpdateCompositionRequestSchema = z.object({
  status: z.enum(["preliminary", "final", "amended", "enteredInError"]).optional(),
  type: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  category: z.array(HealthcareCoreCodeableConceptSchema).optional(),
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
  date: z.string().datetime().transform((str) => new Date(str)).optional(),
  author: z.array(HealthcareCoreReferenceSchema).optional(),
  title: z.string().optional(),
  confidentiality: z.enum(["U", "L", "M", "N", "R", "V"]).optional(),
  attester: z.array(HealthcareClinicalCompositionsCompositionAttesterSchema).optional(),
  custodian: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  relatesTo: z.array(HealthcareClinicalCompositionsCompositionRelatesToSchema).optional(),
  event: z.array(HealthcareClinicalCompositionsCompositionEventSchema).optional(),
  section: z.array(z.lazy(() => HealthcareClinicalCompositionsCompositionSectionSchema)).optional()
});

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

export const HealthcareClinicalConditionsConditionSearchParamsSchema = z.object({
  patient: z.string().optional(),
  code: z.string().optional(),
  clinicalStatus: z.string().optional(),
  category: z.string().optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
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

export const HealthcareClinicalDocumentReferencesDocumentReferenceSearchParamsSchema = z.object({
  patient: z.string().optional(),
  type: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  category: z.string().optional(),
  author: z.string().optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
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

export const HealthcareClinicalEncountersEncounterSearchParamsSchema = z.object({
  patient: z.string().optional(),
  status: z.enum(["planned", "arrived", "triaged", "inProgress", "onLeave", "finished", "cancelled", "enteredInError", "unknown"]).optional(),
  class: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  practitioner: z.string().optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
});

export const HealthcareClinicalEncountersEncounterStatusSchema = z.enum(["planned", "arrived", "triaged", "inProgress", "onLeave", "finished", "cancelled", "enteredInError", "unknown"]);

export const HealthcareClinicalEncountersEncounterStatusTransitionRequestSchema = z.object({
  status: z.enum(["planned", "arrived", "triaged", "inProgress", "onLeave", "finished", "cancelled", "enteredInError", "unknown"]),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

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

export const HealthcareClinicalEpisodesOfCareEpisodeOfCareCreateRequestSchema = z.object({
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
  account: z.array(HealthcareCoreReferenceSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareClinicalEpisodesOfCareEpisodeOfCareSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  status: z.enum(["planned", "waitlist", "active", "onhold", "finished", "cancelled", "enteredInError"]).optional(),
  type: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareClinicalEpisodesOfCareEpisodeOfCareStatusTransitionSchema = z.object({
  status: z.enum(["planned", "waitlist", "active", "onhold", "finished", "cancelled", "enteredInError"]),
  reason: z.string().optional(),
  transitionedAt: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareClinicalFamilyHistoryFamilyHistorySearchParamsSchema = z.object({
  patient: z.string().optional(),
  relationship: z.string().optional(),
  condition: z.string().optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
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

export const HealthcareClinicalFlagsFlagCreateRequestSchema = z.object({
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
  mitigation: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareClinicalFlagsFlagSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  status: z.enum(["active", "inactive", "enteredInError"]).optional(),
  category: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional()
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

export const HealthcareClinicalHospitalEmergencyDepartmentEDBoardSchema = z.object({
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
  bed: z.string().optional(),
  acuity: z.enum(["resuscitation", "emergent", "urgent", "lessUrgent", "nonUrgent"]),
  status: z.enum(["registered", "triaged", "inTreatment", "pendingDisposition", "discharged", "admitted"]),
  waitTimeMinutes: z.number().int().optional(),
  provider: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  chiefComplaint: z.string()
});

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

export const HealthcareClinicalHospitalOrderManagementApplyOrderSetRequestSchema = z.object({
  orderSetId: z.string(),
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
  includeOptionalItems: z.array(z.number().int()).optional()
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

export const HealthcareClinicalHospitalOrderManagementCoSignRequestSchema = z.object({
  coSignedBy: z.string(),
  note: z.string().max(500).optional()
});

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

export const HealthcareClinicalImmunizationsImmunizationSearchParamsSchema = z.object({
  patient: z.string().optional(),
  vaccineCode: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["completed", "enteredInError", "notDone"]).optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
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

export const HealthcareClinicalMedicationRequestsMedicationRequestSearchParamsSchema = z.object({
  patient: z.string().optional(),
  status: z.enum(["active", "onHold", "cancelled", "completed", "enteredInError", "stopped", "draft", "unknown"]).optional(),
  medication: z.string().optional(),
  requester: z.string().optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
});

export const HealthcareClinicalMedicationRequestsMedicationRequestStatusSchema = z.enum(["active", "onHold", "cancelled", "completed", "enteredInError", "stopped", "draft", "unknown"]);

export const HealthcareClinicalMedicationRequestsMedicationRequestStatusTransitionSchema = z.object({
  status: z.enum(["active", "onHold", "cancelled", "completed", "enteredInError", "stopped", "draft", "unknown"]),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

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

export const HealthcareClinicalObservationsObservationBulkCreateRequestSchema = z.object({
  observations: z.array(HealthcareClinicalObservationsObservationSchema)
});

export const HealthcareClinicalObservationsObservationBulkCreateResponseSchema = z.object({
  created: z.array(HealthcareClinicalObservationsObservationSchema),
  errors: z.record(z.string(), z.unknown())
});

export const HealthcareClinicalObservationsObservationSearchParamsSchema = z.object({
  patient: z.string().optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["registered", "preliminary", "final", "amended", "corrected", "cancelled", "enteredInError", "unknown"]).optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
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

export const HealthcareClinicalProceduresProcedureSearchParamsSchema = z.object({
  patient: z.string().optional(),
  code: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["preparation", "inProgress", "notDone", "onHold", "stopped", "completed", "enteredInError", "unknown"]).optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
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

export const HealthcareClinicalRelatedPersonsRelatedPersonCreateRequestSchema = z.object({
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
  communication: z.array(HealthcareClinicalRelatedPersonsRelatedPersonCommunicationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareClinicalRelatedPersonsRelatedPersonSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  relationship: z.string().optional(),
  name: z.string().optional(),
  active: z.boolean().optional()
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

export const HealthcareClinicalServiceRequestsServiceRequestSearchParamsSchema = z.object({
  patient: z.string().optional(),
  category: z.string().optional(),
  code: z.string().optional(),
  status: z.enum(["draft", "active", "onHold", "revoked", "completed", "enteredInError", "unknown"]).optional(),
  requester: z.string().optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional()
});

export const HealthcareClinicalServiceRequestsServiceRequestStatusSchema = z.enum(["draft", "active", "onHold", "revoked", "completed", "enteredInError", "unknown"]);

export const HealthcareClinicalServiceRequestsServiceRequestStatusTransitionSchema = z.object({
  status: z.enum(["draft", "active", "onHold", "revoked", "completed", "enteredInError", "unknown"]),
  reason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

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

export const HealthcareConformanceBulkExportBulkExportOutputFileSchema = z.object({
  type: z.string(),
  url: z.string().url(),
  count: z.number().int().optional()
});

export const HealthcareConformanceBulkExportBulkExportManifestSchema = z.object({
  transactionTime: z.string().datetime().transform((str) => new Date(str)),
  request: z.string().url(),
  requiresAccessToken: z.boolean(),
  output: z.array(HealthcareConformanceBulkExportBulkExportOutputFileSchema),
  error: z.array(HealthcareConformanceBulkExportBulkExportOutputFileSchema)
});

export const HealthcareConformanceBulkExportBulkExportStatusSchema = z.enum(["accepted", "inProgress", "complete", "error", "cancelled"]);

export const HealthcareConformanceBulkExportBulkExportStatusResponseSchema = z.object({
  status: z.enum(["accepted", "inProgress", "complete", "error", "cancelled"]),
  progress: z.string().optional(),
  manifest: z.object({
  transactionTime: z.string().datetime().transform((str) => new Date(str)),
  request: z.string().url(),
  requiresAccessToken: z.boolean(),
  output: z.array(HealthcareConformanceBulkExportBulkExportOutputFileSchema),
  error: z.array(HealthcareConformanceBulkExportBulkExportOutputFileSchema)
}).optional()
});

export const HealthcareConformanceBulkExportBulkImportErrorSchema = z.object({
  type: z.string(),
  url: z.string(),
  count: z.number().int(),
  details: z.string().optional()
});

export const HealthcareConformanceBulkExportBulkImportInputFileSchema = z.object({
  type: z.string(),
  url: z.string()
});

export const HealthcareConformanceBulkExportBulkImportKickoffParamsSchema = z.object({
  inputFormat: z.string().optional(),
  inputSource: z.array(HealthcareConformanceBulkExportBulkImportInputFileSchema),
  storageDetail: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareConformanceBulkExportBulkImportStatusSchema = z.enum(["accepted", "inProgress", "complete", "error", "cancelled"]);

export const HealthcareConformanceBulkExportBulkImportStatusResponseSchema = z.object({
  status: z.enum(["accepted", "inProgress", "complete", "error", "cancelled"]),
  progress: z.string().optional(),
  resourcesImported: z.number().int().optional(),
  resourcesFailed: z.number().int().optional(),
  errors: z.array(HealthcareConformanceBulkExportBulkImportErrorSchema).optional()
});

export const HealthcareConformanceCapabilitiesCapabilityOperationSchema = z.object({
  name: z.string(),
  definition: z.string().url(),
  documentation: z.string().optional()
});

export const HealthcareConformanceCapabilitiesResourceInteractionCodeSchema = z.enum(["read", "vread", "update", "patch", "delete", "historyInstance", "historyType", "create", "searchType"]);

export const HealthcareConformanceCapabilitiesCapabilitySearchParamSchema = z.object({
  name: z.string(),
  type: z.enum(["number", "date", "string", "token", "reference", "composite", "quantity", "uri", "special"]),
  documentation: z.string().optional()
});

export const HealthcareConformanceCapabilitiesCapabilityRestResourceSchema = z.object({
  type: z.string(),
  profile: z.string().url().optional(),
  supportedProfile: z.array(z.string()).optional(),
  interaction: z.array(HealthcareConformanceCapabilitiesResourceInteractionCodeSchema),
  searchParam: z.array(HealthcareConformanceCapabilitiesCapabilitySearchParamSchema).optional(),
  operation: z.array(HealthcareConformanceCapabilitiesCapabilityOperationSchema).optional(),
  versioning: z.string().optional(),
  readHistory: z.boolean().optional(),
  updateCreate: z.boolean().optional(),
  conditionalCreate: z.boolean().optional(),
  conditionalRead: z.string().optional(),
  conditionalUpdate: z.boolean().optional(),
  conditionalDelete: z.string().optional()
});

export const HealthcareConformanceCapabilitiesSystemInteractionCodeSchema = z.enum(["transaction", "batch", "searchSystem", "historySystem"]);

export const HealthcareConformanceCapabilitiesCapabilityStatementRestSchema = z.object({
  mode: z.enum(["client", "server"]),
  documentation: z.string().optional(),
  resource: z.array(HealthcareConformanceCapabilitiesCapabilityRestResourceSchema),
  interaction: z.array(HealthcareConformanceCapabilitiesSystemInteractionCodeSchema).optional(),
  operation: z.array(HealthcareConformanceCapabilitiesCapabilityOperationSchema).optional()
});

export const HealthcareConformanceCapabilitiesCapabilityStatementSchema = z.object({
  status: z.enum(["draft", "active", "retired", "unknown"]),
  kind: z.enum(["instance", "capability", "requirements"]),
  fhirVersion: z.string(),
  format: z.array(z.string()),
  patchFormat: z.array(z.string()).optional(),
  implementationGuide: z.array(z.string()).optional(),
  rest: z.array(HealthcareConformanceCapabilitiesCapabilityStatementRestSchema),
  name: z.string().optional(),
  title: z.string().optional(),
  date: z.string().datetime().transform((str) => new Date(str)),
  publisher: z.string().optional(),
  description: z.string().optional(),
  purpose: z.string().optional(),
  copyright: z.string().optional()
});

export const HealthcareConformanceCapabilitiesCapabilityStatementKindSchema = z.enum(["instance", "capability", "requirements"]);

export const HealthcareConformanceCapabilitiesRestfulCapabilityModeSchema = z.enum(["client", "server"]);

export const HealthcareConformanceCapabilitiesSearchParamTypeSchema = z.enum(["number", "date", "string", "token", "reference", "composite", "quantity", "uri", "special"]);

export const HealthcareConformanceIPSGenerateIPSRequestSchema = z.object({
  patientId: z.string(),
  includeOptional: z.boolean().optional()
});

export const HealthcareConformanceIPSIPSSectionSchema = z.object({
  code: z.enum(["10160-0", "48765-2", "11450-4", "11369-6", "47519-4", "46264-8", "30954-2", "8716-3", "10162-6", "29762-2", "18776-5", "47420-5", "42348-3"]),
  title: z.string(),
  required: z.boolean(),
  entries: z.array(HealthcareCoreReferenceSchema).optional()
});

export const HealthcareConformanceIPSIPSSectionCodeSchema = z.enum(["10160-0", "48765-2", "11450-4", "11369-6", "47519-4", "46264-8", "30954-2", "8716-3", "10162-6", "29762-2", "18776-5", "47420-5", "42348-3"]);

export const HealthcareConformanceIPSInternationalPatientSummarySchema = z.object({
  patient: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  author: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  date: z.string().datetime().transform((str) => new Date(str)),
  title: z.string(),
  sections: z.array(HealthcareConformanceIPSIPSSectionSchema)
});

export const HealthcareConformanceOperationsDocumentBundleRequestSchema = z.object({
  id: z.string(),
  persist: z.boolean().optional()
});

export const HealthcareConformanceOperationsIssueSeveritySchema = z.enum(["fatal", "error", "warning", "information"]);

export const HealthcareConformanceOperationsPatientMatchEntrySchema = z.object({
  resource: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  search: z.object({
  score: z.number().gte(0).lte(1)
})
});

export const HealthcareConformanceOperationsPatientMatchRequestSchema = z.object({
  resource: z.record(z.string(), z.unknown()),
  onlyCertainMatches: z.boolean().optional(),
  count: z.number().int().optional()
});

export const HealthcareConformanceOperationsPatientMatchResponseSchema = z.object({
  entry: z.array(HealthcareConformanceOperationsPatientMatchEntrySchema)
});

export const HealthcareConformanceOperationsValidationIssueSchema = z.object({
  severity: z.enum(["fatal", "error", "warning", "information"]),
  code: z.string(),
  details: z.string().optional(),
  expression: z.array(z.string()).optional()
});

export const HealthcareConformanceOperationsValidationRequestSchema = z.object({
  resource: z.record(z.string(), z.unknown()),
  profile: z.string().url().optional(),
  mode: z.string().optional()
});

export const HealthcareConformanceOperationsValidationResponseSchema = z.object({
  issues: z.array(HealthcareConformanceOperationsValidationIssueSchema)
});

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

export const HealthcareConformanceSubscriptionsSubscriptionNotificationSchema = z.object({
  subscriptionId: z.string(),
  topic: z.string().url(),
  type: z.string(),
  eventsSinceLastDelivery: z.number().int().optional(),
  entry: z.array(HealthcareCoreReferenceSchema).optional()
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

export const HealthcareConformanceTerminologyExpandRequestSchema = z.object({
  url: z.string().url(),
  filter: z.string().optional(),
  count: z.number().int().optional(),
  offset: z.number().int().optional()
});

export const HealthcareConformanceTerminologyLookupRequestSchema = z.object({
  system: z.string().url(),
  code: z.string(),
  version: z.string().optional()
});

export const HealthcareConformanceTerminologyLookupResponseSchema = z.object({
  name: z.string(),
  display: z.string(),
  designation: z.array(HealthcareConformanceTerminologyDesignationSchema).optional(),
  property: z.array(HealthcareConformanceTerminologyConceptPropertySchema).optional()
});

export const HealthcareConformanceTerminologyTranslateMatchSchema = z.object({
  equivalence: z.string(),
  concept: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
})
});

export const HealthcareConformanceTerminologyTranslateRequestSchema = z.object({
  url: z.string().url(),
  system: z.string().url(),
  code: z.string(),
  targetSystem: z.string().url()
});

export const HealthcareConformanceTerminologyTranslateResponseSchema = z.object({
  result: z.boolean(),
  match: z.array(HealthcareConformanceTerminologyTranslateMatchSchema).optional()
});

export const HealthcareConformanceTerminologyValidateCodeRequestSchema = z.object({
  url: z.string().url(),
  code: z.string(),
  system: z.string().url().optional(),
  display: z.string().optional()
});

export const HealthcareConformanceTerminologyValidateCodeResponseSchema = z.object({
  result: z.boolean(),
  message: z.string().optional(),
  display: z.string().optional()
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

export const HealthcareOperationalExternalConnectorsConnectorHealthResponseSchema = z.object({
  connector: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  healthStatus: z.enum(["healthy", "degraded", "unreachable", "unknown"]),
  lastCheckedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  message: z.string().max(500).optional()
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

export const HealthcareOperationalExternalConnectorsConnectorTestRequestSchema = z.object({
  extended: z.boolean().optional()
});

export const HealthcareOperationalExternalConnectorsConnectorTestResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().max(500),
  latencyMs: z.number().int().optional()
});

export const HealthcareOperationalExternalConnectorsConnectorTypeSchema = z.enum(["paymentGateway", "smsProvider", "emailProvider", "imagingPacs", "ePrescribing", "clearinghouse", "videoConference", "laboratoryLis", "hl7Interface", "fhirEndpoint", "cloudStorage", "other"]);

export const HealthcareOperationalExternalConnectorsCreateConnectorCredentialRequestSchema = z.object({
  connector: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  credentialType: z.string().max(100),
  secretValue: z.string().max(4096),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.string().max(500).optional()
});

export const HealthcareOperationalExternalConnectorsRotateConnectorCredentialRequestSchema = z.object({
  newSecretValue: z.string().max(4096),
  expiresAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  note: z.string().max(500).optional()
});

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

export const HealthcareOperationalHospitalEmergencyPreparednessEmergencyActivationRequestSchema = z.object({
  plan: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  level: z.enum(["advisory", "partial", "full"]),
  incidentCommander: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}).optional(),
  note: z.string().optional()
});

export const HealthcareOperationalHospitalEmergencyPreparednessEmergencyDeactivationRequestSchema = z.object({
  deactivatedBy: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  afterActionReportDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  note: z.string().optional()
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

export const HealthcareOperationalHospitalPeerReviewPeerReviewStatusTransitionRequestSchema = z.object({
  status: z.enum(["referred", "underReview", "committeeReview", "actionRequired", "resolved", "closed"]),
  note: z.string().optional()
});

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

export const HealthcareOperationalImplantRegistryAffectedPatientsParamsSchema = z.object({
  recallId: z.string()
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

export const HealthcareOperationalImplantRegistryImplantCreateRequestSchema = z.object({
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
  note: z.array(HealthcareCoreAnnotationSchema).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
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

export const HealthcareOperationalImplantRegistryImplantLotNumberParamsSchema = z.object({
  lotNumber: z.string(),
  manufacturer: z.string().optional()
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

export const HealthcareOperationalImplantRegistryImplantRecallCreateRequestSchema = z.object({
  implant: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  lotNumber: z.string(),
  manufacturer: z.string(),
  reason: z.string(),
  recallDate: z.string().datetime().transform((str) => new Date(str)),
  affectedPatients: z.number().int().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareOperationalImplantRegistryImplantRecallSearchParamsSchema = z.object({
  lotNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareOperationalImplantRegistryImplantStatusSchema = z.enum(["placed", "osseointegrating", "restored", "failed", "explanted"]);

export const HealthcareOperationalImplantRegistryImplantSearchParamsSchema = z.object({
  patientId: z.string().optional(),
  placedById: z.string().optional(),
  status: HealthcareOperationalImplantRegistryImplantStatusSchema.optional(),
  toothNumber: z.number().int().optional(),
  manufacturer: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

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

export const HealthcareOperationalImplantRegistryOsseointegrationCheckCreateRequestSchema = z.object({
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
  nextCheckDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareOperationalImplantRegistryOsseointegrationCheckSearchParamsSchema = z.object({
  implantId: z.string().optional(),
  performerId: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
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

export const HealthcareOperationalOperatoryChairTimeBlockCreateRequestSchema = z.object({
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
  status: z.enum(["scheduled", "checkedIn", "inProgress", "completed", "noShow"]),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareOperationalOperatoryChairTimeBlockSearchParamsSchema = z.object({
  operatoryId: z.string().optional(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  status: HealthcareOperationalOperatoryChairBlockStatusSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
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

export const HealthcareOperationalOperatoryOperatoryAssignmentCreateRequestSchema = z.object({
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
  shiftType: z.string().optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareOperationalOperatoryOperatoryAssignmentSearchParamsSchema = z.object({
  operatoryId: z.string().optional(),
  practitionerId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

export const HealthcareOperationalOperatoryOperatoryCreateRequestSchema = z.object({
  name: z.string(),
  location: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  type: z.enum(["general", "hygiene", "surgical", "pediatric", "orthodontic"]),
  status: z.enum(["available", "occupied", "turnover", "maintenance", "closed"]),
  equipment: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  features: z.array(z.string()).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareOperationalOperatoryOperatoryMetricsSchema = z.object({
  operatoryId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }),
  totalMinutesAvailable: z.number().int(),
  totalMinutesOccupied: z.number().int(),
  utilizationPercent: z.number(),
  turnoverCount: z.number().int(),
  avgTurnoverMinutes: z.number()
});

export const HealthcareOperationalOperatoryOperatoryMetricsParamsSchema = z.object({
  operatoryId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" })
});

export const HealthcareOperationalOperatoryOperatoryTypeSchema = z.enum(["general", "hygiene", "surgical", "pediatric", "orthodontic"]);

export const HealthcareOperationalOperatoryOperatoryStatusSchema = z.enum(["available", "occupied", "turnover", "maintenance", "closed"]);

export const HealthcareOperationalOperatoryOperatorySearchParamsSchema = z.object({
  locationId: z.string().optional(),
  type: HealthcareOperationalOperatoryOperatoryTypeSchema.optional(),
  status: HealthcareOperationalOperatoryOperatoryStatusSchema.optional()
});

export const HealthcareOperationalOperatoryStatusBoardParamsSchema = z.object({
  locationId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional()
});

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

export const HealthcareOperationalOperatoryTurnoverEventCreateRequestSchema = z.object({
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
}).optional(),
  tenantId: z.string(),
  identifiers: z.array(HealthcareCoreIdentifierSchema).optional(),
  extensions: z.array(HealthcareCoreResourceExtensionSchema).optional(),
  sensitivityLabels: z.array(HealthcareCoreSensitivityLabelSchema).optional(),
  version: z.number().int(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional()
});

export const HealthcareOperationalOperatoryTurnoverSearchParamsSchema = z.object({
  operatoryId: z.string().optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional()
});

export const HealthcareOperationalPatientPortalConfirmBookingRequestSchema = z.object({
  appointmentId: z.string()
});

export const HealthcareOperationalPatientPortalDeclineBookingRequestSchema = z.object({
  reason: z.string().max(500)
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

export const HealthcareOperationalPatientPortalSendIntakeFormRequestSchema = z.object({
  expiresAt: z.string().datetime().transform((str) => new Date(str))
});

export const HealthcareOperationalRecallCampaignRunRequestSchema = z.object({
  sendOutreach: z.boolean().optional()
});

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

export const HealthcareOperationalRecallRecallContactRequestSchema = z.object({
  contactDate: z.string().datetime().transform((str) => new Date(str)),
  note: z.string().max(500).optional()
});

export const HealthcareOperationalRecallRecallDismissRequestSchema = z.object({
  reason: z.string().max(500)
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

export const HealthcareSupportCDSCDSActionSchema = z.object({
  type: z.string(),
  description: z.string(),
  resource: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareSupportCDSCDSSuggestionSchema = z.object({
  label: z.string(),
  uuid: z.string().optional(),
  isRecommended: z.boolean().optional(),
  actions: z.array(HealthcareSupportCDSCDSActionSchema).optional()
});

export const HealthcareSupportCDSCDSLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  type: z.string(),
  appContext: z.string().optional()
});

export const HealthcareSupportCDSCDSCardSchema = z.object({
  uuid: z.string().optional(),
  summary: z.string(),
  detail: z.string().optional(),
  indicator: z.enum(["info", "warning", "critical"]),
  source: z.object({
  label: z.string(),
  url: z.string().optional(),
  icon: z.string().optional(),
  topic: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
}),
  suggestions: z.array(HealthcareSupportCDSCDSSuggestionSchema).optional(),
  selectionBehavior: z.string().optional(),
  overrideReasons: z.array(HealthcareCoreCodeableConceptSchema).optional(),
  links: z.array(HealthcareSupportCDSCDSLinkSchema).optional()
});

export const HealthcareSupportCDSCDSContextSchema = z.object({
  userId: z.string(),
  patientId: z.string(),
  encounterId: z.string().optional(),
  selections: z.array(z.string()).optional(),
  draftOrders: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareSupportCDSCDSFhirAuthorizationSchema = z.object({
  accessToken: z.string(),
  tokenType: z.string(),
  expiresIn: z.number().int(),
  scope: z.string(),
  subject: z.string()
});

export const HealthcareSupportCDSCDSHookRequestSchema = z.object({
  hook: z.string(),
  hookInstance: z.string(),
  context: z.object({
  userId: z.string(),
  patientId: z.string(),
  encounterId: z.string().optional(),
  selections: z.array(z.string()).optional(),
  draftOrders: z.record(z.string(), z.unknown()).optional()
}),
  prefetch: z.record(z.string(), z.unknown()).optional(),
  fhirServer: z.string().optional(),
  fhirAuthorization: z.object({
  accessToken: z.string(),
  tokenType: z.string(),
  expiresIn: z.number().int(),
  scope: z.string(),
  subject: z.string()
}).optional()
});

export const HealthcareSupportCDSCDSHookResponseSchema = z.object({
  cards: z.array(HealthcareSupportCDSCDSCardSchema)
});

export const HealthcareSupportCDSCDSIndicatorSchema = z.enum(["info", "warning", "critical"]);

export const HealthcareSupportCDSCDSServiceDescriptorSchema = z.object({
  hook: z.string(),
  title: z.string().optional(),
  description: z.string(),
  id: z.string(),
  prefetch: z.record(z.string(), z.unknown()).optional()
});

export const HealthcareSupportCDSCDSServicesResponseSchema = z.object({
  services: z.array(HealthcareSupportCDSCDSServiceDescriptorSchema)
});

export const HealthcareSupportCDSCDSSourceSchema = z.object({
  label: z.string(),
  url: z.string().optional(),
  icon: z.string().optional(),
  topic: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional()
});

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

export const HealthcareSupportClinicalOutcomesGenerateOutcomeReportRequestSchema = z.object({
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
  benchmarkId: z.string().optional()
});

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

export const HealthcareSupportDataImportCancelImportJobRequestSchema = z.object({
  reason: z.string().max(500).optional()
});

export const HealthcareSupportDataImportExecuteImportJobRequestSchema = z.object({
  dryRun: z.boolean().optional(),
  mappingId: z.string().optional()
});

export const HealthcareSupportDataImportFieldMappingSchema = z.object({
  sourceField: z.string().max(200),
  targetField: z.string().max(200),
  required: z.boolean(),
  defaultValue: z.string().max(500).optional(),
  transformRule: z.string().max(100).optional()
});

export const HealthcareSupportDataImportImportErrorSchema = z.object({
  rowNumber: z.number().int().gte(1),
  field: z.string().max(200).optional(),
  value: z.string().max(1000).optional(),
  errorCode: z.string().max(100),
  message: z.string().max(1000),
  severity: z.string().max(20)
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

export const HealthcareSupportDataImportUploadImportFileRequestSchema = z.object({
  fileReference: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
}),
  contentType: z.string().max(100),
  fileSizeBytes: z.number().int().gte(0)
});

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

export const HealthcareSupportProvenanceProvenanceEntitySchema = z.object({
  role: z.enum(["derivation", "revision", "quotation", "source", "removal"]),
  what: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

export const HealthcareSupportProvenanceCreateProvenanceRequestSchema = z.object({
  target: z.array(HealthcareCoreReferenceSchema),
  occurredDateTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  occurredPeriod: z.object({
  start: z.string().datetime().transform((str) => new Date(str)),
  end: z.string().datetime().transform((str) => new Date(str)).optional()
}).optional(),
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
  purposeOfUse: z.array(HealthcareCorePurposeOfUseSchema).optional()
});

export const HealthcareSupportProvenanceProvenanceActivityTypeSchema = z.enum(["create", "update", "delete", "access", "transmit", "verify", "sign", "amend", "merge", "deidentify", "reidentify"]);

export const HealthcareSupportProvenanceProvenanceAgentRoleSchema = z.enum(["author", "performer", "verifier", "approver", "custodian", "assembler", "informant", "onBehalfOf"]);

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

export const HealthcareSupportPublicHealthImmunizationRegistryForecastRecommendationSchema = z.object({
  vaccineGroup: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}),
  forecastStatus: z.enum(["dueNow", "overdue", "immune", "contraindicated", "notRecommended", "complete"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  overdueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  latestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(val => { const parsed = new Date(val + "T00:00:00Z"); return !isNaN(parsed.getTime()) && parsed.toISOString().split("T")[0] === val; }, { message: "Invalid calendar date" }).optional(),
  doseNumber: z.number().int().optional()
});

export const HealthcareSupportPublicHealthImmunizationRegistryForecastStatusSchema = z.enum(["dueNow", "overdue", "immune", "contraindicated", "notRecommended", "complete"]);

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

export const HealthcareSupportQuestionnairesQuestionnaireResponseAnswerSchema: z.ZodTypeAny = z.object({
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
  answer: z.array(z.lazy(() => HealthcareSupportQuestionnairesQuestionnaireResponseAnswerSchema)).optional(),
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

export const HealthcareSupportSignaturesCreateSignatureRequestSchema = z.object({
  type: z.array(HealthcareSupportSignaturesSignatureTypeSchema),
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
}).optional()
});

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

export const HealthcareSupportTasksTaskStatusTransitionRequestSchema = z.object({
  status: z.enum(["draft", "requested", "received", "accepted", "rejected", "ready", "cancelled", "inProgress", "onHold", "failed", "completed", "enteredInError"]),
  statusReason: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  businessStatus: z.object({
  coding: z.array(HealthcareCoreCodingSchema),
  text: z.string().optional()
}).optional(),
  note: z.string().optional()
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

export const HealthcareSupportTelehealthAsyncConsultationEscalateRequestSchema = z.object({
  escalationReason: z.string().max(500)
});

export const HealthcareSupportTelehealthAsyncConsultationRespondRequestSchema = z.object({
  response: z.string().max(5000)
});

export const HealthcareSupportTelehealthAsyncStatusSchema = z.enum(["submitted", "inReview", "responded", "escalatedToSync", "closed"]);

export const HealthcareSupportTelehealthEndSessionRequestSchema = z.object({
  endedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  status: z.enum(["scheduled", "waiting", "inProgress", "completed", "cancelled", "noShow", "technicalFailure"]),
  technicalIssues: z.string().max(500).optional()
});

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

export const HealthcareSupportTelehealthStartSessionRequestSchema = z.object({
  startedAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  meetingUrl: z.string().max(2048).optional()
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

export const HealthcareSupportWorkflowAutomationQueueItemClaimRequestSchema = z.object({
  assignedTo: z.object({
  resourceType: z.string(),
  id: z.string().uuid(),
  display: z.string().optional()
})
});

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

export const HealthcareSupportWorkflowAutomationWorkflowConditionResultSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains", "in", "exists"]),
  expectedValue: z.string(),
  actualValue: z.string().optional(),
  passed: z.boolean()
});

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

export const HealthcareSupportWorkflowAutomationWorkflowRuleTestRequestSchema = z.object({
  eventPayload: z.record(z.string(), z.unknown()),
  dryRun: z.boolean()
});

export const HealthcareSupportWorkflowAutomationWorkflowRuleTestResultSchema = z.object({
  conditionsMet: z.boolean(),
  actionsToExecute: z.array(HealthcareSupportWorkflowAutomationWorkflowActionSchema),
  conditionResults: z.array(HealthcareSupportWorkflowAutomationWorkflowConditionResultSchema)
});

export const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional()
});

export const IceServersResponseSchema = z.object({
  iceServers: z.array(IceServerSchema)
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

export const LeaveVideoCallResponseSchema = z.object({
  message: z.string(),
  callStillActive: z.boolean(),
  remainingParticipants: z.number().int()
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

export const MessageTypeSchema = z.enum(["text", "system", "video_call"]);

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
  type: z.enum(["billing", "security", "system", "booking.created", "booking.confirmed", "booking.rejected", "booking.cancelled", "booking.no-show-client", "booking.no-show-host", "comms.video-call-started", "comms.video-call-joined", "comms.video-call-left", "comms.video-call-ended", "comms.chat-message"]),
  channel: z.enum(["email", "push", "in-app"]),
  title: z.string().max(200),
  message: z.string().max(1000),
  scheduledAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntity: z.string().uuid().optional(),
  status: z.enum(["queued", "sent", "delivered", "read", "failed", "expired", "unread"]),
  sentAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  deliveredAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  readAt: z.string().datetime().transform((str) => new Date(str)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  consentValidated: z.boolean()
});

export const NotificationChannelSchema = z.enum(["email", "push", "in-app"]);

export const NotificationStatusSchema = z.enum(["queued", "sent", "delivered", "read", "failed", "expired", "unread"]);

export const NotificationTypeSchema = z.enum(["billing", "security", "system", "booking.created", "booking.confirmed", "booking.rejected", "booking.cancelled", "booking.no-show-client", "booking.no-show-host", "comms.video-call-started", "comms.video-call-joined", "comms.video-call-left", "comms.video-call-ended", "comms.chat-message"]);

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

export const PaymentRequestSchema = z.object({
  paymentMethod: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const PaymentResponseSchema = z.object({
  checkoutUrl: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const PaymentStatusSchema = z.enum(["pending", "requires_capture", "processing", "succeeded", "failed", "canceled"]);

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

export const UpdateInvoiceRequestSchema = z.object({
  paymentCaptureMethod: z.enum(["automatic", "manual"]).optional(),
  paymentDueAt: z.union([z.string().datetime().transform((str) => new Date(str)), z.null()]).optional(),
  voidThresholdMinutes: z.number().int().optional(),
  lineItems: z.array(CreateLineItemRequestSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const UpdateLocationRequestSchema = z.object({
  name: z.union([z.string(), z.null()]).optional(),
  status: z.union([z.enum(["active", "suspended", "inactive"]), z.null()]).optional(),
  aliases: z.union([z.array(z.string()), z.null()]).optional(),
  description: z.union([z.string(), z.null()]).optional(),
  mode: z.union([z.enum(["instance", "kind"]), z.null()]).optional(),
  type: z.union([z.array(HealthcareCoreCodeableConceptSchema), z.null()]).optional(),
  telecom: z.union([z.array(HealthcareCoreContactPointSchema), z.null()]).optional(),
  address: z.union([z.object({
  street1: z.string().min(1).max(100).optional(),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(50).optional(),
  state: z.string().min(1).max(50).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).refine(val => validateCountryCode(val), { message: "Invalid ISO 3166-1 country code" }).optional(),
  coordinates: z.object({
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().gte(0).optional()
}).optional()
}), z.null()]).optional(),
  physicalType: z.union([z.object({
  coding: z.array(HealthcareCoreCodingSchema).optional(),
  text: z.string().optional()
}), z.null()]).optional(),
  position: z.union([z.object({
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().gte(0).optional()
}), z.null()]).optional(),
  managingOrganization: z.union([z.object({
  resourceType: z.string().optional(),
  id: z.string().uuid().optional(),
  display: z.string().optional()
}), z.null()]).optional(),
  partOf: z.union([z.object({
  resourceType: z.string().optional(),
  id: z.string().uuid().optional(),
  display: z.string().optional()
}), z.null()]).optional(),
  hoursOfOperation: z.union([z.array(LocationHoursSchema), z.null()]).optional()
});

export const UpdateOrganizationRequestSchema = z.object({
  name: z.union([z.string(), z.null()]).optional(),
  type: z.union([z.array(HealthcareCoreCodeableConceptSchema), z.null()]).optional(),
  active: z.union([z.boolean(), z.null()]).optional(),
  aliases: z.union([z.array(z.string()), z.null()]).optional(),
  telecom: z.union([z.array(HealthcareCoreContactPointSchema), z.null()]).optional(),
  address: z.union([z.array(AddressSchema), z.null()]).optional(),
  partOf: z.union([z.object({
  resourceType: z.string().optional(),
  id: z.string().uuid().optional(),
  display: z.string().optional()
}), z.null()]).optional(),
  contact: z.union([z.array(OrganizationContactSchema), z.null()]).optional(),
  endpoint: z.union([z.array(z.string()), z.null()]).optional()
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
  insuranceCoverage: z.union([z.array(HealthcareCoreReferenceSchema), z.null()]).optional()
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

export const ListAuditLogsQuery = z.object({
  resourceType: z.string().optional(),
  resource: UUIDSchema.optional(),
  user: UUIDSchema.optional(),
  action: AuditActionSchema.optional(),
  startDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  endDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  orderBy: z.string().optional(),
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  context: z.string().optional(),
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  startDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  endDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  expand: z.string().optional(),
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  context: z.string().optional(),
  locationType: LocationTypeSchema.optional(),
  status: BookingEventStatusSchema.optional(),
  availableFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  availableTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  expand: z.string().optional(),
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  startTime: z.string().datetime().transform((str) => new Date(str)).optional(),
  endTime: z.string().datetime().transform((str) => new Date(str)).optional(),
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
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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

export const ListEmailQueueItemsQuery = z.object({
  status: z.union([EmailQueueStatusSchema, z.array(EmailQueueStatusSchema), z.string().transform(val => val.split(",").map(s => s.trim())).pipe(z.array(EmailQueueStatusSchema))]).optional(),
  recipientEmail: EmailSchema.optional(),
  dateFrom: z.string().datetime().transform((str) => new Date(str)).optional(),
  dateTo: z.string().datetime().transform((str) => new Date(str)).optional(),
  priority: z.coerce.number().int().optional(),
  scheduledOnly: z.coerce.boolean().optional(),
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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

export const ListNotificationsQuery = z.object({
  type: NotificationTypeSchema.optional(),
  channel: NotificationChannelSchema.optional(),
  status: NotificationStatusSchema.optional(),
  startDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  endDate: z.string().datetime().transform((str) => new Date(str)).optional(),
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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

export const CreatePersonBody = PersonCreateRequestSchema;
export type CreatePersonBody = z.infer<typeof CreatePersonBody>;

export const CreatePersonResponse = PersonSchema;

export const ListPersonsQuery = z.object({
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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

export const CreateReviewBody = CreateReviewRequestSchema;
export type CreateReviewBody = z.infer<typeof CreateReviewBody>;

export const CreateReviewResponse = ReviewSchema;

export const ListReviewsQuery = z.object({
  context: UUIDSchema.optional(),
  reviewer: UUIDSchema.optional(),
  reviewType: z.string().optional(),
  reviewedEntity: UUIDSchema.optional(),
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
  offset: z.coerce.number().int().gte(0).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
  page: z.coerce.number().int().gte(1).optional(),
  pageSize: z.coerce.number().int().gte(1).lte(100).optional(),
  q: z.string().max(500).optional(),
  sort: z.string().optional(),
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
