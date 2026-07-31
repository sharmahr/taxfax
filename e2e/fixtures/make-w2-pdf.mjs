// Generates a text-bearing W-2 PDF (issuer "Copperline Foods") with Playwright's
// bundled Chromium — no new dependency. The ingest pipeline reads PDF text in
// process via `unpdf`, so unlike a photo this classifies for real in the local
// emulator: strong title match → `w2`, and the "Employer's name" anchor lifts
// the issuer. Each form field is its own block so the PDF text layer keeps the
// line breaks the issuer extractor relies on.
//
//   node e2e/fixtures/make-w2-pdf.mjs e2e/fixtures/w2-form.pdf
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? new URL('./w2-form.pdf', import.meta.url).pathname;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 'Helvetica', Arial, sans-serif; color: #111; margin: 0; padding: 40px; }
  .title { font-size: 22px; font-weight: 700; letter-spacing: .5px; }
  .sub { font-size: 12px; color: #333; margin-top: 2px; }
  .copy { font-size: 11px; color: #444; margin-top: 4px; }
  .grid { display: flex; flex-wrap: wrap; margin-top: 26px; border: 1px solid #111; }
  .box { border: 1px solid #999; padding: 8px 10px; min-height: 58px; }
  .full { width: 100%; }
  .half { width: 50%; }
  .third { width: 33.33%; }
  .label { font-size: 10px; color: #555; text-transform: none; }
  .value { font-size: 15px; font-weight: 600; margin-top: 8px; }
  .money { font-variant-numeric: tabular-nums; }
</style></head><body>
  <div class="title">Form W-2 Wage and Tax Statement</div>
  <div class="sub">2025 &nbsp; Department of the Treasury — Internal Revenue Service</div>
  <div class="copy">Copy B—To Be Filed With Employee's FEDERAL Tax Return</div>

  <div class="grid">
    <div class="box full">
      <div class="label">Employer's name, address, and ZIP code</div>
      <div class="value">Copperline Foods</div>
      <div class="value" style="font-weight:400;font-size:13px">428 Harbor Court</div>
      <div class="value" style="font-weight:400;font-size:13px">Copperline, ME 04011</div>
    </div>
    <div class="box half">
      <div class="label">Employer identification number (EIN)</div>
      <div class="value money">04-3921887</div>
    </div>
    <div class="box half">
      <div class="label">Control number</div>
      <div class="value money">A-2044</div>
    </div>
    <div class="box full">
      <div class="label">Employee's name, address, and ZIP code</div>
      <div class="value">Eleanor Whitfield</div>
      <div class="value" style="font-weight:400;font-size:13px">91 Sycamore Lane, Austin, TX 78703</div>
    </div>
    <div class="box third">
      <div class="label">1 Wages, tips, other compensation</div>
      <div class="value money">88,540.00</div>
    </div>
    <div class="box third">
      <div class="label">2 Federal income tax withheld</div>
      <div class="value money">12,904.00</div>
    </div>
    <div class="box third">
      <div class="label">3 Social security wages</div>
      <div class="value money">90,110.00</div>
    </div>
    <div class="box third">
      <div class="label">4 Social security tax withheld</div>
      <div class="value money">5,586.82</div>
    </div>
    <div class="box third">
      <div class="label">5 Medicare wages and tips</div>
      <div class="value money">90,110.00</div>
    </div>
    <div class="box third">
      <div class="label">6 Medicare tax withheld</div>
      <div class="value money">1,306.60</div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log('wrote', out);
