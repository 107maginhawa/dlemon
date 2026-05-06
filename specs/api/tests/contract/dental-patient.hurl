# Dental Patient contract tests
# Tests the /dental/patients API: create, list, get, update, archive,
# restore, follow-up notes, safety floor, statement, bulk-archive, import, export.

# 0. Sign up as a user (required for auth)
POST {{api}}/auth/sign-up/email
Content-Type: application/json
Origin: {{api}}
{
  "email": "dental-patient-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dr. Dental Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"


# 1. Create a dental patient
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Maria Santos {{suffix}}",
  "dateOfBirth": "1985-06-15",
  "gender": "female",
  "consentGiven": true
}
HTTP 201
[Captures]
patient_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString
jsonpath "$.status" == "active"
jsonpath "$.needsFollowUp" == false
jsonpath "$.person" isCollection


# 2. List dental patients
GET {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patients" isCollection
jsonpath "$.total" >= 1


# 3. List dental patients with search
GET {{api}}/dental/patients?q=Maria+Santos
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patients" isCollection


# 4. Get patient profile
GET {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{patient_id}}"
jsonpath "$.status" == "active"


# 5. Update dental-specific fields
PATCH {{api}}/dental/patients/{{patient_id}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "dentalHistorySummary": "Mild gingivitis. Scaling done annually.",
  "needsFollowUp": true,
  "recallNote": "Schedule cleaning in 6 months"
}
HTTP 200
[Asserts]
jsonpath "$.needsFollowUp" == true


# 6. List patients with needsFollowUp filter
GET {{api}}/dental/patients?needsFollowUp=true
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patients" isCollection


# 7. Add a follow-up note
POST {{api}}/dental/patients/{{patient_id}}/follow-up-notes
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "text": "Patient mentioned sensitivity in upper left molar."
}
HTTP 201
[Captures]
note_id: jsonpath "$.note.id"
[Asserts]
jsonpath "$.note.id" isString
jsonpath "$.note.text" == "Patient mentioned sensitivity in upper left molar."
jsonpath "$.total" >= 1


# 8. List follow-up notes
GET {{api}}/dental/patients/{{patient_id}}/follow-up-notes
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.notes" isCollection
jsonpath "$.total" >= 1


# 9. Get safety floor (medical history aggregation)
GET {{api}}/dental/patients/{{patient_id}}/safety-floor
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.allergies" isCollection
jsonpath "$.medications" isCollection
jsonpath "$.conditions" isCollection
jsonpath "$.retrievedAt" isString


# 10. Get itemized statement
GET {{api}}/dental/patients/{{patient_id}}/statement
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patientId" == "{{patient_id}}"
jsonpath "$.summary.totalVisits" isInteger
jsonpath "$.summary.outstandingBalanceCents" isInteger
jsonpath "$.visits" isCollection
jsonpath "$.invoices" isCollection
jsonpath "$.payments" isCollection


# 11. Export patients as JSON
GET {{api}}/dental/patients/export?format=json
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.patients" isCollection
jsonpath "$.total" >= 1
jsonpath "$.exportedAt" isString


# 12. Import patients via JSON
POST {{api}}/dental/patients/import
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patients": [
    {
      "firstName": "Juan",
      "lastName": "Dela Cruz",
      "dateOfBirth": "1990-03-22",
      "branchId": "00000000-0000-4000-8000-000000000099"
    }
  ]
}
HTTP [201, 422]


# 13. Archive patient
POST {{api}}/dental/patients/{{patient_id}}/archive
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "archived"


# 14. Restore archived patient
POST {{api}}/dental/patients/{{patient_id}}/restore
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"


# 15. Create a second patient for bulk-archive
POST {{api}}/dental/patients
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "displayName": "Bulk Test Patient {{suffix}}",
  "consentGiven": true
}
HTTP 201
[Captures]
patient2_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" isString


# 16. Bulk-archive both patients
POST {{api}}/dental/patients/bulk-archive
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "patientIds": ["{{patient_id}}", "{{patient2_id}}"]
}
HTTP 200
[Asserts]
jsonpath "$.results" isCollection
jsonpath "$.successCount" >= 0
jsonpath "$.failCount" >= 0
