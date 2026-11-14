// «¿A qué jugamos con estas preguntas?» — al abrir el código de una ficha PDF (/?fc=CÓDIGO).
// El código es de las PREGUNTAS (en su orden), no de un juego: se pueden jugar en Invasión Pi
// (escribir o eliminar las incorrectas), Luz roja, Burbujas, Test, Pikatron, Plataformas,
// Money Board, Bunker… o en el juego para el que se imprimió.
// Las preguntas de escribir se convierten en opciones (respuestas de las otras preguntas, sin azar)
// para los juegos que solo funcionan con opciones.
import { useMemo } from 'react';
import { normalizarPregunta, conOpcionesParaElegir } from '../utils/normalizarPreguntas';
import { recursoDeFicha } from '../utils/fichaCodigo';

const NOMBRE_JUEGO = {
    PASAPALABRA: '🔤 Pasapalabra', APAREJADOS: '🃏 AparejaDOS', RULETA: '🎡 Ruleta', WORDLE: '🟩 Wordle', SOPA: '🔠 Sopa de letras',
    AHORCADO: '🪢 Ahorcado', ETIQUETAS: '🏷️ EtiquetaMe', LINEA_TIEMPO: '🕰️ Línea del tiempo', DUELO_PIRATAS_RECURSO: '🏴‍☠️ Duelo Piratas',
    VIDEOQUIZZ: '🎬 VideoQuizz', CAZABURBUJAS: '🫧 Burbujas', PIKATRON: '🏃 Pikatron', PIKATRON_2: '🪜 Plataformas',
    CALAMAR: '🚦 Luz roja · Luz verde', MONEYBOARD: '💰 Money Board', BUNKER: '🔫 Bunker', INVASORES: '👾 Invasión Pi',
};

/**
 * Copia de las preguntas de la ficha en formato de preguntas (pregunta / respuesta / incorrectas),
 * en el mismo orden y con sus hojas. opciones=true: las de escribir pasan a opción múltiple.
 */
export function recursoPreguntas(recurso, { opciones = false } = {}) {
    if (!recurso) return null;
    const hojas = Array.isArray(recurso.hojas) && recurso.hojas.length
        ? recurso.hojas : [{ nombreHoja: recurso.titulo || 'Preguntas', preguntas: recurso.preguntas || [] }];
    // Normalizadas, con la hoja de cada una (AparejaDOS: término A → pregunta, término B → respuesta)
    const planas = [];
    hojas.forEach((h, i) => (h.preguntas || []).forEach((p) => {
        const q = normalizarPregunta(p?.terminoA !== undefined ? { pregunta: p.terminoA, respuesta: p.terminoB } : p);
        if (q && q.tipo !== 'ORDENAR') planas.push({ q, i });
    }));
    const convertidas = opciones ? conOpcionesParaElegir(planas.map((x) => x.q)) : planas.map((x) => x.q);
    const nuevas = hojas.map((h) => ({ nombreHoja: h.nombreHoja || recurso.titulo || 'Preguntas', preguntas: [] }));
    convertidas.forEach((q, k) => {
        const p = q.tipo === 'MULTIPLE' ? { pregunta: q.enunciado, respuesta: q.correcta, incorrectas: q.opciones.filter((o) => o !== q.correcta) }
            : q.tipo === 'RELLENAR' ? { tipo: 'RELLENAR', pregunta: q.enunciado, bloques: q.bloques, respuesta: q.correcta }
                : { tipo: 'SIMPLE', pregunta: q.enunciado, respuesta: q.correcta };
        nuevas[planas[k].i].preguntas.push(p);
    });
    return { ...recurso, tipoJuego: 'CAZABURBUJAS', tipo: undefined, hojas: nuevas.filter((h) => h.preguntas.length) };
}

const cuenta = (r, soloOpciones) => (r?.hojas || []).reduce((s, h) =>
    s + h.preguntas.filter((p) => !soloOpciones || (p.incorrectas?.length || 0) > 0).length, 0);

