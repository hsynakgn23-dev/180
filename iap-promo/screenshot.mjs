import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pages = [
  { file: 'monthly.html', out: 'monthly-promo.png' },
  { file: 'annual.html', out: 'annual-promo.png' },
  { file: 'supporter.html', out: 'supporter-promo.png' },
  { file: 'tickets80.html', out: 'tickets80-promo.png' },
  { file: 'tickets200.html', out: 'tickets200-promo.png' },
  { file: 'tickets550.html', out: 'tickets550-promo.png' },
  { file: 'tickets1200.html', out: 'tickets1200-promo.png' },
];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

for (const { file, out } of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  await page.goto(`file:///${path.join(__dirname, file).replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(__dirname, out), type: 'png', clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  console.log(`✓ ${out}`);
  await page.close();
}

await browser.close();
console.log('\nDone! Files saved to iap-promo/');
