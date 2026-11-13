// ═══════════════════════════════════════════════════════════════════
//  PATIO DE JUEGOS — Ficha en papel (imprimir / guardar como PDF)
//  Genera una hoja A4 con las preguntas del juego y del curso elegidos,
//  cabecera para nombre/fecha/clase, solucionario opcional y vista previa.
//  Se imprime desde un iframe (el diálogo del navegador permite
//  «Guardar como PDF»), sin librerías extra.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { crearGenerador, materiaPorId } from './juegosPatio';
import Monstruo from './Monstruo';

const FUENTE = "'Fredoka','Nunito','Segoe UI',system-ui,sans-serif";
const TINTA = '#2b1d4e';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ¿Se puede contestar escribiendo? (números y huecos de letras)
const admiteEscribir = (q) => q.enunciado?.tipo === 'hueco'
    || (q.enunciado?.tipo === 'texto' && q.enunciado.grande && !/[a-záéíóúñ]/i.test(q.enunciado.texto)
        && (q.opciones.every(o => typeof o.v === 'number') || ['>', '<', '='].includes(q.correcta)));

const etiquetaCorrecta = (q) => {
    const o = q.opciones.find(x => x.v === q.correcta);
    if (q.enunciado?.tipo === 'hueco') return q.correcta === '—' ? '(sin letra)' : `${q.correcta} → ${q.solucion || ''}`;
    return o ? o.label : String(q.correcta);
};

