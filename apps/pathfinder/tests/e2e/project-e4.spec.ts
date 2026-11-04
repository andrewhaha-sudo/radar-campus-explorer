// E2E for the full project review workflow (Epic E4): create + validation
// (AC-4.1.1/4.1.2), membership access (AC-4.2.1/4.5.1), version publish +
// member notification (AC-4.3.1/4.3.2), approval recorded (AC-4.4.1),
// non-reviewer denied (AC-4.4.2).

import { test, expect, type APIRequestContext } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const CLIENT = { email: 'client@test.com', password: 'test1234' };
const NORTHGATE_BUILDING = 'bld-north-main-0000-000000000001';

async function apiLogin(request: APIRequestContext, who: { email: string; password: string }) {
	const res = await request.post('/api/auth/login', { data: who });
	expect(res.ok()).toBe(true);
	return (await res.json()).user.id as string;
}

test('E4 full review workflow: create, members, publish+notify, approve, scope', async ({ playwright, baseURL }) => {
	// Independent request contexts = independent sessions (admin vs client).
	const admin = await playwright.request.newContext({ baseURL });
	const client = await playwright.request.newContext({ baseURL });
	await apiLogin(admin, ADMIN);
	const clientId = await apiLogin(client, CLIENT);

	// AC-4.1.2: a project with no building is rejected.
	const noBuilding = await admin.post('/api/projects', { data: { name: 'X' } });
	expect(noBuilding.status()).toBe(400);

	// AC-4.1.1: create a project under the client's org building.
	const name = `E4 Egress ${Date.now()}`;
	const created = await admin.post('/api/projects', { data: { name, building_id: NORTHGATE_BUILDING } });
	expect(created.status()).toBe(201);
	const projectId = (await created.json()).project.id as string;

	// Before membership, the client cannot access the project directly (AC-4.5.1 inverse).
	expect((await client.get(`/api/projects/${projectId}`)).status()).toBe(404);

	// Add the client as a VIEWER first -> AC-4.4.2: a non-reviewer cannot approve.
	expect((await admin.post(`/api/projects/${projectId}/members`, { data: { userId: clientId, role: 'viewer' } })).ok()).toBe(true);
	expect((await client.get(`/api/projects/${projectId}`)).status()).toBe(200); // member can now see it
	expect((await client.post(`/api/projects/${projectId}/approve`)).status()).toBe(403);

	// Promote the client to REVIEWER (upsert role).
	expect((await admin.post(`/api/projects/${projectId}/members`, { data: { userId: clientId, role: 'reviewer' } })).ok()).toBe(true);

	// AC-4.3.1: publish a version -> the member is notified (digest fan-out).
	const pub = await admin.post(`/api/projects/${projectId}/versions`, { data: { notes: 'v1' } });
	expect(pub.status()).toBe(201);
	expect((await pub.json()).version).toBe(1);
	const digest = await admin.post('/api/notifications/digest');
	expect((await digest.json()).digests).toBeGreaterThanOrEqual(1);

	// AC-4.3.2: publishing again yields V2 as current; V1 record retained.
	expect((await admin.post(`/api/projects/${projectId}/versions`, { data: { notes: 'v2' } })).status()).toBe(201);
	const versions = await (await admin.get(`/api/projects/${projectId}/versions`)).json();
	expect(versions.versions.map((v: { version: number }) => v.version).sort()).toEqual([1, 2]);

	// AC-4.4.1: the reviewer approves -> approval recorded with actor + timestamp.
	const approve = await client.post(`/api/projects/${projectId}/approve`);
	expect(approve.status()).toBe(200);
	const detail = await (await admin.get(`/api/projects/${projectId}`)).json();
	expect(detail.approvals.length).toBeGreaterThanOrEqual(1);
	expect(detail.approvals[0].approver_id).toBe(clientId);
	expect(detail.approvals[0].created_at).toBeTruthy();
	expect(detail.project.status).toBe('approved');

	// AC-4.5.1: remove the member -> the client loses access on the next request.
	expect((await admin.fetch(`/api/projects/${projectId}/members?userId=${clientId}`, { method: 'DELETE' })).ok()).toBe(true);
	expect((await client.get(`/api/projects/${projectId}`)).status()).toBe(404);

	await admin.dispose();
	await client.dispose();
});

test('AC-4.2.1 a client sees project status but no staff edit controls', async ({ browser }) => {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(CLIENT.email);
	await page.getByLabel('Password').fill(CLIENT.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');

	await page.goto(`/buildings/${NORTHGATE_BUILDING}`);
	// Client sees the project list + status, but not the staff-only controls.
	await expect(page.getByTestId('create-project')).toHaveCount(0);
	await expect(page.getByTestId('project-actions')).toHaveCount(0);
	await ctx.close();
});
