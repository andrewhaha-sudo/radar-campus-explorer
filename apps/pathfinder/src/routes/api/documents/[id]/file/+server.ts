// /api/documents/[id]/file (Epic E5). Streams the document's binary from the
// R2 DOCUMENTS bucket with auth + scope enforced. Until the R2 binding lands
// (E7/S4) this returns 404, and the viewer falls back to a demo canvas so the
// annotation tooling stays demonstrable. <img>/<iframe> cannot send the bearer
// token, so the PDF is fetched here behind the session cookie.

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocument } from '$lib/server/documents';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');

	if (!env.DOCUMENTS) error(404, 'Object storage not configured yet.');
	const obj = await env.DOCUMENTS.get(doc.storage_key);
	if (!obj) error(404, 'File not found in storage.');

	return new Response(obj.body, {
		headers: {
			'content-type': doc.mime_type || 'application/pdf',
			'content-length': String(obj.size),
			'cache-control': 'private, max-age=300'
		}
	});
};
