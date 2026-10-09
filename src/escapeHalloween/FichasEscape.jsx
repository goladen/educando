import React from 'react';
import { createRoot } from 'react-dom/client';
import { infoPrueba } from './bancoEscape';
import { LETRAS, candadoParaPapel } from './partidaFija';
import { ETAPAS } from './constantes';

/**
 *  Fichas en papel del escape room (modo pizarra):
 *   · CUADERNILLO: portada y una hoja por sala (preguntas + candado con sus pistas) y la batalla final.
 *   · HOJA DE RESPUESTAS: media hoja (dos por folio) para anotar las letras y los códigos que se ven en el monitor.
 *  Opcionalmente con soluciones (para el profe). PDF con html2canvas + jsPDF, bloque a bloque ([data-bloque];
 *  los bloques con data-salto empiezan hoja nueva).
 */

const NARANJA = '#ea580c', MORADO = '#5b21b6', TINTA = '#1f1235', SUAVE = '#fff7ed';
const fuenteTitulo = "'Creepster', 'Chiller', fantasy";
const ANCHO = 794; // A4 a 96 ppp

const Titulo = ({ children, size = 34, color = MORADO, style }) => (
    <div style={{ fontFamily: fuenteTitulo, fontSize: size, color, letterSpacing: 1.5, lineHeight: 1.1, ...style }}>{children}</div>
);

const Linea = ({ etiqueta, ancho = 260 }) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontWeight: 700, color: TINTA }}>
        {etiqueta}<div style={{ width: ancho, borderBottom: `2px dotted ${MORADO}`, height: 18 }} />
    </div>
);

const Casillas = ({ n, valor = '', tam = 30 }) => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Array.from({ length: Math.max(1, n) }, (_, i) => (
            <div key={i} style={{ width: tam, height: tam + 6, border: `2px solid ${NARANJA}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: tam * 0.6, color: '#15803d', background: '#fff' }}>
                {valor[i] || ''}
            </div>
        ))}
    </div>
);

function CajaCodigo({ candado, soluciones }) {
    const sol = soluciones ? String(candado.solucionVisible || '').replace(/\s*\(.*\)$/, '') : '';
    const n = candado.longitud && candado.longitud <= 14 ? candado.longitud : 0;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>🔐</span><b style={{ color: TINTA }}>Código:</b>
            {n ? <Casillas n={n} valor={sol.replace(/\s/g, '').toUpperCase()} />
                : <div style={{ minWidth: 300, borderBottom: `2px solid ${NARANJA}`, height: 26, fontWeight: 900, color: '#15803d', fontSize: 18 }}>{sol}</div>}
        </div>
    );
}

function Pregunta({ q, etiqueta, soluciones }) {
    return (
        <div data-bloque style={{ padding: '8px 4px 10px', borderBottom: '1px dashed #e9d5ff', color: TINTA }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <div style={{ minWidth: 44, height: 28, borderRadius: 14, background: MORADO, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{etiqueta}</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{q.texto}</div>
            </div>
            {q.detalle && <div style={{ margin: '6px 0 4px 54px', padding: '6px 12px', background: SUAVE, border: '1px solid #fed7aa', borderRadius: 8, display: 'inline-block', fontSize: q.grande ? 22 : 15, fontWeight: q.grande ? 900 : 600 }}>{q.detalle}</div>}
            {q.frase && <div style={{ margin: '6px 0 4px 54px', fontSize: 16 }}>{q.frase.tokens.map((t, i) => <span key={i} style={i === q.frase.resaltar ? { background: '#fed7aa', fontWeight: 900, padding: '0 4px', borderRadius: 4 } : null}>{t} </span>)}</div>}
            {q.img && <div style={{ margin: '6px 0 4px 54px' }}><img src={q.img} alt="" crossOrigin="anonymous" style={{ maxHeight: 90, maxWidth: 200, border: '1px solid #ddd', borderRadius: 6 }} /></div>}
            <div style={{ display: 'grid', gridTemplateColumns: q.opciones.every(o => String(o).length < 24) ? '1fr 1fr' : '1fr', gap: '4px 18px', margin: '6px 0 0 54px' }}>
                {q.opciones.map((o, i) => {
                    const ok = soluciones && i === q.correcta;
                    return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: ok ? 900 : 500, color: ok ? '#15803d' : TINTA }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${ok ? '#15803d' : NARANJA}`, background: ok ? '#bbf7d0' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{LETRAS[i]}</span>
                            {o}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const Decoracion = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, opacity: .85, letterSpacing: 6 }}>
        <span>🦇 🕸️</span><span>🎃 🕯️ 🎃</span><span>🕸️ 🦇</span>
    </div>
);

function Portada({ config, titulo, partida, soluciones, modo }) {
    const etapa = ETAPAS.find(e => e.v === config.etapa)?.l || '';
    return (
        <div data-bloque style={{ border: `4px solid ${NARANJA}`, borderRadius: 22, padding: '18px 24px', background: `linear-gradient(180deg, ${SUAVE}, #fff 60%)`, color: TINTA, marginBottom: 14 }}>
            <Decoracion />
            <div style={{ textAlign: 'center', marginTop: 4 }}>
                <div style={{ fontSize: 46 }}>🏚️🧟</div>
                <Titulo size={50} color={NARANJA}>La mansión del zombi</Titulo>
                <div style={{ fontWeight: 800, fontSize: 18, color: MORADO, marginTop: 4 }}>{titulo || 'Escape Room de Halloween'} {soluciones && <span style={{ color: '#15803d' }}>· SOLUCIONES</span>}</div>
                <div style={{ fontSize: 13, opacity: .75 }}>{etapa} · {partida.pruebas.length} salas · {config.minutos} min</div>
            </div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', margin: '16px 0 8px' }}>
                <Linea etiqueta="Nombre:" ancho={250} /><Linea etiqueta="Curso:" ancho={90} /><Linea etiqueta="Equipo:" ancho={110} />
            </div>
            {modo === 'CUADERNILLO' && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 14, background: '#faf5ff', border: '1px solid #e9d5ff', fontSize: 14, lineHeight: 1.45 }}>
                    <b>🕯️ Cómo escapar:</b> la puerta de la mansión se ha cerrado y en el sótano despierta un zombi. En cada sala, contesta las preguntas que salen en la pizarra
                    (marca la letra). Después resolved el <b>candado</b> con las pistas y escribid el código. Cada puerta abierta os da un amuleto (una vida más) para la <b>batalla final</b>.
                </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                {config.pruebas.map((p, i) => {
                    const inf = infoPrueba(p, i, config.pruebas);
                    return <div key={p.id} style={{ border: `2px solid ${MORADO}`, borderRadius: '18px 18px 6px 6px', padding: '4px 10px', fontSize: 12, fontWeight: 700, textAlign: 'center', minWidth: 70 }}><div style={{ fontSize: 22 }}>{inf.emoji}</div>Sala {i + 1}</div>;
                })}
                <div style={{ border: '2px solid #b91c1c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#b91c1c' }}><div style={{ fontSize: 22 }}>🧟</div>Sótano</div>
            </div>
        </div>
    );
}

