# Pathfinder Portal - User Stories

| Field | Value |
|---|---|
| Document | 02 - User Stories |
| Version | 0.1 |
| Date | 2026-06-15 |
| Status | Draft |
| Source of truth | `docs/00-canonical-context.md` |
| Companion | `docs/03-acceptance-criteria.md` |

---

## Intro

This document enumerates the user stories for the Pathfinder portal, organized by the
canonical epics E1 through E14. It draws all framing, terminology, identifiers, and
product decisions from `docs/00-canonical-context.md`; where the two disagree, the
canonical context wins.

### Persona set

Pathfinder is a multi-level white-label platform, so the personas span the operator that
runs a deployment, the client orgs that are its tenants, the field crew that produces the
data, the responders the data ultimately serves, and the engineers who build and operate
the platform.

- **Operator admin** - runs a Pathfinder deployment under its own brand (Pathfinder LiDAR
  itself, ELS911, or a future reseller). Owns the brand profile, the user roster, API
  keys, and platform settings. Maps to the platform-wide admin role.
- **Staff member** - operator personnel (project lead, mapper, surveyor) who scan
  facilities, build maps, run the review loop, and publish deliverables. Maps to the staff
  role; the surveyor is the field-capture specialization of this persona.
- **Client reviewer** - a named user inside a client org (school district safety director,
  911 center supervisor, university facilities lead) who reviews, comments on, and approves
  the work scoped to their org. Maps to the org-scoped client role.
- **First responder** - law, fire, or EMS personnel who consume published maps and scans
  for orientation and pre-incident planning, often via low-friction or shared access.
- **Compliance officer** - operator or client-side role responsible for the audit trail,
  NG911/NENA export conformance, and the trust posture for gov/edu procurement.
- **Platform engineer** - the developer/operator persona who builds, tests, and ships the
  platform and owns the quality and delivery harness.

### Traceability chain

Every story maps into the canonical chain **Epic -> US -> AC -> Test -> Sprint**. Each
user story carries an ID `US-<epic>.<n>`. Each story is validated by one or more
acceptance criteria `AC-<story>.<n>` in `docs/03-acceptance-criteria.md`, and each AC maps
1:1 to a Vitest/Playwright test `T-<AC>` in the forthcoming TDD plan. Stories cite the
research briefs in `docs/research/` where a behavior is grounded.

---

## E1 - White-Label Brand Layer

### US-1.1 - Default Pathfinder brand
As an operator admin, I want the platform to render under the Pathfinder LiDAR brand by
default, so that an unconfigured deployment still looks finished and on-brand.
Notes/grounding: canonical branding model, default brand = Pathfinder LiDAR; dark slate palette.

### US-1.2 - Drop-in brand swap
As an operator admin, I want to switch the active brand by setting `BRAND=els911` and
dropping in a logo, so that I can rebrand the whole deployment without editing components.
Notes/grounding: canonical "rebrand = add/swap one profile + drop in a logo; no component edits".

