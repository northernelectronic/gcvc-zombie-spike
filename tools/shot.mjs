// one-off screenshot: node tools/shot.mjs "<url>" out.png [waitMs]
import puppeteer from 'puppeteer-core';
const [url, out, wait = '2500'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); const errs = [];
p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); p.on('pageerror', e => errs.push('PE ' + e.message));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(url, { waitUntil: 'networkidle0' });
await p.waitForFunction(() => window.__zs && ['menu', 'proof', 'play'].includes(__zs.state), { timeout: 90000 }).catch(e => errs.push('wait ' + e.message));
await new Promise(r => setTimeout(r, +wait));
await p.screenshot({ path: out });
console.log(JSON.stringify(errs.slice(0, 10)));
await b.close();
