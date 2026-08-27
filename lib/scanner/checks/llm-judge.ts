// Stage 5: model-assisted detection (SECUREVIBE.md 5.5) — OPTIONAL and off
// by default. The scanner stays fully deterministic unless the operator
// sets an API key, because "your code is never sent to an AI" is a promise
// this product makes and keeps.
//
// When enabled, the model is a DETECTOR, never a judge:
//   - one named signal per call, with a definition and a negative example
//   - a ternary verdict (yes / no / cannot tell), never a score or a grade
//   - a citation is required, and a verdict whose citation does not appear
//     in the material we sent is dropped on the floor
//   - findings are capped at confidence 'likely' — a model opinion can
//     never cap a grade, only facts can
//
// What gets sent: short VISIBLE-TEXT excerpts from the marketing page
// (headlines, feature blurbs). Never source code, never file contents.
//
// The default endpoint shape is the OpenAI-compatible chat completions
// API, which the free tiers of several providers speak (Groq is the
// recommended free option — its free tier does not train on API data).
// Any compatible base URL works, including a local model.

import type { Finding } from '../types';

export interface LlmJudgeOptions {
  apiKey: string;
  /** OpenAI-compatible API root. Defaults to Groq's free endpoint. */
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/**
 * Signal F-voice: is the visible marketing copy specific to this product,
 * or is it the statistical average of all marketing copy? Binary verdict
 * with a mandatory citation. Never asks for a rating.
 */
const COPY_SIGNAL_PROMPT = `You are a detector for ONE named signal in marketing copy. Do not evaluate quality and do not give any score or rating.

Signal definition: "generic voice" means no line in the copy says anything only this specific product could say. Generic copy is interchangeable: swap in a different product name and every sentence still works.

Negative example (do NOT fire on this): "Scans your Supabase row-level security from the live URL and shows you the exact row an anonymous visitor can read." This is specific — it names a concrete capability with a concrete outcome.

Positive example (DO fire on this): "Supercharge your workflow with our all-in-one platform. Built for teams that move fast." This works for any product.

You will receive numbered lines of visible text from one page. Answer with JSON only, exactly this shape:
{"verdict": "generic" | "specific" | "cannot_tell", "citation": "<one line copied VERBATIM from the input that best supports your verdict>"}

Rules: the citation must be copied character-for-character from one input line. If fewer than 5 lines are marketing copy, answer "cannot_tell".`;

export interface LlmJudgeResult {
  findings: Finding[];
  notes: string[];
}

export async function judgeCopyVoice(
  samples: string[],
  opts: LlmJudgeOptions,
): Promise<LlmJudgeResult> {
  const notes: string[] = [];
  if (samples.length < 8) return { findings: [], notes };

  const lines = samples.slice(0, 30);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  try {
    const res = await fetchImpl(`${opts.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: COPY_SIGNAL_PROMPT },
          {
            role: 'user',
            content: lines.map((s, i) => `${i + 1}. ${s}`).join('\n'),
          },
        ],
      }),
    });
    if (!res.ok) {
      notes.push(`Model-assisted copy check skipped (provider returned ${res.status}).`);
      return { findings: [], notes };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as { verdict?: string; citation?: string };

    // No citation, no finding — and the citation must actually exist in
    // what we sent, or the verdict is discarded as hallucinated.
    const citation = (parsed.citation ?? '').trim();
    const cited = lines.find((l) => l.includes(citation) || citation.includes(l));
    if (parsed.verdict === 'generic' && citation && cited) {
      notes.push(
        `1 model-assisted check ran (copy voice): ${lines.length} short text ` +
          'excerpts were sent to the configured model. No source code was sent.',
      );
      return {
        notes,
        findings: [
          {
            checkType: 'design',
            severity: 'low',
            confidence: 'likely',
            ruleId: 'copy-generic-voice',
            title: 'Page copy reads as the average of all copy',
            explanation:
              'A model-assisted check found no line on this page that only ' +
              'this product could say. Generic wording is the statistical ' +
              'average of all marketing text, and visitors discount it ' +
              'before reading the second sentence. Specific claims with ' +
              'concrete outcomes read as true.',
            evidenceMasked: cited.slice(0, 160),
            recommendation:
              'Rewrite the headline and first feature blurb around the one ' +
              'concrete thing this product does that others do not. Name the ' +
              'input, the output, and who it is for.',
          },
        ],
      };
    }
    notes.push(
      `1 model-assisted check ran (copy voice): ${lines.length} short text ` +
        'excerpts were sent to the configured model. No source code was sent.',
    );
    return { findings: [], notes };
  } catch {
    notes.push('Model-assisted copy check skipped (provider unreachable).');
    return { findings: [], notes };
  } finally {
    clearTimeout(timer);
  }
}
