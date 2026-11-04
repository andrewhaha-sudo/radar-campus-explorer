import maplibregl from 'maplibre-gl';
import MaplibreInspect from '@maplibre/maplibre-gl-inspect';
import { Utils } from './utils.js';

export class MapView {
    constructor() {
        this.container = document.querySelector("#map-container");
        this.map = null;

        this.updateFunction = null;
    }

    async init(updateFunction = null, options = {}) {
        this.updateFunction = updateFunction;
        var initialView = await this.getInitialView();

        this.map = new maplibregl.Map({
            container: this.container,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [initialView.lon, initialView.lat],
            zoom: initialView.zoom,
            pitch: 60,
            bearing: 0,
            antialias: true,
            ...options
        });

        return new Promise((resolve) => {
            this.map.on('load', async () => {
                console.log('MapLibre map loaded');
                this.map.addSource('indoor_data', {
                    type: 'vector',
                    url: 'http://localhost:3000/tile'
                });
                this.map.addLayer({
                    "id": "room",
                    "type": "fill",
                    "source": "indoor_data",
                    "source-layer": "indoor_room",
                    "layout": {
                        "visibility": "visible"
                    },
                    "paint": {
                        "fill-color": '#a3be8c',
                        "fill-antialias": true,
                        "fill-outline-color": "#000000",
                    }
                });
                this.map.addLayer({
                    "id": "door",
                    "type": "circle",
                    "source": "indoor_data",
                    "source-layer": "indoor_door",
                    "layout": {
                        "visibility": "visible"
                    },
                    "circle": {
                        "circle-radius": 2,
                        "circle-color": "#bf616a"
                    }
                });
                this.map.addLayer({
                    "id": "elevator",
                    "type": "fill",
                    "source": "indoor_data",
                    "source-layer": "indoor_elevator",
                    "layout": {
                        "visibility": "visible"
                    },
                    "fill": {
                        "fill-color": "#d08770",
                        "fill-antialias": true,
                        "fill-outline-color": "#000000",
                    }
                });
                this.map.addLayer({
                    "id": "corridor",
                    "type": "line",
                    "source": "indoor_data",
                    "source-layer": "indoor_corridor",
                    "layout": {
                        "visibility": "visible"
                    },
                    "line": {
                        "line-color": "#00ffff",
                        "line-width": 10
                    }
                });
                this.map.addControl(new MaplibreInspect({
                    popup: new maplibregl.Popup({
                        closeButton: false,
                        closeOnClick: false
                    })
                }));
                await this.loadBuildingSources();
                resolve(this);
            });
        });
    }

    /**
     * 
     * @returns {Promise<{lat: number, lon: number, zoom: number}>}
     */
    async getInitialView() {
        var data = await (await fetch('/data/base_data.json')).json();
        return data.map_initial_view;
    }

    async loadBuildingSources() {
        var data = await (await fetch('/data/base_data.json')).json();
        for (let building of data.buildings) {
            for (let level of building.levels) {
                Utils.checkIfFileExists(level.geojson_path).then(async (exists) => {
                    if (exists) {
                        this.addBuildingLayer((await this.getGeoJSON(building.id, level.level)), building.id, level.level);
                    } else {
                        // console.warn(`[Map] GeoJSON file for building ${building.id} level ${level.level} does not exist at path: ${level.geojson_path}`);
                    }
                });
            }
        }
    }

    zoomIn() {
        this.map.zoomIn();
    }

    zoomOut() {
        this.map.zoomOut();
    }

    resetView() {
        this.getInitialView().then((view) => {
            this.map.flyTo({
                center: [view.lon, view.lat],
                zoom: view.zoom,
                pitch: 60,
                bearing: 0
            });
        });
    }

    displayBuilding(buildingId, levelId) {
        var layers = this.map.getLayersOrder();
        for (let layerId of layers) {
            if (layerId.startsWith(`building-layer-${buildingId}-${levelId}`)) {
                this.map.setLayoutProperty(layerId, 'visibility', 'visible');
            } else if (layerId.startsWith('building-layer-')) {
                this.map.setLayoutProperty(layerId, 'visibility', 'none');
            }
        }
    }

    addBuildingLayer(buildingData, buildingId, levelId) {
        console.log(`[Map] Adding building layer for building ${buildingId} level ${levelId}`);
        this.map.addSource(`building-source-${buildingId}-${levelId}`, {
            type: 'geojson',
            data: buildingData
        });

        this.map.addLayer({
            id: `building-layer-${buildingId}-${levelId}`,
            type: 'fill-extrusion',
            source: `building-source-${buildingId}-${levelId}`,
            paint: {
                'fill-extrusion-color': '#888888',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.6
            }
        });   
    }

    async getGeoJSON(buildingId, level) {
        var data = await (await fetch('/data/base_data.json')).json();
        var buildingData = data.buildings.find(b => b.id === parseInt(buildingId));
        if (!buildingData) {
            console.error(`[App] Building with ID ${buildingId} not found`);
            return;
        }
        var levelData = buildingData.levels.find(l => l.level === appState.get('currentLevel'));
        if (!levelData) {
            console.error(`[App] Level ${appState.get('currentLevel')} not found in building ID ${buildingId}`);
            return;
        }

        var geojson = await (await fetch(levelData.geojson_path)).json();
        return geojson;
    }

    drawRoute(routeGeoJSON) {
        if (this.map.getSource('route-source')) {
            this.map.getSource('route-source').setData(routeGeoJSON);
        } else {
            this.map.addSource('route-source', {
                type: 'geojson',
                data: routeGeoJSON
            });
            this.map.addLayer({
                id: 'route-layer',
                type: 'line',
                source: 'route-source',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#ff0000',
                    'line-width': 4
                }
            });
        }
    }
}   