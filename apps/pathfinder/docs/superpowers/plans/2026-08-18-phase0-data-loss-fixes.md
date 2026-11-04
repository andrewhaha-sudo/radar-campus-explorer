# Phase 0: Stop The Data Loss - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five defects that silently destroy user work, in both the live v1 portal and the v2 rewrite, before any schema redesign begins.

**Architecture:** Five independent fixes, no shared code, no ordering dependency between them. Tasks 1 and 5 touch the LIVE production v1 app (`els911-portal`, serving `portal.els911.com`); Tasks 2, 3 and 4 touch v2 (`pathfinder`). v1 has no test framework, so its tasks are verified by direct D1 query and manual reproduction; v2 tasks are strict TDD via Vitest.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Pages Functions, vanilla JS (v1), SvelteKit + Svelte 5 runes + Vitest (v2), jsPDF, PDF.js.

**Backup:** A verified pre-change backup of both databases and all 11 source PDFs is at
`~/backups/els911-mapping-2026-08-18/` (see its `README.md` for restore commands). Task 1
alters a live production table; do not start it without confirming that backup exists.

---

## Defects addressed

| ID | Repo | Defect |
|---|---|---|
| H1 | els911-portal | `map_markers.type` CHECK omits `'room'`, but the room tool shipped. One room marker fails the whole `DB.batch()`, rolling back every marker in the session. |
| M1 | els911-portal | Marker save errors are swallowed; the unload guard checks the annotation dirty flag, not the marker one. |
| H2 | pathfinder | No autosave and no `beforeunload` handler. Navigating away loses every unsaved marker edit. |
| H3 | pathfinder | Batch export hardcodes `getPage(1)` and filters `m.page === 1`. A 3-floor plan exports as one floor. |
| M2 | pathfinder | PDF fetch/parse failure silently renders a blank page instead of reporting an error. |

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `~/dev/els911-portal/schema.sql` | Canonical v1 schema; CHECK constraint corrected | 1 |
| `~/dev/els911-portal/migrations/0001_map_markers_room_type.sql` (create) | The rebuild statement actually applied to live D1 | 1 |
| `~/dev/els911-portal/functions/api/[[route]].js` | Reject unknown marker types with a 400 before reaching D1 | 1 |
| `~/dev/els911-portal/public/js/viewer.js` | Surface save failures; fix unload guard | 5 |
| `~/dev/pathfinder/src/routes/documents/[id]/+page.svelte` | Autosave + unload guard | 2 |
| `~/dev/pathfinder/src/lib/engines/map-export/export-client.ts` | Multi-page render; propagate load failure | 3, 4 |
| `~/dev/pathfinder/tests/unit/export-client-pages.test.ts` (create) | Page-selection logic under test | 3 |
| `~/dev/pathfinder/src/lib/engines/map-export/pages.ts` (create) | Pure page-selection function, Node-testable | 3 |

---

## Task 1: H1 - Allow `room` markers to save (LIVE PRODUCTION)

**Repo:** `~/dev/els911-portal`

**Files:**
- Create: `migrations/0001_map_markers_room_type.sql`
- Modify: `schema.sql:162`
- Modify: `functions/api/[[route]].js` (in `handleMapMarkersBatch`, before the batch is built)

`map_markers` is referenced by no foreign key, so a table rebuild is safe. SQLite cannot
alter a CHECK constraint in place; rebuild is the only option.

- [ ] **Step 1: Confirm the backup exists before touching production**

```bash
ls -l ~/backups/els911-mapping-2026-08-18/els911-portal-FULL.sql
sqlite3 ~/backups/els911-mapping-2026-08-18/v1.db "SELECT COUNT(*) FROM map_markers;"
```

Expected: the file exists and the count is `112`. If either fails, STOP and re-take the backup.

- [ ] **Step 2: Reproduce the bug against the live schema locally**

```bash
cd ~/backups/els911-mapping-2026-08-18
sqlite3 v1.db "INSERT INTO map_markers (id,doc_id,page,type,label,nx,ny,created_by) \
  SELECT 'probe-1', doc_id, 1, 'room', 'R1', 0.5, 0.5, created_by FROM map_markers LIMIT 1;"
```

Expected: `Runtime error: CHECK constraint failed: map_markers`. This is the defect.

- [ ] **Step 3: Write the migration**

Create `migrations/0001_map_markers_room_type.sql`:

