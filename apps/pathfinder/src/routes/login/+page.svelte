<script lang="ts">
	import { activeBrand } from '$lib/brand';
	import { enhance } from '$app/forms';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { ActionData } from './$types';

	const brand = activeBrand;

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);

	// Surface a sign-in failure as a toast (the announced alert) in addition to
	// the inline message. Re-fires whenever a new failed attempt returns.
	let lastError = '';
	$effect(() => {
		if (form?.error && form.error !== lastError) {
			lastError = form.error;
			toasts.error(form.error);
		}
		if (!form?.error) lastError = '';
	});
</script>

<section class="login">
	<p class="eyebrow reveal">{brand.operatorName}</p>
	<h1 class="reveal-1">Sign in to {brand.productName}</h1>
	<p class="intro reveal-1">Access your facility maps, scans, and review projects.</p>

	<form
		class="form reveal-2"
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				// Keep typed values on validation failure; redirect handled by SvelteKit.
				await update({ reset: false });
				submitting = false;
			};
		}}
	>
		<div class="field">
			<label for="email">Email address</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				inputmode="email"
				value={form?.email ?? ''}
				required
				aria-required="true"
			/>
		</div>

		<div class="field">
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				aria-required="true"
			/>
		</div>

		<button class="btn-primary" type="submit" disabled={submitting}>
			{submitting ? 'Signing in...' : 'Sign in'}
		</button>

		<!-- Inline echo of the failure (the announced alert is the toast). -->
		<div class="error-region">
			{#if form?.error}
				<p class="error" data-testid="login-error">{form.error}</p>
			{/if}
		</div>
	</form>

	<p class="support">
		Need help? <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
	</p>
</section>

<style>
	.login {
		max-width: 27rem;
		margin: var(--space-5) auto;
	}
	.eyebrow {
		margin-bottom: var(--space-2);
	}
	h1 {
		font-size: 2.1rem;
		margin-bottom: var(--space-2);
	}
	.intro {
		color: var(--brand-muted);
		margin-bottom: var(--space-4);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		box-shadow: var(--shadow-3);
		backdrop-filter: blur(12px);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	label {
		font-size: 0.82rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--brand-muted);
	}
	input {
		background: color-mix(in srgb, var(--brand-bg) 70%, transparent);
		color: var(--brand-text);
		border: var(--line-strong);
		border-radius: var(--radius);
		padding: var(--space-3);
		transition:
			border-color var(--dur-1) var(--ease),
			box-shadow var(--dur-2) var(--ease);
	}
	input:focus {
		outline: none;
		border-color: var(--brand-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-primary) 25%, transparent);
	}
	input::placeholder {
		color: var(--brand-muted);
	}
	.btn-primary {
		margin-top: var(--space-2);
		padding: var(--space-3) var(--space-4);
		color: var(--brand-bg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--brand-primary) 90%, white),
			var(--brand-primary)
		);
		border: 1px solid var(--brand-primary);
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
		box-shadow: var(--shadow-1);
		transition:
			transform var(--dur-1) var(--ease),
			box-shadow var(--dur-2) var(--ease);
	}
	.btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: var(--glow);
	}
	.btn-primary:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.error-region {
		min-height: 1.2em;
	}
	.error {
		color: #e2574c;
		font-size: 0.9rem;
		margin: 0;
	}
	.support {
		margin-top: var(--space-4);
		text-align: center;
		color: var(--brand-muted);
		font-size: 0.9rem;
	}
	.support a {
		color: var(--brand-primary);
	}
</style>
