import { INTERESES } from '../hooks/useNotificacionesProfesor';

// Selector de intereses (materias de la página principal + «Otros» con texto
// libre). Lo usan el formulario de alta (App.jsx) y Mi perfil (UserProfile).
// Se guarda en users/{uid}.intereses (ids) e .interesesOtros (texto).
export default function SelectorIntereses({ intereses, setIntereses, otros, setOtros, otrosActivo, setOtrosActivo }) {
    const toggle = (id) => setIntereses(intereses.includes(id) ? intereses.filter(x => x !== id) : [...intereses, id]);
    const chip = (on) => ({
        background: on ? '#1565C0' : 'white', color: on ? 'white' : '#546e7a',
        border: `1.5px solid ${on ? '#1565C0' : '#d9e2ec'}`, borderRadius: 20, padding: '6px 12px',
        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
    });
    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {INTERESES.map(i => (
                    <button key={i.id} type="button" onClick={() => toggle(i.id)} style={chip(intereses.includes(i.id))}>
                        {i.emoji} {i.label}
                    </button>
                ))}
                <button type="button" onClick={() => setOtrosActivo(!otrosActivo)} style={chip(otrosActivo)}>✏️ Otros</button>
            </div>
            {otrosActivo && (
                <input value={otros} onChange={e => setOtros(e.target.value)} maxLength={200} autoFocus
                    placeholder="¿Qué otra materia o tema te interesa?"
                    style={{ width: '100%', marginTop: 8, padding: '9px 11px', borderRadius: 8, border: '1.5px solid #d9e2ec', fontSize: '0.88rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            )}
        </div>
    );
}

/** Texto legible de los intereses (se guarda también en temasPreferidos por compatibilidad). */
export const textoIntereses = (ids = [], otros = '') =>
    [...ids.map(id => INTERESES.find(i => i.id === id)?.label).filter(Boolean), String(otros || '').trim()].filter(Boolean).join(', ');
