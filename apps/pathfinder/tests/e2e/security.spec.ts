// Security test suite. Actively probes the running app for the controls the
// spec promises: authentication, tenant isolation, RBAC, injection-safety,
// API-key scope, CORS, security headers, and credential non-leakage.

import { test, expect, type APIRequestContext, type APIRequest } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const CLIENT = { email: 'client@test.com', password: 'test1234' }; // Northgate org
// ELS911-org resources the Northgate client must NOT be able to reach:
const ELS_DOC = 'doc-wahs-main-f1-000000000001';
const ELS_FACILITY = 'fac-wahs-0000-0000-0000-000000000001';
const ELS_BUILDING = 'bld-wahs-main-0000-000000000001';

async function ctx(request: APIRequest, baseURL: string, who?: { email: string; password: string }) {
	const c: APIRequestContext = await request.newContext({ baseURL });
	if (who) expect((await c.post('/api/auth/login', { data: who })).ok()).toBe(true);
	return c;
}

test('unauthenticated requests to protected APIs are rejected (401)', async ({ playwright, baseURL }) => {
	const anon = await playwright.request.newContext({ baseURL: baseURL! });
	for (const path of ['/api/auth/me', `/api/documents/${ELS_DOC}/annotations`, '/api/admin/users', '/api/activity']) {
		expect((await anon.get(path)).status()).toBe(401);
	}
	await anon.dispose();
});

test('a forged/garbage bearer token does not authenticate', async ({ playwright, baseURL }) => {
	const anon = await playwright.request.newContext({ baseURL: baseURL! });
	const res = await anon.get('/api/auth/me', { headers: { Authorization: 'Bearer not.a.real.jwt' } });
	expect(res.status()).toBe(401);
	await anon.dispose();
});

test('tenant isolation: a client cannot reach another org by guessing IDs', async ({ playwright, baseURL }) => {
	const client = await ctx(playwright.request, baseURL!, CLIENT);
	// Direct-ID access to ELS911 resources from a Northgate client -> 404, no data.
	expect((await client.get(`/api/documents/${ELS_DOC}/annotations`)).status()).toBe(404);
	expect((await client.get(`/api/documents/${ELS_DOC}/markers`)).status()).toBe(404);
	expect((await client.get(`/api/facilities/${ELS_FACILITY}/ng911`)).status()).toBe(404);
	// Scoped list endpoints leak nothing cross-org.
	const facilities = (await (await client.get('/api/facilities')).json()).facilities;
	expect(facilities.every((f: { id: string }) => f.id !== ELS_FACILITY)).toBe(true);
	await client.dispose();
});

test('RBAC: a client cannot perform staff/admin mutations or reach admin', async ({ playwright, baseURL }) => {
	const client = await ctx(playwright.request, baseURL!, CLIENT);
	// Create operations require staff/admin -> 403.
	expect((await client.post('/api/districts', { data: { org_id: 'x', name: 'hax' } })).status()).toBe(403);
	expect((await client.post('/api/buildings', { data: { facility_id: 'x', name: 'hax' } })).status()).toBe(403);
	expect((await client.post('/api/projects', { data: { name: 'hax', building_id: ELS_BUILDING } })).status()).toBe(403);
	// Admin console is admin-only.
	expect((await client.get('/api/admin/users')).status()).toBe(403);
	await client.dispose();
});

test('search is injection-safe and org-scoped', async ({ playwright, baseURL }) => {
	const client = await ctx(playwright.request, baseURL!, CLIENT);
	// FTS operators / SQL-ish payloads are neutralised (no 500, no cross-org leak).
	for (const q of ['" OR 1=1 --', 'NEAR(', '*', '"; DROP TABLE users; --']) {
		const res = await client.get(`/api/search?q=${encodeURIComponent(q)}`);
		expect(res.ok()).toBe(true);
		const hits = (await res.json()).hits;
		// The Northgate client never sees ELS911 entities regardless of payload.
		expect(hits.every((h: { entity_id: string }) => h.entity_id !== ELS_FACILITY)).toBe(true);
	}
	await client.dispose();
});

