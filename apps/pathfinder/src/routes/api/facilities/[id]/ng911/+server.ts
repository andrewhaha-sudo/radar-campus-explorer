// /api/facilities/[id]/ng911 (Epic E11). Downloads a NENA-STA-006-aligned
// GeoJSON export for the facility, with z-axis floor labels and confidence.
// Scoped via exportNg911 (returns null when not visible -> 404).

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { exportNg911 } from '$lib/server/compliance';

export const GET: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const fc = await exportNg911(env, locals.user, params.id, new Date().toISOString());
	if (!fc) error(404, 'Facility not found.');
	await audit(env, locals.user.id, 'compliance.ng911.export', `facility:${params.id}`, request);

	return new Response(JSON.stringify(fc, null, 2), {
		headers: {
			'content-type': 'application/geo+json',
			'content-disposition': `attachment; filename="${params.id}_ng911.geojson"`
		}
	});
};
