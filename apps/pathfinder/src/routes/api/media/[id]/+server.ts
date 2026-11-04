// /api/media/[id] (Epic E7). GET streams a served asset from R2 (hot tier);
// the cold master point cloud is never served (404 for everyone on the binary,
// even staff, who download it through a separate archive tool, not the portal
// delivery path). DELETE removes the asset (admin/staff) and its R2 object.

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getMedia, deleteMedia } from '$lib/server/media';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const asset = await getMedia(env, locals.user, params.id);
	if (!asset) error(404, 'Media not found.');
	if (asset.served === 0) error(404, 'This asset is archived and not served.');
	if (!env.DOCUMENTS) error(503, 'Object storage is not configured.');
	const obj = await env.DOCUMENTS.get(asset.r2_key);
	if (!obj) error(404, 'Object not found in storage.');
	return new Response(obj.body, {
		headers: {
			'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
			'content-length': String(obj.size),
			'cache-control': 'private, max-age=600'
		}
	});
};

export const DELETE: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	const asset = await getMedia(env, locals.user, params.id);
	if (!asset) error(404, 'Media not found.');
	if (env.DOCUMENTS) await env.DOCUMENTS.delete(asset.r2_key);
	await deleteMedia(env, params.id);
	await audit(env, locals.user.id, 'media.delete', `media:${params.id}`, request);
	return json({ ok: true });
};
