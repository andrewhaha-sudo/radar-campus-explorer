<script lang="ts">
	// App-wide toast viewport. Subscribes to the toast store and renders a
	// stacked, auto-dismissing notification column. Errors are assertive (screen
	// readers announce immediately); success/info are polite. Brand-tokenized.
	import { toasts, type ToastKind } from '$lib/stores/toasts.svelte';

	const ICON: Record<ToastKind, string> = { error: '!', success: 'OK', info: 'i' };
	const live = (k: ToastKind) => (k === 'error' ? 'assertive' : 'polite');
</script>

<div class="toaster" aria-live="polite" aria-relevant="additions">
	{#each toasts.items as t (t.id)}
		<output class="toast {t.kind}" role={t.kind === 'error' ? 'alert' : 'status'} aria-live={live(t.kind)} data-testid="toast">
			<span class="badge" aria-hidden="true">{ICON[t.kind]}</span>
			<span class="msg" data-testid="toast-message">{t.message}</span>
			<button class="x" aria-label="Dismiss notification" onclick={() => toasts.dismiss(t.id)}>&times;</button>
		</output>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		top: var(--space-3);
		right: var(--space-3);
		z-index: 200;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: min(24rem, calc(100vw - 2 * var(--space-3)));
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-lg);
		background: var(--surface-glass);
		backdrop-filter: blur(14px);
		border: var(--line);
		box-shadow: var(--shadow-3);
		color: var(--brand-text);
		font-size: 0.9rem;
		/* a coloured status rail down the left edge */
		border-left: 3px solid var(--brand-secondary);
		animation: toast-in var(--dur-3) var(--ease-out) both;
	}
	.toast.error {
		border-left-color: #e2574c;
	}
	.toast.success {
		border-left-color: #2e9e6b;
	}
	.toast.info {
		border-left-color: var(--brand-primary);
	}
	.badge {
		display: grid;
		place-items: center;
		min-width: 1.4rem;
		height: 1.4rem;
		border-radius: var(--radius-pill);
		font-family: var(--brand-font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--brand-bg);
		background: var(--brand-secondary);
	}
	.error .badge {
		background: #e2574c;
		color: #fff;
	}
	.success .badge {
		background: #2e9e6b;
		color: #fff;
	}
	.info .badge {
		background: var(--brand-primary);
	}
	.msg {
		line-height: 1.4;
		padding-top: 0.1rem;
	}
	.x {
		background: none;
		border: none;
		color: var(--brand-muted);
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		padding: 0 0.15rem;
		transition: color var(--dur-1) var(--ease);
	}
	.x:hover {
		color: var(--brand-text);
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateX(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}
	}
</style>
