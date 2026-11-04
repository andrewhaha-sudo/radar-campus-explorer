// /api/media/upload/complete (Epic E7). Finalises the R2 multipart upload from
// the collected parts and flips the media row to active. On any failure the
// upload is aborted and the pending row deleted so no half-written object is
// left billable. Admin/staff only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { markActive, deleteMedia, getMedia } from '$lib/server/media';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	if (!env.DOCUMENTS) error(503, 'Object storage is not configured.');

	let body: { mediaId?: string; key?: string; uploadId?: string; parts?: Array<{ partNumber: number; etag: string }> };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.mediaId || !body.key || !body.uploadId || !Array.isArray(body.parts) || body.parts.length === 0) {
		error(400, 'mediaId, key, uploadId and a non-empty parts array are required.');
	}

	const asset = await getMedia(env, locals.user, body.mediaId);
	if (!asset) error(404, 'Media not found.');

	const mp = env.DOCUMENTS.resumeMultipartUpload(body.key, body.uploadId);
	try {
		await mp.complete(body.parts);
	} catch (e) {
		try {
			await mp.abort();
		} catch {
			/* best-effort */
		}
		await deleteMedia(env, body.mediaId);
		error(422, 'Failed to assemble upload; it was aborted. ' + (e instanceof Error ? e.message : ''));
	}

	await markActive(env, body.mediaId);
	await audit(env, locals.user.id, 'media.upload.complete', `media:${body.mediaId}`, request);
	return json({ ok: true, mediaId: body.mediaId });
};
