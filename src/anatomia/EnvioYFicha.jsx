import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { leerCompeticionUrl, soloPrimitivos } from '../utils/retoLink';
import ModalEnviarCompeticion from '../components/ModalEnviarCompeticion';

// ─── Ventanas del visor «Cuerpo humano 3D»: envío al profesor del juego
// «¿Dónde está?» y ficha en PDF (imagen 3D numerada + ejercicios + soluciones).

const AZUL = '#38bdf8';
const NOMBRE_CAPA = { esqueleto: 'Huesos', musculos: 'Músculos', organos: 'Órganos' };

const estiloInput = {
    padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem',
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};
const botonModal = (activo, color = AZUL) => ({
    background: activo ? color : 'rgba(255,255,255,0.06)', color: activo ? '#0f172a' : '#e2e8f0',
    border: `1px solid ${activo ? color : 'rgba(148,163,184,0.35)'}`, borderRadius: 10,
    padding: '7px 12px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
});

const ModalBase = ({ titulo, color = AZUL, onClose, children }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
        <div style={{ background: '#1e293b', border: `1px solid ${color}55`, borderRadius: 18, width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px', color: 'white', fontFamily: 'system-ui, "Segoe UI", sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color }}>{titulo}</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}>✕</button>
            </div>
            {children}
        </div>
    </div>
);
const Etiqueta = ({ children }) => <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>{children}</label>;

// ─── Enviar al profesor ──────────────────────────────────────────────────────
export function ModalEnviarCuerpo(p) {
    const comp = leerCompeticionUrl();
    if (comp) {
        return <ModalEnviarCompeticion compId={comp.compId} catId={comp.catId} puntos={Number(p.quiz.aciertos) || 0}
            detalle={soloPrimitivos({ aciertos: p.quiz.aciertos, preguntas: p.quiz.preguntas.length, capa: p.quiz.capa })}
            nombreJuego="Cuerpo humano 3D" tituloReto={comp.titulo} onClose={p.onClose} />;
    }
    return <ModalEnviarBase {...p} />;
}

function ModalEnviarBase({ quiz, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const total = quiz.preguntas.length;
    const capa = NOMBRE_CAPA[quiz.capa] || quiz.capa;

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const porcentaje = total ? Math.round((quiz.aciertos / total) * 100) : 0;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'CUERPO_HUMANO',
                modalidad: 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                recursoTitulo: `¿Dónde está? · ${capa}`,
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(),
                    capa: quiz.capa,
                    aciertos: quiz.aciertos, fallos: total - quiz.aciertos, intentos: total, porcentaje,
                    toquesErroneos: quiz.fallos,
                    resultados: (quiz.resultados || []).slice(0, 30).map(r => ({
                        pregunta: String(r.pregunta).slice(0, 80), acierto: !!r.acierto, intentos: r.intentos || 1,
                        tocados: (r.tocados || []).join(', ').slice(0, 200),
                    })),
                }],
            });
            guardarRegistroLocal('CUERPO_HUMANO', {
                titulo: `Cuerpo humano 3D · ¿Dónde está? (${capa.toLowerCase()})`, aciertos: quiz.aciertos, intentos: total,
                porcentaje, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <ModalBase titulo="📤 Enviar al profesor" color="#fbbf24" onClose={onClose}>
            {enviado ? (
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: '3rem' }}>✅</div>
                    <div style={{ color: '#4ade80', fontWeight: 700 }}>¡Informe enviado!</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: 6 }}>{quiz.aciertos} de {total} · {capa}</div>
                    <button onClick={onClose} style={{ ...botonModal(false), marginTop: 14 }}>Cerrar</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 10px' }}>
                        Se envía: ¿Dónde está? ({capa}) · {quiz.aciertos} de {total} aciertos y qué tocaste en cada pregunta.
                    </div>
                    <div><Etiqueta>Nombre y apellido</Etiqueta><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" style={estiloInput} /></div>
                    <div><Etiqueta>Curso</Etiqueta><input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 6º Primaria B" style={estiloInput} /></div>
                    <div><Etiqueta>Código del profesor</Etiqueta><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...estiloInput, letterSpacing: 2, fontWeight: 700 }} /></div>
                    {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>⚠ {error}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={onClose} style={{ ...botonModal(false), flex: 1 }}>Cancelar</button>
                        <button onClick={enviar} disabled={enviando} style={{ ...botonModal(true, '#fbbf24'), flex: 2 }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                    </div>
                </div>
            )}
        </ModalBase>
    );
}

