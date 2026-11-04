<script lang="ts">
	// Floor stack assembly (Epic E15, AC-15.1.x / AC-15.2.1).
	//
	// Three rules drive every decision on this page:
	//   1. The list runs LOWEST FLOOR FIRST, because hallway numbering walks the
	//      stack bottom-up. The list says so out loud - guessing which end is the
	//      basement is the fastest way to print a wrong map.
	//   2. A label is arbitrary free text ("0", "Main", "3", "1A Annex"). It is
	//      shown and stored verbatim and NEVER parsed as a number, so nothing
	//      here sorts, validates or renumbers by label.
	//   3. Position is set by hand, by dragging a floor or moving it with the
	//      keyboard, and persisted through the reorder endpoint.
	//
	// Replacing a floor's plan flags the floor: marker coordinates are normalized
	// per page, so a re-survey at a different crop shifts them and no transform
	// exists to correct that. The honest behaviour is to carry the markers
	// forward and say so.

	import Breadcrumbs, { type Crumb } from '$lib/components/Breadcrumbs.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { PageData } from './$types';

	interface Floor {
		id: string;
		building_id: string;
		label: string;
		level: number | null;
		sort_order: number;
		needs_review: number;
		doc_id: string | null;
		page: number | null;
		version: number | null;
		// Printed plan geometry (migration 0016). plan_scale is the real-world
		// width of the whole plan in millimetres; null means nobody has measured
		// it, and the export then prints no scale bar.
		plan_scale: number | null;
		north_deg: number;
	}
	interface PlanVersion {
		id: string;
		floor_id: string;
		doc_id: string;
		page: number;
		version: number;
		is_current: number;
		note: string | null;
		created_at: string;
	}

	let { data }: { data: PageData } = $props();
	const building = $derived(data.building);
	const documents = $derived(data.documents);

	// Local, reorderable copy of the server list. Moves apply here first so the
	// list responds immediately, then persist; a rejected write reverts.
	let floors = $state<Floor[]>([]);
	$effect(() => {
		floors = (data.floors as Floor[]).map((f) => ({ ...f }));
	});

	const crumbs = $derived<Crumb[]>(
		[
			{ label: 'Dashboard', href: '/dashboard' },
			data.facility ? { label: data.facility.name, href: `/facilities/${data.facility.id}` } : null,
			{ label: building.name, href: `/buildings/${building.id}` },
			{ label: 'Floors', href: `/buildings/${building.id}/floors` }
		].filter(Boolean) as Crumb[]
	);

	function docName(docId: string | null): string {
		if (!docId) return '';
		return documents.find((d) => d.id === docId)?.filename ?? docId;
	}

	// ---- ordering -----------------------------------------------------------

	async function persistOrder(next: Floor[], previous: Floor[]) {
		const res = await fetch(`/api/buildings/${building.id}/floors`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ floorIds: next.map((f) => f.id) })
		});
		if (!res.ok) {
			floors = previous;
			toasts.error('Could not save the new floor order.');
			return;
		}
		floors = ((await res.json()) as { floors: Floor[] }).floors;
		toasts.success('Floor order saved.');
	}

	/** Move a floor one step through the stack. delta -1 is down the building. */
	async function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= floors.length) return;
		const previous = floors.map((f) => ({ ...f }));
		const next = floors.slice();
		[next[index], next[target]] = [next[target], next[index]];
		floors = next;
		await persistOrder(next, previous);
	}

	// Drag reorder. The up/down buttons are the accessible equivalent and are
	// always present, so dragging stays a shortcut rather than the only way in.
	let dragIndex = $state<number | null>(null);
	let overIndex = $state<number | null>(null);

	function onDragStart(i: number, e: DragEvent) {
		dragIndex = i;
		e.dataTransfer?.setData('text/plain', floors[i].id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function onDragOver(i: number, e: DragEvent) {
		if (dragIndex === null) return;
		e.preventDefault();
		overIndex = i;
	}
	async function onDrop(i: number, e: DragEvent) {
		e.preventDefault();
		const from = dragIndex;
		dragIndex = null;
		overIndex = null;
		if (from === null || from === i) return;
		const previous = floors.map((f) => ({ ...f }));
		const next = floors.slice();
		const [moved] = next.splice(from, 1);
		next.splice(i, 0, moved);
		floors = next;
		await persistOrder(next, previous);
	}
	function onDragEnd() {
		dragIndex = null;
		overIndex = null;
	}

	// ---- labels -------------------------------------------------------------

	let editingId = $state<string | null>(null);
	let draftLabel = $state('');

	function startEdit(floor: Floor) {
		editingId = floor.id;
		draftLabel = floor.label;
	}
	function cancelEdit() {
		editingId = null;
		draftLabel = '';
	}
	async function commitLabel(floor: Floor) {
		const label = draftLabel.trim();
		if (!label || label === floor.label) return cancelEdit();
		const res = await fetch(`/api/floors/${floor.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ label })
		});
		if (!res.ok) {
			toasts.error('Could not rename that floor.');
			return cancelEdit();
		}
		// Stored verbatim: whatever was typed is what the map will print.
		floors = floors.map((f) => (f.id === floor.id ? { ...f, label } : f));
		cancelEdit();
		toasts.success(`Floor renamed to "${label}".`);
	}
	function onLabelKey(e: KeyboardEvent, floor: Floor) {
		if (e.key === 'Enter') {
			e.preventDefault();
			void commitLabel(floor);
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	// ---- add / remove -------------------------------------------------------

	let newLabel = $state('');
	let newLevel = $state('');
	let adding = $state(false);

	async function addFloor(e: Event) {
		e.preventDefault();
		if (!newLabel.trim()) return;
		adding = true;
		const res = await fetch(`/api/buildings/${building.id}/floors`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ label: newLabel.trim(), level: newLevel === '' ? null : newLevel })
		});
		adding = false;
		if (!res.ok) {
			toasts.error('Could not add that floor.');
			return;
		}
		toasts.success(`Floor "${newLabel.trim()}" added to the top of the stack.`);
		newLabel = '';
		newLevel = '';
		await invalidateAll();
	}

	async function removeFloor(floor: Floor) {
		const res = await fetch(`/api/floors/${floor.id}`, { method: 'DELETE' });
		if (!res.ok) {
			toasts.error('Could not remove that floor.');
			return;
		}
		toasts.success(`Floor "${floor.label}" removed.`);
		await invalidateAll();
	}

	// ---- plan versions ------------------------------------------------------

	let openVersions = $state<string | null>(null);
	let versions = $state<Record<string, PlanVersion[]>>({});
	let assignDoc = $state('');
	let assignPage = $state('1');
	let assignNote = $state('');

	async function loadVersions(floorId: string) {
		const res = await fetch(`/api/floors/${floorId}/versions`);
		if (!res.ok) {
			toasts.error('Could not load the plan history.');
			return;
		}
		versions = {
			...versions,
			[floorId]: ((await res.json()) as { versions: PlanVersion[] }).versions
		};
	}

	async function toggleVersions(floor: Floor) {
		if (openVersions === floor.id) {
			openVersions = null;
			return;
		}
		openVersions = floor.id;
		assignDoc = documents[0]?.id ?? '';
		assignPage = '1';
		assignNote = '';
		await loadVersions(floor.id);
	}

	async function attachPlan(e: Event, floor: Floor) {
		e.preventDefault();
		if (!assignDoc) return;
		const res = await fetch(`/api/floors/${floor.id}/versions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				docId: assignDoc,
				page: Number(assignPage) || 1,
				note: assignNote.trim() || null
			})
		});
		if (!res.ok) {
			toasts.error('Could not attach that plan.');
			return;
		}
		assignNote = '';
		toasts.success('Plan attached. Markers were carried forward for review.');
		await loadVersions(floor.id);
		await invalidateAll();
	}

	// ---- plan geometry: scale and north -------------------------------------
	//
	// The stored value is real-world millimetres across the whole plan, which is
	// what the exporter needs but not how anyone measures a building. The form
	// therefore asks for the plan's real-world WIDTH in metres or feet and does
	// the conversion here. Leaving it blank clears the scale back to unknown,
	// and an unknown scale prints no scale bar - said plainly in the panel,
	// because a missing bar on a posted map is otherwise a silent surprise.

	const MM_PER_UNIT = { m: 1000, ft: 304.8 } as const;
	type GeomUnit = keyof typeof MM_PER_UNIT;

	let openGeometry = $state<string | null>(null);
	let geomWidth = $state('');
	let geomUnit = $state<GeomUnit>('m');
	let geomNorth = $state('0');
	let savingGeom = $state(false);

	/** Trim float noise off a converted width so the field reads cleanly. */
	function tidy(n: number): string {
		return String(Number(n.toPrecision(10)));
	}

	function widthIn(planScale: number | null, unit: GeomUnit): string {
		return planScale === null ? '' : tidy(planScale / MM_PER_UNIT[unit]);
	}

	/** One-line summary of a floor's geometry for the row. */
	function geometrySummary(floor: Floor): string {
		if (floor.plan_scale === null) return 'No scale set - no scale bar prints';
		const north = floor.north_deg ? `, north ${tidy(floor.north_deg)} deg` : '';
		return `${tidy(floor.plan_scale / 1000)} m wide${north}`;
	}

	function toggleGeometry(floor: Floor) {
		if (openGeometry === floor.id) {
			openGeometry = null;
			return;
		}
		openGeometry = floor.id;
		geomUnit = 'm';
		geomWidth = widthIn(floor.plan_scale, 'm');
		geomNorth = tidy(floor.north_deg ?? 0);
	}

	/** Switching units converts what is already typed rather than discarding it. */
	function changeUnit(next: GeomUnit) {
		const current = Number(geomWidth);
		if (geomWidth.trim() !== '' && Number.isFinite(current) && current > 0) {
			geomWidth = tidy((current * MM_PER_UNIT[geomUnit]) / MM_PER_UNIT[next]);
		}
		geomUnit = next;
	}

	async function saveGeometry(e: Event, floor: Floor) {
		e.preventDefault();
		const raw = geomWidth.trim();
		let planScale: number | null = null;
		if (raw !== '') {
			const width = Number(raw);
			if (!Number.isFinite(width) || width <= 0) {
				toasts.error('Enter the plan width as a positive number, or leave it blank.');
				return;
			}
			planScale = width * MM_PER_UNIT[geomUnit];
		}
		const northDeg = Number(geomNorth.trim() === '' ? 0 : geomNorth);
		if (!Number.isFinite(northDeg)) {
			toasts.error('Enter the north rotation in degrees, clockwise from up.');
			return;
		}

		savingGeom = true;
		const res = await fetch(`/api/floors/${floor.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ planScale, northDeg })
		});
		savingGeom = false;
		if (!res.ok) {
			toasts.error('Could not save the plan scale.');
			return;
		}
		// Trust the server copy: it normalized the rotation into 0-359.
		const saved = ((await res.json()) as { floor: Floor }).floor;
		floors = floors.map((f) =>
			f.id === floor.id ? { ...f, plan_scale: saved.plan_scale, north_deg: saved.north_deg } : f
		);
		geomWidth = widthIn(saved.plan_scale, geomUnit);
		geomNorth = tidy(saved.north_deg ?? 0);
		toasts.success(
			planScale === null
				? `Scale cleared on floor "${floor.label}" - no scale bar will print.`
				: `Scale saved on floor "${floor.label}".`
		);
	}

	// ---- review flag --------------------------------------------------------

	async function clearReview(floor: Floor) {
		const res = await fetch(`/api/floors/${floor.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ needsReview: false })
		});
		if (!res.ok) {
			toasts.error('Could not clear the review flag.');
			return;
		}
		floors = floors.map((f) => (f.id === floor.id ? { ...f, needs_review: 0 } : f));
		toasts.success('Marker positions marked as verified.');
	}
