# RADAR → LifeRouter compatibility prototype

This original adapter reuses RADAR's existing walkability geometry, room IDs,
building entrances and stair connections. It targets LifeRouter commit
`99e468e4ae7b382832dcf0026914c4d08ce53ff0` (Apache-2.0).
The generator itself has no engine dependency. The companion Go service now imports
LifeRouter v1.0.0: see [integration and running instructions](../../docs/LIFEROUTER.md).

Generate with Node.js 24 from the repository root:

```bash
node experiments/liferouter/export-campus.mjs --demo
```

Outputs in `generated/`: twelve indexed PNG masks (red = walkable, black = blocked),
`campus-demo.yaml` and a manifest of all 35 rooms. All coordinates remain derived
from the supplied illustration. **0.05 metres per source pixel is a fictional demo
scale, not GPS calibration or a physical measurement.** Never deploy this file as
an emergency plan. Each scene has its own coordinate space, joined by explicit
portals. Floors and outdoor geography need separate verified scaling/registration
before any real navigation use.

The PNGs are already reduced to 4 source pixels per cell, so LifeRouter's
`pxpercell` is 1. A cell is opened only when every sampled source pixel is walkable.
There are ten bidirectional stair/entrance connections. Building 6 connects its two
floors but deliberately has no invented connection to the outdoor campus.
Room endpoints are snapped to cell centres and checked against the generated mask.

## Verify against the actual engine

In a separate checkout (Go 1.25.3 or compatible):

```bash
git clone https://github.com/Kentalives/LifeRouter.git
cd LifeRouter
git checkout 99e468e4ae7b382832dcf0026914c4d08ce53ff0
# Substitute the absolute path of your RADAR checkout below.
cp /path/to/radar-campus-explorer/experiments/liferouter/radar_adapter_test.go internal/grid/
RADAR_CAMPUS_EXPORT=/path/to/radar-campus-explorer/experiments/liferouter/generated \
  go test ./internal/grid -run TestRADARCampusExport -v
```

This test loads the generated configuration using LifeRouter's real config loader,
reads all PNGs through its production rasterizer, checks blocked border cells and
portal endpoints, and flood-fills the grids to verify that all 35 rooms reach a
portal. It does **not** establish that every room reaches a real safe outdoor exit,
particularly Building 6. The test passed during this evaluation.

## Runtime integration

The tested adapter is now used by `services/liferouter`, which embeds the public
LifeRouter API behind a bounded HTTP bridge. It checks subscription readiness,
uses temporary simulated agents, and never accepts GPS positions. See
[LifeRouter integration](../../docs/LIFEROUTER.md) for setup, API tests and limitations.
The compatibility export remains simulation geometry, not a verified evacuation plan.
