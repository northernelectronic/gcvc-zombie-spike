// GCVC United: Zombie Spike - one hitter at the net, a non-stop feed of sets, and cartoon zombie volleyball
// players shuffling at the net in 3 lanes. Swipe up at the top of the jump; swipe direction picks the lane.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/bebas-neue/400.css';
import { loadAthlete, Athlete, kitTexture } from './athlete.js';
import * as GYM from './gym.js';
import { initAudio, sfx, setMuted, isMuted, crowdLevel } from './audio.js';
import { buzz } from './haptics.js';

const $ = id => document.getElementById(id);
const NET_H = GYM.COURT.netH;
const G = 9.8;
const LANES = [-2.4, 0, 2.4];
const SPAWN_Z = -13.2, DANGER_Z = -0.95;
const HOME = new THREE.Vector3(0, 0, 1.15);           // hitter's base spot
const CONTACT = new THREE.Vector3(0.28, 3.02, 0.5);    // where the set peaks / she meets the ball
const SETTER = new THREE.Vector3(1.55, 0, 1.6);
const SET_FROM = new THREE.Vector3(1.42, 2.32, 1.42);
const MACHINE = new THREE.Vector3(4.6, 1.05, 5.6);
const WIN = { perfect: 0.085, good: 0.165, ok: 0.26, max: 0.5 };
const SAVE_KEY = 'gcvcZombieSpike_v1';
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;

// ---------------- save ----------------
const save = Object.assign({ best: 0, bestWave: 0, muted: false, gfx: 'auto', autoTier: null, tut: false, played: 0 },
  (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })());
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { } };
setMuted(save.muted);

// ---------------- renderer / scene ----------------
const container = $('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const FOG = new THREE.Color('#0a120f');
scene.background = FOG.clone();
scene.fog = new THREE.Fog(FOG, 18, 52);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120);
const hemi = new THREE.HemisphereLight('#c9d8ff', '#3a2a24', 0.55); scene.add(hemi);
const key = new THREE.DirectionalLight('#e9f0ff', 1.55); key.position.set(-4, 20, 6); scene.add(key); scene.add(key.target);
key.target.position.set(0, 0, -6);
{ const sc = key.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 12; sc.bottom = -10; sc.near = 4; sc.far = 40; }
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
// warm hero spot on our hitter, eerie green from the zombie end, red rims along the sides
const heroSpot = new THREE.SpotLight('#ffd9a8', 60, 20, 0.42, 0.6, 1.6); heroSpot.position.set(0.5, 9, 4.5); heroSpot.target.position.set(0, 1, 0.9); scene.add(heroSpot); scene.add(heroSpot.target);
const gateLight = new THREE.DirectionalLight('#5dff8a', 0.9); gateLight.position.set(0, 1.2, -20); gateLight.target.position.set(0, 0.8, 2); scene.add(gateLight); scene.add(gateLight.target);
const zoneFill = new THREE.SpotLight('#d8e4ff', 0, 30, 0.42, 0.7, 1.2); zoneFill.position.set(0, 9, 4); zoneFill.target.position.set(0, 0, -8); scene.add(zoneFill, zoneFill.target); // lights the zombie field so faces read // backlight: green rims on the zombies
const greenB = new THREE.PointLight('#7bff4a', 14, 14, 1.6); greenB.position.set(-6, 1.5, -8); scene.add(greenB);
const greenC = new THREE.PointLight('#7bff4a', 14, 14, 1.6); greenC.position.set(6, 1.5, -8); scene.add(greenC);
const redRim = new THREE.PointLight('#ff2a44', 16, 16, 1.6); redRim.position.set(0, 4, 5); scene.add(redRim);
// soft beauty light for the title screen close-up (front-left, warm)
const menuLight = new THREE.SpotLight('#ffe6d0', 0, 9, 0.3, 0.7, 1.2); menuLight.position.set(-1.2, 2.6, 4.6); menuLight.target.position.set(0, 1.4, 1.1); scene.add(menuLight); scene.add(menuLight.target);
const purple = new THREE.PointLight('#a55bff', 10, 18, 1.6); purple.position.set(-7, 6, -6); scene.add(purple);

const TIERS = {
  high: { dpr: 2, shadow: 2048, bloom: true, reflect: true, crowd: 1.0, mist: 1 },
  medium: { dpr: 1.5, shadow: 1024, bloom: false, reflect: false, crowd: 0.6, mist: 1 },
  low: { dpr: 1, shadow: 0, bloom: false, reflect: false, crowd: 0.3, mist: 0 },
};
const TIER_ORDER = ['high', 'medium', 'low'];
const qs = new URLSearchParams(location.search);
const qParam = qs.get('quality');
const TEST_SLOW = clamp(+qs.get('slow') || 1, 0.05, 1); // test harness only: slows game time so CDP input latency doesn't matter
const isTouch = matchMedia('(pointer: coarse)').matches;
let tierName = TIERS[qParam] ? qParam : (save.gfx !== 'auto' ? save.gfx : (save.autoTier || (isTouch ? 'medium' : 'high')));
let tier = TIERS[tierName];
let composer = null, reflector = null, bloomPass = null;
function buildComposer() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.42, 0.5, 0.95);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = clamp(62 + (0.5 - camera.aspect) * 22, 46, 70);
  camera.updateProjectionMatrix();
  if (composer) { composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); }
  if (reflector) { const s = renderer.getDrawingBufferSize(new THREE.Vector2()); reflector.getRenderTarget().setSize(Math.round(s.x / 2), Math.round(s.y / 2)); }
}
addEventListener('resize', resize);

