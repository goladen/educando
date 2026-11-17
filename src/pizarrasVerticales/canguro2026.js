// XXXI Canguro Matemático 2026 · Nivel 4 (4.º ESO) · Modelo A — Federación Española de Sociedades de Profesores de Matemáticas.
// Enunciados del cuadernillo oficial (www.canguromat.es) y respuestas de la hoja oficial de soluciones.
// Las explicaciones («explica») son propias de Pikt. Las figuras se extrajeron del PDF a public/canguro/2026-4eso/.
// interactivo: id de una manipulación de CanguroInteractivos.jsx.

import { CANGURO_1ESO, CANGURO_2ESO, CANGURO_3ESO, CANGURO_1BACH, CANGURO_2BACH } from './canguro2026Niveles';

const F = n => `/canguro/2026-4eso/${n}.png`;

export const CANGURO_INFO = {
    id: 'canguro2026_4eso',
    titulo: 'Canguro Matemático 2026',
    nivel: 'Nivel 4 · 4.º ESO',
    fecha: '24 de marzo de 2026',
    pdf: '/canguro/canguro-2026-4eso.pdf',
    pdfOficial: 'https://canguromat.es/wp-content/uploads/2026/04/4-ESO-2026.pdf',
    soluciones: 'https://canguromat.es/wp-content/uploads/2026/04/Soluciones-pruebas-2026.pdf',
    web: 'https://canguromat.es',
    minutos: 75,
    puntosIniciales: 30,
    credito: 'Problemas del XXXI Canguro Matemático 2026 (FESPM · canguromat.es). Se reproducen con fines educativos citando la fuente.',
};

