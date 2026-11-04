// /api/export-jobs/[id] (Epic E6). PATCH updates job progress/status from the
// client-side batch renderer (staff/admin).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';
import { updateJob, getJob } from '$lib/server/exports';

const STATUSES = ['queued', 'running', 'done', 'error'];

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	// Ownership: only the job's creator (or an admin) may update it.
	const job = await getJob(env, params.id);
	if (!job) error(404, 'Export job not found.');
	if (locals.user.role !== 'admin' && job.created_by !== locals.user.id) {
		error(403, 'Not your export job.');
	}

	let body: { status?: string; done?: number; result_key?: string; error?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (body.status !== undefined && !STATUSES.includes(body.status)) error(400, 'Invalid status.');
	if (body.done !== undefined && typeof body.done !== 'number') error(400, 'done must be a number.');

	// Only whitelisted, validated fields are forwarded.
	await updateJob(env, params.id, {
		status: body.status as 'queued' | 'running' | 'done' | 'error' | undefined,
		done: body.done,
		result_key: body.result_key,
		error: body.error
	});
	return json({ ok: true });
};
