// Compliance DAL (Epic E11): per-facility compliance metadata, the NG911/NENA
// GeoJSON assembly (delegating shape to the tested pure engine), and immutable
// audit export. Scope is enforced by getFacility before any of these run.

import {
	buildNenaFeatureCollection,
	type FeatureCollection,
	type NenaMarker
} from '$lib/engines/compliance/ng911';
import { getFacility, type ScopeUser } from './hierarchy';

type Env = { DB: D1Database };

export interface ComplianceMeta {
	facility_id: string;
	last_reviewed: string | null;
	last_tour: string | null;
	alyssas_law: number;
	karis_law: number;
	state_mandate: string | null;
	drill_link: string | null;
	floor_labels: string | null;
	updated_at: string;
}

export async function getComplianceMeta(env: Env, facilityId: string): Promise<ComplianceMeta | null> {
	return env.DB.prepare('SELECT * FROM compliance_meta WHERE facility_id = ?')
		.bind(facilityId)
		.first<ComplianceMeta>();
}

export async function upsertComplianceMeta(
	env: Env,
	facilityId: string,
	patch: Partial<Omit<ComplianceMeta, 'facility_id' | 'updated_at'>>
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO compliance_meta (facility_id, last_reviewed, last_tour, alyssas_law, karis_law, state_mandate, drill_link, floor_labels)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(facility_id) DO UPDATE SET
		   last_reviewed=excluded.last_reviewed, last_tour=excluded.last_tour,
		   alyssas_law=excluded.alyssas_law, karis_law=excluded.karis_law,
		   state_mandate=excluded.state_mandate, drill_link=excluded.drill_link,
		   floor_labels=excluded.floor_labels, updated_at=datetime('now')`
	)
		.bind(
			facilityId,
			patch.last_reviewed ?? null,
			patch.last_tour ?? null,
			patch.alyssas_law ?? 0,
			patch.karis_law ?? 0,
			patch.state_mandate ?? null,
			patch.drill_link ?? null,
			patch.floor_labels ?? null
		)
		.run();
}

/** Assemble a NENA-aligned GeoJSON export for a facility (scoped). Returns null
 *  if the facility is not visible to the caller. */
export async function exportNg911(
	env: Env,
	user: ScopeUser,
	facilityId: string,
	generatedAt: string
): Promise<FeatureCollection | null> {
	const facility = await getFacility(env, user, facilityId);
	if (!facility) return null;

	const buildings = await env.DB.prepare(
		'SELECT id, name, floors FROM buildings WHERE facility_id = ? ORDER BY name'
	)
		.bind(facilityId)
		.all<{ id: string; name: string; floors: number }>();

	// Markers across the facility's documents (their labels + types feed the export).
	const markersRows = await env.DB.prepare(
		`SELECT mm.type, mm.label, mm.page AS floor FROM map_markers mm
		   JOIN documents d ON d.id = mm.doc_id
		   JOIN projects p ON p.id = d.project_id
		   JOIN buildings b ON b.id = p.building_id
		  WHERE b.facility_id = ?`
	)
		.bind(facilityId)
		.all<{ type: string; label: string; floor: number }>();

	const markers: NenaMarker[] = (markersRows.results ?? []).map((m) => ({
		type: m.type,
		label: m.label,
		floor: m.floor
	}));

	return buildNenaFeatureCollection(
		{
			id: facility.id,
			name: facility.name,
			address: facility.address,
			zip: facility.zip,
			phone: facility.phone,
			type: facility.type,
			state: 'PA',
			country: 'US'
		},
		buildings.results ?? [],
		markers,
		generatedAt
	);
}

export interface AuditRow {
	id: string;
	user_id: string | null;
	action: string;
	resource: string | null;
	ip: string | null;
	created_at: string;
}

/** Immutable audit export. The audit_log is append-only at the application
 *  layer (no UPDATE/DELETE), so this read is a faithful, tamper-evident record. */
export async function exportAuditLog(env: Env, limit = 5000): Promise<AuditRow[]> {
	const { results } = await env.DB.prepare(
		'SELECT id, user_id, action, resource, ip, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?'
	)
		.bind(limit)
		.all<AuditRow>();
	return results ?? [];
}
