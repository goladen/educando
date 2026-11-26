// «🤖 Con tu IA» del editor de EtiquetaMe.
//   · DIBUJAR: el profe copia un prompt, su IA devuelve un JSON con un SVG (sin textos) y los
//     puntos de cada etiqueta → la imagen se guarda como data:image/svg+xml en la hoja.
//   · IMAGEN: el profe sube a su IA la imagen del diagrama con el prompt y la IA devuelve dónde
//     está cada parte (en % de la imagen) → se crean los puntos y las casillas se colocan solas.
// La respuesta se pega aquí: no se llama a ninguna API (cada profe usa su IA).
import { useMemo, useState } from 'react';

const LIENZO = { w: 1000, h: 700 };
const MAX_SVG = 300 * 1024; // el SVG va dentro del documento de Firestore (límite 1 MB)

// ── Prompts ──────────────────────────────────────────────────────────────────
const listaTexto = (lista) => lista.map((t) => `«${t}»`).join(', ');

export function promptDibujar({ tema, nivel, n, lista }) {
    const etiquetas = lista.length
        ? `exactamente estas ${lista.length} etiquetas: ${listaTexto(lista)}`
        : `${n} etiquetas con las partes más importantes que debe conocer un alumno de ${nivel}`;
    return `Eres ilustrador de material educativo. Crea un diagrama para que los alumnos etiqueten sus partes.
Tema: ${tema || '(escribe aquí el tema)'}
Nivel: ${nivel}

Devuélveme SOLO un objeto JSON válido, sin explicaciones y sin bloques de código, con esta forma:
{
  "titulo": "…",
  "svg": "<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='700' viewBox='0 0 1000 700'>…</svg>",
  "etiquetas": [ { "texto": "…", "punto": [x, y], "caja": [x, y] } ]
}

Reglas del dibujo (SVG):
- Lienzo de 1000 × 700 con fondo claro. Estilo esquema de libro de texto: colores planos, contornos marcados y cada parte con un color distinto.
- El dibujo va en el centro (x entre 250 y 750). Deja libres los márgenes izquierdo y derecho para las etiquetas.
- NO escribas ningún texto, número ni letra dentro del SVG: el alumno tiene que adivinar los nombres.
- Usa solo formas SVG (path, circle, ellipse, rect, polygon, polyline, line, g, defs, linearGradient, radialGradient, use). Nada de <script>, <image>, <text> ni <foreignObject>, ni enlaces a otras webs.
- Dentro del SVG usa comillas simples (') para que el JSON siga siendo válido.

Reglas de las etiquetas:
- ${etiquetas}. Nombres cortos, sin paréntesis ni barras (el alumno los escribirá tal cual).
- "punto": coordenadas en el lienzo de 1000 × 700 de un punto que quede DENTRO de la parte nombrada, en su centro, no en el borde.
- "caja": dónde va la casilla con el nombre, en los márgenes: x = 110 (izquierda) o x = 890 (derecha). Pon cada caja en el lado más cercano a su punto, a una altura parecida, y con al menos 70 de separación vertical entre cajas del mismo lado.
- Dos puntos no pueden estar a menos de 40 de distancia.
- Antes de responder, revisa que cada punto cae de verdad sobre la parte que nombra.`;
}

export function promptImagen({ tema, nivel, n, lista, url }) {
    const que = lista.length
        ? `Localiza en la imagen estas partes: ${listaTexto(lista)}.`
        : `Elige las ${n} partes más importantes que debe conocer un alumno de ${nivel}${tema ? ` (tema: ${tema})` : ''}.`;
    return `Te adjunto la imagen de un diagrama para un juego en el que los alumnos tienen que poner el nombre de cada parte.
${que}
${url && /^https?:/i.test(url) ? `(Si no ves la imagen adjunta, está en: ${url})\n` : ''}
Devuélveme SOLO un objeto JSON válido, sin explicaciones y sin bloques de código:
{ "etiquetas": [ { "texto": "…", "x": 0, "y": 0 } ] }

- "x" e "y" son la posición del punto en PORCENTAJE de la imagen completa: x = 0 es el borde izquierdo y 100 el derecho; y = 0 es el borde de arriba y 100 el de abajo. Usa decimales si hace falta.
- El punto tiene que caer DENTRO de la parte nombrada, en su centro, no en su borde.
- Si la imagen ya trae nombres escritos o flechas, el punto va sobre la parte, no sobre el rótulo.
- Nombres cortos, sin paréntesis ni barras (el alumno los escribirá tal cual).
- Antes de responder, revisa cada punto: mide desde los bordes de la imagen.`;
}

