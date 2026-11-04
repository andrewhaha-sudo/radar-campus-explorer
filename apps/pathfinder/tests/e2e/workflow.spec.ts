// E2E for the project status transition (Epic E4): legal edges advance the
// project; illegal edges are rejected (the guard). Creates its own project for
// isolation. The transition control is also surfaced in the building UI.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const BUILDING = 'bld-wahs-main-0000-000000000001';

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('E4 a project advances along legal status edges and rejects illegal ones', async ({ page }) => {
	await login(page);

	const name = `Transition test ${Date.now()}`;
	const res = await page.request.post('/api/projects', { data: { name, building_id: BUILDING } });
	expect(res.status()).toBe(201);
	const id = (await res.json()).project.id as string;

	// Legal: draft -> in_review.
	expect((await page.request.fetch(`/api/projects/${id}`, { method: 'PATCH', data: { status: 'in_review' } })).ok()).toBe(true);
	expect((await (await page.request.get(`/api/projects/${id}`)).json()).project.status).toBe('in_review');

	// Illegal: in_review -> archived is not a legal edge (must approve/return first).
	const illegal = await page.request.fetch(`/api/projects/${id}`, { method: 'PATCH', data: { status: 'archived' } });
	expect(illegal.status()).toBe(409);

	// The building page surfaces the transition controls for staff.
	await page.goto(`/buildings/${BUILDING}`);
	const row = page.getByTestId('project-list').locator('li').filter({ hasText: name });
	await expect(row.getByTestId('project-status')).toHaveText(/In review/i);
	await expect(row.getByTestId('project-actions')).toBeVisible();
	await page.screenshot({ path: 'tests/e2e/__screenshots__/project-workflow.png', fullPage: true });
});