// ---------------- world: shared helpers ----------------
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function ctex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function blobTex() { const [c, x] = cnv(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const BLOB = blobTex();
function ringTex(color, w = 10) { const [c, x] = cnv(128, 128); x.strokeStyle = color; x.lineWidth = w; x.shadowColor = color; x.shadowBlur = 10; x.beginPath(); x.arc(64, 64, 64 - w - 6, 0, Math.PI * 2); x.stroke(); return ctex(c); }
function glowTex(r, g, b) { const [c, x] = cnv(128, 128); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return ctex(c); }
function mistTex() {
  const [c, x] = cnv(256, 256);
  for (let i = 0; i < 70; i++) { const px = Math.random() * 256, py = Math.random() * 256, r = 20 + Math.random() * 50; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { x.save(); x.translate(ox, oy); x.fillRect(px - r, py - r, r * 2, r * 2); x.restore(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------- world objects ----------------
const netG = GYM.makeNet(); scene.add(netG);
const scoreboard = GYM.makeScoreboard(); scene.add(scoreboard);
const bleachersG = GYM.makeBleachers(false); scene.add(bleachersG);
let crowd = null, floor = null, logoTex = null;

// zombie gate on the far wall: open double doors spilling green light
const gate = new THREE.Group(); scene.add(gate);
{
  const [dc, dx] = cnv(128, 128);
  const dg = dx.createLinearGradient(0, 0, 0, 128); dg.addColorStop(0, '#0c2a14'); dg.addColorStop(0.55, '#2f9a4a'); dg.addColorStop(1, '#b8ffcf');
  dx.fillStyle = dg; dx.fillRect(0, 0, 128, 128);
  const dv = dx.createRadialGradient(64, 120, 10, 64, 100, 90); dv.addColorStop(0, 'rgba(220,255,230,0.7)'); dv.addColorStop(1, 'rgba(0,0,0,0)'); dx.fillStyle = dv; dx.fillRect(0, 0, 128, 128);
  const glowM = new THREE.MeshBasicMaterial({ map: ctex(dc), toneMapped: false, fog: false });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.6), glowM); door.position.set(0, 2.3, -21.35); gate.add(door);
  const frameM = new THREE.MeshStandardMaterial({ color: '#2b2d33', metalness: 0.6, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.9, 0.4), frameM); jamb.position.set(s * 3.65, 2.45, -21.2); gate.add(jamb);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.75, 4.5, 0.08), new THREE.MeshStandardMaterial({ color: '#3a3f3a', metalness: 0.5, roughness: 0.5 }));
    leaf.position.set(s * 4.4, 2.25, -20.4); leaf.rotation.y = s * -1.1; gate.add(leaf);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.4, 0.4), frameM); lintel.position.set(0, 4.85, -21.2); gate.add(lintel);
  // EXIT-style sign reading ZOMBIES
  const [c, x] = cnv(256, 64); x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 256, 64); x.font = '700 50px "Bebas Neue", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#7dff5a'; x.fillText('ZOMBIES', 128, 36);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: ctex(c), toneMapped: false })); sign.position.set(0, 5.4, -21.15); gate.add(sign); gate.userData.sign = sign;
}
// volumetric-looking light shafts from the gate (additive cones)
const shaftMat = new THREE.MeshBasicMaterial({ map: glowTex(90, 255, 140), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
if (false) for (const s of [-1, 0, 1]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(6, 16), shaftMat); sh.rotation.x = -Math.PI / 2 + 0.06; sh.position.set(s * 2.2, 0.4, -14.5); sh.rotation.z = s * 0.12; scene.add(sh); }

// lane guides on the zombie court
const laneG = new THREE.Group(); scene.add(laneG);
const laneGlow = [];
{
  const [c, x] = cnv(64, 512); const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; for (let i = 0; i < 512; i += 32) x.fillRect(0, i, 64, 20);
  const dashT = new THREE.CanvasTexture(c);
  for (const lx of [-1.2, 1.2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 12.2), new THREE.MeshBasicMaterial({ map: dashT, color: new THREE.Color(0.5, 1.6, 0.7), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.set(lx, 0.012, -7.1); laneG.add(m); }
  const [c2, x2] = cnv(64, 256); const g2 = x2.createLinearGradient(0, 256, 0, 0); g2.addColorStop(0, 'rgba(255,255,255,0.9)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = g2; x2.fillRect(0, 0, 64, 256);
  const fadeT = new THREE.CanvasTexture(c2);
  LANES.forEach((lx, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 12), new THREE.MeshBasicMaterial({ map: fadeT, color: new THREE.Color(1.6, 1.2, 0.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.set(lx, 0.014, -7); laneG.add(m); laneGlow.push(m); });
  // danger strip just in front of the net
  const [c3, x3] = cnv(256, 32); for (let i = -32; i < 256; i += 32) { x3.fillStyle = '#ffcf3a'; x3.beginPath(); x3.moveTo(i, 32); x3.lineTo(i + 16, 0); x3.lineTo(i + 32, 0); x3.lineTo(i + 16, 32); x3.fill(); }
  const hz = ctex(c3); hz.wrapS = THREE.RepeatWrapping; hz.repeat.set(4, 1);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.32), new THREE.MeshBasicMaterial({ map: hz, transparent: true, opacity: 0.55, depthWrite: false })); strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.013, DANGER_Z + 0.05); laneG.add(strip);
}
// ground mist (scrolling noise planes, thicker at the zombie end)
const mistT = mistTex();
const mists = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(24, 8), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { map: { value: mistT }, uOff: { value: new THREE.Vector2() }, uCol: { value: new THREE.Color(0.32, 0.8, 0.5) }, uA: { value: 0.4 - i * 0.07 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform vec2 uOff; uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ float n = texture2D(map, vUv * vec2(2.0, 1.5) + uOff).a; float e = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y); gl_FragColor = vec4(uCol, n * e * uA); }',
  }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.12 + i * 0.2, -12.5 + i * 1.3); m.renderOrder = 4; scene.add(m); mists.push(m);
}
// floating spooky motes
const MOTES = 70;
const moteGeo = new THREE.BufferGeometry(); const moteP = new Float32Array(MOTES * 3);
for (let i = 0; i < MOTES; i++) moteP.set([rnd(-9, 9), rnd(0.3, 7), rnd(-18, 3)], i * 3);
moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: glowTex(160, 255, 170), size: 0.16, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(motes);

// ball machine on our side + ball cart
const machine = new THREE.Group(); scene.add(machine);
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.8), new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.4, metalness: 0.3 })); body.position.y = 0.75; machine.add(body);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.7, 20), new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: 0.9, roughness: 0.25 })); tube.rotation.x = -1.0; tube.position.set(0, 1.1, -0.3); machine.add(tube);
  const legM = new THREE.MeshStandardMaterial({ color: '#2b2d33', metalness: 0.6, roughness: 0.4 });
  for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), legM); l.position.set(lx, 0.27, lz); machine.add(l); }
  machine.position.set(MACHINE.x, 0, MACHINE.z + 0.3); machine.lookAt(SET_FROM.x, 0, SET_FROM.z);
}
const fx = { shake: 0, slow: 1, slowT: 0, flashT: 0 };

// ---------------- balls ----------------
const balls = [];
function newBallMesh() { const g = GYM.makeBall(); scene.add(g); const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; scene.add(sh); g.userData.shadow = sh; return g; }
const ballPool = [];
function getBall() { let m = ballPool.pop(); if (!m) m = newBallMesh(); m.visible = true; m.userData.shadow.visible = true; m.scale.setScalar(1); return m; }
function freeBall(b) { b.mesh.visible = false; b.mesh.userData.shadow.visible = false; if (b.fireGlow) b.fireGlow.visible = false; ballPool.push(b.mesh); }
function launchVel(from, to, T) { return new THREE.Vector3((to.x - from.x) / T, (to.y - from.y + 0.5 * G * T * T) / T, (to.z - from.z) / T); }

// timing rings around the contact point
const ringFixed = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex('#ffffff', 8), transparent: true, depthTest: false, toneMapped: false, opacity: 0.85 }));
const ringMove = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex('#ffffff', 6), transparent: true, depthTest: false, toneMapped: false }));
for (const r of [ringFixed, ringMove]) { r.visible = false; r.renderOrder = 11; scene.add(r); }
const fireGlowMat = new THREE.SpriteMaterial({ map: glowTex(255, 140, 40), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

// ---------------- particles (one additive points system) ----------------
const PMAX = 700;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX), pAlpha = new Float32Array(PMAX);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 400 } },
  vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vC * a, a); }',
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
const parts = [];
function burst(pos, n, col, speed = 4, size = 0.12, life = 0.6, grav = 6, spread = 1) {
  for (let i = 0; i < n; i++) {
    if (parts.length >= PMAX) parts.shift();
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * spread, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    const c = Array.isArray(col) ? col[Math.floor(Math.random() * col.length)] : col;
    parts.push({ p: pos.clone(), v: d, life: 0, max: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), col: new THREE.Color(c), grav });
  }
}
function updateParticles(dt) {
  let k = 0;
  for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life += dt; if (q.life > q.max) { parts.splice(i, 1); continue; } q.v.y -= q.grav * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0.02) { q.p.y = 0.02; q.v.y *= -0.3; q.v.x *= 0.7; q.v.z *= 0.7; } }
  for (let i = 0; i < parts.length && k < PMAX; i++, k++) { const q = parts[i]; const f = 1 - q.life / q.max; pPos[k * 3] = q.p.x; pPos[k * 3 + 1] = q.p.y; pPos[k * 3 + 2] = q.p.z; pCol[k * 3] = q.col.r; pCol[k * 3 + 1] = q.col.g; pCol[k * 3 + 2] = q.col.b; pSize[k] = q.size; pAlpha[k] = Math.min(1, f * 1.5); }
  pGeo.setDrawRange(0, k);
  for (const n of ['position', 'color', 'size', 'alpha']) pGeo.attributes[n].needsUpdate = true;
}

// floating score text (sprites)
const floaters = [];
function floatText(text, pos, color = '#ffcf3a', size = 1) {
  const [c, x] = cnv(256, 96); x.font = '700 64px "Bebas Neue", Oswald, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,0.75)'; x.strokeText(text, 128, 50); x.fillStyle = color; x.fillText(text, 128, 50);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex(c), transparent: true, depthTest: false, toneMapped: false })); s.scale.set(1.9 * size, 0.71 * size, 1); s.position.copy(pos); s.renderOrder = 12; scene.add(s);
  floaters.push({ s, t: 0 });
}
function updateFloaters(dt) { for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; f.s.position.y += dt * 1.2; f.s.material.opacity = clamp(1.6 - f.t * 1.6, 0, 1); if (f.t > 1) { scene.remove(f.s); f.s.material.map.dispose(); f.s.material.dispose(); floaters.splice(i, 1); } } }

