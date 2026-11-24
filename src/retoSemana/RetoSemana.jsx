import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection, doc, onSnapshot, query, orderBy, limit, getDocs, where,
    setDoc, updateDoc, deleteDoc, getDoc, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { enlaceAbsoluto } from '../utils/retoLink';
import {
    ADMIN_RETO_SEMANA, COL_RETOS, COMP_RETO_SEMANA, RUTA_RETO_SEMANA,
    estadoReto, ordenarRanking, ms, fechaCorta, semanaPorDefecto, aliasGuardado, idAlias,
} from './retoSemanaDatos';

const ModalElegirHerramienta = lazy(() => import('../components/ModalElegirHerramienta'));

const NARANJA = '#ff9f43';
const MEDALLAS = ['🥇', '🥈', '🥉'];

// ─── utilidades de fecha para <input type="datetime-local"> ───
const aLocal = (t) => {
    const v = ms(t); if (!v) return '';
    const d = new Date(v - new Date(v).getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
};
const deLocal = (s) => (s ? Timestamp.fromDate(new Date(s)) : null);

// Cambia el &t= (título) de la ruta del juego para que coincida con el del reto
const conTitulo = (ruta, titulo) => {
    if (!ruta) return ruta;
    try {
        const u = new URL(ruta, 'https://x.es');
        if (titulo) u.searchParams.set('t', titulo); else u.searchParams.delete('t');
        return u.pathname + u.search;
    } catch (_) { return ruta; }
};

function useCuentaAtras(objetivo) {
    const [ahora, setAhora] = useState(Date.now());
    useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
    const resto = Math.max(0, ms(objetivo) - ahora);
    const d = Math.floor(resto / 86400000), h = Math.floor(resto / 3600000) % 24, m = Math.floor(resto / 60000) % 60, s = Math.floor(resto / 1000) % 60;
    return { resto, d, h, m, s, ahora };
}

export default function RetoSemana({ onExit }) {
    const [usuario, setUsuario] = useState(auth.currentUser);
    const [retos, setRetos] = useState(null);
    const [selId, setSelId] = useState(() => { try { return new URLSearchParams(window.location.search).get('id'); } catch (_) { return null; } });
    const [editando, setEditando] = useState(null); // objeto reto (nuevo o existente)
    const esAdmin = usuario?.email === ADMIN_RETO_SEMANA;

    useEffect(() => onAuthStateChanged(auth, setUsuario), []);
    useEffect(() => onSnapshot(query(collection(db, COL_RETOS), orderBy('inicio', 'desc')),
        s => setRetos(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => setRetos([])), []);

    const visibles = useMemo(() => (retos || []).filter(r => esAdmin || r.publicado), [retos, esAdmin]);
    const activo = visibles.find(r => estadoReto(r) === 'activo');
    const terminados = visibles.filter(r => estadoReto(r) === 'terminado');
    const proximos = visibles.filter(r => estadoReto(r) === 'proximo' || estadoReto(r) === 'borrador');
    const sel = (selId && visibles.find(r => r.id === selId)) || activo || terminados[0] || null;

    const elegir = (id) => {
        setSelId(id);
        window.history.replaceState({}, '', `${RUTA_RETO_SEMANA}${id ? `?id=${id}` : ''}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div style={st.pagina}>
            <div style={st.contenedor}>
                <div style={st.barra}>
                    <button onClick={onExit} style={st.btnVolver}>← Pikt</button>
                    {esAdmin && <button onClick={() => setEditando({ ...semanaPorDefecto(), titulo: '', descripcion: '', premio: '', publicado: false })} style={st.btnAdmin}>➕ Nuevo reto</button>}
                </div>

                <header style={{ textAlign: 'center', margin: '6px 0 22px' }}>
                    <div style={{ fontSize: '2.6rem', lineHeight: 1 }}>🔥</div>
                    <h1 style={{ margin: '8px 0 4px', fontSize: 'clamp(1.6rem, 5vw, 2.3rem)', fontWeight: 900, letterSpacing: -0.5 }}>Reto de la semana</h1>
                    <p style={{ margin: 0, color: '#b8c2cc', fontSize: '0.95rem' }}>Un juego nuevo cada semana · el que más puntos consiga gana · ganadores en Instagram</p>
                </header>

                {retos === null ? (
                    <div style={{ textAlign: 'center', color: '#8899a6', padding: 40 }}>Cargando…</div>
                ) : !sel ? (
                    <div style={st.tarjeta}>
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: '2.4rem' }}>⏳</div>
                            <h2 style={{ margin: '10px 0 6px' }}>Muy pronto, el primer reto</h2>
                            <p style={{ color: '#8899a6', margin: 0 }}>Síguenos en Instagram para enterarte el primero.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <FichaReto reto={sel} esAdmin={esAdmin} onEditar={() => setEditando(sel)} />
                        <Ranking reto={sel} esAdmin={esAdmin} />
                    </>
                )}

                {esAdmin && proximos.length > 0 && (
                    <section style={{ marginTop: 26 }}>
                        <h3 style={st.h3}>🛠️ Próximos y borradores (solo tú)</h3>
                        <div style={st.listaRetos}>
                            {proximos.map(r => <FilaReto key={r.id} r={r} activo={sel?.id === r.id} onClick={() => elegir(r.id)} />)}
                        </div>
                    </section>
                )}

                {(terminados.length > 0 || (activo && sel?.id !== activo.id)) && (
                    <section style={{ marginTop: 26 }}>
                        <h3 style={st.h3}>🏆 Retos anteriores</h3>
                        <div style={st.listaRetos}>
                            {activo && sel?.id !== activo.id && <FilaReto r={activo} onClick={() => elegir(activo.id)} />}
                            {terminados.map(r => <FilaReto key={r.id} r={r} activo={sel?.id === r.id} onClick={() => elegir(r.id)} conPodio />)}
                        </div>
                    </section>
                )}

                <ComoParticipar />
            </div>

            {editando && <EditorReto reto={editando} onClose={() => setEditando(null)} onGuardado={(id) => { setEditando(null); elegir(id); }} />}
        </div>
    );
}

// ─── Ficha del reto seleccionado ────────────────────────────────────────────
function FichaReto({ reto, esAdmin, onEditar }) {
    const estado = estadoReto(reto);
    const { resto, d, h, m, s } = useCuentaAtras(estado === 'proximo' ? reto.inicio : reto.fin);
    const [copiado, setCopiado] = useState(false);
    const enlacePagina = `${window.location.origin}${RUTA_RETO_SEMANA}?id=${reto.id}`;

    const jugar = () => { if (reto.herramientaRuta) window.location.href = enlaceAbsoluto(reto.herramientaRuta); };
    const compartir = async () => {
        const texto = `🔥 Reto de la semana en Pikt: ${reto.titulo}. ¿Te atreves?`;
        if (navigator.share) { try { await navigator.share({ title: reto.titulo, text: texto, url: enlacePagina }); return; } catch (_) { return; } }
        try { await navigator.clipboard.writeText(enlacePagina); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch (_) {}
    };

    const etiqueta = { activo: '🟢 En juego', proximo: '🕒 Próximamente', terminado: '🏁 Terminado', borrador: '📝 Borrador (no visible)' }[estado];

    return (
        <div style={{ ...st.tarjeta, borderColor: estado === 'activo' ? 'rgba(255,159,67,0.55)' : 'rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...st.chip, background: estado === 'activo' ? 'rgba(46,204,113,0.18)' : 'rgba(255,255,255,0.08)', color: estado === 'activo' ? '#2ecc71' : '#b8c2cc' }}>{etiqueta}</span>
                <span style={{ color: '#8899a6', fontSize: '0.82rem' }}>{fechaCorta(reto.inicio)} → {fechaCorta(reto.fin)}</span>
            </div>

            <h2 style={{ margin: '14px 0 6px', fontSize: 'clamp(1.3rem, 4vw, 1.7rem)' }}>{reto.titulo || 'Reto sin título'}</h2>
            {reto.herramientaTitulo && <div style={{ color: NARANJA, fontWeight: 700, fontSize: '0.9rem' }}>🎮 {reto.herramientaTitulo}</div>}
            {reto.descripcion && <p style={{ color: '#d0d7de', lineHeight: 1.55, margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{reto.descripcion}</p>}

            {Array.isArray(reto.herramientaResumen) && reto.herramientaResumen.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {reto.herramientaResumen.map((c, i) => <span key={i} style={st.chip}>{c}</span>)}
                </div>
            )}

            {reto.premio && <div style={st.premio}>🎁 <b>Premio:</b> {reto.premio}</div>}

            {(estado === 'activo' || estado === 'proximo') && resto > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ color: '#8899a6', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>{estado === 'activo' ? 'Termina en' : 'Empieza en'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[[d, 'días'], [h, 'horas'], [m, 'min'], [s, 'seg']].map(([v, l]) => (
                            <div key={l} style={st.reloj}><div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{String(v).padStart(2, '0')}</div><div style={{ fontSize: '0.7rem', color: '#8899a6' }}>{l}</div></div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                {(estado === 'activo' || (esAdmin && reto.herramientaRuta)) && (
                    <button onClick={jugar} disabled={!reto.herramientaRuta} style={{ ...st.btnJugar, flex: '2 1 200px' }}>
                        {estado === 'activo' ? '▶ Jugar el reto' : '▶ Probar (admin)'}
                    </button>
                )}
                <button onClick={compartir} style={{ ...st.btnSec, flex: '1 1 140px' }}>{copiado ? '✓ Enlace copiado' : '🔗 Compartir'}</button>
                {esAdmin && <button onClick={onEditar} style={{ ...st.btnSec, flex: '1 1 120px' }}>✏️ Editar</button>}
            </div>
            {esAdmin && !reto.herramientaRuta && <div style={{ color: '#e74c3c', fontSize: '0.82rem', marginTop: 8 }}>Falta elegir el juego del reto.</div>}
        </div>
    );
}

// ─── Ranking en directo ─────────────────────────────────────────────────────
function Ranking({ reto, esAdmin }) {
    const [filas, setFilas] = useState(null);
    const [verTodo, setVerTodo] = useState(false);
    const [detalle, setDetalle] = useState(null); // { fila, envios, clave }
    const [copiado, setCopiado] = useState(false);
    const yo = idAlias(aliasGuardado());

    useEffect(() => {
        setFilas(null);
        return onSnapshot(query(collection(db, COL_RETOS, reto.id, 'ranking'), orderBy('mejor', 'desc'), limit(300)),
            s => setFilas(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setFilas([]));
    }, [reto.id]);

    const ordenadas = useMemo(() => ordenarRanking([...(filas || [])]), [filas]);
    const retiradas = (filas || []).filter(f => f.descalificado);
    const mostradas = verTodo ? ordenadas : ordenadas.slice(0, 20);
    const miPuesto = ordenadas.findIndex(f => f.id === yo);

    const textoInstagram = () => {
        const top = ordenadas.slice(0, 3);
        return [
            `🔥 RETO DE LA SEMANA · ${reto.titulo}`,
            reto.herramientaTitulo ? `🎮 ${reto.herramientaTitulo}` : '',
            '',
            '🏆 ¡Estos son los ganadores!',
            ...top.map((f, i) => `${MEDALLAS[i]} ${f.alias} · ${f.mejor} puntos`),
            '',
            `👏 Gracias a los ${ordenadas.length} participantes.`,
            'Los ganadores podéis escribirnos por privado con vuestro alias y contraseña para recibir el premio.',
            '',
            '👉 El nuevo reto ya está en pikt.es/retosemana',
            '#pikt #retodelasemana #gamificacion #educacion',
        ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    };
    const copiarInstagram = async () => { try { await navigator.clipboard.writeText(textoInstagram()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch (_) {} };

    const abrirDetalle = async (fila) => {
        setDetalle({ fila, envios: null, clave: null });
        const base = doc(db, COL_RETOS, reto.id);
        const [env, cl] = await Promise.all([
            getDocs(query(collection(base, 'envios'), where('aliasId', '==', fila.id))).catch(() => null),
            getDoc(doc(base, 'claves', fila.id)).catch(() => null),
        ]);
        setDetalle({
            fila,
            envios: env ? env.docs.map(d => d.data()).sort((a, b) => ms(b.fecha) - ms(a.fecha)) : [],
            clave: cl?.exists() ? cl.data().clave : '—',
        });
    };
    const retirar = async (fila, si) => {
        if (si && !window.confirm(`¿Retirar a «${fila.alias}» del ranking? No podrá enviar más puntuaciones en este reto.`)) return;
        await updateDoc(doc(db, COL_RETOS, reto.id, 'ranking', fila.id), { descalificado: si });
        setDetalle(null);
    };

    return (
        <section style={{ ...st.tarjeta, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>📊 Ranking {estadoReto(reto) === 'activo' && <span style={{ fontSize: '0.75rem', color: '#2ecc71', fontWeight: 600 }}>· en directo</span>}</h3>
                <span style={{ color: '#8899a6', fontSize: '0.82rem' }}>{ordenadas.length} participante{ordenadas.length === 1 ? '' : 's'}</span>
            </div>

            {miPuesto >= 0 && (
                <div style={{ background: 'rgba(255,159,67,0.12)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: '0.88rem' }}>
                    Tú (<b>{ordenadas[miPuesto].alias}</b>) vas <b style={{ color: NARANJA }}>{miPuesto + 1}º</b> con <b>{ordenadas[miPuesto].mejor}</b> puntos.
                </div>
            )}

            {filas === null ? <div style={{ color: '#8899a6' }}>Cargando…</div>
                : ordenadas.length === 0 ? <div style={{ color: '#8899a6', padding: '10px 0' }}>Aún no hay puntuaciones. ¡Sé el primero!</div>
                : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {mostradas.map((f, i) => (
                            <div key={f.id} onClick={esAdmin ? () => abrirDetalle(f) : undefined}
                                style={{ ...st.fila, ...(i < 3 ? st.filaPodio : {}), ...(f.id === yo ? { outline: `2px solid ${NARANJA}` } : {}), cursor: esAdmin ? 'pointer' : 'default' }}>
                                <div style={{ width: 34, textAlign: 'center', fontWeight: 900, fontSize: i < 3 ? '1.3rem' : '0.95rem', color: '#b8c2cc' }}>{i < 3 ? MEDALLAS[i] : i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{f.alias}</div>
                                <div style={{ color: '#8899a6', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{f.intentos} {f.intentos === 1 ? 'partida' : 'partidas'}</div>
                                <div style={{ fontWeight: 900, color: '#f1c40f', minWidth: 54, textAlign: 'right' }}>{f.mejor}</div>
                            </div>
                        ))}
                    </div>
                )}

            {ordenadas.length > 20 && (
                <button onClick={() => setVerTodo(v => !v)} style={{ ...st.btnSec, width: '100%', marginTop: 10 }}>{verTodo ? 'Ver solo el top 20' : `Ver los ${ordenadas.length}`}</button>
            )}

            {esAdmin && (
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', marginTop: 16, paddingTop: 12 }}>
                    <div style={{ color: '#8899a6', fontSize: '0.8rem', marginBottom: 8 }}>🛠️ Admin: pulsa una fila para ver sus partidas y su contraseña (para comprobar al ganador) o retirarlo.</div>
                    <button onClick={copiarInstagram} disabled={!ordenadas.length} style={{ ...st.btnSec, width: '100%' }}>{copiado ? '✓ Copiado' : '📋 Copiar texto de ganadores para Instagram'}</button>
                    {retiradas.length > 0 && (
                        <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#8899a6' }}>
                            Retirados: {retiradas.map(f => (
                                <button key={f.id} onClick={() => retirar(f, false)} title="Volver a meter en el ranking" style={{ ...st.chip, border: 'none', cursor: 'pointer', marginRight: 6, textDecoration: 'line-through' }}>{f.alias} ↺</button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {detalle && (
                <div style={st.overlay} onClick={() => setDetalle(null)}>
                    <div style={{ ...st.modal, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{detalle.fila.alias}</h3>
                            <button onClick={() => setDetalle(null)} style={st.btnX}>✕</button>
                        </div>
                        <div style={{ margin: '10px 0', fontSize: '0.9rem' }}>Mejor: <b style={{ color: '#f1c40f' }}>{detalle.fila.mejor}</b> · Contraseña: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 5 }}>{detalle.clave ?? '…'}</code></div>
                        <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {detalle.envios === null ? <div style={{ color: '#8899a6' }}>Cargando…</div> : detalle.envios.map((e, i) => (
                                <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8rem' }}>
                                    <b>{e.puntos}</b> pts · {ms(e.fecha) ? new Date(ms(e.fecha)).toLocaleString('es-ES') : ''}{e.uid ? ' · con cuenta' : ''}
                                    {e.detalle && <div style={{ color: '#8899a6', wordBreak: 'break-word' }}>{Object.entries(e.detalle).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => retirar(detalle.fila, true)} style={{ ...st.btnSec, width: '100%', marginTop: 12, color: '#e74c3c', borderColor: 'rgba(231,76,60,0.5)' }}>🚫 Retirar del ranking</button>
                    </div>
                </div>
            )}
        </section>
    );
}

// ─── Fila de la lista de retos (con podio para los terminados) ──────────────
function FilaReto({ r, activo, onClick, conPodio }) {
    const [podio, setPodio] = useState(null);
    useEffect(() => {
        if (!conPodio) return;
        getDocs(query(collection(db, COL_RETOS, r.id, 'ranking'), orderBy('mejor', 'desc'), limit(10)))
            .then(s => setPodio(ordenarRanking(s.docs.map(d => ({ id: d.id, ...d.data() }))).slice(0, 3)))
            .catch(() => setPodio([]));
    }, [r.id, conPodio]);
    const estado = estadoReto(r);
    return (
        <button onClick={onClick} style={{ ...st.filaReto, ...(activo ? { borderColor: NARANJA } : {}) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ textAlign: 'left' }}>{r.titulo || 'Sin título'}</b>
                <span style={{ color: '#8899a6', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{estado === 'borrador' ? '📝 borrador' : fechaCorta(r.inicio)}</span>
            </div>
            {r.herramientaTitulo && <div style={{ color: NARANJA, fontSize: '0.78rem', marginTop: 2, textAlign: 'left' }}>🎮 {r.herramientaTitulo}</div>}
            {conPodio && podio && podio.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: '0.8rem', color: '#d0d7de' }}>
                    {podio.map((f, i) => <span key={f.id}>{MEDALLAS[i]} {f.alias} <span style={{ color: '#f1c40f' }}>{f.mejor}</span></span>)}
                </div>
            )}
        </button>
    );
}

function ComoParticipar() {
    const pasos = [
        ['🎮', 'Juega', 'Pulsa «Jugar el reto». Todos juegan con la misma configuración.'],
        ['🔥', 'Envía tu puntuación', 'Al terminar, pulsa «Enviar al reto de la semana» con tu alias y una contraseña.'],
        ['🔁', 'Mejora tu marca', 'Repite todas las veces que quieras: cuenta tu mejor puntuación.'],
        ['🏆', 'Ganadores', 'Al acabar la semana anunciamos los ganadores en Instagram. Para el premio te pediremos tu alias y contraseña.'],
    ];
    return (
        <section style={{ marginTop: 26 }}>
            <h3 style={st.h3}>¿Cómo se participa?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                {pasos.map(([e, t, d]) => (
                    <div key={t} style={{ ...st.tarjeta, padding: '14px 16px' }}>
                        <div style={{ fontSize: '1.6rem' }}>{e}</div>
                        <div style={{ fontWeight: 800, margin: '6px 0 4px' }}>{t}</div>
                        <div style={{ color: '#b8c2cc', fontSize: '0.84rem', lineHeight: 1.45 }}>{d}</div>
                    </div>
                ))}
            </div>
            <p style={{ color: '#6b7b88', fontSize: '0.76rem', marginTop: 14, lineHeight: 1.5 }}>
                No hace falta cuenta ni dar tu nombre real: usa un alias. Los alias ofensivos o las puntuaciones imposibles se retiran del ranking.
            </p>
        </section>
    );
}

// ─── Editor del reto (solo admin) ───────────────────────────────────────────
function EditorReto({ reto, onClose, onGuardado }) {
    const [id] = useState(() => reto.id || doc(collection(db, COL_RETOS)).id);
    const [c, setC] = useState({
        titulo: reto.titulo || '', descripcion: reto.descripcion || '', premio: reto.premio || '',
        inicio: aLocal(reto.inicio), fin: aLocal(reto.fin), publicado: !!reto.publicado,
        herramientaId: reto.herramientaId || null, herramientaTitulo: reto.herramientaTitulo || '',
        herramientaRuta: reto.herramientaRuta || '', herramientaResumen: reto.herramientaResumen || [],
        herramientaConfig: reto.herramientaConfig || null,
    });
    const [elegir, setElegir] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setC(p => ({ ...p, [k]: v }));

    const guardar = async () => {
        setError('');
        if (!c.titulo.trim()) { setError('Pon un título.'); return; }
        if (!c.inicio || !c.fin || new Date(c.fin) <= new Date(c.inicio)) { setError('Revisa las fechas: el final debe ser posterior al inicio.'); return; }
        if (c.publicado && !c.herramientaRuta) { setError('Elige el juego antes de publicar.'); return; }
        setGuardando(true);
        try {
            const titulo = c.titulo.trim();
            await setDoc(doc(db, COL_RETOS, id), {
                titulo, descripcion: c.descripcion.trim(), premio: c.premio.trim(),
                inicio: deLocal(c.inicio), fin: deLocal(c.fin), publicado: c.publicado,
                herramientaId: c.herramientaId, herramientaTitulo: c.herramientaTitulo,
                herramientaRuta: conTitulo(c.herramientaRuta, titulo),
                herramientaResumen: c.herramientaResumen || [], herramientaConfig: c.herramientaConfig || null,
                ...(reto.id ? { actualizadoEn: serverTimestamp() } : { creadoEn: serverTimestamp() }),
            }, { merge: true });
            onGuardado(id);
        } catch (e) { setError('No se pudo guardar: ' + e.message); setGuardando(false); }
    };

    const borrar = async () => {
        if (!window.confirm('¿Borrar este reto? El ranking dejará de verse.')) return;
        await deleteDoc(doc(db, COL_RETOS, id));
        onClose();
    };

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={st.modal} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>{reto.id ? '✏️ Editar reto' : '➕ Nuevo reto de la semana'}</h3>
                    <button onClick={onClose} style={st.btnX}>✕</button>
                </div>

                <label style={st.label}>Título</label>
                <input value={c.titulo} maxLength={80} onChange={e => set('titulo', e.target.value)} placeholder="Ej: ¿Quién es el rey del cálculo mental?" style={st.input} />

                <label style={st.label}>Juego o herramienta</label>
                <button onClick={() => setElegir(true)} style={{ ...st.input, textAlign: 'left', cursor: 'pointer', color: c.herramientaTitulo ? 'white' : '#8899a6' }}>
                    {c.herramientaTitulo ? `🎮 ${c.herramientaTitulo} · cambiar` : 'Elegir juego y configuración…'}
                </button>
                {c.herramientaResumen?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '-4px 0 12px' }}>{c.herramientaResumen.map((x, i) => <span key={i} style={st.chip}>{x}</span>)}</div>}

                <label style={st.label}>Descripción (opcional)</label>
                <textarea value={c.descripcion} maxLength={600} rows={3} onChange={e => set('descripcion', e.target.value)} placeholder="Reglas, pistas, qué se valora…" style={{ ...st.input, resize: 'vertical' }} />

                <label style={st.label}>Premio (opcional)</label>
                <input value={c.premio} maxLength={120} onChange={e => set('premio', e.target.value)} placeholder="Ej: mención en Instagram + diploma" style={st.input} />

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 180px' }}><label style={st.label}>Empieza</label><input type="datetime-local" value={c.inicio} onChange={e => set('inicio', e.target.value)} style={st.input} /></div>
                    <div style={{ flex: '1 1 180px' }}><label style={st.label}>Termina</label><input type="datetime-local" value={c.fin} onChange={e => set('fin', e.target.value)} style={st.input} /></div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={c.publicado} onChange={e => set('publicado', e.target.checked)} />
                    Publicado (visible para todos y abierto en esas fechas)
                </label>

                {error && <div style={{ color: '#e74c3c', fontSize: '0.84rem', marginBottom: 10 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10 }}>
                    {reto.id && <button onClick={borrar} style={{ ...st.btnSec, color: '#e74c3c' }}>🗑️</button>}
                    <button onClick={onClose} style={{ ...st.btnSec, flex: 1 }}>Cancelar</button>
                    <button onClick={guardar} disabled={guardando} style={{ ...st.btnJugar, flex: 2, padding: '10px' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
                </div>
            </div>

            {elegir && (
                <Suspense fallback={null}>
                    <ModalElegirHerramienta
                        tituloReto={c.titulo || 'Reto de la semana'}
                        herramientaInicial={c.herramientaId || null}
                        configInicial={c.herramientaConfig || null}
                        compId={COMP_RETO_SEMANA}
                        catId={id}
                        onClose={() => setElegir(false)}
                        onElegir={(h) => { setC(p => ({ ...p, ...h })); setElegir(false); }}
                    />
                </Suspense>
            )}
        </div>
    );
}

const st = {
    pagina: { position: 'fixed', inset: 0, overflowY: 'auto', background: 'radial-gradient(circle at 50% -10%, #4a2511 0%, #15202b 45%, #0d141b 100%)', color: 'white', fontFamily: "'Segoe UI', system-ui, sans-serif", zIndex: 50 },
    contenedor: { maxWidth: 760, margin: '0 auto', padding: '16px 16px 60px', boxSizing: 'border-box' },
    barra: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    btnVolver: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
    btnAdmin: { background: 'rgba(255,159,67,0.15)', border: `1px solid ${NARANJA}`, color: NARANJA, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
    tarjeta: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '18px 20px', boxSizing: 'border-box' },
    chip: { display: 'inline-block', background: 'rgba(255,255,255,0.08)', color: '#d0d7de', borderRadius: 20, padding: '4px 11px', fontSize: '0.76rem', fontWeight: 700, fontFamily: 'inherit' },
    premio: { marginTop: 14, background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.3)', borderRadius: 12, padding: '9px 13px', fontSize: '0.9rem' },
    reloj: { flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '8px 4px', textAlign: 'center' },
    btnJugar: { background: `linear-gradient(135deg, ${NARANJA}, #ee5a24)`, border: 'none', color: 'white', borderRadius: 14, padding: '14px 18px', cursor: 'pointer', fontWeight: 900, fontSize: '1.05rem', fontFamily: 'inherit', boxShadow: '0 8px 22px rgba(238,90,36,0.35)' },
    btnSec: { background: 'transparent', border: '1px solid rgba(255,255,255,0.22)', color: 'white', borderRadius: 12, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem' },
    btnX: { background: 'none', border: 'none', color: '#8899a6', fontSize: '1.2rem', cursor: 'pointer' },
    fila: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '9px 12px' },
    filaPodio: { background: 'rgba(255,159,67,0.1)', padding: '11px 12px' },
    h3: { margin: '0 0 10px', fontSize: '1.05rem' },
    listaRetos: { display: 'flex', flexDirection: 'column', gap: 8 },
    filaReto: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', width: '100%' },
    // Por debajo de ModalElegirHerramienta (6000) y sus editores (9500-9999)
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: '#1b2733', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px', color: 'white', boxSizing: 'border-box' },
    label: { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#95a5a6', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 },
    input: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, colorScheme: 'dark' },
};
