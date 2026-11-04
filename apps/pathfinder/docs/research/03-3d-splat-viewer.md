# Research Brief — 3D Scanning & Gaussian Splats for Emergency Pre-Planning

*How 3D scanning / Gaussian splatting / point clouds are used for first-responder situational awareness, and how to view them in the browser. Prepared June 2026.*

## 1. Responder use-cases & needs

3D scanning for pre-incident planning is an established, vendor-backed practice. Traditional preplanning is manual and stale — firefighters walk a building and draw a map by hand, "nearly impossible to replicate every time a building's features change." 3D scans replace this with survey-grade capture (one provider cites ±2mm at 20m, 20-30k sqft/day).

What responders want from the scene:
- **Orientation before entry** — virtually walk through a building they've never entered (critical for substitute/newly-assigned personnel).
- **Identifying tactical elements ahead of time** — structural layout, hydrants/water sources, entry/exit points, hazardous materials, site risks.
- **Room labels and floorplans** that are CAD/9-1-1 compatible and usable across agencies (law/fire/EMS).
- **Measurements** — distances, room dimensions for staging and apparatus placement.
- **Evacuation/scenario planning** — digital twins driving preventive evacuation strategies and real-time decisions.

Regulatory-driven for schools: Florida §1013.13 mandates responders tour campuses every three years; 3D documentation supplements those tours between physical visits. Gaussian splats add photorealism over bare point clouds — "millions of intelligent particles" blending into a photorealistic radiance field — which matters when a responder must recognize a real hallway under stress.

## 2. Library & format recommendation

**Renderer: Spark (World Labs).** Clear winner for a SvelteKit/THREE.js stack. Targets THREE.js + WebGL2 with 98%+ device support including iOS/Android/VR, fuses splats with regular meshes (needed for markers/annotations), supports all relevant formats (.PLY, .SPZ, .SPLAT, .KSPLAT, .SOG). Spark 2.0 (April 2026) added streaming Level-of-Detail for large worlds. The maintainer of the older GaussianSplats3D has deprecated his own project and explicitly recommends Spark. WebGL2 (not WebGPU) is the right call for first-responder field devices.

**Delivery format: SPZ.** ~90% smaller than PLY with imperceptible quality loss (PSNR ~47dB), preserves spherical harmonics, open-spec (Niantic, Apache-2.0), on the Khronos glTF standardization track. A 200MB PLY (~2M Gaussians) becomes ~18-25MB SPZ; a 500K-Gaussian scene is ~11.8MB and loads in ~1.1s. Raw PLY fails above ~200MB on iPhone Safari, so do not ship PLY to clients. Use SOG only for maximum compression; avoid KSPLAT (PlayCanvas-locked, drops higher SH bands). Archive the master PLY, deliver SPZ.

## 3. Recommended viewer feature list (prioritized)

1. **MP4 walkthrough player** (already exported by Trion Model) — zero-friction baseline every responder can use; ship first.
2. **Interactive Spark/THREE.js splat viewer** with orbit + fly + walk camera modes.
3. **Measurement tool** (point-to-point distance, room dimensions) — high responder value, not in off-the-shelf viewers; build as a differentiator using Spark's raycast-into-splat capability.
4. **Annotations/markers anchored in 3D** — title + description + saved camera viewpoint (exits, hazards, shutoffs, AED). Cap ~25/scene as a sane default.
5. **Named viewpoints/bookmarks** — store position+target+FOV, smooth transitions; doubles as a guided key-points tour.
6. **Floor/level switching** — toggle per-floor scans (essential for multi-story schools).
7. **Screenshot/export** for briefings and printed plans.
8. **Scan-version comparison** — show capture date, swap between scans after renovations.

## 4. Pipeline & storage notes

Chain: **Trion P1 scanner -> Trion Model -> web format.** The P1 outputs LAS/PCD/PTS/PLY; Trion Model imports LAS/PLY/PTS/E57 and "uses advanced 3D Gaussian splatting to produce photorealistic scenes," plus mp4 walkthroughs. Confirm whether Trion Model *exports* a 3DGS .ply (vs. only displaying internally) — if not, an E57->3DGS training step bridges the gap.

**Conversion:** PlayCanvas SplatTransform CLI for scripted PLY->SPZ (`splat-transform input.ply output.spz`). Clean floaters first in the browser-based SuperSplat editor. `3dgsconverter` (Python, GPU) is an alternative with outlier removal.

**R2 storage:** budget ~15-30MB per SPZ scene plus the mp4 (~20-100MB). A multi-floor school of ~5 scans is well under ~250MB — trivial for R2, and SPZ keeps egress and first-load cheap. Archive master PLYs (100-300MB each) in a separate cold/infrequent prefix, never served to clients.

## Sources

- https://www.nist.gov/news-events/news/2020/11/using-lasers-save-lives
- https://www.precision3dscanning.net/pre-incident-planning
- https://www.faro.com/en/LP/Pre-Incident-Planning-Workflow
- https://www.firstdue.com/news/3d-exterior-mapping
- https://www.thefuture3d.com/schools/school-safety-documentation/florida/
- https://blog.bentley.com/software/gaussian-splatting-digital-twin-reality-modeling/
- https://sparkjs.dev/docs/overview/
- https://www.worldlabs.ai/blog/spark-2.0
- https://github.com/mkkellogg/GaussianSplats3D
- https://www.polyvia3d.com/formats/gaussian-splatting-formats
- https://swyvl.io/blog/gaussian-splat-formats-ply-spz-ksplat/
- https://github.com/playcanvas/supersplat-viewer
- https://github.com/playcanvas/splat-transform
- https://us.fjdynamics.com/products/trion-model-software
