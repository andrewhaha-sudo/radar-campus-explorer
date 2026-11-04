// End-to-end "golden path" - the full operator journey in one flow. Mirrors
// the demo script (docs/demo-script.md), so a green run validates the demo.

import { test, expect } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const FACILITY = 'fac-wahs-0000-0000-0000-000000000001';
const BUILDING = 'bld-wahs-main-0000-000000000001';
const DOC = 'doc-wahs-main-f1-000000000001';

test('end-to-end: login -> hierarchy -> floorplan -> review -> search -> compliance -> admin', async ({ page }) => {
	// 1. Sign in -> scoped roll-up dashboard.
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
	await expect(page.getByTestId('rollup-cards')).toBeVisible();

	// 2. Drill the hierarchy: facility -> building.
	await page.goto(`/facilities/${FACILITY}`);
	await expect(page.getByRole('heading', { name: 'Wellsboro Area High School' })).toBeVisible();
	await expect(page.getByTestId('building-list')).toBeVisible();
	await page.goto(`/buildings/${BUILDING}`);

	// 3. The building shows its floorplans, the 5-type scan library, and projects.
	await expect(page.getByTestId('document-list')).toBeVisible();
	await expect(page.getByTestId('media-row')).toHaveCount(5);
	await expect(page.getByTestId('project-list')).toBeVisible();

	// 4. Open the 2D floorplan viewer: tools, annotations, map mode, exports.
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('toolbar')).toBeVisible();
	await expect(page.getByTestId('annotation-count')).toHaveText(/4 annotations/);
	await expect(page.getByTestId('export-map')).toBeVisible();
	await expect(page.getByTestId('text-alternative')).toBeVisible(); // a11y

	// 5. Review workflow: create -> publish version -> approve (via API).
	const name = `Demo review ${Date.now()}`;
	const created = await page.request.post('/api/projects', { data: { name, building_id: BUILDING } });
	const projectId = (await created.json()).project.id as string;
	expect((await page.request.post(`/api/projects/${projectId}/versions`, { data: { notes: 'v1' } })).status()).toBe(201);
	expect((await page.request.post(`/api/projects/${projectId}/approve`)).status()).toBe(200);
	expect((await (await page.request.get(`/api/projects/${projectId}`)).json()).project.status).toBe('approved');

	// 6. Global search jumps straight to a facility.
	await page.goto('/search');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('search-input').fill('Wellsboro');
	await expect(page.getByTestId('search-results')).toContainText('Wellsboro Area High School');

	// 7. Compliance: a valid NENA NG911 export.
	const fc = await (await page.request.get(`/api/facilities/${FACILITY}/ng911`)).json();
	expect(fc.type).toBe('FeatureCollection');
	expect(fc.metadata.standard).toMatch(/NENA-STA-006/);

	// 8. Trust page is public.
	await page.goto('/trust');
	await expect(page.getByTestId('trust-page')).toBeVisible();

	// 9. Admin console: stats, users, audit.
	await page.goto('/admin');
	await expect(page.getByTestId('admin-stats')).toBeVisible();
	await expect(page.getByTestId('admin-users')).toContainText(ADMIN.email);
	await expect(page.getByTestId('admin-audit')).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/demo-admin.png', fullPage: true });
});
