// Global search query helpers (Epic E10). Pure: turns a raw user query into a
// safe SQLite FTS5 MATCH expression (no injection, prefix matching on the last
// token) and provides @-mention parsing reused by collaboration (E9). No DB.

/**
 * Sanitize a raw query into an FTS5 MATCH string. Each whitespace-separated
 * token is double-quoted (so FTS5 treats it as a literal, neutralising its
 * operator syntax) and the final token gets a prefix '*' for as-you-type
 * matching. Returns '' for an empty/blank query (caller should skip the search).
 */
export function toFtsMatch(raw: string): string {
	const tokens = raw
		.trim()
		.split(/\s+/)
		.map((t) => t.replace(/["*]/g, '')) // strip quotes + stars the user typed
		.filter((t) => t.length > 0);
	if (tokens.length === 0) return '';
	return tokens
		.map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`))
		.join(' ');
}

export type SearchEntityType = 'facility' | 'building' | 'project' | 'document' | 'marker';

export interface SearchHit {
	entity_type: SearchEntityType;
	entity_id: string;
	title: string;
	subtitle?: string | null;
	url: string;
	rank?: number;
}

/** Stable ordering for mixed-entity results: by rank (lower = better in FTS5
 *  bm25), then a fixed entity-type priority, then title. Pure + testable. */
const TYPE_PRIORITY: Record<SearchEntityType, number> = {
	facility: 0,
	building: 1,
	project: 2,
	document: 3,
	marker: 4
};

export function rankHits(hits: SearchHit[]): SearchHit[] {
	return hits
		.slice()
		.sort(
			(a, b) =>
				(a.rank ?? 0) - (b.rank ?? 0) ||
				TYPE_PRIORITY[a.entity_type] - TYPE_PRIORITY[b.entity_type] ||
				a.title.localeCompare(b.title)
		);
}

// --- @-mentions (shared with collaboration E9) ---

/** Extract @-mentioned handles from a comment body (alnum, dot, underscore,
 *  hyphen). Deduplicated, lower-cased, in first-seen order. */
export function parseMentions(body: string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const re = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9._-]{2,})/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(body)) !== null) {
		const handle = m[2].toLowerCase();
		if (!seen.has(handle)) {
			seen.add(handle);
			out.push(handle);
		}
	}
	return out;
}
