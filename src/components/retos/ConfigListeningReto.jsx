import React, { useState } from 'react';
import { IDIOMAS_LISTENING, getItems } from '../../listeningIdiomas';
import { DEFAULT_RETO_LIS, resumenListening } from '../../ListeningGame';
import { Chip, Seccion, MarcoConfig } from './ConfigChips';

const MORADO_L = '#8E44AD';
const limpiar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Reto de Listening: idioma + audio concreto + elegir o escribir
export default function ConfigListeningReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_RETO_LIS, ...(config || {}) });
    const [busqueda, setBusqueda] = useState('');
    const items = getItems(cfg.idioma);
    const q = limpiar(busqueda.trim());
    const lista = q ? items.filter(it => limpiar(`${it.titulo} ${it.topic} ${it.nivel || ''}`).includes(q)) : items;

    const cambiarIdioma = (id) => setCfg(c => ({ ...c, idioma: id, itemId: getItems(id)[0]?.id }));

    return (
        <MarcoConfig titulo="🎧 Listening — configuración del reto" color={MORADO_L}
            onClose={onClose} onAceptar={() => onAceptar(cfg, resumenListening(cfg))}>
            <Seccion label="Idioma">
                {Object.values(IDIOMAS_LISTENING).map(i => (
                    <Chip key={i.id} active={cfg.idioma === i.id} onClick={() => cambiarIdioma(i.id)} color={MORADO_L}>{i.flag} {i.label}</Chip>
                ))}
            </Seccion>

            <Seccion label={`Audio (${items.length})`}>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar tema…"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxHeight: 220, overflowY: 'auto' }}>
                    {lista.map(it => (
                        <button key={it.id} onClick={() => setCfg(c => ({ ...c, itemId: it.id }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                                border: `2px solid ${cfg.itemId === it.id ? MORADO_L : '#e2e8f0'}`, background: cfg.itemId === it.id ? '#f5eefa' : 'white' }}>
                            <span style={{ flex: 1, fontWeight: 700, color: '#2c3e50', fontSize: '0.88rem' }}>{it.titulo}</span>
                            {it.nivel && <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700 }}>{it.nivel}</span>}
                            <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{it.gaps?.length || 0} huecos</span>
                        </button>
                    ))}
                    {lista.length === 0 && <div style={{ color: '#95a5a6', textAlign: 'center', padding: 14, fontSize: '0.85rem' }}>Ningún tema coincide.</div>}
                </div>
            </Seccion>

            <Seccion label="Cómo responde el alumno">
                <Chip active={cfg.modo !== 'write'} onClick={() => setCfg(c => ({ ...c, modo: 'multiple' }))} color={MORADO_L}>🔘 Elegir entre 4 opciones</Chip>
                <Chip active={cfg.modo === 'write'} onClick={() => setCfg(c => ({ ...c, modo: 'write' }))} color={MORADO_L}>✍️ Escribir (rellenar)</Chip>
            </Seccion>
        </MarcoConfig>
    );
}