function htmlEnunciado(q, escribir) {
    const e = q.enunciado;
    if (!e) return '';
    if (e.tipo === 'emoji') return `<div class="emo">${esc(e.emoji)}</div>${e.texto ? `<div class="emo-t">${esc(e.texto)}</div>` : ''}`;
    if (e.tipo === 'palabra') return `<div class="grande">${esc(e.texto)}</div>${e.silabas ? `<div class="sils">${e.silabas.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}`;
    if (e.tipo === 'hueco') return `<div class="grande">${esc(e.antes)}<span class="hueco-l"></span>${esc(e.despues)}</div>`;
    if (e.tipo === 'frase') return `<div class="frase">${e.tokens.map((t, i) => `${t.cat === null ? '' : i > 0 ? ' ' : ''}${i === e.resaltar ? `<span class="res">${esc(t.t)}</span>` : esc(t.t)}`).join('')}</div>`;
    const t = esc(e.texto).replace(/\n/g, '<br>');
    if (escribir) {
        const conHueco = /\?/.test(e.texto) ? t.replace(/\?/g, '<span class="hueco"></span>') : `${t} = <span class="hueco"></span>`;
        return `<div class="grande">${conHueco}</div>`;
    }
    return `<div class="${e.grande ? 'grande' : 'texto'}">${t}</div>`;
}

export function htmlFicha({ juego, curso, preguntas, escribir, solucionario, columnas, titulo, svg }) {
    const color = juego.color;
    const instrComun = preguntas.every(q => q.instruccion === preguntas[0]?.instruccion) ? preguntas[0]?.instruccion : null;
    const cajas = preguntas.map((q, i) => {
        const libre = escribir && admiteEscribir(q);
        const opciones = libre ? '' : `<div class="ops">${q.opciones.map(o => `<span class="op"><i></i>${esc(o.label)}</span>`).join('')}</div>`;
        return `<div class="preg"><div class="num" style="background:${color}">${i + 1}</div><div class="cuerpo">${instrComun ? '' : `<div class="instr">${esc(q.instruccion)}</div>`}${htmlEnunciado(q, libre)}${opciones}</div></div>`;
    }).join('');
    const sol = solucionario ? `<div class="solucionario"><h2>✅ Soluciones · ${esc(titulo)}</h2><ol>${preguntas.map(q => `<li>${esc(etiquetaCorrecta(q))}</li>`).join('')}</ol></div>` : '';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap">
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ${FUENTE}; color: ${TINTA}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hoja { padding: 6mm 2mm; }
.cab { display: flex; align-items: center; gap: 12px; border: 3px solid ${color}; border-radius: 18px; padding: 10px 14px; background: ${color}14; }
.cab svg { width: 74px; height: 74px; flex-shrink: 0; }
.cab h1 { margin: 0; font-size: 24px; color: ${color}; }
.cab .sub { font-weight: 500; font-size: 13px; }
.datos { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin: 10px 0 8px; font-weight: 600; font-size: 14px; }
.datos div { border-bottom: 2px dotted #94a3b8; padding: 6px 2px; }
.instr-comun { margin: 6px 0 10px; font-weight: 600; font-size: 16px; }
.nota { float: right; border: 2px solid ${color}; border-radius: 10px; padding: 2px 10px; font-size: 14px; }
.grid { display: grid; grid-template-columns: repeat(${columnas}, 1fr); gap: 8px; }
.preg { display: flex; gap: 8px; border: 2px solid #e2e8f0; border-radius: 14px; padding: 8px 10px; break-inside: avoid; page-break-inside: avoid; }
.num { width: 28px; height: 28px; border-radius: 50%; color: white; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 15px; }
.cuerpo { flex: 1; min-width: 0; }
.instr { font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #475569; }
.grande { font-size: 22px; font-weight: 600; letter-spacing: .5px; }
.texto { font-size: 15px; font-weight: 500; }
.frase { font-size: 15px; line-height: 1.8; }
.frase .res { text-decoration: underline 3px ${color}; font-weight: 700; }
.emo { font-size: 38px; line-height: 1.1; }
.emo-t { font-size: 15px; font-weight: 600; }
.sils span { display: inline-block; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 0 8px; margin: 3px 3px 0 0; font-size: 13px; }
.hueco { display: inline-block; min-width: 70px; height: 30px; border: 2px solid #94a3b8; border-radius: 8px; vertical-align: middle; margin: 0 4px; }
.hueco-l { display: inline-block; min-width: 30px; border-bottom: 3px solid #94a3b8; margin: 0 3px; height: 24px; vertical-align: bottom; }
.ops { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; }
.op { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; font-weight: 500; }
.op i { width: 14px; height: 14px; border: 2px solid #64748b; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.pie { margin-top: 10px; text-align: center; font-size: 11px; color: #94a3b8; }
.solucionario { page-break-before: always; break-before: page; padding: 6mm 2mm; }
.solucionario h2 { color: ${color}; font-size: 20px; margin: 0 0 8px; }
.solucionario ol { columns: 3; font-size: 14px; font-weight: 500; }
.solucionario li { margin-bottom: 4px; }
</style></head><body>
<div class="hoja">
  <div class="cab">${svg || ''}<div style="flex:1"><h1>${esc(juego.emoji)} ${esc(titulo)}</h1><div class="sub">${esc(materiaPorId(juego.materia).label)} · ${curso}º de Primaria · Patio de Juegos</div></div></div>
  <div class="datos"><div>Nombre:</div><div>Fecha:</div><div>Clase:</div></div>
  <div class="instr-comun">${instrComun ? `✏️ ${esc(instrComun)}` : '✏️ Lee cada pregunta y contesta.'} <span class="nota">Aciertos: ____ / ${preguntas.length}</span></div>
  <div class="grid">${cajas}</div>
  <div class="pie">pikt.es · Patio de Juegos</div>
</div>${sol}
</body></html>`;
}

const chip = (activo, color) => ({ padding: '8px 14px', borderRadius: 14, border: `3px solid ${activo ? color : '#e2e8f0'}`, background: activo ? color : 'white', color: activo ? 'white' : TINTA, fontWeight: 700, cursor: 'pointer', fontFamily: FUENTE, fontSize: '0.95rem' });

