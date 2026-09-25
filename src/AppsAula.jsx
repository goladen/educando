// src/AppsAula.jsx
//
// Apps de idiomas lanzables desde Control de Aula con la configuración del profesor y ranking:
//   - ENIGMIC         (EnigmicLogic.jsx): acertijos de lógica; puntos = los del propio juego por caso.
//   - QUIEN_HISTORICO (QuienEsQuienHistorico.jsx): 10 puntos por estrella en cada personaje acertado.
//
// FormAppAula (profesor) → onLanzar({ app, config, rondasMax, titulo, detalle }) y ControlAula escribe
// control_rooms/{CODE}.game = { launchId, app, config, rondasMax, recursoTitulo, modo, state, ... }.
// AppAulaRunner (alumno) monta el juego con la prop `aula = { config, rondasMax, onProgreso, onTerminar }`:
// el juego llama a onProgreso({ puntos, rondas }) con lo ACUMULADO tras cada ronda y a onTerminar()
// al pulsar «Terminar» cuando llega al límite de rondas (rondasMax 0 = sin límite, acaba el profe).

import React, { useMemo, useState } from 'react';
import EnigmicLogic, { CATEGORIAS as CATS_ENIGMIC, NIVELES as NIVELES_ENIGMIC } from './EnigmicLogic';
import QuienEsQuienHistorico from './QuienEsQuienHistorico';
import { PERSONAJES_HISTORICOS, CATEGORIAS_PH, personajesPorCategoria } from './personajesHistoricos';

const IDIOMAS_APP = {
    en: { flag: '🇬🇧', nom: 'English' },
    fr: { flag: '🇫🇷', nom: 'Français' },
    ca: { flag: '🌐', nom: 'Català' },
    es: { flag: '🇪🇸', nom: 'Español' },
};

export const APPS_AULA = {
    ENIGMIC: { label: 'Enigmic', emoji: '🕵️‍♂️', ronda: 'casos', desc: 'Acertijos de lógica con pistas en el idioma que se estudia.' },
    QUIEN_HISTORICO: { label: '¿Quién es quién? histórico', emoji: '🧐', ronda: 'personajes', desc: 'Adivinar el personaje histórico con pistas (es/en/fr/ca).' },
};

const RONDAS = [0, 1, 3, 5, 10];

