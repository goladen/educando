import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import QRSalaBoton, { urlSalaEnVivo } from './components/QRSalaBoton';
import { guardarRegistroLocal } from './utils/registrosLocales';
import {
    ORDEN_SALAS, compruebaCandado, pistasDeJugador, barajar, pick,
    infoPrueba, candadoManual, pruebaParaSala, tienePreguntas, preguntaDePrueba, candadoDePrueba,
} from './escapeHalloween/bancoEscape';
import { TIPO_JUEGO, ETAPAS, ZOMBIS, configPorDefecto } from './escapeHalloween/constantes';
import Mansion3D, { AvatarPreview3D } from './escapeHalloween/Mansion3D';
import EditorDisfraz, { leerAvatarGuardado, avatarAleatorio } from './escapeHalloween/EditorDisfraz';
import EditorEscape from './escapeHalloween/EditorEscape';
import PizarraEscape from './escapeHalloween/PizarraEscape';
import { disfrazDe } from './escapeHalloween/avatares3d';
import { crearAudio, Ambiente, Confeti, Zombi, Corazones, BarraVidaZombi, MapaMansion, TarjetaPregunta, mmss, useNarrador, idNarracionFase, Subtitulo } from './escapeHalloween/comunes';

/**
 *  ESCAPE ROOM DE HALLOWEEN — «La mansión del zombi»
 *  Juego cooperativo para toda la clase (sala live_games, tipoJuego ESCAPE_HALLOWEEN):
 *   · El profesor proyecta la mansión (anfitrión) y los alumnos entran con el móvil (?live=CODIGO).
 *   · Cada sala es una prueba: de una materia (con su tema) o propia del profe (texto + código buscado en el aula).
 *     En las de materia, los aciertos de todos llenan la barra de energía de la sala.
 *   · Los alumnos se disfrazan (avatar 3D) y se ven en la mansión 3D proyectada (escapeHalloween/Mansion3D).
 *   · Los escape rooms se guardan en resources (tipoJuego ESCAPE_HALLOWEEN) o en el navegador (escapeHalloween/EditorEscape).
 *   · Al llenarse aparece un candado cooperativo: las pistas se reparten entre los móviles
 *     y la clase tiene que hablar para juntarlas (un fallo resta 15 s al reloj).
 *   · Cada puerta abierta da un amuleto = una vida extra en la batalla final.
 *   · Batalla final: todos contra el zombi. Cada acierto le golpea; cada pocos segundos ataca
 *     y solo lo bloquea el escudo (un mínimo de golpes de la clase desde el último ataque).
 *   · Si se acaba el tiempo, el zombi despierta antes… y con un 50 % más de vida.
 */

const PENAL_CANDADO = 15; // segundos que resta un código incorrecto
const AVATARES = ['🧛', '🧙', '👻', '🎃', '🦇', '🕷️', '💀', '🧟', '🧌', '🐺'];

const claveDe = (nombre) => String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'jugador';
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// =====================================================================
//  ANFITRIÓN (proyector del profesor)
// =====================================================================
const leer3D = () => { try { return localStorage.getItem('pikt_escape_3d') !== '0'; } catch { return true; } };

