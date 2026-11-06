// Gemelo digital 3D de la casa Smart Home (three.js, sobre montarMini del Laboratorio micro:bit).
// La casa copia lo que pasa en la real: puerta y ventana giran con sus servos, el ventilador gira
// según su velocidad, el LED y el RGB se encienden, y cada sensor lleva una etiqueta con su valor.
// Unidades: 1 = 10 cm de la maqueta. Suelo en y = 0; la puerta mira hacia +Z.
import * as THREE from 'three';
import { montarMini, etiqueta3D, crearMicrobit3D } from '../labMicrobit/escenaMini';
import { crearLcd3D } from './lcd3d';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...extra });
const caja = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; o.receiveShadow = true; return o; };

const W = 4, D = 3, H = 2.4, E = 0.08; // ancho, fondo, alto de pared, grosor
const PUERTA = { w: 0.9, h: 1.5, x: -0.6 };
const VENTANA = { w: 1.0, h: 0.8, z: 0, y: 1.3 };

export function montarCasa({ host, placa = 'esp32' }) {
  const m = montarMini({ host, camara: [4.5, 4.2, 6.5], objetivo: [0, 1, 0] });
  const { scene } = m;
  const madera = mat(0xe8c99b), maderaOsc = mat(0xc9a06a);

  // Base
  const base = caja(W + 1.6, 0.1, D + 1.6, mat(0x94a3b8)); base.position.y = -0.05; scene.add(base);
  const suelo = caja(W, 0.02, D, mat(0xf5e6c8)); suelo.position.y = 0.01; scene.add(suelo);

  // Paredes: fondo, izquierda, derecha (con hueco de ventana) y frente (con hueco de puerta)
  const fondo = caja(W, H, E, madera); fondo.position.set(0, H / 2, -D / 2); scene.add(fondo);
  const izq = caja(E, H, D, madera); izq.position.set(-W / 2, H / 2, 0); scene.add(izq);
  const derArriba = caja(E, H - VENTANA.y - VENTANA.h / 2, D, madera);
  derArriba.position.set(W / 2, (H + VENTANA.y + VENTANA.h / 2) / 2, 0);
  const derAbajo = caja(E, VENTANA.y - VENTANA.h / 2, D, madera);
  derAbajo.position.set(W / 2, (VENTANA.y - VENTANA.h / 2) / 2, 0);
  const ladoV = (D - VENTANA.w) / 2;
  const derA = caja(E, VENTANA.h, ladoV, madera); derA.position.set(W / 2, VENTANA.y, -D / 2 + ladoV / 2);
  const derB = caja(E, VENTANA.h, ladoV, madera); derB.position.set(W / 2, VENTANA.y, D / 2 - ladoV / 2);
  scene.add(derArriba, derAbajo, derA, derB);
  const frenteIzq = caja(PUERTA.x - PUERTA.w / 2 + W / 2, H, E, madera);
  frenteIzq.position.set((-W / 2 + PUERTA.x - PUERTA.w / 2) / 2, H / 2, D / 2);
  const frenteDer = caja(W / 2 - (PUERTA.x + PUERTA.w / 2), H, E, madera);
  frenteDer.position.set((W / 2 + PUERTA.x + PUERTA.w / 2) / 2, H / 2, D / 2);
  const dintel = caja(PUERTA.w, H - PUERTA.h, E, madera); dintel.position.set(PUERTA.x, (H + PUERTA.h) / 2, D / 2);
  scene.add(frenteIzq, frenteDer, dintel);
  // Las paredes de delante y de la derecha, algo transparentes para ver el interior
  [frenteIzq, frenteDer, dintel, derArriba, derAbajo, derA, derB].forEach((o) => { o.material = mat(0xe8c99b, { transparent: true, opacity: 0.55 }); });

  // Tejado a dos aguas (transparente)
  const ala = Math.hypot(W / 2, 0.9) + 0.15;
  const matTejado = mat(0xb45309, { transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  [-1, 1].forEach((s) => {
    const t = caja(ala, 0.06, D + 0.3, matTejado);
    t.position.set((s * W) / 4, H + 0.45, 0);
    t.rotation.z = -s * Math.atan2(0.9, W / 2);
    scene.add(t);
  });

  // Puerta (bisagra en el lado izquierdo del hueco)
  const bisagra = new THREE.Group(); bisagra.position.set(PUERTA.x - PUERTA.w / 2, 0, D / 2 + E / 2); scene.add(bisagra);
  const hoja = caja(PUERTA.w, PUERTA.h, 0.05, maderaOsc); hoja.position.set(PUERTA.w / 2, PUERTA.h / 2, 0); bisagra.add(hoja);
  const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(0xfacc15, { metalness: 0.7 })); pomo.position.set(PUERTA.w - 0.12, PUERTA.h / 2, 0.06); bisagra.add(pomo);

  // Ventana (abatible hacia fuera, bisagra arriba)
  const bisV = new THREE.Group(); bisV.position.set(W / 2 + E / 2, VENTANA.y + VENTANA.h / 2, VENTANA.z); scene.add(bisV);
  const cristal = caja(0.04, VENTANA.h, VENTANA.w, mat(0x7dd3fc, { transparent: true, opacity: 0.55, roughness: 0.1 }));
  cristal.position.set(0, -VENTANA.h / 2, 0); bisV.add(cristal);

  // Ventilador en la pared izquierda
  const motor = caja(0.3, 0.3, 0.3, mat(0x1e293b)); motor.position.set(-W / 2 + 0.2, 1.7, -0.6); scene.add(motor);
  const helice = new THREE.Group(); helice.position.set(-W / 2 + 0.4, 1.7, -0.6); scene.add(helice);
  for (let i = 0; i < 3; i++) {
    const aspa = caja(0.02, 0.5, 0.14, mat(0xef4444)); aspa.position.y = 0.25;
    const g = new THREE.Group(); g.rotation.x = (i * Math.PI * 2) / 3; g.add(aspa); helice.add(g);
  }

  // LED (lámpara en el techo) + luz real
  const bombilla = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), mat(0x78716c, { emissive: 0x000000 }));
  bombilla.position.set(0.4, H - 0.2, -0.2); scene.add(bombilla);
  const luzLed = new THREE.PointLight(0xffd36b, 0, 6); luzLed.position.copy(bombilla.position); scene.add(luzLed);

  // RGB: 4 LED sobre la puerta
  const rgb = [0, 1, 2, 3].map((i) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat(0x334155, { emissive: 0x000000 }));
    l.position.set(PUERTA.x - 0.3 + i * 0.2, PUERTA.h + 0.2, D / 2 + 0.07); scene.add(l); return l;
  });

  // Pantalla LCD1602 en la pared del fondo
  const marcoLcd = caja(1.3, 0.48, 0.05, mat(0x15803d)); marcoLcd.position.set(-0.6, 1.75, -D / 2 + 0.07); scene.add(marcoLcd);
  const lcd = crearLcd3D();
  lcd.mesh.position.set(-0.6, 1.75, -D / 2 + 0.1); scene.add(lcd.mesh);

  // Sensores (piezas sencillas) con etiqueta
  const sensores = {};
  const sensor = (clave, obj, pos, alto = 0.45) => { obj.position.copy(pos); scene.add(obj); sensores[clave] = { obj, pos: pos.clone().setY(pos.y + alto), sprite: null, texto: '' }; };
  sensor('temp', caja(0.22, 0.3, 0.08, mat(0x2563eb)), new THREE.Vector3(1.2, 1.4, -D / 2 + 0.08));
  const pir = new THREE.Group();
  pir.add(caja(0.22, 0.22, 0.06, mat(0x15803d)));
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf8fafc, { emissive: 0x000000 }));
  cupula.rotation.x = Math.PI / 2; cupula.position.z = 0.04; pir.add(cupula);
  sensor('pir', pir, new THREE.Vector3(0.6, 1.9, D / 2 + 0.07));
  const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16), mat(0xa1a1aa, { metalness: 0.6, emissive: 0x000000 }));
  gas.rotation.z = Math.PI / 2;
  sensor('gas', gas, new THREE.Vector3(-W / 2 + 0.1, 0.9, 0.7));
  sensor('vapor', caja(0.3, 0.03, 0.2, mat(0xdc2626)), new THREE.Vector3(W / 4, H + 0.5, 0.6), 0.5);
  // Maceta con planta (sensor de humedad del suelo) y fotorresistencia, fuera de la casa
  const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.4, 20), mat(0xb45309));
  const tierra = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 20), mat(0x5b3a1a)); tierra.position.y = 0.19; maceta.add(tierra);
  const tallo = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), mat(0x16a34a)); tallo.position.y = 0.5; maceta.add(tallo);
  sensor('suelo', maceta, new THREE.Vector3(W / 2 + 0.5, 0.2, D / 2 + 0.3), 0.95);
  const ldr = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), mat(0xfbbf24)); ldr.rotation.x = Math.PI / 2;
  sensor('luz', ldr, new THREE.Vector3(-1.4, 1.9, D / 2 + 0.07));

  // Placa
  let placa3d;
  if (placa === 'microbit') { placa3d = crearMicrobit3D({ escala: 0.12 }); placa3d.position.set(-W / 2 - 0.45, 0.02, D / 2 + 0.35); }
  else {
    placa3d = new THREE.Group();
    placa3d.add(caja(0.9, 0.05, 0.6, mat(0x1d4ed8)));
    const chip = caja(0.3, 0.06, 0.4, mat(0x9ca3af, { metalness: 0.7 })); chip.position.set(0.15, 0.05, 0); placa3d.add(chip);
    const usb = caja(0.12, 0.08, 0.14, mat(0xd1d5db, { metalness: 0.8 })); usb.position.set(-0.45, 0.05, 0); placa3d.add(usb);
    placa3d.position.set(-W / 2 - 0.3, 0.03, D / 2 + 0.35);
  }
  scene.add(placa3d);
  const etiquetaPlaca = etiqueta3D(placa === 'microbit' ? 'micro:bit' : 'ESP32', { escala: 0.22 });
  etiquetaPlaca.position.set(placa3d.position.x, 0.35, placa3d.position.z); scene.add(etiquetaPlaca);

  // Lluvia (gotas que caen sobre el tejado cuando el sensor detecta agua)
  const gotas = [];
  const matGota = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 60; i++) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 4), matGota);
    g.position.set((Math.random() - 0.5) * (W + 1), Math.random() * 2 + H, (Math.random() - 0.5) * (D + 1));
    g.visible = false; scene.add(g); gotas.push(g);
  }

  // ── Estado ──
  let objetivo = { puerta: 0, ventana: 0, vent: 0, led: 0, rgb: [0, 0, 0] };
  let lectura = null;
  let angPuerta = 0, angVentana = 0, t = 0;

  function etiqueta(clave, texto, color = '#fff') {
    const s = sensores[clave];
    if (!s || s.texto === texto + color) return;
    if (s.sprite) { scene.remove(s.sprite); s.sprite.material.map.dispose(); s.sprite.material.dispose(); }
    s.texto = texto + color;
    if (!texto) { s.sprite = null; return; }
    s.sprite = etiqueta3D(texto, { escala: 0.24, color });
    s.sprite.position.copy(s.pos); scene.add(s.sprite);
  }

  m.onFrame((dt) => {
    t += dt;
    angPuerta += (objetivo.puerta - angPuerta) * Math.min(1, dt * 4);
    angVentana += (objetivo.ventana - angVentana) * Math.min(1, dt * 4);
    bisagra.rotation.y = (angPuerta * Math.PI) / 180;
    bisV.rotation.z = (Math.min(angVentana, 120) * Math.PI) / 180; // la hoja sale hacia fuera (+X)
    helice.rotation.x += dt * objetivo.vent * 0.25;
    const on = objetivo.led > 0;
    bombilla.material.emissive.set(on ? 0xffd36b : 0x000000); bombilla.material.emissiveIntensity = on ? 1.6 : 0;
    luzLed.intensity = on ? 3 : 0;
    rgb.forEach((l, i) => {
      const [r, g, b] = objetivo.rgbs?.[i] || objetivo.rgb;
      l.material.emissive.setRGB(r / 255, g / 255, b / 255); l.material.emissiveIntensity = r + g + b > 0 ? 1.5 : 0;
    });
    const alarma = lectura?.gas != null && lectura.gas > 40;
    gas.material.emissive.set(alarma && Math.sin(t * 10) > 0 ? 0xff0000 : 0x000000);
    cupula.material.emissive.set(lectura?.pir ? 0x22c55e : 0x000000); cupula.material.emissiveIntensity = lectura?.pir ? 1 : 0;
    const llueve = lectura?.vapor != null && lectura.vapor > 25;
    gotas.forEach((gt) => {
      gt.visible = llueve;
      if (!llueve) return;
      gt.position.y -= dt * 4;
      if (gt.position.y < H + 0.6 && Math.abs(gt.position.x) < W / 2 + 0.2 && Math.abs(gt.position.z) < D / 2 + 0.2) gt.position.y = H + 2 + Math.random();
      else if (gt.position.y < 0) gt.position.y = H + 2 + Math.random();
    });
  });

  return {
    setEstado({ salidas, lectura: l }) {
      objetivo = salidas;
      lectura = l;
      lcd.pintar(salidas.lcd, salidas.lcdLuz);
      const f = (v, ud, dec = 0) => (v == null ? '' : `${v.toFixed(dec).replace('.', ',')} ${ud}`);
      etiqueta('temp', l ? [l.temp != null ? f(l.temp, '°C') : '', l.hum != null ? f(l.hum, '%') : ''].filter(Boolean).join(' · ') : '');
      etiqueta('pir', l?.pir != null ? (l.pir ? '🚶 movimiento' : 'PIR') : '', l?.pir ? '#86efac' : '#fff');
      etiqueta('gas', l?.gas != null ? (l.gas > 40 ? `¡GAS! ${f(l.gas, '%')}` : `gas ${f(l.gas, '%')}`) : '', l?.gas > 40 ? '#fca5a5' : '#fff');
      etiqueta('vapor', l?.vapor != null ? `lluvia ${f(l.vapor, '%')}` : '');
      etiqueta('suelo', l?.suelo != null ? `tierra ${f(l.suelo, '%')}` : '');
      etiqueta('luz', l?.luz != null ? `luz ${f(l.luz, '%')}` : '');
    },
    destroy: () => m.destroy(),
  };
}
