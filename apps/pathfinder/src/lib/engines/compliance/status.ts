// Compliance status helpers (Epic E11). Pure: staleness of a facility's
// last-reviewed date and a posture summary. No DB.

const MS_PER_DAY = 86_400_000;

/** A facility is stale if its last-reviewed date is older than `maxDays`
 *  (default 365) relative to `asOf`, or if it has never been reviewed
 *  (AC-11.5.1). Dates are ISO strings; both args injected for testability. */
export function isStale(lastReviewed: string | null | undefined, asOf: string, maxDays = 365): boolean {
	if (!lastReviewed) return true;
	const reviewed = Date.parse(lastReviewed);
	const now = Date.parse(asOf);
	if (Number.isNaN(reviewed) || Number.isNaN(now)) return true;
	return (now - reviewed) / MS_PER_DAY > maxDays;
}

/** Days since last review, or null if never reviewed / unparseable. */
export function daysSinceReview(lastReviewed: string | null | undefined, asOf: string): number | null {
	if (!lastReviewed) return null;
	const reviewed = Date.parse(lastReviewed);
	const now = Date.parse(asOf);
	if (Number.isNaN(reviewed) || Number.isNaN(now)) return null;
	return Math.floor((now - reviewed) / MS_PER_DAY);
}

export interface CompliancePosture {
	alyssasLaw: boolean;
	karisLaw: boolean;
	stateMandate: string | null;
}

/** A short human posture line for the trust page / facility header. */
export function postureSummary(p: CompliancePosture): string {
	const flags: string[] = [];
	if (p.alyssasLaw) flags.push("Alyssa's Law");
	if (p.karisLaw) flags.push("Kari's Law");
	if (p.stateMandate) flags.push(p.stateMandate);
	return flags.length ? `Mandates tracked: ${flags.join(', ')}.` : 'No specific mandates flagged.';
}
