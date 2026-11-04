// Unit tests for the AI briefing prompt builder + provider selection (Pro
// feature). The prompt is grounded + guard-railed; provider resolution is
// model-independent (mock / Workers AI / OpenAI-compatible).

import { describe, it, expect, vi } from 'vitest';
import { buildBriefingPrompt, fallbackBriefing } from '../../src/lib/engines/ai/prompt';
import type { MapTextSection } from '../../src/lib/engines/a11y/map-text';

const sections: MapTextSection[] = [
	{ heading: 'Exit', items: ['2 Exit markers on this floor.'] },
	{ heading: 'AED (defibrillator)', items: ['1 AED (defibrillator) marker on this floor.'] },
	{ heading: 'Stairwell', items: ['Stairwell S1'] }
];

describe('briefing prompt', () => {
	it('is grounded and guard-railed', () => {
		const msgs = buildBriefingPrompt('WAHS', 'Floor 1', sections);
		expect(msgs[0].role).toBe('system');
		// guardrails against hallucination + advice
		expect(msgs[0].content).toMatch(/never invent/i);
		expect(msgs[0].content).toMatch(/not give safety procedures|recommendations/i);
		// the user message carries the facility, floor, and the marked features
		const user = msgs[1].content;
		expect(user).toContain('WAHS');
		expect(user).toContain('Floor 1');
		expect(user).toContain('Stairwell S1');
	});

	it('fallback briefing is truthful and data-derived', () => {
		const fb = fallbackBriefing('WAHS', 'Floor 1', sections);
		expect(fb).toContain('WAHS');
		expect(fb).toMatch(/exit|aed|stairwell/i);
		// empty floor -> honest "nothing marked"
		expect(fallbackBriefing('WAHS', 'Floor 9', [{ heading: 'Summary', items: ['No safety features marked on this floor yet.'] }])).toMatch(/no safety features/i);
	});
});

describe('provider adapter (model-independent)', () => {
	it('mock provider returns the data-derived fallback (no key, deterministic)', async () => {
		const { generateBriefing, aiConfigured } = await import('../../src/lib/server/ai');
		const env = makeEnv({ 'llm.provider': 'mock' });
		expect(await aiConfigured(env)).toBe(true);
		const out = await generateBriefing(env, 'WAHS', 'Floor 1', sections);
		expect(out).toContain('WAHS');
	});

	it('Workers AI is used (keyless) when an AI binding is present and no provider override', async () => {
		const { generateBriefing } = await import('../../src/lib/server/ai');
		const run = vi.fn(async () => ({ response: 'A calm grounded briefing.' }));
		const env = makeEnv({}, { AI: { run } });
		const out = await generateBriefing(env, 'WAHS', 'Floor 1', sections);
		expect(run).toHaveBeenCalledOnce();
		expect(out).toBe('A calm grounded briefing.');
	});

	it('OpenAI-compatible adapter calls the configured base URL + model with the key', async () => {
		const { generateBriefing } = await import('../../src/lib/server/ai');
		const fetchMock = vi.fn(async (_url: string, _init: { headers: Record<string, string>; body: string }) =>
			new Response(JSON.stringify({ choices: [{ message: { content: 'External briefing.' } }] }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);
		const env = makeEnv(
			{ 'llm.provider': 'openai', 'llm.base_url': 'https://api.mistral.ai/v1', 'llm.model': 'mistral-small-latest' },
			{ LLM_API_KEY: 'sk-test' }
		);
		const out = await generateBriefing(env, 'WAHS', 'Floor 1', sections);
		expect(out).toBe('External briefing.');
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('https://api.mistral.ai/v1/chat/completions');
		expect(init.headers).toMatchObject({ authorization: 'Bearer sk-test' });
		expect(JSON.parse(init.body).model).toBe('mistral-small-latest');
		vi.unstubAllGlobals();
	});

	it('degrades to the data-derived fallback when the provider throws (never 500)', async () => {
		const { generateBriefing } = await import('../../src/lib/server/ai');
		const env = makeEnv({}, { AI: { run: async () => { throw new Error('entitlement'); } } });
		const out = await generateBriefing(env, 'WAHS', 'Floor 1', sections);
		expect(out).toContain('WAHS'); // fallback, not an exception
	});

	it('reports not-configured when there is no provider, key, or AI binding', async () => {
		const { aiConfigured } = await import('../../src/lib/server/ai');
		expect(await aiConfigured(makeEnv({}))).toBe(false);
	});
});

// In-memory fake env: settings table backed by a Map, plus optional bindings.
function makeEnv(settings: Record<string, string>, extra: Record<string, unknown> = {}) {
	const DB = {
		prepare(sql: string) {
			return {
				bind(key: string) {
					return {
						first: async () => (sql.includes('FROM settings') && key in settings ? { value: settings[key] } : null)
					};
				}
			};
		}
	};
	return { DB, ...extra } as never;
}
