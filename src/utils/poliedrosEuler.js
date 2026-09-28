// poliedrosEuler.js — Los cinco sólidos platónicos y su montaje 3D para contar
// vértices, aristas y caras (fórmula de Euler: V − A + C = 2).
// Los datos los comparten el visor 2D de Geometrix y la Sala de Geometría 3D.
import * as THREE from 'three';

const phi = (1 + Math.sqrt(5)) / 2;
const invPhi = 1 / phi;

export const POLIEDROS = {
    tetraedro: {
        name: 'Tetraedro', emoji: '🔺',
        rgb: [255, 89, 94], lightColor: '#ffb3b5', color: '#FF595E',
        v: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]],
        f: [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]],
        stats: { caras: 4, vertices: 4, aristas: 6 },
        fact: "¡Es una pirámide de base triangular! Su recortable son 4 triángulos."
    },
    cubo: {
        name: 'Cubo', emoji: '🧊',
        rgb: [25, 130, 196], lightColor: '#a6d4f2', color: '#1982C4',
        v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
        f: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]],
        stats: { caras: 6, vertices: 8, aristas: 12 },
        fact: "¡Es perfecto para jugar a los dados! Su recortable es una cruz de 6 cuadrados."
    },
    octaedro: {
        name: 'Octaedro', emoji: '💎',
        rgb: [138, 201, 38], lightColor: '#d3f29b', color: '#8AC926',
        v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
        f: [[4, 0, 2], [4, 2, 1], [4, 1, 3], [4, 3, 0], [5, 2, 0], [5, 1, 2], [5, 3, 1], [5, 0, 3]],
        stats: { caras: 8, vertices: 6, aristas: 12 },
        fact: "Parecen dos pirámides unidas por la base. ¡Tiene 8 caras triangulares!"
    },
    dodecaedro: {
        name: 'Dodecaedro', emoji: '⚽',
        rgb: [255, 202, 58], lightColor: '#ffe89e', color: '#FFCA3A',
        v: [
            [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
            [0, -invPhi, -phi], [0, invPhi, -phi], [0, -invPhi, phi], [0, invPhi, phi],
            [-invPhi, -phi, 0], [invPhi, -phi, 0], [-invPhi, phi, 0], [invPhi, phi, 0],
            [-phi, 0, -invPhi], [phi, 0, -invPhi], [-phi, 0, invPhi], [phi, 0, invPhi]
        ],
        f: [
            [3, 9, 2, 15, 14], [2, 9, 8, 1, 17], [1, 8, 0, 12, 13], [0, 8, 9, 3, 16],
            [0, 16, 18, 4, 12], [5, 13, 1, 17, 19], [4, 12, 13, 5, 10], [6, 11, 10, 5, 19],
            [7, 14, 15, 6, 11], [3, 16, 18, 7, 14], [2, 17, 19, 6, 15], [4, 10, 11, 7, 18]
        ],
        stats: { caras: 12, vertices: 20, aristas: 30 },
        fact: "Sus 12 caras son pentágonos exactos. ¡Fíjate que es como un balón de fútbol clásico!"
    },
    icosaedro: {
        name: 'Icosaedro', emoji: '🔮',
        rgb: [106, 76, 147], lightColor: '#bc9fe0', color: '#6A4C93',
        v: [
            [0, -1, -phi], [0, 1, -phi], [0, -1, phi], [0, 1, phi],
            [-1, -phi, 0], [1, -phi, 0], [-1, phi, 0], [1, phi, 0],
            [-phi, 0, -1], [phi, 0, -1], [-phi, 0, 1], [phi, 0, 1]
        ],
        f: [
            [0, 1, 8], [0, 1, 9], [0, 4, 8], [0, 5, 9], [0, 4, 5], [1, 6, 8], [1, 7, 9], [1, 6, 7],
            [2, 3, 10], [2, 3, 11], [2, 4, 10], [2, 5, 11], [2, 4, 5], [3, 6, 10], [3, 7, 11], [3, 6, 7],
            [4, 8, 10], [5, 9, 11], [6, 8, 10], [7, 9, 11]
        ],
        stats: { caras: 20, vertices: 12, aristas: 30 },
        fact: "¡Es el sólido con más caras! A los aventureros les encanta usarlo como dado de 20."
    }
};

export const IDS_POLIEDROS = ['tetraedro', 'cubo', 'octaedro', 'dodecaedro', 'icosaedro'];

/** Aristas únicas deducidas de las caras: pares [a, b] con a < b. */
export function aristasDe(datos) {
    const vistas = new Set();
    const out = [];
    datos.f.forEach(cara => {
        for (let i = 0; i < cara.length; i++) {
            const a = cara[i], b = cara[(i + 1) % cara.length];
            const clave = a < b ? `${a}-${b}` : `${b}-${a}`;
            if (vistas.has(clave)) continue;
            vistas.add(clave);
            out.push(a < b ? [a, b] : [b, a]);
        }
    });
    return out;
}

