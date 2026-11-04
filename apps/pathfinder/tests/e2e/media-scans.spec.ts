// E2E for the scan library (E7) and 3D viewer routes (E8). Verifies the
// versioned media list (cold master shown as archived, not linked), the 3D
// viewer shell for a splat and the mp4 walkthrough player.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const BUILDING = 'bld-wahs-main-0000-000000000001';
const SPLAT = 'med-wahs-splat-f1-00000001';
const VIDEO = 'med-wahs-video-f1-0000001';

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('E7 the building scan library lists versioned media with capture metadata', async ({ page }) => {
	await login(page);
	await page.goto(`/buildings/${BUILDING}`);

	const lib = page.getByTestId('media-library');
	await expect(lib).toBeVisible();
	await expect(page.getByTestId('media-list')).toBeVisible();
	// AC-7.1.1: all five media types appear in one view.
	await expect(page.getByTestId('media-row')).toHaveCount(5);
	for (const label of ['Floorplan PDF', 'Point cloud (master)', 'Splat (3D)', 'Walkthrough video', 'Reference image']) {
		await expect(lib).toContainText(label);
	}
	await expect(lib).toContainText(/archived/i); // the cold master PLY badge
	await expect(lib).toContainText(/J\. Porterfield/); // surveyor metadata
	// Staff uploader present.
	await expect(page.getByTestId('media-uploader')).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/scan-library.png', fullPage: true });
});

test('AC-8.1.1 the mp4 walkthrough renders a player with transport controls', async ({ page }) => {
	await login(page);
	await page.goto(`/scans/${VIDEO}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	const video = page.getByTestId('walkthrough-video');
	await expect(video).toBeVisible();
	await expect(video).toHaveAttribute('controls', ''); // transport controls present
});

test('AC-8.4.1 a 3D scene marker persists (anchor + reload) via the API', async ({ page }) => {
	await login(page);
	// Save an anchored marker, then read it back unchanged (reload-in-place proxy).
	const put = await page.request.put(`/api/media/${SPLAT}/markers3d`, {
		data: { markers: [{ type: 'aed', label: 'AED-1', position: [1.5, 0.2, -3.0], floor: 1 }] }
	});
	expect(put.ok()).toBe(true);
	const got = await (await page.request.get(`/api/media/${SPLAT}/markers3d`)).json();
	const m = got.markers.find((x: { label: string }) => x.label === 'AED-1');
	expect(m).toBeTruthy();
	expect([m.px, m.py, m.pz]).toEqual([1.5, 0.2, -3.0]); // anchored position retained
});

test('E8 the splat viewer route renders the 3D shell, marker tools and viewpoints', async ({ page }) => {
	await login(page);
	await page.goto(`/scans/${SPLAT}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	await expect(page.getByTestId('splat-host')).toBeVisible();
	await expect(page.getByTestId('marker3d-tools')).toBeVisible();
	await expect(page.getByTestId('viewpoint-list')).toBeVisible();
	// Floor/version switcher (3 related assets in this building).
	await expect(page.getByTestId('related-scans')).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/splat-viewer.png', fullPage: true });
});
