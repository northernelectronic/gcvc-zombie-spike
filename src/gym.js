// Procedural gym: hardwood court, lines, GCVC centre-court medallion, net/posts/antennas, bleachers + crowd,
// ceiling light rig, banners, scoreboard. All geometry/texture generated in code (logo = club artwork).
import * as THREE from 'three';
import { mulberry } from './athlete.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const COURT = { hw: 4.5, hl: 9, netH: 2.40, attack: 3 };
const RED = '#c8102e';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

export function floorTexture(logoImg, ppm) {
  const W = 26, L = 36; // metres covered
  const [c, x] = canvas(Math.round(W * ppm), Math.round(L * ppm));
  const P = v => v * ppm, X = v => P(v + W / 2), Z = v => P(v + L / 2);
  const r = mulberry(7);
  // dark surround
  x.fillStyle = '#18181b'; x.fillRect(0, 0, c.width, c.height);
  // hardwood planks over the playing area incl. free zone
  const fx0 = X(-8), fx1 = X(8), fz0 = Z(-13), fz1 = Z(13);
  const plankW = P(0.12);
  for (let px = fx0; px < fx1; px += plankW) {
    let pz = fz0 - r() * P(2);
    while (pz < fz1) {
      const len = P(1.2 + r() * 2.2);
      const l = 62 + r() * 10, hue = 30 + r() * 6;
      x.fillStyle = `hsl(${hue},${48 + r() * 10}%,${l}%)`; x.fillRect(px, pz, plankW, len);
      // grain streaks
      x.globalAlpha = 0.18;
      for (let g = 0; g < 5; g++) { x.fillStyle = r() < 0.5 ? '#8a5a2a' : '#f4d6a0'; x.fillRect(px + r() * plankW, pz, 1, len); }
      x.globalAlpha = 1;
      x.fillStyle = 'rgba(70,40,15,0.45)'; x.fillRect(px, pz, plankW, 1);
      pz += len;
    }
    x.fillStyle = 'rgba(70,40,15,0.35)'; x.fillRect(px, fz0, 1, fz1 - fz0);
  }
  // painted free zone (carbon/charcoal) leaving the court natural wood
  x.save(); x.beginPath(); x.rect(fx0, fz0, fx1 - fx0, fz1 - fz0); x.rect(X(4.5), Z(-9), -P(9), P(18)); x.clip('evenodd');
  x.fillStyle = 'rgba(28,28,32,0.86)'; x.fillRect(fx0, fz0, fx1 - fx0, fz1 - fz0);
  // carbon weave hint
  x.globalAlpha = 0.07; x.fillStyle = '#ffffff';
  for (let i = 0; i < (fx1 - fx0) / 6; i++) for (let j = 0; j < (fz1 - fz0) / 6; j++) if ((i + j) % 2) x.fillRect(fx0 + i * 6, fz0 + j * 6, 6, 3);
  x.globalAlpha = 1; x.restore();
  // red band around the free zone
  x.strokeStyle = RED; x.lineWidth = P(0.25); x.strokeRect(fx0 + P(0.125), fz0 + P(0.125), fx1 - fx0 - P(0.25), fz1 - fz0 - P(0.25));
  // court lines (5cm white)
  x.strokeStyle = '#f7f7f2'; x.lineWidth = Math.max(2, P(0.05));
  x.strokeRect(X(-4.5), Z(-9), P(9), P(18));
  x.beginPath(); x.moveTo(X(-4.5), Z(0)); x.lineTo(X(4.5), Z(0)); x.stroke();
  for (const s of [-1, 1]) {
    x.beginPath(); x.moveTo(X(-4.5), Z(s * 3)); x.lineTo(X(4.5), Z(s * 3)); x.stroke();
    x.setLineDash([P(0.15), P(0.2)]);
    x.beginPath(); x.moveTo(X(-6.2), Z(s * 3)); x.lineTo(X(-4.5), Z(s * 3)); x.moveTo(X(4.5), Z(s * 3)); x.lineTo(X(6.2), Z(s * 3)); x.stroke();
    x.setLineDash([]);
  }
  // centre-court medallion with club logo
  if (logoImg) {
    const R = P(2.1);
    x.save(); x.translate(X(0), Z(0));
    x.globalAlpha = 0.92;
    x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.clip();
    x.drawImage(logoImg, -R, -R, R * 2, R * 2);
    x.restore();
    x.lineWidth = P(0.12); x.strokeStyle = RED; x.beginPath(); x.arc(X(0), Z(0), R, 0, Math.PI * 2); x.stroke();
    x.lineWidth = P(0.04); x.strokeStyle = '#d9dde2'; x.beginPath(); x.arc(X(0), Z(0), R + P(0.1), 0, Math.PI * 2); x.stroke();
    // logos in the end free zones
    for (const s of [-1, 1]) {
      x.save(); x.translate(X(0), Z(s * 11)); if (s < 0) x.rotate(Math.PI);
      x.font = `700 ${P(1.1)}px "Bebas Neue", Oswald, Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(200,16,46,0.9)'; x.fillText('GCVC  UNITED', 0, 0); x.restore();
    }
    for (const s of [-1, 1]) {
      x.save(); x.translate(X(s * 6.3), Z(0)); x.rotate(s * Math.PI / 2);
      x.font = `700 ${P(0.9)}px "Bebas Neue", Oswald, Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(217,221,226,0.85)'; x.fillText('GCVC UNITED', 0, 0); x.restore();
    }
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return { tex: t, W, L };
}

function volleyballTexture() {
  const W = 512, H = 256; const [c, x] = canvas(W, H);
  const img = x.createImageData(W, H); const d = img.data;
  const cols = [[245, 245, 240], [200, 16, 46], [30, 30, 34]];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = i / W * Math.PI * 2, v = j / H * Math.PI;
    const p = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
    const ax = p.map(Math.abs); const k = ax[0] > ax[1] ? (ax[0] > ax[2] ? 0 : 2) : (ax[1] > ax[2] ? 1 : 2);
    const proj = p.map(q => q / ax[k]);
    const along = p[k] > 0 ? (k + 1) % 3 : (k + 2) % 3;
    const sv = proj[along]; // -1..1 across the face
    const strip = sv < -1 / 3 ? 0 : (sv < 1 / 3 ? 1 : 2);
    const edge = Math.min(Math.abs(sv + 1 / 3), Math.abs(sv - 1 / 3));
    let faceEdge = 1; for (let ii = 0; ii < 3; ii++) if (ii !== k) faceEdge = Math.min(faceEdge, 1 - Math.abs(proj[ii]));
    const col = strip === 1 ? cols[k % 2 ? 1 : 2] : (strip === 0 && k === 1 ? cols[1] : cols[0]);
    let sh = 1;
    if (edge < 0.02) sh = 0.55; else if (edge < 0.04) sh = 0.85;
    if (faceEdge < 0.02) sh = Math.min(sh, 0.5); else if (faceEdge < 0.045) sh = Math.min(sh, 0.82);
    const o = (j * W + i) * 4; d[o] = col[0] * sh; d[o + 1] = col[1] * sh; d[o + 2] = col[2] * sh; d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c);
}

