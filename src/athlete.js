// Athletes: Quaternius "Universal Base Characters" female (CC0, textured, with eyes + brows) on the
// Universal Animation Library rig, wearing volleyball kits baked into the skin texture (tools/bake-kits.py),
// CC0 hairstyles (+ a procedural ponytail), and procedural arm poses layered over the clips.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

let base = null;
const texLoader = new THREE.TextureLoader();
const texCache = {};
export function kitTexture(name, srgb = true) {
  if (texCache[name]) return texCache[name];
  const t = texLoader.load(`./kits/${name}.jpg`); t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (texCache[name] = t);
}
export async function loadAthlete(onProgress) {
  const loader = new GLTFLoader();
  const files = ['./woman.glb', './anims.glb', './hair-long.glb', './hair-buns.glb', './hair-buzzedfemale.glb'];
  let done = 0;
  const [w, a, long, buns, buzz] = await Promise.all(files.map(f => loader.loadAsync(f).then(r => { onProgress && onProgress(++done / files.length); return r; })));
  const hairOf = g => { let m = null; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh && !m) m = o; }); const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); return geo; };
  base = {
    scene: w.scene,
    animations: a.animations.map(c => { c.tracks = c.tracks.filter(t => !t.name.endsWith('.scale') && (!t.name.endsWith('.position') || /^(pelvis|root)\./.test(t.name))); return c; }),
    hair: { long: hairOf(long), buns: hairOf(buns), buzz: hairOf(buzz) },
  };
  // shared textures (all kits preload so spawns never hitch)
  base.normal = kitTexture('normal', false); base.rough = kitTexture('rough', false);
  base.hairTex = [kitTexture('hair1'), kitTexture('hair2')]; base.hairN = [kitTexture('hair1-n', false), kitTexture('hair2-n', false)];
  return base;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

