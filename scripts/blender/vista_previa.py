"""Render de comprobación: pone en fila todos los .glb de una carpeta, en un
fotograma de una animación, y guarda un PNG.

Uso:
  blender -b --factory-startup -P scripts/blender/vista_previa.py -- <carpeta_glb> <salida.png> [Animacion] [fotograma]
"""
import sys
import os
import math
import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
carpeta, png = a[0], a[1]
clip = a[2] if len(a) > 2 else 'Walk'
fotograma = int(a[3]) if len(a) > 3 else 10

bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene
archivos = sorted(f for f in os.listdir(carpeta) if f.endswith('.glb'))
for i, f in enumerate(archivos):
    antes = set(bpy.data.objects)
    acciones_antes = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(carpeta, f))
    nuevos = [o for o in bpy.data.objects if o not in antes]
    raiz = [o for o in nuevos if o.parent is None]
    for o in raiz:
        o.location.x += i * 2.4
        o.rotation_mode = 'XYZ'
        o.rotation_euler.z += math.radians(90)  # de perfil, mirando a la derecha
    for o in nuevos:
        if o.type == 'ARMATURE':
            # solo las acciones que trajo ESTE archivo (al importar varios, Blender las renombra Walk.001…)
            propias = [ac for ac in bpy.data.actions if ac not in acciones_antes]
            accion = next((ac for ac in propias if ac.name.split('|')[-1].split('.')[0] == clip), None)
            if o.animation_data is None:
                o.animation_data_create()
            if accion:
                o.animation_data.action = accion
                if getattr(accion, 'slots', None) and len(accion.slots):  # Blender 4.4+: acciones con ranuras
                    o.animation_data.action_slot = accion.slots[0]
    # etiqueta con el nombre
    bpy.ops.object.text_add(location=(i * 2.4 - 0.6, -1.5, 1.45), rotation=(math.radians(90), 0, 0))
    t = bpy.context.object
    t.data.body = os.path.splitext(f)[0]
    t.data.size = 0.35
escena.frame_set(fotograma)

# el motor Workbench usa el color de vista: copiamos el Base Color de cada material
for m in bpy.data.materials:
    if m.use_nodes:
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            m.diffuse_color = bsdf.inputs['Base Color'].default_value

ancho = max(1, len(archivos)) * 2.4
bpy.ops.mesh.primitive_plane_add(size=ancho + 6, location=(ancho / 2 - 1.2, 0, 0))
bpy.ops.object.camera_add(location=(ancho / 2 - 1.2, -20, 1.4), rotation=(math.radians(88), 0, 0))
cam = bpy.context.object
cam.data.type = 'ORTHO'
cam.data.ortho_scale = ancho + 0.4
escena.camera = cam
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10), rotation=(math.radians(40), math.radians(10), math.radians(30)))
bpy.context.object.data.energy = 3
escena.render.engine = 'BLENDER_WORKBENCH'
escena.display.shading.light = 'STUDIO'
escena.display.shading.color_type = 'MATERIAL'
escena.display.shading.show_shadows = True
escena.render.resolution_x, escena.render.resolution_y = 1800, 420
escena.render.filepath = png
bpy.ops.render.render(write_still=True)
print('PNG', png)
