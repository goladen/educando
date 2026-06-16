// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTECA DE LÍNEAS DEL TIEMPO
// Colección de líneas del tiempo predefinidas para el juego "Línea del Tiempo".
// Cada entrada es un recurso jugable (tipoJuego LINEA_TIEMPO) con una sola hoja.
//
// Estructura de cada entrada:
//   { id, titulo, descripcion, imagen, tema, tipoJuego, esBiblioteca, hojas: [hoja] }
// Estructura de cada evento:
//   { id, fechaTipo: 'anio' | 'dia', anio, mes?, dia?, titulo, descripcion, imagen, video }
//
// Las imágenes se cargan desde Wikimedia Commons (Special:FilePath, redirige al
// archivo). Si alguna no aparece, basta con sustituir la URL del campo `imagen`.
// ─────────────────────────────────────────────────────────────────────────────

// Imágenes (Wikimedia Commons) de cada acontecimiento, indexadas por id de evento.
// Generadas con la API de Commons; si alguna deja de cargar, basta con cambiar la URL.
const IMG = {
    bib_tierra_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/500px-The_Earth_seen_from_Apollo_17.jpg",
    bib_tierra_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Living_stromatolites%2C_Shark_Bay%2C_Western_Australia.png/500px-Living_stromatolites%2C_Shark_Bay%2C_Western_Australia.png",
    bib_tierra_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Black-band_ironstone_%28aka%29.jpg/500px-Black-band_ironstone_%28aka%29.jpg",
    bib_tierra_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Anomalocaris_canadensis_%28TMP_2023.003.0003%29%2C_Royal_Tyrrell_Museum%2C_Drumheller%2C_Alberta%2C_2025-07-13.jpg/500px-Anomalocaris_canadensis_%28TMP_2023.003.0003%29%2C_Royal_Tyrrell_Museum%2C_Drumheller%2C_Alberta%2C_2025-07-13.jpg",
    bib_tierra_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Skeleton_of_Tyrannosaurus_2.jpg/500px-Skeleton_of_Tyrannosaurus_2.jpg",
    bib_tierra_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Artist%27s_illustration_of_NASA%27s_Double_Asteroid_Redirection_Test_Mission.jpg/500px-Artist%27s_illustration_of_NASA%27s_Double_Asteroid_Redirection_Test_Mission.jpg",
    bib_tierra_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Oase_2_skull_%28Homo_sapiens%29.jpg/500px-Oase_2_skull_%28Homo_sapiens%29.jpg",
    bib_prehistoria_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Oldowan_Chopper_Stone_Tool_Sketch.jpeg/500px-Oldowan_Chopper_Stone_Tool_Sketch.jpeg",
    bib_prehistoria_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Lower_Paleolithic_Handaxe_%28FindID_401543%29.jpg/500px-Lower_Paleolithic_Handaxe_%28FindID_401543%29.jpg",
    bib_prehistoria_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Parure_de_Cro-Magnon_MHNT.PRE.2006.0.73.1-32.jpg/500px-Parure_de_Cro-Magnon_MHNT.PRE.2006.0.73.1-32.jpg",
    bib_prehistoria_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Lascaux_painting.jpg/500px-Lascaux_painting.jpg",
    bib_prehistoria_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Centres_of_origin_and_spread_of_agriculture.svg/500px-Centres_of_origin_and_spread_of_agriculture.svg.png",
    bib_prehistoria_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Bronze_swords-MGR_Lyon-IMG_9734.jpg/500px-Bronze_swords-MGR_Lyon-IMG_9734.jpg",
    bib_prehistoria_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Stonehenge_Heel_Stone.jpg/500px-Stonehenge_Heel_Stone.jpg",
    bib_antigua_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Proto_cuneiform_tablet_OIM_A02516.jpg/500px-Proto_cuneiform_tablet_OIM_A02516.jpg",
    bib_antigua_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Great_Sphinx_of_Giza_%28%D8%A3%D8%A8%D9%88_%D8%A7%D9%84%D9%87%D9%88%D9%84%29.jpg/500px-Great_Sphinx_of_Giza_%28%D8%A3%D8%A8%D9%88_%D8%A7%D9%84%D9%87%D9%88%D9%84%29.jpg",
    bib_antigua_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/P1050763_Louvre_code_Hammurabi_face_rwk.JPG/500px-P1050763_Louvre_code_Hammurabi_face_rwk.JPG",
    bib_antigua_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Ancient_Olympia_Stadium_in_Greece_%2851224128585%29.jpg/500px-Ancient_Olympia_Stadium_in_Greece_%2851224128585%29.jpg",
    bib_antigua_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Forum_romanum_6k_%285760x2097%29.jpg/500px-Forum_romanum_6k_%285760x2097%29.jpg",
    bib_antigua_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Alexander_the_Great_mosaic.jpg/500px-Alexander_the_Great_mosaic.jpg",
    bib_antigua_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Colosseum_in_Rome-April_2007-1-_copie_2B.jpg/500px-Colosseum_in_Rome-April_2007-1-_copie_2B.jpg",
    bib_media_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/David_Roberts_%281796-1864%29_-_Ruins_of_the_Roman_Forum_-_OP212_-_Wolverhampton_Art_Gallery.jpg/500px-David_Roberts_%281796-1864%29_-_Ruins_of_the_Roman_Forum_-_OP212_-_Wolverhampton_Art_Gallery.jpg",
    bib_media_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/The_Kaaba_during_Hajj_-_edited.jpg/500px-The_Kaaba_during_Hajj_-_edited.jpg",
    bib_media_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Mezquita-Catedral_de_C%C3%B3rdoba_-_Blending_of_Christian_and_Moorish_architecture.jpg/500px-Mezquita-Catedral_de_C%C3%B3rdoba_-_Blending_of_Christian_and_Moorish_architecture.jpg",
    bib_media_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Charlemagne_Agostino_Cornacchini_Vatican_2.jpg/500px-Charlemagne_Agostino_Cornacchini_Vatican_2.jpg",
    bib_media_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Bayeux_Tapestry_scene57_Harold_death.jpg/500px-Bayeux_Tapestry_scene57_Harold_death.jpg",
    bib_media_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Doutielt3.jpg/500px-Doutielt3.jpg",
    bib_media_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Hagia_Sophia_Mars_2013.jpg/500px-Hagia_Sophia_Mars_2013.jpg",
    bib_moderna_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Printing_press_05.jpg/500px-Printing_press_05.jpg",
    bib_moderna_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Columbus_landing_on_Hispaniola.JPG/500px-Columbus_landing_on_Hispaniola.JPG",
    bib_moderna_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/500px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
    bib_moderna_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Lucas_Cranach_d.%C3%84._-_Martin_Luther%2C_1528_%28Veste_Coburg%29.jpg/500px-Lucas_Cranach_d.%C3%84._-_Martin_Luther%2C_1528_%28Veste_Coburg%29.jpg",
    bib_moderna_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Ferdinand_Magellan.jpg/500px-Ferdinand_Magellan.jpg",
    bib_moderna_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/United_States_Declaration_of_Independence.jpg/500px-United_States_Declaration_of_Independence.jpg",
    bib_moderna_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Prise_de_la_Bastille_clean.jpg/500px-Prise_de_la_Bastille_clean.jpg",
    bib_contemporanea_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Eug%C3%A8ne_Delacroix_-_La_libert%C3%A9_guidant_le_peuple.jpg/500px-Eug%C3%A8ne_Delacroix_-_La_libert%C3%A9_guidant_le_peuple.jpg",
    bib_contemporanea_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Wakataka_steam_locomotive_at_The_19th_Century_Hall_002.jpg/500px-Wakataka_steam_locomotive_at_The_19th_Century_Hall_002.jpg",
    bib_contemporanea_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Cheshire_Regiment_trench_Somme_1916.jpg/500px-Cheshire_Regiment_trench_Somme_1916.jpg",
    bib_contemporanea_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Depression%2C_Breadlines-long_line_of_people_waiting_to_be_fed%2C_New_York_City_-_NARA_-_196499.tif/lossy-page1-500px-Depression%2C_Breadlines-long_line_of_people_waiting_to_be_fed%2C_New_York_City_-_NARA_-_196499.tif.jpg",
    bib_contemporanea_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Into_the_Jaws_of_Death_23-0455M_edit.jpg/500px-Into_the_Jaws_of_Death_23-0455M_edit.jpg",
    bib_contemporanea_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Aldrin_Apollo_11.jpg/500px-Aldrin_Apollo_11.jpg",
    bib_contemporanea_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Juggling_on_the_Berlin_Wall_1a.jpg/500px-Juggling_on_the_Berlin_Wall_1a.jpg",
    bib_contemporanea_8: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/World_Trade_Center%2C_New_York_City_-_aerial_view_%28March_2001%29.jpg/500px-World_Trade_Center%2C_New_York_City_-_aerial_view_%28March_2001%29.jpg",
    bib_espana_xx_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Havana_-_The_USS_Maine_entering_Havana_Harbor.jpg/500px-Havana_-_The_USS_Maine_entering_Havana_Harbor.jpg",
    bib_espana_xx_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Miguel_Primo_de_Rivera%2C_Kaulak_%28cropped%29.jpg/500px-Miguel_Primo_de_Rivera%2C_Kaulak_%28cropped%29.jpg",
    bib_espana_xx_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Bandera_de_la_Rep%C3%BAblica_Espa%C3%B1ola_%281931-1939%29.svg/500px-Bandera_de_la_Rep%C3%BAblica_Espa%C3%B1ola_%281931-1939%29.svg.png",
    bib_espana_xx_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Spanish_Civil_War_-_Mass_grave_-_Est%C3%A9par%2C_Burgos.jpg/500px-Spanish_Civil_War_-_Mass_grave_-_Est%C3%A9par%2C_Burgos.jpg",
    bib_espana_xx_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Francisco_Franco_1930.jpg/500px-Francisco_Franco_1930.jpg",
    bib_espana_xx_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Constitucion_espanola_1978.JPG/500px-Constitucion_espanola_1978.JPG",
    bib_espana_xx_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Madrid_-_Congreso_de_los_Diputados_01.jpg/500px-Madrid_-_Congreso_de_los_Diputados_01.jpg",
    bib_espana_xx_8: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Flag_of_Europe.svg/500px-Flag_of_Europe.svg.png",
    bib_europa_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Statue-Augustus.jpg/500px-Statue-Augustus.jpg",
    bib_europa_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/David_Roberts_%281796-1864%29_-_Ruins_of_the_Roman_Forum_-_OP212_-_Wolverhampton_Art_Gallery.jpg/500px-David_Roberts_%281796-1864%29_-_Ruins_of_the_Roman_Forum_-_OP212_-_Wolverhampton_Art_Gallery.jpg",
    bib_europa_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Charlemagne_Agostino_Cornacchini_Vatican.jpg/500px-Charlemagne_Agostino_Cornacchini_Vatican.jpg",
    bib_europa_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/CampanileGiotto-01.jpg/500px-CampanileGiotto-01.jpg",
    bib_europa_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Prise_de_la_Bastille_clean.jpg/500px-Prise_de_la_Bastille_clean.jpg",
    bib_europa_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Cheshire_Regiment_trench_Somme_1916.jpg/500px-Cheshire_Regiment_trench_Somme_1916.jpg",
    bib_europa_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/EEC_Treaty_%28Treaty_of_Rome%29_German_copy.pdf/page1-500px-EEC_Treaty_%28Treaty_of_Rome%29_German_copy.pdf.jpg",
    bib_europa_8: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Flag_of_Europe.svg/500px-Flag_of_Europe.svg.png",
    bib_espacio_1: "https://upload.wikimedia.org/wikipedia/commons/8/8e/Sputnik_1_satellite_model.png",
    bib_espacio_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Yuri_Gagarin_%281961%29_-_Restoration.jpg/500px-Yuri_Gagarin_%281961%29_-_Restoration.jpg",
    bib_espacio_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Aldrin_Apollo_11.jpg/500px-Aldrin_Apollo_11.jpg",
    bib_espacio_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Space_Shuttle_Columbia_launching.jpg/500px-Space_Shuttle_Columbia_launching.jpg",
    bib_espacio_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/UGC_1810_and_UGC_1813_in_Arp_273_%28captured_by_the_Hubble_Space_Telescope%29.jpg/500px-UGC_1810_and_UGC_1813_in_Arp_273_%28captured_by_the_Hubble_Space_Telescope%29.jpg",
    bib_espacio_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/International_Space_Station_after_undocking_of_STS-132.jpg/500px-International_Space_Station_after_undocking_of_STS-132.jpg",
    bib_espacio_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Curiosity_-_Robot_Geologist_and_Chemist_in_One%21.jpg/500px-Curiosity_-_Robot_Geologist_and_Chemist_in_One%21.jpg",
    bib_inventos_1: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Old_4_wheel_cart.jpg/500px-Old_4_wheel_cart.jpg",
    bib_inventos_2: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Printing_press_05.jpg/500px-Printing_press_05.jpg",
    bib_inventos_3: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Maquina_vapor_Watt_ETSIIM.jpg/500px-Maquina_vapor_Watt_ETSIIM.jpg",
    bib_inventos_4: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Alexander_Graham_Bell_1895_NPG_77_363.jpg/500px-Alexander_Graham_Bell_1895_NPG_77_363.jpg",
    bib_inventos_5: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Light_bulb_Edison_2.jpg/500px-Light_bulb_Edison_2.jpg",
    bib_inventos_6: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/First_flight3.jpg/500px-First_flight3.jpg",
    bib_inventos_7: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Sir_Tim_Berners-Lee_%28cropped%29.jpg/500px-Sir_Tim_Berners-Lee_%28cropped%29.jpg",
    bib_inventos_8: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/First_iPhone_Macworld_2007_DSCF1286.agr.jpg/500px-First_iPhone_Macworld_2007_DSCF1286.agr.jpg",
};