function HostEscape({ config, usuario, onSalir }) {
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;
    const [sonido, setSonido] = useState(true);
    useEffect(() => { audio.silencio(!sonido); }, [sonido, audio]);
    useEffect(() => () => audio.cerrar(), [audio]);
    // Música de fondo (solo en la pantalla proyectada): suena con el botón 🔊. El navegador exige un clic antes de sonar.
    useEffect(() => {
        const f = () => audio.desbloquear();
        window.addEventListener('pointerdown', f);
        return () => window.removeEventListener('pointerdown', f);
    }, [audio]);
    const [usar3D, setUsar3D] = useState(leer3D);
    const cambiar3D = () => setUsar3D(v => { try { localStorage.setItem('pikt_escape_3d', v ? '0' : '1'); } catch { /* */ } return !v; });

    const [codigo, setCodigo] = useState('');
    const [sala, setSala] = useState(null);
    const [error, setError] = useState('');
    const [ahora, setAhora] = useState(Date.now());
    const [conexion, setConexion] = useState(true);
    const [feed, setFeed] = useState([]);
    const [zEstado, setZEstado] = useState('idle');
    const [numsGolpe, setNumsGolpe] = useState([]);
    const [flash, setFlash] = useState(null);
    const salaRef = useRef(null);
    salaRef.current = sala;
    const transRef = useRef('');
    const creada = useRef(false);
    const Z = ZOMBIS[config.zombi] || ZOMBIS.NORMAL;

    const refDoc = useMemo(() => (codigo ? doc(db, 'live_games', codigo) : null), [codigo]);
    const upd = useCallback((data) => { if (refDoc) updateDoc(refDoc, data).catch(e => console.warn('escape', e)); }, [refDoc]);

    // Crear la sala una sola vez
    useEffect(() => {
        if (creada.current) return;
        creada.current = true;
        let unsub = null, vivo = true;
        (async () => {
            try {
                const code = Math.random().toString(36).substring(2, 7).toUpperCase();
                await setDoc(doc(db, 'live_games', code), {
                    codigo: code, tipoJuego: TIPO_JUEGO, estado: 'esperando', fase: 'LOBBY',
                    titulo: 'Escape Room de Halloween', etapa: config.etapa, pruebas: config.pruebas.map(pruebaParaSala),
                    config: { ritmo: config.ritmo, zombi: config.zombi, minutos: config.minutos },
                    salaIdx: 0, objetivo: 0, progreso: {}, candado: null, candadoAbierto: null, pistasReveladas: 0,
                    tiempoFin: null, penalSeg: 0, tiempoAgotado: false, amuletos: [], batalla: null, ultimo: null,
                    jugadores: {}, hostNombre: usuario?.displayName || 'Profesor', hostId: usuario?.uid || null,
                    createdAt: serverTimestamp(),
                });
                setCodigo(code);
                const escuchar = () => {
                    unsub = onSnapshot(doc(db, 'live_games', code), s => { setConexion(true); if (s.exists()) setSala(s.data()); }, () => {
                        setConexion(false);
                        if (unsub) unsub();
                        setTimeout(() => { if (vivo) escuchar(); }, 2000);
                    });
                };
                escuchar();
            } catch (e) { setError('No se pudo crear la sala: ' + e.message); }
        })();
        return () => { vivo = false; if (unsub) unsub(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const jugadores = sala?.jugadores || {};
    const listaJug = Object.entries(jugadores).map(([k, j]) => ({ k, ...j }));
    const nJug = listaJug.length;
    const fase = sala?.fase || 'LOBBY';
    const pruebas = sala?.pruebas || [];
    const salaIdx = sala?.salaIdx ?? 0;
    const salaInfo = infoPrueba(pruebas[salaIdx], salaIdx, pruebas);
    const esUltima = sala ? salaIdx >= pruebas.length - 1 : false;
    const restante = sala?.tiempoFin ? sala.tiempoFin - (sala.penalSeg || 0) * 1000 - ahora : config.minutos * 60000;
    const progreso = sala?.progreso?.[`s${salaIdx}`] || 0;
    const infos3D = useMemo(() => pruebas.map((p, i) => infoPrueba(p, i, pruebas)), [pruebas]);

    // ---------- acciones ----------
    const iniciarSala = useCallback((i) => {
        const s = salaRef.current; if (!s) return;
        const prueba = s.pruebas[i];
        const n = Math.max(1, Object.keys(s.jugadores || {}).length);
        const datos = { salaIdx: i, candadoAbierto: null, pistasReveladas: 0, [`progreso.s${i}`]: 0 };
        if (!s.tiempoFin) datos.tiempoFin = Date.now() + config.minutos * 60000;
        if (!tienePreguntas(prueba)) {
            // Prueba propia sin preguntas: directamente al código
            transRef.current = `C${i}`;
            Object.assign(datos, { fase: 'CANDADO', objetivo: 0, candado: { ...candadoManual(prueba), reparto: barajar(Object.keys(s.jugadores || {})) } });
            audio.campana();
        } else {
            transRef.current = `R${i}`;
            Object.assign(datos, { fase: 'RETOS', objetivo: Math.max(5, n * config.ritmo), candado: null });
        }
        upd(datos);
    }, [config, upd, audio]);

    const iniciarBatalla = useCallback((agotado = false) => {
        const s = salaRef.current; if (!s) return;
        transRef.current = 'BATALLA';
        const n = Math.max(1, Object.keys(s.jugadores || {}).length);
        const hpMax = Math.round(Math.max(12, n * Z.golpesPorAlumno) * (agotado ? 1.5 : 1));
        const vidas = 3 + (s.amuletos || []).length;
        upd({
            fase: 'BATALLA', tiempoAgotado: !!agotado,
            batalla: {
                hpMax, golpes: 0, golpesBase: 0, vidas, vidasMax: vidas, ataques: 0, ultimoAtaque: null,
                escudo: Math.max(2, Math.ceil(n * Z.escudo)), proximoAtaque: Date.now() + Z.ataqueMs + 6000,
            },
        });
        audio.rugido();
    }, [Z, upd, audio]);

    const revancha = () => {
        const b = salaRef.current?.batalla; if (!b) return;
        transRef.current = 'BATALLA';
        upd({ fase: 'BATALLA', 'batalla.vidas': b.vidasMax, 'batalla.golpesBase': b.golpes, 'batalla.proximoAtaque': Date.now() + Z.ataqueMs + 5000 });
        audio.rugido();
    };

    const empezar = () => { audio.desbloquear(); audio.puertaCerrada(); upd({ estado: 'jugando', fase: 'INTRO' }); };
    const siguiente = () => { const s = salaRef.current; if (!s) return; if (s.salaIdx >= s.pruebas.length - 1) iniciarBatalla(false); else iniciarSala(s.salaIdx + 1); };
    const terminar = () => { if (window.confirm('¿Terminar la partida para todos?')) upd({ estado: 'fin', fase: 'TERMINADA' }); };

    // ---------- máquina de estados del anfitrión ----------
    useEffect(() => {
        if (!sala || !refDoc) return;
        const i = sala.salaIdx;
        const prueba = sala.pruebas?.[i];
        if (sala.fase === 'RETOS' && progreso >= sala.objetivo && sala.objetivo > 0 && transRef.current !== `C${i}`) {
            transRef.current = `C${i}`;
            const cand = candadoDePrueba(prueba, sala.etapa);
            upd({ fase: 'CANDADO', candado: { ...cand, reparto: barajar(Object.keys(sala.jugadores || {})) } });
            audio.campana();
        }
        if (sala.fase === 'CANDADO' && sala.candadoAbierto && transRef.current !== `A${i}`) {
            transRef.current = `A${i}`;
            upd({ fase: 'ABIERTA', amuletos: arrayUnion(prueba?.id || `p${i}`) });
            audio.puerta();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala]);

    // Reloj + bucle de batalla (con refs para no depender del render)
    useEffect(() => {
        if (!refDoc) return;
        const id = setInterval(() => {
            const t = Date.now();
            setAhora(prev => (Math.floor(prev / 1000) === Math.floor(t / 1000) ? prev : t));
            const s = salaRef.current; if (!s) return;
            if (['RETOS', 'CANDADO', 'ABIERTA'].includes(s.fase) && s.tiempoFin && s.tiempoFin - (s.penalSeg || 0) * 1000 - t <= 0 && transRef.current !== 'BATALLA') {
                iniciarBatalla(true);
                return;
            }
            if (s.fase !== 'BATALLA' || !s.batalla) return;
            const b = s.batalla;
            if (b.hpMax - b.golpes <= 0) {
                if (transRef.current !== 'FIN') { transRef.current = 'FIN'; upd({ fase: 'VICTORIA', estado: 'fin' }); }
                return;
            }
            if (t >= b.proximoAtaque && transRef.current !== `Z${b.ataques + 1}`) {
                transRef.current = `Z${b.ataques + 1}`;
                const bloqueado = b.golpes - (b.golpesBase || 0) >= b.escudo;
                const vidas = bloqueado ? b.vidas : b.vidas - 1;
                const datos = {
                    'batalla.ataques': b.ataques + 1, 'batalla.ultimoAtaque': { n: b.ataques + 1, bloqueado, ts: t },
                    'batalla.vidas': vidas, 'batalla.golpesBase': b.golpes, 'batalla.proximoAtaque': t + Z.ataqueMs,
                };
                if (vidas <= 0) datos.fase = 'DERROTA';
                upd(datos);
            }
        }, 500);
        return () => clearInterval(id);
    }, [refDoc, Z, upd, iniciarBatalla]);

    // Avance automático tras abrir una puerta
    useEffect(() => {
        if (fase !== 'ABIERTA') return;
        const id = setTimeout(() => { if (salaRef.current?.fase === 'ABIERTA') siguiente(); }, 9000);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, salaIdx]);

    const ultimoTs = sala?.ultimo?.ts;
    useEffect(() => {
        if (!sala?.ultimo) return;
        setFeed(f => [{ ...sala.ultimo, id: ultimoTs + Math.random() }, ...f].slice(0, 6));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ultimoTs]);

    const golpes = sala?.batalla?.golpes || 0;
    const golpesPrev = useRef(0);
    useEffect(() => {
        if (golpes > golpesPrev.current && fase === 'BATALLA') {
            const dmg = golpes - golpesPrev.current;
            audio.golpe();
            setZEstado('golpe');
            const id = Math.random();
            setNumsGolpe(n => [...n.slice(-6), { id, dmg, x: 20 + Math.random() * 60 }]);
            setTimeout(() => setNumsGolpe(n => n.filter(g => g.id !== id)), 1000);
            const t = setTimeout(() => setZEstado(e => (e === 'golpe' ? 'idle' : e)), 350);
            golpesPrev.current = golpes;
            return () => clearTimeout(t);
        }
        golpesPrev.current = golpes;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [golpes]);

    const ataqueN = sala?.batalla?.ultimoAtaque?.n || 0;
    useEffect(() => {
        if (!ataqueN) return;
        const bloqueado = sala.batalla.ultimoAtaque.bloqueado;
        setZEstado('ataque');
        setFlash(bloqueado ? 'azul' : 'rojo');
        if (bloqueado) audio.escudo(); else audio.rugido();
        const t1 = setTimeout(() => setZEstado('idle'), 900);
        const t2 = setTimeout(() => setFlash(null), 900);
        return () => { clearTimeout(t1); clearTimeout(t2); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ataqueN]);

    useEffect(() => {
        audio.musica(sonido && !['VICTORIA', 'TERMINADA'].includes(fase), fase === 'BATALLA' ? 'batalla' : 'suspense');
    }, [sonido, fase, audio]);

    // Narrador: una frase al entrar en cada fase, otra al fallar un código y otra cuando el zombi está a punto de caer
    const narrador = useNarrador(audio, sonido);
    const haySala = !!sala;
    useEffect(() => {
        if (!haySala) return;
        const id = idNarracionFase(fase, salaIdx, pruebas.length, sala?.tiempoAgotado);
        if (id) narrador.decir(id, fase === 'VICTORIA' ? 1600 : fase === 'INTRO' ? 900 : 350);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, salaIdx, haySala]);
    const penalPrev = useRef(0);
    useEffect(() => {
        const p = sala?.penalSeg || 0;
        if (p > penalPrev.current && fase === 'CANDADO') narrador.decir('candado_error');
        penalPrev.current = p;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala?.penalSeg]);
    const finalDicho = useRef(false);
    useEffect(() => {
        const bt = sala?.batalla;
        if (fase !== 'BATALLA' || !bt) { finalDicho.current = false; return; }
        const vida = bt.hpMax - bt.golpes;
        if (!finalDicho.current && vida > 0 && vida <= Math.max(2, Math.ceil(bt.hpMax * 0.15))) { finalDicho.current = true; narrador.decir('golpe_final'); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala?.batalla?.golpes, fase]);

    useEffect(() => {
        if (fase === 'VICTORIA') { setZEstado('muerto'); audio.victoria(); }
        if (fase === 'DERROTA') { setZEstado('victoria'); audio.derrota(); }
        if (fase === 'BATALLA') setZEstado('idle');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase]);

    if (error) return <PantallaSimple titulo="😱 ¡Vaya!" texto={error} onSalir={onSalir} />;
    if (!sala) return <PantallaSimple titulo="🕯️ Encendiendo las velas…" texto="Preparando la mansión embrujada." />;

    const enSalas = ['RETOS', 'CANDADO', 'ABIERTA'].includes(fase);
    const enPelea = ['BATALLA', 'VICTORIA', 'DERROTA'].includes(fase) && sala.batalla;
    const b = sala.batalla;
    const hp = b ? b.hpMax - b.golpes : 0;
    const cand = sala.candado;
    const url = urlSalaEnVivo(codigo);
    const qr = (tam) => `https://api.qrserver.com/v1/create-qr-code/?size=${tam}x${tam}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a0b2e&margin=8`;
    const abiertas = pruebas.map((p, i) => ((sala.amuletos || []).includes(p.id) ? i : -1)).filter(i => i >= 0);
    const codigoManual = (i) => String(config.pruebas.find(p => p.id === pruebas[i]?.id)?.codigo || '').split('|')[0].trim();

    const barraSup = (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', background: 'rgba(0,0,0,.35)' }}>
            <button className="eh-btn2" onClick={onSalir}>← Salir</button>
            <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>🎃 Sala <span style={{ color: '#ffb347', letterSpacing: 3 }}>{codigo}</span></div>
            <QRSalaBoton codigo={codigo} texto="QR" style={{ padding: '7px 12px' }} />
            <div style={{ fontWeight: 700, opacity: .85 }}>👥 {nJug}</div>
            {!conexion && <div className="eh-latido" style={{ fontWeight: 800, color: '#fca5a5' }}>⚠ Reconectando…</div>}
            <div style={{ flex: 1 }} />
            {sala.tiempoFin && enSalas && (
                <div style={{ fontWeight: 900, fontSize: '1.6rem', color: restante < 120000 ? '#ef4444' : '#ffde59', fontVariantNumeric: 'tabular-nums' }}
                    className={restante < 60000 ? 'eh-latido' : ''}>⏳ {mmss(restante)}</div>
            )}
            <button className="eh-btn2" onClick={cambiar3D} title="Mostrar u ocultar la mansión 3D">{usar3D ? '🏚️ 3D' : '🖼️ 2D'}</button>
            <button className="eh-btn2" onClick={() => setSonido(s => !s)} title={sonido ? 'Silenciar sonido y música' : 'Activar sonido y música'}>{sonido ? '🔊' : '🔇'}</button>
        </div>
    );

    const controles = (extra) => (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: 14 }}>
            {extra}
            {enSalas && <>
                <button className="eh-btn2" onClick={() => upd({ tiempoFin: (sala.tiempoFin || Date.now()) + 5 * 60000 })}>➕ 5 min</button>
                <button className="eh-btn2" onClick={siguiente}>⏭ {esUltima ? 'Saltar a la batalla' : 'Saltar sala'}</button>
            </>}
            {fase !== 'VICTORIA' && fase !== 'TERMINADA' && <button className="eh-btn2" onClick={terminar}>⏹ Terminar</button>}
        </div>
    );

    // ══════════ VISTA 3D: escena a la izquierda + panel lateral, todo en una pantalla ══════════
    if (usar3D && fase !== 'TERMINADA') {
        const pct = sala.objetivo ? Math.min(100, (progreso / sala.objetivo) * 100) : 0;
        const titulo = (t, color) => <h2 className="eh-titulo" style={{ fontSize: 'clamp(1.4rem,2.4vw,2.1rem)', color }}>{t}</h2>;
        const cabSala = (
            <div>
                <div style={{ fontWeight: 800, color: salaInfo.color, textTransform: 'uppercase', letterSpacing: 2, fontSize: '.78rem' }}>Sala {salaIdx + 1} de {pruebas.length} · {salaInfo.materia}</div>
                <div style={{ fontWeight: 900, fontSize: '1.35rem' }}>{salaInfo.emoji} {salaInfo.nombre}</div>
            </div>
        );
        const directo = (
            <div>
                <h3 style={{ margin: '4px 0 6px' }}>⚡ En directo</h3>
                {feed.length === 0 && <div style={{ opacity: .6 }}>Aún no hay aciertos…</div>}
                {feed.slice(0, 4).map(f => (
                    <div key={f.id} className="eh-aparece" style={{ padding: '5px 10px', marginBottom: 5, borderRadius: 10, background: f.candado ? 'rgba(239,68,68,.2)' : 'rgba(74,222,128,.15)' }}>
                        {f.candado ? `🔐 ${f.nombre}: código incorrecto (−${PENAL_CANDADO} s)` : `✔ ${f.nombre}`}
                    </div>
                ))}
            </div>
        );
        const botonesProfe = (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.1)' }}>
                {fase === 'CANDADO' && cand && <>
                    {cand.pistas.length > 0 && <button className="eh-btn2" disabled={sala.pistasReveladas >= cand.pistas.length} onClick={() => upd({ pistasReveladas: increment(1) })}>💡 Pista</button>}
                    <button className="eh-btn2" onClick={() => upd({ candadoAbierto: { nombre: 'El profe', ts: Date.now() } })}>🔓 Abrir</button>
                </>}
                {enSalas && <>
                    <button className="eh-btn2" onClick={() => upd({ tiempoFin: (sala.tiempoFin || Date.now()) + 5 * 60000 })}>➕ 5 min</button>
                    <button className="eh-btn2" onClick={siguiente}>⏭ {esUltima ? 'A la batalla' : 'Saltar sala'}</button>
                </>}
                {fase === 'VICTORIA' ? <button className="eh-btn2" onClick={onSalir}>← Salir</button> : <button className="eh-btn2" onClick={terminar}>⏹ Terminar</button>}
            </div>
        );

        let lateral = null, banda = null;
        if (fase === 'LOBBY') {
            lateral = <>
                {titulo('La mansión del zombi')}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ opacity: .85, fontSize: '.95rem' }}>Entrad en <b>{window.location.host}</b> o escanead:</div>
                    <div style={{ fontSize: '2.8rem', fontWeight: 900, letterSpacing: 8, color: '#ffb347', lineHeight: 1.1 }}>{codigo}</div>
                    <img alt="QR" src={qr(260)} style={{ width: 'min(230px, 100%)', aspectRatio: '1', borderRadius: 14, border: '4px solid #ff8c1a', marginTop: 6 }} />
                </div>
                <button className="eh-btn" disabled={nJug === 0} onClick={empezar} style={{ fontSize: '1.1rem' }}>🕯️ Entrar en la mansión</button>
                <div style={{ fontSize: '.82rem', opacity: .7 }}>{pruebas.length} pruebas · {ETAPAS.find(e => e.v === sala.etapa)?.l} · {config.minutos} min · {Z.l}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {listaJug.length === 0 && <div style={{ opacity: .6 }}>Esperando a los primeros valientes…</div>}
                    {listaJug.map(j => (
                        <span key={j.k} className="eh-aparece" style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(255,140,26,.18)', border: '1px solid rgba(255,140,26,.4)', fontWeight: 700, fontSize: '.9rem' }}>
                            {j.avatar?.disfraz ? disfrazDe(j.avatar.disfraz).emoji : AVATARES[hash(j.k) % AVATARES.length]} {j.nombre}
                        </span>
                    ))}
                </div>
            </>;
            banda = <div style={{ fontWeight: 800, fontSize: '1.15rem', textAlign: 'center' }}>👻 {nJug} {nJug === 1 ? 'valiente espera' : 'valientes esperan'} en el jardín de la mansión</div>;
        } else if (fase === 'INTRO') {
            lateral = <>
                {titulo('¡La puerta se ha cerrado!')}
                <p style={{ fontSize: '1.1rem', lineHeight: 1.5, margin: 0 }}>Es la noche de Halloween… <b>¡CLAC!</b> La puerta se ha cerrado a vuestra espalda y en el sótano un <b>zombi</b> está a punto de despertar.</p>
                <p style={{ lineHeight: 1.5, margin: 0, opacity: .9 }}>Superad las <b>{pruebas.length} pruebas</b> entre todos. Cada sala da un <b>amuleto</b> (una vida más para la batalla). Tenéis <b>{config.minutos} minutos</b>.</p>
                <MapaMansion pruebas={pruebas} salaIdx={-1} fase="INTRO" />
                <button className="eh-btn" style={{ fontSize: '1.15rem' }} onClick={() => iniciarSala(0)}>🚪 Abrir la primera puerta</button>
            </>;
        } else if (fase === 'RETOS') {
            const historia = pruebas[salaIdx]?.tipo === 'MANUAL' ? '' : salaInfo.historia;
            lateral = <>
                {cabSala}
                {historia && <p style={{ margin: 0, lineHeight: 1.45, opacity: .9 }}>{historia}</p>}
                <div style={{ fontWeight: 800 }}>📱 ¡Responded en los móviles para cargar la energía de la puerta!</div>
                {directo}
                <MapaMansion pruebas={pruebas} salaIdx={salaIdx} amuletos={sala.amuletos} fase={fase} />
            </>;
            banda = (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.25rem', marginBottom: 6 }}>
                        <span><span className="eh-vela">🕯️</span> Energía de la puerta</span><span>{progreso} / {sala.objetivo} · {Math.round(pct)} %</span>
                    </div>
                    <div className="eh-barra" style={{ height: 34, borderRadius: 17 }}><div style={{ width: `${pct}%` }} /></div>
                </div>
            );
        } else if (fase === 'CANDADO' && cand) {
            lateral = <>
                {cabSala}
                <div style={{ textAlign: 'center' }}><div className="eh-latido" style={{ fontSize: '2.6rem' }}>🔒</div><h2 style={{ margin: 0, color: '#ffde59' }}>{cand.titulo}</h2></div>
                <p style={{ fontSize: '1.15rem', lineHeight: 1.45, margin: 0, whiteSpace: 'pre-wrap' }}>{cand.instruccion}</p>
                {cand.imagen && <img src={cand.imagen} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12 }} />}
                <div style={{ fontWeight: 800, color: '#ffb347' }}>
                    {cand.compartidas ? '🔎 ¡Buscad el código! Escribidlo en cualquier móvil.' : `🗣️ ¡Hablad! Las pistas están repartidas en ${Math.min(cand.pistas.length, Math.max(1, cand.reparto?.length || nJug))} grupos de móviles.`}
                    {cand.longitud ? ` (${cand.longitud} ${cand.tipo === 'numero' ? 'cifras' : 'caracteres'})` : ''}
                </div>
                {cand.pistas.slice(0, sala.pistasReveladas || 0).map((p, i) => (
                    <div key={i} className="eh-aparece" style={{ padding: 10, borderRadius: 12, background: 'rgba(255,222,89,.12)', border: '1px solid rgba(255,222,89,.4)', display: 'flex', gap: 10, alignItems: 'center' }}>
                        💡 {p.texto} {p.img && <img src={p.img} alt="" style={{ height: 44, borderRadius: 6, background: '#fff' }} />}
                    </div>
                ))}
                {directo}
            </>;
            banda = <div style={{ fontWeight: 900, fontSize: '1.2rem', textAlign: 'center' }}>🔒 {cand.titulo} · cada código incorrecto resta {PENAL_CANDADO} s</div>;
        } else if (fase === 'ABIERTA') {
            lateral = <>
                {cabSala}
                <h2 style={{ fontSize: '2rem', margin: 0, color: '#4ade80' }}>¡Puerta abierta!</h2>
                {sala.candadoAbierto?.nombre && <p style={{ margin: 0, fontSize: '1.1rem' }}>🗝️ <b>{sala.candadoAbierto.nombre}</b> ha escrito el código: <b style={{ color: '#ffde59' }}>{cand?.manual ? codigoManual(salaIdx) : cand?.solucionVisible}</b></p>}
                <p style={{ margin: 0, fontSize: '1.1rem' }}>Amuleto: <span style={{ fontSize: '1.8rem' }}>{salaInfo.amuleto.emoji}</span> <b>{salaInfo.amuleto.nombre}</b> (+1 vida)</p>
                <button className="eh-btn" onClick={siguiente} style={{ fontSize: '1.1rem' }}>{esUltima ? '⚔️ ¡Al sótano a por el zombi!' : '🚪 Siguiente sala'}</button>
                <MapaMansion pruebas={pruebas} salaIdx={salaIdx} amuletos={sala.amuletos} fase={fase} />
            </>;
            banda = <div style={{ fontWeight: 900, fontSize: '1.25rem', textAlign: 'center', color: '#4ade80' }}>🚪 ¡Puerta abierta! {salaInfo.amuleto.emoji} {salaInfo.amuleto.nombre}</div>;
        } else if (enPelea) {
            const heroes = [...listaJug].sort((x, y) => ((y.golpes || 0) + (y.aciertos || 0)) - ((x.golpes || 0) + (x.aciertos || 0)));
            lateral = <>
                {fase === 'BATALLA' && titulo('¡Batalla final!')}
                {fase === 'VICTORIA' && titulo('¡Habéis escapado!', '#4ade80')}
                {fase === 'DERROTA' && titulo('¡El zombi os ha atrapado!', '#ef4444')}
                {sala.tiempoAgotado && fase === 'BATALLA' && <div style={{ color: '#fca5a5', fontWeight: 800 }}>⏰ Se acabó el tiempo: el zombi tiene un 50 % más de vida.</div>}
                {fase === 'BATALLA' && <div style={{ lineHeight: 1.45 }}>📱 Cada acierto es un golpe (¡doble en menos de 4 s!). Juntad <b>{b.escudo} golpes</b> antes de cada ataque para bloquearlo.</div>}
                {fase === 'DERROTA' && <>
                    <div>Pero está herido… ¡le quedan {hp} puntos de vida!</div>
                    <button className="eh-btn" onClick={revancha}>🔁 ¡Revancha!</button>
                </>}
                {fase === 'VICTORIA' && <div style={{ fontSize: '1.15rem' }}>El zombi ha caído. ¡Feliz Halloween! 🎃</div>}
                <h3 style={{ margin: '4px 0' }}>{fase === 'VICTORIA' ? '🏆 Héroes de la noche' : '⚔️ Golpes'}</h3>
                <div>
                    {heroes.map((j, i) => (
                        <div key={j.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                            <span>{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`} {j.avatar?.disfraz ? disfrazDe(j.avatar.disfraz).emoji : ''} {j.nombre}</span>
                            <span>✔ {j.aciertos || 0} · 💥 {j.golpes || 0}</span>
                        </div>
                    ))}
                </div>
            </>;
            banda = (
                <div>
                    <BarraVidaZombi hp={hp} hpMax={b.hpMax} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 10, flexWrap: 'wrap' }}>
                        <Corazones vidas={b.vidas} max={b.vidasMax} />
                        {fase === 'BATALLA' && <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>⏱️ Ataque en {Math.max(0, Math.ceil((b.proximoAtaque - ahora) / 1000))} s · 🛡️ <span style={{ color: b.golpes - (b.golpesBase || 0) >= b.escudo ? '#60a5fa' : '#fca5a5' }}>{Math.min(b.golpes - (b.golpesBase || 0), b.escudo)}/{b.escudo}</span></div>}
                    </div>
                </div>
            );
        }

        return (
            <div className="eh-root eh-3d" style={fase === 'VICTORIA' ? { background: 'radial-gradient(ellipse at 50% 0%, #5e3b1d 0%, #2e1a0b 50%, #0f0703 100%)' } : undefined}>
                <Ambiente ligero />
                {flash && <div className={flash === 'rojo' ? 'eh-flash-rojo' : 'eh-flash-azul'} />}
                {fase === 'VICTORIA' && <Confeti />}
                {barraSup}
                <Subtitulo texto={narrador.subtitulo} />
                <div className="eh-layout3d">
                    <div className="eh-escena3d">
                        <Mansion3D pruebas={infos3D} fase={fase} salaIdx={salaIdx} abiertas={abiertas} jugadores={jugadores}
                            batalla={b ? { golpes: b.golpes, ataqueN: b.ultimoAtaque?.n || 0, bloqueado: !!b.ultimoAtaque?.bloqueado } : null}
                            alto="100%" />
                        {banda && <div className="eh-banda">{banda}</div>}
                        {enPelea && numsGolpe.map(g => <div key={g.id} className="eh-golpe-num" style={{ left: `${g.x}%`, top: '35%', zIndex: 3 }}>−{g.dmg}</div>)}
                    </div>
                    <div className="eh-panel eh-lateral">
                        {lateral}
                        {fase !== 'LOBBY' && botonesProfe}
                    </div>
                </div>
            </div>
        );
    }

    // ── contenido por fase ──
    let contenido = null, extraControles = null;
    const contenedor = { position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '14px 18px' };

    if (fase === 'LOBBY') {
        contenido = (
            <div style={{ ...contenedor, display: 'grid', gridTemplateColumns: usar3D ? '1fr' : 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
                {!usar3D && (
                    <div className="eh-panel" style={{ padding: 24, textAlign: 'center' }}>
                        <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)' }}>La mansión del zombi</h1>
                        <p style={{ opacity: .85 }}>Escanead el QR o entrad en <b>{window.location.host}</b> con el código:</p>
                        <div style={{ fontSize: '3.2rem', fontWeight: 900, letterSpacing: 10, color: '#ffb347' }}>{codigo}</div>
                        <img alt="QR" src={qr(260)} style={{ width: 220, height: 220, borderRadius: 16, marginTop: 8, border: '4px solid #ff8c1a' }} />
                        <div style={{ marginTop: 16 }}><button className="eh-btn" disabled={nJug === 0} onClick={empezar} style={{ fontSize: '1.2rem', padding: '14px 30px' }}>🕯️ Entrar en la mansión</button></div>
                    </div>
                )}
                <div className="eh-panel" style={{ padding: 18 }}>
                    <h3 style={{ margin: '0 0 6px' }}>👻 Valientes en la puerta ({nJug}) <span style={{ fontWeight: 500, fontSize: '.85rem', opacity: .7 }}>· {pruebas.length} pruebas · {ETAPAS.find(e => e.v === sala.etapa)?.l} · {config.minutos} min · {Z.l}</span></h3>
                    <MapaMansion pruebas={pruebas} salaIdx={-1} fase="LOBBY" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                        {listaJug.length === 0 && <div style={{ opacity: .6 }}>Esperando a los primeros valientes… (cada uno elige su disfraz en el móvil)</div>}
                        {listaJug.map(j => (
                            <span key={j.k} className="eh-aparece" style={{ padding: '6px 12px', borderRadius: 20, background: 'rgba(255,140,26,.18)', border: '1px solid rgba(255,140,26,.4)', fontWeight: 700 }}>
                                {j.avatar?.disfraz ? disfrazDe(j.avatar.disfraz).emoji : AVATARES[hash(j.k) % AVATARES.length]} {j.nombre}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    } else if (fase === 'INTRO') {
        contenido = (
            <div className="eh-panel eh-aparece" style={{ maxWidth: 820, margin: '18px auto', padding: 26, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                {!usar3D && <div className="eh-flota" style={{ fontSize: '4rem' }}>🏚️</div>}
                <h1 className="eh-titulo" style={{ fontSize: 'clamp(1.8rem,4.5vw,3rem)' }}>¡La puerta se ha cerrado!</h1>
                <p style={{ fontSize: '1.2rem', lineHeight: 1.55 }}>
                    Es la noche de Halloween y habéis entrado en la vieja mansión… <b>¡CLAC!</b> La puerta se ha cerrado a vuestra espalda.
                    En el sótano, un <b>zombi</b> está a punto de despertar.
                </p>
                <p style={{ fontSize: '1.1rem', lineHeight: 1.55, opacity: .9 }}>
                    Superad las <b>{pruebas.length} pruebas</b> y abrid cada candado <b>entre todos</b>. Cada sala os dará un <b>amuleto</b> (una vida más para la batalla final).
                    Tenéis <b>{config.minutos} minutos</b>… si se acaba el tiempo, el zombi despertará antes y más fuerte.
                </p>
                <MapaMansion pruebas={pruebas} salaIdx={-1} fase="INTRO" />
                <button className="eh-btn" style={{ marginTop: 20, fontSize: '1.2rem', padding: '14px 30px' }} onClick={() => iniciarSala(0)}>🚪 Abrir la primera puerta</button>
            </div>
        );
    } else if (enSalas) {
        const pct = sala.objetivo ? Math.min(100, (progreso / sala.objetivo) * 100) : 0;
        const top = [...listaJug].sort((x, y) => (y.aciertos || 0) - (x.aciertos || 0)).slice(0, 5);
        const historia = pruebas[salaIdx]?.tipo === 'MANUAL' ? '' : salaInfo.historia;
        contenido = (
            <div style={contenedor}>
                <MapaMansion pruebas={pruebas} salaIdx={salaIdx} amuletos={sala.amuletos} fase={fase} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18, marginTop: 14 }}>
                    <div className="eh-panel" style={{ padding: 22, borderColor: salaInfo.color + '99', gridColumn: 'span 2', minWidth: 0 }}>
                        {!usar3D && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div className="eh-flota" style={{ fontSize: '3.2rem' }}>{salaInfo.emoji}</div>
                                <div>
                                    <div style={{ fontWeight: 800, color: salaInfo.color, textTransform: 'uppercase', letterSpacing: 2, fontSize: '.85rem' }}>Sala {salaIdx + 1} de {pruebas.length} · {salaInfo.materia}</div>
                                    <h2 className="eh-titulo" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.5rem)' }}>{salaInfo.nombre}</h2>
                                </div>
                            </div>
                        )}
                        {fase === 'RETOS' && <>
                            {historia && <p style={{ fontSize: '1.12rem', lineHeight: 1.5, opacity: .9, marginTop: 0 }}>{historia}</p>}
                            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>📱 ¡Responded en vuestros móviles para cargar la energía de la puerta!</p>
                            <div className="eh-barra" style={{ height: 36, borderRadius: 18 }}><div style={{ width: `${pct}%` }} /></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontWeight: 800, fontSize: '1.2rem' }}>
                                <span><span className="eh-vela">🕯️</span> {progreso} / {sala.objetivo} aciertos</span><span>{Math.round(pct)} %</span>
                            </div>
                        </>}
                        {fase === 'CANDADO' && cand && (
                            <div className="eh-aparece" style={{ textAlign: 'center' }}>
                                <div className="eh-latido" style={{ fontSize: '3.4rem' }}>🔒</div>
                                <h2 style={{ margin: '4px 0', fontSize: '1.9rem', color: '#ffde59' }}>{cand.titulo}</h2>
                                <p style={{ fontSize: '1.25rem', lineHeight: 1.5, maxWidth: 760, margin: '0 auto', whiteSpace: 'pre-wrap' }}>{cand.instruccion}</p>
                                {cand.imagen && <img src={cand.imagen} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 12, marginTop: 12 }} />}
                                {cand.compartidas
                                    ? <p style={{ fontWeight: 800, color: '#ffb347', fontSize: '1.15rem' }}>🔎 ¡Buscad el código! Cuando lo tengáis, escribidlo en cualquier móvil.{cand.longitud ? ` (${cand.longitud} ${cand.tipo === 'numero' ? 'cifras' : 'caracteres'})` : ''}</p>
                                    : <p style={{ fontWeight: 800, color: '#ffb347', fontSize: '1.15rem' }}>
                                        🗣️ ¡Hablad entre vosotros! Las pistas están repartidas en {Math.min(cand.pistas.length, Math.max(1, cand.reparto?.length || nJug))} grupos de móviles.
                                        {cand.longitud ? ` · Respuesta de ${cand.longitud} ${cand.tipo === 'numero' ? 'cifras' : 'letras'}.` : ''}
                                    </p>}
                                <p style={{ opacity: .75 }}>Cada código incorrecto resta {PENAL_CANDADO} s al reloj.</p>
                                {sala.pistasReveladas > 0 && (
                                    <div style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
                                        {cand.pistas.slice(0, sala.pistasReveladas).map((p, i) => (
                                            <div key={i} className="eh-aparece" style={{ padding: 12, borderRadius: 12, background: 'rgba(255,222,89,.12)', border: '1px solid rgba(255,222,89,.4)', fontSize: '1.1rem', display: 'flex', gap: 12, alignItems: 'center' }}>
                                                💡 {p.texto} {p.img && <img src={p.img} alt="" style={{ height: 50, borderRadius: 6, background: '#fff' }} />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {fase === 'ABIERTA' && (
                            <div className="eh-aparece" style={{ textAlign: 'center', padding: '6px 0' }}>
                                {!usar3D && (
                                    <div style={{ display: 'inline-block', width: 110, height: 150, borderRadius: '55px 55px 6px 6px', position: 'relative', boxShadow: '0 0 40px rgba(255,200,100,.6)' }}>
                                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(#fff6c8,#ffb347)', borderRadius: '55px 55px 6px 6px' }} />
                                        <div className="eh-puerta" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#4a2c12,#6b4220)', borderRadius: '55px 55px 6px 6px', border: '3px solid #2a1606' }} />
                                    </div>
                                )}
                                <h2 style={{ fontSize: '2.1rem', margin: '10px 0 4px', color: '#4ade80' }}>¡Puerta abierta!</h2>
                                <p style={{ fontSize: '1.2rem' }}>
                                    {sala.candadoAbierto?.nombre && <>🗝️ <b>{sala.candadoAbierto.nombre}</b> ha escrito el código: <b style={{ color: '#ffde59' }}>{cand?.manual ? codigoManual(salaIdx) : cand?.solucionVisible}</b><br /></>}
                                    Amuleto conseguido: <span style={{ fontSize: '2rem' }}>{salaInfo.amuleto.emoji}</span> <b>{salaInfo.amuleto.nombre}</b> (+1 vida en la batalla)
                                </p>
                                <button className="eh-btn" onClick={siguiente} style={{ fontSize: '1.15rem' }}>{esUltima ? '⚔️ ¡Bajar al sótano a por el zombi!' : '🚪 Siguiente sala'}</button>
                            </div>
                        )}
                    </div>
                    <div className="eh-panel" style={{ padding: 18 }}>
                        <h3 style={{ margin: '0 0 10px' }}>⚡ En directo</h3>
                        {feed.length === 0 && <div style={{ opacity: .6 }}>Aún no hay aciertos…</div>}
                        {feed.map(f => (
                            <div key={f.id} className="eh-aparece" style={{ padding: '6px 10px', marginBottom: 6, borderRadius: 10, background: f.candado ? 'rgba(239,68,68,.2)' : 'rgba(74,222,128,.15)' }}>
                                {f.candado ? `🔐 ${f.nombre} probó un código… ¡incorrecto! −${PENAL_CANDADO} s` : `✔ ${f.nombre}`}
                            </div>
                        ))}
                        <h3 style={{ margin: '16px 0 8px' }}>🏅 Más valientes</h3>
                        {top.map((j, i) => (
                            <div key={j.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                                <span>{['🥇', '🥈', '🥉', '4.', '5.'][i]} {j.nombre}</span><b>{j.aciertos || 0}</b>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
        if (fase === 'CANDADO' && cand) extraControles = <>
            {cand.pistas.length > 0 && <button className="eh-btn2" disabled={sala.pistasReveladas >= cand.pistas.length} onClick={() => upd({ pistasReveladas: increment(1) })}>💡 Mostrar una pista en pantalla</button>}
            <button className="eh-btn2" onClick={() => upd({ candadoAbierto: { nombre: 'El profe', ts: Date.now() } })}>🔓 Abrir el candado</button>
        </>;
    } else if (enPelea) {
        const heroes = [...listaJug].sort((x, y) => ((y.golpes || 0) + (y.aciertos || 0)) - ((x.golpes || 0) + (x.aciertos || 0)));
        contenido = (
            <div style={{ ...contenedor, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18, alignItems: 'start' }}>
                <div className="eh-panel" style={{ padding: 20, textAlign: 'center', gridColumn: 'span 2', minWidth: 0 }}>
                    {fase === 'BATALLA' && <h1 className="eh-titulo" style={{ fontSize: 'clamp(1.7rem,4vw,2.8rem)' }}>¡Batalla final contra el zombi!</h1>}
                    {fase === 'VICTORIA' && <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,5vw,3.4rem)', color: '#4ade80' }}>¡Habéis escapado!</h1>}
                    {fase === 'DERROTA' && <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', color: '#ef4444' }}>¡El zombi os ha atrapado!</h1>}
                    {sala.tiempoAgotado && fase === 'BATALLA' && <p style={{ color: '#fca5a5', fontWeight: 800 }}>⏰ Se acabó el tiempo: el zombi ha despertado con un 50 % más de vida.</p>}
                    {!usar3D && <>
                        <div style={{ position: 'relative', display: 'inline-block', margin: '6px 0' }}>
                            <Zombi estado={zEstado} size={Math.min(280, window.innerWidth * 0.5)} />
                            {numsGolpe.map(g => <div key={g.id} className="eh-golpe-num" style={{ left: `${g.x}%`, top: '20%' }}>−{g.dmg}</div>)}
                        </div>
                        <div style={{ maxWidth: 560, margin: '0 auto' }}><BarraVidaZombi hp={hp} hpMax={b.hpMax} /></div>
                    </>}
                    {fase === 'BATALLA' && (
                        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: '1.15rem', fontWeight: 800 }}>
                            <div>⏱️ El zombi ataca en <span style={{ color: '#ffde59' }}>{Math.max(0, Math.ceil((b.proximoAtaque - ahora) / 1000))} s</span></div>
                            <div>🛡️ Escudo: <span style={{ color: b.golpes - (b.golpesBase || 0) >= b.escudo ? '#60a5fa' : '#fca5a5' }}>{Math.min(b.golpes - (b.golpesBase || 0), b.escudo)} / {b.escudo}</span> golpes</div>
                        </div>
                    )}
                    {fase === 'BATALLA' && <p style={{ opacity: .8, margin: '8px 0 0' }}>📱 Cada acierto es un golpe (¡doble si respondes en menos de 4 s!). Juntad {b.escudo} golpes antes de cada ataque para bloquearlo.</p>}
                    {fase === 'DERROTA' && (
                        <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: '1.1rem' }}>Pero el zombi está herido… ¡le quedan {hp} puntos de vida!</p>
                            <button className="eh-btn" onClick={revancha} style={{ fontSize: '1.15rem' }}>🔁 ¡Revancha! (el zombi conserva sus heridas)</button>
                        </div>
                    )}
                    {fase === 'VICTORIA' && <p style={{ fontSize: '1.25rem' }}>El zombi ha caído y la puerta de la mansión se abre. ¡Feliz Halloween! 🎃</p>}
                </div>
                <div className="eh-panel" style={{ padding: 18 }}>
                    {!usar3D && <><h3 style={{ margin: '0 0 8px', textAlign: 'center' }}>Vidas de la clase</h3><Corazones vidas={b.vidas} max={b.vidasMax} /></>}
                    <div style={{ textAlign: 'center', marginTop: 6, fontSize: '1.4rem' }}>{pruebas.map((p, i) => ((sala.amuletos || []).includes(p.id) ? infoPrueba(p, i, pruebas).amuleto.emoji : null)).filter(Boolean).join(' ')}</div>
                    <h3 style={{ margin: '12px 0 8px' }}>{fase === 'VICTORIA' ? '🏆 Héroes de la noche' : '⚔️ Golpes'}</h3>
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {heroes.map((j, i) => (
                            <div key={j.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                                <span>{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`} {j.avatar?.disfraz ? disfrazDe(j.avatar.disfraz).emoji : ''} {j.nombre}</span>
                                <span>✔ {j.aciertos || 0} · 💥 {j.golpes || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    } else {
        contenido = (
            <div className="eh-panel" style={{ maxWidth: 440, margin: '60px auto', padding: 26, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <h2 style={{ marginTop: 0 }}>🎃 Partida terminada</h2>
                <p>¡Gracias por jugar al escape room de Halloween!</p>
                <button className="eh-btn" onClick={onSalir}>Salir</button>
            </div>
        );
    }

    return (
        <div className="eh-root" style={fase === 'VICTORIA' ? { background: 'radial-gradient(ellipse at 50% 0%, #5e3b1d 0%, #2e1a0b 50%, #0f0703 100%)' } : undefined}>
            <Ambiente murcielagos={fase === 'BATALLA' ? 8 : 5} />
            {flash && <div className={flash === 'rojo' ? 'eh-flash-rojo' : 'eh-flash-azul'} />}
            {fase === 'VICTORIA' && <Confeti />}
            {barraSup}
            <Subtitulo texto={narrador.subtitulo} />
            {contenido}
            {fase === 'VICTORIA'
                ? <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: 14 }}><button className="eh-btn2" onClick={onSalir}>← Salir</button></div>
                : fase !== 'LOBBY' && fase !== 'TERMINADA' && controles(extraControles)}
        </div>
    );
}

// =====================================================================
//  ALUMNO (móvil)
// =====================================================================
function ClienteEscape({ codigo, nombre, avatarInicial, onSalir }) {
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;
    const [sonido, setSonido] = useState(true);
    useEffect(() => { audio.activo = sonido; }, [sonido, audio]);
    useEffect(() => () => audio.cerrar(), [audio]);

    const clave = claveDe(nombre);
    const refSala = useMemo(() => doc(db, 'live_games', String(codigo).toUpperCase()), [codigo]);
    const [sala, setSala] = useState(null);
    const [error, setError] = useState('');
    const [pregunta, setPregunta] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [t0, setT0] = useState(Date.now());
    const [codigoTxt, setCodigoTxt] = useState('');
    const [esperaCandado, setEsperaCandado] = useState(0);
    const [msgCandado, setMsgCandado] = useState('');
    const [flash, setFlash] = useState(null);
    const [ahora, setAhora] = useState(Date.now());
    const [critico, setCritico] = useState(false);
    const [avatar, setAvatar] = useState(avatarInicial || leerAvatarGuardado() || avatarAleatorio());
    const [editandoDisfraz, setEditandoDisfraz] = useState(false);
    const stats = useRef({ aciertos: 0, fallos: 0, golpes: 0 });
    const registrado = useRef(false);
    const salaRef = useRef(null);
    salaRef.current = sala;
    const siguienteRef = useRef(null);      // temporizador de «siguiente pregunta» (se cancela al cambiar de fase)
    const cancelarSiguiente = () => { if (siguienteRef.current) { clearTimeout(siguienteRef.current); siguienteRef.current = null; } };
    useEffect(() => cancelarSiguiente, []);

    useEffect(() => {
        let unsub = null, vivo = true;
        (async () => {
            try {
                const snap = await getDoc(refSala);
                if (!snap.exists()) { setError('La sala no existe o ya se ha cerrado.'); return; }
                const prev = snap.data().jugadores?.[clave];
                if (prev) stats.current = { aciertos: prev.aciertos || 0, fallos: prev.fallos || 0, golpes: prev.golpes || 0 };
                await updateDoc(refSala, { [`jugadores.${clave}.nombre`]: nombre, [`jugadores.${clave}.ts`]: Date.now(), [`jugadores.${clave}.avatar`]: avatar });
                if (!vivo) return;
                unsub = onSnapshot(refSala, s => {
                    if (!s.exists()) { setError('La sala se ha cerrado.'); return; }
                    setSala(s.data());
                }, e => setError('Se ha perdido la conexión con la sala (' + e.code + '). Vuelve a entrar con el mismo nombre.'));
            } catch (e) { setError('Error al entrar: ' + e.message); }
        })();
        return () => { vivo = false; if (unsub) unsub(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigo]);

    const cambiarAvatar = (a) => { setAvatar(a); updateDoc(refSala, { [`jugadores.${clave}.avatar`]: a }).catch(() => { }); };

    useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(id); }, []);

    const fase = sala?.fase || 'LOBBY';
    const salaIdx = sala?.salaIdx ?? 0;
    const pruebas = sala?.pruebas || [];
    const salaInfo = infoPrueba(pruebas[salaIdx], salaIdx, pruebas);

    const nuevaPregunta = useCallback(() => {
        const s = salaRef.current; if (!s) return;
        const lista = s.pruebas || [];
        let prueba = lista[s.salaIdx];
        if (s.fase === 'BATALLA') {
            const conPreguntas = lista.filter(p => tienePreguntas(p));
            prueba = conPreguntas.length ? pick(conPreguntas) : { tipo: 'MATERIA', materia: pick(ORDEN_SALAS), tema: 'MIX' };
        }
        setPregunta(preguntaDePrueba(prueba, s.etapa));
        setT0(Date.now());
    }, []);

    useEffect(() => {
        cancelarSiguiente();
        setFeedback(null); setCritico(false);
        if (fase === 'RETOS' || fase === 'BATALLA') nuevaPregunta();
        else setPregunta(null);
        if (fase === 'CANDADO') { setCodigoTxt(''); setMsgCandado(''); }
        if (fase !== 'LOBBY' && fase !== 'INTRO') setEditandoDisfraz(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, salaIdx]);

    const ataque = sala?.batalla?.ultimoAtaque;
    useEffect(() => {
        if (!ataque?.n) return;
        setFlash(ataque.bloqueado ? 'azul' : 'rojo');
        if (!ataque.bloqueado) { try { navigator.vibrate?.([200, 80, 200]); } catch { } audio.rugido(); } else audio.escudo();
        const t = setTimeout(() => setFlash(null), 900);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ataque?.n]);

    useEffect(() => {
        if (registrado.current) return;
        if (fase === 'VICTORIA' || fase === 'TERMINADA') {
            registrado.current = true;
            const { aciertos, fallos } = stats.current;
            guardarRegistroLocal(TIPO_JUEGO, {
                titulo: fase === 'VICTORIA' ? 'Escape Room de Halloween · ¡Escapamos!' : 'Escape Room de Halloween',
                aciertos, intentos: aciertos + fallos, nombre, via: 'online',
            });
        }
    }, [fase, nombre]);

    const responder = (i) => {
        if (!pregunta || feedback) return;
        audio.desbloquear();
        const ok = i === pregunta.correcta;
        setFeedback({ ok, elegida: i });
        if (ok) {
            audio.acierto();
            stats.current.aciertos++;
            const base = { [`jugadores.${clave}.aciertos`]: increment(1), [`jugadores.${clave}.fallos`]: stats.current.fallos, ultimo: { nombre, ts: Date.now() } };
            if (fase === 'RETOS') {
                updateDoc(refSala, { ...base, [`progreso.s${salaIdx}`]: increment(1) }).catch(() => { });
            } else if (fase === 'BATALLA') {
                const dmg = Date.now() - t0 < 4000 ? 2 : 1;
                stats.current.golpes += dmg;
                setCritico(dmg === 2);
                updateDoc(refSala, { ...base, 'batalla.golpes': increment(dmg), [`jugadores.${clave}.golpes`]: increment(dmg) }).catch(() => { });
            }
        } else {
            audio.fallo();
            stats.current.fallos++;
        }
        cancelarSiguiente();
        const faseRespuesta = fase, salaRespuesta = salaIdx;
        siguienteRef.current = setTimeout(() => {
            siguienteRef.current = null;
            const s = salaRef.current;
            // Si mientras tanto ha cambiado la sala o la fase, el efecto de fase ya ha puesto la pregunta nueva
            if (!s || s.fase !== faseRespuesta || s.salaIdx !== salaRespuesta) return;
            setFeedback(null); setCritico(false); nuevaPregunta();
        }, ok ? 650 : 1900);
    };

    const intentarCandado = () => {
        if (!sala?.candado || ahora < esperaCandado || !codigoTxt.trim()) return;
        audio.desbloquear();
        if (compruebaCandado(sala.candado, codigoTxt)) {
            audio.puerta();
            updateDoc(refSala, { candadoAbierto: { nombre, ts: Date.now() } }).catch(() => { });
        } else {
            audio.fallo();
            try { navigator.vibrate?.(300); } catch { }
            setMsgCandado(`❌ ¡Código incorrecto! El reloj pierde ${PENAL_CANDADO} s. Espera un momento antes de volver a probar.`);
            setEsperaCandado(Date.now() + 8000);
            updateDoc(refSala, { penalSeg: increment(PENAL_CANDADO), ultimo: { nombre, ts: Date.now(), candado: true } }).catch(() => { });
        }
    };

    if (error) return <PantallaSimple titulo="😱 ¡Vaya!" texto={error} onSalir={onSalir} />;
    if (!sala) return <PantallaSimple titulo="🕯️ Entrando en la mansión…" texto="Conectando con la sala." />;

    const restante = sala.tiempoFin ? sala.tiempoFin - (sala.penalSeg || 0) * 1000 - ahora : null;
    const cabecera = (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(0,0,0,.35)' }}>
            <button className="eh-btn2" style={{ padding: '6px 10px' }} onClick={onSalir}>←</button>
            <div style={{ fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{disfrazDe(avatar?.disfraz).emoji} {nombre}</div>
            {restante != null && ['RETOS', 'CANDADO', 'ABIERTA'].includes(fase) && (
                <div style={{ fontWeight: 900, color: restante < 120000 ? '#ef4444' : '#ffde59', fontVariantNumeric: 'tabular-nums' }}>⏳ {mmss(restante)}</div>
            )}
            <button className="eh-btn2" style={{ padding: '6px 10px' }} onClick={() => setSonido(s => !s)}>{sonido ? '🔊' : '🔇'}</button>
        </div>
    );
    const envoltorio = (contenido, extra = null) => (
        <div className="eh-root"><Ambiente murcielagos={3} />
            {flash && <div className={flash === 'rojo' ? 'eh-flash-rojo' : 'eh-flash-azul'} />}
            {extra}
            {cabecera}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: 14 }}>{contenido}</div>
        </div>
    );

    if (fase === 'LOBBY' || fase === 'INTRO') {
        if (editandoDisfraz) return envoltorio(<EditorDisfraz avatar={avatar} nombre={nombre} onChange={cambiarAvatar} onListo={() => setEditandoDisfraz(false)} textoListo="✔ Listo" />);
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 22, textAlign: 'center' }}>
                <AvatarPreview3D avatar={avatar} size={170} />
                <h2 className="eh-titulo" style={{ fontSize: '1.9rem' }}>{fase === 'LOBBY' ? '¡Estás dentro!' : '¡La puerta se ha cerrado!'}</h2>
                <p style={{ lineHeight: 1.5 }}>{fase === 'LOBBY'
                    ? 'Mira la pantalla grande: tu personaje ya está en el jardín de la mansión. Espera a que el profe abra la puerta…'
                    : 'Mirad la pantalla grande. En cuanto se abra la primera sala, aquí te aparecerán los retos.'}</p>
                <button className="eh-btn2" onClick={() => setEditandoDisfraz(true)}>🎭 Cambiar disfraz</button>
                <div style={{ marginTop: 14 }}><MapaMansion pruebas={pruebas} salaIdx={-1} fase={fase} /></div>
            </div>
        );
    }

    if (fase === 'RETOS') {
        const prog = sala.progreso?.[`s${salaIdx}`] || 0;
        return envoltorio(<>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: salaInfo.color, fontSize: '.8rem', letterSpacing: 2, textTransform: 'uppercase' }}>Sala {salaIdx + 1} · {salaInfo.materia}</div>
                <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{salaInfo.emoji} {salaInfo.nombre}</div>
                <div className="eh-barra" style={{ height: 14, marginTop: 8 }}><div style={{ width: `${Math.min(100, (prog / Math.max(1, sala.objetivo)) * 100)}%` }} /></div>
            </div>
            <TarjetaPregunta pregunta={pregunta} feedback={feedback} onResponder={responder} color={salaInfo.color} />
            {feedback && !feedback.ok && <div className="eh-aparece" style={{ textAlign: 'center', marginTop: 12, fontWeight: 800, fontSize: '1.1rem' }}>👻 ¡Buuu! El fantasma te ha asustado…</div>}
            <div style={{ textAlign: 'center', marginTop: 12, opacity: .7, fontSize: '.85rem' }}>Tus aciertos: {stats.current.aciertos}</div>
        </>);
    }

    if (fase === 'CANDADO' && sala.candado) {
        const cand = sala.candado;
        let mias;
        if (cand.compartidas) mias = cand.pistas || [];
        else {
            const reparto = cand.reparto || [];
            let idx = reparto.indexOf(clave);
            const n = Math.max(1, reparto.length);
            if (idx < 0) idx = hash(clave) % n;
            mias = pistasDeJugador(cand.pistas, idx, n);
        }
        const espera = Math.max(0, Math.ceil((esperaCandado - ahora) / 1000));
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 20 }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="eh-latido" style={{ fontSize: '3rem' }}>🔒</div>
                    <h2 style={{ margin: '4px 0', color: '#ffde59' }}>{cand.titulo}</h2>
                    <p style={{ margin: '0 0 12px', opacity: .95, whiteSpace: 'pre-wrap', fontSize: cand.compartidas ? '1.1rem' : '1rem' }}>{cand.instruccion}</p>
                    {cand.imagen && <img src={cand.imagen} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginBottom: 10 }} />}
                </div>
                {mias.length > 0 && <div style={{ fontWeight: 800, marginBottom: 6 }}>{cand.compartidas ? '💡 Pista:' : `🤫 Tu${mias.length > 1 ? 's' : ''} pista${mias.length > 1 ? 's' : ''} secreta${mias.length > 1 ? 's' : ''}:`}</div>}
                {mias.map((p, i) => (
                    <div key={i} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,222,89,.12)', border: '2px dashed rgba(255,222,89,.55)', marginBottom: 8, fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}>
                        {p.texto}
                        {p.img && <div><img src={p.img} alt="" style={{ maxWidth: '100%', maxHeight: 130, marginTop: 8, borderRadius: 8, background: '#fff' }} /></div>}
                    </div>
                ))}
                <p style={{ textAlign: 'center', fontWeight: 800, color: '#ffb347' }}>{cand.compartidas ? '🔎 ¡Buscad el código por el aula!' : '🗣️ ¡Busca a los compañeros que tienen las otras pistas!'}</p>
                <input className="eh-input" value={codigoTxt} placeholder={cand.tipo === 'numero' ? '• • • •' : 'Escribe la respuesta'}
                    inputMode={cand.tipo === 'numero' ? 'numeric' : 'text'} maxLength={60}
                    onChange={e => setCodigoTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') intentarCandado(); }} />
                <button className="eh-btn" style={{ width: '100%', marginTop: 10 }} disabled={espera > 0 || !codigoTxt.trim()} onClick={intentarCandado}>
                    {espera > 0 ? `⏳ Espera ${espera} s` : '🗝️ Probar el código'}
                </button>
                {msgCandado && <div style={{ marginTop: 10, color: '#fca5a5', fontWeight: 700, textAlign: 'center' }}>{msgCandado}</div>}
            </div>
        );
    }

    if (fase === 'ABIERTA') {
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 24, textAlign: 'center' }}>
                <div className="eh-flota" style={{ fontSize: '4rem' }}>{salaInfo.amuleto.emoji}</div>
                <h2 style={{ color: '#4ade80', margin: '6px 0' }}>¡Puerta abierta!</h2>
                <p>{sala.candadoAbierto?.nombre ? <><b>{sala.candadoAbierto.nombre}</b> ha abierto el candado.</> : null}<br />
                    Amuleto: <b>{salaInfo.amuleto.nombre}</b> (+1 vida contra el zombi)</p>
                <p style={{ opacity: .75 }}>Preparaos para la siguiente sala…</p>
            </div>
        );
    }

    if (['BATALLA', 'VICTORIA', 'DERROTA'].includes(fase) && sala.batalla) {
        const b = sala.batalla;
        const hp = b.hpMax - b.golpes;
        if (fase === 'BATALLA') {
            return envoltorio(<>
                <div className="eh-panel" style={{ padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flexShrink: 0 }}><Zombi estado={feedback?.ok ? 'golpe' : 'idle'} size={70} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <BarraVidaZombi hp={hp} hpMax={b.hpMax} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.85rem', fontWeight: 700 }}>
                                <span>❤️ {b.vidas}/{b.vidasMax}</span>
                                <span>⏱️ ataque en {Math.max(0, Math.ceil((b.proximoAtaque - ahora) / 1000))} s</span>
                            </div>
                        </div>
                    </div>
                </div>
                <TarjetaPregunta pregunta={pregunta} feedback={feedback} onResponder={responder} color="#ef4444" />
                {feedback?.ok && <div className="eh-aparece" style={{ textAlign: 'center', marginTop: 10, fontWeight: 900, fontSize: '1.4rem', color: '#ffde59' }}>{critico ? '💥 ¡GOLPE CRÍTICO! ×2' : '👊 ¡Golpe!'}</div>}
                {feedback && !feedback.ok && <div className="eh-aparece" style={{ textAlign: 'center', marginTop: 10, fontWeight: 800 }}>🧟 ¡El zombi ha esquivado tu golpe!</div>}
                <div style={{ textAlign: 'center', marginTop: 10, opacity: .7, fontSize: '.85rem' }}>Tus golpes: {stats.current.golpes}</div>
            </>);
        }
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 24, textAlign: 'center' }}>
                <Zombi estado={fase === 'VICTORIA' ? 'muerto' : 'victoria'} size={140} />
                <h2 className="eh-titulo" style={{ fontSize: '2.2rem', color: fase === 'VICTORIA' ? '#4ade80' : '#ef4444' }}>
                    {fase === 'VICTORIA' ? '¡Habéis escapado!' : '¡El zombi os ha atrapado!'}
                </h2>
                <p>{fase === 'VICTORIA' ? '¡Feliz Halloween! 🎃' : 'Mirad la pantalla: ¡quizá el profe os dé la revancha!'}</p>
                <p style={{ fontWeight: 800 }}>✔ {stats.current.aciertos} aciertos · 💥 {stats.current.golpes} golpes</p>
            </div>,
            fase === 'VICTORIA' ? <Confeti /> : null
        );
    }

    return envoltorio(
        <div className="eh-panel" style={{ padding: 24, textAlign: 'center' }}>
            <h2>🎃 Partida terminada</h2>
            <p>✔ {stats.current.aciertos} aciertos · 💥 {stats.current.golpes} golpes</p>
            <button className="eh-btn" onClick={onSalir}>Salir</button>
        </div>
    );
}

