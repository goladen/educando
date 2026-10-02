import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, limit } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';

// ─────────────────────────────────────────────────────────────────────────────
//  FICHAS IMPRIMIBLES (motor común) — el profesor compone una ficha con
//  ejercicios de distintos tipos (cada uno con N apartados), la descarga en PDF
//  para imprimir (alumno + solucionario), la corrige en el monitor (modo
//  pizarra), la guarda en su cuenta de Google y la comparte con un enlace.
//  Lo propio de cada materia va en un «motor» (prop `motor`):
//    fichas/motorFracciones.jsx (FichasFracciones) · fichas/motorCalculo.jsx (FichasCalculo)
//  motor = { coleccion, ruta, nombre, tituloFicha, emoji, volver, tipos, titulos,
//            ejercicioInicial, ejercicioNuevo, layout(ej), generarApartados(ej, n, existentes),
//            maxApartados(ej), usaNivel(tipo), categorias?(tipo), esTexto(ap), sizeHoja?(ap),
//            Enunciado, Solucion, pasosMax(ap), marcaEnunciado?(ap, vis), RespuestaInline?, Revelado? }
// ─────────────────────────────────────────────────────────────────────────────

const LETRAS = 'abcdefghijklmnopqrstuvwxyz';
const ESPACIOS = { compacto: 0.6, normal: 1, amplio: 1.6 };

// El «motor» describe la materia (tipos, generador, cómo se pinta cada apartado…)
const MotorCtx = createContext(null);
const useMotor = () => useContext(MotorCtx);

export const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};
const nuevaClave = () => Math.random().toString(36).slice(2, 9);
const catPorDefecto = (motor, tipo) => motor.categorias?.(tipo)?.[0]?.[0] || 'todos';

const nuevoEjercicio = (motor, { tipo, nivel = 1, n = 3 }) => {
    const ej = { key: nuevaClave(), tipo, nivel, n, titulo: motor.titulos[tipo] || '', tituloAuto: true, catProb: catPorDefecto(motor, tipo), apartados: [] };
    ej.n = Math.min(n, motor.maxApartados(ej));
    ej.apartados = motor.generarApartados(ej, ej.n);
    return ej;
};

const fichaVacia = (motor) => ({
    id: null,
    titulo: motor.tituloFicha,
    subtitulo: '',
    espacio: 'normal',
    solucionesPublicas: true, // ¿quien abre el enlace público ve las soluciones (PDF soluciones, pizarra)?
    ejercicios: [nuevoEjercicio(motor, motor.ejercicioInicial)],
});

// ═════════════════════════════════════════════════════════════════════════════
//  HOJA IMPRIMIBLE (se pinta fuera de pantalla y se pasa a PDF por bloques)
// ═════════════════════════════════════════════════════════════════════════════
const HojaImprimible = React.forwardRef(({ ficha, soluciones }, ref) => {
    const motor = useMotor();
    const factor = ESPACIOS[ficha.espacio] || 1;
    return (
        <div ref={ref} style={{ position: 'fixed', left: -12000, top: 0, width: 760, background: 'white', fontFamily: "'Segoe UI', Tahoma, sans-serif", color: '#2c3e50' }}>
            <div data-bloque="cabecera" style={{ padding: '6px 4px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #7b1fa2', paddingBottom: 8 }}>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#7b1fa2' }}>{ficha.titulo || motor.tituloFicha}{soluciones ? ' — SOLUCIONES' : ''}</div>
                        {ficha.subtitulo && <div style={{ fontSize: 14, color: '#555', marginTop: 2 }}>{ficha.subtitulo}</div>}
                    </div>
                    <div style={{ fontSize: 22 }}>{motor.emoji}</div>
                </div>
                {!soluciones && (
                    <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 14, fontWeight: 700 }}>
                        <span style={{ flex: 3 }}>Nombre: <span style={{ display: 'inline-block', width: '70%', borderBottom: '1.5px solid #555' }}>&nbsp;</span></span>
                        <span style={{ flex: 1.3 }}>Curso: <span style={{ display: 'inline-block', width: '55%', borderBottom: '1.5px solid #555' }}>&nbsp;</span></span>
                        <span style={{ flex: 1.5 }}>Fecha: <span style={{ display: 'inline-block', width: '60%', borderBottom: '1.5px solid #555' }}>&nbsp;</span></span>
                    </div>
                )}
            </div>
            {ficha.ejercicios.map((ej, ei) => {
                const { cols, alto } = motor.layout(ej);
                const filas = [];
                for (let i = 0; i < ej.apartados.length; i += cols) filas.push(ej.apartados.slice(i, i + cols).map((ap, k) => ({ ap, idx: i + k })));
                const titulo = (
                    <div style={{ fontSize: 16, fontWeight: 800, margin: '4px 0 10px' }}>
                        <span style={{ color: '#7b1fa2' }}>{ei + 1}.</span> {ej.titulo}
                    </div>
                );
                return filas.map((fila, fi) => (
                    <div key={`${ej.key}-${fi}`} data-bloque="fila" style={{ padding: '4px 4px 8px' }}>
                        {fi === 0 && titulo}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
                            {fila.map(({ ap, idx }) => (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: motor.esTexto(ap) ? 'flex-start' : 'center', gap: 8 }}>
                                        <b style={{ fontSize: 15, color: '#7b1fa2' }}>{LETRAS[idx]})</b>
                                        <div style={{ flex: 1, minWidth: 0 }}><motor.Enunciado ap={ap} size={motor.sizeHoja ? motor.sizeHoja(ap) : '1.3rem'} /></div>
                                    </div>
                                    {soluciones
                                        ? <div style={{ paddingLeft: 22 }}><motor.Solucion ap={ap} size="1.2rem" /></div>
                                        : <div style={{ height: Math.round(alto * factor) }} />}
                                </div>
                            ))}
                        </div>
                    </div>
                ));
            })}
        </div>
    );
});

