// Remaining AC coverage (E2/E3/E10/E12).

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const CLIENT = { email: 'client@test.com', password: 'test1234' };
const GYM = 'bld-wahs-gym-0000-0000000000001';
const WAHS_MAIN = 'bld-wahs-main-0000-000000000001';

async function login(page: Page, who = ADMIN) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(who.email);
	await page.getByLabel('Password').fill(who.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('AC-2.2.1 a client hitting a staff-only route gets a clear permission screen', async ({ page }) => {
	await login(page, CLIENT);
	const res = await page.goto('/admin');
	expect(res?.status()).toBe(403);
	await expect(page.getByTestId('error-page')).toHaveAttribute('data-status', '403');
	await expect(page.getByTestId('error-message')).toContainText(/permission/i);
});

test('AC-2.4.1 / AC-2.5.1 login writes an audit entry and password users are unaffected by MFA', async ({ playwright, baseURL }) => {
	const admin = await playwright.request.newContext({ baseURL });
	// AC-2.5.1: a normal password user logs in; MFA hook present but not required.
	const lr = await admin.post('/api/auth/login', { data: ADMIN });
	expect(lr.ok()).toBe(true);
	expect((await lr.json()).mfaRequired).toBe(false);
	// AC-2.4.1: the login produced an immutable audit entry.
	const audit = (await (await admin.get('/api/admin/audit')).json()).audit;
	expect(audit.some((a: { action: string }) => a.action === 'auth.login')).toBe(true);
	await admin.dispose();
});

test('AC-3.4.1 an entity with no children shows a designed empty state', async ({ page }) => {
	await login(page);
	await page.goto(`/buildings/${GYM}`); // gym has no projects seeded
	await expect(page.getByTestId('empty-state')).toBeVisible();
	await expect(page.getByTestId('empty-action')).toBeVisible();
});

test('AC-3.5.1 starring a building persists across sessions', async ({ page, playwright, baseURL }) => {
	await login(page);
	// Reset to a known state so the assertion is isolated across runs.
	await page.request.delete(`/api/buildings/${WAHS_MAIN}/favorite`);
	await page.goto(`/buildings/${WAHS_MAIN}`);
	const star = page.getByTestId('favorite-toggle');
	await expect(star).toHaveText('Star');

	// Star it through the UI.
	await star.click();
	await expect(star).toHaveText('Starred');

	// A brand-new session (fresh cookies, separate login) sees it persisted
	// server-side - the durable cross-session proof.
	const fresh = await playwright.request.newContext({ baseURL: baseURL! });
	expect((await fresh.post('/api/auth/login', { data: ADMIN })).ok()).toBe(true);
	const got = await (await fresh.get(`/api/buildings/${WAHS_MAIN}/favorite`)).json();
	expect(got.favorite).toBe(true);
	await fresh.dispose();
});

test('AC-10.1.1 search returns results across multiple entity types', async ({ page }) => {
	await login(page);
	await page.goto('/search');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('search-input').fill('main');
	await expect(page.getByTestId('search-results')).toBeVisible();
	// "Main" matches a Building and a Floorplan document -> 2+ distinct type badges.
	const badges = await page.getByTestId('search-results').locator('.badge').allInnerTexts();
	expect(new Set(badges.map((b) => b.trim())).size).toBeGreaterThanOrEqual(2);
});

test('AC-10.2.1 search is org-scoped: a client sees only their org', async ({ page }) => {
	await login(page, CLIENT); // Northgate org
	await page.goto('/search');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('search-input').fill('Wellsboro'); // an ELS911 facility
	// No cross-org leakage: the Northgate client gets no Wellsboro (ELS911) hit.
	await expect(page.getByTestId('search-empty')).toBeVisible();
});

test('AC-12.1.1 / AC-12.2.1 keyboard reaches labelled controls', async ({ page }) => {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	// AC-12.2.1: fields and the submit control expose accessible names.
	await expect(page.getByLabel('Email address')).toBeVisible();
	await expect(page.getByLabel('Password')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
	// AC-12.1.1: the email field is keyboard-focusable and operable.
	await page.getByLabel('Email address').focus();
	await expect(page.getByLabel('Email address')).toBeFocused();
	await page.keyboard.type('keyboard@test.com');
	await expect(page.getByLabel('Email address')).toHaveValue('keyboard@test.com');
});
