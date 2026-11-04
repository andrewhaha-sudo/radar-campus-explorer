<script lang="ts">
	// Brand-agnostic inline SVG wordmark. The mark uses currentColor /
	// brand tokens so it themes automatically. No binary assets.
	interface Props {
		/** Product name to render as the wordmark text. */
		label?: string;
		/** Pixel height of the mark; text scales with it. */
		size?: number;
	}
	let { label = 'Pathfinder', size = 24 }: Props = $props();
</script>

<span class="logo" style="--logo-size: {size}px">
	<svg
		class="mark"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		role="img"
		aria-label={`${label} logo`}
	>
		<!-- Squared waypoint diamond + scan ring: point-cloud / pathfinding motif. -->
		<rect x="2" y="2" width="20" height="20" fill="none" stroke="var(--brand-secondary)" stroke-width="1.5" />
		<path d="M12 5 L19 12 L12 19 L5 12 Z" fill="none" stroke="var(--brand-primary)" stroke-width="1.5" />
		<circle cx="12" cy="12" r="2.5" fill="var(--brand-accent)" />
	</svg>
	<span class="wordmark">{label}</span>
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--brand-text);
	}
	.mark {
		display: block;
		flex: none;
	}
	.wordmark {
		font-family: var(--brand-font-display);
		font-weight: 600;
		letter-spacing: 0.01em;
		font-size: calc(var(--logo-size) * 0.7);
		line-height: 1;
	}
</style>
