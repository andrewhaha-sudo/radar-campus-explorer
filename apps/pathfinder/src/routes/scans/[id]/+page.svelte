<script lang="ts">
	// 3D scan viewer (Epic E8). Two baselines: an mp4 walkthrough player every
	// responder can use, and the interactive Spark splat viewer (THREE.js,
	// WebGL2, SPZ delivery) with point-to-point measurement, anchored 3D markers,
	// named viewpoints, floor switching and capture-date version compare. THREE +
	// Spark load lazily in the browser; the page degrades to a clear message if
	// WebGL2 is unavailable. All geometry math comes from the tested engine.
	import { onMount, onDestroy } from 'svelte';
	import { toasts } from '$lib/stores/toasts.svelte';
	import { activeBrand } from '$lib/brand';
	import type { PageData } from './$types';
	import { distance3d, toMeters, formatMeasurement, type Vec3 } from '$lib/engines/splat-viewer/measure';
	import {
		MARKER3D_TYPES,
		MAX_SCENE_MARKERS,
		canAddMarker,
		interpolateViewpoint,
		tourOrder,
		type Marker3d,
		type Marker3dType,
		type Viewpoint
	} from '$lib/engines/splat-viewer/markers3d';

	let { data }: { data: PageData } = $props();
	const isVideo = () => data.media.type === 'walkthrough_video';

	let host: HTMLDivElement | undefined = $state();
	let status = $state('loading');
    let loadedSplats = $state(0);
	let measureMode = $state(false);
	let markerMode = $state<Marker3dType | null>(null);
	let measurePts = $state<Vec3[]>([]);
	let measureLabel = $state('');
	let markers = $state<Marker3d[]>([]);
	let viewpoints = $state<Viewpoint[]>([]);
	let dirty = $state(false);
	let saving = $state(false);
	let unitsPerMeter = $state(1);

	let three: typeof import('three') | null = null;
	let renderer: any = null;
	let scene: any = null;
	let camera: any = null;
	let controls: any = null;
	let splat: any = null;
    let spark: any = null;
	let raf = 0;
    let destroyed = false;

	function seed() {
		markers = data.markers.map((m) => ({
			id: m.id,
			type: m.type as Marker3dType,
			label: m.label,
			description: m.description ?? undefined,
			position: [m.px, m.py, m.pz] as Vec3,
			normal: m.nx != null ? ([m.nx, m.ny, m.nz] as Vec3) : undefined,
			viewpointId: m.viewpoint_id,
			floor: m.floor
		}));
		viewpoints = data.viewpoints.map((v) => ({
			id: v.id,
			name: v.name,
			position: [v.px, v.py, v.pz] as Vec3,
			target: [v.tx, v.ty, v.tz] as Vec3,
			fov: v.fov,
			order: v.sort_order
		}));
	}

	onMount(async () => {
		seed();
		if (isVideo()) {
			status = 'ready';
			return;
		}
		if (!host) return;
		try {
			const THREE = await import('three');
			const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
			const { SplatMesh, SparkRenderer } = await import('@sparkjsdev/spark');
            if (destroyed) return;
			three = THREE;
			const w = host.clientWidth || 800;
			const h = host.clientHeight || Math.round(w * 0.6); // fill the host box
			renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setSize(w, h);
			renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
			renderer.domElement.style.width = '100%';
			renderer.domElement.style.height = '100%';
			host.appendChild(renderer.domElement);
			scene = new THREE.Scene();
			// Brand background (THREE.Color accepts the CSS hex string), so the 3D
			// scene reskins with the white-label brand layer like everything else.
			scene.background = new THREE.Color(activeBrand.colors.bg);
            spark = new SparkRenderer({ renderer });
            scene.add(spark);
			camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
			camera.position.set(0, 1.6, 4);
			controls = new OrbitControls(camera, renderer.domElement);
			controls.enableDamping = true;
			splat = new SplatMesh({ url: data.fileUrl, fileName: data.media.filename });
			scene.add(splat);
			await splat.initialized;
            if (destroyed) return;
            loadedSplats = splat.packedSplats?.numSplats ?? splat.extSplats?.numSplats ?? splat.splats?.getNumSplats?.() ?? 0;
            if (!loadedSplats) throw new Error('The scan contains no displayable splats');
			status = 'ready';
			const loop = () => {
				controls.update();
				renderer.render(scene, camera);
				raf = requestAnimationFrame(loop);
			};
			loop();
			// Keep the drawing buffer + camera aspect matched to the host box.
			ro = new ResizeObserver(() => {
				if (!renderer || !camera || !host) return;
				const cw = host.clientWidth;
				const ch = host.clientHeight;
				if (cw === 0 || ch === 0) return;
				renderer.setSize(cw, ch, false);
				camera.aspect = cw / ch;
				camera.updateProjectionMatrix();
			});
			ro.observe(host);
		} catch (e) {
            releaseRenderer();
            if (destroyed) return;
			status = 'error:' + (e instanceof Error ? e.message : 'WebGL2 unavailable');
		}
	});

	let ro: ResizeObserver | undefined;

    function releaseRenderer() {
        if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
        ro?.disconnect();
        controls?.dispose?.();
        splat?.dispose?.();
        spark?.dispose?.();
        renderer?.forceContextLoss?.();
        renderer?.dispose?.();
        controls = null; splat = null; spark = null; renderer = null;
    }
    onDestroy(() => { destroyed = true; releaseRenderer(); });

	function pickPoint(ev: PointerEvent): Vec3 | null {
		if (!three || !renderer || !camera) return null;
		const rect = renderer.domElement.getBoundingClientRect();
		const ndc = new three.Vector2(
			((ev.clientX - rect.left) / rect.width) * 2 - 1,
			-((ev.clientY - rect.top) / rect.height) * 2 + 1
		);
		const ray = new three.Raycaster();
		ray.setFromCamera(ndc, camera);
		// Try a splat raycast; fall back to the ground plane (y=0) so a point is
		// always pickable even where the splat is sparse.
		const hits = splat ? ray.intersectObject(splat, true) : [];
		if (hits.length) {
			const p = hits[0].point;
			return [p.x, p.y, p.z];
		}
		const plane = new three.Plane(new three.Vector3(0, 1, 0), 0);
		const target = new three.Vector3();
		if (ray.ray.intersectPlane(plane, target)) return [target.x, target.y, target.z];
		return null;
	}

	function onCanvasPointerDown(ev: PointerEvent) {
		if (!data.canEdit) return;
		const p = pickPoint(ev);
		if (!p) return;
		if (measureMode) {
			measurePts = measurePts.length >= 2 ? [p] : [...measurePts, p];
			if (measurePts.length === 2) {
				const d = toMeters(distance3d(measurePts[0], measurePts[1]), unitsPerMeter);
				measureLabel = formatMeasurement(d);
			} else {
				measureLabel = '';
			}
		} else if (markerMode) {
			if (!canAddMarker(markers.length)) {
				measureLabel = `Scene marker cap (${MAX_SCENE_MARKERS}) reached.`;
				return;
			}
			const label = window.prompt(`Label for ${markerMode}:`) ?? '';
			markers = [
				...markers,
				{ id: 'm3' + Date.now().toString(36), type: markerMode, label, position: p }
			];
			dirty = true;
		}
	}

	function gotoViewpoint(vp: Viewpoint) {
		if (!camera || !controls || !three) return;
		const from: Viewpoint = {
			id: '_cur',
			name: '',
			position: [camera.position.x, camera.position.y, camera.position.z],
			target: [controls.target.x, controls.target.y, controls.target.z],
			fov: camera.fov
		};
		const t0 = performance.now();
		const dur = 700;
		const step = (now: number) => {
			const t = Math.min(1, (now - t0) / dur);
			const s = interpolateViewpoint(from, vp, t);
			camera.position.set(...s.position);
			controls.target.set(...s.target);
			camera.fov = s.fov;
			camera.updateProjectionMatrix();
			if (t < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	function saveViewpoint() {
		if (!camera || !controls) return;
		const name = window.prompt('Viewpoint name:') ?? '';
		if (!name.trim()) return;
		viewpoints = [
			...viewpoints,
			{
				id: 'vp' + Date.now().toString(36),
				name,
				position: [camera.position.x, camera.position.y, camera.position.z],
				target: [controls.target.x, controls.target.y, controls.target.z],
				fov: camera.fov,
				order: viewpoints.length
			}
		];
		dirty = true;
	}

	function deleteMarker(id: string) {
		markers = markers.filter((m) => m.id !== id);
		dirty = true;
	}

	async function save() {
		saving = true;
		const [m, v] = await Promise.all([
			fetch(`/api/media/${data.media.id}/markers3d`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					markers: markers.map((m) => ({
						id: m.id,
						type: m.type,
						label: m.label,
						description: m.description,
						position: m.position,
						normal: m.normal ?? null,
						viewpointId: m.viewpointId ?? null,
						floor: m.floor ?? null
					}))
				})
			}),
			fetch(`/api/media/${data.media.id}/viewpoints`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					viewpoints: viewpoints.map((v) => ({
						id: v.id,
						name: v.name,
						position: v.position,
						target: v.target,
						fov: v.fov,
						order: v.order
					}))
				})
			})
		]);
		saving = false;
		if (m.ok && v.ok) {
			dirty = false;
			toasts.success('3D markers and viewpoints saved.');
		} else {
			toasts.error('Could not save the 3D scene. Try again.');
		}
	}

	const tour = $derived(tourOrder(viewpoints));
