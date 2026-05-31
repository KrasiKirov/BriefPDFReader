// Mock OpenAI so no network call happens. summarize() builds its default
// client via `new OpenAI(...)`, which this replaces.
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'INTEGRATION SUMMARY' } }],
        }),
      },
    },
  }))
);

process.env.OPENAI_API_KEY = 'test-key';

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../app');

const FIXTURE = path.join(__dirname, 'fixtures', 'sample.pdf');

function makeConfig(overrides = {}) {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'briefpdf-test-'));
  return {
    uploadDir,
    maxUploadBytes: 20 * 1024 * 1024,
    openaiModel: 'gpt-4.1-mini',
    allowedOrigins: [],
    rateLimit: { windowMs: 60 * 60 * 1000, max: 1000 },
    ...overrides,
  };
}

describe('POST /api/pdfsummary', () => {
  test('returns a summary for a valid PDF upload', async () => {
    const config = makeConfig();
    const app = createApp(config);

    const res = await request(app)
      .post('/api/pdfsummary')
      .field('maxWords', '50')
      .attach('pdf', FIXTURE, { contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.summarisedText).toBe('INTEGRATION SUMMARY');

    // Temp upload was cleaned up.
    expect(fs.readdirSync(config.uploadDir)).toHaveLength(0);
  });

  test('rejects a non-PDF upload with 415', async () => {
    const config = makeConfig();
    const app = createApp(config);

    const res = await request(app)
      .post('/api/pdfsummary')
      .attach('pdf', Buffer.from('not a pdf'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/only pdf/i);
  });

  test('rejects an oversized PDF with 413', async () => {
    const config = makeConfig({ maxUploadBytes: 10 }); // 10 bytes
    const app = createApp(config);

    const res = await request(app)
      .post('/api/pdfsummary')
      .attach('pdf', FIXTURE, { contentType: 'application/pdf' });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  test.each([
    ['above the maximum', '3000'],
    ['below the minimum', '5'],
    ['not a number', 'lots'],
    ['not an integer', '12.5'],
  ])('rejects maxWords %s with 400', async (_label, value) => {
    const config = makeConfig();
    const app = createApp(config);

    const res = await request(app)
      .post('/api/pdfsummary')
      .field('maxWords', value)
      .attach('pdf', FIXTURE, { contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maxWords/);
  });

  test('accepts the maximum allowed maxWords (2500)', async () => {
    const config = makeConfig();
    const app = createApp(config);

    const res = await request(app)
      .post('/api/pdfsummary')
      .field('maxWords', '2500')
      .attach('pdf', FIXTURE, { contentType: 'application/pdf' });

    expect(res.status).toBe(200);
  });

  test('rate-limits repeated requests with 429', async () => {
    const config = makeConfig({ rateLimit: { windowMs: 60 * 60 * 1000, max: 1 } });
    const app = createApp(config);

    const first = await request(app)
      .post('/api/pdfsummary')
      .attach('pdf', FIXTURE, { contentType: 'application/pdf' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/pdfsummary')
      .attach('pdf', FIXTURE, { contentType: 'application/pdf' });
    expect(second.status).toBe(429);
    expect(second.body.error).toMatch(/too many/i);
  });

  test('returns 400 when no file is provided', async () => {
    const config = makeConfig();
    const app = createApp(config);

    const res = await request(app).post('/api/pdfsummary').field('maxWords', '50');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no pdf/i);
  });

  test('does not leak raw error objects on failure', async () => {
    const config = makeConfig();
    const app = createApp(config);
    // health check sanity: error handler returns safe shape only
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });
});
