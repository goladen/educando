// ═══════════════════════════════════════════════════════════════════
//  BANCO DE SEMÁNTICA Y LÉXICO — Lengua (Pikt)
// ═══════════════════════════════════════════════════════════════════

const pares = (txt) => txt.split(',').map(p => p.trim().split('-').map(s => s.trim())).filter(p => p.length === 2);

// nivel p = Primaria · e = ESO
export const SINONIMOS = [
    ...pares('alegre-contento, bonito-hermoso, rápido-veloz, empezar-comenzar, terminar-acabar, hablar-conversar, mirar-observar, casa-hogar, cara-rostro, coche-automóvil, listo-inteligente, enfadado-enojado, miedo-temor, regalo-obsequio, andar-caminar, gordo-grueso, delgado-flaco, antiguo-viejo, chico-muchacho, ayudar-auxiliar, cansado-agotado, dar-entregar, barco-navío, lento-pausado, estrecho-angosto, tirar-lanzar, pelo-cabello, idea-pensamiento, alumno-estudiante, error-equivocación').map(p => [...p, 'p']),
    ...pares('abundante-copioso, valiente-intrépido, perezoso-holgazán, terco-obstinado, evidente-obvio, escaso-exiguo, famoso-célebre, insólito-inusual, honesto-honrado, avaro-tacaño, ocioso-desocupado, efímero-fugaz, ileso-indemne, pulcro-aseado, ocaso-atardecer, auge-apogeo, hallar-encontrar, ostentoso-lujoso, erudito-sabio, dicha-felicidad, empatía-comprensión, contienda-batalla, menguar-disminuir, vestigio-huella, insensato-imprudente, elocuente-expresivo, sustentar-sostener, diáfano-transparente, apacible-sereno, desdén-desprecio').map(p => [...p, 'e']),
];

export const ANTONIMOS = [
    ...pares('alto-bajo, grande-pequeño, rápido-lento, día-noche, frío-caliente, abrir-cerrar, subir-bajar, alegre-triste, lleno-vacío, limpio-sucio, entrar-salir, mucho-poco, fuerte-débil, nuevo-viejo, ganar-perder, encender-apagar, dulce-salado, duro-blando, ancho-estrecho, cerca-lejos, empezar-terminar, recordar-olvidar, ruido-silencio, comprar-vender, rico-pobre, valiente-cobarde, antes-después, delante-detrás, mojado-seco, guerra-paz').map(p => [...p, 'p']),
    ...pares('generoso-tacaño, optimista-pesimista, aceptar-rechazar, atar-desatar, abundante-escaso, sincero-falso, aumentar-disminuir, construir-destruir, efímero-duradero, ignorante-sabio, prudente-imprudente, atraer-repeler, humilde-soberbio, legal-ilegal, presente-ausente, permitir-prohibir, amanecer-anochecer, tímido-extrovertido, acierto-error, simple-complejo, obedecer-desobedecer, preciso-impreciso, alabar-criticar, armonía-discordia, juntar-separar, exterior-interior, máximo-mínimo, superior-inferior, apacible-violento, esperanza-desesperanza').map(p => [...p, 'e']),
];

