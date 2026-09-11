// src/QuienEsQuienHistorico.jsx
// Juego "¿Quién es quién? histórico" — deducción con pistas reveladas.
//  - Se elige categoría (científicos / artistas / mandatarios / mezcla) y dificultad.
//  - Hay un personaje SECRETO en un tablero de caras. El juego revela pistas una a una
//    (sexo, época, continente, campo, país, datos curiosos). El jugador tacha las caras
//    que no encajan y, cuando cree saberlo, adivina.
//  - Menos pistas usadas = más estrellas.

import React, { useState, useEffect } from 'react';
import {
    PERSONAJES_HISTORICOS, personajesPorCategoria, CATEGORIAS_PH,
    fotoDeWiki, avatarIniciales, anioTexto,
} from './personajesHistoricos';
import { guardarRegistroLocal } from './utils/registrosLocales';

const COL = { bg1: '#5b6ee1', bg2: '#8e44ad', verde: '#06d6a0', rojo: '#ef476f', amarillo: '#ffd166', azul: '#118ab2', oscuro: '#1a1a2e' };

const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

const CAT_SINGULAR = { mandatario: 'un mandatario o líder', artista: 'un artista', cientifico: 'un científico o científica' };

function construirPistas(secret, mezclado) {
    const l = [];
    l.push({ icon: secret.sexo === 'M' ? '♀️' : '♂️', txt: secret.sexo === 'M' ? 'Es una MUJER.' : 'Es un HOMBRE.' });
    l.push({ icon: '⏳', txt: `Vivió en: ${secret.epoca}.` });
    l.push({ icon: '🌍', txt: `Es de ${secret.continente}.` });
    if (mezclado) l.push({ icon: '🏷️', txt: `Es ${CAT_SINGULAR[secret.categoria]}.` });
    l.push({ icon: '💼', txt: `Se dedicó a: ${secret.campo}.` });
    l.push({ icon: '📍', txt: `Su país/origen: ${secret.pais}.` });
    (secret.datos || []).forEach((d) => l.push({ icon: '💡', txt: d }));
    return l;
}

/* ---- Foto con reserva a iniciales ---- */
function FotoPersonaje({ p, size = 92 }) {
    const [src, setSrc] = useState(null);
    const [fail, setFail] = useState(false);
    useEffect(() => {
        let ok = true;
        setSrc(null); setFail(false);
        fotoDeWiki(p.wiki).then((u) => { if (ok) { if (u) setSrc(u); else setFail(true); } });
        return () => { ok = false; };
    }, [p.wiki]);
    const url = !fail && src ? src : avatarIniciales(p.nombre, '#6c5ce7');
    return (
        <img src={url} alt={p.nombre} onError={() => setFail(true)}
            style={{ width: '100%', height: size, objectFit: 'cover', display: 'block', background: '#eef' }} />
    );
}

