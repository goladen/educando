/**
 * Prepara un modelo de Sketchfab para el Visor 3D.
 *
 *   npm run modelo          → pregunta la ruta (puedes ARRASTRAR el archivo)
 *   npm run modelo -- "C:\ruta\al\archivo.zip"
 *   npm run modelo -- carpeta_descomprimida
 *   npm run modelo -- modelo.gltf
 *   npm run modelo -- modelo.glb
 *
 * Hace tres cosas:
 *   1. Descomprime el zip si hace falta.
 *   2. Empaqueta el .gltf + .bin + texturas en un único .glb.
 *   3. Lo optimiza con gltf-transform (texturas a 1024 px, malla comprimida).
 *
 * Deja el resultado como <nombre>-listo.glb al lado del original y te dice
 * cuánto ha adelgazado. Ese archivo es el que subes en el Visor 3D.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import { NodeIO } from '@gltf-transform/core';

const ejecutar = promisify(execFile);
// En Windows el ejecutable es npx.cmd; execFile no lo resuelve solo.
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const MB = (bytes) => (bytes / 1048576).toFixed(1) + ' MB';

/* ---------- 1. localizar el glTF y sus recursos ---------- */

/** Devuelve { json, resources, nombreBase } desde un zip, carpeta o archivo. */
async function cargarFuente(entrada) {
    const stat = await fs.stat(entrada).catch(() => null);
    if (!stat) throw new Error(`No existe: ${entrada}`);

    // (a) .glb ya empaquetado
    if (!stat.isDirectory() && /\.glb$/i.test(entrada)) {
        return { glb: new Uint8Array(await fs.readFile(entrada)), nombreBase: path.basename(entrada, path.extname(entrada)) };
    }

    // (b) .zip de Sketchfab
    if (!stat.isDirectory() && /\.zip$/i.test(entrada)) {
        const zip = await JSZip.loadAsync(await fs.readFile(entrada));
        const nombres = Object.keys(zip.files).filter(n => !zip.files[n].dir);

        const yaGlb = nombres.find(n => /\.glb$/i.test(n));
        if (yaGlb) {
            return { glb: await zip.files[yaGlb].async('uint8array'), nombreBase: path.basename(entrada, '.zip') };
        }

        const ruta = nombres.find(n => /\.gltf$/i.test(n));
        if (!ruta) throw new Error('El zip no contiene ningún .gltf ni .glb.');

        const carpeta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/') + 1) : '';
        const resources = {};
        for (const n of nombres) {
            if (n === ruta || (carpeta && !n.startsWith(carpeta))) continue;
            const rel = carpeta ? n.slice(carpeta.length) : n;
            resources[rel] = await zip.files[n].async('uint8array');
            resources[encodeURI(rel)] = resources[rel];
        }
        return {
            json: JSON.parse(await zip.files[ruta].async('string')),
            resources,
            nombreBase: path.basename(entrada, '.zip'),
        };
    }

    // (c) carpeta descomprimida o .gltf suelto
    const dir = stat.isDirectory() ? entrada : path.dirname(entrada);
    let gltf = stat.isDirectory() ? null : entrada;
    if (!gltf) {
        const hijos = await fs.readdir(dir);
        const encontrado = hijos.find(n => /\.gltf$/i.test(n)) || hijos.find(n => /\.glb$/i.test(n));
        if (!encontrado) throw new Error(`No hay ningún .gltf ni .glb en ${dir}`);
        gltf = path.join(dir, encontrado);
    }
    if (/\.glb$/i.test(gltf)) {
        return { glb: new Uint8Array(await fs.readFile(gltf)), nombreBase: path.basename(gltf, '.glb') };
    }

    // Recoge todos los archivos de la carpeta como recursos (bin + texturas).
    const resources = {};
    async function recorrer(actual, prefijo = '') {
        for (const n of await fs.readdir(actual, { withFileTypes: true })) {
            const completo = path.join(actual, n.name);
            const rel = prefijo + n.name;
            if (n.isDirectory()) { await recorrer(completo, rel + '/'); continue; }
            if (completo === gltf) continue;
            resources[rel] = new Uint8Array(await fs.readFile(completo));
            resources[encodeURI(rel)] = resources[rel];
        }
    }
    await recorrer(dir);
    return {
        json: JSON.parse(await fs.readFile(gltf, 'utf8')),
        resources,
        nombreBase: path.basename(gltf, path.extname(gltf)),
    };
}

/* ---------- 2. empaquetar ---------- */

async function empaquetar(fuente) {
    if (fuente.glb) return fuente.glb;
    const io = new NodeIO();
    const doc = await io.readJSON({ json: fuente.json, resources: fuente.resources });
    return await io.writeBinary(doc);
}

