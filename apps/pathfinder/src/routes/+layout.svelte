<script lang="ts">
	import '../app.css';
	// Self-hosted distinctive typefaces (CSP-safe, font-src 'self'). These back
	// the var(--brand-font-*) families declared in the active brand profile.
	import '@fontsource-variable/bricolage-grotesque';
	import '@fontsource-variable/hanken-grotesk';
	import '@fontsource-variable/jetbrains-mono';

	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { activeBrand, brandToCssVars } from '$lib/brand';
	import Logo from '$lib/components/Logo.svelte';
	import Toaster from '$lib/components/Toaster.svelte';

	// White-label shell (Epic E1): the active brand's tokens are injected onto
	// :root as CSS custom properties; every component references var(--brand-*).
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
	const brand = activeBrand;
	const cssVars = brandToCssVars(brand);
	const user = $derived(data.user);
	// Header avatar initials. Populated on mount IF the demo initials() util is
	// implemented (see onMount); stays '' otherwise so no badge renders.
	let avatarInitials = $state('');

	// Active-section highlight for the primary nav.
	const path = $derived(page.url.pathname);
	const isActive = (href: string) => path === href || path.startsWith(href + '/');
	// The floorplan editor and 3D scan viewer are full-bleed workspaces - they
	// escape the centered content cap so the map/scene gets the whole viewport.
	const wide = $derived(path.startsWith('/documents/') || path.startsWith('/scans/'));

	onMount(() => {
		document.documentElement.setAttribute('data-hydrated', 'true');
		// LIVE TDD DEMO: light up a header avatar beside the name IF the initials()
		// util is implemented. Defensive dynamic import - when the export does not
		// exist (its committed/prod state), we simply render no badge, never error.
		const u = user;
		if (!u) return;
		import('$lib/utils/initials')
			.then((mod: { initials?: (name: string) => string }) => {
				if (typeof mod.initials === 'function') avatarInitials = mod.initials(u.name);
			})
			.catch(() => {
				/* util not present - leave the badge off */
			});
	});
</script>

<svelte:head>
	<title>{brand.productName} - {brand.tagline}</title>
	{@html `<style>:root { ${cssVars} }</style>`}
</svelte:head>

<a class="skip-link" href="#main">Skip to main content</a>

