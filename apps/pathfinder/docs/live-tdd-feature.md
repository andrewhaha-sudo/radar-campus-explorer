# Live TDD Runbook - tiny red -> green in front of an audience

A deliberately SMALL feature you build live in ~3-5 minutes to demonstrate
test-driven development: you type a little test, it goes RED, you show the
audience, then you type a little code and it goes GREEN. One pure function, no
UI plumbing, no flakiness.

**The feature:** `initials(name)` - turn a full name into up-to-two uppercase
initials (e.g. for a user avatar badge). `"Test Admin" -> "TA"`. Pure, obvious,
and the kind of helper a real app actually needs.

> The files are committed but **commented out**, so the public repo / prod ship
> no real feature and CI stays green (`tests/unit/initials.test.ts` holds a
> single `it.todo` placeholder; `src/lib/utils/initials.ts` has its export
> commented; the Step-4 layout blocks are commented). On stage you just
> **uncomment** the marked lines - red, then green. No file creation, no jumping
> around.

---

## Before you start (10 seconds, off-screen)

Open a terminal and start the watcher so the audience sees tests re-run live:

```bash
cd ~/dev/pathfinder
npx vitest --watch initials
```

It shows the `it.todo` placeholder as a pending todo - that's the committed
state. We turn it into a real spec next.

---

## Step 1 - RED: uncomment the test, watch it fail (you do this live)

In `tests/unit/initials.test.ts`, uncomment the two import lines and the
assertion block (they're right there, commented). It becomes:

```ts
import { describe, it, expect } from 'vitest';
import { initials } from '../../src/lib/utils/initials';

describe('initials', () => {
	it('takes up to two uppercase initials from a name', () => {
		expect(initials('Test Admin')).toBe('TA');
	});
});
```

Save. The watcher goes **RED** - `initials` is exported nowhere yet (its body is
still commented). *"That's TDD: the test describes the behaviour before the code
exists. Red means we have a real, failing spec to satisfy."*

---

## Step 2 - GREEN: uncomment the code, watch it pass (you do this live)

In `src/lib/utils/initials.ts`, uncomment the `export function initials` block:

```ts
/** Up to two uppercase initials from a full name ("Test Admin" -> "TA"). */
export function initials(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0] ?? '')
		.join('')
		.toUpperCase();
}
```

Save. The watcher flips to **GREEN** - 1 passing. *"Same test, now satisfied by
the smallest code that makes it pass. Red, green - done."*

---

## Step 3 (optional, +1 min) - one more case to show the cycle again

Add a second assertion to the test (RED), then nudge the code (GREEN):

```ts
// RED: a single-word name -> one initial
expect(initials('Pathfinder')).toBe('P');
// (already passes with the code above - point out it handles this for free)

// RED: extra whitespace shouldn't matter
expect(initials('  jane   doe ')).toBe('JD');
// (also already green - the trim()/split(/\s+/) covers it)
```

Nice beat: the audience sees the code is already robust because it was written
to a spec, not to one happy-path example.

---

## Step 4 (optional bonus) - make it visible in the app

The header avatar badge is **powered by your tested `initials()`**, so it only
appears once the function returns a real value - i.e. only when your test is
green. While `initials()` is unimplemented (returns `''`), the badge stays
hidden; the moment you make it green it lights up beside the user's name.

Two small spots in `src/routes/+layout.svelte` carry it, both marked
`LIVE TDD DEMO - Step 4`:
1. the `import { initials } from '$lib/utils/initials';` line in `<script>`, and
2. the badge block in the nav, just before `<span class="who">`.

Uncomment both, then reload. Before you implement the function: signed in, no
badge (red). After Step 2 makes it return `"TA"`: the badge appears beside the
name (green). That is the payoff - *the UI feature is literally dead until the
test passes.*

---

## Cleanup after the demo

Re-comment what you uncommented so the repo returns to its shipped state:
- `tests/unit/initials.test.ts` - re-comment the imports + assertion (leave the
  `it.todo` placeholder active so Vitest still collects the file).
- `src/lib/utils/initials.ts` - re-comment the `export function initials` block.
- `src/routes/+layout.svelte` - re-comment the Step-4 import and the nav badge
  block.

`git checkout tests/unit/initials.test.ts src/lib/utils/initials.ts src/routes/+layout.svelte`
does the same in one shot. The repo is back to its committed, all-green state.

---

### Why this one
- **Truly small:** one pure function, one assertion to start - fits in a few
  minutes with zero risk of a live flake.
- **Honest TDD:** the failing import is genuine red; the body is the minimal
  green. No theatrics.
- **Real:** initials/avatars are something the app legitimately uses, so it
  doesn't feel like a toy.
