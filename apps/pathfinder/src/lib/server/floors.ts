// Floor stack + floor plan version data-access layer (Epic E15).
//
// A floor is the durable unit of a building. Markers hang off the floor; a
// floor plan version is the swappable image underneath them, so a re-survey
// does not strand the annotation work on the superseded PDF.
//
// Ordering rules, which the field workflow depends on:
//   - `label` is free text ("0", "Main", "3") and NEVER drives ordering
//   - `sort_order` is the only ordering truth, lowest floor first, so hallway
//     numbering starts in the basement
//   - `level` is optional metadata for NG911 z-axis output only
//
// Scoping mirrors hierarchy.ts: a floor is visible only if its building ->
// facility -> org is visible to the caller.

import { uuid } from './auth';
import { canSeeOrg, type ScopeUser } from './hierarchy';

type Env = { DB: D1Database };

export interface FloorRow {
	id: string;
	building_id: string;
	label: string;
	level: number | null;
	sort_order: number;
	needs_review: number;
	created_at: string;
	/** Real-world millimetres spanned by one normalized unit of page width, i.e.
	 *  how wide the whole plan is in the world. null = unknown, and the export
	 *  then prints no scale bar rather than one nobody verified (migration 0016). */
	plan_scale: number | null;
	/** Rotation of true north away from up the page, degrees clockwise. */
	north_deg: number;
}

export interface FloorPlanVersionRow {
	id: string;
	floor_id: string;
	doc_id: string;
	page: number;
	version: number;
	is_current: number;
	note: string | null;
	marker_snapshot: string | null;
	created_at: string;
}

/** A floor plus its current plan, which is what the viewer and exporter need. */
export interface FloorWithPlan extends FloorRow {
	doc_id: string | null;
	page: number | null;
	version: number | null;
}

/** True when the caller may see this building. Mirrors docOrgName in
 *  documents.ts: canSeeOrg compares org NAMES, so the join runs through to orgs. */
async function canSeeBuilding(user: ScopeUser, buildingId: string, env: Env): Promise<boolean> {
	const row = await env.DB.prepare(
		`SELECT o.name AS org_name
		   FROM buildings b
		   JOIN facilities f ON f.id = b.facility_id
		   JOIN orgs o      ON o.id = f.org_id
		  WHERE b.id = ?`
	)
		.bind(buildingId)
		.first<{ org_name: string }>();
	return !!row && canSeeOrg(user, row.org_name);
}

/** The building's floors in stack order, each with its current plan. */
export async function listFloors(
	user: ScopeUser,
	buildingId: string,
	env: Env
): Promise<FloorWithPlan[]> {
	if (!(await canSeeBuilding(user, buildingId, env))) return [];
	const res = await env.DB.prepare(
		`SELECT fl.*, v.doc_id AS doc_id, v.page AS page, v.version AS version
		 FROM floors fl
		 LEFT JOIN floor_plan_versions v
		   ON v.floor_id = fl.id AND v.is_current = 1
		 WHERE fl.building_id = ?
		 ORDER BY fl.sort_order`
	)
		.bind(buildingId)
		.all<FloorWithPlan>();
	return res.results ?? [];
}

/**
 * Map each (doc_id, page) in a building to its position in the stack.
 *
 * This is what turns three unrelated PDFs into one ordered building for
 * numbering. Markers carry (doc_id, page), so the exporter and the renumbering
 * engine look their floor position up here rather than guessing from a filename
 * or a page number.
 */
export async function resolveFloorOrder(
	user: ScopeUser,
	buildingId: string,
	env: Env
): Promise<Record<string, number>> {
	const floors = await listFloors(user, buildingId, env);
	const order: Record<string, number> = {};
	floors.forEach((f, i) => {
		if (f.doc_id) order[`${f.doc_id}:${f.page ?? 1}`] = i;
	});
	return order;
}

/** Key a marker into the floor-order map built by resolveFloorOrder. */
export function floorKey(docId: string, page: number): string {
	return `${docId}:${page}`;
}

/** One floor with its current plan, or null when it does not exist or is out of
 *  the caller's scope. Callers use null for a 404 so an invisible floor and a
 *  missing floor are indistinguishable from outside. */
