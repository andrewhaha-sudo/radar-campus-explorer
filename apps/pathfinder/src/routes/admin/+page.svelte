<script lang="ts">
	// Admin console (Epic E13): platform stats, user management, audit viewer,
	// search reindex, immutable audit export.
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	// Standard error extractor for failed API responses.
	async function failMsg(res: Response, fallback: string): Promise<string> {
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		return body.message ?? `${fallback} (${res.status})`;
	}

	let reindexing = $state(false);
	let reindexMsg = $state('');
	async function reindex() {
		reindexing = true;
		try {
			const res = await fetch('/api/search/reindex', { method: 'POST' });
			if (res.ok) {
				const n = ((await res.json()) as { indexed: number }).indexed;
				reindexMsg = `Reindexed ${n} entities.`;
				toasts.success(`Search reindexed - ${n} entities.`);
			} else {
				reindexMsg = 'Reindex failed.';
				toasts.error(await failMsg(res, 'Reindex failed'));
			}
		} catch {
			toasts.error('Reindex failed - network error.');
		} finally {
			reindexing = false;
		}
	}

	async function toggleActive(id: string, active: number) {
		const res = await fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ active: !active })
		});
		if (res.ok) {
			toasts.success(active ? 'User disabled.' : 'User enabled.');
			await invalidateAll();
		} else toasts.error(await failMsg(res, 'Could not update user'));
	}

	async function changeRole(id: string, role: string) {
		const res = await fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ role })
		});
		if (res.ok) {
			toasts.success(`Role updated to ${role}.`);
			await invalidateAll();
		} else toasts.error(await failMsg(res, 'Could not change role'));
	}

	// Create user
	let nu = $state({ name: '', email: '', password: '', role: 'staff', org: '' });
	let createMsg = $state('');
	async function createUser(e: Event) {
		e.preventDefault();
		const res = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(nu)
		});
		if (res.ok) {
			createMsg = `Created ${nu.email}.`;
			toasts.success(`User ${nu.email} created.`);
			nu = { name: '', email: '', password: '', role: 'staff', org: '' };
			await invalidateAll();
		} else {
			const msg = await failMsg(res, 'Could not create user');
			createMsg = `Error: ${msg}`;
			toasts.error(msg);
		}
	}

	// Issue API key (raw shown once)
	let keyName = $state('');
	let keyScope = $state('read');
	let issuedKey = $state('');
	async function issueKey(e: Event) {
		e.preventDefault();
		const res = await fetch('/api/admin/keys', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: keyName, scope: keyScope })
		});
		if (res.ok) {
			issuedKey = ((await res.json()) as { rawKey: string }).rawKey;
			toasts.success('API key issued - copy it now, it is shown once.');
			keyName = '';
			await invalidateAll();
		} else toasts.error(await failMsg(res, 'Could not issue key'));
	}
	async function revokeKey(id: string) {
		const res = await fetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
		if (res.ok) {
			toasts.success('API key revoked.');
			await invalidateAll();
		} else toasts.error(await failMsg(res, 'Could not revoke key'));
	}

	// Settings
	let setKey = $state('');
	let setVal = $state('');
	async function saveSetting(e: Event) {
		e.preventDefault();
		const res = await fetch('/api/admin/settings', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: setKey, value: setVal })
		});
		if (res.ok) {
			toasts.success(`Setting "${setKey}" saved.`);
			setKey = '';
			setVal = '';
			await invalidateAll();
		} else toasts.error(await failMsg(res, 'Could not save setting'));
	}

	// Audit filter
	let filterActor = $state('');
	let filterSince = $state('');
	let filtered = $state<Array<{ id: string; action: string; resource: string | null; created_at: string }> | null>(null);
	async function runFilter(e: Event) {
		e.preventDefault();
		const qs = new URLSearchParams();
		if (filterActor) qs.set('actor', filterActor);
		if (filterSince) qs.set('since', filterSince);
		const res = await fetch(`/api/admin/audit?${qs}`);
		if (res.ok) filtered = ((await res.json()) as { audit: typeof filtered }).audit;
		else toasts.error(await failMsg(res, 'Audit query failed'));
	}

	const stats = $derived(data.stats);
	const cards = $derived([
		{ k: 'users', label: 'Users', v: stats.users },
		{ k: 'facilities', label: 'Facilities', v: stats.facilities },
		{ k: 'buildings', label: 'Buildings', v: stats.buildings },
		{ k: 'documents', label: 'Floorplans', v: stats.documents },
		{ k: 'media', label: 'Media', v: stats.media }
	]);