```sql
-- 0001: allow 'room' in map_markers.type
--
-- The room marker tool shipped in commit a882593 but schema.sql was never updated.
-- Because handleMapMarkersBatch writes every marker in a single DB.batch(), one room
-- marker fails the CHECK and rolls back the entire save - losing that session's
-- stairs, hallways and doors as well.
--
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt. No foreign
-- key references map_markers, so this is safe. Plain SQL only; D1 rejects some PRAGMAs.

CREATE TABLE map_markers_new (
  id           TEXT PRIMARY KEY,
  doc_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page         INTEGER NOT NULL DEFAULT 1,
  type         TEXT NOT NULL CHECK (type IN ('stairs','hallway','door','elevator','room')),
  label        TEXT NOT NULL,
  label_pinned INTEGER NOT NULL DEFAULT 0,
  nx           REAL NOT NULL,
  ny           REAL NOT NULL,
  label_nx     REAL DEFAULT NULL,
  label_ny     REAL DEFAULT NULL,
  points       TEXT DEFAULT NULL,
  extra_labels TEXT DEFAULT NULL,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO map_markers_new
  SELECT id, doc_id, page, type, label, label_pinned, nx, ny,
         label_nx, label_ny, points, extra_labels, created_by, created_at
  FROM map_markers;

DROP TABLE map_markers;

ALTER TABLE map_markers_new RENAME TO map_markers;

CREATE INDEX IF NOT EXISTS idx_map_markers_doc_id ON map_markers(doc_id);
```

- [ ] **Step 4: Rehearse the migration on the backup copy, verifying no row loss**

```bash
cd ~/backups/els911-mapping-2026-08-18
rm -f rehearse.db && sqlite3 rehearse.db < els911-portal-FULL.sql
sqlite3 rehearse.db "SELECT COUNT(*) FROM map_markers;"
sqlite3 rehearse.db < ~/dev/els911-portal/migrations/0001_map_markers_room_type.sql
sqlite3 rehearse.db "SELECT COUNT(*) FROM map_markers;"
sqlite3 rehearse.db "INSERT INTO map_markers (id,doc_id,page,type,label,nx,ny,created_by) \
  SELECT 'probe-1', doc_id, 1, 'room', 'R1', 0.5, 0.5, created_by FROM map_markers LIMIT 1;"
sqlite3 rehearse.db "SELECT COUNT(*) FROM map_markers WHERE type='room';"
```

Expected: `112`, then `112` (no rows lost), then no error on the room insert, then `1`.
If the two counts differ, STOP.

- [ ] **Step 5: Apply to the live database**

```bash
cd ~/dev/els911-portal
npx wrangler d1 execute els911-portal --remote \
  --file migrations/0001_map_markers_room_type.sql
```

Expected: success, no error output.

- [ ] **Step 6: Verify production**

```bash
npx wrangler d1 execute els911-portal --remote --json \
  --command "SELECT COUNT(*) AS n FROM map_markers" | grep -o '"n":[0-9]*'
npx wrangler d1 execute els911-portal --remote --json \
  --command "SELECT sql FROM sqlite_master WHERE name='map_markers'" | grep -o "room"
```

Expected: `"n":112` and `room`. If the count is not 112, restore from the backup immediately
using the commands in `~/backups/els911-mapping-2026-08-18/README.md`.

- [ ] **Step 7: Update `schema.sql` so a fresh deploy matches production**

In `~/dev/els911-portal/schema.sql:162`, replace:

```sql
  type         TEXT NOT NULL CHECK (type IN ('stairs','hallway','door','elevator')),
```

with:

```sql
  type         TEXT NOT NULL CHECK (type IN ('stairs','hallway','door','elevator','room')),
```

- [ ] **Step 8: Make an unknown type a clean 400 instead of a silent batch rollback**

In `functions/api/[[route]].js`, in `handleMapMarkersBatch`, immediately after:

```js
  const markers = body.markers;
  if (!Array.isArray(markers)) return err('markers must be an array.');
```

insert:

```js
  const VALID_MARKER_TYPES = new Set(['stairs', 'hallway', 'door', 'elevator', 'room']);
  const badType = markers.find(m => !VALID_MARKER_TYPES.has(m.type));
  if (badType) return err(`Unknown marker type "${badType.type}".`, 400);
```

This turns a whole-session data loss into a rejected request with a readable reason. It is
the guard that would have made H1 visible the day it shipped.

- [ ] **Step 9: Commit**

```bash
cd ~/dev/els911-portal
git add schema.sql migrations/0001_map_markers_room_type.sql "functions/api/[[route]].js"
git commit -m "fix: allow room markers to save

The room tool shipped without a schema update, so map_markers.type CHECK
rejected it. Saves run as one DB.batch(), so a single room marker rolled
back every stair, hallway and door in that session. Rebuilds the table with
room permitted and rejects unknown types with a 400 instead of a rollback."
```