// ── Leer la respuesta de la IA ───────────────────────────────────────────────
export function extraerJson(texto) {
    let t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i < 0 || j < i) throw new Error('No encuentro el JSON en la respuesta. Copia la respuesta completa de tu IA.');
    t = t.slice(i, j + 1);
    try { return JSON.parse(t); } catch { /* sigue: SVG con comillas dobles sin escapar */ }
    // La IA a veces mete el SVG con comillas dobles sin escapar: lo sacamos aparte
    const m = t.match(/"svg"\s*:\s*"(<svg[\s\S]*?<\/svg>)"/i);
    if (m) {
        const obj = JSON.parse(t.replace(m[0], '"svg": "__SVG__"'));
        obj.svg = m[1];
        return obj;
    }
    throw new Error('La respuesta no es un JSON válido. Pide a tu IA: «Devuélvelo solo como JSON válido».');
}

// Limpia el SVG: fuera scripts, textos, imágenes externas y atributos on…
export function limpiarSvg(svg) {
    let s = String(svg || '').trim();
    const a = s.search(/<svg[\s>]/i), b = s.toLowerCase().lastIndexOf('</svg>');
    if (a < 0 || b < a) throw new Error('No hay ningún <svg> en la respuesta.');
    s = s.slice(a, b + 6);
    s = s.replace(/<(script|foreignObject|text|image|iframe)[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<(script|foreignObject|text|image|iframe)\b[^>]*\/>/gi, '')
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
        .replace(/\s(xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
        .replace(/@import[^;]*;/gi, '')
        .replace(/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none');
    if (!/xmlns=/.test(s.slice(0, 300))) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    // Tamaño propio (sin width/height una <img> con SVG puede salir a 0 o a 300×150)
    const vb = s.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    const w = vb ? parseFloat(vb[1]) : LIENZO.w, h = vb ? parseFloat(vb[2]) : LIENZO.h;
    const cab = s.match(/<svg[^>]*>/i)[0];
    let cab2 = cab;
    if (!/\swidth\s*=/.test(cab)) cab2 = cab2.replace(/<svg/i, `<svg width="${w}"`);
    if (!/\sheight\s*=/.test(cab)) cab2 = cab2.replace(/<svg/i, `<svg height="${h}"`);
    if (!vb) cab2 = cab2.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
    s = s.replace(cab, cab2);
    return { svg: s, w, h };
}

const svgADataUrl = (svg) => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
const recortar = (v, a, b) => Math.min(b, Math.max(a, v));
const red = (v) => Math.round(v * 100) / 100;

// Casillas automáticas: cada punto a su lado (izq./dcha.), ordenadas por altura y sin solaparse
export function colocarCajas(puntos) {
    const res = puntos.map(() => null);
    const lados = [[], []];
    puntos.forEach((p, i) => lados[p.x < 50 ? 0 : 1].push(i));
    // si un lado está muy cargado, pasa al otro los puntos más centrados
    const [izq, der] = lados;
    const mover = (de, a) => { de.sort((x, y) => Math.abs(puntos[x].x - 50) - Math.abs(puntos[y].x - 50)); a.push(de.shift()); };
    while (izq.length - der.length > 2) mover(izq, der);
    while (der.length - izq.length > 2) mover(der, izq);
    lados.forEach((lado, k) => {
        lado.sort((a, b) => puntos[a].y - puntos[b].y);
        const n = lado.length;
        if (!n) return;
        const hueco = Math.min(13, 90 / Math.max(1, n - 1));
        const ys = [];
        lado.forEach((idx, j) => { ys.push(j ? Math.max(puntos[idx].y, ys[j - 1] + hueco) : Math.max(puntos[idx].y, 5)); });
        const exceso = ys[n - 1] - 95;
        lado.forEach((idx, j) => { res[idx] = { labelX: k ? 93 : 7, labelY: red(recortar(ys[j] - Math.max(0, exceso), 4, 96)) }; });
    });
    return res;
}

// JSON de la IA → { imageUrl?, nombreHoja?, markers }
export function interpretar(modo, obj) {
    const lista = Array.isArray(obj?.etiquetas) ? obj.etiquetas : [];
    if (!lista.length) throw new Error('La respuesta no trae ninguna etiqueta.');
    const base = Date.now();
    if (modo === 'DIBUJAR') {
        const { svg, w, h } = limpiarSvg(obj.svg);
        if (svg.length > MAX_SVG) throw new Error('El dibujo es demasiado grande. Pide a tu IA un SVG más sencillo.');
        const puntos = lista.map((e) => ({ x: recortar((Number(e.punto?.[0]) / w) * 100, 0, 100), y: recortar((Number(e.punto?.[1]) / h) * 100, 0, 100) }));
        if (puntos.some((p) => Number.isNaN(p.x) || Number.isNaN(p.y))) throw new Error('Alguna etiqueta no tiene "punto" con dos números.');
        const auto = colocarCajas(puntos);
        // Si a alguna etiqueta le falta la caja, se colocan todas solas (así no se pisan)
        const todasConCaja = lista.every((e) => Array.isArray(e.caja) && e.caja.length === 2 && !Number.isNaN(Number(e.caja[0])) && !Number.isNaN(Number(e.caja[1])));
        return {
            imageUrl: svgADataUrl(svg),
            nombreHoja: String(obj.titulo || '').trim().slice(0, 60) || null,
            markers: lista.map((e, i) => {
                const caja = todasConCaja
                    ? { labelX: red(recortar((Number(e.caja[0]) / w) * 100, 2, 98)), labelY: red(recortar((Number(e.caja[1]) / h) * 100, 3, 97)) }
                    : auto[i];
                return { id: `${base + i}`, text: String(e.texto || '').trim(), anchorX: red(puntos[i].x), anchorY: red(puntos[i].y), ...caja };
            }),
        };
    }
    const puntos = lista.map((e) => ({ x: recortar(Number(e.x), 0, 100), y: recortar(Number(e.y), 0, 100) }));
    if (puntos.some((p) => Number.isNaN(p.x) || Number.isNaN(p.y))) throw new Error('Alguna etiqueta no tiene "x" e "y" con números.');
    const cajas = colocarCajas(puntos);
    return {
        markers: lista.map((e, i) => ({ id: `${base + i}`, text: String(e.texto || '').trim(), anchorX: red(puntos[i].x), anchorY: red(puntos[i].y), ...cajas[i] })),
    };
}

// ── Modal ────────────────────────────────────────────────────────────────────
const NIVELES = ['Primaria', '1º-2º ESO', '3º-4º ESO', 'Bachillerato'];

export default function ModalIAEtiquetas({ hoja, onAplicar, onClose }) {
    const tieneImagen = !!hoja?.imageUrl;
    const [modo, setModo] = useState(tieneImagen && !String(hoja.imageUrl).startsWith('data:image/svg') ? 'IMAGEN' : 'DIBUJAR');
    const [tema, setTema] = useState(hoja?.nombreHoja && !/^Diagrama \d+$/.test(hoja.nombreHoja) ? hoja.nombreHoja : '');
    const [nivel, setNivel] = useState('1º-2º ESO');
    const [n, setN] = useState(8);
    const [listaTxt, setListaTxt] = useState('');
    const [respuesta, setRespuesta] = useState('');
    const [copiado, setCopiado] = useState(false);
    const [error, setError] = useState('');

    const lista = useMemo(() => listaTxt.split(/[\n,;]+/).map((t) => t.trim()).filter(Boolean).slice(0, 20), [listaTxt]);
    const prompt = modo === 'DIBUJAR'
        ? promptDibujar({ tema, nivel, n, lista })
        : promptImagen({ tema, nivel, n, lista, url: hoja?.imageUrl });

    const copiar = async () => {
        try { await navigator.clipboard.writeText(prompt); } catch { /* sin permiso: queda el texto a la vista */ }
        setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    };

    const aplicar = () => {
        setError('');
        if (modo === 'IMAGEN' && !tieneImagen) { setError('Primero pon la imagen de este diagrama (URL o buscador).'); return; }
        try {
            const res = interpretar(modo, extraerJson(respuesta));
            onAplicar(res);
        } catch (e) { setError(e.message); }
    };

    const pestana = (id, txt) => (
        <button key={id} onClick={() => { setModo(id); setError(''); }}
            style={{ flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.86rem', borderRadius: 10, fontFamily: 'inherit', background: modo === id ? '#6D28D9' : '#f1f5f9', color: modo === id ? 'white' : '#334155' }}>{txt}</button>
    );

    return (
        <div style={S.overlay} onClick={onClose}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
                <div style={S.cab}>
                    <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#1e1b4b' }}>🤖 Crear con tu IA</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>
                <div style={S.cuerpo}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        {pestana('DIBUJAR', '🎨 La IA dibuja el diagrama')}
                        {pestana('IMAGEN', '🖼️ Ya tengo la imagen')}
                    </div>
                    <div style={S.ayuda}>
                        {modo === 'DIBUJAR'
                            ? 'Tu IA (ChatGPT, Gemini, Claude…) dibuja el diagrama en SVG y te dice dónde va cada etiqueta. Funciona mejor con esquemas sencillos: células, partes de una planta, figuras, aparatos…'
                            : tieneImagen
                                ? 'Descarga o haz captura de la imagen de este diagrama, adjúntala en tu IA junto con el prompt y pega aquí lo que te responda. Los puntos se colocan solos; luego puedes arrastrarlos para afinarlos.'
                                : '⚠️ Este diagrama aún no tiene imagen: ponla primero (URL o buscador) y vuelve aquí.'}
                    </div>

                    <div style={S.fila}>
                        <label style={S.campo}><span style={S.etq}>Tema</span>
                            <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej.: El ojo humano" style={S.input} />
                        </label>
                        <label style={{ ...S.campo, flex: '0 0 140px' }}><span style={S.etq}>Nivel</span>
                            <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={S.input}>{NIVELES.map((v) => <option key={v}>{v}</option>)}</select>
                        </label>
                        <label style={{ ...S.campo, flex: '0 0 90px' }}><span style={S.etq}>Nº etiquetas</span>
                            <input type="number" min={3} max={15} value={n} disabled={lista.length > 0} onChange={(e) => setN(recortar(parseInt(e.target.value, 10) || 8, 3, 15))} style={S.input} />
                        </label>
                    </div>
                    <label style={S.campo}><span style={S.etq}>Etiquetas que quieres (opcional, separadas por comas)</span>
                        <input value={listaTxt} onChange={(e) => setListaTxt(e.target.value)} placeholder="Ej.: Córnea, Iris, Pupila, Cristalino, Retina, Nervio óptico" style={S.input} />
                    </label>

                    <div style={S.paso}>1 · Copia el prompt y pégalo en tu IA{modo === 'IMAGEN' ? ' junto con la imagen' : ''}</div>
                    <textarea readOnly value={prompt} style={{ ...S.area, height: 120, background: '#f8fafc', color: '#475569' }} onFocus={(e) => e.target.select()} />
                    <button onClick={copiar} style={{ ...S.btn, background: copiado ? '#16a34a' : '#6D28D9' }}>{copiado ? '✓ Copiado' : '📋 Copiar prompt'}</button>

                    <div style={S.paso}>2 · Pega aquí la respuesta de tu IA</div>
                    <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder='{ "etiquetas": [ … ] }' style={{ ...S.area, height: 110, fontFamily: 'monospace', fontSize: '0.78rem' }} />
                    {error && <div style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.85rem', margin: '6px 0' }}>⚠️ {error}</div>}
                    <button onClick={aplicar} disabled={!respuesta.trim()} style={{ ...S.btn, background: '#e74c3c', opacity: respuesta.trim() ? 1 : 0.5 }}>
                        {modo === 'DIBUJAR' ? '✨ Crear el diagrama' : '📍 Colocar las etiquetas'}
                    </button>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, textAlign: 'center' }}>
                        {modo === 'DIBUJAR' ? 'Sustituye la imagen y las etiquetas de este diagrama.' : 'Sustituye las etiquetas de este diagrama (la imagen se queda).'} Revisa siempre el resultado: la IA puede equivocarse.
                    </div>
                </div>
            </div>
        </div>
    );
}

const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: 'white', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', fontFamily: "'Segoe UI', Tahoma, sans-serif" },
    cab: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' },
    cuerpo: { padding: '14px 18px 18px', overflowY: 'auto' },
    ayuda: { background: '#f5f3ff', color: '#4c1d95', borderRadius: 10, padding: '9px 12px', fontSize: '0.84rem', marginBottom: 12, lineHeight: 1.45 },
    fila: { display: 'flex', gap: 8, flexWrap: 'wrap' },
    campo: { display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 200px', marginBottom: 8 },
    etq: { fontSize: '0.74rem', fontWeight: 700, color: '#64748b' },
    input: { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' },
    paso: { fontWeight: 900, color: '#1e1b4b', fontSize: '0.92rem', margin: '10px 0 6px' },
    area: { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #cbd5e1', padding: 10, fontSize: '0.8rem', resize: 'vertical', fontFamily: 'inherit' },
    btn: { width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem', marginTop: 6 },
};
