const OpenAI = require('openai');
const { loadConfig } = require('../config');
const { countTokens, splitTextIntoChunks } = require('./tokens');

// gpt-4.1-mini has a very large context window. We keep the input for a single
// call well under it to leave room for the model's response and a safety margin
// (the gpt-3-encoder token count is an approximation for newer models).
const MAX_INPUT_TOKENS = 100000;
// Token budget per chunk when a document is too large for a single call.
const CHUNK_TOKENS = 12000;

let defaultClient;
function getDefaultClient() {
  if (!defaultClient) {
    const { openaiApiKey, openaiTimeoutMs, openaiMaxRetries } = loadConfig();
    defaultClient = new OpenAI({
      apiKey: openaiApiKey,
      timeout: openaiTimeoutMs,
      maxRetries: openaiMaxRetries,
    });
  }
  return defaultClient;
}

async function summarizeOnce(client, model, text, wordTarget) {
  const condition = wordTarget ? `in about ${wordTarget} words` : '';
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful summarizer assistant. You summarize the given text faithfully and concisely.',
      },
      {
        role: 'user',
        content: `Please summarise the following text ${condition}:\n"""${text}"""\n\nSummary:`,
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}

/**
 * Summarize text via OpenAI.
 *
 * Common path (most PDFs): a single API call. Fallback path: if the text is
 * larger than a single call can take, it is summarized chunk-by-chunk and the
 * partial summaries are re-summarized until they fit, then summarized once more
 * to the requested word target.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.wordTarget] - approximate word count for the summary
 * @param {object} [options.client] - injected OpenAI client (for testing)
 * @param {string} [options.model] - override the configured model (for testing)
 * @param {number} [options.maxInputTokens] - single-call input budget (for testing)
 * @param {number} [options.chunkTokens] - per-chunk budget for the fallback (for testing)
 * @returns {Promise<string>}
 */
async function summarize(text, options = {}) {
  const {
    wordTarget,
    client,
    model,
    maxInputTokens = MAX_INPUT_TOKENS,
    chunkTokens = CHUNK_TOKENS,
  } = options;

  const openai = client || getDefaultClient();
  const useModel = model || loadConfig().openaiModel;

  let working = text;
  while (countTokens(working) > maxInputTokens) {
    const chunks = splitTextIntoChunks(working, chunkTokens);
    const summaries = [];
    for (const chunk of chunks) {
      summaries.push(await summarizeOnce(openai, useModel, chunk));
    }
    working = summaries.join(' ');
  }

  return summarizeOnce(openai, useModel, working, wordTarget);
}

module.exports = { summarize };
