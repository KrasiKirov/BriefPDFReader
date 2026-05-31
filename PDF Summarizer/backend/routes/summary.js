const express = require('express');
const fs = require('fs/promises');
const { extractText } = require('../services/pdf');
const { summarize } = require('../services/summarize');

const MIN_WORDS = 10;
const MAX_WORDS = 2500;

/**
 * Validate the requested word count.
 * @returns {{value: number|undefined}|{error: string}}
 *   - absent/blank -> { value: undefined } (summarize with no target)
 *   - valid integer in range -> { value: n }
 *   - anything else -> { error }
 */
function parseWordTarget(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { value: undefined };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_WORDS || n > MAX_WORDS) {
    return { error: `maxWords must be a whole number between ${MIN_WORDS} and ${MAX_WORDS}.` };
  }
  return { value: n };
}

/**
 * Build the summary router. `upload` is a configured multer instance, injected
 * so the app owns upload limits/filtering and the route stays testable.
 */
module.exports = function createSummaryRouter(upload) {
  const router = express.Router();

  router.post('/pdfsummary', upload.single('pdf'), async (req, res, next) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({ error: 'No PDF file was uploaded.' });
      }

      const wt = parseWordTarget(req.body.maxWords);
      if (wt.error) {
        return res.status(400).json({ error: wt.error });
      }
      const wordTarget = wt.value;

      const text = await extractText(file.path);

      if (!text) {
        return res.status(422).json({
          error: 'Text could not be extracted from this PDF. Please try another PDF.',
        });
      }

      const summarisedText = await summarize(text, { wordTarget });
      res.json({ summarisedText });
    } catch (err) {
      next(err);
    } finally {
      // Always remove the temp upload, on success or failure.
      if (file) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
  });

  return router;
};
