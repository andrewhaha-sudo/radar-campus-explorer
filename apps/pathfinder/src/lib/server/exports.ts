// Batch export job DAL (Epic E6 - batch export). A queued, tracked multi-map
// PDF export over a district/facility/building scope. The actual rendering runs
// client-side over the tested map engine; the job row tracks progress so the
// UI can show status and the result can be collected.

import { uuid } from './auth';

type Env = { DB: D1Database };

export interface ExportJob {
	id: string;
	scope_type: 'district' | 'facility' | 'building';
	scope_id: string;
	status: 'queued' | 'running' | 'done' | 'error';
	total: number;
	done: number;
	result_key: string | null;
	error: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export async function createJob(
	env: Env,
	input: { scopeType: ExportJob['scope_type']; scopeId: string; total: number; createdBy: string }
): Promise<ExportJob> {
	const id = uuid();
	await env.DB.prepare(
		'INSERT INTO export_jobs (id, scope_type, scope_id, total, created_by) VALUES (?, ?, ?, ?, ?)'
	)
		.bind(id, input.scopeType, input.scopeId, input.total, input.createdBy)
		.run();
	return (await env.DB.prepare('SELECT * FROM export_jobs WHERE id = ?').bind(id).first<ExportJob>())!;
}

export async function getJob(env: Env, id: string): Promise<ExportJob | null> {
	return env.DB.prepare('SELECT * FROM export_jobs WHERE id = ?').bind(id).first<ExportJob>();
}

/** Update a job's tracked fields. Only a fixed whitelist of columns is settable
 *  - keys never reach the SQL string, so a caller cannot inject column names. */
export async function updateJob(
	env: Env,
	id: string,
	patch: { status?: ExportJob['status']; done?: number; result_key?: string | null; error?: string | null }
): Promise<void> {
	const sets: string[] = ["updated_at = datetime('now')"];
	const binds: unknown[] = [];
	if (patch.status !== undefined) {
		sets.push('status = ?');
		binds.push(patch.status);
	}
	if (patch.done !== undefined) {
		sets.push('done = ?');
		binds.push(patch.done);
	}
	if (patch.result_key !== undefined) {
		sets.push('result_key = ?');
		binds.push(patch.result_key);
	}
	if (patch.error !== undefined) {
		sets.push('error = ?');
		binds.push(patch.error);
	}
	binds.push(id);
	await env.DB.prepare(`UPDATE export_jobs SET ${sets.join(', ')} WHERE id = ?`)
		.bind(...binds)
		.run();
}

export async function listJobs(
	env: Env,
	scope: { scopeType: string; scopeId: string }
): Promise<ExportJob[]> {
	const { results } = await env.DB.prepare(
		'SELECT * FROM export_jobs WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC LIMIT 20'
	)
		.bind(scope.scopeType, scope.scopeId)
		.all<ExportJob>();
	return results ?? [];
}
