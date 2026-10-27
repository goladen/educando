"""Extrae un sistema del atlas Z-Anatomy y lo exporta a un .glb ligero para three.js.

Uso:
  blender -b --factory-startup <Startup.blend> -P scripts/blender/anatomia_exportar.py -- \
      <coleccion> <salida.glb> <salida.json> [max_vertices_por_pieza] [seleccion.json]

  coleccion   p. ej. "1: Skeletal system" (o varias separadas por comas)
  max_vertices_por_pieza   por defecto 900 (las piezas pequeñas no se tocan)
  seleccion.json  opcional (musculos_seleccion.json, organos_seleccion.json): en vez de
                  exportar todas las piezas, une las de cada entrada en una sola pieza por
                  lado (id.r / id.l) y copia nombre, zona, grupo y tipo al JSON. Cada entrada:
                    partes       nombres exactos (sin .r/.l)
                    colecciones  todas las piezas de esas subcolecciones del atlas
                    excluir      regex de nombres a descartar
                    unir_lados   una sola pieza con los dos lados
                    color        [r, g, b] propio
                    procedural   "rinon": genera la forma en vez de usar la malla del atlas
                                 (solo toma de ella posición y tamaño)

Todos los sistemas se escalan y centran con la MISMA referencia (el esqueleto), para que
huesos, músculos y órganos encajen al cargarlos juntos en el visor.

Qué hace:
  - Se queda con las piezas reales (mallas con más de 8 vértices; descarta los puntos de
    anclaje de etiquetas .i/.j y los textos). En modo selección acepta también curvas con
    grosor (esófago, aorta, nervios…).
  - Aplica modificadores y reduce polígonos (Decimate) hasta el máximo indicado.
  - Pone el origen de cada pieza en el centro de su caja: así en el visor gira sobre sí
    misma cuando se separa del cuerpo.
  - Escala a metros reales (cuerpo de 1,75 m), pies en 0, centrado en X/Y (en three.js mira
    hacia +Z).
  - Material según el tipo de pieza (hueso, diente, cartílago, músculo…) o color propio.
  - Exporta con compresión Draco y escribe un JSON con los datos de cada pieza.

Licencia de los modelos: Z-Anatomy (CC BY-SA 4.0) / BodyParts3D (CC BY-SA 2.1 JP).
NO usar las piezas de origen no comercial (oído interno de Dundee, riñón de L. Cowley).
"""
import os
import sys
import re
import json
import bpy
import bmesh
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
COLECCION, SALIDA_GLB, SALIDA_JSON = a[0], a[1], a[2]
MAX_VERTS = int(a[3]) if len(a) > 3 else 900
SELECCION = json.load(open(a[4], encoding='utf-8')) if len(a) > 4 else None
ALTO_CUERPO = 1.75

# Piezas con licencia no comercial: nunca se exportan
EXCLUIR = re.compile(r'(cochlea|vestibul|semicircular|labyrinth)', re.I)

MATERIALES = {
    'hueso': (0.89, 0.84, 0.74, 1),
    'diente': (0.97, 0.96, 0.92, 1),
    'cartilago': (0.66, 0.78, 0.85, 1),
    'musculo': (0.62, 0.17, 0.15, 1),
    'tendon': (0.9, 0.86, 0.76, 1),
    'organo': (0.85, 0.55, 0.5, 1),
}


def tipo_material(nombre, grupos):
    t = (nombre + ' ' + ' '.join(grupos)).lower()
    if 'teeth' in t or 'tooth' in t or 'incisor' in t or 'canine' in t or 'molar' in t:
        return 'diente'
    if 'cartilage' in t:
        return 'cartilago'
    return 'hueso'


def grupos_de(o):
    g, p = [], o.parent
    while p:
        if p.name.endswith('.g'):
            g.append(p.name[:-2])
        p = p.parent
    return list(reversed(g))


def es_pieza(o, curvas=False):
    if o.type == 'CURVE' and curvas:  # esófago, aorta, nervios… son curvas con grosor
        return not re.search(r'\.(g|s|t)$', o.name) and not EXCLUIR.search(o.name)
    return (o.type == 'MESH' and len(o.data.vertices) > 8
            and not re.search(r'\.(i|j|g|s|t)$', o.name)
            and not EXCLUIR.search(o.name))


