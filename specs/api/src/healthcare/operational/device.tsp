import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Healthcare Device Management module.
 *
 * Provides FHIR R4-aligned models and operations for managing medical devices,
 * device assignments to patients, and device metric calibration records.
 * Supports full traceability of device usage across patients and locations.
 */
namespace Healthcare.Operational.Devices;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of name associated with a device.")
enum DeviceNameType {
  @doc("The name as known by the user of the device")
  userFriendlyName,

  @doc("The name reported by the patient who uses the device")
  patientReportedName,

  @doc("The name as given by the manufacturer of the device")
  manufacturerName,

  @doc("The model number as given by the manufacturer of the device")
  modelName,

  @doc("A device name type not covered by other enumerations")
  other,
}

@doc("The status of a device assignment to a patient.")
enum AssignmentStatus {
  @doc("The device is currently assigned and in active use")
  active,

  @doc("The device has been returned and the assignment is closed")
  returned,

  @doc("The device was reported as lost during the assignment period")
  lost,

  @doc("The device was reported as damaged during the assignment period")
  damaged,
}

@doc("The category of a device metric. Aligns with FHIR DeviceMetricCategory.")
enum DeviceMetricCategory {
  @doc("DeviceObservation is a direct measurement of a physiological parameter")
  measurement,

  @doc("DeviceObservation is a setting that is set by the operator")
  setting,

  @doc("DeviceObservation is a calculated value")
  calculation,

  @doc("The category of the DeviceMetric is unspecified")
  unspecified,
}

@doc("The operational status of a device metric. Aligns with FHIR DeviceMetricOperationalStatus.")
enum DeviceMetricOperationalStatus {
  @doc("The DeviceMetric is operating and will generate DeviceObservations")
  on,

  @doc("The DeviceMetric is not operating")
  off,

  @doc("The DeviceMetric is operating, but will not generate any DeviceObservations")
  standby,

  @doc("The DeviceMetric was entered in error")
  enteredInError,
}

@doc("The type of calibration applied to a device metric. Aligns with FHIR DeviceMetricCalibrationType.")
enum CalibrationType {
  @doc("Calibration type is unspecified")
  unspecified,

  @doc("A simple offset calibration — a constant value is subtracted or added")
  offset,

  @doc("A gain calibration — the output is multiplied by a constant factor")
  gain,

  @doc("A two-point calibration using two reference measurements")
  twoPoint,
}

@doc("The state of calibration for a device metric. Aligns with FHIR DeviceMetricCalibrationState.")
enum CalibrationState {
  @doc("The metric has not been calibrated")
  notCalibrated,

  @doc("The metric needs to be calibrated")
  calibrationRequired,

  @doc("The metric has been calibrated")
  calibrated,

  @doc("The calibration state is unspecified")
  unspecified,
}

// ---------------------------------------------------------------------------
// Supporting models — Device
// ---------------------------------------------------------------------------

/**
 * A name by which a device is known, along with the type of that name.
 */
model DeviceName {
  /** The name of the device. */
  name: string;

  /** The type of name (e.g., user-friendly, manufacturer name, model name). */
  type: DeviceNameType;
}

/**
 * The actual software/firmware version of a device component.
 */
model DeviceVersion {
  /** The type of the device version (e.g., software, firmware, hardware). */
  type?: CodeableConcept;

  /** The hardware or software component of the device to which the version applies. */
  component?: string;

  /** The version text. */
  value: string;
}

// ---------------------------------------------------------------------------
// Root resource — Device
// ---------------------------------------------------------------------------

/**
 * A type of a manufactured item that is used in the provision of healthcare
 * without being substantially changed through that activity. Mapped to
 * FHIR R4 Device.
 */
