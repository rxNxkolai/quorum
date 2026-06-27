import type { Judge, JudgeProvider, JudgeResult, Severity } from './types.js';

/** The free, offline, deterministic judge: runs each member's heuristic. */
export const heuristicJudge: Judge = {
  name: 'heuristic',
  async evaluate(member, input) {
    return { member: member.id, ...member.heuristic(input) };
  },
};

function parseJudgeJson(text: string): JudgeResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match)
    return { severity: 'ok', confidence: 0.3, reason: 'judge returned no JSON; defaulting to ok' };
  try {
    const o = JSON.parse(match[0]) as {
      severity?: unknown;
      confidence?: unknown;
      reason?: unknown;
    };
    const severity: Severity =
      o.severity === 'violation' || o.severity === 'concern' ? o.severity : 'ok';
    const confidence =
      typeof o.confidence === 'number' ? Math.max(0, Math.min(1, o.confidence)) : 0.6;
    const reason = typeof o.reason === 'string' ? o.reason : '';
    return { severity, confidence, reason };
  } catch {
    return { severity: 'ok', confidence: 0.3, reason: 'judge JSON parse failed; defaulting to ok' };
  }
}

type LlmCaller = (prompt: string) => Promise<string>;

function llmJudge(name: JudgeProvider, call: LlmCaller): Judge {
  return {
    name,
    async evaluate(member, input) {
      const text = await call(member.prompt(input));
      return { member: member.id, ...parseJudgeJson(text) };
    },
  };
}

function ollamaCaller(model: string): LlmCaller {
  const base = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
  return async (prompt) => {
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    return ((await res.json()) as { response?: string }).response ?? '';
  };
}

function openaiCaller(model: string): LlmCaller {
  return async (prompt) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    return data?.choices?.[0]?.message?.content ?? '';
  };
}

function anthropicCaller(model: string): LlmCaller {
  return async (prompt) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok)
      throw new Error(`Anthropic error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as any;
    return Array.isArray(data?.content) ? data.content.map((c: any) => c?.text ?? '').join('') : '';
  };
}

/** Resolve a judge by provider. Defaults to the free heuristic judge. */
export function getJudge(provider: JudgeProvider = 'heuristic', model?: string): Judge {
  switch (provider) {
    case 'ollama':
      return llmJudge('ollama', ollamaCaller(model ?? 'qwen2.5:7b'));
    case 'openai':
      return llmJudge('openai', openaiCaller(model ?? 'gpt-4o-mini'));
    case 'anthropic':
      return llmJudge('anthropic', anthropicCaller(model ?? 'claude-3-5-haiku'));
    case 'heuristic':
    default:
      return heuristicJudge;
  }
}
