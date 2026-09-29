import { useState } from 'react';
import AvatarSVG from './AvatarSVG';
import { AVATAR_OPCIONES, normalizarAvatar, avatarAleatorio } from '../../utils/avatarLocal';

// Editor de avatar por pestañas. Tema oscuro, pensado para caber en los modales
// de la landing (Mis registros) y en móvil.

const PESTANAS = [
    { id: 'personaje', label: '🦊 Personaje' },
    { id: 'pelo',      label: '💇 Pelo' },
    { id: 'cara',      label: '😀 Cara' },
    { id: 'ropa',      label: '👕 Ropa' },
    { id: 'extras',    label: '🎩 Extras' },
    { id: 'fondo',     label: '🌌 Fondo' },
];

// Al cambiar de personaje se aplica también su color característico.
const aplicarOpcion = (avatar, campo, op) =>
    campo === 'base' ? { ...avatar, base: op.id, piel: op.piel } : { ...avatar, [campo]: op.id };

const MOODS = [
    { id: 'neutral', emoji: '😐', label: 'Normal' },
    { id: 'happy',   emoji: '😄', label: 'Acierto' },
    { id: 'angry',   emoji: '😠', label: 'Fallo' },
];

function Titulo({ children }) {
    return <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#9aa4ad', textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 7px' }}>{children}</div>;
}

// Rejilla de opciones con miniatura del avatar aplicando cada opción.
function OpcionesAvatar({ campo, avatar, onAplicar }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(66px, 1fr))', gap: 8 }}>
            {AVATAR_OPCIONES[campo].map((op) => {
                const activo = avatar[campo] === op.id;
                const variante = aplicarOpcion(avatar, campo, op);
                return (
                    <button key={op.id} onClick={() => onAplicar(variante)} title={op.label} style={{
                        background: activo ? 'rgba(241,196,15,0.18)' : 'rgba(255,255,255,0.06)',
                        border: `2px solid ${activo ? '#f1c40f' : 'transparent'}`, borderRadius: 12,
                        padding: '6px 4px 5px', cursor: 'pointer', color: 'white',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}>
                        <AvatarSVG config={variante} size={52} style={{ borderRadius: '50%' }} />
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.1 }}>{op.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function Muestras({ campo, avatar, onElegir }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AVATAR_OPCIONES[campo].map((color) => {
                const activo = avatar[campo] === color;
                return (
                    <button key={color} onClick={() => onElegir(campo, color)} aria-label={color} style={{
                        width: 32, height: 32, borderRadius: '50%', background: color, cursor: 'pointer',
                        border: activo ? '3px solid #f1c40f' : '2px solid rgba(255,255,255,0.25)',
                        boxShadow: activo ? '0 0 0 2px #1e272e inset' : 'none',
                    }} />
                );
            })}
        </div>
    );
}

export default function AvatarEditor({ inicial, onGuardar, onCancelar }) {
    const [avatar, setAvatar] = useState(() => normalizarAvatar(inicial || avatarAleatorio()));
    const [pestana, setPestana] = useState('personaje');
    const [mood, setMood] = useState('neutral');

    const elegir = (campo, valor) => setAvatar((a) => ({ ...a, [campo]: valor }));
    const esPersona = avatar.base === 'persona';
    const conCrin = avatar.base === 'unicornio';
    const opciones = (campo) => <OpcionesAvatar campo={campo} avatar={avatar} onAplicar={setAvatar} />;
    const muestras = (campo) => <Muestras campo={campo} avatar={avatar} onElegir={elegir} />;

    return (
        <div>
            {/* Vista previa + prueba de reacciones */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                <AvatarSVG config={avatar} size={110} mood={mood} animado style={{ borderRadius: '50%', boxShadow: '0 8px 24px rgba(0,0,0,0.45)', border: '3px solid rgba(255,255,255,0.8)' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.78rem', color: '#9aa4ad' }}>Así reaccionará en los juegos:</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {MOODS.map((m) => (
                            <button key={m.id} onClick={() => setMood(m.id)} title={m.label} style={{
                                flex: 1, padding: '6px 0', borderRadius: 9, cursor: 'pointer', fontSize: '1.1rem',
                                background: mood === m.id ? 'rgba(241,196,15,0.2)' : 'rgba(255,255,255,0.08)',
                                border: `1px solid ${mood === m.id ? '#f1c40f' : 'rgba(255,255,255,0.15)'}`,
                            }}>{m.emoji}</button>
                        ))}
                    </div>
                    <button onClick={() => setAvatar(avatarAleatorio())} style={{
                        padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem',
                    }}>🎲 Aleatorio</button>
                </div>
            </div>

            {/* Pestañas */}
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4 }}>
                {PESTANAS.map((p) => (
                    <button key={p.id} onClick={() => setPestana(p.id)} style={{
                        flexShrink: 0, padding: '6px 11px', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
                        background: pestana === p.id ? '#f1c40f' : 'rgba(255,255,255,0.08)',
                        color: pestana === p.id ? '#1e272e' : 'white', border: 'none',
                    }}>{p.label}</button>
                ))}
            </div>

            <div style={{ maxHeight: '38vh', overflowY: 'auto', paddingRight: 2 }}>
                {pestana === 'personaje' && <>
                    <Titulo>Personaje</Titulo>
                    {opciones('base')}
                    <Titulo>{esPersona ? 'Tono de piel' : 'Color'}</Titulo>
                    {muestras('piel')}
                </>}
                {pestana === 'pelo' && (esPersona || conCrin ? <>
                    {esPersona && <><Titulo>Peinado</Titulo>{opciones('pelo')}</>}
                    <Titulo>{conCrin ? 'Color de la crin' : 'Color del pelo'}</Titulo>
                    {muestras('colorPelo')}
                </> : (
                    <div style={{ padding: '22px 8px', textAlign: 'center', color: '#9aa4ad', fontSize: '0.86rem' }}>
                        El peinado está disponible para <b>Persona</b> (y la crin para <b>Unicornio</b>).
                    </div>
                ))}
                {pestana === 'cara' && <>
                    <Titulo>Ojos</Titulo>
                    {opciones('ojos')}
                    <Titulo>Color de ojos</Titulo>
                    {muestras('colorOjos')}
                    <Titulo>Boca</Titulo>
                    {opciones('boca')}
                </>}
                {pestana === 'ropa' && <>
                    <Titulo>Estilo</Titulo>
                    {opciones('ropaTipo')}
                    <Titulo>Color</Titulo>
                    {muestras('ropa')}
                </>}
                {pestana === 'extras' && <>
                    <Titulo>Complemento</Titulo>
                    {opciones('accesorio')}
                </>}
                {pestana === 'fondo' && <>
                    <Titulo>Estampado</Titulo>
                    {opciones('patron')}
                    <Titulo>Color</Titulo>
                    {muestras('fondo')}
                </>}
            </div>

            <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={onCancelar} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => onGuardar(avatar)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#27ae60', color: 'white', cursor: 'pointer', fontWeight: 800 }}>✔ Guardar avatar</button>
            </div>
        </div>
    );
}
