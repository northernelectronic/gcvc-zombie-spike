# shared loader for Quaternius Universal Base Characters (Superhero_Female) glTF -> numpy
import json, numpy as np, os
SRC = '/workspace/ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/'
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def load(name='Superhero_Female_FullBody', mesh='Superhero_Female'):
    g = json.load(open(SRC + name + '.gltf'))
    buf = open(SRC + g['buffers'][0]['uri'], 'rb').read()
    def acc(i):
        a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); n = NC[a['type']]; dt = CT[a['componentType']]
        stride = bv.get('byteStride', 0); size = np.dtype(dt).itemsize * n
        if stride and stride != size:
            raw = np.frombuffer(buf, np.uint8, count=stride * (a['count'] - 1) + size, offset=off)
            out = np.stack([np.frombuffer(raw[k * stride:k * stride + size].tobytes(), dt) for k in range(a['count'])])
        else:
            out = np.frombuffer(buf, dt, count=a['count'] * n, offset=off).reshape(a['count'], n) if n > 1 else np.frombuffer(buf, dt, count=a['count'], offset=off)
        return out
    m = next(mm for mm in g['meshes'] if mm['name'] == mesh)
    p = m['primitives'][0]; at = p['attributes']
    pos = acc(at['POSITION']).astype(np.float64); uv = acc(at['TEXCOORD_0']).astype(np.float64)
    J = acc(at['JOINTS_0']).astype(int); W = acc(at['WEIGHTS_0']).astype(np.float64)
    idx = acc(p['indices']).astype(int).reshape(-1, 3)
    joints = [g['nodes'][j]['name'] for j in g['skins'][0]['joints']]
    dom = J[np.arange(len(J)), W.argmax(1)]
    bone = np.array([joints[d] for d in dom])
    return dict(pos=pos, uv=uv, idx=idx, bone=bone)
