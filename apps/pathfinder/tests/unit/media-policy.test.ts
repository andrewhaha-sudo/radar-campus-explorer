// Unit tests for the scan-library storage policy (Epic E7). Lock the AC: master
// PLY routes cold and is never served; SPZ/mp4 route hot and are served; uploads
// are validated by type/extension/size before any bytes are read.

import { describe, it, expect } from 'vitest';
import {
	routeStorage,
	buildStorageKey,
	validateUpload,
	partCount,
	PART_SIZE
} from '../../src/lib/engines/media/storage-policy';

describe('storage tier routing', () => {
	it('routes the master point cloud cold and never-served', () => {
		const r = routeStorage('point_cloud');
		expect(r.tier).toBe('cold');
		expect(r.served).toBe(false);
		expect(r.prefix).toContain('cold/');
	});

	it('routes delivery splat + walkthrough hot and served', () => {
		expect(routeStorage('splat')).toMatchObject({ tier: 'hot', served: true });
		expect(routeStorage('walkthrough_video')).toMatchObject({ tier: 'hot', served: true });
		expect(routeStorage('floorplan_pdf')).toMatchObject({ tier: 'hot', served: true });
	});

	it('builds versioned keys that never collide across versions', () => {
		const k1 = buildStorageKey('splat', 'bld-1', 1, 'scan room.spz');
		const k2 = buildStorageKey('splat', 'bld-1', 2, 'scan room.spz');
		expect(k1).not.toBe(k2);
		expect(k1).toContain('/v1/');
		expect(k1).toContain('scan_room.spz'); // sanitised
	});
});

describe('upload validation (before read)', () => {
	it('accepts a valid PLY under the size cap', () => {
		expect(validateUpload('point_cloud', 'master.ply', 200 * 1024 * 1024).ok).toBe(true);
	});
	it('rejects a wrong extension for the type', () => {
		const r = validateUpload('floorplan_pdf', 'plan.png', 1000);
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/extension/i);
	});
	it('rejects an oversize file', () => {
		const r = validateUpload('reference_image', 'huge.png', 100 * 1024 * 1024);
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/limit/i);
	});
	it('rejects a zero/negative size', () => {
		expect(validateUpload('splat', 'x.spz', 0).ok).toBe(false);
	});
	it('rejects a mismatched mime when provided', () => {
		const r = validateUpload('walkthrough_video', 'clip.mp4', 1000, 'application/zip');
		expect(r.ok).toBe(false);
	});
});

describe('multipart sizing', () => {
	it('computes part counts at PART_SIZE granularity', () => {
		expect(partCount(1)).toBe(1);
		expect(partCount(PART_SIZE)).toBe(1);
		expect(partCount(PART_SIZE + 1)).toBe(2);
		expect(partCount(PART_SIZE * 10)).toBe(10);
	});
});