</script>

<Breadcrumbs {crumbs} />

<section class="stack">
	<header>
		<p class="eyebrow">Floor stack</p>
		<h1>{building.name}</h1>
		<p class="note" data-testid="stack-note">
			Floors are listed in stack order, lowest floor first. The bottom of the building is at the
			top of this list, and hallway numbering starts there. Labels are free text and are printed
			exactly as typed.
		</p>
	</header>

	{#if data.canEdit}
		<form class="add" onsubmit={addFloor} data-testid="add-floor">
			<label class="field">
				<span>Floor label</span>
				<input
					bind:value={newLabel}
					placeholder="0, Main, 3, 1A Annex"
					required
					data-testid="new-floor-label"
				/>
			</label>
			<label class="field narrow">
				<span>Level (optional)</span>
				<input
					bind:value={newLevel}
					inputmode="numeric"
					placeholder="z-axis"
					data-testid="new-floor-level"
				/>
			</label>
			<button type="submit" disabled={adding} data-testid="add-floor-submit">Add floor</button>
		</form>
	{/if}

	{#if floors.length > 0}
		<ol class="list" data-testid="floors-list">
			{#each floors as floor, i (floor.id)}
				<li
					class="floor"
					class:dragging={dragIndex === i}
					class:over={overIndex === i && dragIndex !== i}
					draggable={data.canEdit}
					ondragstart={(e) => onDragStart(i, e)}
					ondragover={(e) => onDragOver(i, e)}
					ondrop={(e) => onDrop(i, e)}
					ondragend={onDragEnd}
					data-testid="floor-row"
				>
					<div class="row">
						{#if data.canEdit}
							<span class="grip" aria-hidden="true">::</span>
							<!-- The list runs lowest floor first, so moving a row UP the list
							     moves the floor LOWER in the building. The labels name the
							     physical move; the note at the top explains the direction. -->
							<span class="movers">
								<button
									type="button"
									onclick={() => move(i, -1)}
									disabled={i === 0}
									aria-label={`Move floor ${floor.label} lower in the building`}
									data-testid="floor-move-up">Lower</button
								>
								<button
									type="button"
									onclick={() => move(i, 1)}
									disabled={i === floors.length - 1}
									aria-label={`Move floor ${floor.label} higher in the building`}
									data-testid="floor-move-down">Higher</button
								>
							</span>
						{/if}

						{#if editingId === floor.id}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								class="label-input"
								bind:value={draftLabel}
								onkeydown={(e) => onLabelKey(e, floor)}
								onblur={() => commitLabel(floor)}
								aria-label="Floor label"
								autofocus
								data-testid="floor-label-input"
							/>
						{:else}
							<span class="label" data-testid="floor-label">{floor.label}</span>
							{#if data.canEdit}
								<button
									type="button"
									class="link"
									onclick={() => startEdit(floor)}
									aria-label={`Rename floor ${floor.label}`}
									data-testid="floor-label-edit">Rename</button
								>
							{/if}
						{/if}

						<span class="plan">
							{#if floor.doc_id}
								{docName(floor.doc_id)}
							{:else}
								No plan attached
							{/if}
						</span>

						<span class="rowactions">
							<button
								type="button"
								class="link"
								onclick={() => toggleVersions(floor)}
								aria-expanded={openVersions === floor.id}
								data-testid="versions-toggle">Plan versions</button
							>
							{#if data.canEdit}
								<button
									type="button"
									class="link danger"
									onclick={() => removeFloor(floor)}
									aria-label={`Remove floor ${floor.label}`}
									data-testid="floor-remove">Remove</button
								>
							{/if}
						</span>
					</div>

					{#if floor.needs_review}
						<p class="review" role="status" data-testid="needs-review-banner">
							<span>Plan updated - verify marker positions on this floor.</span>
							{#if data.canEdit}
								<button
									type="button"
									onclick={() => clearReview(floor)}
									data-testid="clear-needs-review">Positions verified</button
								>
							{/if}
						</p>
					{/if}

					{#if openVersions === floor.id}
						<div class="versions" data-testid="versions-panel">
							{#if (versions[floor.id] ?? []).length > 0}
								<ul>
									{#each versions[floor.id] as v (v.id)}
										<li class="version" data-testid="version-row">
											<span class="vnum">v{v.version}</span>
											<span class="vdoc">{docName(v.doc_id)} p{v.page}</span>
											{#if v.note}<span class="vnote">{v.note}</span>{/if}
											{#if v.is_current}
												<span class="current" data-testid="version-current">Current</span>
											{/if}
										</li>
									{/each}
								</ul>
							{:else}
								<p class="muted" data-testid="no-versions">
									No plan has been attached to this floor yet.
								</p>
							{/if}

							{#if data.canEdit}
								{#if documents.length > 0}
									<form class="assign" onsubmit={(e) => attachPlan(e, floor)} data-testid="assign-plan">
										<label class="field">
											<span>Document</span>
											<select bind:value={assignDoc} data-testid="assign-doc">
												{#each documents as d (d.id)}
													<option value={d.id}>{d.filename}</option>
												{/each}
											</select>
										</label>
										<label class="field narrow">
											<span>Page</span>
											<input bind:value={assignPage} inputmode="numeric" data-testid="assign-page" />
										</label>
										<label class="field">
											<span>Note (optional)</span>
											<input
												bind:value={assignNote}
												placeholder="post-2026 renovation"
												data-testid="assign-note"
											/>
										</label>
										<button type="submit" data-testid="assign-submit">Attach as new version</button>
									</form>
								{:else}
									<p class="muted" data-testid="no-documents">
										Upload a floorplan to this building before attaching a plan.
									</p>
								{/if}
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<div class="empty" data-testid="empty-stack">
			<p class="empty-title">No floors yet</p>
			<p class="empty-body">
				Add one floor per level of this building, starting at the bottom. A floor keeps its
				markers when its plan is re-surveyed, so build the stack once and swap the plans
				underneath it later.
			</p>
		</div>
	{/if}
</section>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--brand-muted);
	}
	h1 {
		font-size: 1.6rem;
	}
	.note {
		color: var(--brand-muted);
		max-width: 46rem;
		margin-top: var(--space-2);
	}
	.add {
		display: flex;
		gap: var(--space-3);
		align-items: flex-end;
		flex-wrap: wrap;
		padding: var(--space-3);
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius-lg);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: 0.8rem;
		color: var(--brand-muted);
	}
	.field.narrow input {
		max-width: 7rem;
	}
	.add button {
		padding: 0.5rem 0.95rem;
		color: var(--brand-bg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--brand-primary) 92%, white),
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
	.add button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: var(--glow);
	}
	.add button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.floor {
		background: var(--surface-glass);
		border: var(--line);
		border-radius: var(--radius);
		transition:
			border-color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}
	.floor.dragging {
		opacity: 0.55;
	}
	.floor.over {
		border-color: color-mix(in srgb, var(--brand-primary) 60%, transparent);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		flex-wrap: wrap;
	}
	.grip {
		color: var(--brand-muted);
		cursor: grab;
		letter-spacing: 0.1em;
	}
	.movers {
		display: flex;
		gap: var(--space-1);
	}
	.movers button,
	.review button {
		padding: 0.3rem 0.6rem;
		background: var(--surface-glass);
		color: var(--brand-text);
		border: var(--line-strong);
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 0.78rem;
		font-weight: 500;
	}
	.movers button:hover:not(:disabled),
	.review button:hover {
		border-color: color-mix(in srgb, var(--brand-primary) 50%, transparent);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.movers button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.label {
		font-weight: 600;
		font-size: 1.05rem;
	}
	.label-input {
		max-width: 12rem;
	}
	.plan {
		color: var(--brand-muted);
		font-size: 0.85rem;
	}
	.rowactions {
		margin-left: auto;
		display: flex;
		gap: var(--space-2);
	}
	.link {
		background: none;
		border: none;
		padding: 0;
		color: var(--brand-primary);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}
	.link:hover {
		text-decoration: underline;
	}
	.link.danger {
		color: color-mix(in srgb, var(--brand-accent) 85%, var(--brand-text));
	}
	.review {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin: 0 var(--space-4) var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius);
		border: 1px solid color-mix(in srgb, var(--brand-accent) 55%, transparent);
		background: color-mix(in srgb, var(--brand-accent) 14%, transparent);
		color: var(--brand-text);
		font-size: 0.85rem;
	}
	.versions {
		margin: 0 var(--space-4) var(--space-3);
		padding-top: var(--space-2);
		border-top: var(--line);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.versions ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.version {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: 0.85rem;
		color: var(--brand-muted);
		flex-wrap: wrap;
	}
	.vnum {
		font-family: var(--brand-font-mono);
		color: var(--brand-text);
	}
	.vdoc {
		color: var(--brand-text);
	}
	.vnote {
		font-style: italic;
	}
	.current {
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--brand-primary) 22%, transparent);
		border: 1px solid color-mix(in srgb, var(--brand-primary) 55%, transparent);
		color: var(--brand-primary);
		font-size: 0.72rem;
		font-weight: 600;
	}
	.assign {
		display: flex;
		gap: var(--space-3);
		align-items: flex-end;
		flex-wrap: wrap;
	}
	.assign button {
		padding: 0.4rem 0.8rem;
		background: var(--surface-glass);
		color: var(--brand-text);
		border: var(--line-strong);
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.assign button:hover {
		border-color: color-mix(in srgb, var(--brand-primary) 50%, transparent);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.muted {
		color: var(--brand-muted);
		font-size: 0.85rem;
	}
	.empty {
		background: var(--surface-glass);
		border: 1px dashed color-mix(in srgb, var(--brand-secondary) 55%, transparent);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.empty-title {
		font-size: 1.2rem;
		font-weight: 600;
	}
	.empty-body {
		color: var(--brand-muted);
		max-width: 42rem;
	}
</style>
