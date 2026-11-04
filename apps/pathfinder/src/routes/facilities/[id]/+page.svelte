<script lang="ts">
	import Breadcrumbs, { type Crumb } from '$lib/components/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toasts.svelte';

	let { data }: { data: PageData } = $props();
	const facility = $derived(data.facility);
	const buildings = $derived(data.buildings);
	const counts = $derived(data.counts);

	// Compliance metadata (E11)
	let cm = $state({
		last_reviewed: '',
		last_tour: '',
		alyssas_law: false,
		karis_law: false,
		state_mandate: '',
		drill_link: ''
	});
	$effect(() => {
		const m = data.compliance;
		cm = {
			last_reviewed: m?.last_reviewed ?? '',
			last_tour: m?.last_tour ?? '',
			alyssas_law: !!m?.alyssas_law,
			karis_law: !!m?.karis_law,
			state_mandate: m?.state_mandate ?? '',
			drill_link: m?.drill_link ?? ''
		};
	});
	let savingCm = $state(false);
	async function saveCompliance(e: Event) {
		e.preventDefault();
		savingCm = true;
		const res = await fetch(`/api/facilities/${facility.id}/compliance`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(cm)
		});
		savingCm = false;
		if (res.ok) {
			toasts.success('Compliance metadata saved.');
			await invalidateAll();
		} else toasts.error('Could not save compliance metadata.');
	}

	// Breadcrumb: Dashboard / [district?] / [facility-switcher]. Capped at three
	// visible levels below the root (spec 9.3).
	const crumbs = $derived<Crumb[]>(
		[
			{ label: 'Dashboard', href: '/dashboard' },
			data.district
				? { label: data.district.name, href: `/districts/${data.district.id}` }
				: null,
			{
				label: facility.name,
				href: `/facilities/${facility.id}`,
				siblings: data.siblings.map((f) => ({
					id: f.id,
					name: f.name,
					href: `/facilities/${f.id}`
				}))
			}
		].filter(Boolean) as Crumb[]
	);
</script>

<Breadcrumbs {crumbs} />