// ---------------- characters ----------------
let hitter = null, setter = null;
const ZHAIR = ['#3a5a2a', '#5a2a6a', '#22252a', '#6a4a8a', '#2f4f4f', '#7a3a2a'];
const ZTYPES = {
  walker: { kit: ['z-walker', 'z-walker2'], eye: '#fff25a', hp: 2, speed: 0.62, scale: 1.0, jersey: '#5b2a86', trim: '#9ee02e', shorts: '#1a1424', clip: 'Walk_Loop', clipSpeed: 0.75, score: 50, label: 'ZOMBIE' },
  libero: { kit: ['z-libero'], eye: '#b6ff5a', hp: 1, speed: 1.35, scale: 0.9, jersey: '#f0b400', trim: '#5b2a86', shorts: '#1a1424', clip: 'Jog_Fwd_Loop', clipSpeed: 0.8, score: 70, label: 'LIBERO' },
  blocker: { kit: ['z-blocker'], eye: '#ffb84a', hp: 6, speed: 0.42, scale: 1.3, jersey: '#22402a', trim: '#ff8a1e', shorts: '#101410', clip: 'Walk_Loop', clipSpeed: 0.55, score: 150, label: 'BLOCKER' },
  swatter: { kit: ['z-swatter'], eye: '#ff6a5a', hp: 3, speed: 0.55, scale: 1.08, jersey: '#d2541c', trim: '#111114', shorts: '#2a1408', clip: 'Walk_Loop', clipSpeed: 0.7, score: 110, label: 'SWATTER' },
  boss: { kit: ['z-boss'], eye: '#b6ff5a', hp: 16, speed: 0.34, scale: 1.65, jersey: '#2a0d3a', trim: '#9ee02e', shorts: '#0b0610', clip: 'Walk_Loop', clipSpeed: 0.45, score: 600, label: 'BIG COACH' },
};
const zPool = {}; // type -> idle Athlete instances for reuse
let zSeed = 100;
function makeZombieAthlete(type) {
  const T = ZTYPES[type];
  const v = zSeed++;
  const ath = new Athlete({ kit: T.kit[v % T.kit.length], hair: ['long', 'buns', 'pony'][v % 3], hairColor: ZHAIR[v % ZHAIR.length], zombie: true, eyeGlow: T.eye, seed: v, tie: T.trim });
  ath.root.scale.setScalar(T.scale);
  ath.zph = Math.random() * 6; ath.tilt = Math.random() < 0.5 ? 1 : -1;
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.011; ath.blob = blob;
  // hp pips
  const [c, x] = cnv(128, 24); const hpT = ctex(c);
  const hpS = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpT, transparent: true, depthTest: false, toneMapped: false })); hpS.scale.set(0.9, 0.17, 1); hpS.renderOrder = 9;
  ath.hp = { s: hpS, c, x, t: hpT };
  return ath;
}
function drawHp(ath, hp, max) {
  const { x, t } = ath.hp; x.clearRect(0, 0, 128, 24);
  x.fillStyle = 'rgba(0,0,0,0.65)'; x.beginPath(); x.roundRect(0, 2, 128, 20, 8); x.fill();
  const w = 120 / max;
  for (let i = 0; i < max; i++) { x.fillStyle = i < hp ? (max >= 6 ? '#ff8a1e' : '#7dff5a') : '#333'; x.fillRect(4 + i * w + 1, 6, w - 2, 12); }
  t.needsUpdate = true;
}
const zombies = [];
function spawnZombie(type, lane, z = SPAWN_Z, rise = true) {
  const T = ZTYPES[type];
  const ath = (zPool[type] && zPool[type].pop()) || makeZombieAthlete(type);
  scene.add(ath.root); scene.add(ath.blob); scene.add(ath.hp.s);
  ath.blob.visible = !renderer.shadowMap.enabled;
  ath.root.visible = true; ath.root.scale.setScalar(T.scale); ath.lean = 0; ath.dive = 0; ath.jumpY = 0;
  ath.facing = 0; ath.loopPose = type === 'blocker' || type === 'boss' ? 'zblock' : 'zombie'; ath.loopW = 1;
  ath.mat.emissive.setRGB(0, 0, 0);
  ath.play(T.clip, 0, T.clipSpeed);
  const zb = { type, T, ath, lane, x: LANES[lane] + rnd(-0.35, 0.35), z, hp: T.hp, max: T.hp, kv: 0, rise: rise ? 0 : 1, hitT: 0, dead: false, deathT: 0, flash: 0, swatT: 0, groanT: rnd(1, 4), speedMul: 1 };
  ath.root.position.set(zb.x, rise ? -1.9 * T.scale : 0, zb.z);
  drawHp(ath, zb.hp, zb.max); ath.hp.s.visible = false;
  zombies.push(zb);
  if (rise) { burst(new THREE.Vector3(zb.x, 0.2, zb.z), 26, ['#7dff5a', '#3a8a4a', '#c9ffb0'], 2.2, 0.35, 0.9, -0.6, 0.6); sfx.rise(); }
  return zb;
}
function removeZombie(zb) {
  const i = zombies.indexOf(zb); if (i >= 0) zombies.splice(i, 1);
  scene.remove(zb.ath.root); scene.remove(zb.ath.blob); scene.remove(zb.ath.hp.s);
  (zPool[zb.type] ||= []).push(zb.ath);
}

// ---------------- game state ----------------
let state = 'loading';
let gt = 0, lastFrame = performance.now();
const game = { score: 0, lives: 3, wave: 0, combo: 0, maxCombo: 0, kills: 0, perfects: 0, spikes: 0, hits: 0,
  queue: [], spawnT: 0, spawnEvery: 3, waveBreak: 0, speedMul: 1, feedT: 0, feedEvery: 1.6, power: null, powerN: 0, freezeT: 0, lastLane: -1, lane: 1 };
let cur = null;        // the set currently coming to the hitter: { ball, tc, resolved }
let pendingSwipe = null, lastSpike = null;
const hit = { phase: 'idle', t: 0, z: HOME.z, x: 0, jvy: 0, jy: 0 };

function resetGame() {
  for (const zb of [...zombies]) removeZombie(zb);
  for (const b of [...balls]) freeBall(b); balls.length = 0;
  Object.assign(game, { score: 0, lives: 3, wave: 0, combo: 0, maxCombo: 0, kills: 0, perfects: 0, spikes: 0, hits: 0, queue: [], spawnT: 1.2, waveBreak: 0, feedT: 1.2, power: null, powerN: 0, freezeT: 0, lastLane: -1 });
  cur = null; pendingSwipe = null; gt = 0;
  Object.assign(hit, { phase: 'idle', t: 0, z: HOME.z, x: 0, jvy: 0, jy: 0 });
  nextWave();
  drawHud();
}
function waveList(n) {
  const list = []; const count = 6 + n * 2;
  for (let i = 0; i < count; i++) {
    let t = 'walker'; const r = Math.random();
    if (n >= 2 && r < 0.22) t = 'libero';
    else if (n >= 3 && r < 0.38) t = 'blocker';
    else if (n >= 4 && r < 0.52) t = 'swatter';
    list.push(t);
  }
  if (n % 5 === 0) list.push('boss');
  return list;
}
function nextWave() {
  game.wave++;
  game.queue = waveList(game.wave);
  game.spawnEvery = Math.max(0.95, 2.7 - game.wave * 0.2);
  game.speedMul = 1 + (game.wave - 1) * 0.07;
  game.feedEvery = Math.max(1.12, 1.6 - game.wave * 0.04);
  game.spawnT = 1.5;
  banner(`WAVE ${game.wave}`, game.wave % 5 === 0 ? '⚠ BIG COACH INCOMING ⚠' : (game.wave === 1 ? 'Swipe up to spike!' : `${game.queue.length} zombies`));
  sfx.wave(); drawHud();
  scoreboard.userData.draw(game.wave, game.lives, 'WAVE', 'LIVES', -1, 'GCVC UNITED vs ZOMBIES');
}
function pickLane() { let l; do { l = Math.floor(Math.random() * 3); } while (l === game.lastLane && Math.random() < 0.6); game.lastLane = l; return l; }

// ---------------- feed: ball machine -> setter -> hitter ----------------
function feedBall() {
  const mesh = getBall();
  const b = { mesh, p: MACHINE.clone(), v: launchVel(MACHINE, SET_FROM, 0.85), phase: 'toSetter', t: 0, T: 0.85 };
  mesh.position.copy(b.p); balls.push(b);
  sfx.serve();
}
function setBall(b) {
  const T = 1.0;
  b.phase = 'set'; b.p.copy(SET_FROM);
  // aim so the ball's apex lands right at CONTACT at time T
  const vy = G * T, y0 = CONTACT.y - 0.5 * G * T * T;
  b.p.y = Math.min(SET_FROM.y, y0); // start a touch lower if needed for a clean apex
  b.v.set((CONTACT.x - b.p.x) / T, (CONTACT.y - b.p.y + 0.5 * G * T * T) / T, (CONTACT.z - b.p.z) / T);
  b.tc = gt + T; b.resolved = false;
  cur = b;
  setter.setPose('set', 0.55);
  sfx.set();
  // hitter approach timing
  hit.phase = 'wait'; hit.tc = b.tc;
}

