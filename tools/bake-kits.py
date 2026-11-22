# Bakes volleyball kits onto the Quaternius Universal Base Characters female body texture (UV space).
# Each texel is classified by its interpolated bind-pose 3D position + skinning bone -> skin / jersey / shorts /
# knee pad / sock / shoe, numbers + crest are projected decals. Outputs public/kits/*.jpg + normal/roughness maps.
import sys, os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(__file__)); from ubc_load import load, SRC
S = 1024
OUT = 'public/kits'; os.makedirs(OUT, exist_ok=True)
TEX = SRC + '../Textures/'
d = load(); pos, uv, idx, bone = d['pos'], d['uv'], d['idx'], d['bone']
P = np.zeros((S, S, 3)); B = np.full((S, S), -1, int); M = np.zeros((S, S), bool)
names = sorted(set(bone)); bid = np.array([names.index(b) for b in bone])
for tri in idx:
    t = uv[tri] * S - 0.5
    x0, y0 = np.floor(t.min(0)).astype(int); x1, y1 = np.ceil(t.max(0)).astype(int)
    x0, y0 = max(x0 - 1, 0), max(y0 - 1, 0); x1, y1 = min(x1 + 1, S - 1), min(y1 + 1, S - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    (ax, ay), (bx, by), (cx, cy) = t
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-12: continue
    w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
    w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
    w2 = 1 - w0 - w1
    e = -0.02  # tiny dilation to avoid seams
    ins = (w0 >= e) & (w1 >= e) & (w2 >= e)
    if not ins.any(): continue
    W = np.stack([w0, w1, w2], -1)[ins]
    pp = W @ pos[tri]
    yy, xx = ys[ins], xs[ins]
    P[yy, xx] = pp; M[yy, xx] = True
    B[yy, xx] = bid[tri][W.argmax(1)]
# dilate coverage a few pixels (padding for mip seams)
for _ in range(4):
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.roll(np.roll(M, dy, 0), dx, 1); fill = sh & ~M
        P[fill] = np.roll(np.roll(P, dy, 0), dx, 1)[fill]; B[fill] = np.roll(np.roll(B, dy, 0), dx, 1)[fill]; M |= fill
bn = np.array(names + ['none'])[B]
x, y, z = P[..., 0], P[..., 1], P[..., 2]; ax_ = np.abs(x)
has = lambda *k: np.isin(bn, list(k))
torso = has('spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r')
# region ids: 0 skin, 1 jersey, 2 shorts, 3 sock, 4 shoe, 5 knee pad, 6 trim, 7 sole
R = np.zeros((S, S), np.uint8)
neckish = torso | has('neck_01')
ytop = 1.476 - 0.05 * np.clip(1 - ax_ / 0.07, 0, 1) * np.clip((z - 0.0) / 0.04, 0, 1)
jers = (neckish & (y < ytop)) | (has('upperarm_l', 'upperarm_r') & (ax_ < 0.225)) | (has('pelvis') & (y >= 0.995))
R[jers] = 1
neckTrim = jers & neckish & (y > ytop - 0.011)
sleeveTrim = jers & has('upperarm_l', 'upperarm_r') & (ax_ > 0.209)
R[neckTrim | sleeveTrim] = 6
shorts = (has('pelvis') & (y < 0.995)) | (has('thigh_l', 'thigh_r') & (y > 0.795 + 0.03 * np.clip((ax_ - 0.05) / 0.15, 0, 1)))
R[shorts] = 2
R[has('pelvis') & (y < 0.995) & (y > 0.975)] = 6  # waistband trim
kne = (has('thigh_l', 'thigh_r', 'calf_l', 'calf_r') & (y > 0.425) & (y < 0.585))
R[kne] = 5
R[has('calf_l', 'calf_r') & (y < 0.165)] = 3
foot = has('foot_l', 'foot_r', 'ball_l', 'ball_r', 'ball_leaf_l', 'ball_leaf_r')
R[foot & (y >= 0.078)] = 3
R[foot & (y < 0.078)] = 4
R[foot & (y < 0.016)] = 7
R[~M] = 0
np.save('/tmp/regions.npy', R)
# ---------- decals ----------
FONT = '/usr/share/fonts/truetype/sand-box/google/Barlow Condensed/BarlowCondensed-Bold.ttf'
def number_img(num, fill, stroke, word='GCVC', W=400, H=460):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    if word:
        f2 = ImageFont.truetype(FONT, 70); dr.text((W / 2, 50), word, font=f2, fill=fill, anchor='mm', stroke_width=4, stroke_fill=stroke)
    f = ImageFont.truetype(FONT, 330); dr.text((W / 2, 280 if word else H / 2), str(num), font=f, fill=fill, anchor='mm', stroke_width=12, stroke_fill=stroke)
    return np.asarray(im).astype(np.float64) / 255
def project(img, cx, cy, w, h, mirror, mask):
    # planar projection along z; returns rgba per texel
    hh, ww = img.shape[:2]
    u = (x - cx) / w * (-1 if mirror else 1) + 0.5; v = 1 - ((y - cy) / h + 0.5)
    ok = mask & (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    out = np.zeros((S, S, 4)); iu = np.clip((u * ww).astype(int), 0, ww - 1); iv = np.clip((v * hh).astype(int), 0, hh - 1)
    out[ok] = img[iv[ok], iu[ok]]
    return out
logo = Image.open('public/logo-square.jpg').convert('RGBA').resize((256, 256))
lm = Image.new('L', (256, 256), 0); ImageDraw.Draw(lm).ellipse((4, 4, 252, 252), fill=255); logo.putalpha(lm)
ring = ImageDraw.Draw(logo); ring.ellipse((4, 4, 252, 252), outline=(217, 221, 226, 255), width=10)
logoA = np.asarray(logo).astype(np.float64) / 255
backM = (R == 1) & torso & (z < -0.03)
frontM = (R == 1) & torso & (z > 0.03)
def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64) / 255
base_light = np.asarray(Image.open(TEX + 'T_Superhero_Female_Light_BaseColor.png').convert('RGB').resize((S, S), Image.LANCZOS)).astype(np.float64) / 255
base_dark = np.asarray(Image.open(TEX + 'T_Superhero_Female_Dark_BaseColor.png').convert('RGB').resize((S, S), Image.LANCZOS)).astype(np.float64) / 255
rng = np.random.default_rng(7)
def fbm(scale, seed):
    r = np.random.default_rng(seed); acc = np.zeros((S, S))
    for o in range(4):
        n = 4 * 2 ** o * scale; a = r.random((int(n) + 1, int(n) + 1))
        acc += np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)).astype(np.float64) / 255 / 2 ** o
    return acc / 1.875
