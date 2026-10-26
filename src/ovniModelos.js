// Animales animados (.glb) para Ovni Abducción.
// Salen del pack «Farm Animals» de Quaternius (CC0), preparados con
// scripts/blender/preparar_animales.py: 1 unidad de alto, origen en los pies,
// cabeza hacia +Z y clips Idle, Walk, WalkSlow, Run, Jump y Death.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonarConEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const MODELOS_GRANJA = ['vaca', 'oveja', 'cerdo', 'caballo', 'llama', 'perro'];
const RUTA = '/modelos/granja/';

let promesa = null;

/** Carga (una sola vez por sesión) los .glb disponibles → { tipo: gltf }. Los que fallen se omiten. */
export const cargarModelosGranja = () => {
    if (!promesa) {
        const loader = new GLTFLoader();
        promesa = Promise.all(MODELOS_GRANJA.map(tipo =>
            loader.loadAsync(RUTA + tipo + '.glb')
                .then(gltf => [tipo, gltf])
                .catch(e => { console.warn(`[Ovni] No se pudo cargar ${tipo}.glb:`, e?.message || e); return [tipo, null]; }),
        )).then(lista => {
            const modelos = Object.fromEntries(lista.filter(([, g]) => g));
            if (!Object.keys(modelos).length) promesa = null; // se reintentará la próxima vez
            return modelos;
        });
    }
    return promesa;
};

/**
 * Copia independiente (con su propio esqueleto) de un modelo cargado.
 * Geometrías y materiales se comparten con el original: se marcan con
 * userData.compartido para no liberarlos al cerrar una partida.
 */
export const instanciarModelo = (gltf, escala) => {
    const obj = clonarConEsqueleto(gltf.scene);
    obj.scale.setScalar(escala);
    obj.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.frustumCulled = false; // la caja de una malla con esqueleto no sigue a la animación
            o.userData.compartido = true;
        }
    });
    const mixer = new THREE.AnimationMixer(obj);
    const acciones = {};
    gltf.animations.forEach(clip => {
        const accion = mixer.clipAction(clip);
        if (clip.name === 'Death' || clip.name === 'Jump') {
            accion.setLoop(THREE.LoopOnce, 1);
            accion.clampWhenFinished = true;
        }
        acciones[clip.name] = accion;
    });
    return { obj, mixer, acciones, actual: null, accion: null };
};

/** Cambia de clip con fundido (no hace nada si ya está sonando). */
export const ponerClip = (modelo, nombre, fundido = 0.25) => {
    if (modelo.actual === nombre) return;
    const sig = modelo.acciones[nombre] || modelo.acciones.Idle;
    if (!sig) return;
    sig.reset();
    sig.enabled = true;
    sig.setEffectiveWeight(1);
    sig.setEffectiveTimeScale(1);
    // los bucles largos empiezan en un punto al azar para que no vayan todos sincronizados
    if (nombre === 'Idle' || nombre === 'Walk' || nombre === 'WalkSlow') sig.time = Math.random() * sig.getClip().duration;
    sig.play();
    if (modelo.accion && modelo.accion !== sig) modelo.accion.crossFadeTo(sig, fundido, false);
    modelo.accion = sig;
    modelo.actual = nombre;
};
