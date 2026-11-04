// /api/media/upload/part (Epic E7). Streams one multipart chunk into R2 and
// returns its { partNumber, etag } for the client to collect. Resumable: the
// client can retry any failed part by re-PUTting the same partNumber. Admin/
// staff only. Query: ?key=&uploadId=&part=N. Body: the raw chunk bytes.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';

export const PUT: RequestHandler = async ({ locals, platform, url, request }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	if (!env.DOCUMENTS) error(503, 'Object storage is not configured.');

	const key = url.searchParams.get('key');
	const uploadId = url.searchParams.get('uploadId');
	const part = Number(url.searchParams.get('part'));
	if (!key || !uploadId || !Number.isInteger(part) || part < 1) {
		error(400, 'key, uploadId and a 1-based part are required.');
	}

	const body = await request.arrayBuffer();
	if (body.byteLength === 0) error(400, 'Empty part body.');

	const mp = env.DOCUMENTS.resumeMultipartUpload(key, uploadId);
	const uploaded = await mp.uploadPart(part, body);
	return json({ partNumber: uploaded.partNumber, etag: uploaded.etag });
};
