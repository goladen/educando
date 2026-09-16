// src/QuienEsQuienHistorico.jsx
// Juego "¿Quién es quién? histórico" — deducción con pistas reveladas.
//  - Modos: AZAR (secreto al azar), ELEGIR (eliges el personaje entre los que hay),
//    CREAR (tú creas el personaje y sus pistas).
//  - Pistas: época, país, categoría (si mezcla), campo y datos curiosos, en ORDEN
//    ALEATORIO (sin pista de sexo, y se dice el país, no el continente).
//  - Disponible en es/en/fr/ca con traducción EMPAQUETADA (trPH, sin llamar a Gemini).

import React, { useState, useEffect } from 'react';
import {
    PERSONAJES_HISTORICOS, personajesPorCategoria, CATEGORIAS_PH,
    fotoDeWiki, avatarIniciales, anioTexto,
} from './personajesHistoricos';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { useLanguage } from './i18n/LanguageContext';
import { trPH } from './personajesHistoricosI18n';

const COL = { bg1: '#5b6ee1', bg2: '#8e44ad', verde: '#06d6a0', rojo: '#ef476f', amarillo: '#ffd166', azul: '#118ab2', oscuro: '#1a1a2e' };

const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const CAT_SINGULAR = { mandatario: 'un mandatario o líder', artista: 'un artista', cientifico: 'un científico o científica' };

