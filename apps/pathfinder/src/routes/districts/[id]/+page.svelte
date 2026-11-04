<script lang="ts">
	import Breadcrumbs, { type Crumb } from '$lib/components/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const district = $derived(data.district);
	const facilities = $derived(data.facilities);
	const counts = $derived(data.counts);

	// Breadcrumb: Dashboard / [district-switcher]. The district segment lists
	// sibling districts so the user can jump laterally (AC-3.2.1 / AC-3.2.2).
	const crumbs = $derived<Crumb[]>([
		{ label: 'Dashboard', href: '/dashboard' },
		{
			label: district.name,
			href: `/districts/${district.id}`,
			siblings: data.siblings.map((d) => ({
				id: d.id,
				name: d.name,
				href: `/districts/${d.id}`
			}))
		}
	]);
</script>

<Breadcrumbs {crumbs} />

<section class="entity">
	<header>
		<p class="eyebrow">District</p>
		<h1>{district.name}</h1>
	</header>

	<ul class="cards" aria-label="District roll-up">
		<li class="card"><span class="count">{counts.facilities}</span><span>Facilities</span></li>
		<li class="card"><span class="count">{counts.buildings}</span><span>Buildings</span></li>
		<li class="card"><span class="count">{counts.projects}</span><span>Projects</span></li>
	</ul>

	<h2>Facilities</h2>
	{#if facilities.length > 0}
		<ul class="list" data-testid="facility-list">
			{#each facilities as f (f.id)}
				<li>
					<a class="row" href={`/facilities/${f.id}`} data-testid="facility-link">
						<span class="row-name">{f.name}</span>
						{#if f.address}<span class="row-meta">{f.address}</span>{/if}
						<span class="row-go" aria-hidden="true">&rarr;</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">No facilities in this district yet.</p>
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
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-family: var(--brand-font-mono);
		color: var(--brand-muted);
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
		gap: var(--space-2);
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		color: var(--brand-muted);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		box-shadow: var(--shadow-1);
		backdrop-filter: blur(8px);
		transition: transform var(--dur-2) var(--ease), border-color var(--dur-2) var(--ease);
	}
	.card:hover {
		transform: translateY(-3px);
		border-color: color-mix(in srgb, var(--brand-primary) 40%, transparent);
	}
	.count {
		font-size: 2.6rem;
		font-weight: 700;
		font-family: var(--brand-font-display);
		color: var(--brand-primary);
		line-height: 1;
		letter-spacing: -0.03em;
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
		text-decoration: none;
		color: var(--brand-text);
		transition: background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease), transform var(--dur-1) var(--ease);
	}
	.row:hover {
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
	}
	.row-go {
		margin-left: auto;
		color: var(--brand-muted);
	}
	.muted {
		color: var(--brand-muted);
	}
</style>
