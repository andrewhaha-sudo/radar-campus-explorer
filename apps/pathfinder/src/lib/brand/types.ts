// White-label brand layer (Epic E1).
//
// A BrandProfile is the single source of truth for one operator deployment.
// Tokens flow to CSS custom properties at load; components reference
// var(--brand-*) only, never literal brand colors.
//
// To rebrand: add a new profile under ./profiles/<id>.ts and set VITE_BRAND=<id>.

export interface BrandColors {
	/** Primary brand color (--brand-primary). */
	primary: string;
	/** Secondary brand color (--brand-secondary). */
	secondary: string;
	/** Accent / highlight color (--brand-accent). */
	accent: string;
	/** Page background (--brand-bg). */
	bg: string;
	/** Raised surface / card background (--brand-surface). */
	surface: string;
	/** Primary text color (--brand-text). */
	text: string;
	/** Muted / secondary text color (--brand-muted). */
	muted: string;
}

export interface BrandFonts {
	/** Display / heading typeface (--brand-font-display). */
	display: string;
	/** Body typeface (--brand-font-body). */
	body: string;
	/** Monospace typeface (--brand-font-mono). */
	mono: string;
}

export interface BrandProfile {
	/** Stable id, matches the filename under ./profiles and brand/<id>/. */
	id: string;
	/** Product name shown in the UI (e.g. "Pathfinder"). */
	productName: string;
	/** Operating company common name. */
	operatorName: string;
	/** Operating company legal name (footer / contracts). */
	operatorLegalName: string;
	/** Short marketing tagline. */
	tagline: string;
	colors: BrandColors;
	fonts: BrandFonts;
	/** Support contact email. */
	supportEmail: string;
	/** Support contact phone. */
	supportPhone: string;
	/** Legal footer line (copyright / rights). */
	legalFooter: string;
	/** Hostnames mapped to this brand (forward-looking runtime resolution). */
	domains: string[];
}
