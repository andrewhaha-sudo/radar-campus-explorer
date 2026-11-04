<script lang="ts">
	// Friendly error screen (Epic E2, AC-2.2.1: a blocked route shows a clear
	// permission screen, not a stack trace). Renders the status + safe message.
	import { page } from '$app/state';
	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong.');
	const title = $derived(
		status === 403 ? 'Access denied' : status === 404 ? 'Not found' : status === 401 ? 'Sign in required' : 'Error'
	);
</script>

<section class="err" data-testid="error-page" data-status={status}>
	<p class="code">{status}</p>
	<h1>{title}</h1>
	<p class="msg" data-testid="error-message">
		{#if status === 403}
			You do not have permission to view this page. If you believe this is a mistake, contact your administrator.
		{:else if status === 401}
			Please sign in to continue.
		{:else}
			{message}
		{/if}
	</p>
	<div class="actions">
		<a class="btn" href="/dashboard">Dashboard</a>
		{#if status === 401}<a class="btn primary" href="/login">Sign in</a>{/if}
	</div>
	{#if page.error?.errorId}<p class="ref">Reference: {page.error.errorId}</p>{/if}
</section>

<style>
	.err { max-width: 32rem; margin: var(--space-5) auto; display: flex; flex-direction: column; gap: var(--space-2); text-align: center; }
	.code { font-size: 3rem; font-weight: 700; color: var(--brand-primary); font-family: var(--brand-font-display); line-height: 1; }
	h1 { font-size: 1.6rem; }
	.msg { color: var(--brand-muted); }
	.actions { display: flex; gap: var(--space-2); justify-content: center; margin-top: var(--space-2); }
	/* buttons use the global .btn control system (app.css) - no local override. */
	.ref { font-size: 0.75rem; color: var(--brand-muted); }
</style>