// ---------------- spiking ----------------
function frontZombie(lane) {
  let best = null;
  for (const zb of zombies) if (!zb.dead && zb.lane === lane && zb.rise > 0.55 && (!best || zb.z > best.z)) best = zb;
  return best;
}
function chestOf(zb, out = new THREE.Vector3()) { return out.set(zb.x, 1.2 * zb.T.scale + zb.ath.root.position.y, zb.z + 0.15); }
function grade(dt) { const a = Math.abs(dt); if (a <= WIN.perfect) return 'perfect'; if (a <= WIN.good) return 'good'; if (a <= WIN.ok) return 'ok'; return dt < 0 ? 'early' : 'late'; }
function onSpike(lane, ts) {
  if (state !== 'play') return;
  showLane(lane);
  if (!cur || cur.resolved) return; // nothing to hit yet
  const t = gtAt(ts);
  const dt = t - cur.tc;
  if (dt < -WIN.max) return; // way too early: ignore, the ball isn't there yet
  doSpike(cur, lane, grade(dt), dt);
}
function doSpike(b, lane, g, dt) {
  b.resolved = true; cur = null;
  game.spikes++; lastSpike = { lane, grade: g, dt: +dt.toFixed(3), t: gt };
  hitter.setPose('swing', 0.42); hitter.facing = Math.PI - (LANES[lane]) * 0.07;
  hit.swungAt = gt;
  b.lane = lane; b.grade = g;
  const from = b.p.clone().setY(Math.max(b.p.y, 2.7));
  if (g === 'early' || g === 'late') {
    game.combo = 0;
    if (g === 'early') { // into the net
      b.phase = 'path'; b.path = { p0: from, p1: new THREE.Vector3(LANES[lane] * 0.3, 2.3, 0.2), p2: new THREE.Vector3(LANES[lane] * 0.35, 1.5, 0.02), T: 0.22, t: 0, end: 'net' };
      pop('TOO EARLY', '#ff6a5a', 'into the net'); sfx.spike(0.5);
    } else {
      b.phase = 'path'; b.path = { p0: from, p1: new THREE.Vector3(LANES[lane] * 1.2, 5.6, -8), p2: new THREE.Vector3(LANES[lane] * 2.4, 3.0, -20), T: 0.9, t: 0, end: 'out' };
      pop('TOO LATE', '#ff6a5a', 'out!'); sfx.spike(0.6);
    }
    buzz('light'); drawHud(); return;
  }
  const power = game.power;
  const lanes = power === 'triple' ? [0, 1, 2] : [lane];
  const T = g === 'perfect' ? 0.3 : g === 'good' ? 0.4 : 0.52;
  sfx.spike(g === 'perfect' ? 1.3 : g === 'good' ? 1 : 0.7);
  if (g === 'perfect') { sfx.perfect(); game.perfects++; fx.slow = 0.35; fx.slowT = 0.14; flash(0.25); buzz('heavy'); } else buzz('medium');
  pop(g === 'perfect' ? 'PERFECT!' : g === 'good' ? 'NICE!' : 'OK', g === 'perfect' ? '#ffcf3a' : g === 'good' ? '#7dff5a' : '#fff');
  burst(from, g === 'perfect' ? 30 : 14, ['#ffffff', '#ffcf3a'], 5, 0.12, 0.35, 2);
  lanes.forEach((ln, i) => {
    let bb = b;
    if (i > 0 || (lanes.length > 1 && ln !== lane)) { if (ln === lane) { } else { bb = { mesh: getBall(), p: from.clone(), v: new THREE.Vector3() }; balls.push(bb); } }
    const zb = frontZombie(ln);
    const target = zb ? chestOf(zb) : new THREE.Vector3(LANES[ln], 0.13, -6.5 - (g === 'perfect' ? 0 : 1.5));
    bb.phase = 'path'; bb.grade = g; bb.lane = ln; bb.fire = power === 'fire';
    bb.path = { p0: from.clone(), p1: new THREE.Vector3((from.x + LANES[ln]) * 0.5, Math.max(3.1, from.y + 0.15), -0.6), p2: target, T, t: 0, end: 'zombie', zb };
    if (bb.fire) { if (!bb.fireGlow) { bb.fireGlow = new THREE.Sprite(fireGlowMat); bb.fireGlow.scale.setScalar(1.1); scene.add(bb.fireGlow); } bb.fireGlow.visible = true; }
  });
  if (power === 'triple' || power === 'fire') { if (--game.powerN <= 0) game.power = null; }
  drawHud();
}
function bez(p, t, out) { const a = (1 - t) * (1 - t), b2 = 2 * (1 - t) * t, c = t * t; return out.set(a * p.p0.x + b2 * p.p1.x + c * p.p2.x, a * p.p0.y + b2 * p.p1.y + c * p.p2.y, a * p.p0.z + b2 * p.p1.z + c * p.p2.z); }
function impact(b) {
  const P = b.path, g = b.grade;
  if (P.end === 'net') { GYM.shakeNet(netG, b.p.x, 0.12); sfx.net(); b.phase = 'free'; b.v.set(rnd(-0.5, 0.5), -0.5, 1.2); b.t = 0; return; }
  if (P.end === 'out') { b.phase = 'free'; b.v.set(0, -2, -6); b.t = 0; return; }
  const zb = P.zb;
  if (!zb || zb.dead || zb.lane !== b.lane) { // floor hit, no zombie
    sfx.floor(); burst(b.p, 10, ['#ffffff', '#d9dde2'], 3, 0.08, 0.4, 6); b.phase = 'free'; b.v.set(rnd(-1, 1), 4, -5); b.t = 0;
    if (!zb) { game.combo = 0; drawHud(); }
    return;
  }
  // swatter blocks anything that isn't perfect or fire
  if (zb.type === 'swatter' && g !== 'perfect' && !b.fire && Math.random() < 0.6) {
    zb.swatT = 0.6; zb.ath.setPose('zblock', 0.6); sfx.block(); floatText('SWATTED!', chestOf(zb).add(new THREE.Vector3(0, 0.8, 0)), '#ff8a1e');
    b.phase = 'free'; b.v.set(rnd(-1.5, 1.5), 4.5, 7.5); b.t = 0; game.combo = 0; drawHud(); buzz('light'); return;
  }
  let dmg = g === 'perfect' ? 3 : g === 'good' ? 2 : 1;
  if (b.fire) dmg *= 2;
  hurtZombie(zb, dmg, g === 'perfect' || b.fire);
  if (b.fire) { for (const o of zombies) if (o !== zb && !o.dead && o.lane === zb.lane) hurtZombie(o, dmg, true); burst(b.p, 40, ['#ff8a1e', '#ffcf3a', '#ff3a1e'], 6, 0.2, 0.6, 2); }
  b.phase = 'free'; b.v.set(rnd(-2, 2), rnd(3, 5), 2.5 + (g === 'perfect' ? 2 : 0)); b.t = 0;
  game.combo++; game.maxCombo = Math.max(game.maxCombo, game.combo); game.hits++;
  if (game.combo > 0 && game.combo % 10 === 0) givePower();
  drawHud();
}
function mult() { return Math.min(5, 1 + Math.floor(game.combo / 5)); }
function hurtZombie(zb, dmg, knock) {
  zb.hp -= dmg; zb.flash = 0.25; zb.hitT = 0.45;
  addScore(10 * dmg, null);
  burst(chestOf(zb), 18, ['#ffffff', '#b6ff5a', '#ffcf3a'], 4, 0.14, 0.45, 4);
  sfx.bonk(); fx.shake = Math.max(fx.shake, knock ? 0.22 : 0.1);
  if (knock) zb.kv = -(zb.type === 'boss' ? 1.5 : zb.type === 'blocker' ? 2.2 : 4.0);
  if (zb.hp <= 0) killZombie(zb);
  else { zb.ath.play('Hit_Chest', 0.08, 1.4); drawHp(zb.ath, zb.hp, zb.max); zb.ath.hp.s.visible = true; }
}
function killZombie(zb) {
  zb.dead = true; zb.deathT = 0; zb.ath.hp.s.visible = false;
  game.kills++;
  const pts = zb.T.score;
  addScore(pts, chestOf(zb).add(new THREE.Vector3(0, 0.9, 0)));
  if (Math.random() < (zb.type === 'boss' ? 1 : 0.13)) givePower();
  zb.ath.play('Hit_Chest', 0.05, 1.2);
}
function addScore(base, at) { const s = base * mult(); game.score += s; if (at) floatText('+' + s, at, mult() > 1 ? '#ffcf3a' : '#ffffff', 1); drawHud(); }
const POWERS = { fire: '🔥 FIREBALL x3', triple: '✨ TRIPLE SPIKE x2', freeze: '❄️ FREEZE', heart: '❤️ EXTRA LIFE' };
function givePower(kind) {
  if (!kind) { const opts = ['fire', 'triple', 'freeze']; if (game.lives < 5) opts.push('heart', 'heart'); kind = opts[Math.floor(Math.random() * opts.length)]; }
  sfx.power(); buzz('medium');
  if (kind === 'heart') { game.lives = Math.min(5, game.lives + 1); banner('❤️ +1 LIFE', ''); }
  else if (kind === 'freeze') { game.freezeT = 6; sfx.freeze(); banner('❄️ FREEZE!', 'zombies slowed'); }
  else { game.power = kind; game.powerN = kind === 'fire' ? 3 : 2; banner(POWERS[kind], 'next spikes powered up'); }
  drawHud();
}
function loseLife(zb) {
  game.lives--; game.combo = 0;
  sfx.hurt(); buzz('heavy'); flashColor('#ff2040', 0.45); fx.shake = 0.4;
  GYM.shakeNet(netG, zb.x, 0.3);
  burst(chestOf(zb), 40, ['#7dff5a', '#3a8a4a', '#c9ffb0'], 4, 0.3, 0.8, 1);
  removeZombie(zb);
  drawHud(); scoreboard.userData.draw(game.wave, Math.max(0, game.lives), 'WAVE', 'LIVES', -1, 'GCVC UNITED vs ZOMBIES');
  if (game.lives <= 0) gameOver();
}

