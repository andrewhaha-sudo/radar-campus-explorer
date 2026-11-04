# Pathfinder Portal - TDD Plan (Prompts for Writing Tests)

| Field | Value |
|---|---|
| Document | 04 - TDD Plan |
| Version | 0.1 |
| Date | 2026-06-15 |
| Status | Draft |
| Source of truth | `docs/00-canonical-context.md` |
| Companions | `docs/02-user-stories.md`, `docs/03-acceptance-criteria.md` |

---

## Intro

This document is the bridge from acceptance criteria to red-green-refactor TDD. For every
acceptance criterion in `docs/03-acceptance-criteria.md` it provides a ready-to-use prompt
that instructs a developer or coding agent to write the FAILING test first, before any
implementation exists. It enforces the canonical project rule: every AC maps 1:1 to a test
`T-<AC>`, and every UI-visible AC (tagged `[screenshot]` in doc 03) is asserted with a
Playwright visual snapshot.

The traceability chain is **Epic -> US -> AC -> Test -> Sprint**. This plan owns the
`AC -> Test` link and ties each test group to the sprint (`S0`..`S7`) at whose Definition
of Done it must be green.

---

## 1. TDD doctrine

Test-first is mandatory. It is the contract of epic E14 (`AC-14.1.1`): a test `T-<AC>` is
written and seen to fail against the unimplemented feature before any implementation is
written. The cycle is:

1. **Red** - Write `T-<AC>` from the AC's Given/When/Then. Run it. Confirm it fails for the
   right reason (the behavior is absent), not because of a typo, a missing import, or a
   broken harness. A test that passes on first run is suspect and must be re-examined.
2. **Green** - Write the minimum implementation that makes `T-<AC>` pass. No extra scope.
3. **Refactor** - Clean up implementation and test with the suite green. For ported engines
   (E5, E6), "refactor" means re-shaping v1 logic into a framework-agnostic module without
   changing behavior; the test is the behavioral lock.

The prompts in section 5 generate the Red step only. They deliberately describe the
behavior to assert and never prescribe the implementation, so the same prompt stays valid
whether the feature is built one way or another.

### Test layer decision table

| Input / behavior under test | Test type | Tool |
|---|---|---|
| Pure logic, engine math (marker coordinates, legend autofit, jitter, print order) | Unit | Vitest |
| Schema / data model invariants, validation rules, serialization round-trips | Unit | Vitest |
| API route handlers (`+server.ts`), auth, RBAC, org-scoping, key auth | Integration | Vitest |
| Storage tiering, multipart assembly, format-on-delivery rules | Integration | Vitest |
| Static source-tree assertions (no hard-coded brand hex) | Unit | Vitest |
| Notification / email dispatch logic, batching windows | Integration | Vitest |
| User-visible single outcome tagged `[screenshot]` | E2E | Playwright |
| Multi-step UI flow (login, drill-down, review loop, annotate, measure) | E2E | Playwright |
| Rendering correctness, theming, focus order, contrast | E2E | Playwright |

Rule of thumb: if the AC carries `[screenshot]`, it is Playwright with a visual snapshot.
If the outcome is a value, a record, an HTTP status, or a file shape with no required visual
proof, it is Vitest. A handful of `[screenshot]` ACs also have meaningful non-visual logic
(for example marker fidelity, `AC-6.6.1`); those are still driven through Playwright because
the AC's stated proof is visual, with numeric assertions made inside the E2E test.

---

## 2. Test harness conventions

### File layout

```
tests/
  unit/                    Vitest unit + integration specs
    <area>.test.ts
  e2e/                     Playwright specs
    <area>.spec.ts
    __screenshots__/       committed visual baselines
      <AC-id>.png
  fixtures/                shared fixtures (sample PDFs, SPZ, seed orgs, brand profiles)
```

- Vitest unit and integration specs live in `tests/unit/*.test.ts`. API route handler tests
  run under Vitest with the Cloudflare Workers test pool against bindings `DB`, `DOCUMENTS`,
  `CACHE`.
- Playwright E2E specs live in `tests/e2e/*.spec.ts`. Visual baselines live in
  `tests/e2e/__screenshots__/` and are committed to the repo.

### Naming

- The test title MUST contain the test id `T-<AC>`, for example:
  `test('T-2.1.1 valid credentials issue a JWT and land on the scoped dashboard', ...)`.
- One `T-<AC>` per AC. Do not fold two ACs into one test, and do not split one AC across two
  test ids.
- A screenshot is named exactly `<AC-id>.png` (the AC id, not the test id prefix), for
  example `AC-2.1.1.png`, stored in `tests/e2e/__screenshots__/`.

### Running

| Command | Runs |
|---|---|
| `npm run test:unit` | Vitest unit + integration suite |
| `npm run test:e2e` | Playwright E2E + screenshot comparison |
| `npm run test` | both, the full suite CI runs |

### Merge rule

A PR cannot merge with a skipped or failing in-scope test. "In scope" means any `T-<AC>`
whose AC belongs to an epic the PR touches, plus the always-on harness tests (E14). CI runs
the full Vitest and Playwright suite on every change and blocks merge on any failure
(`AC-14.4.1`). `test.skip` / `test.todo` on an in-scope test is treated as a failure for
merge purposes.