---

## Task 2: H2 - Autosave and unload guard in v2

**Repo:** `~/dev/pathfinder`

**Files:**
- Modify: `src/routes/documents/[id]/+page.svelte` (after `saveMarkers`, around line 876; and the `<svelte:window>` tag at line 1132)

- [ ] **Step 1: Add a debounced autosave after `saveMarkers`**

`saveMarkers` ends at line 876. Immediately after its closing brace, add:

```js
	// Autosave: markers are the only place a user does dozens of small edits in a
	// row, so an explicit-save-only model loses work. 800ms matches v1's debounce.
	let mapSaveTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleMapSave() {
		if (mapSaveTimer) clearTimeout(mapSaveTimer);
		mapSaveTimer = setTimeout(() => {
			mapSaveTimer = null;
			if (mapDirty && !saving) saveMarkers();
		}, 800);
	}

	function beforeUnload(e: BeforeUnloadEvent) {
		if (!mapDirty && !dirty) return;
		e.preventDefault();
		e.returnValue = '';
	}
```

- [ ] **Step 2: Trigger the autosave whenever markers change**

`mapDirty = true` appears at lines 571, 579, 670, 696, 731, 743, 782, 796, 822 and 845.
Replace every one of those ten occurrences with:

```js
			mapDirty = true;
			scheduleMapSave();
```

preserving each site's existing indentation.

- [ ] **Step 3: Wire the unload guard**

At line 1132, replace:

```svelte
<svelte:window onkeydown={onKey} onkeyup={onKeyUp} />
```

with:

```svelte
<svelte:window onkeydown={onKey} onkeyup={onKeyUp} onbeforeunload={beforeUnload} />
```

- [ ] **Step 4: Verify the checks pass**

```bash
cd ~/dev/pathfinder
npm run check && npm run test:unit
```

Expected: svelte-check clean, all unit tests pass.

- [ ] **Step 5: Verify the behaviour manually**

Run `npm run dev`, open a document, enter map mode, place a marker, and without clicking
Save wait one second. Expected: the "Save map" button flips to "Saved" on its own. Then
place another marker and immediately attempt to close the tab. Expected: the browser's
"Leave site?" prompt appears.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/documents/[id]/+page.svelte"
git commit -m "fix: autosave map markers and guard against unload

Marker edits lived only in memory until an explicit Save, so navigating
away discarded them silently. Adds an 800ms debounced autosave on every
marker mutation plus a beforeunload guard covering both dirty flags."
```

---

## Task 3: H3 - Batch export must render every floor

**Repo:** `~/dev/pathfinder`

**Files:**
- Create: `src/lib/engines/map-export/pages.ts`
- Create: `tests/unit/export-client-pages.test.ts`
- Modify: `src/lib/engines/map-export/export-client.ts:18-70`

The page-selection rule is pure logic, so it is extracted into its own module and tested in
Node. The PDF.js render loop around it stays untested (it needs a real browser canvas).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/export-client-pages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pagesToExport } from '../../src/lib/engines/map-export/pages';
import type { MapMarker } from '../../src/lib/engines/map-export/markers';

function mk(page: number): MapMarker {
	return { id: `m${page}`, page, type: 'stairs', label: 'S1', nx: 0.5, ny: 0.5 } as MapMarker;
}

describe('pagesToExport', () => {
	it('returns page 1 when there are no markers', () => {
		expect(pagesToExport([], 5)).toEqual([1]);
	});

	it('returns every page that carries a marker, ascending', () => {
		expect(pagesToExport([mk(3), mk(1), mk(2)], 5)).toEqual([1, 2, 3]);
	});

	it('deduplicates pages with several markers', () => {
		expect(pagesToExport([mk(2), mk(2), mk(2)], 5)).toEqual([2]);
	});

	it('drops pages beyond the document page count', () => {
		expect(pagesToExport([mk(1), mk(9)], 3)).toEqual([1]);
	});

	it('drops non-positive page numbers', () => {
		expect(pagesToExport([mk(0), mk(-1), mk(2)], 3)).toEqual([2]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/pathfinder
npx vitest run tests/unit/export-client-pages.test.ts
```

Expected: FAIL - cannot resolve `../../src/lib/engines/map-export/pages`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/engines/map-export/pages.ts`:

```ts
// Which pages of a source PDF belong in a map export. Extracted from export-client
// so the rule is testable in Node - the surrounding PDF.js render needs a browser.

