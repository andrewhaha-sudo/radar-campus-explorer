// Floor-major marker numbering (Epic E15, AC-15.2.x).
//
// Replaces the v1-ported chronological numbering, which had four defects:
//   D1 scope    - numbering was per-document, so separate-PDF-per-floor collided
//   D2 ordering - the page term was dropped from the sort in commit 484b474, so
//                 returning to a lower floor appended instead of inserting
//   D3 pinning  - a pinned label did not reserve its number, generating duplicates
//   D4 shafts   - one physical stairwell across 3 floors became S1, S4, S7
//
// The driving real-world case is Rock L. Butler: three floors in three separate
// PDFs labelled "0", "Main" and "3", where Hallway 1 belongs in the basement.

import { describe, it, expect } from 'vitest';
import { reNumberMarkers, doorLabel, type MapMarker } from '../../src/lib/engines/map-export/markers';

const mk = (over: Partial<MapMarker> = {}): MapMarker => ({
	id: Math.random().toString(36).slice(2),
	type: 'stairs',
	label: '',
	page: 1,
	nx: 0.5,
	ny: 0.5,
	...over
});

describe('doorLabel', () => {
	it('counts A..Z', () => {
		expect(doorLabel(1)).toBe('A');
		expect(doorLabel(26)).toBe('Z');
	});

	it('continues past Z as AA, AB rather than punctuation', () => {
		// v1 did String.fromCharCode(65 + n), so the 27th door was "[".
		expect(doorLabel(27)).toBe('AA');
		expect(doorLabel(28)).toBe('AB');
		expect(doorLabel(52)).toBe('AZ');
		expect(doorLabel(53)).toBe('BA');
	});
});

describe('floor-major ordering', () => {
	it('numbers by floor first, not by creation time', () => {
		// The upper floor was annotated first; the basement must still be H1.
		const markers = [
			mk({ id: 'up', type: 'hallway', page: 2, createdAt: '2026-01-01' }),
			mk({ id: 'down', type: 'hallway', page: 1, createdAt: '2026-01-02' })
		];
		reNumberMarkers(markers);
		expect(markers.find((m) => m.id === 'down')!.label).toBe('H1');
		expect(markers.find((m) => m.id === 'up')!.label).toBe('H2');
	});

	it('returning to a lower floor inserts rather than appends (D2)', () => {
		const markers = [
			mk({ id: 'a', type: 'hallway', page: 1, createdAt: '2026-01-01' }),
			mk({ id: 'b', type: 'hallway', page: 1, createdAt: '2026-01-02' }),
			mk({ id: 'c', type: 'hallway', page: 2, createdAt: '2026-01-03' }),
			mk({ id: 'd', type: 'hallway', page: 2, createdAt: '2026-01-04' }),
			// added last, but on floor 1 - must land inside floor 1's run, not at the end
			mk({ id: 'late', type: 'hallway', page: 1, createdAt: '2026-01-05' })
		];
		reNumberMarkers(markers);
		const label = (id: string) => markers.find((m) => m.id === id)!.label;
		expect([label('a'), label('b'), label('late')]).toEqual(['H1', 'H2', 'H3']);
		expect([label('c'), label('d')]).toEqual(['H4', 'H5']);
	});

	it('orders by an explicit floor stack, not by page number', () => {
		// Rock L. Butler: page numbers are all 1 because each floor is its own PDF.
		// The stack order is basement -> main -> top, supplied by the caller.
		const order: Record<string, number> = { basement: 0, main: 1, top: 2 };
		const markers = [
			mk({ id: 'top-h', type: 'hallway', page: 1, docId: 'top', createdAt: '2026-01-01' }),
			mk({ id: 'main-h', type: 'hallway', page: 1, docId: 'main', createdAt: '2026-01-02' }),
			mk({ id: 'base-h', type: 'hallway', page: 1, docId: 'basement', createdAt: '2026-01-03' })
		];
		reNumberMarkers(markers, { floorIndex: (m) => order[m.docId!] });
		expect(markers.find((m) => m.id === 'base-h')!.label).toBe('H1');
		expect(markers.find((m) => m.id === 'main-h')!.label).toBe('H2');
		expect(markers.find((m) => m.id === 'top-h')!.label).toBe('H3');
	});
});

