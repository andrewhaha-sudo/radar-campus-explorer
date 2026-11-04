import type { BrandProfile } from '../types';

// Ready-made operator profile: ELS911 (Emergency Location Services 911).
// Flagship operator deployment. Palette from v1 tokens.css (canonical sec 4):
// primary red, navy, sky, gold; light background.
export const els911: BrandProfile = {
	id: 'els911',
	productName: 'ELS911',
	operatorName: 'Emergency Location Services 911',
	operatorLegalName: 'Emergency Location Services 911, LLC',
	tagline: 'School safety mapping, wayfinding, and emergency location services.',
	colors: {
		primary: '#B22234', // red
		secondary: '#002868', // navy
		accent: '#3B82F6', // sky
		bg: '#f7f9fc',
		surface: '#ffffff',
		text: '#0f1b2d',
		muted: '#5a6b80'
	},
	fonts: {
		display: 'system-ui, "Segoe UI", sans-serif',
		body: 'system-ui, "Segoe UI", sans-serif',
		mono: 'ui-monospace, "JetBrains Mono", monospace'
	},
	supportEmail: 'support@els911.com',
	supportPhone: '+1 (000) 000-0000',
	legalFooter: 'Copyright Emergency Location Services 911, LLC. All rights reserved.',
	domains: ['els911.com']
};
