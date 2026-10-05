// ─────────────────────────────────────────────────────────────────────────────
//  Fuentes de BIOLOGÍA para las fichas: anatomía (dataset con fotos de
//  BiologiaApp), clasificación de animales, la célula y aparatos del cuerpo.
// ─────────────────────────────────────────────────────────────────────────────
import ANATOMIA from '../../anatomia_avanzada_dataset.json';
import { pick } from '../fuenteTexto';

const barajar = (a) => [...a].sort(() => Math.random() - 0.5);
// 3 distractores + la correcta, sin repetir
const opciones = (correcta, pool, n = 4) => barajar([correcta, ...barajar([...new Set(pool)].filter(x => x !== correcta)).slice(0, n - 1)]);
const porNivel = (nv) => ANATOMIA.filter(a => (nv === 1 ? a.dificultad === 'Fácil' : nv === 2 ? a.dificultad !== 'Experto' : true));
const SISTEMAS = [...new Set(ANATOMIA.map(a => a.sistema))];

// ── Animales: grupo y alimentación ───────────────────────────────────────────
const ANIMALES = [
    ['perro', 'Mamífero', 'Omnívoro'], ['vaca', 'Mamífero', 'Herbívoro'], ['león', 'Mamífero', 'Carnívoro'], ['ballena', 'Mamífero', 'Carnívoro'],
    ['murciélago', 'Mamífero', 'Omnívoro'], ['delfín', 'Mamífero', 'Carnívoro'], ['caballo', 'Mamífero', 'Herbívoro'], ['oso', 'Mamífero', 'Omnívoro'],
    ['conejo', 'Mamífero', 'Herbívoro'], ['jirafa', 'Mamífero', 'Herbívoro'], ['águila', 'Ave', 'Carnívoro'], ['pingüino', 'Ave', 'Carnívoro'],
    ['gallina', 'Ave', 'Omnívoro'], ['avestruz', 'Ave', 'Omnívoro'], ['loro', 'Ave', 'Herbívoro'], ['búho', 'Ave', 'Carnívoro'],
    ['cocodrilo', 'Reptil', 'Carnívoro'], ['tortuga', 'Reptil', 'Omnívoro'], ['serpiente', 'Reptil', 'Carnívoro'], ['lagarto', 'Reptil', 'Carnívoro'],
    ['camaleón', 'Reptil', 'Carnívoro'], ['iguana', 'Reptil', 'Herbívoro'], ['rana', 'Anfibio', 'Carnívoro'], ['sapo', 'Anfibio', 'Carnívoro'],
    ['salamandra', 'Anfibio', 'Carnívoro'], ['tritón', 'Anfibio', 'Carnívoro'], ['tiburón', 'Pez', 'Carnívoro'], ['sardina', 'Pez', 'Carnívoro'],
    ['trucha', 'Pez', 'Carnívoro'], ['caballito de mar', 'Pez', 'Carnívoro'], ['atún', 'Pez', 'Carnívoro'], ['carpa', 'Pez', 'Omnívoro'],
    ['mariposa', 'Insecto', 'Herbívoro'], ['hormiga', 'Insecto', 'Omnívoro'], ['abeja', 'Insecto', 'Herbívoro'], ['saltamontes', 'Insecto', 'Herbívoro'],
    ['araña', 'Arácnido', 'Carnívoro'], ['escorpión', 'Arácnido', 'Carnívoro'], ['cangrejo', 'Crustáceo', 'Omnívoro'], ['gamba', 'Crustáceo', 'Omnívoro'],
    ['caracol', 'Molusco', 'Herbívoro'], ['pulpo', 'Molusco', 'Carnívoro'], ['mejillón', 'Molusco', 'Herbívoro'], ['lombriz de tierra', 'Anélido', 'Herbívoro'],
    ['estrella de mar', 'Equinodermo', 'Carnívoro'], ['erizo de mar', 'Equinodermo', 'Herbívoro'], ['medusa', 'Cnidario', 'Carnívoro'],
];
const VERTEBRADOS = ['Mamífero', 'Ave', 'Reptil', 'Anfibio', 'Pez'];
const INVERTEBRADOS = ['Insecto', 'Arácnido', 'Crustáceo', 'Molusco', 'Anélido', 'Equinodermo', 'Cnidario'];