export const CAMPOS = [
    { campo: 'Frutas', emoji: '🍎', palabras: ['manzana', 'pera', 'plátano', 'naranja', 'uva', 'fresa', 'melón', 'cereza', 'kiwi', 'piña'] },
    { campo: 'Deportes', emoji: '⚽', palabras: ['fútbol', 'baloncesto', 'tenis', 'natación', 'balonmano', 'atletismo', 'ciclismo', 'escalada', 'voleibol', 'judo'] },
    { campo: 'Profesiones', emoji: '👩‍⚕️', palabras: ['médica', 'bombero', 'profesora', 'carpintero', 'abogada', 'cocinero', 'fontanero', 'piloto', 'arquitecta', 'enfermero'] },
    { campo: 'Muebles', emoji: '🛋️', palabras: ['mesa', 'silla', 'sofá', 'armario', 'cama', 'estantería', 'cómoda', 'sillón', 'escritorio', 'mesilla'] },
    { campo: 'Instrumentos musicales', emoji: '🎸', palabras: ['guitarra', 'piano', 'violín', 'flauta', 'tambor', 'trompeta', 'arpa', 'saxofón', 'clarinete', 'batería'] },
    { campo: 'Medios de transporte', emoji: '🚗', palabras: ['coche', 'tren', 'avión', 'barco', 'bicicleta', 'autobús', 'moto', 'metro', 'helicóptero', 'patinete'] },
    { campo: 'Prendas de vestir', emoji: '👕', palabras: ['camisa', 'pantalón', 'falda', 'abrigo', 'jersey', 'bufanda', 'calcetín', 'chaqueta', 'vestido', 'camiseta'] },
    { campo: 'Colores', emoji: '🎨', palabras: ['rojo', 'azul', 'verde', 'amarillo', 'morado', 'naranja', 'gris', 'rosa', 'marrón', 'blanco'] },
    { campo: 'El tiempo atmosférico', emoji: '⛅', palabras: ['lluvia', 'nieve', 'viento', 'granizo', 'niebla', 'tormenta', 'relámpago', 'nube', 'sol', 'trueno'] },
    { campo: 'Partes del cuerpo', emoji: '🖐️', palabras: ['cabeza', 'brazo', 'pierna', 'rodilla', 'codo', 'hombro', 'tobillo', 'cuello', 'muñeca', 'espalda'] },
    { campo: 'Sentimientos', emoji: '💗', palabras: ['alegría', 'tristeza', 'miedo', 'amor', 'ira', 'nostalgia', 'envidia', 'orgullo', 'ternura', 'vergüenza'] },
    { campo: 'Útiles escolares', emoji: '✏️', palabras: ['lápiz', 'goma', 'cuaderno', 'regla', 'estuche', 'mochila', 'sacapuntas', 'compás', 'tijeras', 'rotulador'] },
    { campo: 'Aves', emoji: '🐦', palabras: ['águila', 'gorrión', 'paloma', 'búho', 'loro', 'cigüeña', 'pingüino', 'avestruz', 'halcón', 'golondrina'] },
    { campo: 'Herramientas', emoji: '🔨', palabras: ['martillo', 'destornillador', 'sierra', 'llave inglesa', 'alicates', 'taladro', 'serrucho', 'lima', 'cincel', 'clavo'] },
    { campo: 'Accidentes geográficos', emoji: '🏔️', palabras: ['montaña', 'valle', 'río', 'lago', 'cabo', 'golfo', 'meseta', 'llanura', 'volcán', 'península'] },
];