/* ---------- 3. optimizar con la CLI ---------- */

async function optimizar(entrada, salida) {
    // Hace falta shell: true porque en Windows npx es un .cmd, y Node no deja
    // lanzarlo con execFile directamente. Por eso las rutas van entrecomilladas.
    const cita = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
    const orden = (compresion) =>
        `${NPX} --yes @gltf-transform/cli optimize ${cita(entrada)} ${cita(salida)}` +
        ` --texture-size 1024 --compress ${compresion}`;
    const opciones = { shell: true, maxBuffer: 20 * 1024 * 1024 };

    // La primera vez npx descarga la CLI (incluye sharp para las texturas).
    try {
        const { stdout } = await ejecutar(orden('draco'), [], opciones);
        return { ok: true, log: stdout };
    } catch (e) {
        // Draco falla en algunas mallas (puntos, líneas). Meshopt es el plan B,
        // y el visor también lo sabe leer.
        try {
            const { stdout } = await ejecutar(orden('meshopt'), [], opciones);
            return { ok: true, log: stdout, nota: 'comprimido con meshopt (draco falló en este modelo)' };
        } catch (e2) {
            return { ok: false, error: (e2.stderr || e2.message || '').slice(-500) };
        }
    }
}

/* ---------- principal ---------- */

/**
 * Consigue la ruta del modelo.
 *
 * Sin comillas, npm parte la ruta en cada espacio y además colapsa los espacios
 * repetidos, así que una ruta como "C:\Users\Asus  6\..." llega rota y no hay
 * forma de reconstruirla. Por eso, si lo que viene por argumentos no existe,
 * preguntamos: ahí se puede arrastrar el archivo a la ventana, que es la manera
 * más cómoda y no necesita comillas ni teclear nada.
 */
async function pedirRuta() {
    const limpiar = (s) => String(s).trim().replace(/^["']|["']$/g, '');

    const args = process.argv.slice(2).filter(Boolean);
    if (args.length) {
        const candidatos = [limpiar(args.join(' ')), limpiar(args[0])];
        for (const c of candidatos) {
            if (await fs.stat(c).then(() => true, () => false)) return c;
        }
        console.log(`\n⚠️  No encuentro «${limpiar(args.join(' '))}».`);
        console.log('   (Si la ruta tiene espacios, en cmd hay que ponerla entre comillas.)');
    }

    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n📂 Arrastra aquí el .zip (o la carpeta) del modelo y pulsa Enter.');
    const respuesta = await rl.question('   Ruta: ');
    rl.close();

    const ruta = limpiar(respuesta);
    if (!ruta) { console.error('No has indicado ninguna ruta.'); process.exit(1); }
    return ruta;
}

const entrada = await pedirRuta();

console.log(`\n📦 Leyendo ${entrada}`);
const fuente = await cargarFuente(entrada);

const glb = await empaquetar(fuente);
console.log(`🧊 Empaquetado en .glb: ${MB(glb.length)}`);

const stat = await fs.stat(entrada);
const dirSalida = stat.isDirectory() ? entrada : path.dirname(entrada);
const intermedio = path.join(dirSalida, `${fuente.nombreBase}-tmp.glb`);
const salida = path.join(dirSalida, `${fuente.nombreBase}-listo.glb`);

await fs.writeFile(intermedio, glb);

console.log('⚙️  Optimizando (texturas a 1024 px + malla comprimida)…');
const res = await optimizar(intermedio, salida);

if (!res.ok) {
    await fs.rename(intermedio, salida);
    console.log(`\n⚠️  No se pudo optimizar, pero el .glb empaquetado sirve igual.`);
    console.log(`   Motivo: ${res.error}`);
    console.log(`\n✅ ${salida}  (${MB(glb.length)})`);
} else {
    await fs.unlink(intermedio).catch(() => {});
    const final = await fs.stat(salida);
    const ahorro = Math.round((1 - final.size / glb.length) * 100);
    const resumen = ahorro > 0 ? `${ahorro}% menos` : 'sin reducción, ya era mínimo';
    if (res.nota) console.log(`   ℹ️  ${res.nota}`);
    console.log(`\n✅ ${salida}`);
    console.log(`   ${MB(glb.length)} → ${MB(final.size)}  (${resumen})`);
    if (final.size > 8 * 1048576) {
        console.log(`   ⚠️  Sigue siendo grande para móviles. Prueba con --texture-size 512.`);
    }
}

console.log('\n👉 Súbelo en pikt.es → Visor 3D → Añadir modelo, y pega el enlace de Sketchfab');
console.log('   en "Enlace de origen" + botón ⬇️ Datos para rellenar autor y licencia.\n');