</script>

<section class="scan">
	<header class="shead">
		<div>
			<p class="eyebrow">{isVideo() ? 'Walkthrough' : '3D Scan'}</p>
			<h1>{data.media.filename}</h1>
			{#if data.media.capture_date}<p class="muted">Captured {data.media.capture_date}{#if data.media.surveyor} - {data.media.surveyor}{/if}</p>{/if}
		</div>
		{#if data.canEdit && !isVideo()}
			<div class="actions">
				<button class:active={measureMode} aria-pressed={measureMode} onclick={() => { measureMode = !measureMode; markerMode = null; measurePts = []; measureLabel = ''; }} data-testid="measure-toggle">Measure</button>
				<button onclick={saveViewpoint} data-testid="save-viewpoint">Save viewpoint</button>
				<button class="primary" onclick={save} disabled={saving || !dirty} data-testid="save-3d">{saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}</button>
			</div>
		{/if}
	</header>

	<div class="layout">
		<div class="stage">
			{#if isVideo()}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video src={data.fileUrl} controls playsinline data-testid="walkthrough-video"></video>
			{:else}
				<div
					class="host"
					bind:this={host}
					onpointerdown={onCanvasPointerDown}
					role="application"
					aria-label="Interactive 3D scan viewport. Use measure and marker tools to annotate."
					data-testid="splat-host"
                    data-loaded-splats={loadedSplats}
				></div>
				{#if status.startsWith('loading')}
					<p class="overlay" data-testid="splat-status">Loading splat...</p>
				{:else if status.startsWith('error')}
					<p class="overlay err" data-testid="splat-status">3D view unavailable: {status.slice(6)}. Use the walkthrough video instead.</p>
				{/if}
				{#if measureLabel}<p class="measure" data-testid="measure-readout">{measureLabel}</p>{/if}
			{/if}
		</div>

		<aside class="panel">
			{#if data.canEdit && !isVideo()}
				<h2>Place marker</h2>
				<div class="marker-tools" data-testid="marker3d-tools">
					{#each MARKER3D_TYPES as mt (mt)}
						<button class:active={markerMode === mt} aria-pressed={markerMode === mt} onclick={() => { markerMode = markerMode === mt ? null : mt; measureMode = false; }} data-testid={`m3-${mt}`}>{mt}</button>
					{/each}
				</div>
				<label class="scale">Scan units per metre
					<input type="number" min="0.01" step="0.01" bind:value={unitsPerMeter} />
				</label>
			{/if}

			<h2>Markers ({markers.length}/{MAX_SCENE_MARKERS})</h2>
			<ul class="mlist" data-testid="marker3d-list">
				{#each markers as m (m.id)}
					<li><span class="mtype">{m.type}</span> {m.label || '(unlabeled)'}
						{#if data.canEdit && !isVideo()}<button class="x" onclick={() => deleteMarker(m.id)} aria-label="Delete marker">x</button>{/if}
					</li>
				{:else}
					<li class="muted">No 3D markers yet.</li>
				{/each}
			</ul>

			<h2>Viewpoints</h2>
			<ul class="vlist" data-testid="viewpoint-list">
				{#each tour as v (v.id)}
					<li><button onclick={() => gotoViewpoint(v)} disabled={isVideo()} data-testid="viewpoint">{v.name}</button></li>
				{:else}
					<li class="muted">No saved viewpoints.</li>
				{/each}
			</ul>

			{#if data.related.length > 1}
				<h2>Floors &amp; versions</h2>
				<ul class="rlist" data-testid="related-scans">
					{#each data.related as r (r.id)}
						<li>
							<button class:current={r.id === data.media.id} onclick={() => window.location.assign(`/scans/${encodeURIComponent(r.id)}`)}>
								{r.type === 'walkthrough_video' ? 'Video' : 'Splat'}
								{#if r.floor != null}- floor {r.floor}{/if}
								v{r.version}{#if r.capture_date} - {r.capture_date}{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>
</section>

<style>
	.scan { display: flex; flex-direction: column; gap: var(--space-3); }
	.shead {
		display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap;
		padding: var(--space-2) var(--space-3);
		background: var(--surface-glass); border: var(--line); border-radius: var(--radius-lg);
		box-shadow: var(--shadow-1); backdrop-filter: blur(10px);
	}
	h1 { font-size: 1.05rem; letter-spacing: -0.01em; }
	h2 {
		font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.12em;
		font-family: var(--brand-font-mono); color: var(--brand-muted);
		margin: var(--space-3) 0 var(--space-1);
	}
	.muted { color: var(--brand-muted); font-size: 0.85rem; }
	.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
	.actions button, .marker-tools button {
		padding: 0.4rem 0.75rem; background: var(--surface-glass); color: var(--brand-text);
		border: var(--line-strong); border-radius: var(--radius); cursor: pointer; font-size: 0.8rem; font-weight: 500;
		transition: transform var(--dur-1) var(--ease), background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
	}
	.actions button:hover:not(:disabled), .marker-tools button:hover:not(:disabled) {
		transform: translateY(-1px); border-color: color-mix(in srgb, var(--brand-primary) 50%, transparent);
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.actions .primary {
		color: var(--brand-bg); font-weight: 600; border-color: var(--brand-primary);
		background: linear-gradient(180deg, color-mix(in srgb, var(--brand-primary) 92%, white), var(--brand-primary));
		box-shadow: var(--shadow-1);
	}
	.actions .primary:hover:not(:disabled) { box-shadow: var(--glow); }
	button.active { background: color-mix(in srgb, var(--brand-primary) 20%, transparent); border-color: color-mix(in srgb, var(--brand-primary) 60%, transparent); color: var(--brand-text); font-weight: 600; }
	button:disabled { opacity: 0.55; cursor: not-allowed; }
	.layout { display: flex; gap: var(--space-3); align-items: flex-start; flex-wrap: wrap; }
	.stage {
		flex: 1; min-width: 320px; position: relative; overflow: hidden;
		background:
			linear-gradient(color-mix(in srgb, var(--brand-secondary) 12%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--brand-secondary) 12%, transparent) 1px, transparent 1px),
			var(--brand-bg);
		background-size: 24px 24px;
		border: var(--line); border-radius: var(--radius-lg);
		box-shadow: inset 0 0 60px -20px rgba(0,0,0,0.6), var(--shadow-1);
	}
	.host { width: 100%; height: calc(100vh - 15rem); min-height: 30rem; }
	.host :global(canvas) { display: block; width: 100%; height: 100%; cursor: crosshair; }
	video { width: 100%; max-height: calc(100vh - 15rem); display: block; background: #000; border-radius: var(--radius-lg); }
	.overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--brand-muted); padding: var(--space-4); text-align: center; }
	.overlay.err { color: #e2574c; }
	.measure {
		position: absolute; left: var(--space-3); bottom: var(--space-3);
		background: color-mix(in srgb, var(--brand-bg) 80%, transparent); color: var(--brand-text);
		padding: 0.4rem 0.7rem; border-radius: var(--radius); border: var(--line-strong);
		font-variant-numeric: tabular-nums; font-family: var(--brand-font-mono); font-size: 0.85rem;
		backdrop-filter: blur(8px); box-shadow: var(--shadow-2);
	}
	.panel { width: 16rem; flex-shrink: 0; padding: var(--space-3); }
	.marker-tools { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
	.marker-tools :global(.btn) { padding: 0.45rem 0.5rem; white-space: normal; overflow-wrap: anywhere; min-width: 0; line-height: 1.2; }
	.scale { display: flex; flex-direction: column; gap: var(--space-1); font-size: 0.72rem; color: var(--brand-muted); margin-top: var(--space-3); }
	.mlist, .vlist, .rlist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-1); font-size: 0.85rem; }
	.mlist li, .vlist li, .rlist li { display: flex; align-items: center; gap: var(--space-2); }
	.vlist button, .rlist button {
		width: 100%; text-align: left; padding: 0.4rem 0.6rem; background: var(--surface-glass);
		color: var(--brand-text); border: var(--line); border-radius: var(--radius); cursor: pointer; font-size: 0.82rem;
		transition: background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
	}
	.vlist button:hover:not(:disabled), .rlist button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
		border-color: color-mix(in srgb, var(--brand-primary) 40%, transparent);
	}
	.mtype { font-weight: 600; color: var(--brand-primary); font-family: var(--brand-font-mono); font-size: 0.78rem; }
	.x { margin-left: auto; padding: 0 0.45em; background: transparent; border: none; color: var(--brand-muted); cursor: pointer; font-size: 1rem; }
	.x:hover { color: #e2574c; }
	button.current { outline: 2px solid var(--brand-primary); outline-offset: -2px; }
	@media (max-width: 50rem) { .panel { width: 100%; } }
</style>
