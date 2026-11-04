// /api/documents/[id]/comments (Epic E9). GET lists open comment threads on a
// document's annotations (?all=1 includes resolved for the audit view); POST
// adds a comment, fans @-mentions to notifications, logs activity. Scoped via
// getDocument.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocument } from '$lib/server/documents';
import { listComments, addComment } from '$lib/server/collab';

export const GET: RequestHandler = async ({ locals, platform, params, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	const includeResolved = url.searchParams.get('all') === '1';
	return json({ comments: await listComments(env, params.id, includeResolved) });
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');

	let body: { annotationId?: string; text?: string; parentId?: string | null; images?: string[] };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.annotationId || !body.text?.trim()) error(400, 'annotationId and text are required.');

	// Document org for mention scoping (AC-9.3.2).
	const orgRow = await env.DB.prepare(
		`SELECT o.name AS n FROM documents d
		   JOIN projects p ON p.id = d.project_id
		   JOIN buildings b ON b.id = p.building_id
		   JOIN facilities f ON f.id = b.facility_id
		   JOIN orgs o ON o.id = f.org_id WHERE d.id = ?`
	)
		.bind(params.id)
		.first<{ n: string }>();

	const comment = await addComment(env, {
		annotationId: body.annotationId,
		userId: locals.user.id,
		actorName: locals.user.name,
		text: body.text.trim(),
		resourceUrl: `/documents/${params.id}`,
		parentId: body.parentId ?? null,
		images: body.images ?? null,
		docOrg: orgRow?.n ?? null
	});
	return json({ comment }, { status: 201 });
};