export const CANGURO_PREGUNTAS = [
    // ───────────── 3 puntos ─────────────
    {
        n: 1, puntos: 3, pagina: 3, correcta: 'C', interactivo: 'botones',
        enunciado: 'Julia tiene la imagen de un rostro en un sistema de coordenadas. Quiere realizar la transformación de la figura.\n\nPara realizarla dispone de dos botones: uno gira la imagen 90° en sentido horario alrededor del origen y con el otro realiza una simetría con respecto al eje X.\n\n¿Cuántas veces como mínimo debe pulsar Julia un botón?',
        figuras: [F('q1'), F('q1b')],
        opciones: ['1', '2', '3', '4', '5'],
        explica: 'El rostro pasa del 2.º al 1.er cuadrante sin girarse: es una simetría respecto al eje Y. Un giro solo no sirve (el rostro quedaría tumbado) y con dos pulsaciones solo se consiguen giros de 180° o simetrías respecto a las diagonales y = x, y = −x. Con tres sí: dos giros de 90° (giro de 180°) y una simetría respecto al eje X dan la simetría respecto al eje Y.',
    },
    {
        n: 2, puntos: 3, pagina: 3, correcta: 'A', interactivo: 'canicas',
        enunciado: 'Lidia tiene 7 canicas: 5 blancas y 2 rojas. Quiere colocarlas en círculo. ¿De cuántas formas diferentes puede disponer las 7 canicas para que las dos rojas no estén una al lado de la otra?',
        opciones: ['2', '4', '6', '8', '10'],
        explica: 'En un círculo solo importa cuántas canicas blancas hay entre las dos rojas por el camino más corto: 0, 1, 2 o 3 (entre las dos rojas, por los dos lados, hay 5 blancas: 0+5, 1+4, 2+3). Si no pueden estar juntas, quedan dos posibilidades: 1 blanca por un lado y 4 por el otro, o 2 y 3.',
    },
    {
        n: 3, puntos: 3, pagina: 4, correcta: 'B',
        enunciado: 'Hay seis puntos, equidistantes entre sí, marcados en una recta numérica. El primer punto está en el número 3 y el sexto punto está en el número 7.\n\n¿Qué número está en el tercer punto?',
        figuras: [F('q3')],
        opciones: ['4,5', '4,6', '4,7', '4,8', '4,9'],
        explica: 'Del primer al sexto punto hay 5 saltos iguales que suman 7 − 3 = 4, así que cada salto mide 0,8. El tercer punto está a dos saltos del primero: 3 + 1,6 = 4,6.',
    },
    {
        n: 4, puntos: 3, pagina: 4, correcta: 'B',
        enunciado: 'Queremos escribir un número dentro de cada círculo de manera que se cumplan la suma de la primera columna y la resta de la segunda fila de la imagen, sin importar los resultados de las otras dos operaciones indicadas. ¿Cuál es el valor de la suma de los dos números que escribiremos en los círculos grises?',
        figuras: [F('q4')],
        opciones: ['6', '7', '8', '13', 'La suma de los números de los círculos grises puede tener distintas soluciones.'],
        explica: 'Llamamos g₁ y g₂ a los grises y b al blanco de abajo a la izquierda. Columna: g₁ + b = 13. Fila: b − g₂ = 6. Restando: g₁ + g₂ = 13 − 6 = 7, sea cual sea b.',
    },
    {
        n: 5, puntos: 3, pagina: 4, correcta: 'A',
        enunciado: 'El Sr. Pérez tiene dos cestas de manzanas. Cuando se sacan dos manzanas de la primera cesta, las dos cestas contienen el mismo número de manzanas. Por otro lado, cuando se añaden diez manzanas a la primera cesta, esta pasa a tener cinco veces más manzanas que la segunda cesta. ¿Cuántas manzanas hay en total en las dos cestas?',
        opciones: ['8', '10', '12', '15', '20'],
        explica: 'Si la segunda tiene s, la primera tiene s + 2. Al añadir 10: s + 12 = 5s, de donde s = 3. La primera tiene 5 y en total hay 8.',
    },
    {
        n: 6, puntos: 3, pagina: 4, correcta: 'A',
        enunciado: 'Un artista talló todas las esquinas de una piedra con forma de pirámide de base cuadrada. ¿Cuántas caras más tiene la nueva escultura mostrada en la imagen con respecto a la piedra original?',
        figuras: [F('q6')],
        opciones: ['5', '6', '7', '8', '9'],
        explica: 'Cada esquina tallada (vértice cortado) añade una cara nueva. Una pirámide de base cuadrada tiene 5 vértices (4 de la base y la cúspide), así que tiene 5 caras más.',
    },
    {
        n: 7, puntos: 3, pagina: 5, correcta: 'C',
        enunciado: 'En un rectángulo ABCD con lados AB = 9 cm y AD = 3 cm, ¿cuál deberá ser la distancia AE para que el rectángulo AEFD tenga un área igual al 20 % del área del rectángulo EBCF?',
        figuras: [F('q7')],
        opciones: ['0,6 cm', '0,9 cm', '1,5 cm', '1,8 cm', '2,7 cm'],
        explica: 'Los dos rectángulos tienen la misma altura, así que sus áreas son proporcionales a sus bases: AE = 0,2 · EB. Como AE + EB = 9, tenemos 0,2·EB + EB = 9 → EB = 7,5 y AE = 1,5 cm.',
    },
    {
        n: 8, puntos: 3, pagina: 5, correcta: 'B',
        enunciado: 'La construcción de la imagen está compuesta por baldosas hexagonales. Cada baldosa está formada por dos triángulos rojos, dos verdes y dos azules (como los de la figura), pegados entre sí de manera que se forma un disco negro en el centro. Cuando dos baldosas se tocan por uno de sus lados, los triángulos de esos lados tienen el mismo diseño. Cinco de las baldosas interiores se cayeron. ¿Cómo es la baldosa del centro?',
        figuras: [F('q8t1'), F('q8t2'), F('q8t3'), F('q8')],
        opciones: [{ img: F('q8A') }, { img: F('q8B') }, { img: F('q8C') }, { img: F('q8D') }, { img: F('q8E') }],
        explica: 'Reconstruye primero las baldosas caídas: cada una toca varias baldosas del borde, que fijan el diseño de esos lados, y cada baldosa tiene exactamente dos triángulos de cada color. Una vez colocadas, los seis lados del hueco central quedan determinados y solo encaja la baldosa B.',
    },
    {
        n: 9, puntos: 3, pagina: 6, correcta: 'D',
        enunciado: 'Tenemos un cuadrado dividido en 25 celdas. Cada celda contiene exactamente uno de los números 1, 2, 3, 4 o 5, dispuestos de manera que en cada fila, cada columna y ambas diagonales principales del cuadrado, cada uno de estos números aparezca exactamente una vez. ¿Qué número habrá en la celda sombreada?',
        figuras: [F('q9')],
        opciones: ['1', '3', '4', '5', 'Hay más de una solución.'],
        explica: 'Diagonal principal: ya tiene 1, 5, 2 y 3, así que la esquina superior izquierda es 4. Diagonal secundaria: tiene 2, 5 y 4; faltan 1 y 3, y como la 2.ª fila ya tiene un 1, ahí va el 3 (y abajo a la izquierda el 1). Siguiendo con filas y columnas se completa el cuadrado y en la celda sombreada queda un 5.',
    },
    {
        n: 10, puntos: 3, pagina: 6, correcta: 'D',
        enunciado: 'Las áreas de tres de las caras de un prisma rectangular son 6 m², 10 m² y 15 m². ¿Cuál será el volumen del paralelepípedo?',
        figuras: [F('q10')],
        opciones: ['10√10 m³', '15√10 m³', '25 m³', '30 m³', '45 m³'],
        explica: 'Si las aristas son a, b y c: ab = 6, bc = 10, ac = 15. Multiplicando, (abc)² = 900, así que V = abc = 30 m³ (aristas 2, 3 y 5 m).',
    },
    // ───────────── 4 puntos ─────────────
    {
        n: 11, puntos: 4, pagina: 6, correcta: 'C',
        enunciado: 'Cada una de las siguientes estructuras está iluminada desde arriba y desde la izquierda. La sombra de una de ellas aparece como se muestra en la figura. ¿A qué estructura pertenece esta sombra?',
        figuras: [F('q11')],
        opciones: [{ img: F('q11A') }, { img: F('q11B') }, { img: F('q11C') }, { img: F('q11D') }, 'Ninguna de las anteriores.'],
        explica: 'La sombra dibuja la silueta de las columnas de cubos vistas en la dirección de la luz: cada columna más alta proyecta un tramo más largo. El perfil escalonado de la sombra (una parte larga y dos entrantes) coincide con las alturas de la estructura C.',
    },
    {
        n: 12, puntos: 4, pagina: 7, correcta: 'A',
        enunciado: 'Ana tiene cuatro tarjetas rectangulares idénticas, cuya longitud es 3,5 veces mayor que su anchura (imagen 1). Superpone algunos pares de tarjetas como muestra la imagen 2, de modo que los bordes adyacentes a las esquinas superpuestas quedan perfectamente alineados.\n\n¿Cuántas veces es mayor el perímetro de la estructura nueva en comparación con el de una de las tarjetas? (Por perímetro de la estructura nos referimos a la longitud de las líneas rojas de la imagen 2).',
        figuras: [F('q12')],
        opciones: ['20/9', '2,5', '24/9', '3,5', '4'],
        explica: 'Con anchura a, una tarjeta mide a × 3,5a y su perímetro es 9a. El marco es un cuadrado de lado 3,5a con un hueco cuadrado de lado 3,5a − 2a = 1,5a. Líneas rojas: 4·3,5a + 4·1,5a = 20a. La razón es 20a / 9a = 20/9.',
    },
    {
        n: 13, puntos: 4, pagina: 7, correcta: 'D',
        enunciado: 'Se conocen algunos ángulos del cuadrilátero ABCD de la imagen. Si BC = AD, ¿cuál es la medida del ángulo ADC?',
        figuras: [F('q13')],
        opciones: ['30°', '50°', '55°', '65°', '70°'],
        explica: 'En el triángulo ABC: 180° − 75° − 30° = 75°, así que los ángulos en A y en B miden 75° y el triángulo es isósceles: AC = BC. Como BC = AD, también AC = AD, y el triángulo ACD es isósceles con ángulo de 50° en A: ADC = (180° − 50°) / 2 = 65°.',
    },
    {
        n: 14, puntos: 4, pagina: 7, correcta: 'A',
        enunciado: 'Daniel ideó un método de cifrado que utiliza números y formas, y escribió dos ecuaciones correctas utilizando este método. ¿Qué debería colocarse en lugar del signo de interrogación?',
        figuras: [F('q14')],
        opciones: [{ img: F('q14A') }, { img: F('q14B') }, { img: F('q14C') }, { img: F('q14D') }, { img: F('q14E') }],
        explica: 'Cada figura vale su número más su número de lados (el círculo, 0): triángulo 5 → 8, círculo 3 → 3, y 8 + 3 = 11 = cuadrado 7 (7 + 4). Entonces hexágono 6 → 12 menos triángulo 1 → 4 da 8, que es un hexágono con un 2 (2 + 6).',
    },
    {
        n: 15, puntos: 4, pagina: 8, correcta: 'C', interactivo: 'llaves',
        enunciado: 'Hay tres cerraduras cerradas, y cada una tiene una sola llave que la abre. Si las tres llaves se colocan al azar en las tres cerraduras, ¿qué situación es imposible en este caso?',
        opciones: ['Ninguna cerradura se abre.', 'Solo se abre una cerradura.', 'Solo se abren dos cerraduras.', 'Se abren las tres cerraduras.', 'No se puede determinar.'],
        explica: 'Si dos llaves están en su cerradura, la tercera llave solo puede ir en la cerradura que queda, que es la suya: también se abre. No pueden abrirse exactamente dos.',
    },
    {
        n: 16, puntos: 4, pagina: 8, correcta: 'C',
        enunciado: 'Utilizando los dígitos {0, 2, 3, 4, 5, 8}, ¿cuántos números de tres dígitos se pueden formar de manera que no se repita ningún dígito y el número sea realmente de tres dígitos (es decir, el dígito de las centenas no puede ser cero)?',
        opciones: ['120', '110', '100', '80', 'No es posible calcularlo.'],
        explica: 'Centenas: 5 opciones (todas menos el 0). Decenas: 5 (las que quedan, ya incluido el 0). Unidades: 4. Total 5 · 5 · 4 = 100.',
    },
    {
        n: 17, puntos: 4, pagina: 8, correcta: 'C',
        enunciado: '¿Cuántos números enteros positivos de dos dígitos hay tal que, si se elimina el dígito de las decenas, el número se convierte en una sexta parte del original?',
        opciones: ['2', '3', '4', '5', '6'],
        explica: 'Si el número es 10a + b, queremos 6b = 10a + b, es decir, b = 2a. Sirven 12, 24, 36 y 48: son 4.',
    },
    {
        n: 18, puntos: 4, pagina: 8, correcta: 'E',
        enunciado: 'Es posible doblar una hoja de papel con forma de triángulo rectángulo isósceles a lo largo de una línea recta para obtener diferentes formas poligonales externas. ¿Cuántos de los siguientes tipos de polígonos se pueden obtener: triángulo, cuadrilátero, pentágono, hexágono, heptágono?',
        opciones: ['1', '2', '3', '4', '5'],
        explica: 'Doblando por la altura sale un triángulo; doblando una esquina hacia dentro, un cuadrilátero. Si la solapa doblada sobresale del triángulo, su punta añade lados nuevos al contorno, y eligiendo bien la línea del doblez salen pentágono, hexágono y heptágono. Se pueden obtener los 5 (¡probadlo con papel!).',
    },
    {
        n: 19, puntos: 4, pagina: 8, correcta: 'A',
        enunciado: 'El número de dos dígitos AB (A no es 0) es tal que, cuando se invierte (BA), el número aumenta en 27 unidades. Para el mayor de los números de dos cifras que cumplen la condición anterior, ¿cuál es el valor de A + B?',
        opciones: ['15', '11', '9', '7', '4'],
        explica: 'BA − AB = 9(B − A) = 27, así que B = A + 3. El mayor es 69 (al invertirlo, 96). A + B = 15.',
    },
    {
        n: 20, puntos: 4, pagina: 9, correcta: 'D',
        enunciado: 'Pablo está mirando las valoraciones de un libro que quiere comprar, que muestra la imagen. Todos los porcentajes son exactos. ¿Cuál es el número mínimo de valoraciones que podría haber tenido este libro?',
        figuras: [F('q20')],
        opciones: ['250', '200', '125', '40', '20'],
        explica: 'El porcentaje más «fino» es 2,5 % = 1/40. Con 40 valoraciones: 22, 9, 5, 3, 0 y 1, todas enteras. Con menos no sale, porque 2,5 % de N debe ser un número entero.',
    },
    // ───────────── 5 puntos ─────────────
    {
        n: 21, puntos: 5, pagina: 9, correcta: 'B',
        enunciado: 'Se retiraron algunos bloques de un cubo formado por 125 bloques cúbicos idénticos, pero solo los suficientes para formar cuatro túneles idénticos que conectan cada par de paredes opuestas del cubo, tal y como se muestra en la figura. ¿Cuántos bloques se retiraron?',
        figuras: [F('q21')],
        opciones: ['36', '44', '48', '52', '60'],
        explica: 'En cada una de las 3 direcciones hay 4 túneles de 5 bloques: 3 · 4 · 5 = 60. Pero los 8 bloques donde se cruzan los túneles de las tres direcciones se han contado tres veces: sobran 2 · 8 = 16. Se retiraron 60 − 16 = 44.',
    },
    {
        n: 22, puntos: 5, pagina: 9, correcta: 'B',
        enunciado: 'Alicia está ordenando sus libros en las estanterías. Coloca la mitad de ellos en el estante inferior y luego coloca dos tercios de los libros restantes en el segundo estante. Por último, reparte los libros que quedan entre los otros dos estantes, de modo que el tercer estante tiene cuatro libros más que el estante superior, que tiene tres libros.\n\n¿Cuál es el número total de libros que hay en el estante inferior?',
        opciones: ['20', '30', '40', '50', '60'],
        explica: 'Arriba hay 3 y en el tercero 7: 10 libros, que son la sexta parte del total (la mitad de la mitad que no se puso en el inferior es 1/3 · 1/2 = 1/6). Total 60, y en el estante inferior la mitad: 30.',
    },
    {
        n: 23, puntos: 5, pagina: 10, correcta: 'C', interactivo: 'dado',
        enunciado: 'Se coloca un dado no trucado cuyas caras contienen las letras y números M, K, 2, 0, 2 y 6, tal y como se muestra en la figura. La cara opuesta a la M es el número 2, la cara opuesta a la K es el número 0 y la cara opuesta al número 6 es el otro número 2.\n\nSegún las indicaciones de las flechas en la cuadrícula, hace rodar el dado sobre un borde cada vez, pasando por los seis cuadrados secuencialmente.\n\n¿Qué letra o dígito queda hacia arriba al final?',
        figuras: [F('q23')],
        opciones: ['M', 'K', '2', '0', '6'],
        explica: 'Recorrido: hacia delante, derecha, derecha, hacia atrás e izquierda. Arriba van quedando: 0 → 2 → K → M → 2. Al final queda un 2 hacia arriba (el que estaba enfrente del 6).',
    },
    {
        n: 24, puntos: 5, pagina: 10, correcta: 'E',
        enunciado: 'El cuadro de la imagen cuyo título es «Cuadrado» se encuentra en el museo. Hay 12 cuadrados pequeños idénticos a lo largo de su borde. Cada uno de ellos contiene dos triángulos azules que comparten un vértice común. ¿Qué fracción del cuadro es azul?',
        figuras: [F('q24')],
        opciones: ['1/2', '2/3', '3/4', '3/8', '5/8'],
        explica: 'Con 12 cuadrados en el borde, el cuadro es una cuadrícula de 4 × 4 y el centro azul ocupa 2 × 2 = 4 cuadrados. En cada cuadrado del borde, los dos triángulos tienen como base dos lados opuestos y el vértice común dentro, así que suman la mitad del cuadrado: 12 · ½ = 6. Azul: (4 + 6) / 16 = 5/8.',
    },
    {
        n: 25, puntos: 5, pagina: 10, correcta: 'D',
        enunciado: 'Tres círculos, cada uno con un radio de 20 cm, tienen sus centros en P, Q y R. Los círculos están dispuestos de manera que AB = 5 cm, CD = 10 cm y EF = 12 cm. ¿Cuál es el perímetro del triángulo PQR?',
        figuras: [F('q25')],
        opciones: ['66 cm', '87 cm', '92 cm', '93 cm', '120 cm'],
        explica: 'Sobre cada lado, los dos radios de 20 cm se solapan en el tramo marcado: PQ = 40 − 12 = 28, PR = 40 − 5 = 35 y QR = 40 − 10 = 30. Perímetro: 93 cm.',
    },
    {
        n: 26, puntos: 5, pagina: 11, correcta: 'C',
        enunciado: 'Se construye un rectángulo dentro de un triángulo rectángulo, como se muestra en la figura. ¿Cuál es el área del rectángulo?',
        figuras: [F('q26')],
        opciones: ['9', '10', '12', '16', 'No es posible calcular la medida del área.'],
        explica: 'Los dos triangulitos (el de arriba, con cateto 4, y el de la derecha, con cateto 3) son semejantes. Si el rectángulo mide b × h: 4 / b = h / 3, así que b · h = 4 · 3 = 12.',
    },
    {
        n: 27, puntos: 5, pagina: 11, correcta: 'C',
        enunciado: 'Una escuela secundaria organizó un torneo amistoso de fútbol con un formato de liga simple. En los partidos con un ganador, el equipo ganador obtenía 3 puntos y el perdedor ningún punto. En caso de empate, cada equipo obtenía 1 punto. Al final del torneo, los organizadores observaron que el número de partidos con un ganador era 5 veces mayor que el número de partidos empatados, y que el total de puntos obtenidos por todos los equipos era 187. ¿Cuántos equipos participaron en el torneo?',
        opciones: ['10', '11', '12', '13', '14'],
        explica: 'Con e empates y 5e partidos con ganador: 3 · 5e + 2 · e = 17e = 187, así que e = 11 y hay 66 partidos. En una liga simple con n equipos se juegan n(n − 1)/2 partidos: n = 12.',
    },
    {
        n: 28, puntos: 5, pagina: 11, correcta: 'E', interactivo: 'pantalla',
        enunciado: 'El número 2026 aparece escrito en la pantalla del monitor. Cada minuto, el ordenador suma o resta al número la suma de sus dígitos. ¿Cuál de los siguientes números puede aparecer en la pantalla al cabo de un tiempo?',
        opciones: ['2026', '2022', '5037', '12345', '2223'],
        explica: 'Un número y la suma de sus cifras dan el mismo resto al dividir entre 9. Restando se obtiene un múltiplo de 9 (resto 0, y ya no sale de ahí); sumando, el resto se duplica: 1 → 2 → 4 → 8 → 7 → 5 → 1… Nunca aparece resto 3 ni 6, que es lo que dan 2022, 5037 y 12345. 2026 no puede volver: para tener resto 1 hay que haber sumado siempre, y el número habrá crecido. 2223 (múltiplo de 9) sí es posible.',
    },
    {
        n: 29, puntos: 5, pagina: 11, correcta: 'D',
        enunciado: 'Un octágono regular se divide en rectángulos, triángulos y un cuadrado central, tal y como se muestra en la imagen. La relación entre el área sombreada en azul y el área sombreada en rojo es:',
        figuras: [F('q29')],
        opciones: ['√2 : 1', '√3 : 1', '√3 : √2', '1 : 1', '2 : 1'],
        explica: 'Si el lado del octágono es l, el cuadrado azul tiene área l². Cada triángulo rojo es rectángulo isósceles con hipotenusa l: su área es l²/4. Los cuatro suman l². Relación 1 : 1.',
    },
    {
        n: 30, puntos: 5, pagina: 12, correcta: 'D', interactivo: 'corro',
        enunciado: 'Trece niños se sientan en círculo para jugar a un juego. La regla es la siguiente: empezando por un niño determinado, cuentan en el sentido de las agujas del reloj desde el 1. El niño que dice «13» abandona el círculo.\n\nA continuación, el siguiente niño continúa contando en el mismo sentido desde el 1, y el niño que dice «13» también abandona el círculo. Este proceso se repite hasta que solo queda un niño. Mateo es el número 1.\n\nPara asegurarse de que Mateo sea el último en quedarse, ¿a partir de qué niño debería sugerir que comience el juego?',
        figuras: [F('q30')],
        opciones: ['2', '5', '6', '7', '8'],
        explica: 'Se juega una vez empezando por el niño 1 y se ve quién queda: el niño 8, 7 puestos por delante del que empieza. El juego solo depende de las posiciones relativas, así que para que quede el 1 hay que empezar 7 puestos antes: por el niño 7 (7 + 7 = 14 → 1). ¡Comprobadlo en el simulador!',
    },
];

// ─────────── Todos los niveles (1.º ESO … 2.º Bachillerato) ───────────

export const CANGURO_4ESO = {
    id: '4eso', nivel: 'Nivel 4 · 4.º ESO', curso: '4.º ESO', numero: 4,
    pdf: CANGURO_INFO.pdf, preguntas: CANGURO_PREGUNTAS,
};

export const CANGURO_NIVELES = [CANGURO_1ESO, CANGURO_2ESO, CANGURO_3ESO, CANGURO_4ESO, CANGURO_1BACH, CANGURO_2BACH];
