// ═══════════════════════════════════════════════════════════════════
//  PARTIDA FIJA (modo pizarra + fichas en papel)
//  Congela las preguntas y los candados de un escape room para que lo que se proyecta
//  y lo que se imprime (cuadernillo y hoja de respuestas) sea exactamente lo mismo.
//  Se guarda dentro de la configuración: config.partida = { firma, creada, pruebas:[{preguntas, candado}], batalla:[…] }
// ═══════════════════════════════════════════════════════════════════
import { generarPregunta, generarCandado, materiaDePrueba, temaDePrueba, ORDEN_SALAS, pick, tienePreguntas, preguntaDePrueba } from './bancoEscape';
import { candadoRecurso } from './recursosEscape';

export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const PREGUNTAS_POR_SALA = [4, 5, 6, 8, 10];
export const PREGUNTAS_BATALLA = [6, 8, 10, 12];

/** Huella de las pruebas: si cambian, la partida fija ya no corresponde. */
export const firmaPruebas = (config) => JSON.stringify([
    config.etapa,
    (config.pruebas || []).map(p => [p.id, p.tipo, p.materia, p.tema, p.codigo, p.texto, p.pista, p.imagen, p.materiaRetos, p.temaRetos, p.recursoId, (p.hojas || []).join('|'), p.preguntas?.length || 0]),
]);

// Instrucciones de los candados para jugar en papel / pizarra (sin repartir pistas entre móviles)
const INSTRUCCION_PAPEL = {
    'Candado de 4 cifras': 'Cada cifra del código es el resultado de una operación. Resolved las cuatro operaciones de las pistas y escribid las cifras en orden.',
    'La capital secreta': 'El fantasma bibliotecario esconde una ciudad. Con las pistas, descubrid de qué país es la bandera… ¡y escribid su CAPITAL!',
    'El retrato que habla': 'Un retrato ha perdido su placa con el nombre. Leed sus recuerdos en las pistas y descubrid quién es.',
    'El candado de las respuestas': 'Cada pista es una pregunta. Contestadlas: la letra de cada respuesta correcta, en orden, forma el código.',
    'El pergamino desordenado': 'Las letras de una palabra mágica se han desperdigado por la cripta. Juntad todas las letras de las pistas y ordenadlas.',
};

/** Candado preparado para el modo pizarra y las fichas: sin referencias a los móviles. Sirve también para partidas antiguas. */
export function candadoParaPapel(c) {
    if (!c || c.manual) return c;
    return {
        ...c,
        instruccion: INSTRUCCION_PAPEL[c.titulo] || c.instruccion,
        pistas: (c.pistas || []).map(p => ({ ...p, texto: String(p.texto || '').replace(/^Tus letras:/, 'Letras:') })),
    };
}

export const partidaVigente = (config) => !!config?.partida && config.partida.firma === firmaPruebas(config)
    && (!config.nPreguntas || config.partida.nPreguntas === config.nPreguntas)
    && (!config.nBatalla || config.partida.nBatalla === config.nBatalla);

function preguntasSinRepetir(materia, etapa, tema, n) {
    const vistas = new Set(), lista = [];
    for (let intento = 0; lista.length < n && intento < n * 15; intento++) {
        const q = generarPregunta(materia, etapa, tema);
        const clave = `${q.texto}|${q.detalle || ''}|${q.img || ''}|${(q.frase?.tokens || []).join(' ')}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        lista.push(limpiar(q));
    }
    return lista;
}

const limpiar = (q) => {
    const o = { texto: q.texto, opciones: q.opciones, correcta: q.correcta, materia: q.materia };
    if (q.detalle) o.detalle = q.detalle;
    if (q.grande) o.grande = true;
    if (q.img) o.img = q.img;
    if (q.frase) o.frase = q.frase;
    return o;
};

/** Candado congelado. Las pruebas propias guardan el código tal cual (es la configuración del profe). */
function candadoFijo(prueba, etapa) {
    if (prueba.tipo === 'MANUAL') {
        const codigos = String(prueba.codigo || '').split('|').map(c => c.trim()).filter(Boolean);
        return {
            titulo: prueba.nombre || 'La habitación secreta', instruccion: prueba.texto || '', manual: true,
            tipo: codigos[0] && /^\d+$/.test(codigos[0].replace(/\s/g, '')) ? 'numero' : 'texto',
            longitud: codigos[0] ? codigos[0].length : null, imagen: prueba.imagen || '',
            pistas: prueba.pista ? [{ texto: prueba.pista }] : [],
            soluciones: codigos, solucionVisible: codigos[0] || '',
        };
    }
    const c = candadoParaPapel(prueba.tipo === 'RECURSO' ? candadoRecurso(prueba) : generarCandado(prueba.materia, etapa, prueba.tema));
    return { titulo: c.titulo, instruccion: c.instruccion, tipo: c.tipo, longitud: c.longitud, pistas: c.pistas, soluciones: c.soluciones, solucionVisible: c.solucionVisible };
}

/** N preguntas distintas de un recurso (sin repetir mientras haya). */
function delRecurso(p, n) {
    const lista = [...(p.preguntas || [])].sort(() => Math.random() - 0.5).slice(0, n);
    return lista.map(q => limpiar({ ...q, materia: 'RECURSO' }));
}

export function generarPartidaFija(config, { nPreguntas = 6, nBatalla = 8 } = {}) {
    const etapa = config.etapa;
    const pruebas = (config.pruebas || []).map(p => {
        const materia = materiaDePrueba(p);
        return {
            id: p.id,
            preguntas: p.tipo === 'RECURSO' ? delRecurso(p, nPreguntas)
                : materia ? preguntasSinRepetir(materia, etapa, temaDePrueba(p), nPreguntas) : [],
            candado: candadoFijo(p, etapa),
        };
    });
    const conPreguntas = (config.pruebas || []).filter(p => tienePreguntas(p));
    const batalla = [];
    const vistas = new Set();
    for (let i = 0; batalla.length < nBatalla && i < nBatalla * 15; i++) {
        const p = conPreguntas.length ? pick(conPreguntas) : { tipo: 'MATERIA', materia: pick(ORDEN_SALAS), tema: 'MIX' };
        const q = preguntaDePrueba(p, etapa);
        const clave = `${q.texto}|${q.detalle || ''}|${q.img || ''}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave); batalla.push(limpiar(q));
    }
    return { firma: firmaPruebas(config), creada: Date.now(), nPreguntas, nBatalla, pruebas, batalla };
}
