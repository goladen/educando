import { Save, X } from 'lucide-react';

/**
 * PublicarModal — avisa al profesor cuando un recurso no está publicado.
 *
 * modo='guardar': intercepta el botón Guardar
 *   → "Guardar y publicar" | "Solo guardar" | "Cancelar"
 *
 * modo='cerrar': intercepta el botón Cerrar/Volver
 *   → (si !yaPublicado) "Guardar, publicar y salir" | "Guardar y salir" | "Salir sin guardar" | "Cancelar"
 *   → (si yaPublicado)  "Guardar y salir" | "Salir sin guardar" | "Cancelar"
 */
export default function PublicarModal({ modo, yaPublicado = false, onGuardarPublicar, onGuardarSolo, onSalirSinGuardar, onCancelar }) {
    const esCerrar = modo === 'cerrar';
    const mostrarPublicar = !yaPublicado;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#fff', borderRadius: '12px',
                padding: '28px 24px', width: '340px', maxWidth: '92vw',
                boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
                textAlign: 'center', position: 'relative',
            }}>
                <button
                    onClick={onCancelar}
                    style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1 }}
                >×</button>

                <div style={{ fontSize: 32, marginBottom: 8 }}>{esCerrar ? '⚠️' : '🔒'}</div>
                <h3 style={{ margin: '0 0 8px', color: '#1f2937', fontSize: 16 }}>
                    {esCerrar
                        ? (mostrarPublicar ? 'Recurso sin publicar' : '¿Guardar antes de salir?')
                        : '¿Publicar antes de guardar?'}
                </h3>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
                    {esCerrar
                        ? (mostrarPublicar
                            ? 'El recurso no está publicado. Tus alumnos no podrán acceder hasta que lo publiques.'
                            : 'Los cambios no guardados se perderán si sales ahora.')
                        : 'El recurso está en borrador. Puedes publicarlo ahora para que tus alumnos puedan acceder.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {esCerrar && mostrarPublicar && (
                        <button
                            onClick={onGuardarPublicar}
                            style={{ padding: '11px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                            <Save size={15} /> Guardar, publicar y salir
                        </button>
                    )}

                    {!esCerrar && (
                        <button
                            onClick={onGuardarPublicar}
                            style={{ padding: '11px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                            <Save size={15} /> Guardar y publicar
                        </button>
                    )}

                    <button
                        onClick={onGuardarSolo}
                        style={{ padding: '11px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                        <Save size={15} />
                        {esCerrar ? 'Guardar y salir' : 'Solo guardar'}
                    </button>

                    {esCerrar && (
                        <button
                            onClick={onSalirSinGuardar}
                            style={{ padding: '11px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                        >
                            Salir sin guardar
                        </button>
                    )}

                    <button
                        onClick={onCancelar}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, marginTop: 4, textDecoration: 'underline' }}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
