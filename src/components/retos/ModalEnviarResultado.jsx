import React, { useState } from 'react';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { guardarRegistroLocal } from '../../utils/registrosLocales';
import ModalEnviarCompeticion from '../ModalEnviarCompeticion';

/**
 * Envío genérico del resultado de un reto por enlace (para juegos sin modal propio).
 *  · Reto de competición (&comp=…&cat=…) → ModalEnviarCompeticion con `puntos`.
 *  · Si no → informes_juegos { tipo, jugadores:[{ nombre, curso, ...datos, reto }] }.
 *
 *  <ModalEnviarResultado tipo="QUIEN_HISTORICO" nombreJuego="¿Quién es quién?" reto={reto}
 *      datos={{ puntos, aciertos, intentos }} onClose={…} />
 */
export default function ModalEnviarResultado({ tipo, nombreJuego, reto = null, datos = {}, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    if (reto?.compId && reto?.catId) return (
        <ModalEnviarCompeticion compId={reto.compId} catId={reto.catId} puntos={datos.puntos ?? datos.aciertos ?? 0}
            detalle={datos} nombreJuego={nombreJuego} tituloReto={reto.titulo || ''} onClose={onClose} />
    );

    const porcentaje = datos.porcentaje ?? (datos.intentos ? Math.round(((datos.aciertos || 0) / datos.intentos) * 100) : undefined);

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo, modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(), ...datos,
                    ...(porcentaje !== undefined ? { porcentaje } : {}),
                    ...(reto ? { reto: reto.titulo || 'Reto' } : {}),
                }],
            });
            guardarRegistroLocal(tipo, {
                titulo: nombreJuego, aciertos: datos.aciertos ?? datos.puntos ?? 0, intentos: datos.intentos ?? 0,
                porcentaje, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e0e4f0', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    const lbl = { fontSize: '0.78rem', color: '#7f8c8d', fontWeight: 600, display: 'block', marginBottom: 4 };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(8,12,24,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.05rem' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '18px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#27ae60', fontWeight: 700 }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ marginTop: 14, padding: '9px 22px', borderRadius: 10, border: 'none', background: '#f0f0f0', cursor: 'pointer' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '10px 12px', fontSize: '0.85rem', color: '#34495e' }}>
                            {nombreJuego}{reto ? ` · 🎯 ${reto.titulo || 'Reto'}` : ''} — <strong>{datos.puntos ?? datos.aciertos ?? 0}</strong> {datos.puntos != null ? 'puntos' : 'aciertos'}
                        </div>
                        <div><label style={lbl}>Nombre y apellido</label><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
                        <div><label style={lbl}>Curso</label><input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp} /></div>
                        <div><label style={lbl}>Código del profesor</label><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#95a5a6' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