// ---------------- update ----------------
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function update(dtR) {
  const dt = dtR * fx.slow * TEST_SLOW;
  if (fx.slowT > 0) { fx.slowT -= dtR; if (fx.slowT <= 0) fx.slow = 1; }
  if (state === 'play') { gt += dt; stepGame(dt); }
  else if (state === 'menu' || state === 'over' || state === 'proof') menuStep(dt);
  stepBalls(state === 'pause' ? 0 : dt);
  stepHitter(state === 'pause' ? 0 : dt);
  stepZombies(state === 'pause' ? 0 : dt);
  if (state !== 'pause') { hitter.update(dt); setter.update(dt); }
  GYM.updateNet(netG, dt);
  updateParticles(dt); updateFloaters(dt);
  // atmosphere
  const tt = performance.now() / 1000;
  mists.forEach((m, i) => { m.material.uniforms.uOff.value.set(tt * (0.012 + i * 0.006) * (i % 2 ? -1 : 1), tt * 0.008 + i * 0.3); });
  for (let i = 0; i < MOTES; i++) { moteP[i * 3 + 1] += Math.sin(tt * 0.7 + i) * 0.002; moteP[i * 3] += Math.cos(tt * 0.5 + i * 1.3) * 0.002; }
  moteGeo.attributes.position.needsUpdate = true;
  gateLight.intensity = 0.9 + Math.sin(tt * 2.1) * 0.12 + (Math.random() < 0.02 ? -0.4 : 0);
  if (crowd) crowd.uni.uTime.value = tt;
  const inMenu = state === 'menu' || state === 'over'; menuLight.intensity += ((inMenu ? 18 : 0) - menuLight.intensity) * Math.min(1, dtR * 4); if (inMenu) gateLight.intensity *= 0.35; zoneFill.intensity += ((inMenu ? 0 : 140) - zoneFill.intensity) * Math.min(1, dtR * 4);
  laneGlow.forEach((m, i) => { m.material.opacity = Math.max(0, m.material.opacity - dtR * 1.8); });
  updateCamera(dtR);
}
function stepGame(dt) {
  // spawns
  if (game.waveBreak > 0) { game.waveBreak -= dt; if (game.waveBreak <= 0) nextWave(); }
  else {
    game.spawnT -= dt;
    if (game.spawnT <= 0 && game.queue.length) {
      const t = game.queue.shift(); spawnZombie(t, t === 'boss' ? 1 : pickLane());
      game.spawnT = game.spawnEvery * rnd(0.7, 1.25);
      if (Math.random() < 0.3 && game.queue.length && game.wave >= 3) game.spawnT *= 0.35; // occasional pairs
    }
    if (!game.queue.length && !zombies.length) { game.waveBreak = 3.2; addScore(100 * game.wave, null); banner(`WAVE ${game.wave} CLEARED`, `+${100 * game.wave * mult()} bonus`); sfx.fanfare(); crowdLevel(0.8); setTimeout(() => crowdLevel(0.25), 1500); }
  }
  if (game.freezeT > 0) game.freezeT -= dt;
  // constant feed
  game.feedT -= dt;
  const busy = balls.some(b => b.phase === 'toSetter') || (cur && !cur.resolved && cur.tc - gt > 0.45);
  if (game.feedT <= 0 && !busy) { feedBall(); game.feedT = game.feedEvery; }
  // timing rings
  if (cur && !cur.resolved) {
    const left = cur.tc - gt;
    if (left < -WIN.ok - 0.05) { // missed it entirely
      cur.resolved = true; cur.phase = 'set'; cur = null; game.combo = 0; pop('MISSED', '#ff6a5a'); drawHud();
      hitter.setPose('swing', 0.4);
    }
  }
  if (cur && !cur.resolved) {
    const left = cur.tc - gt;
    ringFixed.visible = ringMove.visible = left < 1.0;
    ringFixed.position.copy(CONTACT); ringMove.position.copy(CONTACT);
    const s = 0.55 + Math.max(0, left) * 2.2; ringFixed.scale.setScalar(0.55); ringMove.scale.setScalar(s);
    const hot = Math.abs(left) <= WIN.perfect;
    ringMove.material.color.set(hot ? '#ffcf3a' : (Math.abs(left) <= WIN.good ? '#7dff5a' : '#ffffff'));
    ringFixed.material.color.set(hot ? '#ffcf3a' : '#ffffff');
    if (!save.tut || game.wave === 1) prompt(hot ? 'SWIPE NOW!' : 'Swipe ↖ ⬆ ↗ when the ring turns gold', hot); else prompt('');
  } else { ringFixed.visible = ringMove.visible = false; if (game.wave === 1) prompt(''); }
}
function stepBalls(dt) {
  if (!dt) return;
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.phase === 'toSetter') {
      b.v.y -= G * dt; b.p.addScaledVector(b.v, dt); b.t += dt;
      if (b.t >= b.T) setBall(b);
    } else if (b.phase === 'set' || b.phase === 'free') {
      b.v.y -= G * dt; b.p.addScaledVector(b.v, dt);
      if (b.p.y < 0.13) { b.p.y = 0.13; if (b.v.y < -1.5) sfx.floor(); b.v.y *= -0.5; b.v.x *= 0.8; b.v.z *= 0.8; }
      if (b.phase === 'free') { b.t += dt; if (b.t > 1.8) { freeBall(b); balls.splice(i, 1); continue; } }
      if (b.phase === 'set' && b.resolved && b.p.y <= 0.14 && b !== cur) { b.phase = 'free'; b.t = 0.8; }
    } else if (b.phase === 'path') {
      const P = b.path; P.t += dt;
      if (P.end === 'zombie' && P.zb && !P.zb.dead && P.zb.lane === b.lane) chestOf(P.zb, P.p2);
      const k = Math.min(1, P.t / P.T);
      const prev = tmpV2.copy(b.p);
      bez(P, k, b.p);
      // trail
      if (tier.mist || Math.random() < 0.5) burst(b.p, b.fire ? 3 : 1, b.fire ? ['#ff8a1e', '#ffcf3a', '#ff3a1e'] : (b.grade === 'perfect' ? '#ffcf3a' : '#ffffff'), 0.4, b.fire ? 0.35 : 0.16, 0.25, 0);
      b.v.copy(b.p).sub(prev).divideScalar(Math.max(dt, 1e-4));
      if (k >= 1) impact(b);
    }
    b.mesh.position.copy(b.p);
    b.mesh.rotation.x += dt * (b.phase === 'path' ? 30 : 6); b.mesh.rotation.z += dt * 3;
    const sh = b.mesh.userData.shadow; sh.position.set(b.p.x, 0.012, b.p.z); const sc = clamp(1.2 - b.p.y * 0.2, 0.3, 1.2); sh.scale.setScalar(sc); sh.material.opacity = clamp(1 - b.p.y * 0.18, 0.2, 0.9);
    if (b.fireGlow) { b.fireGlow.position.copy(b.p); if (b.phase !== 'path') b.fireGlow.visible = false; }
  }
}
function stepHitter(dt) {
  if (!dt) return;
  // approach + jump driven by the next contact time
  const tc = hit.tc;
  const toC = tc != null ? tc - gt : 99;
  if (state === 'play' && cur && !cur.resolved && toC < 0.68 && hit.phase !== 'air') {
    if (toC > 0.4) { if (hit.phase !== 'approach') { hit.phase = 'approach'; hitter.play('Jog_Fwd_Loop', 0.1, 1.3); } hit.z += (CONTACT.z + 0.32 - hit.z) * Math.min(1, dt * 9); }
    else { hit.phase = 'air'; hit.jvy = G * toC; hit.jy = 0.001; hitter.play('Jump_Loop', 0.08, 1); hitter.setPose('cock', toC + 0.25); sfx.squeak(); }
  }
  if (hit.phase === 'air') {
    hit.jvy -= G * dt; hit.jy += hit.jvy * dt; hit.z += (CONTACT.z + 0.32 - hit.z) * Math.min(1, dt * 6);
    if (hit.jy <= 0) { hit.jy = 0; hit.phase = 'land'; hit.t = 0; hitter.play('Ready', 0.15); sfx.squeak(); }
  } else if (hit.phase === 'land' || hit.phase === 'idle' || hit.phase === 'wait') {
    hit.t += dt; hit.z += (HOME.z - hit.z) * Math.min(1, dt * 3);
    if (hit.phase === 'land' && hit.t > 0.3) { hit.phase = 'idle'; }
    if (state === 'play') hitter.play('Ready', 0.2);
    if (state === 'play') hitter.facing += (Math.PI - hitter.facing) * Math.min(1, dt * 4);
  }
  hitter.jumpY = hit.jy;
  hitter.root.position.set(hit.x, 0, hit.z);
  // setter faces the hitter, small bounce
  setter.root.position.copy(SETTER);
}
function stepZombies(dt) {
  if (!dt) return;
  const slowF = game.freezeT > 0 ? 0.45 : 1;
  for (let i = zombies.length - 1; i >= 0; i--) {
    const zb = zombies[i], a = zb.ath;
    if (zb.rise < 1) { zb.rise = Math.min(1, zb.rise + dt * 1.4); a.root.position.y = -1.9 * zb.T.scale * Math.pow(1 - zb.rise, 2); }
    if (zb.dead) {
      zb.deathT += dt;
      a.lean = -Math.min(1.35, zb.deathT * 4.5); a.root.position.y = 0;
      if (zb.deathT > 0.42 && !zb.poofed) { zb.poofed = true; sfx.poof(); burst(chestOf(zb), 45, ['#7dff5a', '#ffffff', '#ffcf3a', '#b06aff'], 4.5, 0.26, 0.9, -1, 1); burst(chestOf(zb), 12, ['#c9ffb0'], 1.2, 0.8, 1.2, -0.5, 0.4); }
      if (zb.deathT > 0.42) a.root.scale.setScalar(zb.T.scale * Math.max(0.01, 1 - (zb.deathT - 0.42) * 5));
      if (zb.deathT > 0.65) { removeZombie(zb); continue; }
    } else {
      if (zb.hitT > 0) { zb.hitT -= dt; if (zb.hitT <= 0) a.play(zb.T.clip, 0.2, zb.T.clipSpeed); }
      const sp = zb.T.speed * game.speedMul * slowF * (zb.hitT > 0 ? 0.25 : 1);
      if (state === 'play' && zb.rise >= 1) zb.z += sp * dt;
      zb.z += zb.kv * dt; zb.kv *= Math.exp(-dt * 6); zb.z = Math.max(zb.z, SPAWN_Z - 1.5);
      if (zb.swatT > 0) zb.swatT -= dt;
      zb.groanT -= dt; if (zb.groanT <= 0 && state === 'play') { zb.groanT = rnd(3, 7); if (zb.z > -9) sfx.moan(zb.T.scale > 1.2 ? 0.7 : (zb.type === 'libero' ? 1.4 : 1)); }
      if (state === 'play' && zb.z >= DANGER_Z) { loseLife(zb); continue; }
      a.root.position.x = zb.x; a.root.position.z = zb.z;
    }
    if (zb.flash > 0) { zb.flash -= dt; a.mat.emissive.setRGB(zb.flash * 3, zb.flash * 3, zb.flash * 3); }
    else a.mat.emissive.setRGB(0, game.freezeT > 0 ? 0.05 : 0, game.freezeT > 0 ? 0.25 : 0);
    a.blob.position.set(a.root.position.x, 0.011, a.root.position.z);
    a.hp.s.position.set(a.root.position.x, a.root.position.y + 2.05 * zb.T.scale, a.root.position.z);
    a.update(dt);
  }
}

