import { Utils } from './utils.js';

export class UI {
    constructor() {
        this.containers = {
            roleSelection: document.querySelector('#role-select'),
            buildingSelection: document.querySelector('#building-selector'),
            floorSelection: document.querySelector('#floor-selector')
        };
        this.inputs = {
            position: document.querySelector('#locate-btn'),
            zoomIn: document.querySelector('#zoom-in-btn'),
            zoomOut: document.querySelector('#zoom-out-btn'),
            resetView: document.querySelector('#reset-view-btn'),
            searchInput: document.querySelector('#search-box')
        };
        this.updateFunction = null;
    }

    async init(updateFunction = null) {
        this.updateFunction = updateFunction;
        var data = await this.getBaseData();
        this.roles = data.roles;
        this.buildings = data.buildings;
        appState.set('current-role', data.defaultRole);

        for (let role of this.roles) {
            let html = `<option value="${role.id}">${role.emoji} ${role.name}</option>`;
            this.containers.roleSelection.insertAdjacentHTML('beforeend', html);
        }

        for (let building of this.buildings) {
            let html = `<div class="panel-option" data-building-id="${building.id}">${building.name}</div>`;
            this.containers.buildingSelection.insertAdjacentHTML('beforeend', html);
        }
        this.containers.buildingSelection.querySelectorAll(".panel-option").forEach(option => {
            option.addEventListener('click', () => {
                let buildingId = option.getAttribute('data-building-id');
                appState.set('currentBuilding', parseInt(buildingId));
                this.setBuilding(buildingId);
                if (this.updateFunction) {
                    this.updateFunction();
                }
            });
        });

        this.setBuilding(appState.get('currentBuilding'));

        console.log('[UI] UI components initialized');
    }

    async getBaseData() {
        var data = await (await fetch('/data/base_data.json')).json();
        return {
            roles: data.roles,
            buildings: data.buildings,
            defaultRole: data.default_role_id
        }
    }

    updateLevels(buildingId) {
        let building = this.buildings.find(b => b.id === buildingId);
        this.containers.floorSelection.innerHTML = '';

        for (let i = building.levels.length - 1; i >= 0; i--) {
            let level = building.levels[i];
            let html = `<div class="panel-option" data-level="${level.level}">${level.short_name}</div>`;
            this.containers.floorSelection.insertAdjacentHTML('beforeend', html);
        }

        var levelId = building.levels.find(l => l.level === appState.get('currentLevel')) ? appState.get('currentLevel') : building.levels.find(l => l.level >= 0).level;
        this.setLevel(levelId);

        this.containers.floorSelection.querySelectorAll('.panel-option').forEach(option => {
            option.addEventListener('click', () => {
                let levelIndex = option.getAttribute('data-level');
                appState.set('currentLevel', parseInt(levelIndex));
                this.setLevel(levelIndex);
                if (this.updateFunction) {
                    this.updateFunction();
                }
            });
        });
    }

    setBuilding(buildingId) {
        // Update building selection UI
        buildingId = parseInt(buildingId);
        let buildingOptions = this.containers.buildingSelection.querySelectorAll('.panel-option');
        buildingOptions.forEach(option => {
            if (parseInt(option.getAttribute('data-building-id')) === buildingId) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
        this.updateLevels(buildingId);
    }

    setLevel(levelIndex) {
        // Update floor selection UI
        let floorOptions = this.containers.floorSelection.querySelectorAll('.panel-option');
        floorOptions.forEach(option => {
            if (parseInt(option.getAttribute('data-level')) === parseInt(levelIndex)) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }

    addEventListeners(zoomInCallback, zoomOutCallback, resetViewCallback) {
        this.inputs.zoomIn.addEventListener('click', () => {
            zoomInCallback();
        });

        this.inputs.zoomOut.addEventListener('click', () => {
            zoomOutCallback();
        });

        this.inputs.resetView.addEventListener('click', () => {
            resetViewCallback();
        });
    }
}