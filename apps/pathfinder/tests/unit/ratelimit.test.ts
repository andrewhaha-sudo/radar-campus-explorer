// Unit tests for the login rate-limiter / lockout logic (Epic E2, fix 3).
// Drives src/lib/server/ratelimit.ts against an in-memory KV stub so the
// threshold, reset, and graceful-degradation behavior is verified without a
// real Cloudflare KV binding.

import { describe, it, expect } from 'vitest';
import {
	isLockedOut,
	recordFailure,
	resetFailures,
	DEFAULT_RATE_LIMIT,
	type RateLimitStore
} from '../../src/lib/server/ratelimit';

/** Minimal in-memory KV stub (ignores TTL; that is enforced by real KV). */
function makeStore(): RateLimitStore & { map: Map<string, string> } {
	const map = new Map<string, string>();
	return {
		map,
		async get(k) {
			return map.has(k) ? (map.get(k) as string) : null;
		},
		async put(k, v) {
			map.set(k, v);
		},
		async delete(k) {
			map.delete(k);
		}
	};
}

const IP = '203.0.113.7';
const EMAIL = 'attacker@example.com';

describe('rate limiter', () => {
	it('is not locked out before any failures', async () => {
		const store = makeStore();
		expect(await isLockedOut(store, IP, EMAIL)).toBe(false);
	});

	it('locks out once the threshold of failures is reached', async () => {
		const store = makeStore();
		const t = DEFAULT_RATE_LIMIT.threshold;
		for (let i = 0; i < t - 1; i++) {
			await recordFailure(store, IP, EMAIL);
			expect(await isLockedOut(store, IP, EMAIL)).toBe(false);
		}
		// The threshold-th failure trips the lockout.
		await recordFailure(store, IP, EMAIL);
		expect(await isLockedOut(store, IP, EMAIL)).toBe(true);
	});

	it('locks out by EITHER IP or email counter', async () => {
		const store = makeStore();
		// Drive the email counter to threshold from a single IP, then check a
		// different IP with the same email is still locked (email key trips it).
		for (let i = 0; i < DEFAULT_RATE_LIMIT.threshold; i++) {
			await recordFailure(store, IP, EMAIL);
		}
		expect(await isLockedOut(store, '198.51.100.9', EMAIL)).toBe(true);
	});

	it('resets the counters on success', async () => {
		const store = makeStore();
		for (let i = 0; i < DEFAULT_RATE_LIMIT.threshold; i++) {
			await recordFailure(store, IP, EMAIL);
		}
		expect(await isLockedOut(store, IP, EMAIL)).toBe(true);
		await resetFailures(store, IP, EMAIL);
		expect(await isLockedOut(store, IP, EMAIL)).toBe(false);
	});

	it('degrades gracefully when the store is unavailable (no crash, never locks)', async () => {
		expect(await isLockedOut(undefined, IP, EMAIL)).toBe(false);
		await expect(recordFailure(undefined, IP, EMAIL)).resolves.toBe(0);
		await expect(resetFailures(undefined, IP, EMAIL)).resolves.toBeUndefined();
		await expect(recordFailure(null, IP, EMAIL)).resolves.toBe(0);
	});

	it('survives a KV that throws (fails open)', async () => {
		const throwing: RateLimitStore = {
			async get() {
				throw new Error('KV down');
			},
			async put() {
				throw new Error('KV down');
			},
			async delete() {
				throw new Error('KV down');
			}
		};
		expect(await isLockedOut(throwing, IP, EMAIL)).toBe(false);
		await expect(recordFailure(throwing, IP, EMAIL)).resolves.toBe(0);
		await expect(resetFailures(throwing, IP, EMAIL)).resolves.toBeUndefined();
	});
});
