import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, doc,
    setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { Plus, Trash2, Save, RefreshCw, X, ChevronLeft, CheckCircle } from 'lucide-react';

const rndId = () => Math.random().toString(36).slice(2, 10);

const CANVAS_W  = 760;
const CANVAS_H  = 520;
const SEAT_W    = 74;   // ancho de cada asiento
const SEAT_GAP  = 3;
const PAD       = 8;    // padding horizontal del bloque de asientos

// Ancho total de una mesa según número de asientos
const deskWidth = n => n * SEAT_W + (n - 1) * SEAT_GAP + PAD;
// n=1 → 82  n=2 → 159  n=3 → 236  n=4 → 313

// ─── Layout por defecto: 4 filas × 3 columnas × 2 asientos = 24 ─────────────
function defaultLayout() {
    const m = [];
    // Mesa del profesor (centro, arriba)
    m.push({
        id: rndId(), tipo: 'profesor',
        x: Math.round((CANVAS_W - 180) / 2), y: 10,
        asientos: [{ id: rndId(), alumno: null }]
    });
    // 4 filas × 3 columnas — 2 asientos cada mesa (parejas)
    // Con 2 asientos: deskWidth(2) = 159 → 3 desks + 2 gaps
    // gaps = (760 - 2*30 - 3*159) / 2 = (700-477)/2 = 111
    const xs = [30, 30 + 159 + 111, 30 + 159 + 111 + 159 + 111]; // [30, 300, 570]
    const ys = [110, 210, 310, 410];
    ys.forEach(y => xs.forEach(x =>
        m.push({
            id: rndId(), tipo: 'alumno', x, y,
            asientos: [{ id: rndId(), alumno: null }, { id: rndId(), alumno: null }]
        })
    ));
    return m;
}

