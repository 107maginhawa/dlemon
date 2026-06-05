# Code Data Model

<!-- oli:regen:code-data-model:begin -->
Dialect: `postgres` · Tables: 93 · Enums: 65

| Table | Cols | PK | FK | Module |
|---|---|---|---|---|
| `amendment` | 7 | — | visit_id→dentalVisits, patient_id→patients, author_member_id→dentalMemberships | src/handlers |
| `audit_log_entry` | 19 | — | archived_by→user | src/handlers |
| `booking` | 17 | — | client_id→persons, host_id→persons, slot_id→timeSlots | src/handlers |
| `booking_event` | 16 | — | owner_id→persons | src/handlers |
| `chat_message` | 6 | — | chat_room_id→chatRooms | src/handlers |
| `chat_room` | 7 | — | — | src/handlers |
| `consent_form` | 16 | — | visit_id→dentalVisits, patient_id→patients, accepted_plan_version_id→treatmentPlanVersions | src/handlers |
| `consent_refusal` | 7 | — | visit_id→dentalVisits, patient_id→patients, refusing_member_id→dentalMemberships | src/handlers |
| `consultation_note` | 15 | — | — | src/handlers |
| `dental_alert` | 5 | — | patient_id→patients | src/handlers |
| `dental_appointment` | 22 | — | patient_id→patients, dentist_member_id→dentalMemberships, branch_id→dentalBranches, operatory_id→dentalOperatories, visit_id→dentalVisits | src/handlers |
| `dental_appointment_hold` | 6 | — | branch_id→dentalBranches, provider_id→dentalMemberships | src/handlers |
| `dental_attachment` | 10 | — | visit_id→dentalVisits, patient_id→patients | src/handlers |
| `dental_audit` | 11 | id | — | src/db |
| `dental_audit_log` | 15 | — | — | src/handlers |
| `dental_branch` | 9 | — | organization_id→dentalOrganizations | src/handlers |
| `dental_case_presentation` | 14 | — | patient_id→patients, treatment_plan_id→dentalTreatmentPlans | src/handlers |
| `dental_chart` | 4 | — | visit_id→dentalVisits, patient_id→patients | src/handlers |
| `dental_chart_version` | 1 | — | chart_id→dentalCharts | src/handlers |
| `dental_claim_draft` | 10 | — | patient_id→patients, insurance_profile_id→dentalInsuranceProfiles | src/handlers |
| `dental_consent_template` | 5 | — | branch_id→dentalBranches | src/handlers |
| `dental_coverage_authorization` | 13 | — | patient_id→patients, insurance_profile_id→dentalInsuranceProfiles, branch_id→dentalBranches | src/handlers |
| `dental_erasure_request` | 12 | — | — | src/handlers |
| `dental_feature_permission` | 4 | — | organization_id→dentalOrganizations | src/handlers |
| `dental_household` | 4 | — | — | src/handlers |
| `dental_household_member` | 4 | — | household_id→dentalHouseholds, patient_id→patients | src/handlers |
| `dental_insurance_claim` | 19 | — | patient_id→patients, branch_id→dentalBranches, invoice_id→dentalInvoices | src/handlers |
| `dental_insurance_claim_line` | 9 | — | claim_id→dentalInsuranceClaims | src/handlers |
| `dental_insurance_profile` | 13 | — | patient_id→patients | src/handlers |
| `dental_inventory_adjustment` | 4 | — | item_id→dentalInventoryItems | src/handlers |
| `dental_inventory_item` | 8 | — | branch_id→dentalBranches | src/handlers |
| `dental_invoice` | 20 | — | visit_id→dentalVisits, patient_id→patients, branch_id→dentalBranches, dentist_member_id→dentalMemberships | src/handlers |
| `dental_invoice_line_item` | 9 | — | invoice_id→dentalInvoices, treatment_id→dentalTreatments | src/handlers |
| `dental_legal_hold` | 10 | — | — | src/handlers |
| `dental_membership` | 16 | — | branch_id→dentalBranches | src/handlers |
| `dental_occlusion_screening` | 10 | — | patient_id→patients | src/handlers |
| `dental_operatory` | 3 | — | branch_id→dentalBranches | src/handlers |
| `dental_organization` | 7 | — | — | src/handlers |
| `dental_patient_chart_baseline` | 4 | — | patient_id→patients | src/handlers |
| `dental_patient_contact` | 9 | — | patient_id→patients | src/handlers |
| `dental_payer_payment` | 10 | — | claim_id→dentalInsuranceClaims, branch_id→dentalBranches, invoice_id→dentalInvoices | src/handlers |
| `dental_payment` | 12 | — | invoice_id→dentalInvoices, patient_id→patients, branch_id→dentalBranches, recorded_by_member_id→dentalMemberships, voided_by_member_id→dentalMemberships | src/handlers |
| `dental_payment_plan` | 8 | — | invoice_id→dentalInvoices, patient_id→patients | src/handlers |
| `dental_payment_plan_installment` | 8 | — | plan_id→dentalPaymentPlans, payment_id→dentalPayments | src/handlers |
| `dental_perio_chart` | 10 | — | visit_id→dentalVisits, patient_id→patients, branch_id→dentalBranches | src/handlers |
| `dental_perio_tooth_reading` | 26 | — | chart_id→dentalPerioCharts | src/handlers |
| `dental_postop_template` | 5 | — | branch_id→dentalBranches | src/handlers |
| `dental_procedure_code` | 5 | — | — | src/handlers |
| `dental_queue_item` | 8 | — | appointment_id→dentalAppointments, patient_id→patients, branch_id→dentalBranches | src/handlers |
| `dental_recall` | 10 | — | patient_id→patients | src/handlers |
| `dental_retention_policy` | 10 | — | — | src/handlers |
| `dental_sync_log` | 8 | — | — | src/handlers |
| `dental_task` | 8 | — | patient_id→patients | src/handlers |
| `dental_treatment` | 23 | — | visit_id→dentalVisits, patient_id→patients, source_visit_id→dentalVisits | src/handlers |
| `dental_treatment_plan` | 8 | — | patient_id→patients | src/handlers |
| `dental_treatment_plan_approval` | 7 | — | treatment_plan_id→dentalTreatmentPlans | src/handlers |
| `dental_treatment_plan_status_history` | 5 | — | treatment_plan_id→dentalTreatmentPlans | src/handlers |
| `dental_treatment_template` | 5 | — | branch_id→dentalBranches | src/handlers |
| `dental_visit` | 9 | — | patient_id→patients, branch_id→dentalBranches, dentist_member_id→dentalMemberships | src/handlers |
| `dental_waitlist_entry` | 10 | — | patient_id→patients, branch_id→dentalBranches, preferred_provider_id→dentalMemberships, promoted_appointment_id→dentalAppointments | src/handlers |
| `email_queue` | 19 | — | template→emailTemplates | src/handlers |
| `email_template` | 13 | — | — | src/handlers |
| `imaging_annotation` | 7 | — | image_id→imagingStudyImages | src/handlers |
| `imaging_ceph_analysis` | 7 | — | image_id→imagingStudyImages | src/handlers |
| `imaging_ceph_landmark` | 7 | — | image_id→imagingStudyImages | src/handlers |
| `imaging_ceph_report` | 1 | — | image_id→imagingStudyImages | src/handlers |
| `imaging_ceph_superimposition` | 7 | — | report_from_id→imagingCephReports, report_to_id→imagingCephReports | src/handlers |
| `imaging_finding` | 12 | — | image_id→imagingStudyImages, annotation_id→imagingAnnotations | src/handlers |
| `imaging_study` | 6 | — | — | src/handlers |
| `imaging_study_image` | 12 | — | study_id→imagingStudies | src/handlers |
| `imaging_study_tooth` | 4 | id | image_id→imagingStudyImages | src/handlers |
| `imported_pmd` | 7 | — | — | src/handlers |
| `invoice` | 21 | — | customer→persons, merchant→persons, merchant_account→merchantAccounts | src/handlers |
| `invoice_line_item` | 6 | — | invoice→invoices | src/handlers |
| `lab_order` | 17 | — | visit_id→dentalVisits, patient_id→patients, replaced_by_order_id→labOrders | src/handlers |
| `medical_history_entry` | 9 | — | patient_id→patients | src/handlers |
| `medical_history_review` | 4 | — | patient_id→patients | src/handlers |
| `merchant_account` | 3 | — | person→persons | src/handlers |
| `notification` | 12 | — | — | src/handlers |
| `patient` | 15 | — | person_id→persons | src/handlers |
| `person` | 11 | — | — | src/handlers |
| `pmd_document` | 10 | — | supersedes_id→pmdDocuments | src/handlers |
| `practitioner_roles` | 15 | — | practitioner_id→practitioners | src/handlers |
| `practitioners` | 14 | — | provider_id→providers | src/handlers |
| `prescription` | 15 | — | visit_id→dentalVisits, patient_id→patients, prescriber_member_id→dentalMemberships | src/handlers |
| `provider` | 6 | — | person_id→persons | src/handlers |
| `review` | 6 | — | reviewer_id→persons, reviewed_entity_id→persons | src/handlers |
| `schedule_exception` | 9 | — | event_id→bookingEvents, owner_id→persons | src/handlers |
| `stored_file` | 7 | — | — | src/handlers |
| `time_slot` | 9 | — | owner_id→persons, event_id→bookingEvents, booking_id→bookings | src/handlers |
| `treatment_plan_version` | 1 | — | patient_id→patients | src/handlers |
| `visit_note_version` | 1 | — | note_id→visitNotes | src/handlers |
| `visit_notes` | 11 | — | visit_id→dentalVisits, author_member_id→dentalMemberships | src/handlers |

