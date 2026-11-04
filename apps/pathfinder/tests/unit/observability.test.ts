// Unit test for the observability error hook (Epic E13, AC-13.5.1): an
// unhandled server error is captured into error_log with diagnostic context.

import { describe, it, expect } from 'vitest';
import { captureError } from '../../src/lib/server/observability';

function fakeEnv() {
	const inserts: unknown[][] = [];
	const DB = {
		prepare(sql: string) {
			return {
				bind(...args: unknown[]) {
					return {
						run: async () => {
							inserts.push([sql, ...args]);
							return {};
						}
					};
				}
			};
		}
	};
	return { DB, inserts };
}

describe('captureError observability', () => {
	it('records a 500 with message, url and status into error_log', async () => {
		const { DB, inserts } = fakeEnv();
		const id = await captureError({ DB } as never, {
			message: 'kaboom',
			stack: 'at x',
			url: '/api/boom',
			status: 500,
			userId: 'u1'
		});
		expect(id).toBeTruthy();
		expect(inserts.length).toBe(1);
		const [sql, ...args] = inserts[0];
		expect(String(sql)).toMatch(/INSERT INTO error_log/);
		expect(args).toContain('kaboom');
		expect(args).toContain('/api/boom');
		expect(args).toContain(500);
	});

	it('does not record 404s (noise)', async () => {
		const { DB, inserts } = fakeEnv();
		await captureError({ DB } as never, { message: 'not found', status: 404, url: '/nope' });
		expect(inserts.length).toBe(0);
	});
});