model Device extends HealthcareBaseEntity {
  /** The status of the device availability. */
  status: DeviceStatus;

  /** Reason for the status of the Device availability. */
  statusReason?: CodeableConcept[];

  /** The distinct identification string as required by regulation for a human cell, tissue, or cellular and tissue-based product. */
  distinctIdentifier?: string;

  /** A name of the manufacturer. */
  manufacturer?: string;

  /** The date and time when the device was manufactured. */
  manufactureDate?: plainDate;

  /** The date and time beyond which this device is no longer valid or should not be used. */
  expirationDate?: plainDate;

  /** Lot number assigned by the manufacturer. */
  lotNumber?: string;

  /** The serial number assigned by the organisation when the device was manufactured. */
  serialNumber?: string;

  /** The model number for the device. */
  modelNumber?: string;

  /** The kind or type of device. */
  type: CodeableConcept;

  /** This represents the manufacturer's name of the device as provided by the device, from a UDI label, or by a person describing the Device. */
  deviceName?: DeviceName[];

  /** The actual design of the device or software version running on the device. */
  deviceVersion?: DeviceVersion[];

  /** Patient information, If the device is affixed to a person. */
  patient?: Reference;

  /** An organisation that is responsible for the provision and ongoing maintenance of the device. */
  owner?: Reference;

  /** The place where the device can be found. */
  location?: Reference;

  /** A network address on which the device may be contacted directly. */
  @format("uri")
  url?: string;

  /** Descriptive information, usage information or implantation information that is not captured in an existing element. */
  note?: Annotation[];

  /** Provides additional safety characteristics about a medical device. */
  safety?: CodeableConcept[];

  /** The parent device. */
  parent?: Reference;
}

// ---------------------------------------------------------------------------
// Root resource — DeviceAssignment
// ---------------------------------------------------------------------------

/**
 * Records the assignment of a medical device to a patient, including the
 * duration of the assignment and its outcome (returned, lost, damaged).
 */