### US-1.3 - Ready-made ELS911 profile
As an operator admin, I want ELS911 to ship as a ready-made brand profile, so that the
flagship operator deployment is available out of the box.
Notes/grounding: canonical ELS911 palette (red #B22234 / navy #002868) ported from v1 tokens.css.

### US-1.4 - Token-only component theming
As a platform engineer, I want every component to reference brand tokens and never
hard-code a brand color, so that a brand swap propagates everywhere with zero component edits.
Notes/grounding: canonical "no hard-coded brand colors anywhere in components".

### US-1.5 - Brand continuity with marketing site
As an operator admin, I want the logged-in product brand to match the marketing site, so
that clients do not experience a jarring brand break at sign-in.
Notes/grounding: research 04 pitfall "brand discontinuity between marketing site and logged-in product".

---

## E2 - Identity, Roles & Access

### US-2.1 - Email/password login
As a client reviewer, I want to log in with my email and password over a JWT session, so
that I can securely reach the work scoped to my org.
Notes/grounding: canonical auth = JWT (HS256, Web Crypto), ported from v1.

### US-2.2 - Role-based access control
As an operator admin, I want admin, staff, and client roles enforced on every route and
action, so that users only see and do what their role permits.
Notes/grounding: canonical RBAC admin/staff/client, org-scoped.

### US-2.3 - Org-scoped data isolation
As a client reviewer, I want my access scoped to my own org's data, so that I never see
another tenant's facilities or maps.
Notes/grounding: research 04 "tenant hierarchy shapes data isolation and auth scoping".

### US-2.4 - Audit-logged authentication events
As a compliance officer, I want logins, logouts, and access denials recorded in the audit
log, so that I can demonstrate an auditable access trail during procurement.
Notes/grounding: compliance brief "immutable exportable audit logs (who viewed/edited/exported, when)".

### US-2.5 - Forward-looking MFA/SSO
As an operator admin, I want the identity layer designed so MFA and SSO can be added later,
so that we can meet stricter tenant security requirements without re-architecting auth.
Notes/grounding: canonical "MFA/SSO forward-looking"; compliance brief expected controls.

---

## E3 - Org Hierarchy & Dashboards

### US-3.1 - Navigate the org hierarchy
As a staff member, I want to navigate Org -> District -> Facility -> Building, so that I
can drill from a customer down to a specific structure.
Notes/grounding: canonical hierarchy; research 04 "cap nesting at three levels".

### US-3.2 - Breadcrumb switcher dropdowns
As a client reviewer, I want each breadcrumb segment to double as a dropdown of its
siblings, so that I can jump between buildings without backing all the way out.
Notes/grounding: research 04 standout pattern "breadcrumb segments double as dropdown switchers".

### US-3.3 - Roll-up dashboards
As an operator admin, I want each hierarchy level to show a roll-up dashboard of the levels
beneath it, so that I can see facility and project status at a glance from the top.
Notes/grounding: canonical "roll-up dashboards"; research 04 "clear project-progress visibility".

### US-3.4 - Designed empty states
As a client reviewer, I want an empty facility to show a sample preview and one clear first
action, so that I understand what a finished deployment looks like.
Notes/grounding: research 04 "empty states are a high-leverage onboarding moment".

### US-3.5 - Favorites and saved views
As a staff member, I want to star facilities and buildings I work on often, so that I can
reach them quickly without re-traversing the hierarchy.
Notes/grounding: research 04 "saved views/favorites (manual starring), progressive disclosure".

---

## E4 - Project & Review Workflow

### US-4.1 - Create a project under a building
As a staff member, I want to create a project tied to a specific building with members and
a status, so that work is tracked against the right structure.
Notes/grounding: canonical `projects.building_id` FK; "projects, status, progress, members".

### US-4.2 - Track project progress and status
As a client reviewer, I want to see each project's status and progress, so that I know
where my deliverable stands without emailing the operator.
Notes/grounding: research 04 "clients expect clear project-progress visibility".

### US-4.3 - Version review loop
As a staff member, I want to upload V1, have the client notified, collect their annotations,
revise, and publish V2, so that revisions follow a clear, repeatable loop.
Notes/grounding: research 04 version loop "staff uploads V1 -> client notified -> client annotates -> staff revises -> V2 -> approval".

### US-4.4 - Record an approval
As a client reviewer, I want to approve a specific version and have that approval logged,
so that sign-off is explicit and auditable.
Notes/grounding: research 04 "role-based approvals; logged auditable review trail".

### US-4.5 - Manage project membership
As an operator admin, I want to add and remove members on a project, so that only the right
staff and client users can act on it.
Notes/grounding: canonical `project_members`; RBAC org-scoped.

---

## E5 - 2D Floorplan Annotation Engine

### US-5.1 - View a floorplan PDF
As a staff member, I want to open a floorplan PDF in the in-portal viewer, so that I can
inspect and mark it up without leaving the platform.
Notes/grounding: canonical ported 2D engine PDF.js + canvas (v1 viewer.js ~196KB).

### US-5.2 - Use the annotation tools
As a staff member, I want the 12+ ported annotation tools (rectangle, freehand, text,
arrows, measurements), so that I can mark up floorplans with the proven v1 toolset.
Notes/grounding: canonical "12+ annotation tools" ported from v1 viewer.js.

### US-5.3 - Persist annotations as JSON
As a staff member, I want my annotations saved and reloaded exactly as drawn, so that work
survives reloads and is portable.
Notes/grounding: canonical E5 "JSON export"; v1 `annotations` table retained.

### US-5.4 - Layered per-audience annotations
As a client reviewer, I want to toggle annotation layers by audience (responder / staff /
facilities), so that each viewer sees only the relevant markings.
Notes/grounding: competitive brief "layered map model with per-audience toggles".

### US-5.5 - Client annotation in the review loop
As a client reviewer, I want to annotate the staff's draft directly, so that my feedback
lands on the exact spot I mean.
Notes/grounding: research 04 example story "comment on a specific room before sign-off".

---

## E6 - Safety Mapping & NFPA Export

### US-6.1 - Place NFPA 170 markers
As a staff member, I want to place safety markers (AED, exits, extinguishers, shutoffs)
from the NFPA 170 catalog, so that map semantics are standardized and not freehand.
Notes/grounding: compliance brief "locked symbol semantics (place from catalog, not freehand)".

### US-6.2 - Auto-generated NFPA legend
As a staff member, I want the legend to auto-generate as a vertical list with hallway
chips, so that every exported map carries a standardized, readable key.
Notes/grounding: memory `feedback_els911_legend_autofit`; compliance brief auto-generated legend.

### US-6.3 - North-locked printable map render
As a first responder, I want maps that are north-oriented, gridded, and printable, so that
a hard copy survives a network outage during an incident.
Notes/grounding: competitive brief "north-oriented, printable maps; hard copies must survive a network outage".

### US-6.4 - Batch multi-page PDF export
As a staff member, I want to queue a batch export of all building maps into a correctly
ordered multi-page PDF, so that I can hand off a complete map packet in one job.
Notes/grounding: canonical `export_jobs`; canonical "batch PDF export; multi-page print ordering".

### US-6.5 - Z-axis floor labels
As a compliance officer, I want every map and marker tagged with its z-axis floor label,
so that the data carries dispatchable-location floor context for NG911.
Notes/grounding: compliance brief NENA-REQ-003 dispatchable location; `compliance_meta` z-axis labels.

### US-6.6 - Marker placement fidelity
As a staff member, I want markers to render exactly where I place them with no jitter or
drift, so that the exported map is spatially trustworthy.
Notes/grounding: canonical "marker placement, jitter, print order" battle-tested v1 logic.

---

## E7 - Unified Scan Library & Media

### US-7.1 - Unified media asset library
As a staff member, I want one library holding floorplan PDFs, point clouds, splats,
walkthrough videos, and reference images per facility, so that all scan media lives in one place.
Notes/grounding: canonical `media_assets` types; supersedes flat `documents.doc_type`.

### US-7.2 - Large multipart upload
As a staff member, I want to upload large scan files via resumable R2 multipart upload, so
that a multi-hundred-MB asset uploads reliably without timing out.
Notes/grounding: canonical R2 multipart upload (`DOCUMENTS` binding); sprint S4.

### US-7.3 - Asset versioning
As a staff member, I want each asset to carry a version with capture date and surveyor, so
that I can track which scan is current after a renovation.
Notes/grounding: canonical `media_assets.version`, `capture_date`, `surveyor`; competitive field-verification workflow.

### US-7.4 - Point-cloud cold archive
As an operator admin, I want master PLY point clouds archived to a cold R2 tier and never
served to clients, so that we keep raw data without paying hot egress or shipping huge PLYs.
Notes/grounding: canonical "master PLY archived cold in R2, never served"; 3D brief "do not ship PLY to clients".

### US-7.5 - SPZ delivery format
As a first responder, I want scans delivered as compact SPZ, so that a scene loads fast on
a field device instead of failing on a giant PLY.
Notes/grounding: 3D brief "deliver SPZ" (~90% smaller, 500K scene ~11.8MB / ~1.1s load).

---

## E8 - 3D Scan Viewer

### US-8.1 - MP4 walkthrough player
As a first responder, I want to watch the mp4 walkthrough of a facility, so that I get
zero-friction orientation on any device before entry.
Notes/grounding: 3D brief priority 1 "MP4 walkthrough player ... ship first".

### US-8.2 - Interactive splat viewer
As a first responder, I want to explore the Spark splat scene with orbit, fly, and walk
camera modes, so that I can virtually walk a building I have never entered.
Notes/grounding: canonical Spark (THREE.js, WebGL2); 3D brief camera modes.

### US-8.3 - 3D measurement tool
As a staff member, I want to measure point-to-point distances and room dimensions in the
scan, so that I can support staging and apparatus placement.
Notes/grounding: 3D brief priority 3 measurement via Spark raycast-into-splat (differentiator).

### US-8.4 - Anchored 3D markers
As a staff member, I want to drop markers (exits, hazards, shutoffs, AED) anchored in the
3D scene with a title, description, and saved viewpoint, so that key points are pinned in space.
Notes/grounding: canonical `scan_markers_3d`; 3D brief cap ~25/scene.

### US-8.5 - Floor switching
As a first responder, I want to switch between per-floor scans, so that I can move through
a multi-story school floor by floor.
Notes/grounding: 3D brief priority 6 floor/level switching (essential for multi-story).

### US-8.6 - Named viewpoints
As a staff member, I want to save named camera viewpoints, so that I can build a guided
key-points tour of a scene.
Notes/grounding: canonical `viewpoints`; 3D brief priority 5 named bookmarks.

### US-8.7 - Scan version compare
As a client reviewer, I want to compare scan versions by capture date, so that I can see
what changed after a renovation.
Notes/grounding: 3D brief priority 8 scan-version comparison.

---

## E9 - Collaboration

### US-9.1 - Anchored comment threads
As a client reviewer, I want to start a comment thread anchored to a specific map region or
3D marker, so that staff know exactly what I am referring to.
Notes/grounding: research 04 "inline comment threads anchored to a specific region, with nested replies".

### US-9.2 - Resolve workflow
As a staff member, I want to resolve a thread so it hides without deleting, so that handled
feedback clears the view while the audit trail is preserved.
Notes/grounding: research 04 "hide resolved comments, do not delete (preserves audit trail)".

### US-9.3 - @-mentions with deep-link email
As a client reviewer, I want to @-mention a staff member and have them emailed a deep link,
so that the right person is pulled straight to the comment.
Notes/grounding: research 04 "@-mentions triggering targeted email notifications with a deep link".

### US-9.4 - Batched activity notifications
As a staff member, I want my notifications batched into a digest, so that an active project
does not flood my inbox.
Notes/grounding: research 04 "batching to avoid notification fatigue"; pitfall "ungoverned notification volume".

### US-9.5 - External share links
As an operator admin, I want to generate a scoped share link for a stakeholder outside the
portal, so that I can share a map or scan without provisioning an account.
Notes/grounding: research 04 "export/share links for stakeholders outside the portal".

---

## E10 - Global Search

### US-10.1 - Search across all entity types
As a staff member, I want one search box covering facilities, buildings, projects,
documents, and marker labels, so that I can find anything by typing instead of navigating.
Notes/grounding: canonical FTS5 across facilities/buildings/projects/documents/markers.

### US-10.2 - Org-scoped search results
As a client reviewer, I want search results limited to my own org, so that I never see
another tenant's entities in results.
Notes/grounding: canonical org-scoped; research 04 data isolation.

### US-10.3 - Search-centric navigation for large lists
As a staff member, I want search to be a primary way to reach a facility, so that large
flat lists do not force me to browse the whole hierarchy.
Notes/grounding: research 04 "lean on search-centric navigation for large flat lists".

---

## E11 - Compliance & Trust

### US-11.1 - NG911/NENA GeoJSON export
As a compliance officer, I want to export facility data as GeoJSON aligned to the NENA
STA-006 schema, so that the data is usable by NG911 PSAP systems.
Notes/grounding: compliance brief "export in NENA-aligned GIS formats (GeoJSON to STA-006 schema)".

### US-11.2 - Compliance metadata per facility
As a compliance officer, I want per-facility fields for last-reviewed date, last responder
tour, mandate flags, and drill links, so that I can demonstrate current, mandated mapping.
Notes/grounding: canonical `compliance_meta`; compliance brief Alyssa's/Kari's/HB3 metadata.

### US-11.3 - Immutable, exportable audit log
As a compliance officer, I want an immutable audit log of who viewed, edited, and exported
which map and when, exportable on demand, so that I can satisfy a security review.
Notes/grounding: compliance brief immutable exportable audit logs; canonical `audit_log`.

### US-11.4 - Public trust page
As an operator admin, I want a trust page stating our application-level controls and
posture (FERPA/DPA, encryption, SOC 2 path), so that procurement is not disqualified for its absence.
Notes/grounding: research 04 "a dedicated security/trust page is table stakes ... absence is a procurement disqualifier".

### US-11.5 - Re-verification reminders
As a compliance officer, I want reminders when a facility's last-reviewed date goes stale,
so that maps stay accurate and current as the mandate requires.
Notes/grounding: compliance brief "re-verification reminders"; Alyssa's Law mapping mandate.

---

## E12 - Accessibility

### US-12.1 - Full keyboard navigation
As a client reviewer who does not use a mouse, I want to operate the portal entirely by
keyboard, so that I can review and approve work without a pointing device.
Notes/grounding: compliance brief WCAG 2.1 AA, keyboard-navigable controls.

### US-12.2 - Screen-reader labels
As a client reviewer using a screen reader, I want every control and map symbol to have a
descriptive label, so that I can understand the interface and the map non-visually.
Notes/grounding: compliance brief "screen-reader labels on symbols and exports".

### US-12.3 - Non-visual map alternative
As a first responder using assistive tech, I want a text list of rooms, exits, and markers
as an alternative to the visual map, so that the map's information is available non-visually.
Notes/grounding: compliance brief "accessible non-visual map alternatives (text room/exit lists)".

### US-12.4 - Contrast and VPAT posture
As a compliance officer, I want the UI to meet WCAG 2.1 AA contrast and a maintained VPAT
to be available, so that we clear ADA Title II and Section 508 procurement gates.
Notes/grounding: compliance brief WCAG 2.1 AA min / 2.2 forward; VPAT/ACR; ADA Title II April 24 2026.

---

## E13 - Admin & Platform Ops

### US-13.1 - User management
As an operator admin, I want to create, edit, deactivate, and assign roles to users, so
that I control who has access across the deployment.
Notes/grounding: canonical E13 "user mgmt"; RBAC.

### US-13.2 - API key management
As an operator admin, I want to issue, scope, and revoke API keys, so that integrations can
authenticate without a user session and I can cut off a leaked key.
Notes/grounding: canonical API keys; `api_keys` table; competitive "open API / export".

### US-13.3 - Audit log viewer
As a compliance officer, I want an in-portal viewer to filter and review audit log entries,
so that I can investigate access without exporting raw data first.
Notes/grounding: canonical E13 "audit viewer"; `audit_log`.

### US-13.4 - Platform settings
As an operator admin, I want a settings area for deployment-wide configuration, so that I
can adjust platform behavior without a code change.
Notes/grounding: canonical E13 "settings".

### US-13.5 - Observability
As a platform engineer, I want platform observability (logs, errors, key metrics), so that
I can detect and diagnose issues in the running deployment.
Notes/grounding: canonical E13 "observability".

---

## E14 - Quality & Delivery Harness

### US-14.1 - Failing test before implementation
As a platform engineer, I want each acceptance criterion expressed as a failing test before
code is written, so that the implementation is driven by the AC it satisfies.
Notes/grounding: canonical TDD; AC -> Test `T-<AC>` traceability.

### US-14.2 - Engine unit tests
As a platform engineer, I want each ported engine (2D annotation, NFPA export) to have its
own Vitest unit tests as it is extracted, so that the battle-tested v1 logic is locked down.
Notes/grounding: canonical "each engine gets its own unit tests as it is extracted".

### US-14.3 - Playwright screenshot assertions
As a platform engineer, I want Playwright to capture and compare screenshots of
UI-visible outcomes, so that visual regressions are caught automatically.
Notes/grounding: canonical E14 "Vitest + Playwright screenshots".

### US-14.4 - CI on every change
As a platform engineer, I want the full test suite to run in CI on every change, so that no
regression merges unnoticed.
Notes/grounding: canonical E14 "CI".

### US-14.5 - Deploy to isolated CF test project
As a platform engineer, I want deploys to go to the `pathfinder` Pages project via
`wrangler pages deploy`, so that testing never touches els911-portal production.
Notes/grounding: canonical deploy direct; test project `pathfinder.pages.dev` isolated; memory CF direct-deploy.

---

## Story index

| ID | Title | Epic | Priority (MoSCoW) |
|---|---|---|---|
| US-1.1 | Default Pathfinder brand | E1 | Must |
| US-1.2 | Drop-in brand swap | E1 | Must |
| US-1.3 | Ready-made ELS911 profile | E1 | Must |
| US-1.4 | Token-only component theming | E1 | Must |
| US-1.5 | Brand continuity with marketing site | E1 | Should |
| US-2.1 | Email/password login | E2 | Must |
| US-2.2 | Role-based access control | E2 | Must |
| US-2.3 | Org-scoped data isolation | E2 | Must |
| US-2.4 | Audit-logged authentication events | E2 | Must |
| US-2.5 | Forward-looking MFA/SSO | E2 | Could |
| US-3.1 | Navigate the org hierarchy | E3 | Must |
| US-3.2 | Breadcrumb switcher dropdowns | E3 | Should |
| US-3.3 | Roll-up dashboards | E3 | Must |
| US-3.4 | Designed empty states | E3 | Should |
| US-3.5 | Favorites and saved views | E3 | Could |
| US-4.1 | Create a project under a building | E4 | Must |
| US-4.2 | Track project progress and status | E4 | Must |
| US-4.3 | Version review loop | E4 | Must |
| US-4.4 | Record an approval | E4 | Must |
| US-4.5 | Manage project membership | E4 | Should |
| US-5.1 | View a floorplan PDF | E5 | Must |
| US-5.2 | Use the annotation tools | E5 | Must |
| US-5.3 | Persist annotations as JSON | E5 | Must |
| US-5.4 | Layered per-audience annotations | E5 | Should |
| US-5.5 | Client annotation in the review loop | E5 | Should |
| US-6.1 | Place NFPA 170 markers | E6 | Must |
| US-6.2 | Auto-generated NFPA legend | E6 | Must |
| US-6.3 | North-locked printable map render | E6 | Must |
| US-6.4 | Batch multi-page PDF export | E6 | Must |
| US-6.5 | Z-axis floor labels | E6 | Should |
| US-6.6 | Marker placement fidelity | E6 | Must |
| US-7.1 | Unified media asset library | E7 | Must |
| US-7.2 | Large multipart upload | E7 | Must |
| US-7.3 | Asset versioning | E7 | Must |
| US-7.4 | Point-cloud cold archive | E7 | Should |
| US-7.5 | SPZ delivery format | E7 | Must |
| US-8.1 | MP4 walkthrough player | E8 | Must |
| US-8.2 | Interactive splat viewer | E8 | Must |
| US-8.3 | 3D measurement tool | E8 | Should |
| US-8.4 | Anchored 3D markers | E8 | Must |
| US-8.5 | Floor switching | E8 | Must |
| US-8.6 | Named viewpoints | E8 | Could |
| US-8.7 | Scan version compare | E8 | Could |
| US-9.1 | Anchored comment threads | E9 | Must |
| US-9.2 | Resolve workflow | E9 | Must |
| US-9.3 | @-mentions with deep-link email | E9 | Must |
| US-9.4 | Batched activity notifications | E9 | Should |
| US-9.5 | External share links | E9 | Should |
| US-10.1 | Search across all entity types | E10 | Must |
| US-10.2 | Org-scoped search results | E10 | Must |
| US-10.3 | Search-centric navigation for large lists | E10 | Should |
| US-11.1 | NG911/NENA GeoJSON export | E11 | Must |
| US-11.2 | Compliance metadata per facility | E11 | Must |
| US-11.3 | Immutable, exportable audit log | E11 | Must |
| US-11.4 | Public trust page | E11 | Should |
| US-11.5 | Re-verification reminders | E11 | Could |
| US-12.1 | Full keyboard navigation | E12 | Must |
| US-12.2 | Screen-reader labels | E12 | Must |
| US-12.3 | Non-visual map alternative | E12 | Should |
| US-12.4 | Contrast and VPAT posture | E12 | Must |
| US-13.1 | User management | E13 | Must |
| US-13.2 | API key management | E13 | Must |
| US-13.3 | Audit log viewer | E13 | Should |
| US-13.4 | Platform settings | E13 | Should |
| US-13.5 | Observability | E13 | Should |
| US-14.1 | Failing test before implementation | E14 | Must |
| US-14.2 | Engine unit tests | E14 | Must |
| US-14.3 | Playwright screenshot assertions | E14 | Must |
| US-14.4 | CI on every change | E14 | Must |
| US-14.5 | Deploy to isolated CF test project | E14 | Must |

Total: 70 stories across 14 epics.
