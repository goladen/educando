// src/personajesHistoricos.js
// Base de datos de personajes históricos para el juego "¿Quién es quién? histórico".
//
// El jugador ve caras/pistas y va descartando (categoría, sexo, continente, época,
// campo, datos curiosos) hasta dar con el personaje.
//
// Estructura de cada personaje:
//   id          — identificador único (kebab/slug)
//   nombre      — nombre mostrado
//   categoria   — 'mandatario' | 'artista' | 'cientifico'
//   campo       — subcategoría/oficio (Pintor, Física, Emperador, …) — pista fina
//   sexo        — 'H' | 'M'
//   pais        — nacionalidad principal (nombre actual entre paréntesis si el país histórico difiere)
//   continente  — 'Europa' | 'América' | 'Asia' | 'África' | 'Oceanía'
//   nac, fall   — año de nacimiento y muerte (negativo = a.C.; fall null = desconocido/vivo)
//   epoca       — etiqueta de época para las pistas
//   datos       — array de datos curiosos (frases cortas, para dar pistas)
//   wiki        — título del artículo en Wikipedia (para obtener la foto en tiempo real)
//
// La FOTO no se guarda como URL fija (los nombres de fichero de Commons son frágiles):
// usa `fotoDeWiki(p.wiki)` para obtener la miniatura, con reserva a un avatar de iniciales.

export const CONTINENTES_PH = ['Europa', 'América', 'Asia', 'África', 'Oceanía'];
export const EPOCAS_PH = ['Antigüedad', 'Edad Media', 'Siglo XV', 'Siglo XVI', 'Siglo XVII', 'Siglo XVIII', 'Siglo XIX', 'Siglo XX'];
export const CATEGORIAS_PH = [
    { id: 'mandatario', label: 'Mandatarios y líderes', emoji: '👑' },
    { id: 'artista', label: 'Artistas', emoji: '🎨' },
    { id: 'cientifico', label: 'Científicos', emoji: '🔬' },
];

