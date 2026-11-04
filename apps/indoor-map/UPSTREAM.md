# Indoor Map integration

Source: https://github.com/Evangelisches-Schulzentrum-Leipzig/indoor-map
Revision: 8b921c37642da24ba52a5ec857f6026543e583ae
License: OSL-3.0; see LICENSE.txt and upstream/LICENSE.txt.

Original source is preserved under upstream/. RADAR adapters in src/ reuse the
MapView extrusion, visibility and route layers and Utils GeoJSON conversion.
The original school data and Docker configurations are retained as upstream
reference only and are not served as RADAR facility data. Upstream server URLs,
unimplemented role UI and hardcoded Valhalla route are not used at runtime.

The adapter uses existing RADAR scenes and pathfinding, MapLibre, generated floor
artwork and local illustration coordinates (not surveyed longitude/latitude).
Stairs are supported within a building. Cross-building travel stays in the
existing Campus explorer. No Valhalla/Martin/PostGIS deployment is claimed.
3D extrudes doorway footprints only; these are not surveyed room volumes.
Pathfinder remains the shared annotation, review, media and audit workspace.

This is an independent OSL web module alongside the AGPL Pathfinder application;
license notices and corresponding sources for both are in the source download.
