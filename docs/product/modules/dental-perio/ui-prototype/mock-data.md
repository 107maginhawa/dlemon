# dental-perio — Mock Data

## Sample chart (in-progress draft)

```json
{
  "id": "c2000000-0000-4000-8000-000000000001",
  "visitId": "c1000000-0000-4000-8000-00000000000d",
  "patientId": "c1000000-0000-4000-8000-000000000009",
  "branchId": "c1000000-0000-4000-8000-000000000002",
  "examinerMemberId": "c1000000-0000-4000-8000-000000000004",
  "status": "draft",
  "notes": "Patient reports occasional gum bleeding when flossing.",
  "completedAt": null,
  "summaryBopPercent": null,
  "summaryMeanDepth": null,
  "summaryDeepPocketCount": null,
  "createdAt": "2026-05-24T10:00:00Z",
  "updatedAt": "2026-05-24T10:14:30Z",
  "readings": [
    { "toothNumber": 11, "depthBM": 3, "depthBC": 2, "depthBD": 3, "depthLM": 2, "depthLC": 2, "depthLD": 3, "bopBM": true,  "bopLC": false, "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false },
    { "toothNumber": 12, "depthBM": 2, "depthBC": 2, "depthBD": 3, "depthLM": 2, "depthLC": 3, "depthLD": 3, "bopBM": false, "bopLC": false, "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false },
    { "toothNumber": 16, "depthBM": 4, "depthBC": 3, "depthBD": 5, "depthLM": 4, "depthLC": 4, "depthLD": 5, "bopBD": true,  "bopLD": true,  "mobility": 1, "furcation": 1, "plaque": true,  "suppuration": false },
    { "toothNumber": 21, "depthBM": 3, "depthBC": 2, "depthBD": 3, "depthLM": 2, "depthLC": 2, "depthLD": 3, "bopBM": false, "bopLC": false, "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false },
    { "toothNumber": 26, "depthBM": 5, "depthBC": 4, "depthBD": 6, "depthLM": 5, "depthLC": 5, "depthLD": 6, "bopBM": true,  "bopBD": true,  "mobility": 1, "furcation": 2, "plaque": true,  "suppuration": true,  "notes": "Deep distal pocket; suppuration noted." },
    { "toothNumber": 36, "depthBM": 4, "depthBC": 3, "depthBD": 5, "depthLM": 4, "depthLC": 3, "depthLD": 4, "bopBD": true,  "mobility": 1, "furcation": 1, "plaque": false, "suppuration": false },
    { "toothNumber": 41, "depthBM": 3, "depthBC": 2, "depthBD": 3, "depthLM": 2, "depthLC": 2, "depthLD": 3, "mobility": 0, "furcation": 0, "plaque": false, "suppuration": false },
    { "toothNumber": 46, "depthBM": 4, "depthBC": 3, "depthBD": 5, "depthLM": 4, "depthLC": 3, "depthLD": 4, "bopBD": true,  "mobility": 0, "furcation": 1, "plaque": false, "suppuration": false }
  ]
}
```

## Sample completed chart (summary stats populated)

```json
{
  "id": "c2000000-0000-4000-8000-000000000002",
  "status": "completed",
  "completedAt": "2026-04-12T14:22:00Z",
  "summaryBopPercent": 23.81,
  "summaryMeanDepth": 3.42,
  "summaryDeepPocketCount": 8
}
```
