// Datos SEO por juego para el prerender (scripts/prerender.mjs).
// Cada slug DEBE coincidir con una ruta que el SPA ya sepa abrir (ver RUTAS_RESERVADAS
// en src/App.jsx y el sitemap). Añadir un juego aquí = añadir su <url> al sitemap.xml.
//
// Campos:
//   slug     -> ruta pública (/slug)
//   h1       -> titular visible + <h1> indexable
//   title    -> <title> (mantener < ~60 caracteres)
//   desc     -> meta description + og:description (~150 caracteres)
//   nivel    -> etapa educativa (alineación curricular)
//   materia  -> asignatura
//   emoji    -> icono grande del bloque
//   color    -> color de acento del degradado

export const GAMES = [
  {
    slug: 'pasapalabra', emoji: '🔤', color: '#0A0E45',
    h1: 'Pasapalabra educativo',
    title: 'Pasapalabra educativo para clase | PiKT',
    desc: 'Crea y juega un rosco de Pasapalabra con tus propias preguntas. Gratis, sin registro y listo para proyectar. Repasa cualquier asignatura en clase.',
    nivel: 'Primaria y Secundaria', materia: 'Todas las asignaturas',
  },
  {
    slug: 'burbujas', emoji: '🫧', color: '#de896e',
    h1: 'Caza Burbujas',
    title: 'Caza Burbujas: preguntas para clase | PiKT',
    desc: 'Juego de preguntas donde explotas la burbuja con la respuesta correcta. Gratis y sin registro, perfecto para repasar contenidos proyectando en el aula.',
    nivel: 'Primaria y Secundaria', materia: 'Todas las asignaturas',
  },
  {
    slug: 'pikatron', emoji: '🏃', color: '#2196F3',
    h1: 'Pikatron',
    title: 'Pikatron: juego runner con preguntas | PiKT',
    desc: 'Juego tipo runner en el que corres y respondes preguntas de repaso. Gratis, sin registro y listo para proyectar en clase con tus propios contenidos.',
    nivel: 'Primaria y Secundaria', materia: 'Todas las asignaturas',
  },
  {
    slug: 'aparejados', emoji: '🃏', color: '#FF9800',
    h1: 'AparejaDOS',
    title: 'AparejaDOS: juego de parejas para clase | PiKT',
    desc: 'Juego de memoria y parejas para repasar vocabulario y conceptos. Gratis, sin registro y proyectable. Crea tus propias parejas para cualquier asignatura.',
    nivel: 'Primaria y Secundaria', materia: 'Todas las asignaturas',
  },
  {
    slug: 'ruleta', emoji: '🎡', color: '#f1c40f',
    h1: 'Ruleta de preguntas',
    title: 'Ruleta de la fortuna educativa | PiKT',
    desc: 'Resuelve el panel oculto girando la ruleta, al estilo de La Ruleta de la Fortuna. Gratis y sin registro, ideal para repasar en clase proyectando.',
    nivel: 'Primaria y Secundaria', materia: 'Lengua y repaso',
  },
  {
    slug: 'wordle', emoji: '🟩', color: '#2e7d32',
    h1: 'Wordle educativo',
    title: 'Wordle educativo en español para clase | PiKT',
    desc: 'Adivina la palabra en 6 intentos con tu propio vocabulario. Wordle en español gratis y sin registro, listo para proyectar y repasar en el aula.',
    nivel: 'Primaria y Secundaria', materia: 'Lengua e idiomas',
  },
  {
    slug: 'sopa_letras', emoji: '🔠', color: '#e67e22',
    h1: 'Sopa de letras',
    title: 'Sopa de letras para clase | PiKT',
    desc: 'Encuentra las palabras ocultas con tu propio listado de vocabulario. Sopa de letras gratis, sin registro y proyectable para cualquier asignatura.',
    nivel: 'Primaria y Secundaria', materia: 'Lengua e idiomas',
  },
  {
    slug: 'sintaxis', emoji: '🖍️', color: '#3498db',
    h1: 'Análisis de sintaxis',
    title: 'Analizar sintaxis de frases para clase | PiKT',
    desc: 'Analiza frases por niveles de dificultad: sujeto, predicado y complementos. Herramienta gratis y sin registro para clase de Lengua, lista para proyectar.',
    nivel: 'Secundaria', materia: 'Lengua castellana',
  },
  {
    slug: 'mathle', emoji: '🔢', color: '#1565C0',
    h1: 'Mathle',
    title: 'Mathle: el Wordle de las matemáticas | PiKT',
    desc: 'Adivina la ecuación matemática oculta, al estilo Wordle pero con números. Gratis, sin registro y proyectable para practicar cálculo en clase.',
    nivel: 'Primaria y Secundaria', materia: 'Matemáticas',
  },
  {
    slug: 'geometrix', emoji: '📐', color: '#009688',
    h1: 'Geometrix',
    title: 'Geometrix: áreas y volúmenes | PiKT',
    desc: 'Calcula áreas y volúmenes con regla virtual y figuras interactivas. Herramienta de geometría gratis y sin registro, lista para proyectar en clase.',
    nivel: 'Secundaria', materia: 'Matemáticas',
  },
  {
    slug: 'calculo', emoji: '🧠', color: '#E91E63',
    h1: 'Cálculo mental',
    title: 'Cálculo mental con tiempo para clase | PiKT',
    desc: 'Agilidad mental con operaciones contrarreloj y niveles de dificultad. Gratis, sin registro y proyectable para practicar cálculo en Primaria y Secundaria.',
    nivel: 'Primaria y Secundaria', materia: 'Matemáticas',
  },
  {
    slug: 'ecuaciones', emoji: '⚖️', color: '#3F51B5',
    h1: 'Ecuaciones',
    title: 'Ecuaciones: despejar la X paso a paso | PiKT',
    desc: 'Resuelve ecuaciones despejando la X paso a paso, con explicación de cada movimiento. Herramienta gratis y sin registro, lista para proyectar en clase.',
    nivel: 'Secundaria', materia: 'Matemáticas',
  },
  {
    slug: 'pilive', emoji: '📱', color: '#9C27B0',
    h1: 'Pi Live',
    title: 'Pi Live: preguntas en vivo para clase | PiKT',
    desc: 'Juego de preguntas en vivo (estilo Kahoot): los alumnos responden desde el móvil en tiempo real. Gratis, sin registro y listo para proyectar en el aula.',
    nivel: 'Primaria y Secundaria', materia: 'Todas las asignaturas',
  },
  {
    slug: 'mathlive', emoji: '➗', color: '#009688',
    h1: 'MathLive',
    title: 'MathLive: matemáticas en tiempo real | PiKT',
    desc: 'Compite con las matemáticas en tiempo real con toda la clase. Gratis, sin registro y proyectable para practicar cálculo de forma colaborativa.',
    nivel: 'Primaria y Secundaria', materia: 'Matemáticas',
  },
  {
    slug: 'olympic_live', emoji: '🏅', color: '#D32F2F',
    h1: 'Olympic Live',
    title: 'Olympic Live: minijuegos en vivo | PiKT',
    desc: 'Compite en minijuegos y retos de cálculo en vivo con toda la clase. Gratis, sin registro y listo para proyectar en el aula.',
    nivel: 'Primaria y Secundaria', materia: 'Matemáticas y repaso',
  },
  {
    slug: 'q-sender', emoji: '📮', color: '#2c3e50',
    h1: 'Q-Sender',
    title: 'Q-Sender: alumnos envían preguntas | PiKT',
    desc: 'Los alumnos envían sus preguntas al profesor para crear un juego colaborativo. Herramienta gratis y sin registro para dinamizar el repaso en clase.',
    nivel: 'Primaria y Secundaria', materia: 'Todas las asignaturas',
  },
  {
    slug: 'populares', emoji: '⭐', color: '#7c3aed',
    h1: 'Juegos educativos populares',
    title: 'Juegos educativos gratis para clase | PiKT',
    desc: 'Los juegos y herramientas educativas más usados de PiKT: Pasapalabra, Wordle, Mathle, sopa de letras y más. Gratis, sin registro y listos para proyectar.',
    nivel: 'Primaria y Secundaria', materia: 'Todas las asignaturas',
  },
];
