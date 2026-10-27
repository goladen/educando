"""Inspecciona el atlas Z-Anatomy (Startup.blend): árbol de colecciones con
número de objetos y vértices, para decidir qué extraer.

Uso:
  blender -b --factory-startup <Startup.blend> -P scripts/blender/anatomia_inspeccionar.py -- [profundidad] [filtro]

  profundidad  niveles de colecciones a mostrar (por defecto 3)
  filtro       si se da, lista además los objetos de las colecciones cuyo nombre lo contenga
"""
import sys
import bpy

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PROF = int(a[0]) if a else 3
FILTRO = a[1].lower() if len(a) > 1 else None


def objetos_de(col):
    vistos = set()
    pila = [col]
    while pila:
        c = pila.pop()
        for o in c.objects:
            vistos.add(o)
        pila.extend(c.children)
    return vistos


def verts(objs):
    return sum(len(o.data.vertices) for o in objs if o.type == 'MESH')


def arbol(col, nivel=0):
    objs = objetos_de(col)
    mallas = [o for o in objs if o.type == 'MESH']
    print(f"{'  ' * nivel}- {col.name!r}: {len(mallas)} mallas, {verts(mallas):,} vértices, {len(col.objects)} objetos directos")
    if FILTRO and FILTRO in col.name.lower():
        for o in sorted(col.objects, key=lambda o: o.name)[:400]:
            print(f"{'  ' * (nivel + 1)}· {o.type:8} {o.name!r} {len(o.data.vertices) if o.type == 'MESH' else ''}")
    if nivel + 1 < PROF:
        for c in col.children:
            arbol(c, nivel + 1)


print('Escenas:', [s.name for s in bpy.data.scenes])
print('Total objetos:', len(bpy.data.objects), '| mallas:', sum(1 for o in bpy.data.objects if o.type == 'MESH'),
      '| vértices totales:', f"{verts(bpy.data.objects):,}")
tipos = {}
for o in bpy.data.objects:
    tipos[o.type] = tipos.get(o.type, 0) + 1
print('Tipos:', tipos)
arbol(bpy.context.scene.collection)
