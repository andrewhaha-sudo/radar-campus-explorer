// AI responder-briefing prompt builder (Pro feature). Pure + provider-agnostic:
// turns the building's marked safety features (the same structured sections the
// E12 non-visual alternative produces) into a grounded chat prompt. Grounding +
// explicit guardrails keep the model to describing ONLY what is marked - it must
// not invent features or give safety advice. No DOM, no network.

import type { MapTextSection } from '../a11y/map-text';

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

const SYSTEM = [
	'You are a briefing assistant for emergency responders reading a building safety map.',
	'Write a single concise paragraph (60-110 words) summarising ONLY the marked features listed below.',
	'Rules:',
	'- Describe only features that appear in the data. Never invent exits, AEDs, hazards, or counts.',
	'- Do not give safety procedures, tactical advice, or recommendations - only state what is mapped.',
	'- Lead with egress (exits, stairwells), then life-safety (AED, fire extinguisher), then notes.',
	'- If a category is absent from the data, do not mention it.',
	'- Plain, calm, factual tone. No markdown, no headings, no preamble.'
].join('\n');

/** Serialize the structured sections into a compact, grounded user message. */
function sectionsToText(sections: MapTextSection[]): string {
	return sections.map((s) => `${s.heading}: ${s.items.join('; ')}`).join('\n');
}

/**
 * Build the chat messages for a floor briefing. `facilityName`/`floorLabel`
 * frame it; `sections` are the marked features (from buildMapTextAlternative).
 */
export function buildBriefingPrompt(
	facilityName: string,
	floorLabel: string,
	sections: MapTextSection[]
): ChatMessage[] {
	const body = sectionsToText(sections);
	return [
		{ role: 'system', content: SYSTEM },
		{
			role: 'user',
			content: `Facility: ${facilityName}\nFloor: ${floorLabel}\n\nMarked features:\n${body}\n\nWrite the responder briefing for this floor.`
		}
	];
}

/** Cheap, deterministic fallback briefing built purely from the data - used by
 *  the 'mock' provider (tests/local) and when no model is configured, so the
 *  feature degrades to something truthful rather than nothing. */
export function fallbackBriefing(facilityName: string, floorLabel: string, sections: MapTextSection[]): string {
	const parts = sections
		.filter((s) => s.heading !== 'Summary')
		.map((s) => `${s.heading.toLowerCase()} (${s.items.length})`);
	if (parts.length === 0) return `${facilityName}, ${floorLabel}: no safety features are marked on this floor yet.`;
	return `${facilityName}, ${floorLabel}: mapped features include ${parts.join(', ')}. See the marker list for exact labels and locations.`;
}
