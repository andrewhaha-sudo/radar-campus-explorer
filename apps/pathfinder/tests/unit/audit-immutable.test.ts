// AC-11.3.2: the audit log is immutable. This guard scans the server source and
// asserts NO code path issues an UPDATE or DELETE against audit_log - it is
// append-only (INSERT) + read (SELECT) only. A future regression that adds a
// mutation path fails this test.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (p.endsWith('.ts') || p.endsWith('.svelte')) out.push(p);
	}
	return out;
}

describe('audit log immutability (AC-11.3.2)', () => {
	it('no source file updates or deletes audit_log', () => {
		const files = walk('src');
		const offenders: string[] = [];
		for (const f of files) {
			const src = readFileSync(f, 'utf8');
			if (/UPDATE\s+audit_log/i.test(src) || /DELETE\s+FROM\s+audit_log/i.test(src)) {
				offenders.push(f);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('audit_log is written only via INSERT', () => {
		const files = walk('src');
		let inserts = 0;
		for (const f of files) {
			const src = readFileSync(f, 'utf8');
			const m = src.match(/INSERT INTO audit_log/gi);
			if (m) inserts += m.length;
		}
		expect(inserts).toBeGreaterThan(0); // the append path exists
	});
});
