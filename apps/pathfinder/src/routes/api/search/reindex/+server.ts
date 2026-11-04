// /api/search/reindex (Epic E10). Rebuild the FTS5 index from source tables.
// Admin/staff only. The reindex path complements index-on-write.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reindexAll } from '$lib/server/search';
import { isGlobalScope } from '$lib/server/hierarchy';

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	const count = await reindexAll(env);
	return json({ ok: true, indexed: count });
};
