import "@typespec/http";
import "@typespec/versioning";
import "@typespec/openapi";

import "./common/models.tsp";
import "./common/errors.tsp";
import "./common/pagination.tsp";
import "./common/security.tsp";

// Import all module definitions
// Note: identity/auth is handled by Better-Auth, not TypeSpec
import "./modules/person.tsp";
import "./modules/patient.tsp";
import "./modules/provider.tsp";
import "./modules/billing.tsp";
import "./modules/audit.tsp";
import "./modules/notifs.tsp";
import "./modules/comms.tsp";
import "./modules/storage.tsp";
import "./modules/email.tsp";
import "./modules/booking.tsp";
import "./modules/reviews.tsp";
import "./modules/emr.tsp";

using TypeSpec.Http;
using TypeSpec.Versioning;
using TypeSpec.OpenAPI;

/**
 * Monobase Application API
 * 
 * Comprehensive API for application platform.
 * Provides secure, enterprise-grade endpoints for clients, service providers,
 * and business partners.
 */
@server("https://api.example.com", "Production server")
@server("https://stg.api.example.com", "Staging server")
@versioned(Versions)
@service(#{
  title: "Monobase Application API"
})
// Tag Metadata Definitions
@tagMetadata("Person", #{
  description: "Central person management module serving as the foundation for all user types in the platform. Handles core PII (Personally Identifiable Information) with strict data protection, supporting both client and service provider roles. Manages identity verification, profile updates, consent preferences (marketing, data sharing, SMS, email), and serves as the single source of truth for user information across the platform ecosystem."
})
@tagMetadata("Patient", #{
  description: "Patient profile management extending the Person module with healthcare-specific information. Manages primary care provider relationships and pharmacy preferences for individuals receiving medical services. Provides streamlined patient profile system with essential provider and pharmacy information management for basic healthcare service coordination."
})
@tagMetadata("Provider", #{
  description: "Healthcare provider profile management extending the Person module. Manages professional credentials, practice information, and minor ailment specialties. Features public provider directory with optional authentication for patient discovery. Supports pharmacists and other healthcare providers with search by specialty, location, and experience."
})
@tagMetadata("Billing", #{
  description: "Invoice-based payment processing with Stripe integration. Manages invoices, merchant accounts, payment processing, and refunds. Supports both automatic and manual payment capture flows with comprehensive authorization controls. Any person can become a merchant and receive payments through Stripe Connect."
})
@tagMetadata("Audit", #{
  description: "Enterprise-grade audit logging and compliance tracking system. Records all data access, modifications, and system events with immutable audit trails. Provides detailed activity logs with user attribution, IP tracking, timestamp recording, and data change history. Supports compliance reporting, suspicious activity detection, audit log retention policies, and integration with security information and event management (SIEM) systems."
})
@tagMetadata("Notifs", #{
  description: "Multi-channel notification delivery system for user engagement and communications. Manages email, push notifications, and in-app messaging with delivery tracking. Handles booking reminders, billing notifications, security alerts, and system announcements. Provides read-only API for users with internal service-based creation."
})
@tagMetadata("Comms", #{
  description: "Communication module providing focused video call and chat functionality for professional video sessions. Features Facebook Messenger-style chat with embedded video calls, direct booking integration, immutable message history, and action-based video call management. Supports one active video call per chat room with efficient state management and WebRTC integration for secure video sessions."
})
@tagMetadata("Storage", #{
  description: "Secure document and file management system with AWS S3 integration. Handles documents, reports, files, and consent forms with encryption at rest and in transit. Provides presigned URLs for secure uploads/downloads, automatic file type validation, virus scanning, PDF generation, and retention policy enforcement with enterprise-grade access controls."
})
@tagMetadata("System", #{
  description: "System administration and monitoring endpoints for platform health and operations. Provides health checks for all system components, database connectivity monitoring, service dependency status, API version information, performance metrics, and graceful degradation handling. Includes diagnostic endpoints for troubleshooting, system configuration verification, and operational readiness checks."
})
@tagMetadata("Email", #{
  description: "Runtime-configurable email service with dynamic template management. Enables administrators to create and modify email templates without code deployments, with changes taking effect immediately. Features template tag-based referencing, Handlebars variable substitution, JSON Schema validation, multi-provider support (SMTP/Postmark), asynchronous job-based processing, and comprehensive queue management with retry logic and admin controls."
})
@tagMetadata("Booking", #{
  description: "Professional booking and scheduling system for time-based services. Enables service providers to define booking events with flexible availability patterns, location options (in-person, virtual, or hybrid), and automated time slot generation. Supports booking lifecycle management with confirmation workflows, mutual cancellation, no-show tracking, and schedule exception handling. Features public event discovery for seamless booking experiences."
})
@tagMetadata("Reviews", #{
  description: "Flexible NPS review system for feedback collection. Enables users to submit Net Promoter Score (0-10) reviews with optional comments for any context (appointments, sessions, orders). Supports application-defined review types and optional reviewed entities for maximum flexibility. Features immutable reviews, role-based access control, and duplicate prevention."
})
@tagMetadata("EMR", #{
  description: "Electronic Medical Records for telemedicine consultations. Simplified documentation system for minor ailment consultations with structured clinical data capture. Manages consultation notes with chief complaints, clinical assessments, treatment plans, vital signs, symptoms, prescriptions, and follow-up instructions. Features draft/finalized workflow, role-based access control (provider creates/updates, patient views own records), and flexible integration support for external documentation systems."
})
namespace MonobaseAPI {

