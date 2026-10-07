// Aspecto "como en Unity" para los astros del simulador del Sistema Solar.
// Reproduce el shader Planet.shadergraph del paquete "Planets of the Solar
// System 3D": textura equirectangular sin brillo especular + borde Fresnel
// (color y potencia por planeta, sacados de los materiales URP_*_2k).
import * as THREE from 'three';
import ringUrl from '../assets/solar/saturn_ring.png';
import milkywayUrl from '../assets/solar/milkyway.jpg';

// [r, g, b, potencia] — Color_B354DC38 y Vector1_A01F3A73 de cada material
const FRESNEL = {
    Mercurio: [0.79, 0.71, 0.42, 3], Venus: [0.83, 0.51, 0.33, 2], Tierra: [0.66, 0.85, 1, 3],
    Luna: [1, 1, 1, 5], Marte: [0.99, 0.55, 0.54, 3], Jupiter: [0.39, 0.33, 0.22, 2],
    Saturno: [0.51, 0.45, 0.26, 4], Urano: [0.6, 0.69, 1, 5], Neptuno: [0.37, 0.65, 1, 2],
};

export function materialPlaneta(cuerpo, loader, track) {
    const t = cuerpo.tex ? track(loader.load(cuerpo.tex)) : null;
    if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    const mat = track(new THREE.MeshStandardMaterial({ map: t, color: t ? 0xffffff : new THREE.Color(cuerpo.color), roughness: 1, metalness: 0 }));
    const f = FRESNEL[cuerpo.id];
    if (f) {
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uRim = { value: new THREE.Color(f[0], f[1], f[2]) };
            sh.uniforms.uRimPow = { value: f[3] };
            sh.fragmentShader = 'uniform vec3 uRim;\nuniform float uRimPow;\n' + sh.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uRim * pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), uRimPow);'
            );
        };
        mat.customProgramCacheKey = () => 'planeta-fresnel';
    }
    return mat;
}

// Sol: superficie granulada animada (ruido fbm) + oscurecimiento del limbo
const SOL_VS = `
varying vec3 vPos; varying vec3 vN; varying vec3 vV;
void main() {
  vPos = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SOL_FS = `
uniform float uT; uniform float uEsc;
varying vec3 vPos; varying vec3 vN; varying vec3 vV;
float h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 p = normalize(vPos) * 3.2;
  float n = fbm(p + vec3(uT * 0.05, uT * 0.03, -uT * 0.04));
  float m = fbm(p * 2.5 - vec3(uT * 0.08));
  float v = clamp(n * 0.75 + m * 0.45, 0.0, 1.0);
  vec3 c = mix(vec3(0.85, 0.25, 0.02), vec3(1.0, 0.62, 0.12), smoothstep(0.25, 0.6, v));
  c = mix(c, vec3(1.0, 0.93, 0.62), smoothstep(0.62, 0.9, v));
  float mu = clamp(dot(vN, vV), 0.0, 1.0);
  c *= 0.55 + 0.6 * pow(mu, 0.45);
  c += vec3(1.0, 0.55, 0.15) * pow(1.0 - mu, 3.0) * 0.6;
  gl_FragColor = vec4(c * 1.15, 1.0);
}`;

export function materialSol(track) {
    return track(new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: SOL_VS, fragmentShader: SOL_FS }));
}

// Halo del Sol (dos capas aditivas)
let haloTex = null;
function texHalo() {
    if (haloTex) return haloTex;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.18, 'rgba(255,200,110,0.75)');
    g.addColorStop(0.4, 'rgba(255,140,40,0.25)'); g.addColorStop(1, 'rgba(255,90,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    haloTex = new THREE.CanvasTexture(c);
    return haloTex;
}
export function haloSol(radio, track) {
    const grupo = new THREE.Group();
    [[4.2, 0.85], [9, 0.35]].forEach(([esc, op]) => {
        const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: texHalo(), color: 0xffffff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })));
        s.scale.setScalar(radio * esc);
        grupo.add(s);
    });
    return grupo;
}

// Anillo de Saturno con la textura de Unity (tira radial: interior → exterior)
export function anilloSaturno(radio, loader, track) {
    const ri = radio * 1.24, re = radio * 2.27;
    const geo = track(new THREE.RingGeometry(ri, re, 128, 1));
    const pos = geo.attributes.position, uv = geo.attributes.uv, v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v3.fromBufferAttribute(pos, i); uv.setXY(i, (v3.length() - ri) / (re - ri), 0.5); }
    const t = track(loader.load(ringUrl)); t.colorSpace = THREE.SRGBColorSpace;
    const mat = track(new THREE.MeshStandardMaterial({ map: t, alphaMap: t, transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, depthWrite: false, emissive: 0x2a2418 }));
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2;
    return ring;
}

// Fondo: panorámica de la Vía Láctea (el skybox de la escena de Unity)
export function fondoViaLactea(scene, loader, track, intensidad = 0.55) {
    const t = track(loader.load(milkywayUrl));
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
    scene.backgroundIntensity = intensidad;
}