export async function getFloor(
	user: ScopeUser,
	floorId: string,
	env: Env
): Promise<FloorWithPlan | null> {
	const row = await env.DB.prepare(
		`SELECT fl.*, v.doc_id AS doc_id, v.page AS page, v.version AS version
		 FROM floors fl
		 LEFT JOIN floor_plan_versions v
		   ON v.floor_id = fl.id AND v.is_current = 1
		 WHERE fl.id = ?`
	)
		.bind(floorId)
		.first<FloorWithPlan>();
	if (!row) return null;
	return (await canSeeBuilding(user, row.building_id, env)) ? row : null;
}

export async function createFloor(
	user: ScopeUser,
	buildingId: string,
	input: { label: string; level?: number | null; sortOrder?: number },
	env: Env
): Promise<FloorRow | null> {
	if (!(await canSeeBuilding(user, buildingId, env))) return null;

	// Append to the end of the stack unless a position was given.
	let sortOrder = input.sortOrder;
	if (sortOrder === undefined) {
		const max = await env.DB.prepare(
			'SELECT COALESCE(MAX(sort_order), -1) AS m FROM floors WHERE building_id = ?'
		)
			.bind(buildingId)
			.first<{ m: number }>();
		sortOrder = (max?.m ?? -1) + 1;
	}

	const id = uuid();
	await env.DB.prepare(
		'INSERT INTO floors (id, building_id, label, level, sort_order) VALUES (?, ?, ?, ?, ?)'
	)
		.bind(id, buildingId, input.label, input.level ?? null, sortOrder)
		.run();
	return env.DB.prepare('SELECT * FROM floors WHERE id = ?').bind(id).first<FloorRow>();
}

/** Rewrite the stack order from an explicit list of floor ids, lowest first. */
export async function reorderFloors(
	user: ScopeUser,
	buildingId: string,
	floorIds: string[],
	env: Env
): Promise<boolean> {
	if (!(await canSeeBuilding(user, buildingId, env))) return false;
	const stmt = env.DB.prepare(
		'UPDATE floors SET sort_order = ? WHERE id = ? AND building_id = ?'
	);
	await env.DB.batch(floorIds.map((id, i) => stmt.bind(i, id, buildingId)));
	return true;
}

/**
 * Fold any rotation into one clockwise turn, 0 <= deg < 360.
 *
 * Surveyors hand over bearings in whatever form the instrument printed them
 * (-90, 450), and the export draws the arrow from this number directly, so the
 * wrap happens once here rather than at every reader. Anything that is not a
 * finite number falls back to 0, which is the arrow pointing up the page - the
 * behaviour every existing floor already has.
 */
export function normalizeNorthDeg(deg: number): number {
	if (!Number.isFinite(deg)) return 0;
	return ((deg % 360) + 360) % 360;
}

export async function updateFloor(
	user: ScopeUser,
	floorId: string,
	patch: {
		label?: string;
		level?: number | null;
		needsReview?: boolean;
		/** Real-world mm per normalized unit of page width; null clears it. */
		planScale?: number | null;
		/** Degrees clockwise from up the page; normalized before it is stored. */
		northDeg?: number;
	},
	env: Env
): Promise<boolean> {
	const floor = await env.DB.prepare('SELECT building_id FROM floors WHERE id = ?')
		.bind(floorId)
		.first<{ building_id: string }>();
	if (!floor || !(await canSeeBuilding(user, floor.building_id, env))) return false;

	const sets: string[] = [];
	const args: unknown[] = [];
	if (patch.label !== undefined) {
		sets.push('label = ?');
		args.push(patch.label);
	}
	if (patch.level !== undefined) {
		sets.push('level = ?');
		args.push(patch.level);
	}
	if (patch.needsReview !== undefined) {
		sets.push('needs_review = ?');
		args.push(patch.needsReview ? 1 : 0);
	}
	if (patch.planScale !== undefined) {
		// A scale the exporter cannot justify is stored as unknown, not as a
		// number: the scale bar is a measuring instrument, and a zero, negative
		// or non-finite width would print a lie at a readable size.
		const scale = patch.planScale;
		const usable = typeof scale === 'number' && Number.isFinite(scale) && scale > 0;
		sets.push('plan_scale = ?');
		args.push(usable ? scale : null);
	}
	if (patch.northDeg !== undefined) {
		sets.push('north_deg = ?');
		args.push(normalizeNorthDeg(patch.northDeg));
	}
	if (sets.length === 0) return true;

	await env.DB.prepare(`UPDATE floors SET ${sets.join(', ')} WHERE id = ?`)
		.bind(...args, floorId)
		.run();
	return true;
}

