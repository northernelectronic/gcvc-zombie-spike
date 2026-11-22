// Quaternius Universal Base Characters (CC0) -> public/woman.glb (+ hair glbs). Textures are dropped here;
// the game uses kit textures baked by tools/bake-kits.py (public/kits/*.jpg) and a small eye texture.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, weld } from '@gltf-transform/functions';
import fs from 'fs';
const SRC = '/workspace/ubc/Universal Base Characters[Standard]/';
const io = new NodeIO();
async function strip(inp, out, keepTex = []) {
  const doc = await io.read(inp);
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const sem of p.listSemantics()) if (/TEXCOORD_[1-9]|COLOR_/.test(sem)) p.setAttribute(sem, null);
  for (const mat of doc.getRoot().listMaterials()) {
    if (!keepTex.includes(mat.getName())) { mat.setBaseColorTexture(null); }
    mat.setNormalTexture(null); mat.setMetallicRoughnessTexture(null);
  }
  for (const t of doc.getRoot().listTextures()) if (!t.listParents().some(p => p.propertyType === 'Material')) t.dispose();
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), dedup());
  await io.write(out, doc);
  console.log(out, fs.statSync(out).size);
}
await strip(SRC + 'Base Characters/Godot - UE/Superhero_Female_FullBody.gltf', 'public/woman.glb', ['MI_Eyes']);
for (const h of ['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale', 'Hair_SimpleParted'])
  await strip(SRC + `Hairstyles/Origin at 0/glTF (Godot)/${h}.gltf`, `public/${h.toLowerCase().replace('hair_', 'hair-')}.glb`);
