# Pathfinder Portal - Acceptance Criteria

| Field | Value |
|---|---|
| Document | 03 - Acceptance Criteria |
| Version | 0.1 |
| Date | 2026-06-15 |
| Status | Draft |
| Source of truth | `docs/00-canonical-context.md` |
| Companion | `docs/02-user-stories.md` |

---

## Intro

This document gives the acceptance criteria for every user story in `docs/02-user-stories.md`.
Each criterion is written in Given/When/Then form and carries an ID `AC-<story>.<n>`. Each
AC is independently testable and maps 1:1 to a Vitest/Playwright test `T-<AC>` in the
forthcoming TDD plan (the canonical chain Epic -> US -> AC -> Test -> Sprint).

Criteria describe behavior and outcomes, never implementation. Per the documentation
convention (research 04), each story carries 1 to 3 ACs; coverage spans the happy path plus
at least one edge, permission, or error case in each epic. A trailing `[screenshot]` tag
marks a UI-visible outcome that the TDD plan should assert with a Playwright visual snapshot.

---

## E1 - White-Label Brand Layer

### US-1.1 - Default Pathfinder brand
- **AC-1.1.1** Given no `BRAND` env var is set, When the app loads, Then the Pathfinder
  LiDAR brand name, logo, and dark-slate color tokens render. [screenshot]
- **AC-1.1.2** Given the default brand is active, When any component reads a brand color,
  Then it resolves from a CSS custom property and never from a hard-coded value.

### US-1.2 - Drop-in brand swap
- **AC-1.2.1** Given `BRAND=els911` is set at build, When the app loads, Then the ELS911
  product name, logo, and palette render in place of Pathfinder's with no component change. [screenshot]
- **AC-1.2.2** Given a brand profile is missing its logo asset, When the app loads, Then it
  falls back to the brandmark placeholder and logs a warning rather than rendering broken.

### US-1.3 - Ready-made ELS911 profile
- **AC-1.3.1** Given the ELS911 profile, When it is activated, Then its tokens resolve to
  primary red #B22234 and navy #002868 as ported from v1 tokens.css. [screenshot]

### US-1.4 - Token-only component theming
- **AC-1.4.1** Given the component source tree, When it is scanned for color literals, Then
  no component file contains a hard-coded brand hex value.
- **AC-1.4.2** Given a brand token value is changed, When the app re-renders, Then every
  component referencing that token reflects the new value with no component edit. [screenshot]

### US-1.5 - Brand continuity with marketing site
- **AC-1.5.1** Given the active brand profile, When a user moves from the marketing site to
  the logged-in product, Then the logo, primary color, and typography match. [screenshot]

---

## E2 - Identity, Roles & Access

### US-2.1 - Email/password login
- **AC-2.1.1** Given a registered user, When they submit valid credentials, Then a JWT
  session is issued and they land on their scoped dashboard. [screenshot]
- **AC-2.1.2** Given a registered user, When they submit a wrong password, Then login is
  rejected with a generic error and no session is issued. [screenshot]

### US-2.2 - Role-based access control
- **AC-2.2.1** Given a user with the client role, When they request a staff-only route,
  Then access is denied with a 403 and a permission screen is shown. [screenshot]
- **AC-2.2.2** Given a user with the admin role, When they request an admin route, Then the
  route renders.

### US-2.3 - Org-scoped data isolation
- **AC-2.3.1** Given a client reviewer in Org A, When they request a facility belonging to
  Org B by ID, Then the request is denied and no Org B data is returned.

### US-2.4 - Audit-logged authentication events
- **AC-2.4.1** Given audit logging is enabled, When a user logs in, logs out, or is denied
  access, Then an immutable audit entry records the actor, event, and timestamp.

### US-2.5 - Forward-looking MFA/SSO
- **AC-2.5.1** Given the auth layer, When a user record carries an MFA-enabled flag, Then
  the login flow exposes the MFA step hook without breaking password-only users.

---

## E3 - Org Hierarchy & Dashboards

