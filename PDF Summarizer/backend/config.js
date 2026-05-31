const path = require('path');
const dotenv = require('dotenv');

// Load .env from the project root (one level above /backend).
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const REQUIRED_VARS = ['OPENAI_API_KEY'];

/**
 * Build and validate the runtime configuration.
 * Throws (fail fast) if any required environment variable is missing.
 */
function loadConfig() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.'
    );
  }

  return {
    port: Number(process.env.PORT) || 5000,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 60000,
    openaiMaxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 2),
    uploadDir: path.join(__dirname, 'pdfsummary'),
    maxUploadBytes: 20 * 1024 * 1024, // 20 MB
    // Empty = allow any origin (fine for local dev). In production set
    // ALLOWED_ORIGINS to the frontend URL(s), comma-separated.
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimit: {
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
      max: Number(process.env.RATE_LIMIT_MAX) || 20,
    },
  };
}

module.exports = { loadConfig };
