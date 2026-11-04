// /api/documents/[id]/annotations (Epic E5). GET returns the annotation set;
// PUT replaces it (v1 saveBatch semantics). Scope is enforced by getDocument:
// a caller who cannot see the document gets 404. Any authenticated viewer of
// the document may read; staff/admin (or a project member, future E4) may write.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { getDocument, listAnnotations, saveAnnotationsBatch } from '$lib/server/documents';
import { isGlobalScope } from '$lib/server/hierarchy';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	const annotations = await listAnnotations(env, params.id);
	return json({ annotations });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { annotations?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!Array.isArray(body.annotations)) error(400, 'annotations array required.');
	const ok = (body.annotations as unknown[]).every(
		(a) =>
			a &&
			typeof (a as { type?: unknown }).type === 'string' &&
			Number.isFinite((a as { nx?: unknown }).nx) &&
			Number.isFinite((a as { ny?: unknown }).ny)
	);
	if (!ok) error(400, 'Each annotation needs a type and numeric nx/ny.');

	await saveAnnotationsBatch(env, params.id, body.annotations as never[]);
	await audit(env, locals.user.id, 'annotation.saveBatch', `document:${params.id}`, request);
	return json({ ok: true, count: (body.annotations as unknown[]).length });
};