// Devuelve el documento jsPDF y el nombre de archivo (quien llama decide si lo descarga o lo muestra)
const generarPdf = async (nodo, nombre) => {
    const [{ jsPDF }, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas').then(m => m.default)]);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, M = 12, ancho = W - 2 * M;
    let y = M;
    for (const b of nodo.querySelectorAll('[data-bloque]')) {
        const canvas = await html2canvas(b, { scale: 2, backgroundColor: '#ffffff', logging: false });
        const h = (canvas.height * ancho) / canvas.width;
        if (y + h > H - M && y > M) { pdf.addPage(); y = M; }
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, ancho, h);
        y += h;
    }
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150);
        pdf.text(`${i} / ${total}`, W / 2, H - 5, { align: 'center' });
    }
    return { pdf, archivo: `${(nombre || 'ficha').replace(/[^\wáéíóúñü -]/gi, '').trim().replace(/\s+/g, '_') || 'ficha'}.pdf` };
};

// ─── Enlace público de una ficha (pikt.es/<ruta>?ficha=ID) ──────────────────
export const urlFicha = (ruta, id) => `${window.location.origin}${ruta}?ficha=${encodeURIComponent(id)}`;
const qrUrl = (url, size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=4a148c&margin=8`;

const ModalEnlace = ({ id, titulo, conSoluciones = true, onClose }) => {
    const [copiado, setCopiado] = useState(false);
    const motor = useMotor();
    const url = urlFicha(motor.ruta, id);
    const copiar = async () => {
        try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }
        catch { window.prompt('Copia el enlace:', url); }
    };
    const compartir = () => navigator.share?.({ title: titulo, text: motor.tituloFicha, url }).catch(() => {});
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(20,10,40,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 22, padding: '22px 22px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 900, color: '#4a148c', fontSize: '1.05rem' }}>🔗 Enlace público de la ficha</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888' }}>✕</button>
                </div>
                <p style={{ margin: '0 0 12px', color: '#777', fontSize: '0.86rem' }}>
                    {conSoluciones
                        ? 'Cualquiera con este enlace puede ver la ficha, descargar el PDF (también el de soluciones) y usar el modo pizarra, sin iniciar sesión.'
                        : 'Cualquiera con este enlace puede ver la ficha y descargar el PDF para el alumno, sin iniciar sesión. 🔒 Las soluciones están ocultas.'}
                </p>
                <img src={qrUrl(url, 360)} alt="Código QR de la ficha" style={{ width: 'min(60vw, 240px)', height: 'min(60vw, 240px)', borderRadius: 12, border: '1px solid #eee' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, background: '#f5f0fa', borderRadius: 12, padding: '8px 10px' }}>
                    <span style={{ flex: 1, fontSize: '0.8rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{url}</span>
                    <button onClick={copiar} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: copiado ? '#27ae60' : '#7b1fa2', color: 'white', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                        {copiado ? '✅ Copiado' : '📋 Copiar'}
                    </button>
                </div>
                {navigator.share && (
                    <button onClick={compartir} style={{ marginTop: 10, padding: '9px 18px', borderRadius: 20, border: '2px solid #7b1fa2', background: 'white', color: '#7b1fa2', fontWeight: 800, cursor: 'pointer' }}>📤 Compartir</button>
                )}
            </div>
        </div>
    );
};

// ─── Visor del PDF dentro de la página ───────────────────────────────────────
const VisorPdf = ({ url, archivo, onClose }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(20,10,40,0.9)', display: 'flex', flexDirection: 'column', padding: 12, gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'white', fontWeight: 800, flex: 1, minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {archivo}</span>
            <a href={url} download={archivo} style={{ padding: '9px 16px', borderRadius: 20, background: '#27ae60', color: 'white', fontWeight: 800, textDecoration: 'none' }}>⬇️ Descargar</a>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ padding: '9px 16px', borderRadius: 20, background: '#3498db', color: 'white', fontWeight: 800, textDecoration: 'none' }}>↗ Abrir en pestaña</a>
            <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 20, border: 'none', background: 'white', color: '#2c3e50', fontWeight: 800, cursor: 'pointer' }}>✕ Cerrar</button>
        </div>
        <iframe src={url} title={archivo} style={{ flex: 1, width: '100%', border: 'none', borderRadius: 12, background: 'white' }} />
    </div>
);

// ═════════════════════════════════════════════════════════════════════════════
//  MODO PIZARRA — corrección en el monitor interactivo
// ═════════════════════════════════════════════════════════════════════════════
function Pizarra({ ficha, onSalir }) {
    const motor = useMotor();
    const [ei, setEi] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [rev, setRev] = useState({}); // `${ei}-${ai}` → nº de pasos mostrados
    const ej = ficha.ejercicios[ei];
    const size = `${(2 * zoom).toFixed(2)}rem`;
    const { cols } = motor.layout(ej);

    const k = (ai) => rev[`${ei}-${ai}`] || 0;
    const fijar = (ai, v) => setRev(r => ({ ...r, [`${ei}-${ai}`]: v }));
    const todas = (mostrar) => setRev(r => {
        const n = { ...r };
        ej.apartados.forEach((ap, ai) => { n[`${ei}-${ai}`] = mostrar ? motor.pasosMax(ap) : 0; });
        return n;
    });
    const pantallaCompleta = () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
    };

    const btn = (color, relleno = false) => ({ padding: '9px 16px', borderRadius: 22, border: `2px solid ${color}`, background: relleno ? color : 'white', color: relleno ? 'white' : color, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', touchAction: 'manipulation' });

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={onSalir} style={btn('#7f8c8d')}>← Volver</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setEi(i => Math.max(0, i - 1))} disabled={ei === 0} style={{ ...btn('#7b1fa2'), opacity: ei === 0 ? 0.4 : 1 }}>‹</button>
                    <span style={{ fontWeight: 900, color: '#7b1fa2' }}>Ejercicio {ei + 1} / {ficha.ejercicios.length}</span>
                    <button onClick={() => setEi(i => Math.min(ficha.ejercicios.length - 1, i + 1))} disabled={ei === ficha.ejercicios.length - 1} style={{ ...btn('#7b1fa2'), opacity: ei === ficha.ejercicios.length - 1 ? 0.4 : 1 }}>›</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setZoom(z => Math.max(0.6, z - 0.15))} style={btn('#2c3e50')}>A−</button>
                    <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} style={btn('#2c3e50')}>A+</button>
                    <button onClick={() => todas(true)} style={btn('#27ae60')}>👁 Todas</button>
                    <button onClick={() => todas(false)} style={btn('#e67e22')}>🙈 Ocultar</button>
                    <button onClick={pantallaCompleta} style={btn('#3498db')}>⛶</button>
                </div>
            </div>

            <div style={{ background: 'white', borderRadius: 18, padding: '14px 20px', marginBottom: 14, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', fontSize: `${1.25 * zoom}rem`, fontWeight: 800, color: '#2c3e50' }}>
                <span style={{ color: '#7b1fa2' }}>{ei + 1}.</span> {ej.titulo}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: cols === 1 ? '1fr' : `repeat(auto-fill, minmax(${Math.round(320 * zoom)}px, 1fr))`, gap: 14 }}>
                {ej.apartados.map((ap, ai) => {
                    const max = motor.pasosMax(ap), vis = k(ai);
                    return (
                        <div key={ai} style={{ background: 'white', borderRadius: 18, padding: '16px 18px', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', border: `3px solid ${vis >= max ? '#a5d6a7' : '#ede7f6'}` }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: motor.esTexto(ap) ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
                                <b style={{ fontSize: size, color: '#7b1fa2' }}>{LETRAS[ai]})</b>
                                <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
                                    <motor.Enunciado ap={ap} size={size} marca={motor.marcaEnunciado ? motor.marcaEnunciado(ap, vis) : null} />
                                </div>
                                {motor.RespuestaInline && <motor.RespuestaInline ap={ap} vis={vis} size={size} />}
                            </div>

                            {/* Lo que se va revelando: pasos de las combinadas, preguntas de los problemas… */}
                            {motor.Revelado && <motor.Revelado ap={ap} vis={vis} size={size} zoom={zoom} />}

                            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                                {vis < max && (
                                    <button onClick={() => fijar(ai, vis + 1)} style={btn('#7b1fa2', true)}>
                                        {max === 1 ? '👁 Solución' : vis === 0 ? '▶ Empezar' : '▶ Siguiente paso'}
                                    </button>
                                )}
                                {max > 1 && vis < max && <button onClick={() => fijar(ai, max)} style={btn('#27ae60')}>⏩ Todo</button>}
                                {vis > 0 && <button onClick={() => fijar(ai, 0)} style={btn('#95a5a6')}>↺</button>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
//  EDITOR DE UN EJERCICIO
// ═════════════════════════════════════════════════════════════════════════════
function EditorEjercicio({ ej, i, total, onChange, onMover, onBorrar, isMobile }) {
    const motor = useMotor();
    const tipos = motor.tipos;
    const color = tipos[ej.tipo]?.color || '#7b1fa2';
    const maxN = motor.maxApartados(ej);
    const cats = motor.categorias ? motor.categorias(ej.tipo) : null;

    const cambiar = (cambios, regenerar = false) => {
        const nuevo = { ...ej, ...cambios };
        if (cambios.tipo) {
            if (ej.tituloAuto) nuevo.titulo = motor.titulos[cambios.tipo] || '';
            nuevo.catProb = catPorDefecto(motor, cambios.tipo);
        }
        nuevo.n = Math.max(1, Math.min(nuevo.n, motor.maxApartados(nuevo)));
        if (regenerar) nuevo.apartados = motor.generarApartados(nuevo, nuevo.n);
        onChange(nuevo);
    };
    const cambiarN = (n) => {
        const nn = Math.max(1, Math.min(maxN, n));
        const aps = nn <= ej.apartados.length ? ej.apartados.slice(0, nn) : [...ej.apartados, ...motor.generarApartados(ej, nn - ej.apartados.length, ej.apartados)];
        onChange({ ...ej, n: nn, apartados: aps });
    };
    const regenerarUno = (ai) => {
        const otros = ej.apartados.filter((_, k) => k !== ai);
        const [nuevo] = motor.generarApartados(ej, 1, ej.apartados);
        if (!nuevo) return;
        const aps = [...otros]; aps.splice(ai, 0, nuevo);
        onChange({ ...ej, apartados: aps });
    };

    const chip = (activo, c) => ({ padding: '5px 11px', borderRadius: 18, border: `2px solid ${c}`, background: activo ? c : 'white', color: activo ? 'white' : c, fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' });
    const mini = { width: 32, height: 32, borderRadius: 10, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 900 };

    return (
        <div style={{ background: 'white', borderRadius: 18, padding: isMobile ? '12px 10px' : '16px 18px', boxShadow: '0 6px 16px rgba(0,0,0,0.07)', borderLeft: `6px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, color, fontSize: '1.1rem' }}>Ejercicio {i + 1}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => onMover(-1)} disabled={i === 0} style={{ ...mini, opacity: i === 0 ? 0.35 : 1 }} title="Subir">↑</button>
                <button onClick={() => onMover(1)} disabled={i === total - 1} style={{ ...mini, opacity: i === total - 1 ? 0.35 : 1 }} title="Bajar">↓</button>
                <button onClick={onBorrar} style={{ ...mini, color: '#e74c3c' }} title="Eliminar ejercicio">✕</button>
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {Object.entries(tipos).map(([k, v]) => (
                    <button key={k} onClick={() => k !== ej.tipo && cambiar({ tipo: k }, true)} style={chip(ej.tipo === k, v.color)}>{v.label}</button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#555' }}>Apartados:</span>
                    <button onClick={() => cambiarN(ej.n - 1)} style={mini}>−</button>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', minWidth: 24, textAlign: 'center' }}>{ej.n}</span>
                    <button onClick={() => cambiarN(ej.n + 1)} disabled={ej.n >= maxN} style={{ ...mini, opacity: ej.n >= maxN ? 0.35 : 1 }}>+</button>
                </div>
                {motor.usaNivel(ej.tipo) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#555' }}>Nivel:</span>
                        {[[1, '👶'], [2, '🤓'], [3, '🔥']].map(([n, e]) => (
                            <button key={n} onClick={() => cambiar({ nivel: n }, true)} style={chip(ej.nivel === n, '#7b1fa2')}>{e} {n}</button>
                        ))}
                    </div>
                )}
                {cats && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        {cats.map(([k, l]) => (
                            <button key={k} onClick={() => cambiar({ catProb: k }, true)} style={chip(ej.catProb === k, '#00897b')}>{l}</button>
                        ))}
                    </div>
                )}
                <button onClick={() => cambiar({}, true)} style={chip(false, '#3498db')}>🎲 Otros números</button>
            </div>

            <input value={ej.titulo} onChange={e => onChange({ ...ej, titulo: e.target.value, tituloAuto: false })}
                placeholder="Enunciado del ejercicio"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '2px solid #e1d5ee', fontSize: '0.92rem', fontWeight: 700, color: '#2c3e50', marginBottom: 10 }} />

            <div style={{ display: 'grid', gridTemplateColumns: motor.layout(ej).cols === 1 || isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                {ej.apartados.map((ap, ai) => (
                    <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#faf8fc', borderRadius: 12, padding: '8px 10px', border: '1px solid #eee' }}>
                        <b style={{ color: '#7b1fa2' }}>{LETRAS[ai]})</b>
                        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto' }}><motor.Enunciado ap={ap} size="1.05rem" /></div>
                        <button onClick={() => regenerarUno(ai)} title="Cambiar este apartado" style={{ ...mini, width: 30, height: 30, flexShrink: 0 }}>🎲</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function FichasImprimibles(props) {
    return <MotorCtx.Provider value={props.motor}><FichasApp {...props} /></MotorCtx.Provider>;
}

function FichasApp({ motor, isMobile, onSalir, fichaPublicaId = null }) {
    const COLECCION = motor.coleccion;
    const [vista, setVista] = useState(fichaPublicaId ? 'PUBLICA' : 'LISTA'); // LISTA | EDITOR | PIZARRA | PUBLICA
    const [meta, setMeta] = useState(null);      // ficha pública: { uid, autor, actualizada } | { error }
    const [enlace, setEnlace] = useState(null);  // { id, titulo } → modal del enlace público
    const [visor, setVisor] = useState(null);    // { url, archivo } → visor del PDF
    const [user, setUser] = useState(() => auth.currentUser);
    const [fichas, setFichas] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [ficha, setFicha] = useState(null);
    const [aviso, setAviso] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [pdf, setPdf] = useState(null); // null | 'alumno' | 'soluciones'
    const [volverA, setVolverA] = useState('LISTA');
    const hojaRef = useRef(null);

    useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

    const cargarFichas = async (u = user) => {
        if (!u) { setFichas([]); return; }
        setCargando(true);
        try {
            const snap = await getDocs(query(collection(db, COLECCION), where('uid', '==', u.uid)));
            const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.actualizada?.toMillis?.() || 0) - (a.actualizada?.toMillis?.() || 0));
            setFichas(lista);
            // Fichas guardadas antes de existir la galería: se publican (por defecto son públicas)
            const sinCampo = lista.filter(f => f.publica === undefined);
            if (sinCampo.length) {
                await Promise.all(sinCampo.map(f => setDoc(doc(db, COLECCION, f.id), { publica: true }, { merge: true }).catch(() => {})));
                cargarGaleria();
            }
        } catch (e) { setAviso('No se pudieron cargar tus fichas: ' + e.message); }
        setCargando(false);
    };
    useEffect(() => { cargarFichas(user); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

    // Galería pública: fichas de todos los profesores marcadas como públicas (sin sesión)
    const [galeria, setGaleria] = useState([]);
    const [cargandoGaleria, setCargandoGaleria] = useState(true);
    const [buscar, setBuscar] = useState('');
    const [desdeGaleria, setDesdeGaleria] = useState(false);
    const cargarGaleria = async () => {
        setCargandoGaleria(true);
        try {
            const snap = await getDocs(query(collection(db, COLECCION), where('publica', '==', true), limit(300)));
            setGaleria(snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.actualizada?.toMillis?.() || 0) - (a.actualizada?.toMillis?.() || 0)));
        } catch (e) { setGaleria([]); console.warn('Galería de fichas:', e.message); }
        setCargandoGaleria(false);
    };
    useEffect(() => { cargarGaleria(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Abre una ficha de la galería en su vista pública (PDF, pizarra, copia…)
    const abrirPublica = (f) => {
        try {
            setFicha({ ...JSON.parse(f.datos), id: f.id });
            setMeta({ uid: f.uid, autor: f.autor, actualizada: f.actualizada });
            setDesdeGaleria(true);
            setVista('PUBLICA');
        } catch { setAviso('La ficha está dañada.'); }
    };

    // Ficha abierta desde un enlace público (?ficha=ID): no hace falta sesión
    useEffect(() => {
        if (!fichaPublicaId) return;
        getDoc(doc(db, COLECCION, fichaPublicaId)).then(snap => {
            if (!snap.exists()) { setMeta({ error: 'Esta ficha no existe o ha sido eliminada.' }); return; }
            const d = snap.data();
            setFicha({ ...JSON.parse(d.datos), id: snap.id });
            setMeta({ uid: d.uid, autor: d.autor, actualizada: d.actualizada });
        }).catch(e => setMeta({ error: 'No se pudo abrir la ficha: ' + e.message }));
    }, [fichaPublicaId]);
    useEffect(() => () => { if (visor) URL.revokeObjectURL(visor.url); }, [visor]);

    const login = async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') setAviso('No se pudo iniciar sesión: ' + e.message); }
    };

    const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(a => (a === t ? '' : a)), 3500); };

    const guardar = async () => {
        if (!user) { await login(); return; }
        setGuardando(true);
        try {
            const id = ficha.id || doc(collection(db, COLECCION)).id;
            const datos = { ...ficha, id };
            await setDoc(doc(db, COLECCION, id), {
                // El documento se puede leer con el enlace público: no se guarda el correo
                uid: user.uid, autor: user.displayName || 'Profesor/a', titulo: ficha.titulo || motor.tituloFicha,
                solucionesPublicas: ficha.solucionesPublicas !== false,
                publica: ficha.publica !== false, // aparece en la galería pública de fichas
                nEjercicios: ficha.ejercicios.length,
                nApartados: ficha.ejercicios.reduce((s, e) => s + e.apartados.length, 0),
                datos: JSON.stringify(datos), actualizada: new Date(),
                ...(ficha.id ? {} : { creada: new Date() }),
            }, { merge: true });
            setFicha(datos);
            avisar('✅ Ficha guardada en tu cuenta');
            if (!ficha.id) setEnlace({ id, titulo: datos.titulo, conSoluciones: datos.solucionesPublicas !== false }); // 1ª vez: ya tiene enlace público
            cargarFichas(); cargarGaleria();
        } catch (e) { setAviso('❌ No se pudo guardar: ' + e.message); }
        setGuardando(false);
    };

    const borrar = async (f) => {
        if (!window.confirm(`¿Eliminar la ficha «${f.titulo}»?`)) return;
        try { await deleteDoc(doc(db, COLECCION, f.id)); cargarFichas(); cargarGaleria(); } catch (e) { setAviso('❌ ' + e.message); }
    };

    const abrir = (f, destino = 'EDITOR') => {
        try {
            const datos = JSON.parse(f.datos);
            setFicha({ ...datos, id: f.id });
            setVolverA('LISTA');
            setVista(destino);
        } catch { setAviso('La ficha guardada está dañada.'); }
    };

    // accion: 'ver' (visor en la página) | 'descargar'
    const descargar = async (modo, accion = 'ver') => {
        setPdf(modo);
        await new Promise(r => setTimeout(r, 250)); // que se pinte la hoja fuera de pantalla
        try {
            const { pdf: pdfDoc, archivo } = await generarPdf(hojaRef.current, `${ficha.titulo}${modo === 'soluciones' ? ' - soluciones' : ''}`);
            if (accion === 'descargar') pdfDoc.save(archivo);
            else setVisor({ url: URL.createObjectURL(pdfDoc.output('blob')), archivo });
        } catch (e) { setAviso('❌ Error al generar el PDF: ' + e.message); }
        setPdf(null);
    };

    // Copia de una ficha pública en la cuenta del profesor que la está viendo
    const guardarCopia = async () => {
        if (!user) { await login(); return; }
        setGuardando(true);
        try {
            const id = doc(collection(db, COLECCION)).id;
            const datos = { ...ficha, id, titulo: ficha.titulo, publica: false }; // la copia no sale en la galería hasta que su dueño lo decida
            await setDoc(doc(db, COLECCION, id), {
                uid: user.uid, autor: user.displayName || 'Profesor/a', titulo: datos.titulo,
                nEjercicios: datos.ejercicios.length,
                nApartados: datos.ejercicios.reduce((s, e) => s + e.apartados.length, 0),
                datos: JSON.stringify(datos), publica: false,
                creada: new Date(), actualizada: new Date(),
            });
            setFicha(datos);
            setMeta({ uid: user.uid, autor: user.displayName });
            avisar('✅ Copia guardada en tus fichas');
            cargarFichas();
            setVista('EDITOR');
        } catch (e) { setAviso('❌ No se pudo guardar la copia: ' + e.message); }
        setGuardando(false);
    };

    const actualizarEj = (i, nuevo) => setFicha(f => ({ ...f, ejercicios: f.ejercicios.map((e, k) => (k === i ? nuevo : e)) }));
    const moverEj = (i, d) => setFicha(f => {
        const ejs = [...f.ejercicios]; const j = i + d;
        if (j < 0 || j >= ejs.length) return f;
        [ejs[i], ejs[j]] = [ejs[j], ejs[i]];
        return { ...f, ejercicios: ejs };
    });
    const regenerarTodo = () => setFicha(f => ({ ...f, ejercicios: f.ejercicios.map(e => ({ ...e, apartados: motor.generarApartados(e, e.n) })) }));

    const btn = (color, relleno = true) => ({ padding: '10px 16px', borderRadius: 24, border: `2px solid ${color}`, background: relleno ? color : 'white', color: relleno ? 'white' : color, fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 6 });

    const barraAviso = (
        <>
            {aviso && <div onClick={() => setAviso('')} style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: '#2c3e50', color: 'white', padding: '10px 18px', borderRadius: 14, fontWeight: 700, zIndex: 9999, maxWidth: '90vw', cursor: 'pointer' }}>{aviso}</div>}
            {enlace && <ModalEnlace id={enlace.id} titulo={enlace.titulo} conSoluciones={enlace.conSoluciones} onClose={() => setEnlace(null)} />}
            {visor && <VisorPdf url={visor.url} archivo={visor.archivo} onClose={() => setVisor(null)} />}
            {pdf && ficha && <HojaImprimible ref={hojaRef} ficha={ficha} soluciones={pdf === 'soluciones'} />}
        </>
    );

    // ── Modo pizarra ──
    if (vista === 'PIZARRA' && ficha) return (
        <>{barraAviso}<Pizarra ficha={ficha} onSalir={() => setVista(volverA)} /></>
    );

    // ── Ficha pública (abierta con el enlace) ──
    if (vista === 'PUBLICA') {
        // Desde la galería se vuelve a la lista; desde un enlace, al menú de la herramienta
        const salirPublica = () => {
            setVista('LISTA');
            if (desdeGaleria) { setDesdeGaleria(false); setFicha(null); } else onSalir();
        };
        if (!ficha) return (
            <div style={{ maxWidth: 520, margin: '40px auto', background: 'white', borderRadius: 20, padding: 24, textAlign: 'center' }}>
                {meta?.error
                    ? <><div style={{ fontSize: '2.4rem' }}>😕</div><p style={{ color: '#c0392b', fontWeight: 700 }}>{meta.error}</p></>
                    : <p style={{ color: '#7b1fa2', fontWeight: 800 }}>Cargando ficha…</p>}
                <button onClick={salirPublica} style={btn('#7f8c8d', false)}>← {motor.volver}</button>
            </div>
        );
        const esMia = user && meta?.uid === user.uid;
        // Sin soluciones: se ocultan PDF de soluciones, pizarra y copia (el dueño lo ve todo)
        const conSol = esMia || ficha.solucionesPublicas !== false;
        const tiposF = motor.tipos;
        return (
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
                {barraAviso}
                <div style={{ background: 'white', borderRadius: 20, padding: isMobile ? '18px 14px' : '24px 26px', boxShadow: '0 10px 28px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#c0392b', marginBottom: 4 }}>🖨️ {motor.tituloFicha.toUpperCase()}</div>
                    <h2 style={{ margin: '0 0 4px', color: '#4a148c', fontSize: isMobile ? '1.4rem' : '1.8rem' }}>{ficha.titulo}</h2>
                    {ficha.subtitulo && <div style={{ color: '#666', marginBottom: 4 }}>{ficha.subtitulo}</div>}
                    <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: 16 }}>
                        Creada por {meta?.autor || 'un profesor/a'}{meta?.actualizada?.toDate ? ` · ${meta.actualizada.toDate().toLocaleDateString('es-ES')}` : ''}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                        {ficha.ejercicios.map((ej, i) => (
                            <div key={ej.key || i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 12, background: '#faf6fd', borderLeft: `5px solid ${tiposF[ej.tipo]?.color || '#7b1fa2'}` }}>
                                <b style={{ color: '#7b1fa2' }}>{i + 1}.</b>
                                <span style={{ flex: 1, fontSize: '0.88rem', color: '#2c3e50', fontWeight: 600 }}>{ej.titulo}</span>
                                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: tiposF[ej.tipo]?.color || '#7b1fa2', whiteSpace: 'nowrap' }}>{tiposF[ej.tipo]?.label} · {ej.apartados.length}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button onClick={() => descargar('alumno')} disabled={!!pdf} style={btn('#c0392b')}>{pdf === 'alumno' ? 'Generando…' : '👁 Ver PDF'}</button>
                        <button onClick={() => descargar('alumno', 'descargar')} disabled={!!pdf} style={btn('#c0392b', false)}>⬇️ Descargar PDF</button>
                        {conSol && <button onClick={() => descargar('soluciones')} disabled={!!pdf} style={btn('#8e44ad', false)}>{pdf === 'soluciones' ? 'Generando…' : '📄 PDF soluciones'}</button>}
                        {conSol && <button onClick={() => { setVolverA('PUBLICA'); setVista('PIZARRA'); }} style={btn('#3498db')}>🖥️ Modo pizarra</button>}
                        <button onClick={() => setEnlace({ id: ficha.id, titulo: ficha.titulo, conSoluciones: ficha.solucionesPublicas !== false })} style={btn('#7b1fa2', false)}>🔗 Enlace / QR</button>
                    </div>
                    {!conSol && (
                        <div style={{ textAlign: 'center', marginTop: 10, fontSize: '0.8rem', color: '#999', fontWeight: 700 }}>🔒 El autor ha compartido esta ficha sin soluciones.</div>
                    )}
                    {esMia && ficha.solucionesPublicas === false && (
                        <div style={{ textAlign: 'center', marginTop: 10, fontSize: '0.8rem', color: '#c0392b', fontWeight: 700 }}>🔒 Compartida sin soluciones: tú las ves porque es tu ficha.</div>
                    )}
                    {(esMia || conSol) && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                            {esMia
                                ? <button onClick={() => setVista('EDITOR')} style={btn('#27ae60')}>✏️ Editar mi ficha</button>
                                : <button onClick={guardarCopia} disabled={guardando} style={btn('#27ae60', false)}>{guardando ? 'Guardando…' : user ? '📋 Guardar una copia en mis fichas' : '🔐 Entrar con Google para guardar una copia'}</button>}
                        </div>
                    )}
                </div>
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button onClick={salirPublica} style={btn('#7f8c8d', false)}>← {motor.volver}</button>
                </div>
            </div>
        );
    }

    // ── Editor ──
    if (vista === 'EDITOR' && ficha) return (
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
            {barraAviso}

            <div style={{ background: 'white', borderRadius: 18, padding: isMobile ? '12px 10px' : '16px 18px', marginBottom: 12, boxShadow: '0 6px 16px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input value={ficha.titulo} onChange={e => setFicha(f => ({ ...f, titulo: e.target.value }))} placeholder="Título de la ficha"
                        style={{ flex: 2, minWidth: 200, padding: '10px 12px', borderRadius: 10, border: '2px solid #b39ddb', fontSize: '1.1rem', fontWeight: 900, color: '#7b1fa2' }} />
                    <input value={ficha.subtitulo} onChange={e => setFicha(f => ({ ...f, subtitulo: e.target.value }))} placeholder="Subtítulo (curso, tema…)"
                        style={{ flex: 1, minWidth: 160, padding: '10px 12px', borderRadius: 10, border: '2px solid #e1d5ee', fontSize: '0.95rem' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#555' }}>Espacio para operar en la hoja:</span>
                    {[['compacto', 'Compacto'], ['normal', 'Normal'], ['amplio', 'Amplio']].map(([k, l]) => (
                        <button key={k} onClick={() => setFicha(f => ({ ...f, espacio: k }))}
                            style={{ padding: '5px 12px', borderRadius: 18, border: '2px solid #7b1fa2', background: ficha.espacio === k ? '#7b1fa2' : 'white', color: ficha.espacio === k ? 'white' : '#7b1fa2', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>{l}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#555' }}>En el enlace público:</span>
                    {[[true, '✅ Con soluciones'], [false, '🔒 Sin soluciones']].map(([v, l]) => {
                        const activo = (ficha.solucionesPublicas !== false) === v;
                        return (
                            <button key={l} onClick={() => setFicha(f => ({ ...f, solucionesPublicas: v }))}
                                style={{ padding: '5px 12px', borderRadius: 18, border: `2px solid ${v ? '#27ae60' : '#c0392b'}`, background: activo ? (v ? '#27ae60' : '#c0392b') : 'white', color: activo ? 'white' : (v ? '#27ae60' : '#c0392b'), fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>{l}</button>
                        );
                    })}
                    <span style={{ fontSize: '0.74rem', color: '#999' }}>
                        {ficha.solucionesPublicas !== false ? 'Quien abra el enlace verá el PDF de soluciones y la pizarra.' : 'Quien abra el enlace solo podrá ver y descargar la ficha del alumno.'}
                        {ficha.id ? ' Guarda para aplicar el cambio.' : ''}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#555' }}>Galería pública:</span>
                    {[[true, '🌍 Visible para todos'], [false, '🔗 Solo con el enlace']].map(([v, l]) => {
                        const activo = (ficha.publica !== false) === v;
                        return (
                            <button key={l} onClick={() => setFicha(f => ({ ...f, publica: v }))}
                                style={{ padding: '5px 12px', borderRadius: 18, border: '2px solid #2980b9', background: activo ? '#2980b9' : 'white', color: activo ? 'white' : '#2980b9', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>{l}</button>
                        );
                    })}
                    <span style={{ fontSize: '0.74rem', color: '#999' }}>
                        {ficha.publica !== false ? 'Aparece en la lista de fichas compartidas, también sin iniciar sesión.' : 'No aparece en la lista: solo la abre quien tenga el enlace.'}
                    </span>
                </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14, position: 'sticky', top: 6, zIndex: 5, background: '#f3e5f5ee', padding: '8px 4px', borderRadius: 16 }}>
                <button onClick={guardar} disabled={guardando} style={btn('#27ae60')}>{guardando ? 'Guardando…' : user ? '💾 Guardar' : '🔐 Entrar con Google para guardar'}</button>
                <button onClick={() => descargar('alumno')} disabled={!!pdf} style={btn('#c0392b')}>{pdf === 'alumno' ? 'Generando…' : '📄 PDF alumno'}</button>
                <button onClick={() => descargar('soluciones')} disabled={!!pdf} style={btn('#c0392b', false)}>{pdf === 'soluciones' ? 'Generando…' : '📄 PDF soluciones'}</button>
                <button onClick={() => { setVolverA('EDITOR'); setVista('PIZARRA'); }} style={btn('#3498db')}>🖥️ Modo pizarra</button>
                <button onClick={() => (ficha.id ? setEnlace({ id: ficha.id, titulo: ficha.titulo, conSoluciones: ficha.solucionesPublicas !== false }) : avisar('💾 Guarda la ficha primero para obtener su enlace público'))}
                    style={{ ...btn('#7b1fa2', false), opacity: ficha.id ? 1 : 0.55 }} title={ficha.id ? 'Enlace público' : 'Guarda la ficha primero'}>🔗 Enlace público</button>
                <button onClick={regenerarTodo} style={btn('#7b1fa2', false)}>🎲 Nuevos números</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ficha.ejercicios.map((ej, i) => (
                    <EditorEjercicio key={ej.key} ej={ej} i={i} total={ficha.ejercicios.length} isMobile={isMobile}
                        onChange={n => actualizarEj(i, n)} onMover={d => moverEj(i, d)}
                        onBorrar={() => setFicha(f => ({ ...f, ejercicios: f.ejercicios.filter((_, k) => k !== i) }))} />
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={() => setFicha(f => ({ ...f, ejercicios: [...f.ejercicios, nuevoEjercicio(motor, motor.ejercicioNuevo)] }))} style={btn('#7b1fa2')}>➕ Añadir ejercicio</button>
                <button onClick={() => { cargarFichas(); setVista('LISTA'); }} style={btn('#7f8c8d', false)}>← Mis fichas</button>
            </div>
        </div>
    );

    // ── Lista de fichas ──
    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {barraAviso}
            <div style={{ background: 'white', borderRadius: 20, padding: '20px 18px', boxShadow: '0 10px 28px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <h2 style={{ color: '#7b1fa2', margin: '0 0 6px' }}>🖨️ {motor.nombre}</h2>
                <p style={{ color: '#777', fontSize: '0.9rem', margin: '0 0 14px' }}>
                    Elige ejercicios de distintos tipos y cuántos apartados tiene cada uno. Descarga el PDF para imprimir y corrígelo en el monitor con el modo pizarra.
                </p>
                <button onClick={() => { setFicha(fichaVacia(motor)); setVolverA('LISTA'); setVista('EDITOR'); }} style={{ ...btn('#7b1fa2'), fontSize: '1rem', padding: '12px 22px' }}>➕ Nueva ficha</button>

                <div style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 14 }}>
                    {user ? (
                        <div style={{ fontSize: '0.82rem', color: '#27ae60', fontWeight: 700, marginBottom: 10 }}>🔐 Conectado como {user.email}</div>
                    ) : (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: '0.85rem', color: '#777', marginBottom: 8 }}>Inicia sesión con tu cuenta de Google para guardar tus fichas.</div>
                            <button onClick={login} style={btn('#4285f4')}>🔐 Entrar con Google</button>
                        </div>
                    )}
                    {user && (cargando ? <div style={{ color: '#999' }}>Cargando…</div> : fichas.length === 0 ? (
                        <div style={{ color: '#999', fontSize: '0.88rem' }}>Todavía no has guardado ninguna ficha.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                            {fichas.map(f => (
                                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 14, border: '1px solid #e1d5ee', background: '#fbf8fd', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 160 }}>
                                        <div style={{ fontWeight: 900, color: '#2c3e50' }}>{f.titulo}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                            {f.nEjercicios} ejercicios · {f.nApartados} apartados · {f.actualizada?.toDate ? f.actualizada.toDate().toLocaleDateString('es-ES') : ''}
                                        </div>
                                    </div>
                                    <button onClick={() => abrir(f, 'EDITOR')} style={btn('#7b1fa2', false)}>✏️ Abrir</button>
                                    <button onClick={() => abrir(f, 'PIZARRA')} style={btn('#3498db')}>🖥️ Pizarra</button>
                                    <button onClick={() => setEnlace({ id: f.id, titulo: f.titulo, conSoluciones: f.solucionesPublicas !== false })} style={btn('#7b1fa2', false)} title="Enlace público">🔗</button>
                                    <button onClick={() => borrar(f)} style={btn('#e74c3c', false)} title="Eliminar">🗑️</button>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            {/* Galería pública: visible para todos, con o sin sesión */}
            <div style={{ background: 'white', borderRadius: 20, padding: '18px 16px', boxShadow: '0 10px 28px rgba(0,0,0,0.08)', marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, color: '#2980b9', flex: 1, minWidth: 180 }}>🌍 Fichas compartidas</h3>
                    <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="🔍 Buscar por título o autor"
                        style={{ padding: '8px 12px', borderRadius: 20, border: '2px solid #d6eaf8', fontSize: '0.88rem', minWidth: 0, flex: 1, maxWidth: 260 }} />
                </div>
                <p style={{ margin: '0 0 12px', color: '#888', fontSize: '0.84rem' }}>Fichas que han compartido otros profesores. Ábrelas para ver el PDF, descargarlo o corregirlas en la pizarra.</p>
                {(() => {
                    const t = buscar.trim().toLowerCase();
                    const lista = galeria.filter(f => !t || `${f.titulo} ${f.autor || ''}`.toLowerCase().includes(t));
                    if (cargandoGaleria) return <div style={{ color: '#999', textAlign: 'center' }}>Cargando…</div>;
                    if (!lista.length) return <div style={{ color: '#999', fontSize: '0.88rem', textAlign: 'center' }}>{galeria.length ? 'Ninguna ficha coincide con la búsqueda.' : 'Todavía no hay fichas compartidas.'}</div>;
                    return (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                            {lista.map(f => (
                                <button key={f.id} onClick={() => abrirPublica(f)}
                                    style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: '1px solid #d6eaf8', background: '#f7fbfe', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontWeight: 900, color: '#2c3e50' }}>{motor.emoji} {f.titulo}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{f.nEjercicios} ejercicios · {f.nApartados} apartados</span>
                                    <span style={{ fontSize: '0.72rem', color: '#aaa' }}>
                                        {f.autor || 'Profesor/a'}{f.actualizada?.toDate ? ` · ${f.actualizada.toDate().toLocaleDateString('es-ES')}` : ''}{f.solucionesPublicas === false ? ' · 🔒 sin soluciones' : ''}
                                    </span>
                                </button>
                            ))}
                        </div>
                    );
                })()}
            </div>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={onSalir} style={btn('#7f8c8d', false)}>← Menú</button>
            </div>
        </div>
    );
}
