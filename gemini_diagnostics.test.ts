import { describe, expect, it, vi } from 'vitest';
import { runGeminiDiagnostics } from './src/api/geminiDiagnostics';

const client = (result: unknown) => ({
  functions: { invoke: vi.fn().mockResolvedValue(result) },
});

describe('Gemini test bench diagnostics', () => {
  it('stops at Supabase configuration when no client is available', async () => {
    const invoke = vi.fn();
    const generate = vi.fn();
    const report = await runGeminiDiagnostics({ getClient: () => null, generate: generate as any });

    expect(report.passed).toBe(false);
    expect(report.steps[0].id).toBe('client');
    expect(report.steps[0].repairAction).toBe('network');
    expect(invoke).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('identifies a missing Supabase Gemini secret without attempting generation', async () => {
    const supabase = client({ data: { diagnostic: true, keyConfigured: false, model: 'gemini-flash-latest' }, error: null });
    const generate = vi.fn();
    const report = await runGeminiDiagnostics({ getClient: () => supabase as any, generate: generate as any });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('gemini-gateway', expect.objectContaining({ body: { action: 'diagnostic' } }));
    expect(report.steps.map((step) => step.status)).toEqual(['pass', 'pass', 'fail']);
    expect(report.steps[2].repairAction).toBe('secrets');
    expect(report.steps[2].detail).not.toMatch(/AIza|key value/i);
    expect(generate).not.toHaveBeenCalled();
  });

  it('separates an old or stale gateway deployment from key failures', async () => {
    const supabase = client({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'Invalid contents' }), { status: 400 }) },
    });
    const report = await runGeminiDiagnostics({ getClient: () => supabase as any, generate: vi.fn() as any });

    expect(report.steps.at(-1)?.detail).toContain('does not support the new diagnostic action');
    expect(report.steps.at(-1)?.repairAction).toBe('deploy');
  });

  it('reports a valid Free Tier gateway and live latest Flash request', async () => {
    const supabase = client({ data: { diagnostic: true, keyConfigured: true, model: 'gemini-flash-latest' }, error: null });
    const generate = vi.fn().mockResolvedValue({ text: 'OK', model: 'gemini-flash-latest' });
    const report = await runGeminiDiagnostics({ getClient: () => supabase as any, generate: generate as any });

    expect(report.passed).toBe(true);
    expect(report.steps.map((step) => step.status)).toEqual(['pass', 'pass', 'pass', 'pass']);
    expect(report.steps.at(-1)?.detail).toContain('gemini-flash-latest');
    expect(generate).toHaveBeenCalledOnce();
  });

  it.each([
    ['Gemini returned HTTP 402: Google says the project linked to this key has no usable prepay credits. For Free Tier, use an AI Studio key from a project marked Free Tier. Paid fallback is disabled.', 'quota'],
    ['The project linked to this API key has exceeded its quota.', 'quota'],
    ['Google rejected the API key.', 'key'],
  ])('classifies %s without confusing billing with key rejection', async (message, action) => {
    const supabase = client({ data: { diagnostic: true, keyConfigured: true }, error: null });
    const generate = vi.fn().mockRejectedValue(new Error(message));
    const report = await runGeminiDiagnostics({ getClient: () => supabase as any, generate: generate as any });

    expect(report.steps.at(-1)?.detail).toBe(message);
    expect(report.steps.at(-1)?.repairAction).toBe(action);
    if (action === 'quota') expect(report.steps.at(-1)?.repair).not.toContain('Replace GEMINI_API_KEY');
  });

  it('classifies upstream quota errors as a quota repair, with no paid fallback', async () => {
    const supabase = client({ data: { diagnostic: true, keyConfigured: true }, error: null });
    const generate = vi.fn().mockRejectedValue(new Error('The assistant has reached its Gemini quota.'));
    const report = await runGeminiDiagnostics({ getClient: () => supabase as any, generate: generate as any });

    expect(report.passed).toBe(false);
    expect(report.steps.at(-1)?.repairAction).toBe('quota');
    expect(report.steps.at(-1)?.repair).toContain('no paid fallback');
  });
});
