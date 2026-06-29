import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';

const JuegoMemoria = ({ onBack }) => {
  // Estados del juego
  const [fase, setFase] = useState('menu'); // 'menu', 'leyendo', 'respondiendo', 'resultados'
  const [textoActual, setTextoActual] = useState(0);
  const [tiempoLectura, setTiempoLectura] = useState(120); // 2 minutos en segundos
  const [respuestas, setRespuestas] = useState({});
  const [puntuacion, setPuntuacion] = useState(0);
  const [tiempoTotal, setTiempoTotal] = useState(0);

  // Modal de envío
  const [mostrarModalEnvio, setMostrarModalEnvio] = useState(false);
  const [codigoProfe, setCodigoProfe] = useState('');
  const [nombreAlumno, setNombreAlumno] = useState('');
  const [cursoAlumno, setCursoAlumno] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [resultadoEnviado, setResultadoEnviado] = useState(false);

  // Temas y preguntas
  const temas = [
    {
      titulo: 'Matemáticas',
      emoji: '🔢',
      texto: 'Las matemáticas son el lenguaje del universo, llenas de misterios y cifras fascinantes. Uno de los números más famosos es Pi, cuya aproximación más conocida es 3,14159, aunque en 2021 un superordenador calculó 62,8 billones de sus decimales. Otro concepto asombroso es la secuencia de Fibonacci, descrita en el año 1202 por Leonardo de Pisa, donde cada número es la suma de los dos anteriores. Esta proporción se encuentra en la naturaleza, como en los girasoles, que suelen tener 34, 55 u 89 espirales. En geometría, el copo de nieve de Koch es un fractal descrito en 1904 que tiene un perímetro infinito pero un área finita. Además, el teorema de Pitágoras, formulado en el siglo VI a.C., sigue siendo la base de la trigonometría. Curiosamente, el sistema de numeración arábigo que usamos hoy fue inventado en la India alrededor del siglo V. El número cero, fundamental para el cálculo, fue utilizado por primera vez de forma documentada por la civilización maya en el año 36 a.C. Finalmente, el problema matemático más difícil resuelto recientemente fue el Último Teorema de Fermat, demostrado por Andrew Wiles en 1994 tras 358 años sin solución.',
      preguntas: [
        { pregunta: '¿Cuántos billones de decimales de Pi se calcularon en 2021?', respuestas: ['62,8 billones', '62.8 billones'] },
        { pregunta: '¿En qué año describió Leonardo de Pisa su famosa secuencia?', respuestas: ['1202'] },
        { pregunta: 'Menciona uno de los tres números de espirales comunes en los girasoles.', respuestas: ['34', '55', '89'] },
        { pregunta: '¿En qué año fue descrito el fractal del copo de nieve de Koch?', respuestas: ['1904'] },
        { pregunta: '¿Qué teorema geométrico fue formulado en el siglo VI a.C.?', respuestas: ['teorema de Pitágoras', 'teorema de pitagoras', 'Pitágoras', 'pitagoras'] },
        { pregunta: '¿Dónde se inventó realmente el sistema de numeración arábigo?', respuestas: ['India', 'india'] },
        { pregunta: '¿En qué siglo se inventó este sistema de numeración en la India?', respuestas: ['Siglo V', 'siglo V', 'V', 'v'] },
        { pregunta: '¿Qué civilización usó el número cero de forma documentada en el 36 a.C.?', respuestas: ['maya', 'civilización maya'] },
        { pregunta: '¿Quién demostró el Último Teorema de Fermat?', respuestas: ['Andrew Wiles', 'andrew wiles'] },
        { pregunta: '¿En qué año se resolvió el Último Teorema de Fermat?', respuestas: ['1994'] }
      ]
    },
    {
      titulo: 'Biología',
      emoji: '🧬',
      texto: 'La biología esconde datos verdaderamente sorprendentes sobre los seres vivos que habitan nuestro planeta. Por ejemplo, el pulpo tiene tres corazones: dos bombean sangre a las branquias y uno al resto del cuerpo. Además, su sangre es de color azul porque contiene hemocianina, una proteína rica en cobre. El animal más rápido del mundo no es el guepardo, sino el halcón peregrino, que puede alcanzar los 389 km/h en picado. En el mundo microscópico, los tardígrados, u osos de agua, son criaturas de medio milímetro capaces de sobrevivir en el vacío del espacio y soportar temperaturas desde -272 °C hasta 150 °C. Si hablamos de genética, el ADN humano comparte un 60% de similitud con el de un plátano y un 98,8% con el del chimpancé. El animal más grande que ha existido es la ballena azul, cuyo corazón pesa unos 180 kilos y late solo de 5 a 6 veces por minuto cuando se sumerge. Por otro lado, las medusas Turritopsis dohrnii son consideradas biológicamente inmortales. Finalmente, el cuerpo humano adulto está compuesto por aproximadamente 37 billones de células.',
      preguntas: [
        { pregunta: '¿Cuántos corazones tiene un pulpo?', respuestas: ['Tres', 'tres', '3'] },
        { pregunta: '¿Qué proteína rica en cobre hace que la sangre del pulpo sea azul?', respuestas: ['Hemocianina', 'hemocianina'] },
        { pregunta: '¿Qué velocidad en picado puede alcanzar el halcón peregrino?', respuestas: ['389 km/h', '389 km/h'] },
        { pregunta: '¿Cuál es el tamaño aproximado de un tardígrado?', respuestas: ['Medio milímetro', 'medio milimetro'] },
        { pregunta: '¿Cuál es la temperatura máxima que puede soportar un tardígrado?', respuestas: ['150 °C', '150 C', '150'] },
        { pregunta: '¿Qué porcentaje de ADN compartimos los humanos con un plátano?', respuestas: ['60%', '60'] },
        { pregunta: '¿Cuánto pesa aproximadamente el corazón de una ballena azul?', respuestas: ['180 kilos', '180'] },
        { pregunta: '¿Cuántas veces por minuto late el corazón de la ballena azul al sumergirse?', respuestas: ['De 5 a 6 veces', '5 a 6 veces', '5 a 6', 'de 5 a 6'] },
        { pregunta: '¿Qué medusa es considerada biológicamente inmortal?', respuestas: ['Turritopsis dohrnii', 'turritopsis dohrnii'] },
        { pregunta: '¿Cuántos billones de células componen el cuerpo humano adulto?', respuestas: ['37 billones', '37'] }
      ]
    },
    {
      titulo: 'Literatura',
      emoji: '📚',
      texto: 'La literatura universal está llena de curiosidades fascinantes y obras maestras que han marcado la historia. "Don Quijote de la Mancha", escrita por Miguel de Cervantes, se publicó en dos partes, la primera en 1605 y la segunda en 1615, y es considerado el libro de ficción más vendido de la historia con más de 500 millones de copias. El libro impreso más antiguo que se conserva es "El Sutra del Diamante", un texto budista impreso en China en el año 868 d.C. La novela más larga jamás escrita es "En busca del tiempo perdido" de Marcel Proust, que cuenta con más de 1,2 millones de palabras. Curiosamente, la escritora Agatha Christie, famosa por sus novelas de misterio, desapareció durante 11 días en 1926, un enigma que nunca se resolvió del todo. En Hispanoamérica, Gabriel García Márquez publicó "Cien años de soledad" en 1967, obra en la que la aldea de Macondo sufre una lluvia de flores amarillas. Por otro lado, Mary Shelley escribió "Frankenstein" con tan solo 18 años durante un lúgubre verano de 1816. Finalmente, J.K. Rowling escribió el primer libro de Harry Potter en cafeterías de Edimburgo en 1995.',
      preguntas: [
        { pregunta: '¿En qué año se publicó la primera parte de "Don Quijote de la Mancha"?', respuestas: ['1605'] },
        { pregunta: '¿Cuántas copias ha vendido aproximadamente el Quijote en su historia?', respuestas: ['Más de 500 millones', 'mas de 500 millones', '500 millones'] },
        { pregunta: '¿Cómo se llama el libro impreso más antiguo que se conserva?', respuestas: ['El Sutra del Diamante', 'el sutra del diamante', 'Sutra del Diamante'] },
        { pregunta: '¿En qué año se imprimió "El Sutra del Diamante"?', respuestas: ['868 d.C.', '868', '868 dc'] },
        { pregunta: '¿Quién escribió la novela más larga de la historia?', respuestas: ['Marcel Proust', 'marcel proust'] },
        { pregunta: '¿Cuántos días estuvo desaparecida Agatha Christie en el año 1926?', respuestas: ['11 días', '11'] },
        { pregunta: '¿En qué año publicó Gabriel García Márquez "Cien años de soledad"?', respuestas: ['1967'] },
        { pregunta: '¿De qué color eran las flores que llovieron sobre la aldea de Macondo?', respuestas: ['Amarillas', 'amarillas'] },
        { pregunta: '¿A qué edad escribió Mary Shelley la novela "Frankenstein"?', respuestas: ['18 años', '18'] },
        { pregunta: '¿En qué ciudad escribía J.K. Rowling el primer libro de Harry Potter?', respuestas: ['Edimburgo', 'edimburgo'] }
      ]
    },
    {
      titulo: 'Astronomía',
      emoji: '🪐',
      texto: 'El universo es inmenso y la astronomía nos revela constantemente datos asombrosos sobre su funcionamiento. Nuestro sistema solar tiene un planeta gigante, Júpiter, que posee 95 lunas confirmadas, siendo Ganimedes la más grande, incluso mayor que el planeta Mercurio. La luz viaja a una velocidad increíble de 299.792 kilómetros por segundo, lo que significa que la luz del Sol tarda exactamente 8 minutos y 20 segundos en llegar a la Tierra. En Marte se encuentra el Monte Olimpo, el volcán más grande del sistema solar, con una altura de 21 kilómetros, casi tres veces la del Monte Everest. Nuestra galaxia, la Vía Láctea, tiene un diámetro estimado de 100.000 años luz y se dirige hacia una colisión inevitable con la galaxia de Andrómeda, que ocurrirá dentro de 4.500 millones de años. Las estrellas de neutrones son tan densas que una sola cucharadita de su materia pesaría unos 6.000 millones de toneladas en la Tierra. Por último, en 2006, la Unión Astronómica Internacional reclasificó a Plutón como un "planeta enano", dejando solo ocho planetas principales.',
      preguntas: [
        { pregunta: '¿Cuántas lunas confirmadas posee el planeta Júpiter?', respuestas: ['95'] },
        { pregunta: '¿Cómo se llama la luna de Júpiter que es más grande que Mercurio?', respuestas: ['Ganimedes', 'ganimedes'] },
        { pregunta: '¿A cuántos kilómetros por segundo viaja la luz?', respuestas: ['299.792', '299792'] },
        { pregunta: '¿Cuánto tiempo exacto tarda la luz del Sol en llegar a la Tierra?', respuestas: ['8 minutos y 20 segundos', '8 minutos y 20 seg'] },
        { pregunta: '¿Qué altura tiene el volcán Monte Olimpo en Marte?', respuestas: ['21 kilómetros', '21 km', '21'] },
        { pregunta: '¿Cuál es el diámetro estimado de la Vía Láctea en años luz?', respuestas: ['100.000', '100000'] },
        { pregunta: '¿Con qué galaxia chocará la Vía Láctea en el futuro?', respuestas: ['Andrómeda', 'andromeda'] },
        { pregunta: '¿En cuántos millones de años ocurrirá esta colisión galáctica?', respuestas: ['4.500', '4500'] },
        { pregunta: '¿Cuántas toneladas pesaría una cucharadita de materia de una estrella de neutrones?', respuestas: ['6.000 millones', '6000 millones'] },
        { pregunta: '¿En qué año fue Plutón reclasificado como un planeta enano?', respuestas: ['2006'] }
      ]
    },
    {
      titulo: 'Vida Extraterrestre',
      emoji: '👽',
      texto: 'La búsqueda de vida extraterrestre es uno de los mayores anhelos científicos de la humanidad. En 1961, el astrónomo Frank Drake formuló la Ecuación de Drake, que estima que podría haber hasta 10.000 civilizaciones comunicativas solo en nuestra galaxia. El 15 de agosto de 1977, el radiotelescopio Big Ear en Ohio captó una misteriosa señal de radio de 72 segundos de duración proveniente de la constelación de Sagitario; el astrónomo Jerry Ehman anotó "¡Wow!" en el papel, dando nombre al evento. Hasta la fecha, se han descubierto más de 5.500 exoplanetas, pero uno de los más prometedores es Kepler-186f, descubierto en 2014, el primer planeta del tamaño de la Tierra en una zona habitable. Los científicos también buscan señales de vida microbiana en Encélado, una luna de Saturno que expulsa géiseres de vapor de agua y compuestos orgánicos al espacio. Además, en 1974, enviamos el Mensaje de Arecibo, un código binario de 1.679 bits dirigido al cúmulo estelar M13, que tardará 25.000 años en llegar a su remoto destino.',
      preguntas: [
        { pregunta: '¿En qué año formuló Frank Drake su famosa ecuación astronómica?', respuestas: ['1961'] },
        { pregunta: '¿Cuántas civilizaciones comunicativas estimó Drake en nuestra galaxia?', respuestas: ['10.000', '10000'] },
        { pregunta: '¿Qué día y mes exactos se captó la famosa señal "¡Wow!" en 1977?', respuestas: ['15 de agosto', '15 agosto'] },
        { pregunta: '¿De qué constelación provenía esta misteriosa señal de radio?', respuestas: ['Sagitario', 'sagitario'] },
        { pregunta: '¿Cuántos segundos duró la señal de radio "¡Wow!"?', respuestas: ['72 segundos', '72'] },
        { pregunta: '¿Cuántos exoplanetas se han descubierto aproximadamente hasta la fecha?', respuestas: ['Más de 5.500', 'mas de 5500', '5500'] },
        { pregunta: '¿En qué año fue descubierto el prometedor exoplaneta Kepler-186f?', respuestas: ['2014'] },
        { pregunta: '¿Qué luna de Saturno expulsa géiseres de agua y compuestos orgánicos?', respuestas: ['Encélado', 'enceladus'] },
        { pregunta: '¿De cuántos bits estaba compuesto el código binario del Mensaje de Arecibo?', respuestas: ['1.679', '1679'] },
        { pregunta: '¿A qué cúmulo estelar estaba dirigido el Mensaje de Arecibo de 1974?', respuestas: ['M13', 'm13'] }
      ]
    },
    {
      titulo: 'Historia de España',
      emoji: '🇪🇸',
      texto: 'La historia de España está repleta de episodios determinantes para el mundo. El año 1492 fue crucial: los Reyes Católicos conquistaron Granada el 2 de enero, poniendo fin a la Reconquista; Cristóbal Colón llegó a América el 12 de octubre a bordo de la Santa María junto a la Pinta y la Niña; y Antonio de Nebrija publicó la primera Gramática Castellana. Durante el Imperio Romano, la península ibérica se denominaba Hispania, y dio a Roma tres emperadores nacidos en su territorio: Trajano, Adriano y Teodosio. En el siglo XVI, bajo el reinado de Felipe II, el imperio español se convirtió en el primero "donde nunca se ponía el sol", abarcando territorios inmensos. Más tarde, el 19 de marzo de 1812, se promulgó en Cádiz la primera Constitución española, conocida popularmente como "La Pepa" por coincidir con el día de San José. La Guerra Civil Española, un conflicto devastador, comenzó el 18 de julio de 1936 y terminó el 1 de abril de 1939. Finalmente, el 6 de diciembre de 1978 se aprobó la actual Constitución.',
      preguntas: [
        { pregunta: '¿Qué día y mes se conquistó la ciudad de Granada en 1492?', respuestas: ['2 de enero', '2 enero'] },
        { pregunta: '¿Qué erudito publicó la primera Gramática Castellana en 1492?', respuestas: ['Antonio de Nebrija', 'antonio de nebrija'] },
        { pregunta: 'Nombra a uno de los tres emperadores romanos nacidos en Hispania.', respuestas: ['Trajano', 'Adriano', 'Teodosio', 'trajano', 'adriano', 'teodosio'] },
        { pregunta: '¿Bajo el reinado de qué monarca español "nunca se ponía el sol"?', respuestas: ['Felipe II', 'felipe II'] },
        { pregunta: '¿En qué fecha exacta (día, mes y año) se promulgó la Constitución de Cádiz?', respuestas: ['19 de marzo de 1812', '19 de marzo 1812'] },
        { pregunta: '¿Con qué nombre popular fue bautizada la Constitución de 1812?', respuestas: ['La Pepa', 'la pepa'] },
        { pregunta: '¿En qué fecha exacta (día, mes y año) comenzó la Guerra Civil Española?', respuestas: ['18 de julio de 1936', '18 de julio 1936'] },
        { pregunta: '¿Qué día y mes terminó la Guerra Civil Española en 1939?', respuestas: ['1 de abril', '1 abril'] },
        { pregunta: '¿Qué nombre recibía la península ibérica durante el Imperio Romano?', respuestas: ['Hispania', 'hispania'] },
        { pregunta: '¿Qué día y mes de 1978 se aprobó la actual Constitución española?', respuestas: ['6 de diciembre', '6 diciembre'] }
      ]
    },
    {
      titulo: 'La Tierra',
      emoji: '🌍',
      texto: 'Nuestro planeta Tierra, una esfera de roca azul y verde, guarda secretos asombrosos en sus capas y ecosistemas. El núcleo interno de la Tierra es una bola sólida de hierro y níquel que alcanza una temperatura abrasadora de 6.000 °C, tan caliente como la superficie del Sol. En contraste, el lugar más frío jamás registrado es la base rusa Vostok en la Antártida, donde el termómetro marcó -89,2 °C en el año 1983. Si miramos hacia los océanos, que cubren el 71% de la superficie del planeta, el punto más profundo es la Fosa de las Marianas, que desciende hasta los 10.984 metros bajo el nivel del mar en el abismo de Challenger. La atmósfera terrestre es fundamental para la vida y no está compuesta principalmente de oxígeno; contiene un 78% de nitrógeno, un 21% de oxígeno y un 1% de otros gases. Además, la Tierra no es una esfera perfecta, sino un esferoide oblato, ensanchado en el ecuador. El bosque lluvioso del Amazonas produce el 20% del oxígeno del mundo y alberga a unos 390.000 millones de árboles.',
      preguntas: [
        { pregunta: '¿Qué temperatura en grados Celsius alcanza el núcleo interno de la Tierra?', respuestas: ['6.000 °C', '6000 C', '6000'] },
        { pregunta: '¿De qué dos metales está compuesto principalmente el núcleo terrestre?', respuestas: ['Hierro y níquel', 'hierro y niquel'] },
        { pregunta: '¿Dónde se registró la temperatura más fría de la historia del planeta (-89,2 °C)?', respuestas: ['Base Vostok en la Antártida', 'base vostok en la antartida'] },
        { pregunta: '¿En qué año se registró esa temperatura récord de frío extremo?', respuestas: ['1983'] },
        { pregunta: '¿Qué porcentaje de la superficie de la Tierra está cubierto por los océanos?', respuestas: ['71%', '71'] },
        { pregunta: '¿Cuál es la profundidad máxima en metros de la Fosa de las Marianas?', respuestas: ['10.984 metros', '10984 metros', '10984'] },
        { pregunta: '¿Qué porcentaje de nitrógeno compone nuestra atmósfera terrestre?', respuestas: ['78%', '78'] },
        { pregunta: '¿Qué porcentaje exacto de oxígeno contiene la atmósfera?', respuestas: ['21%', '21'] },
        { pregunta: '¿Qué término geométrico describe la forma real de la Tierra ensanchada en el ecuador?', respuestas: ['Esferoide oblato', 'esferoide oblato'] },
        { pregunta: '¿Cuántos miles de millones de árboles alberga aproximadamente la selva del Amazonas?', respuestas: ['390.000 millones', '390000 millones'] }
      ]
    },
    {
      titulo: 'Moda',
      emoji: '👗',
      texto: 'La moda es un reflejo de la cultura y la historia, y a menudo surge de necesidades prácticas o eventos curiosos. Los zapatos de tacón, por ejemplo, no fueron creados para las mujeres, sino en el siglo X para la caballería persa, ya que les ayudaban a fijar los pies en los estribos al disparar flechas. El moderno bikini fue inventado por el ingeniero francés Louis Réard en 1946; lo nombró así por el atolón de Bikini, donde se realizaban pruebas nucleares, esperando que su diseño fuera igual de "explosivo". Por su parte, los icónicos pantalones vaqueros nacieron en 1873 cuando Levi Strauss y Jacob Davis patentaron unos pantalones de lona resistente con remaches de cobre, diseñados especialmente para los mineros. El color negro como símbolo de luto se popularizó enormemente luego de que la reina Victoria vistiera de negro durante 40 años tras la muerte del príncipe Alberto en 1861. Además, los botones de las camisas de hombre se cosen a la derecha y los de mujer a la izquierda, porque en el pasado las sirvientas abotonaban la ropa de las mujeres adineradas.',
      preguntas: [
        { pregunta: '¿En qué siglo y para quiénes se crearon originalmente los zapatos de tacón?', respuestas: ['Siglo X, para la caballería persa', 'siglo X para la caballeria persa'] },
        { pregunta: '¿Qué profesión tenía el inventor del bikini moderno, Louis Réard?', respuestas: ['Ingeniero', 'ingeniero'] },
        { pregunta: '¿En qué año fue inventado el traje de baño bikini?', respuestas: ['1946'] },
        { pregunta: '¿De qué atolón de pruebas nucleares tomó su nombre esta prenda?', respuestas: ['Atolón de Bikini', 'atolon de bikini'] },
        { pregunta: '¿En qué año patentaron Levi Strauss y Jacob Davis los pantalones vaqueros?', respuestas: ['1873'] },
        { pregunta: '¿De qué material metálico eran los remaches utilizados en los primeros vaqueros?', respuestas: ['Cobre', 'cobre'] },
        { pregunta: '¿Para qué grupo de trabajadores se diseñaron originalmente los vaqueros?', respuestas: ['Mineros', 'mineros'] },
        { pregunta: '¿Cuántos años seguidos vistió de luto la reina Victoria de Inglaterra?', respuestas: ['40 años', '40'] },
        { pregunta: '¿En qué año murió el príncipe Alberto, esposo de la reina Victoria?', respuestas: ['1861'] },
        { pregunta: '¿En qué lado llevan cosidos los botones las camisas de mujer?', respuestas: ['A la izquierda', 'a la izquierda', 'izquierda'] }
      ]
    },
    {
      titulo: 'Internet',
      emoji: '🌐',
      texto: 'Internet ha transformado la sociedad moderna a una velocidad sin precedentes. Sus orígenes se remontan a 1969 con ARPANET, una red estadounidense que envió el primer mensaje, la palabra "LO", el 29 de octubre de ese año (intentaban escribir "LOGIN" pero colapsó). La primera página web del mundo fue creada por el científico británico Tim Berners-Lee en el CERN de Suiza, y se publicó el 6 de agosto de 1991. Sorprendentemente, el término "Wi-Fi" no significa "Wireless Fidelity" ni tiene ningún significado técnico; fue creado por una agencia de marketing en 1999 porque rimaba con "Hi-Fi". El primer vídeo subido a YouTube se titula "Me at the zoo", dura 19 segundos y fue publicado el 23 de abril de 2005 por Jawed Karim. Hoy en día, se envían alrededor de 330.000 millones de correos electrónicos al día en todo el mundo. Además, el emoji más utilizado históricamente en internet es la cara que llora de risa, introducido en el año 2010. Por último, el buscador Google procesa más de 99.000 búsquedas cada segundo.',
      preguntas: [
        { pregunta: '¿En qué año se creó la red antecesora de internet, ARPANET?', respuestas: ['1969'] },
        { pregunta: '¿Qué palabra exacta logró enviarse en el primer mensaje de ARPANET?', respuestas: ['LO', 'lo'] },
        { pregunta: '¿En qué institución europea se creó la primera página web de la historia?', respuestas: ['CERN', 'cern'] },
        { pregunta: '¿En qué fecha (día, mes y año) se publicó la primera página web?', respuestas: ['6 de agosto de 1991', '6 de agosto 1991'] },
        { pregunta: '¿Qué significa realmente el término tecnológico "Wi-Fi"?', respuestas: ['No tiene ningún significado', 'no tiene', 'para nada', 'nada'] },
        { pregunta: '¿En qué año creó una agencia de marketing el término "Wi-Fi"?', respuestas: ['1999'] },
        { pregunta: '¿Cómo se titula en inglés el primer vídeo subido a la plataforma YouTube?', respuestas: ['Me at the zoo', 'me at the zoo'] },
        { pregunta: '¿Cuántos segundos de duración tiene este primer vídeo de YouTube?', respuestas: ['19 segundos', '19'] },
        { pregunta: '¿Cuántos miles de millones de correos electrónicos se envían al día en el mundo?', respuestas: ['330.000 millones', '330000 millones'] },
        { pregunta: '¿En qué año se introdujo oficialmente el emoji de la cara que llora de risa?', respuestas: ['2010'] }
      ]
    },
    {
      titulo: 'Música',
      emoji: '🎵',
      texto: 'La música acompaña al ser humano desde sus orígenes. La composición musical escrita más antigua que se conoce es el Himno de Ugarit o Himno a Nikkal, descubierto en unas tablillas de arcilla en Siria y datado hace unos 3.400 años. En la música clásica, Ludwig van Beethoven compuso su monumental Novena Sinfonía en el año 1824 estando completamente sordo. Los instrumentos de cuerda más codiciados del mundo son los violines Stradivarius, construidos en los siglos XVII y XVIII; hoy en día solo sobreviven unos 650 instrumentos elaborados por Antonio Stradivari. Si hablamos de música moderna, el álbum más vendido de todos los tiempos es "Thriller" de Michael Jackson, lanzado en 1982, que ha acumulado más de 70 millones de copias en todo el mundo. La banda británica The Beatles tiene el récord de más éxitos número uno en la lista Hot 100 de Billboard, con un total de 20 canciones. Curiosamente, la canción "Happy Birthday to You" estuvo bajo estrictos derechos de autor hasta el año 2015, cuando pasó al dominio público.',
      preguntas: [
        { pregunta: '¿Cómo se llama la composición musical escrita más antigua conocida?', respuestas: ['Himno de Ugarit', 'himno de ugarit', 'Himno a Nikkal', 'himno a nikkal'] },
        { pregunta: '¿De qué material eran las tablillas donde se descubrió esta antigua melodía?', respuestas: ['Arcilla', 'arcilla'] },
        { pregunta: '¿Hace cuántos años está datada aproximadamente esta composición en Siria?', respuestas: ['3.400 años', '3400 años', '3400'] },
        { pregunta: '¿En qué año compuso Beethoven su famosa Novena Sinfonía?', respuestas: ['1824'] },
        { pregunta: '¿Cuántos instrumentos construidos por Antonio Stradivari sobreviven aproximadamente?', respuestas: ['650'] },
        { pregunta: '¿Cuál es el título del álbum más vendido de todos los tiempos?', respuestas: ['Thriller', 'thriller'] },
        { pregunta: '¿En qué año se lanzó el álbum de Michael Jackson mencionado anteriormente?', respuestas: ['1982'] },
        { pregunta: '¿Cuántas copias millonarias ha vendido este famoso álbum en todo el mundo?', respuestas: ['Más de 70 millones', 'mas de 70 millones', '70 millones'] },
        { pregunta: '¿Cuántos éxitos número uno logró The Beatles en la lista Hot 100 de Billboard?', respuestas: ['20'] },
        { pregunta: '¿En qué año pasó a ser de dominio público la canción "Happy Birthday to You"?', respuestas: ['2015'] }
      ]
    }
  ];

  // Normalizador de texto para comparación
  const normalizarRespuesta = (texto) => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Verificar respuesta
  const verificarRespuesta = (respuestaUsuario, respuestasCorrectas) => {
    const normalizada = normalizarRespuesta(respuestaUsuario);
    const respuestasNormalizadas = respuestasCorrectas.map(normalizarRespuesta);
    
    if (respuestasNormalizadas.includes(normalizada)) {
      return 10; // Respuesta correcta
    } else if (normalizada.length > 0 && respuestasNormalizadas.some(r => r.includes(normalizada) || normalizada.includes(r))) {
      return 5; // Respuesta parcial
    }
    return 0; // Incorrecta
  };

  // Temporizador
  useEffect(() => {
    if (fase === 'leyendo') {
      const timer = setInterval(() => {
        setTiempoLectura(prev => {
          if (prev <= 1) {
            setFase('respondiendo');
            setRespuestas({});
            return 120;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [fase]);

  // Temporizador de tiempo total
  useEffect(() => {
    if (fase === 'leyendo' || fase === 'respondiendo') {
      const timer = setInterval(() => setTiempoTotal(prev => prev + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [fase]);

  const iniciarJuego = () => {
    setTextoActual(Math.floor(Math.random() * temas.length));
    setFase('leyendo');
    setTiempoLectura(120);
    setRespuestas({});
    setPuntuacion(0);
    setTiempoTotal(0);
    setResultadoEnviado(false);
    setMostrarModalEnvio(false);
  };

  const enviarRespuestas = () => {
    let puntos = 0;
    const tema = temas[textoActual];
    
    tema.preguntas.forEach((p, idx) => {
      const respuesta = (respuestas[idx] || '').trim();
      puntos += verificarRespuesta(respuesta, p.respuestas);
    });
    
    setPuntuacion(puntos);
    setFase('resultados');
  };

  const abrirModalEnvio = () => {
    setMostrarModalEnvio(true);
    setErrorEnvio('');
  };

  const cerrarModalEnvio = () => {
    setMostrarModalEnvio(false);
    setErrorEnvio('');
  };

  const enviarResultado = async () => {
    const code = codigoProfe.trim().toUpperCase();
    if (!nombreAlumno.trim()) { setErrorEnvio('Escribe tu nombre.'); return; }
    if (!code) { setErrorEnvio('Escribe el código del profesor.'); return; }
    setEnviando(true);
    setErrorEnvio('');

    try {
      const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
      if (!codigoDoc.exists()) {
        setErrorEnvio('Código no encontrado.');
        setEnviando(false);
        return;
      }

      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'MEMORIA',
        modalidad: 'Individual',
        fecha: new Date(),
        recursoId: null,
        recursoTitulo: `Memoria - ${temas[textoActual].titulo}`,
        hoja: temas[textoActual].titulo,
        codigoProfesor: code,
        jugadores: [{
          nombre: nombreAlumno.trim(),
          curso: cursoAlumno.trim(),
          aciertos: puntuacion,
          fallos: 100 - puntuacion,
          tiempo: tiempoTotal,
          hoja: temas[textoActual].titulo
        }],
      });

      guardarRegistroLocal('MEMORIA', {
        titulo: `Memoria - ${temas[textoActual].titulo}`, aciertos: puntuacion, intentos: 100, porcentaje: puntuacion,
        nombre: nombreAlumno.trim(), curso: cursoAlumno.trim(), via: 'profesor',
      });
      setResultadoEnviado(true);
      setMostrarModalEnvio(false);
    } catch (e) {
      setErrorEnvio('Error: ' + e.message);
    }
    setEnviando(false);
  };

  // Estilos comunes
  const containerStyle = {
    background: 'linear-gradient(135deg, #9b59b6 0%, #e74c3c 100%)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    color: '#fff'
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '30px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    maxWidth: '900px',
    width: '100%',
    textAlign: 'center'
  };

  const buttonStyle = {
    background: 'linear-gradient(45deg, #3498db, #2980b9)',
    border: 'none',
    borderRadius: '25px',
    padding: '15px 30px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    transition: 'transform 0.3s',
    margin: '10px'
  };

  const backButtonStyle = {
    position: 'absolute',
    top: '20px',
    left: '20px',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    fontSize: '20px',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    transition: 'transform 0.3s'
  };

  const counterStyle = {
    fontSize: '18px',
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '8px 16px',
    borderRadius: '15px',
    margin: '5px',
    display: 'inline-block'
  };

  // Menu
  if (fase === 'menu') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button style={backButtonStyle} onClick={onBack}>←</button>
          <h1 style={{ fontSize: '48px', marginBottom: '30px' }}>🧠 Juego de Memoria</h1>
          <p style={{ fontSize: '18px', marginBottom: '20px', opacity: 0.9 }}>Lee atentamente durante 2 minutos, luego responde las preguntas.</p>
          <button style={buttonStyle} onClick={iniciarJuego}>Comenzar Juego</button>
        </div>
      </div>
    );
  }

  // Fase de lectura
  if (fase === 'leyendo') {
    const tema = temas[textoActual];
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button style={backButtonStyle} onClick={onBack}>←</button>
          <h2 style={{ fontSize: '36px', marginBottom: '10px' }}>{tema.emoji} {tema.titulo}</h2>
          <div style={{ ...counterStyle, fontSize: '24px', marginBottom: '20px', background: 'rgba(255, 100, 100, 0.4)' }}>
            ⏱️ {tiempoLectura}s
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '15px', textAlign: 'left', fontSize: '16px', lineHeight: '1.6', maxHeight: '500px', overflowY: 'auto', marginTop: '20px' }}>
            {tema.texto}
          </div>
        </div>
      </div>
    );
  }

  // Fase de respuestas
  if (fase === 'respondiendo') {
    const tema = temas[textoActual];
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button style={backButtonStyle} onClick={onBack}>←</button>
          <h2 style={{ fontSize: '32px', marginBottom: '20px' }}>{tema.emoji} Preguntas sobre {tema.titulo}</h2>
          <div style={{ textAlign: 'left', maxHeight: '600px', overflowY: 'auto' }}>
            {tema.preguntas.map((p, idx) => (
              <div key={idx} style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '10px' }}>
                <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
                  {idx + 1}. {p.pregunta}
                </p>
                <input
                  type="text"
                  placeholder="Tu respuesta..."
                  value={respuestas[idx] || ''}
                  onChange={(e) => setRespuestas({ ...respuestas, [idx]: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
            ))}
          </div>
          <button style={{ ...buttonStyle, marginTop: '20px', background: 'linear-gradient(45deg, #2ecc71, #27ae60)' }} onClick={enviarRespuestas}>Enviar Respuestas</button>
        </div>
      </div>
    );
  }

  // Fase de resultados
  if (fase === 'resultados') {
    const tema = temas[textoActual];
    const porcentaje = Math.round((puntuacion / 100) * 100);
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <button style={backButtonStyle} onClick={onBack}>←</button>
          <h2 style={{ fontSize: '36px', marginBottom: '20px' }}>¡Juego Terminado!</h2>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <div style={counterStyle}>Tema: {tema.titulo}</div>
            <div style={counterStyle}>Puntuación: {puntuacion}/100</div>
            <div style={counterStyle}>Porcentaje: {porcentaje}%</div>
            <div style={counterStyle}>Tiempo: {tiempoTotal}s</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
            <p style={{ fontSize: '18px' }}>Puntos obtenidos: <strong>{puntuacion}</strong> de 100</p>
            <p style={{ fontSize: '14px', opacity: 0.8 }}>Cada respuesta correcta: 10pts | Respuesta parcial: 5pts</p>
          </div>
          {resultadoEnviado ? (
            <div style={{ background: 'rgba(100,200,100,0.3)', padding: '15px', borderRadius: '15px', color: '#87ff87', fontWeight: 'bold', marginBottom: '20px' }}>
              ✅ Resultado enviado al profesor.
            </div>
          ) : (
            <button style={{ ...buttonStyle, background: 'linear-gradient(45deg, #f39c12, #e67e22)' }} onClick={abrirModalEnvio}>📤 Enviar al profesor</button>
          )}
          <button style={{ ...buttonStyle, background: 'linear-gradient(45deg, #3498db, #2980b9)' }} onClick={() => setFase('menu')}>Jugar de Nuevo</button>
        </div>
        {mostrarModalEnvio && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 420, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                <button onClick={cerrarModalEnvio} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['nombre', 'Nombre y apellido', nombreAlumno, setNombreAlumno, 'Tu nombre completo'],
                  ['curso', 'Curso', cursoAlumno, setCursoAlumno, 'Ej: 3º ESO A'],
                  ['codigo', 'Código del profesor', codigoProfe, setCodigoProfe, 'Ej: PROF01']
                ].map(([key, label, val, setter, ph]) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key === 'codigo' ? 10 : undefined}
                      style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: key === 'codigo' ? 2 : 0, fontWeight: key === 'codigo' ? 700 : 400 }} />
                  </div>
                ))}
                {errorEnvio && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {errorEnvio}</div>}
                <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                  <button onClick={cerrarModalEnvio} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
                  <button onClick={enviarResultado} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {enviando ? 'Enviando…' : '📤 Enviar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default JuegoMemoria;