// ─── Ficha PDF ───────────────────────────────────────────────────────────────
// jsPDF (Helvetica = Latin-1): se limpian símbolos fuera de rango.
const limpiar = (t) => String(t ?? '').replace(/[−–]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
const primeraFrase = (t, max = 90) => {
    const f = String(t || '').split(/(?<=\.)\s/)[0];
    return f.length > max ? f.slice(0, max - 3).replace(/\s\S*$/, '') + '...' : f;
};
const barajar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LETRAS = 'ABCDEFGHIJKLMNOP';

/**
 * @param {object} o
 * @param {{url:string, ancho:number, alto:number, puntos:{id:string,x:number,y:number}[]}} o.imagen  captura del visor
 * @param {object[]} o.piezas   piezas señaladas, en el orden de los números
 * @param {(p:object)=>object} o.fichaDe
 * @param {string} o.titulo
 * @param {boolean} o.soluciones
 */
export async function generarFichaCuerpo({ imagen, piezas, fichaDe, titulo, capa, soluciones }) {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14;
    let y = M;

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(15, 23, 42);
    pdf.text('Cuerpo humano · Ficha de trabajo', M, y + 6);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.setTextColor(71, 85, 105);
    pdf.text(limpiar(titulo), M, y + 12.5);
    y += 20;
    pdf.setTextColor(15, 23, 42); pdf.setFontSize(10.5);
    pdf.text('Nombre: ______________________________   Curso: __________   Fecha: __________', M, y);
    y += 8;

    // ── 1. Imagen numerada + nombres ──
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5);
    pdf.text('1. Escribe el nombre de cada parte señalada', M, y + 4);
    y += 8;
    const altoImg = 150;
    const anchoImg = altoImg * imagen.ancho / imagen.alto;
    pdf.addImage(imagen.url, 'JPEG', M, y, anchoImg, altoImg);
    pdf.setDrawColor(15, 23, 42); pdf.setLineWidth(0.3);
    imagen.puntos.forEach((pt, i) => {
        const px = M + (pt.x / imagen.ancho) * anchoImg;
        const py = y + (pt.y / imagen.alto) * altoImg;
        pdf.setFillColor(255, 255, 255);
        pdf.circle(px, py, 2.8, 'FD');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(15, 23, 42);
        pdf.text(String(i + 1), px, py + 1.05, { align: 'center' });
    });
    const xLineas = M + anchoImg + 8;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11);
    const paso = Math.min(12, altoImg / Math.max(1, piezas.length));
    piezas.forEach((_, i) => {
        const ly = y + 8 + i * paso;
        pdf.text(`${i + 1}.`, xLineas, ly);
        pdf.setDrawColor(148, 163, 184);
        pdf.line(xLineas + 7, ly + 0.8, W - M, ly + 0.8);
    });
    y += altoImg + 8;

    // ── 3. (se dibuja donde quepa entero: bajo la imagen, tras el ejercicio 2 o en página nueva) ──
    const altoBloque3 = 9 + piezas.length * 7;
    const bloque3 = () => {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5); pdf.setTextColor(15, 23, 42);
        pdf.text(capa === 'organos' ? '3. ¿A qué aparato o sistema pertenece cada órgano?' : '3. ¿En qué zona del cuerpo está cada uno?', M, y + 4);
        y += 11; pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5);
        piezas.forEach((p, i) => { pdf.text(`${i + 1}. ________________________________________________`, M, y); y += 7; });
    };
    let bloque3Hecho = false;
    if (y + altoBloque3 < 282) { bloque3(); bloque3Hecho = true; }

    // ── 2. Une cada parte con su función ──
    pdf.addPage(); y = M + 4;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5); pdf.setTextColor(15, 23, 42);
    pdf.text('2. Une cada parte con lo que hace (escribe la letra)', M, y + 4);
    y += 10;
    const funciones = barajar(piezas.map((p, i) => ({ i, texto: primeraFrase(fichaDe(p)?.funcion) })));
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5);
    funciones.forEach((fn, k) => {
        const lineas = pdf.splitTextToSize(limpiar(fn.texto), W - 2 * M - 22);
        pdf.text(`${LETRAS[k]})`, M, y);
        pdf.text(lineas, M + 7, y);
        y += lineas.length * 4.6 + 2.5;
    });
    y += 4;
    pdf.setFont('helvetica', 'bold'); pdf.text('Parte', M, y); pdf.text('Letra', M + 80, y);
    y += 6; pdf.setFont('helvetica', 'normal');
    piezas.forEach((p, i) => {
        pdf.text(`${i + 1}. _____________________`, M, y);
        pdf.rect(M + 82, y - 4, 8, 6);
        y += 8;
    });

    if (!bloque3Hecho) {
        y += 4;
        if (y + altoBloque3 > 282) { pdf.addPage(); y = M + 4; }
        bloque3();
    }

    // ── Soluciones ──
    if (soluciones) {
        pdf.addPage(); y = M + 4;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15);
        pdf.text('Soluciones (para el profesor)', M, y + 4);
        y += 12; pdf.setFontSize(10.5);
        piezas.forEach((p, i) => {
            const letra = LETRAS[funciones.findIndex(f => f.i === i)];
            const extra = capa === 'organos' ? p.grupo : p.zonaNombre;
            pdf.setFont('helvetica', 'bold');
            pdf.text(limpiar(`${i + 1}. ${p.nombre}${p.lado ? ` (${p.lado})` : ''}`), M, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(limpiar(`Función: ${letra}   ·   ${extra}`), M + 95, y);
            y += 7;
        });
    }
    const n = pdf.getNumberOfPages();
    for (let pg = 1; pg <= n; pg++) {
        pdf.setPage(pg); pdf.setFontSize(8); pdf.setTextColor(148, 163, 184);
        pdf.text('pikt.es · Cuerpo humano 3D · Modelo: Z-Anatomy (CC BY-SA 4.0) / BodyParts3D', M, 289);
        pdf.text(`${pg} / ${n}`, W - M, 289, { align: 'right' });
    }
    return pdf;
}

