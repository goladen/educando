// Elegir las hojas de un recurso (juegos con buscador propio: Racing 3D, Pilota el avión…).
//  · Al aparecer, la página baja sola hasta aquí (ya no hay que buscar las hojas abajo del todo).
//  · 1 hoja: un botón para continuar. 2 hojas: un botón por hoja + «las dos».
//  · Más de 2: se marcan las hojas que se quieran (todas marcadas al principio) y «▶ Jugar».
// La selección es 'General' (todas) o un array de nombres de hoja; usar filtrarHojas / textoHojas.
import React, { useEffect, useRef, useState } from 'react';

/** Nombres de las hojas de un recurso, con su n.º de preguntas. */
export const hojasDe = (recurso) => (recurso?.hojas || [])
    .map((h, i) => ({ nombre: String(h.nombreHoja || h.nombre || `Hoja ${i + 1}`).trim(), n: h.preguntas?.length || 0 }))
    .filter(h => h.nombre);

/** Texto legible de una selección: 'General', 'Hoja 1' o 'Hoja 1 + Hoja 3'. */
export const textoHojas = (sel) => (Array.isArray(sel) ? (sel.length ? sel.join(' + ') : 'General') : (sel || 'General'));

/** Filtra las categorías ({ nombre, preguntas }) de categoriasDeRecurso según la selección. */
export function filtrarHojas(cats, sel) {
    if (!sel || sel === 'General' || (Array.isArray(sel) && !sel.length)) return cats;
    const lista = Array.isArray(sel) ? sel : [sel];
    const elegidas = cats.filter(c => lista.includes(c.nombre));
    return elegidas.length ? elegidas : cats;
}

/**
 * Panel de hojas.
 *  props: recurso, color (principal), colores (uno por hoja), oscuro (fondo oscuro = true),
 *         textoContinuar (sin hojas o con una), onElegir(seleccion), bajar (scroll automático; true por defecto)
 */
export default function HojasRecurso({ recurso, color = '#00C6FF', colores = [], textoContinuar = '▶ Continuar', onElegir, bajar = true, titulo }) {
    const ref = useRef(null);
    const hojas = hojasDe(recurso);
    const [marcadas, setMarcadas] = useState(() => hojas.map(h => h.nombre));
    useEffect(() => { setMarcadas(hojasDe(recurso).map(h => h.nombre)); }, [recurso?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!bajar) return;
        const fuera = () => { const r = ref.current?.getBoundingClientRect(); return r && (r.top > window.innerHeight - 80 || r.bottom < 80); };
        const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
        // si el desplazamiento suave no llega (navegadores sin animación), salto directo
        const t2 = setTimeout(() => { if (fuera()) ref.current?.scrollIntoView({ block: 'center' }); }, 700);
        return () => { clearTimeout(t); clearTimeout(t2); };
    }, [recurso?.id, bajar]);
    const btn = (bg, extra = {}) => ({ padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'white', background: bg, ...extra });
    const colorHoja = (i) => colores[i % (colores.length || 1)] || color;
    const nMarcadas = marcadas.length;
    const preguntasMarcadas = hojas.filter(h => marcadas.includes(h.nombre)).reduce((s, h) => s + h.n, 0);
    const alternar = (n) => setMarcadas(m => (m.includes(n) ? m.filter(x => x !== n) : [...m, n]));

    return (
        <div ref={ref} style={{ width: '100%', background: 'rgba(0,0,0,0.35)', border: `2px solid ${color}`, borderRadius: 16, padding: '14px 16px', boxSizing: 'border-box', scrollMarginBottom: 20 }}>
            <div style={{ fontWeight: 800, marginBottom: 10, color }}>{titulo || `${recurso.titulo}${hojas.length > 1 ? ': ¿con qué hojas?' : ''}`}</div>
            {hojas.length <= 1 && (
                <button style={btn(`linear-gradient(135deg,${color},#0277bd)`)} onClick={() => onElegir('General')}>{textoContinuar}</button>
            )}
            {hojas.length === 2 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button style={btn(`linear-gradient(135deg,${color},#0277bd)`)} onClick={() => onElegir('General')}>🔀 Las dos</button>
                    {hojas.map((h, i) => <button key={h.nombre} style={btn(colorHoja(i))} onClick={() => onElegir(h.nombre)}>{h.nombre}{h.n ? <span style={{ opacity: 0.8, fontWeight: 600, fontSize: '0.8rem' }}> · {h.n}</span> : null}</button>)}
                </div>
            )}
            {hojas.length > 2 && (<>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <button style={btn('rgba(255,255,255,0.12)', { padding: '6px 12px', fontSize: '0.82rem' })} onClick={() => setMarcadas(hojas.map(h => h.nombre))}>✅ Todas</button>
                    <button style={btn('rgba(255,255,255,0.12)', { padding: '6px 12px', fontSize: '0.82rem' })} onClick={() => setMarcadas([])}>⬜ Ninguna</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8, marginBottom: 12 }}>
                    {hojas.map((h, i) => {
                        const on = marcadas.includes(h.nombre);
                        return (
                            <button key={h.nombre} onClick={() => alternar(h.nombre)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: '0.92rem', border: `2px solid ${on ? colorHoja(i) : 'rgba(255,255,255,0.15)'}`, background: on ? `${colorHoja(i)}33` : 'rgba(255,255,255,0.05)' }}>
                                <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, border: `2px solid ${on ? colorHoja(i) : 'rgba(255,255,255,0.4)'}`, background: on ? colorHoja(i) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{on ? '✓' : ''}</span>
                                <span style={{ flex: 1 }}>{h.nombre}</span>
                                {h.n > 0 && <span style={{ opacity: 0.7, fontSize: '0.78rem', fontWeight: 600 }}>{h.n}</span>}
                            </button>
                        );
                    })}
                </div>
                <button disabled={!nMarcadas} style={btn(nMarcadas ? `linear-gradient(135deg,${color},#0277bd)` : 'rgba(255,255,255,0.12)', { width: '100%', fontSize: '1.05rem', cursor: nMarcadas ? 'pointer' : 'not-allowed' })}
                    onClick={() => onElegir(nMarcadas === hojas.length ? 'General' : marcadas.slice())}>
                    {nMarcadas ? `▶ Jugar con ${nMarcadas === hojas.length ? 'todas las hojas' : nMarcadas === 1 ? '1 hoja' : `${nMarcadas} hojas`}${preguntasMarcadas ? ` (${preguntasMarcadas} preguntas)` : ''}` : 'Marca al menos una hoja'}
                </button>
            </>)}
        </div>
    );
}
