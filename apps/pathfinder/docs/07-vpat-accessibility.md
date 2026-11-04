# Pathfinder Portal - Accessibility Conformance Report (VPAT-style)

| Field | Value |
|---|---|
| Document | 07 - VPAT / ACR (Accessibility Conformance Report) |
| Standard | WCAG 2.1 Level AA (forward target: WCAG 2.2 AA) |
| Product | Pathfinder Portal (open-core, white-label) |
| Date | 2026-06-16 |
| Owner | Pathfinder LiDAR Solutions |
| Status | Self-assessment for the S1-S7 build; third-party audit pending pre-GA |

This report follows the spirit of the VPAT/ACR format used in gov/edu
procurement. Accessibility is treated as a launch gate (Epic E12): any single
unmet Level A/AA criterion that blocks a responder task is procurement-
disqualifying, so this is a living gate, not a closing checkbox.

## Approach

- **Per-sprint, not deferred.** Each sprint added keyboard support and
  screen-reader labels to its new surface; S7 is the audit + this report + the
  non-visual map alternative, not the first time accessibility was considered.
- **Token-driven contrast.** All colour comes from the brand layer
  (`var(--brand-*)`); the default Pathfinder palette (dark slate / sky / ice)
  is chosen for AA contrast on text and controls.
- **Non-visual map alternative.** The safety map is inherently visual; the
  engine (`engines/a11y/map-text.ts`) renders a deterministic text equivalent
  (counts of exits, AEDs, stairwells; labelled wayfinding markers; reviewer
  notes) surfaced in the viewer under a "Text alternative for this floor"
  region with `aria-live`, and is unit-tested.

## Conformance summary (WCAG 2.1 AA, selected criteria)

| Criterion | Level | Status | Notes |
|---|---|---|---|
| 1.1.1 Non-text Content | A | Supports | Icons/markers have text labels; the map has a text alternative. |
| 1.3.1 Info and Relationships | A | Supports | Semantic headings, lists, tables; form labels. |
| 1.4.3 Contrast (Minimum) | AA | Supports | Brand tokens chosen for AA text contrast. |
| 1.4.11 Non-text Contrast | AA | Supports | Controls/borders use tokened contrast. |
| 2.1.1 Keyboard | A | Supports | Annotation tools, paging, undo/redo, save are keyboard-mapped; nav is link/button based. |
| 2.4.1 Bypass Blocks | A | Supports | "Skip to main content" link in the shell. |
| 2.4.3 Focus Order | A | Supports | DOM order is logical; toolbar precedes canvas. |
| 2.4.7 Focus Visible | AA | Supports | Native focus rings retained; current viewpoint outlined. |
| 3.3.2 Labels or Instructions | A | Supports | Inputs labelled; comment box hints at @mentions. |
| 4.1.2 Name, Role, Value | A | Partial | 3D canvas uses `role="application"` with a label; full AT semantics for the WebGL scene rely on the text alternative and marker list. |
| 1.2.x Time-based Media (video) | A/AA | Partial | mp4 walkthroughs are a baseline; captions/transcripts are a content responsibility, not yet enforced in-product. |

## Known gaps / forward work

- **WebGL splat scene** is not directly screen-reader navigable; the marker
  list, measurement readout and the 2D map text alternative are the equivalent
  access path. A keyboard-driven viewpoint tour is provided.
- **Video captions/transcripts** are not yet ingested; tracked for post-launch.
- **Third-party audit + automated axe-core run in CI** are planned before GA;
  this document is a self-assessment.

## Testing performed

- Manual keyboard walkthrough of auth, hierarchy nav, the 2D viewer and admin.
- Unit tests lock the non-visual map alternative output.
- Playwright captures screenshots per acceptance criterion (E14 harness).
