/**
 * Indian Healthcare Code Systems
 *
 * Code system URIs specific to Indian healthcare under the
 * Ayushman Bharat Digital Mission (ABDM) / National Digital Health Mission (NDHM).
 * These supplement the core international code systems and are used in
 * ABDM-connected health information systems.
 *
 * Regulatory basis: ABDM Health Data Management Policy,
 * DPDP Act 2023 (Digital Personal Data Protection Act),
 * NMC Act 2020 (National Medical Commission Act),
 * CDSCO (Central Drugs Standard Control Organisation) regulations,
 * National Digital Health Blueprint (NDHB).
 */

namespace Localization.IN;

@doc("Indian healthcare code system URIs for use in Coding.system fields.")
enum INCodingSystem {
  @doc("ABDM SNOMED CT — ABDM mandates SNOMED CT as the terminology standard for clinical data in the ABDM ecosystem. System URI is the international SNOMED CT root. The National Resource Centre for EHR Standards (NRCeS) maintains guidance on SNOMED CT use in Indian ABDM implementations.")
  snomedCtABDM: "http://snomed.info/sct",

  @doc("LOINC — Logical Observation Identifiers Names and Codes. Mandated by ABDM for laboratory and clinical observation reporting in the Unified Health Interface (UHI). Used for lab results, clinical measurements, and document type coding in ABDM Health Locker.")
  loinc: "http://loinc.org",

  @doc("ICD-10 — International Classification of Diseases 10th revision (WHO). Used for diagnosis coding in ABDM EHR. India uses the WHO base edition (not a national modification). Mandated for National Health Stack (NHS-IN) data submissions.")
  icd10: "http://hl7.org/fhir/sid/icd-10",

  @doc("NLEM — National List of Essential Medicines. Maintained by the Ministry of Health and Family Welfare. The 2022 NLEM lists 384 medicines. Used in PMJAY (Pradhan Mantri Jan Arogya Yojana) benefit package definitions and public procurement.")
  nlem: "https://main.mohfw.gov.in/NLEM",

  @doc("AYUSH codes — Classification system for AYUSH (Ayurveda, Yoga & Naturopathy, Unani, Siddha, and Homeopathy) treatment systems. ABDM supports AYUSH clinical documentation. Managed by the Ministry of AYUSH.")
  ayush: "https://abdm.gov.in/terminology/ayush",

  @doc("NMC codes — National Medical Commission registration codes. NMC is the apex body for medical education and practice regulation under the NMC Act 2020. Replaced the Medical Council of India (MCI).")
  nmc: "https://www.nmc.org.in",

  @doc("CDSCO Drug Code — Drug regulatory codes assigned by the Central Drugs Standard Control Organisation under Schedule H, H1, and X of the Drugs and Cosmetics Act 1940. Used for controlled and prescription drug identification.")
  cdsco: "https://cdsco.gov.in/opencms/opencms/en/Drugs/",

  @doc("PMJAY Package Codes — Pradhan Mantri Jan Arogya Yojana (Ayushman Bharat PM-JAY) HBP (Health Benefit Package) codes. Published by the National Health Authority (NHA). Used for insurance claim processing under PM-JAY.")
  pmjayPackage: "https://pmjay.gov.in/hbp",

  @doc("eSanjeevani — National telemedicine service codes. Used in the Unified Health Interface (UHI) for telemedicine service identification. Maintained by C-DAC/MoHFW.")
  esanjeevani: "https://esanjeevani.mohfw.gov.in",
}