model DeviceAssignment extends HealthcareBaseEntity {
  /** The device that was assigned to the patient. */
  device: Reference;

  /** The patient to whom the device was assigned. */
  patient: Reference;

  /** The clinical encounter during which the device was assigned. */
  encounter?: Reference;

  /** The practitioner who assigned the device to the patient. */
  assignedBy: Reference;

  /** The date and time at which the device was assigned. */
  assignedAt: utcDateTime;

  /** The date and time at which the device was returned, if applicable. */
  returnedAt?: utcDateTime;

  /** The current status of the device assignment. */
  status: AssignmentStatus;

  /** The clinical reason for assigning the device to this patient. */
  reason?: CodeableConcept;

  /** Additional free-text notes about the assignment. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Supporting models — DeviceMetric
// ---------------------------------------------------------------------------

/**
 * A single calibration event for a device metric.
 */
model DeviceMetricCalibration {
  /** Describes the type of the calibration method. */
  type?: CalibrationType;

  /** Describes the state of the calibration. */
  state?: CalibrationState;

  /** Describes the time last calibration has been performed. */
  time?: utcDateTime;
}

// ---------------------------------------------------------------------------
// Root resource — DeviceMetric
// ---------------------------------------------------------------------------

/**
 * Describes a measurement, calculation, or setting capability of a medical
 * device. Mapped to FHIR R4 DeviceMetric.
 */
model DeviceMetric extends HealthcareBaseEntity {
  /** The device resource from which the metric originates. */
  device: Reference;

  /** Describes the type of the metric. */
  type: CodeableConcept;

  /** Describes the unit that an observed value determined for this metric will have. */
  unit?: CodeableConcept;

  /** Describes the link to the Device that this DeviceMetric belongs to and that contain measurement. */
  source?: Reference;

  /** Indicates the category of the observation generation process. */
  category: DeviceMetricCategory;

  /** Indicates current operational state of the device. */
  operationalStatus?: DeviceMetricOperationalStatus;

  /** Describes the color representation for the metric — used in user interfaces. */
  color?: string;

  /** Describes the measurement repetition time. */
  measurementPeriod?: Period;

  /** Describes the calibrations that have been performed or that are required to be performed. */
  calibration?: DeviceMetricCalibration[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching Device resources. */
model DeviceSearchParams {
  /** Filter by device type code. */
  @query type?: string;

  /** Filter by device status. */
  @query status?: string;

  /** Filter by patient reference id. */
  @query patient?: string;

  /** Filter by location reference id. */
  @query location?: string;

  /** Filter by manufacturer name (partial match). */
  @query manufacturer?: string;

  ...PaginationQuery;
}

/** Query parameters for searching DeviceAssignment resources. */
model DeviceAssignmentSearchParams {
  /** Filter by device reference id. */
  @query device?: string;

  /** Filter by patient reference id. */
  @query patient?: string;

  /** Filter by assignment status. */
  @query status?: string;

  /** Filter by assignedBy reference id. */
  @query assignedBy?: string;

  /** Filter by encounter reference id. */
  @query encounter?: string;

  ...PaginationQuery;
}

/** Query parameters for searching DeviceMetric resources. */
model DeviceMetricSearchParams {
  /** Filter by device reference id. */
  @query device?: string;

  /** Filter by metric type code. */
  @query type?: string;

  /** Filter by category. */
  @query category?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Device resources.
 */
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface DeviceManagement {
  /** Create a new Device. */
  @post
  @operationId("createDevice")
  create(
    @body body: Device,
  ): {
    @statusCode statusCode: 201;
    @body device: Device;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single Device by id. */
  @get
  @operationId("getDevice")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body device: Device;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing Device. */
  @put
  @operationId("updateDevice")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Device,
  ): {
    @statusCode statusCode: 200;
    @body device: Device;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a Device. */
  @patch
  @operationId("patchDevice")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body device: Device;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a Device by id. */
  @delete
  @operationId("deleteDevice")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for Devices using filter parameters. */
  @get
  @operationId("searchDevices")
  @route("/search")
  search(
    ...DeviceSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Device>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for DeviceAssignment resources.
 */
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface DeviceAssignmentManagement {
  /** Create a new DeviceAssignment. */
  @post
  @operationId("createDeviceAssignment")
  create(
    @body body: DeviceAssignment,
  ): {
    @statusCode statusCode: 201;
    @body deviceAssignment: DeviceAssignment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single DeviceAssignment by id. */
  @get
  @operationId("getDeviceAssignment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body deviceAssignment: DeviceAssignment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing DeviceAssignment. */
  @put
  @operationId("updateDeviceAssignment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: DeviceAssignment,
  ): {
    @statusCode statusCode: 200;
    @body deviceAssignment: DeviceAssignment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a DeviceAssignment. */
  @patch
  @operationId("patchDeviceAssignment")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body deviceAssignment: DeviceAssignment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a DeviceAssignment by id. */
  @delete
  @operationId("deleteDeviceAssignment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for DeviceAssignments using filter parameters. */
  @get
  @operationId("searchDeviceAssignments")
  @route("/search")
  search(
    ...DeviceAssignmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DeviceAssignment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for DeviceMetric resources.
 */
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface DeviceMetricManagement {
  /** Create a new DeviceMetric. */
  @post
  @operationId("createDeviceMetric")
  create(
    @body body: DeviceMetric,
  ): {
    @statusCode statusCode: 201;
    @body deviceMetric: DeviceMetric;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single DeviceMetric by id. */
  @get
  @operationId("getDeviceMetric")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body deviceMetric: DeviceMetric;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing DeviceMetric. */
  @put
  @operationId("updateDeviceMetric")
  @route("/{id}")
  update(
    @path id: string,
    @body body: DeviceMetric,
  ): {
    @statusCode statusCode: 200;
    @body deviceMetric: DeviceMetric;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a DeviceMetric. */
  @patch
  @operationId("patchDeviceMetric")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body deviceMetric: DeviceMetric;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a DeviceMetric by id. */
  @delete
  @operationId("deleteDeviceMetric")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for DeviceMetrics using filter parameters. */
  @get
  @operationId("searchDeviceMetrics")
  @route("/search")
  search(
    ...DeviceMetricSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DeviceMetric>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
