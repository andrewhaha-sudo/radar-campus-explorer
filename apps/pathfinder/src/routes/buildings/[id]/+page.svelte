<script lang="ts">
	import Breadcrumbs, { type Crumb } from '$lib/components/Breadcrumbs.svelte';
	import MediaLibrary from '$lib/components/MediaLibrary.svelte';
	import { exportDocMap } from '$lib/engines/map-export/export-client';
	import type { MapMarker } from '$lib/engines/map-export/markers';
	import { availableTransitions, type ProjectStatus } from '$lib/engines/workflow/status';
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const building = $derived(data.building);
	const projects = $derived(data.projects);
	const documents = $derived(data.documents);

	// Favorite star (E3 AC-3.5.1), persisted per user.
	let favorite = $state(false);
	$effect(() => {
		favorite = data.favorite;
	});
	async function toggleFavorite() {
		const method = favorite ? 'DELETE' : 'POST';
		const res = await fetch(`/api/buildings/${building.id}/favorite`, { method });
		if (res.ok) {
			favorite = ((await res.json()) as { favorite: boolean }).favorite;
			toasts.success(favorite ? 'Building starred.' : 'Removed from starred.');
		} else toasts.error('Could not update favorite.');
	}

	// Batch NFPA export (Epic E6): enqueue a tracked job, then render+download an
	// NFPA map for every floorplan in this building, reporting progress back.
	let batchBusy = $state(false);
	let batchProgress = $state('');
	async function batchExport() {
		if (!documents.length) return;
		batchBusy = true;
		const jobRes = await fetch('/api/export-jobs', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ scopeType: 'building', scopeId: building.id, total: documents.length })
		});
		const jobId = jobRes.ok ? ((await jobRes.json()) as { job: { id: string } }).job.id : null;
		let done = 0;
		for (const d of documents) {
			batchProgress = `Exporting ${done + 1} of ${documents.length}...`;
			const mRes = await fetch(`/api/documents/${d.id}/markers`);
			const markers: MapMarker[] = mRes.ok
				? (((await mRes.json()) as { markers: Array<Record<string, unknown>> }).markers.map((m) => ({
						id: m.id,
						type: m.type,
						label: m.label,
						page: m.page,
						nx: m.nx,
						ny: m.ny
					})) as MapMarker[])
				: [];
			const result = await exportDocMap({
				docId: d.id,
				filename: d.filename,
				fileUrl: `/api/documents/${d.id}/file`,
				markers
			});
			// AC-6.4.2: a failed render must mark the job failed, not report the
			// partial run as a completed export.
			if (!result.ok) {
				toasts.error(`${d.filename}: ${result.error ?? 'Export failed.'}`);
				if (jobId)
					await fetch(`/api/export-jobs/${jobId}`, {
						method: 'PATCH',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ status: 'failed', done })
					});
				batchProgress = '';
				batchBusy = false;
				return;
			}
			done++;
			if (jobId)
				await fetch(`/api/export-jobs/${jobId}`, {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ status: done === documents.length ? 'done' : 'running', done })
				});
		}
		batchProgress = `Exported ${done} map${done === 1 ? '' : 's'}.`;
		toasts.success(`Batch export complete - ${done} map${done === 1 ? '' : 's'}.`);
		batchBusy = false;
	}

	// Project review workflow (Epic E4): move a project along a legal status edge.
	let transitioning = $state<string | null>(null);
	async function transition(projectId: string, to: ProjectStatus) {
		transitioning = projectId;
		const res = await fetch(`/api/projects/${projectId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status: to })
		});
		transitioning = null;
		if (res.ok) {
			toasts.success(`Project moved to ${to.replace('_', ' ')}.`);
			await invalidateAll();
		} else {
			const m = ((await res.json().catch(() => ({}))) as { message?: string }).message;
			toasts.error(m ?? 'That status change is not allowed.');
		}
	}

	// Create project (E4 AC-4.1.1/4.1.2)
	let newProjectName = $state('');
	let createProjErr = $state('');
	async function createProject(e: Event) {
		e.preventDefault();
		createProjErr = '';
		const res = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: newProjectName, building_id: building.id })
		});
		if (res.ok) {
			toasts.success(`Project "${newProjectName}" created.`);
			newProjectName = '';
			await invalidateAll();
		} else {
			createProjErr = ((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'Failed';
			toasts.error(createProjErr);
		}
	}

	async function publishVersion(projectId: string) {
		const res = await fetch(`/api/projects/${projectId}/versions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ notes: 'Published for review' })
		});
		if (res.ok) {
			toasts.success('New review version published - members notified.');
			await invalidateAll();
		} else toasts.error('Could not publish version.');
	}
	async function approveProject(projectId: string) {
		const res = await fetch(`/api/projects/${projectId}/approve`, { method: 'POST' });
		if (res.ok) {
			toasts.success('Project approved.');
			await invalidateAll();
		} else {
			const m = ((await res.json().catch(() => ({}))) as { message?: string }).message;
			toasts.error(m ?? 'Only a reviewer may approve.');
		}
	}

	// Breadcrumb: Dashboard / [facility?] / [building-switcher]. The building
	// segment lists sibling buildings under the same facility - the canonical
	// switcher example (AC-3.2.1 / AC-3.2.2, research/04).
	const crumbs = $derived<Crumb[]>(
		[
			{ label: 'Dashboard', href: '/dashboard' },
			data.facility
				? { label: data.facility.name, href: `/facilities/${data.facility.id}` }
				: null,
			{
				label: building.name,
				href: `/buildings/${building.id}`,
				siblings: data.siblings.map((b) => ({
					id: b.id,
					name: b.name,
					href: `/buildings/${b.id}`
				}))
			}
		].filter(Boolean) as Crumb[]
	);

	const statusLabel: Record<string, string> = {
		draft: 'Draft',
		in_review: 'In review',
		approved: 'Approved',
		archived: 'Archived'
	};