describe('label reservation (D3)', () => {
	it('a pinned label inside the auto range reserves its number', () => {
		// v1: pinned S2 was skipped without consuming a slot, so the third marker
		// was also labelled S2 and the legend silently de-duplicated them.
		const markers = [
			mk({ id: 'a', type: 'stairs', createdAt: '2026-01-01' }),
			mk({ id: 'b', type: 'stairs', createdAt: '2026-01-02', labelPinned: true, label: 'S2' }),
			mk({ id: 'c', type: 'stairs', createdAt: '2026-01-03' })
		];
		reNumberMarkers(markers);
		const labels = markers.map((m) => m.label);
		expect(labels).toEqual(['S1', 'S2', 'S3']);
		expect(new Set(labels).size).toBe(3); // no duplicates, by construction
	});

	it('never emits a duplicate even when pins take the low numbers', () => {
		const markers = [
			mk({ id: 'a', type: 'stairs', createdAt: '2026-01-01', labelPinned: true, label: 'S1' }),
			mk({ id: 'b', type: 'stairs', createdAt: '2026-01-02', labelPinned: true, label: 'S2' }),
			mk({ id: 'c', type: 'stairs', createdAt: '2026-01-03' }),
			mk({ id: 'd', type: 'stairs', createdAt: '2026-01-04' })
		];
		reNumberMarkers(markers);
		expect(markers.map((m) => m.label)).toEqual(['S1', 'S2', 'S3', 'S4']);
	});

	it('a frozen label reserves its number just like a pinned one', () => {
		const markers = [
			mk({ id: 'a', type: 'hallway', createdAt: '2026-01-01', labelFrozen: true, label: 'H1' }),
			mk({ id: 'b', type: 'hallway', createdAt: '2026-01-02', labelFrozen: true, label: 'H2' }),
			mk({ id: 'c', type: 'hallway', createdAt: '2026-01-03' })
		];
		reNumberMarkers(markers);
		expect(markers.map((m) => m.label)).toEqual(['H1', 'H2', 'H3']);
	});

	it('a non-numeric pinned label does not block the numeric sequence', () => {
		const markers = [
			mk({ id: 'a', type: 'stairs', createdAt: '2026-01-01', labelPinned: true, label: 'Main Stair' }),
			mk({ id: 'b', type: 'stairs', createdAt: '2026-01-02' })
		];
		reNumberMarkers(markers);
		expect(markers[0].label).toBe('Main Stair');
		expect(markers[1].label).toBe('S1');
	});
});