/** Juegos con los que se pueden jugar las preguntas de la ficha. */
export function juegosDeFicha(ficha) {
    const base = recursoDeFicha(ficha);
    const out = [];
    const esInvasores = ficha.juego === 'INVASORES' && String(ficha.enlace || '').startsWith('/invasores');
    const escritas = base ? recursoPreguntas(base) : null;
    const conOpc = base ? recursoPreguntas(base, { opciones: true }) : null;
    const nTodas = cuenta(escritas, false);
    const nOpc = cuenta(conOpc, true);
    const fijo = (r) => r && { ...r, config: { ...(r.config || {}), aleatorio: false }, ordenFicha: ficha.codigo };

    // Invasión Pi: la ficha de Invasión Pi se abre con su enlace (mismas opciones A-D y enunciados de Math World)
    if (esInvasores || nTodas) {
        out.push({ id: 'INV_DISPARA', titulo: '👾 Invasión Pi · Dispara al responder', desc: 'Escribe la respuesta o elígela (A-D).', n: esInvasores ? null : nTodas,
            accion: esInvasores ? { tipo: 'ENLACE', enlace: ficha.enlace, extra: 'var=DISPARA' } : { tipo: 'INVASORES', variante: 'DISPARA', recurso: fijo(escritas) } });
        out.push({ id: 'INV_FILTRO', titulo: '👾 Invasión Pi · Filtro de respuestas', desc: 'Derriba las respuestas incorrectas y deja pasar la buena.', n: esInvasores ? null : nOpc,
            accion: esInvasores ? { tipo: 'ENLACE', enlace: ficha.enlace, extra: 'var=FILTRO' } : { tipo: 'INVASORES', variante: 'FILTRO', recurso: fijo(conOpc) } });
    }
    if (nTodas) {
        out.push({ id: 'CALAMAR', titulo: NOMBRE_JUEGO.CALAMAR, desc: 'Responde para avanzar con la luz verde (escribir o elegir).', n: nTodas, accion: { tipo: 'JUEGO', modo: 'CALAMAR', recurso: fijo(escritas) } });
        if ((escritas.hojas || []).length >= 2) out.push({ id: 'MONEYBOARD', titulo: NOMBRE_JUEGO.MONEYBOARD, desc: 'Tablero por equipos: cada hoja es una categoría.', n: nTodas, accion: { tipo: 'JUEGO', modo: 'MONEYBOARD', recurso: fijo(escritas) } });
    }
    if (nOpc) {
        out.push({ id: 'TEST', titulo: '📝 Test', desc: 'Pregunta a pregunta, eligiendo la respuesta.', n: nOpc, accion: { tipo: 'JUEGO', modo: 'TEST', recurso: fijo(conOpc) } });
        out.push({ id: 'BURBUJAS', titulo: NOMBRE_JUEGO.CAZABURBUJAS, desc: 'Explota la burbuja con la respuesta correcta.', n: nOpc, accion: { tipo: 'JUEGO', modo: 'BURBUJAS', recurso: fijo(conOpc) } });
        out.push({ id: 'PIKATRON', titulo: NOMBRE_JUEGO.PIKATRON, desc: 'Corre y salta por la respuesta buena.', n: nOpc, accion: { tipo: 'JUEGO', modo: 'PIKATRON', recurso: fijo(conOpc) } });
        out.push({ id: 'PLATAFORMAS', titulo: NOMBRE_JUEGO.PIKATRON_2, desc: 'Sube por las plataformas acertando.', n: nOpc, accion: { tipo: 'JUEGO', modo: 'PLATAFORMAS', recurso: fijo(conOpc) } });
        out.push({ id: 'BUNKER', titulo: NOMBRE_JUEGO.BUNKER, desc: 'Dispara a la respuesta correcta en 3D.', n: nOpc, accion: { tipo: 'JUEGO', modo: 'BUNKER', recurso: fijo(conOpc) } });
    }

    // El juego para el que se imprimió, si no es uno de los de arriba (Pasapalabra, AparejaDOS, Ruleta, Sopa…)
    const original = { CAZABURBUJAS: 'BURBUJAS', PIKATRON: 'PIKATRON', PIKATRON_2: 'PLATAFORMAS', CALAMAR: 'CALAMAR', MONEYBOARD: 'MONEYBOARD', BUNKER: 'BUNKER', INVASORES: 'INV_DISPARA' }[ficha.juego];
    if (original) {
        const k = out.findIndex((j) => j.id === original);
        if (k >= 0) out.unshift({ ...out.splice(k, 1)[0], deLaFicha: true });
    } else if (base) {
        out.unshift({ id: 'ORIGINAL', deLaFicha: true, titulo: NOMBRE_JUEGO[ficha.juego] || 'El juego de la ficha', desc: 'Como se imprimió.', accion: { tipo: 'JUEGO', modo: ficha.modo || null, recurso: base } });
    } else if (ficha.enlace) {
        out.unshift({ id: 'ORIGINAL', deLaFicha: true, titulo: NOMBRE_JUEGO[ficha.juego] || 'El juego de la ficha', desc: 'Como se imprimió.', accion: { tipo: 'ENLACE', enlace: ficha.enlace } });
    }
    return out;
}

export default function ElegirJuegoFicha({ ficha, onElegir, onSalir }) {
    const juegos = useMemo(() => juegosDeFicha(ficha), [ficha]);
    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#1e1b4b,#4c1d95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Segoe UI', system-ui, sans-serif", boxSizing: 'border-box' }}>
            <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 620, padding: '22px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '2rem' }}>🎟️</span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7c3aed', letterSpacing: 1 }}>FICHA {ficha.codigo}</div>
                        <h2 style={{ margin: '2px 0 0', color: '#1e1b4b', fontSize: '1.3rem' }}>{ficha.titulo || 'Preguntas de la ficha'}</h2>
                    </div>
                    <button onClick={onSalir} style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>✕ Salir</button>
                </div>
                <p style={{ color: '#475569', fontSize: '0.9rem', margin: '10px 0 14px' }}>
                    ¿A qué jugamos con estas preguntas? En todos salen <b>las mismas y en el mismo orden</b> que en el papel.
                </p>
                {juegos.length === 0 && <p style={{ color: '#b91c1c' }}>Esta ficha no tiene preguntas que se puedan jugar.</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                    {juegos.map((j) => (
                        <button key={j.id} onClick={() => onElegir(j.accion)} style={{
                            textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                            border: j.deLaFicha ? '2px solid #7c3aed' : '1.5px solid #e2e8f0', background: j.deLaFicha ? '#f5f3ff' : 'white',
                        }}>
                            <div style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '0.95rem' }}>{j.titulo}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>{j.desc}</div>
                            <div style={{ fontSize: '0.72rem', marginTop: 5, color: j.deLaFicha ? '#7c3aed' : '#94a3b8', fontWeight: 700 }}>
                                {j.deLaFicha ? '★ El de la ficha' : ''}{j.deLaFicha && j.n ? ' · ' : ''}{j.n ? `${j.n} preguntas` : ''}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
