// /api/documents/[id]/markers (Epic E6). GET returns the map-marker layer;
// PUT replaces it (batch). Scoped via getDocument.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { getDocument, listMarkers, saveMarkersBatch } from '$lib/server/documents';
import { isGlobalScope } from '$lib/server/hierarchy';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	const markers = await listMarkers(env, params.id);
	return json({ markers });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { markers?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!Array.isArray(body.markers)) error(400, 'markers array required.');
	const ok = (body.markers as unknown[]).every(
		(m) =>
			m &&
			typeof (m as { type?: unknown }).type === 'string' &&
			Number.isFinite((m as { nx?: unknown }).nx) &&
			Number.isFinite((m as { ny?: unknown }).ny)
	);
	if (!ok) error(400, 'Each marker needs a type and numeric nx/ny.');

	await saveMarkersBatch(env, params.id, body.markers as never[]);
	await audit(env, locals.user.id, 'marker.saveBatch', `document:${params.id}`, request);
	return json({ ok: true, count: (body.markers as unknown[]).length });
};
