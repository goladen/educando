// ─────────────────────────────────────────────────────────────────────────────
//  «🖨️ Fichas PDF de PiKT»: todos los generadores de fichas imprimibles.
//  La lista sale de los propios motores (FUENTES de Math World y MATERIAS_FICHAS),
//  así los temas nuevos aparecen solos. Los motores se cargan al abrir esta
//  pestaña (import dinámico) y cada centro se abre encima con BotonFichas.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import BotonFichas from '../components/BotonFichas';

const ETAPAS_F = { primaria: 'Primaria', eso: 'ESO', bach: 'Bachillerato' };

// Herramientas con motor de fichas propio (fuera de Math World y de las materias)
const APPS_EXTRA = [
    { clave: 'app-enigmic', abrir: { app: 'enigmic' }, nombre: 'Enigmic: acertijos de lógica', emoji: '🕵️', color: '#7c3aed',
        desc: 'Acertijos tipo Einstein con tablas de deducción', grupo: 'Lógica', etapas: ['primaria', 'eso', 'bach'] },
];

export default function FichasPikt() {
    const [lista, setLista] = useState(null);
    const [error, setError] = useState('');
    const [texto, setTexto] = useState('');
    const [etapa, setEtapa] = useState('');
    const [abierto, setAbierto] = useState(null); // { tema } | { materia } | { app } (+ nuevaInicial)

    useEffect(() => {
        let vivo = true;
        Promise.all([import('../fichas/motorMathWorld'), import('../fichas/motorMaterias'), import('../fichas/catalogo')])
            .then(([mw, mat, cat]) => {
                if (!vivo) return;
                const nCat = (id) => (cat.CATALOGO_MATES || []).filter(c => (c.temas || []).includes(id)).length;
                const mates = Object.entries(mw.FUENTES || {}).map(([id, f]) => ({
                    clave: `mw-${id}`, abrir: { tema: id }, grupo: 'Matemáticas',
                    nombre: f.nombre || id, emoji: f.emoji || '📐', color: f.color || '#7b1fa2', desc: f.desc || '',
                    etapas: f.etapas || [], tipos: Object.keys(f.tipos || {}).length, colecciones: nCat(id),
                }));
                const materias = Object.entries(mat.MATERIAS_FICHAS || {}).map(([id, m]) => {
                    const temas = [m.fuente, ...(m.otrasFuentes || [])].filter(Boolean);
                    return {
                        clave: `mat-${id}`, abrir: { materia: id }, grupo: (m.opts?.nombre || id).replace(/^Fichas de /, ''),
                        nombre: m.opts?.nombre || id, emoji: m.opts?.emoji || '📄', color: m.fuente?.color || '#5c6bc0',
                        desc: temas.map(t => t.nombre).filter(Boolean).join(' · ') || m.fuente?.desc || '',
                        etapas: [...new Set(temas.flatMap(t => t.etapas || []))],
                        tipos: temas.reduce((s, t) => s + Object.keys(t.tipos || {}).length, 0),
                        colecciones: (m.catalogo || []).length,
                    };
                });
                setLista([...mates, ...materias, ...APPS_EXTRA]);
            })
            .catch(e => { if (vivo) setError('No se ha podido cargar el catálogo de fichas: ' + e.message); });
        return () => { vivo = false; };
    }, []);

    const filtrada = useMemo(() => {
        const t = texto.trim().toLowerCase();
        return (lista || [])
            .filter(f => !etapa || !f.etapas?.length || f.etapas.includes(etapa))
            .filter(f => !t || [f.nombre, f.desc, f.grupo].some(x => String(x || '').toLowerCase().includes(t)));
    }, [lista, texto, etapa]);

    const grupos = useMemo(() => {
        const m = new Map();
        filtrada.forEach(f => { if (!m.has(f.grupo)) m.set(f.grupo, []); m.get(f.grupo).push(f); });
        return [...m.entries()];
    }, [filtrada]);

    return (
        <div>
            <div style={{ background: 'linear-gradient(135deg,#f3e5f5,#e8eaf6)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, color: '#4a148c', fontSize: '0.9rem' }}>
                🖨️ Pulsa <b>✨ Generar la tuya</b> para crear aquí mismo una ficha con <b>números o preguntas nuevas cada vez</b>: eliges los ejercicios y descargas el PDF del alumno y el de soluciones (sin necesidad de guardarla).
                Si la guardas, la puedes compartir con un enlace. Además, cada recurso de juego que crees (Pasapalabra, Burbujas, Ruleta…) tiene su ficha en papel con el botón 🖨️ de «Mis recursos».
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, background: 'white', padding: 12, borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="🔎 Buscar tema: fracciones, ecuaciones, célula, ortografía…"
                    style={{ flex: '1 1 240px', padding: '9px 11px', borderRadius: 10, border: '1.5px solid #cfd8dc', fontSize: '0.95rem', minWidth: 0 }} />
                <select value={etapa} onChange={e => setEtapa(e.target.value)}
                    style={{ flex: '0 1 180px', padding: '8px 10px', borderRadius: 10, border: '1.5px solid #cfd8dc', background: 'white', minWidth: 0 }}>
                    <option value="">Todas las etapas</option>
                    {Object.entries(ETAPAS_F).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
            </div>

            {error && <div style={{ color: '#c62828', fontWeight: 700, textAlign: 'center', margin: 20 }}>{error}</div>}
            {!lista && !error && <div style={{ textAlign: 'center', color: '#607d8b', margin: 30 }}>Cargando fichas…</div>}
            {lista && filtrada.length === 0 && <div style={{ textAlign: 'center', color: '#607d8b', margin: 30 }}>No hay fichas con esa búsqueda.</div>}

            {grupos.map(([grupo, fichas]) => (
                <section key={grupo} style={{ marginBottom: 22 }}>
                    <h3 style={{ color: '#4a148c', margin: '0 0 10px', borderBottom: '2px solid #e1bee7', paddingBottom: 4 }}>
                        {grupo} <span style={{ color: '#ce93d8', fontWeight: 400 }}>({fichas.length})</span>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: 10 }}>
                        {fichas.map(f => (
                            <div key={f.clave}
                                style={{ background: 'white', borderLeft: `5px solid ${f.color}`, borderRadius: 12, padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.7rem', lineHeight: 1 }}>{f.emoji}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: 'block', fontWeight: 800, color: '#263238' }}>{f.nombre}</span>
                                        {f.desc && <span style={{ display: 'block', fontSize: '0.8rem', color: '#607d8b', marginTop: 2 }}>{f.desc}</span>}
                                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                            {(f.etapas || []).map(e => <span key={e} style={TAG}>{ETAPAS_F[e] || e}</span>)}
                                            {f.tipos > 0 && <span style={{ ...TAG, background: '#ede7f6', color: '#4527a0' }}>{f.tipos} tipos de ejercicio</span>}
                                        </span>
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
                                    <button onClick={() => setAbierto({ ...f.abrir, nuevaInicial: true })} title="Abre el editor con una ficha nueva: eliges ejercicios y descargas el PDF"
                                        style={{ ...BTN, flex: '1 1 auto', background: f.color, color: 'white', border: `2px solid ${f.color}` }}>✨ Generar la tuya</button>
                                    <button onClick={() => setAbierto(f.abrir)} title="Fichas listas para usar y fichas compartidas por otros profes"
                                        style={{ ...BTN, flex: '1 1 auto', background: 'white', color: f.color, border: `2px solid ${f.color}` }}>
                                        📚 {f.colecciones > 0 ? `${f.colecciones} fichas listas` : 'Fichas compartidas'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {abierto && (
                <BotonFichas key={JSON.stringify(abierto)} abiertoInicial {...abierto} onCerrar={() => setAbierto(null)} />
            )}
        </div>
    );
}

const BTN = { padding: '7px 10px', borderRadius: 18, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' };
const TAG = { fontSize: '0.7rem', padding: '2px 7px', borderRadius: 8, background: '#eceff1', color: '#455a64' };