---

## 3. Prompt template

Every entry in section 5 follows this reusable shape. To generate a failing test, paste the
AC text plus the prompt:

> **Write a failing `<Vitest|Playwright>` test `T-<AC-id>`.**
> Given `<preconditions / fixtures>`, when `<the action>`, assert that
> `<the observable outcome>`. `<For Playwright: capture a screenshot named <AC-id>.png and
> assert it against the stored baseline.>` Do NOT implement the feature. Run the test and
> confirm it fails because the behavior is absent (not because of a harness or import error).
> Assert behavior and observable outcomes only; do not assert internal implementation detail.

---

## 4. How to read section 5

Section 5 is organized by epic E1..E14. Each epic has:

- an **index table** (`Test ID | AC | Tool | Screenshot`) for quick traceability, and
- **numbered prompt blocks**, one per AC, each a concrete paste-ready test-writing prompt.

Sprint relevance follows the canonical sprint map (section 7): S0 baseline (E5/E6/E4/E2
partial), S1 (E1/E2/E14), S2 (E3), S3 (E5/E6), S4 (E7), S5 (E8), S6 (E10/E6/E9), S7
(E11/E12/E13 + migration/launch).

---

## 5. Test-writing prompts by epic

### E1 - White-Label Brand Layer (S1)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-1.1.1 | AC-1.1.1 | Playwright | yes |
| T-1.1.2 | AC-1.1.2 | Vitest | no |
| T-1.2.1 | AC-1.2.1 | Playwright | yes |
| T-1.2.2 | AC-1.2.2 | Vitest | no |
| T-1.3.1 | AC-1.3.1 | Playwright | yes |
| T-1.4.1 | AC-1.4.1 | Vitest | no |
| T-1.4.2 | AC-1.4.2 | Playwright | yes |
| T-1.5.1 | AC-1.5.1 | Playwright | yes |

1. **T-1.1.1** (Playwright) - Write a failing E2E test. Given no `BRAND` env var is set, when
   the app loads, assert the Pathfinder LiDAR product name and logo render and the
   dark-slate brand color tokens are applied to the page. Capture `AC-1.1.1.png` and assert
   it against the stored baseline. Do not implement the brand layer.
2. **T-1.1.2** (Vitest) - Write a failing unit test. Given the default brand is active, when a
   component reads a brand color, assert the resolved value comes from a CSS custom property
   (token) and never from a hard-coded literal. Do not implement token resolution.
3. **T-1.2.1** (Playwright) - Write a failing E2E test. Given `BRAND=els911` at build, when the
   app loads, assert the ELS911 product name, logo, and palette render in place of
   Pathfinder's with no component source change. Capture `AC-1.2.1.png` and assert against
   baseline. Do not implement the brand swap.
4. **T-1.2.2** (Vitest) - Write a failing unit test. Given a brand profile missing its logo
   asset, when the brand loads, assert the brandmark placeholder is selected and a warning is
   logged, and that nothing throws or renders a broken image reference. Do not implement the
   fallback.
5. **T-1.3.1** (Playwright) - Write a failing E2E test. Given the ELS911 profile is activated,
   when the app loads, assert its primary token resolves to `#B22234` and navy to `#002868`
   as ported from v1 `tokens.css`. Capture `AC-1.3.1.png` and assert against baseline. Do not
   implement the profile.
6. **T-1.4.1** (Vitest) - Write a failing unit test. Given the component source tree, when it is
   scanned for color literals, assert no component file contains a hard-coded brand hex value
   (tokens and neutral utility files excepted per an allowlist). Do not implement the scan
   target.
7. **T-1.4.2** (Playwright) - Write a failing E2E test. Given a brand token value is changed,
   when the app re-renders, assert every component referencing that token reflects the new
   value with no component edit. Capture `AC-1.4.2.png` and assert against baseline. Do not
   implement token propagation.
8. **T-1.5.1** (Playwright) - Write a failing E2E test. Given the active brand profile, when a
   user moves from the marketing site to the logged-in product, assert the logo, primary
   color, and typography match across the boundary. Capture `AC-1.5.1.png` and assert against
   baseline. Do not implement brand continuity.

### E2 - Identity, Roles & Access (S1, S0 partial)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-2.1.1 | AC-2.1.1 | Playwright | yes |
| T-2.1.2 | AC-2.1.2 | Playwright | yes |
| T-2.2.1 | AC-2.2.1 | Playwright | yes |
| T-2.2.2 | AC-2.2.2 | Vitest | no |
| T-2.3.1 | AC-2.3.1 | Vitest | no |
| T-2.4.1 | AC-2.4.1 | Vitest | no |
| T-2.5.1 | AC-2.5.1 | Vitest | no |

1. **T-2.1.1** (Playwright) - Write a failing E2E test. Given a registered user fixture, when
   they submit valid credentials, assert a JWT session is issued and they land on their
   role-scoped dashboard. Capture `AC-2.1.1.png` and assert against baseline. Do not implement
   login.
2. **T-2.1.2** (Playwright) - Write a failing E2E test. Given a registered user, when they
   submit a wrong password, assert login is rejected with a generic error message and no
   session cookie/token is issued. Capture `AC-2.1.2.png` and assert against baseline. Do not
   implement auth rejection.
