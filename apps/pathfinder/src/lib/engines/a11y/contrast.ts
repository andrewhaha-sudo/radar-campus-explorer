// WCAG contrast math (Epic E12, AC-12.4.1). Pure: relative luminance + contrast
// ratio per WCAG 2.1, used to verify brand token pairs meet AA. No DOM.

function channel(c: number): number {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
	const n = parseInt(full, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG contrast ratio between two hex colours (1..21). */
export function contrastRatio(fg: string, bg: string): number {
	const l1 = luminance(hexToRgb(fg));
	const l2 = luminance(hexToRgb(bg));
	const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
	return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text / UI. */
export function meetsAA(fg: string, bg: string, large = false): boolean {
	return contrastRatio(fg, bg) >= (large ? 3 : 4.5);
}
