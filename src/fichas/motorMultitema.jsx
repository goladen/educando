import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  Fábrica de motores MULTITEMA para FichasImprimibles: una ficha puede mezclar
//  ejercicios de varias fuentes (temas). Cada ejercicio y apartado lleva
//  `fuente` y el motor delega en ella. La usan Math World y las materias
//  (Biología, Geografía, Sintaxis, Música).
// ─────────────────────────────────────────────────────────────────────────────

export const ETAPAS = { primaria: '🧒 Primaria', eso: '🎒 ESO', bach: '🎓 Bachillerato' };
export const CURSOS = {
    primaria: ['1.º', '2.º', '3.º', '4.º', '5.º', '6.º'],
    eso: ['1.º', '2.º', '3.º', '4.º'],
    bach: ['1.º', '2.º'],
};

// fuentes: { id: fuente } · opts: { coleccion, ruta, nombre, tituloFicha, emoji, volver, catalogo, legacy, ejercicioInicial, ejercicioNuevo, etapas? }
export const crearMotorMultitema = (fuentes, opts) => {
    const primera = Object.values(fuentes)[0];
    const F = (x) => fuentes[x?.fuente] || primera;
    const delegar = (nombre) => function Delegado(props) {
        const C = F(props.ap)[nombre];
        return C ? <C {...props} /> : null;
    };
    const tipoInicial = (f) => Object.keys(f.tipos)[0];
    return {
        etapas: ETAPAS,
        cursos: CURSOS,
        ejercicioInicial: { fuente: primera.id, tipo: tipoInicial(primera), nivel: 1, n: 4 },
        ejercicioNuevo: { fuente: primera.id, tipo: tipoInicial(primera), nivel: 1, n: 4 },
        ...opts,
        fuentes,
        tipos: {},
        titulos: {},
        layout: (ej) => F(ej).layout(ej),
        generarApartados: (ej, n, existentes) => F(ej).generarApartados(ej, n, existentes).map(a => ({ ...a, fuente: ej.fuente })),
        maxApartados: (ej) => F(ej).maxApartados(ej),
        usaNivel: (tipo, ej) => F(ej).usaNivel(tipo),
        categorias: (tipo, ej) => (F(ej).categorias ? F(ej).categorias(tipo) : null),
        esTexto: (ap) => F(ap).esTexto(ap),
        sizeHoja: (ap) => (F(ap).sizeHoja ? F(ap).sizeHoja(ap) : '1.3rem'),
        Enunciado: delegar('Enunciado'),
        Solucion: delegar('Solucion'),
        pasosMax: (ap) => F(ap).pasosMax(ap),
        marcaEnunciado: (ap, vis) => (F(ap).marcaEnunciado ? F(ap).marcaEnunciado(ap, vis) : null),
        RespuestaInline: delegar('RespuestaInline'),
        Revelado: delegar('Revelado'),
        respuestas: (ap) => (F(ap).respuestas ? F(ap).respuestas(ap) : []),
    };
};

// Motor con un tema preseleccionado (al abrir las fichas desde una herramienta)
export const conTema = (motor, tema) => {
    const f = motor.fuentes?.[tema];
    if (!f) return motor;
    const tipo = Object.keys(f.tipos)[0];
    return { ...motor, temaInicial: tema, volver: f.nombre, ejercicioInicial: { fuente: tema, tipo, nivel: 1, n: 4 }, ejercicioNuevo: { fuente: tema, tipo, nivel: 1, n: 4 } };
};
