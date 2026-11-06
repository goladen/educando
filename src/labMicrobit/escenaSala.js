// Escena three.js de la sala del Laboratorio micro:bit: suelo con cuadrícula en metros y ejes,
// paredes (la que tapa la vista se vuelve transparente, como una casa de muñecas), muebles,
// satélites y receptor. Se arrastran con el ratón o el dedo sobre el suelo.
// Coordenadas de sala: x a lo ancho, y a lo largo, origen (0, 0) en una esquina; en three.js
// la sala está centrada: X = x − ancho/2, Z = y − largo/2.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MUEBLES, crearMueble, pegarAPared } from './muebles';

export const COLORES_SAT = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b'];
const SUELOS = { madera: 0xd6b48a, baldosa: 0xe2e8f0, cesped: 0x4ade80, pista: 0x60a5fa };

function sprite(texto, { color = '#0f172a', fondo = 'rgba(255,255,255,0.92)', escala = 0.5, borde = null } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = 'bold 44px system-ui, sans-serif';
  const w = Math.ceil(g.measureText(texto).width) + 36;
  c.width = w; c.height = 72;
  g.font = 'bold 44px system-ui, sans-serif';
  g.fillStyle = fondo;
  g.beginPath(); g.roundRect(2, 4, w - 4, 64, 22); g.fill();
  if (borde) { g.strokeStyle = borde; g.lineWidth = 5; g.stroke(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, w / 2, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(escala * (w / 72), escala, 1);
  s.renderOrder = 30;
  return s;
}

function liberar(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

/**
 * host: div contenedor · cb(): { onSeleccion(clave|null), onMover(clave, x, y, rot) (mientras se arrastra),
 *   onSoltar(clave, x, y, rot) (al soltar), onClickSuelo(x, y) }
 * clave: 'm:<id>' mueble · 's:<k>' satélite · 'r' receptor
 */
export function montarSala({ host, cb }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);
  scene.fog = new THREE.Fog(0x0f172a, 30, 80);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  scene.add(sol, sol.target);

  let sala = null;
  let grupoSala = null;      // suelo, paredes, cuadrícula
  const paredes = [];        // { mesh, normal }
  const objetos = new Map(); // clave → Group
  let capas = new THREE.Group(); scene.add(capas);
  let interaccion = { muebles: true, satelites: true, receptor: true };
  let seleccion = null;
  let selMarca = null;
  let receptor = null;       // { x, y } en coordenadas de sala

  const aEscena = (x, y) => new THREE.Vector3(x - sala.ancho / 2, 0, y - sala.largo / 2);
  const aSala = (v) => ({ x: v.x + sala.ancho / 2, y: v.z + sala.largo / 2 });
  const limitar = (p) => ({ x: Math.min(Math.max(p.x, 0), sala.ancho), y: Math.min(Math.max(p.y, 0), sala.largo) });

  // ── Construcción de la sala ──
  function construirSala() {
    if (grupoSala) { scene.remove(grupoSala); liberar(grupoSala); }
    paredes.length = 0;
    grupoSala = new THREE.Group();
    const { ancho, largo, alto } = sala;

    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(ancho, largo), new THREE.MeshStandardMaterial({ color: SUELOS[sala.suelo] || SUELOS.madera, roughness: 0.9 }));
    suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; suelo.userData.suelo = true;
    grupoSala.add(suelo);

    // Cuadrícula de 1 m (y de 0,5 m más suave)
    const lineas = [], finas = [];
    for (let x = 0; x <= ancho + 1e-6; x += 0.5) (Math.abs(x - Math.round(x)) < 1e-6 ? lineas : finas).push(x - ancho / 2, 0.005, -largo / 2, x - ancho / 2, 0.005, largo / 2);
    for (let y = 0; y <= largo + 1e-6; y += 0.5) (Math.abs(y - Math.round(y)) < 1e-6 ? lineas : finas).push(-ancho / 2, 0.005, y - largo / 2, ancho / 2, 0.005, y - largo / 2);
    const red = (arr, op) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: op }));
    };
    grupoSala.add(red(lineas, 0.35), red(finas, 0.12));

    // Ejes y números (origen en la esquina)
    const eje = (dir, largoEje, color) => {
      const a = new THREE.ArrowHelper(dir, aEscena(0, 0).setY(0.02), largoEje, color, 0.35, 0.2);
      grupoSala.add(a);
    };
    eje(new THREE.Vector3(1, 0, 0), ancho + 0.6, 0xdc2626);
    eje(new THREE.Vector3(0, 0, 1), largo + 0.6, 0x16a34a);
    const paso = Math.max(ancho, largo) > 20 ? 5 : Math.max(ancho, largo) > 10 ? 2 : 1;
    for (let x = 0; x <= ancho + 1e-6; x += paso) { const s = sprite(String(x), { color: '#dc2626', escala: 0.32 }); s.position.copy(aEscena(x, -0.35)).setY(0.05); grupoSala.add(s); }
    for (let y = paso; y <= largo + 1e-6; y += paso) { const s = sprite(String(y), { color: '#16a34a', escala: 0.32 }); s.position.copy(aEscena(-0.35, y)).setY(0.05); grupoSala.add(s); }
    const ex = sprite('x', { color: '#fff', fondo: '#dc2626', escala: 0.4 }); ex.position.copy(aEscena(ancho + 0.9, 0)).setY(0.1); grupoSala.add(ex);
    const ey = sprite('y', { color: '#fff', fondo: '#16a34a', escala: 0.4 }); ey.position.copy(aEscena(0, largo + 0.9)).setY(0.1); grupoSala.add(ey);

    // Paredes (sin pared si alto = 0: patio)
    if (alto > 0) {
      const matPared = () => new THREE.MeshStandardMaterial({ color: new THREE.Color(sala.pared || '#f1f5f9'), roughness: 0.95, transparent: true, opacity: 1 });
      const e = 0.1;
      [
        { w: ancho + 2 * e, pos: [0, alto / 2, -largo / 2 - e / 2], rotY: 0, n: [0, 0, -1] },
        { w: ancho + 2 * e, pos: [0, alto / 2, largo / 2 + e / 2], rotY: 0, n: [0, 0, 1] },
        { w: largo, pos: [-ancho / 2 - e / 2, alto / 2, 0], rotY: Math.PI / 2, n: [-1, 0, 0] },
        { w: largo, pos: [ancho / 2 + e / 2, alto / 2, 0], rotY: Math.PI / 2, n: [1, 0, 0] },
      ].forEach((p) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, alto, e), matPared());
        m.position.set(...p.pos); m.rotation.y = p.rotY; m.receiveShadow = true;
        grupoSala.add(m);
        paredes.push({ mesh: m, normal: new THREE.Vector3(...p.n) });
      });
    }
    scene.add(grupoSala);

    const lado = Math.max(ancho, largo);
    sol.position.set(lado * 0.4, lado * 1.2 + 4, lado * 0.6);
    const sc = sol.shadow.camera; sc.left = sc.bottom = -lado; sc.right = sc.top = lado; sc.far = lado * 4 + 20; sc.updateProjectionMatrix();
  }

  function marcaSeleccion(obj) {
    if (selMarca) { selMarca.parent?.remove(selMarca); liberar(selMarca); selMarca = null; }
    if (!obj) return;
    const caja = new THREE.Box3().setFromObject(obj);
    const tam = caja.getSize(new THREE.Vector3());
    const r = Math.max(tam.x, tam.z) / 2 + 0.15;
    selMarca = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.07, 48), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
    selMarca.rotation.x = -Math.PI / 2; selMarca.position.y = 0.03;
    obj.add(selMarca);
  }

  function crearSatelite(s) {
    const g = new THREE.Group();
    const col = new THREE.Color(COLORES_SAT[(s.k - 1) % 4]);
    const m = (c, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3, ...extra });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 24), m(0x334155)); base.position.y = 0.04;
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 10), m(0x94a3b8)); palo.position.y = 0.6;
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), m(col, { emissive: col, emissiveIntensity: 0.6 })); bola.position.y = 1.25;
    [base, palo, bola].forEach((o) => { o.castShadow = true; g.add(o); });
    // Antenas tipo satélite
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.16), m(0x1e3a8a, { emissive: 0x1e3a8a, emissiveIntensity: 0.3 }));
    panel.position.y = 1.25; g.add(panel);
    const et = sprite(`S${s.k}`, { color: '#fff', fondo: COLORES_SAT[(s.k - 1) % 4], escala: 0.38 }); et.position.y = 1.65; g.add(et);
    g.userData.bola = bola;
    return g;
  }

  function crearReceptor() {
    const g = new THREE.Group();
    const anillo = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40), new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.02;
    const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 6, 16), new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.5 }));
    cuerpo.position.y = 0.55; cuerpo.castShadow = true;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfde68a }));
    cabeza.position.y = 1.08; cabeza.castShadow = true;
    const placa = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0xef4444, emissiveIntensity: 0.4 }));
    placa.position.set(0, 0.75, 0.17);
    g.add(anillo, cuerpo, cabeza, placa);
    const et = sprite('Receptor', { color: '#fff', fondo: '#7c3aed', escala: 0.3 }); et.position.y = 1.45; g.add(et);
    return g;
  }

  function colocar(obj, x, y, rotGrados = 0, alturaPared = 0) {
    obj.position.copy(aEscena(x, y)).setY(alturaPared);
    obj.rotation.y = (rotGrados * Math.PI) / 180;
  }

  function construirObjetos() {
    objetos.forEach((o) => { scene.remove(o); liberar(o); });
    objetos.clear();
    selMarca = null;
    (sala.muebles || []).forEach((mu) => {
      const def = MUEBLES[mu.tipo] || MUEBLES.mesa;
      const g = crearMueble(mu.tipo, sala);
      colocar(g, mu.x, mu.y, mu.rot || 0, def.pared ? def.altura || 0 : 0);
      g.userData.clave = 'm:' + mu.id;
      scene.add(g); objetos.set(g.userData.clave, g);
    });
    (sala.satelites || []).forEach((s) => {
      const g = crearSatelite(s);
      colocar(g, s.x, s.y);
      g.userData.clave = 's:' + s.k;
      scene.add(g); objetos.set(g.userData.clave, g);
    });
    const r = crearReceptor();
    r.userData.clave = 'r';
    r.visible = !!receptor;
    if (receptor) colocar(r, receptor.x, receptor.y);
    scene.add(r); objetos.set('r', r);
    if (seleccion && objetos.get(seleccion)) marcaSeleccion(objetos.get(seleccion));
  }

  // ── Capas del GPS: circunferencias, punto calculado, recorrido, líneas, brújula ──
  function setCapas(c = {}) {
    scene.remove(capas); liberar(capas);
    capas = new THREE.Group(); scene.add(capas);
    if (!sala) return;
    (c.circulos || []).forEach(({ x, y, r, color }) => {
      if (!(r > 0.02)) return;
      const anillo = new THREE.Mesh(new THREE.RingGeometry(Math.max(0, r - 0.035), r + 0.035, 160),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
      anillo.rotation.x = -Math.PI / 2; anillo.position.copy(aEscena(x, y)).setY(0.025);
      const disco = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
      disco.rotation.x = -Math.PI / 2; disco.position.copy(aEscena(x, y)).setY(0.015);
      capas.add(anillo, disco);
    });
    (c.lineas || []).forEach(({ a, b, color, texto }) => {
      const geo = new THREE.BufferGeometry().setFromPoints([aEscena(a.x, a.y).setY(0.06), aEscena(b.x, b.y).setY(0.06)]);
      capas.add(new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: 0.15, gapSize: 0.08 })));
      capas.children[capas.children.length - 1].computeLineDistances();
      if (texto) { const s = sprite(texto, { color, escala: 0.34, borde: color }); s.position.copy(aEscena((a.x + b.x) / 2, (a.y + b.y) / 2)).setY(0.45); capas.add(s); }
    });
    if (c.rastro?.length > 1) {
      const geo = new THREE.BufferGeometry().setFromPoints(c.rastro.map((p) => aEscena(p.x, p.y).setY(0.04)));
      capas.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xa855f7 })));
      c.rastro.forEach((p) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xa855f7 })); d.position.copy(aEscena(p.x, p.y)).setY(0.05); capas.add(d); });
    }
    (c.puntos || []).forEach(({ x, y, color = '#facc15', texto, grande }) => {
      const r = grande ? 0.16 : 0.1;
      const bola = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }));
      bola.position.copy(aEscena(x, y)).setY(r + 0.02); bola.userData.latido = grande;
      capas.add(bola);
      if (grande) {
        const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
        haz.position.copy(aEscena(x, y)).setY(1.25); capas.add(haz);
      }
      if (texto) { const s = sprite(texto, { color: '#0f172a', fondo: color, escala: 0.34 }); s.position.copy(aEscena(x, y)).setY(grande ? 2.75 : 0.5); capas.add(s); }
    });
    if (c.brujula) {
      const { x, y, grados, norte = 0 } = c.brujula;
      const g = new THREE.Group();
      const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d }));
      flecha.rotation.x = Math.PI / 2; flecha.position.z = -0.45; g.add(flecha);
      g.position.copy(aEscena(x, y)).setY(0.2);
      // rumbo: 0° = norte de la sala (dirección -y si norte = 0), sentido horario visto desde arriba
      g.rotation.y = -((grados - norte) * Math.PI) / 180;
      capas.add(g);
    }
  }

  // ── Interacción ──
  const ray = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ptr = new THREE.Vector2();
  let arrastre = null; // { clave, dx, dy }
  let abajo = null;    // { x, y } píxeles del pointerdown

  function rayDesde(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
  }
  function puntoSuelo(e) {
    rayDesde(e);
    const v = new THREE.Vector3();
    return ray.ray.intersectPlane(plano, v) ? aSala(v) : null;
  }
  const puedeArrastrar = (clave) => (clave === 'r' ? interaccion.receptor : clave.startsWith('s:') ? interaccion.satelites : interaccion.muebles);

  function onDown(e) {
    if (!sala) return;
    abajo = { x: e.clientX, y: e.clientY };
    rayDesde(e);
    const hits = ray.intersectObjects([...objetos.values()].filter((o) => o.visible), true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.clave) o = o.parent;
      if (!o) continue;
      const clave = o.userData.clave;
      if (!puedeArrastrar(clave)) continue;
      const p = puntoSuelo(e);
      const actual = aSala(o.position);
      arrastre = { clave, dx: p ? actual.x - p.x : 0, dy: p ? actual.y - p.y : 0 };
      controls.enabled = false;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      setSeleccion(clave); cb().onSeleccion?.(clave);
      return;
    }
  }
  function onMove(e) {
    if (!arrastre) return;
    const p = puntoSuelo(e);
    if (!p) return;
    let { x, y } = limitar({ x: p.x + arrastre.dx, y: p.y + arrastre.dy });
    x = Math.round(x * 20) / 20; y = Math.round(y * 20) / 20; // de 5 en 5 cm
    const o = objetos.get(arrastre.clave);
    let rot = null;
    if (arrastre.clave.startsWith('m:')) {
      const mu = sala.muebles.find((m) => 'm:' + m.id === arrastre.clave);
      const def = MUEBLES[mu?.tipo];
      if (def?.pared) ({ x, y, rot } = pegarAPared(x, y, sala, def.d));
      colocar(o, x, y, rot ?? mu?.rot ?? 0, def?.pared ? def.altura || 0 : 0);
    } else colocar(o, x, y);
    if (arrastre.clave === 'r') receptor = { x, y };
    arrastre.ultimo = { x, y, rot };
    cb().onMover?.(arrastre.clave, x, y, rot);
  }
  function onUp(e) {
    const fueClick = abajo && Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) < 6;
    if (arrastre) {
      // Al soltar se guarda la posición (durante el arrastre solo se mueve el objeto 3D)
      if (arrastre.ultimo) cb().onSoltar?.(arrastre.clave, arrastre.ultimo.x, arrastre.ultimo.y, arrastre.ultimo.rot);
      arrastre = null;
      controls.enabled = true;
    } else if (fueClick && sala) {
      const p = puntoSuelo(e);
      if (p && p.x >= 0 && p.y >= 0 && p.x <= sala.ancho && p.y <= sala.largo) {
        setSeleccion(null); cb().onSeleccion?.(null);
        cb().onClickSuelo?.(Math.round(p.x * 20) / 20, Math.round(p.y * 20) / 20);
      }
    }
    abajo = null;
  }
  renderer.domElement.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  function setSeleccion(clave) {
    seleccion = clave;
    marcaSeleccion(clave ? objetos.get(clave) : null);
  }

  function vista(tipo = 'perspectiva') {
    if (!sala) return;
    const lado = Math.max(sala.ancho, sala.largo);
    controls.target.set(0, 0, 0);
    if (tipo === 'cenital') camera.position.set(0, lado * 1.35 + 2, 0.01);
    else camera.position.set(sala.ancho * 0.35, lado * 0.85 + 2, sala.largo * 0.5 + lado * 0.75);
    controls.update();
  }

  // ── Bucle ──
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  });
  ro.observe(host);
  let raf = 0, t = 0;
  const tmp = new THREE.Vector3();
  const frame = () => {
    raf = requestAnimationFrame(frame);
    t += 0.016;
    controls.update();
    // Paredes entre la cámara y la sala: casi transparentes
    paredes.forEach(({ mesh, normal }) => {
      tmp.copy(camera.position).sub(mesh.position);
      const delante = tmp.dot(normal) > 0;
      mesh.material.opacity = delante ? 0.12 : 1;
      mesh.material.depthWrite = !delante;
    });
    capas.children.forEach((o) => { if (o.userData.latido) o.scale.setScalar(1 + 0.25 * Math.sin(t * 5)); });
    objetos.forEach((o, k) => { if (k.startsWith('s:') && o.userData.bola) o.userData.bola.material.emissiveIntensity = 0.45 + 0.35 * Math.sin(t * 3 + Number(k.slice(2))); });
    renderer.render(scene, camera);
  };
  frame();

  return {
    setSala(nueva, { recolocarCamara = false } = {}) {
      const cambiaForma = !sala || sala.ancho !== nueva.ancho || sala.largo !== nueva.largo || sala.alto !== nueva.alto || sala.suelo !== nueva.suelo || sala.pared !== nueva.pared;
      const primera = !sala;
      sala = nueva;
      if (cambiaForma) construirSala();
      construirObjetos();
      if (primera || recolocarCamara) vista('perspectiva');
    },
    setReceptor(p) {
      receptor = p;
      const r = objetos.get('r');
      if (r) { r.visible = !!p; if (p) colocar(r, p.x, p.y); }
    },
    setInteraccion(i) { interaccion = { ...interaccion, ...i }; },
    setSeleccion,
    setCapas,
    vista,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      controls.dispose();
      liberar(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
