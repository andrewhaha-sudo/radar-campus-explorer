// AI provider adapter (Pro feature). Model-independent: a single code path that
// resolves to Cloudflare Workers AI (keyless, on-platform), an OpenAI-compatible
// endpoint (Mistral / OpenAI / Groq / Together / Ollama - just a base URL + key
// + model), or a deterministic 'mock' for tests/local. Non-secret config
// (provider/base URL/model) lives in the `settings` table (admin-editable); the
// API key is a Cloudflare secret (LLM_API_KEY) - never stored in D1.

import { buildBriefingPrompt, fallbackBriefing, type ChatMessage } from '$lib/engines/ai/prompt';
import type { MapTextSection } from '$lib/engines/a11y/map-text';

type Env = {
	DB: D1Database;
	AI?: { run: (model: string, input: unknown) => Promise<{ response?: string } | unknown> };
	LLM_API_KEY?: string;
};

export type Provider = 'mock' | 'workers-ai' | 'openai';

interface Resolved {
	provider: Provider;
	baseUrl: string;
	model: string;
}

const DEFAULT_WORKERS_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const DEFAULT_OPENAI_MODEL = 'mistral-small-latest';

async function setting(env: Env, key: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
	return row?.value ?? null;
}

/**
 * Resolve the active provider from settings + bindings, or null if nothing is
 * configured. Precedence: an explicit `llm.provider` setting wins; otherwise a
 * Workers AI binding is used keyless; otherwise an OpenAI-compatible endpoint if
 * a key + base URL are present.
 */
export async function resolveProvider(env: Env): Promise<Resolved | null> {
	const override = (await setting(env, 'llm.provider')) as Provider | null;
	const baseUrl = (await setting(env, 'llm.base_url')) ?? '';
	const model = (await setting(env, 'llm.model')) ?? '';

	if (override === 'mock') return { provider: 'mock', baseUrl, model };
	if (override === 'workers-ai' || (!override && env.AI)) {
		return { provider: 'workers-ai', baseUrl, model: model || DEFAULT_WORKERS_MODEL };
	}
	if (override === 'openai' || (!override && env.LLM_API_KEY && baseUrl)) {
		if (!env.LLM_API_KEY || !baseUrl) return null; // misconfigured external provider
		return { provider: 'openai', baseUrl, model: model || DEFAULT_OPENAI_MODEL };
	}
	return null;
}

export async function aiConfigured(env: Env): Promise<boolean> {
	return (await resolveProvider(env)) !== null;
}

/** Generate a responder briefing for a floor. Throws if not configured. */
export async function generateBriefing(
	env: Env,
	facilityName: string,
	floorLabel: string,
	sections: MapTextSection[]
): Promise<string> {
	const resolved = await resolveProvider(env);
	if (!resolved) throw new Error('No AI provider configured.');
	const messages = buildBriefingPrompt(facilityName, floorLabel, sections);
	const fallback = () => fallbackBriefing(facilityName, floorLabel, sections);

	// A provider error (entitlement, network, model) must never 500 the request:
	// degrade to the truthful, data-derived fallback briefing.
	try {
		if (resolved.provider === 'mock') return fallback();
		if (resolved.provider === 'workers-ai') {
			const r = (await env.AI!.run(resolved.model, { messages, max_tokens: 220 })) as { response?: string };
			return (r?.response ?? '').trim() || fallback();
		}
		return await openAiChat(resolved.baseUrl, env.LLM_API_KEY as string, resolved.model, messages, fallback);
	} catch {
		return fallback();
	}
}

async function openAiChat(
	baseUrl: string,
	apiKey: string,
	model: string,
	messages: ChatMessage[],
	onFail: () => string
): Promise<string> {
	const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
		method: 'POST',
		headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
		body: JSON.stringify({ model, messages, max_tokens: 220, temperature: 0.3 })
	});
	if (!res.ok) return onFail();
	const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
	return (data.choices?.[0]?.message?.content ?? '').trim() || onFail();
}
