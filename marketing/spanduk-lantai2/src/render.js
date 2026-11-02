// Render the banner: PNG previews (both variants) and print-ready vector PDFs at 3 m x 2 m.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  for (const v of ['terang', 'gelap']) {
    const p = await b.newPage({ viewport: { width: 3000, height: 2000 } });
    await p.goto('file://' + path.join(__dirname, 'spanduk.html') + (v === 'gelap' ? '#dark' : ''));
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(__dirname, '..', `spanduk-${v}-preview.png`) });
    await p.pdf({ path: path.join(__dirname, '..', `spanduk-${v}-3x2m-cetak.pdf`), width: '3000mm', height: '2000mm', printBackground: true, pageRanges: '1' });
    console.log('done', v);
  }
  await b.close();
})();
