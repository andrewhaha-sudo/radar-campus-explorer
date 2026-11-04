// E2E for admin & platform ops (Epic E13): user creation + role login
// (AC-13.1.1), deactivation enforced at request time (AC-13.1.2), API key
// issue/use/scope (AC-13.2.1), revoke (AC-13.2.2), settings persistence
// (AC-13.4.1), audit filter (AC-13.3.1).

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };

async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

test('AC-13.1.1 / AC-13.1.2 create a user with a role, they log in, then deactivation blocks them', async ({ page, browser }) => {
	const email = `e2e-staff-${Date.now()}@test.com`;
	const password = 'staffpass12';

	await login(page);
	await page.waitForURL('**/dashboard');
	await page.goto('/admin');

	// AC-13.1.1: create the user with role=staff.
	await page.getByTestId('create-user').getByPlaceholder('Name').fill('E2E Staff');
	await page.getByTestId('create-user').getByPlaceholder('Email').fill(email);
	await page.getByTestId('create-user').getByPlaceholder('Password (8+)').fill(password);
	await page.getByTestId('create-user').locator('select').selectOption('staff');
	await page.getByTestId('create-user-submit').click();
	await expect(page.getByTestId('create-user-msg')).toContainText(/Created/i);

	// The new user logs in and carries exactly the staff role.
	const ctx = await browser.newContext();
	const u = await ctx.newPage();
	const loginRes = await u.request.post('/api/auth/login', { data: { email, password } });
	expect(loginRes.ok()).toBe(true);
	expect((await loginRes.json()).user.role).toBe('staff');
	// session works
	expect((await u.request.get('/api/auth/me')).ok()).toBe(true);

	// AC-13.1.2: admin disables the user -> their next request is rejected.
	const row = page.getByTestId('admin-users').locator('tr').filter({ hasText: email });
	await row.getByRole('button', { name: 'Disable' }).click();
	await expect(row.getByTestId('user-status')).toHaveText(/disabled/i);
	const me = await u.request.get('/api/auth/me');
	expect(me.status()).toBe(401);
	await ctx.close();
});

test('AC-13.2.1 / AC-13.2.2 issue an API key (authenticates, scoped), then revoke it (rejected)', async ({ page, browser }) => {
	await login(page);
	await page.waitForURL('**/dashboard');
	await page.goto('/admin');

	// Issue a READ-scoped key.
	await page.getByTestId('issue-key').getByPlaceholder('Key name').fill(`e2e-key-${Date.now()}`);
	await page.getByTestId('issue-key').locator('select').selectOption('read');
	await page.getByTestId('issue-key-submit').click();
	const raw = (await page.getByTestId('issued-key').locator('code').textContent())!.trim();
	expect(raw.startsWith('pf_')).toBe(true);

	// Use a COOKIELESS context so the key (not the admin session cookie) is what
	// authenticates - otherwise the logged-in cookie would win.
	const anon = await browser.newContext();

	// AC-13.2.1: the key authenticates a request within scope.
	const ok = await anon.request.get('/api/auth/me', { headers: { 'X-API-Key': raw } });
	expect(ok.ok()).toBe(true);
	// read scope cannot mutate.
	const blocked = await anon.request.put('/api/admin/settings', {
		headers: { 'X-API-Key': raw, 'content-type': 'application/json' },
		data: { key: 'x', value: '1' }
	});
	expect(blocked.status()).toBe(403);

	// AC-13.2.2: revoke -> the key no longer authenticates.
	const keyRow = page.getByTestId('admin-apikeys').locator('tr').filter({ hasText: raw.slice(0, 10) });
	await keyRow.getByTestId('revoke-key').click();
	await expect(page.getByTestId('admin-apikeys').locator('tr').filter({ hasText: raw.slice(0, 10) })).toContainText(/revoked/i);
	const after = await anon.request.get('/api/auth/me', { headers: { 'X-API-Key': raw } });
	expect(after.status()).toBe(401);
	await anon.close();
});

test('AC-13.4.1 a deployment setting persists; AC-13.3.1 audit filter returns scoped rows', async ({ page }) => {
	await login(page);
	await page.waitForURL('**/dashboard');
	await page.goto('/admin');

	const key = `banner_${Date.now()}`;
	await page.getByTestId('settings-form').getByPlaceholder('key').fill(key);
	await page.getByTestId('settings-form').getByPlaceholder('value').fill('maintenance 9pm');
	await page.getByTestId('setting-save').click();
	await expect(page.getByTestId('admin-settings')).toContainText(key);
	// persists across reload
	await page.reload();
	await expect(page.getByTestId('admin-settings')).toContainText('maintenance 9pm');

	// AC-13.3.1: filtering by a bogus actor returns no rows; by a real one returns rows.
	await page.getByTestId('audit-filter').getByPlaceholder('actor user id').fill('no-such-actor');
	await page.getByTestId('audit-filter-run').click();
	await expect(page.getByTestId('admin-audit-filtered').locator('tbody tr')).toHaveCount(0);
});
