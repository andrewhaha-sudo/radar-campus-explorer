// E2E for collaboration (Epic E9): the comments panel + resolve workflow and
// the read-only share link round-trip.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const STAFF = { email: 'staff@test.com', password: 'test1234' };
const CLIENT = { email: 'client@test.com', password: 'test1234' };
const DOC = 'doc-wahs-main-f1-000000000001';
const AED_ANNOTATION = 'ann-wahs-aed-00000000000001';

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('E9 the viewer shows a comments panel; the draft requires a selected annotation', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	const panel = page.getByTestId('comments-panel');
	await expect(panel).toBeVisible();
	// With nothing selected, the comment draft is disabled (anchored comments).
	await expect(page.getByTestId('comment-draft')).toBeDisabled();
	await expect(page.getByTestId('show-resolved')).toBeVisible();
});

test('AC-9.1.1 / AC-9.1.2 / AC-9.2.1 anchored comment, reply nesting, resolve hides-not-deletes', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	// AC-9.1.1: anchor a comment to a selected annotation; it renders + persists.
	// Wait for the viewer's onMount to seed annotations before clicking the canvas.
	await expect(page.getByTestId('annotation-count')).toHaveText(/4 annotations/);
	const canvas = page.getByTestId('annotation-canvas');
	await page.getByTestId('tool-select').click();
	const box = (await canvas.boundingBox())!;
	const draft = page.getByTestId('comment-draft');
	// Retry the select until the comment box enables - the canvas hit-test can
	// race the viewer's first paint. Click the centre of the seeded rect
	// annotation (nx .15-.35, ny .15-.27), a large, reliable target.
	await expect(async () => {
		await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.21 } });
		await expect(draft).toBeEnabled({ timeout: 700 });
	}).toPass({ timeout: 8000 });
	const text = `Egress note ${Date.now()}`;
	const reply = `Ack ${Date.now()}`;
	await draft.fill(text);
	await page.getByTestId('comment-submit').click();
	// Scope to MY comment li (the doc's panel may show others from shared seed/runs).
	const mine = page.getByTestId('comment').filter({ hasText: text });
	await expect(mine).toHaveCount(1);

	// AC-9.1.2: reply nests under THIS thread (selection still anchored).
	await mine.getByTestId('reply-toggle').click();
	await mine.getByTestId('reply-input').fill(reply);
	await mine.getByTestId('reply-submit').click();
	await expect(mine.getByTestId('reply').filter({ hasText: reply })).toHaveCount(1);

	// AC-9.2.1: resolving hides THIS thread from the default view but retains it.
	await mine.getByTestId('resolve-toggle').click();
	await expect(page.getByTestId('comment').filter({ hasText: text })).toHaveCount(0);
	await page.getByTestId('show-resolved').check();
	await expect(page.getByTestId('comment').filter({ hasText: text })).toHaveCount(1); // retained
});

test('AC-9.3.1 / AC-9.3.2 mentions notify in-org users with a deep link, not out-of-org', async ({ playwright, baseURL }) => {
	const admin = await playwright.request.newContext({ baseURL });
	const staff = await playwright.request.newContext({ baseURL });
	const client = await playwright.request.newContext({ baseURL });
	expect((await admin.post('/api/auth/login', { data: ADMIN })).ok()).toBe(true);
	expect((await staff.post('/api/auth/login', { data: STAFF })).ok()).toBe(true);
	expect((await client.post('/api/auth/login', { data: CLIENT })).ok()).toBe(true);

	const token = `m${Date.now()}`;
	// WAHS doc is in the ELS911 org; staff sees all orgs, client is Northgate.
	const res = await admin.post(`/api/documents/${DOC}/comments`, {
		data: { annotationId: AED_ANNOTATION, text: `@staff and @client check ${token}` }
	});
	expect(res.ok()).toBe(true);

	// AC-9.3.1: the in-org staff mention produces a notification with a deep link.
	const staffNotes = (await (await staff.get('/api/notifications')).json()).notifications;
	const hit = staffNotes.find((n: { excerpt: string }) => n.excerpt?.includes(token));
	expect(hit).toBeTruthy();
	expect(hit.kind).toBe('mention');
	expect(hit.resource_url).toContain(`/documents/${DOC}`);

	// AC-9.3.2: the out-of-org client mention does NOT notify.
	const clientNotes = (await (await client.get('/api/notifications')).json()).notifications;
	expect(clientNotes.some((n: { excerpt: string }) => n.excerpt?.includes(token))).toBe(false);

	await admin.dispose();
	await staff.dispose();
	await client.dispose();
});

test('AC-9.5.2 a revoked share link denies access', async ({ playwright, baseURL }) => {
	const admin = await playwright.request.newContext({ baseURL });
	const anon = await playwright.request.newContext({ baseURL });
	expect((await admin.post('/api/auth/login', { data: ADMIN })).ok()).toBe(true);

	const mint = await admin.post('/api/share', { data: { resourceType: 'document', resourceId: DOC } });
	const { token } = await mint.json();

	// Works before revocation (public share page resolves).
	expect((await anon.get(`/share/${token}`)).ok()).toBe(true);

	// Revoke -> the link no longer resolves.
	expect((await admin.fetch(`/api/share/${token}`, { method: 'DELETE' })).ok()).toBe(true);
	expect((await anon.get(`/share/${token}`)).status()).toBe(404);

	await admin.dispose();
	await anon.dispose();
});

test('E9 a share link mints a public read-only view of the floorplan', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	await page.getByTestId('share-link').click();
	const note = page.getByTestId('share-url');
	await expect(note).toBeVisible();
	const shareUrl = (await note.textContent()) ?? '';
	const match = shareUrl.match(/\/share\/[a-f0-9]+/);
	expect(match).not.toBeNull();

	// The share page is public (no auth) and read-only: open it in a fresh
	// context with no session cookie.
	const ctx = await page.context().browser()!.newContext();
	const anon = await ctx.newPage();
	await anon.goto(match![0]);
	await expect(anon.getByTestId('share-annotations')).toBeVisible();
	await expect(anon.locator('.eyebrow')).toContainText(/read only/i);
	await anon.screenshot({ path: 'tests/e2e/__screenshots__/share-readonly.png', fullPage: true });
	await ctx.close();
});
