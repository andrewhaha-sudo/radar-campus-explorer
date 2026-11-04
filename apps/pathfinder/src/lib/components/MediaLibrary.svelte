<script lang="ts">
	// Scan library panel (Epic E7): lists versioned media per building with
	// capture date + surveyor, and (for staff/admin) a resumable multipart
	// uploader. Cold master point clouds show an "archived" badge and are not
	// linked for download (never served).
	import { invalidateAll } from '$app/navigation';
	import { uploadMedia } from '$lib/engines/media/upload-client';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { MediaType } from '$lib/engines/media/storage-policy';

	interface MediaRow {
		id: string;
		type: string;
		filename: string;
		version: number;
		storage_tier: string;
		served: number;
		capture_date: string | null;
		surveyor: string | null;
		floor: number | null;
		size: number | null;
	}

	let { buildingId, media, canEdit }: { buildingId: string; media: MediaRow[]; canEdit: boolean } =
		$props();

	const TYPE_LABEL: Record<string, string> = {
		floorplan_pdf: 'Floorplan PDF',
		point_cloud: 'Point cloud (master)',
		splat: 'Splat (3D)',
		walkthrough_video: 'Walkthrough video',
		reference_image: 'Reference image'
	};

	let uploadType = $state<MediaType>('splat');
	let captureDate = $state('');
	let surveyor = $state('');
	let floor = $state<number | undefined>(undefined);
	let progress = $state(0);
	let busy = $state(false);
	let errorMsg = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	function fmtSize(n: number | null): string {
		if (!n) return '';
		if (n > 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
		return Math.ceil(n / 1024) + ' KB';
	}

	async function onUpload() {
		const file = fileInput?.files?.[0];
		if (!file) {
			errorMsg = 'Choose a file first.';
			return;
		}
		errorMsg = '';
		busy = true;
		progress = 0;
		try {
			await uploadMedia(
				{
					file,
					type: uploadType,
					buildingId,
					captureDate: captureDate || undefined,
					surveyor: surveyor || undefined,
					floor
				},
				(f) => (progress = f)
			);
			if (fileInput) fileInput.value = '';
			toasts.success(`${file.name} uploaded.`);
			await invalidateAll();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Upload failed.';
			toasts.error(`Upload failed: ${errorMsg}`);
		} finally {
			busy = false;
		}
	}
</script>

<section class="media" data-testid="media-library">
	<h2>Scans &amp; media</h2>
	{#if media.length > 0}
		<ul class="list" data-testid="media-list">
			{#each media as m (m.id)}
				<li class="row" data-testid="media-row">
					<span class="type">{TYPE_LABEL[m.type] ?? m.type}</span>
					{#if m.served && (m.type === 'splat' || m.type === 'walkthrough_video')}
						<a class="name" href={`/scans/${m.id}`} data-testid="media-link">{m.filename}</a>
					{:else if m.served}
						<a class="name" href={`/api/media/${m.id}`} data-testid="media-link">{m.filename}</a>
					{:else}
						<span class="name">{m.filename}</span>
					{/if}
					<span class="badge" data-tier={m.storage_tier}>
						v{m.version} - {m.storage_tier === 'cold' ? 'archived' : 'live'}
					</span>
					<span class="meta">
						{#if m.capture_date}captured {m.capture_date}{/if}
						{#if m.surveyor} - {m.surveyor}{/if}
						{#if m.size} - {fmtSize(m.size)}{/if}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted" data-testid="no-media">No scans or media uploaded for this building yet.</p>
	{/if}

	{#if canEdit}
		<form class="uploader" data-testid="media-uploader" onsubmit={(e) => { e.preventDefault(); onUpload(); }}>
			<div class="fields">
				<label>
					Type
					<select bind:value={uploadType} data-testid="upload-type">
						{#each Object.entries(TYPE_LABEL) as [val, lbl] (val)}
							<option value={val}>{lbl}</option>
						{/each}
					</select>
				</label>
				<label>Capture date <input type="date" bind:value={captureDate} /></label>
				<label>Surveyor <input type="text" bind:value={surveyor} placeholder="Name" /></label>
				<label>Floor <input type="number" min="0" bind:value={floor} /></label>
				<label>File <input type="file" bind:this={fileInput} data-testid="upload-file" /></label>
			</div>
			{#if busy}
				<progress value={progress} max="1" data-testid="upload-progress"></progress>
			{/if}
			{#if errorMsg}<p class="err" data-testid="upload-error">{errorMsg}</p>{/if}
			<button type="submit" disabled={busy} data-testid="upload-submit">
				{busy ? `Uploading ${Math.round(progress * 100)}%` : 'Upload'}
			</button>
		</form>
	{/if}
</section>

<style>
	.media {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-family: var(--brand-font-mono);
		color: var(--brand-muted);
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius);
		flex-wrap: wrap;
		transition: border-color var(--dur-1) var(--ease);
	}
	.row:hover {
		border-color: color-mix(in srgb, var(--brand-primary) 35%, transparent);
	}
	.type {
		font-weight: 600;
		min-width: 10rem;
	}
	.name {
		color: var(--brand-primary);
		text-decoration: none;
	}
	.name:hover {
		text-decoration: underline;
	}
	.badge {
		font-size: 0.75rem;
		padding: 0.15em 0.6em;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 50%, transparent);
		color: var(--brand-muted);
	}
	.badge[data-tier='cold'] {
		color: var(--brand-muted);
		border-style: dashed;
	}
	.meta {
		color: var(--brand-muted);
		font-size: 0.85rem;
		margin-left: auto;
	}
	.muted {
		color: var(--brand-muted);
	}
	.uploader {
		margin-top: var(--space-2);
		padding: var(--space-3);
		border: 1px dashed color-mix(in srgb, var(--brand-secondary) 50%, transparent);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.fields label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: 0.8rem;
		color: var(--brand-muted);
	}
	.uploader button {
		align-self: flex-start;
		padding: var(--space-2) var(--space-3);
		background: var(--brand-primary);
		color: var(--brand-bg);
		border: none;
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
	}
	.uploader button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.err {
		color: #e2574c;
		font-size: 0.85rem;
	}
	progress {
		width: 100%;
	}
</style>
