// ─────────────────────────────────────────────────────────────────────────────
//  Bancos del modo libre de Bunker. { q, ok, mal[3] } por materia (MATES, GEO, ENG, CIEN).
//  Extraído de BunkerDisparo.jsx (que lo importa con el mismo nombre local) para
//  usarlo también en las «Preguntas de PiKT» de todos los juegos (bancoPreguntas/recursosPikt.js).
// ─────────────────────────────────────────────────────────────────────────────

export const BANCOS_BUNKER = {
    MATES: {
        nombre: 'Matemáticas', emoji: '➗', color: '#3498db',
        preguntas: [
            { q: '¿Cuál es un número primo?', ok: '3', mal: ['4', '6', '9'] },
            { q: '¿Cuánto es 7 × 8?', ok: '56', mal: ['54', '48', '64'] },
            { q: '¿Raíz cuadrada de 144?', ok: '12', mal: ['11', '14', '24'] },
            { q: '¿Cuál es múltiplo de 9?', ok: '81', mal: ['82', '76', '93'] },
            { q: '¿Cuánto es 2⁵?', ok: '32', mal: ['10', '25', '64'] },
            { q: '¿Cuál es un número par?', ok: '38', mal: ['37', '41', '55'] },
            { q: '¿Cuánto es 15 % de 200?', ok: '30', mal: ['15', '20', '35'] },
            { q: '¿Cuál es divisible por 3?', ok: '123', mal: ['124', '125', '127'] },
            { q: '¿Cuánto es 9 × 9?', ok: '81', mal: ['72', '89', '91'] },
            { q: '¿Cuál es el mcd de 12 y 18?', ok: '6', mal: ['3', '9', '36'] },
            { q: '¿Cuánto es 144 ÷ 12?', ok: '12', mal: ['11', '13', '14'] },
            { q: '¿Cuál es un número primo?', ok: '17', mal: ['15', '21', '27'] },
            { q: '¿Cuánto es 3⁴?', ok: '81', mal: ['12', '27', '64'] },
            { q: '¿Cuál es el 25 % de 80?', ok: '20', mal: ['15', '25', '40'] },
        ],
    },
    GEO: {
        nombre: 'Geografía', emoji: '🌍', color: '#27ae60',
        preguntas: [
            { q: '¿Capital de Francia?', ok: 'París', mal: ['Madrid', 'Bruselas', 'Praga'] },
            { q: '¿Capital de Italia?', ok: 'Roma', mal: ['Milán', 'Lisboa', 'Atenas'] },
            { q: '¿Capital de Alemania?', ok: 'Berlín', mal: ['Múnich', 'Viena', 'Varsovia'] },
            { q: '¿Capital de Portugal?', ok: 'Lisboa', mal: ['Oporto', 'Sevilla', 'Madrid'] },
            { q: '¿Capital de Reino Unido?', ok: 'Londres', mal: ['Dublín', 'Edimburgo', 'Oxford'] },
            { q: '¿Río más largo del mundo?', ok: 'Amazonas', mal: ['Nilo', 'Misisipi', 'Danubio'] },
            { q: '¿Continente del Sahara?', ok: 'África', mal: ['Asia', 'Oceanía', 'América'] },
            { q: '¿Océano más grande?', ok: 'Pacífico', mal: ['Atlántico', 'Índico', 'Ártico'] },
            { q: '¿Capital de Japón?', ok: 'Tokio', mal: ['Pekín', 'Seúl', 'Bangkok'] },
            { q: '¿País de la Torre Eiffel?', ok: 'Francia', mal: ['Italia', 'España', 'Bélgica'] },
            { q: '¿Cordillera de América del Sur?', ok: 'Andes', mal: ['Alpes', 'Himalaya', 'Urales'] },
            { q: '¿Capital de Egipto?', ok: 'El Cairo', mal: ['Argel', 'Túnez', 'Rabat'] },
            { q: '¿Isla más grande del mundo?', ok: 'Groenlandia', mal: ['Australia', 'Borneo', 'Madagascar'] },
        ],
    },
    ENG: {
        nombre: 'Inglés', emoji: '🇬🇧', color: '#e67e22',
        preguntas: [
            { q: '"Perro" en inglés', ok: 'Dog', mal: ['Cat', 'Cow', 'Duck'] },
            { q: '"Rojo" en inglés', ok: 'Red', mal: ['Blue', 'Green', 'Black'] },
            { q: 'Plural de "child"', ok: 'Children', mal: ['Childs', 'Childes', 'Childrens'] },
            { q: 'Pasado de "go"', ok: 'Went', mal: ['Goed', 'Gone', 'Goes'] },
            { q: '"Lunes" en inglés', ok: 'Monday', mal: ['Sunday', 'Manday', 'Moonday'] },
            { q: '"Manzana" en inglés', ok: 'Apple', mal: ['Orange', 'Grape', 'Pear'] },
            { q: 'Pasado de "eat"', ok: 'Ate', mal: ['Eated', 'Eaten', 'Eats'] },
            { q: '"Casa" en inglés', ok: 'House', mal: ['Horse', 'Hose', 'Mouse'] },
            { q: '"Número 3" en inglés', ok: 'Three', mal: ['Tree', 'Third', 'Thirty'] },
            { q: 'Artículo antes de "apple"', ok: 'An', mal: ['A', 'The', 'Any'] },
            { q: '"Feliz" en inglés', ok: 'Happy', mal: ['Angry', 'Hungry', 'Sad'] },
            { q: 'Pasado de "have"', ok: 'Had', mal: ['Haved', 'Has', 'Haven'] },
            { q: '"Agua" en inglés', ok: 'Water', mal: ['Wine', 'Milk', 'Water fall'] },
        ],
    },
    CIEN: {
        nombre: 'Ciencias', emoji: '🔬', color: '#9b59b6',
        preguntas: [
            { q: 'Símbolo químico del oro', ok: 'Au', mal: ['Ag', 'Go', 'Or'] },
            { q: 'Planeta más cercano al Sol', ok: 'Mercurio', mal: ['Venus', 'Marte', 'Tierra'] },
            { q: 'Gas que respiramos para vivir', ok: 'Oxígeno', mal: ['Nitrógeno', 'CO₂', 'Helio'] },
            { q: '¿Cuántos huesos tiene el adulto?', ok: '206', mal: ['201', '106', '306'] },
            { q: 'Órgano que bombea la sangre', ok: 'Corazón', mal: ['Pulmón', 'Hígado', 'Riñón'] },
            { q: 'Fuerza que nos atrae al suelo', ok: 'Gravedad', mal: ['Fricción', 'Magnetismo', 'Inercia'] },
            { q: 'Estado del agua a 0 °C', ok: 'Sólido', mal: ['Líquido', 'Gas', 'Plasma'] },
            { q: 'Animal mamífero', ok: 'Delfín', mal: ['Tiburón', 'Cocodrilo', 'Atún'] },
            { q: 'Fórmula del agua', ok: 'H₂O', mal: ['CO₂', 'O₂', 'HO₂'] },
            { q: 'Astro que ilumina el día', ok: 'Sol', mal: ['Luna', 'Marte', 'Venus'] },
            { q: 'Parte de la planta que hace fotosíntesis', ok: 'Hoja', mal: ['Raíz', 'Tallo', 'Flor'] },
            { q: 'Velocidad de la luz aprox.', ok: '300.000 km/s', mal: ['3.000 km/s', '30 km/s', '1.000 km/s'] },
        ],
    },
};
