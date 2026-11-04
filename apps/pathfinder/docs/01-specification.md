# Pathfinder Portal - Product and Technical Specification

| Field | Value |
|---|---|
| Document | Pathfinder Portal v2 - Product and Technical Specification |
| Status | Draft for review |
| Version | 0.1 |
| Owner | Pathfinder LiDAR Solutions |
| Date | 2026-06-15 |
| Reviewers | TBD |
| Supersedes | ELS911 Client Portal (v1) |
| Related | docs/00-canonical-context.md; docs/research/01-04 |

---

## 2. Executive summary

Pathfinder Portal is a white-label web platform for emergency floorplan mapping and 3D facility documentation, built and owned by Pathfinder LiDAR Solutions. It lets an operator (Pathfinder itself, the ELS911 flagship deployment, or a future reseller) serve many client organizations (school districts, 911 centers, universities, government agencies, hospitals) from one branded deployment. Each client organization manages its facilities and buildings, reviews 2D floorplans with field-verified safety markers, exports NFPA 170-compliant printable maps, and walks through true 3D digital twins of its buildings in the browser.

The market gap Pathfinder targets is specific (see research/01): incumbents such as CRG and Navigate360 treat verified 2D plans plus 360-degree photos as the core artifact, and almost none make a measurable spatial 3D digital twin the primary deliverable. Pathfinder inverts that. The 3D scan is first-class, it links directly to 2D markers and NFPA exports, and it integrates with (rather than competes against) the alerting and PSAP layer owned by RapidSOS, Rave, and others. Regulatory tailwinds (Alyssa's Law mapping mandates, Florida tri-annual responder tours, NENA z-axis requirements) pull demand toward exactly this combination of current 2D maps plus 3D documentation (see research/02, research/03).

v2 is a SvelteKit rewrite of the application shell that ports v1's proven imperative engines rather than rewriting them. v1 (the existing ELS911 portal, vanilla HTML/CSS/JS on Cloudflare Pages) has battle-tested canvas annotation, marker placement, and NFPA print logic; v2 modernizes structure (auth, routing, dashboards, org hierarchy, search, collaboration, the new 3D viewer) without re-litigating logic that already works. The product is organized into fourteen epics (E1-E14) delivered across eight sprints (S0-S7). A VP or PM can stop reading after this summary and section 8 (high-level architecture) and understand the product and its shape.

---

## 3. Background and problem statement

### 3.1 v1 lineage

v1 is the ELS911 Client Portal: a secure PDF review portal where ELS911 staff and their school-district clients collaborate on 2D floorplan reviews with real-time annotations. It runs entirely on Cloudflare (Pages, Pages Functions, D1, R2, KV), uses JWT plus API-key auth (HS256 via Web Crypto, PBKDF2-SHA256 password hashing), and ships a 12-tool PDF.js plus canvas annotation engine (`public/js/viewer.js`, ~196 KB / 4,500+ lines) plus a jsPDF-based NFPA-style map export. Its data model covers users, projects, project members, documents, annotations, annotation comments, project notes, map markers, map crops, API keys, an activity log, and an audit log. It is proven in production and the engines are correct under stress.

### 3.2 Why a rewrite of the shell

v1's shell carries vanilla-JS friction: hand-rolled routing and page guards, demo-mode fallbacks woven through the API client, a single catch-all `functions/api/[[route]].js`, and no test harness. As Pathfinder generalizes from one operator (ELS911) to a white-label platform with a deep org hierarchy, unified media, 3D, search, and collaboration, the shell needs typed server routes, a real component model, a brand layer, and a TDD harness. The de-risking principle (canonical sec 2) is to rewrite the shell and port the engines: the 2D annotation engine, the map/NFPA export engine, and the new 3D splat viewer are framework-agnostic TypeScript modules mounted in thin Svelte wrappers, each with its own unit tests.

### 3.3 The market gap

Incumbents are heavy emergency-management platforms; Pathfinder is the sharp map shop (see research/01). The wedge is a focused best-in-class floorplan-plus-scan-plus-NFPA-export portal whose 3D digital twin is the primary artifact and which integrates with the alerting and PSAP layer rather than replacing it. The dual-use ROI story (one scan serves safety documentation and enrollment, facilities, and insurance) is a budget-justification angle incumbents do not lead with.

---

## 4. Goals and non-goals

### 4.1 Goals

- G1. Make the 3D digital twin a first-class, browser-viewable artifact linked to 2D maps and NFPA exports.
- G2. Generalize the single-operator v1 into a white-label, multi-tenant platform (operator brand over many client orgs).
- G3. Preserve v1's proven 2D annotation and NFPA 170 export behavior verbatim by porting, not rewriting, the engines.
- G4. Meet the compliance bar that gov and edu procurement demands: FERPA posture, NENA/NG911 export, WCAG 2.1 AA, immutable audit logs.
- G5. Ship a TDD-backed, deployable product with a CI screenshot harness covering every acceptance criterion.

### 4.2 Non-goals

- NG1. Pathfinder does NOT build panic-alarm hardware or silent-alarm devices. It documents and maps; the panic-alarm and mass-notification layer stays with partners.
- NG2. Pathfinder is NOT a mass-notification platform. It will not send emergency broadcasts to endpoints.
- NG3. Pathfinder does NOT operate as a PSAP or CAD system. NENA/NG911 work is export and integration posture (GeoJSON to STA-006, z-axis labels), not call routing.
- NG4. v2 does NOT re-implement v1's canvas or print math from scratch; ground-up rewrites of working engines are out of scope.
- NG5. SIS integration, drill logging, and EOP authoring are adjacent expectations (research/01) but are out of scope for v2; integration posture is provided instead.

---

## 5. Personas

| Persona | Role | Needs |
|---|---|---|
| Operator admin | Pathfinder LiDAR or ELS911 platform operator | Manage users, brands, API keys; view audit log; observe platform health; onboard client orgs (E13) |
| Operator staff | Surveyor / map technician | Upload scans and floorplans, place markers, run NFPA exports, drive review loop with clients (E4, E5, E6, E7) |
| District safety director (client) | Customer org reviewer/approver | Review maps, annotate, comment, approve versions, browse the org hierarchy and dashboards, export current maps (E3, E4, E9) |
| First responder (read-only) | Fire / law / EMS familiarization | Walk the 3D twin and mp4, read room labels and markers, no edit rights, free access (E8, E12) |

---

## 6. Functional requirements

Each requirement is one testable line, grouped by canonical epic. IDs are stable.

### E1 White-Label Brand Layer

- FR-1. The system SHALL resolve a single active brand profile (`brand/<id>/brand.config.ts` plus assets) at load and expose its tokens as CSS custom properties.
- FR-2. The system SHALL ship Pathfinder LiDAR as the default brand and ELS911 as a ready-made profile selectable via `BRAND` env at build time.
- FR-3. No component SHALL hard-code a brand color, name, logo, or contact detail; all SHALL reference brand tokens or fields.
- FR-4. Adding a new operator brand SHALL require only a new profile plus logo/favicon assets, with zero component edits.
- FR-5. The system SHALL support forward-looking per-hostname runtime brand resolution (a domain maps to a brand profile).

### E2 Identity, Roles and Access

- FR-6. The system SHALL authenticate users via JWT (HS256, Web Crypto) and accept API keys (SHA-256 hashed) on every request.
- FR-7. The system SHALL enforce admin/staff/client RBAC server-side on every mutation and read.
- FR-8. Client users SHALL only access orgs, facilities, buildings, and projects they are scoped to.
- FR-9. Passwords SHALL be hashed with PBKDF2-SHA256 (>= 100,000 iterations) with per-user salt.
- FR-10. The system SHALL provide forward-looking hooks for MFA and SSO without requiring them in v2.

### E3 Org Hierarchy and Dashboards

- FR-11. The system SHALL model Org -> District -> Facility -> Building, with `projects.building_id` linking projects to buildings.
- FR-12. The system SHALL render location-based breadcrumbs that mirror the hierarchy, capped at three visible nesting levels.
- FR-13. Each breadcrumb segment SHALL double as a dropdown switcher to sibling nodes.
- FR-14. The system SHALL render roll-up dashboards at org, district, facility, and building scope.
- FR-15. Navigation SHALL provide search-centric entry and saved/favorited views for large flat lists.

### E4 Project and Review Workflow

- FR-16. Staff SHALL create projects with status (pending/in_review/approved/completed/archived) and progress (0-100).
- FR-17. The system SHALL support a version review loop: staff uploads Vn, client is notified, client annotates, staff revises to Vn+1, approval is recorded.
- FR-18. The system SHALL record project membership with project-scoped roles (admin/reviewer/viewer).
- FR-19. Approvals SHALL be logged to the activity log against the reviewed version.

### E5 2D Floorplan Annotation Engine (ported)

- FR-20. The system SHALL render multi-page PDF floorplans via pinned PDF.js with zoom, pan, and page navigation.
- FR-21. The ported canvas engine SHALL provide the 12 v1 annotation tools: circle, rect, arrow, freehand, comment, correction, AED, stairs, door, overhead, exit, fire extinguisher.
- FR-22. Annotation geometry SHALL be stored as normalized coordinates [0,1] relative to page dimensions.
- FR-23. The system SHALL support undo/redo, autosave, batch save, and the v1 keyboard shortcut set.
- FR-24. The system SHALL export all annotations as structured JSON (schema 1.0, page-grouped).

### E6 Safety Mapping and NFPA Export

- FR-25. The system SHALL maintain a persistent map-marker layer (stairs, hallway, door, elevator) separate from review annotations, with labels and hallway polygons.
- FR-26. The system SHALL place markers from an NFPA 170-compliant symbol catalog with locked semantics (no freehand symbol invention).
- FR-27. The map export SHALL generate north-locked, printable PDFs with an auto-fit vertical-list legend (one row per marker type, instance chips per row).
- FR-28. Markers SHALL render at their placed positions with no separation, alignment, or leader lines; small icon sizing keeps natural clustering legible.
- FR-29. The system SHALL support per-page floor labels and a print-order field for multi-page batch export.
- FR-30. The system SHALL queue and track batch PDF map export jobs across a building's pages/floors.
- FR-31. The system SHALL export NENA-aligned GeoJSON (STA-006 schema) with z-axis floor labels and a confidence/uncertainty field per point.

### E7 Unified Scan Library and Media

- FR-32. The system SHALL store all media in a unified `media_assets` model typed as floorplan_pdf, point_cloud, splat, walkthrough_video, or reference_image.
- FR-33. Each media asset SHALL carry version, R2 key, storage tier (hot/cold), capture date, and surveyor.
- FR-34. The system SHALL upload large files to R2 via multipart upload with resumability.
- FR-35. Master point-cloud PLY archives SHALL be stored in a cold R2 prefix and never served to clients.

### E8 3D Scan Viewer

- FR-36. The system SHALL play the Trion-exported mp4 walkthrough as a zero-friction baseline viewer.
- FR-37. The system SHALL render SPZ splat scenes via Spark (THREE.js, WebGL2) with orbit, fly, and walk camera modes.
- FR-38. The system SHALL provide point-to-point distance and room-dimension measurement using raycast-into-splat.
- FR-39. The system SHALL support 3D-anchored markers (position, normal, type, label, description, saved viewpoint), capped at ~25 per scene by default.
- FR-40. The system SHALL support named viewpoint bookmarks (position, target, FOV) with smooth transitions.
- FR-41. The system SHALL support per-floor scan switching for multi-story buildings.
- FR-42. The system SHALL support screenshot export and scan-version comparison by capture date.

### E9 Collaboration

- FR-43. The system SHALL support comment threads anchored to a 2D map region or a 3D scene point, with nested replies.
- FR-44. The system SHALL provide a resolve workflow that hides (never deletes) resolved threads to preserve the audit trail.
- FR-45. The system SHALL support @-mentions that trigger a targeted email notification carrying a deep link.
- FR-46. The system SHALL maintain a per-project activity feed for thread participants.
- FR-47. Email notifications SHALL be batched to avoid notification fatigue.
- FR-48. The system SHALL generate scoped share links for stakeholders outside the portal.

### E10 Global Search

- FR-49. The system SHALL provide global full-text search via D1 FTS5 across facilities, buildings, projects, documents, and marker labels.
- FR-50. Search results SHALL be RBAC-filtered to the requester's scope.

### E11 Compliance and Trust

- FR-51. The system SHALL maintain per-facility compliance metadata (last-reviewed date, last responder tour, mandate flags, drill links, z-axis floor labels).
- FR-52. The system SHALL write immutable audit-log entries for view, edit, and export of maps and media.
- FR-53. The system SHALL surface a trust page stating application-level controls and certification posture.

### E12 Accessibility

- FR-54. The system SHALL meet WCAG 2.1 AA (2.2 AA forward-looking) including keyboard navigation and screen-reader labels on symbols and exports.
- FR-55. The system SHALL provide non-visual map alternatives (text room/exit lists keyed to markers).

### E13 Admin and Platform Ops

- FR-56. Operator admins SHALL manage users, API keys, brands, and settings, and view the audit log.
- FR-57. The system SHALL expose observability (request logs, error rates, export job status).

### E14 Quality and Delivery Harness

- FR-58. Every acceptance criterion SHALL be proven by a failing-first test (T-<AC>) under TDD.
- FR-59. The Playwright E2E suite SHALL capture a screenshot at every acceptance criterion and run in CI before deploy to the Pathfinder test project.

---

## 7. Non-functional requirements

- NFR-1. Performance: an interactive page SHALL reach first interaction within 2.5 s on a mid-tier field laptop over 4G.
- NFR-2. Splat load budget: a ~500K-Gaussian SPZ scene SHALL load and first-paint in <= ~1.5 s; a typical scene targets 15-30 MB SPZ (see research/03).
- NFR-3. File-size limits: served splats SHALL be SPZ only; raw PLY SHALL never be served to clients (PLY fails above ~200 MB on iPhone Safari, research/03). mp4 walkthroughs target 20-100 MB. A 5-scan school stays under ~250 MB hot storage.
- NFR-4. Security: TLS 1.2+ in transit, AES-256 at rest, RBAC enforced server-side, API keys and passwords stored only as hashes.
- NFR-5. Accessibility: WCAG 2.1 AA minimum across all interactive pages and exported PDFs; a maintained VPAT/ACR.
- NFR-6. Availability: target 99.9% monthly, riding Cloudflare's global edge; no single-region dependency.
- NFR-7. Data residency: U.S. data residency option for client data and media.
- NFR-8. Auditability: audit-log entries SHALL be append-only and exportable.
- NFR-9. Portability of brand: a rebrand SHALL require zero component edits (one profile plus assets).
- NFR-10. Repo hygiene: the public repo SHALL never contain secrets or client data; CF Pages commit messages SHALL be ASCII-only to keep deploys safe.

---

## 8. High-level architecture

Pathfinder is a SvelteKit (Svelte 5) application built with `@sveltejs/adapter-cloudflare` and deployed to Cloudflare Pages plus Functions. SvelteKit `+server.ts` server routes replace v1's single `functions/api/[[route]].js` catch-all. State lives in Cloudflare D1 (binding `DB`), files in R2 (binding `DOCUMENTS`), and sessions/cache in KV (binding `CACHE`). Search rides D1 FTS5 virtual tables. Three engines do the heavy lifting: the ported 2D annotation engine (PDF.js plus canvas), the ported map/NFPA export engine (jsPDF), and the new 3D splat viewer (Spark on THREE.js / WebGL2). Each is a framework-agnostic TypeScript module wrapped in a thin Svelte component.

```
                        Browser (client devices, field laptops, responder tablets)
   +-----------------------------------------------------------------------------+
   |  SvelteKit app shell (Svelte 5)                                             |
   |   - brand layer: tokens -> CSS custom properties                            |
   |   - routing, auth guards, org-hierarchy nav, dashboards, search UI          |
   |                                                                             |
   |   thin Svelte wrappers mounting ported/new TS engines:                      |
   |     [2D annotation engine]  [map/NFPA export]   [3D splat viewer (Spark)]   |
   |          PDF.js + canvas        jsPDF              THREE.js / WebGL2         |
   +-----------------------------------------------------------------------------+
                       |  HTTPS (TLS 1.2+), JWT / API key
                       v
   +-----------------------------------------------------------------------------+
   |  Cloudflare Pages + Functions  (SvelteKit +server.ts routes)                |
   |    auth | hierarchy | projects | media | annotations | markers | export     |
   |    3d (scans/markers/viewpoints) | search | comments | admin | audit        |
   +-----------------------------------------------------------------------------+
        |                         |                          |
        v                         v                          v
   +---------+            +----------------+          +----------------+
   | D1 (DB) |            | R2 (DOCUMENTS) |          | KV (CACHE)     |
   | SQLite  |            | hot: SPZ, mp4, |          | sessions,      |
   | + FTS5  |            | PDF, images    |          | rate limits,   |
   |         |            | cold: master   |          | brand cache    |
   |         |            | PLY archive    |          |                |
   +---------+            +----------------+          +----------------+

   Offline pipeline (operator-side, not in the request path):
     Trion P1 scanner -> Trion Model (3DGS + mp4) -> SplatTransform CLI (PLY->SPZ)
       -> upload SPZ (hot) + mp4 (hot) + master PLY (cold) into R2

   Integration posture (out of band): NENA STA-006 GeoJSON export -> NG911 / PSAP;
     no panic-alarm or notification ownership (see non-goals).
```

---

## 9. Detailed design

### 9.1 White-label brand layer (E1)

A single brand profile is the source of truth: `brand/<id>/brand.config.ts` plus logo, logoMark, and favicon assets. Profile fields are `productName`, `operatorName`, `operatorLegalName`, `logo`, `logoMark`, `favicon`, color tokens (`--brand-primary`, `--brand-secondary`, `--brand-accent`, neutrals), typography, `supportEmail`, `supportPhone`, `legalFooter`, and `domains`. At load the active profile's tokens are written to CSS custom properties on the document root; components reference tokens only, never literal brand colors (FR-3). The default brand is Pathfinder LiDAR (dark slate `#0a131e`, void `#060b12`, navy `#1b3147`, a point-cloud ramp from far `#3e5366` to hot `#e6f2fb`, sky/steel/ice accents, squared 3px radius, restrained glow, Clash Display plus Satoshi plus JetBrains Mono). ELS911 ships as a ready-made profile (primary red `#B22234`, navy `#002868`, sky `#3B82F6`, gold `#C8960C`, from v1 `tokens.css`). Resolution is build-time via `BRAND=els911` env, with per-hostname runtime resolution as a forward-looking option (FR-5). Dropping in a new operator brand is one profile plus assets, zero component edits (FR-4).

### 9.2 Identity, roles and access (E2)

Auth is ported from v1: JWT signed HS256 via Web Crypto, plus API keys stored as SHA-256 hashes (full key shown once). Passwords use PBKDF2-SHA256 at >= 100,000 iterations with per-user salt. Three platform roles (admin, staff, client) are enforced server-side on every route. Client scope is enforced by joining requested resources to the requester's org/facility/building/project membership; a client may never read outside scope (FR-8). MFA and SSO are designed for as forward-looking additions (claim hooks and an auth-provider abstraction) without being required for v2.

### 9.3 Org hierarchy and navigation (E3)

The tenant hierarchy is the architectural backbone, not cosmetics (see research/04): it shapes data isolation, auth scoping, and navigation. The model is Org -> District -> Facility -> Building, with projects linked to a building via `projects.building_id`. A vertical sidebar is primary nav; location-based breadcrumbs mirror the hierarchy and are capped at three visible levels, with each segment doubling as a dropdown switcher to siblings (clicking a building name opens its sibling buildings). Roll-up dashboards aggregate project status, last-reviewed dates, and scan coverage at org, district, facility, and building scope. Large flat lists use search-centric entry and manual favoriting. Empty states show a sample facility and one clear first action (research/04).

### 9.4 2D annotation engine (ported) (E5)

The 2D engine is ported from v1 `viewer.js` (~196 KB) as a framework-agnostic TypeScript module mounted in a thin Svelte wrapper. PDF.js (pinned) renders pages to a canvas; an overlay canvas carries annotations. The 12 tools are unchanged: circle, rect, arrow, freehand, comment, correction, and the six safety markers (AED, stairs, door, overhead, exit, fire extinguisher). Geometry is stored as normalized coordinates `nx, ny, nw, nh` in [0,1]; freehand stores a JSON point array. The engine keeps v1's undo/redo stack, autosave, batch save, comment pins with sequential numbering, threaded annotation comments, image attachments (R2 keys), and the full keyboard shortcut set (S/C/R/A/F/T/X/E, 1-6, Space pan, arrows for pages, Ctrl+Z/Y/S, Delete, +/-). JSON export follows v1 schema 1.0 (page-grouped, normalized coordinates, author, resolved flag). The port is covered by its own unit tests as it is extracted (canonical sec 2).

### 9.5 Safety mapping and NFPA 170 export (ported) (E6)

A persistent map-marker layer (`map_markers`) is separate from review annotations and carries labeled location markers (stairs, hallway, door, elevator), hallway polygons (`points`), pinned and repositioned labels, and secondary label pins (`extra_labels`). Markers are placed from an NFPA 170-compliant symbol catalog with locked semantics (research/02): a user places from the catalog, never invents a symbol freehand. The export engine is the ported v1 jsPDF logic. It produces north-locked, printable PDFs with a vertical-list legend that is NFPA-style: one row per marker type, each row carrying instance chips (squares for point markers, colored pills for hallways), with per-item icons-per-row and row height computed so the legend auto-fits its content. Brand-themed style sets drive legend colors and headers (the export reads brand tokens). Markers render at their placed positions with no separation, alignment, or leader lines; small icon sizing keeps natural clustering legible (this matches the validated ELS911 legend/marker behavior). Per-page floor labels and a `print_order` field on `map_crops` drive multi-page ordering; `export_jobs` queues and tracks a building-wide batch export. NENA-aligned GeoJSON export (STA-006 schema) attaches z-axis floor labels and a confidence/uncertainty field per point (FR-31, research/02).

### 9.6 Unified scan library (E7)

`media_assets` supersedes v1's flat `documents.doc_type`. Each asset is typed (floorplan_pdf, point_cloud, splat, walkthrough_video, reference_image) and carries version, `r2_key`, `storage_tier`, `capture_date`, and `surveyor` (the field-verification metadata buyers expect, research/01). Large uploads go to R2 via multipart upload with resumability; the server mints upload URLs and confirms parts. Hot tier holds served SPZ, mp4, PDF, and images; the cold tier holds master PLY archives that are never served to clients (NFR-3). Budgeting per research/03: ~15-30 MB per SPZ scene, 20-100 MB per mp4, master PLY 100-300 MB cold.

### 9.7 3D scan viewer (E8)

The viewer ships in priority order (research/03). First, an mp4 walkthrough player (the Trion-exported video) as a zero-friction baseline every responder can use. Second, the interactive Spark splat viewer (THREE.js, WebGL2 chosen for 98%+ field-device support including iOS/Android) rendering SPZ, with orbit, fly, and walk camera modes; Spark fuses splats with regular meshes, which is required to draw markers and measurement geometry over the radiance field. Differentiating features: point-to-point and room-dimension measurement via raycast-into-splat (`scan_markers_3d` not needed for transient measures); 3D-anchored markers stored in `scan_markers_3d` (position, normal, type, label, description, saved viewpoint), capped at ~25/scene; named viewpoint bookmarks in `viewpoints` (position, target, FOV) with smooth transitions doubling as a guided tour; per-floor scan switching; screenshot export; and scan-version comparison by capture date. Pipeline (operator-side, offline): Trion P1 scanner -> Trion Model (3D Gaussian splatting plus mp4) -> PlayCanvas SplatTransform CLI (`splat-transform input.ply output.spz`) -> SPZ delivered hot, master PLY archived cold. If Trion Model does not export a 3DGS PLY, an E57->3DGS training step bridges the gap (research/03).

### 9.8 Collaboration (E9)

Comment threads are anchored to a specific 2D map region or a 3D scene point, with nested replies (research/04). A resolve action hides resolved threads but never deletes them, preserving the audit trail. @-mentions trigger a targeted email carrying a deep link to the anchored thread. A per-project activity feed tracks participant events; email notifications are batched to avoid fatigue. The review loop is modeled explicitly: staff uploads V1, the client is notified, the client annotates, staff revises to V2, and an approval is recorded against the version. Scoped share links let outside stakeholders view without an account.

### 9.9 Global search (E10)

A D1 FTS5 virtual table (`search_index`) indexes facilities, buildings, projects, documents, and marker labels. Queries are RBAC-filtered to the requester's scope before results are returned. Search is also the primary entry point for large flat lists in navigation (research/04).

### 9.10 Data model (v2 additions)

v1 tables are retained additively: `users`, `projects`, `project_members`, `documents`, `annotations`, `project_notes`, `annotation_comments`, `map_markers`, `map_crops`, `api_keys`, `activity_log`, `audit_log`. `projects` gains `building_id` (FK). New tables follow.

#### orgs

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| name | TEXT NOT NULL | client organization (tenant) |
| brand_id | TEXT | operator brand this org lives under |
| type | TEXT | school/911_center/university/government/healthcare/other |
| created_at | TEXT | default datetime('now') |

#### districts

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| org_id | TEXT FK -> orgs(id) | |
| name | TEXT NOT NULL | |
| created_at | TEXT | |

#### facilities

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| district_id | TEXT FK -> districts(id) | nullable for independent facilities |
| org_id | TEXT FK -> orgs(id) | |
| name | TEXT NOT NULL | |
| address | TEXT | used on map exports |
| zip | TEXT | |
| phone | TEXT | |
| created_at | TEXT | |

#### buildings

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| facility_id | TEXT FK -> facilities(id) | |
| name | TEXT NOT NULL | |
| floors | INTEGER | floor count for multi-story switching |
| created_at | TEXT | |

#### brands

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | matches `brand/<id>/` |
| product_name | TEXT | |
| operator_name | TEXT | |
| operator_legal_name | TEXT | |
| domains | TEXT | JSON array, for hostname resolution |
| config | TEXT | JSON token snapshot (file config is canonical) |

#### media_assets

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| building_id | TEXT FK -> buildings(id) | |
| project_id | TEXT FK -> projects(id) | nullable |
| asset_type | TEXT | floorplan_pdf/point_cloud/splat/walkthrough_video/reference_image |
| filename | TEXT | |
| r2_key | TEXT | R2 object key |
| storage_tier | TEXT | hot/cold |
| size | INTEGER | bytes |
| version | INTEGER | default 1 |
| capture_date | TEXT | field-verification metadata |
| surveyor | TEXT | |
| status | TEXT | pending/active/archived |
| uploaded_by | TEXT FK -> users(id) | |
| uploaded_at | TEXT | |

#### scan_markers_3d

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| asset_id | TEXT FK -> media_assets(id) | the splat scene |
| type | TEXT | exit/hazard/shutoff/aed/note |
| label | TEXT | |
| description | TEXT | |
| pos_x, pos_y, pos_z | REAL | anchor position |
| nrm_x, nrm_y, nrm_z | REAL | surface normal |
| viewpoint_id | TEXT FK -> viewpoints(id) | saved camera |
| created_by | TEXT FK -> users(id) | |
| created_at | TEXT | |

#### viewpoints

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| asset_id | TEXT FK -> media_assets(id) | |
| name | TEXT | bookmark label |
| pos_x, pos_y, pos_z | REAL | camera position |
| tgt_x, tgt_y, tgt_z | REAL | camera target |
| fov | REAL | |
| created_at | TEXT | |

#### export_jobs

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| building_id | TEXT FK -> buildings(id) | |
| requested_by | TEXT FK -> users(id) | |
| status | TEXT | queued/running/done/error |
| format | TEXT | pdf/geojson |
| r2_key | TEXT | result artifact |
| created_at | TEXT | |
| completed_at | TEXT | |

#### compliance_meta

| Column | Type | Notes |
|---|---|---|
| facility_id | TEXT PK FK -> facilities(id) | one row per facility |
| last_reviewed | TEXT | re-verification reminder source |
| last_responder_tour | TEXT | FL tri-annual mandate tracking |
| mandate_flags | TEXT | JSON: Alyssa's/Kari's/state |
| drill_links | TEXT | JSON array of URLs |
| z_axis_labels | TEXT | JSON floor labels for NENA export |

#### search_index (FTS5)

| Column | Type | Notes |
|---|---|---|
| rowid | (FTS5) | |
| entity_type | TEXT (UNINDEXED) | facility/building/project/document/marker |
| entity_id | TEXT (UNINDEXED) | |
| title | TEXT | indexed |
| body | TEXT | indexed (labels, notes) |
| scope_key | TEXT (UNINDEXED) | for RBAC pre-filter |

### 9.11 API surface

SvelteKit `+server.ts` server routes mirror v1's REST endpoints plus new routes for hierarchy, media, 3D, search, and collaboration. All require `Authorization: Bearer <token>` (JWT or API key).

```
Auth        POST /api/auth/login | POST /api/auth/logout | GET /api/auth/me
Hierarchy   GET/POST /api/orgs | GET/PUT /api/orgs/:id
            GET/POST /api/districts | GET/POST /api/facilities | GET/POST /api/buildings
            GET /api/buildings/:id/projects
Projects    GET/POST /api/projects | GET/PUT/DELETE /api/projects/:id
            GET/POST /api/projects/:id/members
Media       GET /api/buildings/:id/media | POST /api/media/upload-url
            POST /api/media/:id/parts | POST /api/media/:id/confirm
            GET /api/media/:id | DELETE /api/media/:id
Annotations GET/POST /api/documents/:id/annotations
            PUT /api/documents/:id/annotations/batch
            GET /api/documents/:id/export | PUT/DELETE /api/annotations/:id
Markers     GET/POST /api/documents/:id/markers | PUT/DELETE /api/markers/:id
            GET /api/documents/:id/crops | PUT /api/documents/:id/crops/:page
Export      POST /api/buildings/:id/export (pdf|geojson) | GET /api/export-jobs/:id
3D          GET/POST /api/media/:id/scan-markers | PUT/DELETE /api/scan-markers/:id
            GET/POST /api/media/:id/viewpoints | DELETE /api/viewpoints/:id
Search      GET /api/search?q=...   (RBAC-scoped, FTS5)
Comments    GET/POST /api/threads/:anchor/comments | POST /api/comments/:id/resolve
            POST /api/share-links | GET /api/activity?project=:id
Admin       GET/POST /api/users | PUT/DELETE /api/users/:id
            GET/POST /api/api-keys | DELETE /api/api-keys/:id
            GET /api/brands | GET /api/stats/dashboard | GET /api/stats/admin | GET /api/audit
Compliance  GET/PUT /api/facilities/:id/compliance
```

---

## 10. Security and privacy

Pathfinder handles district data under FERPA's "school official" exception (34 CFR 99.31): facility maps are usually not education records, but the operator is engaged under a signed data-processing agreement (DPA) with redisclosure restrictions, breach notification, and data-deletion/retention terms (research/02). Facility safety maps are sensitive-but-unclassified: a blueprint of exits, shutoffs, and chokepoints is itself a security risk if leaked, so controls run tighter than FERPA's floor. Concretely: TLS 1.2+ in transit and AES-256 at rest; RBAC enforced server-side on every route; passwords as PBKDF2-SHA256 hashes and API keys as SHA-256 hashes; immutable, exportable audit logs recording who viewed, edited, or exported which map and when (FR-52); a U.S. data-residency option; and CORS restricted to configured origins. The repo is public on GitHub (`melonmelonz/pathfinder`); secrets and client data are never committed, and CF Pages commit messages stay ASCII-only to keep wrangler deploys safe (NFR-10). Compliance posture pursues SOC 2 Type II broadly and GovRAMP (the Feb-2025 StateRAMP rename) for government buyers; the trust page states application-level controls explicitly, since hosting on a compliant cloud does not equal compliance (research/04). Accessibility is treated as a procurement gate (research/02): failing WCAG 2.1 AA risks ADA Title II / OCR liability after April 24, 2026, and bid disqualification.

---

## 11. Testing strategy

TDD is mandatory (epic E14, canonical sec 2). Every acceptance criterion gets a failing-first test before implementation; the traceability chain is Epic -> US -> AC -> Test -> Sprint, with tests named `T-<AC>` (e.g. T-3.2.1). Unit tests run on Vitest and cover the three ported/new engines as they are extracted: the 2D annotation engine (coordinate normalization, undo/redo, JSON export schema), the map/NFPA export engine (legend auto-fit, one-row-per-type with chips, print ordering, marker placement fidelity), and the 3D viewer engine (measurement math, viewpoint serialization, marker anchoring). End-to-end tests run on Playwright and capture a screenshot at every acceptance criterion (FR-59), giving a visual regression record per AC. CI runs the full suite before any deploy to the Pathfinder test project. The detailed test plan lives in the documentation package's TDD plan file (the S0-S7 plan references each `T-<AC>`).

---

## 12. Rollout, deployment and migration

v2 ships from a new public repo (`github.com/melonmelonz/pathfinder`) and a new, isolated Cloudflare test project (`pathfinder` -> `pathfinder.pages.dev`), kept separate from els911-portal production. Deploys are direct via `wrangler pages deploy`; git push does NOT publish. Rollout follows the canonical sprint map:

| Sprint | Theme | Primary epics |
|---|---|---|
| S0 | Baseline (retroactive): document v1 engine + schema as inherited foundation | E5, E6 (partial), E4 (partial), E2 (partial) |
| S1 | Foundation: SvelteKit scaffold, CF adapter, brand layer, auth port, test harness, AGENTS.md | E1, E2, E14 |
| S2 | Hierarchy: org/district/facility/building + roll-up dashboards + search-ready nav | E3 |
| S3 | Engine port: 2D annotation + map/NFPA export into Svelte wrappers | E5, E6 |
| S4 | Scan library: media_assets, R2 multipart upload, point-cloud archive | E7 |
| S5 | 3D viewer: mp4 player + Spark splat viewer + measurement + 3D markers | E8 |
| S6 | Search and collaboration: FTS5 search, batch map export, comment/resolve/@mention/notifications | E10, E6, E9 |
| S7 | Compliance, accessibility, migration and launch: NG911 export, audit, WCAG 2.1 AA, v1->v2 migration, deploy | E11, E12, E13 |

Migration: v1 tables are retained additively, so v1 D1 data carries forward. The migration backfills the new hierarchy from existing flat fields (v1 `projects.facility`, `district`, `address`, `zip`, `phone` seed `facilities`/`districts`/`orgs`; existing `documents` rows map into `media_assets` with `asset_type=floorplan_pdf` and inferred tier). The migration is a versioned D1 script run against a copy first, validated by a row-count and referential-integrity check, then applied. Master point-cloud PLYs (if any exist in v1 R2) are relocated to the cold prefix.

---

## 13. Risks, dependencies and mitigations; alternatives; open questions; revision history

### 13.1 Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Trion Model does not export a 3DGS PLY | Blocks SPZ pipeline | Bridge with an E57->3DGS training step (research/03); validate early in S5 |
| Porting the 4,500-line v1 engine introduces regressions | 2D/NFPA correctness loss | Extract behind unit tests per canonical sec 2; visual-regression Playwright screenshots per AC |
| Large splats fail on field iOS Safari | Responders cannot view scenes | SPZ-only delivery; never serve PLY; enforce NFR-2/NFR-3 budgets |
| Brand color leaks into a component | White-label breaks for new operators | Lint rule forbidding literal brand colors; token-only references (FR-3) |
| WCAG 2.1 AA gap | Procurement disqualification, ADA liability | E12 accessibility sprint; maintained VPAT; keyboard and SR coverage in E2E |
| Secret committed to public repo | Security exposure | AGENTS.md "never commit secrets" rule; secrets only as CF env/bindings (NFR-10) |
| NENA export not conformant | Data unusable to PSAPs | Validate GeoJSON against STA-006 schema with z-axis labels (FR-31) |

### 13.2 Dependencies

PDF.js (pinned), Spark (World Labs, THREE.js / WebGL2), jsPDF (ported export), PlayCanvas SplatTransform CLI (offline PLY->SPZ), Trion P1 plus Trion Model (capture pipeline), Cloudflare Pages/Functions/D1/R2/KV, SvelteKit plus adapter-cloudflare.

### 13.3 Alternatives considered

- SvelteKit over React/Astro: SvelteKit matches the sibling `pathfinder-lidar` project, reads cleanly in vim, and pairs naturally with adapter-cloudflare; React would add ceremony and Astro is weaker for a stateful authenticated app.
- SPZ over PLY/KSPLAT/SOG: SPZ is ~90% smaller than PLY at imperceptible quality loss (PSNR ~47 dB), preserves spherical harmonics, is open-spec (Niantic, Apache-2.0) and on the glTF track; raw PLY fails above ~200 MB on iPhone Safari; KSPLAT is PlayCanvas-locked and drops higher SH bands; SOG is reserved for maximum compression only (research/03).
- Spark over the older GaussianSplats3D: GaussianSplats3D's maintainer deprecated it and recommends Spark; Spark fuses splats with meshes (needed for markers) and added streaming LOD in 2.0 (research/03).
- WebGL2 over WebGPU: 98%+ device support including field iOS/Android is the right call for first responders (research/03).
- Port over rewrite of the engines: v1's canvas/print logic is full of fiddly correctness (marker placement, legend auto-fit, print order); modernize structure without re-litigating working logic (canonical sec 2).

### 13.4 Open questions

- Does Trion Model export a 3DGS PLY directly, or is the E57->3DGS step required? (Resolve in S5.)
- Will runtime per-hostname brand resolution be needed before the first reseller, or does build-time `BRAND` suffice through launch?
- What is the canonical RapidSOS integration posture (export handoff vs. live partner API) for v2?
- Is SOC 2 Type II or GovRAMP the first certification to pursue, given the initial buyer mix?

### 13.5 Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-06-15 | Pathfinder LiDAR Solutions | Initial draft for review |
