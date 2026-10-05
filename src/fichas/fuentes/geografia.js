// ─────────────────────────────────────────────────────────────────────────────
//  Fuentes de GEOGRAFÍA para las fichas: capitales y banderas (datos de
//  GeografiaApp), continentes, ríos y cordilleras, comunidades autónomas,
//  provincias y vertientes de los ríos de España.
// ─────────────────────────────────────────────────────────────────────────────
import { PAISES_BANDERAS, ELEMENTOS_GEO } from '../../components/GeografiaApp';
import { pick } from '../fuenteTexto';

const barajar = (a) => [...a].sort(() => Math.random() - 0.5);
const opciones = (correcta, pool, n = 4) => barajar([correcta, ...barajar([...new Set(pool)].filter(x => x !== correcta)).slice(0, n - 1)]);
const CONTINENTES = ['Europa', 'América', 'África', 'Asia', 'Oceanía'];
const paisesNivel = (nv) => PAISES_BANDERAS.filter(p => (nv === 1 ? p.continente === 'Europa' : nv === 2 ? ['Europa', 'América'].includes(p.continente) : true));
const bandera = (iso2) => `https://flagcdn.com/w160/${iso2}.png`;

// ── España: comunidades autónomas, capitales y provincias ────────────────────
const CCAA = [
    ['Andalucía', 'Sevilla', ['Almería', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Málaga', 'Sevilla']],
    ['Aragón', 'Zaragoza', ['Huesca', 'Teruel', 'Zaragoza']],
    ['Asturias', 'Oviedo', ['Asturias']],
    ['Islas Baleares', 'Palma', ['Islas Baleares']],
    ['Canarias', 'Santa Cruz de Tenerife y Las Palmas de Gran Canaria', ['Las Palmas', 'Santa Cruz de Tenerife']],
    ['Cantabria', 'Santander', ['Cantabria']],
    ['Castilla-La Mancha', 'Toledo', ['Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara', 'Toledo']],
    ['Castilla y León', 'Valladolid', ['Ávila', 'Burgos', 'León', 'Palencia', 'Salamanca', 'Segovia', 'Soria', 'Valladolid', 'Zamora']],
    ['Cataluña', 'Barcelona', ['Barcelona', 'Girona', 'Lleida', 'Tarragona']],
    ['Comunidad Valenciana', 'Valencia', ['Alicante', 'Castellón', 'Valencia']],
    ['Extremadura', 'Mérida', ['Badajoz', 'Cáceres']],
    ['Galicia', 'Santiago de Compostela', ['A Coruña', 'Lugo', 'Ourense', 'Pontevedra']],
    ['Comunidad de Madrid', 'Madrid', ['Madrid']],
    ['Región de Murcia', 'Murcia', ['Murcia']],
    ['Navarra', 'Pamplona', ['Navarra']],
    ['País Vasco', 'Vitoria-Gasteiz', ['Álava', 'Gipuzkoa', 'Bizkaia']],
    ['La Rioja', 'Logroño', ['La Rioja']],
];
const PROVINCIAS = CCAA.flatMap(([c, , ps]) => ps.map(p => [p, c])).filter(([p, c]) => p !== c && !c.includes(p));
const VERTIENTES = [
    ['Ebro', 'Mediterránea'], ['Júcar', 'Mediterránea'], ['Segura', 'Mediterránea'], ['Turia', 'Mediterránea'], ['Llobregat', 'Mediterránea'],
    ['Tajo', 'Atlántica'], ['Duero', 'Atlántica'], ['Guadiana', 'Atlántica'], ['Guadalquivir', 'Atlántica'], ['Miño', 'Atlántica'],
    ['Nalón', 'Cantábrica'], ['Bidasoa', 'Cantábrica'], ['Navia', 'Cantábrica'], ['Nervión', 'Cantábrica'], ['Sella', 'Cantábrica'],
];

export const GEOGRAFIA = {
    id: 'geografia', nombre: 'Geografía', emoji: '🌍', color: '#0d9488', etapas: ['primaria', 'eso'],
    desc: 'Capitales, banderas, continentes, ríos y cordilleras, comunidades y provincias de España',
    tipos: {
        capitales: {
            label: '🏛️ Capitales', titulo: 'Escribe la capital de cada país.', cols: 2, alto: 35,
            gen: (nv) => { const p = pick(paisesNivel(nv)); return { e: p.nombre, s: p.capital, r: [{ tipo: 'texto', v: p.capital, placeholder: 'capital' }], pasos: [`${p.nombre} está en ${p.continente}`] }; },
        },
        paisDeCapital: {
            label: '🗺️ ¿De qué país es la capital?', titulo: '¿De qué país es capital cada ciudad?', cols: 2, alto: 35,
            gen: (nv) => { const p = pick(paisesNivel(nv)); return { e: p.capital, s: p.nombre, r: [{ tipo: 'texto', v: p.nombre, placeholder: 'país' }], pasos: [`Está en ${p.continente}`] }; },
        },
        banderas: {
            label: '🚩 Banderas', titulo: '¿De qué país es cada bandera?', cols: 3, alto: 35,
            gen: (nv) => { const p = pick(paisesNivel(nv)); return { img: bandera(p.iso2), imgAlto: 2.6, e: '', s: p.nombre, r: [{ tipo: 'texto', v: p.nombre, placeholder: 'país' }], pasos: [`Continente: ${p.continente}`, `Capital: ${p.capital}`] }; },
        },
        continentes: {
            label: '🌐 Continentes', titulo: '¿En qué continente está cada país?', cols: 3, alto: 30, niveles: false,
            gen: () => { const p = pick(PAISES_BANDERAS); return { e: p.nombre, s: p.continente, r: [{ tipo: 'opcion', v: p.continente, opciones: CONTINENTES }], pasos: [`Su capital es ${p.capital}`] }; },
        },
        relieve: {
            label: '⛰️ Ríos y cordilleras', titulo: '¿Es un río o una cordillera? ¿Dónde está?', cols: 2, alto: 40,
            gen: (nv) => {
                const pool = ELEMENTOS_GEO.filter(e => (nv === 1 ? e.ambito === 'España' : nv === 2 ? ['España', 'Europa'].includes(e.ambito) : true));
                const el = pick(pool), tipo = el.tipo === 'rio' ? 'Río' : 'Cordillera';
                const donde = el.ambito === 'España' ? 'España' : el.ambito;
                return { e: el.nombre, s: `${tipo} · ${donde}`, r: [{ etiqueta: '¿Río o cordillera?', tipo: 'opcion', v: tipo, opciones: ['Río', 'Cordillera'] }, { etiqueta: '¿Dónde está?', tipo: 'opcion', v: donde, opciones: ['España', ...CONTINENTES] }], pasos: [] };
            },
        },
        ccaaCapitales: {
            label: '🇪🇸 Comunidades y capitales', titulo: 'Escribe la capital de cada comunidad autónoma.', cols: 2, alto: 35, niveles: false,
            gen: () => {
                const [c, cap] = pick(CCAA.filter(x => !x[1].includes(' y ')));
                return { e: c, s: cap, r: [{ tipo: 'texto', v: cap, placeholder: 'capital' }], pasos: [] };
            },
        },
        provincias: {
            label: '📍 Provincias', titulo: '¿A qué comunidad autónoma pertenece cada provincia?', cols: 2, alto: 35, niveles: false,
            gen: () => {
                const [p, c] = pick(PROVINCIAS);
                return { e: p, s: c, r: [{ tipo: 'opcion', v: c, opciones: opciones(c, CCAA.map(x => x[0])) }], pasos: [] };
            },
        },
        vertientes: {
            label: '🌊 Vertientes de España', titulo: '¿A qué vertiente pertenece cada río?', cols: 3, alto: 30, niveles: false,
            gen: () => {
                const [rio, v] = pick(VERTIENTES);
                return { e: `Río ${rio}`, s: `Vertiente ${v.toLowerCase()}`, r: [{ tipo: 'opcion', v, opciones: ['Atlántica', 'Mediterránea', 'Cantábrica'] }], pasos: [] };
            },
        },
    },
};
