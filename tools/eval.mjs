// node tools/eval.mjs "<url>" "<js expression>"
import puppeteer from 'puppeteer-core';
const [url, expr] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); const errs = [];
p.on('console', m => errs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => errs.push('PE ' + e.message));
await p.setViewport({ width: 390, height: 844 });
await p.goto(url, { waitUntil: 'networkidle0' });
await p.waitForFunction(() => window.__zs && ['menu', 'proof', 'play'].includes(__zs.state), { timeout: 90000 }).catch(e => errs.push('wait ' + e.message));
await new Promise(r => setTimeout(r, 1000));
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
console.log(errs.slice(0, 15).join('\n'));
await b.close();