3. **T-2.2.1** (Playwright) - Write a failing E2E test. Given a user with the client role, when
   they request a staff-only route, assert access is denied with HTTP 403 and a designed
   permission screen is shown. Capture `AC-2.2.1.png` and assert against baseline. Do not
   implement RBAC.
4. **T-2.2.2** (Vitest) - Write a failing integration test on the route handler. Given a user
   with the admin role, when they request an admin route, assert the route resolves
   successfully (renders / returns 200). Do not implement the admin guard.
5. **T-2.3.1** (Vitest) - Write a failing integration test. Given a client reviewer in Org A,
   when they request a facility belonging to Org B by id, assert the request is denied and no
   Org B data is returned in the response body. Do not implement org-scoping.
6. **T-2.4.1** (Vitest) - Write a failing integration test. Given audit logging is enabled, when
   a user logs in, logs out, or is denied access, assert an immutable audit entry is recorded
   capturing actor, event type, and timestamp. Do not implement audit writes.
7. **T-2.5.1** (Vitest) - Write a failing integration test. Given the auth layer, when a user
   record carries an MFA-enabled flag, assert the login flow exposes the MFA step hook while
   password-only users still authenticate unchanged. Do not implement the MFA hook.

### E3 - Org Hierarchy & Dashboards (S2)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-3.1.1 | AC-3.1.1 | Playwright | yes |
| T-3.1.2 | AC-3.1.2 | Vitest | no |
| T-3.2.1 | AC-3.2.1 | Playwright | yes |
| T-3.2.2 | AC-3.2.2 | Vitest | no |
| T-3.3.1 | AC-3.3.1 | Playwright | yes |
| T-3.4.1 | AC-3.4.1 | Playwright | yes |
| T-3.5.1 | AC-3.5.1 | Playwright | yes |

1. **T-3.1.1** (Playwright) - Write a failing E2E test. Given an org with districts, facilities,
   and buildings, when a staff member drills from org down to building, assert each level
   lists only its direct children. Capture `AC-3.1.1.png` and assert against baseline. Do not
   implement the hierarchy navigation.
2. **T-3.1.2** (Vitest) - Write a failing unit test. Given the hierarchy model, when rendered or
   queried, assert nesting is capped at the three canonical levels below org (district,
   facility, building) and a deeper nesting is rejected or impossible to express. Do not
   implement the cap.
3. **T-3.2.1** (Playwright) - Write a failing E2E test. Given a building page, when a user clicks
   a breadcrumb segment, assert a dropdown of sibling entities at that level opens. Capture
   `AC-3.2.1.png` and assert against baseline. Do not implement the breadcrumb switcher.
4. **T-3.2.2** (Vitest) - Write a failing integration test. Given the breadcrumb dropdown, when
   the user selects a sibling, assert navigation resolves to that sibling at the same
   hierarchy level (correct route/target). Do not implement the navigation.
5. **T-3.3.1** (Playwright) - Write a failing E2E test. Given a district with multiple
   facilities, when the operator admin opens the district dashboard, assert it shows an
   aggregated roll-up of facility and project status. Capture `AC-3.3.1.png` and assert
   against baseline. Do not implement the roll-up.
6. **T-3.4.1** (Playwright) - Write a failing E2E test. Given a facility with no projects, when a
   client reviewer opens it, assert a designed empty state shows a sample preview and exactly
   one clear first action. Capture `AC-3.4.1.png` and assert against baseline. Do not
   implement the empty state.
7. **T-3.5.1** (Playwright) - Write a failing E2E test. Given a building, when a staff member
   stars it, assert it appears in their favorites list and persists across a session reload.
   Capture `AC-3.5.1.png` and assert against baseline. Do not implement favorites.

### E4 - Project & Review Workflow (S2, S0 partial)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-4.1.1 | AC-4.1.1 | Playwright | yes |
| T-4.1.2 | AC-4.1.2 | Vitest | no |
| T-4.2.1 | AC-4.2.1 | Playwright | yes |
| T-4.3.1 | AC-4.3.1 | Vitest | no |
| T-4.3.2 | AC-4.3.2 | Playwright | yes |
| T-4.4.1 | AC-4.4.1 | Playwright | yes |
| T-4.4.2 | AC-4.4.2 | Vitest | no |
| T-4.5.1 | AC-4.5.1 | Vitest | no |

1. **T-4.1.1** (Playwright) - Write a failing E2E test. Given a building, when a staff member
   creates a project with a name and members, assert the project is saved with that
   `building_id` and an initial status and appears in the UI. Capture `AC-4.1.1.png` and
   assert against baseline. Do not implement project creation.
2. **T-4.1.2** (Vitest) - Write a failing integration test. Given project creation, when no
   building is selected, assert creation is blocked with a validation error and nothing is
   persisted. Do not implement the validation.
3. **T-4.2.1** (Playwright) - Write a failing E2E test. Given a project, when a client reviewer
   opens it, assert its current status and progress are displayed and that no staff-only
   editing controls are present. Capture `AC-4.2.1.png` and assert against baseline. Do not
   implement the read-only view.
