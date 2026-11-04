// Relabeling operations (Epic E15, AC-15.4.x).
//
// The user requirement is "dummy easy to change hallway numbers". Today v1
// physically cannot rename a hallway (hard return at viewer.js:2996) and v2 uses
// a window.prompt with no validation where an empty string commits as a pinned
// blank label the marker can never escape.
//
// The rules these tests lock in:
//   - renaming to a taken label SWAPS the two, so duplicates are unreachable
//   - an empty label clears back to auto-numbering
//   - resequencing assigns 1..N in the order the user clicked
//   - freezing on export keeps a printed map valid

import { describe, it, expect } from 'vitest';
import {
	renameMarker,
	resequence,
	offsetType,
	clearLabel,
	freezeLabels,
	findDuplicates
} from '../../src/lib/engines/map-export/relabel';
import type { MapMarker } from '../../src/lib/engines/map-export/markers';

const mk = (over: Partial<MapMarker> = {}): MapMarker => ({
	id: Math.random().toString(36).slice(2),
	type: 'hallway',
	label: '',
	page: 1,
	nx: 0.5,
	ny: 0.5,
	...over
});

function hallways(n: number): MapMarker[] {
	return Array.from({ length: n }, (_, i) =>
		mk({ id: `h${i + 1}`, type: 'hallway', label: `H${i + 1}`, createdAt: `2026-01-0${i + 1}` })
	);
}