describe('shafts (D4)', () => {
	it('one stairwell spanning three floors carries a single label', () => {
		const markers = [
			mk({ id: 'f1', type: 'stairs', page: 1, shaftId: 'shaft-a', createdAt: '2026-01-01' }),
			mk({ id: 'f2', type: 'stairs', page: 2, shaftId: 'shaft-a', createdAt: '2026-01-02' }),
			mk({ id: 'f3', type: 'stairs', page: 3, shaftId: 'shaft-a', createdAt: '2026-01-03' })
		];
		reNumberMarkers(markers);
		expect(markers.map((m) => m.label)).toEqual(['S1', 'S1', 'S1']);
	});

	it('a shaft consumes exactly one number, so its neighbours do not skip', () => {
		const markers = [
			mk({ id: 'shaft-f1', type: 'stairs', page: 1, shaftId: 'shaft-a', createdAt: '2026-01-01' }),
			mk({ id: 'shaft-f2', type: 'stairs', page: 2, shaftId: 'shaft-a', createdAt: '2026-01-02' }),
			mk({ id: 'lone', type: 'stairs', page: 2, createdAt: '2026-01-03' })
		];
		reNumberMarkers(markers);
		expect(markers.find((m) => m.id === 'shaft-f1')!.label).toBe('S1');
		expect(markers.find((m) => m.id === 'shaft-f2')!.label).toBe('S1');
		expect(markers.find((m) => m.id === 'lone')!.label).toBe('S2');
	});

	it('a shaft is numbered from its lowest floor', () => {
		const markers = [
			mk({ id: 'ground-only', type: 'elevator', page: 1, createdAt: '2026-01-09' }),
			mk({ id: 'shaft-top', type: 'elevator', page: 3, shaftId: 'e1', createdAt: '2026-01-01' }),
			mk({ id: 'shaft-base', type: 'elevator', page: 1, shaftId: 'e1', createdAt: '2026-01-02' })
		];
		reNumberMarkers(markers);
		// the shaft reaches floor 1 and was created first, so it takes E1
		expect(markers.find((m) => m.id === 'shaft-base')!.label).toBe('E1');
		expect(markers.find((m) => m.id === 'shaft-top')!.label).toBe('E1');
		expect(markers.find((m) => m.id === 'ground-only')!.label).toBe('E2');
	});
});

describe('numbering options', () => {
	it('honours a custom start number', () => {
		const markers = [
			mk({ type: 'hallway', createdAt: '2026-01-01' }),
			mk({ type: 'hallway', createdAt: '2026-01-02' })
		];
		reNumberMarkers(markers, { startAt: 10 });
		expect(markers.map((m) => m.label)).toEqual(['H10', 'H11']);
	});

	it('can number doors numerically instead of with letters', () => {
		const markers = [
			mk({ type: 'door', createdAt: '2026-01-01' }),
			mk({ type: 'door', createdAt: '2026-01-02' })
		];
		reNumberMarkers(markers, { doorsUseLetters: false });
		expect(markers.map((m) => m.label)).toEqual(['D1', 'D2']);
	});
});

describe('the Rock L. Butler case end to end', () => {
	it('numbers hallways from the basement upward across three separate PDFs', () => {
		const order: Record<string, number> = { floor0: 0, main: 1, floor3: 2 };
		const markers: MapMarker[] = [
			// annotated in the order the surveyor happened to work: main floor first
			mk({ id: 'm1', type: 'hallway', docId: 'main', createdAt: '2026-01-01' }),
			mk({ id: 'm2', type: 'hallway', docId: 'main', createdAt: '2026-01-02' }),
			mk({ id: 'm3', type: 'hallway', docId: 'main', createdAt: '2026-01-03' }),
			mk({ id: 'm4', type: 'hallway', docId: 'main', createdAt: '2026-01-04' }),
			mk({ id: 'b1', type: 'hallway', docId: 'floor0', createdAt: '2026-01-05' }),
			mk({ id: 't1', type: 'hallway', docId: 'floor3', createdAt: '2026-01-06' }),
			// the same elevator shaft appears on the basement and top floor
			mk({ id: 'e-base', type: 'elevator', docId: 'floor0', shaftId: 'elev', createdAt: '2026-01-07' }),
			mk({ id: 'e-top', type: 'elevator', docId: 'floor3', shaftId: 'elev', createdAt: '2026-01-08' })
		];
		reNumberMarkers(markers, { floorIndex: (m) => order[m.docId!] });
		const label = (id: string) => markers.find((m) => m.id === id)!.label;

		// Hallway 1 is in the basement, exactly as the field workflow requires
		expect(label('b1')).toBe('H1');
		expect([label('m1'), label('m2'), label('m3'), label('m4')]).toEqual(['H2', 'H3', 'H4', 'H5']);
		expect(label('t1')).toBe('H6');

		// and the shared elevator is one E1, not two
		expect(label('e-base')).toBe('E1');
		expect(label('e-top')).toBe('E1');
	});
});
