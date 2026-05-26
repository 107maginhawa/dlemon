# Interaction States — dental-scheduling
<!-- oli: v3-dentalemon | dental-scheduling | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

**Calendar grid:**
- Loading: gray skeleton blocks in time slots, header chips pulse.
- Empty day: dashed outline placeholder + "No appointments scheduled" microcopy.
- Hover empty slot: lemon-tinted fill + `+` icon.
- Hover appointment block: 4% darker tint, cursor pointer.
- Drag-to-reschedule (future): not in v1, slot click only.

**Slot picker:**
- Available: white surface.
- Occupied: gray striped, tooltip on hover.
- Outside working hours: solid gray, non-clickable.
- Selected: lemon fill, multi-slot duration span outlined.
- Focus: 2px lemon ring.

**Double-booking warning:** blocking modal, red iconography, no override path (FR3.7).

**Check-in:** success toast "Patient checked in. Visit created." Block-fade animation lemon (200ms ease).

**Reschedule same-day:** blocking Alert inside dialog, Confirm permanently disabled.

**Cancel:** destructive button red. On submit: block fades to cancelled red over 200ms.

**Working hours validation:** inline red helper text on invalid range; sticky unsaved banner top of page.

**Toasts:** top-center, 3s duration, lemon for success, red for error, neutral gray for info.