4. **T-4.3.1** (Vitest) - Write a failing integration test. Given a staff member publishes V1,
   when publication completes, assert the client org's reviewer is notified and the version is
   marked awaiting review. Do not implement the publish/notify flow.
5. **T-4.3.2** (Playwright) - Write a failing E2E test. Given client annotations on V1, when
   staff publish V2, assert V2 becomes current while V1's annotations remain tied to V1 for
   history. Capture `AC-4.3.2.png` and assert against baseline. Do not implement versioning.
6. **T-4.4.1** (Playwright) - Write a failing E2E test. Given a current version, when a client
   reviewer approves it, assert the approval is recorded against that version with actor and
   timestamp and reflected in the UI. Capture `AC-4.4.1.png` and assert against baseline. Do
   not implement approvals.
7. **T-4.4.2** (Vitest) - Write a failing integration test. Given a user without the client
   reviewer role, when they attempt to approve a version, assert the action is denied and no
   approval is recorded. Do not implement the guard.
8. **T-4.5.1** (Vitest) - Write a failing integration test. Given a project, when an operator
   admin removes a member, assert that user loses access to the project on their next request.
   Do not implement membership management.

### E5 - 2D Floorplan Annotation Engine (S3, S0 baseline)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-5.1.1 | AC-5.1.1 | Playwright | yes |
| T-5.1.2 | AC-5.1.2 | Playwright | yes |
| T-5.2.1 | AC-5.2.1 | Playwright | yes |
| T-5.3.1 | AC-5.3.1 | Playwright | yes |
| T-5.3.2 | AC-5.3.2 | Vitest | no |
| T-5.4.1 | AC-5.4.1 | Playwright | yes |
| T-5.5.1 | AC-5.5.1 | Playwright | yes |

1. **T-5.1.1** (Playwright) - Write a failing E2E test. Given a floorplan PDF asset fixture, when
   a staff member opens it, assert the PDF renders in the in-portal viewer at the correct page
   and scale. Capture `AC-5.1.1.png` and assert against baseline. Do not implement the viewer.
2. **T-5.1.2** (Playwright) - Write a failing E2E test. Given a corrupt or unsupported file
   fixture, when it is opened, assert the viewer shows an error state rather than a blank
   canvas. Capture `AC-5.1.2.png` and assert against baseline. Do not implement error
   handling.
3. **T-5.2.1** (Playwright) - Write a failing E2E test. Given the viewer, when a staff member
   selects each ported annotation tool and draws, assert the corresponding annotation is
   created on the canvas for each tool. Capture `AC-5.2.1.png` and assert against baseline. Do
   not implement the tools.
4. **T-5.3.1** (Playwright) - Write a failing E2E test. Given annotations drawn on a floorplan,
   when the page is reloaded, assert the annotations reappear exactly as drawn. Capture
   `AC-5.3.1.png` and assert against baseline. Do not implement persistence.
5. **T-5.3.2** (Vitest) - Write a failing unit test on the engine. Given saved annotations, when
   exported, assert the output is valid JSON that round-trips back into the identical shape
   set (export then import yields equal annotations). Do not implement serialization.
6. **T-5.4.1** (Playwright) - Write a failing E2E test. Given annotations tagged by audience
   layer, when a reviewer toggles the responder layer off, assert only non-responder
   annotations remain visible. Capture `AC-5.4.1.png` and assert against baseline. Do not
   implement layering.
7. **T-5.5.1** (Playwright) - Write a failing E2E test. Given a client reviewer viewing a draft,
   when they place an annotation on a room, assert it is saved against the current version and
   becomes visible to staff. Capture `AC-5.5.1.png` and assert against baseline. Do not
   implement client annotation.

### E6 - Safety Mapping & NFPA Export (S3, S6, S0 partial)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-6.1.1 | AC-6.1.1 | Playwright | yes |
| T-6.1.2 | AC-6.1.2 | Vitest | no |
| T-6.2.1 | AC-6.2.1 | Playwright | yes |
| T-6.3.1 | AC-6.3.1 | Playwright | yes |
| T-6.4.1 | AC-6.4.1 | Vitest | no |
| T-6.4.2 | AC-6.4.2 | Vitest | no |
| T-6.5.1 | AC-6.5.1 | Vitest | no |
| T-6.6.1 | AC-6.6.1 | Playwright | yes |

1. **T-6.1.1** (Playwright) - Write a failing E2E test. Given the NFPA 170 catalog, when a staff
   member places an AED marker, assert it renders with the standardized NFPA 170 symbol.
   Capture `AC-6.1.1.png` and assert against baseline. Do not implement marker placement.
2. **T-6.1.2** (Vitest) - Write a failing unit test. Given the marker tool, when a freehand
   symbol is attempted, assert only catalog symbols are placeable and that no freehand symbol
   creation path exists. Do not implement the catalog constraint.
3. **T-6.2.1** (Playwright) - Write a failing E2E test. Given placed markers, when the legend
   generates, assert it lists one vertical row per marker type with hallway chips and no
   duplicate rows. Capture `AC-6.2.1.png` and assert against baseline. Do not implement legend
   autofit.
4. **T-6.3.1** (Playwright) - Write a failing E2E test. Given a map prepared for export, when it
   renders, assert the output is north-oriented, gridded, and laid out for print. Capture
   `AC-6.3.1.png` and assert against baseline. Do not implement the print render.
