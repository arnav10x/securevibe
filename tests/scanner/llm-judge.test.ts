// The model-assisted copy check (SECUREVIBE.md 5.5), tested fully offline
// with a mocked provider. The contract under test: the model is a detector
// with a ternary verdict, a finding requires a REAL citation (a fabricated
// one is discarded), findings cap at confidence 'likely', and provider
// failures degrade to a note instead of an error.

import { describe, expect, it } from 'vitest';
import { judgeCopyVoice } from '@/lib/scanner/checks/llm-judge';

const SAMPLES = [
  'Supercharge your workflow today',
  'Built for teams that move fast',
  'The all-in-one platform for modern teams',
  'Everything you need in one place',
  'Get started in seconds',
  'Trusted by thousands of developers',
  'Simple, powerful, flexible',
  'Your work, organized beautifully',
  'One tool for every job',
  'Do more with less effort',
];

function providerReturning(content: string): typeof fetch {
  return async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

describe('judgeCopyVoice', () => {
  it('files a likely finding when the verdict is generic with a real citation', async () => {
    const res = await judgeCopyVoice(SAMPLES, {
      apiKey: 'k',
      fetchImpl: providerReturning(
        JSON.stringify({ verdict: 'generic', citation: 'Supercharge your workflow today' }),
      ),
    });
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0].confidence).toBe('likely'); // a model opinion never caps a grade
    expect(res.findings[0].evidenceMasked).toContain('Supercharge');
    expect(res.notes[0]).toContain('No source code was sent');
  });

  it('discards a verdict whose citation is not in the material sent', async () => {
    const res = await judgeCopyVoice(SAMPLES, {
      apiKey: 'k',
      fetchImpl: providerReturning(
        JSON.stringify({ verdict: 'generic', citation: 'A line the model invented' }),
      ),
    });
    expect(res.findings).toHaveLength(0);
  });

  it('files nothing on a specific verdict', async () => {
    const res = await judgeCopyVoice(SAMPLES, {
      apiKey: 'k',
      fetchImpl: providerReturning(
        JSON.stringify({ verdict: 'specific', citation: SAMPLES[0] }),
      ),
    });
    expect(res.findings).toHaveLength(0);
  });

  it('skips quietly when the provider errors', async () => {
    const res = await judgeCopyVoice(SAMPLES, {
      apiKey: 'k',
      fetchImpl: async () => new Response('rate limited', { status: 429 }),
    });
    expect(res.findings).toHaveLength(0);
    expect(res.notes[0]).toContain('skipped');
  });

  it('does not run at all on too little copy', async () => {
    let called = false;
    const res = await judgeCopyVoice(['one line'], {
      apiKey: 'k',
      fetchImpl: async () => {
        called = true;
        return new Response('{}', { status: 200 });
      },
    });
    expect(called).toBe(false);
    expect(res.findings).toHaveLength(0);
  });
});