<section class="entity">
	<header class="fhead">
		<div>
			<p class="eyebrow">Facility</p>
			<h1>{facility.name}</h1>
			{#if facility.address}<p class="muted">{facility.address}</p>{/if}
		</div>
		<a
			class="ng911"
			href={`/api/facilities/${facility.id}/ng911`}
			data-testid="ng911-export"
			download
		>Export NG911 (NENA GeoJSON)</a>
	</header>

	{#if data.stale}
		<p class="flag stale" data-testid="staleness-flag">
			This facility's map is due for re-verification (last reviewed
			{data.compliance?.last_reviewed ?? 'never'}).
		</p>
	{/if}
	{#if data.missingFields.length > 0}
		<p class="flag missing" data-testid="missing-fields">
			NG911 export is missing required fields: {data.missingFields.join(', ')}.
		</p>
	{/if}

	<ul class="cards" aria-label="Facility roll-up">
		<li class="card"><span class="count">{counts.buildings}</span><span>Buildings</span></li>
		<li class="card"><span class="count">{counts.projects}</span><span>Projects</span></li>
	</ul>

	<h2>Buildings</h2>
	{#if buildings.length > 0}
		<ul class="list" data-testid="building-list">
			{#each buildings as b (b.id)}
				<li>
					<a class="row" href={`/buildings/${b.id}`} data-testid="building-link">
						<span class="row-name">{b.name}</span>
						<span class="row-meta">{b.floors} floor{b.floors === 1 ? '' : 's'}</span>
						<span class="row-go" aria-hidden="true">&rarr;</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<!-- Designed empty state (AC-3.4.1): sample preview + one clear action. -->
		<div class="empty" data-testid="empty-state">
			<p class="empty-title">No buildings yet</p>
			<p class="empty-body">
				A facility usually contains one or more buildings, each with its own
				floorplans and scans. A sample looks like <em>"Main Building, 2 floors"</em>.
			</p>
			<a class="empty-action" href="/dashboard" data-testid="empty-action"
				>Back to dashboard</a
			>
		</div>
	{/if}

	{#if data.canEdit}
		<h2>Compliance metadata</h2>
		<form class="compliance" onsubmit={saveCompliance} data-testid="compliance-form">
			<label>Last reviewed <input type="date" bind:value={cm.last_reviewed} data-testid="cm-last-reviewed" /></label>
			<label>Last responder tour <input type="date" bind:value={cm.last_tour} /></label>
			<label class="chk"><input type="checkbox" bind:checked={cm.alyssas_law} /> Alyssa's Law</label>
			<label class="chk"><input type="checkbox" bind:checked={cm.karis_law} /> Kari's Law</label>
			<label>State mandate <input type="text" bind:value={cm.state_mandate} placeholder="e.g. PA Act 44" /></label>
			<label>Drill records link <input type="url" bind:value={cm.drill_link} placeholder="https://" /></label>
			<button type="submit" disabled={savingCm} data-testid="cm-save">{savingCm ? 'Saving...' : 'Save compliance'}</button>
		</form>
	{/if}

	<p class="trust-link"><a href="/trust" data-testid="trust-link">View trust &amp; compliance posture</a></p>
</section>

<style>
	.entity {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.fhead {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.ng911 {
		padding: 0.5rem 0.95rem;
		background: var(--surface-glass);
		border: var(--line-strong);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--brand-text);
		font-size: 0.85rem;
		font-weight: 600;
		transition:
			transform var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}
	.ng911:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--brand-primary) 50%, transparent);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--brand-muted);
	}
	/* semantic status flags: amber = warning (review overdue), red = error
	   (missing required data). The red matches the app-wide error red. */
	.flag {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius);
		font-size: 0.9rem;
		border-left-width: 3px;
		border-left-style: solid;
	}
	.flag.stale {
		background: color-mix(in srgb, #d9870622 18%, transparent);
		border: 1px solid color-mix(in srgb, #d97706 55%, transparent);
		border-left-color: #d97706;
	}
	.flag.missing {
		background: color-mix(in srgb, #e2574c 14%, transparent);
		border: 1px solid color-mix(in srgb, #e2574c 55%, transparent);
		border-left-color: #e2574c;
	}
	.compliance {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: flex-end;
		background: var(--surface-glass);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		border-radius: var(--radius);
		padding: var(--space-3);
	}
	.compliance label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: 0.8rem;
		color: var(--brand-muted);
	}
	.compliance label.chk {
		flex-direction: row;
		align-items: center;
		gap: var(--space-1);
	}
	.compliance input[type='text'],
	.compliance input[type='url'],
	.compliance input[type='date'] {
		padding: var(--space-1) var(--space-2);
		background: var(--brand-bg);
		color: var(--brand-text);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
	}
	.compliance button {
		padding: var(--space-2) var(--space-3);
		background: var(--brand-primary);
		color: var(--brand-bg);
		border: none;
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
	}
	.trust-link a {
		color: var(--brand-primary);
	}
	h1 {
		font-size: 1.6rem;
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: calc(-1 * var(--space-2));
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--space-3);
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
		padding: var(--space-4);
		color: var(--brand-muted);
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.count {
		font-size: 2rem;
		font-weight: 700;
		font-family: var(--brand-font-display);
		color: var(--brand-primary);
		line-height: 1;
		letter-spacing: 0;
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
		padding: var(--space-3);
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--brand-text);
	}
	.row:hover {
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.row-name {
		font-weight: 600;
	}
	.row-meta {
		color: var(--brand-muted);
		font-size: 0.85rem;
	}
	.row-go {
		margin-left: auto;
		color: var(--brand-muted);
	}
	.muted {
		color: var(--brand-muted);
	}
	.empty {
		background: var(--brand-surface);
		border: 1px dashed color-mix(in srgb, var(--brand-secondary) 50%, transparent);
		border-radius: var(--radius);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: flex-start;
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