### US-3.1 - Navigate the org hierarchy
- **AC-3.1.1** Given an org with districts, facilities, and buildings, When a staff member
  drills from org to building, Then each level lists only its direct children. [screenshot]
- **AC-3.1.2** Given the hierarchy, When rendered, Then nesting is capped at the canonical
  three levels below org (district, facility, building).

### US-3.2 - Breadcrumb switcher dropdowns
- **AC-3.2.1** Given a building page, When a user clicks a breadcrumb segment, Then a
  dropdown of sibling entities at that level opens. [screenshot]
- **AC-3.2.2** Given the breadcrumb dropdown, When the user selects a sibling, Then the
  view navigates to that sibling at the same hierarchy level.

### US-3.3 - Roll-up dashboards
- **AC-3.3.1** Given a district with multiple facilities, When the operator admin opens the
  district dashboard, Then it shows an aggregated roll-up of facility and project status. [screenshot]

### US-3.4 - Designed empty states
- **AC-3.4.1** Given a facility with no projects, When a client reviewer opens it, Then a
  designed empty state shows a sample preview and one clear first action. [screenshot]

### US-3.5 - Favorites and saved views
- **AC-3.5.1** Given a building, When a staff member stars it, Then it appears in their
  favorites list and persists across sessions. [screenshot]

---

## E4 - Project & Review Workflow

### US-4.1 - Create a project under a building
- **AC-4.1.1** Given a building, When a staff member creates a project with a name and
  members, Then the project is saved with that `building_id` and an initial status. [screenshot]
- **AC-4.1.2** Given project creation, When no building is selected, Then creation is
  blocked with a validation error.

### US-4.2 - Track project progress and status
- **AC-4.2.1** Given a project, When a client reviewer opens it, Then its current status and
  progress are displayed without any staff-only editing controls. [screenshot]

### US-4.3 - Version review loop
- **AC-4.3.1** Given a staff member publishes V1, When publication completes, Then the
  client org's reviewer is notified and the version is marked awaiting review.
- **AC-4.3.2** Given client annotations on V1, When staff publish V2, Then V2 becomes
  current and V1's annotations remain tied to V1 for history. [screenshot]

### US-4.4 - Record an approval
- **AC-4.4.1** Given a current version, When a client reviewer approves it, Then the
  approval is recorded against that version with actor and timestamp. [screenshot]
- **AC-4.4.2** Given a user without the client reviewer role, When they attempt to approve,
  Then the action is denied.

### US-4.5 - Manage project membership
- **AC-4.5.1** Given a project, When an operator admin removes a member, Then that user
  loses access to the project on their next request.

---

## E5 - 2D Floorplan Annotation Engine

### US-5.1 - View a floorplan PDF
- **AC-5.1.1** Given a floorplan PDF asset, When a staff member opens it, Then the PDF
  renders in the in-portal viewer at the correct page and scale. [screenshot]
- **AC-5.1.2** Given a corrupt or unsupported file, When opened, Then the viewer shows an
  error state instead of a blank canvas. [screenshot]

### US-5.2 - Use the annotation tools
- **AC-5.2.1** Given the viewer, When a staff member selects each of the ported tools and
  draws, Then the corresponding annotation is created on the canvas. [screenshot]

### US-5.3 - Persist annotations as JSON
- **AC-5.3.1** Given annotations drawn on a floorplan, When the page is reloaded, Then the
  annotations reappear exactly as drawn. [screenshot]
- **AC-5.3.2** Given saved annotations, When exported, Then the output is valid JSON
  round-trippable back into the same shapes.

### US-5.4 - Layered per-audience annotations
- **AC-5.4.1** Given annotations tagged by audience layer, When a reviewer toggles the
  responder layer off, Then only non-responder annotations remain visible. [screenshot]

### US-5.5 - Client annotation in the review loop
- **AC-5.5.1** Given a client reviewer viewing a draft, When they place an annotation on a
  room, Then it is saved against the current version and visible to staff. [screenshot]

---

## E6 - Safety Mapping & NFPA Export

