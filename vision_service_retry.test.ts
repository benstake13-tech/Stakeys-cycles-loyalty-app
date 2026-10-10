import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Exercises the vision service's bounded retry loop with a mocked SDK, so the
 * "fails fast, retries transient errors, throws a structured VisionError"
 * contract is verified without hitting the network.
 */
const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent } };
  }),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN', ARRAY: 'ARRAY' },
}));

vi.mock('./src/api/geminiModel', () => ({ resolveGeminiModel: () => 'gemini-flash-latest' }));

const OVERLOAD = new Error(
  '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'
);

beforeEach(() => {
  generateContent.mockReset();
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('identifyBikeFromImage', () => {
  it('returns parsed JSON on success and disables the SDK default retry', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"make":"Trek","summary":"ok"}' });
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    const result = await identifyBikeFromImage('data:image/png;base64,AAAA');
    expect(result).toEqual({ make: 'Trek', summary: 'ok' });
    expect(generateContent).toHaveBeenCalledTimes(1);
    const cfg = generateContent.mock.calls[0][0].config;
    expect(cfg.httpOptions.retryOptions.attempts).toBe(1);
    expect(cfg.httpOptions.timeout).toBeGreaterThan(0);
    expect(cfg.abortSignal).toBeTruthy();
  });

  it('retries a 503 then succeeds', async () => {
    generateContent
      .mockRejectedValueOnce(OVERLOAD)
      .mockResolvedValueOnce({ text: '{"make":"Giant","summary":"ok"}' });
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    const result = await identifyBikeFromImage('AAAA');
    expect(result.make).toBe('Giant');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('stops after 3 attempts and throws a structured MODEL_OVERLOADED error', async () => {
    generateContent.mockRejectedValue(OVERLOAD);
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    const { VisionError } = await import('./src/api/visionErrors');
    let caught: any;
    try {
      await identifyBikeFromImage('AAAA');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(VisionError);
    expect(caught.kind).toBe('MODEL_OVERLOADED');
    expect(caught.retryable).toBe(true);
    expect(caught.message).toMatch(/temporarily busy/i);
    expect(caught.message).not.toContain('UNAVAILABLE'); // raw JSON never leaks
    expect(generateContent).toHaveBeenCalledTimes(3); // original + 2 retries
  });

  it('does not retry a non-transient error', async () => {
    generateContent.mockRejectedValue(new Error('AI vision is not configured.'));
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    let caught: any;
    try {
      await identifyBikeFromImage('AAAA');
    } catch (e) {
      caught = e;
    }
    expect(caught.kind).toBe('NOT_CONFIGURED');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung request and reports a TIMEOUT', async () => {
    vi.useFakeTimers();
    generateContent.mockImplementation(
      ({ config }) =>
        new Promise((_resolve, reject) => {
          config.abortSignal.addEventListener('abort', () =>
            reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }))
          );
        })
    );
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    const promise = identifyBikeFromImage('AAAA');
    const assertion = expect(promise).rejects.toMatchObject({ kind: 'TIMEOUT' });
    await vi.runAllTimersAsync();
    await assertion;
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('sends every supplied photo (full + brand + model) in one request', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"make":"Trek","model":"FX 1"}' });
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    const result = await identifyBikeFromImage([
      { data: 'FULLDATA', mimeType: 'image/jpeg' },
      { data: 'BRANDDATA', mimeType: 'image/png' },
      { data: 'MODELDATA', mimeType: 'image/png' },
    ]);
    expect(result).toEqual({ make: 'Trek', model: 'FX 1' });
    expect(generateContent).toHaveBeenCalledTimes(1);
    const parts = generateContent.mock.calls[0][0].contents[0].parts;
    // three images + the single text prompt
    expect(parts).toHaveLength(4);
    expect(parts.slice(0, 3).map((p: any) => p.inlineData.data)).toEqual(['FULLDATA', 'BRANDDATA', 'MODELDATA']);
    expect(parts[1].inlineData.mimeType).toBe('image/png');
    expect(parts[3].text).toMatch(/valve type/i);
  });

  it('still accepts a single legacy data-URL string', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"make":"Giant"}' });
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    await identifyBikeFromImage('data:image/png;base64,LEGACY');
    const parts = generateContent.mock.calls[0][0].contents[0].parts;
    expect(parts[0].inlineData.data).toBe('LEGACY');
    expect(parts[0].inlineData.mimeType).toBe('image/jpeg');
  });

  it('exposes the exhaustive taxonomy fields in the response schema + prompt', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"make":"Trek"}' });
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    await identifyBikeFromImage('AAAA');
    const schema = generateContent.mock.calls[0][0].config.responseSchema;
    const itemProps = schema.properties.mainSpecs.items.properties;
    for (const field of ['systemId', 'componentId', 'specValue', 'visibility', 'confidence']) {
      expect(itemProps[field]).toBeTruthy();
    }
    expect(schema.properties.notVisible.type).toBe('ARRAY');
    expect(schema.properties.coverage.type).toBe('NUMBER');
    expect(schema.properties.mainSpecs.items.required).toContain('systemId');
    // The prompt instructs a full part-by-part sweep.
    const promptText = generateContent.mock.calls[0][0].contents[0].parts.at(-1).text;
    expect(promptText).toMatch(/EXHAUSTIVE PART SWEEP/i);
    expect(promptText).toMatch(/Wheels & Tyres/);
  });

  it('appends the customer notes to the prompt when supplied', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"make":"Trek"}' });
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    await identifyBikeFromImage('AAAA', 'image/jpeg', 'el freno chirría');
    const promptText = generateContent.mock.calls[0][0].contents[0].parts.at(-1).text;
    expect(promptText).toMatch(/CUSTOMER NOTES/);
    expect(promptText).toContain('el freno chirría');
  });

  it('exposes the diagnostic intake fields in the response schema', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"make":"Trek"}' });
    const { identifyBikeFromImage } = await import('./src/api/visionService');
    await identifyBikeFromImage('AAAA');
    const props = generateContent.mock.calls[0][0].config.responseSchema.properties;
    for (const field of ['inputLanguageDetected', 'userNotesTranslated', 'hasVisualData', 'overallCondition', 'wheelSizeAndSpecs', 'faults']) {
      expect(props[field]).toBeTruthy();
    }
    const faultProps = props.faults.items.properties;
    for (const field of ['component', 'faultTitle', 'description', 'severity', 'source']) {
      expect(faultProps[field]).toBeTruthy();
    }
  });
});