5. **T-6.4.1** (Vitest) - Write a failing integration test. Given a building with multiple maps,
   when a staff member queues a batch export, assert an export job is created and a correctly
   ordered multi-page PDF is produced (page order matches map order). Do not implement the
   export pipeline.
6. **T-6.4.2** (Vitest) - Write a failing integration test. Given a queued export job, when it
   fails mid-render, assert the job is marked failed and the partial output is not delivered
   as final. Do not implement failure handling.
7. **T-6.5.1** (Vitest) - Write a failing integration test. Given a multi-floor facility, when a
   map and its markers are saved, assert each carries a z-axis floor label in its compliance
   metadata. Do not implement floor labels.
8. **T-6.6.1** (Playwright) - Write a failing E2E test. Given a marker placed at a known canvas
   point, when the map is re-rendered and exported, assert the marker appears at the same
   coordinates with no drift or jitter (assert exact coordinates within zero tolerance).
   Capture `AC-6.6.1.png` and assert against baseline. Do not implement placement fidelity.

### E7 - Unified Scan Library & Media (S4)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-7.1.1 | AC-7.1.1 | Playwright | yes |
| T-7.2.1 | AC-7.2.1 | Vitest | no |
| T-7.2.2 | AC-7.2.2 | Vitest | no |
| T-7.3.1 | AC-7.3.1 | Playwright | yes |
| T-7.4.1 | AC-7.4.1 | Vitest | no |
| T-7.4.2 | AC-7.4.2 | Vitest | no |
| T-7.5.1 | AC-7.5.1 | Vitest | no |

1. **T-7.1.1** (Playwright) - Write a failing E2E test. Given a facility with mixed media, when
   the library opens, assert floorplan PDFs, point clouds, splats, walkthrough videos, and
   reference images all list together in one view. Capture `AC-7.1.1.png` and assert against
   baseline. Do not implement the library view.
2. **T-7.2.1** (Vitest) - Write a failing integration test. Given a large scan file uploaded via
   multipart, when all parts are sent, assert they assemble into one R2 object on the
   `DOCUMENTS` binding and the asset becomes available. Do not implement multipart assembly.
3. **T-7.2.2** (Vitest) - Write a failing integration test. Given a multipart upload interrupted
   partway, when it is resumed, assert it completes without re-uploading already-sent parts.
   Do not implement resumable upload.
4. **T-7.3.1** (Playwright) - Write a failing E2E test. Given an existing asset, when a new scan
   is uploaded for the same building, assert it is stored as a new version carrying capture
   date and surveyor while prior versions remain intact. Capture `AC-7.3.1.png` and assert
   against baseline. Do not implement versioning.
5. **T-7.4.1** (Vitest) - Write a failing integration test. Given a master PLY point cloud, when
   it is ingested, assert it is written to the cold storage tier. Do not implement tiering.
6. **T-7.4.2** (Vitest) - Write a failing integration test. Given a client request for an asset,
   when the asset is a master PLY, assert it is never served to the client (request denied or
   substituted). Do not implement the serving rule.
7. **T-7.5.1** (Vitest) - Write a failing integration test. Given a scan for client delivery,
   when the viewer requests it, assert it is served as SPZ and not PLY. Do not implement
   format-on-delivery.

### E8 - 3D Scan Viewer (S5)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-8.1.1 | AC-8.1.1 | Playwright | yes |
| T-8.2.1 | AC-8.2.1 | Playwright | yes |
| T-8.2.2 | AC-8.2.2 | Playwright | yes |
| T-8.3.1 | AC-8.3.1 | Playwright | yes |
| T-8.4.1 | AC-8.4.1 | Playwright | yes |
| T-8.4.2 | AC-8.4.2 | Vitest | no |
| T-8.5.1 | AC-8.5.1 | Playwright | yes |
| T-8.6.1 | AC-8.6.1 | Playwright | yes |
| T-8.7.1 | AC-8.7.1 | Playwright | yes |

1. **T-8.1.1** (Playwright) - Write a failing E2E test. Given a facility with a walkthrough mp4,
   when a first responder opens it, assert the video plays with standard transport controls on
   the device. Capture `AC-8.1.1.png` and assert against baseline. Do not implement the
   player.
2. **T-8.2.1** (Playwright) - Write a failing E2E test. Given an SPZ scan, when the splat viewer
   loads, assert the scene renders and responds to orbit, fly, and walk camera modes. Capture
   `AC-8.2.1.png` and assert against baseline. Do not implement the viewer.
3. **T-8.2.2** (Playwright) - Write a failing E2E test. Given a device/context without WebGL2,
   when the viewer loads, assert it shows a graceful fallback message rather than a broken
   canvas. Capture `AC-8.2.2.png` and assert against baseline. Do not implement the fallback.
4. **T-8.3.1** (Playwright) - Write a failing E2E test. Given a loaded scan, when a staff member
   picks two points, assert a point-to-point distance is reported in real-world units. Capture
   `AC-8.3.1.png` and assert against baseline. Do not implement measurement.