### US-6.1 - Place NFPA 170 markers
- **AC-6.1.1** Given the NFPA 170 catalog, When a staff member places an AED marker, Then
  it renders with the standardized NFPA 170 symbol. [screenshot]
- **AC-6.1.2** Given the marker tool, When a user attempts a freehand symbol, Then only
  catalog symbols are placeable and freehand symbol creation is not offered.

### US-6.2 - Auto-generated NFPA legend
- **AC-6.2.1** Given placed markers, When the legend generates, Then it lists one vertical
  row per marker type with hallway chips and no duplicate rows. [screenshot]

### US-6.3 - North-locked printable map render
- **AC-6.3.1** Given a map for export, When rendered, Then it is north-oriented, gridded,
  and laid out for print. [screenshot]

### US-6.4 - Batch multi-page PDF export
- **AC-6.4.1** Given a building with multiple maps, When a staff member queues a batch
  export, Then an export job is created and a correctly ordered multi-page PDF is produced.
- **AC-6.4.2** Given a queued export job, When it fails mid-render, Then the job is marked
  failed and the partial output is not delivered as final.

### US-6.5 - Z-axis floor labels
- **AC-6.5.1** Given a multi-floor facility, When a map and its markers are saved, Then each
  carries a z-axis floor label in its compliance metadata.

### US-6.6 - Marker placement fidelity
- **AC-6.6.1** Given a marker placed at a canvas point, When the map is re-rendered and
  exported, Then the marker appears at the same coordinates with no drift or jitter. [screenshot]

---

## E7 - Unified Scan Library & Media

### US-7.1 - Unified media asset library
- **AC-7.1.1** Given a facility with mixed media, When the library opens, Then floorplan
  PDFs, point clouds, splats, walkthrough videos, and reference images all list in one view. [screenshot]

### US-7.2 - Large multipart upload
- **AC-7.2.1** Given a large scan file, When uploaded via multipart, Then all parts assemble
  into one R2 object and the asset becomes available.
- **AC-7.2.2** Given a multipart upload interrupted partway, When resumed, Then it completes
  without re-uploading already-sent parts.

### US-7.3 - Asset versioning
- **AC-7.3.1** Given an asset, When a new scan is uploaded for the same building, Then it is
  stored as a new version carrying capture date and surveyor, leaving prior versions intact. [screenshot]

### US-7.4 - Point-cloud cold archive
- **AC-7.4.1** Given a master PLY point cloud, When ingested, Then it is written to the cold
  storage tier.
- **AC-7.4.2** Given a client request for an asset, When the asset is a master PLY, Then it
  is never served to the client.

### US-7.5 - SPZ delivery format
- **AC-7.5.1** Given a scan for client delivery, When the viewer requests it, Then it is
  served as SPZ, not PLY.

---

## E8 - 3D Scan Viewer

### US-8.1 - MP4 walkthrough player
- **AC-8.1.1** Given a facility with a walkthrough mp4, When a first responder opens it,
  Then the video plays with standard transport controls on the device. [screenshot]

### US-8.2 - Interactive splat viewer
- **AC-8.2.1** Given an SPZ scan, When the splat viewer loads, Then the scene renders and
  responds to orbit, fly, and walk camera modes. [screenshot]
- **AC-8.2.2** Given a device without WebGL2, When the viewer loads, Then it shows a
  graceful fallback message rather than a broken canvas. [screenshot]

### US-8.3 - 3D measurement tool
- **AC-8.3.1** Given a loaded scan, When a staff member picks two points, Then a
  point-to-point distance is reported in real-world units. [screenshot]

### US-8.4 - Anchored 3D markers
- **AC-8.4.1** Given a scan, When a staff member drops a marker with a title, description,
  and saved viewpoint, Then it anchors at that 3D position and reloads in place. [screenshot]
- **AC-8.4.2** Given a scene at the marker cap, When another marker is added, Then the cap
  is enforced with a clear message.

### US-8.5 - Floor switching
- **AC-8.5.1** Given a multi-floor facility, When a responder switches floors, Then the
  viewer loads the selected floor's scan and updates the active-floor indicator. [screenshot]

