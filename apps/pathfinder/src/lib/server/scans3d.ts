// 3D scan annotation DAL (Epic E8). Markers and viewpoints attach to a
// media_asset; visibility is delegated to getMedia (which enforces hierarchy
// scope and the never-served-master rule). Batch save mirrors the 2D engine.

import { uuid } from './auth';
import { getMedia } from './media';
import { MAX_SCENE_MARKERS } from '$lib/engines/splat-viewer/markers3d';
import type { ScopeUser } from './hierarchy';

type Env = { DB: D1Database };

export interface Marker3dRow {
	id: string;
	media_id: string;
	type: string;
	label: string;
	description: string | null;
	px: number;
	py: number;
	pz: number;
	nx: number | null;
	ny: number | null;
	nz: number | null;
	viewpoint_id: string | null;
	floor: number | null;
}

export interface ViewpointRow {
	id: string;
	media_id: string;
	name: string;
	px: number;
	py: number;
	pz: number;
	tx: number;
	ty: number;
	tz: number;
	fov: number;
	sort_order: number;
}

export async function listMarkers3d(env: Env, user: ScopeUser, mediaId: string): Promise<Marker3dRow[] | null> {
	if (!(await getMedia(env, user, mediaId))) return null;
	const { results } = await env.DB.prepare(
		'SELECT * FROM scan_markers_3d WHERE media_id = ? ORDER BY created_at'
	)
		.bind(mediaId)
		.all<Marker3dRow>();
	return results ?? [];
}

export async function saveMarkers3dBatch(
	env: Env,
	mediaId: string,
	markers: Array<{
		id?: string;
		type: string;
		label?: string;
		description?: string | null;
		position: [number, number, number];
		normal?: [number, number, number] | null;
		viewpointId?: string | null;
		floor?: number | null;
		createdBy?: string | null;
	}>
): Promise<void> {
	const capped = markers.slice(0, MAX_SCENE_MARKERS); // enforce cap server-side
	const stmts: D1PreparedStatement[] = [
		env.DB.prepare('DELETE FROM scan_markers_3d WHERE media_id = ?').bind(mediaId)
	];
	for (const m of capped) {
		const n = m.normal ?? [null, null, null];
		stmts.push(
			env.DB.prepare(
				`INSERT INTO scan_markers_3d
				  (id, media_id, type, label, description, px, py, pz, nx, ny, nz, viewpoint_id, floor, created_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				m.id ?? uuid(),
				mediaId,
				m.type,
				m.label ?? '',
				m.description ?? null,
				m.position[0],
				m.position[1],
				m.position[2],
				n[0],
				n[1],
				n[2],
				m.viewpointId ?? null,
				m.floor ?? null,
				m.createdBy ?? null
			)
		);
	}
	await env.DB.batch(stmts);
}

export async function listViewpoints(env: Env, user: ScopeUser, mediaId: string): Promise<ViewpointRow[] | null> {
	if (!(await getMedia(env, user, mediaId))) return null;
	const { results } = await env.DB.prepare(
		'SELECT * FROM viewpoints WHERE media_id = ? ORDER BY sort_order, name'
	)
		.bind(mediaId)
		.all<ViewpointRow>();
	return results ?? [];
}

export async function saveViewpointsBatch(
	env: Env,
	mediaId: string,
	viewpoints: Array<{
		id?: string;
		name: string;
		position: [number, number, number];
		target: [number, number, number];
		fov?: number;
		order?: number;
		createdBy?: string | null;
	}>
): Promise<void> {
	const stmts: D1PreparedStatement[] = [
		env.DB.prepare('DELETE FROM viewpoints WHERE media_id = ?').bind(mediaId)
	];
	viewpoints.forEach((v, i) => {
		stmts.push(
			env.DB.prepare(
				`INSERT INTO viewpoints (id, media_id, name, px, py, pz, tx, ty, tz, fov, sort_order, created_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				v.id ?? uuid(),
				mediaId,
				v.name,
				v.position[0],
				v.position[1],
				v.position[2],
				v.target[0],
				v.target[1],
				v.target[2],
				v.fov ?? 60,
				v.order ?? i,
				v.createdBy ?? null
			)
		);
	});
	await env.DB.batch(stmts);
}
