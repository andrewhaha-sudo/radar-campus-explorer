// /api/documents/[id]/briefing (Pro feature). Generates an AI responder
// briefing for a floor, grounded on the document's marked annotations + map
// markers (the same structured data as the non-visual alternative). Staff/admin
// only; scoped via getDocument; audited. 503 when no AI provider is configured.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getDocument, listAnnotations, listMarkers } from '$lib/server/documents';
import { buildMapTextAlternative } from '$lib/engines/a11y/map-text';
import { generateBriefing, aiConfigured } from '$lib/server/ai';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const doc = await getDocument(env, locals.user, params.id);
	if (!doc) error(404, 'Document not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	if (!(await aiConfigured(env))) error(503, 'No AI provider is configured for this deployment.');

	let body: { page?: number };
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const page = typeof body.page === 'number' ? body.page : 1;

	const [annotations, markers, facility] = await Promise.all([
		listAnnotations(env, params.id),
		listMarkers(env, params.id),
		env.DB.prepare(
			`SELECT f.name FROM documents d
			   JOIN projects p ON p.id = d.project_id
			   JOIN buildings b ON b.id = p.building_id
			   JOIN facilities f ON f.id = b.facility_id WHERE d.id = ?`
		)
			.bind(params.id)
			.first<{ name: string }>()
	]);

	const sections = buildMapTextAlternative(
		page,
		annotations.map((a) => ({ type: a.type, page: a.page_number, text: a.text })),
		markers.map((m) => ({ type: m.type, label: m.label, page: m.page }))
	);

	const briefing = await generateBriefing(env, facility?.name ?? doc.filename, `Floor ${page}`, sections);
	await audit(env, locals.user.id, 'ai.briefing', `document:${params.id}`, request);
	return json({ briefing });
};