// ═════════════════════════════════════════════════════════════════════════════
// PROFESOR: elegir app + configuración
// ═════════════════════════════════════════════════════════════════════════════
export function FormAppAula({ onLanzar, numConectados = 0 }) {
    const [app, setApp] = useState(null);

    // Enigmic
    const [en, setEn] = useState({ lang: 'en', modo: 'LEER', N: 5, nivel: 'MEDIO', catIds: ['PROFESIONES', 'VERBOS', 'OBJETOS'] });
    // ¿Quién es quién? histórico
    const [qh, setQh] = useState({ idioma: 'en', modo: 'AZAR', cat: '__MEZCLA__', dif: 16, sinNombres: false, elegidoId: '', customNombre: '', customWiki: '', customPistas: ['', '', ''] });
    const [rondas, setRondas] = useState(3);

    const poolQh = useMemo(() => (qh.cat === '__MEZCLA__' ? PERSONAJES_HISTORICOS : personajesPorCategoria(qh.cat)), [qh.cat]);
    const rondaUnica = app === 'QUIEN_HISTORICO' && qh.modo !== 'AZAR'; // mismo personaje para todos → 1 ronda

    const toggleCat = (id) => setEn((c) => {
        const ya = c.catIds.includes(id);
        if (ya && c.catIds.length <= 2) return c;
        return { ...c, catIds: ya ? c.catIds.filter((x) => x !== id) : [...c.catIds, id].slice(0, 5) };
    });

    const lanzar = () => {
        const rondasMax = rondaUnica ? 1 : rondas;
        if (app === 'ENIGMIC') {
            onLanzar({
                app, config: en, rondasMax,
                titulo: 'Enigmic',
                detalle: `${IDIOMAS_APP[en.lang].nom} · ${NIVELES_ENIGMIC[en.nivel].nombre} · ${en.N}×${en.catIds.length}${en.modo === 'ESCUCHAR' ? ' · 🎧' : ''}`,
            });
        } else if (app === 'QUIEN_HISTORICO') {
            if (qh.modo === 'ELEGIR' && !qh.elegidoId) { alert('Elige el personaje secreto.'); return; }
            const pistas = qh.customPistas.map((x) => x.trim()).filter(Boolean);
            if (qh.modo === 'CREAR' && (!qh.customNombre.trim() || !pistas.length)) { alert('Escribe el nombre del personaje y al menos una pista.'); return; }
            const catLbl = qh.cat === '__MEZCLA__' ? 'Todos' : CATEGORIAS_PH.find((c) => c.id === qh.cat)?.label;
            onLanzar({
                app, rondasMax,
                config: qh.modo === 'CREAR'
                    ? { idioma: qh.idioma, modo: 'CREAR', customNombre: qh.customNombre.trim(), customWiki: qh.customWiki.trim(), customPistas: pistas }
                    : { idioma: qh.idioma, modo: qh.modo, cat: qh.cat, dif: qh.dif, sinNombres: qh.sinNombres, elegidoId: qh.modo === 'ELEGIR' ? qh.elegidoId : '' },
                titulo: '¿Quién es quién? histórico',
                detalle: `${IDIOMAS_APP[qh.idioma].nom} · ${qh.modo === 'CREAR' ? 'Personaje propio' : `${catLbl} · ${qh.dif} caras`}`,
            });
        }
    };

    return (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <h3 style={{ margin: '0 0 4px', color: '#1e293b' }}>🗣️ Apps de idiomas con puntuación</h3>
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.85rem' }}>
                Configúralas a tu gusto: todos los alumnos juegan con esa configuración y ves sus puntos en directo y el ranking al terminar.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
                {Object.entries(APPS_AULA).map(([id, a]) => (
                    <button key={id} onClick={() => setApp(app === id ? null : id)}
                        style={{ ...chip, ...(app === id ? chipOn : {}), flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '10px 12px' }}>
                        <span style={{ fontSize: '1rem' }}>{a.emoji} {a.label}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.85 }}>{a.desc}</span>
                    </button>
                ))}
            </div>

            {app === 'ENIGMIC' && (
                <>
                    <label style={lblTop}>Idioma de las pistas</label>
                    <Opciones valor={en.lang} onChange={(v) => setEn({ ...en, lang: v })}
                        opciones={Object.entries(IDIOMAS_APP).map(([k, v]) => [k, `${v.flag} ${v.nom}`])} />
                    <label style={lblTop}>Presentación de las pistas</label>
                    <Opciones valor={en.modo} onChange={(v) => setEn({ ...en, modo: v })}
                        opciones={[['LEER', '📖 Leer'], ['ESCUCHAR', '🎧 Solo escuchar']]} />
                    <label style={lblTop}>Tablero y nivel</label>
                    <Opciones valor={en.N} onChange={(v) => setEn({ ...en, N: v })} opciones={[[5, '5 casillas'], [6, '6 casillas']]} />
                    <div style={{ height: 6 }} />
                    <Opciones valor={en.nivel} onChange={(v) => setEn({ ...en, nivel: v })}
                        opciones={Object.values(NIVELES_ENIGMIC).map((n) => [n.id, `${n.id === 'FACIL' ? '🟢' : n.id === 'MEDIO' ? '🟡' : '🔴'} ${n.nombre}`])} />
                    <label style={lblTop}>Categorías (2 a 5) · tablero {en.N}×{en.catIds.length}</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {CATS_ENIGMIC.map((c) => (
                            <button key={c.id} onClick={() => toggleCat(c.id)} style={{ ...chip, ...(en.catIds.includes(c.id) ? chipOn : {}) }}>
                                {c.emoji} {c.nombre.es}
                            </button>
                        ))}
                    </div>
                    <div style={nota}>Puntos por caso: 10 por casilla − 5 por minuto − 5 por cada pista de casilla. Revelar la solución = 0.</div>
                </>
            )}

            {app === 'QUIEN_HISTORICO' && (
                <>
                    <label style={lblTop}>Idioma del juego</label>
                    <Opciones valor={qh.idioma} onChange={(v) => setQh({ ...qh, idioma: v })}
                        opciones={['en', 'fr', 'ca', 'es'].map((k) => [k, `${IDIOMAS_APP[k].flag} ${IDIOMAS_APP[k].nom}`])} />
                    <label style={lblTop}>Modo</label>
                    <Opciones valor={qh.modo} onChange={(v) => setQh({ ...qh, modo: v })}
                        opciones={[['AZAR', '🎲 Al azar (cada alumno el suyo)'], ['ELEGIR', '👆 Elijo yo el personaje'], ['CREAR', '✏️ Personaje propio']]} />
                    {qh.modo !== 'CREAR' ? (
                        <>
                            <label style={lblTop}>Categoría</label>
                            <Opciones valor={qh.cat} onChange={(v) => setQh({ ...qh, cat: v, elegidoId: '' })}
                                opciones={[...CATEGORIAS_PH.map((c) => [c.id, `${c.emoji} ${c.label}`]), ['__MEZCLA__', '🌍 Todos mezclados']]} />
                            {qh.modo === 'ELEGIR' && (
                                <>
                                    <label style={lblTop}>Personaje secreto (el mismo para toda la clase)</label>
                                    <select value={qh.elegidoId} onChange={(e) => setQh({ ...qh, elegidoId: e.target.value })} style={inp}>
                                        <option value="">— Elige un personaje —</option>
                                        {poolQh.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                </>
                            )}
                            <label style={lblTop}>Dificultad</label>
                            <Opciones valor={qh.dif} onChange={(v) => setQh({ ...qh, dif: v })} opciones={[[9, 'Fácil · 9 caras'], [16, 'Normal · 16'], [24, 'Difícil · 24']]} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.88rem', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                                <input type="checkbox" checked={qh.sinNombres} onChange={(e) => setQh({ ...qh, sinNombres: e.target.checked })} />
                                🙈 Modo sin nombres (solo las fotos)
                            </label>
                        </>
                    ) : (
                        <>
                            <label style={lblTop}>Nombre del personaje</label>
                            <input value={qh.customNombre} onChange={(e) => setQh({ ...qh, customNombre: e.target.value })} placeholder="Ej: Marie Curie" style={inp} />
                            <label style={lblTop}>Foto (título de Wikipedia, opcional)</label>
                            <input value={qh.customWiki} onChange={(e) => setQh({ ...qh, customWiki: e.target.value })} placeholder="Ej: Marie Curie" style={inp} />
                            <label style={lblTop}>Pistas (escríbelas en el idioma del juego)</label>
                            {qh.customPistas.map((p, i) => (
                                <input key={i} value={p} placeholder={`Pista ${i + 1}`} style={{ ...inp, marginBottom: 6 }}
                                    onChange={(e) => setQh({ ...qh, customPistas: qh.customPistas.map((x, j) => (j === i ? e.target.value : x)) })} />
                            ))}
                            <button onClick={() => setQh({ ...qh, customPistas: [...qh.customPistas, ''] })} style={chip}>➕ Añadir pista</button>
                        </>
                    )}
                    <div style={nota}>Puntos por personaje: 30 (⭐⭐⭐, hasta 2 pistas), 20 (⭐⭐, hasta 4) o 10 (⭐). Rendirse = 0.</div>
                </>
            )}

            {app && (
                <>
                    <label style={lblTop}>Número de {APPS_AULA[app].ronda}</label>
                    {rondaUnica ? (
                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>1 (todos adivinan el mismo personaje).</div>
                    ) : (
                        <Opciones valor={rondas} onChange={setRondas} opciones={RONDAS.map((r) => [r, r === 0 ? 'Sin límite (acabo yo)' : String(r)])} />
                    )}
                    <button onClick={lanzar} style={{ ...btn('#7c3aed'), marginTop: 14 }}>
                        🚀 Lanzar a los {numConectados} dispositivos
                    </button>
                </>
            )}
        </div>
    );
}

