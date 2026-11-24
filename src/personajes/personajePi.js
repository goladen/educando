// Personaje Pi de PiKT en 3D (three.js): un muñeco con forma de π.
// La barra de arriba es la cabeza (con cara), las dos patas son las piernas y
// lleva bracitos. Pensado para reutilizarse en cualquier juego 3D de PiKT.
//
//   const pi = crearPersonajePi({ color: 0x8b5cf6 });
//   scene.add(pi.grupo);                       // mira hacia +Z, pies en y = 0, mide ~1,5 m
//   pi.animar(dt, { velocidad, enAire });      // cada fotograma (velocidad en m/s)
//   pi.mano                                    // grupo de la mano derecha (para colgar una linterna…)
//   pi.celebrar() · pi.susto()                 // animaciones cortas
//   pi.dispose()
import * as THREE from 'three';

const ALTO_CABEZA = 1.3;   // altura de la barra (centro)

function tubo(puntos, radio, mat, segmentos = 24) {
    const curva = new THREE.CatmullRomCurve3(puntos.map(p => new THREE.Vector3(...p)));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, segmentos, radio, 12, false), mat));
    // tapas redondas en los extremos
    [puntos[0], puntos[puntos.length - 1]].forEach(p => { const e = new THREE.Mesh(new THREE.SphereGeometry(radio, 12, 10), mat); e.position.set(...p); g.add(e); });
    return g;
}

