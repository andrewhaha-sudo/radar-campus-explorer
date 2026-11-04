<script lang="ts">
	// Global search (Epic E10). As-you-type query across facilities, buildings,
	// projects, documents and marker labels, scoped server-side to the caller.
	import { goto } from '$app/navigation';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { SearchHit } from '$lib/engines/search/query';

	let q = $state('');
	let hits = $state<SearchHit[]>([]);
	let searching = $state(false);
	let ran = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const TYPE_LABEL: Record<string, string> = {
		facility: 'Facility',
		building: 'Building',
		project: 'Project',
		document: 'Floorplan',
		marker: 'Marker'
	};

	async function run() {
		if (!q.trim()) {
			hits = [];
			ran = false;
			return;
		}
		searching = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
			if (res.ok) {
				hits = ((await res.json()) as { hits: SearchHit[] }).hits;
			} else {
				toasts.error('Search failed. Please try again.');
			}
		} catch {
			toasts.error('Search failed - network error.');
		} finally {
			searching = false;
			ran = true;
		}
	}

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(run, 180);
	}
</script>

<section class="search">
	<h1>Search</h1>
	<input
		type="search"
		bind:value={q}
		oninput={onInput}
		placeholder="Search facilities, buildings, floorplans, markers..."
		aria-label="Search query"
		data-testid="search-input"
	/>

	{#if searching}<p class="muted">Searching...</p>{/if}

	{#if hits.length > 0}
		<ul class="results" data-testid="search-results">
			{#each hits as h (h.entity_type + h.entity_id)}
				<li>
					<button class="hit" onclick={() => goto(h.url)} data-testid="search-hit">
						<span class="badge">{TYPE_LABEL[h.entity_type] ?? h.entity_type}</span>
						<span class="title">{h.title}</span>
						{#if h.subtitle}<span class="sub">{h.subtitle}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else if ran && !searching}
		<p class="muted" data-testid="search-empty">No matches for "{q}".</p>
	{/if}
</section>

<style>
	.search { display: flex; flex-direction: column; gap: var(--space-3); max-width: 44rem; }
	h1 { font-size: 1.8rem; }
	input {
		padding: 0.85rem 1rem;
		font-size: 1.05rem;
		box-shadow: var(--shadow-1);
	}
	.muted { color: var(--brand-muted); }
	.results { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
	.hit {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius);
		color: var(--brand-text);
		cursor: pointer;
		text-align: left;
		transition: background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease), transform var(--dur-1) var(--ease);
	}
	.hit:hover {
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
		border-color: color-mix(in srgb, var(--brand-primary) 45%, transparent);
		transform: translateX(2px);
	}
	.badge { min-width: 5.5rem; justify-content: center; }
	.title { font-weight: 600; }
	.sub { color: var(--brand-muted); font-size: 0.85rem; margin-left: auto; }
</style>
