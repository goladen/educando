"""Inspecciona modelos 3D (fbx / glb / gltf / obj / blend) con Blender en segundo plano.

Uso:
  blender -b --factory-startup -P scripts/blender/inspeccionar.py -- <archivo o carpeta> [...]

Muestra por archivo: mallas (vértices, materiales), armaduras (huesos), acciones
(nombre, fotogramas) y la caja que ocupa el modelo (ancho, alto, largo y hacia dónde mira).
"""
import sys
import os
import bpy
from mathutils import Vector

EXT = ('.fbx', '.glb', '.gltf', '.obj', '.blend')


def args():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def importar(ruta):
    ext = os.path.splitext(ruta)[1].lower()
    if ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=ruta)
    elif ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=ruta)
    elif ext == '.obj':
        bpy.ops.wm.obj_import(filepath=ruta)
    elif ext == '.blend':
        bpy.ops.wm.open_mainfile(filepath=ruta)


def caja():
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    if not pts:
        return None
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def informe(ruta):
    limpiar()
    importar(ruta)
    print('\n=== ' + os.path.basename(ruta) + ' ===')
    for o in bpy.context.scene.objects:
        linea = f'  {o.type:9} {o.name!r}  escala={tuple(round(s, 3) for s in o.scale)}  rot={tuple(round(r, 3) for r in o.rotation_euler)}'
        if o.type == 'MESH':
            linea += f'  vertices={len(o.data.vertices)}  materiales={[m.name for m in o.data.materials if m]}'
        if o.type == 'ARMATURE':
            linea += f'  huesos={len(o.data.bones)}'
        print(linea)
    for a in bpy.data.actions:
        ini, fin = a.frame_range
        print(f'  ACCION    {a.name!r}  fotogramas {int(ini)}-{int(fin)}')
    c = caja()
    if c:
        mn, mx = c
        d = mx - mn
        print(f'  CAJA      x={d.x:.3f}  y={d.y:.3f}  z={d.z:.3f}   min={tuple(round(v, 3) for v in mn)}  max={tuple(round(v, 3) for v in mx)}')
    print(f'  FPS escena: {bpy.context.scene.render.fps}')


rutas = []
for a in args():
    if os.path.isdir(a):
        rutas += [os.path.join(a, f) for f in sorted(os.listdir(a)) if f.lower().endswith(EXT)]
    else:
        rutas.append(a)
for r in rutas:
    try:
        informe(r)
    except Exception as e:  # sigue con el resto
        print(f'  ERROR con {r}: {e}')
