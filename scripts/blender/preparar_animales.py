"""Prepara animales animados para los juegos three.js (Ovni Abducción…).

Uso (Blender en segundo plano, sin abrir la interfaz):
  blender -b --factory-startup -P scripts/blender/preparar_animales.py -- <carpeta_origen> <carpeta_salida>

Por cada .blend / .fbx / .glb de la carpeta de origen:
  1. Deja un único esqueleto (armature) con su malla.
  2. Lo orienta con la cabeza hacia -Y de Blender (= +Z en three.js) y lo
     escala a 1 unidad de alto, con el origen en el suelo y centrado.
  3. Se queda solo con las animaciones conocidas y con nombres fijos
     (Idle, Walk, WalkSlow, Run, Jump; Eat si existe), muestreadas cada PASO_FOTOGRAMAS para que el juego las encuentre.
  4. Exporta un .glb y lo vuelve a importar para comprobar que salen las animaciones.
Al final escribe <carpeta_salida>/animales.json con lo exportado.

El nombre del archivo de salida sale de NOMBRES (Cow.blend → vaca.glb); si no
está en la tabla, se usa el nombre original en minúsculas.
"""
import sys
import os
import json
import math
import bpy
from mathutils import Vector

NOMBRES = {
    'cow': 'vaca', 'horse': 'caballo', 'sheep': 'oveja', 'pig': 'cerdo',
    'llama': 'llama', 'pug': 'perro', 'zebra': 'cebra', 'chicken': 'gallina',
}
# Nombre final de cada animación → variantes que aceptamos en el origen
CLIPS = {
    'Idle': ['idle'],
    'Walk': ['walk'],
    'WalkSlow': ['walkslow', 'walk_slow'],
    'Run': ['run', 'gallop'],
    'Jump': ['jump'],
    # 'Death' no se exporta: ningún juego la usa y pesa (añadir aquí si hiciera falta)
    'Eat': ['eat', 'eating', 'graze'],
}
EXT = ('.blend', '.fbx', '.glb', '.gltf')
ALTO = 1.0
# Fotogramas de animación: 2 = la mitad (three interpola entre ellos y no se nota). Reduce ~30 % el .glb
PASO_FOTOGRAMAS = 2


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(a) < 2:
        raise SystemExit('Uso: ... -- <carpeta_origen> <carpeta_salida>')
    return a[0], a[1]


def abrir(ruta):
    ext = os.path.splitext(ruta)[1].lower()
    if ext == '.blend':
        bpy.ops.wm.open_mainfile(filepath=ruta)
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=ruta)
    else:
        bpy.ops.import_scene.gltf(filepath=ruta)


def nombre_clip(nombre_accion):
    """'Armature|Armature|WalkSlow' → 'WalkSlow' (o None si no es una que usemos)."""
    base = nombre_accion.split('|')[-1].strip().lower().replace(' ', '')
    for final, variantes in CLIPS.items():
        if base in variantes:
            return final
    return None


