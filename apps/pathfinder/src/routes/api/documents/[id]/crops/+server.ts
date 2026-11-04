// /api/documents/[id]/crops (Epic E6). GET lists per-page print crops; PUT
// upserts one page's crop; DELETE removes it. Scoped via getDocument.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocument, listCrops, saveCrop, deleteCrop } from '$lib/server/documents';
import { isGlobalScope } from '$lib/server/hierarchy';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	return json({ crops: await listCrops(env, params.id) });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { page?: number; nx?: number; ny?: number; nw?: number; nh?: number; label?: string; printOrder?: number };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (typeof body.page !== 'number') error(400, 'page is required.');
	await saveCrop(env, params.id, {
		page: body.page,
		nx: body.nx ?? 0,
		ny: body.ny ?? 0,
		nw: body.nw ?? 1,
		nh: body.nh ?? 1,
		label: body.label ?? null,
		printOrder: body.printOrder ?? 0
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, params, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	const page = Number(url.searchParams.get('page'));
	if (!Number.isFinite(page)) error(400, 'page query param is required.');
	await deleteCrop(env, params.id, page);
	return json({ ok: true });
};
