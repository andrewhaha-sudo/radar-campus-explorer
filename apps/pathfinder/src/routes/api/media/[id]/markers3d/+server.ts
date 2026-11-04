// /api/media/[id]/markers3d (Epic E8). GET returns anchored scene markers;
// PUT replaces them (batch, capped at MAX_SCENE_MARKERS server-side). Scoped
// via getMedia inside the DAL.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { listMarkers3d, saveMarkers3dBatch } from '$lib/server/scans3d';
import { validateMarker3d } from '$lib/engines/splat-viewer/markers3d';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const markers = await listMarkers3d(env, locals.user, params.id);
	if (markers === null) error(404, 'Media not found.');
	return json({ markers });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const visible = await listMarkers3d(env, locals.user, params.id);
	if (visible === null) error(404, 'Media not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { markers?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!Array.isArray(body.markers)) error(400, 'markers array required.');
	for (const m of body.markers as Array<{ type?: unknown; position?: unknown }>) {
		const err = validateMarker3d(m?.type, m?.position);
		if (err) error(400, err);
	}
	await saveMarkers3dBatch(env, params.id, body.markers as never[]);
	await audit(env, locals.user.id, 'scan3d.markers.save', `media:${params.id}`, request);
	return json({ ok: true, count: (body.markers as unknown[]).length });
};
