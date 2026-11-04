import { Utils } from './utils.js';

export class RoutingEngine {
    constructor() {
        this.map = null;
        this.valhallaClient = null;
    }

    init(options) {
        this.map = options.map;
        this.valhallaClient = options.valhallaClient;
    }

}

export class ValhallaClient {
    constructor(options) {
        this.endpoint = options.endpoint;
        this.timeout = options.timeout || 10000;
    }

    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(`${this.endpoint}/status`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async getRoute(start, end) {
        const url = new URL(`${this.endpoint}/route`);
        url.searchParams.append('json', JSON.stringify({
            "locations":[
                {"lat":51.33059990630696,"lon":12.377065669761578},
                {"lat":51.33069375735544,"lon":12.37736339496223}
            ],
            "costing":"pedestrian",
            "shape_format": "geojson"
        }));

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error('Failed to fetch route from Valhalla');
        }
        var data = (await response.json());
        var decodedShape = this.decodePolyline(data.trip.legs[0].shape, 6);
        return {data, decodedShape};
    }

    decodePolyline(str, precision) {
        var index = 0,
            lat = 0,
            lng = 0,
            coordinates = [],
            shift = 0,
            result = 0,
            byte = null,
            latitude_change,
            longitude_change,
            factor = Math.pow(10, precision || 6);

        // Coordinates have variable length when encoded, so just keep
        // track of whether we've hit the end of the string. In each
        // loop iteration, a single coordinate is decoded.
        while (index < str.length) {

            // Reset shift, result, and byte
            byte = null;
            shift = 0;
            result = 0;

            do {
                byte = str.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);

            latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

            shift = result = 0;

            do {
                byte = str.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);

            longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

            lat += latitude_change;
            lng += longitude_change;

            coordinates.push([lat / factor, lng / factor]);
        }

        return coordinates;
    }
}