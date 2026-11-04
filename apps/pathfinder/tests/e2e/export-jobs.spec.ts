// E2E for batch map export jobs (Epic E6): a job is created and tracked
// (AC-6.4.1), and a failed render marks the job errored (AC-6.4.2).

import { test, expect, type APIRequestContext } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const BUILDING = 'bld-wahs-main-0000-000000000001';

test('AC-6.4.1 / AC-6.4.2 a batch export job is created, tracked, and can be marked failed', async ({ playwright, baseURL }) => {
	const admin: APIRequestContext = await playwright.request.newContext({ baseURL });
	expect((await admin.post('/api/auth/login', { data: ADMIN })).ok()).toBe(true);

	// AC-6.4.1: enqueue a batch export job for a building scope.
	const created = await admin.post('/api/export-jobs', {
		data: { scopeType: 'building', scopeId: BUILDING, total: 3 }
	});
	expect(created.status()).toBe(201);
	const jobId = (await created.json()).job.id as string;

	const listed = await (await admin.get(`/api/export-jobs?scopeType=building&scopeId=${BUILDING}`)).json();
	expect(listed.jobs.some((j: { id: string }) => j.id === jobId)).toBe(true);

	// progress update (running)
	expect((await admin.fetch(`/api/export-jobs/${jobId}`, { method: 'PATCH', data: { status: 'running', done: 1 } })).ok()).toBe(true);

	// AC-6.4.2: a mid-render failure marks the job errored (partial not delivered).
	expect((await admin.fetch(`/api/export-jobs/${jobId}`, { method: 'PATCH', data: { status: 'error', error: 'render failed' } })).ok()).toBe(true);
	const after = await (await admin.get(`/api/export-jobs?scopeType=building&scopeId=${BUILDING}`)).json();
	const job = after.jobs.find((j: { id: string }) => j.id === jobId);
	expect(job.status).toBe('error');
	expect(job.result_key).toBeFalsy(); // no partial result delivered

	await admin.dispose();
});
