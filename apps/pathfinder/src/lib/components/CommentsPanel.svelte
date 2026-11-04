<script lang="ts">
	// Anchored comment threads + resolve + replies + image attachments (Epic E9).
	// Comments attach to the selected annotation; replies nest under a parent;
	// resolving hides (not deletes); @-mentions fan out to batched notifications.
	import { onMount } from 'svelte';
	import { toasts } from '$lib/stores/toasts.svelte';

	interface Comment {
		id: string;
		annotation_id: string;
		text: string;
		resolved: number;
		parent_id: string | null;
		images: string | null;
		author_name?: string;
		created_at: string;
	}

	let {
		documentId,
		selectedId,
		canEdit
	}: { documentId: string; selectedId: string | null; canEdit: boolean } = $props();

	let comments = $state<Comment[]>([]);
	let showResolved = $state(false);
	let draft = $state('');
	let busy = $state(false);
	let replyTo = $state<string | null>(null);
	let replyDraft = $state('');
	let pendingImages = $state<string[]>([]);
	let lightbox = $state<string | null>(null);

	const topLevel = $derived(comments.filter((c) => !c.parent_id));
	const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
	const imgs = (c: Comment): string[] => {
		if (!c.images) return [];
		try {
			const parsed = JSON.parse(c.images);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return []; // a corrupt images value must never crash the panel render
		}
	};
	const imgUrl = (key: string) => `/api/documents/${documentId}/comment-images?key=${encodeURIComponent(key)}`;

	async function load() {
		const res = await fetch(`/api/documents/${documentId}/comments${showResolved ? '?all=1' : ''}`);
		if (res.ok) comments = ((await res.json()) as { comments: Comment[] }).comments;
	}
	onMount(load);

	async function uploadImage(file: File) {
		const fd = new FormData();
		fd.append('file', file);
		const res = await fetch(`/api/documents/${documentId}/comment-images`, { method: 'POST', body: fd });
		if (res.ok) {
			pendingImages = [...pendingImages, ((await res.json()) as { key: string }).key];
			toasts.success('Image attached.');
		} else toasts.error('Image upload failed.');
	}

	async function post(text: string, parentId: string | null) {
		if (!text.trim() && pendingImages.length === 0) return;
		busy = true;
		const res = await fetch(`/api/documents/${documentId}/comments`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ annotationId: selectedId, text: text.trim() || '(image)', parentId, images: pendingImages })
		});
		busy = false;
		if (res.ok) {
			draft = '';
			replyDraft = '';
			replyTo = null;
			pendingImages = [];
			await load();
			toasts.success(parentId ? 'Reply posted.' : 'Comment posted.');
		} else toasts.error('Could not post comment.');
	}

	async function toggleResolve(c: Comment) {
		const res = await fetch(`/api/comments/${c.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ resolved: !c.resolved })
		});
		if (res.ok) {
			await load();
			toasts.success(c.resolved ? 'Thread reopened.' : 'Thread resolved.');
		} else toasts.error('Could not update the thread.');
	}
</script>

<aside class="comments" data-testid="comments-panel">
	<header>
		<h2>Comments</h2>
		<label class="toggle">
			<input type="checkbox" bind:checked={showResolved} onchange={load} data-testid="show-resolved" />
			Show resolved
		</label>
	</header>

	<ul class="clist" data-testid="comment-list">
		{#each topLevel as c (c.id)}
			<li class:resolved={c.resolved} data-testid="comment">
				<p class="body">{c.text}</p>
				{#each imgs(c) as key (key)}
					<button class="thumb" onclick={() => (lightbox = imgUrl(key))} aria-label="View attachment">
						<img src={imgUrl(key)} alt="comment attachment" />
					</button>
				{/each}
				<p class="meta">
					{c.author_name ?? 'Unknown'}
					{#if c.resolved}<span class="rb">resolved</span>{/if}
				</p>
				<ul class="replies" data-testid="replies">
					{#each repliesOf(c.id) as r (r.id)}
						<li data-testid="reply"><span class="ra">{r.author_name ?? '?'}:</span> {r.text}</li>
					{/each}
				</ul>
				{#if canEdit}
					<div class="crow">
						<button class="resolve" onclick={() => toggleResolve(c)} data-testid="resolve-toggle">
							{c.resolved ? 'Reopen' : 'Resolve'}
						</button>
						<button class="resolve" onclick={() => (replyTo = replyTo === c.id ? null : c.id)} data-testid="reply-toggle">Reply</button>
					</div>
					{#if replyTo === c.id}
						<form onsubmit={(e) => { e.preventDefault(); post(replyDraft, c.id); }}>
							<input bind:value={replyDraft} placeholder="Reply..." aria-label="Reply to comment" data-testid="reply-input" />
							<button type="submit" data-testid="reply-submit">Send</button>
						</form>
					{/if}
				{/if}
			</li>
		{:else}
			<li class="muted">No comments{showResolved ? '' : ' (open)'} yet.</li>
		{/each}
	</ul>

	{#if canEdit}
		<form onsubmit={(e) => { e.preventDefault(); post(draft, null); }}>
			<textarea
				bind:value={draft}
				placeholder={selectedId ? 'Comment on the selected annotation. Use @name to mention.' : 'Select an annotation to comment on it.'}
				disabled={!selectedId || busy}
				data-testid="comment-draft"
			></textarea>
			<div class="crow">
				<label class="attach">
					Attach
					<input
						type="file"
						accept="image/*"
						disabled={!selectedId || busy}
						data-testid="comment-image"
						onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (f) uploadImage(f); }}
					/>
				</label>
				{#if pendingImages.length}<span class="muted" data-testid="pending-images">{pendingImages.length} image(s) attached</span>{/if}
				<button type="submit" disabled={!selectedId || busy} data-testid="comment-submit">
					{busy ? 'Posting...' : 'Comment'}
				</button>
			</div>
		</form>
	{/if}
</aside>

{#if lightbox}
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label="Attachment preview"
		tabindex="-1"
		onclick={() => (lightbox = null)}
		onkeydown={(e) => e.key === 'Escape' && (lightbox = null)}
		data-testid="lightbox"
	>
		<img src={lightbox} alt="comment attachment, full size" />
		<button class="lb-close" aria-label="Close preview" onclick={() => (lightbox = null)}>&times;</button>
	</div>
{/if}

<svelte:window onkeydown={(e) => e.key === 'Escape' && lightbox && (lightbox = null)} />

<style>
	.comments { width: 16rem; display: flex; flex-direction: column; gap: var(--space-2); }
	header { display: flex; flex-direction: column; gap: var(--space-1); }
	h2 { font-size: 1rem; }
	.toggle { font-size: 0.75rem; color: var(--brand-muted); display: flex; gap: var(--space-1); align-items: center; }
	.clist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
	.clist > li { background: var(--brand-surface); border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent); border-radius: var(--radius); padding: var(--space-2); }
	.clist > li.resolved { opacity: 0.6; }
	.body { font-size: 0.85rem; }
	.meta { font-size: 0.72rem; color: var(--brand-muted); margin-top: var(--space-1); }
	.rb { color: var(--brand-primary); margin-left: var(--space-1); }
	.crow { display: flex; gap: var(--space-2); align-items: center; margin-top: var(--space-1); flex-wrap: wrap; }
	.resolve { font-size: 0.75rem; padding: 0.1em 0.6em; background: transparent; color: var(--brand-text); border: 1px solid var(--brand-secondary); border-radius: var(--radius); cursor: pointer; }
	.replies { list-style: none; margin: var(--space-1) 0 0 var(--space-2); padding-left: var(--space-2); border-left: 2px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent); font-size: 0.8rem; }
	.ra { font-weight: 600; color: var(--brand-primary); }
	.muted { color: var(--brand-muted); font-size: 0.85rem; }
	.thumb { padding: 0; border: none; background: none; cursor: pointer; }
	.thumb img { max-width: 100%; border-radius: var(--radius); margin-top: var(--space-1); }
	.attach { font-size: 0.72rem; color: var(--brand-muted); }
	textarea { width: 100%; min-height: 4rem; background: var(--brand-surface); color: var(--brand-text); border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent); border-radius: var(--radius); padding: var(--space-2); font: inherit; }
	form button { margin-top: var(--space-1); padding: var(--space-1) var(--space-3); background: var(--brand-primary); color: var(--brand-bg); border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer; }
	form button:disabled { opacity: 0.55; cursor: default; }
	.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 60; padding: var(--space-4); }
	.lightbox img { max-width: 90vw; max-height: 90vh; border-radius: var(--radius); box-shadow: var(--shadow-3); }
	.lb-close { position: fixed; top: var(--space-3); right: var(--space-3); width: 2.4rem; height: 2.4rem; border-radius: var(--radius-pill); background: var(--surface-glass); border: var(--line-strong); color: var(--brand-text); font-size: 1.3rem; line-height: 1; cursor: pointer; }
	.lb-close:hover { background: color-mix(in srgb, var(--brand-primary) 18%, transparent); }
</style>
