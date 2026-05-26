# Microcopy — dental-visit
<!-- oli: v3-dentalemon | dental-visit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## Labels
- Primary CTAs: "Open Workspace", "New Visit", "Complete Visit", "Save Draft"
- SOAP: "Sign Notes", "Add Addendum", "View Version History"
- Treatments: "Mark Performed", "Mark Planned", "Carry-over from prior visit"
- Status: "Draft", "Active", "Completed", "Locked"

## Tooltips / Hints
- Chart: "Tap a tooth to chart conditions and treatments"
- Carry-over indicator: "Carry-over from {date}: {treatment}"
- Status blocked: "Treatment must be planned first before marking performed"

## Banners
- Locked: "This visit is locked and cannot be modified."
- Offline: "Working offline. Changes will sync when connection returns."
- Unsigned-SOAP warning: "SOAP notes are unsigned. Sign before completing or acknowledge below."

## Empty states
- Visit list: "No visits yet — start a new visit."
- Chart: "Tap a tooth to start charting."
- SOAP: "Add notes for each section, then sign to lock."

## Confirmations
- Complete visit: "Complete this visit? Status will change to Completed and {n} performed treatments will be ready for invoicing."
- Sign SOAP: "Sign these notes? You'll only be able to add addendums after signing."
- Discard chart entry: "Discard unsaved changes?"

## Errors
- Save: "Couldn't save. Retry?"
- Status transition: "Couldn't update treatment status. Please retry."