// ─── HTML de impresión ────────────────────────────────────────────────────────
function htmlPlano(nombre, mesas, grupoNombre) {
    const sc   = 0.88;
    const W    = Math.round(CANVAS_W * sc);
    const H    = Math.round(CANVAS_H * sc);
    const asig = mesas.flatMap(m => m.asientos).filter(s => s.alumno).length;

    const desks = mesas.map(m => {
        const isP = m.tipo === 'profesor';
        const w   = Math.round((isP ? 180 : deskWidth(m.asientos.length)) * sc);
        const seats = m.asientos.map(s =>
            `<div style="flex:1;border:1px solid ${isP?'#e67e22':'#1565C0'};border-radius:4px;padding:3px;font-size:0.67rem;font-weight:600;min-height:34px;display:flex;align-items:center;justify-content:center;text-align:center;background:${s.alumno?'#e8f5e9':'#f8f9fa'};color:${s.alumno?'#2c3e50':'#bbb'}">${s.alumno||'vacío'}</div>`
        ).join('');
        return `<div style="position:absolute;left:${Math.round(m.x*sc)}px;top:${Math.round(m.y*sc)}px;width:${w}px;border:2px solid ${isP?'#e67e22':'#1565C0'};border-radius:8px;overflow:hidden">
  <div style="background:${isP?'#e67e22':'#1565C0'};color:white;font-size:0.58rem;font-weight:700;padding:2px 6px">${isP?'👨‍🏫 PROFESOR':''}</div>
  <div style="display:flex;gap:3px;padding:3px">${seats}</div>
</div>`;
    }).join('');

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${nombre}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:20px;}
h1{font-size:1.3rem;color:#1565C0;margin-bottom:3px;}p{font-size:0.78rem;color:#7f8c8d;margin-bottom:14px;}
.btn{display:block;margin:0 auto 14px;padding:8px 24px;background:#1565C0;color:white;border:none;border-radius:6px;font-size:0.9rem;font-weight:700;cursor:pointer;}
@media print{.btn{display:none;}}</style></head>
<body>
<button class="btn" onclick="window.print()">🖨 Imprimir</button>
<h1>${nombre}</h1><p>${grupoNombre?grupoNombre+' · ':''}${asig} alumnos asignados</p>
<div style="position:relative;width:${W}px;height:${H}px;border:2px solid #e0e4f0;border-radius:10px;background:#f8faff;overflow:hidden">
  <div style="text-align:center;position:absolute;top:3px;left:0;right:0;font-size:0.6rem;color:#bdc3c7;font-weight:700">▲ PIZARRA / FRENTE</div>
  ${desks}
</div></body></html>`;
}

// ─── Tarjeta de mesa ──────────────────────────────────────────────────────────
function DeskCard({ mesa, selSeat, selUnassign, onStartDrag, onClickSeat, onDelete, onAddSeat, onRemoveSeat }) {
    const isP  = mesa.tipo === 'profesor';
    const col  = isP ? '#e67e22' : '#1565C0';
    const n    = mesa.asientos.length;
    const w    = isP ? 180 : deskWidth(n);

    return (
        <div style={{
            position: 'absolute', left: mesa.x, top: mesa.y, width: w,
            borderRadius: 10, border: `2px solid ${col}`,
            background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            overflow: 'hidden', userSelect: 'none', zIndex: 1
        }}>
            {/* Barra de arrastre */}
            <div onMouseDown={e => { e.preventDefault(); onStartDrag(e, mesa.id); }}
                style={{ background: col, height: 22, cursor: 'grab',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5px', gap: 3 }}>

                <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                    {isP ? '👨‍🏫' : '⠿'}
                </span>

                {/* Controles de asientos (solo mesas de alumno) */}
                {!isP && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => e.stopPropagation()}>
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onRemoveSeat(mesa.id); }}
                            disabled={n <= 1}
                            style={{ background: 'rgba(0,0,0,0.25)', border: 'none', color: 'white', borderRadius: 3, width: 16, height: 16, cursor: n>1?'pointer':'default', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: n<=1?0.4:1, padding: 0 }}>
                            −
                        </button>
                        <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 700, minWidth: 10, textAlign: 'center' }}>{n}</span>
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onAddSeat(mesa.id); }}
                            style={{ background: 'rgba(0,0,0,0.25)', border: 'none', color: 'white', borderRadius: 3, width: 16, height: 16, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                            +
                        </button>
                    </div>
                )}

                <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onDelete(mesa.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.8)', padding: '1px 2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <X size={isP ? 0 : 10}/>
                </button>
            </div>

            {/* Asientos */}
            <div style={{ display: 'flex', gap: SEAT_GAP, padding: `4px ${PAD/2}px` }}>
                {mesa.asientos.map((s, idx) => {
                    const isSel    = selSeat?.deskId === mesa.id && selSeat?.seatIdx === idx;
                    const isTarget = !isSel && selUnassign !== null && !s.alumno;
                    const bg     = isSel ? '#fdecea' : isTarget ? '#e8f0fe' : s.alumno ? '#e8f5e9' : '#f8faff';
                    const border = isSel ? '2px solid #e74c3c'
                        : isTarget ? '2px dashed #1565C0'
                        : s.alumno ? '1.5px solid #a5d6a7' : '1.5px solid #e0e4f0';
                    return (
                        <div key={s.id} onClick={() => onClickSeat(mesa.id, idx)} style={{
                            width: SEAT_W, minHeight: 42, borderRadius: 6, border, background: bg,
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', padding: '2px 3px', textAlign: 'center',
                            fontSize: '0.65rem', fontWeight: 600, color: '#2c3e50',
                            wordBreak: 'break-word', lineHeight: 1.2, transition: 'all 0.1s',
                        }}>
                            {s.alumno || <span style={{ color: '#ccc', fontWeight: 400 }}>vacío</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Editor del aula ──────────────────────────────────────────────────────────
function EditorAula({ planInicial, grupos, profesorUid, onSaved, onBack }) {
    const [mesas,        setMesas]        = useState(planInicial?.mesas       || defaultLayout());
    const [nombre,       setNombre]       = useState(planInicial?.nombre      || 'Plano sin título');
    const [grupoId,      setGrupoId]      = useState(planInicial?.grupoId     || '');
    const [grupoAlumnos, setGrupoAlumnos] = useState([]);
    const [alumnosExtra, setAlumnosExtra] = useState(planInicial?.alumnosExtra || []);
    const [inputExtra,   setInputExtra]   = useState('');
    const [selSeat,      setSelSeat]      = useState(null);
    const [selUnassign,  setSelUnassign]  = useState(null);
    const [dragging,     setDragging]     = useState(null);
    const [guardando,    setGuardando]    = useState(false);
    const [guardadoOk,   setGuardadoOk]  = useState(false);

    useEffect(() => {
        if (!grupoId) { setGrupoAlumnos([]); return; }
        setGrupoAlumnos(grupos.find(g => g.id === grupoId)?.alumnos || []);
    }, [grupoId, grupos]);

    const todosAlumnos = [...grupoAlumnos.map(a => a.nombre), ...alumnosExtra];
    const asignados    = new Set(mesas.flatMap(m => m.asientos.map(s => s.alumno)).filter(Boolean));
    const noAsignados  = todosAlumnos.filter(n => !asignados.has(n));

    // ── Drag de mesas ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!dragging) return;
        const onMove = e => {
            const dx = e.clientX - dragging.startMX;
            const dy = e.clientY - dragging.startMY;
            setMesas(prev => prev.map(m => {
                if (m.id !== dragging.id) return m;
                const w = m.tipo === 'profesor' ? 180 : deskWidth(m.asientos.length);
                return {
                    ...m,
                    x: Math.max(0, Math.min(CANVAS_W - w,   dragging.startDX + dx)),
                    y: Math.max(0, Math.min(CANVAS_H - 74,  dragging.startDY + dy))
                };
            }));
        };
        const onUp = () => setDragging(null);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [dragging]);

    const startDrag = (e, deskId) => {
        const d = mesas.find(m => m.id === deskId);
        setDragging({ id: deskId, startMX: e.clientX, startMY: e.clientY, startDX: d.x, startDY: d.y });
    };

    // ── Añadir / quitar asientos ──────────────────────────────────────────────
    const addSeat = id => setMesas(prev => prev.map(m => m.id !== id ? m : {
        ...m, asientos: [...m.asientos, { id: rndId(), alumno: null }]
    }));

    const removeSeat = id => setMesas(prev => prev.map(m => {
        if (m.id !== id || m.asientos.length <= 1) return m;
        const last = m.asientos[m.asientos.length - 1];
        // Si el último asiento tenía alumno, simplemente queda sin asignar (se recalcula noAsignados)
        if (selSeat?.deskId === id && selSeat?.seatIdx === m.asientos.length - 1) setSelSeat(null);
        return { ...m, asientos: m.asientos.slice(0, -1) };
    }));

    // ── Interacción con asientos ──────────────────────────────────────────────
    const onClickSeat = (deskId, seatIdx) => {
        if (dragging) return;
        if (selUnassign !== null) {
            setMesas(prev => prev.map(m => m.id !== deskId ? m : {
                ...m, asientos: m.asientos.map((s, i) => i === seatIdx ? { ...s, alumno: selUnassign } : s)
            }));
            setSelUnassign(null);
        } else if (selSeat) {
            if (selSeat.deskId === deskId && selSeat.seatIdx === seatIdx) {
                setSelSeat(null);
            } else {
                setMesas(prev => {
                    const next = prev.map(m => ({ ...m, asientos: m.asientos.map(s => ({ ...s })) }));
                    const d1 = next.find(m => m.id === selSeat.deskId);
                    const d2 = next.find(m => m.id === deskId);
                    if (!d1 || !d2) return next;
                    const a1 = d1.asientos[selSeat.seatIdx].alumno;
                    d1.asientos[selSeat.seatIdx].alumno = d2.asientos[seatIdx].alumno;
                    d2.asientos[seatIdx].alumno = a1;
                    return next;
                });
                setSelSeat(null);
            }
        } else {
            setSelSeat({ deskId, seatIdx });
        }
    };

    const onClickUnassigned = n => { setSelSeat(null); setSelUnassign(prev => prev === n ? null : n); };

    // ── Rellenar (front → back) ───────────────────────────────────────────────
    const rellenar = () => {
        const todos = [...todosAlumnos].sort(() => Math.random() - 0.5);
        const alumnoMesas = [...mesas]
            .filter(m => m.tipo === 'alumno')
            .sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
        const newMesas = mesas.map(m => ({ ...m, asientos: m.asientos.map(s => ({ ...s, alumno: null })) }));
        let idx = 0;
        alumnoMesas.forEach(sm => {
            const mesa = newMesas.find(m => m.id === sm.id);
            if (mesa) mesa.asientos.forEach(s => { if (idx < todos.length) s.alumno = todos[idx++]; });
        });
        setMesas(newMesas); setSelSeat(null); setSelUnassign(null);
    };

    const añadirMesa = () => setMesas(prev => [...prev, {
        id: rndId(), tipo: 'alumno', x: 40, y: 50,
        asientos: [{ id: rndId(), alumno: null }, { id: rndId(), alumno: null }]
    }]);

    const eliminarMesa = id => { setMesas(prev => prev.filter(m => m.id !== id)); setSelSeat(null); };

    const vaciarAsiento = () => {
        if (!selSeat) return;
        setMesas(prev => prev.map(m => m.id !== selSeat.deskId ? m : {
            ...m, asientos: m.asientos.map((s, i) => i === selSeat.seatIdx ? { ...s, alumno: null } : s)
        }));
        setSelSeat(null);
    };

    const guardar = async () => {
        setGuardando(true);
        try {
            const id = planInicial?.id || rndId();
            const grupoNombre = grupos.find(g => g.id === grupoId)?.nombre || '';
            await setDoc(doc(db, 'planos_aula', id), {
                id, profesorUid, nombre, grupoId, grupoNombre,
                mesas, alumnosExtra,
                fechaCreacion: planInicial?.fechaCreacion || serverTimestamp()
            }, { merge: true });
            setGuardadoOk(true); setTimeout(() => setGuardadoOk(false), 2500);
            onSaved?.();
        } catch (e) { alert('Error al guardar: ' + e.message); }
        setGuardando(false);
    };

    const imprimir = () => {
        const w = window.open('', '_blank');
        w.document.write(htmlPlano(nombre, mesas, grupos.find(g => g.id === grupoId)?.nombre || ''));
        w.document.close();
    };

    const totalAsientos = mesas.filter(m => m.tipo === 'alumno').reduce((s, m) => s + m.asientos.length, 0);
    const selAlumno = selSeat ? mesas.find(m => m.id === selSeat.deskId)?.asientos[selSeat.seatIdx]?.alumno : null;

    return (
        <div>
            {/* Cabecera */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:8, border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.82rem', color:'#555' }}>
                    <ChevronLeft size={14}/> Mis planos
                </button>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                    style={{ flex:1, minWidth:140, padding:'7px 12px', borderRadius:8, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', fontFamily:'inherit', fontWeight:700 }}/>
                <select value={grupoId} onChange={e => setGrupoId(e.target.value)}
                    style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid #e0e4f0', fontSize:'0.84rem', outline:'none', background:'white' }}>
                    <option value="">Sin grupo</option>
                    {grupos.map(g => <option key={g.id} value={g.id}>👥 {g.nombre} ({g.alumnos?.length||0})</option>)}
                </select>
                <button onClick={imprimir} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #bdc3c7', background:'white', cursor:'pointer', fontSize:'0.82rem', color:'#555' }}>
                    🖨 Imprimir
                </button>
                <button onClick={guardar} disabled={guardando}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'none', background: guardadoOk?'#27ae60':'#1565C0', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.85rem' }}>
                    {guardadoOk ? <><CheckCircle size={14}/> Guardado</> : guardando ? 'Guardando…' : <><Save size={14}/> Guardar</>}
                </button>
            </div>

            {/* Barra de herramientas */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
                <button onClick={rellenar} disabled={todosAlumnos.length===0}
                    style={{ padding:'6px 14px', borderRadius:8, border:'none', fontWeight:700, fontSize:'0.83rem', cursor: todosAlumnos.length===0?'default':'pointer',
                        background: todosAlumnos.length===0?'#e0e4f0':'#27ae60', color: todosAlumnos.length===0?'#aaa':'white' }}>
                    ✨ Rellenar
                </button>
                <button onClick={añadirMesa} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'1px solid #bdc3c7', background:'white', cursor:'pointer', fontSize:'0.82rem', color:'#555' }}>
                    <Plus size={13}/> Mesa
                </button>
                {selSeat && selAlumno && (
                    <button onClick={vaciarAsiento} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 11px', borderRadius:8, border:'1px solid #e74c3c', background:'#fdecea', color:'#e74c3c', cursor:'pointer', fontSize:'0.82rem' }}>
                        <X size={12}/> Vaciar asiento
                    </button>
                )}
                <span style={{ fontSize:'0.72rem', color:'#95a5a6', marginLeft:'auto' }}>
                    Arrastra la barra de cada mesa para moverla · usa − / + para cambiar asientos
                </span>
                <span style={{ fontSize:'0.74rem', color:'#7f8c8d', fontWeight:600 }}>
                    {asignados.size}/{totalAsientos} · {noAsignados.length} sin asignar
                </span>
            </div>

            {/* Área principal */}
            <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                {/* Canvas */}
                <div style={{ overflowX:'auto', flexShrink:0 }}>
                    <div style={{
                        position:'relative', width:CANVAS_W, height:CANVAS_H,
                        background:'linear-gradient(180deg,#f0f4ff 0%,#f8faff 100%)',
                        border:'2px solid #e0e4f0', borderRadius:14,
                        cursor: dragging?'grabbing':'default'
                    }}>
                        <div style={{ position:'absolute', top:3, left:0, right:0, textAlign:'center', fontSize:'0.62rem', color:'#bdc3c7', fontWeight:700, pointerEvents:'none' }}>
                            ▲ PIZARRA / FRENTE DE CLASE
                        </div>
                        {mesas.map(m => (
                            <DeskCard key={m.id} mesa={m}
                                selSeat={selSeat} selUnassign={selUnassign}
                                onStartDrag={startDrag} onClickSeat={onClickSeat}
                                onDelete={eliminarMesa} onAddSeat={addSeat} onRemoveSeat={removeSeat}/>
                        ))}
                    </div>
                </div>

                {/* Panel lateral */}
                <div style={{ flex:1, minWidth:160 }}>
                    <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.85rem', marginBottom:8 }}>
                        Sin asignar
                        <span style={{ marginLeft:6, background:'#e8f0fe', color:'#1565C0', borderRadius:20, padding:'1px 7px', fontSize:'0.72rem', fontWeight:700 }}>
                            {noAsignados.length}
                        </span>
                    </div>

                    {noAsignados.length === 0 && (
                        <p style={{ color:'#95a5a6', fontSize:'0.8rem', marginBottom:12 }}>
                            {todosAlumnos.length===0 ? 'Selecciona un grupo' : '✓ Todos asignados'}
                        </p>
                    )}

                    <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:16, maxHeight:240, overflowY:'auto' }}>
                        {noAsignados.map(n => (
                            <div key={n} onClick={() => onClickUnassigned(n)} style={{
                                padding:'6px 10px', borderRadius:8, cursor:'pointer',
                                background: selUnassign===n?'#1565C0':'#e8f0fe',
                                color: selUnassign===n?'white':'#1565C0',
                                fontSize:'0.8rem', fontWeight:600, transition:'all 0.1s',
                                border:'1.5px solid '+(selUnassign===n?'#1565C0':'transparent')
                            }}>{n}</div>
                        ))}
                    </div>

                    {/* Alumno extra */}
                    <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.82rem', marginBottom:6 }}>Añadir alumno extra</div>
                    <div style={{ display:'flex', gap:5 }}>
                        <input value={inputExtra} onChange={e => setInputExtra(e.target.value)}
                            onKeyDown={e => { if (e.key==='Enter' && inputExtra.trim()) { setAlumnosExtra(p=>[...p,inputExtra.trim()]); setInputExtra(''); } }}
                            placeholder="Nombre…"
                            style={{ flex:1, padding:'6px 8px', borderRadius:7, border:'1.5px solid #e0e4f0', fontSize:'0.8rem', outline:'none', fontFamily:'inherit' }}/>
                        <button onClick={() => { if (!inputExtra.trim()) return; setAlumnosExtra(p=>[...p,inputExtra.trim()]); setInputExtra(''); }}
                            style={{ padding:'6px 10px', borderRadius:7, border:'none', background:'#1565C0', color:'white', cursor:'pointer', display:'flex', alignItems:'center' }}>
                            <Plus size={14}/>
                        </button>
                    </div>

                    {alumnosExtra.length > 0 && (
                        <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:3 }}>
                            {alumnosExtra.map((n, i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.78rem', color:'#7f8c8d' }}>
                                    <span style={{ flex:1 }}>{n}</span>
                                    <button onClick={() => {
                                        setAlumnosExtra(p => p.filter((_,j)=>j!==i));
                                        setMesas(p => p.map(m => ({ ...m, asientos: m.asientos.map(s => s.alumno===n?{...s,alumno:null}:s) })));
                                    }} style={{ background:'none', border:'none', cursor:'pointer', color:'#e74c3c', padding:2 }}>
                                        <X size={11}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Hint */}
                    {(selSeat || selUnassign) && (
                        <div style={{ marginTop:14, padding:'8px 10px', background:'#fff8e1', borderRadius:8, fontSize:'0.74rem', color:'#856404', lineHeight:1.4 }}>
                            {selUnassign
                                ? `Clic en un asiento para colocar a "${selUnassign}"`
                                : `"${selAlumno||'vacío'}" seleccionado — clic en otro asiento para intercambiar`}
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin{100%{transform:rotate(360deg);}}`}</style>
        </div>
    );
}

