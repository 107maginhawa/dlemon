# Code Data Model

<!-- oli:regen:code-data-model:begin -->
Dialect: `postgres` · Tables: 75 · Enums: 58

| Table | Cols | PK | FK | Module |
|---|---|---|---|---|
| `amendment` | 7 | — | visit_id→dentalVisits, patient_id→patients, author_member_id→dentalMemberships | dental-clinical |
| `audit_log_entry` | 19 | — | archived_by→user | audit |
| `booking` | 17 | — | client_id→persons, host_id→persons, slot_id→timeSlots | booking |
| `booking_event` | 16 | — | owner_id→persons | booking |
| `chat_message` | 6 | — | chat_room_id→chatRooms | comms |
| `chat_room` | 7 | — | — | comms |
| `consent_form` | 11 | — | visit_id→dentalVisits, patient_id→patients, accepted_plan_version_id→treatmentPlanVersions | dental-clinical |
| `consultation_note` | 15 | — | — | emr |
| `dental_alert` | 5 | — | patient_id→patients | dental-patient |
| `dental_appointment` | 15 | — | patient_id→patients, dentist_member_id→dentalMemberships, branch_id→dentalBranches, operatory_id→dentalOperatories, visit_id→dentalVisits | dental-scheduling |
| `dental_attachment` | 10 | — | visit_id→dentalVisits, patient_id→patients | dental-clinical |
| `dental_audit` | 11 | id | — | unknown |
| `dental_audit_log` | 15 | — | — | dental-audit |
| `dental_branch` | 9 | — | organization_id→dentalOrganizations | dental-org |
| `dental_chart` | 4 | — | visit_id→dentalVisits, patient_id→patients | dental-visit |
| `dental_chart_version` | 1 | — | chart_id→dentalCharts | dental-visit |
| `dental_claim_draft` | 10 | — | patient_id→patients, insurance_profile_id→dentalInsuranceProfiles | dental-patient |
| `dental_consent_template` | 5 | — | branch_id→dentalBranches | dental-org |
| `dental_insurance_profile` | 9 | — | patient_id→patients | dental-patient |
| `dental_inventory_adjustment` | 4 | — | item_id→dentalInventoryItems | dental-clinical |
| `dental_inventory_item` | 8 | — | branch_id→dentalBranches | dental-clinical |
| `dental_invoice` | 19 | — | visit_id→dentalVisits, patient_id→patients, branch_id→dentalBranches, dentist_member_id→dentalMemberships | dental-billing |
| `dental_invoice_line_item` | 9 | — | invoice_id→dentalInvoices, treatment_id→dentalTreatments | dental-billing |
| `dental_membership` | 12 | — | branch_id→dentalBranches | dental-org |
| `dental_occlusion_screening` | 10 | — | patient_id→patients | dental-clinical |
| `dental_operatory` | 3 | — | branch_id→dentalBranches | dental-scheduling |
| `dental_organization` | 6 | — | — | dental-org |
| `dental_patient_chart_baseline` | 4 | — | patient_id→patients | dental-visit |
| `dental_patient_contact` | 9 | — | patient_id→patients | dental-patient |
| `dental_payment` | 12 | — | invoice_id→dentalInvoices, patient_id→patients, branch_id→dentalBranches, recorded_by_member_id→dentalMemberships, voided_by_member_id→dentalMemberships | dental-billing |
| `dental_payment_plan` | 8 | — | invoice_id→dentalInvoices, patient_id→patients | dental-billing |
| `dental_payment_plan_installment` | 8 | — | plan_id→dentalPaymentPlans, payment_id→dentalPayments | dental-billing |
| `dental_perio_chart` | 10 | — | visit_id→dentalVisits, patient_id→patients, branch_id→dentalBranches | dental-perio |
| `dental_perio_tooth_reading` | 20 | — | chart_id→dentalPerioCharts | dental-perio |
| `dental_postop_template` | 5 | — | branch_id→dentalBranches | dental-clinical |
| `dental_procedure_code` | 5 | — | — | dental-visit |
| `dental_queue_item` | 8 | — | appointment_id→dentalAppointments, patient_id→patients, branch_id→dentalBranches | dental-scheduling |
| `dental_recall` | 7 | — | patient_id→patients | dental-patient |
| `dental_sync_log` | 8 | — | — | dental-patient |
| `dental_task` | 8 | — | patient_id→patients | dental-patient |
| `dental_treatment` | 17 | — | visit_id→dentalVisits, patient_id→patients, source_visit_id→dentalVisits | dental-visit |
| `dental_treatment_plan` | 7 | — | patient_id→patients | dental-patient |
| `dental_treatment_template` | 5 | — | branch_id→dentalBranches | dental-visit |
| `dental_visit` | 9 | — | patient_id→patients, branch_id→dentalBranches, dentist_member_id→dentalMemberships | dental-visit |
| `email_queue` | 19 | — | template→emailTemplates | email |
| `email_template` | 13 | — | — | email |
| `imaging_annotation` | 7 | — | image_id→imagingStudyImages | dental-imaging |
| `imaging_ceph_analysis` | 7 | — | image_id→imagingStudyImages | dental-imaging |
| `imaging_ceph_landmark` | 7 | — | image_id→imagingStudyImages | dental-imaging |
| `imaging_ceph_report` | 1 | — | image_id→imagingStudyImages | dental-imaging |
| `imaging_finding` | 11 | — | image_id→imagingStudyImages, annotation_id→imagingAnnotations | dental-imaging |
| `imaging_study` | 6 | — | — | dental-imaging |
| `imaging_study_image` | 7 | — | study_id→imagingStudies | dental-imaging |
| `imaging_study_tooth` | 4 | id | image_id→imagingStudyImages | dental-imaging |
| `imported_pmd` | 7 | — | — | dental-pmd |
| `invoice` | 21 | — | customer→persons, merchant→persons, merchant_account→merchantAccounts | billing |
| `invoice_line_item` | 6 | — | invoice→invoices | billing |
| `lab_order` | 13 | — | visit_id→dentalVisits, patient_id→patients, replaced_by_order_id→labOrders | dental-clinical |
| `medical_history_entry` | 9 | — | patient_id→patients | dental-clinical |
| `merchant_account` | 3 | — | person→persons | billing |
| `notification` | 12 | — | — | notifs |
| `patient` | 15 | — | person_id→persons | patient |
| `person` | 11 | — | — | person |
| `pmd_document` | 10 | — | supersedes_id→pmdDocuments | dental-pmd |
| `practitioner_roles` | 15 | — | practitioner_id→practitioners | provider |
| `practitioners` | 14 | — | provider_id→providers | provider |
| `prescription` | 12 | — | visit_id→dentalVisits, patient_id→patients, prescriber_member_id→dentalMemberships | dental-clinical |
| `provider` | 6 | — | person_id→persons | provider |
| `review` | 6 | — | reviewer_id→persons, reviewed_entity_id→persons | reviews |
| `schedule_exception` | 9 | — | event_id→bookingEvents, owner_id→persons | booking |
| `stored_file` | 7 | — | — | storage |
| `time_slot` | 9 | — | owner_id→persons, event_id→bookingEvents, booking_id→bookings | booking |
| `treatment_plan_version` | 1 | — | patient_id→patients | dental-visit |
| `visit_note_version` | 1 | — | note_id→visitNotes | dental-visit |
| `visit_notes` | 11 | — | visit_id→dentalVisits, author_member_id→dentalMemberships | dental-visit |

