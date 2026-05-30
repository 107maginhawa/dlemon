# Code API Surface

<!-- oli:regen:code-api-surface:begin -->
| Endpoint | Handler | Auth | Consumers | Phantom | Confidence |
|---|---|---|---|---|---|
| `POST /dental/patients` | — | ? | 2 | ⚠️ | LOW |
| `GET /dental/org/members` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/organizations/:orgId/branches/:branchId/members/:memberId/verify-pin` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/billing/invoices/:invoiceId` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/billing/invoices/:invoiceId/issue` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/billing/invoices/:invoiceId/void` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/billing/invoices/:invoiceId/payments` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/billing/invoices/:invoiceId/plan` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/imaging/images/:imageId/ceph/reports` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/imaging/images/:imageId/ceph/landmarks` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/imaging/images/:imageId/ceph/landmarks/:code` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/imaging/images/:imageId/ceph/landmarks` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /dental/imaging/images/:imageId/ceph/landmarks/:code` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/imaging/images/:imageId/ceph/analysis` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/imaging/images/:imageId/calibration` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/imaging/images/:imageId/measurements` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/imaging/images/:imageId/measurements` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /dental/imaging/measurements/:measurementId` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/imaging/images/:imageId/findings` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/imaging/images/:imageId/findings` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/imaging/findings/:findingId` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /dental/imaging/findings/:findingId` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/patients/:patientId/images` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/imaging/studies` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /storage/multipart/:fileId/abort` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/organizations` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/organizations/:id/branches` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/organizations/:id/branches/:id/members` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/organizations/:id/branches/:id/members/:id/set-pin` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/pmd/import` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/billing/invoices` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/branches/:branchId/queue-board` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/queue-items/:itemId/status` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/patients/:patientId/recalls` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/patients/:patientId/recalls` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/patients/:patientId/recalls/:recallId` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/sync-logs` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/patients/:patientId/treatment-plan` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/patients/:patientId/treatment-plan/accept` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/visits/:visitId/treatments/:treatmentId` | — | ? | 1 | ⚠️ | LOW |
| `GET /dental/patients/:patientId/treatment-plans` | — | ? | 1 | ⚠️ | LOW |
| `POST /dental/patients/:patientId/treatment-plans` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /dental/patients/:patientId/treatment-plans/:planId` | — | ? | 1 | ⚠️ | LOW |
<!-- oli:regen:code-api-surface:end -->