describe('getFallbackDiagnostic', () => {
  it('builds a valid diagnostic from the notes when the service is down', async () => {
    const { getFallbackDiagnostic } = await import('./src/api/visionService');
    const d = getFallbackDiagnostic('Rear brake squeals when wet');
    expect(d.hasVisualData).toBe(false);
    expect(d.overallCondition).toBe('Fair');
    expect(d.wheelSizeAndSpecs).toBe('Standard / Requires Workshop Measurement');
    expect(d.make).toBe('Unknown / To Be Inspected');
    expect(d.faults).toHaveLength(1);
    expect(d.faults[0].source).toBe('User Note');
    expect(d.faults[0].description).toContain('Rear brake squeals when wet');
  });

  it('returns a "General Workshop Assessment Needed" fault when there is neither text nor image', async () => {
    const { getFallbackDiagnostic } = await import('./src/api/visionService');
    const d = getFallbackDiagnostic('');
    expect(d.faults).toHaveLength(1);
    expect(d.faults[0].faultTitle).toBe('General Workshop Assessment Needed');
    expect(d.userNotesTranslated).toBe('No user notes provided');
  });
});

describe('diagnoseFault — graceful degradation', () => {
  it('falls back (without calling the model) when no image is supplied', async () => {
    const { diagnoseFault } = await import('./src/api/visionService');
    const d = await diagnoseFault({ images: [], userNotes: 'chain skips' });
    expect(d.usedFallback).toBe(true);
    expect(d.fallbackReason).toBe('no-images');
    expect(generateContent).not.toHaveBeenCalled();
    expect(d.faults[0].description).toContain('chain skips');
  });

  it('falls back to the notes when the model errors out', async () => {
    generateContent.mockRejectedValue(new Error('boom: unexpected upstream failure'));
    const { diagnoseFault } = await import('./src/api/visionService');
    const d = await diagnoseFault({ images: [{ data: 'AAAA', mimeType: 'image/jpeg' }] as any, userNotes: 'wobble' });
    expect(d.usedFallback).toBe(true);
    expect(d.faults[0].source).toBe('User Note');
  });

  it('returns the live diagnostic (no fallback) on success', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"make":"Trek","faults":[]}' });
    const { diagnoseFault } = await import('./src/api/visionService');
    const d = await diagnoseFault({ images: [{ data: 'AAAA', mimeType: 'image/jpeg' }] as any });
    expect(d.usedFallback).toBe(false);
    expect(d.make).toBe('Trek');
  });
});
