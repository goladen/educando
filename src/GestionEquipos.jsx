// src/GestionEquipos.jsx
//
// Panel reutilizable de "Equipos del aula" (Agente Pikt de escritorio, estilo Veyon).
// Se usa en dos contextos:
//   - Control de Aula  (scope 'personal')  → equipos vinculados a TU código de profesor.
//   - Comunidades      (scope 'comunidad') → equipos del centro, vistos por los miembros.
//
// Props:
//   scope     : 'personal' | 'comunidad'
//   id        : codigoProfesor (personal) o comId (comunidad). Es el "código de equipos".
//   canManage : si false (p. ej. lectores de la comunidad), solo se VE (presencia + miniaturas),
//               sin bloquear/mensaje/web/vídeo.
//
// Datos en Firestore:
//   {coll}/{id}                          → { thumbs }            (flag "ver pantallas")
//   {coll}/{id}/agents/{machineId}       → presencia + cmd + lastCmd + thumb
//   {coll}/{id}/agents/{machineId}/calls/{sessionId} → señalización WebRTC del vídeo en vivo
//   donde coll = 'aulas_fijas' (personal) | 'aulas_comunidad' (comunidad).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from './firebase';
import { doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc } from 'firebase/firestore';

const DESCONEXION_MS = 20000;
const ICE_FALLBACK = [{ urls: 'stun:stun.l.google.com:19302' }];
// Instalador del Agente Pikt (GitHub Releases). Actualiza la URL al subir una versión nueva.
const URL_AGENTE = 'https://github.com/goladen/pikt-agente/releases/download/v.0.1.1/AgentePikt-Setup-0.1.1.exe';

export const collForScope = (scope) => (scope === 'comunidad' ? 'aulas_comunidad' : 'aulas_fijas');

// Servidores ICE (STUN + TURN) para el vídeo en vivo. Se piden a /api/turn (las credenciales
// TURN viven en el servidor). Si falla (dev con Vite, sin /api), usa solo STUN.
async function obtenerIceServers() {
    try {
        const r = await fetch('/api/turn');
        if (r.ok) { const d = await r.json(); if (Array.isArray(d.iceServers) && d.iceServers.length) return d.iceServers; }
    } catch { /* sin endpoint: fallback */ }
    return ICE_FALLBACK;
}