// Construye las pistas de un personaje del banco. SIN sexo; usa PAÍS (no continente).
// Cada pista lleva tipo + valor para poder traducirla por piezas (plantilla + valor).
function construirPistas(secret, mezclado) {
    const l = [];
    if (secret.epoca) l.push({ icon: '⏳', tipo: 'epoca', valor: secret.epoca });
    if (secret.pais) l.push({ icon: '📍', tipo: 'pais', valor: secret.pais });
    if (mezclado && secret.categoria) l.push({ icon: '🏷️', tipo: 'cat', valor: `Es ${CAT_SINGULAR[secret.categoria]}.` });
    if (secret.campo) l.push({ icon: '💼', tipo: 'campo', valor: secret.campo });
    (secret.datos || []).forEach((d) => l.push({ icon: '💡', tipo: 'dato', valor: d }));
    return shuffle(l); // orden aleatorio en cada partida
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
    const { idioma, setIdioma, idiomas } = useLanguage();
    const t = (s) => trPH(idioma, s); // traducción empaquetada, sin Gemini
    // Texto de una pista traducido por piezas (plantilla + valor).
    const clueText = (p) => {
        if (p.tipo === 'epoca') return `${t('Vivió en:')} ${t(p.valor)}.`;
        if (p.tipo === 'pais') return `${t('Es de:')} ${t(p.valor)}.`;
        if (p.tipo === 'campo') return `${t('Se dedicó a:')} ${t(p.valor)}.`;
        return t(p.valor); // 'cat' (frase completa) o 'dato'
    };
    const salir = onExit || onBack || (() => {});
    const [fase, setFase] = useState('SETUP'); // SETUP | JUGANDO | FIN
    const [modo, setModo] = useState('AZAR');  // AZAR | ELEGIR | CREAR
    const [cat, setCat] = useState('__MEZCLA__');
    const [dif, setDif] = useState(16);
    const [sinNombres, setSinNombres] = useState(false);
    const [elegidoId, setElegidoId] = useState('');
    // Personaje personalizado
    const [customNombre, setCustomNombre] = useState('');
    const [customWiki, setCustomWiki] = useState('');
    const [customPistas, setCustomPistas] = useState(['', '', '']);

    const [playMode, setPlayMode] = useState('BOARD'); // BOARD | TEXTO
    const [board, setBoard] = useState([]);
    const [secret, setSecret] = useState(null);
    const [pistas, setPistas] = useState([]);
    const [nPistas, setNPistas] = useState(1);
    const [tachados, setTachados] = useState({});
    const [modoAdivinar, setModoAdivinar] = useState(false);
    const [guessTxt, setGuessTxt] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [intentos, setIntentos] = useState(0);
    const [resultado, setResultado] = useState(null); // 'gano' | 'rendido'

    const mezclado = cat === '__MEZCLA__';
    const poolCat = mezclado ? PERSONAJES_HISTORICOS : personajesPorCategoria(cat);

    const iniComun = (s, pistasArr, pm, b) => {
        setSecret(s);
        setPistas(pistasArr);
        setPlayMode(pm);
        setBoard(b || []);
        setNPistas(1);
        setTachados({});
        setModoAdivinar(false);
        setGuessTxt('');
        setMensaje('');
        setIntentos(0);
        setResultado(null);
        setFase('JUGANDO');
    };

    const empezar = () => {
        if (modo === 'CREAR') {
            const ds = customPistas.map((x) => x.trim()).filter(Boolean);
            if (!customNombre.trim()) { setMensaje(''); alert(t('Escribe el nombre del personaje.')); return; }
            if (ds.length === 0) { alert(t('Añade al menos una pista.')); return; }
            const s = { id: '__custom__', nombre: customNombre.trim(), datos: ds, wiki: customWiki.trim(), campo: '', pais: '', epoca: '', nac: null, fall: null };
            iniComun(s, shuffle(ds.map((d) => ({ icon: '💡', tipo: 'dato', valor: d }))), 'TEXTO', []);
            return;
        }
        // AZAR / ELEGIR → tablero
        const n = Math.min(dif, poolCat.length);
        let s, b;
        if (modo === 'ELEGIR') {
            s = poolCat.find((p) => p.id === elegidoId) || poolCat[0];
            const otros = shuffle(poolCat.filter((p) => p.id !== s.id)).slice(0, n - 1);
            b = shuffle([s, ...otros]);
        } else {
            b = shuffle(poolCat).slice(0, n);
            s = b[Math.floor(Math.random() * b.length)];
        }
        iniComun(s, construirPistas(s, mezclado), 'BOARD', b);
    };

    const otraPista = () => setNPistas((n) => Math.min(n + 1, pistas.length));

    const ganar = () => {
        setResultado('gano');
        setFase('FIN');
        const estrellas = nPistas <= 2 ? 3 : nPistas <= 4 ? 2 : 1;
        guardarRegistroLocal('QUIEN_HISTORICO', {
            titulo: '¿Quién es quién? histórico', aciertos: estrellas, intentos: 3,
            porcentaje: Math.round((estrellas / 3) * 100), via: 'juego',
        });
    };

    const clickCarta = (p) => {
        if (modoAdivinar) {
            if (p.id === secret.id) ganar();
            else {
                setIntentos((i) => i + 1);
                setTachados((tt) => ({ ...tt, [p.id]: true }));
                setNPistas((n) => Math.min(n + 1, pistas.length));
                setMensaje(`${t('No es')} ${p.nombre}. ${t('¡Te doy otra pista!')}`);
                setModoAdivinar(false);
            }
        } else {
            setTachados((tt) => ({ ...tt, [p.id]: !tt[p.id] }));
        }
    };

    const comprobarTexto = () => {
        const g = norm(guessTxt);
        if (!g) return;
        const ok = g === norm(secret.nombre) || (g.length >= 4 && norm(secret.nombre).includes(g));
        if (ok) ganar();
        else {
            setIntentos((i) => i + 1);
            setNPistas((n) => Math.min(n + 1, pistas.length));
            setMensaje(t('No es correcto. ¡Te doy otra pista!'));
            setGuessTxt('');
        }
    };

    const rendirse = () => { setResultado('rendido'); setFase('FIN'); };

    /* ---------------- SETUP ---------------- */
    if (fase === 'SETUP') {
        const opciones = [...CATEGORIAS_PH, { id: '__MEZCLA__', label: 'Todos mezclados', emoji: '🌍' }];
        const modos = [
            { id: 'AZAR', emoji: '🎲', t: 'Al azar', d: 'El juego elige un personaje secreto.' },
            { id: 'ELEGIR', emoji: '👆', t: 'Elegir personaje', d: 'Tú eliges quién es el personaje secreto.' },
            { id: 'CREAR', emoji: '✏️', t: 'Crear personaje', d: 'Inventa un personaje y sus pistas.' },
        ];
        return (
            <Wrap salir={salir} t={t}>
                <div style={S.panel}>
                    <h2 style={{ marginTop: 0, color: COL.oscuro }}>🧐 {t('Elige el reto')}</h2>
                    <p style={{ color: '#555' }}>{t('Adivina el personaje histórico secreto usando las pistas y tus conocimientos.')}</p>

                    <label style={S.label}>🗣️ {t('Idioma del juego')}</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(idiomas).map(([code, info]) => (
                            <button key={code} onClick={() => setIdioma(code)}
                                style={{ ...S.opt, flex: '1 1 0', minWidth: 68, border: `3px solid ${idioma === code ? COL.azul : '#dbe4ec'}`, background: idioma === code ? '#e8f6fb' : '#fff' }}>
                                <span style={{ fontSize: '1.5rem' }}>{info.bandera}</span>
                                <b style={{ fontSize: '0.78rem', textAlign: 'center' }}>{info.etiqueta}</b>
                            </button>
                        ))}
                    </div>

                    <label style={{ ...S.label, marginTop: 16 }}>{t('Modo')}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {modos.map((m) => (
                            <button key={m.id} onClick={() => setModo(m.id)} title={t(m.d)}
                                style={{ ...S.opt, border: `3px solid ${modo === m.id ? COL.azul : '#dbe4ec'}`, background: modo === m.id ? '#e8f6fb' : '#fff' }}>
                                <span style={{ fontSize: '1.5rem' }}>{m.emoji}</span>
                                <b style={{ fontSize: '0.82rem', textAlign: 'center' }}>{t(m.t)}</b>
                            </button>
                        ))}
                    </div>

                    {modo !== 'CREAR' && (
                        <>
                            <label style={{ ...S.label, marginTop: 16 }}>{t('Categoría')}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {opciones.map((o) => {
                                    const on = cat === o.id;
                                    const total = o.id === '__MEZCLA__' ? PERSONAJES_HISTORICOS.length : personajesPorCategoria(o.id).length;
                                    return (
                                        <button key={o.id} onClick={() => { setCat(o.id); setElegidoId(''); }}
                                            style={{ ...S.opt, border: `3px solid ${on ? COL.azul : '#dbe4ec'}`, background: on ? '#e8f6fb' : '#fff' }}>
                                            <span style={{ fontSize: '1.6rem' }}>{o.emoji}</span>
                                            <b>{t(o.label)}</b>
                                            <span style={{ fontSize: '0.78rem', color: '#888' }}>{total} {t('personajes')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {modo === 'ELEGIR' && (
                        <>
                            <label style={{ ...S.label, marginTop: 16 }}>{t('Personaje secreto')}</label>
                            <select style={S.input} value={elegidoId} onChange={(e) => setElegidoId(e.target.value)}>
                                <option value="">{t('— Elige un personaje —')}</option>
                                {poolCat.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((p) => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                            </select>
                        </>
                    )}

                    {modo === 'CREAR' && (
                        <div style={{ marginTop: 8 }}>
                            <label style={S.label}>{t('Nombre del personaje')}</label>
                            <input style={S.input} value={customNombre} onChange={(e) => setCustomNombre(e.target.value)} placeholder={t('Ej: Marie Curie')} />
                            <label style={{ ...S.label, marginTop: 10 }}>{t('Foto (título de Wikipedia, opcional)')}</label>
                            <input style={S.input} value={customWiki} onChange={(e) => setCustomWiki(e.target.value)} placeholder={t('Ej: Marie Curie')} />
                            <label style={{ ...S.label, marginTop: 10 }}>{t('Pistas (una por línea)')}</label>
                            {customPistas.map((p, i) => (
                                <input key={i} style={{ ...S.input, marginBottom: 6 }} value={p}
                                    onChange={(e) => setCustomPistas((arr) => arr.map((x, j) => j === i ? e.target.value : x))}
                                    placeholder={`${t('Pista')} ${i + 1}`} />
                            ))}
                            <button style={{ ...S.btn('#94a3b8'), padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setCustomPistas((a) => [...a, ''])}>➕ {t('Añadir pista')}</button>
                        </div>
                    )}

                    {modo !== 'CREAR' && (
                        <>
                            <label style={{ ...S.label, marginTop: 16 }}>{t('Dificultad (nº de caras)')}</label>
                            <div style={{ display: 'flex', gap: 10 }}>
                                {[{ n: 9, tl: 'Fácil' }, { n: 16, tl: 'Normal' }, { n: 24, tl: 'Difícil' }].map((d) => (
                                    <button key={d.n} onClick={() => setDif(d.n)}
                                        style={{ ...S.opt, flex: 1, border: `3px solid ${dif === d.n ? COL.azul : '#dbe4ec'}`, background: dif === d.n ? '#e8f6fb' : '#fff' }}>
                                        <b>{t(d.tl)}</b><span style={{ fontSize: '0.78rem', color: '#888' }}>{d.n} {t('caras')}</span>
                                    </button>
                                ))}
                            </div>

                            <button onClick={() => setSinNombres((v) => !v)}
                                style={{ ...S.opt, flexDirection: 'row', justifyContent: 'flex-start', gap: 10, width: '100%', marginTop: 16, textAlign: 'left',
                                    border: `3px solid ${sinNombres ? COL.azul : '#dbe4ec'}`, background: sinNombres ? '#e8f6fb' : '#fff' }}>
                                <span style={{ fontSize: '1.6rem' }}>{sinNombres ? '🙈' : '🏷️'}</span>
                                <span style={{ flex: 1 }}>
                                    <b>{t('Modo sin nombres')}</b>
                                    <span style={{ display: 'block', fontSize: '0.78rem', color: '#888' }}>{t('Oculta el nombre bajo cada cara: hay que deducir solo por la foto. ¡Más difícil!')}</span>
                                </span>
                                <span style={{ fontWeight: 900, color: sinNombres ? COL.verde : '#bbb' }}>{sinNombres ? t('SÍ') : 'NO'}</span>
                            </button>
                        </>
                    )}

                    <button style={{ ...S.btn(COL.verde), marginTop: 22, width: '100%', fontSize: '1.1rem' }} onClick={empezar}>▶️ {t('¡Jugar!')}</button>
                </div>
            </Wrap>
        );
    }

    /* ---------------- FIN ---------------- */
    if (fase === 'FIN') {
        const estrellas = nPistas <= 2 ? 3 : nPistas <= 4 ? 2 : 1;
        const meta = [secret.campo, secret.pais, secret.nac != null ? `${anioTexto(secret.nac)}${secret.fall != null ? '–' + anioTexto(secret.fall) : ''}` : '']
            .filter(Boolean).map((x) => t(x)).join(' · ');
        return (
            <Wrap salir={salir} t={t}>
                <div style={{ ...S.panel, textAlign: 'center' }}>
                    {resultado === 'gano' ? (
                        <>
                            <div style={{ fontSize: '3.4rem' }}>🎉</div>
                            <h2 style={{ color: COL.verde, margin: '4px 0' }}>{t('¡Correcto!')}</h2>
                            <div style={{ fontSize: '1.8rem' }}>{'⭐'.repeat(estrellas)}{'☆'.repeat(3 - estrellas)}</div>
                            <p style={{ color: '#555' }}>{t('Pistas usadas')}: {nPistas}{intentos > 0 ? ` · ${t('intentos')}: ${intentos}` : ''}</p>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '3.4rem' }}>🙈</div>
                            <h2 style={{ color: COL.rojo, margin: '4px 0' }}>{t('Era…')}</h2>
                        </>
                    )}
                    <div style={{ margin: '12px auto', maxWidth: 240, borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
                        <FotoPersonaje p={secret} size={220} />
                        <div style={{ background: COL.oscuro, color: '#fff', padding: '10px 12px' }}>
                            <b style={{ fontSize: '1.05rem' }}>{secret.nombre}</b>
                            {meta && <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>{meta}</div>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', maxWidth: 320, margin: '0 auto 10px', color: '#444', fontSize: '0.9rem' }}>
                        {(secret.datos || []).map((d, i) => <div key={i}>💡 {t(d)}</div>)}
                    </div>
                    <button style={{ ...S.btn(COL.azul), marginTop: 8 }} onClick={empezar}>🔁 {t('Otra vez')}</button>
                    <button style={{ ...S.btn('#94a3b8'), marginTop: 8, marginLeft: 8 }} onClick={() => setFase('SETUP')}>⚙️ {t('Cambiar reto')}</button>
                </div>
            </Wrap>
        );
    }

    /* ---------------- JUGANDO ---------------- */
    return (
        <Wrap salir={salir} t={t}>
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 12px' }}>
                {/* Panel de pistas */}
                <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <h3 style={{ margin: 0, color: COL.oscuro }}>🕵️ {t('Pistas')} ({nPistas}/{pistas.length})</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={{ ...S.btn(COL.amarillo), color: COL.oscuro, padding: '8px 14px' }} disabled={nPistas >= pistas.length} onClick={otraPista}>➕ {t('Otra pista')}</button>
                            {playMode === 'BOARD' && (
                                <button style={{ ...S.btn(COL.verde), padding: '8px 14px' }} onClick={() => { setModoAdivinar((v) => !v); setMensaje(modoAdivinar ? '' : t('Toca la carta del personaje que crees que es.')); }}>
                                    {modoAdivinar ? `✋ ${t('Cancelar')}` : `🎯 ${t('¡Ya lo sé!')}`}
                                </button>
                            )}
                        </div>
                    </div>
                    <ol style={{ margin: '10px 0 0', paddingLeft: 4, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pistas.slice(0, nPistas).map((p, i) => (
                            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#f4f7fb', borderRadius: 10, padding: '8px 10px' }}>
                                <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                                <span><b>{i + 1}.</b> {clueText(p)}</span>
                            </li>
                        ))}
                    </ol>
                    {mensaje && <p style={{ margin: '10px 0 0', fontWeight: 700, color: modoAdivinar ? COL.verde : COL.rojo }}>{mensaje}</p>}

                    {playMode === 'TEXTO' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            <input style={{ ...S.input, flex: 1, minWidth: 160 }} value={guessTxt} onChange={(e) => setGuessTxt(e.target.value)}
                                placeholder={t('Escribe quién crees que es…')} onKeyDown={(e) => e.key === 'Enter' && comprobarTexto()} />
                            <button style={{ ...S.btn(COL.verde), padding: '10px 16px' }} onClick={comprobarTexto}>✅ {t('Comprobar')}</button>
                        </div>
                    )}

                    {playMode === 'BOARD' && (
                        <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#888' }}>
                            {t('Tacha (toca) las caras que NO encajan con las pistas. Cuando lo tengas claro, pulsa «¡Ya lo sé!».')}
                        </div>
                    )}
                </div>

                {/* Tablero (solo modo BOARD) */}
                {playMode === 'BOARD' && (
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
                )}

                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <button style={{ ...S.btn('#94a3b8'), padding: '8px 16px' }} onClick={rendirse}>🏳️ {t('Rendirse / ver quién era')}</button>
                </div>
            </div>
        </Wrap>
    );
}

/* ---- Marco común (fondo + cabecera + selector de idioma) ---- */
function Wrap({ children, salir, t }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: `linear-gradient(135deg, ${COL.bg1}, ${COL.bg2})`, fontFamily: "'Comic Sans MS','Segoe UI',sans-serif", padding: '0 0 50px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', position: 'sticky', top: 0, zIndex: 20, background: 'rgba(26,26,46,0.25)', backdropFilter: 'blur(6px)' }}>
                <button onClick={salir} style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontWeight: 800, boxShadow: '0 3px 0 rgba(0,0,0,0.2)' }}>← {t ? t('Salir') : 'Salir'}</button>
                <h1 style={{ color: '#fff', margin: 0, fontSize: '1.3rem', textShadow: '0 2px 4px rgba(0,0,0,0.35)', flex: 1 }}>🧐 {t ? t('¿Quién es quién? histórico') : '¿Quién es quién? histórico'}</h1>
            </div>
            <div style={{ maxWidth: 1000, margin: '20px auto', padding: '0 12px' }}>{children}</div>
        </div>
    );
}

const S = {
    panel: { background: '#fff', borderRadius: 22, padding: 24, maxWidth: 560, margin: '0 auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', color: COL.oscuro },
    label: { display: 'block', fontWeight: 800, margin: '10px 0 6px', color: COL.azul },
    opt: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 8px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', color: COL.oscuro },
    input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: '2px solid #dbe4ec', fontSize: '1rem', fontFamily: 'inherit', outline: 'none' },
    btn: (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 14, padding: '12px 18px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 0 rgba(0,0,0,0.2)' }),
};
