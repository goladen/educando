// desarrolloPlano.js — Desarrollo plano (red) de los cuerpos geométricos de la Sala 3D.
// El reparto de las piezas es el de los recortables de clase:
//   · prisma y cubo → banda de caras laterales en fila + las dos bases pegadas a la primera cara
//   · pirámide      → base en el centro y los triángulos abatidos alrededor
//   · cilindro      → rectángulo con un círculo tangente a cada lado
//   · cono          → sector circular con el círculo de la base tangente al arco
// Se pliega/despliega con aplicar(t), t ∈ [0, 1]: 0 = cuerpo montado, 1 = red extendida.
// Al desplegarse, la red se levanta sobre una cartulina para que no se confunda con el suelo.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.min(1, Math.max(0, t));
const ALTURA_VUELO = 0.7;      // a qué altura queda la red desplegada

export const areaBasePoligono = (n, r) => (n / 2) * r * r * Math.sin(TAU / n);
export const ladoPoligono = (n, r) => 2 * r * Math.sin(Math.PI / n);
export const apotemaPoligono = (n, r) => r * Math.cos(Math.PI / n);

/* ═══════════════ geometrías auxiliares ═══════════════ */

/** Polígono regular de n lados y radio r en el plano XZ (normal hacia +Y). */
function geoPoligonoXZ(n, r) {
    const pos = [];
    for (let k = 0; k < n; k++) {
        const a = (TAU * k) / n, b = (TAU * (k + 1)) / n;
        pos.push(0, 0, 0, r * Math.sin(a), 0, r * Math.cos(a), r * Math.sin(b), 0, r * Math.cos(b));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}

/** Polígono regular apoyado en un lado sobre el eje X (de −L/2 a L/2), en el plano XY. */
function geoPoligonoXY(n, r) {
    const ap = apotemaPoligono(n, r);
    const P = k => {
        const al = -Math.PI / 2 + Math.PI / n + (TAU * k) / n;
        return [r * Math.cos(al), ap + r * Math.sin(al)];
    };
    const pos = [];
    for (let k = 0; k < n; k++) {
        const [x1, y1] = P(k), [x2, y2] = P(k + 1);
        pos.push(0, ap, 0, x1, y1, 0, x2, y2, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}

/** Pestaña de pegado: trapecio apoyado en el eje X (de −largo/2 a largo/2), abierto hacia +Y. */
function geoPestana(largo, alto) {
    const s = Math.min(alto * 0.7, largo * 0.28);
    const a = -largo / 2, b = largo / 2;
    const pos = [
        a, 0, 0, b, 0, 0, b - s, alto, 0,
        a, 0, 0, b - s, alto, 0, a + s, alto, 0,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}

/** Malla reticulada (SEG × 2) para las superficies laterales curvas. */
function geoRejilla(seg) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((seg + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < seg; i++) {
        const a = i * 2, b = (i + 1) * 2;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    g.setIndex(idx);
    return g;
}

/* ═══════════════ desarrollo ═══════════════ */

export function crearDesarrollo({ tipo, n = 6, r = 0.5, h = 1, color = 0x66bb6a }) {
    if (tipo === 'ESFERA') return null;

    // el cubo es un prisma cuadrangular cuya altura coincide con el lado
    let T = tipo, N = n, H = h;
    if (tipo === 'CUBO') { T = 'PRISMA'; N = 4; H = r * Math.SQRT2; }
    if (T !== 'PRISMA' && T !== 'PIRAMIDE' && T !== 'CILINDRO' && T !== 'CONO') return null;

    let mostrarPestanas = true;
    const basura = [];
    const reg = o => { basura.push(o); return o; };

    const matCara = reg(new THREE.MeshStandardMaterial({
        color, roughness: 0.55, metalness: 0.03, side: THREE.DoubleSide,
    }));
    const matBase = reg(new THREE.MeshStandardMaterial({
        color: 0xffb300, roughness: 0.55, metalness: 0.03, side: THREE.DoubleSide,
    }));
    const matPestana = reg(new THREE.MeshStandardMaterial({
        color: 0x90a4ae, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.75,
    }));
    const matLinea = reg(new THREE.LineBasicMaterial({ color: 0x08161f }));
    const matPliegue = reg(new THREE.LineDashedMaterial({
        color: 0x08161f, dashSize: 0.028, gapSize: 0.022, transparent: true, opacity: 0.55,
    }));

    const grupo = new THREE.Group();
    const marco = new THREE.Group();         // coloca y orienta la lámina ya desplegada
    grupo.add(marco);
    const raiz = new THREE.Group();          // contiene las piezas
    marco.add(raiz);
    const pestanas = [];

    const conAristas = (malla) => {
        malla.add(new THREE.LineSegments(reg(new THREE.EdgesGeometry(malla.geometry, 1)), matLinea));
        return malla;
    };

    /** Pestaña apoyada en la arista A→B, en el plano de la cara, hacia el lado contrario a `dentro`. */
    const anadirPestana = (padre, A, B, dentro, alto) => {
        const largo = A.distanceTo(B);
        if (largo < 1e-5 || alto < 1e-4) return;
        const M = A.clone().add(B).multiplyScalar(0.5);
        const ejeX = B.clone().sub(A).normalize();
        const nrm = B.clone().sub(A).cross(dentro.clone().sub(A)).normalize();
        const ejeY = new THREE.Vector3().crossVectors(nrm, ejeX).normalize();
        if (ejeY.dot(dentro.clone().sub(M)) > 0) ejeY.negate();          // siempre hacia fuera
        const ejeZ = new THREE.Vector3().crossVectors(ejeX, ejeY);
        const g = new THREE.Group();
        g.position.copy(M);
        g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ejeX, ejeY, ejeZ));
        g.add(conAristas(new THREE.Mesh(reg(geoPestana(largo, alto)), matPestana)));
        g.visible = false;
        padre.add(g);
        pestanas.push(g);
    };

    /**
     * Cierra el montaje: mide la red desplegada, le pone debajo una cartulina y
     * hace que todo se eleve al desplegarse para que no se confunda con el suelo.
     */
    const finalizar = (aplicarPiezas, info) => {
        aplicarPiezas(1);
        const caja = new THREE.Box3().setFromObject(raiz);
        const tam = caja.getSize(new THREE.Vector3());
        const cen = caja.getCenter(new THREE.Vector3());
        const margen = Math.max(0.05, Math.max(tam.x, tam.z) * 0.05);
        // el centro del tablero pasa a ser el origen del marco: así gira sobre sí mismo
        raiz.position.set(-cen.x, 0, -cen.z);
        const radio = 0.5 * Math.hypot(tam.x + 2 * margen, tam.z + 2 * margen);
        let vertical = false;
        const matTablero = reg(new THREE.MeshStandardMaterial({
            color: 0xf5efe2, roughness: 0.95, metalness: 0, transparent: true, opacity: 0,
        }));
        const tablero = new THREE.Mesh(
            reg(new THREE.BoxGeometry(tam.x + margen * 2, 0.014, tam.z + margen * 2)),
            matTablero
        );
        tablero.position.set(cen.x, -0.013, cen.z);
        tablero.visible = false;
        raiz.add(tablero);
        const borde = new THREE.LineSegments(reg(new THREE.EdgesGeometry(tablero.geometry)), matLinea);
        tablero.add(borde);
        aplicarPiezas(0);

        let tActual = 0;
        const aplicar = (t) => {
            tActual = t;
            aplicarPiezas(t);
            // la lámina se eleva y, si se pide, se pone de frente como un póster
            const tv = clamp01((t - 0.25) / 0.75);
            marco.rotation.x = vertical ? -(Math.PI / 2) * tv : 0;
            marco.position.set(cen.x, lerp(0, vertical ? ALTURA_VUELO + radio * 0.9 : ALTURA_VUELO, tv), cen.z);
            const op = clamp01((t - 0.4) / 0.35);
            const trans = op < 0.99;
            if (matTablero.transparent !== trans) { matTablero.transparent = trans; matTablero.needsUpdate = true; }
            matTablero.opacity = op;
            tablero.visible = op > 0.02;
            pestanas.forEach(p => { p.visible = mostrarPestanas && t > 0.86; });
        };
        aplicar(0);

        return {
            grupo, aplicar,
            setPestanas: v => { mostrarPestanas = v; aplicar(tActual); },
            setVertical: v => { vertical = v; aplicar(tActual); },
            /** Centro y radio de la lámina desplegada, en coordenadas del grupo. */
            encuadre: () => ({
                centro: new THREE.Vector3(cen.x, vertical ? ALTURA_VUELO + radio * 0.9 : ALTURA_VUELO, cen.z),
                radio,
                vertical,
            }),
            info: { ...info, radio },
            dispose: () => basura.forEach(o => o.dispose?.()),
        };
    };

    /* ───────── PRISMA / CUBO: banda de caras laterales en fila ───────── */
    if (T === 'PRISMA') {
        const L = ladoPoligono(N, r);
        const ap = apotemaPoligono(N, r);
        const AB = areaBasePoligono(N, r);
        const giro = TAU / N;                        // ángulo exterior entre caras contiguas
        const altoPest = Math.min(L, H) * 0.2;

        // base inferior: se queda fija
        const base = conAristas(new THREE.Mesh(reg(geoPoligonoXZ(N, r)), matBase));
        base.position.y = 0.0015;
        raiz.add(base);

        // bisagra sobre la arista 0 de la base: de ahí cuelga toda la banda lateral
        const A0 = new THREE.Vector3(0, 0, r);
        const A1 = new THREE.Vector3(r * Math.sin(giro), 0, r * Math.cos(giro));
        const M0 = A0.clone().add(A1).multiplyScalar(0.5);
        const e0 = A1.clone().sub(A0).normalize();
        const z0 = e0.clone().cross(UP);
        if (z0.dot(M0) < 0) { e0.negate(); z0.negate(); }
        // OJO: `rotation` y `quaternion` son la misma rotación, así que la orientación de la
        // arista y el giro de la bisagra tienen que ir en dos grupos distintos.
        const orientBase = new THREE.Group();
        orientBase.position.copy(M0);
        orientBase.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(e0, UP, z0));
        raiz.add(orientBase);
        const bisagraBase = new THREE.Group();
        orientBase.add(bisagraBase);

        // cadena de caras: cada una articulada en la arista vertical que comparte con la anterior
        const articulaciones = [];
        let padre = bisagraBase;
        for (let k = 0; k < N; k++) {
            if (k === 0) {
                const geo = reg(new THREE.PlaneGeometry(L, H));
                geo.translate(0, H / 2, 0);                       // x ∈ [−L/2, L/2]
                bisagraBase.add(conAristas(new THREE.Mesh(geo, matCara)));
                continue;
            }
            const art = new THREE.Group();
            art.position.set(k === 1 ? L / 2 : L, 0, 0);
            padre.add(art);
            articulaciones.push(art);
            padre = art;

            const geo = reg(new THREE.PlaneGeometry(L, H));
            geo.translate(L / 2, H / 2, 0);                       // x ∈ [0, L]
            art.add(conAristas(new THREE.Mesh(geo, matCara)));

            // línea de pliegue en la arista compartida
            const pl = new THREE.Line(reg(new THREE.BufferGeometry().setFromPoints(
                [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H, 0)])), matPliegue);
            pl.computeLineDistances();
            art.add(pl);

            // pestañas para pegar las dos bases y para cerrar la banda
            const dentro = new THREE.Vector3(L / 2, H / 2, 0);
            anadirPestana(art, new THREE.Vector3(0, 0, 0), new THREE.Vector3(L, 0, 0), dentro, altoPest);
            anadirPestana(art, new THREE.Vector3(0, H, 0), new THREE.Vector3(L, H, 0), dentro, altoPest);
            if (k === N - 1) {
                anadirPestana(art, new THREE.Vector3(L, 0, 0), new THREE.Vector3(L, H, 0), dentro, altoPest);
            }
        }

        // tapa superior: cuelga del borde de arriba de la primera cara
        const tapa = new THREE.Group();
        tapa.position.set(0, H, 0);
        tapa.add(conAristas(new THREE.Mesh(reg(geoPoligonoXY(N, r)), matBase)));
        bisagraBase.add(tapa);

        return finalizar(
            (t) => {
                const tu = clamp01(t / 0.62);                  // 1º: se desenrolla la banda
                const tb = clamp01((t - 0.42) / 0.58);         // 2º: se tumba y se abre la tapa
                articulaciones.forEach(a => { a.rotation.y = giro * (1 - tu); });
                bisagraBase.rotation.x = (Math.PI / 2) * tb;
                tapa.rotation.x = lerp(-Math.PI / 2, 0, tb);
            },
            {
                desarrollable: true,
                reparto: `Una tira de ${N} rectángulos iguales, con las dos bases pegadas a la primera cara.`,
                piezas: [
                    `2 polígonos de ${N} lados (las bases) · ${(2 * AB).toFixed(3)} m²`,
                    `${N} rectángulos de ${L.toFixed(3)} × ${H.toFixed(3)} m en fila · ${(N * L * H).toFixed(3)} m²`,
                    `La tira mide ${(N * L).toFixed(3)} m de larga: el perímetro de la base`,
                ],
                formula: `A = 2·A_base + P·h = 2·${AB.toFixed(3)} + ${(N * L).toFixed(3)}·${H.toFixed(3)}`,
                areaBase: 2 * AB, areaLateral: N * L * H, areaTotal: 2 * AB + N * L * H,
                apotema: ap,
            }
        );
    }

    /* ───────── PIRÁMIDE: base en el centro y triángulos alrededor ───────── */
    if (T === 'PIRAMIDE') {
        const L = ladoPoligono(N, r);
        const ap = apotemaPoligono(N, r);
        const AB = areaBasePoligono(N, r);
        const apLat = Math.hypot(H, ap);
        const angFinal = Math.PI - Math.atan2(H, ap);
        const altoPest = Math.min(L, apLat) * 0.18;

        const base = conAristas(new THREE.Mesh(reg(geoPoligonoXZ(N, r)), matBase));
        base.position.y = 0.0015;
        raiz.add(base);

        const bisagras = [];
        for (let k = 0; k < N; k++) {
            const a = (TAU * k) / N, b = (TAU * (k + 1)) / N;
            const A = new THREE.Vector3(r * Math.sin(a), 0, r * Math.cos(a));
            const B = new THREE.Vector3(r * Math.sin(b), 0, r * Math.cos(b));
            const M = A.clone().add(B).multiplyScalar(0.5);
            const e = B.clone().sub(A).normalize();
            const z = e.clone().cross(UP);
            if (z.dot(M) < 0) { e.negate(); z.negate(); }

            // la orientación de la arista va en un grupo y el giro de la bisagra en otro:
            // si se mezclan, three recompone los ángulos de Euler y el abatimiento sale torcido
            const orient = new THREE.Group();
            orient.position.copy(M);
            orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(e, UP, z));
            raiz.add(orient);
            const bis = new THREE.Group();
            orient.add(bis);
            bisagras.push(bis);

            const geo = reg(new THREE.BufferGeometry());
            geo.setAttribute('position', new THREE.Float32BufferAttribute(
                [-L / 2, 0, 0, L / 2, 0, 0, 0, H, -ap], 3));
            geo.computeVertexNormals();
            bis.add(conAristas(new THREE.Mesh(geo, matCara)));

            // pestaña en un lado de cada triángulo: el otro queda libre para pegarla
            anadirPestana(bis, new THREE.Vector3(-L / 2, 0, 0), new THREE.Vector3(0, H, -ap),
                new THREE.Vector3(0, H / 3, -ap / 3), altoPest);
        }

        return finalizar(
            (t) => { bisagras.forEach(b => { b.rotation.x = angFinal * t; }); },
            {
                desarrollable: true,
                reparto: `La base en el centro y los ${N} triángulos abatidos alrededor, como una estrella.`,
                piezas: [
                    `1 polígono de ${N} lados (la base) · ${AB.toFixed(3)} m²`,
                    `${N} triángulos de base ${L.toFixed(3)} m y altura ${apLat.toFixed(3)} m · ${((N * L * apLat) / 2).toFixed(3)} m²`,
                    `La altura del triángulo es la apotema de la pirámide, no su altura`,
                ],
                formula: `A = A_base + (P·ap_lat)/2 = ${AB.toFixed(3)} + (${(N * L).toFixed(3)}·${apLat.toFixed(3)})/2`,
                areaBase: AB, areaLateral: (N * L * apLat) / 2, areaTotal: AB + (N * L * apLat) / 2,
                apotema: apLat,
            }
        );
    }

    /* ───────── CILINDRO: rectángulo con un círculo tangente a cada lado ───────── */
    if (T === 'CILINDRO') {
        const SEG = 96;
        const geoLat = reg(geoRejilla(SEG));
        const lateral = new THREE.Mesh(geoLat, matCara);
        const pivote = new THREE.Group();            // bisagra tangente: la tira cae hacia fuera
        pivote.position.set(0, 0, r);
        lateral.position.set(0, 0, -r);
        pivote.add(lateral);
        raiz.add(pivote);

        const discos = [0, 1].map(() => {
            const geo = reg(new THREE.CircleGeometry(r, 72));
            geo.rotateX(-Math.PI / 2);
            const d = conAristas(new THREE.Mesh(geo, matBase));
            raiz.add(d);
            return d;
        });

        // pestaña de cierre en el lado corto del rectángulo (coordenadas del estado desplegado)
        anadirPestana(lateral,
            new THREE.Vector3(Math.PI * r, 0, r), new THREE.Vector3(Math.PI * r, h, r),
            new THREE.Vector3(0, h / 2, r), Math.min(h, TAU * r) * 0.11);

        const pos = geoLat.attributes.position;
        const aplicarPiezas = (t) => {
            const theta = TAU * (1 - t);
            const R = theta > 1e-3 ? (TAU * r) / theta : 0;
            for (let i = 0; i <= SEG; i++) {
                const u = i / SEG;
                let x, z;
                if (theta > 1e-3) {
                    const al = theta * (u - 0.5);
                    x = R * Math.sin(al);
                    z = r - R + R * Math.cos(al);
                } else { x = TAU * r * (u - 0.5); z = r; }
                pos.setXYZ(i * 2, x, 0, z);
                pos.setXYZ(i * 2 + 1, x, h, z);
            }
            pos.needsUpdate = true;
            geoLat.computeVertexNormals();
            geoLat.computeBoundingSphere();
            pivote.rotation.x = (Math.PI / 2) * t * t;
            // los círculos acaban tangentes a cada lado largo del rectángulo
            discos[0].position.set(0, lerp(0, 0.002, t), 0);
            discos[1].position.set(0, lerp(h, 0.002, t), lerp(0, 2 * r + h, t));
        };

        const AB = Math.PI * r * r, AL = TAU * r * h;
        return finalizar(aplicarPiezas, {
            desarrollable: true,
            reparto: 'Un rectángulo con un círculo tangente a cada lado: el recortable clásico de la lata.',
            piezas: [
                `2 círculos de radio ${r.toFixed(3)} m · ${(2 * AB).toFixed(3)} m²`,
                `1 rectángulo de ${(TAU * r).toFixed(3)} × ${h.toFixed(3)} m · ${AL.toFixed(3)} m²`,
                `El lado largo del rectángulo es la longitud de la circunferencia: 2·π·r`,
            ],
            formula: `A = 2·π·r² + 2·π·r·h = ${(2 * AB).toFixed(3)} + ${AL.toFixed(3)}`,
            areaBase: 2 * AB, areaLateral: AL, areaTotal: 2 * AB + AL,
        });
    }

    /* ───────── CONO: sector circular con el círculo tangente al arco ───────── */
    const SEG = 96;
    const g = Math.hypot(r, h);
    const sigma0 = Math.asin(r / g);
    const geoLat = reg(geoRejilla(SEG));
    const lateral = new THREE.Mesh(geoLat, matCara);
    const pivote = new THREE.Group();
    pivote.add(lateral);
    raiz.add(pivote);

    const geoDisco = reg(new THREE.CircleGeometry(r, 72));
    geoDisco.rotateX(-Math.PI / 2);
    const disco = conAristas(new THREE.Mesh(geoDisco, matBase));
    raiz.add(disco);

    // pestaña de cierre sobre uno de los radios del sector (estado desplegado)
    const betaMax = Math.PI * (r / g);
    anadirPestana(lateral,
        new THREE.Vector3(0, h, 0),
        new THREE.Vector3(g * Math.sin(betaMax), h, g * Math.cos(betaMax)),
        new THREE.Vector3(0, h, g * 0.5), Math.min(g, TAU * r) * 0.09);

    const posC = geoLat.attributes.position;
    const aplicarCono = (t) => {
        const sigma = lerp(sigma0, Math.PI / 2, t);
        const k = Math.sin(sigma0) / Math.sin(sigma);
        const sS = Math.sin(sigma), cS = Math.cos(sigma);
        for (let i = 0; i <= SEG; i++) {
            const beta = (i / SEG - 0.5) * TAU * k;
            posC.setXYZ(i * 2, 0, h, 0);                                                  // vértice
            posC.setXYZ(i * 2 + 1, g * sS * Math.sin(beta), h - g * cS, g * sS * Math.cos(beta));
        }
        posC.needsUpdate = true;
        geoLat.computeVertexNormals();
        geoLat.computeBoundingSphere();
        pivote.position.y = -h * t;                                   // el sector acaba abajo
        disco.position.set(0, 0.002, lerp(0, g + r + 0.02, t));        // tangente al arco
    };

    const ABc = Math.PI * r * r, ALc = Math.PI * r * g;
    return finalizar(aplicarCono, {
        desarrollable: true,
        reparto: 'Un sector circular (el «gorro») con el círculo de la base tangente a su arco.',
        piezas: [
            `1 círculo de radio ${r.toFixed(3)} m · ${ABc.toFixed(3)} m²`,
            `1 sector de radio g = ${g.toFixed(3)} m y ángulo ${(360 * r / g).toFixed(1)}° · ${ALc.toFixed(3)} m²`,
            `El arco del sector mide 2·π·r = ${(TAU * r).toFixed(3)} m: la circunferencia de la base`,
        ],
        formula: `A = π·r² + π·r·g = ${ABc.toFixed(3)} + ${ALc.toFixed(3)} · g = √(r²+h²) = ${g.toFixed(3)} m`,
        areaBase: ABc, areaLateral: ALc, areaTotal: ABc + ALc,
        apotema: g,
    });
}
