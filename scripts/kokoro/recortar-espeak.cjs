// Recorta espeak-ng (Emscripten, GPL-3.0) a los idiomas que usa Kokoro fuera del
// inglés y deja el resultado en public/kokoro/ (lo carga public/kokoro/kokoro-worker.js).
// El paquete completo pesa 24 MB (≈100 idiomas); recortado, ≈1 MB.
//
// Uso (desde la raíz del repo):
//   npm pack @echogarden/espeak-ng-emscripten@0.3.5 && tar xzf echogarden-espeak-ng-emscripten-0.3.5.tgz
//   node scripts/kokoro/recortar-espeak.cjs package public/kokoro
//   (y borrar package/ y el .tgz)
const fs = require("fs"), path = require("path");
const src = process.argv[2];
const out = process.argv[3];
let js = fs.readFileSync(path.join(src, "espeak-ng.js"), "utf8");
const data = fs.readFileSync(path.join(src, "espeak-ng.data"));
const i = js.indexOf("loadPackage({") + 12; let d = 0, j = i;
for (; j < js.length; j++) { if (js[j] == "{") d++; if (js[j] == "}") { d--; if (!d) break; } }
const meta = Function("return " + js.slice(i, j + 1))();
const IDIOMAS = ["es", "fr", "it", "pt"];
const keep = meta.files.filter(f => !/_dict$/.test(f.filename) || IDIOMAS.some(l => f.filename.endsWith(`/${l}_dict`)));
let pos = 0; const partes = [];
const files = keep.map(f => { const b = data.subarray(f.start, f.end); partes.push(b); const n = { ...f, start: pos, end: pos + b.length }; pos += b.length; return n; });
const nuevo = { ...meta, files, remote_package_size: pos };
js = js.slice(0, i) + JSON.stringify(nuevo) + js.slice(j + 1);
fs.writeFileSync(path.join(out, "espeak-ng.js"), js);
fs.writeFileSync(path.join(out, "espeak-ng.data"), Buffer.concat(partes));
fs.copyFileSync(path.join(src, "COPYING"), path.join(out, "COPYING-espeak-ng.txt"));
console.log(meta.files.length, "->", files.length, "archivos;", data.length, "->", pos, "bytes");
