const { summarize } = require('../services/summarize');

function makeMockClient(reply = 'MOCK SUMMARY') {
  const create = jest.fn().mockResolvedValue({
    choices: [{ message: { content: reply } }],
  });
  return { client: { chat: { completions: { create } } }, create };
}

describe('summarize', () => {
  test('single-call path: one API call for text under the input budget', async () => {
    const { client, create } = makeMockClient('A short summary.');
    const result = await summarize('Some modest amount of text.', {
      client,
      model: 'gpt-4.1-mini',
      wordTarget: 50,
    });

    expect(result).toBe('A short summary.');
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.model).toBe('gpt-4.1-mini');
    expect(arg.messages[1].content).toContain('in about 50 words');
  });

  test('omits the word-count instruction when no wordTarget is given', async () => {
    const { client, create } = makeMockClient();
    await summarize('Text without a target.', { client, model: 'gpt-4.1-mini' });
    expect(create.mock.calls[0][0].messages[1].content).not.toContain('in about');
  });

  test('chunk-fallback path: re-summarizes when text exceeds the input budget', async () => {
    const { client, create } = makeMockClient('tiny');
    // Tiny budgets force the fallback loop; the mock returns a short string so
    // the loop converges.
    const bigText = Array.from({ length: 60 }, (_, i) => `Sentence ${i} content here`).join('. ') + '.';
    const result = await summarize(bigText, {
      client,
      model: 'gpt-4.1-mini',
      maxInputTokens: 10,
      chunkTokens: 8,
    });

    expect(result).toBe('tiny');
    // More than one call means the fallback chunking actually ran.
    expect(create.mock.calls.length).toBeGreaterThan(1);
  });

  test('propagates errors from the OpenAI client', async () => {
    const create = jest.fn().mockRejectedValue(new Error('rate limited'));
    const client = { chat: { completions: { create } } };
    await expect(summarize('text', { client, model: 'gpt-4.1-mini' })).rejects.toThrow('rate limited');
  });
});