</script>

<section class="admin">
	<header class="ahead">
		<h1>Admin console</h1>
		<div class="tools">
			<button onclick={reindex} disabled={reindexing} data-testid="reindex">{reindexing ? 'Reindexing...' : 'Reindex search'}</button>
			<a class="dl" href="/api/admin/audit?format=csv" data-testid="audit-export">Export audit (CSV)</a>
		</div>
	</header>
	{#if reindexMsg}<p class="muted" data-testid="reindex-msg">{reindexMsg}</p>{/if}

	<ul class="cards" data-testid="admin-stats">
		{#each cards as c (c.k)}
			<li class="card"><span class="count">{c.v}</span><span class="lbl">{c.label}</span></li>
		{/each}
	</ul>

	<h2>Users</h2>
	<form class="row-form" onsubmit={createUser} data-testid="create-user">
		<input placeholder="Name" aria-label="New user name" bind:value={nu.name} required />
		<input placeholder="Email" aria-label="New user email" type="email" bind:value={nu.email} required />
		<input placeholder="Password (8+)" aria-label="New user password" type="text" bind:value={nu.password} required />
		<select bind:value={nu.role} aria-label="Role"><option>admin</option><option>staff</option><option>client</option></select>
		<input placeholder="Org (optional)" aria-label="New user organization" bind:value={nu.org} />
		<button type="submit" data-testid="create-user-submit">Create user</button>
		{#if createMsg}<span class="muted" data-testid="create-user-msg">{createMsg}</span>{/if}
	</form>
	<table data-testid="admin-users">
		<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Org</th><th>Status</th><th></th></tr></thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<td>{u.name}</td>
					<td>{u.email}</td>
					<td>
						<select value={u.role} onchange={(e) => changeRole(u.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={`Role for ${u.email}`} data-testid="user-role-select">
							<option>admin</option><option>staff</option><option>client</option>
						</select>
					</td>
					<td>{u.org ?? '-'}</td>
					<td data-testid="user-status">{u.active ? 'active' : 'disabled'}</td>
					<td><button class="sm" onclick={() => toggleActive(u.id, u.active)}>{u.active ? 'Disable' : 'Enable'}</button></td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2>API keys</h2>
	<form class="row-form" onsubmit={issueKey} data-testid="issue-key">
		<input placeholder="Key name" aria-label="API key name" bind:value={keyName} required />
		<select bind:value={keyScope} aria-label="Scope"><option value="read">read</option><option value="write">write</option></select>
		<button type="submit" data-testid="issue-key-submit">Issue key</button>
	</form>
	{#if issuedKey}
		<p class="muted" data-testid="issued-key">New key (shown once): <code>{issuedKey}</code></p>
	{/if}
	{#if data.apiKeys.length}
		<table data-testid="admin-apikeys">
			<thead><tr><th>Name</th><th>Key</th><th>Scope</th><th>Status</th><th></th></tr></thead>
			<tbody>
				{#each data.apiKeys as k (k.id)}
					<tr>
						<td>{k.name}</td><td>{k.masked_key ?? '-'}</td><td>{(k as { scope?: string }).scope ?? '-'}</td>
						<td>{k.revoked ? 'revoked' : 'active'}</td>
						<td>{#if !k.revoked}<button class="sm" onclick={() => revokeKey(k.id)} data-testid="revoke-key">Revoke</button>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="muted">No API keys yet.</p>
	{/if}

	<h2>Deployment settings</h2>
	<form class="row-form" onsubmit={saveSetting} data-testid="settings-form">
		<input placeholder="key" aria-label="Setting key" bind:value={setKey} required />
		<input placeholder="value" aria-label="Setting value" bind:value={setVal} />
		<button type="submit" data-testid="setting-save">Save setting</button>
	</form>
	{#if data.settings.length}
		<table data-testid="admin-settings">
			<thead><tr><th>Key</th><th>Value</th></tr></thead>
			<tbody>{#each data.settings as s (s.key)}<tr><td>{s.key}</td><td>{s.value}</td></tr>{/each}</tbody>
		</table>
	{/if}

	<h2>Recent audit log</h2>
	<form class="row-form" onsubmit={runFilter} data-testid="audit-filter">
		<input placeholder="actor user id" aria-label="Filter by actor user id" bind:value={filterActor} />
		<input placeholder="since (ISO)" aria-label="Filter since date" bind:value={filterSince} />
		<button type="submit" data-testid="audit-filter-run">Filter</button>
	</form>
	{#if filtered}
		<table data-testid="admin-audit-filtered">
			<thead><tr><th>When</th><th>Action</th><th>Resource</th></tr></thead>
			<tbody>{#each filtered as a (a.id)}<tr><td>{a.created_at}</td><td>{a.action}</td><td>{a.resource ?? '-'}</td></tr>{/each}</tbody>
		</table>
	{/if}
	<table data-testid="admin-audit">
		<thead><tr><th>When</th><th>Action</th><th>Resource</th><th>IP</th></tr></thead>
		<tbody>
			{#each data.audit as a (a.id)}
				<tr><td>{a.created_at}</td><td>{a.action}</td><td>{a.resource ?? '-'}</td><td>{a.ip ?? '-'}</td></tr>
			{:else}
				<tr><td colspan="4" class="muted">No audit entries yet.</td></tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.admin { display: flex; flex-direction: column; gap: var(--space-4); }
	.ahead { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
	h1 { font-size: 1.8rem; }
	h2 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-family: var(--brand-font-mono);
		color: var(--brand-muted);
		margin-top: var(--space-3);
		padding-bottom: var(--space-1);
		border-bottom: var(--line);
	}
	.tools { display: flex; gap: var(--space-2); align-items: center; }
	/* the toolbar buttons + download link use the .btn-like glass look */
	.tools button, .dl {
		display: inline-flex; align-items: center;
		padding: 0.5rem 0.9rem;
		background: var(--surface-glass);
		color: var(--brand-text);
		border: var(--line-strong);
		border-radius: var(--radius);
		cursor: pointer; text-decoration: none; font-size: 0.85rem; font-weight: 600;
		transition: transform var(--dur-1) var(--ease), background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
	}
	.tools button:hover, .dl:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--brand-primary) 50%, transparent);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.muted { color: var(--brand-muted); }
	.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: var(--space-3); list-style: none; padding: 0; margin: 0; }
	.card {
		display: flex; flex-direction: column; gap: var(--space-2);
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		box-shadow: var(--shadow-1);
		backdrop-filter: blur(8px);
		transition: transform var(--dur-2) var(--ease), border-color var(--dur-2) var(--ease);
	}
	.card:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--brand-primary) 40%, transparent); }
	.count { font-size: 2.2rem; font-weight: 700; color: var(--brand-primary); font-family: var(--brand-font-display); letter-spacing: -0.03em; line-height: 1; }
	.lbl { font-size: 0.78rem; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.08em; }
	/* tables come from the global instrument-table baseline; wrap in a panel */
	table {
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-1);
	}
	.sm { padding: 0.32rem 0.7rem; background: transparent; color: var(--brand-text); border: var(--line-strong); border-radius: var(--radius); cursor: pointer; font-size: 0.78rem; font-weight: 500; transition: background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease); }
	.sm:hover { background: color-mix(in srgb, var(--brand-primary) 12%, transparent); border-color: color-mix(in srgb, var(--brand-primary) 50%, transparent); }
	.row-form { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-bottom: var(--space-3); }
	.row-form input, .row-form select { width: auto; flex: 0 1 auto; }
	.row-form button {
		padding: 0.5rem 0.95rem;
		color: var(--brand-bg);
		background: linear-gradient(180deg, color-mix(in srgb, var(--brand-primary) 92%, white), var(--brand-primary));
		border: 1px solid var(--brand-primary); border-radius: var(--radius);
		font-weight: 600; cursor: pointer; box-shadow: var(--shadow-1);
		transition: transform var(--dur-1) var(--ease), box-shadow var(--dur-2) var(--ease);
	}
	.row-form button:hover { transform: translateY(-1px); box-shadow: var(--glow); }
	code { color: var(--brand-primary); word-break: break-all; font-family: var(--brand-font-mono); }
</style>
