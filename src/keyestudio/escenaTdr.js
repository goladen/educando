// Gemelo 3D de la placa Imagina TdR STEAM (sobre la ESP32 STEAMakers), con montarMini del Laboratorio
// micro:bit. Copia a la placa real: el mando del potenciómetro gira, los botones se hunden, los LED
// rojo/azul y el RGB se encienden, la pantalla LCD muestra su texto y cada sensor lleva su valor.
// Disposición esquemática (no a escala exacta). Unidades: 1 = 1 cm; la placa está en el plano XZ.
import * as THREE from 'three';
import { montarMini, etiqueta3D } from '../labMicrobit/escenaMini';
import { crearLcd3D } from './lcd3d';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...extra });
const pieza = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };

export function montarTdr({ host }) {
  const m = montarMini({ host, camara: [0, 8.5, 7.5], objetivo: [0, 0.4, -0.6] });
  const { scene } = m;
  const Y = 0.62; // cara superior del escudo

  // ESP32 STEAMakers (abajo) + escudo Imagina TdR STEAM (arriba), unidos por los conectores
  scene.add(pieza(new THREE.BoxGeometry(7, 0.16, 5.4), mat(0x1e3a8a), 0, 0.08, 0));
  scene.add(pieza(new THREE.BoxGeometry(6.8, 0.16, 5.3), mat(0x14532d), 0, Y - 0.08, 0));
  [-2.45, 2.45].forEach((z) => scene.add(pieza(new THREE.BoxGeometry(5.6, 0.3, 0.25), mat(0x111111), 0, 0.31, z)));
  scene.add(pieza(new THREE.BoxGeometry(1.2, 0.45, 0.9), mat(0xd1d5db, { metalness: 0.8 }), -3.3, 0.38, -1.4)); // USB

  const etiquetas = {};
  const etiqueta = (clave, x, z, alto = 0.9) => { etiquetas[clave] = { pos: new THREE.Vector3(x, Y + alto, z), sprite: null, texto: '' }; };

  // Potenciómetro (A0): base y mando con una marca que gira
  scene.add(pieza(new THREE.BoxGeometry(1.1, 0.25, 1.1), mat(0x1d4ed8), -2.2, Y + 0.12, 1.3));
  const mando = new THREE.Group(); mando.position.set(-2.2, Y + 0.25, 1.3); scene.add(mando);
  mando.add(pieza(new THREE.CylinderGeometry(0.45, 0.48, 0.45, 24), mat(0xe5e7eb), 0, 0.22, 0));
  mando.add(pieza(new THREE.BoxGeometry(0.08, 0.06, 0.4), mat(0x111827), 0, 0.46, -0.2));
  const puntoRojo = pieza(new THREE.SphereGeometry(0.07, 10, 8), mat(0xef4444), 0, 0, 0);
  puntoRojo.position.set(-2.2 + 0.62 * Math.sin(-0.75 * Math.PI), Y + 0.27, 1.3 - 0.62 * Math.cos(-0.75 * Math.PI)); scene.add(puntoRojo);
  etiqueta('pot', -2.2, 1.3, 1.4);

  // LDR (A1), LM35 (A2) y DHT11 (D4)
  scene.add(pieza(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 20), mat(0xf59e0b), -0.8, Y + 0.06, 1.6));
  etiqueta('luz', -0.8, 1.6);
  const lm = pieza(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16, 1, false, 0, Math.PI), mat(0x111827), 0.2, Y + 0.25, 1.6);
  scene.add(lm); etiqueta('tempLM', 0.2, 1.6);
  scene.add(pieza(new THREE.BoxGeometry(1.2, 0.55, 1.5), mat(0x38bdf8), 1.7, Y + 0.28, 1.3));
  etiqueta('dht', 1.7, 1.3, 1.2);

  // Botones SW1 (D2) y SW2 (D7): el capuchón baja al pulsar
  const botones = [-1.8, -0.6].map((x) => {
    scene.add(pieza(new THREE.BoxGeometry(0.7, 0.2, 0.7), mat(0x334155), x, Y + 0.1, -0.4));
    const cap = pieza(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16), mat(0x0f172a), x, Y + 0.3, -0.4);
    scene.add(cap); return cap;
  });
  etiqueta('boton1', -1.8, -0.4, 0.8); etiqueta('boton2', -0.6, -0.4, 0.8);

  // LED rojo (D12), LED azul (D13) y LED RGB (D6-D9-D10)
  const cupula = (color) => pieza(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { emissive: 0x000000, transparent: true, opacity: 0.9 }), 0, 0, 0);
  const ledRojo = cupula(0x7f1d1d); ledRojo.position.set(0.7, Y, -0.4); scene.add(ledRojo);
  const ledAzul = cupula(0x1e3a8a); ledAzul.position.set(1.3, Y, -0.4); scene.add(ledAzul);
  const ledRgb = cupula(0xf1f5f9); ledRgb.scale.setScalar(1.4); ledRgb.position.set(2.3, Y, -0.4); scene.add(ledRgb);
  const luzRgb = new THREE.PointLight(0xffffff, 0, 3); luzRgb.position.set(2.3, Y + 0.5, -0.4); scene.add(luzRgb);

  // Zumbador (D8) y receptor IR (D11)
  scene.add(pieza(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 24), mat(0x111827), -2.2, Y + 0.22, -1.8));
  const onda = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0 }));
  onda.rotation.x = Math.PI / 2; onda.position.set(-2.2, Y + 0.5, -1.8); scene.add(onda);
  scene.add(pieza(new THREE.BoxGeometry(0.45, 0.4, 0.3), mat(0x111827), 0.2, Y + 0.2, -1.9));

  // Micrófono del kit en el puerto A3 (borde derecho) y pantalla LCD de pie detrás de la placa
  scene.add(pieza(new THREE.BoxGeometry(0.9, 0.08, 1.3), mat(0x1d4ed8), 3.9, Y - 0.2, 1.2));
  scene.add(pieza(new THREE.CylinderGeometry(0.25, 0.25, 0.25, 20), mat(0x9ca3af, { metalness: 0.7 }), 3.9, Y - 0.04, 1.5));
  etiqueta('mic', 3.9, 1.3, 0.8);
  scene.add(pieza(new THREE.BoxGeometry(7.2, 3.2, 0.12), mat(0x15803d), 0, 1.9, -3.6));
  const lcd = crearLcd3D({ ancho: 6.2, alto: 1.9 });
  lcd.mesh.position.set(0, 1.9, -3.53); scene.add(lcd.mesh);

  const rotulo = etiqueta3D('Imagina TdR STEAM', { escala: 0.32 });
  rotulo.position.set(0, Y + 0.05, 2.35); scene.add(rotulo);

  let salidas = null, lectura = null, angMando = 0, t = 0, ultimoPitido = 0;
  m.onFrame((dt) => {
    t += dt;
    const p = lectura?.pot != null ? lectura.pot / 100 : 0;
    angMando += ((-135 + 270 * p) - angMando) * Math.min(1, dt * 8);
    mando.rotation.y = (-angMando * Math.PI) / 180;
    botones.forEach((cap, i) => { cap.position.y = Y + ((i ? lectura?.boton2 : lectura?.boton1) ? 0.2 : 0.3); });
    if (!salidas) return;
    ledRojo.material.emissive.set(salidas.led ? 0xff2020 : 0x000000); ledRojo.material.emissiveIntensity = salidas.led ? 1.6 : 0;
    ledAzul.material.emissive.set(salidas.led2 ? 0x3b82f6 : 0x000000); ledAzul.material.emissiveIntensity = salidas.led2 ? 1.6 : 0;
    const [r, g, b] = salidas.rgb;
    ledRgb.material.emissive.setRGB(r / 255, g / 255, b / 255); ledRgb.material.emissiveIntensity = r + g + b ? 1.4 : 0;
    luzRgb.color.setRGB(r / 255, g / 255, b / 255); luzRgb.intensity = r + g + b ? 2 : 0;
    const vida = (performance.now() - ultimoPitido) / 400;
    onda.material.opacity = vida < 1 ? 0.9 * (1 - vida) : 0;
    onda.scale.setScalar(1 + (vida < 1 ? vida : 0) * 0.8);
  });

  function ponEtiqueta(clave, texto) {
    const e = etiquetas[clave];
    if (!e || e.texto === texto) return;
    if (e.sprite) { scene.remove(e.sprite); e.sprite.material.map.dispose(); e.sprite.material.dispose(); }
    e.texto = texto; e.sprite = null;
    if (!texto) return;
    e.sprite = etiqueta3D(texto, { escala: 0.32 });
    e.sprite.position.copy(e.pos); scene.add(e.sprite);
  }

  return {
    setEstado({ salidas: s, lectura: l }) {
      salidas = s; lectura = l;
      lcd.pintar(s.lcd, s.lcdLuz);
      const f = (v, ud, dec = 0) => (v == null ? '' : `${v.toFixed(dec).replace('.', ',')} ${ud}`);
      ponEtiqueta('pot', l?.pot != null ? `${Math.round(2.7 * l.pot)}°` : '');
      ponEtiqueta('luz', l?.luz != null ? `luz ${f(l.luz, '%')}` : '');
      ponEtiqueta('tempLM', l?.tempLM != null ? f(l.tempLM, '°C', 1) : '');
      ponEtiqueta('dht', l?.temp != null ? [f(l.temp, '°C'), l.hum != null ? f(l.hum, '%') : ''].filter(Boolean).join(' · ') : '');
      ponEtiqueta('mic', l?.mic != null ? `🎤 ${f(l.mic, '%')}` : '');
      ponEtiqueta('boton1', l?.boton1 ? 'SW1' : '');
      ponEtiqueta('boton2', l?.boton2 ? 'SW2' : '');
    },
    pitido() { ultimoPitido = performance.now(); },
    destroy: () => m.destroy(),
  };
}
