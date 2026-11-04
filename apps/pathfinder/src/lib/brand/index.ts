// White-label brand layer entry point (Epic E1).
//
// HOW TO REBRAND:
//   1. Add a profile: src/lib/brand/profiles/<id>.ts exporting a BrandProfile.
//   2. Register it in the `profiles` map below.
//   3. Build / run with VITE_BRAND=<id> (default is 'pathfinder').
//   No component edits required - components consume var(--brand-*) only.

import type { BrandProfile } from './types';
import { pathfinder } from './profiles/pathfinder';
import { radar } from './profiles/radar';
import { els911 } from './profiles/els911';

export type { BrandProfile, BrandColors, BrandFonts } from './types';

export const DEFAULT_BRAND_ID = 'pathfinder';

/** All registered operator brand profiles, keyed by id. */
export const profiles: Record<string, BrandProfile> = {
	pathfinder,
	radar,
	els911
};

/**
 * Resolve a brand profile by id, falling back to the Pathfinder default
 * when the id is unknown or unset.
 */
export function resolveBrand(id: string | undefined | null): BrandProfile {
	if (id && profiles[id]) return profiles[id];
	return profiles[DEFAULT_BRAND_ID];
}

/**
 * Build-time active brand, selected via the VITE_BRAND env var.
 * (Per-hostname runtime resolution is a forward-looking option, FR-5.)
 */
const envBrand =
	typeof import.meta !== 'undefined' && import.meta.env
		? (import.meta.env.VITE_BRAND as string | undefined)
		: undefined;

export const activeBrand: BrandProfile = resolveBrand(envBrand);

/**
 * Render a brand profile's tokens as a CSS custom-property declaration block.
 * Returned string is suitable for inlining into a `style` attribute on :root.
 */
export function brandToCssVars(brand: BrandProfile): string {
	const { colors, fonts } = brand;
	const decls: string[] = [
		`--brand-primary: ${colors.primary}`,
		`--brand-secondary: ${colors.secondary}`,
		`--brand-accent: ${colors.accent}`,
		`--brand-bg: ${colors.bg}`,
		`--brand-surface: ${colors.surface}`,
		`--brand-text: ${colors.text}`,
		`--brand-muted: ${colors.muted}`,
		`--brand-font-display: ${fonts.display}`,
		`--brand-font-body: ${fonts.body}`,
		`--brand-font-mono: ${fonts.mono}`
	];
	return decls.join('; ') + ';';
}