function Opciones({ valor, onChange, opciones }) {
    return (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {opciones.map(([v, lbl]) => (
                <button key={String(v)} onClick={() => onChange(v)} style={{ ...chip, ...(valor === v ? chipOn : {}) }}>{lbl}</button>
            ))}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// ALUMNO: juega la app con la configuración del profe
// ═════════════════════════════════════════════════════════════════════════════
// rondasMax = las que le quedan (si recargó a mitad); onProgreso/onTerminar los gestiona StudentJoinView.
export function AppAulaRunner({ game, usuario, rondasMax, onProgreso, onTerminar }) {
    const aula = { config: game.config || {}, rondasMax, onProgreso, onTerminar };
    if (game.app === 'ENIGMIC') return <EnigmicLogic usuario={usuario} aula={aula} />;
    if (game.app === 'QUIEN_HISTORICO') return <QuienEsQuienHistorico aula={aula} />;
    return <div style={{ color: 'white', padding: 40, textAlign: 'center' }}>App no soportada.</div>;
}

// ── estilos ──
const lblTop = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '12px 0 6px' };
const inp = { width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' };
const chip = { display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, padding: '7px 11px', cursor: 'pointer', fontWeight: 700, color: '#334155', fontSize: '0.83rem' };
const chipOn = { background: '#7c3aed', color: 'white', borderColor: '#7c3aed' };
const nota = { fontSize: '0.78rem', color: '#64748b', marginTop: 10 };
const btn = (bg) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: bg, color: 'white', border: 'none', borderRadius: 12, padding: '12px 20px', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' });