| Enum | Values |
|---|---|
| `appointment_status` | scheduled / checked_in / completed / cancelled / no_show |
| `audit_action` | create / read / update / delete / login / logout |
| `audit_category` | hipaa / security / privacy / administrative / clinical / financial |
| `audit_event_type` | authentication / data-access / data-modification / system-config / security / compliance |
| `audit_outcome` | success / failure / partial / denied |
| `audit_retention_status` | active / archived / pending-purge |
| `booking_event_status` | draft / active / paused / archived |
| `booking_status` | pending / confirmed / rejected / cancelled / completed / no_show_client / no_show_host |
| `capture_method` | automatic / manual |
| `ceph_analysis_type` | steiner_hybrid_sn |
| `ceph_calibration_method` | dicom_tag / manual_ruler / assumed_default / not_calibrated |
| `ceph_landmark_source` | manual / ai / ai_corrected |
| `ceph_landmark_status` | not_placed / placed / confirmed / locked |
| `chart_entry_classification` | existing / existing_other / treatment_plan / condition |
| `chart_layer` | baseline / proposed / completed |
| `chat_room_status` | active / archived |
| `consultation_status` | draft / finalized / amended |
| `dental_attachment_image_type` | xray / photo / scan / document / other |
| `dental_installment_status` | pending / paid / overdue / waived |
| `dental_invoice_status` | draft / issued / partial / paid / overdue / voided |
| `dental_payment_method` | cash / card / bank_transfer |
| `dental_perio_chart_status` | draft / completed / locked |
| `dental_plan_frequency` | weekly / biweekly / monthly |
| `dental_plan_status` | on_track / behind / completed / defaulted |
| `dental_treatment_status` | diagnosed / planned / performed / verified / dismissed / declined |
| `dental_visit_status` | draft / active / completed / locked / discarded |
| `email_provider` | smtp / postmark / onesignal |
| `email_queue_status` | pending / processing / sent / failed / cancelled |
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
| `location_type` | video / phone / in-person |
| `medical_history_entry_type` | condition / medication / allergy / procedure / vaccination / family_history |
| `member_role` | dentist_owner / dentist_associate / hygienist / staff_full / staff_scheduling / dental_assistant / front_desk / billing_staff / read_only |
| `member_status` | invited / active / inactive / revoked |
| `message_type` | text / system / video_call |
| `notification_channel` | email / push / in-app |
| `notification_status` | queued / sent / delivered / read / failed / expired |
| `notification_type` | billing / security / system / booking.created / booking.confirmed / booking.rejected / booking.cancelled / booking.no-show-client / booking.no-show-host / comms.video-call-started / comms.video-call-joined / comms.video-call-left / comms.video-call-ended / comms.chat-message |
| `org_tier` | solo / clinic / group / enterprise |
| `participant_type` | client / host |
| `payment_status` | pending / requires_capture / processing / succeeded / failed / canceled |
| `pmd_document_status` | generated / signed / superseded |
| `prescription_status` | pending / dispensed / cancelled |
| `recurrence_type` | daily / weekly / monthly / yearly |
| `slot_status` | available / booked / blocked |
| `template_status` | draft / active / archived |
| `tooth_state` | healthy / caries / fractured / filled / crown / missing / implant / extracted / watchlist |
| `tooth_surface` | mesial / distal / buccal / lingual / occlusal / incisal / cervical |
| `variable_type` | string / number / boolean / date / datetime / url / email / array |
| `video_call_status` | starting / active / ended / cancelled |
<!-- oli:regen:code-data-model:end -->
