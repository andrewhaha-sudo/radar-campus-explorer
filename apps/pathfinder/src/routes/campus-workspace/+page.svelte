<script lang="ts">
 import type { PageData } from './$types';
 let {data}:{data:PageData}=$props();
</script>
<svelte:head><title>RADAR shared floor workspace</title></svelte:head>
<h1>Campus floor workspace</h1>
<p>Shared Pathfinder documents for the RADAR campus drawings. Review annotations, collaborate, publish versions and export maps from each floorplan.</p>
<p>These source illustrations require site verification. Staff facilities accounts and student profiles have separate permissions.</p>
<nav aria-label="Campus workspace"><a href="/campus/">Campus explorer</a> <a href="/dashboard">Facilities dashboard</a> <a href="/search">Search documents and media</a></nav>
{#if !data.available}<p role="status">The facilities database is unavailable.</p>{:else if !data.floors.length}<p role="status">No campus floorplans are available to this account. An administrator must initialize the campus documents and assign access.</p>{/if}
<div class="radar-floors">
 {#each data.floors as floor}
  <article data-testid="radar-floor"><div data-testid={`radar-floor-${floor.sceneId}`}>
   <h2>{floor.name}</h2><p>{floor.roomIds.join(', ')}</p>
   <a href={`/documents/${floor.documentId}`}>Open shared floorplan</a>
   <a href={`/buildings/${floor.buildingId}/floors`}>Floor versions and geometry</a>
   <a href={`/buildings/${floor.buildingId}`}>Projects, media and 3D scans</a>
  </div></article>
 {/each}
</div>
<style>
 nav{display:flex;gap:var(--space-4);flex-wrap:wrap;margin-block:var(--space-5)}
 .radar-floors{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-4)}
 article{padding:var(--space-5);border:var(--line);border-radius:var(--radius);background:var(--brand-surface)}
 article h2{font-family:var(--brand-font-display);font-size:1.2rem}article p{color:var(--brand-muted);overflow-wrap:anywhere}
 article a{display:block;margin-top:var(--space-3);color:var(--brand-primary)}
</style>
