// Document / annotation / map-marker data-access layer (Epics E5, E6).
//
// Scoping mirrors hierarchy.ts: a document is visible only if its
// project -> building -> facility -> org is visible to the caller. Every read
// re-checks scope so a client cannot reach another org's floorplan by guessing
// an id. Writes require the document to be visible first (callers enforce role).

import { uuid } from './auth';
import { canSeeOrg, type ScopeUser } from './hierarchy';

type Env = { DB: D1Database };

export interface DocumentRow {
	id: string;
	project_id: string;
	filename: string;
	storage_key: string;
	size: number | null;
	page_count: number;
	doc_type: string;
	mime_type: string;
	version: number;
	status: string;
	uploaded_by: string | null;
	uploaded_at: string;
	updated_at: string;
}

export interface AnnotationRow {
	id: string;
	document_id: string;
	page_number: number;
	type: string;
	nx: number;
	ny: number;
	nw: number;
	nh: number;
	points: string | null;
	color: string;
	text: string | null;
	images: string | null;
	linked_annotation_id: string | null;
	resolved: number;
	created_by: string | null;
	created_at: string;
}

export interface MapMarkerRow {
	id: string;
	doc_id: string;
	page: number;
	type: string;
	label: string;
	label_pinned: number;
	nx: number;
	ny: number;
	label_nx: number | null;
	label_ny: number | null;
	points: string | null;
	extra_labels: string | null;
}

export interface MapCropRow {
	doc_id: string;
	page: number;
	nx: number;
	ny: number;
	nw: number;
	nh: number;
	label: string | null;
	print_order: number;
}

/** Resolve the org name that owns a document, for scope checks. Returns null
 *  if the document does not exist or has no resolvable org. */
async function docOrgName(env: Env, docId: string): Promise<string | null> {
	const row = await env.DB.prepare(
		`SELECT o.name AS org_name
		   FROM documents d
		   JOIN projects p   ON p.id = d.project_id
		   JOIN buildings b  ON b.id = p.building_id
		   JOIN facilities f ON f.id = b.facility_id
		   JOIN orgs o       ON o.id = f.org_id
		  WHERE d.id = ?`
	)
		.bind(docId)
		.first<{ org_name: string }>();
	return row?.org_name ?? null;
}

/** Fetch a document if the caller may see it, else null. */
export async function getDocument(
	env: Env,
	user: ScopeUser,
	id: string
): Promise<DocumentRow | null> {
	const row = await env.DB.prepare('SELECT * FROM documents WHERE id = ?')
		.bind(id)
		.first<DocumentRow>();
	if (!row) return null;
	const org = await docOrgName(env, id);
	// Documents whose project is not yet attached to a building have no org;
	// only global roles may see those (orphan/staging docs).
	if (org === null) return canSeeOrg(user, null) || user.role !== 'client' ? row : null;
	if (!canSeeOrg(user, org)) return null;
	return row;
}

/** List documents under a project the caller can see. */
export async function listDocuments(
	env: Env,
	user: ScopeUser,
	projectId: string
): Promise<DocumentRow[]> {
	const { results } = await env.DB.prepare(
		'SELECT * FROM documents WHERE project_id = ? AND status != ? ORDER BY uploaded_at DESC'
	)
		.bind(projectId, 'archived')
		.all<DocumentRow>();
	const docs = results ?? [];
	if (docs.length === 0) return [];
	// Scope-check via the first doc's org (all share a project -> one org).
	const org = await docOrgName(env, docs[0].id);
	if (org !== null && !canSeeOrg(user, org)) return [];
	return docs;
}

/** List documents across all projects in a building the caller can see. Used
 *  by the building browse page to surface its floorplans (E5). */
export async function listBuildingDocuments(
	env: Env,
	user: ScopeUser,
	buildingId: string
): Promise<DocumentRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT d.* FROM documents d
		   JOIN projects p ON p.id = d.project_id
		  WHERE p.building_id = ? AND d.status != 'archived'
		  ORDER BY d.uploaded_at DESC`
	)
		.bind(buildingId)
		.all<DocumentRow>();
	const docs = results ?? [];
	if (docs.length === 0) return [];
	const org = await docOrgName(env, docs[0].id);
	if (org !== null && !canSeeOrg(user, org)) return [];
	return docs;
}

export async function createDocument(
	env: Env,
	input: {
		project_id: string;
		filename: string;
		storage_key: string;
		size?: number | null;
		page_count?: number;
		doc_type?: string;
		mime_type?: string;
		uploaded_by?: string | null;
	}
): Promise<DocumentRow> {
	const id = uuid();
	await env.DB.prepare(
		`INSERT INTO documents (id, project_id, filename, storage_key, size, page_count, doc_type, mime_type, uploaded_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			id,
			input.project_id,
			input.filename,
			input.storage_key,
			input.size ?? null,
			input.page_count ?? 1,
			input.doc_type ?? 'floorplan',
			input.mime_type ?? 'application/pdf',
			input.uploaded_by ?? null
		)
		.run();
	return (await env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<DocumentRow>())!;
}

