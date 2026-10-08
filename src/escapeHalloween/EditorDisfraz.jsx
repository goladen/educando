import React from 'react';
import { DISFRACES, COLORES_DISFRAZ, ACCESORIOS, AVATAR_POR_DEFECTO, disfrazDe } from './avatares3d';
import { AvatarPreview3D } from './Mansion3D';

const CLAVE_LS = 'pikt_escape_avatar';

export function leerAvatarGuardado() {
    try { const a = JSON.parse(localStorage.getItem(CLAVE_LS) || 'null'); if (a?.disfraz) return a; } catch { /* sin almacenamiento */ }
    return null;
}
export function guardarAvatar(a) {
    try { localStorage.setItem(CLAVE_LS, JSON.stringify(a)); } catch { /* sin almacenamiento */ }
}
export const avatarAleatorio = () => ({
    disfraz: DISFRACES[Math.floor(Math.random() * DISFRACES.length)].id,
    color: null,
    accesorio: ACCESORIOS[1 + Math.floor(Math.random() * (ACCESORIOS.length - 1))].id,
});

/** Editor del disfraz de Halloween del alumno (vista previa 3D). */
export default function EditorDisfraz({ avatar, onChange, onListo, textoListo = '🚪 ¡Listo, a la mansión!', nombre }) {
    const a = avatar || AVATAR_POR_DEFECTO;
    const def = disfrazDe(a.disfraz);
    const set = (cambios) => { const n = { ...a, ...cambios }; guardarAvatar(n); onChange(n); };
    const titulo = { fontWeight: 800, fontSize: '.9rem', margin: '14px 0 6px' };
    return (
        <div className="eh-panel eh-aparece" style={{ padding: 18 }}>
            <h2 className="eh-titulo" style={{ fontSize: '1.9rem', textAlign: 'center' }}>Elige tu disfraz</h2>
            <div style={{ position: 'relative' }}>
                <AvatarPreview3D avatar={a} size={210} />
                {nombre && <div style={{ textAlign: 'center', fontWeight: 800, marginTop: -6 }}>{def.emoji} {nombre}</div>}
                <button className="eh-btn2" style={{ position: 'absolute', top: 4, right: 4, padding: '6px 10px' }} title="Disfraz al azar"
                    onClick={() => set(avatarAleatorio())}>🎲</button>
            </div>

            <div style={titulo}>🎭 Disfraz</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(82px,1fr))', gap: 6 }}>
                {DISFRACES.map(d => (
                    <button key={d.id} className={`eh-chip ${a.disfraz === d.id ? 'on' : ''}`} style={{ padding: '8px 4px', fontSize: '.78rem' }}
                        onClick={() => set({ disfraz: d.id, color: null })}>
                        <div style={{ fontSize: '1.6rem' }}>{d.emoji}</div>{d.nombre}
                    </button>
                ))}
            </div>

            <div style={titulo}>🎨 Color del disfraz</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className={`eh-chip ${!a.color ? 'on' : ''}`} style={{ padding: '6px 10px', fontSize: '.8rem' }} onClick={() => set({ color: null })}>Original</button>
                {COLORES_DISFRAZ.map(c => (
                    <button key={c} aria-label={c} onClick={() => set({ color: c })}
                        style={{ width: 34, height: 34, borderRadius: '50%', background: c, cursor: 'pointer', border: a.color === c ? '3px solid #ff8c1a' : '2px solid rgba(255,255,255,.35)', boxShadow: a.color === c ? '0 0 10px #ff8c1a' : 'none' }} />
                ))}
            </div>

            <div style={titulo}>🎒 En la mano</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ACCESORIOS.map(x => (
                    <button key={x.id} className={`eh-chip ${a.accesorio === x.id ? 'on' : ''}`} style={{ padding: '7px 10px', fontSize: '.82rem' }} onClick={() => set({ accesorio: x.id })}>
                        {x.emoji} {x.nombre}
                    </button>
                ))}
            </div>

            {onListo && <button className="eh-btn" style={{ width: '100%', marginTop: 18 }} onClick={() => { guardarAvatar(a); onListo(a); }}>{textoListo}</button>}
        </div>
    );
}