</script>

<Breadcrumbs {crumbs} />

<section class="entity">
	<header class="bhead">
		<div>
			<p class="eyebrow">Building</p>
			<h1>{building.name}</h1>
			<p class="muted">{building.floors} floor{building.floors === 1 ? '' : 's'}</p>
		</div>
		<button
			class="star"
			class:on={favorite}
			onclick={toggleFavorite}
			aria-pressed={favorite}
			data-testid="favorite-toggle"
			title={favorite ? 'Unstar building' : 'Star building'}
		>{favorite ? 'Starred' : 'Star'}</button>
	</header>

	<div class="floor-head">
		<h2>Floorplans</h2>
		<div class="floor-actions">
			<a class="batch" href={`/buildings/${building.id}/floors`} data-testid="floor-stack-link">
				Floor stack
			</a>
			{#if data.canEdit && documents.length > 0}
				<button class="batch" onclick={batchExport} disabled={batchBusy} data-testid="batch-export">
					{batchBusy ? batchProgress || 'Exporting...' : 'Batch NFPA export'}
				</button>
			{/if}
		</div>
	</div>
	<p class="muted">
		Floors of one building often arrive as separate PDFs. Assemble them into a stack so marker
		numbering runs bottom-up across the whole building instead of restarting on every plan.
	</p>
	{#if batchProgress && !batchBusy}<p class="muted" data-testid="batch-result">{batchProgress}</p>{/if}
	{#if documents.length > 0}
		<ul class="list" data-testid="document-list">
			{#each documents as d (d.id)}
				<li>
					<a class="row" href={`/documents/${d.id}`} data-testid="document-link">
						<span class="row-name">{d.filename}</span>
						<span class="row-meta">{d.page_count} page{d.page_count === 1 ? '' : 's'} &rarr;</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted" data-testid="no-documents">No floorplans uploaded for this building yet.</p>
	{/if}

	<MediaLibrary buildingId={building.id} media={data.media} canEdit={data.canEdit} />

	<h2>Projects</h2>
	{#if data.canEdit}
		<form class="proj-create" onsubmit={createProject} data-testid="create-project">
			<input placeholder="New project name" aria-label="New project name" bind:value={newProjectName} required data-testid="new-project-name" />
			<button type="submit" data-testid="create-project-submit">Create project</button>
			{#if createProjErr}<span class="muted" data-testid="create-project-err">{createProjErr}</span>{/if}
		</form>
	{/if}
	{#if projects.length > 0}
		<ul class="list" data-testid="project-list">
			{#each projects as p (p.id)}
				<li>
					<div class="row">
						<span class="row-name">{p.name}</span>
						<span class="badge" data-status={p.status} data-testid="project-status">{statusLabel[p.status] ?? p.status}</span>
						<span class="row-meta">{p.progress}%</span>
						{#if data.canEdit}
							<span class="actions" data-testid="project-actions">
								{#each availableTransitions(p.status as ProjectStatus) as t (t.to)}
									<button
										onclick={() => transition(p.id, t.to)}
										disabled={transitioning === p.id}
										data-testid={`transition-${t.to}`}>{t.label}</button
									>
								{/each}
								<button onclick={() => publishVersion(p.id)} data-testid="publish-version">Publish version</button>
								<button onclick={() => approveProject(p.id)} data-testid="approve-project">Approve</button>
							</span>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="empty" data-testid="empty-state">
			<p class="empty-title">No projects yet</p>
			<p class="empty-body">
				Review projects for this building will appear here once a floorplan or
				scan is uploaded. A sample project looks like
				<em>"Ground-floor egress review, in review, 40%"</em>.
			</p>
			<a class="empty-action" href="/dashboard" data-testid="empty-action"
				>Back to dashboard</a
			>
		</div>
	{/if}
</section>

<style>
	.entity {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--brand-muted);
	}
	h1 {
		font-size: 1.6rem;
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: calc(-1 * var(--space-2));
	}
	.bhead {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.star {
		padding: 0.45rem 0.9rem;
		background: var(--surface-glass);
		color: var(--brand-text);
		border: var(--line-strong);
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 600;
		font-size: 0.85rem;
		transition:
			transform var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.star:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--brand-primary) 45%, transparent);
	}
	.star.on {
		background: color-mix(in srgb, var(--brand-primary) 20%, transparent);
		border-color: color-mix(in srgb, var(--brand-primary) 60%, transparent);
		color: var(--brand-primary);
	}
	.floor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.floor-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	a.batch {
		text-decoration: none;
		display: inline-block;
	}
	.batch {
		padding: 0.5rem 0.95rem;
		color: var(--brand-bg);
		background: linear-gradient(180deg, color-mix(in srgb, var(--brand-primary) 92%, white), var(--brand-primary));
		border: 1px solid var(--brand-primary);
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
		font-size: 0.85rem;
		box-shadow: var(--shadow-1);
		transition:
			transform var(--dur-1) var(--ease),
			box-shadow var(--dur-2) var(--ease);
	}
	.batch:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: var(--glow);
	}
	.batch:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.actions {
		margin-left: auto;
		display: flex;
		gap: var(--space-1);
		flex-wrap: wrap;
	}
	.actions button {
		padding: 0.3rem 0.6rem;
		background: var(--surface-glass);
		color: var(--brand-text);
		border: var(--line-strong);
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 0.78rem;
		font-weight: 500;
		transition:
			transform var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.actions button:hover:not(:disabled) {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--brand-primary) 50%, transparent);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.actions button:disabled {
		opacity: 0.5;
		cursor: progress;
	}
	.proj-create {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-bottom: var(--space-3);
		flex-wrap: wrap;
	}
	.proj-create input {
		flex: 1;
		max-width: 22rem;
	}
	.proj-create button {
		padding: 0.5rem 0.95rem;
		color: var(--brand-bg);
		background: linear-gradient(180deg, color-mix(in srgb, var(--brand-primary) 92%, white), var(--brand-primary));
		border: 1px solid var(--brand-primary);
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
		box-shadow: var(--shadow-1);
		transition:
			transform var(--dur-1) var(--ease),
			box-shadow var(--dur-2) var(--ease);
	}
	.proj-create button:hover {
		transform: translateY(-1px);
		box-shadow: var(--glow);
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
		color: var(--brand-text);
		text-decoration: none;
		flex-wrap: wrap;
		transition:
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease),
			transform var(--dur-1) var(--ease);
	}
	a.row:hover {
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
		border-color: color-mix(in srgb, var(--brand-primary) 40%, transparent);
		transform: translateX(2px);
	}
	.row-name {
		font-weight: 600;
	}
	.row-meta {
		color: var(--brand-muted);
		font-size: 0.85rem;
		margin-left: auto;
	}
	.muted {
		color: var(--brand-muted);
	}
	.empty {
		background: var(--surface-glass);
		border: 1px dashed color-mix(in srgb, var(--brand-secondary) 55%, transparent);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: flex-start;
		backdrop-filter: blur(8px);
	}
	.empty-title {
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--brand-text);
	}
	.empty-body {
		color: var(--brand-muted);
		max-width: 42rem;
	}
	.empty-action {
		display: inline-block;
		padding: var(--space-2) var(--space-3);
		background: var(--brand-primary);
		color: var(--brand-bg);
		border-radius: var(--radius);
		text-decoration: none;
		font-weight: 600;
	}
</style>
