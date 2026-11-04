// NG911 / NENA export (Epic E11). Pure: builds a NENA-aligned GeoJSON
// FeatureCollection for a facility, carrying dispatchable-location attributes
// and - critically - a z-axis floor label per NENA-REQ-003, plus a confidence
// field. No DB, no network: the caller passes the facility, its buildings and
// (optionally) marker positions; this shapes the standards-aligned payload.
//
// Geometry: actual lat/lon geocoding (Mapbox/Google) and RapidSOS push are
// forward integrations (canonical backlog). Where a coordinate is unknown the
// feature still carries the full address + floor attributes with a low
// confidence, so the export is structurally valid and reviewable today.

export interface NenaFacility {
	id: string;
	name: string;
	address: string | null;
	zip: string | null;
	phone: string | null;
	type: string | null;
	state?: string | null;
	country?: string | null;
}

export interface NenaBuilding {
	id: string;
	name: string;
	floors: number;
}

export interface NenaMarker {
	type: string;
	label: string;
	floor?: number | null;
	lon?: number | null;
	lat?: number | null;
}

export interface GeoFeature {
	type: 'Feature';
	geometry: { type: 'Point'; coordinates: [number, number] } | null;
	properties: Record<string, unknown>;
}

export interface FeatureCollection {
	type: 'FeatureCollection';
	metadata: {
		standard: string;
		generated: string;
		facilityId: string;
		note: string;
		missingFields: string[];
		valid: boolean;
	};
	features: GeoFeature[];
}

/** NENA-REQ-003 dispatchable-location floor label: "Floor N" / "Ground floor"
 *  / "Basement". A 0 or negative floor is treated as ground/basement. */
export function floorLabel(floor: number | null | undefined): string {
	if (floor == null) return 'Unspecified floor';
	if (floor <= 0) return floor === 0 ? 'Ground floor' : `Basement ${Math.abs(floor)}`;
	return `Floor ${floor}`;
}

/** Required NENA civic-location fields that must be present for a dispatchable
 *  export (AC-11.1.2). Returns the list of MISSING field names, empty if valid. */
export function requiredFieldsMissing(facility: NenaFacility): string[] {
	const missing: string[] = [];
	if (!facility.address || !facility.address.trim()) missing.push('address');
	if (!facility.zip || !facility.zip.trim()) missing.push('zip');
	if (!facility.state || !facility.state.trim()) missing.push('state');
	return missing;
}

/** Confidence in [0,1]: full when a coordinate is present, low when only the
 *  civic address is known (geocoding pending). */
export function locationConfidence(hasCoord: boolean, hasAddress: boolean): number {
	if (hasCoord) return 0.95;
	if (hasAddress) return 0.4;
	return 0.1;
}

/**
 * Build a NENA-STA-006-aligned FeatureCollection. Emits one feature per
 * building (one per floor) and one per located marker, each with the civic
 * address, z-axis floor label and a confidence value.
 */
export function buildNenaFeatureCollection(
	facility: NenaFacility,
	buildings: NenaBuilding[],
	markers: NenaMarker[],
	generatedAt: string
): FeatureCollection {
	const baseProps = {
		country: facility.country ?? 'US',
		stateA1: facility.state ?? null,
		addressFull: facility.address ?? null,
		postalCode: facility.zip ?? null,
		phone: facility.phone ?? null,
		placeType: facility.type ?? 'other'
	};
	const hasAddress = !!facility.address;

	const features: GeoFeature[] = [];
	for (const b of buildings) {
		for (let f = 1; f <= Math.max(1, b.floors); f++) {
			features.push({
				type: 'Feature',
				geometry: null,
				properties: {
					...baseProps,
					featureClass: 'StructureFloor',
					buildingId: b.id,
					buildingName: b.name,
					floor: f,
					floorLabel: floorLabel(f),
					confidence: locationConfidence(false, hasAddress)
				}
			});
		}
	}
	for (const m of markers) {
		const hasCoord = typeof m.lon === 'number' && typeof m.lat === 'number';
		features.push({
			type: 'Feature',
			geometry: hasCoord ? { type: 'Point', coordinates: [m.lon as number, m.lat as number] } : null,
			properties: {
				...baseProps,
				featureClass: 'SafetyMarker',
				markerType: m.type,
				label: m.label,
				floor: m.floor ?? null,
				floorLabel: floorLabel(m.floor),
				confidence: locationConfidence(hasCoord, hasAddress)
			}
		});
	}

	const missingFields = requiredFieldsMissing(facility);
	return {
		type: 'FeatureCollection',
		metadata: {
			standard: 'NENA-STA-006 (aligned)',
			generated: generatedAt,
			facilityId: facility.id,
			note: 'Geometry pending geocoding/RapidSOS integration; attributes are authoritative.',
			missingFields,
			valid: missingFields.length === 0
		},
		features
	};
}
