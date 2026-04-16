/**
 * UK Healthcare Code Systems
 *
 * Code system URIs specific to United Kingdom healthcare.
 * These supplement the core international code systems and are used
 * alongside WHO ICD-10, SNOMED CT, and LOINC in NHS and independent sector implementations.
 *
 * Regulatory basis: NHS Digital Data Standards, NHS Data Dictionary, SNOMED CT UK Edition licence,
 * MHRA drug regulation, NICE technology appraisals, DCB standards (DCB0129/DCB0160).
 */

namespace Localization.UK;

@doc("UK healthcare code system URIs for use in Coding.system fields.")
enum UKCodingSystem {
  @doc("SNOMED CT UK Edition — The UK National Release Centre (NRC) maintains the UK Clinical Extension and UK Drug Extension on top of the international SNOMED CT release. Required for NHS Digital clinical coding submissions. System URI references the international SNOMED CT root; the UK Edition is identified by its module ID (999000041000000102).")
  snomedCtUK: "http://snomed.info/sct",

  @doc("dm+d — Dictionary of Medicines and Devices. Maintained by NHS Business Services Authority (NHSBSA) and NHS Digital. The authoritative NHS drug coding system. Required for ePrescribing, dispensing, and medicines reconciliation in NHS England.")
  dmd: "https://dmd.nhs.uk",

  @doc("OPCS-4 — Office of Population Censuses and Surveys Classification of Interventions and Procedures, version 4. NHS England mandatory classification for all operative and diagnostic procedures on admitted patients. Required for HES (Hospital Episode Statistics) submissions.")
  opcs4: "https://www.datadictionary.nhs.uk/data_elements/main_operative_procedure_-_opcs_code.html",

  @doc("NHS Data Dictionary — NHS Data Dictionary coded data elements including admission methods, discharge destinations, specialty codes, and patient classification. Maintained by NHS England.")
  nhsDataDictionary: "https://www.datadictionary.nhs.uk",

  @doc("READ codes (CTV3/Read v2) — Legacy primary care coding system used in GP systems. READ v2 and CTV3 (Clinical Terms Version 3) are being retired in favour of SNOMED CT. Retained for historical record mapping only.")
  readCodes: "http://read.info/readv2",

  @doc("CTV3 — Clinical Terms Version 3 (Read codes v3). Extended READ code system used in some legacy GP systems. Being retired in favour of SNOMED CT. Retained for historical record mapping only.")
  ctv3: "http://read.info/ctv3",

  @doc("BNF — British National Formulary classification. Published jointly by the British Medical Association and Royal Pharmaceutical Society. Used alongside dm+d for prescribing decision support and drug classification.")
  bnf: "https://www.nhsbsa.nhs.uk/pharmacies-gp-practices-and-appliance-contractors/drug-tariff/drug-tariff-part-ix",

  @doc("NHS Outcome Framework — NHS OF indicators for reporting quality and outcomes in NHS commissioned services.")
  nhsOutcomeFramework: "https://digital.nhs.uk/data-and-information/data-tools-and-services/data-services/patient-reported-outcome-measures",

  @doc("NICIP — National Interim Clinical Imaging Procedure code set. NHS England coding system for imaging procedures, aligning with SNOMED CT imaging concepts.")
  nicip: "https://www.datadictionary.nhs.uk/data_elements/nicip_code.html",
}
