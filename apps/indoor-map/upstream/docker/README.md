# Docker Setup for Mapbox Indoor Project

This directory contains Docker configurations for running the following services:

- **Tile Server** (`martin`): Serves vector tiles from MBTiles files.
- **Routing Server** (`valhalla`): Provides routing services using Valhalla.
- **Database** (`db`): PostGIS-enabled PostgreSQL database for Martin.
- **Tilemaker Config**: Configuration files for generating vector tiles from OSM data.

## Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

## Folder Structure

- `martin/tiles/` — Place your `.mbtiles` files here for the tile server.
- `martin/db/` — Used by the PostGIS database (persistent storage).
- `valhalla/custom_files/` — Custom Valhalla config, OSM extracts, and generated tiles.
- `valhalla/data/` — Used for Valhalla runtime data.
- `tilemaker/` — Contains `config.json` and `process.lua` for tilemaker.

**Important:**  
The folders used as Docker volumes (`martin/tiles/`, `martin/db/`, `valhalla/custom_files/`, `valhalla/data/`) must exist before running `docker-compose up`.  
These folders are not included in the git repository and need to be created manually if missing.

## Usage
0. Place your tiles in the `martin/tiles/` folder as `.mbtiles` and the osm data for routing inside the `valhalla/custom_files` as `.osm.pbf` files.

1. **Build and start all services:**

   ```sh
   docker-compose up -d
   ```

2. **Access the services:**
   - Martin Tile Server: [http://localhost:3000](http://localhost:3000)
   - Valhalla Routing Server: [http://localhost:8002](http://localhost:8002)

## Tilemaker Configuration

- `tilemaker/config.json` — Defines layers and settings for vector tile generation.
- `tilemaker/process.lua` — Lua script for processing OSM data into custom layers (e.g., rooms, corridors, doors, elevators).

## Tips to get tiles and routing data
You can edit OSM data perfectly with [JOSM](https://josm.openstreetmap.de/) and export the data as `.osm.pbf` files with the PBF extension.  
  
These files then can be used with [tilemaker](https://github.com/systemed/tilemaker) and the config files to generate the `.mbtiles`.  
You may want to change to configs to use less RAM. And please compile rather from source and run tilemaker on bare metal as tilemaker is very for more detailed tiles memory hungry. You need more detail because indoor features are very small

## Notes

- The database and tile data are persisted in the respective folders mapped as Docker volumes.
- If you need to reset the database or tile data, you can stop the containers and remove the contents of the corresponding folders.

---
