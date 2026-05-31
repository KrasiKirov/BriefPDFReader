const { PDFExtract } = require('pdf.js-extract');

const EXTRACT_OPTIONS = {
  firstPage: 1,
  lastPage: undefined,
  password: '',
  verbosity: -1,
  normalizeWhitespace: false,
  disableCombinedTextItems: false,
};

/**
 * Extract all text from a PDF file on disk.
 * @param {string} filePath - absolute path to the PDF
 * @returns {Promise<string>} the concatenated text (trimmed)
 */
async function extractText(filePath) {
  const pdfExtract = new PDFExtract();
  const data = await pdfExtract.extract(filePath, EXTRACT_OPTIONS);

  return data.pages
    .map((page) => page.content.map((item) => item.str).join(' '))
    .join(' ')
    .trim();
}

module.exports = { extractText };
