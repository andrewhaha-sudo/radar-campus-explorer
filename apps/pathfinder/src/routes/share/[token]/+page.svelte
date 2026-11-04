<script lang="ts">
	// Read-only shared view (Epic E9). No editing, no tools - a stakeholder-safe
	// summary of a floorplan's safety annotations and wayfinding markers.
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const TYPE_LABEL: Record<string, string> = {
		aed: 'AED', stairs: 'Stairs', door: 'Door', overhead: 'Overhead', exit: 'Exit',
		fireext: 'Fire extinguisher', comment: 'Comment', circle: 'Circle', rect: 'Region',
		arrow: 'Arrow', freehand: 'Markup', correction: 'Correction'
	};
</script>

<section class="share">
	<p class="eyebrow">Shared - read only</p>
	{#if data.kind === 'document'}
		<h1>{data.document.filename}</h1>
		<p class="muted">{data.document.page_count} page(s) - {data.annotations.length} annotations - {data.markers.length} map markers</p>

		<h2>Safety annotations</h2>
		<ul class="list" data-testid="share-annotations">
			{#each data.annotations as a (a.id)}
				<li><span class="badge">{TYPE_LABEL[a.type] ?? a.type}</span> {a.text ?? `page ${a.page_number}`}</li>
			{:else}
				<li class="muted">No annotations.</li>
			{/each}
		</ul>

		<h2>Wayfinding markers</h2>
		<ul class="list" data-testid="share-markers">
			{#each data.markers as m (m.id)}
				<li><span class="badge">{m.type}</span> {m.label}</li>
			{:else}
				<li class="muted">No map markers.</li>
			{/each}
		</ul>
	{:else}
		<h1>Shared resource</h1>
		<p class="muted">This link points to a {data.resource.resource_type}.</p>
	{/if}
</section>

<style>
	.share { display: flex; flex-direction: column; gap: var(--space-2); }
	.eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; color: var(--brand-muted); }
	h1 { font-size: 1.5rem; }
	h2 { font-size: 1rem; margin-top: var(--space-3); }
	.muted { color: var(--brand-muted); font-size: 0.9rem; }
	.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-1); }
	.list li { display: flex; gap: var(--space-2); align-items: center; padding: var(--space-2); background: var(--brand-surface); border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent); border-radius: var(--radius); }
	.badge { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.15em 0.6em; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--brand-secondary) 50%, transparent); color: var(--brand-muted); }
</style>
