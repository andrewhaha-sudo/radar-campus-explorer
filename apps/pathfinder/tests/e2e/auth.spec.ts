// E2E auth flow (Epic E2 - Identity, Roles & Access).
// Drives the real login route against a `wrangler pages dev` server with the
// local D1 binding and the seeded test admin (scripts/seed-dev.mjs).
//
// T-2.1.1 (AC-2.1.1): valid credentials issue a session and land on /dashboard.
// T-2.1.2 (AC-2.1.2): a wrong password is rejected with a generic error,
//                     no session, and stays on /login.

import { test, expect } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };

test('T-2.1.1 valid credentials issue a session and land on the scoped dashboard', async ({
	page
}) => {
	await page.goto('/login');
	// Wait for client hydration so use:enhance intercepts the submit.
	await page.locator('html[data-hydrated="true"]').waitFor();

	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();

	// Lands on the scoped dashboard and is greeted by name.
	await page.waitForURL('**/dashboard');
	await expect(page.getByRole('heading', { name: /Welcome, Test Admin/i })).toBeVisible();
	await expect(page.getByTestId('user-role')).toContainText(/Administrator/i);

	// A session cookie was issued.
	const cookies = await page.context().cookies();
	expect(cookies.some((c) => c.name === 'pf_session')).toBe(true);

	await page.screenshot({ path: 'tests/e2e/__screenshots__/dashboard.png', fullPage: true });
});

test('T-2.1.2 a wrong password is rejected with a generic error and no session', async ({
	page
}) => {
	await page.goto('/login');
	// Wait for client hydration so use:enhance intercepts the submit.
	await page.locator('html[data-hydrated="true"]').waitFor();

	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill('wrong-password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	// Generic error is announced as a toast (role=alert) and echoed inline; we
	// stay on /login.
	await expect(page.getByTestId('toast')).toContainText(/invalid email or password/i);
	await expect(page.getByTestId('login-error')).toContainText(/invalid email or password/i);
	await expect(page).toHaveURL(/\/login/);

	// No session cookie was issued.
	const cookies = await page.context().cookies();
	expect(cookies.some((c) => c.name === 'pf_session')).toBe(false);

	await page.screenshot({ path: 'tests/e2e/__screenshots__/auth-error.png', fullPage: true });
});
