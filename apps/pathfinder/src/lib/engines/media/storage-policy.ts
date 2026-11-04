// Unified scan-library storage policy (Epic E7).
//
// Pure, framework-agnostic decisions for the media model: which storage tier a
// media type lands on, its R2 key prefix, whether it is ever served to clients,
// and client-side upload validation (type/extension/size, checked BEFORE the
// bytes are read - consistent with the project image-handling rule). No DOM, no
// Cloudflare - unit-testable.

export type MediaType =
	| 'floorplan_pdf'
	| 'point_cloud'
	| 'splat'
	| 'walkthrough_video'
	| 'reference_image';

export type StorageTier = 'hot' | 'cold';

export interface StorageRoute {
	tier: StorageTier;
	prefix: string;
	/** Cold master artefacts (raw PLY) are archived and never streamed to
	 *  clients; only the derived delivery formats are served (canonical: deliver
	 *  SPZ/mp4, archive master PLY cold, never serve PLY). */
	served: boolean;
}

/**
 * Route a media type to its tier + key prefix (v2 cold-archive policy). The
 * master point cloud (raw PLY) is the only cold, never-served artefact; the
 * delivered SPZ splat, walkthrough mp4, floorplan PDF and reference images are
 * hot and served.
 */
export function routeStorage(type: MediaType): StorageRoute {
	switch (type) {
		case 'point_cloud':
			return { tier: 'cold', prefix: 'cold/pointcloud/', served: false };
		case 'splat':
			return { tier: 'hot', prefix: 'hot/splat/', served: true };
		case 'walkthrough_video':
			return { tier: 'hot', prefix: 'hot/video/', served: true };
		case 'floorplan_pdf':
			return { tier: 'hot', prefix: 'hot/docs/', served: true };
		case 'reference_image':
			return { tier: 'hot', prefix: 'hot/ref/', served: true };
	}
}

/** Build the R2 object key for an upload: tier prefix + buildingId + version +
 *  sanitized filename, so versions of the same asset never collide. */
export function buildStorageKey(
	type: MediaType,
	buildingId: string,
	version: number,
	filename: string
): string {
	const { prefix } = routeStorage(type);
	const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
	return `${prefix}${buildingId}/v${version}/${safe}`;
}

// --- Upload validation ---

const MB = 1024 * 1024;

/** Per-type allowed extensions + max byte size (validated before read). */
export const MEDIA_RULES: Record<
	MediaType,
	{ exts: string[]; maxBytes: number; mimePrefixes?: string[] }
> = {
	floorplan_pdf: { exts: ['.pdf'], maxBytes: 50 * MB, mimePrefixes: ['application/pdf'] },
	point_cloud: { exts: ['.ply', '.las', '.laz', '.e57'], maxBytes: 500 * MB },
	splat: { exts: ['.spz', '.ply', '.ksplat'], maxBytes: 150 * MB },
	walkthrough_video: { exts: ['.mp4', '.mov', '.webm'], maxBytes: 200 * MB, mimePrefixes: ['video/'] },
	reference_image: {
		exts: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'],
		maxBytes: 25 * MB,
		mimePrefixes: ['image/']
	}
};

export interface ValidationResult {
	ok: boolean;
	error?: string;
}

/** Validate an upload candidate by type, filename extension and declared size
 *  (and mime when provided), before any bytes are read. Returns the first
 *  failure, or { ok: true }. */
export function validateUpload(
	type: MediaType,
	filename: string,
	sizeBytes: number,
	mime?: string
): ValidationResult {
	const rule = MEDIA_RULES[type];
	if (!rule) return { ok: false, error: 'Unknown media type.' };
	const lower = filename.toLowerCase();
	const ext = lower.slice(lower.lastIndexOf('.'));
	if (!rule.exts.includes(ext)) {
		return { ok: false, error: `Unsupported extension ${ext} for ${type}. Allowed: ${rule.exts.join(', ')}.` };
	}
	if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
		return { ok: false, error: 'File size must be a positive number.' };
	}
	if (sizeBytes > rule.maxBytes) {
		return { ok: false, error: `File exceeds the ${Math.round(rule.maxBytes / MB)}MB limit for ${type}.` };
	}
	if (mime && rule.mimePrefixes && !rule.mimePrefixes.some((p) => mime.startsWith(p))) {
		return { ok: false, error: `MIME type ${mime} does not match ${type}.` };
	}
	return { ok: true };
}

/** Recommended multipart part size (8MB) and the part count for a given total. */
export const PART_SIZE = 8 * MB;
export function partCount(sizeBytes: number): number {
	return Math.max(1, Math.ceil(sizeBytes / PART_SIZE));
}
