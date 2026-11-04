// Non-visual map alternative (Epic E12, WCAG 2.1 AA). Pure: turns the visual
// safety map (annotations + map markers) into a structured text description -
// an ordered list of exits, AEDs, stairwells, fire extinguishers and other
// wayfinding features - so a screen-reader user (or a text export) gets an
// equivalent of the map without seeing it. No DOM.

interface AnnotationLike {
	type: string;
	page: number;
	text?: string | null;
}
interface MarkerLike {
	type: string;
	label: string;
	page: number;
}

const SAFETY_NAMES: Record<string, string> = {
	aed: 'AED (defibrillator)',
	exit: 'Exit',
	fireext: 'Fire extinguisher',
	stairs: 'Stairwell',
	door: 'Door',
	overhead: 'Overhead hazard',
	elevator: 'Elevator',
	hallway: 'Hallway',
	room: 'Room'
};

export interface MapTextSection {
	heading: string;
	items: string[];
}

/**
 * Build a structured non-visual description for one page of a floorplan.
 * Groups safety features by type so a responder can hear "3 exits, 2 AEDs,
 * 1 stairwell" rather than parse pixels. Pure + ordered deterministically.
 */
export function buildMapTextAlternative(
	page: number,
	annotations: AnnotationLike[],
	markers: MarkerLike[]
): MapTextSection[] {
	const sections: MapTextSection[] = [];

	// Safety markers from annotations (the 6 symbol tools).
	const safetyTools = ['aed', 'exit', 'fireext', 'stairs', 'door', 'overhead'];
	for (const tool of safetyTools) {
		const count = annotations.filter((a) => a.page === page && a.type === tool).length;
		if (count > 0) {
			sections.push({
				heading: SAFETY_NAMES[tool] ?? tool,
				items: [`${count} ${SAFETY_NAMES[tool] ?? tool} marker${count > 1 ? 's' : ''} on this floor.`]
			});
		}
	}

	// Wayfinding map markers grouped by type with their labels.
	const byType = new Map<string, string[]>();
	for (const m of markers) {
		if (m.page !== page) continue;
		const arr = byType.get(m.type) ?? [];
		arr.push(m.label);
		byType.set(m.type, arr);
	}
	for (const [type, labels] of byType) {
		sections.push({
			heading: SAFETY_NAMES[type] ?? type,
			items: labels.sort().map((l) => `${SAFETY_NAMES[type] ?? type} ${l}`)
		});
	}

	// Reviewer comments as text notes.
	const comments = annotations
		.filter((a) => a.page === page && a.type === 'comment' && a.text)
		.map((a) => a.text as string);
	if (comments.length) sections.push({ heading: 'Notes', items: comments });

	if (sections.length === 0) {
		sections.push({ heading: 'Summary', items: ['No safety features marked on this floor yet.'] });
	}
	return sections;
}

/** Flatten the sections to a single screen-reader string. */
export function mapTextToString(sections: MapTextSection[]): string {
	return sections.map((s) => `${s.heading}: ${s.items.join('; ')}`).join('. ');
}