const COL_SIN = { V: 0xffffff, A: 0x27384a, C: null };   // C usa el color del poliedro
const COL_MARCA = { V: 0xffd54f, A: 0xffd54f, C: 0x66bb6a };

/**
 * Monta el poliedro en un grupo de three.js con cada vértice, arista y cara como
 * objeto independiente, para poder señalarlos uno a uno al contarlos.
 */
export function crearPoliedroEuler(id, radio = 0.45) {
    const datos = POLIEDROS[id] || POLIEDROS.cubo;
    const basura = [];
    const reg = o => { basura.push(o); return o; };

    // normalizar para que todos ocupen lo mismo
    const puntos = datos.v.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const maxR = Math.max(...puntos.map(p => p.length()));
    puntos.forEach(p => p.multiplyScalar(radio / maxR));

    const grupo = new THREE.Group();
    const giratorio = new THREE.Group();      // lo que se puede hacer girar solo
    grupo.add(giratorio);

    const colorBase = new THREE.Color(datos.color);
    const piezas = [];

    /* ── caras ── */
    const gCaras = new THREE.Group();
    giratorio.add(gCaras);
    datos.f.forEach((cara, idx) => {
        const centro = new THREE.Vector3();
        cara.forEach(k => centro.add(puntos[k]));
        centro.divideScalar(cara.length);
        const pos = [];
        for (let i = 0; i < cara.length; i++) {
            const A = puntos[cara[i]], B = puntos[cara[(i + 1) % cara.length]];
            pos.push(centro.x, centro.y, centro.z, A.x, A.y, A.z, B.x, B.y, B.z);
        }
        const geo = reg(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        const mat = reg(new THREE.MeshStandardMaterial({
            color: colorBase, roughness: 0.45, metalness: 0.05,
            side: THREE.DoubleSide, transparent: true, opacity: 0.55,
        }));
        const m = new THREE.Mesh(geo, mat);
        m.userData = { pieza: 'C', idx, clave: `C${idx}` };
        gCaras.add(m);
        piezas.push(m);
    });

    /* ── aristas ── */
    const aristas = aristasDe(datos);
    const geoArista = reg(new THREE.CylinderGeometry(1, 1, 1, 8));
    const gAristas = new THREE.Group();
    giratorio.add(gAristas);
    const grosor = radio * 0.035;
    aristas.forEach(([a, b], idx) => {
        const A = puntos[a], B = puntos[b];
        const mat = reg(new THREE.MeshStandardMaterial({ color: COL_SIN.A, roughness: 0.4, metalness: 0.2 }));
        const m = new THREE.Mesh(geoArista, mat);
        m.position.copy(A).add(B).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
        m.scale.set(grosor, A.distanceTo(B), grosor);
        m.userData = { pieza: 'A', idx, clave: `A${idx}` };
        gAristas.add(m);
        piezas.push(m);
    });

    /* ── vértices ── */
    const geoVert = reg(new THREE.SphereGeometry(radio * 0.075, 16, 12));
    const gVert = new THREE.Group();
    giratorio.add(gVert);
    puntos.forEach((p, idx) => {
        const mat = reg(new THREE.MeshStandardMaterial({ color: COL_SIN.V, roughness: 0.3, metalness: 0.1 }));
        const m = new THREE.Mesh(geoVert, mat);
        m.position.copy(p);
        m.userData = { pieza: 'V', idx, clave: `V${idx}` };
        gVert.add(m);
        piezas.push(m);
    });

    /** Repinta según el conjunto de claves marcadas. */
    const aplicarMarcas = (marcadas) => {
        piezas.forEach(m => {
            const on = marcadas.has(m.userData.clave);
            const t = m.userData.pieza;
            if (t === 'C') {
                m.material.color.set(on ? COL_MARCA.C : colorBase);
                m.material.opacity = on ? 0.82 : 0.55;
                m.material.emissive.setHex(on ? 0x1b3d22 : 0x000000);
            } else {
                m.material.color.setHex(on ? COL_MARCA[t] : COL_SIN[t]);
                m.material.emissive.setHex(on ? 0x4a3800 : 0x000000);
            }
        });
    };
    aplicarMarcas(new Set());

    return {
        grupo, giratorio, piezas, datos,
        totales: { V: datos.v.length, A: aristas.length, C: datos.f.length },
        aplicarMarcas,
        setCaras: v => { gCaras.visible = v; },
        dispose: () => basura.forEach(o => o.dispose?.()),
    };
}
