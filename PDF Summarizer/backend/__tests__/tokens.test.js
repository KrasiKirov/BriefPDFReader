const { countTokens, splitSentence, splitTextIntoChunks } = require('../services/tokens');

describe('countTokens', () => {
  test('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  test('counts tokens for non-empty text', () => {
    expect(countTokens('hello world')).toBeGreaterThan(0);
  });
});

describe('splitTextIntoChunks', () => {
  test('returns empty array for empty text', () => {
    expect(splitTextIntoChunks('', 100)).toEqual([]);
  });

  test('keeps short text in a single chunk', () => {
    const text = 'One. Two. Three.';
    const chunks = splitTextIntoChunks(text, 1000);
    expect(chunks).toHaveLength(1);
  });

  test('splits text across multiple chunks when it exceeds the limit', () => {
    const sentences = Array.from({ length: 50 }, (_, i) => `Sentence number ${i} here`).join('. ') + '.';
    const chunks = splitTextIntoChunks(sentences, 20);
    expect(chunks.length).toBeGreaterThan(1);
    // every chunk stays within (or close to) the token budget
    for (const chunk of chunks) {
      expect(countTokens(chunk)).toBeLessThanOrEqual(20);
    }
  });

  test('reassembling chunks preserves all words', () => {
    const text = 'Alpha beta. Gamma delta epsilon. Zeta eta theta iota.';
    const chunks = splitTextIntoChunks(text, 5);
    const original = text.split(/\W+/).filter(Boolean).sort();
    const roundtrip = chunks.join(' ').split(/\W+/).filter(Boolean).sort();
    expect(roundtrip).toEqual(original);
  });

  test('splits a single oversized sentence at word level', () => {
    const longSentence = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const chunks = splitTextIntoChunks(longSentence, 10);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countTokens(chunk)).toBeLessThanOrEqual(10);
    }
  });
});

describe('splitSentence', () => {
  test('keeps every chunk within the token budget', () => {
    const sentence = Array.from({ length: 30 }, (_, i) => `token${i}`).join(' ');
    const chunks = splitSentence(sentence, 8);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countTokens(chunk)).toBeLessThanOrEqual(8);
    }
  });
});
