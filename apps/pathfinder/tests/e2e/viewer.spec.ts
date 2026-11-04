// E2E for the 2D annotation viewer + map/NFPA export (Epics E5, E6) and the
// non-visual text alternative (E12). Drives the real /documents/[id] route
// against `wrangler pages dev` with the seeded WAHS Floor 1 document.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const DOC = 'doc-wahs-main-f1-000000000001';

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('E5 viewer renders the 12-tool toolbar, the canvas and the seeded annotations', async ({
	page
}) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	// Toolbar with all 12 annotation tools + select/pan.
	await expect(page.getByTestId('toolbar')).toBeVisible();
	for (const t of ['circle', 'rect', 'arrow', 'freehand', 'comment', 'correction', 'aed', 'stairs', 'door', 'overhead', 'exit', 'fireext']) {
		await expect(page.getByTestId(`tool-${t}`)).toBeVisible();
	}
	await expect(page.getByTestId('annotation-canvas')).toBeVisible();

	// The 4 seeded annotations load (after onMount seeds them).
	await expect(page.getByTestId('annotation-count')).toHaveText(/4 annotations/);
	await expect(page.getByTestId('page-indicator')).toContainText('Page 1');

	// Editing controls present for staff/admin.
	await expect(page.getByTestId('save')).toBeVisible();
	await expect(page.getByTestId('export-json')).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/viewer.png', fullPage: true });
});

test('E5 selecting a tool activates it and undo/redo are wired', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	const circle = page.getByTestId('tool-circle');
	await circle.click();
	await expect(circle).toHaveClass(/active/);

	await expect(page.getByTestId('undo')).toBeVisible();
	await expect(page.getByTestId('redo')).toBeVisible();
});

test('E6 map mode exposes marker tools and the NFPA export button', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	await expect(page.getByTestId('export-map')).toBeVisible();
	await page.getByTestId('map-mode-toggle').click();

	await expect(page.getByTestId('map-toolbar')).toBeVisible();
	for (const t of ['stairs', 'hallway', 'door', 'elevator', 'room']) {
		await expect(page.getByTestId(`map-tool-${t}`)).toBeVisible();
	}
	await page.screenshot({ path: 'tests/e2e/__screenshots__/viewer-map-mode.png', fullPage: true });
});

test('E6 map markers autosave without an explicit Save click', async ({ page }) => {
	// Regression guard: marker edits used to live only in memory until the Save
	// button was pressed, so navigating away discarded them silently.
	const SCRATCH = 'doc-wahs-scratch-00000000001';
	await login(page);
	await page.request.put(`/api/documents/${SCRATCH}/markers`, { data: { markers: [] } });
	await page.goto(`/documents/${SCRATCH}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('map-mode-toggle').click();
	await expect(page.getByTestId('map-toolbar')).toBeVisible();

	// Place a stairs marker on the map canvas.
	const canvas = page.getByTestId('map-canvas');
	const box = (await canvas.boundingBox())!;
	await page.getByTestId('map-tool-stairs').click();
	await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);

	// Deliberately do NOT click Save. The 800ms debounce must persist it.
	await expect(page.getByTestId('save-markers')).toHaveText(/Saved/, { timeout: 5000 });

	// Reload without ever having saved by hand -> the marker survived.
	await page.reload();
	await page.locator('html[data-hydrated="true"]').waitFor();
	const res = await page.request.get(`/api/documents/${SCRATCH}/markers`);
	const body = (await res.json()) as { markers: unknown[] };
	expect(body.markers.length).toBe(1);
});

test('AC-5.2.1 / AC-5.3.1 drawing a shape creates an annotation that persists across reload', async ({ page }) => {
	// Dedicated scratch document so this write test does not disturb the
	// read-only-count assertions on the primary seeded document.
	const SCRATCH = 'doc-wahs-scratch-00000000001';
	await login(page);
	// Reset the scratch doc so the test is isolated across runs.
	await page.request.put(`/api/documents/${SCRATCH}/annotations`, { data: { annotations: [] } });
	await page.goto(`/documents/${SCRATCH}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('annotation-count')).toHaveText(/0 annotations/);

	// Draw a circle by dragging on the canvas.
	const canvas = page.getByTestId('annotation-canvas');
	const box = (await canvas.boundingBox())!;
	await page.getByTestId('tool-circle').click();
	await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 5 });
	await page.mouse.up();
	await expect(page.getByTestId('annotation-count')).toHaveText(/1 annotations/);

	// Save, then reload -> the drawn annotation is still there (persisted).
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save')).toHaveText(/Saved/);
	await page.reload();
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('annotation-count')).toHaveText(/1 annotations/);
});

