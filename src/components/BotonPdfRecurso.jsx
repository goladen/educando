import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatosDisponibles } from '../utils/pdfRecurso';

const ModalPdfRecurso = lazy(() => import('./ModalPdfRecurso'));

// ¿Se puede sacar una ficha en papel de este recurso?
export const tienePdf = (r) => !!r && (r.tipoJuego === 'LISTENING_RECURSO' || formatosDisponibles(r).length > 0);

// Botón «📄 PDF» autónomo para cualquier lista de recursos de los juegos:
// abre la ficha en papel del recurso (ModalPdfRecurso). No se pinta si el recurso no da para ficha.
//   recurso: documento de `resources` (con id)   texto: etiqueta (por defecto «PDF»)
//   style: estilos extra del botón               conSoluciones: mostrar la opción de soluciones
//   enLinea: se pinta como <span role="button"> para poder ir DENTRO de una tarjeta que ya es un <button>
export default function BotonPdfRecurso({ recurso, texto = 'PDF', style, title = 'Ficha en PDF para imprimir', conSoluciones = true, enLinea = false }) {
    const [abierto, setAbierto] = useState(false);
    if (!tienePdf(recurso)) return null;
    const Tag = enLinea ? 'span' : 'button';
    const abrir = (e) => { e.stopPropagation(); e.preventDefault(); setAbierto(true); };
    return (
        <>
            <Tag
                {...(enLinea
                    ? { role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') abrir(e); } }
                    : { type: 'button' })}
                title={title}
                onClick={abrir}
                style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#EDE7F6', color: '#6D28D9', fontWeight: 800, fontSize: '0.78rem',
                    fontFamily: 'inherit', flexShrink: 0, ...style,
                }}>
                📄{texto ? ` ${texto}` : ''}
            </Tag>
            {/* Portal: las tarjetas suelen ser clicables o tener overflow/transform */}
            {abierto && createPortal(
                <Suspense fallback={null}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <ModalPdfRecurso recurso={recurso} conSoluciones={conSoluciones} onClose={() => setAbierto(false)} />
                    </div>
                </Suspense>,
                document.body,
            )}
        </>
    );
}