export default function FichaPapel({ juego, curso, onVolver }) {
    const [n, setN] = useState(12);
    const [semilla, setSemilla] = useState(0);
    const [solucionario, setSolucionario] = useState(true);
    const [columnas, setColumnas] = useState(2);
    const [titulo, setTitulo] = useState(juego.nombre);
    const generar = useMemo(() => crearGenerador(juego, curso), [juego, curso]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const preguntas = useMemo(() => {
        // Sin repetir el mismo enunciado (p. ej. el mismo animal) dentro de la ficha
        const vistas = new Set(), lista = [];
        for (let i = 0; i < n; i++) {
            let q, clave, k = 0;
            do { q = generar(); clave = JSON.stringify(q.enunciado ?? q.correcta); k++; } while (vistas.has(clave) && k < 25);
            vistas.add(clave); lista.push(q);
        }
        return lista;
    }, [n, semilla, generar]);
    const puedeEscribir = preguntas.some(admiteEscribir);
    const [escribir, setEscribir] = useState(true);
    const refSvg = useRef(null);
    const refFrame = useRef(null);
    const [svg, setSvg] = useState('');
    const [ancho, setAncho] = useState(800);
    const [altoDoc, setAltoDoc] = useState(1123);
    const refCaja = useRef(null);

    useEffect(() => { if (refSvg.current) setSvg(refSvg.current.innerHTML.replace(/animation:[^;"]*;?/g, '')); }, []);
    useEffect(() => {
        const f = () => setAncho(refCaja.current?.clientWidth || 800);
        f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
    }, []);

    const html = useMemo(() => htmlFicha({ juego, curso, preguntas, escribir: escribir && puedeEscribir, solucionario, columnas, titulo: titulo.trim() || juego.nombre, svg }),
        [juego, curso, preguntas, escribir, puedeEscribir, solucionario, columnas, titulo, svg]);

    const imprimir = () => {
        const w = refFrame.current?.contentWindow;
        if (!w) return;
        const go = () => { w.focus(); w.print(); };
        try { (w.document.fonts?.ready || Promise.resolve()).then(go); } catch { go(); }
    };

    const A4 = 794; // px a 96 ppp
    const escala = Math.min(1, (ancho - 4) / A4);
    const color = juego.color;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(180deg,#e0f2fe,#f8fafc)', fontFamily: FUENTE, color: TINTA }}>
            <div ref={refSvg} style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true"><Monstruo tipo={1} color={color} size={74} animo="feliz" /></div>
            <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.9)', borderBottom: `3px solid ${TINTA}14` }}>
                <button onClick={onVolver} style={chip(false)}>← Volver</button>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 'clamp(1rem,3vw,1.3rem)' }}>🖨️ Ficha en papel · {juego.nombre} · {curso}º</div>
            </div>
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 16px 60px' }}>
                <div style={{ background: 'white', borderRadius: 22, padding: 16, border: `4px solid ${color}`, boxShadow: `0 6px 0 ${color}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ fontWeight: 700 }}>Título de la ficha
                        <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={60} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 12px', borderRadius: 12, border: '3px solid #e2e8f0', fontFamily: FUENTE, fontSize: '1rem', fontWeight: 600, color: TINTA }} />
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <b style={{ marginRight: 4 }}>Preguntas:</b>
                        {[8, 12, 16, 20, 30].map(k => <button key={k} onClick={() => setN(k)} style={chip(n === k, color)}>{k}</button>)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <b style={{ marginRight: 4 }}>Columnas:</b>
                        {[1, 2, 3].map(k => <button key={k} onClick={() => setColumnas(k)} style={chip(columnas === k, color)}>{k}</button>)}
                        {puedeEscribir && <>
                            <b style={{ margin: '0 4px 0 12px' }}>Respuesta:</b>
                            <button onClick={() => setEscribir(true)} style={chip(escribir, color)}>✏️ Escribir</button>
                            <button onClick={() => setEscribir(false)} style={chip(!escribir, color)}>⭕ Rodear</button>
                        </>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, cursor: 'pointer' }}>
                            <input type="checkbox" checked={solucionario} onChange={e => setSolucionario(e.target.checked)} style={{ width: 20, height: 20 }} /> Añadir hoja de soluciones
                        </label>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setSemilla(s => s + 1)} style={chip(false)}>🎲 Otras preguntas</button>
                        <button onClick={imprimir} style={{ ...chip(true, '#16a34a'), padding: '10px 18px', fontSize: '1.05rem', boxShadow: '0 4px 0 #15803d' }}>🖨️ Imprimir / Guardar PDF</button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Para el PDF, elige «Guardar como PDF» como impresora en el diálogo que se abre.</div>
                </div>

                <div ref={refCaja} style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: A4 * escala, height: altoDoc * escala, overflow: 'hidden', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', background: 'white' }}>
                        <iframe ref={refFrame} title="Vista previa de la ficha" srcDoc={html}
                            onLoad={() => { try { const d = refFrame.current.contentDocument; const medir = () => setAltoDoc(Math.max(600, d.documentElement.scrollHeight)); medir(); d.fonts?.ready.then(medir); } catch { /* sin acceso */ } }}
                            style={{ width: A4, height: altoDoc, border: 'none', transform: `scale(${escala})`, transformOrigin: 'top left', display: 'block' }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
