// Simulador de eclipse solar + modelo 3D orbital + cuestionario — pikt.es
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import earthTexUrl from '../assets/solar/earth.png';
import moonTexUrl from '../assets/solar/moon.png';

const PREGUNTAS = [
  // ---------- ASTRONOMÍA ----------
  {
    cat: 'Astronomía',
    q: '¿En qué fase lunar puede producirse un eclipse solar?',
    opts: ['Luna llena', 'Luna nueva', 'Cuarto creciente', 'Cuarto menguante'],
    ok: 1,
    exp: 'Solo en luna nueva la Luna se sitúa entre el Sol y la Tierra.'
  },
  {
    cat: 'Astronomía',
    q: '¿Por qué no hay un eclipse solar cada mes?',
    opts: [
      'Porque la órbita de la Luna está inclinada unos 5° respecto a la eclíptica',
      'Porque la Luna gira demasiado deprisa',
      'Porque el tamaño del Sol cambia',
      'Porque la Tierra se interpone'
    ],
    ok: 0,
    exp: 'Esa inclinación hace que la sombra pase casi siempre por encima o por debajo de la Tierra. Solo coinciden cerca de los nodos.'
  },
  {
    cat: 'Astronomía',
    q: '¿Cómo se llama la zona de sombra desde la que se ve el eclipse TOTAL?',
    opts: ['Penumbra', 'Antumbra', 'Umbra', 'Corona'],
    ok: 2,
    exp: 'En la umbra el disco solar queda cubierto por completo; en la penumbra el eclipse es solo parcial.'
  },
  {
    cat: 'Astronomía',
    q: '¿Cuál es la duración máxima aproximada de la totalidad?',
    opts: ['Unos 30 segundos', 'Unos 7 minutos y medio', 'Unos 25 minutos', 'Algo más de una hora'],
    ok: 1,
    exp: 'El máximo teórico ronda los 7 min 32 s. La mayoría de eclipses totales duran entre 2 y 4 minutos.'
  },
  {
    cat: 'Astronomía',
    q: 'Un eclipse ANULAR (anillo de fuego) se produce cuando…',
    opts: [
      'La Luna está cerca del apogeo y su disco parece más pequeño que el del Sol',
      'La Luna está más cerca que nunca de la Tierra',
      'El Sol está en su punto más lejano',
      'La Tierra se interpone entre el Sol y la Luna'
    ],
    ok: 0,
    exp: 'Al estar más lejos, la Luna se ve más pequeña y deja un anillo de Sol sin cubrir.'
  },
  {
    cat: 'Astronomía',
    q: 'El ciclo de Saros, que permite predecir eclipses, dura aproximadamente…',
    opts: ['1 año y 11 días', '18 años y 11 días', '76 años', '248 años'],
    ok: 1,
    exp: 'Tras 18 años, 11 días y 8 horas se repite una geometría Sol–Tierra–Luna muy parecida.'
  },
  {
    cat: 'Astronomía',
    q: 'La corona solar, visible durante la totalidad, alcanza temperaturas de…',
    opts: ['Unos 100 °C', 'Unos 5.500 °C', 'Más de un millón de grados', 'Unos 20 °C'],
    ok: 2,
    exp: 'Es mucho más caliente que la fotosfera (~5.500 °C). Explicarlo es el llamado problema del calentamiento coronal.'
  },
  {
    cat: 'Astronomía',
    q: 'Las "perlas de Baily", justo antes de la totalidad, se deben a…',
    opts: ['Nubes altas en la atmósfera terrestre', 'Montañas y valles del borde de la Luna', 'Manchas solares', 'Reflejos del telescopio'],
    ok: 1,
    exp: 'La luz del Sol se cuela entre el relieve lunar y forma puntos brillantes en el borde.'
  },

  // ---------- SEMEJANZA ----------
  {
    cat: 'Semejanza',
    q: 'El Sol es unas 400 veces mayor que la Luna y está unas 400 veces más lejos. ¿Qué consecuencia tiene?',
    opts: ['La Luna se ve el doble de grande', 'Ambos se ven con el mismo tamaño angular', 'El Sol se ve 400 veces mayor', 'No se pueden comparar'],
    ok: 1,
    exp: 'Es semejanza de triángulos: si multiplicas tamaño y distancia por el mismo factor, el ángulo no cambia.'
  },
  {
    cat: 'Semejanza',
    q: '¿Cuál es el tamaño angular aproximado del Sol y de la Luna vistos desde la Tierra?',
    opts: ['0,5 grados', '5 grados', '15 grados', '45 grados'],
    ok: 0,
    exp: 'Medio grado: más o menos el ancho de tu dedo meñique con el brazo estirado.'
  },
  {
    cat: 'Semejanza',
    q: 'Si dos figuras son semejantes con razón k, la razón entre sus áreas es…',
    opts: ['k', 'k²', 'k³', '2k'],
    ok: 1,
    exp: 'Las áreas escalan con el cuadrado de la razón de semejanza.'
  },
  {
    cat: 'Semejanza',
    q: 'Si dos cuerpos son semejantes con razón k, la razón entre sus volúmenes es…',
    opts: ['k', 'k²', 'k³', 'k⁴'],
    ok: 2,
    exp: 'Los volúmenes escalan con el cubo de la razón de semejanza.'
  },
  {
    cat: 'Semejanza',
    q: 'Si la Luna estuviera al doble de distancia (con su mismo tamaño real), su tamaño angular…',
    opts: ['Se duplicaría', 'No cambiaría', 'Se reduciría a la mitad', 'Se reduciría a la cuarta parte'],
    ok: 2,
    exp: 'El tamaño aparente es inversamente proporcional a la distancia. Ya no habría eclipses totales.'
  },
  {
    cat: 'Semejanza',
    q: 'En una maqueta donde el Sol es una pelota de 1 m, la Tierra sería una bolita de 9 mm situada a…',
    opts: ['1 metro', '10 metros', '107 metros', '1 kilómetro'],
    ok: 2,
    exp: 'A escala, el Sistema Solar es sobre todo espacio vacío.'
  },
  {
    cat: 'Semejanza',
    q: '¿Cuántas veces es mayor el radio de la Tierra que el de la Luna?',
    opts: ['1,5 veces', '3,7 veces', '9 veces', '50 veces'],
    ok: 1,
    exp: '6.371 km frente a 1.737 km.'
  },
  {
    cat: 'Semejanza',
    q: '¿A qué distancia del ojo hay que colocar un disco de 2 cm para que tape exactamente la Luna?',
    opts: ['A unos 20 cm', 'A unos 60 cm', 'A unos 2,3 m', 'A unos 11 m'],
    ok: 2,
    exp: '2 cm ÷ 0,00873 rad ≈ 2,3 m. Es el mismo truco de semejanza que hace posibles los eclipses.'
  },

  // ---------- VOLÚMENES Y ÁREAS ----------
  {
    cat: 'Volúmenes y áreas',
    q: '¿Cuántas Tierras cabrían dentro del Sol, en volumen?',
    opts: ['Unas 1.300', 'Unas 130.000', 'Unas 1.300.000', 'Unos 900 millones'],
    ok: 2,
    exp: 'El radio del Sol es 109 veces el terrestre, y 109³ ≈ 1,3 millones.'
  },
  {
    cat: 'Volúmenes y áreas',
    q: '¿Cuántas Lunas cabrían dentro de la Tierra, en volumen?',
    opts: ['Unas 4', 'Unas 50', 'Unas 500', 'Unas 5.000'],
    ok: 1,
    exp: '3,67³ ≈ 49.'
  },
  {
    cat: 'Volúmenes y áreas',
    q: 'La superficie total de la Tierra es aproximadamente…',
    opts: ['51 millones de km²', '510 millones de km²', '5.100 millones de km²', '51.000 millones de km²'],
    ok: 1,
    exp: 'A = 4πR², con R = 6.371 km.'
  },
  {
    cat: 'Volúmenes y áreas',
    q: 'La superficie de la Tierra es unas … veces la de la Luna.',
    opts: ['3,7', '13,5', '49', '109'],
    ok: 1,
    exp: 'Las áreas van con el cuadrado de la razón: 3,67² ≈ 13,5.'
  },
  {
    cat: 'Volúmenes y áreas',
    q: 'Si el radio de un planeta se duplica, su volumen se multiplica por…',
    opts: ['2', '4', '6', '8'],
    ok: 3,
    exp: 'V = (4/3)πr³, así que al duplicar r el volumen se multiplica por 2³ = 8.'
  },
  {
    cat: 'Volúmenes y áreas',
    q: 'Con r = 1.737 km, el volumen de la Luna es aproximadamente…',
    opts: ['2,2 × 10⁷ km³', '2,2 × 10¹⁰ km³', '2,2 × 10¹⁵ km³', '2,2 × 10²⁰ km³'],
    ok: 1,
    exp: 'V = (4/3)π · 1.737³ ≈ 2,2 × 10¹⁰ km³.'
  },
  {
    cat: 'Volúmenes y áreas',
    q: '¿Cuántas veces es mayor el radio del Sol que el de la Tierra?',
    opts: ['Unas 11 veces', 'Unas 109 veces', 'Unas 400 veces', 'Unas 1.300 veces'],
    ok: 1,
    exp: '696.000 km frente a 6.371 km.'
  },
  {
    cat: 'Volúmenes y áreas',
    q: 'La masa del Sol equivale aproximadamente a…',
    opts: ['3.300 Tierras', '33.000 Tierras', '333.000 Tierras', '3.300.000 Tierras'],
    ok: 2,
    exp: 'El Sol concentra el 99,8 % de la masa de todo el Sistema Solar.'
  },

  // ---------- LUZ Y DISTANCIAS ----------
  {
    cat: 'Luz y distancias',
    q: '¿Cuánto tarda la luz del Sol en llegar a la Tierra?',
    opts: ['8 segundos', '8 minutos y 20 segundos', '8 horas', '1,3 segundos'],
    ok: 1,
    exp: '150 millones de km ÷ 300.000 km/s ≈ 500 s.'
  },
  {
    cat: 'Luz y distancias',
    q: '¿Cuánto tarda la luz en recorrer la distancia Tierra–Luna?',
    opts: ['0,001 s', '1,3 s', '13 s', '2 minutos'],
    ok: 1,
    exp: '384.400 km ÷ 300.000 km/s ≈ 1,28 s.'
  },
  {
    cat: 'Luz y distancias',
    q: 'La velocidad de la luz en el vacío es de aproximadamente…',
    opts: ['300 km/s', '3.000 km/s', '30.000 km/s', '300.000 km/s'],
    ok: 3,
    exp: 'Con más precisión, 299.792,458 km/s.'
  },
  {
    cat: 'Luz y distancias',
    q: 'La distancia media entre la Tierra y la Luna es de unos…',
    opts: ['38.440 km', '384.400 km', '3.844.000 km', '38.440.000 km'],
    ok: 1,
    exp: 'Unas 30 veces el diámetro de la Tierra.'
  },
  {
    cat: 'Luz y distancias',
    q: '¿Cuántas vueltas a la Tierra daría la luz en un segundo?',
    opts: ['Media vuelta', '7,5 vueltas', '100 vueltas', '1.000 vueltas'],
    ok: 1,
    exp: 'El ecuador mide 40.075 km y la luz recorre 300.000 km cada segundo.'
  },
  {
    cat: 'Luz y distancias',
    q: 'Si el Sol dejara de brillar de golpe, ¿cuándo lo notaríamos en la Tierra?',
    opts: ['Al instante', 'Unos 8 minutos después', 'Una hora después', 'Un día después'],
    ok: 1,
    exp: 'Siempre vemos el Sol tal como era hace unos 8 minutos.'
  }
];

