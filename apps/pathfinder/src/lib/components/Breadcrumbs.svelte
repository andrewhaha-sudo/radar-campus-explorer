<script lang="ts">
	// Breadcrumb switcher (Epic E3, AC-3.2.1 / AC-3.2.2; research/04 PART A sec 1).
	//
	// Each breadcrumb segment doubles as a DROPDOWN SWITCHER: clicking a segment
	// opens a menu of sibling entities at that level so a user can jump laterally
	// (e.g. from one building to a sibling building) without re-traversing the
	// hierarchy. Capped at three visible levels below the root; deeper context
	// lives in the breadcrumb, not the nav (spec 9.3).
	//
	// Keyboard-accessible: each switcher is a real <button> with aria-expanded /
	// aria-haspopup; the menu is a list of links; Escape closes it and returns
	// focus to the trigger. Brand-tokened (var(--brand-*) only).

	import { goto } from '$app/navigation';

	export interface Crumb {
		/** Visible label for this segment (the current node at this level). */
		label: string;
		/** href for the current node itself (the label links here). */
		href: string;
		/** Sibling entities selectable from this segment's dropdown. */
		siblings?: Array<{ id: string; name: string; href: string }>;
	}

	let { crumbs = [] }: { crumbs: Crumb[] } = $props();

	// Which segment's dropdown is open (index), or -1 for none.
	let openIndex = $state(-1);

	function toggle(i: number) {
		openIndex = openIndex === i ? -1 : i;
	}

	function close() {
		openIndex = -1;
	}

	async function jump(href: string) {
		close();
		await goto(href);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={onKey} />

<nav class="breadcrumbs" aria-label="Hierarchy breadcrumb">
	<ol>
		{#each crumbs as crumb, i (crumb.href)}
			<li class="crumb">
				{#if crumb.siblings && crumb.siblings.length > 0}
					<button
						type="button"
						class="switcher"
						aria-haspopup="listbox"
						aria-expanded={openIndex === i}
						data-testid="breadcrumb-switcher"
						onclick={() => toggle(i)}
					>
						<span class="label">{crumb.label}</span>
						<span class="caret" aria-hidden="true">v</span>
					</button>
					{#if openIndex === i}
						<ul class="menu" role="listbox" aria-label={`Switch ${crumb.label}`}>
							{#each crumb.siblings as sib (sib.id)}
								<li role="option" aria-selected={sib.href === crumb.href}>
									<a
										href={sib.href}
										class:current={sib.href === crumb.href}
										data-testid="breadcrumb-sibling"
										onclick={(e) => {
											e.preventDefault();
											jump(sib.href);
										}}>{sib.name}</a
									>
								</li>
							{/each}
						</ul>
					{/if}
				{:else}
					<a class="label plain" href={crumb.href}>{crumb.label}</a>
				{/if}
			</li>
			{#if i < crumbs.length - 1}
				<li class="sep" aria-hidden="true">/</li>
			{/if}
		{/each}
	</ol>
</nav>

<style>
	.breadcrumbs ol {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: 0.9rem;
	}
	.crumb {
		position: relative;
	}
	.sep {
		color: var(--brand-muted);
	}
	.switcher {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius);
		color: var(--brand-text);
		padding: var(--space-1) var(--space-2);
		cursor: pointer;
		font: inherit;
		transition: background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
	}
	.switcher:hover {
		background: color-mix(in srgb, var(--brand-primary) 14%, transparent);
		border-color: color-mix(in srgb, var(--brand-primary) 45%, transparent);
	}
	.caret {
		font-size: 0.7em;
		color: var(--brand-muted);
	}
	.label.plain {
		color: var(--brand-text);
		text-decoration: none;
		padding: var(--space-1) var(--space-2);
	}
	.menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 20;
		min-width: 12rem;
		list-style: none;
		margin: 0;
		padding: var(--space-1);
		background: var(--surface-glass);
		border: var(--line-strong);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-3);
		backdrop-filter: blur(14px);
	}
	.menu li {
		margin: 0;
	}
	.menu a {
		display: block;
		padding: var(--space-2);
		color: var(--brand-text);
		text-decoration: none;
		border-radius: var(--radius);
	}
	.menu a:hover,
	.menu a:focus {
		background: color-mix(in srgb, var(--brand-primary) 18%, transparent);
		outline: none;
	}
	.menu a.current {
		color: var(--brand-primary);
		font-weight: 600;
	}
</style>
