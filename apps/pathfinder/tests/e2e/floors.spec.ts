// E2E for the floor stack assembly page (Epic E15, AC-15.1.x). Drives the real
// /buildings/[id]/floors route against `wrangler pages dev`.
//
// The contract under test is the one the field workflow depends on: labels are
// arbitrary free text ("0", "Main", "3") stored verbatim, and sort_order - set
// by moving floors in the list, lowest floor first - is the only ordering
// truth. Nothing may parse "0" as a number to decide it belongs at the bottom.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
// The Gymnasium: a seeded building with no floors of its own, so this spec owns
// its stack and cannot disturb the Main Building fixtures other specs use.
const BUILDING = 'bld-wahs-gym-0000-0000000000001';

interface FloorPayload {
	floors: Array<{ id: string; label: string; sort_order: number; needs_review: number }>;
}

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

/** The local D1 persists across runs, so start from a known-empty stack. */
async function resetFloors(page: Page) {
	const res = await page.request.get(`/api/buildings/${BUILDING}/floors`);
	const body = (await res.json()) as FloorPayload;
	for (const f of body.floors) {
		await page.request.delete(`/api/floors/${f.id}`);
	}
}

async function addFloor(page: Page, label: string) {
	await page.getByTestId('new-floor-label').fill(label);
	await page.getByTestId('add-floor-submit').click();
	await expect(page.getByTestId('floor-row').filter({ hasText: label })).toHaveCount(1);
}

test('AC-15.1.1 floors are labelled with arbitrary free text and ordered lowest floor first', async ({
	page
}) => {
	await login(page);
	await resetFloors(page);
	await page.goto(`/buildings/${BUILDING}/floors`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	// The list states its own direction, because "which end is the bottom of the
	// building" is the single most confusing thing about a floor stack.
	await expect(page.getByTestId('stack-note')).toContainText(/lowest floor first/i);

	// Deliberately create them in the WRONG stack order: "0" is the basement but
	// arrives last, exactly like a folder of per-floor PDFs named by the surveyor.
	await addFloor(page, 'Main');
	await addFloor(page, '3');
	await addFloor(page, '0');

	await expect(page.getByTestId('floor-label')).toHaveText(['Main', '3', '0']);

	// Move "0" to the bottom of the building (top of the list) with the keyboard
	// accessible controls, one step at a time.
	const zeroRow = page.getByTestId('floor-row').filter({ hasText: '0' }).first();
	await zeroRow.getByTestId('floor-move-up').click();
	await expect(page.getByTestId('floor-label')).toHaveText(['Main', '0', '3']);
	await page
		.getByTestId('floor-row')
		.filter({ hasText: '0' })
		.first()
		.getByTestId('floor-move-up')
		.click();
	await expect(page.getByTestId('floor-label')).toHaveText(['0', 'Main', '3']);

	// The order and the verbatim labels are PERSISTED, not just re-rendered.
	const res = await page.request.get(`/api/buildings/${BUILDING}/floors`);
	expect(res.ok()).toBe(true);
	const body = (await res.json()) as FloorPayload;
	expect(body.floors.map((f) => f.label)).toEqual(['0', 'Main', '3']);
	expect(body.floors.map((f) => f.sort_order)).toEqual([0, 1, 2]);

	// A reload shows the same stack: the server, not component state, is the truth.
	await page.reload();
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('floor-label')).toHaveText(['0', 'Main', '3']);

	await page.screenshot({ path: 'tests/e2e/__screenshots__/floor-stack.png', fullPage: true });
});

test('AC-15.1.2 a floor label is editable inline and stored exactly as typed', async ({ page }) => {
	await login(page);
	await resetFloors(page);
	await page.goto(`/buildings/${BUILDING}/floors`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	await addFloor(page, 'LL');
	const row = page.getByTestId('floor-row').first();
	await row.getByTestId('floor-label-edit').click();
	const input = row.getByTestId('floor-label-input');
	await input.fill('1A Annex');
	await input.press('Enter');
	await expect(row.getByTestId('floor-label')).toHaveText('1A Annex');

	const body = (await (await page.request.get(`/api/buildings/${BUILDING}/floors`)).json()) as FloorPayload;
	expect(body.floors.map((f) => f.label)).toEqual(['1A Annex']);
});

test('AC-15.2.1 a re-surveyed floor is flagged for marker review until verified', async ({
	page
}) => {
	await login(page);
	await resetFloors(page);

	// Two plan versions on one floor: the second supersedes the first, which is
	// the moment marker positions stop being trustworthy.
	const created = (await (
		await page.request.post(`/api/buildings/${BUILDING}/floors`, { data: { label: 'Main' } })
	).json()) as { floor: { id: string } };
	const floorId = created.floor.id;
	const DOC = 'doc-wahs-main-f1-000000000001';
	await page.request.post(`/api/floors/${floorId}/versions`, { data: { docId: DOC, page: 1 } });
	await page.request.post(`/api/floors/${floorId}/versions`, {
		data: { docId: DOC, page: 1, note: 'post-renovation resurvey' }
	});

	await page.goto(`/buildings/${BUILDING}/floors`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	const banner = page.getByTestId('needs-review-banner');
	await expect(banner).toBeVisible();
	await expect(banner).toContainText(/verify marker positions/i);

	// Version history marks exactly one current version out of two.
	await page.getByTestId('versions-toggle').click();
	await expect(page.getByTestId('version-row')).toHaveCount(2);
	await expect(page.getByTestId('version-current')).toHaveCount(1);

	await page.getByTestId('clear-needs-review').click();
	await expect(banner).toHaveCount(0);

	const body = (await (await page.request.get(`/api/buildings/${BUILDING}/floors`)).json()) as FloorPayload;
	expect(body.floors[0].needs_review).toBe(0);
});
