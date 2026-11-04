// Seed E2E spec (Epic E14). Worked example for the per-AC Playwright tests
// described in docs/04-tdd-plan.md (T-<AC> ids).
import { test, expect } from '@playwright/test';

test('T-1.1.1 landing page shows the integrated platform without edition gates', async ({ page }) => {
	await page.goto('/');

	// Integrated brand wordmark remains visible.
	await expect(page.getByRole('link', { name: /home/i })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	// Both capability areas are available together.
	await expect(page.getByRole('heading', { name: 'Floorplans and shared review' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Campus and 3D documentation' })).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/landing.png', fullPage: true });
});
