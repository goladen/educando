// ─────────────────────────────────────────────────────────────────────────────
//  Problemas de «fracción de una cantidad» para Fracciones.jsx (modo 📖 Problemas)
//  cat: 'total'     → se conoce el total y se calcula una parte
//       'averiguar' → se conoce una parte y hay que averiguar el total
//  preguntas: { p, tipo: 'num' | 'frac' | 'opcion', r, unidad?, opciones? }
//    num    → r es un número          frac → r es [n, d] (se aceptan equivalentes)
//    opcion → r es una de las opciones
//  barra (opcional): { d, total, unidad, tramos: [{ n, etiqueta, color }] }
//    El total se parte en d trozos iguales; cada tramo pinta n trozos seguidos.
// ─────────────────────────────────────────────────────────────────────────────

export const PDF_EJERCICIOS_FRACCIONES = 'https://c2d44406-0ca5-4e92-ad51-bbcce01ab63b.filesusr.com/ugd/c13bbd_ced1cacb64454cff97d15ace13e3e26d.pdf';

const C1 = '#7b1fa2', C2 = '#00897b', C3 = '#1e88e5', C4 = '#f39c12', RESTO = '#cfd8dc';

export const PROBLEMAS_FRACCIONES = [
    {
        id: 'gasoil', cat: 'total', emoji: '⛽',
        texto: 'El depósito de gasoil para la calefacción de nuestro instituto tiene una capacidad de 1500 litros. Este trimestre se ha consumido 2/5 de su contenido. ¿Cuántos litros de gasoil quedan?',
        preguntas: [
            { p: '¿Cuántos litros se han consumido?', tipo: 'num', r: 600, unidad: 'litros' },
            { p: '¿Cuántos litros de gasoil quedan?', tipo: 'num', r: 900, unidad: 'litros' },
        ],
        explicacion: ['1/5 de 1500 = 1500 : 5 = 300 litros', 'Consumido: 2/5 de 1500 = 2 · 300 = 600 litros', 'Quedan: 1500 − 600 = 900 litros (o bien 3/5 de 1500 = 900)'],
        barra: { d: 5, total: 1500, unidad: 'L', tramos: [{ n: 2, etiqueta: 'consumido', color: C1 }, { n: 3, etiqueta: 'queda', color: RESTO }] },
    },
    {
        id: 'competicion', cat: 'total', emoji: '🏅',
        texto: 'En una competición se pueden obtener un total de 75 puntos. Juan ha conseguido 3/5 del total. ¿Cuántos puntos le han faltado por lograr para hacer una competición perfecta?',
        preguntas: [
            { p: '¿Cuántos puntos ha conseguido Juan?', tipo: 'num', r: 45, unidad: 'puntos' },
            { p: '¿Cuántos puntos le han faltado?', tipo: 'num', r: 30, unidad: 'puntos' },
        ],
        explicacion: ['1/5 de 75 = 75 : 5 = 15 puntos', 'Conseguido: 3/5 de 75 = 3 · 15 = 45 puntos', 'Faltan: 75 − 45 = 30 puntos (2/5 de 75)'],
        barra: { d: 5, total: 75, unidad: 'pts', tramos: [{ n: 3, etiqueta: 'conseguido', color: C1 }, { n: 2, etiqueta: 'falta', color: RESTO }] },
    },
    {
        id: 'bombones', cat: 'averiguar', emoji: '🍫',
        texto: 'Andrés se comió 1/5 de los bombones de una caja y Ana 1/2 de la misma. ¿Qué fracción de bombones se comieron entre los dos? Si quedaron 12 bombones, ¿cuántos bombones tenía la caja?',
        preguntas: [
            { p: '¿Qué fracción de bombones se comieron entre los dos?', tipo: 'frac', r: [7, 10] },
            { p: '¿Qué fracción de la caja quedó?', tipo: 'frac', r: [3, 10] },
            { p: '¿Cuántos bombones tenía la caja?', tipo: 'num', r: 40, unidad: 'bombones' },
        ],
        explicacion: ['Comieron: 1/5 + 1/2 = 2/10 + 5/10 = 7/10', 'Quedó: 1 − 7/10 = 3/10 de la caja', '3/10 son 12 bombones → 1/10 = 12 : 3 = 4', 'La caja: 10/10 = 10 · 4 = 40 bombones'],
        barra: { d: 10, total: 40, unidad: '', tramos: [{ n: 2, etiqueta: 'Andrés', color: C1 }, { n: 5, etiqueta: 'Ana', color: C2 }, { n: 3, etiqueta: 'quedan (12)', color: RESTO }] },
    },
    {
        id: 'camino', cat: 'averiguar', emoji: '🚶',
        texto: 'Antonio lleva recorridos los 5/7 del camino de su casa al instituto y aún le quedan por andar 300 metros. ¿Qué distancia lleva recorrida? ¿Cuánto dista su casa del instituto?',
        preguntas: [
            { p: '¿Qué fracción del camino le queda?', tipo: 'frac', r: [2, 7] },
            { p: '¿Qué distancia lleva recorrida?', tipo: 'num', r: 750, unidad: 'metros' },
            { p: '¿Cuánto dista su casa del instituto?', tipo: 'num', r: 1050, unidad: 'metros' },
        ],
        explicacion: ['Le queda: 1 − 5/7 = 2/7 del camino', '2/7 son 300 m → 1/7 = 300 : 2 = 150 m', 'Recorrido: 5/7 = 5 · 150 = 750 m', 'Distancia total: 7/7 = 7 · 150 = 1050 m'],
        barra: { d: 7, total: 1050, unidad: 'm', tramos: [{ n: 5, etiqueta: 'recorrido', color: C1 }, { n: 2, etiqueta: 'quedan 300 m', color: RESTO }] },
    },
    {
        id: 'coches', cat: 'total', emoji: '🚗',
        texto: 'Dos automóviles A y B hacen un mismo trayecto de 572 km. El automóvil A lleva recorridos los 5/11 del trayecto cuando el B ha recorrido los 6/13 del mismo. ¿Cuál de los dos va primero? ¿Cuántos kilómetros llevan recorridos cada automóvil?',
        preguntas: [
            { p: '¿Cuántos kilómetros lleva recorridos el automóvil A?', tipo: 'num', r: 260, unidad: 'km' },
            { p: '¿Cuántos kilómetros lleva recorridos el automóvil B?', tipo: 'num', r: 264, unidad: 'km' },
            { p: '¿Cuál de los dos va primero?', tipo: 'opcion', r: 'B', opciones: ['A', 'B'] },
        ],
        explicacion: ['A: 1/11 de 572 = 52 km → 5/11 = 5 · 52 = 260 km', 'B: 1/13 de 572 = 44 km → 6/13 = 6 · 44 = 264 km', 'Va primero B (también: 5/11 = 65/143 < 66/143 = 6/13)'],
    },
    {
        id: 'elecciones', cat: 'total', emoji: '🗳️',
        texto: 'En las elecciones al Consejo Escolar, 3/11 de los votos fueron para el candidato A, 3/10 para el candidato B, 5/14 para C y el resto para el candidato D. El total de votos ha sido de 770. Calcula el número de votos que obtuvo cada candidato.',
        preguntas: [
            { p: 'Votos del candidato A', tipo: 'num', r: 210, unidad: 'votos' },
            { p: 'Votos del candidato B', tipo: 'num', r: 231, unidad: 'votos' },
            { p: 'Votos del candidato C', tipo: 'num', r: 275, unidad: 'votos' },
            { p: 'Votos del candidato D', tipo: 'num', r: 54, unidad: 'votos' },
        ],
        explicacion: ['A: 770 : 11 = 70 → 3 · 70 = 210 votos', 'B: 770 : 10 = 77 → 3 · 77 = 231 votos', 'C: 770 : 14 = 55 → 5 · 55 = 275 votos', 'D: 770 − 210 − 231 − 275 = 54 votos'],
    },
    {
        id: 'edad', cat: 'averiguar', emoji: '🎂',
        texto: 'Hace unos años Pedro tenía 24 años, que representan los 2/3 de su edad actual. ¿Qué edad tiene Pedro?',
        preguntas: [
            { p: '¿Cuántos años son 1/3 de su edad actual?', tipo: 'num', r: 12, unidad: 'años' },
            { p: '¿Qué edad tiene Pedro?', tipo: 'num', r: 36, unidad: 'años' },
        ],
        explicacion: ['2/3 de su edad son 24 años → 1/3 = 24 : 2 = 12 años', 'Edad actual: 3/3 = 3 · 12 = 36 años'],
        barra: { d: 3, total: 36, unidad: 'años', tramos: [{ n: 2, etiqueta: 'tenía 24', color: C1 }, { n: 1, etiqueta: 'años pasados', color: RESTO }] },
    },
    {
        id: 'rifa', cat: 'averiguar', emoji: '🎟️',
        texto: 'Tres hermanas se reparten el premio de una rifa. Luisa se queda con 1/4 del premio, María con 1/3 y Eva se lleva 500 €. ¿Cuánto se lleva Luisa? ¿Y María? ¿Cuál es la fracción del dinero que se lleva Eva? ¿De cuánto era el premio?',
        preguntas: [
            { p: '¿Qué fracción del premio se lleva Eva?', tipo: 'frac', r: [5, 12] },
            { p: '¿De cuánto era el premio?', tipo: 'num', r: 1200, unidad: '€' },
            { p: '¿Cuánto se lleva Luisa?', tipo: 'num', r: 300, unidad: '€' },
            { p: '¿Cuánto se lleva María?', tipo: 'num', r: 400, unidad: '€' },
        ],
        explicacion: ['Luisa + María: 1/4 + 1/3 = 3/12 + 4/12 = 7/12', 'Eva: 1 − 7/12 = 5/12', '5/12 son 500 € → 1/12 = 100 € → premio = 12 · 100 = 1200 €', 'Luisa: 3/12 = 300 € · María: 4/12 = 400 €'],
        barra: { d: 12, total: 1200, unidad: '€', tramos: [{ n: 3, etiqueta: 'Luisa', color: C1 }, { n: 4, etiqueta: 'María', color: C2 }, { n: 5, etiqueta: 'Eva (500 €)', color: C4 }] },
    },
    {
        id: 'compras', cat: 'total', emoji: '🛍️',
        texto: 'Alicia dispone de 300 € para compras. El jueves gastó 2/5 de esa cantidad y el sábado los 3/4 de lo que le quedaba. ¿Cuánto gastó cada día y cuánto le queda al final?',
        preguntas: [
            { p: '¿Cuánto gastó el jueves?', tipo: 'num', r: 120, unidad: '€' },
            { p: '¿Cuánto gastó el sábado?', tipo: 'num', r: 135, unidad: '€' },
            { p: '¿Cuánto le queda al final?', tipo: 'num', r: 45, unidad: '€' },
        ],
        explicacion: ['Jueves: 2/5 de 300 = 2 · 60 = 120 €', 'Le quedaban 300 − 120 = 180 €', 'Sábado: 3/4 de 180 = 3 · 45 = 135 €', 'Al final: 180 − 135 = 45 €'],
        barra: { d: 20, total: 300, unidad: '€', tramos: [{ n: 8, etiqueta: 'jueves', color: C1 }, { n: 9, etiqueta: 'sábado', color: C2 }, { n: 3, etiqueta: 'queda', color: RESTO }] },
    },
    {
        id: 'cine', cat: 'averiguar', emoji: '🎬',
        texto: 'Ayer salí con mis amigos, me gasté 1/5 del dinero que llevaba en entrar al cine y 1/3 del mismo en la cena. Al llegar a casa me quedaban 7 €. ¿Cuánto dinero tenía? ¿Cuánto me gasté en el cine? ¿Y en cenar?',
        preguntas: [
            { p: '¿Qué fracción del dinero me quedó?', tipo: 'frac', r: [7, 15] },
            { p: '¿Cuánto dinero tenía?', tipo: 'num', r: 15, unidad: '€' },
            { p: '¿Cuánto me gasté en el cine?', tipo: 'num', r: 3, unidad: '€' },
            { p: '¿Y en cenar?', tipo: 'num', r: 5, unidad: '€' },
        ],
        explicacion: ['Gastado: 1/5 + 1/3 = 3/15 + 5/15 = 8/15', 'Quedó: 1 − 8/15 = 7/15', '7/15 son 7 € → 1/15 = 1 € → tenía 15 €', 'Cine: 3/15 = 3 € · Cena: 5/15 = 5 €'],
        barra: { d: 15, total: 15, unidad: '€', tramos: [{ n: 3, etiqueta: 'cine', color: C1 }, { n: 5, etiqueta: 'cena', color: C2 }, { n: 7, etiqueta: 'quedan 7 €', color: RESTO }] },
    },
    // ── Problemas añadidos ───────────────────────────────────────────────────
    {
        id: 'deporte', cat: 'total', emoji: '⚽',
        texto: 'En una clase de 30 alumnos, 3/5 practican algún deporte. ¿Cuántos alumnos practican deporte? ¿Cuántos no lo practican?',
        preguntas: [
            { p: '¿Cuántos alumnos practican deporte?', tipo: 'num', r: 18, unidad: 'alumnos' },
            { p: '¿Cuántos no practican deporte?', tipo: 'num', r: 12, unidad: 'alumnos' },
        ],
        explicacion: ['1/5 de 30 = 30 : 5 = 6 alumnos', 'Deporte: 3/5 = 3 · 6 = 18 alumnos', 'No practican: 30 − 18 = 12 alumnos'],
        barra: { d: 5, total: 30, unidad: '', tramos: [{ n: 3, etiqueta: 'deporte', color: C1 }, { n: 2, etiqueta: 'no', color: RESTO }] },
    },
    {
        id: 'libro', cat: 'total', emoji: '📚',
        texto: 'Un libro tiene 240 páginas. El lunes leí 3/8 del libro y el martes 1/4. ¿Cuántas páginas leí cada día? ¿Qué fracción del libro me queda por leer? ¿Cuántas páginas son?',
        preguntas: [
            { p: '¿Cuántas páginas leí el lunes?', tipo: 'num', r: 90, unidad: 'páginas' },
            { p: '¿Cuántas páginas leí el martes?', tipo: 'num', r: 60, unidad: 'páginas' },
            { p: '¿Qué fracción del libro me queda?', tipo: 'frac', r: [3, 8] },
            { p: '¿Cuántas páginas me quedan?', tipo: 'num', r: 90, unidad: 'páginas' },
        ],
        explicacion: ['1/8 de 240 = 30 páginas → lunes: 3 · 30 = 90', 'Martes: 1/4 de 240 = 60 páginas', 'Leído: 3/8 + 1/4 = 3/8 + 2/8 = 5/8 → queda 3/8', 'Quedan: 3 · 30 = 90 páginas'],
        barra: { d: 8, total: 240, unidad: 'pág', tramos: [{ n: 3, etiqueta: 'lunes', color: C1 }, { n: 2, etiqueta: 'martes', color: C2 }, { n: 3, etiqueta: 'queda', color: RESTO }] },
    },
    {
        id: 'terreno', cat: 'total', emoji: '🍅',
        texto: 'Un terreno mide 1200 m². Se siembran 2/3 del terreno y, de la parte sembrada, 3/4 son tomates. ¿Cuántos m² hay sembrados? ¿Cuántos m² son de tomates? ¿Qué fracción del terreno ocupan los tomates?',
        preguntas: [
            { p: '¿Cuántos m² hay sembrados?', tipo: 'num', r: 800, unidad: 'm²' },
            { p: '¿Cuántos m² son de tomates?', tipo: 'num', r: 600, unidad: 'm²' },
            { p: '¿Qué fracción del terreno ocupan los tomates?', tipo: 'frac', r: [1, 2] },
        ],
        explicacion: ['Sembrado: 2/3 de 1200 = 2 · 400 = 800 m²', 'Tomates: 3/4 de 800 = 3 · 200 = 600 m²', 'Fracción de fracción: 3/4 · 2/3 = 6/12 = 1/2 del terreno'],
        barra: { d: 6, total: 1200, unidad: 'm²', tramos: [{ n: 3, etiqueta: 'tomates', color: C1 }, { n: 1, etiqueta: 'resto sembrado', color: C2 }, { n: 2, etiqueta: 'sin sembrar', color: RESTO }] },
    },
    {
        id: 'botellas', cat: 'total', emoji: '💧',
        texto: 'Tenemos un bidón con 20 litros de agua y queremos llenar botellas de 2/5 de litro. ¿Cuántas botellas podemos llenar? Si regalamos 3/10 de las botellas, ¿cuántas nos quedan?',
        preguntas: [
            { p: '¿Cuántas botellas podemos llenar?', tipo: 'num', r: 50, unidad: 'botellas' },
            { p: '¿Cuántas botellas regalamos?', tipo: 'num', r: 15, unidad: 'botellas' },
            { p: '¿Cuántas botellas nos quedan?', tipo: 'num', r: 35, unidad: 'botellas' },
        ],
        explicacion: ['Botellas: 20 : 2/5 = 20 · 5/2 = 50 botellas', 'Regalamos: 3/10 de 50 = 3 · 5 = 15 botellas', 'Quedan: 50 − 15 = 35 botellas'],
    },
    {
        id: 'grifo', cat: 'averiguar', emoji: '🚰',
        texto: 'Un grifo ha llenado los 3/4 de un depósito echando 450 litros. ¿Cuál es la capacidad del depósito? ¿Cuántos litros faltan para llenarlo?',
        preguntas: [
            { p: '¿Cuántos litros son 1/4 del depósito?', tipo: 'num', r: 150, unidad: 'litros' },
            { p: '¿Cuál es la capacidad del depósito?', tipo: 'num', r: 600, unidad: 'litros' },
            { p: '¿Cuántos litros faltan para llenarlo?', tipo: 'num', r: 150, unidad: 'litros' },
        ],
        explicacion: ['3/4 son 450 L → 1/4 = 450 : 3 = 150 L', 'Capacidad: 4/4 = 4 · 150 = 600 L', 'Faltan: 1/4 = 150 L'],
        barra: { d: 4, total: 600, unidad: 'L', tramos: [{ n: 3, etiqueta: 'lleno (450 L)', color: C3 }, { n: 1, etiqueta: 'falta', color: RESTO }] },
    },
    {
        id: 'paga', cat: 'averiguar', emoji: '💶',
        texto: 'Marta se ha gastado 2/7 de su paga y todavía le quedan 25 €. ¿Cuánto era su paga? ¿Cuánto se ha gastado?',
        preguntas: [
            { p: '¿Qué fracción de la paga le queda?', tipo: 'frac', r: [5, 7] },
            { p: '¿Cuánto era su paga?', tipo: 'num', r: 35, unidad: '€' },
            { p: '¿Cuánto se ha gastado?', tipo: 'num', r: 10, unidad: '€' },
        ],
        explicacion: ['Le queda: 1 − 2/7 = 5/7', '5/7 son 25 € → 1/7 = 5 €', 'Paga: 7 · 5 = 35 € · Gastado: 2 · 5 = 10 €'],
        barra: { d: 7, total: 35, unidad: '€', tramos: [{ n: 2, etiqueta: 'gastado', color: C1 }, { n: 5, etiqueta: 'quedan 25 €', color: RESTO }] },
    },
    {
        id: 'transporte', cat: 'averiguar', emoji: '🚌',
        texto: 'En un instituto, 3/8 de los alumnos van andando, 1/2 en autobús y los 60 restantes en bicicleta. ¿Cuántos alumnos tiene el instituto? ¿Cuántos van andando? ¿Y en autobús?',
        preguntas: [
            { p: '¿Qué fracción de alumnos va en bicicleta?', tipo: 'frac', r: [1, 8] },
            { p: '¿Cuántos alumnos tiene el instituto?', tipo: 'num', r: 480, unidad: 'alumnos' },
            { p: '¿Cuántos van andando?', tipo: 'num', r: 180, unidad: 'alumnos' },
            { p: '¿Cuántos van en autobús?', tipo: 'num', r: 240, unidad: 'alumnos' },
        ],
        explicacion: ['Andando + autobús: 3/8 + 1/2 = 3/8 + 4/8 = 7/8', 'Bicicleta: 1 − 7/8 = 1/8 → 1/8 son 60 alumnos', 'Total: 8 · 60 = 480 alumnos', 'Andando: 3 · 60 = 180 · Autobús: 4 · 60 = 240'],
        barra: { d: 8, total: 480, unidad: '', tramos: [{ n: 3, etiqueta: 'andando', color: C1 }, { n: 4, etiqueta: 'autobús', color: C2 }, { n: 1, etiqueta: 'bici (60)', color: C4 }] },
    },
    {
        id: 'ciclista', cat: 'averiguar', emoji: '🚴',
        texto: 'Un ciclista recorre por la mañana 1/3 de una etapa y por la tarde 3/5 de lo que le quedaba. Aún le faltan 40 km para terminar. ¿Cuántos kilómetros tiene la etapa?',
        preguntas: [
            { p: '¿Qué fracción de la etapa recorrió por la tarde?', tipo: 'frac', r: [2, 5] },
            { p: '¿Qué fracción de la etapa le falta?', tipo: 'frac', r: [4, 15] },
            { p: '¿Cuántos kilómetros tiene la etapa?', tipo: 'num', r: 150, unidad: 'km' },
        ],
        explicacion: ['Tras la mañana le queda 1 − 1/3 = 2/3', 'Tarde: 3/5 de 2/3 = 6/15 = 2/5 de la etapa', 'Falta: 1 − 1/3 − 2/5 = 15/15 − 5/15 − 6/15 = 4/15', '4/15 son 40 km → 1/15 = 10 km → etapa = 150 km'],
        barra: { d: 15, total: 150, unidad: 'km', tramos: [{ n: 5, etiqueta: 'mañana', color: C1 }, { n: 6, etiqueta: 'tarde', color: C2 }, { n: 4, etiqueta: 'faltan 40 km', color: RESTO }] },
    },
];