const NUMEROS = [6, 8, 10, 12];
// piezas internas (no se ven desde fuera aunque el rayo se cuele por un surco)
const NO_EN_FICHA = new Set(['cuerpo_calloso', 'insula_cisuras', 'vasto_intermedio', 'diafragma']);

export function ModalFichaCuerpo({ datos, fichaDe, capturar, onClose }) {
    const [capa, setCapa] = useState('organos');
    const [aparato, setAparato] = useState('');
    const [n, setN] = useState(8);
    const [soluciones, setSoluciones] = useState(true);
    const [estado, setEstado] = useState('');

    const generar = async (ver) => {
        setEstado('Preparando la imagen…');
        try {
            // candidatos: una pieza por nombre (los pares, del lado derecho)
            let lista = datos.piezas.filter(p => p.sistema === capa && (capa !== 'organos' || !aparato || p.grupo === aparato));
            const porNombre = new Map();
            lista.forEach(p => { const prev = porNombre.get(p.en); if (!prev || p.lado === 'derecho') porNombre.set(p.en, p); });
            lista = barajar([...porNombre.values()]).filter(p => fichaDe(p) && !NO_EN_FICHA.has(p.en));
            const captura = capturar({ capa, candidatos: lista, max: n });
            if (!captura.puntos.length) { setEstado('No hay piezas para esa selección.'); return; }
            const piezas = captura.puntos.map(pt => lista.find(p => p.id === pt.id));
            setEstado('Generando el PDF…');
            const titulo = `${NOMBRE_CAPA[capa]}${capa === 'organos' && aparato ? ` · ${aparato}` : ''}`;
            const pdf = await generarFichaCuerpo({ imagen: captura, piezas, fichaDe, titulo, capa, soluciones });
            const archivo = `ficha-cuerpo-${capa}${aparato ? '-' + aparato.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') : ''}.pdf`;
            if (ver) { const url = pdf.output('bloburl'); if (!window.open(url, '_blank')) pdf.save(archivo); }
            else pdf.save(archivo);
            setEstado(captura.puntos.length < n ? `Ficha con ${captura.puntos.length} partes (no cabían más sin solaparse).` : '');
        } catch (e) {
            console.error(e);
            setEstado('No se pudo generar el PDF: ' + e.message);
        }
    };

    return (
        <ModalBase titulo="🖨️ Ficha para trabajar antes de clase" onClose={onClose}>
            <p style={{ margin: '0 0 12px', fontSize: '0.86rem', color: '#cbd5e1' }}>
                Imagen 3D del cuerpo con partes numeradas para nombrar, un ejercicio de unir cada parte con su función y otro de aparatos o zonas. Cada ficha sale distinta.
            </p>
            <Etiqueta>Qué trabajar</Etiqueta>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {Object.entries(NOMBRE_CAPA).map(([id, txt]) => <button key={id} onClick={() => setCapa(id)} style={botonModal(capa === id)}>{txt}</button>)}
            </div>
            {capa === 'organos' && (
                <>
                    <Etiqueta>Aparato</Etiqueta>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        <button onClick={() => setAparato('')} style={botonModal(!aparato, '#fbbf24')}>Todos</button>
                        {datos.aparatos.map(a => <button key={a} onClick={() => setAparato(a)} style={botonModal(aparato === a, '#fbbf24')}>{a}</button>)}
                    </div>
                </>
            )}
            <Etiqueta>Número de partes</Etiqueta>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {NUMEROS.map(k => <button key={k} onClick={() => setN(k)} style={botonModal(n === k)}>{k}</button>)}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={soluciones} onChange={e => setSoluciones(e.target.checked)} /> Hoja de soluciones
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => generar(true)} style={{ ...botonModal(false), flex: 1 }}>👁 Ver</button>
                <button onClick={() => generar(false)} style={{ ...botonModal(true), flex: 2 }}>⬇️ Descargar PDF</button>
            </div>
            {estado && <div style={{ marginTop: 10, fontSize: '0.85rem', color: estado.startsWith('No') ? '#f87171' : '#94a3b8' }}>{estado}</div>}
        </ModalBase>
    );
}