import type { MapMarker } from './markers';

/** Ascending, deduplicated list of pages carrying markers; [1] when there are none. */
export function pagesToExport(markers: MapMarker[], pageCount: number): number[] {
	const pages = new Set<number>();
	for (const m of markers) {
		if (Number.isInteger(m.page) && m.page >= 1 && m.page <= pageCount) pages.add(m.page);
	}
	if (pages.size === 0) return [1];
	return [...pages].sort((a, b) => a - b);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/export-client-pages.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Replace the single-page render with a multi-page loop**

In `src/lib/engines/map-export/export-client.ts`, replace lines 17-42 (the whole
`renderFirstPage` function) with:

```ts
/** Render the requested pages of a PDF to JPEG data URLs. Throws if the PDF cannot
 *  be fetched or parsed - callers decide whether that is fatal. */
async function renderPages(fileUrl: string, markers: MapMarker[]): Promise<ExportPageInput[]> {
	const pdfjs = await import('pdfjs-dist');
	pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
	const res = await fetch(fileUrl);
	if (!res.ok) throw new Error(`Could not fetch the source PDF (HTTP ${res.status}).`);
	const buf = await res.arrayBuffer();
	const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;

	const out: ExportPageInput[] = [];
	for (const n of pagesToExport(markers, doc.numPages)) {
		const page = await doc.getPage(n);
		const viewport = page.getViewport({ scale: 2 });
		const canvas = document.createElement('canvas');
		canvas.width = viewport.width;
		canvas.height = viewport.height;
		const ctx = canvas.getContext('2d')!;
		// White-fill first: transparent PDF backgrounds otherwise bleed to black in JPEG.
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		await page.render({ canvasContext: ctx, viewport }).promise;
		out.push({
			page: n,
			imageDataUrl: canvas.toDataURL('image/jpeg', 0.95),
			canvasW: canvas.width,
			canvasH: canvas.height,
			markers: markers.filter((m) => m.page === n)
		});
	}
	return out;
}
```

- [ ] **Step 6: Add the import**

At line 8, below the existing `import type { MapMarker } from './markers';`, add:

```ts
import { pagesToExport } from './pages';
```

- [ ] **Step 7: Rewrite `exportDocMap` to emit every page (Task 4 completes this)**

Replace the body of `exportDocMap` (lines 46-70) with:

```ts
export async function exportDocMap(input: DocExportInput): Promise<boolean> {
	const { default: JsPDF } = await import('jspdf');
	const pages = await renderPages(input.fileUrl, input.markers);
	const facilityName = input.filename.replace(/\.[^.]+$/, '');
	const doc = buildMapPdf(
		(orientation, size) => new JsPDF({ orientation, unit: 'mm', format: size }),
		pages,
		{},
		input.markers,
		{ facilityName, brandName: 'Pathfinder' }
	);
	doc.save(exportFilename(input.filename));
	return true;
}
```

- [ ] **Step 8: Run the full suite**

```bash
npm run check && npm run test:unit
```

Expected: svelte-check clean, all unit tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/engines/map-export/pages.ts src/lib/engines/map-export/export-client.ts tests/unit/export-client-pages.test.ts
git commit -m "fix: batch export renders every floor, not only page 1

renderFirstPage hardcoded getPage(1) and filtered markers to page 1, so a
three-floor plan batch-exported as a single floor while AC-6.4.1 claimed
correct multi-page output. Page selection is extracted to pages.ts and
unit tested; the render loop now covers every page carrying a marker."
```

---

## Task 4: M2 - A missing PDF must report, not fake a blank page

**Repo:** `~/dev/pathfinder`

**Files:**
- Modify: `src/lib/engines/map-export/export-client.ts` (the `exportDocMap` written in Task 3)
- Modify: `src/routes/buildings/[id]/+page.svelte:57` (the batch export call site)

Task 3 made `renderPages` throw. This task makes the caller handle it honestly. The old
demo fallback produced a legend over an empty page, which reads as a successful export of a
building with no floor plan - the worst possible failure mode for a life-safety document.

- [ ] **Step 1: Return a reason instead of a bare boolean**

In `export-client.ts`, above `exportDocMap`, add:

```ts
export interface ExportResult {
	ok: boolean;
	error?: string;
}
```

- [ ] **Step 2: Catch the failure and report it**

Change the `exportDocMap` signature and wrap the render:

```ts
export async function exportDocMap(input: DocExportInput): Promise<ExportResult> {
	const { default: JsPDF } = await import('jspdf');
	let pages: ExportPageInput[];
	try {
		pages = await renderPages(input.fileUrl, input.markers);
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'Could not read the source PDF.' };
	}
	const facilityName = input.filename.replace(/\.[^.]+$/, '');
	const doc = buildMapPdf(
		(orientation, size) => new JsPDF({ orientation, unit: 'mm', format: size }),
		pages,
		{},
		input.markers,
		{ facilityName, brandName: 'Pathfinder' }
	);
	doc.save(exportFilename(input.filename));
	return { ok: true };
}
```

- [ ] **Step 3: Update the only call site**

`src/routes/buildings/[id]/+page.svelte:57` is the sole caller and currently **discards** the
return value. It also increments `done` and PATCHes the job to `done` regardless of outcome,
so a failed render is reported as a completed export - which contradicts `AC-6.4.2`
("the job is marked failed and the partial output is not delivered as final").

`toasts` is already imported at line 8; no new import is needed.

Replace line 57:

```js
			await exportDocMap({ docId: d.id, filename: d.filename, fileUrl: `/api/documents/${d.id}/file`, markers });