export function crearPersonajePi({ color = 0x8b5cf6, colorZapatos = 0x1e1b4b, colorGorra = 0xfacc15, linterna = false } = {}) {
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Group(); grupo.add(cuerpo);   // lo que bota al andar
    const col = new THREE.Color(color);
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col.clone().multiplyScalar(0.18) });
    const matZapato = new THREE.MeshLambertMaterial({ color: colorZapatos });
    const matBlanco = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matNegro = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const matBlancoL = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Cabeza: la barra del π, con la punta izquierda un poco curvada hacia abajo
    const cabeza = new THREE.Group(); cabeza.position.y = ALTO_CABEZA; cuerpo.add(cabeza);
    cabeza.add(tubo([[-0.5, -0.1, 0], [-0.44, 0.02, 0], [-0.2, 0.05, 0], [0.2, 0.05, 0], [0.48, 0.08, 0]], 0.14, mat));

    // Cara (en la parte delantera de la barra)
    const ojos = [];
    [-0.13, 0.13].forEach(x => {
        const ojo = new THREE.Group(); ojo.position.set(x, 0.08, 0.12);
        const blanco = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), matBlanco); blanco.scale.z = 0.6; ojo.add(blanco);
        const pupila = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), matNegro); pupila.position.set(0, -0.005, 0.04); ojo.add(pupila);
        cabeza.add(ojo); ojos.push(ojo);
    });
    // Cejas
    const cejas = [-0.13, 0.13].map((x, i) => {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.02), matNegro);
        c.position.set(x, 0.175, 0.12); c.rotation.z = i ? -0.18 : 0.18; cabeza.add(c);
        return c;
    });
    // Gorra con visera
    const matGorra = new THREE.MeshLambertMaterial({ color: colorGorra, emissive: new THREE.Color(colorGorra).multiplyScalar(0.15) });
    const gorra = new THREE.Group(); gorra.position.set(0.02, 0.16, 0); gorra.rotation.z = -0.08; cabeza.add(gorra);
    const copa = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), matGorra); copa.scale.set(1.1, 0.85, 1); gorra.add(copa);
    const visera = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 18, 1, false, -Math.PI / 2, Math.PI), matGorra);
    visera.position.set(0, 0.005, 0.1); visera.scale.set(0.95, 1, 0.75); gorra.add(visera);
    const boton = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), matBlancoL); boton.position.y = 0.16; gorra.add(boton);
    // Pajarita
    const matPaj = new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0x3a2c00 });
    const pajarita = new THREE.Group(); pajarita.position.set(0, -0.17, 0.1); cabeza.add(pajarita);
    [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.1, 8), matPaj); a.rotation.z = s * Math.PI / 2; a.position.x = s * 0.05; pajarita.add(a); });
    pajarita.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), matPaj));
    // Mochila con «3,14159…» (es lo que se ve desde la cámara de detrás)
    const texMochila = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
        g.fillStyle = '#f97316'; g.fillRect(0, 0, 256, 256);
        g.strokeStyle = '#9a3412'; g.lineWidth = 8; g.strokeRect(22, 120, 212, 112);
        g.fillStyle = '#fff'; g.font = 'bold 84px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('π', 128, 62);
        g.font = 'bold 40px "Segoe UI", sans-serif'; g.fillText('3,14159', 128, 160);
        g.font = 'bold 22px "Segoe UI", sans-serif'; g.fillStyle = '#ffedd5'; g.fillText('26535 89793…', 128, 200);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const matMochila = new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x5a2205 });
    // con brillo propio para que se lea aunque la luz le dé de frente al personaje
    const matMochilaCara = new THREE.MeshLambertMaterial({ map: texMochila, emissive: 0xffffff, emissiveMap: texMochila, emissiveIntensity: 0.55 });
    // BoxGeometry: caras +x, -x, +y, -y, +z, -z → la de detrás (-z) lleva el dibujo
    const mochila = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.16), [matMochila, matMochila, matMochila, matMochila, matMochila, matMochilaCara]);
    mochila.position.set(0, -0.32, -0.19); mochila.rotation.x = 0.05; cabeza.add(mochila);
    [-0.13, 0.13].forEach(x => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.03), new THREE.MeshLambertMaterial({ color: 0x9a3412 })); a.position.set(x, -0.08, -0.13); cabeza.add(a); });
    const boca = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 16, Math.PI), matNegro);
    boca.position.set(0, -0.04, 0.135); boca.rotation.z = Math.PI; cabeza.add(boca);
    const mejillaMat = new THREE.MeshBasicMaterial({ color: 0xff8fb1, transparent: true, opacity: 0.6 });
    [-0.24, 0.24].forEach(x => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), mejillaMat); m.position.set(x, -0.01, 0.138); cabeza.add(m); });

    // Piernas: cada una gira desde la cadera (justo debajo de la barra)
    const cadera = ALTO_CABEZA - 0.08;
    const pierna = (x, puntos) => {
        const p = new THREE.Group(); p.position.set(x, cadera, 0);
        p.add(tubo(puntos, 0.085, mat));
        const fin = puntos[puntos.length - 1];
        const zapato = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), matZapato);
        zapato.scale.set(1, 0.6, 1.5); zapato.position.set(fin[0], fin[1] - 0.02, fin[2] + 0.06); p.add(zapato);
        // suela blanca y una raya en la zapatilla
        const suela = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), matBlancoL);
        suela.scale.set(1, 1, 1.55); suela.position.set(fin[0], fin[1] - 0.075, fin[2] + 0.06); p.add(suela);
        const raya = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16, Math.PI), matBlancoL);
        raya.rotation.y = Math.PI / 2; raya.position.set(fin[0], fin[1] - 0.02, fin[2] + 0.07); p.add(raya);
        cuerpo.add(p);
        return p;
    };
    // izquierda casi recta; derecha con la curva del π hacia fuera
    const piernaIzq = pierna(-0.22, [[0, 0, 0], [-0.02, -0.55, 0], [-0.06, -cadera + 0.1, 0]]);
    const piernaDer = pierna(0.22, [[0, 0, 0], [0, -0.6, 0], [0.04, -cadera + 0.16, 0], [0.12, -cadera + 0.1, 0]]);

    // Brazos (desde los extremos de la barra)
    const brazo = (x, lado) => {
        const b = new THREE.Group(); b.position.set(x, ALTO_CABEZA - 0.05, 0);
        b.add(tubo([[0, 0, 0], [lado * 0.08, -0.2, 0.02], [lado * 0.1, -0.4, 0.06]], 0.045, mat, 12));
        const mano = new THREE.Group(); mano.position.set(lado * 0.1, -0.43, 0.08); b.add(mano);
        mano.add(new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), matBlanco));
        cuerpo.add(b);
        return { b, mano };
    };
    const izq = brazo(-0.5, -1), der = brazo(0.48, 1);

    // Linterna en la mano derecha (opcional)
    if (linterna) {
        const l = new THREE.Group(); l.position.set(0, 0, 0.08); l.rotation.x = Math.PI / 2;
        l.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 10), new THREE.MeshLambertMaterial({ color: 0x333a44 })));
        const cristal = new THREE.Mesh(new THREE.CircleGeometry(0.038, 12), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
        cristal.position.y = 0.111; cristal.rotation.x = -Math.PI / 2; l.add(cristal);
        der.mano.add(l);
    }

    // Sombra redonda falsa en el suelo (barata y ayuda a ver dónde caes al saltar)
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sombra.position.y = 0.015; grupo.add(sombra);

    let fase = 0, parpadeo = 2 + Math.random() * 2, extra = null, tExtra = 0;
    const animar = (dt, { velocidad = 0, enAire = false, alturaSuelo = 0 } = {}) => {
        const andando = velocidad > 0.2 && !enAire;
        fase += dt * (andando ? 4 + velocidad * 2.4 : 2);
        const amp = andando ? Math.min(0.75, 0.25 + velocidad * 0.14) : 0;
        if (enAire) {
            piernaIzq.rotation.x = THREE.MathUtils.lerp(piernaIzq.rotation.x, -0.55, dt * 12);
            piernaDer.rotation.x = THREE.MathUtils.lerp(piernaDer.rotation.x, 0.35, dt * 12);
            izq.b.rotation.z = THREE.MathUtils.lerp(izq.b.rotation.z, -1.9, dt * 12);
            der.b.rotation.z = THREE.MathUtils.lerp(der.b.rotation.z, 1.9, dt * 12);
            cuerpo.position.y = 0;
        } else {
            piernaIzq.rotation.x = Math.sin(fase) * amp;
            piernaDer.rotation.x = -Math.sin(fase) * amp;
            izq.b.rotation.z = THREE.MathUtils.lerp(izq.b.rotation.z, 0, dt * 10);
            der.b.rotation.z = THREE.MathUtils.lerp(der.b.rotation.z, 0, dt * 10);
            izq.b.rotation.x = -Math.sin(fase) * amp * 0.8;
            der.b.rotation.x = Math.sin(fase) * amp * 0.5;
            cuerpo.position.y = andando ? Math.abs(Math.sin(fase)) * 0.06 : Math.sin(fase) * 0.012;
        }
        cabeza.rotation.z = andando ? Math.sin(fase) * 0.05 : 0;
        // parpadeo
        parpadeo -= dt;
        const cerrado = parpadeo < 0.12;
        ojos.forEach(o => { o.scale.y = cerrado ? 0.15 : 1; });
        if (parpadeo < 0) parpadeo = 2 + Math.random() * 3;
        // animaciones cortas
        if (extra) {
            tExtra += dt;
            if (extra === 'celebrar') { cuerpo.rotation.y = tExtra * 10; izq.b.rotation.z = -2.4; der.b.rotation.z = 2.4; }
            if (extra === 'susto') { cuerpo.position.x = Math.sin(tExtra * 60) * 0.04; ojos.forEach(o => o.scale.setScalar(1.35)); cejas.forEach(c => { c.position.y = 0.21; }); }
            if (tExtra > 0.7) { extra = null; cuerpo.rotation.y = 0; cuerpo.position.x = 0; ojos.forEach(o => o.scale.setScalar(1)); cejas.forEach(c => { c.position.y = 0.175; }); }
        }
        // la sombra se queda en el suelo y encoge al saltar
        sombra.position.y = alturaSuelo - grupo.position.y + 0.015;
        const s = Math.max(0.4, 1 - (grupo.position.y - alturaSuelo) * 0.5);
        sombra.scale.set(s, s, s);
    };

    return {
        grupo,
        mano: der.mano,
        animar,
        celebrar() { extra = 'celebrar'; tExtra = 0; },
        susto() { extra = 'susto'; tExtra = 0; },
        dispose() {
            grupo.traverse(o => { if (o.geometry) o.geometry.dispose(); });
            [mat, matZapato, matBlanco, matBlancoL, matNegro, mejillaMat, matGorra, matPaj, matMochila, matMochilaCara, sombra.material].forEach(m => m.dispose());
            texMochila.dispose();
        },
    };
}
