/**
 * Generates a minimal, structurally-valid single-page PDF with known text,
 * computing accurate xref byte offsets. Run once to (re)create sample.pdf:
 *   node backend/__tests__/fixtures/make-sample-pdf.js
 */
const fs = require('fs');
const path = require('path');

const LINES = [
  'BriefPDF Reader sample document.',
  'This fixture exists so tests can exercise real PDF text extraction.',
  'It contains a few sentences of plain text across a single page.',
];

function escapePdfText(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildContentStream() {
  let content = 'BT /F1 18 Tf 72 720 Td 20 TL ';
  content += `(${escapePdfText(LINES[0])}) Tj`;
  for (let i = 1; i < LINES.length; i++) {
    content += ` T* (${escapePdfText(LINES[i])}) Tj`;
  }
  content += ' ET';
  return content;
}

function buildPdf() {
  const content = buildContentStream();
  const bodies = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  bodies.forEach((body, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  const size = bodies.length + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

const outPath = path.join(__dirname, 'sample.pdf');
fs.writeFileSync(outPath, buildPdf());
console.log(`Wrote ${outPath}`);

module.exports = { LINES };
