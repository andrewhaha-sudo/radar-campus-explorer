// Global search DAL (Epic E10). Maintains the FTS5 search_index (index-on-write
// plus a full reindex path) and runs scoped queries: results are re-checked
// against the caller's org so a client can never find another org's entities.

import { canSeeOrg, type ScopeUser } from './hierarchy';
import { toFtsMatch, rankHits, type SearchEntityType, type SearchHit } from '$lib/engines/search/query';

type Env = { DB: D1Database };

/** Upsert one entity into the index (delete-then-insert keeps it idempotent). */
export async function indexEntity(
	env: Env,
	type: SearchEntityType,
	id: string,
	title: string,
	subtitle: string,
	url: string
): Promise<void> {
	await env.DB.batch([
		env.DB.prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?').bind(type, id),
		env.DB.prepare(
			'INSERT INTO search_index (entity_type, entity_id, title, subtitle, url) VALUES (?, ?, ?, ?, ?)'
		).bind(type, id, title, subtitle, url)
	]);
}

export async function removeFromIndex(env: Env, type: SearchEntityType, id: string): Promise<void> {
	await env.DB.prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?')
		.bind(type, id)
		.run();
}

/** Rebuild the entire index from the source tables (the reindex path). Returns
 *  the number of rows indexed. */
export async function reindexAll(env: Env): Promise<number> {
	await env.DB.prepare('DELETE FROM search_index').run();
	const stmts: D1PreparedStatement[] = [];
	const push = (type: string, id: string, title: string, subtitle: string, url: string) =>
		stmts.push(
			env.DB.prepare(
				'INSERT INTO search_index (entity_type, entity_id, title, subtitle, url) VALUES (?, ?, ?, ?, ?)'
			).bind(type, id, title ?? '', subtitle ?? '', url)
		);

	const facilities = await env.DB.prepare('SELECT id, name, type FROM facilities').all<{ id: string; name: string; type: string | null }>();
	for (const f of facilities.results ?? []) push('facility', f.id, f.name, f.type ?? 'facility', `/facilities/${f.id}`);

	const buildings = await env.DB.prepare('SELECT id, name FROM buildings').all<{ id: string; name: string }>();
	for (const b of buildings.results ?? []) push('building', b.id, b.name, 'Building', `/buildings/${b.id}`);

	const projects = await env.DB.prepare('SELECT id, name, status, building_id FROM projects').all<{ id: string; name: string; status: string; building_id: string | null }>();
	for (const p of projects.results ?? []) push('project', p.id, p.name, p.status, p.building_id ? `/buildings/${p.building_id}` : '/dashboard');

	const docs = await env.DB.prepare('SELECT id, filename FROM documents').all<{ id: string; filename: string }>();
	for (const d of docs.results ?? []) push('document', d.id, d.filename, 'Floorplan', `/documents/${d.id}`);

	const markers = await env.DB.prepare('SELECT id, label, type, doc_id FROM map_markers').all<{ id: string; label: string; type: string; doc_id: string }>();
	for (const m of markers.results ?? []) push('marker', m.id, m.label, `${m.type} marker`, `/documents/${m.doc_id}`);

	if (stmts.length) await env.DB.batch(stmts);
	return stmts.length;
}

/** Resolve the owning org name for a hit, for client scope filtering. */
async function hitOrgName(env: Env, type: SearchEntityType, id: string): Promise<string | null> {
	const q: Record<SearchEntityType, string> = {
		facility: 'SELECT o.name AS n FROM facilities f JOIN orgs o ON o.id=f.org_id WHERE f.id=?',
		building: 'SELECT o.name AS n FROM buildings b JOIN facilities f ON f.id=b.facility_id JOIN orgs o ON o.id=f.org_id WHERE b.id=?',
		project: 'SELECT o.name AS n FROM projects p JOIN buildings b ON b.id=p.building_id JOIN facilities f ON f.id=b.facility_id JOIN orgs o ON o.id=f.org_id WHERE p.id=?',
		document: 'SELECT o.name AS n FROM documents d JOIN projects p ON p.id=d.project_id JOIN buildings b ON b.id=p.building_id JOIN facilities f ON f.id=b.facility_id JOIN orgs o ON o.id=f.org_id WHERE d.id=?',
		marker: 'SELECT o.name AS n FROM map_markers m JOIN documents d ON d.id=m.doc_id JOIN projects p ON p.id=d.project_id JOIN buildings b ON b.id=p.building_id JOIN facilities f ON f.id=b.facility_id JOIN orgs o ON o.id=f.org_id WHERE m.id=?'
	};
	const row = await env.DB.prepare(q[type]).bind(id).first<{ n: string }>();
	return row?.n ?? null;
}

/** Run a scoped search. Returns ranked hits the caller is allowed to see. */
export async function search(env: Env, user: ScopeUser, raw: string, limit = 30): Promise<SearchHit[]> {
	const match = toFtsMatch(raw);
	if (!match) return [];
	const { results } = await env.DB.prepare(
		`SELECT entity_type, entity_id, title, subtitle, url, rank
		   FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT ?`
	)
		.bind(match, limit * 2)
		.all<SearchHit & { rank: number }>();
	let hits = (results ?? []) as SearchHit[];

	if (user.role === 'client') {
		const allowed: SearchHit[] = [];
		for (const h of hits) {
			const org = await hitOrgName(env, h.entity_type, h.entity_id);
			if (canSeeOrg(user, org)) allowed.push(h);
		}
		hits = allowed;
	}
	return rankHits(hits).slice(0, limit);
}