/* ============================ MANDATARIOS Y LÍDERES (30) ============================ */
const MANDATARIOS = [
    { id: 'napoleon', nombre: 'Napoleón Bonaparte', categoria: 'mandatario', campo: 'Emperador', sexo: 'H', pais: 'Francia', continente: 'Europa', nac: 1769, fall: 1821, epoca: 'Siglo XIX',
      datos: ['Se coronó emperador de Francia en 1804.', 'Fue derrotado en la batalla de Waterloo.', 'Murió desterrado en la isla de Santa Elena.'], wiki: 'Napoleón Bonaparte' },
    { id: 'julio-cesar', nombre: 'Julio César', categoria: 'mandatario', campo: 'General y dictador', sexo: 'H', pais: 'Roma (Italia)', continente: 'Europa', nac: -100, fall: -44, epoca: 'Antigüedad',
      datos: ['Conquistó la Galia.', 'Cruzó el río Rubicón con su ejército.', 'Fue asesinado en los idus de marzo.'], wiki: 'Julio César' },
    { id: 'alejandro-magno', nombre: 'Alejandro Magno', categoria: 'mandatario', campo: 'Rey', sexo: 'H', pais: 'Macedonia (Grecia)', continente: 'Europa', nac: -356, fall: -323, epoca: 'Antigüedad',
      datos: ['Creó uno de los mayores imperios de la Antigüedad.', 'Fue alumno de Aristóteles.', 'Fundó la ciudad de Alejandría.'], wiki: 'Alejandro Magno' },
    { id: 'cleopatra', nombre: 'Cleopatra VII', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'Egipto', continente: 'África', nac: -69, fall: -30, epoca: 'Antigüedad',
      datos: ['Fue la última reina (faraona) del antiguo Egipto.', 'Se alió con Julio César y Marco Antonio.', 'Hablaba varios idiomas.'], wiki: 'Cleopatra' },
    { id: 'augusto', nombre: 'Augusto', categoria: 'mandatario', campo: 'Emperador', sexo: 'H', pais: 'Roma (Italia)', continente: 'Europa', nac: -63, fall: 14, epoca: 'Antigüedad',
      datos: ['Fue el primer emperador de Roma.', 'Era sobrino de Julio César.', 'El mes de agosto lleva su nombre.'], wiki: 'César Augusto' },
    { id: 'carlomagno', nombre: 'Carlomagno', categoria: 'mandatario', campo: 'Emperador', sexo: 'H', pais: 'Imperio franco (Francia/Alemania)', continente: 'Europa', nac: 742, fall: 814, epoca: 'Edad Media',
      datos: ['Fue coronado emperador el día de Navidad del año 800.', 'Impulsó la cultura y la educación.', 'Se le llama "el padre de Europa".'], wiki: 'Carlomagno' },
    { id: 'isabel-i-inglaterra', nombre: 'Isabel I de Inglaterra', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'Inglaterra', continente: 'Europa', nac: 1533, fall: 1603, epoca: 'Siglo XVI',
      datos: ['Su reinado se conoce como la "época dorada" inglesa.', 'Nunca se casó (la "Reina Virgen").', 'Bajo su reinado se derrotó a la Armada Invencible.'], wiki: 'Isabel I de Inglaterra' },
    { id: 'enrique-viii', nombre: 'Enrique VIII', categoria: 'mandatario', campo: 'Rey', sexo: 'H', pais: 'Inglaterra', continente: 'Europa', nac: 1491, fall: 1547, epoca: 'Siglo XVI',
      datos: ['Tuvo seis esposas.', 'Fundó la Iglesia anglicana.', 'Fue padre de Isabel I.'], wiki: 'Enrique VIII de Inglaterra' },
    { id: 'luis-xiv', nombre: 'Luis XIV', categoria: 'mandatario', campo: 'Rey', sexo: 'H', pais: 'Francia', continente: 'Europa', nac: 1638, fall: 1715, epoca: 'Siglo XVII',
      datos: ['Fue apodado el "Rey Sol".', 'Mandó construir el palacio de Versalles.', 'Reinó durante más de 70 años.'], wiki: 'Luis XIV de Francia' },
    { id: 'isabel-catolica', nombre: 'Isabel la Católica', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'España (Castilla)', continente: 'Europa', nac: 1451, fall: 1504, epoca: 'Siglo XV',
      datos: ['Financió el viaje de Colón en 1492.', 'Fue una de los Reyes Católicos.', 'Unió Castilla y Aragón al casarse con Fernando.'], wiki: 'Isabel I de Castilla' },
    { id: 'fernando-catolico', nombre: 'Fernando el Católico', categoria: 'mandatario', campo: 'Rey', sexo: 'H', pais: 'España (Aragón)', continente: 'Europa', nac: 1452, fall: 1516, epoca: 'Siglo XV',
      datos: ['Fue uno de los Reyes Católicos, esposo de Isabel.', 'Con él se completó la Reconquista al tomar Granada.', 'Impulsó la unión de los reinos de España.'], wiki: 'Fernando el Católico' },
    { id: 'carlos-v', nombre: 'Carlos V', categoria: 'mandatario', campo: 'Emperador', sexo: 'H', pais: 'España / Sacro Imperio', continente: 'Europa', nac: 1500, fall: 1558, epoca: 'Siglo XVI',
      datos: ['Se decía que en su imperio "nunca se ponía el sol".', 'Fue Carlos I de España y V de Alemania.', 'Abdicó y se retiró al monasterio de Yuste.'], wiki: 'Carlos I de España' },
    { id: 'felipe-ii', nombre: 'Felipe II', categoria: 'mandatario', campo: 'Rey', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1527, fall: 1598, epoca: 'Siglo XVI',
      datos: ['Mandó construir el monasterio de El Escorial.', 'Era hijo de Carlos V.', 'Envió la Armada Invencible contra Inglaterra.'], wiki: 'Felipe II de España' },
    { id: 'catalina-grande', nombre: 'Catalina la Grande', categoria: 'mandatario', campo: 'Emperatriz', sexo: 'M', pais: 'Rusia', continente: 'Europa', nac: 1729, fall: 1796, epoca: 'Siglo XVIII',
      datos: ['Amplió mucho el Imperio ruso.', 'Impulsó las artes y la cultura.', 'En realidad había nacido en Alemania.'], wiki: 'Catalina II de Rusia' },
    { id: 'pedro-grande', nombre: 'Pedro el Grande', categoria: 'mandatario', campo: 'Zar', sexo: 'H', pais: 'Rusia', continente: 'Europa', nac: 1672, fall: 1725, epoca: 'Siglo XVIII',
      datos: ['Fundó la ciudad de San Petersburgo.', 'Modernizó Rusia al estilo europeo.', 'Medía cerca de dos metros de altura.'], wiki: 'Pedro I de Rusia' },
    { id: 'gengis-kan', nombre: 'Gengis Kan', categoria: 'mandatario', campo: 'Emperador', sexo: 'H', pais: 'Mongolia', continente: 'Asia', nac: 1162, fall: 1227, epoca: 'Edad Media',
      datos: ['Fundó el Imperio mongol.', 'Creó el mayor imperio continuo de la historia.', 'Unió a las tribus nómadas de la estepa.'], wiki: 'Gengis Kan' },
    { id: 'lincoln', nombre: 'Abraham Lincoln', categoria: 'mandatario', campo: 'Presidente', sexo: 'H', pais: 'Estados Unidos', continente: 'América', nac: 1809, fall: 1865, epoca: 'Siglo XIX',
      datos: ['Abolió la esclavitud en Estados Unidos.', 'Gobernó durante la Guerra de Secesión.', 'Fue asesinado en un teatro.'], wiki: 'Abraham Lincoln' },
    { id: 'washington', nombre: 'George Washington', categoria: 'mandatario', campo: 'Presidente', sexo: 'H', pais: 'Estados Unidos', continente: 'América', nac: 1732, fall: 1799, epoca: 'Siglo XVIII',
      datos: ['Fue el primer presidente de Estados Unidos.', 'Lideró el ejército en la guerra de independencia.', 'La capital del país lleva su nombre.'], wiki: 'George Washington' },
    { id: 'churchill', nombre: 'Winston Churchill', categoria: 'mandatario', campo: 'Primer ministro', sexo: 'H', pais: 'Reino Unido', continente: 'Europa', nac: 1874, fall: 1965, epoca: 'Siglo XX',
      datos: ['Dirigió el Reino Unido en la Segunda Guerra Mundial.', 'Ganó el Premio Nobel de Literatura.', 'Es célebre por sus discursos.'], wiki: 'Winston Churchill' },
    { id: 'gandhi', nombre: 'Mahatma Gandhi', categoria: 'mandatario', campo: 'Líder', sexo: 'H', pais: 'India', continente: 'Asia', nac: 1869, fall: 1948, epoca: 'Siglo XX',
      datos: ['Lideró la independencia de la India.', 'Defendió la lucha sin violencia.', 'Era abogado de formación.'], wiki: 'Mahatma Gandhi' },
    { id: 'mandela', nombre: 'Nelson Mandela', categoria: 'mandatario', campo: 'Presidente', sexo: 'H', pais: 'Sudáfrica', continente: 'África', nac: 1918, fall: 2013, epoca: 'Siglo XX',
      datos: ['Luchó contra el apartheid.', 'Pasó 27 años en prisión.', 'Ganó el Premio Nobel de la Paz.'], wiki: 'Nelson Mandela' },
    { id: 'bolivar', nombre: 'Simón Bolívar', categoria: 'mandatario', campo: 'Líder', sexo: 'H', pais: 'Venezuela', continente: 'América', nac: 1783, fall: 1830, epoca: 'Siglo XIX',
      datos: ['Fue apodado "El Libertador".', 'Independizó a varios países de Sudamérica.', 'El país de Bolivia lleva su nombre.'], wiki: 'Simón Bolívar' },
    { id: 'reina-victoria', nombre: 'Reina Victoria', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1819, fall: 1901, epoca: 'Siglo XIX',
      datos: ['Dio nombre a la "época victoriana".', 'Reinó durante más de 63 años.', 'Sus descendientes reinaron en media Europa.'], wiki: 'Victoria del Reino Unido' },
    { id: 'juana-de-arco', nombre: 'Juana de Arco', categoria: 'mandatario', campo: 'Líder militar', sexo: 'M', pais: 'Francia', continente: 'Europa', nac: 1412, fall: 1431, epoca: 'Edad Media',
      datos: ['Guió al ejército francés siendo muy joven.', 'Murió en la hoguera.', 'Siglos después fue proclamada santa.'], wiki: 'Juana de Arco' },
    { id: 'tutankamon', nombre: 'Tutankamón', categoria: 'mandatario', campo: 'Faraón', sexo: 'H', pais: 'Egipto', continente: 'África', nac: -1341, fall: -1323, epoca: 'Antigüedad',
      datos: ['Llegó a faraón siendo un niño.', 'Su tumba se descubrió casi intacta en 1922.', 'Su máscara funeraria de oro es muy famosa.'], wiki: 'Tutankamón' },
    { id: 'moctezuma', nombre: 'Moctezuma II', categoria: 'mandatario', campo: 'Emperador', sexo: 'H', pais: 'Imperio azteca (México)', continente: 'América', nac: 1466, fall: 1520, epoca: 'Siglo XVI',
      datos: ['Gobernaba Tenochtitlan cuando llegaron los españoles.', 'Fue el emperador azteca durante la llegada de Hernán Cortés.'], wiki: 'Moctezuma II' },
    { id: 'atahualpa', nombre: 'Atahualpa', categoria: 'mandatario', campo: 'Emperador', sexo: 'H', pais: 'Imperio inca (Perú)', continente: 'América', nac: 1500, fall: 1533, epoca: 'Siglo XVI',
      datos: ['Fue el último emperador del Imperio inca.', 'Fue capturado por Francisco Pizarro.'], wiki: 'Atahualpa' },
    { id: 'soliman', nombre: 'Solimán el Magnífico', categoria: 'mandatario', campo: 'Sultán', sexo: 'H', pais: 'Imperio otomano (Turquía)', continente: 'Asia', nac: 1494, fall: 1566, epoca: 'Siglo XVI',
      datos: ['Llevó al Imperio otomano a su máximo esplendor.', 'Fue un gran legislador.'], wiki: 'Solimán el Magnífico' },
    { id: 'ramses-ii', nombre: 'Ramsés II', categoria: 'mandatario', campo: 'Faraón', sexo: 'H', pais: 'Egipto', continente: 'África', nac: -1303, fall: -1213, epoca: 'Antigüedad',
      datos: ['Fue uno de los faraones más poderosos.', 'Mandó construir los templos de Abu Simbel.', 'Reinó unos 66 años.'], wiki: 'Ramsés II' },
    { id: 'thatcher', nombre: 'Margaret Thatcher', categoria: 'mandatario', campo: 'Primera ministra', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1925, fall: 2013, epoca: 'Siglo XX',
      datos: ['Fue la primera mujer primera ministra del Reino Unido.', 'La apodaban "la Dama de Hierro".'], wiki: 'Margaret Thatcher' },
    { id: 'isabel-ii', nombre: 'Isabel II del Reino Unido', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1926, fall: 2022, epoca: 'Siglo XX',
      datos: ['Fue la reina más longeva del Reino Unido.', 'Reinó durante unos 70 años.'], wiki: 'Isabel II del Reino Unido' },
    { id: 'maria-antonieta', nombre: 'María Antonieta', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'Francia', continente: 'Europa', nac: 1755, fall: 1793, epoca: 'Siglo XVIII',
      datos: ['Fue reina de Francia.', 'Murió en la guillotina durante la Revolución francesa.'], wiki: 'María Antonieta' },
    { id: 'indira-gandhi', nombre: 'Indira Gandhi', categoria: 'mandatario', campo: 'Primera ministra', sexo: 'M', pais: 'India', continente: 'Asia', nac: 1917, fall: 1984, epoca: 'Siglo XX',
      datos: ['Fue la primera mujer primera ministra de la India.', 'No era pariente de Mahatma Gandhi.'], wiki: 'Indira Gandhi' },
    { id: 'golda-meir', nombre: 'Golda Meir', categoria: 'mandatario', campo: 'Primera ministra', sexo: 'M', pais: 'Israel', continente: 'Asia', nac: 1898, fall: 1978, epoca: 'Siglo XX',
      datos: ['Fue la primera mujer primera ministra de Israel.'], wiki: 'Golda Meir' },
    { id: 'juana-castilla', nombre: 'Juana I de Castilla', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'España (Castilla)', continente: 'Europa', nac: 1479, fall: 1555, epoca: 'Siglo XVI',
      datos: ['Era hija de los Reyes Católicos.', 'Es conocida como "Juana la Loca".'], wiki: 'Juana I de Castilla' },
    { id: 'boudica', nombre: 'Boudica', categoria: 'mandatario', campo: 'Reina guerrera', sexo: 'M', pais: 'Britania (Reino Unido)', continente: 'Europa', nac: 30, fall: 61, epoca: 'Antigüedad',
      datos: ['Fue una reina que se rebeló contra el Imperio romano en Britania.'], wiki: 'Boudica' },
    { id: 'wu-zetian', nombre: 'Wu Zetian', categoria: 'mandatario', campo: 'Emperatriz', sexo: 'M', pais: 'China', continente: 'Asia', nac: 624, fall: 705, epoca: 'Edad Media',
      datos: ['Fue la única mujer que gobernó China como emperatriz.'], wiki: 'Wu Zetian' },
    { id: 'nefertiti', nombre: 'Nefertiti', categoria: 'mandatario', campo: 'Reina', sexo: 'M', pais: 'Egipto', continente: 'África', nac: -1370, fall: -1330, epoca: 'Antigüedad',
      datos: ['Fue una reina del antiguo Egipto.', 'Su busto es una obra de arte muy famosa.'], wiki: 'Nefertiti' },
    { id: 'eva-peron', nombre: 'Eva Perón', categoria: 'mandatario', campo: 'Líder política', sexo: 'M', pais: 'Argentina', continente: 'América', nac: 1919, fall: 1952, epoca: 'Siglo XX',
      datos: ['Fue una líder política argentina, conocida como "Evita".', 'Luchó por el voto de las mujeres en Argentina.'], wiki: 'Eva Perón' },
    { id: 'rosa-parks', nombre: 'Rosa Parks', categoria: 'mandatario', campo: 'Activista', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1913, fall: 2005, epoca: 'Siglo XX',
      datos: ['Se negó a ceder su asiento en un autobús.', 'Fue un símbolo de la lucha por los derechos civiles.'], wiki: 'Rosa Parks' },
];

