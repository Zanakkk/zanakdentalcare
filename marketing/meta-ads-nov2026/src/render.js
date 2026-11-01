// Render each ad HTML file to PNG. Usage: node render.js [file.html ...]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = __dirname;
  const out = path.join(dir, '..');
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs.readdirSync(dir).filter(f => /^\d\d-.*\.html$/.test(f));
  const browser = await chromium.launch();
  for (const f of files) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto('file://' + path.join(dir, f));
    await page.evaluate(() => document.fonts.ready);
    const el = await page.$('.canvas');
    const png = path.join(out, f.replace('.html', '.png'));
    await el.screenshot({ path: png });
    console.log('wrote', png);
    await page.close();
  }
  await browser.close();
})();
