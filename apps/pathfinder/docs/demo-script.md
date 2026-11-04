# Pathfinder - Live Demo Script

A ~12-15 minute guided walkthrough of the running portal. Live URL:
**https://pathfinder-c3o.pages.dev**. Demo login: `test@test.com` / `test1234`
(admin). A client account `client@test.com` / `test1234` shows the scoped,
read-only side.

> The end-to-end test `tests/e2e/demo-flow.spec.ts` walks this exact path, so if
> the suite is green the demo works. Run `npm run test:e2e demo-flow` to rehearse.

---

## 0. Framing (30s, before you click)

> "Pathfinder is an open-core, white-label portal for emergency floorplan
> mapping and 3D facility documentation. It's a SvelteKit + Cloudflare rewrite
> of a shipped product - we kept the battle-tested 2D annotation and NFPA
> export engines and added a multi-tenant hierarchy, 3D Gaussian-splat scans,
> collaboration, search, and NG911 compliance export. Everything you'll see is
> running on Cloudflare's edge - D1, R2, KV - with server-side RBAC on every
> route."

---

## 1. Sign in -> the roll-up dashboard (1 min)

1. Open the live URL. Note the **branding** - this is the Pathfinder profile.
   Mention: *"the entire look is a drop-in brand layer; the same code ships as
   ELS911 or a reseller by swapping one profile - no component edits."*
2. Sign in as admin. Land on the **dashboard**.
3. Point at the **roll-up cards** (districts / facilities / buildings /
   projects) and the **recent activity feed**.

**Talking point:** *"Counts aggregate over the caller's scope. An admin sees
everything; a district client sees only their own org - enforced server-side,
not in the UI."*

## 2. Navigate the hierarchy (1 min)

1. Click into **Wellsboro Area High School** (a facility).
2. Note the **breadcrumb switcher** (click a segment -> jump to siblings) and
   the **NG911 export** button (we'll come back to it).
3. Click into the **Main Building**.

**Talking point:** *"District > Facility > Building, capped at three levels, with
search-friendly navigation - this is the backbone everything attaches to."*

## 3. The scan library (1 min)

On the building page, show **Scans & media**:
- All five asset types in one view: floorplan PDF, point cloud (master),
  splat, walkthrough video, reference image.
- The master point cloud shows **archived** - *"raw PLY is cold-archived and
  never served; clients only get the delivery formats, SPZ + mp4."*
- Capture date + surveyor metadata for field verification.
- The uploader uses **resumable R2 multipart** for the hundred-megabyte scans.

## 4. The 2D floorplan viewer - the core engine (3 min)

Open **WAHS Main - Floor 1.pdf** (the floorplan link).

1. **Annotation tools** - point at the 12-tool palette: circle, rect, arrow,
   freehand, comment, correction, and the six NFPA safety markers (AED, stairs,
   door, overhead, exit, fire extinguisher). Draw one or two. *"Coordinates are
   normalized 0-1, so they're resolution-independent."*
2. **Select + drag** an annotation to move it; **undo/redo** (Ctrl+Z/Y);
   **delete** prompts a confirm.
3. **Responder layer toggle** - flip the safety markers off/on.
4. **Comments** (right panel): select an annotation, leave a comment, reply,
   `@mention` a teammate, attach an image, then **resolve** it (it hides but is
   retained for the audit trail).
5. Switch to **Map mode**: place wayfinding markers (stairs/door/elevator),
   draw a **hallway polygon** (click vertices, Enter to close; drag a vertex to
   reshape), and draw a **crop** for the printed page.
6. Pick a **print style** (command / blueprint / field) and click
   **Export NFPA map** - a print-ready PDF with the autofit legend, north
   arrow, grid, and per-floor crops. Also show **Export annotated PDF** and
   **Export JSON**.
7. **Accessibility:** expand *"Text alternative for this floor"* - a
   screen-reader-friendly list of every exit, AED, and marker.
8. **AI responder briefing** (if a provider is configured): click **AI briefing**
   - it turns the *same marked data* into a natural-language responder paragraph.
   *"Grounded on the markers, so it can't invent exits or give advice it wasn't
   given. It's model-independent: Cloudflare Workers AI with no key, or Mistral/
   OpenAI/Groq/Ollama by setting a key + base URL in admin settings - swap
   models without a redeploy."*

**Talking point:** *"This is the de-risked part - the annotation and NFPA-export
math is the proven v1 engine, extracted into framework-agnostic TypeScript
modules with characterization tests, then mounted in a thin Svelte shell."*

## 5. The 3D scan viewer (2 min)

Back on the building, open the **splat** (or the walkthrough video) from the
scan library -> `/scans/...`.

- **mp4 walkthrough** is the zero-friction baseline every responder can use.
- The **splat viewer** (Spark / THREE.js, WebGL2) loads the SPZ; orbit around.
- **Measure** point-to-point in real units; drop a **3D marker**; save a
  **viewpoint** and jump back to it; switch **floors** / compare capture dates.

**Talking point:** *"This is the wedge - incumbents ship 2D plans and 360 photos;
we make a measurable 3D digital twin the primary artifact, delivered as SPZ
(~90% smaller than PLY, mobile-safe)."*

## 6. Review workflow (1 min)

On the building, in **Projects**: create a project, **Submit for review**,
**Publish version** (members are notified), then **Approve** - the approval is
recorded with actor + timestamp. Show that a **client reviewer** sees status
and progress but none of the staff edit controls.

## 7. Global search (45s)

Top nav -> **Search**. Type `Wellsboro` -> jump straight to the facility. Type
`main` -> results span buildings + floorplans, grouped by type. *"FTS5 across
facilities, buildings, projects, documents and markers - and a client only ever
sees their own org's results."*

## 8. Compliance & trust (1 min)

1. Back on the **facility** page: show the **compliance metadata** editor
   (last reviewed, responder tour, Alyssa's/Kari's Law flags), the
   **staleness flag** for an overdue review, and any **missing-field** warning.
2. Click **Export NG911 (NENA GeoJSON)** - a standards-aligned FeatureCollection
   with **z-axis floor labels** and a confidence field per feature.
3. Open **/trust** (public) - the brand's security & compliance posture.

**Talking point:** *"NENA conformance and accessibility are launch gates for the
gov/edu buyer - any single gap is procurement-disqualifying, so they're built
in, not bolted on."*

## 9. Admin & platform ops (1 min)

Top nav -> **Admin** (admin only; a client gets a clean 403 screen). Show:
platform stats, **create a user** with a role, **issue an API key** (shown
once, scoped read/write), **deployment settings**, and the **audit viewer**
with actor/date filtering + immutable CSV export.

## 10. Close (30s)

> "Open-core: the Community Edition is AGPL and self-hostable; Pathfinder Pro
> adds the white-label multi-brand layer, the interactive splat viewer, the
> batch pipeline, SSO/MFA and Stripe billing. It's live on Cloudflare today,
> with 179 unit + 58 end-to-end tests green and CI gating every change."

---

## Reset / rehearse

- Re-seed demo data locally: `npm run db:seed:hierarchy:local`.
- Rehearse the whole path headless: `npm run test:e2e demo-flow`.
- Remote demo data is already seeded; the scratch document
  (`WAHS scratch sheet.pdf`) is safe to draw on without disturbing the others.