// =====================================================================
//  MODELO 3D ORBITAL  ·  Sol – Tierra – Luna
//  Tamaños y distancias EXAGERADOS para poder ver la geometría.
//  La inclinación de la órbita lunar (~5°) es la clave: por eso no hay
//  eclipse cada mes, solo cuando la Luna cruza un nodo alineada con el Sol.
// =====================================================================
const Escena3D = ({ movil }) => {
  const contRef = useRef(null);
  // Valores "en vivo" que lee el bucle de animación sin re-montar la escena
  const ctrl = useRef({
    playing: true,
    velocidad: 1,
    verConos: true,
    verOrbitas: true,
    seguirTierra: false,
    earthAngle: 0.35,   // ángulo orbital de la Tierra (rad)
    moonAngle: 2.1,     // ángulo orbital de la Luna (rad)
    manual: null        // {tipo:'earth'|'moon', valor} cuando se arrastra un slider
  });
  const estadoRef = useRef(null);   // div de estado (texto) actualizado por el bucle
  const apiRef = useRef({});        // funciones expuestas a los botones de React
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const cont = contRef.current;
    if (!cont) return;

    // ------------------------------------------------------- constantes escena
    const INCL = THREE.MathUtils.degToRad(15);   // inclinación exagerada (real ~5,14°)
    const SUN_R = 24;
    const EARTH_R = 6;
    const MOON_R = 1.7;
    const EARTH_DIST = 210;
    const MOON_DIST = 34;
    const RATIO = 13.37;                          // órbitas lunares por vuelta terrestre
    const OMEGA_E = (2 * Math.PI) / 42;           // 1 año ≈ 42 s a velocidad 1

    // ------------------------------------------------------- renderer / escena
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(cont.clientWidth, cont.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    cont.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070f);

    const camera = new THREE.PerspectiveCamera(45, cont.clientWidth / cont.clientHeight, 0.1, 5000);
    camera.position.set(120, 130, 320);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 40;
    controls.maxDistance = 900;

    // ------------------------------------------------------- luces
    scene.add(new THREE.AmbientLight(0x223044, 0.35));
    const sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0.0);
    scene.add(sunLight); // en el Sol (origen)

    // ------------------------------------------------------- estrellas de fondo
    const starGeo = new THREE.BufferGeometry();
    const starN = 1400, starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 1800 + Math.random() * 1200;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.cos(ph);
      starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false })));

    // ------------------------------------------------------- Sol
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_R, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0xfff2c4 })
    );
    scene.add(sun);

    // halo del Sol (sprite con gradiente radial)
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const gx = glowCanvas.getContext('2d');
    const grad = gx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,240,190,0.95)');
    grad.addColorStop(0.25, 'rgba(255,190,90,0.55)');
    grad.addColorStop(0.55, 'rgba(255,140,40,0.18)');
    grad.addColorStop(1, 'rgba(255,120,0,0)');
    gx.fillStyle = grad;
    gx.fillRect(0, 0, 256, 256);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(SUN_R * 6);
    scene.add(glow);

    // ------------------------------------------------------- texturas
    const loader = new THREE.TextureLoader();
    const earthTex = loader.load(earthTexUrl); earthTex.colorSpace = THREE.SRGBColorSpace;
    const moonTex = loader.load(moonTexUrl);  moonTex.colorSpace = THREE.SRGBColorSpace;

    // ------------------------------------------------------- Tierra
    const earthSystem = new THREE.Group();        // se traslada por la órbita; orientación fija en el mundo
    scene.add(earthSystem);

    const earthTilt = new THREE.Group();          // inclinación del eje 23,5°
    earthTilt.rotation.z = THREE.MathUtils.degToRad(23.5);
    earthSystem.add(earthTilt);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 64, 64),
      new THREE.MeshStandardMaterial({ map: earthTex, roughness: 1, metalness: 0 })
    );
    earthTilt.add(earth);

    // ------------------------------------------------------- órbita lunar (plano inclinado)
    const moonPlane = new THREE.Group();          // plano orbital de la Luna, inclinado; nodos sobre eje X
    moonPlane.rotation.x = INCL;
    earthSystem.add(moonPlane);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_R, 48, 48),
      new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, metalness: 0 })
    );
    moonPlane.add(moon);

    // línea de nodos (donde el plano lunar corta la eclíptica)
    const nodosGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-MOON_DIST * 1.5, 0, 0), new THREE.Vector3(MOON_DIST * 1.5, 0, 0)
    ]);
    const lineaNodos = new THREE.Line(nodosGeo, new THREE.LineBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.5 }));
    moonPlane.add(lineaNodos);

    // círculo de la órbita lunar
    const moonOrbitPts = [];
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; moonOrbitPts.push(new THREE.Vector3(Math.cos(a) * MOON_DIST, 0, Math.sin(a) * MOON_DIST)); }
    const moonOrbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(moonOrbitPts), new THREE.LineBasicMaterial({ color: 0x9aa7c7, transparent: true, opacity: 0.45 }));
    moonPlane.add(moonOrbitLine);

    // ------------------------------------------------------- órbita terrestre
    const earthOrbitPts = [];
    for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; earthOrbitPts.push(new THREE.Vector3(Math.cos(a) * EARTH_DIST, 0, Math.sin(a) * EARTH_DIST)); }
    const earthOrbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(earthOrbitPts), new THREE.LineBasicMaterial({ color: 0x3a4a6a, transparent: true, opacity: 0.6 }));
    scene.add(earthOrbitLine);

    // ------------------------------------------------------- conos de sombra
    const conoMat = () => new THREE.MeshBasicMaterial({ color: 0x0a0a12, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    // Cono de la Luna (umbra que puede tocar la Tierra → eclipse solar)
    const moonConeLen = MOON_DIST * 2.4;
    const moonCone = new THREE.Mesh(new THREE.ConeGeometry(MOON_R * 1.05, moonConeLen, 40, 1, true), conoMat());
    scene.add(moonCone);
    // Cono de la Tierra (donde cae la Luna → eclipse lunar)
    const earthConeLen = MOON_DIST * 2.4;
    const earthCone = new THREE.Mesh(new THREE.ConeGeometry(EARTH_R * 1.05, earthConeLen, 44, 1, true), conoMat());
    scene.add(earthCone);

    // Coloca un cono de sombra que parte de `origen`, radio `radio`, apuntando en anti-Sol
    const tmpDir = new THREE.Vector3();
    const ejeY = new THREE.Vector3(0, 1, 0);
    const colocaCono = (cono, origen, len) => {
      tmpDir.copy(origen).sub(sun.position).normalize(); // dirección Sol→cuerpo (anti-Sol)
      cono.position.copy(origen).addScaledVector(tmpDir, len / 2);
      // Base ancha (radio del cuerpo) sobre el cuerpo; vértice (punta de la umbra) alejándose del Sol.
      cono.quaternion.setFromUnitVectors(ejeY, tmpDir);
    };

    // ------------------------------------------------------- posiciones mundo (reutilizadas)
    const earthWorld = new THREE.Vector3();
    const moonWorld = new THREE.Vector3();
    const sunWorld = new THREE.Vector3(0, 0, 0);
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();

    // Distancia perpendicular del punto P a la recta A + t·d (d unitario)
    const distARecta = (P, A, d) => {
      vA.copy(P).sub(A);
      const t = vA.dot(d);
      vB.copy(A).addScaledVector(d, t);
      return { dist: vC.copy(P).sub(vB).length(), t };
    };

    // ------------------------------------------------------- API para botones
    apiRef.current = {
      setEclipseSolar: () => { ctrl.current.playing = false; ctrl.current.earthAngle = 0; ctrl.current.moonAngle = Math.PI; sync(); },
      setEclipseLunar: () => { ctrl.current.playing = false; ctrl.current.earthAngle = 0; ctrl.current.moonAngle = 0; sync(); },
      resetVista: () => { camera.position.set(120, 130, 320); controls.target.set(0, 0, 0); }
    };
    const sync = () => forceUpdate(n => n + 1);

    // ------------------------------------------------------- bucle
    const clock = new THREE.Clock();
    let raf;
    const targetCam = new THREE.Vector3();
    const animar = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const c = ctrl.current;
      if (c.playing) {
        c.earthAngle += dt * OMEGA_E * c.velocidad;
        c.moonAngle += dt * OMEGA_E * RATIO * c.velocidad;
      }
      // posición de la Tierra en su órbita
      earthSystem.position.set(Math.cos(c.earthAngle) * EARTH_DIST, 0, Math.sin(c.earthAngle) * EARTH_DIST);
      // rotaciones propias (visual)
      earth.rotation.y += dt * 0.5 * (c.playing ? c.velocidad : 0) + 0;
      // Luna en su plano inclinado
      moon.position.set(Math.cos(c.moonAngle) * MOON_DIST, 0, Math.sin(c.moonAngle) * MOON_DIST);
      moon.rotation.y = -c.moonAngle; // cara fija hacia la Tierra (aprox.)

      // mundo
      earthSystem.updateMatrixWorld();
      earth.getWorldPosition(earthWorld);
      moon.getWorldPosition(moonWorld);
      sun.getWorldPosition(sunWorld);

      // conos de sombra
      moonCone.visible = earthCone.visible = c.verConos;
      if (c.verConos) { colocaCono(moonCone, moonWorld, moonConeLen); colocaCono(earthCone, earthWorld, earthConeLen); }
      lineaNodos.visible = moonOrbitLine.visible = earthOrbitLine.visible = c.verOrbitas;

      // ---- detección de eclipse ----
      // Sol→Luna
      vC.copy(moonWorld).sub(sunWorld);
      const dSunMoon = vC.length();
      const dirSM = vC.clone().normalize();
      const solar = distARecta(earthWorld, sunWorld, dirSM);
      const moonEntre = dSunMoon < earthWorld.distanceTo(sunWorld);
      const esSolar = moonEntre && solar.dist < EARTH_R * 1.35;

      // Sol→Tierra (para eclipse lunar)
      vC.copy(earthWorld).sub(sunWorld);
      const dirSE = vC.clone().normalize();
      const lunar = distARecta(moonWorld, sunWorld, dirSE);
      const lunaDetras = moonWorld.distanceTo(sunWorld) > earthWorld.distanceTo(sunWorld);
      const esLunar = lunaDetras && lunar.dist < EARTH_R * 1.0;

      // resaltar
      moonCone.material.opacity = esSolar ? 0.5 : 0.24;
      moonCone.material.color.setHex(esSolar ? 0x1a1030 : 0x0a0a12);
      earthCone.material.color.setHex(esLunar ? 0x2a0a0a : 0x0a0a12);

      if (estadoRef.current) {
        let tipo, txt, color;
        if (esSolar) { tipo = '☀️ ECLIPSE SOLAR'; color = '#fbbf24'; txt = 'La Luna está entre el Sol y la Tierra: su sombra (umbra) toca la superficie terrestre.'; }
        else if (esLunar) { tipo = '🌑 ECLIPSE LUNAR'; color = '#f87171'; txt = 'La Tierra está entre el Sol y la Luna: la Luna entra en la sombra terrestre.'; }
        else {
          const cerca = solar.dist < EARTH_R * 4 && moonEntre;
          tipo = 'SIN ECLIPSE'; color = '#94a3b8';
          txt = cerca
            ? 'Luna nueva, pero su sombra pasa por encima o por debajo de la Tierra: falta cruzar el nodo. Por eso NO hay eclipse cada mes.'
            : 'La Luna orbita en un plano inclinado ~5°. Solo cerca de los nodos puede alinearse con el Sol y la Tierra.';
        }
        estadoRef.current.innerHTML = `<span style="color:${color};font-weight:800">${tipo}</span><br><span style="opacity:.8">${txt}</span>`;
      }

      // cámara: seguir a la Tierra
      if (c.seguirTierra) { targetCam.lerp(earthWorld, 0.08); }
      else { targetCam.lerp(sunWorld, 0.08); }
      controls.target.copy(targetCam);

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);

    // ------------------------------------------------------- resize
    const onResize = () => {
      if (!cont.clientWidth) return;
      camera.aspect = cont.clientWidth / cont.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(cont.clientWidth, cont.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(cont);

    // ------------------------------------------------------- limpieza
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => x.dispose()); } });
      earthTex.dispose(); moonTex.dispose(); glowTex.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  // ------------------------------------------------------- UI (React) sobre el lienzo
  const [ui, setUi] = useState({ playing: true, velocidad: 1, verConos: true, verOrbitas: true, seguirTierra: false });
  const [showOpc, setShowOpc] = useState(false); // desplegable de opciones en móvil
  const set = (patch) => { setUi(u => { const n = { ...u, ...patch }; Object.assign(ctrl.current, n); return n; }); };

  const chip = (activo, color) => ({
    background: activo ? color : 'rgba(255,255,255,.08)',
    color: activo ? '#0b1020' : '#e2e8f0',
    border: '1px solid rgba(255,255,255,.16)', borderRadius: 10,
    padding: movil ? '9px 11px' : '9px 14px', fontSize: movil ? 12 : 13, fontWeight: 700, cursor: 'pointer'
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Estado / detección de eclipse */}
      <div ref={estadoRef} style={{
        position: 'absolute', top: movil ? 8 : 14, left: '50%', transform: 'translateX(-50%)',
        width: movil ? '92%' : 'min(560px, 80%)', textAlign: 'center', pointerEvents: 'none',
        background: 'rgba(9,14,30,.6)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(6px)',
        borderRadius: 12, padding: movil ? '9px 12px' : '11px 16px', color: '#f1f5f9',
        fontSize: movil ? 12 : 14, lineHeight: 1.45
      }} />

      {/* Panel de controles */}
      {movil ? (
        // ---- Móvil: fila principal compacta + opciones desplegables ----
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center', width: '96%', maxWidth: '96%' }}>
          {showOpc && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', alignItems: 'center', width: '100%', boxSizing: 'border-box', background: 'rgba(9,14,30,.72)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: 9 }}>
              <button style={chip(ui.verConos, '#a78bfa')} onClick={() => set({ verConos: !ui.verConos })}>Sombras</button>
              <button style={chip(ui.verOrbitas, '#38bdf8')} onClick={() => set({ verOrbitas: !ui.verOrbitas })}>Órbitas</button>
              <button style={chip(ui.seguirTierra, '#34d399')} onClick={() => set({ seguirTierra: !ui.seguirTierra })}>{ui.seguirTierra ? '🎯 Tierra' : '☀️ Sol'}</button>
              <button style={chip(false, '#fff')} onClick={() => { apiRef.current.setEclipseSolar?.(); setUi(u => ({ ...u, playing: false })); }}>☀️ Solar</button>
              <button style={chip(false, '#fff')} onClick={() => { apiRef.current.setEclipseLunar?.(); setUi(u => ({ ...u, playing: false })); }}>🌑 Lunar</button>
              <button style={chip(false, '#fff')} onClick={() => apiRef.current.resetVista?.()}>⟳ Centrar</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, justifyContent: 'center', alignItems: 'center', background: 'rgba(9,14,30,.72)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '8px 10px' }}>
            <button style={{ ...chip(ui.playing, '#10b981'), whiteSpace: 'nowrap' }} onClick={() => set({ playing: !ui.playing })}>{ui.playing ? '⏸' : '▶'}</button>
            {[0.5, 1, 2, 4].map(v => (<button key={v} style={{ ...chip(ui.velocidad === v, '#fbbf24'), padding: '8px 7px', minWidth: 34 }} onClick={() => set({ velocidad: v })}>×{v}</button>))}
            <button style={chip(showOpc, '#6366f1')} onClick={() => setShowOpc(o => !o)}>⚙️ {showOpc ? '▴' : '▾'}</button>
          </div>
        </div>
      ) : (
        // ---- Escritorio: una sola fila ----
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center', maxWidth: '96%',
          background: 'rgba(9,14,30,.62)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '12px 16px'
        }}>
          <button style={chip(ui.playing, '#10b981')} onClick={() => set({ playing: !ui.playing })}>{ui.playing ? '⏸ Pausar' : '▶ Reproducir'}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
            <span style={{ opacity: .7 }}>Velocidad</span>
            {[0.5, 1, 2, 4].map(v => (<button key={v} style={{ ...chip(ui.velocidad === v, '#fbbf24'), padding: '7px 9px', minWidth: 40 }} onClick={() => set({ velocidad: v })}>×{v}</button>))}
          </div>
          <button style={chip(ui.verConos, '#a78bfa')} onClick={() => set({ verConos: !ui.verConos })}>Sombras</button>
          <button style={chip(ui.verOrbitas, '#38bdf8')} onClick={() => set({ verOrbitas: !ui.verOrbitas })}>Órbitas</button>
          <button style={chip(ui.seguirTierra, '#34d399')} onClick={() => set({ seguirTierra: !ui.seguirTierra })}>{ui.seguirTierra ? '🎯 Tierra' : '☀️ Sol'}</button>
          <button style={chip(false, '#fff')} onClick={() => { apiRef.current.setEclipseSolar?.(); setUi(u => ({ ...u, playing: false })); }}>Alinear ☀️ solar</button>
          <button style={chip(false, '#fff')} onClick={() => { apiRef.current.setEclipseLunar?.(); setUi(u => ({ ...u, playing: false })); }}>Alinear 🌑 lunar</button>
          <button style={chip(false, '#fff')} onClick={() => apiRef.current.resetVista?.()}>Centrar vista</button>
        </div>
      )}

      {/* Ayuda de escala (solo escritorio; en móvil se omite para no tapar el estado) */}
      {!movil && (
        <div style={{
          position: 'absolute', top: 14, right: 14, maxWidth: 200,
          background: 'rgba(9,14,30,.5)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10,
          padding: '7px 10px', color: '#cbd5e1', fontSize: 11, lineHeight: 1.4, pointerEvents: 'none'
        }}>
          🔍 Tamaños y distancias exagerados. Arrastra para girar · rueda para acercar.
        </div>
      )}
    </div>
  );
};