| Enum | Values |
|---|---|
| `appointment_status` | scheduled / confirmed / checked_in / completed / cancelled / no_show |
| `asa_classification` | I / II / III / IV / V / VI |
| `audit_action` | create / read / update / delete / login / logout |
| `audit_category` | hipaa / security / privacy / administrative / clinical / financial |
| `audit_event_type` | authentication / data-access / data-modification / system-config / security / compliance |
| `audit_outcome` | success / failure / partial / denied |
| `audit_retention_status` | active / archived / pending-purge |
| `booking_event_status` | draft / active / paused / archived |
| `booking_status` | pending / confirmed / rejected / cancelled / completed / no_show_client / no_show_host |
| `capture_method` | automatic / manual |
| `ceph_analysis_type` | steiner_hybrid_sn / ricketts |
| `ceph_calibration_method` | dicom_tag / manual_ruler / assumed_default / not_calibrated |
| `ceph_landmark_source` | manual / ai / ai_corrected |
| `ceph_landmark_status` | not_placed / placed / confirmed / locked |
| `ceph_superimposition_reference` | cranial_base / maxillary / mandibular |
| `chart_entry_classification` | existing / existing_other / treatment_plan / condition |
| `chart_layer` | baseline / proposed / completed |
| `chat_room_status` | active / archived |
| `consultation_status` | draft / finalized / amended |
| `controlled_substance_schedule` | none / II / III / IV / V |
| `dental_attachment_image_type` | xray / photo / scan / document / other |
| `dental_installment_status` | pending / paid / overdue / waived |
| `dental_invoice_status` | draft / issued / partial / paid / overdue / voided / uncollectible |
| `dental_payment_method` | cash / card / bank_transfer |
| `dental_perio_chart_status` | draft / completed / locked |
| `dental_plan_frequency` | weekly / biweekly / monthly |
| `dental_plan_status` | on_track / behind / completed / defaulted |
| `dental_treatment_phase` | systemic / disease_control / re_evaluation / definitive / maintenance |
| `dental_treatment_status` | diagnosed / planned / performed / verified / dismissed / declined |
| `dental_visit_status` | draft / active / completed / locked / discarded |
| `email_provider` | smtp / postmark / onesignal |
| `email_queue_status` | pending / processing / sent / failed / cancelled |
| `erasure_request_status` | requested / approved / anonymized / rejected |
| `file_status` | uploading / processing / available / failed |
| `gender` | male / female / non-binary / other / prefer-not-to-say |
| `imaging_annotation_type` | line / angle / area / label / arrow / freehand / shape / tooth |
| `imaging_finding_status` | draft / suspected / confirmed / monitoring / resolved |
| `imaging_finding_type` | caries / secondary_caries / bone_loss / furcation_involvement / periapical_lesion / root_resorption / calculus / crown_fracture / root_fracture / impacted_tooth / over_eruption / open_contact / overhang / crown_needed / implant_needed |
| `imaging_modality` | periapical / bitewing / panoramic / cephalometric / cbct / intraoral_photo / extraoral_photo / other |
| `imaging_status` | active / archived |
| `imaging_tier` | free / basic / addon |
| `invoice_status` | draft / open / paid / void / uncollectible |
| `lab_order_status` | ordered / in_fabrication / delivered / fitted / cancelled |
| `legal_hold_status` | active / released |
| `location_type` | video / phone / in-person |
| `medical_history_entry_type` | condition / medication / allergy / procedure / vaccination / family_history |
| `member_role` | dentist_owner / dentist_associate / hygienist / staff_full / staff_scheduling / dental_assistant / front_desk / billing_staff / read_only |
| `member_status` | invited / active / inactive / revoked |
| `message_type` | text / system / video_call |
| `notification_channel` | email / push / in-app / sms |
| `notification_status` | queued / sent / delivered / read / failed / expired |
| `notification_type` | billing / security / system / booking.created / booking.confirmed / booking.rejected / booking.cancelled / booking.no-show-client / booking.no-show-host / comms.video-call-started / comms.video-call-joined / comms.video-call-left / comms.video-call-ended / comms.chat-message / appointment.reminder / appointment.confirmation-request / recall.due / recall.reminder |
| `org_tier` | solo / clinic / group / enterprise |
| `participant_type` | client / host |
| `payment_status` | pending / requires_capture / processing / succeeded / failed / canceled |
| `pmd_document_status` | generated / signed / superseded |
| `prescription_status` | pending / dispensed / cancelled |
| `recurrence_type` | daily / weekly / monthly / yearly |
| `retention_policy_action` | archive / anonymize / delete / retain |
| `slot_status` | available / booked / blocked |
| `template_status` | draft / active / archived |
| `tooth_state` | healthy / caries / fractured / filled / crown / missing / implant / extracted / watchlist |
| `tooth_surface` | mesial / distal / buccal / lingual / occlusal / incisal / cervical |
| `variable_type` | string / number / boolean / date / datetime / url / email / array |
| `video_call_status` | starting / active / ended / cancelled |
<!-- oli:regen:code-data-model:end -->