// ---------------- camera ----------------
const camPos = new THREE.Vector3(0, 5.7, 7.3), camLook = new THREE.Vector3(0, 0.3, -6.4);
let menuT = 0;
function updateCamera(dtR) {
  if (qs.get('cam') === 'body') { camera.position.set(0.3, 1.25, 3.3); camera.lookAt(0, 1.05, 1.15); return; }
  if (qs.get('cam') === 'zombie') { const z = zombies[1] || zombies[0]; const hp = new THREE.Vector3().setFromMatrixPosition(z.ath.bones['Head'].matrixWorld); camera.position.set(hp.x + 0.2, hp.y + 0.1, hp.z + 1.0); camera.lookAt(hp.x, hp.y - 0.05, hp.z); return; }
  if (qs.get('cam') === 'face') { const h = hitter.bones['Head']; const hp = new THREE.Vector3().setFromMatrixPosition(h.matrixWorld); camera.position.set(hp.x + 0.15, hp.y + 0.05, hp.z + 0.75); camera.lookAt(hp.x, hp.y + 0.05, hp.z); return; }
  if (state === 'menu' || state === 'over') {
    // slow orbit in front of the hitter so you see her face and the zombies behind her
    const a = Math.sin(menuT * 0.25) * 0.35;
    camera.position.set(Math.sin(a) * 0.9, 1.45, 3.75);
    camera.lookAt(Math.sin(a) * 0.15, 1.12, 0.2);
    return;
  }
  if (state === 'proof') { camera.position.copy(camPos); camera.lookAt(camLook); return; }
  camera.position.copy(camPos);
  if (fx.shake > 0) { fx.shake = Math.max(0, fx.shake - dtR * 1.6); camera.position.x += (Math.random() - 0.5) * fx.shake; camera.position.y += (Math.random() - 0.5) * fx.shake; }
  camera.lookAt(camLook);
}
function menuStep(dt) {
  menuT += dt;
  // ambient: a few zombies shuffling in place behind the net on the title screen
}

