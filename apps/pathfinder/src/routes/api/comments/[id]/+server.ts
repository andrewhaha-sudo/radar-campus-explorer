// /api/comments/[id] (Epic E9). PATCH toggles the resolve state of a comment
// thread. Resolving HIDES the thread (preserved for the audit trail), never
// deletes it. Staff/admin only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';
import { setCommentResolved, commentDocumentId } from '$lib/server/collab';
import { getDocument } from '$lib/server/documents';

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	// Scope to the comment's document so a staff user cannot resolve another
	// org's thread by guessing an id (IDOR).
	const docId = await commentDocumentId(env, params.id);
	if (!docId || !(await getDocument(env, locals.user, docId))) error(404, 'Comment not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { resolved?: boolean };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (typeof body.resolved !== 'boolean') error(400, 'resolved boolean required.');
	await setCommentResolved(env, params.id, body.resolved, locals.user.id);
	return json({ ok: true });
};
