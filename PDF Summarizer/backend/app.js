const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const createSummaryRouter = require('./routes/summary');

/**
 * Build the Express app. Takes the loaded config so upload limits, CORS,
 * rate limiting and the upload directory are driven by configuration (and
 * overridable in tests).
 */
function createApp(config) {
  const app = express();

  // Trust the platform proxy (Railway/Render/etc.) so rate limiting sees the
  // real client IP rather than the proxy's.
  app.set('trust proxy', 1);

  const allowedOrigins = config.allowedOrigins || [];
  app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
  app.use(express.json());

  const rl = config.rateLimit || { windowMs: 60 * 60 * 1000, max: 20 };
  const summaryLimiter = rateLimit({
    windowMs: rl.windowMs,
    max: rl.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });

  const upload = multer({
    dest: config.uploadDir,
    limits: { fileSize: config.maxUploadBytes },
    fileFilter: (req, file, cb) => {
      const isPdf =
        file.mimetype === 'application/pdf' &&
        file.originalname.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        const err = new Error('Only PDF files are accepted.');
        err.status = 415; // tagged errors are safe to expose to the client
        return cb(err);
      }
      cb(null, true);
    },
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/pdfsummary', summaryLimiter);
  app.use('/api', createSummaryRouter(upload));

  // Centralized error handler: log the full error server-side, return only a
  // safe message to the client. Raw error objects are never serialized.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'PDF is too large. Maximum size is 20 MB.' });
      }
      return res.status(400).json({ error: 'File upload failed.' });
    }
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Request failed:', err);
    res.status(500).json({ error: 'An unexpected error occurred while processing the PDF.' });
  });

  return app;
}

module.exports = { createApp };
