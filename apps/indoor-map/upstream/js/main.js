import { Utils } from "./utils";
import { UI } from "./ui";
import { MapView } from "./map";
import { RoutingEngine, ValhallaClient } from "./routing";

const utils = new Utils();

class States {
    constructor() {
        console.log('[State] Initializing application state manager');
        this.state = new Map();  // Now uses native Map
    }

    set(key, value) {
        this.state.set(key, value);
    }

    get(key) {
        return this.state.get(key);
    }
}

const appState = new States();
window.appState = appState;  // Make accessible globally for other modules

class Main {
    constructor() {
        this.ui = new UI();
        this.map = new MapView();
        this.routingEngine = new RoutingEngine();

        this.initialized = false;
    }

    async init() {
        console.log('[App] Initializing Leipzig School Digital Twin...');
        
        try {
            // Initialize map first
            this.map = await this.map.init(this.update);
            console.log('[App] Map initialized');
            
            // Initialize Valhalla client for outdoor routing
            this.valhallaClient = new ValhallaClient({
                endpoint: 'http://localhost:8002',
                timeout: 30000
            });
            
            // Check Valhalla availability
            this.valhallaAvailable = await this.valhallaClient.isAvailable();
            console.log(`[App] Valhalla routing: ${this.valhallaAvailable ? 'available' : 'unavailable'}`);
            
            // Initialize route manager
            this.routingEngine.init({
                map: this.map,
                valhallaClient: this.valhallaAvailable ? this.valhallaClient : null
            });
            console.log('[App] Routing engine initialized');
            
            // Set initial state
            appState.set('currentBuilding', 1);
            appState.set('currentLevel', 0);
            
            // Initialize UI components
            this.ui.init(this.update);
            this.ui.addEventListeners(this.map.zoomIn, this.map.zoomOut, this.map.resetView);
            
            this.initialized = true;
            console.log('[App] Initialization complete');

            this.displayBuilding(appState.get('currentBuilding'));
            
        } catch (error) {
            console.error('[App] Initialization failed:', error);
        }
    }

    async update() {
        if (!this.initialized) {
            console.warn('[App] Cannot update before initialization');
            return;
        }
        this.map.displayBuilding(
            appState.get('currentBuilding'),
            appState.get('currentLevel')
        );
    }

    async displayBuilding(buildingId, levelId = null) {
        if (!this.initialized) {
            console.warn('[App] Cannot display building before initialization');
            return;
        }
    }
}

const app = new Main();
document.addEventListener('DOMContentLoaded', async () => {
    await app.init();
    var geoJSON = Utils.locationArrayToGeoJSON((await app.routingEngine.valhallaClient.getRoute()).decodedShape)
    app.map.drawRoute(geoJSON);
});
window.app = app;  // Make accessible globally for debugging