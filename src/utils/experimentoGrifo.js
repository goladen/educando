// experimentoGrifo.js — Montaje 3D del experimento "el cono cabe 3 veces en el cilindro".
// Dos recipientes de igual base y altura (uno cónico/piramidal y otro cilíndrico/prismático),
// un grifo que llena el primero y el trasvase que demuestra que V = (1/3)·A_base·h.
import * as THREE from 'three';

const TAU = Math.PI * 2;
export const ALTURA_MESA = 0.75;
export const X_CONO = -0.42;
export const X_CIL = 0.42;

const areaBase = (poligonal, n, r) => (poligonal ? (n / 2) * r * r * Math.sin(TAU / n) : Math.PI * r * r);

/**
 * Nivel del agua en un recipiente cónico o piramidal apoyado en el vértice (tipo embudo).
 * El agua forma un cuerpo semejante: V(t) = A_base·t³/(3·h²)  →  t = ∛(3·V·h²/A_base).
 */
export function nivelEnCono(V, r, h, AB) {
    if (V <= 0) return 0;
    return Math.max(0, Math.min(h, Math.cbrt((3 * V * h * h) / AB)));
}
/** Nivel del agua en un recipiente de sección constante. */
export const nivelEnCilindro = (V, h, AB) => Math.max(0, Math.min(h, V / AB));