export default function GestionEquipos({ scope = 'personal', id, canManage = true }) {
    const coll = collForScope(scope);
    const [agentes, setAgentes] = useState([]);
    const [verPantallas, setVerPantallas] = useState(false); // refleja el flag thumbs del doc del aula
    const [thumbs, setThumbs] = useState({}); // agentId → { data, at } leído del subdoc screen/latest
    const vistoAgentesRef = useRef({});
    const aulaRef = useMemo(() => (id ? doc(db, coll, id) : null), [coll, id]);

    // Suscripción a los equipos + al flag thumbs.
    useEffect(() => {
        if (!id) { setAgentes([]); return; }
        const unsubAgentes = onSnapshot(collection(db, coll, id, 'agents'), (snap) => {
            const ahora = Date.now();
            const lista = snap.docs.map((d) => {
                const a = { id: d.id, ...d.data() };
                const marca = a.lastSeenMs ?? null;
                const prev = vistoAgentesRef.current[a.id];
                if (!prev) {
                    const srv = a.lastSeen?.toMillis?.();
                    vistoAgentesRef.current[a.id] = { marca, at: srv ? Math.min(ahora, srv) : 0 };
                } else if (prev.marca !== marca) {
                    vistoAgentesRef.current[a.id] = { marca, at: ahora };
                }
                a._vistoAt = vistoAgentesRef.current[a.id].at;
                return a;
            });
            setAgentes(lista.sort((x, y) => (x.name || '').localeCompare(y.name || '')));
        });
        const unsubAula = onSnapshot(doc(db, coll, id), (snap) => {
            setVerPantallas(!!(snap.exists() && snap.data().thumbs));
        });
        return () => {
            unsubAgentes();
            unsubAula();
            // Al salir, si soy gestor, apago las miniaturas.
            if (canManage && aulaRef) setDoc(aulaRef, { thumbs: false }, { merge: true }).catch(() => {});
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coll, id]);

    // Miniaturas: un listener por equipo al subdoc screen/latest, SOLO mientras se ven las pantallas.
    const agentIds = agentes.map((a) => a.id).join(',');
    useEffect(() => {
        if (!verPantallas || !id) { setThumbs({}); return; }
        const ids = agentIds ? agentIds.split(',') : [];
        const unsubs = ids.map((aid) => onSnapshot(
            doc(db, coll, id, 'agents', aid, 'screen', 'latest'),
            (snap) => setThumbs((prev) => ({ ...prev, [aid]: snap.exists() ? snap.data() : null })),
            () => { /* sin permiso o error: se queda sin miniatura */ }
        ));
        return () => unsubs.forEach((u) => u());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verPantallas, coll, id, agentIds]);

    const agenteOnline = (a) => Date.now() - (a._vistoAt || 0) < DESCONEXION_MS;

    const enviarCmdAgente = async (agentId, type, payload = {}) => {
        if (!id) return;
        try {
            await setDoc(doc(db, coll, id, 'agents', agentId),
                { cmd: { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, payload, at: Date.now() } },
                { merge: true });
        } catch (e) { console.error(e); }
    };
    const enviarCmdTodos = async (type, payload = {}) => {
        await Promise.all(agentes.filter(agenteOnline).map((a) => enviarCmdAgente(a.id, type, payload)));
    };
    const quitarAgente = async (a) => {
        if (!id) return;
        if (!window.confirm(`¿Quitar el equipo "${a.name || 'equipo'}" de la lista? Volverá a aparecer en su próximo latido si sigue encendido.`)) return;
        try { await deleteDoc(doc(db, coll, id, 'agents', a.id)); } catch (e) { console.error(e); }
    };
    const toggleVerPantallas = async (on) => {
        if (!aulaRef) return;
        try { await setDoc(aulaRef, { thumbs: on }, { merge: true }); } catch (e) { console.error(e); }
    };

    return (
        <PanelEquipos
            agentes={agentes}
            online={agenteOnline}
            onCmd={enviarCmdAgente}
            onCmdTodos={enviarCmdTodos}
            onQuitar={quitarAgente}
            verPantallas={verPantallas}
            onToggleVerPantallas={toggleVerPantallas}
            thumbs={thumbs}
            codigoEquipos={id}
            scope={scope}
            canManage={canManage}
        />
    );
}

// ── Tarjeta de equipos ──
function PanelEquipos({ agentes, online, onCmd, onCmdTodos, onQuitar, verPantallas, onToggleVerPantallas, thumbs = {}, codigoEquipos, scope, canManage }) {
    const conectados = agentes.filter(online);
    const [vivo, setVivo] = useState(null);

    const pedirMensaje = () => {
        const txt = window.prompt('Mensaje para mostrar en las pantallas:');
        return (txt && txt.trim()) ? txt.trim() : null;
    };
    const pedirUrl = () => {
        const url = window.prompt('Web a abrir en los equipos (https://…):', 'https://');
        return (url && /^https?:\/\//i.test(url.trim())) ? url.trim() : null;
    };
    const badge = (txt, bg, c) => (
        <span style={{ background: bg, color: c, borderRadius: 20, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{txt}</span>
    );
    const miniBtn = (bg) => ({ background: bg, color: 'white', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 });

    const etiquetaCodigo = scope === 'comunidad' ? 'código de la comunidad' : 'código de equipos';

    return (
        <div style={{ background: '#0f172a', borderRadius: 14, padding: 16, marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    🖥️ Equipos{scope === 'comunidad' ? ' del centro' : ' del aula'} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>· {conectados.length} en línea de {agentes.length}</span>
                    {codigoEquipos && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', background: '#67e8f9', borderRadius: 20, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Código para vincular los equipos (no cambia)">
                            {etiquetaCodigo}: {codigoEquipos}
                            <button onClick={() => navigator.clipboard?.writeText(codigoEquipos)} style={{ background: 'rgba(15,23,42,0.15)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', padding: '0 5px' }}>copiar</button>
                        </span>
                    )}
                    {codigoEquipos && (
                        <a href={URL_AGENTE} download style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white', background: '#2563eb', borderRadius: 20, padding: '3px 12px', textDecoration: 'none' }}
                            title="Descarga el instalador. Ejecútalo en el PC del aula e introduce el código de arriba.">
                            ⬇️ Descargar Agente
                        </a>
                    )}
                </h3>
                {canManage && codigoEquipos && agentes.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => onToggleVerPantallas(!verPantallas)} style={miniBtn(verPantallas ? '#f59e0b' : '#334155')}>
                            {verPantallas ? '🙈 Ocultar pantallas' : '👁️ Ver pantallas'}
                        </button>
                        <button onClick={() => onCmdTodos('lock', { message: 'Atiende a la pantalla del profesor' })} style={miniBtn('#dc2626')}>🔒 Bloquear todos</button>
                        <button onClick={() => onCmdTodos('unlock')} style={miniBtn('#16a34a')}>🔓 Desbloquear todos</button>
                        <button onClick={() => { const m = pedirMensaje(); if (m) onCmdTodos('message', { text: m }); }} style={miniBtn('#7c3aed')}>💬 Mensaje a todos</button>
                    </div>
                )}
            </div>

            {!codigoEquipos ? (
                <div style={{ color: '#fbbf24', fontSize: '0.88rem', lineHeight: 1.5 }}>
                    {scope === 'comunidad'
                        ? '⚠️ Comunidad sin identificador. Recarga la página.'
                        : <>⚠️ Necesitas un <b>código de profesor</b> (lo pones en <b>Informes</b>) para vincular equipos.</>}
                </div>
            ) : agentes.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
                    No hay equipos vinculados todavía. Instala el <b>Agente Pikt</b> en los ordenadores, elige
                    <b style={{ color: '#e2e8f0' }}> {scope === 'comunidad' ? 'Comunidad' : 'Personal'}</b> e introduce
                    el <b style={{ color: '#e2e8f0' }}>{etiquetaCodigo}: {codigoEquipos}</b> la primera vez.
                    Quedan vinculados y aparecerán aquí al encenderse.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: 10 }}>
                    {agentes.map((a) => {
                        const on = online(a);
                        const th = thumbs[a.id];
                        return (
                            <div key={a.id} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${a.locked ? '#f87171' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                    <span style={{ color: 'white', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💻 {a.name || 'Equipo'}</span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {on ? badge('🟢 En línea', '#064e3b', '#6ee7b7') : badge('⚫ Desconectado', '#334155', '#cbd5e1')}
                                        {a.locked && badge('🔒', '#7f1d1d', '#fecaca')}
                                    </div>
                                </div>
                                {verPantallas && (
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#000', borderRadius: 8, overflow: 'hidden', marginBottom: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {th?.data ? (
                                            <img src={th.data} alt={`Pantalla de ${a.name || 'equipo'}`}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: on ? 1 : 0.4 }} />
                                        ) : (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                                                {on ? '⏳ esperando captura…' : 'sin señal'}
                                            </div>
                                        )}
                                        {!on && th?.data && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700 }}>⚫ desconectado</div>
                                        )}
                                    </div>
                                )}
                                {canManage ? (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {a.locked
                                            ? <button onClick={() => onCmd(a.id, 'unlock')} disabled={!on} style={{ ...miniBtn('#16a34a'), opacity: on ? 1 : 0.5 }}>🔓 Desbloquear</button>
                                            : <button onClick={() => onCmd(a.id, 'lock', { message: 'Atiende a la pantalla del profesor' })} disabled={!on} style={{ ...miniBtn('#dc2626'), opacity: on ? 1 : 0.5 }}>🔒 Bloquear</button>}
                                        <button onClick={() => { const m = pedirMensaje(); if (m) onCmd(a.id, 'message', { text: m }); }} disabled={!on} style={{ ...miniBtn('#7c3aed'), opacity: on ? 1 : 0.5 }}>💬</button>
                                        <button onClick={() => { const u = pedirUrl(); if (u) onCmd(a.id, 'openUrl', { url: u }); }} disabled={!on} style={{ ...miniBtn('#0ea5e9'), opacity: on ? 1 : 0.5 }}>🌐 Abrir web</button>
                                        <button onClick={() => setVivo(a)} disabled={!on} style={{ ...miniBtn('#e11d48'), opacity: on ? 1 : 0.5 }}>📹 En vivo</button>
                                        {!on && <button onClick={() => onQuitar(a)} title="Quitar de la lista" style={miniBtn('#475569')}>✕</button>}
                                    </div>
                                ) : (
                                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Solo lectura — puedes ver la pantalla, no gestionar.</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {vivo && (
                <VistaEnVivo scope={scope} codigoEquipos={codigoEquipos} agente={vivo} onCmd={onCmd} onClose={() => setVivo(null)} />
            )}
        </div>
    );
}

// Modal de vídeo EN VIVO (WebRTC). El profe es el "answerer": pide al agente que empiece
// (cmd liveStart), recibe la oferta por Firestore, responde, intercambia ICE y muestra el stream.
// Los fotogramas van peer-to-peer; por Firebase solo pasa la señalización.
function VistaEnVivo({ scope, codigoEquipos, agente, onCmd, onClose }) {
    const videoRef = useRef(null);
    const [estado, setEstado] = useState('Conectando con el equipo…');

    useEffect(() => {
        if (!codigoEquipos || !agente) return;
        const coll = collForScope(scope);
        let pc = null, unsubCall = () => {}, unsubCands = () => {}, cancelado = false;
        const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const callDoc = doc(db, coll, codigoEquipos, 'agents', agente.id, 'calls', sessionId);
        const agentCands = collection(callDoc, 'agentCandidates');
        const viewerCands = collection(callDoc, 'viewerCandidates');

        (async () => {
            const iceServers = await obtenerIceServers();
            if (cancelado) return;
            pc = new RTCPeerConnection({ iceServers });
            pc.ontrack = (e) => { if (videoRef.current) { videoRef.current.srcObject = e.streams[0]; setEstado(''); } };
            pc.onicecandidate = (e) => { if (e.candidate) addDoc(viewerCands, e.candidate.toJSON()).catch(() => {}); };
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'failed') setEstado('No se pudo conectar (NAT/cortafuegos). Revisa el TURN en /api/turn.');
                else if (pc.connectionState === 'disconnected') setEstado('Conexión perdida.');
            };

            onCmd(agente.id, 'liveStart', { sessionId });

            unsubCall = onSnapshot(callDoc, async (snap) => {
                const d = snap.data();
                if (d && d.offer && pc && !pc.currentRemoteDescription) {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await setDoc(callDoc, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });
                    } catch (err) { console.error('answer:', err); }
                }
            });
            unsubCands = onSnapshot(agentCands, (s) => {
                s.docChanges().forEach((ch) => {
                    if (ch.type === 'added' && pc) pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
                });
            });
        })();

        return () => {
            cancelado = true;
            onCmd(agente.id, 'liveStop', {});
            unsubCall(); unsubCands();
            try { if (pc) pc.close(); } catch { /* nada */ }
            (async () => {
                try {
                    for (const c of [agentCands, viewerCands]) {
                        const qs = await getDocs(c);
                        await Promise.all(qs.docs.map((d) => deleteDoc(d.ref)));
                    }
                    await deleteDoc(callDoc);
                } catch { /* nada */ }
            })();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, codigoEquipos, agente?.id]);

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10010, background: 'rgba(2,6,23,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
            <div style={{ color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                📹 {agente?.name || 'Equipo'} — en vivo
                <button onClick={onClose} style={{ background: '#e11d48', color: 'white', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>Cerrar</button>
            </div>
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(92vw, 1280px)', aspectRatio: '16 / 9', background: '#000', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                {estado && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontSize: '0.95rem', textAlign: 'center', padding: 20 }}>{estado}</div>
                )}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>El vídeo va directo equipo↔tú (WebRTC); por Firebase solo pasa la conexión inicial.</div>
        </div>
    );
}
