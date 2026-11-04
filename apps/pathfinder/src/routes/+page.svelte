<script lang="ts">
	import { activeBrand } from '$lib/brand';
	const brand = activeBrand;
</script>

<section class="hero">
	<p class="eyebrow reveal">{brand.operatorName}</p>
	<h1 class="reveal-1">{brand.productName}</h1>
	<p class="lede reveal-1">{brand.tagline}</p>
	<p class="sub reveal-2">
		An open platform for emergency floorplan mapping, safety
		annotation, and 3D facility documentation - built so first responders can
		find what they need inside a building before they arrive. Source drawings and annotations still require facility review.
	</p>
	<div class="cta reveal-2">
		<a class="btn-primary" href="/login">Sign in</a>
		<a class="btn-secondary" href="/campus-workspace">Open campus floors</a>
	</div>
	<dl class="stats reveal-3" aria-label="At a glance">
		<div><dt>2D + 3D</dt><dd>floorplans &amp; splats</dd></div>
		<div><dt>NFPA 170</dt><dd>safety symbols</dd></div>
		<div><dt>NG911</dt><dd>NENA export</dd></div>
		<div><dt>Open source</dt><dd>self-host or hosted</dd></div>
	</dl>
</section>

<section id="capabilities" class="capabilities" aria-labelledby="capabilities-title">
 <h2 id="capabilities-title">One complete facilities platform</h2>
 <div class="cards">
  <article class="card"><h3>Floorplans and shared review</h3><ul><li>PDF annotation, safety markers and map export</li><li>Floor switching, source versions and geometry</li><li>Staff permissions, comments, sharing and audit history</li><li>Project publishing, review and approval</li></ul></article>
  <article class="card card-campus"><span class="ribbon">RADAR</span><h3>Campus and 3D documentation</h3><ul><li>Interactive campus explorer and device drafts</li><li>Shared campus floor documents and draft publishing</li><li>Media uploads, scan library and walkthrough playback</li><li>Interactive 3D splats, anchored markers and viewpoints</li></ul></article>
 </div>
 <p class="capabilities-note">All included Pathfinder features are available without an edition gate. Live provider integrations and real scan assets require configuration.</p>
</section>

<style>
	.hero {
		max-width: 50rem;
		padding: var(--space-5) 0 var(--space-4);
	}
	.eyebrow {
		margin-bottom: var(--space-3);
	}
	h1 {
		font-size: clamp(3rem, 9vw, 6rem);
		margin-bottom: var(--space-3);
		background: linear-gradient(
			180deg,
			var(--brand-text),
			color-mix(in srgb, var(--brand-text) 70%, var(--brand-primary))
		);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.lede {
		font-size: clamp(1.2rem, 2.4vw, 1.6rem);
		font-family: var(--brand-font-display);
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--brand-text);
		margin-bottom: var(--space-3);
		max-width: 40rem;
	}
	.sub {
		color: var(--brand-muted);
		max-width: 40rem;
		margin-bottom: var(--space-4);
		font-size: 1.05rem;
	}
	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-5);
	}

	.btn-primary,
	.btn-secondary {
		display: inline-block;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius);
		text-decoration: none;
		font-weight: 600;
		transition:
			transform var(--dur-1) var(--ease),
			box-shadow var(--dur-2) var(--ease),
			background var(--dur-2) var(--ease);
	}
	.btn-primary {
		color: var(--brand-bg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--brand-primary) 90%, white),
			var(--brand-primary)
		);
		border: 1px solid var(--brand-primary);
		box-shadow: var(--shadow-1);
	}
	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: var(--glow);
	}
	.btn-secondary {
		background: var(--surface-glass);
		color: var(--brand-text);
		border: var(--line-strong);
		backdrop-filter: blur(8px);
	}
	.btn-secondary:hover {
		transform: translateY(-2px);
		background: color-mix(in srgb, var(--brand-primary) 14%, transparent);
	}

	/* hero stat strip - a console readout */
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-1);
		border-top: var(--line);
		padding-top: var(--space-4);
		margin: 0;
	}
	.stats div {
		padding-right: var(--space-3);
	}
	.stats dt {
		font-family: var(--brand-font-display);
		font-weight: 700;
		font-size: 1.4rem;
		color: var(--brand-text);
		letter-spacing: -0.02em;
	}
	.stats dd {
		margin: 0;
		font-size: 0.8rem;
		color: var(--brand-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.capabilities {
		margin-top: var(--space-6);
	}
	.capabilities h2 {
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		margin-bottom: var(--space-4);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: var(--space-3);
	}
	.card {
		position: relative;
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		box-shadow: var(--shadow-2);
		backdrop-filter: blur(10px);
		transition:
			transform var(--dur-2) var(--ease),
			border-color var(--dur-2) var(--ease),
			box-shadow var(--dur-2) var(--ease);
	}
	.card:hover {
		transform: translateY(-4px);
		border-color: color-mix(in srgb, var(--brand-primary) 45%, transparent);
		box-shadow: var(--shadow-3);
	}
	.card-campus {
		border-color: color-mix(in srgb, var(--brand-primary) 55%, transparent);
		box-shadow:
			var(--shadow-2),
			inset 0 1px 0 color-mix(in srgb, var(--brand-primary) 25%, transparent);
	}
	.ribbon {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		font-family: var(--brand-font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--brand-bg);
		background: var(--brand-primary);
		padding: 0.2em 0.6em;
		border-radius: var(--radius-pill);
	}
	.card h3 {
		font-size: 1.35rem;
		margin-bottom: var(--space-1);
	}	.card ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		color: var(--brand-muted);
	}
	.card li {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		line-height: 1.4;
	}
	.card li::before {
		content: '+';
		color: var(--brand-accent);
		font-family: var(--brand-font-mono);
		flex-shrink: 0;
	}
	.capabilities-note {
		margin-top: var(--space-4);
		color: var(--brand-muted);
		font-size: 0.9rem;
		max-width: 40rem;
	}
</style>
