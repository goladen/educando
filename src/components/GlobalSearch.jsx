import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // Asegúrate de que la ruta sea correcta
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Search, RotateCcw, Copy, Users, Eye } from 'lucide-react';

export default function GlobalSearch({ usuario, onCopy, tiposJuegos, onInspect }) {
    const [busqueda, setBusqueda] = useState('');
    const [appFiltro, setAppFiltro] = useState('TODAS');
    const [resultados, setResultados] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [todosLosRecursos, setTodosLosRecursos] = useState([]);

    // Cargar TODOS los recursos públicos al montar (para filtrar en cliente, 
    // ya que Firestore no permite buscar en múltiples campos a la vez fácilmente)
    useEffect(() => {
        const cargarTodo = async () => {
            setCargando(true);
            try {
                const q = query(collection(db, "resources"), where("isPrivate", "==", false));
                const snap = await getDocs(q);
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                setTodosLosRecursos(docs);
                setResultados(docs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0)));
            } catch (e) {
                console.error("Error cargando biblioteca global:", e);
            }
            setCargando(false);
        };
        cargarTodo();
    }, []);

    // Lógica de filtrado
    useEffect(() => {
        let filtrados = todosLosRecursos;

        // 1. Filtro por App
        if (appFiltro !== 'TODAS') {
            filtrados = filtrados.filter(r => r.tipoJuego === appFiltro);
        }

        // 2. Filtro por Texto (Título, Temas, Hojas)
        if (busqueda.trim()) {
            const lowerQ = busqueda.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            filtrados = filtrados.filter(r => {
                const tituloMatch = r.titulo?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerQ);
                const temasMatch = r.temas?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerQ);

                // Buscar dentro de los nombres de las hojas
                const hojasMatch = r.hojas?.some(h =>
                    h.nombreHoja?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerQ)
                );

                return tituloMatch || temasMatch || hojasMatch;
            });
        }

        // 3. Ordenar por PlayCount
        filtrados.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

        setResultados(filtrados);
    }, [busqueda, appFiltro, todosLosRecursos]);

    const btnStyle = (bg, color) => ({ flex: 1, padding: '8px', background: bg, color: color, border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontWeight: 'bold' });

    return (
        <div style={{ padding: '20px', background: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <h2 style={{ color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Search size={28} /> Buscador Global de Recursos
            </h2>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555', fontSize: '12px' }}>Término de búsqueda:</label>
                    <input
                        placeholder="Ej: Ecuaciones, Historia, Inglés..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                    />
                </div>

                <div style={{ width: '200px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555', fontSize: '12px' }}>Filtrar por Aplicación:</label>
                    <select
                        value={appFiltro}
                        onChange={e => setAppFiltro(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', cursor: 'pointer' }}
                    >
                        <option value="TODAS">Todas las Aplicaciones</option>
                        {Object.values(tiposJuegos).map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {cargando ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Cargando biblioteca...</div>
            ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {resultados.map((r) => {
                            const appInfo = tiposJuegos[r.tipoJuego] || { color: '#999', label: r.tipoJuego };
                            return (
                                <div key={r.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: `6px solid ${appInfo.color}`, position: 'relative', border: '1px solid #eee' }}>
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#f1c40f', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Users size={12} /> {r.playCount || 0}
                                    </div>
                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: appInfo.color, fontWeight: 'bold', marginBottom: '5px' }}>
                                        {appInfo.label} {r.tipo === 'PRO' && '🔥 PRO'}
                                    </div>
                                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: '#333' }}>{r.titulo}</h3>
                                    <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 15px 0' }}>Prof: {r.profesorNombre}</p>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => onInspect(r)} style={btnStyle('#eee', '#333')}><Eye size={16} /> Ver</button>
                                        {r.profesorUid !== usuario.uid && (
                                            <button onClick={() => onCopy(r)} style={btnStyle('#27ae60', 'white')}><Copy size={16} /> Copiar</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {resultados.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>
                                No se encontraron recursos con "{busqueda}".
                        </div>
                        )}
                    </div>
                )}
        </div>
    );
}