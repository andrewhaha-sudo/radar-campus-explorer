// /api/documents/[id]/comment-images (Epic E9, v1 parity). POST uploads an
// image attachment for a comment to R2 and returns its key; GET (?key=) streams
// it back (same-origin <img src> carries the session cookie, so no bearer dance
// is needed). Scoped via getDocument. Validated before read (project rule).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocument } from '$lib/server/documents';
import { uuid } from '$lib/server/auth';
import { validateUpload } from '$lib/engines/media/storage-policy';

export const GET: RequestHandler = async ({ locals, platform, params, url }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getDocument(env, locals.user, params.id))) error(404, 'Document not found.');
	const key = url.searchParams.get('key');
	if (!key || !key.startsWith(`hot/comment-img/${params.id}/`)) error(400, 'Invalid key.');
	if (!env.DOCUMENTS) error(404, 'Object storage not configured.');
	const obj = await env.DOCUMENTS.get(key);
	if (!obj) error(404, 'Image not found.');
	return new Response(obj.body, {
		headers: { 'content-type': obj.httpMetadata?.contentType || 'image/*', 'cache-control': 'private, max-age=600' }
	});
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getDocument(env, locals.user, params.id))) error(404, 'Document not found.');
	if (!env.DOCUMENTS) error(503, 'Object storage is not configured.');

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) error(400, 'A file field is required.');
	const check = validateUpload('reference_image', file.name, file.size, file.type || undefined);
	if (!check.ok) error(400, check.error ?? 'Invalid image.');

	const ext = file.name.slice(file.name.lastIndexOf('.')) || '.png';
	const key = `hot/comment-img/${params.id}/${uuid()}${ext}`;
	await env.DOCUMENTS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'image/png' } });
	return json({ key }, { status: 201 });
};
