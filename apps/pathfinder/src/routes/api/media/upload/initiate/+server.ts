// /api/media/upload/initiate (Epic E7). Validates the candidate (type/ext/size
// BEFORE any bytes), resolves the next version + R2 key + storage tier, starts
// an R2 multipart upload, and records a pending media row. Returns the key,
// uploadId, mediaId and recommended part size for the client to stream parts.
// Admin/staff only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { createPending, nextVersion } from '$lib/server/media';
import { validateUpload, buildStorageKey, PART_SIZE, type MediaType } from '$lib/engines/media/storage-policy';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env as { DB: D1Database; DOCUMENTS?: R2Bucket } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	if (!env.DOCUMENTS) error(503, 'Object storage is not configured.');

	let body: {
		type?: MediaType;
		filename?: string;
		size?: number;
		mime?: string;
		building_id?: string | null;
		facility_id?: string | null;
		capture_date?: string;
		surveyor?: string;
		floor?: number;
	};
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.type || !body.filename || typeof body.size !== 'number') {
		error(400, 'type, filename and size are required.');
	}
	if (!body.building_id && !body.facility_id) error(400, 'building_id or facility_id is required.');

	const v = validateUpload(body.type, body.filename, body.size, body.mime);
	if (!v.ok) error(400, v.error ?? 'Invalid upload.');

	const version = await nextVersion(env, body.building_id ?? null, body.type, body.filename);
	const key = buildStorageKey(body.type, body.building_id ?? 'facility', version, body.filename);

	const mp = await env.DOCUMENTS.createMultipartUpload(key, {
		customMetadata: { type: body.type, uploadedBy: locals.user.id }
	});

	const asset = await createPending(env, {
		building_id: body.building_id ?? null,
		facility_id: body.facility_id ?? null,
		type: body.type,
		filename: body.filename,
		r2_key: key,
		size: body.size,
		version,
		upload_id: mp.uploadId,
		capture_date: body.capture_date ?? null,
		surveyor: body.surveyor ?? null,
		floor: body.floor ?? null,
		uploaded_by: locals.user.id
	});

	await audit(env, locals.user.id, 'media.upload.initiate', `media:${asset.id}`, request);
	return json({ mediaId: asset.id, key, uploadId: mp.uploadId, partSize: PART_SIZE, version }, { status: 201 });
};