weave = 1 + 0.035 * (np.sin(np.arange(S)[:, None] * 2.1) * np.sin(np.arange(S)[None, :] * 2.1))
def deunder(b):
    # the source texture has grey underwear painted on; replace low-saturation texels with skin tone
    mx, mn = b.max(-1), b.min(-1); sat = (mx - mn) / np.maximum(mx, 1e-3)
    grey = (sat < 0.18) & M
    skinMean = np.median(b[(sat > 0.3) & (R == 0) & M], 0)
    lum = b.mean(-1, keepdims=True)
    b = b.copy(); b[grey] = skinMean * np.clip(lum[grey] / max(lum[grey].mean(), 1e-3), 0.85, 1.1)
    return b
base_light = deunder(base_light); base_dark = deunder(base_dark)
def kit(name, jersey, trim, shorts, num, skin='light', zombie=False, seed=0, pad='#1d1d20', sock='#f2f2f2', shoe='#f4f4f4', shoeAcc='#c8102e', crest=True):
    base = (base_light if skin == 'light' else base_dark).copy()
    if zombie:
        lum = base.mean(-1, keepdims=True)
        tint = hexc(['#8fc46a', '#9dcf8a', '#7fb07a', '#a9c968'][seed % 4])
        blot = fbm(1.5, seed + 1)[..., None]
        base = lum / 0.62 * tint * (0.75 + 0.35 * blot)
        # bruise-purple patches and dark eye sockets
        pur = np.clip((fbm(2, seed + 9) - 0.62) * 4, 0, 1)[..., None]
        base = base * (1 - pur * 0.5) + hexc('#6a4a8a') * pur * 0.5
        de = np.sqrt(((y - 1.655) / 0.028) ** 2 + ((ax_ - 0.034) / 0.03) ** 2)
        ek = (np.clip(1.15 - de, 0, 1) * (has('Head') & (z > 0.02)))[..., None] * 0.75
        base = base * (1 - ek) + hexc('#2e1a36') * ek
        base = np.clip(base, 0, 1)
    out = base.copy()
    cols = {1: hexc(jersey), 2: hexc(shorts), 3: hexc(sock), 4: hexc(shoe), 5: hexc(pad), 6: hexc(trim), 7: hexc('#e9e4da')}
    shade = 0.92 + 0.08 * fbm(6, 3)
    for r, c in cols.items():
        m = R == r; out[m] = c * shade[m, None] * weave[m, None]
    # shoe accent swoosh-ish stripe
    acc = (R == 4) & (np.abs(y - 0.045) < 0.012) & (z < 0.05); out[acc] = hexc(shoeAcc)
    # side panels on jersey in trim colour
    side = (R == 1) & torso & (ax_ > 0.115) & (np.abs(z) < 0.045); out[side] = hexc(trim) * 0.9
    # decals
    nb = number_img(num, (255, 255, 255, 255) if hexc(jersey).mean() < 0.6 else (20, 20, 24, 255), tuple(int(v * 255) for v in hexc(trim)) + (255,), 'ZOMBIES' if zombie else 'GCVC')
    for img, cx, cy, w, h, mir, mk in [(nb, 0, 1.25, 0.25, 0.29, True, backM), (number_img(num, (255, 255, 255, 255) if hexc(jersey).mean() < 0.6 else (20, 20, 24, 255), tuple(int(v * 255) for v in hexc(trim)) + (255,), None), 0, 1.2, 0.12, 0.14, False, frontM & (ax_ < 0.07))]:
        dc = project(img, cx, cy, w, h, mir, mk); a = dc[..., 3:4]; out = out * (1 - a) + dc[..., :3] * a
    if crest and not zombie:
        dc = project(logoA, 0.075, 1.355, 0.075, 0.075, False, frontM); a = dc[..., 3:4]; out = out * (1 - a) + dc[..., :3] * a
    if zombie:
        # rips: holes in the jersey/shorts show (green) skin, plus grime
        rip = (fbm(3, seed + 21) > 0.70) & np.isin(R, [1, 2, 6])
        out[rip] = base[rip] * 0.85
        edge = (fbm(3, seed + 21) > 0.67) & ~rip & np.isin(R, [1, 2, 6]); out[edge] *= 0.55
        grime = np.clip((fbm(2.5, seed + 33) - 0.5) * 2.2, 0, 1)[..., None] * np.isin(R, [1, 2, 3, 4, 5, 6])[..., None]
        out = out * (1 - grime * 0.45) + hexc('#4a3a22') * grime * 0.45
    out = np.clip(out, 0, 1)
    Image.fromarray((out * 255).astype(np.uint8)).save(f'{OUT}/{name}.jpg', quality=88)
    print('kit', name)
