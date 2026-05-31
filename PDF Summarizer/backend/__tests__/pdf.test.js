const path = require('path');
const { extractText } = require('../services/pdf');

const FIXTURE = path.join(__dirname, 'fixtures', 'sample.pdf');

describe('extractText', () => {
  test('extracts the text content from a real PDF', async () => {
    const text = await extractText(FIXTURE);
    expect(text).toContain('BriefPDF Reader sample document');
    expect(text).toContain('real PDF text extraction');
  });

  test('rejects when the file does not exist', async () => {
    await expect(extractText(path.join(__dirname, 'nope.pdf'))).rejects.toBeDefined();
  });
});
