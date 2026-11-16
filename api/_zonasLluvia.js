// Zonas de escalada del recopilador de lluvia (coordenadas aproximadas del sector principal).
// Compartido por el navegador (src/Simuladores física/Precipitaciones.jsx) y por el cron de
// api/aemet.js, que precalcula AEMET para todas estas zonas. El "_" evita que Vercel lo
// publique como ruta.
export const ZONAS_ESCALADA = [
    { id: 'rodellar',   nombre: 'Rodellar',        region: 'Huesca',     lat: 42.285, lon: -0.083, saih: 'P106H' },
    { id: 'alquezar',   nombre: 'Alquézar',        region: 'Huesca',     lat: 42.173, lon: 0.026, saih: 'P101G' },
    { id: 'barasona',   nombre: 'Barasona',        region: 'Huesca',     lat: 42.137, lon: 0.318, saih: 'EM48B' },
    { id: 'baldellou',  nombre: 'Baldellou',       region: 'Huesca',     lat: 41.918, lon: 0.547 },
    { id: 'avellanes',  nombre: 'Les Avellanes',   region: 'Lleida',     lat: 41.876, lon: 0.757, saih: 'P038M' },
    { id: 'santalinya', nombre: 'Santa Linya',     region: 'Lleida',     lat: 41.933, lon: 0.800, saih: 'P038M' },
    { id: 'terradets',  nombre: 'Terradets',       region: 'Lleida',     lat: 42.040, lon: 0.883, saih: 'E059M' },
    { id: 'vadiello',   nombre: 'Vadiello',        region: 'Huesca',     lat: 42.262, lon: -0.270, saih: 'EM41H' },
    { id: 'campo',      nombre: 'Campo',           region: 'Huesca',     lat: 42.410, lon: 0.396, saih: 'A258B' },
    { id: 'oliana',     nombre: 'Oliana',          region: 'Lleida',     lat: 42.070, lon: 1.310 },
    { id: 'margalef',   nombre: 'Margalef',        region: 'Tarragona',  lat: 41.285, lon: 0.754 },
    { id: 'siurana',    nombre: 'Siurana',         region: 'Tarragona',  lat: 41.258, lon: 0.932 },
    { id: 'riglos',     nombre: 'Riglos',          region: 'Huesca',     lat: 42.348, lon: -0.726 },
    { id: 'montserrat', nombre: 'Montserrat',      region: 'Barcelona',  lat: 41.593, lon: 1.837 },
    { id: 'albarracin', nombre: 'Albarracín',      region: 'Teruel',     lat: 40.408, lon: -1.444 },
    { id: 'chulilla',   nombre: 'Chulilla',        region: 'Valencia',   lat: 39.655, lon: -0.890 },
    { id: 'chorro',     nombre: 'El Chorro',       region: 'Málaga',     lat: 36.906, lon: -4.760 },
    { id: 'pedriza',    nombre: 'La Pedriza',      region: 'Madrid',     lat: 40.750, lon: -3.880 },
    { id: 'patones',    nombre: 'Patones',         region: 'Madrid',     lat: 40.870, lon: -3.480 },
    { id: 'ramales',    nombre: 'Ramales',         region: 'Cantabria',  lat: 43.260, lon: -3.460 },
    { id: 'ifach',      nombre: 'Peñón de Ifach',  region: 'Alicante',   lat: 38.635, lon: 0.075 },
];

// Pluviómetros del SAIH Ebro que lee el cron de api/saih.js (señales <codigo>84PACUM = acumulado del día y
// <codigo>83PA24H = últimas 24 h). La propiedad "saih" de cada zona apunta a uno de estos códigos.
export const SAIH_ESTACIONES = [
    { codigo: 'P106H', nombre: 'Rodellar' },
    { codigo: 'P101G', nombre: 'Alquézar' },
    { codigo: 'EM48B', nombre: 'Embalse de Barasona' },
    { codigo: 'E059M', nombre: 'Embalse de Terradets' },
    { codigo: 'EM41H', nombre: 'Embalse de Vadiello' },
    { codigo: 'P038M', nombre: 'Os de Balaguer' },
    { codigo: 'A258B', nombre: 'Campo' },
];
export const DOC_LLUVIA_SAIH = 'sitio_publico/lluvia_saih';

// Documento público (lectura libre, escritura solo desde el servidor) con el último cálculo del cron.
export const DOC_LLUVIA_AEMET = 'sitio_publico/lluvia_aemet';
