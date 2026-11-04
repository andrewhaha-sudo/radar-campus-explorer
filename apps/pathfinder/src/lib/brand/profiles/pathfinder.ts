import type { BrandProfile } from '../types';

// Default brand: Pathfinder LiDAR Solutions (canonical sec 4).
// Dark slate, point-cloud-inspired ice/sky accents, squared corners,
// restrained glow. NOT green. Clash Display + Satoshi + JetBrains Mono.
export const pathfinder: BrandProfile = {
	id: 'pathfinder',
	productName: 'Pathfinder',
	operatorName: 'Pathfinder LiDAR Solutions',
	operatorLegalName: 'Pathfinder LiDAR Solutions, Inc.',
	tagline: 'Emergency floorplan mapping and 3D facility documentation.',
	colors: {
		primary: '#6fa8d4', // sky
		secondary: '#3f6e98', // steel-blue
		accent: '#c4e2f5', // ice
		bg: '#0a131e', // dark slate
		surface: '#0f1c2b',
		text: '#eaf1f9',
		muted: '#8aa1b6'
	},
	fonts: {
		// Self-hosted via @fontsource (loaded in +layout.svelte), CSP-safe.
		// Bricolage Grotesque = characterful editorial-technical display;
		// Hanken Grotesk = clean precise body; JetBrains Mono = console/data.
		display: '"Bricolage Grotesque Variable", "Clash Display", system-ui, sans-serif',
		body: '"Hanken Grotesk Variable", "Satoshi", system-ui, sans-serif',
		mono: '"JetBrains Mono Variable", ui-monospace, monospace'
	},
	supportEmail: 'support@pathfinderlidar.com',
	supportPhone: '+1 (000) 000-0000',
	legalFooter: 'Copyright Pathfinder LiDAR Solutions, Inc. All rights reserved.',
	domains: ['pathfinder.pages.dev']
};
