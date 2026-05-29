/**
 * Dental Imaging Module
 *
 * Provides API for the dental imaging workspace:
 * - ImagingStudy creation with presigned upload URL
 * - Study retrieval with associated images
 * - Patient image listing (union: new imaging + legacy dental_attachment)
 * - Soft-delete images (status='archived')
 * - Modality reclassification
 */

import "@typespec/http";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;

namespace DentalImagingModule {

  enum ModalityEnum {
    periapical,
    bitewing,
    panoramic,
    cephalometric,
    cbct, // V-IMG-010: cone-beam CT (WF-019 / §7)
    intraoral_photo,
    extraoral_photo,
    other,
  }

  @example(#{
    id: "img-s1a2b3c4-0000-4000-8000-000000000001",
    patientId: "d1a2b3c4-0000-4000-8000-000000000001",
    visitId: "v1a2b3c4-0000-4000-8000-000000000001",
    branchId: "b1a2b3c4-0000-4000-8000-000000000001",
    acquiredBy: "m1a2b3c4-0000-4000-8000-000000000001",
    modality: ModalityEnum.periapical,
    status: "active",
    createdAt: utcDateTime.fromISO("2026-03-15T10:15:00Z"),
    updatedAt: utcDateTime.fromISO("2026-03-15T10:15:00Z"),
  }, #{ title: "Periapical X-ray study" })
  model ImagingStudy {
    id: string;
    patientId: string;
    visitId: string | null;
    branchId: string;
    acquiredBy: string;
    modality: ModalityEnum;
    status: "active" | "archived";
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  model ImagingStudyImage {
    id: string;
    studyId: string;
    fileId: string;
    pixelSpacingMm: float64 | null;
    sequenceNumber: int32;
    dicomMetadata: Record<unknown> | null;
    modality: ModalityEnum;
    status: "active" | "archived";
    createdAt: utcDateTime;
  }

  model ImagingStudyWithImages extends ImagingStudy {
    images: ImagingStudyImage[];
  }

  model PatientImageItem {
    id: string;
    source: "imaging" | "legacy";
    modality: ModalityEnum;
    fileName: string;
    mimeType: string;
    fileSizeBytes: int64;
    studyId: string | null;
    visitId: string | null;
    toothNumbers: int32[];
    createdAt: utcDateTime;
  }

  model ListPatientImagesResponse {
    items: PatientImageItem[];
    total: int32;
  }

  @example(#{
    patientId: "d1a2b3c4-0000-4000-8000-000000000001",
    visitId: "v1a2b3c4-0000-4000-8000-000000000001",
    branchId: "b1a2b3c4-0000-4000-8000-000000000001",
    modality: ModalityEnum.periapical,
    filename: "tooth-36-periapical-2026-03-15.jpg",
    mimeType: "image/jpeg",
    size: 2457600,
    toothNumbers: #[36],
    sequenceNumber: 1,
  }, #{ title: "Upload periapical X-ray" })
  model CreateImagingStudyBody {
    patientId: string;
    visitId?: string;
    branchId: string;
    modality?: ModalityEnum;
    filename: string;
    mimeType: string;
    size: int64;
    toothNumbers?: int32[];
    sequenceNumber?: int32;
  }

  model CreateImagingStudyResponse {
    study: ImagingStudy;
    uploadUrl: string;
    uploadMethod: string;
    fileId: string;
    expiresAt: utcDateTime;
  }

  model UpdateImageModalityBody {
    modality: ModalityEnum;
  }

  model ImagingAnnotation {
    id: string;
    imageId: string;
    type: "line" | "angle" | "area" | "label" | "arrow" | "freehand" | "shape" | "tooth";
    geometry: Record<unknown>;
    measurementValue: float64 | null;
    measurementUnit: string | null;
    toothNumber: int32 | null;
    visible: boolean;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  model UpdateCalibrationBody {
    pixelSpacingMm: float64;
  }

  model CreateMeasurementBody {
    type: "distance" | "angle" | "area";
    geometry: Record<unknown>;
    measurementValue?: float64;
    measurementUnit?: string;
  }

  model MeasurementListResponse {
    items: ImagingAnnotation[];
  }

  @route("/dental/imaging")
  interface ImagingManagement {
    @post
    @route("/studies")
    @useAuth(bearerAuth)
    createImagingStudy(@body body: CreateImagingStudyBody): CreateImagingStudyResponse | ErrorResponse;

    @get
    @route("/studies/{studyId}")
    @useAuth(bearerAuth)
    getImagingStudy(@path studyId: string): ImagingStudyWithImages | ErrorResponse;

    @delete
    @route("/images/{imageId}")
    @useAuth(bearerAuth)
    deleteImage(@path imageId: string): void | ErrorResponse;

    @patch
    @route("/images/{imageId}/modality")
    @useAuth(bearerAuth)
    updateImageModality(@path imageId: string, @body body: UpdateImageModalityBody): ImagingStudyImage | ErrorResponse;

    @patch
    @route("/images/{imageId}/calibration")
    @useAuth(bearerAuth)
    updateImageCalibration(@path imageId: string, @body body: UpdateCalibrationBody): ImagingStudyImage | ErrorResponse;

    @post
    @route("/images/{imageId}/measurements")
    @useAuth(bearerAuth)
    createMeasurement(@path imageId: string, @body body: CreateMeasurementBody): ImagingAnnotation | ErrorResponse;

    @get
    @route("/images/{imageId}/measurements")
    @useAuth(bearerAuth)
    listMeasurements(@path imageId: string): MeasurementListResponse | ErrorResponse;

    @delete
    @route("/measurements/{measurementId}")
    @useAuth(bearerAuth)
    deleteMeasurement(@path measurementId: string): void | ErrorResponse;
  }

  interface PatientImageListing {
    @get
    @route("/{patientId}/images")
    @useAuth(bearerAuth)
    listPatientImages(@path patientId: string, @query branchId: string): ListPatientImagesResponse | ErrorResponse;
  }

  enum ImagingFindingType {
    caries,
    secondary_caries,
    bone_loss,
    furcation_involvement,
    periapical_lesion,
    root_resorption,
    calculus,
    crown_fracture,
    root_fracture,
    impacted_tooth,
    over_eruption,
    open_contact,
    overhang,
    crown_needed,
    implant_needed,
  }

  // V-IMG-007: SM-01 finding lifecycle is draft → confirmed → resolved (spec §8 / §11).
  // Legacy `suspected`/`monitoring` states are no longer part of the API surface.
  enum ImagingFindingStatus {
    draft,
    confirmed,
    resolved,
  }

  model ImagingFinding {
    id: string;
    imageId: string;
    annotationId: string | null;
    treatmentId: string | null;
    visitId: string;
    patientId: string;
    branchId: string;
    type: ImagingFindingType;
    status: ImagingFindingStatus;
    toothNumber: int32 | null;
    surfaces: string[] | null;
    note: string | null;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  model ImagingFindingListResponse {
    items: ImagingFinding[];
  }

  model CreateFindingBody {
    type: ImagingFindingType;
    status?: ImagingFindingStatus;
    toothNumber?: int32;
    surfaces?: string[];
    note?: string;
    annotationId?: string;
    treatmentId?: string;
    visitId: string;
    patientId: string;
    branchId: string;
  }

  model UpdateFindingBody {
    type?: ImagingFindingType;
    status?: ImagingFindingStatus;
    toothNumber?: int32;
    surfaces?: string[];
    note?: string;
    treatmentId?: string;
  }

  // NOTE: Full paths are on each operation (not the interface) to work around a code-generator
  // bug where the interface-level @route is silently dropped for the second interface sharing
  // the same base path. The generated routes were registering as /findings/:findingId instead
  // of /dental/imaging/findings/:findingId — a P0 security gap (global auth middleware
  // filters on /dental/* prefix and would have missed these 4 routes).
  interface ImagingFindings {
    @post
    @route("/dental/imaging/images/{imageId}/findings")
    @useAuth(bearerAuth)
    createFinding(@path imageId: string, @body body: CreateFindingBody): ImagingFinding | ErrorResponse;

    @get
    @route("/dental/imaging/images/{imageId}/findings")
    @useAuth(bearerAuth)
    listFindings(@path imageId: string): ImagingFindingListResponse | ErrorResponse;

    @patch
    @route("/dental/imaging/findings/{findingId}")
    @useAuth(bearerAuth)
    updateFinding(@path findingId: string, @body body: UpdateFindingBody): ImagingFinding | ErrorResponse;

    @delete
    @route("/dental/imaging/findings/{findingId}")
    @useAuth(bearerAuth)
    deleteFinding(@path findingId: string): void | ErrorResponse;
  }

  // =========================================================================
  // CEPHALOMETRIC ANALYSIS (v1.4)
  // =========================================================================

  // D-A landmark set + support landmarks (D5 — single source of truth)
  enum CephLandmarkCode {
    S,
    N,
    A,
    B,
    ANS,
    PNS,
    Go,
    Po,
    Me,
    Or,
    Pog,
    Gn,
    U1T,
    U1A,
    L1T,
    L1A,
  }

  enum CephLandmarkSource {
    manual,
    ai,
    ai_corrected,
  }

  // Mirrors FINDING_TRANSITIONS: placed → confirmed → locked (one-directional)
  enum CephLandmarkStatus {
    placed,
    confirmed,
    locked,
  }

  // D-J calibration provenance ("not_calibrated" = source unknown/unspecified)
  enum CephCalibrationMethod {
    dicom_tag,
    manual_ruler,
    assumed_default,
    not_calibrated,
  }

  model CephLandmark {
    id: string;
    imageId: string;
    landmarkCode: CephLandmarkCode;
    x: float64;
    y: float64;
    source: CephLandmarkSource;
    confidence: float64 | null;
    status: CephLandmarkStatus;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  model CephLandmarkInput {
    landmarkCode: CephLandmarkCode;
    x: float64;
    y: float64;
    source?: CephLandmarkSource;
    confidence?: float64;
    status?: CephLandmarkStatus;
  }

  model BatchUpsertLandmarksBody {
    landmarks: CephLandmarkInput[];
  }

  model UpdateLandmarkBody {
    x?: float64;
    y?: float64;
    status?: CephLandmarkStatus;
  }

  // measurements: keyed by metric name, value is number or null (missing landmark / uncalibrated)
  model CephAnalysis {
    imageId: string;
    analysisType: string;
    measurements: Record<unknown>;
    missing: string[];
    uncalibrated: boolean;
    calibrationValue: float64 | null;
    calibrationMethod: CephCalibrationMethod | null;
    calibratedAt: utcDateTime | null;
    calibratedBy: string | null;
    updatedAt: utcDateTime;
  }

  model CephLandmarkListResponse {
    items: CephLandmark[];
    analysis: CephAnalysis;
  }

  // D-I: immutable versioned snapshot — never mutated after creation
  model CephReport {
    id: string;
    imageId: string;
    version: int32;
    snapshot: Record<unknown>;
    createdAt: utcDateTime;
  }

  // NOTE: Full absolute paths on every operation — same route-gotcha as ImagingFindings above.
  // Missing /dental/imaging prefix = P0 auth bypass (routes fall outside /dental/* middleware).
  interface CephManagement {
    @post
    @route("/dental/imaging/images/{imageId}/ceph/landmarks")
    @useAuth(bearerAuth)
    batchUpsertCephLandmarks(@path imageId: string, @body body: BatchUpsertLandmarksBody): CephLandmarkListResponse | ErrorResponse;

    @get
    @route("/dental/imaging/images/{imageId}/ceph/landmarks")
    @useAuth(bearerAuth)
    listCephLandmarks(@path imageId: string): CephLandmarkListResponse | ErrorResponse;

    @patch
    @route("/dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}")
    @useAuth(bearerAuth)
    updateCephLandmark(@path imageId: string, @path landmarkCode: CephLandmarkCode, @body body: UpdateLandmarkBody): CephLandmarkListResponse | ErrorResponse;

    @delete
    @route("/dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}")
    @useAuth(bearerAuth)
    deleteCephLandmark(@path imageId: string, @path landmarkCode: CephLandmarkCode): void | ErrorResponse;

    @get
    @route("/dental/imaging/images/{imageId}/ceph/analysis")
    @useAuth(bearerAuth)
    getCephAnalysis(@path imageId: string): CephLandmarkListResponse | ErrorResponse;

    @post
    @route("/dental/imaging/images/{imageId}/ceph/analysis/recompute")
    @useAuth(bearerAuth)
    recomputeCephAnalysis(@path imageId: string): CephAnalysis | ErrorResponse;

    @post
    @route("/dental/imaging/images/{imageId}/ceph/reports")
    @useAuth(bearerAuth)
    createCephReport(@path imageId: string): CephReport | ErrorResponse;

    @get
    @route("/dental/imaging/images/{imageId}/ceph/reports")
    @useAuth(bearerAuth)
    getCephReport(@path imageId: string, @query version?: int32): CephReport | ErrorResponse;
  }
}