5. **T-8.4.1** (Playwright) - Write a failing E2E test. Given a scan, when a staff member drops a
   marker with a title, description, and saved viewpoint, assert it anchors at that 3D
   position and reloads in place after a page reload. Capture `AC-8.4.1.png` and assert
   against baseline. Do not implement 3D markers.
6. **T-8.4.2** (Vitest) - Write a failing unit test. Given a scene at the marker cap, when
   another marker is added, assert the cap is enforced and a clear message is surfaced. Do not
   implement the cap.
7. **T-8.5.1** (Playwright) - Write a failing E2E test. Given a multi-floor facility, when a
   responder switches floors, assert the viewer loads the selected floor's scan and updates
   the active-floor indicator. Capture `AC-8.5.1.png` and assert against baseline. Do not
   implement floor switching.
8. **T-8.6.1** (Playwright) - Write a failing E2E test. Given a scan, when a staff member saves a
   named viewpoint and later selects it, assert the camera returns to the stored position,
   target, and FOV. Capture `AC-8.6.1.png` and assert against baseline. Do not implement
   viewpoints.
9. **T-8.7.1** (Playwright) - Write a failing E2E test. Given two scan versions, when a client
   reviewer compares them, assert both capture dates are shown and the viewer can swap between
   versions. Capture `AC-8.7.1.png` and assert against baseline. Do not implement version
   compare.

### E9 - Collaboration (S6)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-9.1.1 | AC-9.1.1 | Playwright | yes |
| T-9.1.2 | AC-9.1.2 | Vitest | no |
| T-9.2.1 | AC-9.2.1 | Playwright | yes |
| T-9.3.1 | AC-9.3.1 | Vitest | no |
| T-9.3.2 | AC-9.3.2 | Vitest | no |
| T-9.4.1 | AC-9.4.1 | Vitest | no |
| T-9.5.1 | AC-9.5.1 | Playwright | yes |
| T-9.5.2 | AC-9.5.2 | Vitest | no |

1. **T-9.1.1** (Playwright) - Write a failing E2E test. Given a map region or 3D marker, when a
   client reviewer starts a thread, assert the comment anchors to that location and renders
   for all participants. Capture `AC-9.1.1.png` and assert against baseline. Do not implement
   threads.
2. **T-9.1.2** (Vitest) - Write a failing integration test. Given an existing thread, when a
   participant replies, assert the reply nests under the thread in chronological order. Do not
   implement replies.
3. **T-9.2.1** (Playwright) - Write a failing E2E test. Given an open thread, when a staff member
   resolves it, assert it is hidden from the default view but retained in the record and not
   deleted. Capture `AC-9.2.1.png` and assert against baseline. Do not implement resolve.
4. **T-9.3.1** (Vitest) - Write a failing integration test. Given a comment, when a client
   reviewer @-mentions a staff member, assert that member receives an email containing a deep
   link to the comment. Do not implement mention email.
5. **T-9.3.2** (Vitest) - Write a failing integration test. Given an @-mention of a user outside
   the org, when submitted, assert the mention is rejected and no email is sent. Do not
   implement the org guard.
6. **T-9.4.1** (Vitest) - Write a failing integration test. Given multiple activity events for one
   user within a batching window, when the digest sends, assert they arrive as a single
   batched notification. Do not implement batching.
7. **T-9.5.1** (Playwright) - Write a failing E2E test. Given a map or scan, when an operator
   admin creates a share link, assert an unauthenticated visitor with the link sees only that
   scoped resource. Capture `AC-9.5.1.png` and assert against baseline. Do not implement share
   links.
8. **T-9.5.2** (Vitest) - Write a failing integration test. Given a revoked share link, when it
   is opened, assert access is denied. Do not implement revocation.

### E10 - Global Search (S6)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-10.1.1 | AC-10.1.1 | Playwright | yes |
| T-10.2.1 | AC-10.2.1 | Vitest | no |
| T-10.3.1 | AC-10.3.1 | Playwright | yes |

1. **T-10.1.1** (Playwright) - Write a failing E2E test. Given indexed content, when a staff
   member searches a term, assert matching facilities, buildings, projects, documents, and
   marker labels are returned grouped by type. Capture `AC-10.1.1.png` and assert against
   baseline. Do not implement search.
2. **T-10.2.1** (Vitest) - Write a failing integration test. Given a client reviewer in Org A,
   when they search a term that also matches Org B content, assert only Org A results are
   returned. Do not implement search scoping.
3. **T-10.3.1** (Playwright) - Write a failing E2E test. Given a large set of facilities, when a
   staff member searches by name, assert a matching facility is reachable directly from
   results without hierarchy traversal. Capture `AC-10.3.1.png` and assert against baseline.
   Do not implement search-centric navigation.

### E11 - Compliance & Trust (S7)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-11.1.1 | AC-11.1.1 | Vitest | no |
| T-11.1.2 | AC-11.1.2 | Vitest | no |
| T-11.2.1 | AC-11.2.1 | Playwright | yes |
| T-11.3.1 | AC-11.3.1 | Vitest | no |
| T-11.3.2 | AC-11.3.2 | Vitest | no |
| T-11.4.1 | AC-11.4.1 | Playwright | yes |
| T-11.5.1 | AC-11.5.1 | Playwright | yes |

