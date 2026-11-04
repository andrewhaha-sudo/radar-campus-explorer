# Indoor Map (School Digital Twin)

**Status:** In development

This project is a web-based 2D/3D indoor navigation system for a school campus, using MapLibre GL JS, valhalla and custom vector tiles. It aims to provide interactive indoor maps, routing, status of infrastructure and search functionality for buildings and rooms.

## Features

- Interactive indoor maps with MapLibre GL
- Indoor routing (Valhalla)
- Search for rooms and locations
- Custom vector tiles (Tilemaker)
- Status indicators
- Dockerized tile and routing servers

## Project Structure

- `js/` — Main frontend JavaScript (map, UI, routing, utils)
- `css/` — Tailwind CSS setup
- `data/` — Data templates and base data for plans
- `docker/` — Docker Compose setup for tile server (martin), routing server (valhalla), and database
- `docker/tilemaker/` — Config and Lua script for custom vector tile generation
- `index.html` — Main entry point

## Development

Install dependencies and start the development server:

```sh
npm i -d
npm run dev
```

Build for production:

```sh
npm run build
```

## Docker Setup

For information on running the tile server, routing server, and related configuration using Docker, see [docker/README.md](docker/README.md).

## Contributing

Contributions of any kind are welcome!

## License

[Open Software License 3.0](https://choosealicense.com/licenses/osl-3.0/)

## Acknowledgements

This project makes use of the following open source tools, libraries, and resources:

- [MapLibre GL JS](https://maplibre.org/) — Interactive map rendering
- [Valhalla](https://github.com/valhalla/valhalla) — Routing engine
- [Martin](https://github.com/maplibre/martin) — Vector tile server
- [Tilemaker](https://github.com/systemed/tilemaker) — Custom vector tile generation
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework
- [PostGIS](https://postgis.net/) — Spatial database extension for PostgreSQL
- [Vite](https://vitejs.dev/) — Frontend build tool

Used tools in development outside of code:

- [JOSM](https://josm.openstreetmap.de/) — OSM editor and exporter
- [mbtiles-viewer](https://github.com/gmaclennan/mbtiles-viewer) — For viewing/debugging MBTiles

Special thanks to:

- [OpenStreetMap](https://www.openstreetmap.org/) and its contributors for geodata

Large inspirations:

- [Christian Beiwinkel's Indoor Routing Post](https://bwnkl.de/posts/indoor-routing/) — For routing ideas and approaches
- [Volker Krause's KDE Venue Maps](https://www.volkerkrause.eu/2024/07/06/kde-kongress-venue-maps.html) — For concrete indoor mapping inspiration
- [MapsPeople MapsIndoors](https://www.mapspeople.com/mapsindoors) — For indoor mapping concepts and UI ideas