import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Search, RefreshCw } from 'lucide-react';
import { INTERESES, ms } from '../hooks/useNotificacionesProfesor';
import { inferirIntereses, textoRecurso } from '../utils/inferirIntereses';

// ─────────────────────────────────────────────────────────────────────────────
// Panel del administrador dentro de la campana (BuzonNovedades): lista de
// usuarios (colección `users`) con buscador y filtros, y selección de los que
// recibirán un mensaje personal (colección `mensajes_admin`).
// Los profes que no han marcado intereses reciben unos DEDUCIDOS de sus
// «temas preferidos» del alta o, si no, de sus recursos (utils/inferirIntereses).
// ─────────────────────────────────────────────────────────────────────────────

const limpiar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const nombreUsuario = (u) => u.nombre || u.displayName || (u.email ? u.email.split('@')[0] : 'Sin nombre');

export default function AdminUsuariosPanel({ seleccion, setSeleccion, onEscribir }) {
    const [usuarios, setUsuarios] = useState(null);
    const [error, setError] = useState('');
    const [texto, setTexto] = useState('');
    const [rol, setRol] = useState('profesor');
    const [interes, setInteres] = useState('');
    const [soloSel, setSoloSel] = useState(false);
    const [deducidos, setDeducidos] = useState({});      // uid → { ids, origen }
    const [deduciendo, setDeduciendo] = useState(false);

    const cargar = async () => {
        setUsuarios(null); setError('');
        try {
            const snap = await getDocs(collection(db, 'users'));
            const lista = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
                .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
            setUsuarios(lista);
            deducir(lista);
        } catch (e) { setError('No se pudieron cargar los usuarios: ' + e.message); setUsuarios([]); }
    };

    // Intereses deducidos para los profes que no han marcado ninguno
    const deducir = async (lista) => {
        const res = {};
        const sinDatos = [];
        lista.filter(u => u.role !== 'alumno' && !(u.intereses || []).length).forEach(u => {
            const ids = inferirIntereses(u.temasPreferidos);
            if (ids.length) res[u.uid] = { ids: ids.slice(0, 2), origen: 'perfil' };
            else sinDatos.push(u.uid);
        });
        setDeducidos({ ...res });
        if (!sinDatos.length) return;
        setDeduciendo(true);
        try {
            // Sus recursos, en tandas de 30 (límite del operador 'in')
            const textos = {};
            for (let i = 0; i < sinDatos.length; i += 30) {
                const snap = await getDocs(query(collection(db, 'resources'), where('profesorUid', 'in', sinDatos.slice(i, i + 30))));
                snap.docs.forEach(d => {
                    const r = d.data();
                    (textos[r.profesorUid] = textos[r.profesorUid] || []).push(textoRecurso(r));
                });
            }
            sinDatos.forEach(uid => {
                const ids = inferirIntereses(textos[uid] || []);
                if (ids.length) res[uid] = { ids: ids.slice(0, 2), origen: 'recursos' };
            });
            setDeducidos({ ...res });
        } catch (e) { console.error('[AdminUsuarios] deducir intereses:', e); }
        setDeduciendo(false);
    };

    // Intereses con los que se filtra y se pinta a cada usuario
    const interesesDe = (u) => {
        if ((u.intereses || []).length) return { ids: u.intereses, origen: 'declarado' };
        return deducidos[u.uid] || { ids: [], origen: null };
    };
    useEffect(() => { cargar(); }, []);

    const filtrados = useMemo(() => {
        const t = limpiar(texto);
        return (usuarios || []).filter(u => {
            if (soloSel && !seleccion[u.uid]) return false;
            if (rol === 'profesor' && u.role === 'alumno') return false;
            if (rol === 'alumno' && u.role !== 'alumno') return false;
            const { ids } = interesesDe(u);
            if (interes === '_ninguno' && ids.length) return false;
            if (interes && interes !== '_ninguno' && !ids.includes(interes)) return false;
            if (t && ![nombreUsuario(u), u.email, u.poblacion, u.region, u.pais].some(x => limpiar(x).includes(t))) return false;
            return true;
        });
    }, [usuarios, texto, rol, interes, soloSel, seleccion, deducidos]); // eslint-disable-line react-hooks/exhaustive-deps

    const nSel = Object.keys(seleccion).length;
    const toggle = (u) => setSeleccion(prev => {
        const n = { ...prev };
        if (n[u.uid]) delete n[u.uid]; else n[u.uid] = nombreUsuario(u);
        return n;
    });
    const seleccionarVisibles = () => setSeleccion(prev => {
        const n = { ...prev };
        filtrados.forEach(u => { n[u.uid] = nombreUsuario(u); });
        return n;
    });

    const chip = (on) => ({ background: on ? '#1565C0' : 'white', color: on ? 'white' : '#546e7a', border: `1.5px solid ${on ? '#1565C0' : '#d9e2ec'}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 });
    const btn = { background: 'white', color: '#1565C0', border: '1.5px solid #cfe0f5', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' };

    return (
        <div style={{ padding: '12px 20px', background: '#f7f9fc', borderBottom: '2px dashed #90caf9', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '52vh' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #d9e2ec', borderRadius: 9, padding: '6px 10px' }}>
                    <Search size={15} color="#90a4ae" />
                    <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nombre, email o localidad…"
                        style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.85rem', fontFamily: 'inherit', minWidth: 0 }} />
                </div>
                <select value={rol} onChange={e => setRol(e.target.value)} style={{ border: '1.5px solid #d9e2ec', borderRadius: 9, padding: '6px 8px', fontSize: '0.8rem', background: 'white' }}>
                    <option value="profesor">Profesores</option>
                    <option value="alumno">Alumnos</option>
                    <option value="">Todos</option>
                </select>
                <button onClick={cargar} title="Recargar" style={{ ...btn, padding: '6px 8px', display: 'flex' }}><RefreshCw size={14} /></button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button onClick={() => setInteres('')} style={chip(!interes)}>Todos los intereses</button>
                {INTERESES.map(i => (
                    <button key={i.id} onClick={() => setInteres(v => v === i.id ? '' : i.id)} style={chip(interes === i.id)}>{i.emoji} {i.label}</button>
                ))}
                <button onClick={() => setInteres(v => v === '_ninguno' ? '' : '_ninguno')} style={chip(interes === '_ninguno')}>❔ Sin datos</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '0.78rem', color: '#546e7a' }}>
                <span><b>{filtrados.length}</b> {usuarios ? `de ${usuarios.length}` : ''} usuarios{deduciendo && ' · deduciendo intereses…'}</span>
                <button onClick={seleccionarVisibles} disabled={!filtrados.length} style={btn}>Seleccionar visibles</button>
                {nSel > 0 && <button onClick={() => setSoloSel(v => !v)} style={{ ...btn, background: soloSel ? '#e3f0fd' : 'white' }}>{soloSel ? 'Ver todos' : `Ver seleccionados`}</button>}
                {nSel > 0 && <button onClick={() => { setSeleccion({}); setSoloSel(false); }} style={{ ...btn, color: '#e74c3c', borderColor: '#f3c9c4' }}>Limpiar</button>}
                <button onClick={onEscribir} disabled={!nSel}
                    style={{ marginLeft: 'auto', background: nSel ? '#1565C0' : '#b0bec5', color: 'white', border: 'none', borderRadius: 8, padding: '6px 13px', cursor: nSel ? 'pointer' : 'default', fontWeight: 700, fontSize: '0.8rem' }}>
                    ✉️ Escribir a {nSel}
                </button>
            </div>

            <div style={{ overflowY: 'auto', background: 'white', borderRadius: 10, border: '1px solid #e3e9f0', minHeight: 80 }}>
                {error && <div style={{ padding: 12, color: '#c0392b', fontSize: '0.82rem' }}>{error}</div>}
                {!usuarios && !error && <div style={{ padding: 16, color: '#90a4ae', fontSize: '0.84rem', textAlign: 'center' }}>Cargando usuarios…</div>}
                {usuarios && !filtrados.length && !error && <div style={{ padding: 16, color: '#90a4ae', fontSize: '0.84rem', textAlign: 'center' }}>Ningún usuario con esos filtros.</div>}
                {filtrados.map(u => {
                    const on = !!seleccion[u.uid];
                    const lugar = [u.poblacion, u.region].filter(Boolean).join(', ');
                    const alta = ms(u.createdAt);
                    return (
                        <label key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f4f8', cursor: 'pointer', background: on ? '#eef5ff' : 'white' }}>
                            <input type="checkbox" checked={on} onChange={() => toggle(u)} />
                            {u.photoURL
                                ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                                : <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#e3f0fd', color: '#1565C0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{nombreUsuario(u)[0]?.toUpperCase()}</span>}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#2c3e50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {nombreUsuario(u)} {u.role === 'alumno' && <span style={{ fontSize: '0.68rem', color: '#8e44ad' }}>· alumno</span>}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#90a4ae', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.email}{lugar ? ` · ${lugar}` : ''}{alta ? ` · alta ${new Date(alta).toLocaleDateString('es-ES')}` : ''}
                                </div>
                            </div>
                            <IconosInteres {...interesesDe(u)} esAlumno={u.role === 'alumno'} />
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

// Emojis de interés: los marcados por el profe, enteros; los deducidos, en
// tenue y con el origen en el título; sin nada, ❔.
const ORIGEN = { perfil: 'deducido de sus temas preferidos', recursos: 'deducido de sus recursos' };
function IconosInteres({ ids, origen, esAlumno }) {
    if (esAlumno) return null;
    const nombres = ids.map(id => INTERESES.find(i => i.id === id)?.label).filter(Boolean).join(', ');
    if (!ids.length) return <span title="Sin intereses ni datos para deducirlos" style={{ fontSize: '0.85rem', opacity: 0.5, flexShrink: 0 }}>❔</span>;
    return (
        <span title={origen === 'declarado' ? nombres : `${nombres} (${ORIGEN[origen]})`}
            style={{ fontSize: '0.85rem', flexShrink: 0, opacity: origen === 'declarado' ? 1 : 0.55, display: 'flex', alignItems: 'center', gap: 2 }}>
            {ids.map(id => INTERESES.find(i => i.id === id)?.emoji).join('')}
            {origen !== 'declarado' && <span style={{ fontSize: '0.62rem', color: '#90a4ae', fontWeight: 700 }}>≈</span>}
        </span>
    );
}
