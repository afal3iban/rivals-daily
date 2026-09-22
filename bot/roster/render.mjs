// Renders bot/roster/index.html into one image per role for the Discord bot.
// Run by .github/workflows/roster.yml whenever heroes.js changes.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p.endsWith(path.sep)) p += 'index.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8765);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:8765/bot/roster/index.html');
await page.waitForFunction(() => window.rosterReady === true, null, { timeout: 90000 });
await page.evaluate(() => document.fonts.ready);
for (const role of ['vanguard', 'duelist', 'strategist']) {
  await page.locator('#' + role).screenshot({ path: `bot/roster/${role}.jpg`, type: 'jpeg', quality: 88 });
  console.log('rendered', role);
}
await browser.close();
server.close();
