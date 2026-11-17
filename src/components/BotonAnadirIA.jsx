// Botón flotante «🤖 Añadir con IA» sobre los editores de un recurso ya creado.
// Reutiliza ModalCrearIA (automática o copiar prompt + pegar respuesta) y deja elegir
// si las preguntas van a una hoja existente o a una hoja nueva con el nombre que se ponga.
// Las preguntas se convierten al formato del editor con aComun/aDestino (como «Importar preguntas»).
import { useState } from 'react';
import ModalCrearIA from './ModalCrearIA';
import { JUEGOS_IA } from '../iaRecursos';
import { aComun, aDestino } from './ImportarPreguntas';

// Tipo de recurso → generador de IA que produce su formato
const TIPO_IA = { PIKATRON: 'CAZABURBUJAS' };
export const tipoIAde = (tipoJuego) => {
    const t = String(tipoJuego || '').toUpperCase();
    const k = TIPO_IA[t] || t;
    return JUEGOS_IA[k] && k !== 'PROBLEMAS_FQ' ? k : null;
};

/**
 * onAnadir(destino, nombreNueva, preguntas, extraHoja)
 *   destino: índice de hoja | 'nueva' · extraHoja: { frasesOcultas } en La Ruleta
 */
export default function BotonAnadirIA({ tipoJuego, hojas = [], maxHojas = 99, onAnadir, estilo, zIndex = 7000 }) {
    const [abierto, setAbierto] = useState(false);
    const tipoIA = tipoIAde(tipoJuego);
    if (!tipoIA) return null;

    const recibir = (hojasIA, { destino, nombreNueva }) => {
        const crudas = hojasIA.flatMap(h => h.preguntas || []);
        const comunes = crudas.map(aComun).filter(Boolean);
        const pool = comunes.map(c => c.respuesta);
        const preguntas = comunes.map(c => aDestino(c, tipoJuego, pool));
        const frases = (hojasIA[0]?.frasesOcultas || []).filter(Boolean);
        onAnadir(destino, nombreNueva, preguntas, frases.length ? { frasesOcultas: frases } : {});
        setAbierto(false);
        alert(`✅ ${preguntas.length} añadida${preguntas.length === 1 ? '' : 's'} ${destino === 'nueva' ? `en la hoja nueva «${nombreNueva}»` : `a la hoja «${hojas[destino]?.nombreHoja || `Hoja ${destino + 1}`}»`}.\nRevísalas y pulsa Guardar para quedártelas.`);
    };

    return (
        <>
            <button onClick={() => setAbierto(true)} title="Generar más preguntas con IA (o pegando la respuesta de tu IA) y añadirlas a una hoja"
                style={{ position: 'fixed', left: 16, bottom: 116, zIndex, border: 'none', borderRadius: 99, padding: '11px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#fff', background: 'linear-gradient(135deg,#7e57c2,#673AB7)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)', fontFamily: 'system-ui, sans-serif', ...estilo }}>
                🤖 Añadir con IA
            </button>
            {abierto && (
                <ModalCrearIA tipo={tipoIA} hojasDestino={hojas} maxHojas={maxHojas} zIndex={10060}
                    onClose={() => setAbierto(false)} onGenerado={recibir} />
            )}
        </>
    );
}