### US-8.6 - Named viewpoints
- **AC-8.6.1** Given a scan, When a staff member saves a named viewpoint, Then selecting it
  later returns the camera to the stored position, target, and FOV. [screenshot]

### US-8.7 - Scan version compare
- **AC-8.7.1** Given two scan versions, When a client reviewer compares them, Then both
  capture dates are shown and the viewer can swap between versions. [screenshot]

---

## E9 - Collaboration

### US-9.1 - Anchored comment threads
- **AC-9.1.1** Given a map region or 3D marker, When a client reviewer starts a thread,
  Then the comment anchors to that location and renders for all participants. [screenshot]
- **AC-9.1.2** Given an existing thread, When a participant replies, Then the reply nests
  under the thread in order.

### US-9.2 - Resolve workflow
- **AC-9.2.1** Given an open thread, When a staff member resolves it, Then it is hidden from
  the default view but retained in the record, not deleted. [screenshot]

### US-9.3 - @-mentions with deep-link email
- **AC-9.3.1** Given a comment, When a client reviewer @-mentions a staff member, Then that
  member receives an email containing a deep link to the comment.
- **AC-9.3.2** Given an @-mention of a user outside the org, When submitted, Then the
  mention is rejected and no email is sent.

### US-9.4 - Batched activity notifications
- **AC-9.4.1** Given multiple activity events for one user within a batching window, When
  the digest sends, Then they arrive as a single batched notification.

### US-9.5 - External share links
- **AC-9.5.1** Given a map or scan, When an operator admin creates a share link, Then an
  unauthenticated visitor with the link sees only that scoped resource. [screenshot]
- **AC-9.5.2** Given a revoked share link, When it is opened, Then access is denied.

---

## E10 - Global Search

### US-10.1 - Search across all entity types
- **AC-10.1.1** Given indexed content, When a staff member searches a term, Then matching
  facilities, buildings, projects, documents, and marker labels are returned grouped by type. [screenshot]

### US-10.2 - Org-scoped search results
- **AC-10.2.1** Given a client reviewer in Org A, When they search a term that also matches
  Org B content, Then only Org A results are returned.

### US-10.3 - Search-centric navigation for large lists
- **AC-10.3.1** Given a large set of facilities, When a staff member searches by name, Then
  a matching facility is reachable directly from results without hierarchy traversal. [screenshot]

---

## E11 - Compliance & Trust

### US-11.1 - NG911/NENA GeoJSON export
- **AC-11.1.1** Given a facility with structure and point data, When a compliance officer
  exports GeoJSON, Then the output conforms to the NENA STA-006 schema.
- **AC-11.1.2** Given a facility missing required NENA fields, When export is attempted,
  Then the export reports the missing fields rather than producing invalid GIS.

### US-11.2 - Compliance metadata per facility
- **AC-11.2.1** Given a facility, When a compliance officer edits compliance metadata, Then
  last-reviewed date, last responder tour, mandate flags, and drill links are saved. [screenshot]

### US-11.3 - Immutable, exportable audit log
- **AC-11.3.1** Given audit entries, When a compliance officer exports the log, Then it
  contains who viewed, edited, and exported which map and when.
- **AC-11.3.2** Given an existing audit entry, When any actor attempts to alter it, Then the
  entry cannot be modified or deleted.

### US-11.4 - Public trust page
- **AC-11.4.1** Given the deployment, When a visitor opens the trust page, Then it states
  the application-level controls and compliance posture for the active brand. [screenshot]

### US-11.5 - Re-verification reminders
- **AC-11.5.1** Given a facility whose last-reviewed date has passed the staleness
  threshold, When the reminder check runs, Then the facility is flagged for re-verification. [screenshot]

---

## E12 - Accessibility

### US-12.1 - Full keyboard navigation
- **AC-12.1.1** Given the portal, When a user navigates with keyboard only, Then all
  interactive controls are reachable and operable with a visible focus indicator. [screenshot]