/**
 * Remove a floor and everything that hangs off it.
 *
 * The child rows are deleted explicitly rather than left to ON DELETE CASCADE:
 * SQLite only honours the declared cascade when foreign keys are enforced for
 * the connection, so relying on it would leave orphan versions and markers
 * behind on any deployment where they are not.
 */
export async function deleteFloor(
	user: ScopeUser,
	floorId: string,
	env: Env
): Promise<boolean> {
	const floor = await env.DB.prepare('SELECT building_id FROM floors WHERE id = ?')
		.bind(floorId)
		.first<{ building_id: string }>();
	if (!floor || !(await canSeeBuilding(user, floor.building_id, env))) return false;
	await env.DB.batch([
		env.DB.prepare('DELETE FROM floor_plan_versions WHERE floor_id = ?').bind(floorId),
		env.DB.prepare('DELETE FROM map_markers WHERE floor_id = ?').bind(floorId),
		env.DB.prepare('DELETE FROM floors WHERE id = ?').bind(floorId)
	]);
	return true;
}

/**
 * Attach a new plan to a floor, superseding the current one.
 *
 * The outgoing version keeps a JSON snapshot of the marker set so it can be
 * restored or compared, and the floor is flagged needs_review. Markers are NOT
 * touched: they belong to the floor, which is the whole point of the model.
 * Marker coordinates are normalized per page, so a redo at a different crop
 * shifts them - flagging is honest, silent acceptance would not be.
 */
export async function addFloorPlanVersion(
	user: ScopeUser,
	floorId: string,
	input: { docId: string; page?: number; note?: string },
	env: Env
): Promise<FloorPlanVersionRow | null> {
	const floor = await env.DB.prepare('SELECT building_id FROM floors WHERE id = ?')
		.bind(floorId)
		.first<{ building_id: string }>();
	if (!floor || !(await canSeeBuilding(user, floor.building_id, env))) return null;

	const current = await env.DB.prepare(
		'SELECT * FROM floor_plan_versions WHERE floor_id = ? AND is_current = 1'
	)
		.bind(floorId)
		.first<FloorPlanVersionRow>();

	const maxRow = await env.DB.prepare(
		'SELECT COALESCE(MAX(version), 0) AS m FROM floor_plan_versions WHERE floor_id = ?'
	)
		.bind(floorId)
		.first<{ m: number }>();
	const nextVersion = (maxRow?.m ?? 0) + 1;

	const batch: D1PreparedStatement[] = [];

	if (current) {
		const markers = await env.DB.prepare('SELECT * FROM map_markers WHERE floor_id = ?')
			.bind(floorId)
			.all();
		batch.push(
			env.DB.prepare(
				'UPDATE floor_plan_versions SET is_current = 0, marker_snapshot = ? WHERE id = ?'
			).bind(JSON.stringify(markers.results ?? []), current.id)
		);
	}

	const id = uuid();
	batch.push(
		env.DB.prepare(
			`INSERT INTO floor_plan_versions (id, floor_id, doc_id, page, version, is_current, note)
			 VALUES (?, ?, ?, ?, ?, 1, ?)`
		).bind(id, floorId, input.docId, input.page ?? 1, nextVersion, input.note ?? null)
	);

	// Only flag for review when this replaces an existing plan; the first plan on
	// a floor has no prior marker positions to invalidate.
	if (current) {
		batch.push(env.DB.prepare('UPDATE floors SET needs_review = 1 WHERE id = ?').bind(floorId));
	}

	await env.DB.batch(batch);
	return env.DB.prepare('SELECT * FROM floor_plan_versions WHERE id = ?')
		.bind(id)
		.first<FloorPlanVersionRow>();
}

export async function listFloorPlanVersions(
	user: ScopeUser,
	floorId: string,
	env: Env
): Promise<FloorPlanVersionRow[]> {
	const floor = await env.DB.prepare('SELECT building_id FROM floors WHERE id = ?')
		.bind(floorId)
		.first<{ building_id: string }>();
	if (!floor || !(await canSeeBuilding(user, floor.building_id, env))) return [];
	const res = await env.DB.prepare(
		'SELECT * FROM floor_plan_versions WHERE floor_id = ? ORDER BY version DESC'
	)
		.bind(floorId)
		.all<FloorPlanVersionRow>();
	return res.results ?? [];
}
