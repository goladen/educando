// Escena three.js pequeña para los instrumentos (inclinómetro, brújula, caída) y modelo 3D de
// una micro:bit V2 (placa, 25 LED, botones A y B, logo y conector dorado).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function montarMini({ host, camara = [0, 3, 6], objetivo = [0, 0.5, 0], fondo = 0x0f172a, orbitar = true }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(fondo);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
  camera.position.set(...camara);
  let controls = null;
  if (orbitar) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...objetivo);
    controls.enableDamping = true;
  } else camera.lookAt(...objetivo);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5);
  sol.position.set(4, 8, 5); sol.castShadow = true;
  scene.add(sol);

  const alFrame = new Set();
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  });
  ro.observe(host);
  let raf = 0, last = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    alFrame.forEach((fn) => fn(dt));
    controls?.update();
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  return {
    scene, camera,
    onFrame(fn) { alFrame.add(fn); return () => alFrame.delete(fn); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); controls?.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}

/** Texto en un sprite (siempre mirando a la cámara). */
export function etiqueta3D(texto, { color = '#fff', fondo = 'rgba(15,23,42,0.85)', escala = 0.4 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = 'bold 44px system-ui, sans-serif';
  const w = Math.ceil(g.measureText(texto).width) + 36;
  c.width = w; c.height = 72;
  g.font = 'bold 44px system-ui, sans-serif';
  g.fillStyle = fondo; g.beginPath(); g.roundRect(2, 4, w - 4, 64, 22); g.fill();
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texto, w / 2, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(escala * (w / 72), escala, 1); s.renderOrder = 30;
  return s;
}

/**
 * Micro:bit V2 en 3D (unidades: 1 = 1 cm·10, la placa mide 5,2 × 4,2). Tumbada en el plano XZ,
 * con los LED hacia +Y y el conector hacia +Z (hacia quien la mira). Devuelve el grupo;
 * group.userData.leds = matriz 5×5 de mallas para encenderlas.
 */
export function crearMicrobit3D({ escala = 1 } = {}) {
  const g = new THREE.Group();
  const m = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...extra });
  const placa = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.16, 4.2), m(0x111111));
  placa.castShadow = true; placa.receiveShadow = true; g.add(placa);
  // Conector dorado
  const conector = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.17, 0.7), m(0xd4a017, { metalness: 0.8, roughness: 0.3 }));
  conector.position.set(0, 0.001, 1.75); g.add(conector);
  [-2, -0.6, 0.8, 2.2].forEach((x) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16), m(0x111111)); h.position.set(x - 0.1, 0.002, 1.75); g.add(h); });
  // LED 5×5
  const leds = [];
  for (let f = 0; f < 5; f++) {
    leds.push([]);
    for (let c = 0; c < 5; c++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.32), m(0x3f0d0d, { emissive: 0x000000 }));
      led.position.set(-1.0 + c * 0.5, 0.11, -1.4 + f * 0.5);
      g.add(led); leds[f].push(led);
    }
  }
  // Botones A y B
  [[-2.15, 'A'], [2.15, 'B']].forEach(([x]) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), m(0x9ca3af)); base.position.set(x, 0.12, -0.4); g.add(base);
    const boton = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), m(0x1f2937)); boton.position.set(x, 0.22, -0.4); g.add(boton);
  });
  // Logo táctil
  const logo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 24), m(0xd4a017, { metalness: 0.8, roughness: 0.3 }));
  logo.rotation.x = Math.PI / 2; logo.position.set(0, 0.1, -1.85); g.add(logo);
  g.scale.setScalar(escala);
  g.userData.leds = leds;
  return g;
}

/** Enciende los LED según un patrón '01010:…' (5 filas). */
export function pintarLeds(microbit, patron) {
  const filas = patron.split(':');
  microbit.userData.leds.forEach((fila, f) => fila.forEach((led, c) => {
    const on = filas[f]?.[c] && filas[f][c] !== '0';
    led.material.color.set(on ? 0xff2d2d : 0x3f0d0d);
    led.material.emissive.set(on ? 0xff0000 : 0x000000);
    led.material.emissiveIntensity = on ? 1.2 : 0;
  }));
}