// ---------------- UI ----------------
let popTimer = 0;
function pop(text, color = '#fff', sub = '') { const el = $('pop'); el.classList.remove('hidden'); el.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); el.style.color = color; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(popTimer); popTimer = setTimeout(() => el.classList.add('hidden'), 900); }
let bannerTimer = 0;
function banner(text, sub = '') { const el = $('banner'); el.classList.remove('hidden'); el.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => el.classList.add('hidden'), 2200); }
let promptKey = '';
function prompt(text, hot = false) { const el = $('prompt'); if (!text) { if (promptKey) el.classList.add('hidden'); promptKey = ''; return; } const k = text + hot; if (k === promptKey) return; promptKey = k; el.innerHTML = text; el.classList.remove('hidden'); el.classList.toggle('hot', hot); }
function flash(a = 0.5) { flashColor('#ffffff', a); }
function flashColor(col, a) { const f = $('flash'); f.style.background = col; f.style.transition = 'none'; f.style.opacity = a; void f.offsetWidth; f.style.transition = 'opacity .35s'; f.style.opacity = 0; }
function drawHud() {
  $('score').textContent = game.score;
  $('waveLbl').textContent = 'WAVE ' + game.wave;
  $('lives').innerHTML = Array.from({ length: Math.max(3, game.lives) }, (_, i) => `<i class="${i < game.lives ? '' : 'off'}">❤️</i>`).join('');
  const m = mult();
  $('comboFill').style.width = (m >= 5 ? 100 : (game.combo % 5) / 5 * 100) + '%';
  $('comboTxt').textContent = 'COMBO ' + game.combo; $('mult').textContent = 'x' + m;
  $('combo').classList.toggle('hot', m >= 3);
  const pw = $('power');
  if (game.power) { pw.classList.remove('hidden'); pw.textContent = (game.power === 'fire' ? '🔥 FIREBALL' : '✨ TRIPLE') + ' ×' + game.powerN; }
  else if (game.freezeT > 0) { pw.classList.remove('hidden'); pw.textContent = '❄️ FREEZE'; }
  else pw.classList.add('hidden');
}
function showLane(l) {
  laneGlow[l].material.opacity = 0.55;
  [...$('lanes').children].forEach((el, i) => el.classList.toggle('on', i === l));
  clearTimeout(showLane.t); showLane.t = setTimeout(() => [...$('lanes').children].forEach(el => el.classList.remove('on')), 260);
}
function show(id) { for (const s of ['menu', 'pause', 'over', 'tut', 'loading']) $(s).classList.toggle('hidden', s !== id); }

// ---------------- input ----------------
const gtAt = ts => gt + clamp((ts - lastFrame) * 0.001, -0.05, 0.05) * fx.slow * TEST_SLOW;
function laneFrom(dx, dy) {
  const ang = Math.atan2(dx, -dy); // 0 = straight up, + = right
  if (dy > 10 && Math.abs(dx) < Math.abs(dy)) return 1; // downward swipe: middle
  if (ang < -0.3) return 0; if (ang > 0.3) return 2; return 1;
}
const ptr = { id: null, x: 0, y: 0, fired: false };
function down(e) { if (state !== 'play') return; initAudio(); ptr.id = e.pointerId; ptr.x = e.clientX; ptr.y = e.clientY; ptr.fired = false; }
function move(e) {
  if (e.pointerId !== ptr.id || ptr.fired || state !== 'play') return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  if (Math.hypot(dx, dy) >= 26) { ptr.fired = true; onSpike(laneFrom(dx, dy), e.timeStamp || performance.now()); }
}
function up(e) {
  if (e.pointerId !== ptr.id) return; ptr.id = null;
  if (!ptr.fired && state === 'play') { const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; onSpike(Math.hypot(dx, dy) < 26 ? 1 : laneFrom(dx, dy), e.timeStamp || performance.now()); }
}
container.addEventListener('pointerdown', down);
addEventListener('pointermove', move);
addEventListener('pointerup', up); addEventListener('pointercancel', e => { if (e.pointerId === ptr.id) ptr.id = null; });
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (state === 'play') {
    initAudio();
    if (k === 'arrowleft' || k === 'a') onSpike(0, e.timeStamp);
    else if (k === 'arrowup' || k === 'w' || k === ' ') onSpike(1, e.timeStamp);
    else if (k === 'arrowright' || k === 'd') onSpike(2, e.timeStamp);
    else if (k === 'escape' || k === 'p') togglePause();
  } else if (state === 'pause' && (k === 'escape' || k === 'p')) togglePause();
});