### US-12.2 - Screen-reader labels
- **AC-12.2.1** Given the interface and map symbols, When inspected by a screen reader,
  Then every control and symbol exposes a descriptive accessible label.

### US-12.3 - Non-visual map alternative
- **AC-12.3.1** Given a map, When a user opens its non-visual alternative, Then a text list
  of rooms, exits, and markers conveys the same information. [screenshot]

### US-12.4 - Contrast and VPAT posture
- **AC-12.4.1** Given the UI, When color contrast is measured, Then text and controls meet
  WCAG 2.1 AA contrast ratios. [screenshot]
- **AC-12.4.2** Given a procurement request, When the VPAT is requested, Then a maintained
  VPAT/ACR document is available.

---

## E13 - Admin & Platform Ops

### US-13.1 - User management
- **AC-13.1.1** Given the admin area, When an operator admin creates a user and assigns a
  role, Then the user can log in with exactly that role's permissions. [screenshot]
- **AC-13.1.2** Given an active user, When an operator admin deactivates them, Then their
  next request is rejected.

### US-13.2 - API key management
- **AC-13.2.1** Given the admin area, When an operator admin issues a scoped API key, Then
  the key authenticates API requests within its scope. [screenshot]
- **AC-13.2.2** Given an issued key, When the admin revokes it, Then subsequent requests
  using that key are rejected.

### US-13.3 - Audit log viewer
- **AC-13.3.1** Given audit entries, When a compliance officer filters the in-portal viewer
  by actor and date, Then only matching entries are shown. [screenshot]

### US-13.4 - Platform settings
- **AC-13.4.1** Given the settings area, When an operator admin changes a deployment-wide
  setting, Then the change persists and takes effect without a code change.

### US-13.5 - Observability
- **AC-13.5.1** Given a runtime error in the deployment, When it occurs, Then it is captured
  in the observability output with enough context to diagnose it.

---

## E14 - Quality & Delivery Harness

### US-14.1 - Failing test before implementation
- **AC-14.1.1** Given a new acceptance criterion, When its test `T-<AC>` is first written,
  Then it fails against the unimplemented feature before any implementation exists.

### US-14.2 - Engine unit tests
- **AC-14.2.1** Given a ported engine, When its extraction lands, Then it ships with passing
  Vitest unit tests covering its core logic.

### US-14.3 - Playwright screenshot assertions
- **AC-14.3.1** Given a UI-visible outcome, When its Playwright test runs, Then a screenshot
  is captured and compared against the stored baseline. [screenshot]
- **AC-14.3.2** Given a visual regression, When the screenshot differs beyond threshold,
  Then the test fails.

### US-14.4 - CI on every change
- **AC-14.4.1** Given a change, When it is pushed, Then CI runs the full Vitest and
  Playwright suite and blocks merge on failure.

### US-14.5 - Deploy to isolated CF test project
- **AC-14.5.1** Given a deploy, When `wrangler pages deploy` runs, Then it targets the
  `pathfinder` Pages project and never els911-portal production.

---

## Coverage summary

| Epic | Title | #Stories | #ACs |
|---|---|---|---|
| E1 | White-Label Brand Layer | 5 | 8 |
| E2 | Identity, Roles & Access | 5 | 7 |
| E3 | Org Hierarchy & Dashboards | 5 | 7 |
| E4 | Project & Review Workflow | 5 | 8 |
| E5 | 2D Floorplan Annotation Engine | 5 | 7 |
| E6 | Safety Mapping & NFPA Export | 6 | 8 |
| E7 | Unified Scan Library & Media | 5 | 7 |
| E8 | 3D Scan Viewer | 7 | 9 |
| E9 | Collaboration | 5 | 8 |
| E10 | Global Search | 3 | 3 |
| E11 | Compliance & Trust | 5 | 7 |
| E12 | Accessibility | 4 | 5 |
| E13 | Admin & Platform Ops | 5 | 7 |
| E14 | Quality & Delivery Harness | 5 | 6 |
| **Total** | | **70** | **97** |