test('AC-5.4.1 the responder safety layer can be toggled off', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	const toggle = page.getByTestId('responder-layer-toggle').locator('input');
	await expect(toggle).toBeChecked();
	await toggle.uncheck();
	await expect(toggle).not.toBeChecked(); // safety markers hidden from the view
});

test('AC-6.1.2 only the fixed safety symbol catalog is placeable (no freehand symbol tool)', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	// The six NFPA safety markers are present...
	for (const m of ['aed', 'stairs', 'door', 'overhead', 'exit', 'fireext']) {
		await expect(page.getByTestId(`tool-${m}`)).toBeVisible();
	}
	// ...and there is no arbitrary/custom-symbol tool.
	await expect(page.getByTestId('tool-custom')).toHaveCount(0);
});

test('E5 annotated-PDF export is available alongside JSON export', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('export-json')).toBeVisible();
	await expect(page.getByTestId('export-annotated')).toBeVisible();
});

test('E5 delete prompts a confirm dialog before removing a selected annotation', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('annotation-count')).toHaveText(/4 annotations/);

	// Select the seeded rect annotation (a large, reliable bbox target) then
	// press Delete -> confirm modal. (Delete is in-memory until Save, so this
	// does not disturb the persisted 4-annotation seed for other tests.)
	const canvas = page.getByTestId('annotation-canvas');
	await page.getByTestId('tool-select').click();
	const box = (await canvas.boundingBox())!;
	const modal = page.getByRole('dialog', { name: 'Confirm delete' });
	// Retry the select+Delete until the dialog opens - the canvas hit-test can
	// race the viewer's first paint; requestDelete only opens the modal (no
	// destructive action) so retrying is safe.
	await expect(async () => {
		await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.21 } });
		await page.keyboard.press('Delete');
		await expect(modal).toBeVisible({ timeout: 700 });
	}).toPass({ timeout: 8000 });
	await page.getByTestId('delete-confirm').click();
	await expect(page.getByTestId('annotation-count')).toHaveText(/3 annotations/);
});

test('E6 map mode exposes the crop tool, print-style picker and map undo', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('map-mode-toggle').click();
	await expect(page.getByTestId('map-tool-crop')).toBeVisible();
	await expect(page.getByTestId('map-undo')).toBeVisible();
	await expect(page.getByTestId('print-style')).toBeVisible();
	await page.getByTestId('print-style').selectOption('blueprint');
	await expect(page.getByTestId('print-style')).toHaveValue('blueprint');
});

test('E12 the floor has a non-visual text alternative for screen readers', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	const alt = page.getByTestId('text-alternative');
	await expect(alt).toBeVisible();
	await alt.locator('summary').click();
	// Seeded floor has an AED, an exit and a comment -> headings appear.
	await expect(alt).toContainText(/AED/i);
});

test('E15 renaming a marker to a taken label swaps the two, never duplicating', async ({ page }) => {
	const SCRATCH = 'doc-wahs-scratch-00000000001';
	await login(page);
	await page.request.put(`/api/documents/${SCRATCH}/markers`, { data: { markers: [] } });
	await page.goto(`/documents/${SCRATCH}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('map-mode-toggle').click();

	// Place three stairs markers -> S1, S2, S3
	const canvas = page.getByTestId('map-canvas');
	const box = (await canvas.boundingBox())!;
	await page.getByTestId('map-tool-stairs').click();
	for (const f of [0.3, 0.5, 0.7]) {
		await page.mouse.click(box.x + box.width * f, box.y + box.height * 0.5);
	}
	const panel = page.getByTestId('marker-panel');
	await expect(panel).toContainText('S1');
	await expect(panel).toContainText('S3');

	// Rename S3 -> S1 via the panel. S1 must take S3, not duplicate.
	await panel.getByRole('button', { name: 'S3', exact: true }).click();
	await panel.getByRole('button', { name: 'Rename' }).last().click();
	await page.getByTestId('rename-input').fill('S1');
	await page.getByTestId('rename-commit').click();

	const chips = await panel.locator('.mp-chip').allTextContents();
	const stairs = chips.filter((c) => /^S\d+$/.test(c));
	expect(new Set(stairs).size).toBe(stairs.length); // no duplicates
	expect(stairs.sort()).toEqual(['S1', 'S2', 'S3']);
});