// Construye una entrada de la biblioteca. La imagen de portada se toma de `portadaKey`
// (un id de evento de IMG); cada evento recibe su imagen desde IMG por su id.
const linea = (id, titulo, descripcion, portadaKey, tema, mostrarFechas, eventos) => ({
    id,
    titulo,
    descripcion,
    imagen: IMG[portadaKey] || '',
    tema,
    tipoJuego: 'LINEA_TIEMPO',
    tipo: 'LINEA_TIEMPO',
    esBiblioteca: true,
    isFinished: true,
    profesorNombre: 'Biblioteca pikt.es',
    hojas: [{
        nombreHoja: titulo,
        mostrarFechas,
        eventos: eventos.map((e, i) => ({ id: `${id}_${i + 1}`, video: '', ...e, imagen: IMG[`${id}_${i + 1}`] || e.imagen || '' })),
    }],
});

export const BIBLIOTECA_LINEAS_TIEMPO = [

    // 1 ── HISTORIA DE LA TIERRA ──────────────────────────────────────────────
    linea('bib_tierra', 'Historia de la Tierra',
        'Los grandes hitos geológicos y biológicos de nuestro planeta, desde su formación hasta la aparición del ser humano.',
        'bib_tierra_1', 'Geología', true, [
        { fechaTipo: 'anio', anio: -4543000000, titulo: 'Formación de la Tierra', descripcion: 'Hace unos 4.500 millones de años se forma la Tierra a partir del disco de gas y polvo que rodeaba al Sol.' },
        { fechaTipo: 'anio', anio: -3700000000, titulo: 'Primeras formas de vida', descripcion: 'Aparecen las primeras bacterias en los océanos primitivos.' },
        { fechaTipo: 'anio', anio: -2400000000, titulo: 'La Gran Oxidación', descripcion: 'La fotosíntesis de las cianobacterias llena la atmósfera de oxígeno.' },
        { fechaTipo: 'anio', anio: -538000000, titulo: 'Explosión del Cámbrico', descripcion: 'En pocos millones de años surge una enorme diversidad de animales con caparazón.' },
        { fechaTipo: 'anio', anio: -230000000, titulo: 'Era de los dinosaurios', descripcion: 'Los dinosaurios se convierten en los animales dominantes en tierra firme.' },
        { fechaTipo: 'anio', anio: -66000000, titulo: 'Extinción de los dinosaurios', descripcion: 'El impacto de un asteroide provoca la extinción de los dinosaurios no avianos.' },
        { fechaTipo: 'anio', anio: -300000, titulo: 'Aparece el Homo sapiens', descripcion: 'Surge nuestra especie en el continente africano.' },
    ]),

    // 2 ── PREHISTORIA ────────────────────────────────────────────────────────
    linea('bib_prehistoria', 'Prehistoria',
        'Desde las primeras herramientas de piedra hasta la Edad de los Metales, antes de la invención de la escritura.',
        'bib_prehistoria_4', 'Prehistoria', true, [
        { fechaTipo: 'anio', anio: -2600000, titulo: 'Primeras herramientas de piedra', descripcion: 'El Homo habilis talla las primeras herramientas: comienza el Paleolítico.' },
        { fechaTipo: 'anio', anio: -800000, titulo: 'Dominio del fuego', descripcion: 'El ser humano aprende a controlar el fuego para calentarse, cocinar y protegerse.' },
        { fechaTipo: 'anio', anio: -300000, titulo: 'Aparece el Homo sapiens', descripcion: 'Surge el ser humano moderno.' },
        { fechaTipo: 'anio', anio: -36000, titulo: 'Arte rupestre', descripcion: 'Se pintan las cuevas de Altamira y Lascaux con escenas de caza.' },
        { fechaTipo: 'anio', anio: -9000, titulo: 'Revolución Neolítica', descripcion: 'Nacen la agricultura y la ganadería; el ser humano se hace sedentario.' },
        { fechaTipo: 'anio', anio: -5000, titulo: 'Edad de los Metales', descripcion: 'Se empieza a trabajar el cobre, después el bronce y el hierro.' },
        { fechaTipo: 'anio', anio: -3000, titulo: 'Construcción de Stonehenge', descripcion: 'Se levanta el famoso monumento megalítico en Inglaterra.' },
    ]),

    // 3 ── EDAD ANTIGUA ───────────────────────────────────────────────────────
    linea('bib_antigua', 'Edad Antigua',
        'Las grandes civilizaciones de la Antigüedad, desde la invención de la escritura hasta la caída de Roma.',
        'bib_antigua_2', 'Historia', true, [
        { fechaTipo: 'anio', anio: -3300, titulo: 'Invención de la escritura', descripcion: 'En Mesopotamia se inventa la escritura cuneiforme. Comienza la Historia.' },
        { fechaTipo: 'anio', anio: -2560, titulo: 'Pirámides de Egipto', descripcion: 'Se construye la Gran Pirámide de Guiza para el faraón Keops.' },
        { fechaTipo: 'anio', anio: -1750, titulo: 'Código de Hammurabi', descripcion: 'El rey de Babilonia promulga uno de los primeros conjuntos de leyes escritas.' },
        { fechaTipo: 'anio', anio: -776, titulo: 'Primeros Juegos Olímpicos', descripcion: 'Se celebran en Olimpia, en la Antigua Grecia.' },
        { fechaTipo: 'anio', anio: -509, titulo: 'Nace la República romana', descripcion: 'Roma derroca a sus reyes y se organiza como república.' },
        { fechaTipo: 'anio', anio: -336, titulo: 'Imperio de Alejandro Magno', descripcion: 'Alejandro extiende la cultura griega desde Grecia hasta la India.' },
        { fechaTipo: 'anio', anio: 476, titulo: 'Caída del Imperio Romano', descripcion: 'Cae el Imperio Romano de Occidente. Termina la Edad Antigua.' },
    ]),

    // 4 ── EDAD MEDIA ─────────────────────────────────────────────────────────
    linea('bib_media', 'Edad Media',
        'Mil años de historia entre la caída de Roma y el final del mundo medieval.',
        'bib_media_3', 'Historia', true, [
        { fechaTipo: 'anio', anio: 476, titulo: 'Caída de Roma', descripcion: 'Cae el Imperio Romano de Occidente y comienza la Edad Media.' },
        { fechaTipo: 'anio', anio: 622, titulo: 'Nacimiento del Islam', descripcion: 'Mahoma emigra de La Meca a Medina (la Hégira); arranca el calendario musulmán.' },
        { fechaTipo: 'anio', anio: 711, titulo: 'Llegada musulmana a Hispania', descripcion: 'Los musulmanes cruzan el Estrecho y conquistan gran parte de la península ibérica.' },
        { fechaTipo: 'anio', anio: 800, titulo: 'Coronación de Carlomagno', descripcion: 'Carlomagno es coronado emperador, restaurando el Imperio en Occidente.' },
        { fechaTipo: 'anio', anio: 1066, titulo: 'Batalla de Hastings', descripcion: 'Guillermo el Conquistador invade Inglaterra.' },
        { fechaTipo: 'anio', anio: 1347, titulo: 'La Peste Negra', descripcion: 'Una epidemia de peste mata a un tercio de la población europea.' },
        { fechaTipo: 'anio', anio: 1453, titulo: 'Caída de Constantinopla', descripcion: 'Los turcos otomanos toman Constantinopla. Suele marcarse el fin de la Edad Media.' },
    ]),

    // 5 ── EDAD MODERNA ───────────────────────────────────────────────────────
    linea('bib_moderna', 'Edad Moderna',
        'Descubrimientos, imprenta, revoluciones científicas y el camino hacia el mundo contemporáneo.',
        'bib_moderna_3', 'Historia', true, [
        { fechaTipo: 'anio', anio: 1455, titulo: 'La imprenta de Gutenberg', descripcion: 'Gutenberg imprime la Biblia con tipos móviles; los libros se difunden por Europa.' },
        { fechaTipo: 'dia', anio: 1492, mes: 10, dia: 12, titulo: 'Descubrimiento de América', descripcion: 'Cristóbal Colón llega a América. Comienza la Edad Moderna.' },
        { fechaTipo: 'anio', anio: 1503, titulo: 'Leonardo pinta la Gioconda', descripcion: 'Leonardo da Vinci comienza la Mona Lisa, símbolo del Renacimiento.' },
        { fechaTipo: 'anio', anio: 1517, titulo: 'Reforma protestante', descripcion: 'Lutero publica sus 95 tesis y divide a la cristiandad occidental.' },
        { fechaTipo: 'anio', anio: 1522, titulo: 'Primera vuelta al mundo', descripcion: 'La expedición de Magallanes y Elcano completa la primera circunnavegación.' },
        { fechaTipo: 'dia', anio: 1776, mes: 7, dia: 4, titulo: 'Independencia de EE. UU.', descripcion: 'Las Trece Colonias declaran su independencia de Gran Bretaña.' },
        { fechaTipo: 'dia', anio: 1789, mes: 7, dia: 14, titulo: 'Revolución Francesa', descripcion: 'La toma de la Bastilla inicia la Revolución Francesa y el fin de la Edad Moderna.' },
    ]),

    // 6 ── HISTORIA CONTEMPORÁNEA ─────────────────────────────────────────────
    linea('bib_contemporanea', 'Historia Contemporánea',
        'Los grandes acontecimientos mundiales desde la Revolución Francesa hasta el siglo XXI.',
        'bib_contemporanea_6', 'Historia', true, [
        { fechaTipo: 'dia', anio: 1789, mes: 7, dia: 14, titulo: 'Revolución Francesa', descripcion: 'La toma de la Bastilla abre la Edad Contemporánea.' },
        { fechaTipo: 'anio', anio: 1869, titulo: 'Revolución Industrial', descripcion: 'Las máquinas de vapor y las fábricas transforman la economía y la sociedad.' },
        { fechaTipo: 'anio', anio: 1914, titulo: 'Primera Guerra Mundial', descripcion: 'Estalla la Gran Guerra, el primer conflicto a escala mundial.' },
        { fechaTipo: 'anio', anio: 1929, titulo: 'Crac del 29', descripcion: 'El hundimiento de la Bolsa de Nueva York provoca la Gran Depresión.' },
        { fechaTipo: 'anio', anio: 1939, titulo: 'Segunda Guerra Mundial', descripcion: 'Comienza la guerra más mortífera de la historia.' },
        { fechaTipo: 'dia', anio: 1969, mes: 7, dia: 20, titulo: 'Llegada a la Luna', descripcion: 'La misión Apolo 11 lleva por primera vez al ser humano a la Luna.' },
        { fechaTipo: 'dia', anio: 1989, mes: 11, dia: 9, titulo: 'Caída del Muro de Berlín', descripcion: 'Cae el Muro de Berlín y se acerca el final de la Guerra Fría.' },
        { fechaTipo: 'dia', anio: 2001, mes: 9, dia: 11, titulo: 'Atentados del 11-S', descripcion: 'Los atentados contra las Torres Gemelas marcan el inicio del siglo XXI.' },
    ]),

    // 7 ── HISTORIA DEL SIGLO XX EN ESPAÑA ────────────────────────────────────
    linea('bib_espana_xx', 'Historia del siglo XX en España',
        'De la pérdida de las colonias a la entrada en Europa: un siglo decisivo para España.',
        'bib_espana_xx_3', 'Historia de España', true, [
        { fechaTipo: 'anio', anio: 1898, titulo: 'El Desastre del 98', descripcion: 'España pierde Cuba, Puerto Rico y Filipinas, sus últimas colonias.' },
        { fechaTipo: 'anio', anio: 1923, titulo: 'Dictadura de Primo de Rivera', descripcion: 'El general Primo de Rivera instaura una dictadura con el apoyo del rey.' },
        { fechaTipo: 'dia', anio: 1931, mes: 4, dia: 14, titulo: 'Segunda República', descripcion: 'Se proclama la Segunda República Española y el rey marcha al exilio.' },
        { fechaTipo: 'dia', anio: 1936, mes: 7, dia: 18, titulo: 'Guerra Civil', descripcion: 'Un golpe de Estado militar desencadena la Guerra Civil Española.' },
        { fechaTipo: 'dia', anio: 1975, mes: 11, dia: 20, titulo: 'Muerte de Franco', descripcion: 'Muere el dictador Francisco Franco; comienza la Transición.' },
        { fechaTipo: 'dia', anio: 1978, mes: 12, dia: 6, titulo: 'Constitución de 1978', descripcion: 'Los españoles aprueban en referéndum la Constitución que rige hoy.' },
        { fechaTipo: 'dia', anio: 1981, mes: 2, dia: 23, titulo: 'Golpe de Estado del 23-F', descripcion: 'Un intento de golpe de Estado fracasa y consolida la democracia.' },
        { fechaTipo: 'anio', anio: 1986, titulo: 'España entra en la CEE', descripcion: 'España ingresa en la Comunidad Económica Europea, hoy Unión Europea.' },
    ]),

    // 8 ── HISTORIA DE EUROPA ─────────────────────────────────────────────────
    linea('bib_europa', 'Historia de Europa',
        'Un recorrido por los momentos que han dado forma al continente europeo.',
        'bib_europa_8', 'Historia', true, [
        { fechaTipo: 'anio', anio: -27, titulo: 'Nace el Imperio Romano', descripcion: 'Augusto se convierte en el primer emperador; comienza la Pax Romana.' },
        { fechaTipo: 'anio', anio: 476, titulo: 'Caída de Roma', descripcion: 'El Imperio Romano de Occidente se desmorona y nace la Europa medieval.' },
        { fechaTipo: 'anio', anio: 800, titulo: 'Imperio de Carlomagno', descripcion: 'Carlomagno unifica buena parte de Europa occidental.' },
        { fechaTipo: 'anio', anio: 1453, titulo: 'Fin de la Edad Media', descripcion: 'La caída de Constantinopla y la imprenta abren paso al Renacimiento.' },
        { fechaTipo: 'anio', anio: 1789, titulo: 'Revolución Francesa', descripcion: 'Las ideas de libertad e igualdad se extienden por toda Europa.' },
        { fechaTipo: 'anio', anio: 1914, titulo: 'Primera Guerra Mundial', descripcion: 'Europa se sumerge en la Gran Guerra.' },
        { fechaTipo: 'anio', anio: 1957, titulo: 'Tratado de Roma', descripcion: 'Seis países firman el tratado que dará origen a la Unión Europea.' },
        { fechaTipo: 'anio', anio: 1993, titulo: 'Nace la Unión Europea', descripcion: 'El Tratado de Maastricht crea oficialmente la Unión Europea.' },
    ]),

    // 9 ── LA CARRERA ESPACIAL ────────────────────────────────────────────────
    linea('bib_espacio', 'La carrera espacial',
        'La conquista del espacio, desde el primer satélite hasta las misiones a Marte.',
        'bib_espacio_4', 'Ciencia y Tecnología', true, [
        { fechaTipo: 'dia', anio: 1957, mes: 10, dia: 4, titulo: 'Sputnik 1', descripcion: 'La URSS lanza el primer satélite artificial de la historia.' },
        { fechaTipo: 'dia', anio: 1961, mes: 4, dia: 12, titulo: 'Gagarin en el espacio', descripcion: 'Yuri Gagarin se convierte en el primer ser humano en orbitar la Tierra.' },
        { fechaTipo: 'dia', anio: 1969, mes: 7, dia: 20, titulo: 'Llegada a la Luna', descripcion: 'Neil Armstrong y Buzz Aldrin pisan la Luna en la misión Apolo 11.' },
        { fechaTipo: 'anio', anio: 1981, titulo: 'El transbordador espacial', descripcion: 'La NASA estrena el primer vehículo espacial reutilizable.' },
        { fechaTipo: 'anio', anio: 1990, titulo: 'Telescopio Hubble', descripcion: 'Se pone en órbita el telescopio que cambiaría nuestra visión del universo.' },
        { fechaTipo: 'anio', anio: 1998, titulo: 'Estación Espacial Internacional', descripcion: 'Comienza la construcción del mayor laboratorio en órbita.' },
        { fechaTipo: 'anio', anio: 2012, titulo: 'El rover Curiosity en Marte', descripcion: 'El robot Curiosity aterriza en Marte para estudiar el planeta rojo.' },
    ]),

    // 10 ── GRANDES INVENTOS ──────────────────────────────────────────────────
    linea('bib_inventos', 'Grandes inventos de la Humanidad',
        'Las invenciones que cambiaron para siempre la forma de vivir de las personas.',
        'bib_inventos_6', 'Ciencia y Tecnología', true, [
        { fechaTipo: 'anio', anio: -3500, titulo: 'La rueda', descripcion: 'En Mesopotamia se inventa la rueda, clave para el transporte y la alfarería.' },
        { fechaTipo: 'anio', anio: 1440, titulo: 'La imprenta', descripcion: 'Gutenberg revoluciona la difusión del conocimiento con los tipos móviles.' },
        { fechaTipo: 'anio', anio: 1769, titulo: 'La máquina de vapor', descripcion: 'James Watt perfecciona la máquina de vapor e impulsa la Revolución Industrial.' },
        { fechaTipo: 'anio', anio: 1876, titulo: 'El teléfono', descripcion: 'Graham Bell patenta el teléfono y acerca las comunicaciones a distancia.' },
        { fechaTipo: 'anio', anio: 1879, titulo: 'La bombilla eléctrica', descripcion: 'Edison desarrolla una bombilla incandescente duradera.' },
        { fechaTipo: 'dia', anio: 1903, mes: 12, dia: 17, titulo: 'El avión', descripcion: 'Los hermanos Wright realizan el primer vuelo a motor controlado.' },
        { fechaTipo: 'anio', anio: 1991, titulo: 'La World Wide Web', descripcion: 'Tim Berners-Lee publica la primera página web y nace la web tal como la conocemos.' },
        { fechaTipo: 'anio', anio: 2007, titulo: 'El smartphone', descripcion: 'El primer iPhone populariza el teléfono inteligente con pantalla táctil.' },
    ]),

];

export default BIBLIOTECA_LINEAS_TIEMPO;