function CabeceraSala({ inf, idx, prueba }) {
    return (
        <div data-bloque data-salto="" style={{ marginTop: 0, padding: '10px 16px', borderRadius: 16, border: `3px solid ${NARANJA}`, background: SUAVE, color: TINTA, display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 40 }}>{inf.emoji}</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: NARANJA, textTransform: 'uppercase', letterSpacing: 2 }}>Sala {idx + 1} · {inf.materia}</div>
                <Titulo size={28}>{inf.nombre}</Titulo>
                {prueba.tipo !== 'MANUAL' && inf.historia && <div style={{ fontSize: 13, opacity: .85, marginTop: 2 }}>{inf.historia}</div>}
            </div>
            <div style={{ fontSize: 26, opacity: .7 }}>🚪</div>
        </div>
    );
}

function BloqueCandado({ candado: original, soluciones, idx }) {
    const candado = candadoParaPapel(original);
    const pistas = candado.pistas || [];
    return (
        <div data-bloque style={{ marginTop: 10, padding: '12px 16px', borderRadius: 16, border: `3px dashed ${MORADO}`, background: '#faf5ff', color: TINTA }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 32 }}>🔒</span>
                <div><div style={{ fontSize: 12, fontWeight: 800, color: MORADO }}>CANDADO DE LA SALA {idx + 1}</div><div style={{ fontWeight: 900, fontSize: 19 }}>{candado.titulo}</div></div>
            </div>
            <div style={{ margin: '6px 0', fontSize: 15, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{candado.instruccion}</div>
            {candado.imagen && <img src={candado.imagen} alt="" crossOrigin="anonymous" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 8, margin: '4px 0' }} />}
            {pistas.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: pistas.length > 1 ? '1fr 1fr' : '1fr', gap: 8, margin: '8px 0 4px' }}>
                    {pistas.map((p, k) => (
                        <div key={k} style={{ border: '2px solid #fcd34d', background: '#fffbeb', borderRadius: 12, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ minWidth: 30, height: 30, borderRadius: '50%', background: NARANJA, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{pistas.length > 1 ? k + 1 : '💡'}</div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>
                                {p.texto}
                                {p.img && <div><img src={p.img} alt="" crossOrigin="anonymous" style={{ maxHeight: 70, marginTop: 4, border: '1px solid #ddd', borderRadius: 4 }} /></div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ marginTop: 8 }}><CajaCodigo candado={candado} soluciones={soluciones} /></div>
        </div>
    );
}

export function Cuadernillo({ config, titulo, soluciones }) {
    const partida = config.partida;
    return (
        <div style={{ width: ANCHO - 90, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#fff', padding: 0 }}>
            <Portada config={config} titulo={titulo} partida={partida} soluciones={soluciones} modo="CUADERNILLO" />
            {partida.pruebas.map((pp, i) => {
                const prueba = config.pruebas[i];
                const inf = infoPrueba(prueba, i, config.pruebas);
                return (
                    <React.Fragment key={pp.id}>
                        <CabeceraSala inf={inf} idx={i} prueba={prueba} />
                        {pp.preguntas.map((q, k) => <Pregunta key={k} q={q} etiqueta={`${i + 1}.${k + 1}`} soluciones={soluciones} />)}
                        <BloqueCandado candado={pp.candado} soluciones={soluciones} idx={i} />
                    </React.Fragment>
                );
            })}
            <div data-bloque data-salto="" style={{ marginTop: 0, padding: '12px 16px', borderRadius: 16, border: '3px solid #b91c1c', background: '#fef2f2', color: TINTA, display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ fontSize: 44 }}>🧟</div>
                <div><Titulo size={30} color="#b91c1c">Batalla final en el sótano</Titulo>
                    <div style={{ fontSize: 13 }}>Cada acierto es un golpe al zombi. ¡Cada fallo, un mordisco! Tenéis 3 vidas + una por cada amuleto.</div></div>
            </div>
            {partida.batalla.map((q, k) => <Pregunta key={k} q={q} etiqueta={`Z${k + 1}`} soluciones={soluciones} />)}
        </div>
    );
}

/** Media hoja para anotar las respuestas de lo que sale en el monitor. */
export function HojaRespuestas({ config, titulo, soluciones }) {
    const partida = config.partida;
    const fila = { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px dashed #e9d5ff' };
    return (
        <div data-bloque style={{ width: ANCHO - 90, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#fff', color: TINTA, border: `3px solid ${NARANJA}`, borderRadius: 18, padding: '10px 16px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28 }}>🎃</div>
                <div style={{ flex: 1 }}>
                    <Titulo size={28} color={NARANJA}>La mansión del zombi</Titulo>
                    <div style={{ fontSize: 12, fontWeight: 700, color: MORADO }}>{titulo || 'Hoja de respuestas'} {soluciones && <span style={{ color: '#15803d' }}>· SOLUCIONES</span>}</div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}><Linea etiqueta="Nombre:" ancho={190} /><Linea etiqueta="Curso:" ancho={60} /></div>
                <div style={{ fontSize: 24 }}>🦇</div>
            </div>
            <div style={{ fontSize: 11, opacity: .75, margin: '4px 0 2px' }}>Escribe la letra de cada pregunta que salga en la pizarra y el código de cada candado.</div>
            {partida.pruebas.map((pp, i) => {
                const prueba = config.pruebas[i];
                const inf = infoPrueba(prueba, i, config.pruebas);
                return (
                    <div key={pp.id} style={fila}>
                        <div style={{ width: 92, fontWeight: 800, fontSize: 13 }}>{inf.emoji} Sala {i + 1}</div>
                        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                            {pp.preguntas.map((q, k) => (
                                <div key={k} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, opacity: .7 }}>{k + 1}</div>
                                    <div style={{ width: 24, height: 26, border: `2px solid ${NARANJA}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#15803d' }}>{soluciones ? LETRAS[q.correcta] : ''}</div>
                                </div>
                            ))}
                            {pp.preguntas.length === 0 && <div style={{ fontSize: 11, opacity: .6, alignSelf: 'center' }}>(sin preguntas: ¡buscad el código!)</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🔐</span>
                            <div style={{ width: 150, height: 26, borderBottom: `2px solid ${MORADO}`, fontWeight: 900, color: '#15803d', fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap' }}>{soluciones ? String(pp.candado.solucionVisible || '').replace(/\s*\(.*\)$/, '') : ''}</div>
                        </div>
                    </div>
                );
            })}
            <div style={{ ...fila, borderBottom: 'none' }}>
                <div style={{ width: 92, fontWeight: 800, fontSize: 13, color: '#b91c1c' }}>🧟 Batalla</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {partida.batalla.map((q, k) => (
                        <div key={k} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 9, opacity: .7 }}>Z{k + 1}</div>
                            <div style={{ width: 24, height: 26, border: '2px solid #b91c1c', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#15803d' }}>{soluciones ? LETRAS[q.correcta] : ''}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Generación del PDF ─────────────────────────────────────────────
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

async function prepararNodo(elemento) {
    const cont = document.createElement('div');
    cont.style.cssText = `position:fixed;left:-12000px;top:0;width:${ANCHO}px;background:#fff;padding:0;z-index:-1;`;
    document.body.appendChild(cont);
    if (!document.getElementById('eh-fuente-creepster')) {
        const l = document.createElement('link');
        l.id = 'eh-fuente-creepster'; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Creepster&display=swap';
        document.head.appendChild(l);
    }
    const root = createRoot(cont);
    root.render(elemento);
    await esperar(80);
    try { await document.fonts.load("40px 'Creepster'"); await document.fonts.ready; } catch { /* sin fuente: se usa la alternativa */ }
    await Promise.all([...cont.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 4000); }))));
    return { cont, cerrar: () => { root.unmount(); cont.remove(); } };
}

const nombreArchivo = (t) => `${String(t || 'escape_halloween').replace(/[^\wáéíóúñü -]/gi, '').trim().replace(/\s+/g, '_') || 'escape_halloween'}.pdf`;

/** tipo: 'CUADERNILLO' | 'HOJA'. Descarga el PDF. */
export async function descargarPdfEscape(tipo, { config, titulo, soluciones = false }) {
    const [{ jsPDF }, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas').then(m => m.default)]);
    const Comp = tipo === 'HOJA' ? HojaRespuestas : Cuadernillo;
    const { cont, cerrar } = await prepararNodo(<Comp config={config} titulo={titulo} soluciones={soluciones} />);
    try {
        const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        const W = 210, H = 297, M = 12, ancho = W - 2 * M;
        const captura = (b) => html2canvas(b, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
        if (tipo === 'HOJA') {
            const canvas = await captura(cont.querySelector('[data-bloque]'));
            const img = canvas.toDataURL('image/jpeg', 0.92);
            let h = (canvas.height * ancho) / canvas.width, w = ancho;
            const mitad = H / 2 - M - 4;
            if (h <= mitad) {
                // dos copias por folio, con línea de corte
                pdf.addImage(img, 'JPEG', M, M, w, h);
                pdf.addImage(img, 'JPEG', M, H / 2 + 4, w, h);
                pdf.setLineDashPattern([2, 2], 0); pdf.setDrawColor(160); pdf.line(6, H / 2, W - 6, H / 2);
            } else {
                if (h > H - 2 * M) { const k = (H - 2 * M) / h; h *= k; w *= k; }
                pdf.addImage(img, 'JPEG', (W - w) / 2, M, w, h);
            }
        } else {
            let y = M;
            for (const b of cont.querySelectorAll('[data-bloque]')) {
                const canvas = await captura(b);
                const h = (canvas.height * ancho) / canvas.width;
                // Cada sala (y la batalla) empieza en una hoja nueva
                if (y > M && (b.hasAttribute('data-salto') || y + h > H - M)) { pdf.addPage(); y = M; }
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', M, y, ancho, Math.min(h, H - 2 * M));
                y += h;
            }
            const total = pdf.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150);
                pdf.text(`La mansión del zombi · ${i} / ${total}`, W / 2, H - 5, { align: 'center' });
            }
        }
        const base = `${titulo || 'escape_halloween'}_${tipo === 'HOJA' ? 'hoja_respuestas' : 'cuadernillo'}${soluciones ? '_soluciones' : ''}`;
        pdf.save(nombreArchivo(base));
    } finally {
        cerrar();
    }
}

export const resumenPartida = (config) => {
    const p = config?.partida; if (!p) return '';
    const n = p.pruebas.reduce((s, x) => s + x.preguntas.length, 0);
    return `${n} preguntas en ${p.pruebas.length} salas + ${p.batalla.length} de batalla`;
};
