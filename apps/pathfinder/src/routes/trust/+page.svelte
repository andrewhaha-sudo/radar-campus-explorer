<script lang="ts">
	// Trust & compliance posture (Epic E11, AC-11.4.1). Public, brand-aware page
	// stating the application-level controls and compliance posture for the
	// active brand. Content is static/posture-level (not per-facility data).
	import { activeBrand } from '$lib/brand';
	const brand = activeBrand;

	const controls = [
		{ area: 'Authentication', detail: 'HS256 JWT (Web Crypto) with pinned algorithm and fail-closed secret; PBKDF2-SHA256 password hashing (100k iterations); httpOnly/Secure/SameSite session cookies; token revocation via version counter.' },
		{ area: 'Authorization', detail: 'Server-side RBAC (admin/staff/client) on every route; org-scoped tenant isolation; scoped, revocable API keys.' },
		{ area: 'Audit', detail: 'Append-only audit log of logins, mutations, exports and views; immutable, exportable as JSON/CSV.' },
		{ area: 'Data handling', detail: 'Master point clouds archived to cold storage and never served; delivery formats (SPZ, mp4) only; no third-party trackers.' },
		{ area: 'Compliance', detail: "NG911/NENA STA-006-aligned GeoJSON export with z-axis floor labels; Alyssa's Law / Kari's Law mandate tracking per facility; staleness re-verification flags." },
		{ area: 'Accessibility', detail: 'WCAG 2.1 AA target; keyboard navigation; screen-reader labels; non-visual map alternatives; VPAT/ACR available.' },
		{ area: 'Observability', detail: 'Server errors captured with diagnostic context; optional Sentry forwarding.' }
	];
</script>

<svelte:head><title>{brand.productName} - Trust & Compliance</title></svelte:head>

<section class="trust" data-testid="trust-page">
	<p class="eyebrow">Trust & Compliance</p>
	<h1>{brand.productName} security & compliance posture</h1>
	<p class="lede">
		{brand.productName} is operated by {brand.legalFooter}. This page summarises the
		application-level controls and compliance posture. For deployment-specific
		documentation, contact <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
	</p>

	<dl class="controls" data-testid="trust-controls">
		{#each controls as c (c.area)}
			<dt>{c.area}</dt>
			<dd>{c.detail}</dd>
		{/each}
	</dl>
</section>

<style>
	.trust { display: flex; flex-direction: column; gap: var(--space-3); max-width: 52rem; }
	.eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; color: var(--brand-muted); }
	h1 { font-size: 1.6rem; }
	.lede { color: var(--brand-muted); }
	.lede a { color: var(--brand-primary); }
	.controls { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-4); }
	dt { font-weight: 700; color: var(--brand-text); }
	dd { margin: 0; color: var(--brand-muted); }
	@media (max-width: 40rem) {
		.controls { grid-template-columns: 1fr; gap: var(--space-1); }
		dd { margin-bottom: var(--space-2); }
	}
</style>