/* ============================ ARTISTAS (30) ============================ */
const ARTISTAS = [
    { id: 'picasso', nombre: 'Pablo Picasso', categoria: 'artista', campo: 'Pintor', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1881, fall: 1973, epoca: 'Siglo XX',
      datos: ['Fue uno de los creadores del cubismo.', 'Pintó el "Guernica".', 'Realizó miles de obras a lo largo de su vida.'], wiki: 'Pablo Picasso' },
    { id: 'davinci', nombre: 'Leonardo da Vinci', categoria: 'artista', campo: 'Pintor e inventor', sexo: 'H', pais: 'Italia', continente: 'Europa', nac: 1452, fall: 1519, epoca: 'Siglo XVI',
      datos: ['Pintó "La Gioconda" (Mona Lisa).', 'Diseñó máquinas voladoras adelantadas a su tiempo.', 'Fue un genio del Renacimiento.'], wiki: 'Leonardo da Vinci' },
    { id: 'miguelangel', nombre: 'Miguel Ángel', categoria: 'artista', campo: 'Escultor y pintor', sexo: 'H', pais: 'Italia', continente: 'Europa', nac: 1475, fall: 1564, epoca: 'Siglo XVI',
      datos: ['Esculpió el "David".', 'Pintó el techo de la Capilla Sixtina.'], wiki: 'Miguel Ángel' },
    { id: 'vangogh', nombre: 'Vincent van Gogh', categoria: 'artista', campo: 'Pintor', sexo: 'H', pais: 'Países Bajos', continente: 'Europa', nac: 1853, fall: 1890, epoca: 'Siglo XIX',
      datos: ['Pintó "La noche estrellada".', 'Vendió muy pocos cuadros mientras vivía.', 'Se cortó parte de una oreja.'], wiki: 'Vincent van Gogh' },
    { id: 'dali', nombre: 'Salvador Dalí', categoria: 'artista', campo: 'Pintor', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1904, fall: 1989, epoca: 'Siglo XX',
      datos: ['Fue un pintor surrealista.', 'Pintó relojes derretidos.', 'Tenía un bigote muy característico.'], wiki: 'Salvador Dalí' },
    { id: 'frida', nombre: 'Frida Kahlo', categoria: 'artista', campo: 'Pintora', sexo: 'M', pais: 'México', continente: 'América', nac: 1907, fall: 1954, epoca: 'Siglo XX',
      datos: ['Es famosa por sus autorretratos.', 'Sufrió un grave accidente de joven.', 'Es un icono de la cultura mexicana.'], wiki: 'Frida Kahlo' },
    { id: 'monet', nombre: 'Claude Monet', categoria: 'artista', campo: 'Pintor', sexo: 'H', pais: 'Francia', continente: 'Europa', nac: 1840, fall: 1926, epoca: 'Siglo XIX',
      datos: ['Es considerado el padre del impresionismo.', 'Pintó muchas veces sus nenúfares.'], wiki: 'Claude Monet' },
    { id: 'rembrandt', nombre: 'Rembrandt', categoria: 'artista', campo: 'Pintor', sexo: 'H', pais: 'Países Bajos', continente: 'Europa', nac: 1606, fall: 1669, epoca: 'Siglo XVII',
      datos: ['Fue un maestro del claroscuro.', 'Pintó "La ronda de noche".'], wiki: 'Rembrandt' },
    { id: 'goya', nombre: 'Francisco de Goya', categoria: 'artista', campo: 'Pintor', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1746, fall: 1828, epoca: 'Siglo XIX',
      datos: ['Fue pintor de la corte española.', 'Creó las llamadas "pinturas negras".', 'Con los años se quedó sordo.'], wiki: 'Francisco de Goya' },
    { id: 'velazquez', nombre: 'Diego Velázquez', categoria: 'artista', campo: 'Pintor', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1599, fall: 1660, epoca: 'Siglo XVII',
      datos: ['Pintó "Las meninas".', 'Fue el pintor del rey Felipe IV.'], wiki: 'Diego Velázquez' },
    { id: 'beethoven', nombre: 'Ludwig van Beethoven', categoria: 'artista', campo: 'Compositor', sexo: 'H', pais: 'Alemania', continente: 'Europa', nac: 1770, fall: 1827, epoca: 'Siglo XIX',
      datos: ['Compuso nueve sinfonías.', 'Compuso música aun estando sordo.', 'Es suya la pieza "Para Elisa".'], wiki: 'Ludwig van Beethoven' },
    { id: 'mozart', nombre: 'Wolfgang Amadeus Mozart', categoria: 'artista', campo: 'Compositor', sexo: 'H', pais: 'Austria', continente: 'Europa', nac: 1756, fall: 1791, epoca: 'Siglo XVIII',
      datos: ['Fue un niño prodigio de la música.', 'Compuso más de 600 obras.', 'Empezó a componer con solo cinco años.'], wiki: 'Wolfgang Amadeus Mozart' },
    { id: 'bach', nombre: 'Johann Sebastian Bach', categoria: 'artista', campo: 'Compositor', sexo: 'H', pais: 'Alemania', continente: 'Europa', nac: 1685, fall: 1750, epoca: 'Siglo XVIII',
      datos: ['Fue un gran maestro de la música barroca.', 'Tuvo veinte hijos.'], wiki: 'Johann Sebastian Bach' },
    { id: 'chopin', nombre: 'Frédéric Chopin', categoria: 'artista', campo: 'Compositor y pianista', sexo: 'H', pais: 'Polonia', continente: 'Europa', nac: 1810, fall: 1849, epoca: 'Siglo XIX',
      datos: ['Compuso casi toda su música para piano.'], wiki: 'Frédéric Chopin' },
    { id: 'vivaldi', nombre: 'Antonio Vivaldi', categoria: 'artista', campo: 'Compositor', sexo: 'H', pais: 'Italia', continente: 'Europa', nac: 1678, fall: 1741, epoca: 'Siglo XVIII',
      datos: ['Compuso "Las cuatro estaciones".', 'Era sacerdote y lo apodaban "el cura rojo".'], wiki: 'Antonio Vivaldi' },
    { id: 'shakespeare', nombre: 'William Shakespeare', categoria: 'artista', campo: 'Escritor', sexo: 'H', pais: 'Inglaterra', continente: 'Europa', nac: 1564, fall: 1616, epoca: 'Siglo XVII',
      datos: ['Escribió "Romeo y Julieta" y "Hamlet".', 'Inventó muchas palabras del inglés.'], wiki: 'William Shakespeare' },
    { id: 'cervantes', nombre: 'Miguel de Cervantes', categoria: 'artista', campo: 'Escritor', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1547, fall: 1616, epoca: 'Siglo XVII',
      datos: ['Escribió "Don Quijote de la Mancha".', 'Perdió el uso de una mano en la batalla de Lepanto.'], wiki: 'Miguel de Cervantes' },
    { id: 'austen', nombre: 'Jane Austen', categoria: 'artista', campo: 'Escritora', sexo: 'M', pais: 'Inglaterra', continente: 'Europa', nac: 1775, fall: 1817, epoca: 'Siglo XIX',
      datos: ['Escribió "Orgullo y prejuicio".', 'Publicó sus novelas de forma anónima.'], wiki: 'Jane Austen' },
    { id: 'dickens', nombre: 'Charles Dickens', categoria: 'artista', campo: 'Escritor', sexo: 'H', pais: 'Inglaterra', continente: 'Europa', nac: 1812, fall: 1870, epoca: 'Siglo XIX',
      datos: ['Escribió "Oliver Twist" y "Cuento de Navidad".', 'Publicaba sus historias por entregas.'], wiki: 'Charles Dickens' },
    { id: 'garcia-marquez', nombre: 'Gabriel García Márquez', categoria: 'artista', campo: 'Escritor', sexo: 'H', pais: 'Colombia', continente: 'América', nac: 1927, fall: 2014, epoca: 'Siglo XX',
      datos: ['Escribió "Cien años de soledad".', 'Es maestro del "realismo mágico".', 'Ganó el Premio Nobel de Literatura.'], wiki: 'Gabriel García Márquez' },
    { id: 'lorca', nombre: 'Federico García Lorca', categoria: 'artista', campo: 'Poeta y dramaturgo', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1898, fall: 1936, epoca: 'Siglo XX',
      datos: ['Formó parte de la Generación del 27.', 'Escribió "La casa de Bernarda Alba".'], wiki: 'Federico García Lorca' },
    { id: 'christie', nombre: 'Agatha Christie', categoria: 'artista', campo: 'Escritora', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1890, fall: 1976, epoca: 'Siglo XX',
      datos: ['Es la reina de las novelas de misterio.', 'Creó a los detectives Poirot y Miss Marple.', 'Es una de las autoras más vendidas de la historia.'], wiki: 'Agatha Christie' },
    { id: 'poe', nombre: 'Edgar Allan Poe', categoria: 'artista', campo: 'Escritor', sexo: 'H', pais: 'Estados Unidos', continente: 'América', nac: 1809, fall: 1849, epoca: 'Siglo XIX',
      datos: ['Fue maestro de los cuentos de terror.', 'Escribió el poema "El cuervo".', 'Es pionero del relato detectivesco.'], wiki: 'Edgar Allan Poe' },
    { id: 'rodin', nombre: 'Auguste Rodin', categoria: 'artista', campo: 'Escultor', sexo: 'H', pais: 'Francia', continente: 'Europa', nac: 1840, fall: 1917, epoca: 'Siglo XIX',
      datos: ['Esculpió "El pensador".'], wiki: 'Auguste Rodin' },
    { id: 'gaudi', nombre: 'Antoni Gaudí', categoria: 'artista', campo: 'Arquitecto', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1852, fall: 1926, epoca: 'Siglo XX',
      datos: ['Diseñó la Sagrada Familia de Barcelona.', 'Es la figura más famosa del modernismo.'], wiki: 'Antoni Gaudí' },
    { id: 'warhol', nombre: 'Andy Warhol', categoria: 'artista', campo: 'Artista', sexo: 'H', pais: 'Estados Unidos', continente: 'América', nac: 1928, fall: 1987, epoca: 'Siglo XX',
      datos: ['Fue una figura clave del "pop art".', 'Pintó latas de sopa Campbell y retratos de Marilyn.'], wiki: 'Andy Warhol' },
    { id: 'chaikovski', nombre: 'Piotr Chaikovski', categoria: 'artista', campo: 'Compositor', sexo: 'H', pais: 'Rusia', continente: 'Europa', nac: 1840, fall: 1893, epoca: 'Siglo XIX',
      datos: ['Compuso "El lago de los cisnes" y "El cascanueces".'], wiki: 'Piotr Ilich Chaikovski' },
    { id: 'okeeffe', nombre: "Georgia O'Keeffe", categoria: 'artista', campo: 'Pintora', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1887, fall: 1986, epoca: 'Siglo XX',
      datos: ['Es famosa por sus flores gigantes y sus paisajes.'], wiki: "Georgia O'Keeffe" },
    { id: 'gentileschi', nombre: 'Artemisia Gentileschi', categoria: 'artista', campo: 'Pintora', sexo: 'M', pais: 'Italia', continente: 'Europa', nac: 1593, fall: 1656, epoca: 'Siglo XVII',
      datos: ['Fue una pintora del Barroco.', 'Fue una de las primeras mujeres pintoras de gran éxito.'], wiki: 'Artemisia Gentileschi' },
    { id: 'rivera', nombre: 'Diego Rivera', categoria: 'artista', campo: 'Pintor y muralista', sexo: 'H', pais: 'México', continente: 'América', nac: 1886, fall: 1957, epoca: 'Siglo XX',
      datos: ['Es famoso por sus grandes murales.', 'Estuvo casado con Frida Kahlo.'], wiki: 'Diego Rivera' },
    { id: 'coco-chanel', nombre: 'Coco Chanel', categoria: 'artista', campo: 'Diseñadora de moda', sexo: 'M', pais: 'Francia', continente: 'Europa', nac: 1883, fall: 1971, epoca: 'Siglo XX',
      datos: ['Revolucionó la moda femenina.', 'Creó un perfume mundialmente famoso.'], wiki: 'Coco Chanel' },
    { id: 'maria-callas', nombre: 'Maria Callas', categoria: 'artista', campo: 'Cantante de ópera', sexo: 'M', pais: 'Grecia', continente: 'Europa', nac: 1923, fall: 1977, epoca: 'Siglo XX',
      datos: ['Fue una de las mayores sopranos de la historia.'], wiki: 'Maria Callas' },
    { id: 'virginia-woolf', nombre: 'Virginia Woolf', categoria: 'artista', campo: 'Escritora', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1882, fall: 1941, epoca: 'Siglo XX',
      datos: ['Fue una escritora británica muy innovadora.', 'Escribió "La señora Dalloway".'], wiki: 'Virginia Woolf' },
    { id: 'mary-shelley', nombre: 'Mary Shelley', categoria: 'artista', campo: 'Escritora', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1797, fall: 1851, epoca: 'Siglo XIX',
      datos: ['Escribió "Frankenstein".', 'La escribió siendo muy joven.'], wiki: 'Mary Shelley' },
    { id: 'gabriela-mistral', nombre: 'Gabriela Mistral', categoria: 'artista', campo: 'Poeta', sexo: 'M', pais: 'Chile', continente: 'América', nac: 1889, fall: 1957, epoca: 'Siglo XX',
      datos: ['Fue poeta chilena.', 'Fue la primera latinoamericana en ganar el Nobel de Literatura.'], wiki: 'Gabriela Mistral' },
    { id: 'sor-juana', nombre: 'Sor Juana Inés de la Cruz', categoria: 'artista', campo: 'Poeta', sexo: 'M', pais: 'México (Nueva España)', continente: 'América', nac: 1648, fall: 1695, epoca: 'Siglo XVII',
      datos: ['Fue poeta y monja en la Nueva España.', 'Defendió el derecho de las mujeres a estudiar.'], wiki: 'Sor Juana Inés de la Cruz' },
    { id: 'clara-schumann', nombre: 'Clara Schumann', categoria: 'artista', campo: 'Pianista y compositora', sexo: 'M', pais: 'Alemania', continente: 'Europa', nac: 1819, fall: 1896, epoca: 'Siglo XIX',
      datos: ['Fue una gran pianista y compositora.'], wiki: 'Clara Schumann' },
    { id: 'camille-claudel', nombre: 'Camille Claudel', categoria: 'artista', campo: 'Escultora', sexo: 'M', pais: 'Francia', continente: 'Europa', nac: 1864, fall: 1943, epoca: 'Siglo XIX',
      datos: ['Fue una talentosa escultora francesa.'], wiki: 'Camille Claudel' },
    { id: 'emily-dickinson', nombre: 'Emily Dickinson', categoria: 'artista', campo: 'Poeta', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1830, fall: 1886, epoca: 'Siglo XIX',
      datos: ['Fue poeta estadounidense.', 'Casi toda su poesía se publicó tras su muerte.'], wiki: 'Emily Dickinson' },
    { id: 'isadora-duncan', nombre: 'Isadora Duncan', categoria: 'artista', campo: 'Bailarina', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1877, fall: 1927, epoca: 'Siglo XX',
      datos: ['Fue pionera de la danza moderna.'], wiki: 'Isadora Duncan' },
];

