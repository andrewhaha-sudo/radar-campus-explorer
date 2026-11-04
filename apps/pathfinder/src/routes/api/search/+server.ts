// /api/search?q= (Epic E10). Scoped global search across all indexed entities.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { search } from '$lib/server/search';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const q = url.searchParams.get('q') ?? '';
	const hits = await search(env, locals.user, q);
	return json({ query: q, hits });
};