const App = () => {
  // ---------------------------------------------------------------- estado
  const [pantalla, setPantalla] = useState('sim'); // 'sim' | '3d' | 'quiz'
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [distLunar, setDistLunar] = useState(20); // 0 = perigeo, 100 = apogeo
  const [alineacion, setAlineacion] = useState(0); // -100..100 (desviación norte/sur)
  const [win, setWin] = useState({ w: window.innerWidth, h: window.innerHeight });

  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const velRef = useRef(1);

  useEffect(() => { velRef.current = velocidad; }, [velocidad]);

  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Bucle de animación con refs (evita cierres obsoletos y efectos dentro del setState)
  useEffect(() => {
    if (!isPlaying || pantalla !== 'sim') { lastRef.current = null; return; }
    const paso = (t) => {
      if (lastRef.current == null) lastRef.current = t;
      const dt = t - lastRef.current;
      lastRef.current = t;
      setProgress((p) => Math.min(100, p + dt * 0.0035 * velRef.current));
      rafRef.current = requestAnimationFrame(paso);
    };
    rafRef.current = requestAnimationFrame(paso);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [isPlaying, pantalla]);

  useEffect(() => {
    if (progress >= 100 && isPlaying) setIsPlaying(false);
  }, [progress, isPlaying]);

  // Atajos de teclado: espacio = reproducir/pausar, flechas = avanzar
  useEffect(() => {
    const onKey = (e) => {
      if (pantalla !== 'sim') return;
      if (e.code === 'Space') { e.preventDefault(); alternarPlay(); }
      if (e.code === 'ArrowRight') { setIsPlaying(false); setProgress((p) => Math.min(100, p + 0.5)); }
      if (e.code === 'ArrowLeft') { setIsPlaying(false); setProgress((p) => Math.max(0, p - 0.5)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pantalla, isPlaying, progress]);

  const alternarPlay = () => {
    if (!isPlaying && progress >= 100) setProgress(0);
    setIsPlaying((v) => !v);
  };

  const reiniciar = () => { setProgress(0); setIsPlaying(false); };

  // Estrellas de fondo (se generan una sola vez)
  const [estrellas] = useState(() =>
    Array.from({ length: 110 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 78,
      s: Math.random() * 1.8 + 0.6,
      d: (Math.random() * 4).toFixed(2)
    }))
  );

  // ------------------------------------------------------------- geometría
  const movil = win.w < 820;
  const escena = movil ? Math.min(win.w * 0.88, 380) : Math.min(win.h * 0.5, win.w * 0.42, 460);
  const Dsol = escena * 0.42;
  const R = Dsol / 2;                                  // radio aparente del Sol
  const razonLuna = 1.06 - (distLunar / 100) * 0.14;   // 1,06 (perigeo) → 0,92 (apogeo)
  const rL = R * razonLuna;                            // radio aparente de la Luna
  const distanciaKm = Math.round(356500 + (distLunar / 100) * (406700 - 356500));

  const solCx = escena / 2;
  const solCy = escena / 2;
  const recorrido = escena + 2 * rL;
  const lunaCx = -rL + (progress / 100) * recorrido;
  const lunaCy = solCy + (alineacion / 100) * (R + rL) * 1.15;

  const dx = lunaCx - solCx;
  const dy = lunaCy - solCy;
  const d = Math.sqrt(dx * dx + dy * dy);

  // Área de intersección de dos círculos de radios distintos
  let areaCubierta = 0;
  if (d >= R + rL) areaCubierta = 0;
  else if (d <= Math.abs(R - rL)) areaCubierta = Math.PI * Math.pow(Math.min(R, rL), 2);
  else {
    areaCubierta =
      rL * rL * Math.acos((d * d + rL * rL - R * R) / (2 * d * rL)) +
      R * R * Math.acos((d * d + R * R - rL * rL) / (2 * d * R)) -
      0.5 * Math.sqrt((-d + rL + R) * (d + rL - R) * (d - rL + R) * (d + rL + R));
  }
  const ocultacion = Math.max(0, Math.min(100, (areaCubierta / (Math.PI * R * R)) * 100));
  const oc = Math.round(ocultacion);

  const esTotal = d + R <= rL;
  const esAnular = d + rL <= R && !esTotal;
  const entrando = dx < 0;

  let tipo = 'SIN ECLIPSE';
  if (esTotal) tipo = 'TOTAL';
  else if (esAnular) tipo = 'ANULAR';
  else if (oc > 0) tipo = 'PARCIAL';

  let fase = 'Antes del primer contacto (C1)';
  if (esTotal) fase = 'Totalidad — entre C2 y C3';
  else if (esAnular) fase = 'Anularidad — anillo de fuego';
  else if (oc > 0) fase = entrando ? 'Parcialidad creciente' : 'Parcialidad decreciente';
  else if (!entrando) fase = 'Eclipse terminado (C4)';

  // Oscurecimiento del cielo: solo cae de verdad en los últimos porcentajes
  const oscuridad = Math.pow(ocultacion / 100, 4.5);
  const L = 68 - oscuridad * 64;
  const cieloAlto = `hsl(216, 80%, ${Math.max(3, L * 0.55)}%)`;
  const cieloBajo = `hsl(203, 78%, ${Math.max(6, L)}%)`;

  const anilloDiamante = !esTotal && !esAnular && ocultacion > 96.5;
  const bordeSol = esTotal || esAnular
    ? '0 0 0 0 rgba(0,0,0,0)'
    : anilloDiamante
      ? '0 0 30px 8px rgba(255,255,255,.85), 0 0 90px 30px rgba(251,191,36,.55)'
      : `0 0 ${30 + 20 * (1 - oscuridad)}px ${10}px rgba(250,204,21,.75), 0 0 90px 26px rgba(249,115,22,.45)`;

  // Reloj de simulación: la pasada completa equivale a ~150 min reales
  const minutos = (progress - 50) * 1.5;
  const signo = minutos < 0 ? '−' : '+';
  const relojTxt = `${signo}${String(Math.floor(Math.abs(minutos))).padStart(2, '0')}:${String(Math.floor((Math.abs(minutos) % 1) * 60)).padStart(2, '0')}`;
  const temperatura = (23 - 6.5 * Math.pow(ocultacion / 100, 5)).toFixed(1);

  // ------------------------------------------------------------ cuestionario
  const [quizEstado, setQuizEstado] = useState('inicio'); // 'inicio' | 'jugando' | 'fin'
  const [ronda, setRonda] = useState([]);
  const [indice, setIndice] = useState(0);
  const [elegida, setElegida] = useState(null);
  const [respuestas, setRespuestas] = useState([]);

  const barajar = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };

  const nuevaRonda = () => {
    const seleccion = barajar(PREGUNTAS).slice(0, 10).map((p) => {
      const pares = barajar(p.opts.map((texto, i) => ({ texto, correcta: i === p.ok })));
      return { cat: p.cat, q: p.q, exp: p.exp, opts: pares.map((x) => x.texto), ok: pares.findIndex((x) => x.correcta) };
    });
    setRonda(seleccion);
    setIndice(0);
    setElegida(null);
    setRespuestas([]);
    setQuizEstado('jugando');
  };

  const responder = (i) => {
    if (elegida !== null) return;
    setElegida(i);
    setRespuestas((r) => r.concat([{ i: indice, elegida: i, acierto: i === ronda[indice].ok }]));
  };

  const siguiente = () => {
    if (indice + 1 >= ronda.length) setQuizEstado('fin');
    else { setIndice(indice + 1); setElegida(null); }
  };

  const aciertos = respuestas.filter((r) => r.acierto).length;

  // ------------------------------------------------------------------ estilo
  const colorCat = {
    'Astronomía': '#a78bfa',
    'Semejanza': '#38bdf8',
    'Volúmenes y áreas': '#fbbf24',
    'Luz y distancias': '#34d399'
  };

  const panel = {
    background: 'rgba(9, 14, 30, 0.62)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '16px',
    backdropFilter: 'blur(8px)',
    color: '#f1f5f9'
  };

  const microLabel = {
    fontSize: movil ? '11px' : '12px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    opacity: 0.65,
    fontWeight: 700
  };

  const mono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const sans = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

  const botonBase = {
    fontFamily: sans,
    fontWeight: 700,
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#f8fafc',
    padding: movil ? '13px 18px' : '11px 22px',
    fontSize: movil ? '15px' : '16px',
    transition: 'transform .1s ease, background-color .2s ease'
  };

  const estilosGlobales = `
    @keyframes titila { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
    @keyframes latido { 0%,100% { transform: translate(-50%,-50%) scale(1) } 50% { transform: translate(-50%,-50%) scale(1.045) } }
    .ec-range { -webkit-appearance: none; appearance: none; width: 100%; height: 26px; background: transparent; cursor: pointer; }
    .ec-range::-webkit-slider-runnable-track { height: 10px; border-radius: 999px; background: rgba(255,255,255,.22); }
    .ec-range::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; margin-top: -8px; border-radius: 50%; background: #fbbf24; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
    .ec-range::-moz-range-track { height: 10px; border-radius: 999px; background: rgba(255,255,255,.22); }
    .ec-range::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; background: #fbbf24; border: 2px solid #fff; }
    .ec-range:focus-visible::-webkit-slider-thumb { outline: 3px solid #38bdf8; }
    .ec-btn:focus-visible, .ec-opt:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `;

  // ------------------------------------------------------------- navegación
  const NavSuperior = () => (
    <div style={{ display: 'flex', gap: movil ? '6px' : '8px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      {[{ id: 'sim', txt: 'Vista desde la Tierra', txtM: '🌍 Tierra' }, { id: '3d', txt: 'Modelo 3D', txtM: '🌐 3D' }, { id: 'quiz', txt: 'Cuestionario', txtM: '❓ Test' }].map((t) => (
        <button
          key={t.id}
          className="ec-btn"
          onClick={() => { setPantalla(t.id); setIsPlaying(false); }}
          style={{
            ...botonBase,
            padding: movil ? '8px 12px' : '8px 18px',
            fontSize: movil ? '13px' : '14px',
            backgroundColor: pantalla === t.id ? 'rgba(251,191,36,.92)' : 'rgba(15,23,42,.55)',
            color: pantalla === t.id ? '#1c1917' : '#e2e8f0'
          }}
        >
          {movil ? t.txtM : t.txt}
        </button>
      ))}
    </div>
  );

  // =================================================================== QUIZ
  if (pantalla === 'quiz') {
    const p = ronda[indice];
    return (
      <div style={{
        minHeight: '100vh', width: '100%', boxSizing: 'border-box',
        background: 'radial-gradient(120% 90% at 50% 0%, #16204a 0%, #070b18 60%, #04060f 100%)',
        color: '#f1f5f9', fontFamily: sans, padding: movil ? '16px' : '32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px'
      }}>
        <style>{estilosGlobales}</style>
        <NavSuperior />

        {quizEstado === 'inicio' && (
          <div style={{ ...panel, padding: movil ? '24px' : '38px', maxWidth: '680px', width: '100%', textAlign: 'center' }}>
            <div style={microLabel}>10 preguntas de un banco de 30</div>
            <h1 style={{ fontSize: movil ? '30px' : '42px', margin: '10px 0 12px', letterSpacing: '-0.02em' }}>
              Cuestionario del eclipse
            </h1>
            <p style={{ opacity: 0.8, lineHeight: 1.6, margin: '0 0 22px' }}>
              Cada partida sortea diez preguntas distintas y baraja también las opciones. Tras cada respuesta verás la explicación.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '26px' }}>
              {Object.keys(colorCat).map((c) => (
                <span key={c} style={{
                  fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px',
                  border: `1px solid ${colorCat[c]}`, color: colorCat[c]
                }}>{c}</span>
              ))}
            </div>
            <button className="ec-btn" onClick={nuevaRonda} style={{ ...botonBase, backgroundColor: '#fbbf24', color: '#1c1917', fontSize: '18px', padding: '15px 34px' }}>
              Empezar el cuestionario
            </button>
          </div>
        )}

        {quizEstado === 'jugando' && p && (
          <div style={{ maxWidth: '760px', width: '100%' }}>
            {/* progreso */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
              <span style={{ ...microLabel, fontFamily: mono, opacity: 0.9 }}>{indice + 1} / {ronda.length}</span>
              <div style={{ flexGrow: 1, height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,.15)' }}>
                <div style={{
                  width: `${((indice + (elegida !== null ? 1 : 0)) / ronda.length) * 100}%`,
                  height: '100%', borderRadius: '999px', background: '#fbbf24', transition: 'width .3s ease'
                }} />
              </div>
              <span style={{ ...microLabel, fontFamily: mono, opacity: 0.9 }}>{aciertos} ✓</span>
            </div>

            <div style={{ ...panel, padding: movil ? '20px' : '30px' }}>
              <span style={{
                fontSize: '12px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                color: colorCat[p.cat], border: `1px solid ${colorCat[p.cat]}`, padding: '4px 10px', borderRadius: '999px'
              }}>{p.cat}</span>

              <h2 style={{ fontSize: movil ? '21px' : '26px', lineHeight: 1.35, margin: '16px 0 22px', fontWeight: 700 }}>
                {p.q}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {p.opts.map((o, i) => {
                  const revelado = elegida !== null;
                  const correcta = i === p.ok;
                  const fallada = revelado && i === elegida && !correcta;
                  return (
                    <button
                      key={i}
                      className="ec-opt"
                      onClick={() => responder(i)}
                      disabled={revelado}
                      style={{
                        textAlign: 'left', padding: '14px 16px', borderRadius: '12px', cursor: revelado ? 'default' : 'pointer',
                        fontFamily: sans, fontSize: movil ? '15px' : '16px', lineHeight: 1.4, fontWeight: 600,
                        color: '#f8fafc', display: 'flex', gap: '12px', alignItems: 'center',
                        background: revelado && correcta ? 'rgba(52,211,153,.22)' : fallada ? 'rgba(248,113,113,.20)' : 'rgba(255,255,255,.06)',
                        border: `1px solid ${revelado && correcta ? '#34d399' : fallada ? '#f87171' : 'rgba(255,255,255,.16)'}`,
                        transition: 'background-color .2s ease'
                      }}
                    >
                      <span style={{
                        fontFamily: mono, fontWeight: 800, opacity: .7, minWidth: '18px'
                      }}>{'ABCD'[i]}</span>
                      <span style={{ flexGrow: 1 }}>{o}</span>
                      {revelado && correcta && <span>✓</span>}
                      {fallada && <span>✕</span>}
                    </button>
                  );
                })}
              </div>

              {elegida !== null && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{
                    padding: '14px 16px', borderRadius: '12px', lineHeight: 1.55,
                    background: 'rgba(56,189,248,.10)', border: '1px solid rgba(56,189,248,.35)'
                  }}>
                    <strong style={{ color: elegida === p.ok ? '#34d399' : '#f87171' }}>
                      {elegida === p.ok ? '¡Correcto! ' : 'No es esa. '}
                    </strong>
                    {p.exp || `La respuesta correcta es ${p.opts[p.ok]}.`}
                  </div>
                  <button className="ec-btn" onClick={siguiente} style={{ ...botonBase, backgroundColor: '#fbbf24', color: '#1c1917', marginTop: '16px', width: movil ? '100%' : 'auto' }}>
                    {indice + 1 >= ronda.length ? 'Ver resultado' : 'Siguiente pregunta'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {quizEstado === 'fin' && (
          <div style={{ maxWidth: '760px', width: '100%' }}>
            <div style={{ ...panel, padding: movil ? '24px' : '36px', textAlign: 'center' }}>
              <div style={microLabel}>Resultado</div>
              <div style={{ fontFamily: mono, fontSize: movil ? '58px' : '82px', fontWeight: 800, lineHeight: 1, margin: '10px 0' }}>
                {aciertos}<span style={{ fontSize: '0.42em', opacity: .6 }}>/{ronda.length}</span>
              </div>
              <p style={{ fontSize: '18px', margin: '0 0 24px', opacity: .85 }}>
                {aciertos >= 9 ? 'Dominas la geometría del eclipse.'
                  : aciertos >= 7 ? 'Buen resultado: repasa los datos numéricos.'
                  : aciertos >= 5 ? 'Vas por buen camino. Repite y compara.'
                  : 'Vuelve a la simulación y prueba otra vez.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="ec-btn" onClick={nuevaRonda} style={{ ...botonBase, backgroundColor: '#fbbf24', color: '#1c1917' }}>
                  Jugar con 10 preguntas nuevas
                </button>
                <button className="ec-btn" onClick={() => { setPantalla('sim'); setQuizEstado('inicio'); }} style={{ ...botonBase, backgroundColor: 'rgba(255,255,255,.08)' }}>
                  Volver a la simulación
                </button>
              </div>
            </div>

            <div style={{ ...panel, padding: movil ? '18px' : '26px', marginTop: '16px' }}>
              <div style={{ ...microLabel, marginBottom: '14px' }}>Repaso de la partida</div>
              {ronda.map((pr, i) => {
                const r = respuestas.find((x) => x.i === i);
                return (
                  <div key={i} style={{ padding: '12px 0', borderTop: i ? '1px solid rgba(255,255,255,.10)' : 'none' }}>
                    <div style={{ fontWeight: 700, marginBottom: '6px', lineHeight: 1.4 }}>
                      <span style={{ color: r && r.acierto ? '#34d399' : '#f87171', marginRight: '8px' }}>{r && r.acierto ? '✓' : '✕'}</span>
                      {pr.q}
                    </div>
                    <div style={{ fontSize: '14px', opacity: .8, paddingLeft: '24px', lineHeight: 1.5 }}>
                      Respuesta correcta: <strong>{pr.opts[pr.ok]}</strong>
                      {r && !r.acierto && <span> · Tú marcaste: {pr.opts[r.elegida]}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =============================================================== MODELO 3D
  if (pantalla === '3d') {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        background: '#05070f', color: '#f1f5f9', fontFamily: sans
      }}>
        <style>{estilosGlobales}</style>
        <div style={{ padding: movil ? '10px 8px 8px' : '14px', flexShrink: 0, zIndex: 10 }}>
          <NavSuperior />
        </div>
        <div style={{ position: 'relative', flexGrow: 1, minHeight: 0 }}>
          <Escena3D movil={movil} />
        </div>
      </div>
    );
  }

  // ============================================================= SIMULACIÓN
  const controlDeslizante = (etiqueta, valor, min, max, step, onChange, izq, der) => (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={microLabel}>{etiqueta}</span>
        <span style={{ ...microLabel, opacity: .5 }}>{izq} → {der}</span>
      </div>
      <input
        className="ec-range" type="range" min={min} max={max} step={step} value={valor}
        aria-label={etiqueta}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', width: '100%', boxSizing: 'border-box', overflowX: 'hidden',
      background: `linear-gradient(180deg, ${cieloAlto} 0%, ${cieloBajo} 82%, hsl(28, ${60 * oscuridad + 20}%, ${Math.max(8, L * 0.9)}%) 100%)`,
      color: '#f8fafc', fontFamily: sans,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: movil ? '12px' : '18px', gap: movil ? '12px' : '14px',
      transition: 'background .25s linear', position: 'relative'
    }}>
      <style>{estilosGlobales}</style>

      {/* Estrellas: aparecen cuando el cielo se oscurece */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: Math.max(0, oscuridad * 1.25 - 0.15) }}>
        {estrellas.map((e, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${e.x}%`, top: `${e.y}%`,
            width: `${e.s}px`, height: `${e.s}px`, borderRadius: '50%', background: '#fff',
            animation: `titila ${2 + parseFloat(e.d)}s ease-in-out infinite`
          }} />
        ))}
      </div>

      <NavSuperior />

      <div style={{ textAlign: 'center', zIndex: 5 }}>
        <h1 style={{ fontSize: movil ? '22px' : '30px', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,.45)' }}>
          Eclipse solar: la coincidencia del 400
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: movil ? '13px' : '15px', opacity: .85, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
          Mueve la Luna, cambia su distancia y observa cómo cambia el porcentaje cubierto.
        </p>
      </div>

      {/* ---------------------------------------------------------- escena */}
      <div style={{ width: `${escena}px`, height: `${escena}px`, position: 'relative', zIndex: 4 }}>
        {/* Corona solar */}
        {(esTotal || ocultacion > 99) && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: `${rL * 5.2}px`, height: `${rL * 5.2}px`, borderRadius: '50%',
            transform: 'translate(-50%,-50%)',
            background: `radial-gradient(circle, rgba(255,255,255,0) 37%, rgba(226,240,255,.55) 40%, rgba(190,215,255,.22) 55%, rgba(160,190,255,0) 72%)`,
            animation: 'latido 4s ease-in-out infinite', zIndex: 1, pointerEvents: 'none'
          }} />
        )}

        {/* Sol */}
        <div style={{
          position: 'absolute', left: `${solCx}px`, top: `${solCy}px`,
          width: `${Dsol}px`, height: `${Dsol}px`, marginLeft: `${-R}px`, marginTop: `${-R}px`,
          borderRadius: '50%',
          backgroundImage: 'radial-gradient(circle at 50% 50%, #fffbeb 0%, #fde68a 45%, #f59e0b 78%, #ea580c 100%)',
          boxShadow: bordeSol, zIndex: 2
        }} />

        {/* Luna */}
        <div style={{
          position: 'absolute', left: `${lunaCx}px`, top: `${lunaCy}px`,
          width: `${rL * 2}px`, height: `${rL * 2}px`, marginLeft: `${-rL}px`, marginTop: `${-rL}px`,
          borderRadius: '50%', overflow: 'hidden', zIndex: 3,
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle at 32% 30%, #3a3a3a 0%, #1c1c1c 45%, #080808 100%)',
          boxShadow: 'inset -6px -6px 18px rgba(0,0,0,.6)'
        }}>
          {[[18, 26, .22], [55, 18, .14], [38, 60, .3], [68, 55, .18], [24, 74, .12]].map((c, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${c[0]}%`, top: `${c[1]}%`,
              width: `${rL * 2 * c[2]}px`, height: `${rL * 2 * c[2]}px`, borderRadius: '50%',
              background: 'rgba(255,255,255,.05)', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,.5)'
            }} />
          ))}
        </div>

        {/* Anillo de diamante en el lado que todavía queda descubierto */}
        {anilloDiamante && (
          <div style={{
            position: 'absolute',
            left: `${solCx + (entrando ? 1 : -1) * R * 0.92}px`,
            top: `${solCy - R * 0.16}px`,
            width: '14px', height: '14px', marginLeft: '-7px', marginTop: '-7px', borderRadius: '50%',
            background: '#fff', zIndex: 4,
            boxShadow: '0 0 30px 14px rgba(255,255,255,.95), 0 0 70px 34px rgba(255,236,180,.55)'
          }} />
        )}

        {/* Etiqueta central */}
        {(esTotal || esAnular) && (
          <div style={{
            position: 'absolute', left: '50%', bottom: '-6px', transform: 'translateX(-50%)',
            fontSize: movil ? '14px' : '16px', fontWeight: 800, letterSpacing: '.16em', zIndex: 6,
            textShadow: '0 0 14px rgba(147,197,253,.9)'
          }}>
            {esTotal ? 'TOTALIDAD' : 'ANILLO DE FUEGO'}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------- datos y fase */}
      <div style={{
        display: 'flex', flexDirection: movil ? 'column' : 'row', gap: '12px',
        width: '100%', maxWidth: '1000px', zIndex: 5, alignItems: 'stretch'
      }}>
        <div style={{ ...panel, padding: '14px 18px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={microLabel}>Fase</div>
          <div style={{ fontSize: movil ? '17px' : '19px', fontWeight: 700, margin: '4px 0 8px' }}>{fase}</div>
          <div style={{ fontSize: movil ? '13px' : '14px', lineHeight: 1.5, opacity: .82 }}>
            {esAnular
              ? 'La Luna está lejos y su disco es menor que el solar: nunca llega a taparlo del todo y el cielo apenas se oscurece.'
              : esTotal
                ? 'Solo ahora es visible la corona: la atmósfera exterior del Sol, a más de un millón de grados.'
                : Math.abs(alineacion) > 55
                  ? 'La sombra pasa desviada: desde este punto solo se ve un eclipse parcial, estás en la penumbra.'
                  : 'El Sol es 400 veces mayor que la Luna, pero está 400 veces más lejos. Por eso ambos miden medio grado en el cielo.'}
          </div>
        </div>

        <div style={{ ...panel, padding: '14px 18px', minWidth: movil ? 'auto' : '210px', textAlign: 'center' }}>
          <div style={microLabel}>Sol cubierto</div>
          <div style={{
            fontFamily: mono, fontSize: movil ? '46px' : '54px', fontWeight: 800, lineHeight: 1.05,
            color: oc > 90 ? '#fca5a5' : '#f8fafc'
          }}>
            {oc}<span style={{ fontSize: '.45em', opacity: .6 }}>%</span>
          </div>
          <div style={{
            display: 'inline-block', marginTop: '6px', padding: '3px 12px', borderRadius: '999px',
            fontSize: '12px', fontWeight: 800, letterSpacing: '.1em',
            background: tipo === 'TOTAL' ? '#ef4444' : tipo === 'ANULAR' ? '#f97316' : tipo === 'PARCIAL' ? '#eab308' : '#22c55e',
            color: '#0b1020'
          }}>{tipo}</div>
        </div>

        <div style={{ ...panel, padding: '14px 18px', minWidth: movil ? 'auto' : '210px' }}>
          {[
            ['Tiempo al máximo', `${relojTxt}`],
            ['Distancia lunar', `${distanciaKm.toLocaleString('es-ES')} km`],
            ['Tamaño Luna/Sol', razonLuna.toFixed(3)],
            ['Temperatura', `${temperatura} °C`]
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '3px 0', fontSize: movil ? '13px' : '14px' }}>
              <span style={{ opacity: .6 }}>{f[0]}</span>
              <span style={{ fontFamily: mono, fontWeight: 700 }}>{f[1]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------- controles */}
      <div style={{ ...panel, padding: movil ? '14px' : '18px 22px', width: '100%', maxWidth: '1000px', zIndex: 5, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: movil ? 'column' : 'row', gap: movil ? '10px' : '26px' }}>
          {controlDeslizante('Recorrido de la Luna', progress, 0, 100, 0.1, (v) => { setProgress(v); setIsPlaying(false); }, 'inicio', 'fin')}
          {controlDeslizante('Distancia de la Luna', distLunar, 0, 100, 1, setDistLunar, 'perigeo', 'apogeo')}
          {controlDeslizante('Alineación', alineacion, -100, 100, 1, setAlineacion, 'norte', 'sur')}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '14px' }}>
          <button className="ec-btn" onClick={alternarPlay}
            style={{ ...botonBase, backgroundColor: isPlaying ? '#ef4444' : '#10b981', minWidth: '160px' }}>
            {isPlaying ? 'Pausar' : progress >= 100 ? 'Repetir' : 'Reproducir'}
          </button>
          <button className="ec-btn" onClick={reiniciar} style={{ ...botonBase, backgroundColor: 'rgba(255,255,255,.10)' }}>
            Reiniciar
          </button>
          {[0.5, 1, 2].map((v) => (
            <button key={v} className="ec-btn" onClick={() => setVelocidad(v)}
              style={{
                ...botonBase, padding: '11px 14px', minWidth: '58px',
                backgroundColor: velocidad === v ? 'rgba(251,191,36,.9)' : 'rgba(255,255,255,.10)',
                color: velocidad === v ? '#1c1917' : '#f8fafc'
              }}>
              ×{v}
            </button>
          ))}
          <button className="ec-btn" onClick={() => { setDistLunar(85); setProgress(50); setIsPlaying(false); }}
            style={{ ...botonBase, backgroundColor: 'rgba(249,115,22,.85)' }}>
            Ver eclipse anular
          </button>
        </div>
        <div style={{ ...microLabel, textAlign: 'center', marginTop: '10px', opacity: .45 }}>
          Espacio: reproducir o pausar · Flechas ← →: avanzar paso a paso
        </div>
      </div>
    </div>
  );
};

export default App;