// Familias léxicas: palabras que comparten lexema + «falsos amigos» que lo parecen pero no lo son.
export const FAMILIAS = [
    { lexema: 'mar', palabras: ['marino', 'marinero', 'marea', 'submarino', 'maremoto', 'marítimo'], falsas: ['mariposa', 'martes', 'marco', 'mármol'] },
    { lexema: 'pan', palabras: ['panadero', 'panadería', 'panecillo', 'empanada', 'panera'], falsas: ['pantalón', 'pantalla', 'panda', 'pantano'] },
    { lexema: 'flor', palabras: ['florero', 'floristería', 'florecer', 'florido', 'floral'], falsas: ['flotar', 'flojo', 'flota'] },
    { lexema: 'tierra', palabras: ['terreno', 'enterrar', 'terrestre', 'aterrizar', 'terráqueo', 'territorio'], falsas: ['terror', 'ternura', 'terco'] },
    { lexema: 'libr-', palabras: ['librería', 'librero', 'libreta', 'librito'], falsas: ['libre', 'libertad', 'librar', 'libra'] },
    { lexema: 'zapat-', palabras: ['zapatero', 'zapatilla', 'zapatería', 'zapatazo'], falsas: ['zapallo', 'zapear'] },
    { lexema: 'leche', palabras: ['lechero', 'lechería', 'lechoso', 'lechal'], falsas: ['lechuga', 'lechuza'] },
    { lexema: 'agua', palabras: ['aguacero', 'aguado', 'desaguar', 'aguador', 'paraguas'], falsas: ['aguacate', 'agudo', 'aguja', 'águila'] },
    { lexema: 'sol', palabras: ['solar', 'soleado', 'solsticio', 'parasol', 'insolación'], falsas: ['soldado', 'soledad', 'solución', 'soltar'] },
    { lexema: 'casa', palabras: ['casita', 'caserío', 'casero', 'caserón'], falsas: ['casco', 'casino', 'castillo', 'cascada'] },
    { lexema: 'pez/pesc-', palabras: ['pescado', 'pescador', 'pescadería', 'pecera', 'pesquero'], falsas: ['pesado', 'pesadilla', 'pestaña', 'pescuezo'] },
    { lexema: 'luz', palabras: ['lucero', 'luminoso', 'iluminar', 'lucir', 'luminaria'], falsas: ['lucha', 'luna', 'lugar', 'lujo'] },
    { lexema: 'cant-', palabras: ['cantante', 'canción', 'cantautor', 'cantar', 'canto'], falsas: ['cantidad', 'cántaro', 'cantimplora', 'cantera'] },
    { lexema: 'hierro', palabras: ['herrero', 'herradura', 'herramienta', 'herrería', 'férreo'], falsas: ['herida', 'hermano', 'herencia', 'hervir'] },
    { lexema: 'nube', palabras: ['nublado', 'nubarrón', 'nubosidad', 'anublar'], falsas: ['nuca', 'nuez', 'nudo'] },
];

