// Document viewer (Epics E5/E6). Server-guarded: 404 for any document the
// caller's scope cannot see. Loads the document, its saved annotations, the map
// marker layer and crops, plus the parent project for the breadcrumb. The PDF
// binary itself is streamed lazily from /api/documents/[id]/file.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getDocument,
	listAnnotations,
	listMarkers,
	listCrops
} from '$lib/server/documents';
import { isGlobalScope } from '$lib/server/hierarchy';
import { aiConfigured } from '$lib/server/ai';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const document = await getDocument(env, locals.user, params.id);
	if (!document) error(404, 'Document not found.');

	const [annotations, markers, crops] = await Promise.all([
		listAnnotations(env, params.id),
		listMarkers(env, params.id),
		listCrops(env, params.id)
	]);

	// Facility civic data for the NFPA/map export header (best-effort join).
	const facility = await env.DB.prepare(
		`SELECT f.address, f.zip, f.phone, f.name FROM documents d
		   JOIN projects p ON p.id = d.project_id
		   JOIN buildings b ON b.id = p.building_id
		   JOIN facilities f ON f.id = b.facility_id
		  WHERE d.id = ?`
	)
		.bind(params.id)
		.first<{ address: string | null; zip: string | null; phone: string | null; name: string }>();

	return {
		document,
		annotations,
		markers,
		crops,
		canEdit: isGlobalScope(locals.user),
		aiEnabled: await aiConfigured(env),
		fileUrl: `/api/documents/${params.id}/file`,
		facilityName: facility?.name ?? null,
		facilityAddress: facility?.address ?? null,
		facilityZip: facility?.zip ?? null,
		facilityPhone: facility?.phone ?? null
	};
};