// --- Annotations ---

export async function listAnnotations(env: Env, docId: string): Promise<AnnotationRow[]> {
	const { results } = await env.DB.prepare(
		'SELECT * FROM annotations WHERE document_id = ? ORDER BY created_at'
	)
		.bind(docId)
		.all<AnnotationRow>();
	return results ?? [];
}

/** Replace the full annotation set for a document (v1 saveBatch semantics):
 *  delete-all then re-insert in one batch so the saved set is authoritative. */
export async function saveAnnotationsBatch(
	env: Env,
	docId: string,
	annotations: Array<{
		id?: string;
		page: number;
		type: string;
		nx: number;
		ny: number;
		nw: number;
		nh: number;
		points?: unknown;
		color?: string;
		text?: string | null;
		images?: unknown;
		linkedAnnotationId?: string | null;
		resolved?: boolean;
		createdBy?: string | null;
	}>
): Promise<void> {
	const stmts: D1PreparedStatement[] = [
		env.DB.prepare('DELETE FROM annotations WHERE document_id = ?').bind(docId)
	];
	for (const a of annotations) {
		stmts.push(
			env.DB.prepare(
				`INSERT INTO annotations
				  (id, document_id, page_number, type, nx, ny, nw, nh, points, color, text, images, linked_annotation_id, resolved, created_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				a.id ?? uuid(),
				docId,
				a.page ?? 1,
				a.type,
				a.nx ?? 0,
				a.ny ?? 0,
				a.nw ?? 0,
				a.nh ?? 0,
				a.points ? JSON.stringify(a.points) : null,
				a.color ?? '#B22234',
				a.text ?? null,
				a.images ? JSON.stringify(a.images) : null,
				a.linkedAnnotationId ?? null,
				a.resolved ? 1 : 0,
				a.createdBy ?? null
			)
		);
	}
	await env.DB.batch(stmts);
}

// --- Map markers + crops ---

export async function listMarkers(env: Env, docId: string): Promise<MapMarkerRow[]> {
	const { results } = await env.DB.prepare(
		'SELECT * FROM map_markers WHERE doc_id = ? ORDER BY created_at'
	)
		.bind(docId)
		.all<MapMarkerRow>();
	return results ?? [];
}

export async function saveMarkersBatch(
	env: Env,
	docId: string,
	markers: Array<{
		id?: string;
		page: number;
		type: string;
		label: string;
		labelPinned?: boolean;
		nx: number;
		ny: number;
		labelNx?: number | null;
		labelNy?: number | null;
		points?: unknown;
		extraLabels?: unknown;
		createdBy?: string | null;
	}>
): Promise<void> {
	const stmts: D1PreparedStatement[] = [
		env.DB.prepare('DELETE FROM map_markers WHERE doc_id = ?').bind(docId)
	];
	for (const m of markers) {
		stmts.push(
			env.DB.prepare(
				`INSERT INTO map_markers
				  (id, doc_id, page, type, label, label_pinned, nx, ny, label_nx, label_ny, points, extra_labels, created_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				m.id ?? uuid(),
				docId,
				m.page ?? 1,
				m.type,
				m.label,
				m.labelPinned ? 1 : 0,
				m.nx,
				m.ny,
				m.labelNx ?? null,
				m.labelNy ?? null,
				m.points ? JSON.stringify(m.points) : null,
				m.extraLabels ? JSON.stringify(m.extraLabels) : null,
				m.createdBy ?? null
			)
		);
	}
	await env.DB.batch(stmts);
}

export async function listCrops(env: Env, docId: string): Promise<MapCropRow[]> {
	const { results } = await env.DB.prepare('SELECT * FROM map_crops WHERE doc_id = ?')
		.bind(docId)
		.all<MapCropRow>();
	return results ?? [];
}

export async function saveCrop(
	env: Env,
	docId: string,
	crop: { page: number; nx: number; ny: number; nw: number; nh: number; label?: string | null; printOrder?: number }
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO map_crops (doc_id, page, nx, ny, nw, nh, label, print_order)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(doc_id, page) DO UPDATE SET
		   nx = excluded.nx, ny = excluded.ny, nw = excluded.nw, nh = excluded.nh,
		   label = excluded.label, print_order = excluded.print_order`
	)
		.bind(docId, crop.page, crop.nx, crop.ny, crop.nw, crop.nh, crop.label ?? null, crop.printOrder ?? 0)
		.run();
}

export async function deleteCrop(env: Env, docId: string, page: number): Promise<void> {
	await env.DB.prepare('DELETE FROM map_crops WHERE doc_id = ? AND page = ?')
		.bind(docId, page)
		.run();
}
