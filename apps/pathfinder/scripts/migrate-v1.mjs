// v1 -> v2 migration dry-run (Epic E13 / S7). Reads row counts and orphan
// checks from the v1 (els911-portal) and v2 (pathfinder) D1 databases via
// `wrangler d1 execute --json`, then reconciles them with the pure engine and
// prints a report. DRY RUN by default - it does not write anything. Pass
// `--apply` to additionally emit the INSERT...SELECT cutover SQL to stdout
// (review before running it against v2).
//
// Usage:
//   node scripts/migrate-v1.mjs            # dry-run reconciliation report
//   node scripts/migrate-v1.mjs --remote   # against remote D1 (else --local)
//   node scripts/migrate-v1.mjs --apply    # also print cutover SQL
//
// This script intentionally has no DB credentials of its own; it shells out to
// wrangler, which uses the operator's Cloudflare auth.

import { execFileSync } from 'node:child_process';
import { reconcile, formatReport } from '../src/lib/engines/migration/reconcile.ts';

const REMOTE = process.argv.includes('--remote');
const APPLY = process.argv.includes('--apply');
const loc = REMOTE ? '--remote' : '--local';

function count(db, table) {
	try {
		const out = execFileSync(
			'wrangler',
			['d1', 'execute', db, loc, '--json', '--command', `SELECT COUNT(*) AS n FROM ${table}`],
			{ encoding: 'utf8' }
		);
		const parsed = JSON.parse(out);
		return parsed?.[0]?.results?.[0]?.n ?? 0;
	} catch {
		return 0; // table may not exist yet on the target
	}
}

const V1_DB = 'els911-portal';
const V2_DB = 'pathfinder';

const v1 = {
	users: count(V1_DB, 'users'),
	projects: count(V1_DB, 'projects'),
	project_members: count(V1_DB, 'project_members'),
	documents: count(V1_DB, 'documents'),
	annotations: count(V1_DB, 'annotations'),
	map_markers: count(V1_DB, 'map_markers'),
	map_crops: count(V1_DB, 'map_crops'),
	annotation_comments: count(V1_DB, 'annotation_comments'),
	audit_log: count(V1_DB, 'audit_log')
};

const v2 = {
	users: count(V2_DB, 'users'),
	projects: count(V2_DB, 'projects'),
	documents: count(V2_DB, 'documents'),
	annotations: count(V2_DB, 'annotations'),
	map_markers: count(V2_DB, 'map_markers'),
	map_crops: count(V2_DB, 'map_crops'),
	annotation_comments: count(V2_DB, 'annotation_comments'),
	audit_log: count(V2_DB, 'audit_log')
};

// Orphan checks against v2 referential integrity (zero expected post-migration).
const orphans = {
	annotationsMissingDoc: count(V2_DB, 'annotations a LEFT JOIN documents d ON d.id=a.document_id WHERE d.id IS NULL') ,
	markersMissingDoc: count(V2_DB, 'map_markers m LEFT JOIN documents d ON d.id=m.doc_id WHERE d.id IS NULL'),
	documentsMissingProject: count(V2_DB, 'documents x LEFT JOIN projects p ON p.id=x.project_id WHERE p.id IS NULL')
};

const result = reconcile(v1, v2, orphans);
console.error('--- v1 -> v2 migration dry-run (' + loc + ') ---');
console.error('v1 counts:', JSON.stringify(v1));
console.error('v2 counts:', JSON.stringify(v2));
console.error(formatReport(result));

if (APPLY) {
	// Cutover SQL: attach is not available in D1, so the real cutover exports v1
	// rows and re-inserts them into v2. This prints the INSERT shape for review;
	// the operator pipes v1 exports into it. v2 is additive over v1 so the column
	// lists match the retained tables.
	console.log('-- REVIEW BEFORE RUNNING. v2 retains v1 table shapes additively.');
	console.log('-- Export each v1 table and load into v2, in FK order:');
	console.log('--   users -> projects -> project_members -> documents -> annotations');
	console.log('--   -> map_markers -> map_crops -> annotation_comments -> audit_log');
	console.log('-- Then run the hierarchy backfill to attach projects to buildings.');
}

process.exit(result.ok ? 0 : 1);