def rinon(referencia):
    """Riñón con forma de judía, del tamaño y en el sitio de la pieza de referencia."""
    dgr = bpy.context.evaluated_depsgraph_get()
    caja = [referencia.matrix_world @ Vector(c) for c in referencia.evaluated_get(dgr).bound_box]
    cmin = Vector((min(p.x for p in caja), min(p.y for p in caja), min(p.z for p in caja)))
    cmax = Vector((max(p.x for p in caja), max(p.y for p in caja), max(p.z for p in caja)))
    centro, tam = (cmin + cmax) / 2, cmax - cmin
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
    hacia_dentro = -1 if centro.x > 0 else 1  # el hilio mira hacia la columna (x = 0)
    for v in bm.verts:
        x, y, z = v.co
        # hendidura del hilio en el lado interno, en la mitad de la altura
        if x * hacia_dentro > 0:
            v.co.x -= hacia_dentro * 0.55 * max(0.0, 1 - abs(z) / 0.55) * (x * hacia_dentro)
        v.co.x *= tam.x * 0.5
        v.co.y *= tam.y * 0.5
        v.co.z *= tam.z * 0.5
        v.co += centro
    me = bpy.data.meshes.new('rinon_tmp')
    bm.to_mesh(me)
    bm.free()
    return me


colecciones = [bpy.data.collections[c.strip()] for c in COLECCION.split(',')]
piezas = []
for col in colecciones:
    piezas += [o for o in col.objects if es_pieza(o, curvas=bool(SELECCION)) and o not in piezas]

# Referencia común de escala: la caja del esqueleto (en coordenadas de mundo)
dg = bpy.context.evaluated_depsgraph_get()
ref_min = Vector((1e9, 1e9, 1e9))
ref_max = Vector((-1e9, -1e9, -1e9))
for o in bpy.data.collections['1: Skeletal system'].objects:
    if not es_pieza(o):
        continue
    for c in o.evaluated_get(dg).bound_box:
        w = o.matrix_world @ Vector(c)
        ref_min = Vector(map(min, ref_min, w))
        ref_max = Vector(map(max, ref_max, w))

# Fuentes: (nombre de salida, [objetos origen], datos extra)
fuentes = []
if SELECCION:
    por_nombre = {o.name: o for o in piezas}
    entradas = SELECCION.get('piezas') or SELECCION.get('musculos')
    tipo_defecto = 'musculo' if 'musculos' in SELECCION else 'organo'
    for m in entradas:
        extra = {k: m[k] for k in ('nombre', 'zona', 'grupo') if k in m}
        extra['tipo'] = m.get('tipo', tipo_defecto)
        if 'color' in m:
            extra['color'] = m['color']
        if m.get('procedural'):
            extra['procedural'] = m['procedural']
        lados = {}
        if m.get('colecciones'):
            excluir = re.compile(m['excluir'], re.I) if m.get('excluir') else None
            for o in piezas:
                if o.type != 'MESH' or (excluir and excluir.search(o.name)):
                    continue
                if not any(c.name in m['colecciones'] for c in o.users_collection):
                    continue
                lado = o.name[-2:] if re.search(r'\.(r|l)$', o.name) else ''
                lados.setdefault(lado, []).append(o)
        else:
            for lado in ('.r', '.l', ''):
                objs = [por_nombre[p + lado] for p in m['partes'] if p + lado in por_nombre]
                if objs:
                    faltan = [p for p in m['partes'] if p + lado not in por_nombre]
                    if faltan and lado:
                        print(f'AVISO {m["id"]}{lado}: faltan {faltan}')
                    lados[lado] = objs
        if not lados:
            print(f'AVISO {m["id"]}: no se encontró ninguna parte')
            continue
        if m.get('unir_lados'):
            lados = {'': [o for grupo in lados.values() for o in grupo]}
        for lado, objs in lados.items():
            fuentes.append((m['id'] + lado, objs, extra))
        print(f'  {m["id"]}: ' + ', '.join(f'{(l or "único")}={len(o)}' for l, o in lados.items()))
else:
    fuentes = [(o.name, [o], {}) for o in piezas]
info = {nombre: {'grupos': grupos_de(objs[0]), 'extra': extra} for nombre, objs, extra in fuentes}
print(f'Piezas: {len(fuentes)}')

mats = {}


def material(clave, color):
    if clave not in mats:
        m = bpy.data.materials.new('anat_' + clave)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = 0.75
        mats[clave] = m
    return mats[clave]