describe('renameMarker', () => {
	it('swaps with the marker already holding the target label', () => {
		const markers = hallways(5);
		renameMarker(markers, 'h5', 'H2');
		const by = (id: string) => markers.find((m) => m.id === id)!;
		expect(by('h5').label).toBe('H2');
		expect(by('h2').label).toBe('H5'); // took the vacated label
	});

	it('never produces a duplicate label', () => {
		const markers = hallways(4);
		renameMarker(markers, 'h4', 'H1');
		const labels = markers.map((m) => m.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('pins both sides of a swap so renumbering respects them', () => {
		const markers = hallways(3);
		renameMarker(markers, 'h3', 'H1');
		expect(markers.find((m) => m.id === 'h3')!.labelPinned).toBe(true);
		expect(markers.find((m) => m.id === 'h1')!.labelPinned).toBe(true);
	});

	it('renames freely when the target label is not taken', () => {
		const markers = hallways(2);
		renameMarker(markers, 'h1', 'Corridor A');
		expect(markers.find((m) => m.id === 'h1')!.label).toBe('Corridor A');
		// "Corridor A" is outside the numeric sequence, so H1 is now free and the
		// remaining auto-numbered hallway closes up into it rather than leaving a gap.
		expect(markers.find((m) => m.id === 'h2')!.label).toBe('H1');
	});

	it('only swaps within the same marker type', () => {
		const markers = [
			mk({ id: 'h1', type: 'hallway', label: 'H1' }),
			mk({ id: 's1', type: 'stairs', label: 'S1' })
		];
		renameMarker(markers, 'h1', 'S1');
		expect(markers.find((m) => m.id === 'h1')!.label).toBe('S1');
		expect(markers.find((m) => m.id === 's1')!.label).toBe('S1'); // a different type, untouched
	});

	it('an empty label clears back to auto-numbering', () => {
		const markers = hallways(3);
		markers[0].labelPinned = true;
		renameMarker(markers, 'h1', '  ');
		const m = markers.find((m) => m.id === 'h1')!;
		expect(m.labelPinned).toBeFalsy();
		expect(m.label).toBe('H1'); // renumbered, not left blank
	});

	it('returns false for an unknown marker id', () => {
		const markers = hallways(2);
		expect(renameMarker(markers, 'nope', 'H9')).toBe(false);
	});
});

describe('resequence', () => {
	it('numbers markers 1..N in the order they were clicked', () => {
		const markers = hallways(4);
		// user walks the route: h3, h1, h4, h2
		resequence(markers, 'hallway', ['h3', 'h1', 'h4', 'h2']);
		const by = (id: string) => markers.find((m) => m.id === id)!.label;
		expect(by('h3')).toBe('H1');
		expect(by('h1')).toBe('H2');
		expect(by('h4')).toBe('H3');
		expect(by('h2')).toBe('H4');
	});

	it('leaves unclicked markers of that type after the sequence', () => {
		const markers = hallways(4);
		resequence(markers, 'hallway', ['h4', 'h3']);
		const by = (id: string) => markers.find((m) => m.id === id)!.label;
		expect(by('h4')).toBe('H1');
		expect(by('h3')).toBe('H2');
		// h1 and h2 keep going after the clicked run, with no duplicates
		const labels = markers.map((m) => m.label);
		expect(new Set(labels).size).toBe(4);
	});

	it('ignores ids of a different type', () => {
		const markers = [...hallways(2), mk({ id: 's1', type: 'stairs', label: 'S1' })];
		resequence(markers, 'hallway', ['s1', 'h2']);
		expect(markers.find((m) => m.id === 'h2')!.label).toBe('H1');
		expect(markers.find((m) => m.id === 's1')!.label).toBe('S1');
	});

	it('numbers doors with letters', () => {
		const markers = [
			mk({ id: 'd1', type: 'door', label: 'A' }),
			mk({ id: 'd2', type: 'door', label: 'B' })
		];
		resequence(markers, 'door', ['d2', 'd1']);
		expect(markers.find((m) => m.id === 'd2')!.label).toBe('A');
		expect(markers.find((m) => m.id === 'd1')!.label).toBe('B');
	});
});

describe('offsetType', () => {
	it('restarts a type at a chosen number', () => {
		const markers = hallways(3);
		offsetType(markers, 'hallway', 20);
		expect(markers.map((m) => m.label)).toEqual(['H20', 'H21', 'H22']);
	});

	it('can offset only the markers on one floor', () => {
		const markers = [
			mk({ id: 'a', type: 'hallway', page: 1, createdAt: '2026-01-01' }),
			mk({ id: 'b', type: 'hallway', page: 2, createdAt: '2026-01-02' })
		];
		offsetType(markers, 'hallway', 50, (m) => m.page === 2);
		expect(markers.find((m) => m.id === 'b')!.label).toBe('H50');
	});
});

describe('clearLabel', () => {
	it('unpins and unfreezes, restoring the auto number', () => {
		const markers = hallways(3);
		markers[2].labelPinned = true;
		markers[2].label = 'Custom';
		clearLabel(markers, 'h3');
		const m = markers.find((m) => m.id === 'h3')!;
		expect(m.labelPinned).toBeFalsy();
		expect(m.labelFrozen).toBeFalsy();
		expect(m.label).toBe('H3');
	});
});

describe('freezeLabels', () => {
	it('freezes every marker so a printed map stops renumbering', () => {
		const markers = hallways(3);
		freezeLabels(markers);
		expect(markers.every((m) => m.labelFrozen)).toBe(true);
	});

	it('a marker added after a freeze takes the next free number', () => {
		const markers = hallways(3);
		freezeLabels(markers);
		markers.push(mk({ id: 'new', type: 'hallway', createdAt: '2026-01-09' }));
		resequence(markers, 'hallway', []); // renumber only the unfrozen
		expect(markers.find((m) => m.id === 'new')!.label).toBe('H4');
		expect(markers.find((m) => m.id === 'h1')!.label).toBe('H1'); // frozen, unchanged
	});

	it('can freeze only one floor', () => {
		const markers = [
			mk({ id: 'a', type: 'hallway', page: 1 }),
			mk({ id: 'b', type: 'hallway', page: 2 })
		];
		freezeLabels(markers, (m) => m.page === 1);
		expect(markers.find((m) => m.id === 'a')!.labelFrozen).toBe(true);
		expect(markers.find((m) => m.id === 'b')!.labelFrozen).toBeFalsy();
	});
});

describe('findDuplicates', () => {
	it('reports labels held by more than one marker of a type', () => {
		const markers = [
			mk({ id: 'a', type: 'hallway', label: 'H1' }),
			mk({ id: 'b', type: 'hallway', label: 'H1' }),
			mk({ id: 'c', type: 'hallway', label: 'H2' })
		];
		const dupes = findDuplicates(markers);
		expect(dupes).toHaveLength(1);
		expect(dupes[0].label).toBe('H1');
		expect(dupes[0].ids.sort()).toEqual(['a', 'b']);
	});

	it('does not report the same label across different types', () => {
		const markers = [
			mk({ id: 'a', type: 'hallway', label: 'X' }),
			mk({ id: 'b', type: 'stairs', label: 'X' })
		];
		expect(findDuplicates(markers)).toEqual([]);
	});

	it('treats shaft members sharing a label as intentional, not duplicate', () => {
		const markers = [
			mk({ id: 'a', type: 'stairs', label: 'S1', page: 1, shaftId: 'sh1' }),
			mk({ id: 'b', type: 'stairs', label: 'S1', page: 2, shaftId: 'sh1' })
		];
		expect(findDuplicates(markers)).toEqual([]);
	});
});