export default function QuienEsQuienHistorico({ onExit, onBack }) {
    const salir = onExit || onBack || (() => {});
    const [fase, setFase] = useState('SETUP'); // SETUP | JUGANDO | FIN
    const [cat, setCat] = useState('__MEZCLA__');
    const [dif, setDif] = useState(16);
    const [sinNombres, setSinNombres] = useState(false);

    const [board, setBoard] = useState([]);
    const [secret, setSecret] = useState(null);
    const [pistas, setPistas] = useState([]);
    const [nPistas, setNPistas] = useState(1);
    const [tachados, setTachados] = useState({});
    const [modoAdivinar, setModoAdivinar] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [intentos, setIntentos] = useState(0);
    const [resultado, setResultado] = useState(null); // 'gano' | 'rendido'

    const mezclado = cat === '__MEZCLA__';

    const empezar = () => {
        const pool = mezclado ? PERSONAJES_HISTORICOS : personajesPorCategoria(cat);
        const n = Math.min(dif, pool.length);
        const b = shuffle(pool).slice(0, n);
        const s = b[Math.floor(Math.random() * b.length)];
        setBoard(b);
        setSecret(s);
        setPistas(construirPistas(s, mezclado));
        setNPistas(1);
        setTachados({});
        setModoAdivinar(false);
        setMensaje('');
        setIntentos(0);
        setResultado(null);
        setFase('JUGANDO');
    };

    const otraPista = () => { setNPistas((n) => Math.min(n + 1, pistas.length)); };

    const clickCarta = (p) => {
        if (modoAdivinar) {
            // Adivinar
            if (p.id === secret.id) {
                setResultado('gano');
                setFase('FIN');
                const estrellas = nPistas <= 2 ? 3 : nPistas <= 4 ? 2 : 1;
                guardarRegistroLocal('QUIEN_HISTORICO', {
                    titulo: `¿Quién es quién? histórico`,
                    aciertos: estrellas, intentos: 3,
                    porcentaje: Math.round((estrellas / 3) * 100), via: 'juego',
                });
            } else {
                setIntentos((i) => i + 1);
                setTachados((t) => ({ ...t, [p.id]: true }));
                setNPistas((n) => Math.min(n + 1, pistas.length));
                setMensaje(`No es ${p.nombre}. ¡Te doy otra pista!`);
                setModoAdivinar(false);
            }
        } else {
            // Tachar / destachar
            setTachados((t) => ({ ...t, [p.id]: !t[p.id] }));
        }
    };

    const rendirse = () => { setResultado('rendido'); setFase('FIN'); };

    /* ---------------- SETUP ---------------- */
    if (fase === 'SETUP') {
        const opciones = [...CATEGORIAS_PH, { id: '__MEZCLA__', label: 'Todos mezclados', emoji: '🌍' }];
        return (
            <Wrap salir={salir}>
                <div style={S.panel}>
                    <h2 style={{ marginTop: 0, color: COL.oscuro }}>🧐 Elige el reto</h2>
                    <p style={{ color: '#555' }}>Adivina el personaje histórico secreto usando las pistas y tus conocimientos.</p>

                    <label style={S.label}>Categoría</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {opciones.map((o) => {
                            const on = cat === o.id;
                            const total = o.id === '__MEZCLA__' ? PERSONAJES_HISTORICOS.length : personajesPorCategoria(o.id).length;
                            return (
                                <button key={o.id} onClick={() => setCat(o.id)}
                                    style={{ ...S.opt, border: `3px solid ${on ? COL.azul : '#dbe4ec'}`, background: on ? '#e8f6fb' : '#fff' }}>
                                    <span style={{ fontSize: '1.6rem' }}>{o.emoji}</span>
                                    <b>{o.label}</b>
                                    <span style={{ fontSize: '0.78rem', color: '#888' }}>{total} personajes</span>
                                </button>
                            );
                        })}
                    </div>

                    <label style={{ ...S.label, marginTop: 16 }}>Dificultad (nº de caras)</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {[{ n: 9, t: 'Fácil' }, { n: 16, t: 'Normal' }, { n: 24, t: 'Difícil' }].map((d) => (
                            <button key={d.n} onClick={() => setDif(d.n)}
                                style={{ ...S.opt, flex: 1, border: `3px solid ${dif === d.n ? COL.azul : '#dbe4ec'}`, background: dif === d.n ? '#e8f6fb' : '#fff' }}>
                                <b>{d.t}</b><span style={{ fontSize: '0.78rem', color: '#888' }}>{d.n} caras</span>
                            </button>
                        ))}
                    </div>

                    <button onClick={() => setSinNombres((v) => !v)}
                        style={{ ...S.opt, flexDirection: 'row', justifyContent: 'flex-start', gap: 10, width: '100%', marginTop: 16, textAlign: 'left',
                            border: `3px solid ${sinNombres ? COL.azul : '#dbe4ec'}`, background: sinNombres ? '#e8f6fb' : '#fff' }}>
                        <span style={{ fontSize: '1.6rem' }}>{sinNombres ? '🙈' : '🏷️'}</span>
                        <span style={{ flex: 1 }}>
                            <b>Modo sin nombres</b>
                            <span style={{ display: 'block', fontSize: '0.78rem', color: '#888' }}>Oculta el nombre bajo cada cara: hay que deducir solo por la foto. ¡Más difícil!</span>
                        </span>
                        <span style={{ fontWeight: 900, color: sinNombres ? COL.verde : '#bbb' }}>{sinNombres ? 'SÍ' : 'NO'}</span>
                    </button>

                    <button style={{ ...S.btn(COL.verde), marginTop: 22, width: '100%', fontSize: '1.1rem' }} onClick={empezar}>▶️ ¡Jugar!</button>
                </div>
            </Wrap>
        );
    }

    /* ---------------- FIN ---------------- */
    if (fase === 'FIN') {
        const estrellas = nPistas <= 2 ? 3 : nPistas <= 4 ? 2 : 1;
        return (
            <Wrap salir={salir}>
                <div style={{ ...S.panel, textAlign: 'center' }}>
                    {resultado === 'gano' ? (
                        <>
                            <div style={{ fontSize: '3.4rem' }}>🎉</div>
                            <h2 style={{ color: COL.verde, margin: '4px 0' }}>¡Correcto!</h2>
                            <div style={{ fontSize: '1.8rem' }}>{'⭐'.repeat(estrellas)}{'☆'.repeat(3 - estrellas)}</div>
                            <p style={{ color: '#555' }}>Usaste {nPistas} pista{nPistas !== 1 ? 's' : ''}{intentos > 0 ? ` y ${intentos} intento(s)` : ''}.</p>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '3.4rem' }}>🙈</div>
                            <h2 style={{ color: COL.rojo, margin: '4px 0' }}>Era…</h2>
                        </>
                    )}
                    <div style={{ margin: '12px auto', maxWidth: 240, borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
                        <FotoPersonaje p={secret} size={220} />
                        <div style={{ background: COL.oscuro, color: '#fff', padding: '10px 12px' }}>
                            <b style={{ fontSize: '1.05rem' }}>{secret.nombre}</b>
                            <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>{secret.campo} · {secret.pais} · {anioTexto(secret.nac)}–{secret.fall == null ? '' : anioTexto(secret.fall)}</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', maxWidth: 320, margin: '0 auto 10px', color: '#444', fontSize: '0.9rem' }}>
                        {(secret.datos || []).map((d, i) => <div key={i}>💡 {d}</div>)}
                    </div>
                    <button style={{ ...S.btn(COL.azul), marginTop: 8 }} onClick={empezar}>🔁 Otro personaje</button>
                    <button style={{ ...S.btn('#94a3b8'), marginTop: 8, marginLeft: 8 }} onClick={() => setFase('SETUP')}>⚙️ Cambiar reto</button>
                </div>
            </Wrap>
        );
    }

    /* ---------------- JUGANDO ---------------- */
    return (
        <Wrap salir={salir}>
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 12px' }}>
                {/* Panel de pistas */}
                <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <h3 style={{ margin: 0, color: COL.oscuro }}>🕵️ Pistas ({nPistas}/{pistas.length})</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={{ ...S.btn(COL.amarillo), color: COL.oscuro, padding: '8px 14px' }} disabled={nPistas >= pistas.length} onClick={otraPista}>➕ Otra pista</button>
                            <button style={{ ...S.btn(COL.verde), padding: '8px 14px' }} onClick={() => { setModoAdivinar((v) => !v); setMensaje(modoAdivinar ? '' : 'Toca la carta del personaje que crees que es.'); }}>
                                {modoAdivinar ? '✋ Cancelar' : '🎯 ¡Ya lo sé!'}
                            </button>
                        </div>
                    </div>
                    <ol style={{ margin: '10px 0 0', paddingLeft: 4, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pistas.slice(0, nPistas).map((p, i) => (
                            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#f4f7fb', borderRadius: 10, padding: '8px 10px' }}>
                                <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                                <span><b>{i + 1}.</b> {p.txt}</span>
                            </li>
                        ))}
                    </ol>
                    {mensaje && <p style={{ margin: '10px 0 0', fontWeight: 700, color: modoAdivinar ? COL.verde : COL.rojo }}>{mensaje}</p>}
                    <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#888' }}>
                        Tacha (toca) las caras que NO encajan con las pistas. Cuando lo tengas claro, pulsa «¡Ya lo sé!».
                    </div>
                </div>

                {/* Tablero */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 24 }}>
                    {board.map((p) => {
                        const off = tachados[p.id];
                        return (
                            <button key={p.id} onClick={() => clickCarta(p)}
                                style={{
                                    position: 'relative', border: `3px solid ${modoAdivinar ? COL.verde : '#fff'}`, borderRadius: 14, overflow: 'hidden',
                                    cursor: 'pointer', padding: 0, background: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                    opacity: off ? 0.38 : 1, filter: off ? 'grayscale(1)' : 'none', transition: 'opacity .15s',
                                }}>
                                <FotoPersonaje p={p} size={92} />
                                <div style={{ padding: '6px 4px', fontSize: '0.74rem', fontWeight: 700, color: sinNombres ? '#bbb' : COL.oscuro, lineHeight: 1.1, minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                    {sinNombres ? '¿?' : p.nombre}
                                </div>
                                {off && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.6rem', color: COL.rojo }}>✗</div>}
                            </button>
                        );
                    })}
                </div>

                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <button style={{ ...S.btn('#94a3b8'), padding: '8px 16px' }} onClick={rendirse}>🏳️ Rendirse / ver quién era</button>
                </div>
            </div>
        </Wrap>
    );
}

/* ---- Marco común (fondo + cabecera) ---- */
function Wrap({ children, salir }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: `linear-gradient(135deg, ${COL.bg1}, ${COL.bg2})`, fontFamily: "'Comic Sans MS','Segoe UI',sans-serif", padding: '0 0 50px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', position: 'sticky', top: 0, zIndex: 20, background: 'rgba(26,26,46,0.25)', backdropFilter: 'blur(6px)' }}>
                <button onClick={salir} style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontWeight: 800, boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>← Salir</button>
                <h1 style={{ color: '#fff', margin: 0, fontSize: '1.3rem', textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}>🧐 ¿Quién es quién? histórico</h1>
            </div>
            <div style={{ maxWidth: 1000, margin: '20px auto', padding: '0 12px' }}>{children}</div>
        </div>
    );
}

const S = {
    panel: { background: '#fff', borderRadius: 22, padding: 24, maxWidth: 560, margin: '0 auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', color: COL.oscuro },
    label: { display: 'block', fontWeight: 800, margin: '10px 0 6px', color: COL.azul },
    opt: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 8px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', color: COL.oscuro },
    btn: (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 14, padding: '12px 18px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 0 rgba(0,0,0,0.2)' }),
};