1. **T-11.1.1** (Vitest) - Write a failing integration test. Given a facility with structure and
   point data, when a compliance officer exports GeoJSON, assert the output conforms to the
   NENA STA-006 schema (validate against the schema). Do not implement the export.
2. **T-11.1.2** (Vitest) - Write a failing integration test. Given a facility missing required
   NENA fields, when export is attempted, assert the export reports the missing fields rather
   than producing invalid GIS output. Do not implement validation.
3. **T-11.2.1** (Playwright) - Write a failing E2E test. Given a facility, when a compliance
   officer edits compliance metadata, assert last-reviewed date, last responder tour, mandate
   flags, and drill links are saved. Capture `AC-11.2.1.png` and assert against baseline. Do
   not implement the metadata editor.
4. **T-11.3.1** (Vitest) - Write a failing integration test. Given audit entries, when a
   compliance officer exports the log, assert it contains who viewed, edited, and exported
   which map and when. Do not implement export.
5. **T-11.3.2** (Vitest) - Write a failing integration test. Given an existing audit entry, when
   any actor attempts to alter it, assert the entry cannot be modified or deleted. Do not
   implement immutability.
6. **T-11.4.1** (Playwright) - Write a failing E2E test. Given the deployment, when a visitor
   opens the trust page, assert it states the application-level controls and compliance
   posture for the active brand. Capture `AC-11.4.1.png` and assert against baseline. Do not
   implement the trust page.
7. **T-11.5.1** (Playwright) - Write a failing E2E test. Given a facility whose last-reviewed
   date has passed the staleness threshold, when the reminder check runs, assert the facility
   is flagged for re-verification. Capture `AC-11.5.1.png` and assert against baseline. Do not
   implement the reminder.

### E12 - Accessibility (S7)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-12.1.1 | AC-12.1.1 | Playwright | yes |
| T-12.2.1 | AC-12.2.1 | Vitest | no |
| T-12.3.1 | AC-12.3.1 | Playwright | yes |
| T-12.4.1 | AC-12.4.1 | Playwright | yes |
| T-12.4.2 | AC-12.4.2 | Vitest | no |

1. **T-12.1.1** (Playwright) - Write a failing E2E test. Given the portal, when a user navigates
   with keyboard only, assert all interactive controls are reachable and operable with a
   visible focus indicator. Capture `AC-12.1.1.png` and assert against baseline. Do not
   implement keyboard nav.
2. **T-12.2.1** (Vitest) - Write a failing unit test (DOM/accessibility-tree assertion). Given
   the interface and map symbols, when inspected by an accessibility checker, assert every
   control and symbol exposes a descriptive accessible label. Do not implement labels.
3. **T-12.3.1** (Playwright) - Write a failing E2E test. Given a map, when a user opens its
   non-visual alternative, assert a text list of rooms, exits, and markers conveys the same
   information as the visual map. Capture `AC-12.3.1.png` and assert against baseline. Do not
   implement the alternative.
4. **T-12.4.1** (Playwright) - Write a failing E2E test. Given the UI, when color contrast is
   measured, assert text and controls meet WCAG 2.1 AA contrast ratios. Capture
   `AC-12.4.1.png` and assert against baseline. Do not implement contrast fixes.
5. **T-12.4.2** (Vitest) - Write a failing unit test. Given a procurement request, when the VPAT
   is requested, assert a maintained VPAT/ACR document is available (present and resolvable).
   Do not author the VPAT.

### E13 - Admin & Platform Ops (S7)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-13.1.1 | AC-13.1.1 | Playwright | yes |
| T-13.1.2 | AC-13.1.2 | Vitest | no |
| T-13.2.1 | AC-13.2.1 | Playwright | yes |
| T-13.2.2 | AC-13.2.2 | Vitest | no |
| T-13.3.1 | AC-13.3.1 | Playwright | yes |
| T-13.4.1 | AC-13.4.1 | Vitest | no |
| T-13.5.1 | AC-13.5.1 | Vitest | no |

1. **T-13.1.1** (Playwright) - Write a failing E2E test. Given the admin area, when an operator
   admin creates a user and assigns a role, assert the user can log in with exactly that
   role's permissions. Capture `AC-13.1.1.png` and assert against baseline. Do not implement
   user management.
2. **T-13.1.2** (Vitest) - Write a failing integration test. Given an active user, when an
   operator admin deactivates them, assert their next request is rejected. Do not implement
   deactivation.
3. **T-13.2.1** (Playwright) - Write a failing E2E test. Given the admin area, when an operator
   admin issues a scoped API key, assert the key authenticates API requests within its scope.
   Capture `AC-13.2.1.png` and assert against baseline. Do not implement key issuance.
4. **T-13.2.2** (Vitest) - Write a failing integration test. Given an issued key, when the admin
   revokes it, assert subsequent requests using that key are rejected. Do not implement
   revocation.
5. **T-13.3.1** (Playwright) - Write a failing E2E test. Given audit entries, when a compliance
   officer filters the in-portal viewer by actor and date, assert only matching entries are
   shown. Capture `AC-13.3.1.png` and assert against baseline. Do not implement the viewer.
6. **T-13.4.1** (Vitest) - Write a failing integration test. Given the settings area, when an
   operator admin changes a deployment-wide setting, assert the change persists and takes
   effect without a code change. Do not implement settings.