for clave, color in MATERIALES.items():
    material(clave, color)

nuevos = []
for nombre, objs, extra in fuentes:
    # mallas evaluadas (con modificadores) en coordenadas de mundo, unidas en una
    bm = bmesh.new()
    for o in objs:
        if extra.get('procedural') == 'rinon':
            tmp = rinon(o)
        else:
            tmp = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            tmp.transform(o.matrix_world)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for o in objs:
        if o.name == nombre:
            o.name = nombre + '__origen'  # libera el nombre para la pieza exportada
    obj = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(obj)  # en la escena evaluada: si no, Decimate no se aplica
    nuevos.append(obj)

# reducción de polígonos
total_antes = total_despues = 0
for obj in nuevos:
    n = len(obj.data.vertices)
    total_antes += n
    if n > MAX_VERTS:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bm.to_mesh(obj.data)
        bm.free()
        mod = obj.modifiers.new('reducir', 'DECIMATE')
        mod.ratio = MAX_VERTS / n
        dg2 = bpy.context.evaluated_depsgraph_get()
        reducida = bpy.data.meshes.new_from_object(obj.evaluated_get(dg2))
        obj.modifiers.clear()
        vieja = obj.data
        obj.data = reducida
        bpy.data.meshes.remove(vieja)
    total_despues += len(obj.data.vertices)

# escala a metros y pies en el suelo, centrado (misma referencia para todos los sistemas)
mn, mx = ref_min, ref_max
k = ALTO_CUERPO / (mx.z - mn.z)
desplaza = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
datos = []
for obj in nuevos:
    me = obj.data
    me.transform(Matrix.Translation(-desplaza))
    me.transform(Matrix.Scale(k, 4))
    # origen en el centro de la pieza
    vs = [v.co for v in me.vertices]
    cmin = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    cmax = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    centro = (cmin + cmax) / 2
    me.transform(Matrix.Translation(-centro))
    obj.location = centro
    for p in me.polygons:
        p.use_smooth = True
    g = info[obj.name]['grupos']
    extra = info[obj.name]['extra']
    me.materials.clear()
    if 'color' in extra:
        me.materials.append(material('c_' + obj.name.split('.')[0], (*extra['color'], 1)))
    else:
        me.materials.append(mats[extra['tipo'] if 'tipo' in extra else tipo_material(obj.name, g)])
    lado = 'r' if obj.name.endswith('.r') else 'l' if obj.name.endswith('.l') else ''
    # three.js: Blender (x, y, z) -> glTF (x, z, -y)
    datos.append({
        'id': obj.name, 'en': re.sub(r'\.(r|l)$', '', obj.name).strip(), 'lado': lado,
        'grupos': g, 'vertices': len(me.vertices),
        'centro': [round(centro.x, 4), round(centro.z, 4), round(-centro.y, 4)],
        'tam': [round(cmax.x - cmin.x, 4), round(cmax.z - cmin.z, 4), round(cmax.y - cmin.y, 4)],
        **{k2: v for k2, v in extra.items() if k2 not in ('color', 'procedural')},
    })

print(f'Vértices: {total_antes:,} -> {total_despues:,}')

# Exportar desde un Blender vacío: el atlas completo (300 MB) hace fallar al exportador.
# Se guardan las piezas en un .blend intermedio, se vacía todo y se vuelven a cargar.
intermedio = os.path.splitext(SALIDA_GLB)[0] + '_piezas.blend'
bpy.data.libraries.write(intermedio, set(nuevos), fake_user=True)
nombres = [o.name for o in nuevos]
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(intermedio, link=False) as (origen, destino):
    destino.objects = [n for n in origen.objects if n in nombres]
escena = bpy.context.scene
for o in destino.objects:
    escena.collection.objects.link(o)
    o.select_set(True)
opciones = dict(
    filepath=SALIDA_GLB, export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_animations=False,
    export_cameras=False, export_lights=False, export_normals=True,
    export_texcoords=False, export_tangents=False, export_materials='EXPORT',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
)
validas = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
bpy.ops.export_scene.gltf(**{c: v for c, v in opciones.items() if c in validas})
os.remove(intermedio)

with open(SALIDA_JSON, 'w', encoding='utf-8') as f:
    json.dump({'coleccion': COLECCION, 'alto': ALTO_CUERPO, 'piezas': datos}, f, ensure_ascii=False, indent=1)
print('Exportado', SALIDA_GLB)
