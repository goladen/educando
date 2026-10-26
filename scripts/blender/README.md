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

## Modelos en uso

| Juego | Carpeta | Origen | Licencia |
|---|---|---|---|
| Ovni Abducción | `public/modelos/granja/` (vaca, oveja, cerdo, caballo, llama, perro) | «Farm Animals» de Quaternius (opengameart.org/content/lowpoly-animated-farm-animal-pack) | CC0 |

Los carga `src/ovniModelos.js` (GLTFLoader + `SkeletonUtils.clone` por animal).
