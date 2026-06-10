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
    // P2-7 CBCT volume descriptor. is_volume marks a 3-D/multi-frame object so the
    // frontend renders a volume card + viewer handoff, NEVER a flat <img>. viewerKind
    // is the explicit discriminator ('volume' | 'image').
    isVolume?: boolean;
    sliceThicknessMm?: float64 | null;
    frameCount?: int32 | null;
    seriesInstanceUid?: string | null;
    studyInstanceUid?: string | null;
    viewerKind?: "image" | "volume";
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
    // Presigned GET URL for the image bytes (imaging source). null for legacy
    // attachments that have no object-store backing.
    downloadUrl: string | null;
    // P2-7 CBCT: surfaced so the list can render the right affordance (volume card
    // vs flat thumbnail) without a follow-up fetch.
    isVolume?: boolean;
    frameCount?: int32 | null;
    viewerKind?: "image" | "volume";
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
    // P1-9: DICOM PixelSpacing (0028,0030) parsed client-side from the DICOM file.
    // When present, the image is persisted pre-calibrated (calibrationMethod=dicom_tag),
    // so mm measurements work without a manual ruler. Ignored for non-DICOM uploads.
    pixelSpacingMm?: float64;
  }

  // P1-9: a single PUT for small files; an S3 multipart envelope for large DICOM/CBCT
  // payloads (~50 MB pano). When uploadMethod="MULTIPART", uploadUrl is empty and the
  // client uploads parts to partUrls then completes via the storage multipart endpoint.
  model CreateImagingStudyResponse {
    study: ImagingStudy;
    image: ImagingStudyImage;
    uploadUrl: string;
    uploadMethod: string;
    fileId: string;
    expiresAt: utcDateTime;
    uploadId?: string;
    partSize?: int64;
    partCount?: int32;
    partUrls?: string[];
  }

  model UpdateImageModalityBody {
    modality: ModalityEnum;
  }

  // =========================================================================
  // P2-7 CBCT / 3-D imaging (Phase 1 = Option A1: ingest + store + link +
  // download handoff). The CBCT upload itself reuses createImagingStudy's
  // multipart envelope (modality='cbct' / mimeType='application/dicom').
  // =========================================================================

  // finalizeCbctStudy: called AFTER the storage multipart completeMultipartUpload.
  // Triggers the server-side DICOM parse, populates the volume metadata columns,
  // and sets is_volume=true. imageId identifies the image row created at study create.
  model FinalizeCbctStudyBody {
    imageId: string;
    // Base64-encoded DICOM bytes for the server-side parse. The client already
    // holds the bytes from the multipart upload; for large volumes a future phase
    // may parse server-side from the object store, but A1 accepts them inline.
    dicomBase64: string;
  }

  model FinalizeCbctStudyResponse {
    image: ImagingStudyImage;
  }

  // getCbctViewerLink (A1): a presigned GET download of the DICOM object so the
  // clinician opens it in their own DICOM viewer. viewerKind='download' in v1
  // (Phase 2 will add a hosted-viewer 'deeplink').
  model CbctViewerLinkResponse {
    viewerKind: "download";
    downloadUrl: string;
    expiresAt: utcDateTime;
    isVolume: boolean;
    frameCount: int32 | null;
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

    // P2-7 CBCT finalize: server-side DICOM parse + populate volume metadata + set
    // is_volume=true. Called after the storage multipart upload completes.
    @post
    @route("/studies/{studyId}/cbct/finalize")
    @useAuth(bearerAuth)
    finalizeCbctStudy(@path studyId: string, @body body: FinalizeCbctStudyBody): FinalizeCbctStudyResponse | ErrorResponse;

    // P2-7 CBCT viewer handoff (A1): presigned GET download for an external DICOM viewer.
    @get
    @route("/studies/{studyId}/cbct/viewer-link")
    @useAuth(bearerAuth)
    getCbctViewerLink(@path studyId: string): CbctViewerLinkResponse | ErrorResponse;

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
    // P2-7 CBCT: the slice/frame index this finding was placed on (multi-frame
    // volume). null for flat 2-D findings.
    frameIndex?: int32 | null;
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
    // visitId/patientId/branchId are DERIVED from the parent study by the handler
    // (createFinding.ts) — the "derive branch from the resource, never the caller"
    // invariant. They are optional in the contract: the handler ignores any value the
    // caller sends. Requiring them previously rejected the imaging-workspace UI (which
    // correctly sends only {type,status,note,...}) with a 400 before the handler ran.
    visitId?: string;
    patientId?: string;
    branchId?: string;
    // P2-7 CBCT: optional slice index for a finding placed on a volume frame.
    frameIndex?: int32;
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

  // G2 (reproducibility): the analysis + reference population the clinician was
  // viewing when finalizing. Pinned into the snapshot so a finalized report
  // records the analysis ACTUALLY used (not a hardcoded default). Both optional
  // and back-compatible — omitted → steiner_hybrid_sn / default population.
  model CreateCephReportBody {
    analysisType?: string;
    normPopulation?: string;
  }

  // =========================================================================
  // AUTO / AI LANDMARK DETECTION (P1-10, Phase 0 — detector SEAM + FakeDetector)
  // =========================================================================
  //
  // SAFETY (plan §4): detection produces DRAFTS only. Predictions land via the
  // existing batch-upsert path as source='ai', status='placed', with per-point
  // confidence. AI output NEVER auto-confirms and NEVER auto-finalizes — the
  // report gate (A/B/Go/Po must be human-'confirmed') is the human-review gate.
  // Gated by imaging addon tier AND the dental_imaging_auto_landmark kill-switch.

  // Async-job status. Phase-0 FakeDetector resolves synchronously → 'succeeded'.
  enum CephDetectionStatus {
    pending,
    succeeded,
    failed,
  }

  // A single predicted landmark in image-space pixels (D-C), with confidence.
  model CephLandmarkPrediction {
    landmarkCode: CephLandmarkCode;
    x: float64;
    y: float64;
    confidence: float64;
  }

  // Detection-run result. Predictions are persisted (source='ai', status='placed')
  // before this is returned, so `items` reflects the post-write landmark set.
  model CephLandmarkDetectionResult {
    jobId: string;
    status: CephDetectionStatus;
    modelVersion: string;
    provider: string;
    predictions: CephLandmarkPrediction[];
    items: CephLandmark[];
    analysis: CephAnalysis;
    error?: string;
  }

  // =========================================================================
  // CEPHALOMETRIC SUPERIMPOSITION (P1-11, v1: cranial-base S–N only)
  // =========================================================================
  //
  // CLINICAL HONESTY (plan §2/§8): v1 is a TWO-POINT (S–N) similarity
  // registration on the cranial base — a SIMPLIFIED superimposition, NOT
  // ABO-grade structural superimposition. Output is a measurement of change,
  // never a diagnosis. mm deltas are gated on calibration of BOTH timepoints.
  // Maxillary / mandibular structural registrations are v2 (rejected here).

  // Registration reference frame. v1 implements `cranial_base` only.
  enum CephSuperimpositionReference {
    cranial_base,
    maxillary, // v2 — rejected with SUPERIMPOSITION_NOT_IMPLEMENTED
    mandibular, // v2 — rejected with SUPERIMPOSITION_NOT_IMPLEMENTED
  }

  // Similarity transform mapping timepoint-B image-space → timepoint-A.
  model CephSimilarityTransform {
    scale: float64;
    rotationRad: float64;
    tx: float64;
    ty: float64;
    basis: string[]; // registration-basis landmark codes (provenance)
  }

  // Per-landmark displacement in the registered frame. mm null = uncalibrated.
  model CephLandmarkDelta {
    landmarkCode: string;
    dxPx: float64;
    dyPx: float64;
    magnitudePx: float64;
    dxMm: float64 | null;
    dyMm: float64 | null;
    magnitudeMm: float64 | null;
    directionDeg: float64;
  }

  // Signed per-metric Δ (to − from). delta null = missing on one side.
  model CephMetricDelta {
    metric: string;
    from: float64 | null;
    to: float64 | null;
    delta: float64 | null;
  }

  model CephSuperimpositionInput {
    reportFromId: string; // earlier timepoint report snapshot
    reportToId: string; // later timepoint report snapshot
    reference: CephSuperimpositionReference;
  }

  // Computed (and optionally persisted) superimposition artifact.
  model CephSuperimposition {
    id: string | null; // null for preview (compute-on-the-fly, not persisted)
    patientId: string;
    reportFromId: string;
    reportToId: string;
    reference: CephSuperimpositionReference;
    transform: CephSimilarityTransform;
    landmarkDeltas: CephLandmarkDelta[];
    metricDeltas: CephMetricDelta[];
    // mm validity is traceable per timepoint (D-J posture).
    uncalibrated: boolean;
    calibrationBasis: Record<unknown>;
    // v1 disclosure label — consumers MUST surface this verbatim.
    label: string;
    createdAt: utcDateTime | null;
  }

  model CephSuperimpositionListResponse {
    items: CephSuperimposition[];
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

    // analysisType selects the protocol (steiner_hybrid_sn | ricketts). Omitted = default.
    @get
    @route("/dental/imaging/images/{imageId}/ceph/analysis")
    @useAuth(bearerAuth)
    getCephAnalysis(@path imageId: string, @query analysisType?: string): CephLandmarkListResponse | ErrorResponse;

    @post
    @route("/dental/imaging/images/{imageId}/ceph/analysis/recompute")
    @useAuth(bearerAuth)
    recomputeCephAnalysis(@path imageId: string, @query analysisType?: string): CephAnalysis | ErrorResponse;

    @post
    @route("/dental/imaging/images/{imageId}/ceph/reports")
    @useAuth(bearerAuth)
    createCephReport(@path imageId: string, @body body: CreateCephReportBody): CephReport | ErrorResponse;

    @get
    @route("/dental/imaging/images/{imageId}/ceph/reports")
    @useAuth(bearerAuth)
    getCephReport(@path imageId: string, @query version?: int32): CephReport | ErrorResponse;

    // ── Auto / AI landmark detection (P1-10, Phase 0) ──────────────────────
    // Full /dental/imaging prefix required (route-override gotcha; missing prefix
    // = P0 auth bypass). Addon-tier + dental_imaging_auto_landmark flag gated.
    // Predictions are persisted via batch-upsert (source='ai', status='placed').
    @post
    @route("/dental/imaging/images/{imageId}/ceph/landmarks/detect")
    @useAuth(bearerAuth)
    detectCephLandmarks(@path imageId: string): CephLandmarkDetectionResult | ErrorResponse;

    @get
    @route("/dental/imaging/images/{imageId}/ceph/landmarks/detect/{jobId}")
    @useAuth(bearerAuth)
    getCephLandmarkDetectionJob(@path imageId: string, @path jobId: string): CephLandmarkDetectionResult | ErrorResponse;

    // ── Superimposition (P1-11, v1 cranial-base only) ──────────────────────
    // Compute-on-the-fly preview: returns transform + deltas WITHOUT persisting
    // (plan §4.2 v1 variant). id/createdAt are null.
    @post
    @route("/dental/imaging/ceph/superimpositions/preview")
    @useAuth(bearerAuth)
    previewCephSuperimposition(@body body: CephSuperimpositionInput): CephSuperimposition | ErrorResponse;

    // Persist a superimposition artifact (durable, auditable). 422 on missing
    // basis landmarks (INSUFFICIENT_LANDMARKS) or non-cranial_base in v1
    // (SUPERIMPOSITION_NOT_IMPLEMENTED).
    @post
    @route("/dental/imaging/ceph/superimpositions")
    @useAuth(bearerAuth)
    createCephSuperimposition(@body body: CephSuperimpositionInput): CephSuperimposition | ErrorResponse;

    @get
    @route("/dental/imaging/ceph/superimpositions/{superimpositionId}")
    @useAuth(bearerAuth)
    getCephSuperimposition(@path superimpositionId: string): CephSuperimposition | ErrorResponse;

    // List persisted superimpositions for a patient (timeline host).
    @get
    @route("/dental/imaging/patients/{patientId}/ceph/superimpositions")
    @useAuth(bearerAuth)
    listCephSuperimpositions(@path patientId: string): CephSuperimpositionListResponse | ErrorResponse;
  }
}