7. **T-13.5.1** (Vitest) - Write a failing integration test. Given a runtime error in the
   deployment, when it occurs, assert it is captured in the observability output with enough
   context to diagnose it (actor/route/stack present). Do not implement observability.

### E14 - Quality & Delivery Harness (S1, always-on)

| Test ID | AC | Tool | Screenshot |
|---|---|---|---|
| T-14.1.1 | AC-14.1.1 | Vitest | no |
| T-14.2.1 | AC-14.2.1 | Vitest | no |
| T-14.3.1 | AC-14.3.1 | Playwright | yes |
| T-14.3.2 | AC-14.3.2 | Vitest | no |
| T-14.4.1 | AC-14.4.1 | Vitest | no |
| T-14.5.1 | AC-14.5.1 | Vitest | no |

1. **T-14.1.1** (Vitest) - Write a failing meta-test. Given a new acceptance criterion, when its
   test `T-<AC>` is first written, assert it fails against the unimplemented feature before any
   implementation exists (assert the red state is reachable and meaningful). Do not implement
   the feature under test.
2. **T-14.2.1** (Vitest) - Write a failing meta-test. Given a ported engine, when its extraction
   lands, assert it ships with passing Vitest unit tests covering its core logic (assert the
   engine test file exists and exercises core paths). Do not port the engine.
3. **T-14.3.1** (Playwright) - Write a failing E2E test. Given a UI-visible outcome, when its
   Playwright test runs, assert a screenshot is captured and compared against the stored
   baseline. Capture `AC-14.3.1.png` and assert against baseline. Do not implement the UI.
4. **T-14.3.2** (Vitest) - Write a failing meta-test. Given a visual regression, when the
   screenshot differs beyond threshold, assert the test fails (drive a synthetic diff and
   assert the comparator reports failure). Do not implement the comparator.
5. **T-14.4.1** (Vitest) - Write a failing meta-test. Given a change is pushed, when CI runs,
   assert the full Vitest and Playwright suite runs and merge is blocked on any failure
   (assert the CI config invokes both suites and gates merge). Do not author the CI workflow.
6. **T-14.5.1** (Vitest) - Write a failing meta-test. Given a deploy, when `wrangler pages
   deploy` runs, assert it targets the `pathfinder` Pages project and never els911-portal
   production (assert the configured deploy target). Do not author the deploy script.

---

## 6. Coverage & traceability summary

Every AC in `docs/03-acceptance-criteria.md` has exactly one corresponding test prompt.

| Epic | #ACs | #Vitest tests | #Playwright tests | #screenshots |
|---|---|---|---|---|
| E1 | 8 | 3 | 5 | 5 |
| E2 | 7 | 4 | 3 | 3 |
| E3 | 7 | 2 | 5 | 5 |
| E4 | 8 | 4 | 4 | 4 |
| E5 | 7 | 1 | 6 | 6 |
| E6 | 8 | 4 | 4 | 4 |
| E7 | 7 | 5 | 2 | 2 |
| E8 | 9 | 1 | 8 | 8 |
| E9 | 8 | 5 | 3 | 3 |
| E10 | 3 | 1 | 2 | 2 |
| E11 | 7 | 4 | 3 | 3 |
| E12 | 5 | 2 | 3 | 3 |
| E13 | 7 | 4 | 3 | 3 |
| E14 | 6 | 5 | 1 | 1 |
| **Total** | **97** | **45** | **52** | **52** |

Totals: 97 test prompts, 45 Vitest, 52 Playwright, 52 screenshots. Every Playwright test in
this plan corresponds to a `[screenshot]`-tagged AC, so the Playwright count and screenshot
count match.

---

## 7. Sprint test focus

Each sprint's Definition of Done requires its listed test groups to be green (alongside the
always-on E14 harness, which must be green from S1 onward). Sprints reuse and do not regress
earlier groups; the suite is cumulative.

| Sprint | Theme | Test groups green at DoD |
|---|---|---|
| S0 | Baseline (retroactive) - document v1 engine + schema | Inherited foundation documented for E5, E6, E4, E2 partial; baseline engine specs scaffolded (no new green required beyond documentation) |
| S1 | Foundation - scaffold, brand, auth port, harness | T-1.x (E1), T-2.x (E2), T-14.x (E14) all green |
| S2 | Hierarchy - org/district/facility/building + dashboards | T-3.x (E3), T-4.x (E4) green |
| S3 | Engine port - 2D annotation + map/NFPA export | T-5.x (E5), T-6.x (E6) green |
| S4 | Scan library - media_assets, R2 multipart, archive | T-7.x (E7) green |
| S5 | 3D viewer - mp4 + Spark + measurement + markers | T-8.x (E8) green |
| S6 | Search & collaboration - FTS5, batch export, comments | T-10.x (E10), T-9.x (E9), and E6 export/legend group (T-6.4.x) green |
| S7 | Compliance, accessibility, ops, launch | T-11.x (E11), T-12.x (E12), T-13.x (E13) green; full cumulative suite green for launch |

At every sprint DoD, `npm run test` (full Vitest + Playwright) must pass with no skipped or
failing in-scope test, and CI must block merge on any failure (`AC-14.4.1`).
