// Unit tests for the toast store: list reducer (cap/dismiss) + auto-expiry with
// an injected scheduler (no real timers).

import { describe, it, expect, vi } from 'vitest';
import { addToList, removeFromList, ToastStore, type Toast } from '../../src/lib/stores/toasts.svelte';

const t = (id: number, message = 'x'): Toast => ({ id, kind: 'info', message });

describe('toast list reducer', () => {
	it('appends in order', () => {
		expect(addToList([t(1)], t(2)).map((x) => x.id)).toEqual([1, 2]);
	});
	it('caps at 4, dropping the oldest', () => {
		const full = [t(1), t(2), t(3), t(4)];
		expect(addToList(full, t(5)).map((x) => x.id)).toEqual([2, 3, 4, 5]);
	});
	it('removes by id', () => {
		expect(removeFromList([t(1), t(2)], 1).map((x) => x.id)).toEqual([2]);
	});
});

describe('ToastStore', () => {
	it('push adds a toast and returns an id', () => {
		const s = new ToastStore(() => {}); // no-op scheduler -> no auto-dismiss
		const id = s.error('Invalid email or password.');
		expect(s.items).toHaveLength(1);
		expect(s.items[0]).toMatchObject({ id, kind: 'error', message: 'Invalid email or password.' });
	});

	it('auto-dismisses after the TTL via the scheduler', () => {
		let fire: () => void = () => {};
		const schedule = vi.fn((fn: () => void) => {
			fire = fn;
		});
		const s = new ToastStore(schedule);
		s.success('Saved');
		expect(s.items).toHaveLength(1);
		expect(schedule).toHaveBeenCalledOnce();
		fire(); // simulate the timer firing
		expect(s.items).toHaveLength(0);
	});

	it('a sticky toast (ttl=0) is never scheduled for dismissal', () => {
		const schedule = vi.fn();
		const s = new ToastStore(schedule);
		s.push('stays', 'info', 0);
		expect(schedule).not.toHaveBeenCalled();
		expect(s.items).toHaveLength(1);
	});

	it('the DEFAULT scheduler works (regression: setTimeout must not be called as a method)', () => {
		// A bare `setTimeout` reference invoked via this.#schedule(...) throws
		// "Illegal invocation" in browsers. The default must wrap it. Use real
		// timers so the default path is exercised, not an injected stub.
		vi.useFakeTimers();
		try {
			const s = new ToastStore(); // no injected scheduler -> default path
			expect(() => s.success('Saved')).not.toThrow();
			expect(s.items).toHaveLength(1);
			vi.advanceTimersByTime(4000);
			expect(s.items).toHaveLength(0); // auto-dismissed via the default timer
		} finally {
			vi.useRealTimers();
		}
	});

	it('dismiss removes a specific toast', () => {
		const s = new ToastStore(() => {});
		const a = s.info('a');
		s.info('b');
		s.dismiss(a);
		expect(s.items.map((x) => x.message)).toEqual(['b']);
	});
});
