// Login form accessibility (Epic E2 / Epic E12). The labeled-fields contract
// for the sign-in form. The full login + dashboard flow lives in auth.spec.ts
// (T-2.1.1 / T-2.1.2).
import { test, expect } from '@playwright/test';

test('login form exposes accessible, labeled fields', async ({ page }) => {
	await page.goto('/login');

	// Fields are reachable by their accessible label (real <label for=...>).
	const email = page.getByLabel('Email address');
	const password = page.getByLabel('Password');
	await expect(email).toBeVisible();
	await expect(password).toBeVisible();
	await expect(email).toHaveAttribute('type', 'email');
	await expect(password).toHaveAttribute('type', 'password');

	// The form carries an aria-live region for errors and a submit control.
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/login.png', fullPage: true });
});