export function makeBall() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 40, 24), new THREE.MeshPhysicalMaterial({ map: volleyballTexture(), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }));
  ball.castShadow = true; g.add(ball); g.userData.mesh = ball;
  return g;
}

function netTexture() {
  const [c, x] = canvas(64, 64);
  x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(16,16,18,0.95)'; x.lineWidth = 9; x.strokeRect(0, 0, 64, 64);
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(99, 10); return t;
}
function stripeTexture(a, b, n) {
  const [c, x] = canvas(8, 64); for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(0, i * 64 / n, 8, 64 / n); } return tex(c);
}

export function makeNet() {
  const g = new THREE.Group();
  const H = COURT.netH;
  const geo = new THREE.PlaneGeometry(9.9, 1.0, 44, 6);
  const net = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9 }));
  net.position.y = H - 0.5; net.castShadow = true; g.add(net);
  g.userData.net = net; g.userData.base = Float32Array.from(geo.attributes.position.array);
  const band = new THREE.Mesh(new THREE.BoxGeometry(9.9, 0.07, 0.02), new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.6 }));
  band.position.y = H - 0.035; g.add(band); g.userData.band = band;
  const band2 = band.clone(); band2.position.y = H - 1.0; band2.scale.y = 0.7; g.add(band2);
  const postMat = new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 0.8, roughness: 0.25 });
  const padMat = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.55 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 16), postMat); post.position.set(s * 5.4, 1.3, 0); post.castShadow = true; g.add(post);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 20), padMat); pad.position.set(s * 5.4, 0.95, 0); pad.castShadow = true; g.add(pad);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 24), postMat); base.position.set(s * 5.4, 0.04, 0); g.add(base);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6), postMat); cable.rotation.z = Math.PI / 2; cable.position.set(s * 4.95, H - 0.03, 0); g.add(cable);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 8), new THREE.MeshStandardMaterial({ map: stripeTexture('#ffffff', RED, 18), roughness: 0.5 }));
    ant.position.set(s * 4.5, H - 1 + 0.9 + 0.6, 0); g.add(ant);
  }
  return g;
}
export function shakeNet(netG, x, amt) { netG.userData.shake = { x, amt, t: 0 }; }
export function updateNet(netG, dt) {
  const s = netG.userData.shake; if (!s) return;
  s.t += dt; const pos = netG.userData.net.geometry.attributes.position, b = netG.userData.base;
  const decay = Math.exp(-s.t * 4) * s.amt;
  for (let i = 0; i < pos.count; i++) {
    const px = b[i * 3], py = b[i * 3 + 1];
    const fall = Math.exp(-Math.pow((px - s.x) / 1.4, 2)) * (0.5 - py + 0.6);
    pos.setZ(i, Math.sin(s.t * 26) * decay * fall);
  }
  pos.needsUpdate = true;
  if (decay < 0.002) { netG.userData.shake = null; pos.array.set(b); pos.needsUpdate = true; }
}

