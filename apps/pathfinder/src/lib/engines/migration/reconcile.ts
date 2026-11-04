// v1 -> v2 migration reconciliation (Epic E13 / S7 migration). Pure: given the
// row counts from the v1 (els911-portal) schema and the resulting v2 counts,
// project what v2 should contain and report any discrepancy or orphan. The
// node migration script (scripts/migrate-v1.mjs) gathers the counts via
// wrangler and feeds them here; keeping the math pure makes the dry-run
// verifiable in unit tests.

export interface V1Counts {
	users: number;
	projects: number;
	project_members: number;
	documents: number;
	annotations: number;
	map_markers: number;
	map_crops: number;
	annotation_comments: number;
	audit_log: number;
}

export interface V2Counts {
	users: number;
	projects: number;
	documents: number;
	annotations: number;
	map_markers: number;
	map_crops: number;
	annotation_comments: number;
	audit_log: number;
	// v2 additions (orgs/facilities/buildings) are created by the hierarchy
	// backfill, not carried 1:1 from v1, so they are not reconciled here.
}

/** Tables that migrate 1:1 from v1 to v2 (same row count expected). */
export const ONE_TO_ONE: Array<keyof V2Counts> = [
	'users',
	'projects',
	'documents',
	'annotations',
	'map_markers',
	'map_crops',
	'annotation_comments',
	'audit_log'
];

export interface Discrepancy {
	table: string;
	v1: number;
	v2: number;
	delta: number;
}

export interface ReconcileResult {
	ok: boolean;
	discrepancies: Discrepancy[];
	orphans: string[];
}

/**
 * Reconcile v1 vs v2 counts for the 1:1 tables. `orphanCounts` maps a check
 * name to the number of orphaned rows found (e.g. annotations whose document
 * is missing); any non-zero orphan fails the reconciliation. Returns ok=true
 * only when every 1:1 table matches and there are zero orphans.
 */
export function reconcile(
	v1: V1Counts,
	v2: V2Counts,
	orphanCounts: Record<string, number> = {}
): ReconcileResult {
	const discrepancies: Discrepancy[] = [];
	for (const t of ONE_TO_ONE) {
		const a = (v1 as unknown as Record<string, number>)[t] ?? 0;
		const b = v2[t] ?? 0;
		if (a !== b) discrepancies.push({ table: t, v1: a, v2: b, delta: b - a });
	}
	const orphans = Object.entries(orphanCounts)
		.filter(([, n]) => n > 0)
		.map(([name, n]) => `${name}: ${n} orphan(s)`);
	return { ok: discrepancies.length === 0 && orphans.length === 0, discrepancies, orphans };
}

/** A human-readable reconciliation report for the dry-run output. */
export function formatReport(result: ReconcileResult): string {
	const lines = [result.ok ? 'RECONCILED: row counts match, zero orphans.' : 'MISMATCH:'];
	for (const d of result.discrepancies) {
		lines.push(`  ${d.table}: v1=${d.v1} v2=${d.v2} (delta ${d.delta > 0 ? '+' : ''}${d.delta})`);
	}
	for (const o of result.orphans) lines.push(`  ORPHAN ${o}`);
	return lines.join('\n');
}
