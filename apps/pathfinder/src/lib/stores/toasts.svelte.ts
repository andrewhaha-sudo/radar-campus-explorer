// Toast notifications (app-wide). A tiny Svelte 5 rune store: push a toast,
// it auto-dismisses after a TTL, and can be dismissed manually. The core list
// logic (add / cap / dismiss / expiry) is pure and unit-testable; the timer is
// the only browser-coupled part and is injectable for tests.

export type ToastKind = 'error' | 'success' | 'info';

export interface Toast {
	id: number;
	kind: ToastKind;
	message: string;
}

const MAX = 4; // cap visible toasts so a burst can't bury the screen
const DEFAULT_TTL = 5000;

/** Pure list reducer: append a toast, dropping the oldest beyond MAX. Exported
 *  for unit tests (no DOM, no timers). */
export function addToList(list: Toast[], toast: Toast): Toast[] {
	const next = [...list, toast];
	return next.length > MAX ? next.slice(next.length - MAX) : next;
}

/** Pure: remove a toast by id. */
export function removeFromList(list: Toast[], id: number): Toast[] {
	return list.filter((t) => t.id !== id);
}

class ToastStore {
	items = $state<Toast[]>([]);
	#seq = 0;
	#schedule: (fn: () => void, ms: number) => void;

	constructor(
		// Default wraps setTimeout in an arrow so it is always invoked with the
		// global `this` - a bare `setTimeout` reference called as a method
		// (this.#schedule(...)) throws "Illegal invocation" in browsers.
		schedule: (fn: () => void, ms: number) => void = (fn, ms) => setTimeout(fn, ms)
	) {
		this.#schedule = schedule;
	}

	/** Show a toast; returns its id. Auto-dismisses after `ttl` ms (0 = sticky). */
	push(message: string, kind: ToastKind = 'info', ttl = DEFAULT_TTL): number {
		const id = ++this.#seq;
		this.items = addToList(this.items, { id, kind, message });
		if (ttl > 0) this.#schedule(() => this.dismiss(id), ttl);
		return id;
	}

	error(message: string, ttl = 6000) {
		return this.push(message, 'error', ttl);
	}
	success(message: string, ttl = 4000) {
		return this.push(message, 'success', ttl);
	}
	info(message: string, ttl = 5000) {
		return this.push(message, 'info', ttl);
	}

	dismiss(id: number) {
		this.items = removeFromList(this.items, id);
	}
	clear() {
		this.items = [];
	}
}

/** App-wide singleton. Components import `toasts` and call toasts.error(...). */
export const toasts = new ToastStore();
export { ToastStore };