/* ============================ CIENTÍFICOS (30) ============================ */
const CIENTIFICOS = [
    { id: 'einstein', nombre: 'Albert Einstein', categoria: 'cientifico', campo: 'Física', sexo: 'H', pais: 'Alemania', continente: 'Europa', nac: 1879, fall: 1955, epoca: 'Siglo XX',
      datos: ['Desarrolló la teoría de la relatividad.', 'Ganó el Premio Nobel de Física.', 'Es suya la ecuación E=mc².'], wiki: 'Albert Einstein' },
    { id: 'newton', nombre: 'Isaac Newton', categoria: 'cientifico', campo: 'Física y matemáticas', sexo: 'H', pais: 'Inglaterra', continente: 'Europa', nac: 1643, fall: 1727, epoca: 'Siglo XVII',
      datos: ['Formuló la ley de la gravedad.', 'Enunció las leyes del movimiento.', 'Se cuenta que le inspiró una manzana al caer.'], wiki: 'Isaac Newton' },
    { id: 'curie', nombre: 'Marie Curie', categoria: 'cientifico', campo: 'Física y química', sexo: 'M', pais: 'Polonia', continente: 'Europa', nac: 1867, fall: 1934, epoca: 'Siglo XX',
      datos: ['Descubrió el radio y el polonio.', 'Ganó dos premios Nobel (Física y Química).', 'Fue la primera mujer en ganar un Nobel.'], wiki: 'Marie Curie' },
    { id: 'darwin', nombre: 'Charles Darwin', categoria: 'cientifico', campo: 'Biología', sexo: 'H', pais: 'Inglaterra', continente: 'Europa', nac: 1809, fall: 1882, epoca: 'Siglo XIX',
      datos: ['Propuso la teoría de la evolución.', 'Viajó por el mundo en el barco Beagle.', 'Estudió los animales de las islas Galápagos.'], wiki: 'Charles Darwin' },
    { id: 'galileo', nombre: 'Galileo Galilei', categoria: 'cientifico', campo: 'Física y astronomía', sexo: 'H', pais: 'Italia', continente: 'Europa', nac: 1564, fall: 1642, epoca: 'Siglo XVII',
      datos: ['Mejoró el telescopio y observó los astros.', 'Defendió que la Tierra gira alrededor del Sol.'], wiki: 'Galileo Galilei' },
    { id: 'tesla', nombre: 'Nikola Tesla', categoria: 'cientifico', campo: 'Ingeniería', sexo: 'H', pais: 'Serbia', continente: 'Europa', nac: 1856, fall: 1943, epoca: 'Siglo XX',
      datos: ['Desarrolló la corriente alterna.', 'Fue autor de muchos inventos eléctricos.'], wiki: 'Nikola Tesla' },
    { id: 'edison', nombre: 'Thomas Edison', categoria: 'cientifico', campo: 'Inventor', sexo: 'H', pais: 'Estados Unidos', continente: 'América', nac: 1847, fall: 1931, epoca: 'Siglo XX',
      datos: ['Perfeccionó la bombilla eléctrica.', 'Inventó el fonógrafo.', 'Registró más de mil patentes.'], wiki: 'Thomas Alva Edison' },
    { id: 'pasteur', nombre: 'Louis Pasteur', categoria: 'cientifico', campo: 'Microbiología', sexo: 'H', pais: 'Francia', continente: 'Europa', nac: 1822, fall: 1895, epoca: 'Siglo XIX',
      datos: ['Inventó la pasteurización.', 'Desarrolló la vacuna contra la rabia.'], wiki: 'Louis Pasteur' },
    { id: 'hawking', nombre: 'Stephen Hawking', categoria: 'cientifico', campo: 'Física', sexo: 'H', pais: 'Reino Unido', continente: 'Europa', nac: 1942, fall: 2018, epoca: 'Siglo XX',
      datos: ['Estudió los agujeros negros.', 'Escribió "Breve historia del tiempo".', 'Hablaba mediante un sintetizador de voz.'], wiki: 'Stephen Hawking' },
    { id: 'fleming', nombre: 'Alexander Fleming', categoria: 'cientifico', campo: 'Medicina', sexo: 'H', pais: 'Reino Unido (Escocia)', continente: 'Europa', nac: 1881, fall: 1955, epoca: 'Siglo XX',
      datos: ['Descubrió la penicilina.', 'Lo descubrió casi por casualidad.'], wiki: 'Alexander Fleming' },
    { id: 'mendel', nombre: 'Gregor Mendel', categoria: 'cientifico', campo: 'Genética', sexo: 'H', pais: 'Chequia (Imperio austríaco)', continente: 'Europa', nac: 1822, fall: 1884, epoca: 'Siglo XIX',
      datos: ['Es el padre de la genética.', 'Hizo sus experimentos con guisantes.', 'Era monje.'], wiki: 'Gregor Mendel' },
    { id: 'copernico', nombre: 'Nicolás Copérnico', categoria: 'cientifico', campo: 'Astronomía', sexo: 'H', pais: 'Polonia', continente: 'Europa', nac: 1473, fall: 1543, epoca: 'Siglo XVI',
      datos: ['Propuso que el Sol es el centro (heliocentrismo).'], wiki: 'Nicolás Copérnico' },
    { id: 'kepler', nombre: 'Johannes Kepler', categoria: 'cientifico', campo: 'Astronomía', sexo: 'H', pais: 'Alemania', continente: 'Europa', nac: 1571, fall: 1630, epoca: 'Siglo XVII',
      datos: ['Descubrió que los planetas se mueven en órbitas elípticas.'], wiki: 'Johannes Kepler' },
    { id: 'faraday', nombre: 'Michael Faraday', categoria: 'cientifico', campo: 'Física y química', sexo: 'H', pais: 'Inglaterra', continente: 'Europa', nac: 1791, fall: 1867, epoca: 'Siglo XIX',
      datos: ['Estudió el electromagnetismo.', 'Descubrió la inducción eléctrica.'], wiki: 'Michael Faraday' },
    { id: 'volta', nombre: 'Alessandro Volta', categoria: 'cientifico', campo: 'Física', sexo: 'H', pais: 'Italia', continente: 'Europa', nac: 1745, fall: 1827, epoca: 'Siglo XIX',
      datos: ['Inventó la pila eléctrica.', 'El "voltio" lleva su nombre.'], wiki: 'Alessandro Volta' },
    { id: 'arquimedes', nombre: 'Arquímedes', categoria: 'cientifico', campo: 'Matemáticas y física', sexo: 'H', pais: 'Grecia (Siracusa)', continente: 'Europa', nac: -287, fall: -212, epoca: 'Antigüedad',
      datos: ['Se dice que gritó "¡Eureka!".', 'Explicó por qué flotan los cuerpos.', 'Estudió las palancas.'], wiki: 'Arquímedes' },
    { id: 'pitagoras', nombre: 'Pitágoras', categoria: 'cientifico', campo: 'Matemáticas', sexo: 'H', pais: 'Grecia', continente: 'Europa', nac: -570, fall: -495, epoca: 'Antigüedad',
      datos: ['Es célebre por su teorema sobre los triángulos.'], wiki: 'Pitágoras' },
    { id: 'aristoteles', nombre: 'Aristóteles', categoria: 'cientifico', campo: 'Filosofía y ciencia', sexo: 'H', pais: 'Grecia', continente: 'Europa', nac: -384, fall: -322, epoca: 'Antigüedad',
      datos: ['Fue maestro de Alejandro Magno.', 'Estudió casi todas las ciencias de su tiempo.'], wiki: 'Aristóteles' },
    { id: 'hipatia', nombre: 'Hipatia de Alejandría', categoria: 'cientifico', campo: 'Matemáticas y astronomía', sexo: 'M', pais: 'Egipto (Grecia)', continente: 'África', nac: 355, fall: 415, epoca: 'Antigüedad',
      datos: ['Fue una de las primeras mujeres matemáticas conocidas.', 'Enseñaba en Alejandría.'], wiki: 'Hipatia de Alejandría' },
    { id: 'rosalind-franklin', nombre: 'Rosalind Franklin', categoria: 'cientifico', campo: 'Química', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1920, fall: 1958, epoca: 'Siglo XX',
      datos: ['Sus fotografías ayudaron a descubrir la forma del ADN.'], wiki: 'Rosalind Franklin' },
    { id: 'ada-lovelace', nombre: 'Ada Lovelace', categoria: 'cientifico', campo: 'Matemáticas', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1815, fall: 1852, epoca: 'Siglo XIX',
      datos: ['Está considerada la primera programadora de la historia.', 'Era hija del poeta Lord Byron.'], wiki: 'Ada Lovelace' },
    { id: 'turing', nombre: 'Alan Turing', categoria: 'cientifico', campo: 'Matemáticas e informática', sexo: 'H', pais: 'Reino Unido', continente: 'Europa', nac: 1912, fall: 1954, epoca: 'Siglo XX',
      datos: ['Es uno de los padres de la informática.', 'Descifró códigos secretos en la Segunda Guerra Mundial.'], wiki: 'Alan Turing' },
    { id: 'sagan', nombre: 'Carl Sagan', categoria: 'cientifico', campo: 'Astronomía', sexo: 'H', pais: 'Estados Unidos', continente: 'América', nac: 1934, fall: 1996, epoca: 'Siglo XX',
      datos: ['Fue un gran divulgador de la astronomía.', 'Presentó la serie "Cosmos".'], wiki: 'Carl Sagan' },
    { id: 'mendeleyev', nombre: 'Dmitri Mendeléyev', categoria: 'cientifico', campo: 'Química', sexo: 'H', pais: 'Rusia', continente: 'Europa', nac: 1834, fall: 1907, epoca: 'Siglo XIX',
      datos: ['Creó la tabla periódica de los elementos.'], wiki: 'Dmitri Mendeléyev' },
    { id: 'lavoisier', nombre: 'Antoine Lavoisier', categoria: 'cientifico', campo: 'Química', sexo: 'H', pais: 'Francia', continente: 'Europa', nac: 1743, fall: 1794, epoca: 'Siglo XVIII',
      datos: ['Es el padre de la química moderna.', 'Dio nombre al oxígeno.'], wiki: 'Antoine Lavoisier' },
    { id: 'cajal', nombre: 'Santiago Ramón y Cajal', categoria: 'cientifico', campo: 'Medicina', sexo: 'H', pais: 'España', continente: 'Europa', nac: 1852, fall: 1934, epoca: 'Siglo XX',
      datos: ['Estudió las neuronas del cerebro.', 'Ganó el Premio Nobel de Medicina.'], wiki: 'Santiago Ramón y Cajal' },
    { id: 'goodall', nombre: 'Jane Goodall', categoria: 'cientifico', campo: 'Biología', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1934, fall: null, epoca: 'Siglo XX',
      datos: ['Es famosa por su estudio de los chimpancés.', 'Vivió entre chimpancés en África.'], wiki: 'Jane Goodall' },
    { id: 'katherine-johnson', nombre: 'Katherine Johnson', categoria: 'cientifico', campo: 'Matemáticas', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1918, fall: 2020, epoca: 'Siglo XX',
      datos: ['Calculó trayectorias de naves para la NASA.', 'Su historia aparece en la película "Figuras ocultas".'], wiki: 'Katherine Johnson' },
    { id: 'bohr', nombre: 'Niels Bohr', categoria: 'cientifico', campo: 'Física', sexo: 'H', pais: 'Dinamarca', continente: 'Europa', nac: 1885, fall: 1962, epoca: 'Siglo XX',
      datos: ['Propuso un modelo del átomo.', 'Ganó el Premio Nobel de Física.'], wiki: 'Niels Bohr' },
    { id: 'schrodinger', nombre: 'Erwin Schrödinger', categoria: 'cientifico', campo: 'Física', sexo: 'H', pais: 'Austria', continente: 'Europa', nac: 1887, fall: 1961, epoca: 'Siglo XX',
      datos: ['Fue clave en la física cuántica.', 'Es famoso por su experimento mental "el gato de Schrödinger".'], wiki: 'Erwin Schrödinger' },
    { id: 'rita-levi', nombre: 'Rita Levi-Montalcini', categoria: 'cientifico', campo: 'Medicina', sexo: 'M', pais: 'Italia', continente: 'Europa', nac: 1909, fall: 2012, epoca: 'Siglo XX',
      datos: ['Investigó el sistema nervioso.', 'Ganó el Premio Nobel de Medicina.'], wiki: 'Rita Levi-Montalcini' },
    { id: 'mcclintock', nombre: 'Barbara McClintock', categoria: 'cientifico', campo: 'Genética', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1902, fall: 1992, epoca: 'Siglo XX',
      datos: ['Estudió los genes del maíz.', 'Ganó el Premio Nobel.'], wiki: 'Barbara McClintock' },
    { id: 'hodgkin', nombre: 'Dorothy Hodgkin', categoria: 'cientifico', campo: 'Química', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1910, fall: 1994, epoca: 'Siglo XX',
      datos: ['Estudió la estructura de moléculas como la penicilina.', 'Ganó el Premio Nobel de Química.'], wiki: 'Dorothy Hodgkin' },
    { id: 'lise-meitner', nombre: 'Lise Meitner', categoria: 'cientifico', campo: 'Física', sexo: 'M', pais: 'Austria', continente: 'Europa', nac: 1878, fall: 1968, epoca: 'Siglo XX',
      datos: ['Contribuyó al descubrimiento de la fisión nuclear.'], wiki: 'Lise Meitner' },
    { id: 'vera-rubin', nombre: 'Vera Rubin', categoria: 'cientifico', campo: 'Astronomía', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1928, fall: 2016, epoca: 'Siglo XX',
      datos: ['Aportó pruebas de la existencia de la materia oscura.'], wiki: 'Vera Rubin' },
    { id: 'mary-anning', nombre: 'Mary Anning', categoria: 'cientifico', campo: 'Paleontología', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1799, fall: 1847, epoca: 'Siglo XIX',
      datos: ['Descubrió importantes fósiles de reptiles marinos.', 'Fue pionera de la paleontología.'], wiki: 'Mary Anning' },
    { id: 'chatelet', nombre: 'Émilie du Châtelet', categoria: 'cientifico', campo: 'Física y matemáticas', sexo: 'M', pais: 'Francia', continente: 'Europa', nac: 1706, fall: 1749, epoca: 'Siglo XVIII',
      datos: ['Fue física y matemática.', 'Tradujo y explicó la obra de Newton.'], wiki: 'Émilie du Châtelet' },
    { id: 'grace-hopper', nombre: 'Grace Hopper', categoria: 'cientifico', campo: 'Informática', sexo: 'M', pais: 'Estados Unidos', continente: 'América', nac: 1906, fall: 1992, epoca: 'Siglo XX',
      datos: ['Fue pionera de la programación de ordenadores.', 'Popularizó el término "bug" (fallo informático).'], wiki: 'Grace Hopper' },
    { id: 'margarita-salas', nombre: 'Margarita Salas', categoria: 'cientifico', campo: 'Bioquímica', sexo: 'M', pais: 'España', continente: 'Europa', nac: 1938, fall: 2019, epoca: 'Siglo XX',
      datos: ['Fue una destacada bioquímica española.', 'Su investigación permitió multiplicar el ADN.'], wiki: 'Margarita Salas' },
    { id: 'jocelyn-bell', nombre: 'Jocelyn Bell Burnell', categoria: 'cientifico', campo: 'Astrofísica', sexo: 'M', pais: 'Reino Unido', continente: 'Europa', nac: 1943, fall: null, epoca: 'Siglo XX',
      datos: ['Descubrió los púlsares (estrellas de neutrones).'], wiki: 'Jocelyn Bell Burnell' },
];

