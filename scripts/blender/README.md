# Modelos 3D con Blender en segundo plano

Scripts para preparar modelos animados para los juegos three.js sin abrir la
interfaz de Blender. Blender instalado en este equipo:

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
```

(abajo se abrevia como `blender`).

## 1. Inspeccionar un pack descargado

```
blender -b --factory-startup -P scripts/blender/inspeccionar.py -- <carpeta o archivos>
```

Lista mallas, esqueletos, animaciones (con sus fotogramas) y la caja que ocupa cada modelo.
Ojo: los FBX de Quaternius pierden animaciones; los `.blend` del mismo pack las traen todas.

## 2. Preparar los animales

```
blender -b --factory-startup -P scripts/blender/preparar_animales.py -- <carpeta_origen> <carpeta_salida>
```

Por cada `.blend` / `.fbx` / `.glb`:

- cabeza hacia +Z en three.js, 1 unidad de alto, origen en los pies;
- materiales rehechos con Principled BSDF (si no, el exportador glTF los saca blancos);
- solo las animaciones `Idle`, `Walk`, `WalkSlow`, `Run`, `Jump` (y `Eat` si existe), con esos nombres y muestreadas cada 2 fotogramas (`PASO_FOTOGRAMAS`) para pesar menos;
- exporta `.glb`, lo reimporta para comprobarlo y escribe `animales.json`.

Los nombres de salida están en `NOMBRES` (`Cow` → `vaca.glb`…).

## 3. Vista previa

```
blender -b --factory-startup -P scripts/blender/vista_previa.py -- <carpeta_glb> salida.png Run 8
```

Render de todos los `.glb` en fila, de perfil, en el fotograma indicado de una animación.

## 4. Anatomía (Z-Anatomy)

```
# inspeccionar el atlas (árbol de colecciones)
blender -b --factory-startup Startup.blend -P scripts/blender/anatomia_inspeccionar.py -- 2
# exportar un sistema (piezas reales, reducidas, origen en su centro, Draco)
blender -b --factory-startup Startup.blend -P scripts/blender/anatomia_exportar.py -- "1: Skeletal system" esqueleto.glb esqueleto_export.json 900
# nombres en español (TA2.csv del atlas + nombres escolares) → public/anatomia/esqueleto.json
node scripts/anatomia/generar_esqueleto.mjs TA2.csv esqueleto_export.json public/anatomia/esqueleto.json
# músculos: solo los de musculos_seleccion.json, uniendo sus partes (deltoides = 3 partes…)
blender -b --factory-startup Startup.blend -P scripts/blender/anatomia_exportar.py -- "4: Muscular system" musculos.glb musculos_export.json 1600 scripts/anatomia/musculos_seleccion.json
node scripts/anatomia/generar_capa.mjs musculos_export.json scripts/anatomia/musculos_seleccion.json musculos public/anatomia/musculos.json
# órganos: varias colecciones, curvas con grosor (esófago, aorta…) y riñón generado
blender -b --factory-startup Startup.blend -P scripts/blender/anatomia_exportar.py -- "8: Visceral systems,5: Cardiovascular system,7: Nervous system & Sense organs,6: Lymphoid organs" organos.glb organos_export.json 2500 scripts/anatomia/organos_seleccion.json
node scripts/anatomia/generar_capa.mjs organos_export.json scripts/anatomia/organos_seleccion.json organos public/anatomia/organos.json
```

Todas las capas se escalan con la caja del esqueleto, así encajan al cargarlas juntas.
Para añadir o renombrar un músculo u órgano basta con tocar su `*_seleccion.json` (renombrar
no necesita Blender: solo volver a ejecutar `generar_capa.mjs`).
El riñón NO usa la malla del atlas (podría ser la de L. Cowley, no comercial): el exportador
genera una forma de judía con la posición y el tamaño de esa pieza (`"procedural": "rinon"`).

`Startup.blend` viene dentro de `Z-Anatomy.zip` (github.com/Z-Anatomy/Models-of-human-anatomy).
Las mallas de 2 vértices `.i`/`.j` son anclajes de etiquetas, no piezas. Exportar desde un
Blender vacío (el script guarda un .blend intermedio): con el atlas cargado el exportador falla.

## Modelos en uso

| Juego | Carpeta | Origen | Licencia |
|---|---|---|---|
| Ovni Abducción | `public/modelos/granja/` (vaca, oveja, cerdo, caballo, llama, perro) | «Farm Animals» de Quaternius (opengameart.org/content/lowpoly-animated-farm-animal-pack) | CC0 |
| Biología · Cuerpo humano 3D | `public/anatomia/esqueleto.glb` + `.json` (277 huesos) y `musculos.glb` + `.json` (46 músculos, 91 piezas) | Z-Anatomy, basado en BodyParts3D (DBCLS) | CC BY-SA 4.0 / CC BY-SA 2.1 JP: crédito visible en el visor y los modelos derivados con la misma licencia. **No usar** el oído interno (Dundee) ni el riñón (L. Cowley): son no comerciales |

Los carga `src/ovniModelos.js` (GLTFLoader + `SkeletonUtils.clone` por animal).
