// Ambiente y efectos de Ovni Abducción, todo con código (no pesa nada):
//  - hierba mecida por el viento (shader sobre las matas instanciadas)
//  - luciérnagas que flotan y parpadean
//  - bancos de niebla baja que se desplazan
//  - halos de luz (ventanas, farol y panza de cada ovni) como «bloom» barato
//  - chispas en espiral que suben por el rayo tractor
//  - ondas en el suelo y destello en la nave al abducir / acertar / fallar
// Funciona igual con una vista o con la pantalla partida (no usa postprocesado).
import * as THREE from 'three';

const texturaSuave = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
};

const texturaNube = () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
        const x = 40 + Math.random() * 176, y = 44 + Math.random() * 40, r = 26 + Math.random() * 30;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
    }
    return new THREE.CanvasTexture(c);
};

/** Dobla las matas de hierba con una ola de viento que recorre el prado. */
export const vientoEnHierba = (material, uTiempo) => {
    material.onBeforeCompile = (sh) => {
        sh.uniforms.uTiempo = uTiempo;
        sh.vertexShader = 'uniform float uTiempo;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
                vec2 base = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
            #else
                vec2 base = vec2(0.0);
            #endif
            float ola = sin(uTiempo * 1.6 - base.x * 0.09 + base.y * 0.04) * 0.5 + 0.5;
            float doblez = position.y * position.y * 1.6;
            transformed.x += (0.15 + ola * 0.45) * doblez;
            transformed.z += sin(uTiempo * 2.3 + base.y * 0.3) * 0.08 * doblez;`);
    };
    material.customProgramCacheKey = () => 'ovni-hierba-viento';
    material.needsUpdate = true;
};

/**
 * @param {THREE.Scene} escena
 * @param {object} o
 * @param {number} o.limite       medio lado del prado
 * @param {number} o.alturaOvni
 * @param {number} o.radioRayo
 * @param {THREE.Texture[]} o.texturas  aquí se apuntan las texturas creadas (para liberarlas)
 * @param {Array<[number,number,number,number,number]>} o.halos  [x, y, z, color, tamaño] de luces fijas
 */
export function crearAmbiente(escena, { limite, alturaOvni, radioRayo, texturas, halos = [] }) {
    const tSuave = texturaSuave();
    const tNube = texturaNube();
    texturas.push(tSuave, tNube);
    const uViento = { value: 0 };
    const sprite = (color, opacidad, aditivo = true, mapa = tSuave) => new THREE.Sprite(new THREE.SpriteMaterial({
        map: mapa, color, transparent: true, opacity: opacidad, depthWrite: false,
        blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));

    // ── Luciérnagas ──
    const NL = 150;
    const lBase = new Float32Array(NL * 3);
    const lFase = new Float32Array(NL);
    const lPos = new Float32Array(NL * 3);
    const lCol = new Float32Array(NL * 3);
    for (let i = 0; i < NL; i++) {
        lBase[i * 3] = (Math.random() * 2 - 1) * (limite + 8);
        lBase[i * 3 + 1] = 0.5 + Math.random() * 2.8;
        lBase[i * 3 + 2] = (Math.random() * 2 - 1) * (limite + 8);
        lFase[i] = Math.random() * 100;
    }
    const geoL = new THREE.BufferGeometry();
    geoL.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
    geoL.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
    const luciernagas = new THREE.Points(geoL, new THREE.PointsMaterial({
        size: 0.6, map: tSuave, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    luciernagas.frustumCulled = false;
    escena.add(luciernagas);
    const colLuz = new THREE.Color(0xd9f99d);

    // ── Niebla baja ──
    const nieblas = Array.from({ length: 16 }, () => {
        const s = sprite(0xa78bfa, 0.11, false, tNube);
        s.scale.set(26 + Math.random() * 18, 6 + Math.random() * 4, 1);
        s.position.set((Math.random() * 2 - 1) * 85, 1.4 + Math.random() * 1.4, (Math.random() * 2 - 1) * 85);
        s.userData.v = 0.4 + Math.random() * 0.6;
        escena.add(s);
        return s;
    });

    // ── Halos de luces fijas (ventanas, farol) ──
    halos.forEach(([x, y, z, color, tam]) => {
        const s = sprite(color, 0.55);
        s.scale.set(tam, tam, 1);
        s.position.set(x, y, z);
        escena.add(s);
    });

    // ── Ondas en el suelo ──
    const geoOnda = new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2);
    const ondas = Array.from({ length: 10 }, () => {
        const m = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.position.y = 0.1; m.visible = false; m.userData = { t: 0, dur: 1, radio: 5 };
        escena.add(m);
        return m;
    });
    let sigOnda = 0;
    const onda = (x, z, color, radio = 5, dur = 0.8) => {
        const m = ondas[sigOnda]; sigOnda = (sigOnda + 1) % ondas.length;
        m.position.x = x; m.position.z = z;
        m.material.color.set(color);
        m.userData = { t: dur, dur, radio };
        m.visible = true;
    };

    // ── Chispas en espiral dentro del rayo ──
    const NC = 600;
    const cPos = new Float32Array(NC * 3).fill(-999);
    const cCol = new Float32Array(NC * 3);
    const cVida = new Float32Array(NC);
    const cAng = new Float32Array(NC);
    const cRad = new Float32Array(NC);
    const cVy = new Float32Array(NC);
    const cDueño = new Int8Array(NC);
    const geoC = new THREE.BufferGeometry();
    geoC.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    geoC.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    const chispas = new THREE.Points(geoC, new THREE.PointsMaterial({
        size: 0.3, map: tSuave, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    chispas.frustumCulled = false;
    escena.add(chispas);
    let sigC = 0;
    const emitir = (j, n) => {
        for (let i = 0; i < n; i++) {
            const k = sigC; sigC = (sigC + 1) % NC;
            cDueño[k] = j.idx;
            cAng[k] = Math.random() * Math.PI * 2;
            cRad[k] = radioRayo * (0.25 + Math.random() * 0.6);
            cVy[k] = 2.5 + Math.random() * 3.5;
            cVida[k] = 1;
            cPos[k * 3 + 1] = 0.1;
        }
    };

    // ── Halo y destello de cada nave ──
    const naves = new Map();
    const prepararJugadores = (jugadores) => {
        jugadores.forEach(j => {
            const halo = sprite(j.color, 0.3);
            halo.position.y = -0.8; halo.scale.set(7, 7, 1);
            const flash = sprite(0xffffff, 0);
            flash.scale.set(2, 2, 1);
            j.O.ovni.add(halo, flash);
            naves.set(j.idx, { halo, flash, t: 0, acum: 0 });
        });
    };
    const destello = (j, color) => {
        const n = naves.get(j.idx);
        if (!n) return;
        n.flash.material.color.set(color);
        n.t = 0.55;
    };

    const actualizar = (dt, t, jugadores) => {
        uViento.value = t;

        for (let i = 0; i < NL; i++) {
            const f = lFase[i];
            lPos[i * 3] = lBase[i * 3] + Math.sin(t * 0.35 + f) * 2.2;
            lPos[i * 3 + 1] = lBase[i * 3 + 1] + Math.sin(t * 0.9 + f * 1.7) * 0.5;
            lPos[i * 3 + 2] = lBase[i * 3 + 2] + Math.cos(t * 0.28 + f) * 2.2;
            const k = Math.pow(Math.max(0, Math.sin(t * 1.7 + f * 3.1)), 3);
            lCol[i * 3] = colLuz.r * k; lCol[i * 3 + 1] = colLuz.g * k; lCol[i * 3 + 2] = colLuz.b * k;
        }
        geoL.attributes.position.needsUpdate = true;
        geoL.attributes.color.needsUpdate = true;

        nieblas.forEach(s => {
            s.position.x += s.userData.v * dt;
            if (s.position.x > 95) s.position.x = -95;
        });

        ondas.forEach(m => {
            if (!m.visible) return;
            m.userData.t -= dt;
            const k = m.userData.t / m.userData.dur;
            if (k <= 0) { m.visible = false; return; }
            const r = 0.5 + (1 - k) * m.userData.radio;
            m.scale.set(r, 1, r);
            m.material.opacity = k * 0.9;
        });

        // chispas: muchas mientras se abduce, pocas si solo hay un objetivo a tiro
        jugadores.forEach(j => {
            const n = naves.get(j.idx);
            if (!n) return;
            const ritmo = j.abduciendo ? 110 : j.objetivoVisible ? 14 : 0;
            n.acum += ritmo * dt;
            const enteras = Math.floor(n.acum);
            if (enteras) { emitir(j, enteras); n.acum -= enteras; }

            const fuerza = j.rayo.uniforms.uFuerza.value;
            n.halo.material.opacity = 0.18 + fuerza * 0.4 + Math.sin(t * 3 + j.idx) * 0.04;
            const hs = 6 + fuerza * 4; n.halo.scale.set(hs, hs, 1);
            if (n.t > 0) {
                n.t = Math.max(0, n.t - dt);
                const k = n.t / 0.55;
                const fs = 3 + (1 - k) * 18; n.flash.scale.set(fs, fs, 1);
                n.flash.material.opacity = k;
            } else n.flash.material.opacity = 0;
        });
        for (let i = 0; i < NC; i++) {
            if (cVida[i] <= 0) continue;
            const j = jugadores[cDueño[i]];
            const y = cPos[i * 3 + 1] + cVy[i] * dt;
            if (!j || y > alturaOvni - 0.8) { cVida[i] = 0; cPos[i * 3 + 1] = -999; continue; }
            cAng[i] += (2.4 + 1.2 / (cRad[i] + 0.3)) * dt;
            cRad[i] *= 1 - 0.28 * dt;
            cPos[i * 3] = j.ovni.x + Math.cos(cAng[i]) * cRad[i];
            cPos[i * 3 + 1] = y;
            cPos[i * 3 + 2] = j.ovni.z + Math.sin(cAng[i]) * cRad[i];
            const brillo = 0.6 + 0.4 * Math.min(1, y / 2);
            const c = j.rayoRojoHasta > t ? { r: 1, g: 0.25, b: 0.35 } : j.color;
            cCol[i * 3] = Math.min(1, c.r * brillo + 0.25); cCol[i * 3 + 1] = Math.min(1, c.g * brillo + 0.25); cCol[i * 3 + 2] = Math.min(1, c.b * brillo + 0.25);
        }
        geoC.attributes.position.needsUpdate = true;
        geoC.attributes.color.needsUpdate = true;
    };

    return { uViento, actualizar, onda, destello, prepararJugadores };
}