```

with:

```js
			const result = await exportDocMap({
				docId: d.id,
				filename: d.filename,
				fileUrl: `/api/documents/${d.id}/file`,
				markers
			});
			if (!result.ok) {
				toasts.error(`${d.filename}: ${result.error ?? 'Export failed.'}`);
				if (jobId)
					await fetch(`/api/export-jobs/${jobId}`, {
						method: 'PATCH',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ status: 'failed', done })
					});
				batchProgress = '';
				return;
			}
```

This leaves the existing `done++` and the success PATCH on lines 58-64 untouched - they are
now only reached when the export actually succeeded.

- [ ] **Step 4: Run the checks**

```bash
npm run check && npm run test:unit
```

Expected: svelte-check clean, all unit tests pass. If svelte-check reports that another
caller of `exportDocMap` still expects a boolean, update that caller the same way.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/map-export/export-client.ts "src/routes/buildings/[id]/+page.svelte"
git commit -m "fix: report export failures instead of emitting a blank page

A failed fetch or parse fell back to a blank canvas, producing a legend
over an empty page that reads as a successful export. Export now returns
an ok/error result and the batch call site surfaces it as a toast."
```

---

## Task 5: M1 - v1 must not swallow save failures

**Repo:** `~/dev/els911-portal`

**Files:**
- Modify: `public/js/viewer.js:3236-3243` (`_flushMapSave`)
- Modify: `public/js/viewer.js:4460-4466` (the unload guard)

- [ ] **Step 1: Surface the failure**

In `_flushMapSave`, replace the swallowing catch at line 3242:

```js
  } catch (err) { console.error('Map save failed', err); }
```

with:

```js
  } catch (err) {
    console.error('Map save failed', err);
    state.mapDirty = true;   // keep it dirty so the unload guard still fires
    API.toast('Could not save map markers. Your changes are still here - try again.', 'error');
  }
```

`API.toast` is defined at `public/js/api.js:11` and is already used elsewhere in this file
(for example `viewer.js:3194`).

- [ ] **Step 2: Fix the unload guard**

At `viewer.js:4460-4466` the guard tests `state.isDirty`, which tracks annotations only.
Change the condition to cover marker state as well:

```js
  if (state.isDirty || state.mapDirty) {
```

- [ ] **Step 3: Verify manually**

Serve the app, open a document with a floor plan, enter map mode, place a marker, and
confirm in devtools Network that the save fires. Then set the browser to offline, place
another marker, and wait one second. Expected: an error toast appears rather than silence.
Attempt to close the tab. Expected: the browser's leave-site prompt appears.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/els911-portal
git add public/js/viewer.js
git commit -m "fix: surface map save failures and guard unload on marker edits

_flushMapSave swallowed every error, so a failed save looked identical to
a successful one. The unload guard also checked only the annotation dirty
flag, so marker edits lost inside the 800ms debounce vanished silently."
```

---

## Verification

After all five tasks:

- [ ] `cd ~/dev/pathfinder && npm run check && npm run test:unit` - clean and green
- [ ] `cd ~/dev/pathfinder && npm run test:e2e` - no new failures versus the pre-change run
- [ ] Live D1 still reports 112 markers:
      `npx wrangler d1 execute els911-portal --remote --command "SELECT COUNT(*) FROM map_markers"`
- [ ] A room marker saves against production without rolling back its siblings
- [ ] Neither repo has uncommitted changes

Do NOT deploy either app as part of this plan. Both are direct-deploy
(`wrangler pages deploy`); deployment is a separate, explicitly requested step.