<div class="shell">
	<header class="site-header">
		<a class="brand-link" href="/" aria-label={`${brand.productName} home`}>
			<Logo label={brand.productName} size={26} />
		</a>

		<nav class="site-nav" aria-label="Primary">
            <a href="/campus/" class="navlink">Campus explorer</a>
            <a href="/indoor-map/" class="navlink">Indoor Map</a>
            <a href="/campus-workspace" class="navlink">Campus floors</a>
			{#if user}
				<a href="/search" class="navlink" class:active={isActive('/search')} data-testid="nav-search">Search</a>
				<a href="/dashboard" class="navlink" class:active={isActive('/dashboard')}>Dashboard</a>
				{#if user.role === 'admin'}
					<a href="/admin" class="navlink" class:active={isActive('/admin')} data-testid="nav-admin">Admin</a>
				{/if}
				<span class="user-cluster">
					{#if avatarInitials}
						<span class="user-avatar" data-testid="user-avatar" aria-hidden="true">{avatarInitials}</span>
					{/if}
					<span class="who" data-testid="nav-user">
						<span class="who-name">{user.name}</span>
						<span class="who-role">{user.role}</span>
					</span>
				</span>
			{:else}
				<a href="/login" class="btn-cta">Sign in</a>
			{/if}
		</nav>
	</header>

	<main id="main" class="site-main" class:wide>
		{@render children?.()}
	</main>

	<footer class="site-footer">
		<p class="legal">{brand.legalFooter}</p>
		<p class="contact">
			<span class="status-dot" aria-hidden="true"></span>
			{#if brand.supportEmail}<a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>{/if}
            <a href="/source/radar-campus-explorer.tar.gz" download>Application source (AGPL)</a>
		</p>
	</footer>
</div>

<Toaster />

<style>
	.skip-link {
		position: absolute;
		left: -9999px;
		top: 0;
		background: var(--brand-surface);
		color: var(--brand-text);
		padding: var(--space-2) var(--space-3);
		z-index: 300;
		border: var(--line-strong);
		border-radius: var(--radius);
	}
	.skip-link:focus {
		left: var(--space-3);
		top: var(--space-3);
	}

	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.site-header {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in srgb, var(--brand-bg) 72%, transparent);
		backdrop-filter: blur(14px) saturate(1.4);
		border-bottom: var(--line);
	}
	.brand-link {
		text-decoration: none;
		transition: opacity var(--dur-1) var(--ease);
	}
	.brand-link:hover {
		opacity: 0.85;
	}

	.site-nav {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.navlink {
		position: relative;
		padding: var(--space-2) var(--space-3);
		text-decoration: none;
		color: var(--brand-muted);
		font-size: 0.92rem;
		font-weight: 500;
		border-radius: var(--radius);
		transition:
			color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}
	.navlink:hover {
		color: var(--brand-text);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.navlink.active {
		color: var(--brand-text);
	}
	/* an underline "readout" tick for the active section */
	.navlink.active::after {
		content: '';
		position: absolute;
		left: var(--space-3);
		right: var(--space-3);
		bottom: 0.25rem;
		height: 2px;
		border-radius: 2px;
		background: var(--brand-primary);
		box-shadow: 0 0 10px -1px color-mix(in srgb, var(--brand-primary) 70%, transparent);
	}

	/* avatar + name/role, with the divider that used to sit on .who */
	.user-cluster {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: var(--space-2);
		padding-left: var(--space-3);
		border-left: var(--line);
	}
	.user-avatar {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 50%;
		font-family: var(--brand-font-mono);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--brand-primary);
		background: color-mix(in srgb, var(--brand-primary) 18%, transparent);
		border: 1px solid color-mix(in srgb, var(--brand-primary) 45%, transparent);
	}
	.who {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.1;
	}
	.who-name {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.who-role {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--brand-primary);
		font-family: var(--brand-font-mono);
	}

	.btn-cta {
		display: inline-block;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius);
		text-decoration: none;
		font-weight: 600;
		color: var(--brand-bg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--brand-primary) 92%, white),
			var(--brand-primary)
		);
		box-shadow: var(--shadow-1);
		transition:
			transform var(--dur-1) var(--ease),
			box-shadow var(--dur-2) var(--ease);
	}
	.btn-cta:hover {
		transform: translateY(-1px);
		box-shadow: var(--glow);
	}

	.site-main {
		flex: 1;
		width: 100%;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
		animation: pf-rise var(--dur-3) var(--ease-out) both;
	}
	/* Full-bleed workspace routes (floor editor, 3D viewer): use the whole width
	   and a tighter top pad so the canvas dominates. */
	.site-main.wide {
		max-width: none;
		padding: var(--space-3) var(--space-4) var(--space-4);
	}

	.site-footer {
		border-top: var(--line);
		padding: var(--space-4);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		justify-content: space-between;
		align-items: center;
		font-size: 0.82rem;
		color: var(--brand-muted);
	}
	.contact {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.site-footer a {
		color: var(--brand-primary);
		text-decoration: none;
	}
	.site-footer a:hover {
		text-decoration: underline;
	}
	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #2e9e6b;
		box-shadow: 0 0 8px 0 color-mix(in srgb, #2e9e6b 80%, transparent);
	}

	@media (max-width: 38rem) {
        .site-header { flex-wrap: wrap; }
        .site-nav { width: 100%; flex-wrap: wrap; }
        .navlink { white-space: nowrap; }

		.who {
			display: none;
		}
		/* drop the divider when only the avatar (or nothing) remains */
		.user-cluster {
			margin-left: 0;
			padding-left: 0;
			border-left: none;
		}
		.site-main {
			padding: var(--space-4) var(--space-3);
		}
	}
</style>