// ─── Lista de planos guardados ────────────────────────────────────────────────
function ListaPlanos({ planes, onSelect, onCreate, onDelete, borrando }) {
    return (
        <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <h2 style={{ margin:0, color:'#2c3e50', fontSize:'1.3rem' }}>🪑 Planos de Clase</h2>
                <button onClick={onCreate}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, border:'none', background:'#1565C0', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.85rem' }}>
                    <Plus size={15}/> Nuevo Plano
                </button>
            </div>

            {planes.length === 0 ? (
                <div style={{ background:'white', borderRadius:14, padding:'40px 20px', textAlign:'center', color:'#95a5a6', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize:'2.5rem', marginBottom:10 }}>🪑</div>
                    <div style={{ fontWeight:600, marginBottom:6 }}>Sin planos todavía</div>
                    <div style={{ fontSize:'0.85rem' }}>Crea un plano para organizar los asientos de tu clase.</div>
                </div>
            ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {planes.map(p => (
                        <div key={p.id} style={{ background:'white', borderRadius:12, padding:'14px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #f0f0f0', display:'flex', alignItems:'center', gap:12 }}>
                            <div style={{ flex:1, cursor:'pointer' }} onClick={() => onSelect(p)}>
                                <div style={{ fontWeight:700, color:'#1565C0', fontSize:'1rem' }}>{p.nombre}</div>
                                <div style={{ fontSize:'0.75rem', color:'#95a5a6', marginTop:2 }}>
                                    {p.grupoNombre ? `👥 ${p.grupoNombre} · ` : ''}
                                    {p.mesas?.filter(m=>m.tipo==='alumno').reduce((s,m)=>s+m.asientos.filter(a=>a.alumno).length,0)||0} alumnos asignados
                                    {p.fechaCreacion?.seconds ? ` · ${new Date(p.fechaCreacion.seconds*1000).toLocaleDateString('es-ES')}` : ''}
                                </div>
                            </div>
                            <button onClick={() => onSelect(p)}
                                style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #1565C0', background:'#e8f0fe', color:'#1565C0', cursor:'pointer', fontWeight:600, fontSize:'0.8rem' }}>
                                Editar
                            </button>
                            <button onClick={() => onDelete(p.id)} disabled={borrando===p.id}
                                style={{ padding:'5px 8px', borderRadius:7, border:'1px solid #fdd', background:'#fdecea', color:'#e74c3c', cursor:'pointer' }}>
                                {borrando===p.id ? '…' : <Trash2 size={13}/>}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MapaAula({ usuario }) {
    const [planes,   setPlanes]   = useState([]);
    const [grupos,   setGrupos]   = useState([]);
    const [cargando, setCargando] = useState(true);
    const [editando, setEditando] = useState(null);
    const [borrando, setBorrando] = useState(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [sp, sg] = await Promise.all([
                getDocs(query(collection(db,'planos_aula'),    where('profesorUid','==',usuario.uid))),
                getDocs(query(collection(db,'grupos_profesor'), where('profesorUid','==',usuario.uid)))
            ]);
            setPlanes(sp.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.fechaCreacion?.seconds||0)-(a.fechaCreacion?.seconds||0)));
            setGrupos(sg.docs.map(d=>({id:d.id,...d.data()})));
        } catch(e) { console.error(e); }
        setCargando(false);
    }, [usuario.uid]);

    useEffect(() => { cargar(); }, [cargar]);

    const borrar = async id => {
        setBorrando(id);
        try { await deleteDoc(doc(db,'planos_aula',id)); setPlanes(p=>p.filter(x=>x.id!==id)); }
        catch(e) { alert('Error: '+e.message); }
        setBorrando(null);
    };

    if (cargando) return (
        <div style={{ textAlign:'center', padding:'50px 0', color:'#95a5a6' }}>
            <RefreshCw size={28} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 12px' }}/>
            Cargando…
            <style>{`@keyframes spin{100%{transform:rotate(360deg);}}`}</style>
        </div>
    );

    if (editando !== null) return (
        <EditorAula
            planInicial={editando}
            grupos={grupos}
            profesorUid={usuario.uid}
            onSaved={cargar}
            onBack={() => setEditando(null)}
        />
    );

    return (
        <ListaPlanos
            planes={planes}
            onSelect={p => setEditando(p)}
            onCreate={() => setEditando({})}
            onDelete={borrar}
            borrando={borrando}
        />
    );
}