// ── La célula ────────────────────────────────────────────────────────────────
const ORGANULOS = [
    ['Núcleo', 'Contiene el material genético (ADN) y controla la actividad de la célula.'],
    ['Membrana plasmática', 'Envuelve la célula y controla qué sustancias entran y salen.'],
    ['Citoplasma', 'Medio acuoso donde se encuentran los orgánulos.'],
    ['Mitocondria', 'Realiza la respiración celular y obtiene la energía.'],
    ['Cloroplasto', 'Realiza la fotosíntesis (solo en células vegetales).'],
    ['Pared celular', 'Capa rígida que protege y da forma a la célula vegetal.'],
    ['Ribosoma', 'Fabrica las proteínas.'],
    ['Vacuola', 'Almacena agua, nutrientes y sustancias de desecho.'],
    ['Aparato de Golgi', 'Modifica, empaqueta y distribuye las proteínas.'],
    ['Retículo endoplasmático', 'Red de membranas que transporta sustancias por la célula.'],
    ['Lisosoma', 'Contiene enzimas que digieren sustancias y restos celulares.'],
];

// ── Funciones de los aparatos ────────────────────────────────────────────────
const APARATOS = [
    ['Transforma los alimentos en nutrientes', 'Digestivo'], ['Absorbe los nutrientes en el intestino delgado', 'Digestivo'],
    ['Toma el oxígeno del aire y expulsa el dióxido de carbono', 'Respiratorio'], ['El intercambio de gases ocurre en los alvéolos', 'Respiratorio'],
    ['Transporta la sangre por todo el cuerpo', 'Circulatorio'], ['El corazón bombea la sangre', 'Circulatorio'],
    ['Filtra la sangre y elimina los desechos en la orina', 'Excretor'], ['Los riñones fabrican la orina', 'Excretor'],
    ['Recibe la información de los sentidos y da órdenes', 'Nervioso'], ['El cerebro y la médula espinal lo forman', 'Nervioso'],
    ['Permite el movimiento gracias a huesos y músculos', 'Locomotor'], ['Sostiene el cuerpo y protege los órganos', 'Locomotor'],
    ['Produce las células sexuales (gametos)', 'Reproductor'], ['Fabrica hormonas que regulan el crecimiento', 'Endocrino'],
];
const NOMBRES_APARATOS = [...new Set(APARATOS.map(a => a[1]))];