test('cross-origin API requests are blocked (CORS)', async ({ playwright, baseURL }) => {
	const c = await ctx(playwright.request, baseURL!, ADMIN);
	const res = await c.get('/api/search?q=main', { headers: { Origin: 'https://evil.example' } });
	expect(res.status()).toBe(403);
	await c.dispose();
});

test('responses carry hardening headers and never leak password material', async ({ playwright, baseURL }) => {
	const admin = await ctx(playwright.request, baseURL!, ADMIN);
	const root = await admin.get('/');
	const h = root.headers();
	expect(h['content-security-policy']).toBeTruthy();
	expect(h['x-frame-options']).toMatch(/DENY/i);
	expect(h['x-content-type-options']).toMatch(/nosniff/i);

	// Neither /me nor the admin user list expose password_hash / salt.
	const me = await (await admin.get('/api/auth/me')).text();
	expect(me).not.toMatch(/password_hash|salt/);
	const users = await (await admin.get('/api/admin/users')).text();
	expect(users).not.toMatch(/password_hash|salt/);
	await admin.dispose();
});

const STAFF = { email: 'staff@test.com', password: 'test1234' };

test('export jobs: only the creator (or admin) may update; unknown columns are ignored', async ({ playwright, baseURL }) => {
	const admin = await ctx(playwright.request, baseURL!, ADMIN);
	const staff = await ctx(playwright.request, baseURL!, STAFF);

	const created = await admin.post('/api/export-jobs', { data: { scopeType: 'building', scopeId: ELS_BUILDING, total: 1 } });
	const jobId = (await created.json()).job.id as string;

	// A different staff user cannot mutate another's job (ownership).
	expect((await staff.fetch(`/api/export-jobs/${jobId}`, { method: 'PATCH', data: { status: 'error' } })).status()).toBe(403);

	// The owner can; an injected/unknown column is silently ignored (whitelist).
	const ok = await admin.fetch(`/api/export-jobs/${jobId}`, { method: 'PATCH', data: { status: 'running', done: 1, hacked_column: 'x' } });
	expect(ok.ok()).toBe(true);
	const job = (await (await admin.get(`/api/export-jobs?scopeType=building&scopeId=${ELS_BUILDING}`)).json()).jobs.find((j: { id: string }) => j.id === jobId);
	expect(job.status).toBe('running');
	expect(job).not.toHaveProperty('hacked_column');
	await admin.dispose();
	await staff.dispose();
});

test('share links: only the issuer (or an admin) may revoke', async ({ playwright, baseURL }) => {
	const admin = await ctx(playwright.request, baseURL!, ADMIN);
	const staff = await ctx(playwright.request, baseURL!, STAFF);
	const { token } = await (await admin.post('/api/share', { data: { resourceType: 'document', resourceId: ELS_DOC } })).json();

	// A staff user who did not issue the link cannot revoke it.
	expect((await staff.fetch(`/api/share/${token}`, { method: 'DELETE' })).status()).toBe(404);
	// The issuer can.
	expect((await admin.fetch(`/api/share/${token}`, { method: 'DELETE' })).ok()).toBe(true);
	await admin.dispose();
	await staff.dispose();
});

test('the audit log exposes no mutation endpoint (append-only)', async ({ playwright, baseURL }) => {
	const admin = await ctx(playwright.request, baseURL!, ADMIN);
	// There is a read/export endpoint but no PATCH/DELETE to tamper with entries.
	expect((await admin.fetch('/api/admin/audit', { method: 'DELETE' })).status()).toBeGreaterThanOrEqual(404);
	expect((await admin.fetch('/api/admin/audit', { method: 'PATCH', data: {} })).status()).toBeGreaterThanOrEqual(404);
	await admin.dispose();
});