export class Athlete {
  // opts: kit (texture name), hair ('pony' | 'buns' | 'long'), hairColor, zombie, eyeGlow, seed
  constructor(opts) {
    const { kit, hair = 'pony', hairColor = '#5a3418', zombie = false, eyeGlow = null, seed = 1 } = opts;
    this.root = new THREE.Group();
    const model = SkeletonUtils.clone(base.scene);
    this.model = model; this.root.add(model);
    this.meshes = [];
    this.mat = new THREE.MeshStandardMaterial({ map: kitTexture(kit), normalMap: base.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: base.rough, roughness: 1, metalness: 0 });
    this.mat.emissive = new THREE.Color(0, 0, 0);
    const hc = new THREE.Color(hairColor);
    model.traverse(o => {
      if (o.isSkinnedMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
        if (o.name.startsWith('Superhero')) { o.material = this.mat; this.body = o; }
        else if (o.name.startsWith('Eyes')) {
          if (eyeGlow) o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(eyeGlow).multiplyScalar(1.8), toneMapped: false });
          else { o.material = o.material.clone(); o.material.roughness = 0.15; }
          o.castShadow = false;
        } else if (o.name.startsWith('Eyebrows')) { o.material = new THREE.MeshStandardMaterial({ color: hc.clone().multiplyScalar(0.7), roughness: 0.8, transparent: true, opacity: 0.95 }); o.castShadow = false; }
        this.meshes.push(o);
      }
      if (o.isBone) { (this.bones ||= {})[o.name] = o; this.bones[o.name.replace(/\./g, '')] = o; }
    });
    model.updateMatrixWorld(true);
    // hair: CC0 hairstyle meshes (authored in character space) attached to the head bone
    const head = this.bones['Head'];
    const hairG = new THREE.Group();
    const hi = hair === 'long' ? 1 : 0;
    const hairMat = new THREE.MeshStandardMaterial({ map: base.hairTex[hair === 'pony' ? 0 : 1], normalMap: base.hairN[hair === 'pony' ? 0 : 1], color: hc.clone().multiplyScalar(1.6), roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
    const geo = hair === 'buns' ? base.hair.buns : hair === 'long' ? base.hair.long : base.hair.buzz;
    const hm = new THREE.Mesh(geo, hairMat); hm.castShadow = true; hairG.add(hm);
    this.tieMat = new THREE.MeshStandardMaterial({ color: opts.tie || '#c8102e', roughness: 0.5 });
    this.tailSeg = [];
    if (hair === 'pony') {
      // high ponytail out of the back of the head: chain of tapered, textured capsules that swing
      const tailRoot = new THREE.Group(); tailRoot.position.set(0, 1.735, -0.085); hairG.add(tailRoot);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.01, 8, 16), this.tieMat); tie.rotation.x = 0.9; tailRoot.add(tie);
      let parent = tailRoot;
      for (let i = 0; i < 5; i++) {
        const seg = new THREE.Group(); seg.position.set(0, i === 0 ? -0.005 : -0.07, i === 0 ? -0.015 : 0); parent.add(seg);
        const r = 0.034 * (1 - i * 0.15) * (i === 0 ? 0.9 : 1);
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.05, 4, 12), hairMat); m.position.y = -0.04; m.scale.z = 0.78; m.castShadow = true; seg.add(m);
        seg.rotation.x = i === 0 ? 0.75 : -0.16;
        this.tailSeg.push(seg); parent = seg;
      }
    }
    this.swing = 0; this.swingV = 0;
    this.root.add(hairG); hairG.updateMatrixWorld(true); head.attach(hairG);
    this.hairMat = hairMat;
    // animation
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const c of base.animations) this.actions[c.name] = this.mixer.clipAction(c);
    for (const n of ['Roll', 'Hit_Chest']) if (this.actions[n]) { this.actions[n].setLoop(THREE.LoopOnce); this.actions[n].clampWhenFinished = true; }
    this.cur = null; this.tw = {}; this.fade = 0.18; this.play('Idle_Loop', 0);
    this.pose = null; this.poseW = 0; this.poseT = 0;
    this.jumpY = 0; this.lean = 0; this.dive = 0; this.diveDir = 0;
    this.facing = 0;
  }
  setKit(kit) { this.mat.map = kitTexture(kit); this.mat.needsUpdate = true; }
  // weighted clip blending: mix = { clipName: weight }
  play(name, fade = 0.18, speed = 1) { this.playMix(name === 'Ready' ? { Idle_Loop: 0.5, Crouch_Idle_Loop: 0.5 } : { [name]: 1 }, fade, speed, name); }
  playMix(mix, fade = 0.18, speed = 1, key = '') {
    for (const n in mix) { const a = this.actions[n]; if (!a) continue; a.timeScale = speed; }
    if (this.curName === key) return;
    this.curName = key; this.fade = fade;
    for (const n in this.tw) this.tw[n] = 0;
    for (const n in mix) {
      const a = this.actions[n]; if (!a) continue;
      if (!a.isRunning() || (this.weights?.[n] ?? 0) < 0.02 || a.loop === THREE.LoopOnce) { a.reset(); a.play(); if (fade <= 0) a.setEffectiveWeight(mix[n]); else a.setEffectiveWeight(this.weights?.[n] || 0); }
      this.tw[n] = mix[n];
    }
    this.weights ||= {};
    if (fade <= 0) for (const n in this.tw) this.weights[n] = this.tw[n];
  }
  setPose(name, dur = 0.5) { this.pose = name; this.poseT = 0; this.poseDur = dur; }
  update(dt, cam) {
    const k = Math.min(1, dt / Math.max(0.01, this.fade));
    for (const n in this.tw) {
      const w = (this.weights[n] ?? 0) + (this.tw[n] - (this.weights[n] ?? 0)) * k; this.weights[n] = w;
      const a = this.actions[n]; a.setEffectiveWeight(w);
      if (w < 0.002 && this.tw[n] === 0) { a.stop(); delete this.tw[n]; this.weights[n] = 0; }
    }
    this.mixer.update(dt);
    // whole-body procedural transforms
    this.model.position.y = this.jumpY - this.dive * 0.55;
    this.model.rotation.set(this.dive * 1.25 + this.lean, 0, 0);
    this.model.position.z = this.dive * 0.5;
    this.root.rotation.y = this.facing;
    // ponytail spring: reacts to jumps / turns / runs
    if (this.tailSeg && this.tailSeg.length) {
      const yv = (this.jumpY - (this._py ?? this.jumpY)) / Math.max(dt, 1e-4); this._py = this.jumpY;
      const yaw = this.facing - (this._pf ?? this.facing); this._pf = this.facing;
      this.swingV += (-this.swing * 60 - this.swingV * 7 + yv * 6) * dt; this.swing += this.swingV * dt;
      this.sideV = (this.sideV || 0) + (-(this.side || 0) * 50 - (this.sideV || 0) * 6 - yaw * 400) * dt; this.side = (this.side || 0) + this.sideV * dt;
      this.tailSeg.forEach((sg, i) => { sg.rotation.x = (i === 0 ? 0.55 : -0.12) + this.swing * 0.25 * (i + 1) * 0.5; sg.rotation.z = (this.side || 0) * 0.3; });
    }
    // procedural arm pose layer
    if (this.pose) { this.poseT += dt; const t = this.poseT / this.poseDur; this.poseW = t < 0.12 ? t / 0.12 : (t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1); if (t >= 1) { this.pose = null; this.poseW = 0; } }
    if (this.loopPose && !(this.pose && this.poseW > 0.99)) { this.loopT = (this.loopT || 0) + dt; this.root.updateMatrixWorld(true); const f = POSES[this.loopPose]; if (f) f(this, this.loopT, this.loopW ?? 1); }
    if (this.pose && this.poseW > 0.001) {
      this.root.updateMatrixWorld(true);
      const f = POSES[this.pose]; if (f) f(this, Math.min(1, this.poseT / this.poseDur), this.poseW);
    }
  }
  // aim a bone so that the direction bone->child points along dir (character-local frame: x right, y up, z forward)
  aim(boneName, childName, dir, w) {
    const b = this.bones[boneName.replace(/\./g, '')], c = this.bones[childName.replace(/\./g, '')]; if (!b || !c || w <= 0) return;
    b.updateMatrixWorld(true);
    const bp = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const cp = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
    const cur = cp.sub(bp).normalize();
    const want = _v2.copy(dir).normalize().applyQuaternion(this.model.getWorldQuaternion(_q3));
    const delta = _q.setFromUnitVectors(cur, want);
    const bw = b.getWorldQuaternion(_q2);
    const target = delta.multiply(bw); // world
    const pw = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    const local = pw.multiply(target);
    b.quaternion.slerp(local, w);
    b.updateMatrixWorld(true);
  }
}
// character-local helper: R = character's right (-x for a +z-facing model), U up, F forward
const R = new THREE.Vector3(-1, 0, 0), U = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3(0, 0, 1);
const D = (r, u, f) => new THREE.Vector3().addScaledVector(R, r).addScaledVector(U, u).addScaledVector(F, f);
function arms(a, w, uL, fL, uR, fR) {
  a.aim('upperarm_l', 'lowerarm_l', uL, w); a.aim('lowerarm_l', 'hand_l', fL, w);
  a.aim('upperarm_r', 'lowerarm_r', uR, w); a.aim('lowerarm_r', 'hand_r', fR, w);
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const POSES = {
  // forearm platform, arms straight forward-down, hands together
  bump(a, t, w) { const d = 0.2 * Math.sin(t * Math.PI); arms(a, w, D(0.3, -0.7 + d, 0.65), D(0.12, -0.55 + d, 0.85), D(-0.3, -0.7 + d, 0.65), D(-0.12, -0.55 + d, 0.85)); },
  // overhead set: hands above forehead, elbows out, then extend
  set(a, t, w) { const e = t > 0.45 ? Math.min(1, (t - 0.45) / 0.25) : 0;
    arms(a, w, D(-0.75, 0.55 + e * 0.3, 0.35), D(0.35, 0.8, 0.35 - e * 0.2 + 0.1), D(0.75, 0.55 + e * 0.3, 0.35), D(-0.35, 0.8, 0.35 - e * 0.2 + 0.1)); },
  // spike: left arm points up at ball, right arm cocks back then whips through
  spike(a, t, w) {
    const s = t < 0.55 ? 0 : ease(Math.min(1, (t - 0.55) / 0.2));
    const upR = D(0.55, 0.65 - s * 0.9, -0.55 + s * 1.3), foR = D(0.2, 0.5 - s * 1.2 + (1 - s) * 0.3, -0.85 + s * 1.6);
    arms(a, w, D(-0.25, 0.9 - s * 1.2, 0.35 + s * 0.2), D(-0.1, 0.95 - s * 1.3, 0.3), upR, foR);
  },
  tip(a, t, w) { arms(a, w, D(-0.3, 0.6, 0.3), D(-0.1, 0.6, 0.4), D(0.2, 0.95, 0.25), D(0.05, 0.95, 0.4 + t * 0.4)); },
  block(a, t, w) { arms(a, w, D(-0.18, 1, 0.22), D(-0.1, 1, 0.3), D(0.18, 1, 0.22), D(0.1, 1, 0.3)); },
  serve(a, t, w) { // toss with left hand, then overhead swing with right
    const toss = Math.min(1, t / 0.35), s = t < 0.6 ? 0 : ease(Math.min(1, (t - 0.6) / 0.2));
    arms(a, w, D(-0.2, -0.2 + toss * 1.1 - s * 0.9, 0.6), D(-0.1, toss * 1.0 - s * 0.9, 0.5), D(0.5, 0.5 + toss * 0.2 - s * 0.7, -0.6 + s * 1.3), D(0.15, 0.4 - s * 1.0 + (1 - s) * 0.4, -0.85 + s * 1.6));
  },
  dive(a, t, w) { arms(a, w, D(0.12, 0.05, 1), D(0.25, 0, 1), D(-0.12, 0.05, 1), D(-0.25, 0, 1)); },
  celebrate(a, t, w) { const p = Math.sin(t * Math.PI * 6) * 0.25; arms(a, w, D(-0.5, 0.85 + p, 0.1), D(-0.3, 1, 0.1), D(0.5, 0.85 - p, 0.1), D(0.3, 1, 0.1)); },
  // classic cartoon zombie: both arms straight out front, lazily swaying; head lolls to one side
  zombie(a, t, w) {
    const p = a.zph || 0, sw = Math.sin(t * 2.2 + p) * 0.12, sw2 = Math.sin(t * 2.2 + p + 1.7) * 0.12;
    arms(a, w, D(-0.18, 0.12 + sw, 1), D(-0.06, 0.05 + sw, 1), D(0.18, 0.12 + sw2, 1), D(0.06, 0.02 + sw2, 1));
    const h = a.bones['Head']; if (h) { h.rotation.z += (0.32 + Math.sin(t * 1.3 + p) * 0.12) * (a.tilt || 1) * w; h.rotation.x += 0.15 * w; h.updateMatrixWorld(true); }
  },
  // zombie blocker: both hands up high
  zblock(a, t, w) { arms(a, w, D(-0.25, 1, 0.3), D(-0.15, 1, 0.35), D(0.25, 1, 0.3), D(0.15, 1, 0.35)); },
  // hitter loaded in the air: bow-and-arrow, left hand up at the ball, hitting arm cocked behind the head
  cock(a, t, w) { arms(a, w, D(-0.25, 0.95, 0.35), D(-0.1, 0.95, 0.3), D(0.4, 0.85, -0.35), D(-0.15, 0.35, -0.9)); },
  // the whip through: progress t 0..1
  swing(a, t, w) {
    const s = ease(Math.min(1, t * 2.2));
    arms(a, w, D(-0.25, 0.95 - s * 1.3, 0.35 + s * 0.25), D(-0.1, 0.95 - s * 1.4, 0.3), D(0.55 - s * 0.6, 0.65 + s * 0.2 - s * s * 0.95, -0.55 + s * 1.4), D(0.2 - s * 0.25, 0.5 - s * 1.2 + (1 - s) * 0.4, -0.85 + s * 1.7));
  },
  ready(a, t, w) { arms(a, w, D(-0.25, -0.75, 0.45), D(-0.05, -0.1, 1), D(0.25, -0.75, 0.45), D(0.05, -0.1, 1)); },
};

export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function numberCanvas(num, fill, trim) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 148;
  const x = cv.getContext('2d');
  x.font = '700 22px "Bebas Neue", Oswald, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = fill; x.fillText('GCVC', 64, 18);
  x.font = '700 104px "Bebas Neue", Oswald, Impact, sans-serif';
  x.lineWidth = 8; x.strokeStyle = trim; x.strokeText(String(num), 64, 92);
  x.fillStyle = fill; x.fillText(String(num), 64, 92);
  return cv;
}
export function numberTexture(num, fill, trim) {
  const t = new THREE.CanvasTexture(numberCanvas(num, fill, trim)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.num = num; return t;
}
numberTexture.canvas = numberCanvas;
