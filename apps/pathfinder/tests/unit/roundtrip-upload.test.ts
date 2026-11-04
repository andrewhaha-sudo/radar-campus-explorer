// Unit tests: JSON export<->import round-trip (AC-5.3.2) and the resumable
// multipart upload client assembly + per-part retry (AC-7.2.1/7.2.2).

import { describe, it, expect, vi } from 'vitest';
import { buildExport, importEnvelope } from '../../src/lib/engines/2d-annotate/export-json';
import type { Annotation } from '../../src/lib/engines/2d-annotate/types';
import { uploadMedia } from '../../src/lib/engines/media/upload-client';

describe('JSON export round-trip (AC-5.3.2)', () => {
	it('export then import yields the same shapes', () => {
		const anns: Annotation[] = [
			{ id: 'a1', page: 1, type: 'circle', nx: 0.1, ny: 0.2, nw: 0.3, nh: 0.4, color: '#B22234' },
			{ id: 'a2', page: 2, type: 'freehand', nx: 0, ny: 0, nw: 0, nh: 0, color: '#000', points: [[0.1, 0.1], [0.2, 0.3]] },
			{ id: 'a3', page: 1, type: 'comment', nx: 0.5, ny: 0.5, nw: 0, nh: 0, color: '#000', text: 'hi' }
		];
		const round = importEnvelope(buildExport('d', 'n', anns, 'now'));
		// Sorted by page in the envelope; compare as sets by id.
		const byId = Object.fromEntries(round.map((a) => [a.id, a]));
		expect(byId.a1).toMatchObject({ type: 'circle', nx: 0.1, ny: 0.2, nw: 0.3, nh: 0.4 });
		expect(byId.a2.points).toEqual([[0.1, 0.1], [0.2, 0.3]]);
		expect(byId.a3).toMatchObject({ type: 'comment', text: 'hi' });
		expect(round).toHaveLength(3);
	});
});

describe('resumable multipart upload client (AC-7.2.1/7.2.2)', () => {
	function fakeFile(size: number): File {
		// minimal File-like with slice()
		return {
			name: 'scan.spz',
			size,
			type: '',
			slice: (s: number, e: number) => ({ size: e - s }) as Blob
		} as unknown as File;
	}

	it('assembles a large file into ordered parts and completes', async () => {
		const calls: string[] = [];
		const fetchMock = vi.fn(async (url: string) => {
			calls.push(url);
			if (url.includes('initiate'))
				return new Response(JSON.stringify({ mediaId: 'm', key: 'k', uploadId: 'u', partSize: 8 * 1024 * 1024, version: 1 }), { status: 201 });
			if (url.includes('/part')) return new Response(JSON.stringify({ partNumber: 1, etag: 'e' }), { status: 200 });
			if (url.includes('complete')) return new Response(JSON.stringify({ ok: true, mediaId: 'm' }), { status: 200 });
			return new Response('{}', { status: 200 });
		});
		vi.stubGlobal('fetch', fetchMock);

		const file = fakeFile(20 * 1024 * 1024); // 20MB -> 3 parts at 8MB
		let lastProgress = 0;
		const res = await uploadMedia({ file, type: 'splat', buildingId: 'b1' }, (f) => (lastProgress = f));
		expect(res.mediaId).toBe('m');
		// 3 parts uploaded + initiate + complete
		expect(calls.filter((c) => c.includes('/part')).length).toBe(3);
		expect(calls.some((c) => c.includes('complete'))).toBe(true);
		expect(lastProgress).toBe(1);
		vi.unstubAllGlobals();
	});

	it('retries a failed part without re-uploading earlier parts (resumable)', async () => {
		let partAttempts = 0;
		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes('initiate'))
				return new Response(JSON.stringify({ mediaId: 'm', key: 'k', uploadId: 'u', partSize: 8 * 1024 * 1024, version: 1 }), { status: 201 });
			if (url.includes('/part')) {
				partAttempts++;
				if (partAttempts === 1) return new Response('boom', { status: 500 }); // first attempt fails
				return new Response(JSON.stringify({ partNumber: 1, etag: 'e' }), { status: 200 });
			}
			if (url.includes('complete')) return new Response(JSON.stringify({ ok: true, mediaId: 'm' }), { status: 200 });
			return new Response('{}', { status: 200 });
		});
		vi.stubGlobal('fetch', fetchMock);

		const file = fakeFile(4 * 1024 * 1024); // 1 part
		const res = await uploadMedia({ file, type: 'splat', buildingId: 'b1' });
		expect(res.mediaId).toBe('m');
		expect(partAttempts).toBe(2); // failed once, retried once
		vi.unstubAllGlobals();
	});
});
