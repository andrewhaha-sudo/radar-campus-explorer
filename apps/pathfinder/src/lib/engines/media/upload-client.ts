// Browser-side resumable multipart upload client (Epic E7). Drives the
// /api/media/upload/{initiate,part,complete} flow: validate locally, initiate,
// stream parts (retrying a failed part up to `maxRetries` - the resumability
// the AC requires), then complete. Pure of any framework; takes a File-like and
// reports progress via a callback.

import { validateUpload, type MediaType } from './storage-policy';

export interface UploadInput {
	file: File;
	type: MediaType;
	buildingId?: string | null;
	facilityId?: string | null;
	captureDate?: string;
	surveyor?: string;
	floor?: number;
}

export interface UploadResult {
	mediaId: string;
	version: number;
}

/** Upload a file via R2 multipart with per-part retry. `onProgress` receives a
 *  0..1 fraction. Throws on validation failure or after exhausting retries. */
export async function uploadMedia(
	input: UploadInput,
	onProgress: (fraction: number) => void = () => {},
	maxRetries = 3
): Promise<UploadResult> {
	const { file, type } = input;
	const v = validateUpload(type, file.name, file.size, file.type || undefined);
	if (!v.ok) throw new Error(v.error);

	const init = await fetch('/api/media/upload/initiate', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			type,
			filename: file.name,
			size: file.size,
			mime: file.type,
			building_id: input.buildingId ?? null,
			facility_id: input.facilityId ?? null,
			capture_date: input.captureDate,
			surveyor: input.surveyor,
			floor: input.floor
		})
	});
	if (!init.ok) throw new Error(`Initiate failed: ${init.status} ${await init.text()}`);
	const { mediaId, key, uploadId, partSize, version } = (await init.json()) as {
		mediaId: string;
		key: string;
		uploadId: string;
		partSize: number;
		version: number;
	};

	const total = Math.max(1, Math.ceil(file.size / partSize));
	const parts: Array<{ partNumber: number; etag: string }> = [];
	for (let i = 0; i < total; i++) {
		const partNumber = i + 1;
		const chunk = file.slice(i * partSize, Math.min(file.size, (i + 1) * partSize));
		let attempt = 0;
		for (;;) {
			try {
				const res = await fetch(
					`/api/media/upload/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&part=${partNumber}`,
					{ method: 'PUT', body: chunk }
				);
				if (!res.ok) throw new Error(`part ${partNumber}: ${res.status}`);
				const { etag } = (await res.json()) as { partNumber: number; etag: string };
				parts.push({ partNumber, etag });
				break;
			} catch (e) {
				if (++attempt > maxRetries) throw e;
				await new Promise((r) => setTimeout(r, 250 * attempt)); // backoff before resume
			}
		}
		onProgress(partNumber / total);
	}

	const done = await fetch('/api/media/upload/complete', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ mediaId, key, uploadId, parts })
	});
	if (!done.ok) throw new Error(`Complete failed: ${done.status} ${await done.text()}`);
	onProgress(1);
	return { mediaId, version };
}
