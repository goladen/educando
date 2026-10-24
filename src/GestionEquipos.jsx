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
import { db, auth } from './firebase';
import { doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import SesionEquipos, { RegistroSesiones } from './SesionEquipos';

// El agente late cada 30 s (espaciado para ahorrar escrituras en Firebase). Damos margen (3 latidos).
const DESCONEXION_MS = 90000;
const ICE_FALLBACK = [{ urls: 'stun:stun.l.google.com:19302' }];
// Instalador del Agente Pikt (GitHub Releases). Actualiza la URL al subir una versión nueva.
const URL_AGENTE = 'https://github.com/goladen/pikt-agente/releases/download/v.0.1.6/AgentePikt-Setup-0.1.6.exe';

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

export default function GestionEquipos({ scope = 'personal', id, esGestor = false }) {
    const coll = collForScope(scope);
    const [vista, setVista] = useState('inicio');   // 'inicio' | 'config'
    const [sesion, setSesion] = useState(null);      // { id? } sesión abierta en pantalla, o null
    const [verRegistro, setVerRegistro] = useState(false);
    const [vivoSesion, setVivoSesion] = useState(null); // equipo cuyo vídeo en vivo se ve desde la sesión
    const [abiertas, setAbiertas] = useState([]);    // sesiones mías ABIERTAS (para continuar)
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
            if (esGestor && aulaRef) setDoc(aulaRef, { thumbs: false }, { merge: true }).catch(() => {});
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
    // Guarda metadatos del equipo (tipo alumno/profesor, ubicación) en su doc.
    const guardarMeta = async (agentId, campos) => {
        if (!id) return;
        try { await setDoc(doc(db, coll, id, 'agents', agentId), campos, { merge: true }); } catch (e) { console.error(e); }
    };

    const conectados = agentes.filter(agenteOnline).length;
    const abrirNueva = () => setSesion({});
    const continuar = (sid) => setSesion({ id: sid });

    // Mis sesiones ABIERTAS (para ofrecer "Continuar"). Se recarga al cerrar el modal de sesión.
    useEffect(() => {
        if (!id) { setAbiertas([]); return; }
        let vivo = true;
        const uid = auth.currentUser?.uid;
        getDocs(query(collection(db, 'registro_equipos'), where('code', '==', id)))
            .then((snap) => {
                if (!vivo) return;
                const mias = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
                    .filter((s) => s.estado === 'abierta' && s.ownerUid === uid)
                    .sort((a, b) => (b.inicioMs || 0) - (a.inicioMs || 0));
                setAbiertas(mias);
            })
            .catch(() => {});
        return () => { vivo = false; };
        // recargar cuando se cierra el modal (sesion pasa a null)
    }, [id, sesion]);

    const modales = (
        <>
            {sesion && (
                <SesionEquipos scope={scope} codigoEquipos={id} agentes={agentes} sesionIdInicial={sesion.id || null} online={agenteOnline} onCmd={enviarCmdAgente} onVivo={setVivoSesion} esGestor={esGestor} onClose={() => setSesion(null)} />
            )}
            {verRegistro && (
                <RegistroSesiones scope={scope} codigoEquipos={id} canGestionar={esGestor} onClose={() => setVerRegistro(false)} />
            )}
            {vivoSesion && (
                <VistaEnVivo scope={scope} codigoEquipos={id} agente={vivoSesion} onCmd={enviarCmdAgente} onClose={() => setVivoSesion(null)} />
            )}
        </>
    );

    // La Configuración (gestión técnica: pantallas, bloqueo, vídeo, energía, tipo/ubicación,
    // instalación) es SOLO para el gestor (creador de la comunidad / dueño en personal).
    if (vista === 'config' && esGestor) {
        return (
            <>
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
                    canManage={esGestor}
                    onVolver={() => setVista('inicio')}
                    onNuevaSesion={abrirNueva}
                    onMeta={guardarMeta}
                />
                {modales}
            </>
        );
    }

    return (
        <>
            <PanelInicio
                scope={scope}
                codigoEquipos={id}
                conectados={conectados}
                total={agentes.length}
                esGestor={esGestor}
                abiertas={abiertas}
                onContinuar={continuar}
                onNuevaSesion={abrirNueva}
                onVerRegistro={() => setVerRegistro(true)}
                onConfig={() => setVista('config')}
            />
            {modales}
        </>
    );
}

// ── Pantalla de inicio de Equipos: acciones principales + acceso a configuración ──
function PanelInicio({ scope, conectados, total, esGestor, abiertas = [], onContinuar, onNuevaSesion, onVerRegistro, onConfig }) {
    const bigBtn = (bg) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: bg, color: 'white', border: 'none', borderRadius: 16, padding: '26px 20px', cursor: 'pointer', fontWeight: 800, fontSize: '1.05rem', minHeight: 120 });
    const tituloSesion = (s) => (s.cursos || []).map((c) => c.nombre).join(', ') || s.grupo || 'Sesión';
    return (
        <div style={{ background: '#0f172a', borderRadius: 14, padding: 20, marginTop: 18, maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🖥️ Equipos{scope === 'comunidad' ? ' del centro' : ''}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>· {conectados} en línea de {total}</span>
                </h3>
                {/* La configuración (instalar, gestionar, energía…) solo la ve el gestor/creador. */}
                {esGestor && <button onClick={onConfig} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>⚙️ Configuración de la sala</button>}
            </div>
            {abiertas.length > 0 && (
                <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {abiertas.map((s) => (
                        <button key={s.id} onClick={() => onContinuar(s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#15803d', color: 'white', border: 'none', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontWeight: 800 }}>
                            <span>▶ Continuar sesión: {tituloSesion(s)}</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>🟢 abierta · {s.machineIds?.length || 0} equipos</span>
                        </button>
                    ))}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14 }}>
                {/* Crear sesión está disponible para TODOS los miembros (incluidos los de solo lectura). */}
                <button onClick={onNuevaSesion} style={bigBtn('#15803d')}><span style={{ fontSize: 34 }}>📋</span> Crear una nueva sesión</button>
                <button onClick={onVerRegistro} style={bigBtn('#2563eb')}><span style={{ fontSize: 34 }}>📚</span> Ver registro de sesiones</button>
            </div>
        </div>
    );
}

// ── Guía paso a paso para vincular los equipos del centro (sobre todo en comunidad) ──
function GuiaVinculacion({ scope, codigoEquipos, abiertaInicial }) {
    const [abierta, setAbierta] = useState(abiertaInicial);
    const esCom = scope === 'comunidad';
    const copiar = () => { try { navigator.clipboard?.writeText(codigoEquipos || ''); } catch { /* nada */ } };

    const paso = (n, titulo, cuerpo) => (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#2563eb', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>{n}</div>
            <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}><b>{titulo}</b><br />{cuerpo}</div>
        </div>
    );

    return (
        <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }} onClick={() => setAbierta((v) => !v)}>
                <h4 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>📘 Cómo vincular los equipos del centro</h4>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>{abierta ? '▲ ocultar' : '▼ ver guía'}</span>
            </div>

            {abierta && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, fontSize: '0.88rem', color: '#1e3a8a', lineHeight: 1.55 }}>
                        Esta herramienta instala un pequeño programa (<b>Agente Pikt</b>) en los ordenadores del centro
                        para <b>supervisarlos y gestionarlos</b> (ver pantallas, bloquear, lanzar webs, vídeo en vivo),
                        funcionen donde funcionen (también fuera del centro). {esCom && 'Todos los miembros de la comunidad los ven; los de solo lectura solo los ven.'}
                    </div>

                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, fontSize: '0.88rem', color: '#991b1b', lineHeight: 1.55 }}>
                        ⚠️ <b>Solo funciona en Windows.</b> En tablets, móviles o Chromebooks no se puede instalar el agente.
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 12, fontSize: '0.85rem', color: '#475569', lineHeight: 1.55 }}>
                        <b>No confundir con «Control de Aula»:</b>
                        <div style={{ marginTop: 6 }}>
                            🧭 <b>Control de Aula</b> — supervisión <b>dentro del navegador</b>, por sesión con código/QR, en <b>cualquier dispositivo</b> y <b>sin instalar nada</b>. Para dirigir actividades en clase.
                        </div>
                        <div style={{ marginTop: 6 }}>
                            🖥️ <b>Vinculación de equipos</b> (esto) — supervisión del <b>ordenador entero</b>, <b>permanente</b>, con un programa instalado. <b>Solo Windows</b>. Para gestionar los PCs del centro.
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {paso(1, 'Descarga el Agente Pikt en cada ordenador', <>Pulsa el botón <b>⬇️ Descargar Agente</b> (arriba) en el propio PC del centro, o lleva el instalador por USB.</>)}
                        {paso(2, 'Ejecútalo e instálalo', <>Al abrirlo, Windows avisa de «editor desconocido» → <b>Más información → Ejecutar de todas formas</b>, y acepta los permisos (<b>Sí</b>).</>)}
                        {paso(3, esCom ? 'Elige «Comunidad» y pega el código' : 'Elige «Personal» y pega tu código', (
                            <>En la ventana del agente, marca <b>{esCom ? '🏫 Comunidad' : '👤 Personal'}</b> y pega este código:{' '}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#67e8f9', borderRadius: 8, padding: '2px 8px', fontWeight: 800, fontSize: '0.82rem', maxWidth: '100%', flexWrap: 'wrap', wordBreak: 'break-all' }}>
                                    {codigoEquipos || '—'}
                                    <button onClick={copiar} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', padding: '0 6px', flexShrink: 0 }}>copiar</button>
                                </span>
                            </>
                        ))}
                        {paso(4, '¡Listo! Queda vinculado para siempre', <>El equipo aparecerá abajo como <b>🟢 En línea</b>, arrancará solo con Windows y se <b>actualizará solo</b>. Repite en cada ordenador.</>)}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        ¿Muchos equipos? Se puede desplegar de forma desatendida por IT (instalación silenciosa + código pre-configurado). Pídelo si lo necesitas.
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Tarjeta de equipos ──
function PanelEquipos({ agentes, online, onCmd, onCmdTodos, onQuitar, verPantallas, onToggleVerPantallas, thumbs = {}, codigoEquipos, scope, canManage, onVolver, onNuevaSesion, onMeta }) {
    const conectados = agentes.filter(online);

    // Enciende por Wake-on-LAN los equipos apagados de un grupo, usando los encendidos como emisores.
    const encender = (grupo) => {
        // MACs de los equipos apagados del grupo (todas las interfaces conocidas de cada uno).
        const macs = [...new Set(grupo.filter((a) => !online(a)).flatMap((a) => (a.macs && a.macs.length ? a.macs : (a.mac ? [a.mac] : []))))];
        const emisores = agentes.filter(online);
        if (!macs.length) { alert('No hay equipos apagados con MAC conocida en ese grupo. (Enciéndelos una vez con el agente instalado para registrar su MAC.)'); return; }
        if (!emisores.length) { alert('Hace falta al menos un equipo encendido en la misma red para despertar a los demás.'); return; }
        emisores.forEach((a) => onCmd(a.id, 'wake', { macs }));
    };
    const apagarGrupo = (grupo) => {
        const ids = grupo.filter(online).map((a) => a.id);
        if (!ids.length) { alert('No hay equipos encendidos en ese grupo.'); return; }
        if (window.confirm(`¿Apagar ${ids.length} equipo(s)?`)) ids.forEach((id) => onCmd(id, 'shutdown'));
    };
    // Agrupa por ubicación.
    const porUbicacion = {};
    agentes.forEach((a) => { const u = (a.ubicacion || '').trim() || 'Sin ubicación'; (porUbicacion[u] = porUbicacion[u] || []).push(a); });
    const [vivo, setVivo] = useState(null);
    const [sel, setSel] = useState(() => new Set());   // ids de equipos seleccionados
    const [ampliada, setAmpliada] = useState(null);     // miniatura ampliada (dataURL) o null

    const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const seleccionOnline = () => agentes.filter((a) => sel.has(a.id) && online(a)).map((a) => a.id);
    // Aplica una orden a un conjunto de equipos (solo a los que estén en línea).
    const aplicarA = (ids, type, payload = {}) => ids.forEach((id) => onCmd(id, type, payload));
    const energiaA = (ids, type, verbo) => {
        if (!ids.length) return;
        if (window.confirm(`¿${verbo} ${ids.length} equipo(s)? Esta acción es inmediata.`)) aplicarA(ids, type);
    };

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
    const metaInp = { background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 6px', fontSize: '0.74rem', boxSizing: 'border-box' };

    const etiquetaCodigo = scope === 'comunidad' ? 'código de la comunidad' : 'código de equipos';

    return (
        <div style={{ background: '#0f172a', borderRadius: 14, padding: 16, marginTop: 18, maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
            {onVolver && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <button onClick={onVolver} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>← Volver</button>
                    <span style={{ color: '#e2e8f0', fontWeight: 800 }}>⚙️ Configuración de la sala</span>
                </div>
            )}
            {codigoEquipos && <GuiaVinculacion scope={scope} codigoEquipos={codigoEquipos} abiertaInicial={agentes.length === 0} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    🖥️ Equipos{scope === 'comunidad' ? ' del centro' : ' del aula'} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>· {conectados.length} en línea de {agentes.length}</span>
                    {codigoEquipos && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', background: '#67e8f9', borderRadius: 14, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', flexWrap: 'wrap', wordBreak: 'break-all' }} title="Código para vincular los equipos (no cambia)">
                            {etiquetaCodigo}: {codigoEquipos}
                            <button onClick={() => navigator.clipboard?.writeText(codigoEquipos)} style={{ background: 'rgba(15,23,42,0.15)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', padding: '0 5px', flexShrink: 0 }}>copiar</button>
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
                        <button onClick={() => { if (window.confirm('¿Parar las órdenes activas en todos los equipos (desbloquear, parar captura/vídeo)?')) onCmdTodos('reset'); }} style={miniBtn('#0f766e')}>🧯 Parar órdenes</button>
                        <button onClick={() => { const m = pedirMensaje(); if (m) onCmdTodos('message', { text: m }); }} style={miniBtn('#7c3aed')}>💬 Mensaje a todos</button>
                        <button onClick={() => energiaA(conectados.map((a) => a.id), 'logoff', 'Cerrar sesión en')} style={miniBtn('#0891b2')}>🚪 Cerrar sesión</button>
                        <button onClick={() => energiaA(conectados.map((a) => a.id), 'reboot', 'Reiniciar')} style={miniBtn('#ca8a04')}>🔄 Reiniciar</button>
                        <button onClick={() => energiaA(conectados.map((a) => a.id), 'shutdown', 'Apagar')} style={miniBtn('#475569')}>🔌 Apagar</button>
                    </div>
                )}
            </div>

            {canManage && sel.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(37,99,235,0.15)', border: '1px solid #2563eb', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                    <span style={{ color: '#bfdbfe', fontWeight: 800, fontSize: '0.82rem' }}>{sel.size} seleccionado(s):</span>
                    <button onClick={() => onNuevaSesion([...sel])} style={miniBtn('#15803d')}>📋 Crear sesión</button>
                    <button onClick={() => aplicarA(seleccionOnline(), 'lock', { message: 'Atiende a la pantalla del profesor' })} style={miniBtn('#dc2626')}>🔒 Bloquear</button>
                    <button onClick={() => aplicarA(seleccionOnline(), 'unlock')} style={miniBtn('#16a34a')}>🔓 Desbloquear</button>
                    <button onClick={() => aplicarA(seleccionOnline(), 'reset')} style={miniBtn('#0f766e')}>🧯 Parar</button>
                    <button onClick={() => { const m = pedirMensaje(); if (m) aplicarA(seleccionOnline(), 'message', { text: m }); }} style={miniBtn('#7c3aed')}>💬 Mensaje</button>
                    <button onClick={() => { const u = pedirUrl(); if (u) aplicarA(seleccionOnline(), 'openUrl', { url: u }); }} style={miniBtn('#0ea5e9')}>🌐 Abrir web</button>
                    <button onClick={() => energiaA(seleccionOnline(), 'logoff', 'Cerrar sesión en')} style={miniBtn('#0891b2')}>🚪 Cerrar sesión</button>
                    <button onClick={() => energiaA(seleccionOnline(), 'reboot', 'Reiniciar')} style={miniBtn('#ca8a04')}>🔄 Reiniciar</button>
                    <button onClick={() => energiaA(seleccionOnline(), 'shutdown', 'Apagar')} style={miniBtn('#475569')}>🔌 Apagar</button>
                    <button onClick={() => setSel(new Set())} style={{ ...miniBtn('transparent'), color: '#bfdbfe' }}>✕ deseleccionar</button>
                </div>
            )}

            {canManage && agentes.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>⚡ Energía por ubicación</span>
                        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => apagarGrupo(agentes)} style={miniBtn('#475569')}>🔌 Apagar todos</button>
                            <button onClick={() => encender(agentes)} style={miniBtn('#0891b2')}>⚡ Encender todos</button>
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(porUbicacion).map(([u, grupo]) => (
                            <div key={u} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px' }}>
                                <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 700 }}>📍 {u} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {grupo.filter(online).length}/{grupo.length} encendidos</span></span>
                                <span style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => apagarGrupo(grupo)} style={miniBtn('#475569')}>🔌 Apagar</button>
                                    <button onClick={() => encender(grupo)} style={miniBtn('#0891b2')}>⚡ Encender</button>
                                </span>
                            </div>
                        ))}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 8 }}>«Encender» usa Wake-on-LAN: requiere WoL activado en la BIOS, cable de red y un equipo encendido en la misma red.</div>
                </div>
            )}

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
                                    <label style={{ color: 'white', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, cursor: canManage ? 'pointer' : 'default' }}>
                                        {canManage && <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggleSel(a.id)} style={{ cursor: 'pointer' }} />}
                                        💻 {a.name || 'Equipo'}
                                    </label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {on ? badge('🟢 En línea', '#064e3b', '#6ee7b7') : badge('⚫ Desconectado', '#334155', '#cbd5e1')}
                                        {a.locked && badge('🔒', '#7f1d1d', '#fecaca')}
                                        {a.live && badge('📹 en uso', '#1e3a8a', '#bfdbfe')}
                                    </div>
                                </div>
                                {(a.battery != null || a.student?.name) && (
                                    <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem', color: '#94a3b8', marginBottom: 6, flexWrap: 'wrap' }}>
                                        {a.battery != null && <span style={{ color: a.battery <= 20 ? '#f87171' : '#94a3b8' }}>🔋 {a.battery}%</span>}
                                        {a.student?.name && <span>👤 {a.student.name}</span>}
                                    </div>
                                )}
                                {canManage && onMeta && (
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <select value={a.tipo || 'alumno'} onChange={(e) => onMeta(a.id, { tipo: e.target.value })} style={metaInp}>
                                            <option value="alumno">👦 Alumno</option>
                                            <option value="profesor">🧑‍🏫 Profesor</option>
                                        </select>
                                        <input defaultValue={a.ubicacion || ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (a.ubicacion || '')) onMeta(a.id, { ubicacion: v }); }} placeholder="📍 ubicación" style={{ ...metaInp, flex: 1, minWidth: 90 }} />
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#cbd5e1', fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Avisar y registrar si el alumno cambia el fondo de escritorio">
                                            <input type="checkbox" checked={!!a.vigilar} onChange={(e) => onMeta(a.id, { vigilar: e.target.checked })} /> 👁️ Vigilar
                                        </label>
                                    </div>
                                )}
                                {Array.isArray(a.incidencias) && a.incidencias.length > 0 && (
                                    <div style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 7, padding: '4px 8px', marginBottom: 8, fontSize: '0.72rem', color: '#fecaca', maxHeight: 120, overflowY: 'auto' }}>
                                        {a.incidencias.slice(-15).reverse().map((inc, k) => (
                                            <div key={k} style={{ padding: '1px 0' }}>
                                                🚨 {inc.detalle}
                                                {inc.at ? <span style={{ color: '#f87171' }}> · {new Date(inc.at).toLocaleString('es-ES')}</span> : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {verPantallas && (
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#000', borderRadius: 8, overflow: 'hidden', marginBottom: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {th?.data ? (
                                            <img src={th.data} alt={`Pantalla de ${a.name || 'equipo'}`}
                                                onClick={() => setAmpliada({ data: th.data, name: a.name })}
                                                title="Clic para ampliar"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: on ? 1 : 0.4, cursor: 'zoom-in' }} />
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
                                        <button onClick={() => onCmd(a.id, 'reset')} disabled={!on} title="Parar órdenes / desbloquear este equipo" style={{ ...miniBtn('#0f766e'), opacity: on ? 1 : 0.5 }}>🧯</button>
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

            {ampliada && (
                <div onClick={() => setAmpliada(null)} style={{ position: 'fixed', inset: 0, zIndex: 10010, background: 'rgba(2,6,23,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, cursor: 'zoom-out' }}>
                    <div style={{ color: 'white', fontWeight: 700 }}>🖥️ {ampliada.name || 'Equipo'} — miniatura</div>
                    <img src={ampliada.data} alt="Pantalla ampliada" style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Es la miniatura (poca resolución). Para verla nítida y en movimiento usa 📹 En vivo. (toca para cerrar)</div>
                </div>
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
    const [avisoToma] = useState(() => !!agente?.live); // ya lo veía otro profe → al conectar tomas el control

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
            {avisoToma && (
                <div style={{ background: '#78350f', color: '#fde68a', borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem' }}>
                    ⚠️ Otro profesor estaba viendo este equipo. Al conectar tomas tú el control del vídeo.
                </div>
            )}
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
