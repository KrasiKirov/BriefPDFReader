const { encode } = require('gpt-3-encoder');

/** Count the number of tokens in a string. */
const countTokens = (text) => encode(text).length;

/**
 * Split a single sentence that is too large for one chunk into word-bounded
 * pieces, each under `maxTokens`.
 */
function splitSentence(sentence, maxTokens) {
  const chunks = [];
  let current = '';

  for (const word of sentence.split(' ')) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (countTokens(candidate) <= maxTokens) {
      current = candidate;
    } else {
      if (current) chunks.push(current.trim());
      current = word; // a lone word over the limit becomes its own chunk
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Split text into chunks, each under `maxTokens`. Splits on sentence
 * boundaries, falling back to word-level splitting for any single sentence
 * that exceeds the limit on its own.
 */
function splitTextIntoChunks(text, maxTokens) {
  const chunks = [];
  let current = '';

  for (const raw of text.split('.')) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const piece = `${sentence}.`;

    // A single sentence larger than the limit must be split at word level.
    if (countTokens(piece) > maxTokens) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      chunks.push(...splitSentence(sentence, maxTokens));
      continue;
    }

    if (countTokens(current + piece) <= maxTokens) {
      current += piece;
    } else {
      if (current) chunks.push(current.trim());
      current = piece;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

module.exports = { countTokens, splitSentence, splitTextIntoChunks };
