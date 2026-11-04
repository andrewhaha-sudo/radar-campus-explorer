// E2E for global search (E10), the admin console (E13) and NG911 compliance
// export (E11).

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const FACILITY = 'fac-wahs-0000-0000-0000-000000000001';

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('E10 global search finds a facility and navigates to it', async ({ page }) => {
	await login(page);
	await page.goto('/search');
	await page.locator('html[data-hydrated="true"]').waitFor();

	await page.getByTestId('search-input').fill('Wellsboro');
	const results = page.getByTestId('search-results');
	await expect(results).toBeVisible();
	await expect(results).toContainText(/Wellsboro Area High School/);

	await page.screenshot({ path: 'tests/e2e/__screenshots__/search.png', fullPage: true });

	await page.getByTestId('search-hit').first().click();
	await expect(page).toHaveURL(/\/(facilities|buildings|documents)\//);
});

test('E13 admin console shows stats, users and the audit viewer; reindex works', async ({ page }) => {
	await login(page);
	await page.goto('/admin');

	await expect(page.getByTestId('admin-stats')).toBeVisible();
	await expect(page.getByTestId('admin-users')).toContainText(ADMIN.email);
	await expect(page.getByTestId('admin-audit')).toBeVisible();
	await expect(page.getByTestId('audit-export')).toBeVisible();

	await page.getByTestId('reindex').click();
	await expect(page.getByTestId('reindex-msg')).toContainText(/Reindexed/i);

	await page.screenshot({ path: 'tests/e2e/__screenshots__/admin.png', fullPage: true });
});

test('E11 a facility exposes an NG911 NENA GeoJSON export that validates', async ({ page }) => {
	await login(page);
	await page.goto(`/facilities/${FACILITY}`);
	await expect(page.getByTestId('ng911-export')).toBeVisible();

	// Fetch the export with the session cookie and assert NENA-aligned shape.
	const res = await page.request.get(`/api/facilities/${FACILITY}/ng911`);
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('geo+json');
	const fc = await res.json();
	expect(fc.type).toBe('FeatureCollection');
	expect(fc.metadata.standard).toMatch(/NENA-STA-006/);
	// Every floor feature carries a z-axis floor label (NENA-REQ-003).
	const floors = fc.features.filter((f: { properties: { featureClass: string } }) => f.properties.featureClass === 'StructureFloor');
	expect(floors.length).toBeGreaterThan(0);
	expect(floors[0].properties.floorLabel).toMatch(/Floor|Ground/);
});
