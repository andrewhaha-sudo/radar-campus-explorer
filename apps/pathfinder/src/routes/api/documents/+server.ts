// /api/documents (Epic E5). GET lists documents under ?projectId= (scoped);
// POST registers a document row (admin/staff). The binary upload itself lands
// in E7 (R2 multipart); this records the metadata + storage key.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { listDocuments, createDocument } from '$lib/server/documents';
import { isGlobalScope } from '$lib/server/hierarchy';
import { indexEntity } from '$lib/server/search';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const projectId = url.searchParams.get('projectId');
	if (!projectId) error(400, 'projectId is required.');
	const documents = await listDocuments(env, locals.user, projectId);
	return json({ documents });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { project_id?: string; filename?: string; storage_key?: string; page_count?: number; doc_type?: string; mime_type?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.project_id) error(400, 'project_id is required.');
	if (!body.filename) error(400, 'filename is required.');
	if (!body.storage_key) error(400, 'storage_key is required.');

	const doc = await createDocument(env, {
		project_id: body.project_id,
		filename: body.filename,
		storage_key: body.storage_key,
		page_count: body.page_count,
		doc_type: body.doc_type,
		mime_type: body.mime_type,
		uploaded_by: locals.user.id
	});
	await audit(env, locals.user.id, 'document.create', `document:${doc.id}`, request);
	await indexEntity(env, 'document', doc.id, doc.filename, 'Floorplan', `/documents/${doc.id}`);
	return json({ document: doc }, { status: 201 });
};