kit('hitter', '#c8102e', '#d9dde2', '#111114', 7)
kit('setter', '#c8102e', '#d9dde2', '#111114', 3, skin='dark')
kit('z-walker', '#5b2a86', '#9ee02e', '#1a1424', 13, zombie=True, seed=0)
kit('z-walker2', '#4a2a6e', '#9ee02e', '#1a1424', 66, zombie=True, seed=1)
kit('z-libero', '#f0b400', '#5b2a86', '#1a1424', 1, zombie=True, seed=2)
kit('z-blocker', '#22402a', '#ff8a1e', '#101410', 99, zombie=True, seed=3)
kit('z-swatter', '#d2541c', '#111114', '#2a1408', 31, zombie=True, seed=1)
kit('z-boss', '#2a0d3a', '#9ee02e', '#0b0610', 0, zombie=True, seed=2)
# normal map: flatten clothing areas (spandex / jersey shouldn't show every muscle)
nm = np.asarray(Image.open(TEX + 'Normals Unity - Godot/T_Superhero_Female_Normal.png').convert('RGB').resize((S, S), Image.LANCZOS)).astype(np.float64)
flat = np.array([128, 128, 255.0]); k = np.where(np.isin(R, [1, 6]), 0.55, np.where(np.isin(R, [2, 3, 4, 5, 7]), 0.8, 0))[..., None]
nm = nm * (1 - k) + flat * k
Image.fromarray(nm.astype(np.uint8)).save(f'{OUT}/normal.jpg', quality=90)
# roughness (green channel): skin a touch glossy, fabric matte, shoes semi
rough = np.select([R == 0, np.isin(R, [1, 6]), R == 2, R == 5], [0.52, 0.72, 0.6, 0.45], 0.62)
Image.fromarray((np.stack([rough * 0, rough, rough * 0], -1) * 255).astype(np.uint8)).resize((512, 512)).save(f'{OUT}/rough.jpg', quality=90)
print('done')