// ---------------- flow ----------------
function stageMenu() {
  for (const zb of [...zombies]) removeZombie(zb);
  for (const b of [...balls]) freeBall(b); balls.length = 0; cur = null;
  ringFixed.visible = ringMove.visible = false;
  hit.phase = 'idle'; hit.jy = 0; hit.z = HOME.z; hit.tc = null;
  hitter.facing = 0.0; hitter.play('Idle_Loop', 0);
  [[0, -4.2], [1, -6.0], [2, -3.6], [0, -8.5], [2, -9.5], [1, -11]].forEach(([l, z], i) => {
    const zb = spawnZombie(['walker', 'blocker', 'swatter', 'libero', 'walker', 'walker'][i], l, z, false);
  });
}
function goMenu() {
  state = 'menu'; show('menu'); $('hud').classList.add('hidden'); prompt('');
  $('mBest').textContent = save.best; $('mWave').textContent = save.bestWave;
  $('muteBtn').textContent = isMuted() ? '🔇 Sound' : '🔊 Sound';
  $('gfxBtn').textContent = '✨ ' + (save.gfx === 'auto' ? 'Auto' : save.gfx[0].toUpperCase() + save.gfx.slice(1));
  stageMenu(); crowdLevel(0.2);
}
function startGame() {
  initAudio(); sfx.click();
  if (!save.tut) { show('tut'); $('tutGo').onclick = () => { save.tut = true; persist(); startGame(); }; return; }
  show(null); $('hud').classList.remove('hidden');
  for (const zb of [...zombies]) removeZombie(zb);
  hitter.facing = Math.PI; hitter.play('Ready', 0.2);
  state = 'play'; resetGame(); crowdLevel(0.3); sfx.whistle();
  save.played++; persist();
}
function gameOver() {
  state = 'over'; ringFixed.visible = ringMove.visible = false; prompt('');
  const isBest = game.score > save.best;
  if (isBest) save.best = game.score; save.bestWave = Math.max(save.bestWave, game.wave); persist();
  sfx.lose();
  setTimeout(() => {
    if (state !== 'over') return;
    show('over'); $('hud').classList.add('hidden');
    $('oScore').textContent = game.score;
    $('oBest').innerHTML = isBest ? '🏆 NEW BEST!' : `Best: ${save.best}`;
    $('oStats').innerHTML = `Wave ${game.wave} · ${game.kills} zombies bonked<br>${game.perfects} perfect spikes · best combo ${game.maxCombo}`;
    hitter.facing = 0; stageMenu();
  }, 1300);
}
function togglePause() {
  if (state === 'play') { state = 'pause'; show('pause'); }
  else if (state === 'pause') { state = 'play'; show(null); lastFrame = performance.now(); }
}
function wireUI() {
  $('playBtn').onclick = startGame;
  $('howBtn').onclick = () => { sfx.click(); show('tut'); $('tutGo').onclick = () => { save.tut = true; persist(); goMenu(); }; };
  $('pHowBtn').onclick = () => { sfx.click(); show('tut'); $('tutGo').onclick = () => { show('pause'); }; };
  $('muteBtn').onclick = () => { initAudio(); setMuted(!isMuted()); save.muted = isMuted(); persist(); $('muteBtn').textContent = isMuted() ? '🔇 Sound' : '🔊 Sound'; sfx.click(); };
  $('gfxBtn').onclick = () => {
    const order = ['auto', 'high', 'medium', 'low']; save.gfx = order[(order.indexOf(save.gfx) + 1) % 4]; persist();
    applyTier(save.gfx === 'auto' ? (save.autoTier || 'medium') : save.gfx);
    $('gfxBtn').textContent = '✨ ' + (save.gfx === 'auto' ? 'Auto' : save.gfx[0].toUpperCase() + save.gfx.slice(1)); sfx.click();
  };
  $('pauseBtn').onclick = () => { sfx.click(); togglePause(); };
  $('resumeBtn').onclick = () => { sfx.click(); togglePause(); };
  $('quitBtn').onclick = () => { sfx.click(); goMenu(); };
  $('againBtn').onclick = () => startGame();
  $('homeBtn').onclick = () => { sfx.click(); goMenu(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
}

// ---------------- quality ----------------
function applyTier(name) {
  tierName = name; tier = TIERS[name];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
  const wantShadow = tier.shadow > 0;
  if (renderer.shadowMap.enabled !== wantShadow) { renderer.shadowMap.enabled = wantShadow; scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); }); }
  key.castShadow = wantShadow;
  if (wantShadow && key.shadow.mapSize.x !== tier.shadow) { key.shadow.mapSize.set(tier.shadow, tier.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  for (const zb of zombies) zb.ath.blob.visible = !wantShadow;
  if (hitter) { hitter.blob.visible = setter.blob.visible = !wantShadow; }
  if (crowd) for (const m of crowd.group.children) m.count = Math.floor(crowd.count * tier.crowd);
  mists.forEach((m, i) => m.visible = tier.mist > 0 || i === 0);
  if (tier.reflect && !reflector && floor) makeReflector();
  if (reflector) reflector.visible = tier.reflect;
  if (floor) floor.material.clearcoat = name === 'low' ? 0 : 0.6;
  resize();
}
function makeReflector() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  reflector = new Reflector(new THREE.PlaneGeometry(16, 26), {
    textureWidth: Math.round(size.x / 2), textureHeight: Math.round(size.y / 2), clipBias: 0.003, multisample: 0,
    shader: {
      name: 'FloorReflection', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
      vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW; void main(){ vUv = textureMatrix * vec4(position,1.0); vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec4 vUv; varying vec3 vW; void main(){ vec3 c = min(texture2DProj(tDiffuse, vUv).rgb, vec3(0.6)); float edge = smoothstep(8.0, 6.5, abs(vW.x)) * smoothstep(13.0, 11.0, abs(vW.z)); gl_FragColor = vec4(c, 0.2 * edge); }',
    },
  });
  reflector.material.transparent = true; reflector.material.depthWrite = false;
  reflector.rotation.x = -Math.PI / 2; reflector.position.y = 0.006; reflector.renderOrder = 1;
  scene.add(reflector);
}

// ---------------- boot / loop ----------------
const autoQuality = () => !TIERS[qParam] && save.gfx === 'auto';
let ftAcc = 0, ftN = 0, fastWindows = 0, upgrades = 0;
function frame(now) {
  const raw = (now - lastFrame) / 1000; lastFrame = now;
  try { if (hitter) update(Math.min(0.05, raw)); } catch (e) { console.error(e); }
  pMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  if (tier.bloom) { if (!composer) { buildComposer(); resize(); } composer.render(); }
  else renderer.render(scene, camera);
  if (autoQuality() && raw < 0.25 && state !== 'loading') {
    ftAcc += raw; ftN++;
    if (ftN >= 90) {
      const avg = ftAcc / ftN; ftAcc = 0; ftN = 0;
      const idx = TIER_ORDER.indexOf(tierName);
      if (avg > 0.022 && idx < 2) { applyTier(TIER_ORDER[idx + 1]); save.autoTier = tierName; persist(); fastWindows = 0; }
      else if (avg < 0.0125 && idx > 0 && upgrades < 1) { if (++fastWindows >= 3) { upgrades++; fastWindows = 0; applyTier(TIER_ORDER[idx - 1]); save.autoTier = tierName; persist(); } }
      else fastWindows = 0;
    }
  }
  requestAnimationFrame(frame);
}
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image ' + src)); i.src = src; });
async function boot() {
  const bar = $('loadBar');
  resize(); applyTier(tierName);
  requestAnimationFrame(frame);
  try { await document.fonts.load('400 40px "Bebas Neue"'); await document.fonts.load('600 30px Oswald'); } catch { }
  const logoSq = await loadImg('./logo-square.jpg');
  bar.style.width = '25%';
  logoTex = new THREE.Texture(logoSq); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.needsUpdate = true;
  const ft = GYM.floorTexture(logoSq, tierName === 'low' ? 32 : 48);
  ft.tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  floor = new THREE.Mesh(new THREE.PlaneGeometry(ft.W, ft.L), new THREE.MeshPhysicalMaterial({ map: ft.tex, roughness: 0.4, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const hall = GYM.makeHall(logoTex); scene.add(hall);
  hall.traverse(o => { if (o.isInstancedMesh) o.material.color.setRGB(1.3, 1.4, 1.3); }); // dimmer, cooler ceiling lamps
  crowd = GYM.makeCrowd(900, false); scene.add(crowd.group);
  for (const g of [hall, crowd.group, bleachersG, scoreboard, gate]) g.traverse(o => o.layers.set(1));
  camera.layers.enable(1);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(GYM.envScene(), 0.03).texture; scene.environmentIntensity = 0.35; pm.dispose();
  scoreboard.userData.draw(0, 3, 'WAVE', 'LIVES', -1, 'GCVC UNITED vs ZOMBIES');
  bar.style.width = '45%';
  await loadAthlete(f => { bar.style.width = (45 + f * 35) + '%'; });
  for (const k of ['hitter', 'setter', 'z-walker', 'z-walker2', 'z-libero', 'z-blocker', 'z-swatter', 'z-boss']) kitTexture(k);
  hitter = new Athlete({ kit: 'hitter', hair: 'long', hairColor: '#6b3d1e', tie: '#c8102e' });
  setter = new Athlete({ kit: 'setter', hair: 'buns', hairColor: '#1c1310', tie: '#c8102e' });
  for (const a of [hitter, setter]) { scene.add(a.root); const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.011; scene.add(blob); a.blob = blob; }
  hitter.root.position.copy(HOME); hitter.facing = Math.PI; hitter.play('Ready', 0);
  setter.root.position.copy(SETTER); setter.facing = Math.atan2(-(SETTER.x - HOME.x) * 1, -0.35); setter.play('Ready', 0);
  hitter.blob.position.set(HOME.x, 0.011, HOME.z); setter.blob.position.set(SETTER.x, 0.011, SETTER.z);
  // prewarm a pool of each zombie type so spawns don't hitch mid-game
  for (const t of Object.keys(ZTYPES)) { zPool[t] = []; const n = t === 'walker' ? 6 : t === 'boss' ? 1 : 3; for (let i = 0; i < n; i++) zPool[t].push(makeZombieAthlete(t)); }
  for (let i = 0; i < 6; i++) ballPool.push(newBallMesh()), ballPool[ballPool.length - 1].visible = false, ballPool[ballPool.length - 1].userData.shadow.visible = false;
  applyTier(tierName);
  bar.style.width = '100%';
  wireUI();
  if (qs.get('proof')) stageProof(qs.get('proof')); else goMenu();
  renderer.compile(scene, camera);
}
// design-proof staging: frozen gameplay moment with zombies in all 3 lanes and the hitter loaded up
function stageProof(kind) {
  state = 'proof'; show(null); $('hud').classList.remove('hidden');
  game.score = 1250; game.wave = 3; game.combo = 7; game.lives = 3; drawHud();
  hitter.facing = Math.PI;
  [[0, -2.6, 'walker'], [0, -7.5, 'libero'], [1, -4.4, 'blocker'], [1, -10.5, 'walker'], [2, -3.2, 'swatter'], [2, -8.4, 'walker']].forEach(([l, z, t]) => spawnZombie(t, l, z, false));
  if (kind === 'title') { goMenu(); return; }
  hit.phase = 'proof'; hit.jy = 0.72; hit.z = CONTACT.z + 0.32; hitter.play('Jump_Loop', 0); hitter.setPose('cock', 1e6); hitter.poseT = 1e5 * 0.5;
  const b = { mesh: getBall(), p: CONTACT.clone().add(new THREE.Vector3(0, 0.05, 0)), v: new THREE.Vector3(), phase: 'hold' }; b.mesh.position.copy(b.p); balls.push(b);
  ringFixed.visible = ringMove.visible = true; ringFixed.position.copy(CONTACT); ringMove.position.copy(CONTACT); ringFixed.scale.setScalar(0.55); ringMove.scale.setScalar(0.62); ringMove.material.color.set('#ffcf3a'); ringFixed.material.color.set('#ffcf3a');
  if (kind === 'hit') { const z0 = zombies[2]; const sb = { mesh: getBall(), p: chestOf(z0).add(new THREE.Vector3(0, 0, 0.6)), v: new THREE.Vector3(), phase: 'hold' }; sb.mesh.position.copy(sb.p); balls.push(sb); burst(chestOf(z0), 40, ['#ffffff', '#b6ff5a', '#ffcf3a'], 4, 0.18, 2, 0); }
}
boot().catch(e => { console.error(e); $('loading').querySelector('.tip').textContent = 'Could not load: ' + e.message; });

// test / debug hook
window.__zs = {
  get state() { return state; }, get gt() { return gt; }, get cur() { return cur; }, get tier() { return tierName; }, game, zombies, balls, hit,
  get hitter() { return hitter; }, get lastSpike() { return lastSpike; }, save, renderer, applyTier, startGame, goMenu, gameOver, spawnZombie, givePower, LANES, WIN,
  frontZombie, scene, mists, get reflector() { return reflector; }, get composer() { return composer; }, set lives(v) { game.lives = v; drawHud(); },
};