/** Disco de radio 1 en el plano XZ, con los mismos n vértices que los sólidos de la sala. */
function discoRadio1(n) {
    const pos = [];
    for (let k = 0; k < n; k++) {
        const a = (TAU * k) / n, b = (TAU * (k + 1)) / n;
        pos.push(0, 0, 0, Math.sin(a), 0, Math.cos(a), Math.sin(b), 0, Math.cos(b));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
}

function anilloRadio1(n) {
    const pts = [];
    for (let k = 0; k <= n; k++) {
        const a = (TAU * k) / n;
        pts.push(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
}

export function crearExperimentoGrifo({ poligonal = false, n = 6, r = 0.3, h = 0.6 }) {
    const seg = poligonal ? n : 48;
    const AB = areaBase(poligonal, n, r);
    const vConoTotal = (AB * h) / 3;
    const vCilTotal = AB * h;

    const basura = [];
    const reg = o => { basura.push(o); return o; };

    const grupo = new THREE.Group();

    const matVidrio = reg(new THREE.MeshPhysicalMaterial({
        color: 0xcfe9f5, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
    }));
    const matAristas = reg(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    const matMetal = reg(new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.3, metalness: 0.85 }));

    // planos de recorte (espacio mundo): conservan lo que queda por debajo del nivel del agua
    const planoCono = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const planoCil = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const matAguaCono = reg(new THREE.MeshStandardMaterial({
        color: 0x29b6f6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, clippingPlanes: [planoCono],
    }));
    const matAguaCil = reg(new THREE.MeshStandardMaterial({
        color: 0x29b6f6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, clippingPlanes: [planoCil],
    }));
    const matSuperficie = reg(new THREE.MeshStandardMaterial({
        color: 0x81d4fa, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide,
    }));

    /* ── mesa ── */
    const mesa = new THREE.Mesh(
        reg(new THREE.BoxGeometry(1.7, 0.05, 0.72)),
        reg(new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 }))
    );
    mesa.position.set(0, ALTURA_MESA - 0.025, 0);
    grupo.add(mesa);
    [[-0.78, -0.3], [0.78, -0.3], [-0.78, 0.3], [0.78, 0.3]].forEach(([x, z]) => {
        const pata = new THREE.Mesh(
            reg(new THREE.CylinderGeometry(0.025, 0.025, ALTURA_MESA - 0.05, 12)),
            mesa.material
        );
        pata.position.set(x, (ALTURA_MESA - 0.05) / 2, z);
        grupo.add(pata);
    });

    /* ── recipiente cónico / piramidal ── */
    const grupoCono = new THREE.Group();
    grupoCono.position.set(X_CONO, ALTURA_MESA, 0);
    grupo.add(grupoCono);

    // apoyado en el vértice y abierto por arriba: así se puede llenar de verdad
    const geoCono = reg(new THREE.ConeGeometry(r, h, seg, 1, true));
    geoCono.rotateX(Math.PI);
    geoCono.translate(0, h / 2, 0);
    const paredCono = new THREE.Mesh(geoCono, matVidrio);
    grupoCono.add(paredCono);
    grupoCono.add(new THREE.LineSegments(reg(new THREE.EdgesGeometry(geoCono, 18)), matAristas));

    const geoAguaCono = reg(new THREE.ConeGeometry(r * 0.985, h, seg));
    geoAguaCono.rotateX(Math.PI);
    geoAguaCono.translate(0, h / 2, 0);
    const aguaCono = new THREE.Mesh(geoAguaCono, matAguaCono);
    grupoCono.add(aguaCono);

    // soporte fijo sobre la mesa: un cono no se sostiene sobre su vértice
    const soporte = new THREE.Group();
    soporte.position.set(X_CONO, ALTURA_MESA, 0);
    grupo.add(soporte);
    const yAro = h * 0.55;
    const aro = new THREE.Mesh(reg(new THREE.TorusGeometry(r * 0.56, 0.008, 8, 32)), matMetal);
    aro.rotation.x = Math.PI / 2;
    aro.position.y = yAro;
    soporte.add(aro);
    for (let k = 0; k < 3; k++) {
        const a = (TAU * k) / 3 + 0.4;
        const pata = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.007, 0.007, yAro, 8)), matMetal);
        pata.position.set(Math.sin(a) * r * 0.56, yAro / 2, Math.cos(a) * r * 0.56);
        soporte.add(pata);
    }

    const geoDisco = reg(discoRadio1(seg));
    const supCono = new THREE.Mesh(geoDisco, matSuperficie);
    grupoCono.add(supCono);

    /* ── recipiente cilíndrico / prismático ── */
    const grupoCil = new THREE.Group();
    grupoCil.position.set(X_CIL, ALTURA_MESA, 0);
    grupo.add(grupoCil);

    const geoCil = reg(new THREE.CylinderGeometry(r, r, h, seg, 1, true));  // sin tapas: es un vaso
    geoCil.translate(0, h / 2, 0);
    grupoCil.add(new THREE.Mesh(geoCil, matVidrio));
    const geoFondo = reg(discoRadio1(seg));
    const fondo = new THREE.Mesh(geoFondo, matVidrio);
    fondo.scale.set(r, 1, r);
    grupoCil.add(fondo);
    grupoCil.add(new THREE.LineSegments(reg(new THREE.EdgesGeometry(
        (() => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(0, h / 2, 0); return reg(g); })(), 18)), matAristas));

    const geoAguaCil = reg(new THREE.CylinderGeometry(r * 0.985, r * 0.985, h, seg));
    geoAguaCil.translate(0, h / 2, 0);
    const aguaCil = new THREE.Mesh(geoAguaCil, matAguaCil);
    grupoCil.add(aguaCil);
    const supCil = new THREE.Mesh(geoDisco, matSuperficie);
    supCil.scale.set(r * 0.985, 1, r * 0.985);
    grupoCil.add(supCil);

    // marcas en tercios: cada vertido del cono debe llegar justo a una marca
    const geoAnillo = reg(anilloRadio1(seg));
    const marcas = [1, 2, 3].map(k => {
        const mat = reg(new THREE.LineBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.9 }));
        const anillo = new THREE.Line(geoAnillo, mat);
        anillo.scale.set(r * 1.03, 1, r * 1.03);
        anillo.position.y = (k * h) / 3;
        grupoCil.add(anillo);
        return anillo;
    });

    /* ── grifo ── */
    const grifo = new THREE.Group();
    grifo.position.set(X_CONO, 0, -0.26);
    grupo.add(grifo);
    const yCano = ALTURA_MESA + h + 0.40;
    const tubo = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.022, 0.022, yCano - 0.02, 16)), matMetal);
    tubo.position.y = (yCano - 0.02) / 2;
    grifo.add(tubo);
    const brazo = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 16)), matMetal);
    brazo.rotation.x = Math.PI / 2;
    brazo.position.set(0, yCano, 0.13);
    grifo.add(brazo);
    const cano = new THREE.Mesh(reg(new THREE.CylinderGeometry(0.018, 0.024, 0.09, 16)), matMetal);
    cano.position.set(0, yCano - 0.045, 0.26);
    grifo.add(cano);
    const volante = new THREE.Mesh(
        reg(new THREE.TorusGeometry(0.05, 0.013, 10, 20)),
        reg(new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5, metalness: 0.3 }))
    );
    volante.rotation.x = Math.PI / 2;
    volante.position.set(0, yCano - 0.06, 0);
    grifo.add(volante);

    /* ── chorros ── */
    const geoChorro = reg(new THREE.CylinderGeometry(0.014, 0.014, 1, 12, 1, true));
    geoChorro.translate(0, -0.5, 0);      // pivota desde arriba: escala en Y = longitud
    const matChorro = reg(new THREE.MeshStandardMaterial({
        color: 0x4fc3f7, roughness: 0.1, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
    }));
    const chorroGrifo = new THREE.Mesh(geoChorro, matChorro);
    chorroGrifo.position.set(X_CONO, yCano - 0.085, 0);
    chorroGrifo.visible = false;
    grupo.add(chorroGrifo);

    const chorroVertido = new THREE.Mesh(geoChorro, matChorro);
    chorroVertido.visible = false;
    grupo.add(chorroVertido);

    /* ── actualización por fotograma ── */
    const tmp = new THREE.Vector3();
    function actualizar({ vCono = 0, vCil = 0, posCono = null, grifoAbierto = false, vertiendo = false }) {
        if (posCono) grupoCono.position.copy(posCono);

        const tCono = nivelEnCono(vCono, r, h, AB);
        const tCil = nivelEnCilindro(vCil, h, AB);

        grupoCono.updateMatrixWorld();
        grupoCil.updateMatrixWorld();
        planoCono.constant = grupoCono.getWorldPosition(tmp).y + tCono;
        planoCil.constant = grupoCil.getWorldPosition(tmp).y + tCil;

        const rCono = r * 0.985 * (tCono / h);
        aguaCono.visible = vCono > 1e-6;
        supCono.visible = aguaCono.visible;
        supCono.position.y = tCono;
        supCono.scale.set(Math.max(rCono, 1e-4), 1, Math.max(rCono, 1e-4));

        aguaCil.visible = vCil > 1e-6;
        supCil.visible = aguaCil.visible;
        supCil.position.y = tCil;

        volante.rotation.z = grifoAbierto ? Math.PI / 4 : 0;
        chorroGrifo.visible = grifoAbierto;
        if (grifoAbierto) {
            const largo = Math.max(0.02, (yCano - 0.085) - (ALTURA_MESA + tCono));
            chorroGrifo.scale.set(1, largo, 1);
        }

        chorroVertido.visible = vertiendo;
        if (vertiendo) {
            chorroVertido.position.set(grupoCono.position.x, grupoCono.position.y, grupoCono.position.z);
            const largo = Math.max(0.02, grupoCono.position.y - (ALTURA_MESA + tCil));
            chorroVertido.scale.set(1, largo, 1);
        }
    }
    actualizar({});

    return {
        grupo, grupoCono, grupoCil, marcas,
        medidas: { AB, vConoTotal, vCilTotal, r, h, n: seg, alturaMesa: ALTURA_MESA },
        actualizar,
        dispose: () => basura.forEach(o => o.dispose?.()),
    };
}