  // Note: Identity/Auth endpoints are handled by Better-Auth
  // and will be merged in the final OpenAPI spec
  
  // Person Management
  @tag("Person")
  @route("/persons")
  interface PersonManagement extends PersonModule.PersonManagement {}
  
  // Patient Management
  @tag("Patient")
  @route("/patients")
  interface PatientManagement extends PatientModule.PatientManagement {}
  
  // Provider Management
  @tag("Provider")
  @route("/providers")
  interface ProviderManagement extends ProviderModule.ProviderManagement {}
  
  // Billing Management
  @tag("Billing")
  @route("/billing")
  interface BillingInvoiceManagement extends BillingModule.InvoiceManagement {}
  
  @tag("Billing")
  @route("/billing")
  interface BillingPaymentProcessing extends BillingModule.PaymentProcessing {}
  
  @tag("Billing")
  @route("/billing")
  interface BillingMerchantAccountManagement extends BillingModule.MerchantAccountManagement {}
  
  // Audit Management
  @tag("Audit")
  @route("/audit")
  interface AuditManagement extends AuditModule.AuditManagement {}
  
  // Notification Management
  @tag("Notifs")
  @route("/notifs")
  interface NotificationManagement extends Notifs.NotificationManagement {}
  
  // Comms Management
  @tag("Comms")
  @route("/comms")
  interface CommsManagement extends CommsModule.CommsManagement {}

  // Storage Management
  @tag("Storage")
  interface StorageManagement extends StorageModule.StorageManagement {}

  // Email Management - template and queue management
  @tag("Email")
  @route("/email")
  interface EmailTemplateManagement extends EmailModule.EmailTemplateManagement {}

  @tag("Email")
  @route("/email")
  interface EmailQueueManagement extends EmailModule.EmailQueueManagement {}

  // Booking Management - events, slots, bookings, and schedule exceptions
  @tag("Booking")
  @route("/booking")
  interface BookingEventManagement extends BookingModule.BookingEventManagement {}

  @tag("Booking")
  @route("/booking")
  interface SlotDiscovery extends BookingModule.SlotDiscovery {}

  @tag("Booking")
  @route("/booking")
  interface BookingManagement extends BookingModule.BookingManagement {}

  @tag("Booking")
  @route("/booking")
  interface ScheduleExceptionManagement extends BookingModule.ScheduleExceptionManagement {}

  // Reviews Management
  @tag("Reviews")
  @route("/reviews")
  interface ReviewsManagement extends ReviewsModule.ReviewsManagement {}

  // EMR Management
  @tag("EMR")
  @route("/emr")
  interface EMRManagement extends EMRModule.EMRManagement {}

}

/**
 * API versioning scheme
 */
enum Versions {
  @doc("Initial API version")
  v1: "1.0",
}

/**
 * Global security configuration
 * Uses bearer token authentication from common/security.tsp
 */
