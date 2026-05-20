# Module 1: Workspace — Hi-Fi Screenshot Guide

> **Purpose:** Hi-fi Figma screenshots of the Workspace module prototype. These are the authoritative visual reference — wireframes (XML) define structure, screenshots define the look.

## How to Use

1. **Dev AI:** When implementing a screen from `wireframes/`, check this folder for the corresponding screenshot. The screenshot shows the final visual treatment — colors, typography, spacing, component styling. The wireframe shows structure and component names.
2. **Reviewers:** Compare the implemented screen against these screenshots for visual fidelity. Use `/anor` for adversarial evaluation.
3. **Naming convention:** `NN-dental-workspace-[view-or-state].png` — numbered for sequence, describes the view or state shown.

## Screenshot Inventory

| # | Screenshot | Shows | Corresponds To |
|---|------------|-------|---------------|
| 01 | `01-dental-workspace-defaultscreen.png` | Default workspace — dental chart (upper + lower arch), date header (March 05, 2026), Breakdown table below (Tooth, Surface, Condition, Treatment Plan, Work Done, Status columns), filter toggles (Fractured, Cleansing), Grand Total with "Continue to Payment" button | `wireframes/dental-workspace.xml` — default state |
| 02 | `02-dental-workspace-tooth-selected.png` | Tooth selected state — Tooth #9 selected (highlighted in chart), right slideout panel open showing "Conditions" section with "Select condition" dropdown and "No conditions added" empty state. Bottom action bar: "Continue to Payment", "Back", "Save & Continue" | `wireframes/dental-workspace.xml` + `wireframes/step-slideout-overview.xml` |
| 03 | `03-dental-workspace-previous-baseline-selected.png` | Previous baseline view — date header shows October 12, 2025 (historical date), dental chart grayed out (read-only), Breakdown table shows historical records, Grand Total preserved | `wireframes/dental-workspace.xml` — previous baseline state |

## Not Yet Implemented in Screenshots

These elements are part of the design intent but are NOT visible in the current screenshots. The dev must implement them.

| Missing Element | Where | Source of Truth | What to Implement |
|----------------|-------|-----------------|-------------------|
| **Cervical toggle** | Slideout panel (screenshot 02), within the 5-surface selector | Figma design intent (not in wireframe XML) | A toggle that enables the user to tag the cervical region of a tooth. In SVG terms: the outer stroke/border zone of the 5-surface diagram (B, M, D, P, I) represents the cervical area. When toggled ON, the cervical ring becomes selectable/taggable like any other surface. When OFF, only the 5 inner surfaces are interactive. This is a clinical charting requirement — cervical caries, abrasion, and restorations need surface-level tracking at the cervical margin. |

## Precedence Rule

When the screenshot and wireframe conflict:
- **Layout and component names** → wireframe wins (structural source of truth)
- **Visual treatment** (colors, spacing, typography, shadows, component styling) → screenshot wins (design source of truth)
- **States and interactions** → wireframe wins (behavioral source of truth)
- **Missing elements** (listed above) → check the Source of Truth column. Some are in wireframes, some are Figma design intent not yet in wireframes.
