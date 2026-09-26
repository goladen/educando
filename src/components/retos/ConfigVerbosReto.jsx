import React, { useState } from 'react';
import { VERBOS_IRREGULARES, DEFAULT_CONFIG_VERBOS, NIVELES_VERBOS, COLUMNAS_VERBOS, resumenVerbos } from '../../IrregularVerbsTest';
import { Chip, Seccion, NumeroPreguntas, MarcoConfig } from './ConfigChips';

const AZUL_V = '#0369a1';
const TIEMPOS = [[60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']];

// Reto de Irregular Verbs: nivel + nº de verbos (al azar) o verbos concretos, tiempo y columnas
export default function ConfigVerbosReto({ config, onAceptar, onClose }) {
    const [cfg, setCfg] = useState({ ...DEFAULT_CONFIG_VERBOS, ...(config || {}), verbos: config?.verbos || [] });
    const [elegir, setElegir] = useState((config?.verbos || []).length > 0);
    const [busqueda, setBusqueda] = useState('');
    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
    const toggleVerbo = (b) => setCfg(c => ({ ...c, verbos: c.verbos.includes(b) ? c.verbos.filter(x => x !== b) : [...c.verbos, b] }));

    const q = busqueda.trim().toLowerCase();
    const lista = q ? VERBOS_IRREGULARES.filter(v => `${v.baseForm} ${v.pastSimple} ${v.translation}`.toLowerCase().includes(q)) : VERBOS_IRREGULARES;

    const aceptar = () => {
        const final = { ...cfg, verbos: elegir ? cfg.verbos : [] };
        if (elegir && final.verbos.length === 0) return;
        onAceptar(final, resumenVerbos(final));
    };

    return (
        <MarcoConfig titulo="📝 Irregular Verbs — configuración del reto" color={AZUL_V} onClose={onClose} onAceptar={aceptar}>
            <Seccion label="Qué verbos">
                <Chip active={!elegir} onClick={() => setElegir(false)} color={AZUL_V}>🎲 Al azar por nivel</Chip>
                <Chip active={elegir} onClick={() => setElegir(true)} color={AZUL_V}>📌 Elegir los verbos</Chip>
            </Seccion>

            {!elegir ? (<>
                <Seccion label="Nivel">
                    {NIVELES_VERBOS.map(([v, l]) => <Chip key={v} active={cfg.level === v} onClick={() => set('level', v)} color={AZUL_V}>{l}</Chip>)}
                </Seccion>
                <Seccion label="Número de verbos">
                    <NumeroPreguntas valor={cfg.numVerbs} onChange={v => set('numVerbs', v)} opciones={[5, 10, 15, 20]} color={AZUL_V} />
                </Seccion>
            </>) : (
                <Seccion label={`Verbos elegidos: ${cfg.verbos.length}`}>
                    <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar verbo o traducción…"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto', justifyContent: 'center' }}>
                        {lista.map(v => (
                            <button key={v.baseForm} onClick={() => toggleVerbo(v.baseForm)} title={`${v.pastSimple} · ${v.pastParticiple} · ${v.translation}`}
                                style={{ padding: '5px 11px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700,
                                    border: `1.5px solid ${cfg.verbos.includes(v.baseForm) ? AZUL_V : '#cbd5e1'}`,
                                    background: cfg.verbos.includes(v.baseForm) ? AZUL_V : 'white', color: cfg.verbos.includes(v.baseForm) ? 'white' : '#334155' }}>
                                {v.baseForm}
                            </button>
                        ))}
                    </div>
                    {cfg.verbos.length === 0 && <div style={{ color: '#e67e22', fontSize: '0.78rem', marginTop: 6, width: '100%', textAlign: 'center' }}>Marca al menos un verbo.</div>}
                </Seccion>
            )}

            <Seccion label="Columnas a evaluar">
                {COLUMNAS_VERBOS.map(([v, l]) => <Chip key={v} active={cfg.columnsMode === v} onClick={() => set('columnsMode', v)} color={AZUL_V}>{l}</Chip>)}
            </Seccion>
            <Seccion label="Tiempo">
                {TIEMPOS.map(([t, l]) => <Chip key={t} active={cfg.timeLimit === t} onClick={() => set('timeLimit', t)} color={AZUL_V}>{l}</Chip>)}
            </Seccion>
        </MarcoConfig>
    );
}