export const BIOLOGIA = {
    id: 'biologia', nombre: 'Biología', emoji: '🔬', color: '#2E7D32', etapas: ['primaria', 'eso'],
    desc: 'Anatomía con fotos, clasificación de animales, la célula y aparatos del cuerpo',
    tipos: {
        anatomiaFoto: {
            label: '📷 ¿Qué es? (foto)', titulo: 'Escribe el nombre de cada órgano, hueso o músculo.', cols: 3, alto: 35,
            gen: (nv) => {
                const a = pick(porNivel(nv));
                return { img: a.imagenUrl, imgAlto: 4.5, e: '', s: a.nombre, r: [{ tipo: 'texto', v: a.nombre, placeholder: 'nombre' }], pasos: [`${a.categoria} · ${a.sistema}`, a.descripcion] };
            },
        },
        anatomiaDefinicion: {
            label: '📖 Definiciones', titulo: '¿De qué órgano, hueso o músculo se trata?', cols: 1, alto: 40,
            gen: (nv) => {
                const a = pick(porNivel(nv));
                return { largo: true, e: a.descripcion, s: a.nombre, r: [{ tipo: 'texto', v: a.nombre, placeholder: 'nombre' }], pasos: [`${a.categoria} del ${a.sistema.toLowerCase()}`] };
            },
        },
        anatomiaSistema: {
            label: '🫀 ¿A qué sistema pertenece?', titulo: 'Indica a qué sistema o aparato pertenece cada elemento.', cols: 2, alto: 40,
            gen: (nv) => {
                const a = pick(porNivel(nv));
                return { e: a.nombre, s: a.sistema, r: [{ tipo: 'opcion', v: a.sistema, opciones: opciones(a.sistema, SISTEMAS) }], pasos: [a.descripcion] };
            },
        },
        organoHuesoMusculo: {
            label: '🦴 Órgano, hueso o músculo', titulo: 'Clasifica cada elemento: órgano, hueso o músculo.', cols: 3, alto: 30,
            gen: (nv) => {
                const a = pick(porNivel(nv));
                return { e: a.nombre, s: a.categoria, r: [{ tipo: 'opcion', v: a.categoria, opciones: ['Órgano', 'Hueso', 'Músculo'] }], pasos: [a.descripcion] };
            },
        },
        clasificarAnimales: {
            label: '🐾 Clasificar animales', titulo: 'Escribe a qué grupo pertenece cada animal.', cols: 3, alto: 35,
            gen: (nv) => {
                const lista = nv === 1 ? ANIMALES.filter(a => VERTEBRADOS.includes(a[1])) : ANIMALES;
                const [animal, grupo] = pick(lista);
                const vert = VERTEBRADOS.includes(grupo);
                return { e: animal[0].toUpperCase() + animal.slice(1), s: `${grupo} (${vert ? 'vertebrado' : 'invertebrado'})`,
                    r: [{ tipo: 'opcion', v: grupo, opciones: opciones(grupo, nv === 1 ? VERTEBRADOS : [...VERTEBRADOS, ...INVERTEBRADOS]) }],
                    pasos: [vert ? 'Tiene esqueleto interno con columna vertebral' : 'No tiene columna vertebral'] };
            },
        },
        vertebradoInvertebrado: {
            label: '🦴 ¿Vertebrado o invertebrado?', titulo: '¿Es vertebrado o invertebrado?', cols: 3, alto: 30, niveles: false,
            gen: () => {
                const [animal, grupo] = pick(ANIMALES), vert = VERTEBRADOS.includes(grupo);
                return { e: animal[0].toUpperCase() + animal.slice(1), s: vert ? 'Vertebrado' : 'Invertebrado', r: [{ tipo: 'opcion', v: vert ? 'Vertebrado' : 'Invertebrado', opciones: ['Vertebrado', 'Invertebrado'] }], pasos: [`Es ${grupo === 'Ave' ? 'un ave' : `un ${grupo.toLowerCase()}`}`] };
            },
        },
        alimentacion: {
            label: '🥕 ¿Qué come?', titulo: '¿Es herbívoro, carnívoro u omnívoro?', cols: 3, alto: 30, niveles: false,
            gen: () => {
                const [animal, , dieta] = pick(ANIMALES);
                return { e: animal[0].toUpperCase() + animal.slice(1), s: dieta, r: [{ tipo: 'opcion', v: dieta, opciones: ['Herbívoro', 'Carnívoro', 'Omnívoro'] }], pasos: [dieta === 'Herbívoro' ? 'Se alimenta de plantas' : dieta === 'Carnívoro' ? 'Se alimenta de otros animales' : 'Come plantas y animales'] };
            },
        },
        celula: {
            label: '🧫 La célula', titulo: '¿Qué orgánulo de la célula realiza esta función?', cols: 1, alto: 40, niveles: false,
            gen: () => {
                const [org, fun] = pick(ORGANULOS);
                return { largo: true, e: fun, s: org, r: [{ tipo: 'opcion', v: org, opciones: opciones(org, ORGANULOS.map(o => o[0])) }], pasos: [`${org}: ${fun}`] };
            },
        },
        aparatos: {
            label: '🫁 Aparatos y sistemas', titulo: '¿Qué aparato o sistema realiza esta función?', cols: 1, alto: 40, niveles: false,
            gen: () => {
                const [fun, ap] = pick(APARATOS);
                return { largo: true, e: fun, s: `Aparato ${ap.toLowerCase()}`.replace('Aparato nervioso', 'Sistema nervioso').replace('Aparato endocrino', 'Sistema endocrino'), r: [{ tipo: 'opcion', v: ap, opciones: opciones(ap, NOMBRES_APARATOS) }], pasos: [] };
            },
        },
    },
};