// Refranes y frases hechas: t = texto, s = significado
export const REFRANES = [
    { t: 'Más vale pájaro en mano que ciento volando', s: 'Es mejor tener algo seguro que muchas cosas inseguras.', tipo: 'refrán' },
    { t: 'No por mucho madrugar amanece más temprano', s: 'Las cosas tienen su ritmo y no se pueden adelantar por más prisa que tengamos.', tipo: 'refrán' },
    { t: 'A quien madruga, Dios le ayuda', s: 'Quien se esfuerza y empieza pronto tiene más posibilidades de conseguir lo que quiere.', tipo: 'refrán' },
    { t: 'Perro ladrador, poco mordedor', s: 'Quien amenaza mucho suele hacer poco.', tipo: 'refrán' },
    { t: 'En boca cerrada no entran moscas', s: 'A veces es más prudente callar.', tipo: 'refrán' },
    { t: 'Dime con quién andas y te diré quién eres', s: 'A las personas se las conoce por sus amistades.', tipo: 'refrán' },
    { t: 'Ojos que no ven, corazón que no siente', s: 'Lo que no sabemos no nos hace sufrir.', tipo: 'refrán' },
    { t: 'Camarón que se duerme se lo lleva la corriente', s: 'Quien se descuida pierde oportunidades.', tipo: 'refrán' },
    { t: 'Cría cuervos y te sacarán los ojos', s: 'Quien hace favores a gente desagradecida puede recibir daño a cambio.', tipo: 'refrán' },
    { t: 'Al mal tiempo, buena cara', s: 'Hay que afrontar las dificultades con buen ánimo.', tipo: 'refrán' },
    { t: 'Quien mucho abarca, poco aprieta', s: 'Quien intenta hacer demasiadas cosas a la vez no hace bien ninguna.', tipo: 'refrán' },
    { t: 'A caballo regalado no le mires el diente', s: 'Lo que nos regalan no se critica.', tipo: 'refrán' },
    { t: 'Más vale tarde que nunca', s: 'Es mejor hacer algo con retraso que no hacerlo.', tipo: 'refrán' },
    { t: 'El que la sigue la consigue', s: 'Con constancia se alcanzan los objetivos.', tipo: 'refrán' },
    { t: 'No hay mal que por bien no venga', s: 'De una situación mala puede salir algo bueno.', tipo: 'refrán' },
    { t: 'Agua que no has de beber, déjala correr', s: 'No te metas en lo que no te interesa o no te corresponde.', tipo: 'refrán' },
    { t: 'Donde fueres, haz lo que vieres', s: 'Hay que adaptarse a las costumbres del lugar en el que se está.', tipo: 'refrán' },
    { t: 'Zapatero, a tus zapatos', s: 'Cada uno debe ocuparse de lo que sabe y no opinar de lo que desconoce.', tipo: 'refrán' },
    { t: 'A buen entendedor, pocas palabras bastan', s: 'Una persona lista entiende enseguida sin largas explicaciones.', tipo: 'refrán' },
    { t: 'Del dicho al hecho hay mucho trecho', s: 'Es más fácil decir las cosas que hacerlas.', tipo: 'refrán' },
    { t: 'Estar en las nubes', s: 'Estar distraído, pensando en otras cosas.', tipo: 'frase hecha' },
    { t: 'Tomar el pelo', s: 'Burlarse de alguien o engañarle en broma.', tipo: 'frase hecha' },
    { t: 'Costar un ojo de la cara', s: 'Ser muy caro.', tipo: 'frase hecha' },
    { t: 'Meter la pata', s: 'Equivocarse o decir algo inoportuno.', tipo: 'frase hecha' },
    { t: 'Ser pan comido', s: 'Ser muy fácil.', tipo: 'frase hecha' },
    { t: 'Echar una mano', s: 'Ayudar a alguien.', tipo: 'frase hecha' },
    { t: 'Estar como una cabra', s: 'Estar un poco loco o comportarse de forma extravagante.', tipo: 'frase hecha' },
    { t: 'Dormirse en los laureles', s: 'Dejar de esforzarse después de un éxito.', tipo: 'frase hecha' },
    { t: 'Ponerse las pilas', s: 'Empezar a esforzarse o a actuar con energía.', tipo: 'frase hecha' },
    { t: 'Tirar la toalla', s: 'Rendirse, abandonar un esfuerzo.', tipo: 'frase hecha' },
    { t: 'Ser uña y carne', s: 'Ser muy amigos, estar siempre juntos.', tipo: 'frase hecha' },
    { t: 'Llover a cántaros', s: 'Llover muchísimo.', tipo: 'frase hecha' },
    { t: 'Quedarse en blanco', s: 'No poder recordar nada en un momento dado.', tipo: 'frase hecha' },
    { t: 'Hablar por los codos', s: 'Hablar demasiado.', tipo: 'frase hecha' },
    { t: 'Estar hecho polvo', s: 'Estar muy cansado o abatido.', tipo: 'frase hecha' },
    { t: 'Ir al grano', s: 'Hablar directamente de lo importante, sin rodeos.', tipo: 'frase hecha' },
    { t: 'Buscarle tres pies al gato', s: 'Complicar las cosas buscando problemas donde no los hay.', tipo: 'frase hecha' },
    { t: 'Dar gato por liebre', s: 'Engañar dando algo de peor calidad de lo prometido.', tipo: 'frase hecha' },
    { t: 'Estar entre la espada y la pared', s: 'Tener que elegir entre dos opciones difíciles.', tipo: 'frase hecha' },
    { t: 'Tener la sartén por el mango', s: 'Tener el control de una situación.', tipo: 'frase hecha' },
];

// Para «Completa el refrán»: corte por la coma o por la mitad de las palabras.
export function partirRefran(t) {
    if (t.includes(',')) {
        const i = t.indexOf(',');
        return [t.slice(0, i).trim(), t.slice(i + 1).trim()];
    }
    const w = t.split(' ');
    const k = Math.ceil(w.length / 2);
    return [w.slice(0, k).join(' '), w.slice(k).join(' ')];
}