def caja_mallas(mallas):
    pts = [m.matrix_world @ Vector(c) for m in mallas for c in m.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def materiales_para_gltf():
    """Rehace cada material con un único Principled BSDF.

    Los packs de Quaternius traen varias salidas y la activa usa Diffuse BSDF,
    que el exportador glTF no entiende (sale blanco). El color bueno está en
    el Base Color del Principled o, si no lo hay, en el color de vista.
    """
    for m in bpy.data.materials:
        color = tuple(m.diffuse_color)
        if m.use_nodes and m.node_tree:
            bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf and not bsdf.inputs['Base Color'].is_linked:
                color = tuple(bsdf.inputs['Base Color'].default_value)
        m.use_nodes = True
        nodos = m.node_tree.nodes
        nodos.clear()
        salida = nodos.new('ShaderNodeOutputMaterial')
        bsdf = nodos.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = 0.9
        bsdf.inputs['Metallic'].default_value = 0.0
        m.node_tree.links.new(bsdf.outputs['BSDF'], salida.inputs['Surface'])
        salida.is_active_output = True


def preparar(ruta, salida):
    abrir(ruta)
    materiales_para_gltf()
    escena = bpy.context.scene
    armaduras = [o for o in escena.objects if o.type == 'ARMATURE']
    if len(armaduras) != 1:
        raise RuntimeError(f'esperaba 1 esqueleto y hay {len(armaduras)}')
    arm = armaduras[0]
    mallas = [o for o in escena.objects if o.type == 'MESH']
    # fuera cámaras, luces y demás
    for o in list(escena.objects):
        if o is not arm and o not in mallas:
            bpy.data.objects.remove(o, do_unlink=True)

    # posición de reposo para medir
    for a in [arm]:
        if a.animation_data:
            a.animation_data.action = None
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()

    # 1) orientación: la cabeza debe quedar hacia -Y
    cabeza = next((b for b in arm.data.bones if b.name.lower() == 'head'), None) \
        or next((b for b in arm.data.bones if 'head' in b.name.lower()), None)
    mn, mx = caja_mallas(mallas)
    centro = (mn + mx) / 2
    if cabeza is not None:
        y_cabeza = (arm.matrix_world @ cabeza.head_local).y
        if y_cabeza > centro.y:
            arm.rotation_euler.z += math.pi
            bpy.context.view_layer.update()

    # 2) escala a ALTO y origen en el suelo, centrado en X/Y
    mn, mx = caja_mallas(mallas)
    k = ALTO / max(mx.z - mn.z, 1e-6)
    arm.scale = arm.scale * k
    bpy.context.view_layer.update()
    mn, mx = caja_mallas(mallas)
    arm.location -= Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    bpy.context.view_layer.update()
    mn, mx = caja_mallas(mallas)

    # 3) animaciones: renombrar las conocidas y borrar el resto
    elegidas = {}
    for accion in list(bpy.data.actions):
        final = nombre_clip(accion.name)
        if final and final not in elegidas:
            elegidas[final] = accion
        else:
            bpy.data.actions.remove(accion)
    if arm.animation_data:
        for pista in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(pista)
    else:
        arm.animation_data_create()
    for final, accion in elegidas.items():
        accion.name = final
        accion.use_fake_user = True
        # cada acción en su pista NLA: el exportador las saca como clips separados
        pista = arm.animation_data.nla_tracks.new()
        pista.name = final
        pista.strips.new(final, int(accion.frame_range[0]), accion)
        pista.mute = True
    arm.data.pose_position = 'POSE'
    arm.animation_data.action = elegidas.get('Idle')

    # 4) exportar (solo pasamos opciones que existan en esta versión de Blender)
    os.makedirs(salida, exist_ok=True)
    base = os.path.splitext(os.path.basename(ruta))[0]
    nombre = NOMBRES.get(base.lower(), base.lower())
    destino = os.path.join(salida, nombre + '.glb')
    opciones = dict(
        filepath=destino, export_format='GLB',
        export_animations=True, export_animation_mode='NLA_TRACKS',
        export_skins=True, export_morph=False,
        export_cameras=False, export_lights=False,
        export_optimize_animation_size=True,
        export_apply=False, export_yup=True,
        export_force_sampling=True, export_frame_step=PASO_FOTOGRAMAS,
    )
    validas = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{c: v for c, v in opciones.items() if c in validas})

    # 5) comprobación: reimportar y contar animaciones
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=destino)
    clips = sorted({a.name.split('|')[-1] for a in bpy.data.actions})
    faltan = sorted(set(elegidas) - set(clips))
    return {
        'animal': nombre, 'archivo': os.path.basename(destino), 'origen': os.path.basename(ruta),
        'clips': clips, 'faltan': faltan,
        'medidas': {'ancho': round(mx.x - mn.x, 3), 'largo': round(mx.y - mn.y, 3), 'alto': round(mx.z - mn.z, 3)},
        'kb': round(os.path.getsize(destino) / 1024, 1),
    }


origen, salida = args()
rutas = [os.path.join(origen, f) for f in sorted(os.listdir(origen)) if f.lower().endswith(EXT)]
resultado = []
for r in rutas:
    try:
        info = preparar(r, salida)
        resultado.append(info)
        print(f"OK  {info['origen']:14} -> {info['archivo']:12} {info['kb']:7} KB  clips={info['clips']}  faltan={info['faltan']}  medidas={info['medidas']}")
    except Exception as e:
        print(f'ERROR {os.path.basename(r)}: {e}')
with open(os.path.join(salida, 'animales.json'), 'w', encoding='utf-8') as f:
    json.dump({x['animal']: x for x in resultado}, f, ensure_ascii=False, indent=2)
print(f'Listo: {len(resultado)} de {len(rutas)} en {salida}')
