// E2E for the AI responder briefing (Pro feature). Uses the deterministic
// 'mock' provider (set via admin settings) so the full flow - configure ->
// button -> grounded briefing - runs without any key or external call.

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

test('AI briefing: configure provider in settings, generate a grounded briefing', async ({ page }) => {
	await login(page);
	// Operator selects a provider in the admin console (here the deterministic
	// mock; in production this is workers-ai or an external key + base URL).
	const set = await page.request.put('/api/admin/settings', { data: { key: 'llm.provider', value: 'mock' } });
	expect(set.ok()).toBe(true);

	// API: a grounded briefing for the floor (mentions the facility, no key).
	const res = await page.request.post(`/api/documents/${DOC}/briefing`, { data: { page: 1 } });
	expect(res.status()).toBe(200);
	const briefing = (await res.json()).briefing as string;
	expect(briefing).toContain('Wellsboro Area High School');

	// UI: the staff-only button generates and shows the briefing.
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('ai-briefing').click();
	await expect(page.getByTestId('briefing-text')).toContainText('Wellsboro Area High School');
});

test('AI briefing is staff-gated', async ({ playwright, baseURL }) => {
	const client = await playwright.request.newContext({ baseURL: baseURL! });
	expect((await client.post('/api/auth/login', { data: { email: 'client@test.com', password: 'test1234' } })).ok()).toBe(true);
	// A client (even if they could see a doc) cannot generate briefings; for an
	// out-of-org doc it is a 404 before the 403 even applies.
	const res = await client.post(`/api/documents/${DOC}/briefing`, { data: { page: 1 } });
	expect([403, 404]).toContain(res.status());
	await client.dispose();
});
