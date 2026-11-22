// Automated play test in headless Chrome (390x844 phone, touch input via CDP) + screenshots.
// Usage: (cd dist && python3 -m http.server 8777) & node tools/test.mjs [url]
// ?slow=0.4 slows game time so CDP input latency doesn't skew timing (timing windows are judged in game time).
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const url = process.argv[2] || 'http://127.0.0.1:8777/?quality=medium&slow=0.4';
const D = process.env.SHOTS || 'shots';
fs.mkdirSync(D, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__zs && __zs.state === 'menu', { timeout: 90000 });
await new Promise(r => setTimeout(r, 2500));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (f, ...a) => page.evaluate(f, ...a);
const res = { spikes: [], laneChecks: [], events: [] };
await page.screenshot({ path: D + '/01-title.png' });
await page.tap('#playBtn'); await sleep(700);
res.tutorialShown = await ev(() => !document.getElementById('tut').classList.contains('hidden'));
await page.screenshot({ path: D + '/02-how-to-play.png' });
await page.tap('#tutGo'); await sleep(800);
res.started = await ev(() => __zs.state);
const swipe = async (lane, len = 120) => { const x = 195, y = 640; const dx = [-0.75, 0, 0.75][lane] * len, dy = -len; await page.touchscreen.touchStart(x, y); for (let i = 1; i <= 3; i++) await page.touchscreen.touchMove(x + dx * i / 3, y + dy * i / 3); await page.touchscreen.touchEnd(); };
const tapMid = async () => { await page.touchscreen.tap(195, 640); };
// pick the lane whose front zombie is closest to the net
const bestLane = () => ev(() => { let best = 1, bz = -99; for (let l = 0; l < 3; l++) { const z = __zs.frontZombie(l); if (z && z.z > bz) { bz = z.z; best = l; } } return best; });
async function waitSet(lead) {
  return page.waitForFunction(l => __zs.state === 'play' && __zs.cur && !__zs.cur.resolved && __zs.cur.tc - __zs.gt < l, { polling: 'raf', timeout: 30000 }, lead).then(() => true).catch(() => false);
}
let shot3 = false, shotHit = false;
const t0 = Date.now();
let n = 0;
// ---- phase 0: hold fire until zombies are in all 3 lanes, grab the gameplay shot
{ const tw = Date.now(); while (Date.now() - tw < 90000) { const u = await ev(() => new Set(__zs.zombies.filter(z => !z.dead && z.z > -12).map(z => z.lane)).size); if (u >= 3) { await sleep(600); await page.screenshot({ path: D + '/03-gameplay-3-lanes.png' }); shot3 = true; break; } await sleep(400); } res.events.push('3-lane shot ' + shot3); }
// ---- phase 1: play well for a while (aim at the most dangerous lane), with a sprinkle of tap + early/late tests
while (Date.now() - t0 < 150000) {
  const st = await ev(() => __zs.state); if (st !== 'play') break;
  const lanesUsed = await ev(() => new Set(__zs.zombies.filter(z => !z.dead).map(z => z.lane)).size);
  if (!shot3 && lanesUsed >= 3) { await page.screenshot({ path: D + '/03-gameplay-3-lanes.png' }); shot3 = true; }
  const mode = n === 3 ? 'early' : n === 5 ? 'none' : n === 7 ? 'tap' : 'aim';
  if (mode === 'early') { if (!await waitSet(0.42)) continue; await swipe(1); }
  else if (mode === 'none') { if (!await waitSet(0.3)) continue; await page.waitForFunction(() => !__zs.cur || __zs.cur.resolved, { polling: 'raf', timeout: 8000 }).catch(() => { }); res.events.push('no-swipe -> ' + await ev(() => document.getElementById('pop').textContent)); n++; continue; }
  else {
    if (!await waitSet(0.03)) continue;
    const lane = await bestLane();
    if (mode === 'tap') await tapMid(); else await swipe(lane);
    if (mode === 'aim') res.laneChecks.push(lane);
  }
  const ls = await ev(() => __zs.lastSpike);
  const pop = await ev(() => document.getElementById('pop').textContent);
  res.spikes.push({ mode, lane: ls && ls.lane, grade: ls && ls.grade, dt: ls && ls.dt, pop });
  if (!shotHit && ls && ls.grade === 'perfect' && mode === 'aim' && await ev(l => !!__zs.frontZombie(l), ls.lane)) { await sleep(260); await page.screenshot({ path: D + '/04-spike-hit.png' }); shotHit = true; }
  n++;
  const g = await ev(() => ({ wave: __zs.game.wave, kills: __zs.game.kills, score: __zs.game.score, lives: __zs.game.lives }));
  if (g.wave >= 3 && n > 30) break;
}
res.afterPlay = await ev(() => ({ wave: __zs.game.wave, kills: __zs.game.kills, score: __zs.game.score, lives: __zs.game.lives, combo: __zs.game.maxCombo, perfects: __zs.game.perfects, spikes: __zs.game.spikes, tier: __zs.tier }));
// ---- power-up check
await ev(() => __zs.givePower('triple')); await sleep(300);
await page.screenshot({ path: D + '/05-power-up.png' });
if (await waitSet(0.03)) { await swipe(1); res.tripleBallsInFlight = await ev(() => __zs.balls.filter(b => b.phase === 'path').length); }
// ---- phase 2: stop playing, let zombies reach the net -> lives drop -> game over
await ev(() => { __zs.lives = 1; for (const l of [0, 1, 2]) __zs.spawnZombie('libero', l, -3, false); });
await page.waitForFunction(() => __zs.state === 'over', { timeout: 60000 }).then(() => res.gameOver = true).catch(() => res.gameOver = false);
await sleep(2200);
res.overScreen = await ev(() => !document.getElementById('over').classList.contains('hidden'));
res.best = await ev(() => __zs.save.best);
await page.screenshot({ path: D + '/06-game-over.png' });
// play again works
await page.tap('#againBtn'); await sleep(800);
res.restart = await ev(() => [__zs.state, __zs.game.score, __zs.game.lives, __zs.game.wave]);
// summary
const grades = {}; for (const s of res.spikes) grades[s.grade] = (grades[s.grade] || 0) + 1;
res.grades = grades;
res.laneMatch = res.spikes.filter(s => s.mode === 'aim').every((s, i) => s.lane === res.laneChecks[i]);
res.errors = errs;
console.log(JSON.stringify(res, null, 1));
await browser.close();
