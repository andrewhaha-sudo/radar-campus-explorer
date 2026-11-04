export class Utils {
    static async checkIfFileExists(url) {
        try {
            var response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    static locationArrayToGeoJSON(coords) {
        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords.map(c => [c[1], c[0]])
                },
                "properties": {}
            }]
        };
    }
}