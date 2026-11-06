// Pantalla LCD1602 en 3D (plano con textura de canvas que se repinta al cambiar el texto).
// La usan la casa (escenaCasa.js) y la placa Imagina TdR STEAM (escenaTdr.js).
import * as THREE from 'three';

export function crearLcd3D({ ancho = 1.16, alto = 0.36 } = {}) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 512; lienzo.height = 160;
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex }));
  let pintada = '';
  function pintar(lineas = ['', ''], luz = 1) {
    const clave = lineas.join('|') + luz;
    if (clave === pintada) return;
    pintada = clave;
    const g = lienzo.getContext('2d');
    g.fillStyle = luz ? '#2563eb' : '#1e293b'; g.fillRect(0, 0, 512, 160);
    g.font = 'bold 54px ui-monospace, Consolas, monospace'; g.textBaseline = 'middle';
    g.fillStyle = luz ? '#f8fafc' : '#64748b';
    lineas.forEach((l, f) => { [...(l || '').padEnd(16).slice(0, 16)].forEach((ch, i) => g.fillText(ch === '`' ? '°' : ch, 10 + i * 31.2, 45 + f * 72)); });
    tex.needsUpdate = true;
  }
  pintar(['PiKT Smart Home', 'Laboratorio']);
  return { mesh, pintar };
}
