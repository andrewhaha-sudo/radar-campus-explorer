// Map theme cascade data-access layer (design doc 2026-08-18, section 5.5).
//
// Themes cascade, nearest wins: org -> facility -> building -> floor -> this
// export. A district gets one look for free, a single school can deviate, a
// single floor can deviate, and an operator can tweak one export without
// saving anything. That is what makes "super custom" survive contact with a
// district that has forty schools.
//
// A row stores only the tokens it OVERRIDES, as JSON, so a preset improvement
// reaches every facility that did not deliberately opt out. The merge happens
// in the engine (theme.ts) - this module only resolves which layers apply.
//
// Scoping mirrors floors.ts: a theme is reachable only if its building ->
// facility -> org is visible to the caller, and canSeeOrg compares org NAMES,
// so the join runs through to orgs.name.

import { uuid } from './auth';
import { canSeeOrg, type ScopeUser } from './hierarchy';
import { DEFAULT_THEME, mergeThemes, type DeepPartial, type MapTheme } from '../engines/map-export/theme';

type Env = { DB: D1Database };

export type ThemeScopeType = 'org' | 'facility' | 'building' | 'floor';

export interface MapThemeRow {
	id: string;
	scope_type: ThemeScopeType;
	scope_id: string;
	name: string;
	/** JSON: the partial token set this scope overrides. */
	tokens: string;
	is_default: number;
	created_at: string;
}

/** Cascade order, lowest priority first. The index IS the priority. */
const SCOPE_ORDER: ThemeScopeType[] = ['org', 'facility', 'building', 'floor'];

interface BuildingScope {
	org_id: string;
	org_name: string;
	facility_id: string;
}

/** Resolve a building's ancestry and check the caller may see it. */
async function buildingScope(
	user: ScopeUser,
	buildingId: string,
	env: Env
): Promise<BuildingScope | null> {
	const row = await env.DB.prepare(
		`SELECT o.id AS org_id, o.name AS org_name, f.id AS facility_id
		   FROM buildings b
		   JOIN facilities f ON f.id = b.facility_id
		   JOIN orgs o      ON o.id = f.org_id
		  WHERE b.id = ?`
	)
		.bind(buildingId)
		.first<BuildingScope>();
	if (!row || !canSeeOrg(user, row.org_name)) return null;
	return row;
}

/** Parse a stored token blob. A corrupt blob is skipped, never thrown: a bad
 *  theme row must not be able to break an export. */
function parseTokens(tokens: string): DeepPartial<MapTheme> | null {
	try {
		const parsed = JSON.parse(tokens);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as DeepPartial<MapTheme>)
			: null;
	} catch {
		return null;
	}
}

/**
 * The theme in force for a building (optionally for one floor of it).
 *
 * Merges every default theme row on the path org -> facility -> building ->
 * floor over DEFAULT_THEME, nearest scope last so it wins. A caller with no
 * visibility, or a building with no themes, gets the default theme - never
 * another org's tokens.
 */
export async function resolveThemeForBuilding(
	user: ScopeUser,
	buildingId: string,
	env: Env,
	floorId?: string
): Promise<MapTheme> {
	const scope = await buildingScope(user, buildingId, env);
	if (!scope) return DEFAULT_THEME;

	const res = await env.DB.prepare(
		`SELECT scope_type, scope_id, tokens
		   FROM map_themes
		  WHERE is_default = 1
		    AND ( (scope_type = 'org'      AND scope_id = ?)
		       OR (scope_type = 'facility' AND scope_id = ?)
		       OR (scope_type = 'building' AND scope_id = ?)
		       OR (scope_type = 'floor'    AND scope_id = ?) )`
	)
		.bind(scope.org_id, scope.facility_id, buildingId, floorId ?? '')
		.all<Pick<MapThemeRow, 'scope_type' | 'scope_id' | 'tokens'>>();

	const rows = res.results ?? [];
	const layers = rows
		.filter((r) => SCOPE_ORDER.includes(r.scope_type))
		// A floor row only applies to the floor that was asked for.
		.filter((r) => r.scope_type !== 'floor' || (!!floorId && r.scope_id === floorId))
		.sort((a, b) => SCOPE_ORDER.indexOf(a.scope_type) - SCOPE_ORDER.indexOf(b.scope_type))
		.map((r) => parseTokens(r.tokens))
		.filter((t): t is DeepPartial<MapTheme> => t !== null);

	if (layers.length === 0) return DEFAULT_THEME;
	return mergeThemes(DEFAULT_THEME, ...layers);
}

/** Every theme saved at one scope, newest first. */
export async function listThemes(
	user: ScopeUser,
	scopeType: ThemeScopeType,
	scopeId: string,
	buildingId: string,
	env: Env
): Promise<MapThemeRow[]> {
	if (!(await buildingScope(user, buildingId, env))) return [];
	const res = await env.DB.prepare(
		'SELECT * FROM map_themes WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC'
	)
		.bind(scopeType, scopeId)
		.all<MapThemeRow>();
	return res.results ?? [];
}

/**
 * Save a theme at a scope ("save as theme" promotes an ad-hoc tweak). Only the
 * overridden tokens are stored. Marking it default clears the previous default
 * at the same scope, so exactly one row per scope drives the cascade.
 */
export async function createTheme(
	user: ScopeUser,
	buildingId: string,
	input: {
		scopeType: ThemeScopeType;
		scopeId: string;
		name: string;
		tokens: DeepPartial<MapTheme>;
		isDefault?: boolean;
	},
	env: Env
): Promise<MapThemeRow | null> {
	if (!(await buildingScope(user, buildingId, env))) return null;
	const id = uuid();
	const isDefault = input.isDefault ? 1 : 0;
	const batch: D1PreparedStatement[] = [];
	if (isDefault) {
		batch.push(
			env.DB.prepare(
				'UPDATE map_themes SET is_default = 0 WHERE scope_type = ? AND scope_id = ?'
			).bind(input.scopeType, input.scopeId)
		);
	}
	batch.push(
		env.DB.prepare(
			`INSERT INTO map_themes (id, scope_type, scope_id, name, tokens, is_default)
			 VALUES (?, ?, ?, ?, ?, ?)`
		).bind(id, input.scopeType, input.scopeId, input.name, JSON.stringify(input.tokens), isDefault)
	);
	await env.DB.batch(batch);
	return env.DB.prepare('SELECT * FROM map_themes WHERE id = ?').bind(id).first<MapThemeRow>();
}