// ---- crowd (instanced, animated in the vertex shader) ----
export function makeCrowd(count, far = true) {
  const r = mulberry(3);
  const spots = [];
  // side bleachers
  for (const s of [-1, 1]) for (let row = 0; row < 8; row++) for (let z = -17; z <= 15; z += 0.62) if (r() < 0.86) spots.push([s * (9.2 + row * 0.75), 0.5 + row * 0.42, z + (r() - 0.5) * 0.2, s > 0 ? -Math.PI / 2 : Math.PI / 2]);
  // far end
  if (far) for (let row = 0; row < 9; row++) for (let xx = -14; xx <= 14; xx += 0.62) if (r() < 0.88) spots.push([xx + (r() - 0.5) * 0.2, 0.5 + row * 0.42, -(14.2 + row * 0.75), 0]);
  while (spots.length > count) spots.splice(Math.floor(r() * spots.length), 1);
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; } // shuffle so lower quality tiers thin the crowd evenly
  const n = spots.length;
  const shirt = ['#c8102e', '#c8102e', '#c8102e', '#e8e8e8', '#1b1b1f', '#c8102e', '#7d0a1d', '#d9dde2', '#2b5bd7', '#f0b400'];
  const skins = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#6b4129'];
  const uni = { uTime: { value: 0 }, uHype: { value: 0 } };
  const mkMat = () => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uni.uTime; sh.uniforms.uHype = uni.uHype;
      sh.vertexShader = 'uniform float uTime; uniform float uHype; attribute float aPhase;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = aPhase * 6.2831;
        float idle = sin(uTime * 1.3 + ph) * 0.03;
        float jump = max(0.0, sin(uTime * 9.0 + ph * 3.0)) * 0.32 * uHype * step(0.35, fract(aPhase * 7.13));
        transformed.y += idle + jump;
        transformed.x += sin(uTime * 0.9 + ph) * 0.03;`);
    };
    return m;
  };
  const bodyG = new THREE.CapsuleGeometry(0.2, 0.42, 2, 6); bodyG.translate(0, 0.42, 0);
  const headG = new THREE.SphereGeometry(0.12, 7, 5); headG.translate(0, 0.98, 0);
  const armG = new THREE.CapsuleGeometry(0.055, 0.42, 1, 4); armG.translate(0.24, 0.62, 0.05);
  const meshes = [];
  for (const [geo, colFn] of [[bodyG, () => shirt[Math.floor(r() * shirt.length)]], [headG, () => skins[Math.floor(r() * skins.length)]], [armG, null]]) {
    const ph = new Float32Array(n); for (let i = 0; i < n; i++) ph[i] = (i * 0.6180339) % 1;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    const im = new THREE.InstancedMesh(geo, mkMat(), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
    const cs = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const [px, py, pz, ry] = spots[i];
      q.setFromEuler(e.set(0, ry, 0)); sc.setScalar(0.9 + ((i * 7919) % 100) / 400);
      m4.compose(new THREE.Vector3(px, py, pz), q, sc); im.setMatrixAt(i, m4);
      if (colFn) im.setColorAt(i, cs.set(colFn()));
    }
    if (!colFn) { // arms match shirt colour of body (same index order)
      const body = meshes[0]; for (let i = 0; i < n; i++) { body.getColorAt(i, cs); im.setColorAt(i, cs); }
    }
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; meshes.push(im);
  }
  const g = new THREE.Group(); meshes.forEach(m => g.add(m));
  // raise arms when hyped (mirror arm for other side)
  const armR = meshes[2].clone(); armR.geometry = meshes[2].geometry.clone(); armR.geometry.scale(-1, 1, 1); armR.material = meshes[2].material; g.add(armR);
  return { group: g, uni, count: n };
}

export function makeBleachers(far = true) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#2a2a2f', roughness: 0.7, metalness: 0.2 });
  const edge = new THREE.MeshStandardMaterial({ color: '#8f949b', roughness: 0.35, metalness: 0.8 });
  const pad = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.6 });
  const A = [], B = [], C = [];
  const box = (arr, w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); arr.push(b); };
  for (const s of [-1, 1]) for (let row = 0; row < 8; row++) {
    box(A, 0.75, 0.42 * (row + 1), 34, s * (9.2 + row * 0.75), 0.21 * (row + 1), -1);
    box(B, 0.05, 0.05, 34, s * (9.2 + row * 0.75 - 0.36), 0.42 * (row + 1), -1);
  }
  if (far) for (let row = 0; row < 9; row++) {
    box(A, 30, 0.42 * (row + 1), 0.75, 0, 0.21 * (row + 1), -(14.2 + row * 0.75));
    box(B, 30, 0.05, 0.05, 0, 0.42 * (row + 1), -(14.2 + row * 0.75 - 0.36));
  }
  for (const s of [-1, 1]) box(C, 0.2, 0.9, 30, s * 8.65, 0.45, -1);
  if (far) box(C, 17, 0.9, 0.2, 0, 0.45, -13.7);
  for (const [arr, m] of [[A, mat], [B, edge], [C, pad]]) g.add(new THREE.Mesh(mergeGeometries(arr), m));
  return g;
}
export function makeHall(logoTex) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: '#1d1d22', roughness: 0.8 });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), wallMat); far.position.set(0, 8, -21.5); g.add(far);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(46, 16), wallMat); w.rotation.y = -s * Math.PI / 2; w.position.set(s * 16.5, 8, 0); g.add(w); }
  // red + chrome stripes
  const stripe = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.5, emissive: '#3a0008' });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: 1, roughness: 0.2 });
  const st = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.5), stripe); st.position.set(0, 5.6, -21.45); g.add(st);
  const st2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.08), chrome); st2.position.set(0, 5.25, -21.45); g.add(st2);
  for (const s of [-1, 1]) { const ss = new THREE.Mesh(new THREE.PlaneGeometry(46, 0.5), stripe); ss.rotation.y = -s * Math.PI / 2; ss.position.set(s * 16.45, 5.6, 0); g.add(ss); }
  // logo banners
  if (logoTex) {
    const bm = new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.55, emissive: '#ffffff', emissiveMap: logoTex, emissiveIntensity: 0.15 });
    for (const x of [-9.5, 9.5]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), bm); b.position.set(x, 9.0, -21.4); g.add(b);
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.9), chrome); fr.position.set(x, 9.0, -21.42); g.add(fr);
    }
    for (const s of [-1, 1]) for (const z of [-12, -2, 8]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), bannerMat(logoTex)); b.rotation.y = -s * Math.PI / 2; b.position.set(s * 16.4, 9.2, z); g.add(b);
    }
  }
  // ceiling + light rig (emissive panels drive bloom on high quality)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 46), new THREE.MeshStandardMaterial({ color: '#121216', roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 15.5; g.add(ceil);
  const beamMat = new THREE.MeshStandardMaterial({ color: '#2b2d33', metalness: 0.6, roughness: 0.5 });
  for (let z = -18; z <= 18; z += 6) { const b = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 0.3), beamMat); b.position.set(0, 14.8, z); g.add(b); }
  const lampG = new THREE.BoxGeometry(1.4, 0.12, 0.7);
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.9) });
  const lamps = new THREE.InstancedMesh(lampG, lampM, 40); let k = 0; const m4 = new THREE.Matrix4();
  for (let ix = -2; ix <= 2; ix++) for (let iz = -4; iz <= 3; iz++) { m4.makeTranslation(ix * 3.6, 14.4, iz * 4.6 + 2.3); lamps.setMatrixAt(k++, m4); }
  g.add(lamps);
  return g;
}
function bannerMat(logoTex) {
  const [c, x] = canvas(256, 336);
  const gr = x.createLinearGradient(0, 0, 0, 336); gr.addColorStop(0, '#8d0b20'); gr.addColorStop(1, '#c8102e');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 336);
  x.fillStyle = '#d9dde2'; x.fillRect(0, 0, 256, 10); x.fillRect(0, 326, 256, 10);
  x.beginPath(); x.moveTo(0, 336); x.lineTo(128, 300); x.lineTo(256, 336); x.fillStyle = '#121216'; x.fill();
  if (logoTex.image) { x.save(); x.beginPath(); x.arc(128, 128, 100, 0, Math.PI * 2); x.clip(); x.drawImage(logoTex.image, 28, 28, 200, 200); x.restore(); x.lineWidth = 6; x.strokeStyle = '#d9dde2'; x.beginPath(); x.arc(128, 128, 100, 0, Math.PI * 2); x.stroke(); }
  x.font = '700 40px "Bebas Neue", Oswald, Impact, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('UNITED', 128, 272);
  return new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.7, side: THREE.DoubleSide });
}

export function makeScoreboard() {
  const [c, x] = canvas(768, 320);
  const t = tex(c);
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.2, 0.4), new THREE.MeshStandardMaterial({ color: '#1a1a1e', metalness: 0.7, roughness: 0.3 }));
  g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.9), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  face.position.z = 0.21; g.add(face);
  g.position.set(0, 12.2, -21.2); g.scale.setScalar(0.85);
  g.userData.draw = (home, away, homeName, awayName, serving, msg) => {
    x.fillStyle = '#050507'; x.fillRect(0, 0, 768, 320);
    x.strokeStyle = '#c8102e'; x.lineWidth = 6; x.strokeRect(4, 4, 760, 312);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 46px "Bebas Neue", Oswald, Impact, sans-serif';
    x.fillStyle = '#ff3b4f'; x.fillText(homeName, 190, 52); x.fillStyle = '#9fc4ff'; x.fillText(awayName, 578, 52);
    x.font = '700 170px "Bebas Neue", Oswald, Impact, sans-serif';
    x.shadowColor = '#ffb000'; x.shadowBlur = 18; x.fillStyle = '#ffcf3a';
    x.fillText(String(home).padStart(2, '0'), 190, 180); x.fillText(String(away).padStart(2, '0'), 578, 180);
    x.shadowBlur = 0;
    x.fillStyle = '#ffcf3a'; x.beginPath(); x.arc(serving === 0 ? 330 : 438, 180, 13, 0, Math.PI * 2); x.fill();
    x.font = '600 34px Oswald, sans-serif'; x.fillStyle = '#d9dde2'; x.fillText(msg || 'SET 1 • RALLY TO 15', 384, 286);
    t.needsUpdate = true;
  };
  return g;
}

// environment for image-based lighting: dark hall with bright ceiling panels -> glossy floor highlights
export function envScene() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 46), new THREE.MeshBasicMaterial({ color: '#2a2622', side: THREE.BackSide }));
  room.position.y = 8; s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 30), new THREE.MeshBasicMaterial({ color: '#7a5a38' })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; s.add(floor);
  const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 6.8, 6.3) });
  for (let ix = -2; ix <= 2; ix++) for (let iz = -4; iz <= 3; iz++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.7), lm); l.position.set(ix * 3.6, 14.4, iz * 4.6 + 2.3); s.add(l); }
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.05, 0.1) });
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 46), red); b.position.set(sx * 19.8, 5.6, 0); s.add(b); }
  const crowd = new THREE.MeshBasicMaterial({ color: '#4a2328' });
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 34), crowd); c.position.set(sx * 11.5, 1.8, 0); s.add(c); }
  return s;
}