function PantallaSimple({ titulo, texto, onSalir }) {
    return (
        <div className="eh-root"><Ambiente murcielagos={3} />
            <div className="eh-panel" style={{ maxWidth: 440, margin: '80px auto', padding: 26, textAlign: 'center' }}>
                <h2 style={{ marginTop: 0 }}>{titulo}</h2>
                <p>{texto}</p>
                {onSalir && <button className="eh-btn" onClick={onSalir}>Salir</button>}
            </div>
        </div>
    );
}

// =====================================================================
//  COMPONENTE PRINCIPAL
// =====================================================================
export default function EscapeHalloween({ usuario, onExit, codigoSala = null }) {
    const nombreUsuario = usuario?.displayName && usuario.displayName !== 'Profe Invitado' ? usuario.displayName : '';
    const [pantalla, setPantalla] = useState(codigoSala ? (nombreUsuario ? 'DISFRAZ' : 'UNIRSE') : 'MENU');
    const [nombre, setNombre] = useState(nombreUsuario);
    const [codigoEntrada, setCodigoEntrada] = useState(String(codigoSala || '').toUpperCase());
    const [errorUnir, setErrorUnir] = useState('');
    const [config, setConfig] = useState(configPorDefecto);
    const [configPartida, setConfigPartida] = useState(null);
    const [tituloPartida, setTituloPartida] = useState('');
    const [metaEditor, setMetaEditor] = useState({ titulo: '', publico: false, guardado: null });
    const [avatar, setAvatar] = useState(() => leerAvatarGuardado() || avatarAleatorio());
    const [semilla, setSemilla] = useState(0);

    const salirAlMenu = () => { setPantalla('MENU'); setSemilla(s => s + 1); };

    if (pantalla === 'PIZARRA' && configPartida?.partida) return <PizarraEscape key={'p' + semilla} config={configPartida} titulo={tituloPartida} onSalir={() => setPantalla('CONFIG')} />;
    if (pantalla === 'HOST' && configPartida) return <HostEscape key={'h' + semilla} config={configPartida} usuario={usuario} onSalir={salirAlMenu} />;
    if (pantalla === 'CLIENTE') return <ClienteEscape key={'c' + codigoEntrada} codigo={codigoEntrada} nombre={nombre.trim()} avatarInicial={avatar} onSalir={() => (codigoSala ? onExit?.() : salirAlMenu())} />;

    if (pantalla === 'DISFRAZ') {
        return (
            <div className="eh-root"><Ambiente />
                <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto', padding: 14 }}>
                    <EditorDisfraz avatar={avatar} nombre={nombre.trim()} onChange={setAvatar} onListo={(a) => { setAvatar(a); setPantalla('CLIENTE'); }} />
                </div>
            </div>
        );
    }

    if (pantalla === 'UNIRSE') {
        const entrar = async () => {
            const code = codigoEntrada.trim().toUpperCase();
            if (!nombre.trim()) { setErrorUnir('Escribe tu nombre.'); return; }
            if (!code) { setErrorUnir('Escribe el código de la sala.'); return; }
            try {
                const snap = await getDoc(doc(db, 'live_games', code));
                if (!snap.exists()) { setErrorUnir('No existe esa sala.'); return; }
                if (snap.data().tipoJuego !== TIPO_JUEGO) { setErrorUnir('Esa sala es de otro juego.'); return; }
                setCodigoEntrada(code);
                setPantalla('DISFRAZ');
            } catch (e) { setErrorUnir('Error: ' + e.message); }
        };
        return (
            <div className="eh-root"><Ambiente />
                <div className="eh-panel eh-aparece" style={{ maxWidth: 420, margin: '60px auto', padding: 26 }}>
                    <h2 className="eh-titulo" style={{ fontSize: '2.2rem', textAlign: 'center' }}>🎃 Entrar en la mansión</h2>
                    <label style={{ fontWeight: 700, fontSize: '.9rem' }}>Tu nombre</label>
                    <input className="eh-input" style={{ fontSize: '1.1rem', letterSpacing: 0, marginTop: 4 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" maxLength={30} />
                    <label style={{ fontWeight: 700, fontSize: '.9rem', display: 'block', marginTop: 14 }}>Código de la sala</label>
                    <input className="eh-input" style={{ marginTop: 4, letterSpacing: 6 }} value={codigoEntrada} onChange={e => setCodigoEntrada(e.target.value.toUpperCase())} placeholder="ABC12" maxLength={8}
                        onKeyDown={e => { if (e.key === 'Enter') entrar(); }} />
                    {errorUnir && <div style={{ color: '#fca5a5', fontSize: '.9rem', marginTop: 8 }}>⚠ {errorUnir}</div>}
                    <button className="eh-btn" style={{ width: '100%', marginTop: 16 }} onClick={entrar}>🎭 Siguiente: elegir disfraz</button>
                    <button className="eh-btn2" style={{ width: '100%', marginTop: 10 }} onClick={() => (codigoSala ? onExit?.() : setPantalla('MENU'))}>Cancelar</button>
                </div>
            </div>
        );
    }

    if (pantalla === 'CONFIG') {
        return (
            <div className="eh-root"><Ambiente />
                <EditorEscape config={config} setConfig={setConfig} usuario={usuario} meta={metaEditor} setMeta={setMetaEditor} onAtras={() => setPantalla('MENU')}
                    onCrear={(c) => { setConfigPartida(c); setSemilla(s => s + 1); setPantalla('HOST'); }}
                    onPizarra={(c, t) => { setConfigPartida(c); setTituloPartida(t || ''); setSemilla(s => s + 1); setPantalla('PIZARRA'); }} />
            </div>
        );
    }

    // ── MENÚ ──
    return (
        <div className="eh-root"><Ambiente murcielagos={7} />
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', padding: '30px 16px', textAlign: 'center' }}>
                {onExit && <div style={{ textAlign: 'left' }}><button className="eh-btn2" onClick={onExit}>← Volver</button></div>}
                <div className="eh-flota" style={{ fontSize: '4.5rem', marginTop: 10 }}>🎃🏚️🧟</div>
                <h1 className="eh-titulo" style={{ fontSize: 'clamp(2.4rem,7vw,4.2rem)' }}>La mansión del zombi</h1>
                <p style={{ fontSize: '1.15rem', lineHeight: 1.55, opacity: .9 }}>
                    Escape room de Halloween para <b>toda la clase</b>. Montad las pruebas que queráis (de Matemáticas, Geografía, Biología, Historia, Lengua, Inglés… o con
                    vuestro propio texto y un código escondido en el aula), entrad disfrazados en la mansión 3D y derrotad juntos al <b>zombi</b> en la batalla final.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 24 }}>
                    <div className="eh-panel" style={{ padding: 22 }}>
                        <div style={{ fontSize: '2.6rem' }}>📽️</div>
                        <h3 style={{ margin: '6px 0' }}>Soy el profe</h3>
                        <p style={{ opacity: .8, fontSize: '.95rem' }}>Prepara (o abre uno guardado) y juega con móviles o solo con la pizarra y fichas en papel.</p>
                        <button className="eh-btn" style={{ width: '100%' }} onClick={() => { setConfig(c => ({ ...c, modo: undefined })); setPantalla('CONFIG'); }}>🕯️ Crear escape room</button>
                    </div>
                    <div className="eh-panel" style={{ padding: 22 }}>
                        <div style={{ fontSize: '2.6rem' }}>📱</div>
                        <h3 style={{ margin: '6px 0' }}>Soy alumno</h3>
                        <p style={{ opacity: .8, fontSize: '.95rem' }}>Entra con el código o el QR de la pantalla y elige tu disfraz.</p>
                        <button className="eh-btn" style={{ width: '100%' }} onClick={() => setPantalla('UNIRSE')}>🚪 Unirme</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
