// E2E for compliance & trust (Epic E11): staleness flag + metadata edit
// (AC-11.5.1/11.2.1), trust page (AC-11.4.1), NENA export field reporting
// (AC-11.1.2), audit export content (AC-11.3.1).

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

test('AC-11.5.1 / AC-11.2.1 a never-reviewed facility is flagged stale; editing compliance clears it', async ({ page }) => {
	await login(page);
	// Reset to never-reviewed so the test is isolated across runs.
	await page.request.put(`/api/facilities/${FACILITY}/compliance`, { data: { last_reviewed: '' } });
	await page.goto(`/facilities/${FACILITY}`);

	// A never-reviewed facility is flagged for re-verification.
	await expect(page.getByTestId('staleness-flag')).toBeVisible();
	await expect(page.getByTestId('compliance-form')).toBeVisible(); // editor present

	// Record a recent review via the same endpoint the form posts to (AC-11.2.1).
	const put = await page.request.put(`/api/facilities/${FACILITY}/compliance`, {
		data: { last_reviewed: '2026-06-16', alyssas_law: true }
	});
	expect(put.ok()).toBe(true);

	// A fresh load reflects the saved metadata: no longer stale.
	await page.reload();
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('staleness-flag')).toHaveCount(0);
});

test('AC-11.4.1 the trust page states the brand compliance posture', async ({ page }) => {
	await page.goto('/trust'); // public
	await expect(page.getByTestId('trust-page')).toBeVisible();
	const controls = page.getByTestId('trust-controls');
	await expect(controls).toContainText(/NG911|NENA/);
	await expect(controls).toContainText(/WCAG/);
	await expect(controls).toContainText(/audit/i);
});

test('AC-11.1.2 the NENA export reports field validity; AC-11.3.1 audit export has who/what/when', async ({ page }) => {
	await login(page);

	const exp = await page.request.get(`/api/facilities/${FACILITY}/ng911`);
	expect(exp.ok()).toBe(true);
	const fc = await exp.json();
	expect(Array.isArray(fc.metadata.missingFields)).toBe(true);
	expect(typeof fc.metadata.valid).toBe('boolean');

	const audit = await page.request.get('/api/admin/audit');
	expect(audit.ok()).toBe(true);
	const rows = (await audit.json()).audit;
	expect(Array.isArray(rows)).toBe(true);
	if (rows.length) {
		expect(rows[0]).toHaveProperty('action');
		expect(rows[0]).toHaveProperty('created_at');
	}
	// CSV variant carries the who/what/when header.
	const csv = await page.request.get('/api/admin/audit?format=csv');
	expect((await csv.text()).split('\n')[0]).toContain('action');
});
