// Render both banner sizes: PNG previews and print-ready vector PDFs at real size (1 px = 1 mm).
const { chromium } = require('playwright');
const path = require('path');
const sizes = { lebar: [4000, 1250], kotak: [3000, 2000] };
(async () => {
  const b = await chromium.launch();
  for (const [v, [w, h]] of Object.entries(sizes)) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + path.join(__dirname, 'spanduk.html') + '#' + v);
    await p.waitForFunction(() => document.body.dataset.ready);
    const name = v === 'lebar' ? 'spanduk-4x1.25m' : 'spanduk-3x2m';
    await p.screenshot({ path: path.join(__dirname, '..', `${name}-preview.png`) });
    await p.pdf({ path: path.join(__dirname, '..', `${name}-cetak.pdf`), width: w + 'mm', height: h + 'mm', printBackground: true, pageRanges: '1' });
    console.log('done', name);
  }
  await b.close();
})();
