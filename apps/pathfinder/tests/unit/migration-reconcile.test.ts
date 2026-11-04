// Unit tests for the v1->v2 migration reconciliation (S7 migration).

import { describe, it, expect } from 'vitest';
import { reconcile, formatReport, type V1Counts, type V2Counts } from '../../src/lib/engines/migration/reconcile';

const v1: V1Counts = {
	users: 10,
	projects: 5,
	project_members: 8,
	documents: 12,
	annotations: 240,
	map_markers: 60,
	map_crops: 9,
	annotation_comments: 30,
	audit_log: 500
};

const matchingV2: V2Counts = {
	users: 10,
	projects: 5,
	documents: 12,
	annotations: 240,
	map_markers: 60,
	map_crops: 9,
	annotation_comments: 30,
	audit_log: 500
};

describe('migration reconcile', () => {
	it('reconciles when 1:1 counts match and there are no orphans', () => {
		const r = reconcile(v1, matchingV2, { annotationsMissingDoc: 0 });
		expect(r.ok).toBe(true);
		expect(r.discrepancies).toHaveLength(0);
		expect(formatReport(r)).toMatch(/RECONCILED/);
	});

	it('flags a row-count mismatch', () => {
		const r = reconcile(v1, { ...matchingV2, annotations: 239 });
		expect(r.ok).toBe(false);
		expect(r.discrepancies[0]).toMatchObject({ table: 'annotations', delta: -1 });
	});

	it('fails on any orphan', () => {
		const r = reconcile(v1, matchingV2, { annotationsMissingDoc: 3 });
		expect(r.ok).toBe(false);
		expect(r.orphans[0]).toMatch(/3 orphan/);
	});
});
