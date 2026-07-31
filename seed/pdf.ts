/**
 * A tiny, dependency-free PDF writer — enough to put a legible page of text in
 * front of a buyer, and nothing more.
 *
 * The demo's review queue is worth exactly as much as what its preview pane
 * shows. Seeding 174 rows with no bytes behind them made the flagship surface
 * read "Preview not available"; seeding real files makes it read like February.
 * A PDF generator is a well-worn wheel, but the alternative is a runtime
 * dependency in a seed script for the sake of laying out monospaced text in a
 * box, so this stays: ~90 lines, no install, no supply chain.
 *
 * Deliberate limits: Helvetica and Courier only (the two base-14 fonts every
 * reader has built in), WinAnsi, US Letter, left-aligned lines. Anything a real
 * tax form does beyond that is decoration we don't need.
 */

const WIDTH = 612; // US Letter, 72dpi
const HEIGHT = 792;
const MARGIN = 54;

export interface Line {
  text: string;
  /** Points. 8–20 covers everything a form does. */
  size?: number;
  bold?: boolean;
  mono?: boolean;
  /** Extra leading above this line. */
  gap?: number;
  /** Indent from the left margin, in points. */
  indent?: number;
  /** 0–1 grey; 0 is black. Faded text is how a bad photocopy reads. */
  grey?: number;
}

/** WinAnsi-escape a string for a PDF literal. */
function esc(s: string): string {
  return s
    // "Nguyễn" has no glyph in Helvetica, but "Nguyen" does. Fold accents that
    // fall outside Latin-1 rather than silently deleting the letters under them.
    .replace(/[^\x00-\xff]/g, (ch) => ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''))
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Anything outside Latin-1 has no glyph in the base fonts; drop it rather
    // than emit a byte that renders as a random accent.
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '');
}

function contentStream(lines: Line[]): string {
  const out: string[] = [];
  let y = HEIGHT - MARGIN;
  for (const line of lines) {
    const size = line.size ?? 10;
    y -= (line.gap ?? 0) + size + 3;
    if (y < MARGIN) break;
    const font = line.mono ? (line.bold ? '/F4' : '/F3') : line.bold ? '/F2' : '/F1';
    const grey = line.grey ?? 0;
    out.push(
      `BT ${font} ${size} Tf ${grey} g ${MARGIN + (line.indent ?? 0)} ${y.toFixed(1)} Td (${esc(line.text)}) Tj ET`,
    );
  }
  return out.join('\n');
}

/** Builds a multi-page PDF. Each element of `pages` is one page's lines. */
export function buildPdf(pages: Line[][]): Buffer {
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  // 1 catalog, 2 pages tree, then per page: page dict + content stream.
  const catalogNo = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesNo = add(''); // placeholder, filled once kids are known
  const fontNos = {
    F1: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    F2: add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    F3: add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'),
    F4: add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'),
  };
  const fontRes = `<< /F1 ${fontNos.F1} 0 R /F2 ${fontNos.F2} 0 R /F3 ${fontNos.F3} 0 R /F4 ${fontNos.F4} 0 R >>`;

  const kids: number[] = [];
  for (const lines of pages) {
    const stream = contentStream(lines);
    const contentNo = add(
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
    kids.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] ` +
          `/Resources << /Font ${fontRes} >> /Contents ${contentNo} 0 R >>`,
      ),
    );
  }
  objects[pagesNo - 1] =
    `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((n) => `${n} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNo} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