/* ============================ EXPORTS ============================ */

export const PERSONAJES_HISTORICOS = [...MANDATARIOS, ...ARTISTAS, ...CIENTIFICOS];

// Utilidades de filtrado/consulta ---------------------------------------------
export const personajesPorCategoria = (cat) => PERSONAJES_HISTORICOS.filter((p) => p.categoria === cat);
export const personajePorId = (id) => PERSONAJES_HISTORICOS.find((p) => p.id === id);

// Época "legible" a partir del año (por si se quiere derivar en vez de usar p.epoca).
export function epocaDeAnio(anio) {
    if (anio == null) return '';
    if (anio < 476) return 'Antigüedad';
    if (anio < 1453) return 'Edad Media';
    if (anio < 1501) return 'Siglo XV';
    if (anio < 1601) return 'Siglo XVI';
    if (anio < 1701) return 'Siglo XVII';
    if (anio < 1801) return 'Siglo XVIII';
    if (anio < 1901) return 'Siglo XIX';
    return 'Siglo XX';
}

// Año formateado con a.C./d.C. para mostrar fechas.
export const anioTexto = (a) => (a == null ? '?' : a < 0 ? `${-a} a.C.` : `${a}`);

// Avatar de reserva (iniciales sobre color) como data URI, por si falla la foto.
export function avatarIniciales(nombre, bg = '#118ab2') {
    const ini = String(nombre || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='${bg}'/><text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='Arial' font-size='84' fill='white'>${ini}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Obtiene la URL de la foto desde Wikipedia (miniatura del artículo).
// Devuelve null si no hay foto; el componente debe usar avatarIniciales como reserva.
const _cacheFotos = {};
export async function fotoDeWiki(titulo, lang = 'es') {
    if (!titulo) return null;
    if (_cacheFotos[titulo] !== undefined) return _cacheFotos[titulo];
    try {
        const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`);
        if (!r.ok) { _cacheFotos[titulo] = null; return null; }
        const d = await r.json();
        const url = d.thumbnail?.source || d.originalimage?.source || null;
        _cacheFotos[titulo] = url;
        return url;
    } catch {
        _cacheFotos[titulo] = null;
        return null;
    }
}
