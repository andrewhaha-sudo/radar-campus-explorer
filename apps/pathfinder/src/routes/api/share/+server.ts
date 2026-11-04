// /api/share (Epic E9). POST mints a tokenised read-only share link for a
// resource (staff/admin). The token is opaque and optionally expiring.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';
import { createShareLink } from '$lib/server/collab';

export const POST: RequestHandler = async ({ locals, platform, request, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { resourceType?: string; resourceId?: string; expiresAt?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!body.resourceType || !body.resourceId) error(400, 'resourceType and resourceId required.');

	const token = await createShareLink(env, {
		resourceType: body.resourceType,
		resourceId: body.resourceId,
		createdBy: locals.user.id,
		expiresAt: body.expiresAt ?? null
	});
	return json({ token, url: `${url.origin}/share/${token}` }, { status: 201 });
};
