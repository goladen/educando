import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RotateCcw, CheckCircle, XCircle, Trophy, ArrowRight, Calculator, Ruler, Play, Users, Loader, Monitor, Copy, Save, ArrowUp } from 'lucide-react';
import Confetti from 'react-confetti';
import { db } from './firebase';
import { doc, setDoc, updateDoc, onSnapshot, increment, collection, writeBatch, addDoc, getDoc } from 'firebase/firestore';
import { bibliotecaGeometria } from './BibliotecaGeometria';

// --- AUDIOS Y AVATARES (Estética MathLive) ---
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';
import startSoundFile from './assets/inicio juego.mp3';
import piHappy from './assets/Pi-contento.png';
import piAngry from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';

const audioCorrect = new Audio(correctSoundFile);
const audioWrong = new Audio(wrongSoundFile);
const audioWin = new Audio(winSoundFile);
const audioStart = new Audio(startSoundFile);

const safePlay = (audioObj) => {
    audioObj.currentTime = 0;
    audioObj.play().catch(e => console.log("Audio bloqueado por navegador", e));
};

// --- CONSTANTES GEOMETRIX ---
const UNIDADES = ['mm', 'cm', 'dm', 'm', 'dam', 'hm', 'km'];
const FIGURAS_2D = ['CUADRADO', 'RECTANGULO', 'TRIANGULO', 'CIRCULO', 'ROMBO', 'TRAPECIO'];
const FIGURAS_3D = ['CILINDRO', 'CONO', 'ESFERA', 'PRISMA_RECT'];
const FIGURAS_TODAS = [...FIGURAS_2D, ...FIGURAS_3D];
const SCALE = 37.8;

// Config por defecto para ejercicios
const DEFAULT_GAME_CONFIG = {
    tipos: { area: true, perimetro: true, volumen: true },
    figuras: { planas2D: true, cuerpos3D: true },
    numEjercicios: 10,
    modoRegla: false,
};

const generarFormula = (shape, type, params, unit) => {
    const u = unit, u2 = `${unit}²`, u3 = `${unit}³`;
    switch (shape) {
        case 'CUADRADO': return type === 'ÁREA' ? `A = l² = ${params.l} × ${params.l} = ${params.l * params.l} ${u2}` : `P = 4 × l = 4 × ${params.l} = ${4 * params.l} ${u}`;
        case 'RECTANGULO': return type === 'ÁREA' ? `A = b × h = ${params.b} × ${params.h} = ${params.b * params.h} ${u2}` : `P = 2×(b+h) = 2×(${params.b}+${params.h}) = ${2 * (params.b + params.h)} ${u}`;
        case 'TRIANGULO': return `A = (b × h) / 2 = (${params.b} × ${params.h}) / 2 = ${(params.b * params.h) / 2} ${u2}`;
        case 'CIRCULO': return type === 'ÁREA' ? `A = π × r² = 3.14 × ${params.r}² = ${parseFloat((Math.PI * params.r ** 2).toFixed(2))} ${u2}` : `P = 2 × π × r = 2 × 3.14 × ${params.r} = ${parseFloat((2 * Math.PI * params.r).toFixed(2))} ${u}`;
        case 'ROMBO': return type === 'ÁREA' ? `A = (D × d) / 2 = (${params.D} × ${params.d}) / 2 = ${(params.D * params.d) / 2} ${u2}` : `P = 4 × l = 4 × ${params.l} = ${4 * params.l} ${u}`;
        case 'TRAPECIO': return type === 'ÁREA' ? `A = ((B+b) / 2) × h = ((${params.B}+${params.b}) / 2) × ${params.h} = ${parseFloat((((params.B + params.b) / 2) * params.h).toFixed(2))} ${u2}` : `P = B+b+2×l = ${params.B}+${params.b}+2×${params.l_obl} = ${params.B + params.b + 2 * params.l_obl} ${u}`;
        // 3D
        case 'CILINDRO': {
            if (type === 'ÁREA') {
                const at = parseFloat((2 * Math.PI * params.r * (params.r + params.h)).toFixed(2));
                return `AT = 2×π×r×(r+h) = 2×3.14×${params.r}×(${params.r}+${params.h}) = ${at} ${u2}`;
            }
            return `V = π × r² × h = 3.14 × ${params.r}² × ${params.h} = ${parseFloat((Math.PI * params.r ** 2 * params.h).toFixed(2))} ${u3}`;
        }
        case 'CONO': {
            const g = parseFloat(Math.sqrt(params.r ** 2 + params.h ** 2).toFixed(2));
            if (type === 'ÁREA') {
                const at = parseFloat((Math.PI * params.r * (params.r + g)).toFixed(2));
                return `AT = π×r×(r+g) | g=√(r²+h²)=${g} → 3.14×${params.r}×(${params.r}+${g}) = ${at} ${u2}`;
            }
            return `V = (π × r² × h) / 3 = (3.14 × ${params.r}² × ${params.h}) / 3 = ${parseFloat(((Math.PI * params.r ** 2 * params.h) / 3).toFixed(2))} ${u3}`;
        }
        case 'ESFERA': {
            if (type === 'ÁREA') return `AT = 4 × π × r² = 4 × 3.14 × ${params.r}² = ${parseFloat((4 * Math.PI * params.r ** 2).toFixed(2))} ${u2}`;
            return `V = (4/3) × π × r³ = (4/3) × 3.14 × ${params.r}³ = ${parseFloat(((4 / 3) * Math.PI * params.r ** 3).toFixed(2))} ${u3}`;
        }
        case 'PRISMA_RECT': {
            if (type === 'ÁREA') {
                const at = 2 * (params.l * params.w + params.l * params.h + params.w * params.h);
                return `AT = 2×(l×a + l×h + a×h) = 2×(${params.l}×${params.w}+${params.l}×${params.h}+${params.w}×${params.h}) = ${at} ${u2}`;
            }
            return `V = l × a × h = ${params.l} × ${params.w} × ${params.h} = ${params.l * params.w * params.h} ${u3}`;
        }
        default: return '';
    }
};

const generarProblemaData = (modoRegla = false, bag = null, cfg = DEFAULT_GAME_CONFIG) => {
    // Construir pool de figuras según config
    let pool = [];
    if (cfg.figuras.planas2D) pool = [...pool, ...FIGURAS_2D];
    if (cfg.figuras.cuerpos3D) pool = [...pool, ...FIGURAS_3D];
    if (pool.length === 0) pool = [...FIGURAS_TODAS]; // fallback de seguridad

    // Sacar figura de la bolsa (filtrando solo las del pool)
    let shape;
    if (bag && bag.length > 0) {
        const idx = bag.findIndex(s => pool.includes(s));
        if (idx !== -1) shape = bag.splice(idx, 1)[0];
        else shape = pool[Math.floor(Math.random() * pool.length)];
    } else {
        shape = pool[Math.floor(Math.random() * pool.length)];
    }

    const is3D = FIGURAS_3D.includes(shape);
    const unit = modoRegla ? 'cm' : UNIDADES[Math.floor(Math.random() * UNIDADES.length)];
    const rI = (a, b) => Math.floor(Math.random() * (Math.max(a, b) - a + 1)) + a;
    const maxS = modoRegla ? 5 : 12;

    // Tipos válidos para esta figura según config
    let validTypes = [];
    if (!is3D) {
        if (cfg.tipos.area) validTypes.push('ÁREA');
        if (cfg.tipos.perimetro) validTypes.push('PERÍMETRO');
    } else {
        if (cfg.tipos.area) validTypes.push('ÁREA');      // área total de la superficie
        if (cfg.tipos.volumen) validTypes.push('VOLUMEN');
    }
    if (validTypes.length === 0) validTypes = is3D ? ['VOLUMEN'] : ['ÁREA']; // fallback

    const type = validTypes[Math.floor(Math.random() * validTypes.length)];

    let text = '', correctAnswer = 0, correctExp = '', params = {};

    switch (shape) {
        case 'CUADRADO':
            params.l = rI(3, maxS);
            correctAnswer = type === 'ÁREA' ? params.l ** 2 : 4 * params.l;
            correctExp = type === 'ÁREA' ? '2' : '';
            text = `Calcula el ${type} de este cuadrado.`; break;
        case 'RECTANGULO':
            params.b = rI(5, maxS); params.h = rI(3, Math.max(3, params.b - 1));
            correctAnswer = type === 'ÁREA' ? params.b * params.h : 2 * params.b + 2 * params.h;
            correctExp = type === 'ÁREA' ? '2' : '';
            text = `Calcula el ${type} de este rectángulo.`; break;
        case 'TRIANGULO':
            params.b = rI(4, maxS); params.h = rI(4, maxS);
            correctAnswer = (params.b * params.h) / 2; correctExp = '2';
            text = 'Calcula el ÁREA de este triángulo.'; break;
        case 'CIRCULO':
            params.r = rI(3, Math.floor(maxS / 2));
            correctAnswer = type === 'ÁREA' ? Math.PI * params.r ** 2 : 2 * Math.PI * params.r;
            correctExp = type === 'ÁREA' ? '2' : '';
            text = `Calcula el ${type} de este círculo (π≈3.14).`; break;
        case 'ROMBO':
            if (type === 'ÁREA') {
                params.D = rI(6, maxS); params.d = rI(4, Math.max(4, params.D - 2));
                correctAnswer = (params.D * params.d) / 2; correctExp = '2';
            } else {
                params.l = rI(4, maxS); correctAnswer = 4 * params.l; correctExp = '';
            }
            text = `Calcula el ${type} de este rombo.`; break;
        case 'TRAPECIO':
            params.B = rI(8, maxS); params.b = rI(4, Math.max(4, params.B - 2));
            if (type === 'ÁREA') {
                params.h = rI(4, maxS); correctAnswer = ((params.B + params.b) / 2) * params.h; correctExp = '2';
            } else {
                params.l_obl = rI(4, maxS); correctAnswer = params.B + params.b + 2 * params.l_obl; correctExp = '';
            }
            text = `Calcula el ${type} de este trapecio isósceles.`; break;
        case 'CILINDRO':
            params.r = rI(3, Math.floor(maxS * 0.5)); params.h = rI(5, maxS);
            if (type === 'ÁREA') {
                correctAnswer = 2 * Math.PI * params.r * (params.r + params.h); correctExp = '2';
                text = 'Calcula el ÁREA TOTAL de este cilindro (π≈3.14).';
            } else {
                correctAnswer = Math.PI * params.r ** 2 * params.h; correctExp = '3';
                text = modoRegla ? 'Mide radio y altura y calcula VOLUMEN (π≈3.14).' : 'Calcula el VOLUMEN del cilindro (π≈3.14).';
            } break;
        case 'CONO':
            params.r = rI(3, Math.floor(maxS * 0.5)); params.h = rI(5, maxS);
            if (type === 'ÁREA') {
                const g = Math.sqrt(params.r ** 2 + params.h ** 2);
                correctAnswer = Math.PI * params.r * (params.r + g); correctExp = '2';
                text = 'Calcula el ÁREA TOTAL de este cono (π≈3.14).';
            } else {
                correctAnswer = (Math.PI * params.r ** 2 * params.h) / 3; correctExp = '3';
                text = modoRegla ? 'Mide base y altura y calcula VOLUMEN (π≈3.14).' : 'Calcula el VOLUMEN del cono (π≈3.14).';
            } break;
        case 'ESFERA':
            params.r = rI(3, Math.floor(maxS * 0.5));
            if (type === 'ÁREA') {
                correctAnswer = 4 * Math.PI * params.r ** 2; correctExp = '2';
                text = modoRegla ? 'Mide el radio y calcula el ÁREA TOTAL (π≈3.14).' : 'Calcula el ÁREA TOTAL de esta esfera (π≈3.14).';
            } else {
                correctAnswer = (4 / 3) * Math.PI * params.r ** 3; correctExp = '3';
                text = modoRegla ? 'Mide el radio y calcula el VOLUMEN (π≈3.14).' : 'Calcula el VOLUMEN de esta esfera (π≈3.14).';
            } break;
        case 'PRISMA_RECT':
            params.l = rI(4, maxS);
            // En modo regla: base cuadrada — solo hay que medir lado y altura
            params.w = modoRegla ? params.l : rI(3, Math.max(3, params.l - 1));
            params.h = rI(3, maxS);
            if (type === 'ÁREA') {
                correctAnswer = 2 * (params.l * params.w + params.l * params.h + params.w * params.h); correctExp = '2';
                text = modoRegla ? 'Mide el lado de la base y la altura y calcula el ÁREA TOTAL.' : 'Calcula el ÁREA TOTAL de este prisma rectangular.';
            } else {
                correctAnswer = params.l * params.w * params.h; correctExp = '3';
                text = modoRegla ? 'Mide el lado de la base y la altura y calcula el VOLUMEN.' : 'Calcula el VOLUMEN de este prisma rectangular.';
            } break;
        default: break;
    }
    const formula = generarFormula(shape, type, params, unit);
    return { shape, text, type, unit, params, correctAnswer: parseFloat(correctAnswer.toFixed(2)), correctExp, formula };
};

// ─────────────────────────────────────────────────────────────────────────────
// FIGURAS COMPUESTAS — 3D renderer (Three.js) + Modal
// ─────────────────────────────────────────────────────────────────────────────
function construirFigura3D(figura, group) {
    const m = figura.medidas;
    const key = figura.componentes.join(',');
    const COLORS = [0x3498db, 0xe67e22, 0x9b59b6, 0x2ecc71];
    const wireMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 });
    let ci = 0;
    const nextMat = () => new THREE.MeshStandardMaterial({ color: COLORS[ci++ % COLORS.length], roughness: 0.5, metalness: 0.05 });

    const add = (geo, mat, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(px, py, pz);
        mesh.rotation.set(rx, ry, rz);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), wireMat));
        group.add(mesh);
        return mesh;
    };

    if (key === 'Cilindro,Cono') {
        add(new THREE.CylinderGeometry(m.radio, m.radio, m.alturaCilindro, 32), nextMat(), 0, m.alturaCilindro / 2);
        add(new THREE.ConeGeometry(m.radio, m.alturaCono, 32), nextMat(), 0, m.alturaCilindro + m.alturaCono / 2);

    } else if (key === 'Prisma Cuadrangular,Pirámide') {
        add(new THREE.BoxGeometry(m.lado, m.alturaPrisma, m.lado), nextMat(), 0, m.alturaPrisma / 2);
        add(new THREE.ConeGeometry(m.lado / Math.sqrt(2), m.alturaPiramide, 4), nextMat(), 0, m.alturaPrisma + m.alturaPiramide / 2, 0, 0, Math.PI / 4);

    } else if (key === 'Cilindro,Semiesfera') {
        add(new THREE.CylinderGeometry(m.radio, m.radio, m.alturaCilindro, 32), nextMat(), 0, m.alturaCilindro / 2);
        add(new THREE.SphereGeometry(m.radio, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), nextMat(), 0, m.alturaCilindro);

    } else if (key === 'Prisma Rectangular,Cilindro') {
        add(new THREE.BoxGeometry(m.largo, m.alturaPrisma, m.ancho), nextMat(), 0, m.alturaPrisma / 2);
        add(new THREE.CylinderGeometry(m.radioCilindro, m.radioCilindro, m.alturaCilindro, 32), nextMat(), 0, m.alturaPrisma + m.alturaCilindro / 2);

    } else if (key === 'Cono,Cono') {
        add(new THREE.ConeGeometry(m.radio, m.alturaConos, 32), nextMat(), 0, m.alturaConos / 2);
        add(new THREE.ConeGeometry(m.radio, m.alturaConos, 32), nextMat(), 0, -m.alturaConos / 2, 0, Math.PI);

    } else if (key === 'Semiesfera,Cilindro,Cono') {
        // Eraser (dome down), body, tip
        add(new THREE.SphereGeometry(m.radio, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), nextMat(), 0, 0, 0, Math.PI);
        add(new THREE.CylinderGeometry(m.radio, m.radio, m.alturaCilindro, 32), nextMat(), 0, m.alturaCilindro / 2);
        add(new THREE.ConeGeometry(m.radio, m.alturaCono, 32), nextMat(), 0, m.alturaCilindro + m.alturaCono / 2);

    } else if (key === 'Prisma Rectangular,Prisma Triangular') {
        add(new THREE.BoxGeometry(m.largo, m.alturaPrisma, m.ancho), nextMat(), 0, m.alturaPrisma / 2);
        const shape = new THREE.Shape();
        shape.moveTo(-m.ancho / 2, 0); shape.lineTo(m.ancho / 2, 0); shape.lineTo(0, m.alturaTriangulo); shape.closePath();
        const extGeo = new THREE.ExtrudeGeometry(shape, { depth: m.largo, bevelEnabled: false });
        extGeo.translate(0, 0, -m.largo / 2);
        add(extGeo, nextMat(), 0, m.alturaPrisma, 0, 0, Math.PI / 2);

    } else if (key === 'Prisma Cuadrangular,Cilindro,Semiesfera') {
        add(new THREE.BoxGeometry(m.ladoPrisma, m.alturaPrisma, m.ladoPrisma), nextMat(), 0, m.alturaPrisma / 2);
        add(new THREE.CylinderGeometry(m.radio, m.radio, m.alturaCilindro, 32), nextMat(), 0, m.alturaPrisma + m.alturaCilindro / 2);
        add(new THREE.SphereGeometry(m.radio, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), nextMat(), 0, m.alturaPrisma + m.alturaCilindro);

    } else if (key === 'Cilindro,Cilindro') {
        add(new THREE.CylinderGeometry(m.radioMayor, m.radioMayor, m.alturaMayor, 32), nextMat(), 0, m.alturaMayor / 2);
        add(new THREE.CylinderGeometry(m.radioMenor, m.radioMenor, m.alturaMenor, 32), nextMat(), 0, m.alturaMayor + m.alturaMenor / 2);

    } else {
        // Pedestales: Prisma Rectangular + Prisma Rectangular
        add(new THREE.BoxGeometry(m.l1, m.h1, m.w1), nextMat(), 0, m.h1 / 2);
        add(new THREE.BoxGeometry(m.l2, m.h2, m.w2), nextMat(), 0, m.h1 + m.h2 / 2);
    }
}

function Figura3D({ figura }) {
    const containerRef = useRef(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const W = el.clientWidth || 400;
        const H = 280;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeef2ff);

        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        el.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const dl = new THREE.DirectionalLight(0xffffff, 0.9);
        dl.position.set(10, 20, 10);
        scene.add(dl);
        const dl2 = new THREE.DirectionalLight(0x88aaff, 0.3);
        dl2.position.set(-10, 5, -10);
        scene.add(dl2);

        const group = new THREE.Group();
        construirFigura3D(figura, group);
        scene.add(group);

        // Grid + camera auto-fit
        const box3 = new THREE.Box3().setFromObject(group);
        const center = box3.getCenter(new THREE.Vector3());
        const size3 = box3.getSize(new THREE.Vector3());
        const maxDim = Math.max(size3.x, size3.y, size3.z);

        const grid = new THREE.GridHelper(maxDim * 4, 10, 0xbbbbbb, 0xdddddd);
        grid.position.y = box3.min.y - 0.01;
        scene.add(grid);

        const dist = maxDim * 2.5;
        camera.position.set(center.x + dist * 0.7, center.y + dist * 0.6, center.z + dist * 0.7);
        controls.target.copy(center);
        controls.update();

        let animId;
        const animate = () => { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
        animate();

        const onResize = () => {
            const nW = el.clientWidth;
            renderer.setSize(nW, H);
            camera.aspect = nW / H;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            controls.dispose();
            renderer.dispose();
            if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        };
    }, [figura.id]);

    return <div ref={containerRef} style={{ width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', cursor: 'grab' }} />;
}

function ModalFigurasCompuestas({ usuario, onClose }) {
    const [figura, setFigura] = useState(() => bibliotecaGeometria[Math.floor(Math.random() * bibliotecaGeometria.length)]);
    const [inputArea, setInputArea] = useState('');
    const [inputVol, setInputVol] = useState('');
    const [resultado, setResultado] = useState(null);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [codigoProfe, setCodigoProfe] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState('');

    const nuevaFigura = () => {
        setFigura(bibliotecaGeometria[Math.floor(Math.random() * bibliotecaGeometria.length)]);
        setInputArea(''); setInputVol(''); setResultado(null);
        setMostrarEnvio(false); setEnviado(false); setErrorEnvio('');
    };

    const comprobar = () => {
        const a = parseFloat(inputArea.replace(',', '.'));
        const v = parseFloat(inputVol.replace(',', '.'));
        if (isNaN(a) || isNaN(v)) return;
        const tolA = Math.max(figura.area * 0.02, 0.5);
        const tolV = Math.max(figura.volumen * 0.02, 0.5);
        setResultado({
            areaOk: Math.abs(a - figura.area) <= tolA,
            volOk: Math.abs(v - figura.volumen) <= tolV,
            areaEsp: figura.area.toFixed(2),
            volEsp: figura.volumen.toFixed(2),
        });
    };

    const enviarAlProfe = async () => {
        if (!codigoProfe.trim()) return;
        setEnviando(true); setErrorEnvio('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', codigoProfe.toUpperCase().trim()));
            if (!snap.exists()) { setErrorEnvio('Código de profesor no encontrado.'); setEnviando(false); return; }
            const res = resultado.areaOk && resultado.volOk ? '100%' : !resultado.areaOk && !resultado.volOk ? 'Falla área y volumen' : !resultado.areaOk ? 'Falla área' : 'Falla volumen';
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'GEOMETRIX_COMPUESTO', modalidad: 'Individual',
                codigoProfesor: codigoProfe.toUpperCase().trim(),
                profesorUid: snap.data().uid || null,
                alumno: usuario?.displayName || 'Anónimo', alumnoUid: usuario?.uid || null,
                figuraId: figura.id, figuraNombre: figura.nombre,
                areaOk: resultado.areaOk, volumenOk: resultado.volOk, resultado: res,
                fecha: new Date().toISOString(), timestamp: Date.now(),
            });
            setEnviado(true);
        } catch { setErrorEnvio('Error al enviar. Inténtalo de nuevo.'); }
        setEnviando(false);
    };

    const borderColor = (ok) => ok ? '#2ecc71' : '#e74c3c';

    return (
        <div style={sLive.overlay}>
            <div style={{ ...sLive.modal, maxWidth: 560, position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#aaa' }}>✕</button>
                <h2 style={{ textAlign: 'center', color: '#2c3e50', margin: '0 0 4px', fontSize: '1.3rem' }}>🏗️ Figuras Compuestas</h2>
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                    <span style={{ fontWeight: 'bold', color: '#009688', fontSize: '0.82rem' }}>{figura.id}</span>{' — '}
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#2c3e50' }}>{figura.nombre}</span>
                    <div style={{ color: '#888', fontSize: '0.78rem', marginTop: 2 }}>Componentes: {figura.componentes.join(' + ')}</div>
                </div>

                {/* 3D figure viewer */}
                <div style={{ marginBottom: 10 }}>
                    <Figura3D figura={figura} />
                    <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: '0.75rem', color: '#aaa' }}>🖱️ Arrastra para rotar · Rueda para zoom</p>
                </div>

                {/* Medidas */}
                <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: '0.8rem', color: '#555', textAlign: 'center' }}>
                    <strong>Medidas: </strong>
                    {Object.entries(figura.medidas).map(([k, v]) => `${k} = ${v}`).join(' | ')}
                    <span style={{ color: '#aaa' }}> (u)</span>
                </div>

                {/* Inputs */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.83rem', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: 4 }}>📐 Área (u²)</label>
                        <input type="number" step="0.01" value={inputArea} onChange={e => setInputArea(e.target.value)}
                            placeholder="Tu respuesta..." style={{ width: '100%', padding: '9px', borderRadius: 8, border: `2px solid ${resultado ? borderColor(resultado.areaOk) : '#ccc'}`, fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.83rem', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: 4 }}>🧊 Volumen (u³)</label>
                        <input type="number" step="0.01" value={inputVol} onChange={e => setInputVol(e.target.value)}
                            placeholder="Tu respuesta..." style={{ width: '100%', padding: '9px', borderRadius: 8, border: `2px solid ${resultado ? borderColor(resultado.volOk) : '#ccc'}`, fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 14, justifyContent: 'center' }}>
                    <button onClick={comprobar} disabled={!inputArea || !inputVol}
                        style={{ background: '#009688', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 20, fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>
                        ✔️ Comprobar
                    </button>
                    <button onClick={nuevaFigura}
                        style={{ background: '#9b59b6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 20, fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>
                        🔀 Nueva figura
                    </button>
                </div>

                {/* Feedback */}
                {resultado && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ background: resultado.areaOk ? '#d4edda' : '#fde8e8', border: `2px solid ${borderColor(resultado.areaOk)}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                            <div style={{ fontWeight: 'bold', color: resultado.areaOk ? '#27ae60' : '#c0392b' }}>
                                {resultado.areaOk ? `✅ Área correcta (${resultado.areaEsp} u²)` : `❌ Área incorrecta — esperado: ${resultado.areaEsp} u²`}
                            </div>
                            {!resultado.areaOk && (
                                <pre style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#c0392b', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{figura.feedback.pasosArea}</pre>
                            )}
                        </div>
                        <div style={{ background: resultado.volOk ? '#d4edda' : '#fde8e8', border: `2px solid ${borderColor(resultado.volOk)}`, borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ fontWeight: 'bold', color: resultado.volOk ? '#27ae60' : '#c0392b' }}>
                                {resultado.volOk ? `✅ Volumen correcto (${resultado.volEsp} u³)` : `❌ Volumen incorrecto — esperado: ${resultado.volEsp} u³`}
                            </div>
                            {!resultado.volOk && (
                                <pre style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#c0392b', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{figura.feedback.pasosVolumen}</pre>
                            )}
                        </div>
                    </div>
                )}

                {/* Enviar al profe */}
                {resultado && !enviado && (
                    <div>
                        {!mostrarEnvio ? (
                            <button onClick={() => setMostrarEnvio(true)}
                                style={{ width: '100%', background: 'linear-gradient(135deg,#27ae60,#2ecc71)', color: 'white', border: 'none', padding: '11px 20px', borderRadius: 20, fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>
                                📤 Enviar al profesor
                            </button>
                        ) : (
                            <div style={{ background: '#f0faf5', border: '1px solid #2ecc71', borderRadius: 12, padding: 14 }}>
                                <p style={{ margin: '0 0 8px', fontWeight: 'bold', fontSize: '0.88rem', color: '#2c3e50' }}>Código del profesor:</p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input type="text" value={codigoProfe} onChange={e => setCodigoProfe(e.target.value.toUpperCase())}
                                        placeholder="XXXXXX" maxLength={6}
                                        style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '2px solid #2ecc71', textAlign: 'center', fontSize: '1.1rem', outline: 'none', letterSpacing: 3 }} />
                                    <button onClick={enviarAlProfe} disabled={enviando || !codigoProfe.trim()}
                                        style={{ background: '#27ae60', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                                        {enviando ? '⏳' : '📤 Enviar'}
                                    </button>
                                </div>
                                {errorEnvio && <p style={{ color: '#e74c3c', fontSize: '0.83rem', margin: '6px 0 0' }}>{errorEnvio}</p>}
                            </div>
                        )}
                    </div>
                )}
                {enviado && (
                    <div style={{ background: '#d4edda', border: '2px solid #2ecc71', borderRadius: 12, padding: 12, textAlign: 'center', color: '#27ae60', fontWeight: 'bold', fontSize: '0.95rem' }}>
                        ✅ Informe enviado al profesor
                    </div>
                )}
            </div>
        </div>
    );
}

const generarCodigo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// Genera un problema garantizando que no se repite la misma figura con las mismas medidas en la sesión
const generarUnico = (modoRegla, bag, cfg, usedSet, maxIntentos = 20) => {
    for (let i = 0; i < maxIntentos; i++) {
        // Clonar la bolsa temporalmente para no consumirla si hay colisión
        const bagSnapshot = [...bag];
        const p = generarProblemaData(modoRegla, bagSnapshot, cfg);
        const firma = `${p.shape}-${p.type}-${p.correctAnswer}`;
        if (!usedSet.has(firma)) {
            // Aceptado: aplicar los cambios a la bolsa real
            bag.length = 0;
            bagSnapshot.forEach(s => bag.push(s));
            usedSet.add(firma);
            return p;
        }
        // Si colisión, intentar de nuevo (la bolsa no se modificó)
    }
    // Tras maxIntentos, aceptar igualmente para no bloquear
    const p = generarProblemaData(modoRegla, bag, cfg);
    usedSet.add(`${p.shape}-${p.type}-${p.correctAnswer}`);
    return p;
};

// ─── ROUTER PRINCIPAL INTELIGENTE ─────────────────────────────────────────────
export default function GeometriaGame({ usuario, onExit, isHost, codigoSala }) {
    // Estados internos para gestionar las salas sin depender del Landing
    const [internalHostRoom, setInternalHostRoom] = useState(null);
    const [internalClientRoom, setInternalClientRoom] = useState(null);

    // Compatibilidad por si se lanza desde un modal del Landing
    if (isHost) return <GeometrixLiveHost codigoSala={codigoSala} usuario={usuario} onExit={onExit} />;
    if (codigoSala) return <GeometrixLiveClient codigoSala={codigoSala} usuario={usuario} onExit={onExit} />;

    // Si se activan internamente
    if (internalHostRoom) return <GeometrixLiveHost codigoSala={internalHostRoom} usuario={usuario} onExit={() => setInternalHostRoom(null)} />;
    if (internalClientRoom) return <GeometrixLiveClient codigoSala={internalClientRoom} usuario={usuario} onExit={() => setInternalClientRoom(null)} />;

    return <GeometriaGameLocal usuario={usuario} onExit={onExit} onHostStart={setInternalHostRoom} onClientJoin={setInternalClientRoom} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU Y MODO LOCAL
// ─────────────────────────────────────────────────────────────────────────────
function GeometriaGameLocal({ usuario, onExit, onHostStart, onClientJoin }) {
    const [gameState, setGameState] = useState('START');
    const [modoRegla, setModoRegla] = useState(false);
    const [score, setScore] = useState(0);
    const [questionNum, setQuestionNum] = useState(1);
    const [currentProblem, setCurrentProblem] = useState(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [userUnit, setUserUnit] = useState('');
    const [userExp, setUserExp] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [canvasDim, setCanvasDim] = useState({ w: 600, h: 350 });
    const [isMobile, setIsMobile] = useState(false);
    const [drawMode, setDrawMode] = useState(false);
    const [showCalc, setShowCalc] = useState(false);
    const [showFigurasCompuestas, setShowFigurasCompuestas] = useState(false);

    // Modo 3 config
    const [showGameConfig, setShowGameConfig] = useState(false);
    const [gameConfig, setGameConfig] = useState({ ...DEFAULT_GAME_CONFIG });

    // Live config (modo 4)
    const [joinCode, setJoinCode] = useState('');
    const [showLiveConfig, setShowLiveConfig] = useState(false);
    const [liveConfig, setLiveConfig] = useState({
        tiempoPregunta: 45, numPreguntas: 10, puntosMax: 100, puntosMin: 50,
        modoRegla: false,
        tipos: { area: true, perimetro: true, volumen: true },
        figuras: { planas2D: true, cuerpos3D: true },
    });
    const [creandoSala, setCreandoSala] = useState(false);

    const bagRef = useRef([]);
    const usedRef = useRef(new Set());
    const canvasRef = useRef(null);
    const cardRef = useRef(null);

    useEffect(() => {
        const update = () => {
            const mobile = window.innerWidth <= 600;
            setIsMobile(mobile);
            requestAnimationFrame(() => {
                const cardW = cardRef.current ? cardRef.current.clientWidth - (mobile ? 40 : 60) : Math.min(640, window.innerWidth - (mobile ? 40 : 80));
                setCanvasDim({ w: Math.max(200, cardW), h: mobile ? 240 : 350 });
            });
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [gameState]);

    const abrirConfigModo3 = () => setShowGameConfig(true);

    // Modo 1: rápido — todas las figuras, todos los tipos, 10 preguntas, fórmulas
    const startModo1 = () => {
        const cfg = { tipos: { area: true, perimetro: true, volumen: true }, figuras: { planas2D: true, cuerpos3D: true }, numEjercicios: 10, modoRegla: false };
        setGameConfig(cfg);
        startGame(false, cfg);
    };

    // Modo 2: regla — 2D y 3D medibles con regla, 10 preguntas
    const startModo2 = () => {
        const cfg = { tipos: { area: true, perimetro: true, volumen: true }, figuras: { planas2D: true, cuerpos3D: true }, numEjercicios: 10, modoRegla: true };
        setGameConfig(cfg);
        startGame(true, cfg);
    };

    const startGame = (rm, cfg) => {
        setModoRegla(rm); setScore(0); setQuestionNum(1);
        setDrawMode(false); setShowCalc(false);
        const pool2D = cfg.figuras.planas2D ? [...FIGURAS_2D] : [];
        const pool3D = cfg.figuras.cuerpos3D ? [...FIGURAS_3D] : [];
        const bag = [...pool2D, ...pool2D, ...pool3D, ...pool3D].sort(() => Math.random() - 0.5);
        bagRef.current = bag;
        usedRef.current = new Set();
        const p = generarUnico(rm, bagRef.current, cfg, usedRef.current);
        setCurrentProblem(p);
        setUserAnswer(''); setUserUnit(rm ? 'cm' : ''); setUserExp(''); setFeedback(null);
        setGameState('PLAYING');
    };

    const checkAnswer = () => {
        if (!userAnswer || !userUnit) return;
        const userVal = parseFloat(userAnswer.replace(',', '.'));
        const correctVal = currentProblem.correctAnswer;
        const margen = Math.max(0.2, correctVal * (modoRegla ? 0.05 : 0.02));
        const isNumCorrect = Math.abs(userVal - correctVal) <= margen;
        const isUnitCorrect = userUnit === currentProblem.unit;
        const isExpCorrect = userExp === currentProblem.correctExp;
        const strUnit = `${currentProblem.unit}${currentProblem.correctExp === '2' ? '²' : currentProblem.correctExp === '3' ? '³' : ''}`;
        let message = '', totalCorrect = false;
        if (isNumCorrect && isUnitCorrect && isExpCorrect) { setScore(s => s + 10); message = `¡Perfecto! Resultado correcto: ${correctVal} ${strUnit}`; totalCorrect = true; }
        else if (isNumCorrect) { message = `¡El número está bien! Pero las unidades son incorrectas. Era ${strUnit}`; }
        else { message = `Incorrecto. El resultado era ${correctVal} ${strUnit}`; }
        setFeedback({ isCorrect: totalCorrect, message, formula: currentProblem.formula });
        setGameState('FEEDBACK');
    };

    const nextQuestion = () => {
        if (questionNum >= gameConfig.numEjercicios) { setGameState('END'); }
        else {
            setQuestionNum(q => q + 1);
            setDrawMode(false);
            const p = generarUnico(modoRegla, bagRef.current, gameConfig, usedRef.current);
            setCurrentProblem(p);
            setUserAnswer(''); setUserUnit(modoRegla ? 'cm' : ''); setUserExp(''); setFeedback(null);
            setGameState('PLAYING');
        }
    };

    const handleExit = () => {
        if (onExit) {
            onExit();
        } else {
            window.history.pushState({}, '', '/math_world');
            window.dispatchEvent(new Event('popstate'));
        }
    };
    const crearSalaEnVivo = async () => {
        setCreandoSala(true);
        try {
            const codigo = generarCodigo();
            const liveCfg = {
                tipos: liveConfig.tipos,
                figuras: liveConfig.figuras,
                numEjercicios: liveConfig.numPreguntas,
            };
            const pool2D = liveConfig.figuras.planas2D ? [...FIGURAS_2D] : [];
            const pool3D = liveConfig.figuras.cuerpos3D ? [...FIGURAS_3D] : [];
            const bag = [...pool2D, ...pool2D, ...pool3D, ...pool3D].sort(() => Math.random() - 0.5);
            const preguntas = Array.from({ length: liveConfig.numPreguntas }, () => ({
                ...generarProblemaData(liveConfig.modoRegla, bag, liveCfg),
                tiempo: liveConfig.tiempoPregunta,
                puntosMax: liveConfig.puntosMax,
                puntosMin: liveConfig.puntosMin,
            }));
            await setDoc(doc(db, 'live_games', codigo), {
                tipoJuego: 'GEOMETRIX', estado: 'LOBBY', fasePregunta: 'RESPONDING',
                jugadores: {}, preguntas, indicePregunta: 0, respuestasRonda: {},
                questionStartTime: null, config: liveConfig, creadoEn: Date.now(),
            });
            setShowLiveConfig(false);
            onHostStart(codigo);
        } catch (e) { console.error(e); alert('Error al crear la sala. Comprueba la conexión.'); }
        setCreandoSala(false);
    };

    const unirseASala = async () => {
        if (joinCode.length !== 6) return alert("El código debe tener 6 letras/números.");
        onClientJoin(joinCode.toUpperCase());
    };

    // ── Helpers de UI (definidos fuera del render para evitar re-renders) ──
    const SeccionConfig = ({ label, children }) => (
        <div style={sLive.section}><div style={sLive.label}>{label}</div>{children}</div>
    );

    // ChipToggle: no usa callback-pattern — recibe valor directo
    const ChipToggle = ({ active, onClick, children, color = '#e74c3c', disabled }) => (
        <button onClick={disabled ? undefined : onClick} style={{
            ...sLive.chip,
            background: active ? color : '#eee',
            color: active ? 'white' : (disabled ? '#bbb' : '#555'),
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: disabled ? '1px dashed #ccc' : 'none',
        }}>{children}</button>
    );

    // TiposFigurasConfig: usa cfg prop directamente, NO callback-pattern
    const renderConfigFiguras = (cfg, onChangeCfg) => {
        const toggle = (key, subKey) => {
            const newVal = !cfg[key][subKey];
            const updated = { ...cfg, [key]: { ...cfg[key], [subKey]: newVal } };
            // Garantizar al menos 1 figura y 1 tipo válido
            const anyFig = Object.values(updated.figuras).some(Boolean);
            const anyTipo = Object.values(updated.tipos).some(Boolean);
            if (!anyFig || !anyTipo) return;
            onChangeCfg(updated);
        };
        const toggleModoRegla = (val) => {
            onChangeCfg({ ...cfg, modoRegla: val });
        };
        const solo3D = cfg.figuras.cuerpos3D && !cfg.figuras.planas2D;
        const solo2D = cfg.figuras.planas2D && !cfg.figuras.cuerpos3D;
        return (<>
            <SeccionConfig label="📐 Modo de juego">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <ChipToggle active={!cfg.modoRegla} onClick={() => toggleModoRegla(false)} color="#3498db">🔢 Fórmulas</ChipToggle>
                    <ChipToggle active={cfg.modoRegla} onClick={() => toggleModoRegla(true)} color="#f39c12">📏 Regla</ChipToggle>
                </div>
                {cfg.modoRegla && <p style={{ color: '#e67e22', fontSize: '0.8rem', textAlign: 'center', margin: '6px 0 0' }}>📏 Modo regla: el prisma siempre tendrá base cuadrada (un solo lado a medir)</p>}
            </SeccionConfig>
            <SeccionConfig label="🔵 Tipo de figuras">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <ChipToggle active={cfg.figuras.planas2D} onClick={() => toggle('figuras', 'planas2D')} color="#2ecc71">⬡ 2D Planas</ChipToggle>
                    <ChipToggle active={cfg.figuras.cuerpos3D} onClick={() => toggle('figuras', 'cuerpos3D')} color="#9b59b6">🧊 3D Cuerpos</ChipToggle>
                </div>
                <p style={{ fontSize: '0.76rem', color: '#888', textAlign: 'center', margin: '5px 0 0' }}>
                    2D: cuadrado, rectángulo, triángulo, círculo, rombo, trapecio<br/>
                    3D: cilindro, cono, esfera, prisma rectangular
                </p>
            </SeccionConfig>
            <SeccionConfig label="📊 Tipos de ejercicios">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <ChipToggle active={cfg.tipos.area} onClick={() => toggle('tipos', 'area')} color="#e74c3c">📐 Área</ChipToggle>
                    <ChipToggle active={cfg.tipos.perimetro} onClick={() => toggle('tipos', 'perimetro')} color="#3498db" disabled={solo3D}>📏 Perímetro</ChipToggle>
                    <ChipToggle active={cfg.tipos.volumen} onClick={() => toggle('tipos', 'volumen')} color="#8e44ad" disabled={solo2D}>🧊 Volumen</ChipToggle>
                </div>
                {solo3D && <p style={{ color: '#e74c3c', fontSize: '0.76rem', textAlign: 'center', margin: '4px 0 0' }}>Perímetro no disponible para 3D</p>}
                {solo2D && <p style={{ color: '#e74c3c', fontSize: '0.76rem', textAlign: 'center', margin: '4px 0 0' }}>Volumen no disponible para 2D</p>}
            </SeccionConfig>
        </>);
    };

    return (
        <div style={sLocal.container}>

            {/* ── MODAL FIGURAS COMPUESTAS ── */}
            {showFigurasCompuestas && (
                <ModalFigurasCompuestas usuario={usuario} onClose={() => setShowFigurasCompuestas(false)} />
            )}

            {/* ── MODAL CONFIG MODO 3 ── */}
            {showGameConfig && (
                <div style={sLive.overlay}>
                    <div style={sLive.modal}>
                        <h2 style={{ margin: '0 0 16px', color: '#2c3e50', fontSize: '1.25rem', textAlign: 'center' }}>⚙️ Modo Configurado</h2>
                        {renderConfigFiguras(gameConfig, setGameConfig)}
                        <SeccionConfig label="🔢 Número de ejercicios">
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                {[5, 8, 10, 15].map(n => (
                                    <ChipToggle key={n} active={gameConfig.numEjercicios === n} onClick={() => setGameConfig(c => ({ ...c, numEjercicios: n }))} color="#009688">{n}</ChipToggle>
                                ))}
                                <input type="number" min="1" max="50" placeholder="···"
                                    value={![5,8,10,15].includes(gameConfig.numEjercicios) ? gameConfig.numEjercicios : ''}
                                    onChange={e => { const v = parseInt(e.target.value); if (v > 0) setGameConfig(c => ({ ...c, numEjercicios: v })); }}
                                    style={{ width: 52, padding: '6px 8px', borderRadius: 20, border: `2px solid ${![5,8,10,15].includes(gameConfig.numEjercicios) ? '#009688' : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold', color: '#333' }} />
                            </div>
                        </SeccionConfig>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
                            <button onClick={() => setShowGameConfig(false)} style={sLive.btnSec}>Cancelar</button>
                            <button onClick={() => { setShowGameConfig(false); startGame(gameConfig.modoRegla, gameConfig); }} style={sLive.btnPri}>▶ Comenzar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL CONFIG EN VIVO ── */}
            {showLiveConfig && (
                <div style={sLive.overlay}>
                    <div style={sLive.modal}>
                        <h2 style={{ margin: '0 0 16px', color: '#2c3e50', fontSize: '1.25rem', textAlign: 'center' }}>🔴 Juego en Vivo — Configuración</h2>
                        {renderConfigFiguras(liveConfig, setLiveConfig)}
                        <SeccionConfig label="⏱ Tiempo por pregunta">
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                {[20, 30, 45, 60].map(t => (
                                    <ChipToggle key={t} active={liveConfig.tiempoPregunta === t} onClick={() => setLiveConfig(c => ({ ...c, tiempoPregunta: t }))}>{t}s</ChipToggle>
                                ))}
                                <input type="number" min="5" max="300" placeholder="···"
                                    value={![20,30,45,60].includes(liveConfig.tiempoPregunta) ? liveConfig.tiempoPregunta : ''}
                                    onChange={e => { const v = parseInt(e.target.value); if (v > 0) setLiveConfig(c => ({ ...c, tiempoPregunta: v })); }}
                                    style={{ width: 52, padding: '6px 8px', borderRadius: 20, border: `2px solid ${![20,30,45,60].includes(liveConfig.tiempoPregunta) ? '#e74c3c' : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold', color: '#333' }} />
                            </div>
                        </SeccionConfig>
                        <SeccionConfig label="🔢 Número de preguntas">
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                {[5, 8, 10, 15].map(n => (
                                    <ChipToggle key={n} active={liveConfig.numPreguntas === n} onClick={() => setLiveConfig(c => ({ ...c, numPreguntas: n }))}>{n}</ChipToggle>
                                ))}
                                <input type="number" min="1" max="50" placeholder="···"
                                    value={![5,8,10,15].includes(liveConfig.numPreguntas) ? liveConfig.numPreguntas : ''}
                                    onChange={e => { const v = parseInt(e.target.value); if (v > 0) setLiveConfig(c => ({ ...c, numPreguntas: v })); }}
                                    style={{ width: 52, padding: '6px 8px', borderRadius: 20, border: `2px solid ${![5,8,10,15].includes(liveConfig.numPreguntas) ? '#009688' : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold', color: '#333' }} />
                            </div>
                        </SeccionConfig>
                        <SeccionConfig label="🏆 Puntuación">
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <label style={{ fontSize: '0.85rem', color: '#555' }}>Máx:
                                    <input type="number" value={liveConfig.puntosMax} onChange={e => setLiveConfig(c => ({ ...c, puntosMax: parseInt(e.target.value) || 100 }))}
                                        style={{ width: 60, marginLeft: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid #ccc' }} />
                                </label>
                                <label style={{ fontSize: '0.85rem', color: '#555' }}>Mín:
                                    <input type="number" value={liveConfig.puntosMin} onChange={e => setLiveConfig(c => ({ ...c, puntosMin: parseInt(e.target.value) || 50 }))}
                                        style={{ width: 60, marginLeft: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid #ccc' }} />
                                </label>
                            </div>
                        </SeccionConfig>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
                            <button onClick={() => setShowLiveConfig(false)} style={sLive.btnSec}>Cancelar</button>
                            <button onClick={crearSalaEnVivo} disabled={creandoSala} style={sLive.btnPri}>{creandoSala ? '⏳ Creando...' : '🚀 Lanzar Juego'}</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={sLocal.header}>
                <button onClick={handleExit} style={sLocal.btnVolver}><RotateCcw size={16} /> Salir</button>
                {gameState !== 'START' && (
                    <div style={sLocal.scoreBoard}>
                        <span>{questionNum}/{gameConfig.numEjercicios}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f1c40f' }}><Trophy size={16} /> {score} pts</div>
                    </div>
                )}
            </div>

            {gameState === 'START' && (
                <div ref={cardRef} style={sLocal.centerCard}>
                    <Calculator size={55} color="#009688" style={{ marginBottom: 8 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.4rem', margin: '8px 0' }}>Geometrix</h1>
                    <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 24px' }}>Áreas, perímetros y volúmenes</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                        {/* Modo 1 */}
                        <button onClick={startModo1} style={{ ...sLocal.btnPrimary, background: '#3498db' }}>
                            <Calculator size={20} /> 🎯 Modo Rápido <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>(todas las figuras)</span>
                        </button>
                        {/* Modo 2 */}
                        <button onClick={startModo2} style={{ ...sLocal.btnPrimary, background: '#f39c12' }}>
                            <Ruler size={20} /> 📏 Modo Regla <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>(medir en pantalla)</span>
                        </button>
                        {/* Modo 3 */}
                        <button onClick={abrirConfigModo3} style={{ ...sLocal.btnPrimary, background: '#009688' }}>
                            ⚙️ Modo Configurado <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>(elige tipos y figuras)</span>
                        </button>

                        {/* Figuras Compuestas */}
                        <button onClick={() => setShowFigurasCompuestas(true)} style={{ ...sLocal.btnPrimary, background: '#e74c3c' }}>
                            🏗️ Figuras Compuestas <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>(área y volumen)</span>
                        </button>

                        <div style={{ width: '100%', maxWidth: 320, height: 2, background: '#eee', margin: '6px 0' }} />

                        {/* Modo 4 */}
                        <button onClick={() => setShowLiveConfig(true)} style={{ ...sLocal.btnPrimary, background: '#9C27B0' }}>
                            <Monitor size={20} /> 🔴 Crear Partida en Vivo
                        </button>
                        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
                            <input type="text" placeholder="Código de 6 letras" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                style={{ flex: 1, padding: '12px', borderRadius: 30, border: '2px solid #ccc', textAlign: 'center', fontSize: '1.1rem', outline: 'none', textTransform: 'uppercase' }} maxLength={6} />
                            <button onClick={unirseASala} style={{ ...sLocal.btnPrimary, background: '#2ecc71', width: 'auto', padding: '12px 25px' }}>Unirse</button>
                        </div>
                    </div>
                </div>
            )}

            {gameState === 'PLAYING' && currentProblem && (
                <div ref={cardRef} style={sLocal.centerCard}>
                    {modoRegla ? (
                        <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', borderRadius: 14, border: '1px solid #ddd', background: '#f8f9fa', marginBottom: 14, position: 'relative' }}>
                            <div ref={canvasRef} style={{ position: 'relative', width: `${canvasDim.w}px`, height: `${canvasDim.h}px`, flexShrink: 0 }}>
                                <ShapeRenderer shape={currentProblem.shape} params={currentProblem.params} unit={currentProblem.unit} hideText={true} canvasDim={canvasDim} rulerMode={true} />
                                <DrawingCanvas width={canvasDim.w} height={canvasDim.h} active={drawMode} key={`draw-${questionNum}`} />
                                <VirtualRuler canvasRef={canvasRef} canvasDim={canvasDim} />
                            </div>
                        </div>
                    ) : (
                        <div ref={canvasRef} style={{ position: 'relative', width: '100%', height: `${canvasDim.h}px`, margin: '0 auto 14px auto', background: '#f8f9fa', borderRadius: 14, border: '1px solid #ddd', overflow: 'hidden' }}>
                            <ShapeRenderer shape={currentProblem.shape} params={currentProblem.params} unit={currentProblem.unit} hideText={false} canvasDim={canvasDim} rulerMode={false} />
                            <DrawingCanvas width={canvasDim.w} height={canvasDim.h} active={drawMode} key={`draw-${questionNum}`} />
                        </div>
                    )}

                    {/* Enunciado + botones ✏️ y 🖩 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <p style={{ flex: 1, fontSize: isMobile ? '1rem' : '1.1rem', color: '#333', fontWeight: 'bold', margin: 0, lineHeight: 1.4 }}>{currentProblem.text}</p>
                        <button onClick={() => setDrawMode(d => !d)} title={drawMode ? 'Desactivar lápiz' : 'Activar lápiz'}
                            style={{ flexShrink: 0, background: drawMode ? '#3498db' : '#f0f0f0', color: drawMode ? 'white' : '#555', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: '1.1rem', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => setShowCalc(s => !s)} title="Mini calculadora"
                            style={{ flexShrink: 0, background: showCalc ? '#f39c12' : '#f0f0f0', color: showCalc ? 'white' : '#555', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: '1.1rem', cursor: 'pointer' }}>🧮</button>
                    </div>

                    {showCalc && <MiniCalculadora onClose={() => setShowCalc(false)} />}

                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#f8f9fa', padding: 12, borderRadius: 14 }}>
                        <input type="number" step="0.01" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkAnswer()} placeholder="Número..." style={{ ...sLocal.inputNum, width: isMobile ? 95 : 115 }} autoFocus={!isMobile} />
                        <select value={userUnit} onChange={e => setUserUnit(e.target.value)} style={sLocal.inputSelect} disabled={modoRegla}>
                            <option value="">Unidad...</option>
                            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <select value={userExp} onChange={e => setUserExp(e.target.value)} style={sLocal.inputSelect}>
                            <option value="">(Lineal)</option>
                            <option value="2">² Cuadrado</option>
                            <option value="3">³ Cúbico</option>
                        </select>
                        <button onClick={checkAnswer} style={{ ...sLocal.btnSuccess, background: modoRegla ? '#f39c12' : '#27ae60', width: isMobile ? '100%' : 'auto' }} disabled={!userAnswer || !userUnit}>Comprobar</button>
                    </div>
                </div>
            )}

            {gameState === 'FEEDBACK' && feedback && (
                <div style={{ ...sLocal.centerCard, border: `3px solid ${feedback.isCorrect ? '#2ecc71' : '#e74c3c'}` }}>
                    {feedback.isCorrect ? <CheckCircle size={55} color="#2ecc71" /> : <XCircle size={55} color="#e74c3c" />}
                    <h2 style={{ color: feedback.isCorrect ? '#27ae60' : '#c0392b', fontSize: isMobile ? '1rem' : '1.2rem', margin: '12px 0' }}>{feedback.message}</h2>
                    <div style={sLocal.formulaBox}><div style={sLocal.formulaLabel}>📐 Operación a realizar:</div><div style={sLocal.formulaText}>{feedback.formula}</div></div>
                    <button onClick={nextQuestion} style={{ ...sLocal.btnPrimary, background: modoRegla ? '#f39c12' : '#3498db', marginTop: 20 }}>{questionNum >= gameConfig.numEjercicios ? 'Ver Resultados' : 'Siguiente'} <ArrowRight size={18} /></button>
                </div>
            )}

            {gameState === 'END' && (
                <div style={sLocal.centerCard}>
                    {score >= gameConfig.numEjercicios * 5 && <Confetti recycle={false} />}
                    <Trophy size={75} color="#f1c40f" style={{ marginBottom: 16 }} />
                    <h1 style={{ color: '#2c3e50' }}>¡Desafío Completado!</h1>
                    <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#f1c40f' }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: 28 }}>Puntos sobre {gameConfig.numEjercicios * 10}</p>
                    <button onClick={handleExit} style={{ ...sLocal.btnPrimary, background: '#009688' }}>Salir al Menú</button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOST — PROFESOR EN VIVO (Con estética MathLive)
// ─────────────────────────────────────────────────────────────────────────────
function GeometrixLiveHost({ codigoSala, onExit, usuario }) {
    const [gameData, setGameData] = useState(null);
    const [jugadores, setJugadores] = useState([]);
    const [faseHost, setFaseHost] = useState('LOBBY');
    const [subFase, setSubFase] = useState('RESPONDING');
    const [timerVisual, setTimerVisual] = useState(0);
    const [stats, setStats] = useState({ aciertos: 0, total: 0, pct: 0 });
    const [cargandoSig, setCargandoSig] = useState(false);
    const [avatarMood, setAvatarMood] = useState('neutral');
    const [canvasDim] = useState({ w: 500, h: 300 });

    const timerRef = useRef(null);
    const gdRef = useRef(null);
    useEffect(() => { gdRef.current = gameData; }, [gameData]);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setGameData(data);
            setFaseHost(data.estado || 'LOBBY');
            setSubFase(data.fasePregunta || 'RESPONDING');
            setJugadores(data.jugadores ? Object.values(data.jugadores) : []);

            if (data.estado === 'JUEGO' && data.fasePregunta === 'RESPONDING') {
                const respuestas = data.respuestasRonda || {};
                const updates = {}; let hayCambios = false;
                Object.entries(respuestas).forEach(([uid, resp]) => {
                    if (!resp.processed) {
                        hayCambios = true;
                        let puntos = 0;
                        if (resp.correct) {
                            const p = data.preguntas[data.indicePregunta];
                            const max = parseInt(p.puntosMax || 100), min = parseInt(p.puntosMin || 50);
                            const tt = parseInt(p.tiempo || 30);
                            const tr = (Date.now() - (data.questionStartTime || Date.now())) / 1000;
                            puntos = Math.round(min + (max - min) * Math.max(0, Math.min(1, (tt - tr) / tt)));
                        }
                        updates[`respuestasRonda.${uid}.puntosGanados`] = puntos;
                        updates[`respuestasRonda.${uid}.processed`] = true;
                        if (puntos > 0 && data.jugadores?.[uid]) updates[`jugadores.${uid}.puntos`] = increment(puntos);
                    }
                });
                if (hayCambios) await updateDoc(doc(db, 'live_games', codigoSala), updates);
                const n = Object.keys(respuestas).length, total = Object.values(data.jugadores || {}).length;
                if (total > 0 && n >= total) revelarRespuestas(data);
            }
        });
        return () => unsub();
    }, [codigoSala]);

    useEffect(() => { setCargandoSig(false); }, [gameData?.indicePregunta, gameData?.fasePregunta, gameData?.estado]);

    useEffect(() => {
        clearInterval(timerRef.current);
        if (faseHost === 'JUEGO' && subFase === 'RESPONDING' && gameData) {
            const p = gameData.preguntas[gameData.indicePregunta];
            const tt = parseInt(p.tiempo || 30), inicio = gameData.questionStartTime || Date.now();
            timerRef.current = setInterval(() => {
                const restante = Math.max(0, Math.ceil(tt - (Date.now() - inicio) / 1000));
                setTimerVisual(restante);
                if (restante <= 0) { clearInterval(timerRef.current); if (gdRef.current) revelarRespuestas(gdRef.current); }
            }, 500);
        }
        return () => clearInterval(timerRef.current);
    }, [faseHost, subFase, gameData?.indicePregunta, gameData?.questionStartTime]);

    const revelarRespuestas = async (d) => {
        if (d.fasePregunta !== 'RESPONDING') return;
        const resps = Object.values(d.respuestasRonda || {});
        const aciertos = resps.filter(r => r.correct).length;
        const pct = resps.length > 0 ? Math.round((aciertos / resps.length) * 100) : 0;
        setStats({ aciertos, total: resps.length, pct });

        let newMood = 'neutral';
        if (resps.length > 0) { if (pct < 30) newMood = 'angry'; else if (pct >= 60) newMood = 'happy'; }
        setAvatarMood(newMood);

        await updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'REVEAL' });
        setTimeout(() => updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'LEADERBOARD' }), 5000);
    };

    const forzarFin = () => { clearInterval(timerRef.current); const d = gdRef.current || gameData; if (d) revelarRespuestas(d); };

    const siguientePregunta = async () => {
        if (cargandoSig) return; setCargandoSig(true);
        try {
            const d = gdRef.current || gameData;
            const nextIdx = (d.indicePregunta || 0) + 1;
            if (nextIdx < d.preguntas.length) {
                setAvatarMood('neutral');
                await updateDoc(doc(db, 'live_games', codigoSala), { indicePregunta: nextIdx, respuestasRonda: {}, fasePregunta: 'RESPONDING', questionStartTime: Date.now() });
            } else {
                safePlay(audioWin);
                await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'FIN' });
            }
        } catch (e) { console.error(e); setCargandoSig(false); }
    };

    const empezarPartida = async () => { await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'COUNTDOWN' }); };
    const finCuentaAtras = async () => { await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'JUEGO', indicePregunta: 0, respuestasRonda: {}, fasePregunta: 'RESPONDING', questionStartTime: Date.now() }); };

    if (!gameData) return <div className="game-container host-mode"><Loader size={44} color="white" /></div>;

    const currentP = gameData.preguntas?.[gameData.indicePregunta];
    const isLast = (gameData.indicePregunta || 0) >= (gameData.preguntas?.length || 1) - 1;
    const numResponsivos = Object.keys(gameData.respuestasRonda || {}).length;
    const esModoRegla = gameData.config?.modoRegla;

    return (
        <div className="game-container host-mode">
            <EstilosLive />

            <div className="top-hud host-hud">
                <button className="btn-exit" onClick={onExit}>X Salir</button>
                <div className="room-code">SALA: <span>{codigoSala}</span></div>
                <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                    {faseHost === 'JUEGO' && <div className="q-counter">P. {(gameData.indicePregunta || 0) + 1}/{gameData.preguntas?.length}</div>}
                    <div className="player-counter"><Users size={20} /> {jugadores.length}</div>
                </div>
            </div>

            {faseHost === 'JUEGO' && (
                <div className="pi-avatar-container-host">
                    <img src={avatarMood === 'happy' ? piHappy : (avatarMood === 'angry' ? piAngry : piNeutral)} className={`pi-avatar-img ${avatarMood}`} alt="Pi" />
                    <div className="pi-stats-badge">{stats.pct}% Aciertos</div>
                </div>
            )}

            <div className="game-area-host">
                {faseHost === 'LOBBY' && (
                    <div className="lobby-screen">
                        <Calculator size={60} color="#f1c40f" style={{ marginBottom: 10 }} />
                        <h1>Geometrix en Vivo</h1>
                        <div className="big-code">{codigoSala}</div>
                        <p>{esModoRegla ? '📏 MODO REGLA' : '🔢 MODO FÓRMULAS'}</p>
                        <div className="players-grid">{jugadores.map((j, i) => (<div key={i} className="player-chip">{j.nombre}</div>))}</div>
                        <button className="btn-start-big" onClick={empezarPartida} disabled={jugadores.length === 0} style={{ opacity: jugadores.length === 0 ? 0.5 : 1 }}>
                            <Play size={32} fill="white" /> EMPEZAR
                        </button>
                    </div>
                )}

                {faseHost === 'COUNTDOWN' && <PantallaCuentaAtras playSound={safePlay} audioStart={audioStart} onFinished={finCuentaAtras} />}

                {faseHost === 'JUEGO' && currentP && (
                    <div className="host-question-view centered">
                        {subFase === 'RESPONDING' && (
                            <div className="question-card" style={{ width: '90%', maxWidth: 650 }}>
                                <h2 style={{ color: '#34495e' }}>{currentP.text}</h2>
                                <div style={{ position: 'relative', width: '100%', height: canvasDim.h, background: '#f8f9fa', borderRadius: 14, overflow: 'hidden', margin: '20px 0' }}>
                                    <ShapeRenderer shape={currentP.shape} params={currentP.params} unit={currentP.unit} hideText={esModoRegla} canvasDim={canvasDim} rulerMode={false} />
                                </div>
                                <div className="host-waiting">
                                    <div className="timer-big">{timerVisual}s</div>
                                    <p>{numResponsivos} / {jugadores.length} respuestas</p>
                                    <button className="btn-force-timeout" onClick={forzarFin}>⏹ Forzar Final</button>
                                </div>
                            </div>
                        )}

                        {subFase === 'REVEAL' && (
                            <div className="correct-answer-reveal" style={{ marginTop: 50 }}>
                                <div className="reveal-label">La solución es:</div>
                                <div className="reveal-text">{currentP.correctAnswer} {currentP.unit}{currentP.correctExp === '2' ? '²' : currentP.correctExp === '3' ? '³' : ''}</div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 15, borderRadius: 10, marginTop: 20, fontFamily: 'monospace', fontSize: '1.2rem', color: '#f1c40f' }}>
                                    {currentP.formula}
                                </div>
                            </div>
                        )}

                        {subFase === 'LEADERBOARD' && (
                            <div className="podium-screen">
                                <h2>🏆 Ranking de la Ronda</h2>
                                <PodiumDisplay jugadores={jugadores} />
                                <div className="host-controls">
                                    <button className="btn-next-floating" onClick={siguientePregunta} disabled={cargandoSig} style={{ opacity: cargandoSig ? 0.7 : 1 }}>
                                        {cargandoSig ? "..." : (isLast ? "🏆 Ver Podio Final" : "Siguiente Pregunta")} <ArrowUp className="rotate-90" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {faseHost === 'FIN' && (
                    <div className="podium-screen">
                        <h1>🏆 PODIO FINAL 🏆</h1>
                        <PodiumDisplay jugadores={jugadores} final={true} />
                        <button className="btn-exit-big" onClick={onExit} style={{ marginTop: 30 }}>Cerrar Sala</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE — ALUMNO EN VIVO (Con estética MathLive)
// ─────────────────────────────────────────────────────────────────────────────
function GeometrixLiveClient({ codigoSala, usuario, onExit }) {
    const [gameData, setGameData] = useState(null);
    const [fase, setFase] = useState('LOBBY');
    const [subFase, setSubFase] = useState('RESPONDING');
    const [puntuacion, setPuntuacion] = useState(0);
    const [myResult, setMyResult] = useState(null);
    const [myRank, setMyRank] = useState(null);
    const [canvasDim, setCanvasDim] = useState({ w: 380, h: 240 });

    const joiningRef = useRef(false);
    const myName = usuario?.displayName || prompt("Tu nombre:") || "Invitado";
    const myUid = usuario?.uid || 'guest_' + Math.random().toString(36).substr(2, 9);

    useEffect(() => {
        const update = () => { const w = Math.min(window.innerWidth - 40, 500); setCanvasDim({ w: Math.max(260, w), h: Math.max(200, Math.round(w * 0.6)) }); };
        update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update);
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
            if (!snap.exists()) { alert('La sala se ha cerrado.'); onExit(); return; }
            const data = snap.data();
            setGameData(data); setFase(data.estado || 'LOBBY'); setSubFase(data.fasePregunta || 'RESPONDING');

            const jugMap = data.jugadores || {};
            if (jugMap[myUid]) { setPuntuacion(jugMap[myUid].puntos || 0); }
            else if (!joiningRef.current && (data.estado === 'LOBBY' || data.estado === 'JUEGO')) {
                joiningRef.current = true;
                await updateDoc(doc(db, 'live_games', codigoSala), { [`jugadores.${myUid}`]: { uid: myUid, nombre: myName, puntos: 0 } });
                joiningRef.current = false;
            }
            setMyResult(data.respuestasRonda?.[myUid] || null);
            if (data.estado === 'FIN') {
                const sorted = Object.values(jugMap).sort((a, b) => b.puntos - a.puntos);
                setMyRank(sorted.findIndex(j => j.uid === myUid) + 1);
            }
        });
        return () => unsub();
    }, [codigoSala]);

    if (!gameData) return <div className="game-container client-mode"><Loader size={40} color="white" /></div>;

    const p = gameData.preguntas?.[gameData.indicePregunta];
    const esModoRegla = gameData.config?.modoRegla;

    return (
        <div className="game-container client-mode">
            <EstilosLive />
            <div className="client-header-container">
                <button className="btn-exit" onClick={onExit} style={{ position: 'absolute', left: 10 }}>X</button>
                <div className="client-score-wrapper">
                    <div className="score-badge blue-pill">{puntuacion} pts</div>
                </div>
            </div>

            {fase === 'LOBBY' && (
                <div className="lobby-wait">
                    <Calculator size={80} color="#f1c40f" style={{ marginBottom: 20 }} />
                    <h2>¡Hola {myName}!</h2>
                    <p>Espera a que el profesor empiece...</p>
                </div>
            )}

            {fase === 'COUNTDOWN' && <div className="lobby-wait"><h1 style={{ fontSize: '6rem', color: '#f1c40f', margin: 0 }}>¡ATENTOS!</h1></div>}

            {fase === 'JUEGO' && p && (
                <ClientPreguntaGeo
                    key={gameData.indicePregunta}
                    pregunta={p}
                    startTime={gameData.questionStartTime}
                    subFase={subFase}
                    myResult={myResult}
                    puntuacion={puntuacion}
                    canvasDim={canvasDim}
                    esModoRegla={esModoRegla}
                    onResponder={async (esCorrecta) => {
                        await updateDoc(doc(db, 'live_games', codigoSala), {
                            [`respuestasRonda.${myUid}`]: { uid: myUid, correct: esCorrecta, puntosGanados: 0, processed: false }
                        });
                    }}
                />
            )}

            {fase === 'FIN' && (
                <div className="final-screen-client">
                    {myRank <= 3 && <Confetti recycle={false} numberOfPieces={200} />}
                    <h1 className="final-title">¡FIN DE PARTIDA!</h1>
                    <div className="final-card-client">
                        <p className="final-text-intro">Enhorabuena <span className="highlight-name">{myName}</span></p>
                        <p className="final-text-body">has quedado en<br /><span className="highlight-rank">{myRank}º posición</span></p>
                        <p className="final-text-body">con <span className="highlight-score">{puntuacion} puntos</span></p>
                        <button onClick={onExit} className="btn-confirmar-amarillo" style={{ marginTop: 20 }}>Salir al Menú</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ClientPreguntaGeo({ pregunta, startTime, subFase, myResult, puntuacion, canvasDim, esModoRegla, onResponder }) {
    const [userAnswer, setUserAnswer] = useState('');
    const [userUnit, setUserUnit] = useState(esModoRegla ? 'cm' : '');
    const [userExp, setUserExp] = useState('');
    const [enviado, setEnviado] = useState(false);
    const [timeLeft, setTimeLeft] = useState(100);
    const [isLate, setIsLate] = useState(false);
    const [drawMode, setDrawMode] = useState(false);
    const [showCalc, setShowCalc] = useState(false);
    const tRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (subFase !== 'RESPONDING' || enviado) return;
        const tt = parseInt(pregunta.tiempo || 30);
        tRef.current = setInterval(() => {
            const tr = (Date.now() - startTime) / 1000;
            const pct = Math.max(0, 100 - (tr / tt * 100));
            setTimeLeft(pct);
            if (pct < 20) setIsLate(true);
            if (pct <= 0) { clearInterval(tRef.current); if (!enviado) enviar(true); }
        }, 150);
        return () => clearInterval(tRef.current);
    }, [startTime, subFase, enviado]);

    const enviar = (porTiempo = false) => {
        if (enviado) return;
        let esCorrecta = false;
        if (!porTiempo) {
            const uv = parseFloat(userAnswer.replace(',', '.'));
            const cv = pregunta.correctAnswer;
            const margen = Math.max(0.2, cv * (esModoRegla ? 0.05 : 0.02));
            esCorrecta = !isNaN(uv) && Math.abs(uv - cv) <= margen && userUnit === pregunta.unit && userExp === pregunta.correctExp;
        }
        clearInterval(tRef.current);
        setEnviado(true);
        onResponder(esCorrecta);
    };

    const strUnit = `${pregunta.unit}${pregunta.correctExp === '2' ? '²' : pregunta.correctExp === '3' ? '³' : ''}`;

    if (subFase === 'REVEAL') {
        const ok = myResult?.correct; const pts = myResult?.puntosGanados || 0;
        return (
            <div className="feedback-container">
                <div className="pi-feedback-wrapper"><img src={ok ? piHappy : piAngry} className={`pi-feedback ${ok ? 'happy' : 'angry'}`} alt="Pi" /></div>
                <div className={`neon-card ${ok ? 'success' : 'error'}`}>
                    {ok ? <CheckCircle size={50} color="#2ecc71" /> : <XCircle size={50} color="#ff003c" />}
                    <div className="neon-title">{ok ? '¡CORRECTO!' : (!myResult ? '¡TIEMPO!' : 'INCORRECTO')}</div>
                    {ok ? <div className="points-added">+{pts} pts</div> : <div className="neon-answer">{pregunta.correctAnswer} {strUnit}</div>}
                </div>
            </div>
        );
    }

    if (subFase === 'LEADERBOARD') {
        return (
            <div className="feedback-container">
                <div className="pi-feedback-wrapper"><img src={piNeutral} className="pi-feedback" alt="Pi" /></div>
                <div className="neon-card neutral">
                    <div className="neon-title">Puntuación Total</div>
                    <div className="points-added big">{puntuacion} pts</div>
                </div>
            </div>
        );
    }

    return (
        <div className="client-question-area" style={{ flexDirection: 'column', gap: 15, padding: 10 }}>
            <div className={`timer-bar-container ${isLate ? 'blinking' : ''}`} style={{ width: '100%', maxWidth: 500, margin: '60px 0 10px' }}>
                <div className="timer-bar-fill" style={{ width: `${timeLeft}%`, backgroundColor: isLate ? '#e74c3c' : '#2ecc71' }} />
            </div>

            {enviado || myResult ? (
                <div className="waiting-others"><Loader className="spin-icon" size={48} /><p>Respuesta enviada. Espera...</p></div>
            ) : (
                    <div className="question-card" style={{ width: '100%', maxWidth: 500, padding: 15 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <p style={{ flex: 1, color: '#2c3e50', fontWeight: 'bold', fontSize: '1.05rem', margin: 0 }}>{pregunta.text}</p>
                            <button onClick={() => setDrawMode(d => !d)} title={drawMode ? 'Desactivar' : 'Anotar'}
                                style={{ flexShrink: 0, background: drawMode ? '#3498db' : '#f0f0f0', color: drawMode ? 'white' : '#555', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: '1.1rem', cursor: 'pointer' }}>
                                ✏️
                            </button>
                            <button onClick={() => setShowCalc(s => !s)} title="Mini calculadora"
                                style={{ flexShrink: 0, background: showCalc ? '#f39c12' : '#f0f0f0', color: showCalc ? 'white' : '#555', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: '1.1rem', cursor: 'pointer' }}>🧮</button>
                        </div>

                        {showCalc && <MiniCalculadora onClose={() => setShowCalc(false)} />}

                        {esModoRegla ? (
                            <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', borderRadius: 14, border: '1px solid #ddd', background: '#f8f9fa', marginBottom: 15 }}>
                                <div ref={canvasRef} style={{ position: 'relative', width: `${canvasDim.w}px`, height: `${canvasDim.h}px`, flexShrink: 0 }}>
                                    <ShapeRenderer shape={pregunta.shape} params={pregunta.params} unit={pregunta.unit} hideText={true} canvasDim={canvasDim} rulerMode={true} />
                                    <DrawingCanvas width={canvasDim.w} height={canvasDim.h} active={drawMode} key="client-draw" />
                                    <VirtualRuler canvasRef={canvasRef} canvasDim={canvasDim} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ position: 'relative', width: '100%', height: canvasDim.h, background: '#f8f9fa', borderRadius: 14, overflow: 'hidden', marginBottom: 15, border: '1px solid #ddd' }}>
                                <ShapeRenderer shape={pregunta.shape} params={pregunta.params} unit={pregunta.unit} hideText={false} canvasDim={canvasDim} rulerMode={false} />
                                <DrawingCanvas width={canvasDim.w} height={canvasDim.h} active={drawMode} key="client-draw" />
                            </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                            <input type="number" step="0.01" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} placeholder="Núm" style={{ padding: 10, fontSize: '1.1rem', borderRadius: 8, border: '2px solid #bdc3c7', textAlign: 'center', outline: 'none', width: 80 }} />
                            <select value={userUnit} onChange={e => setUserUnit(e.target.value)} disabled={esModoRegla} style={{ padding: 8, fontSize: '0.9rem', borderRadius: 8, border: '2px solid #bdc3c7', outline: 'none', background: 'white' }}>
                                <option value="">Unidad...</option>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <select value={userExp} onChange={e => setUserExp(e.target.value)} style={{ padding: 8, fontSize: '0.9rem', borderRadius: 8, border: '2px solid #bdc3c7', outline: 'none', background: 'white' }}>
                                <option value="">(Lin)</option><option value="2">²</option><option value="3">³</option>
                            </select>
                        </div>
                        <button onClick={() => enviar(false)} disabled={!userAnswer || !userUnit} className="btn-confirmar-amarillo" style={{ width: '100%', padding: '12px', fontSize: '1.1rem', marginTop: 15, background: userAnswer && userUnit ? '#2ecc71' : '#ccc', color: 'white' }}>✓ Enviar</button>
                    </div>
                )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI CALCULADORA
// ─────────────────────────────────────────────────────────────────────────────
function MiniCalculadora({ onClose }) {
    const [display, setDisplay] = useState('0');
    const [prev, setPrev] = useState(null);
    const [op, setOp] = useState(null);
    const [waitNext, setWaitNext] = useState(false);

    const pressNum = (n) => {
        if (waitNext) { setDisplay(String(n)); setWaitNext(false); }
        else setDisplay(d => d === '0' ? String(n) : d + n);
    };
    const pressDecimal = () => {
        if (waitNext) { setDisplay('0.'); setWaitNext(false); return; }
        if (!display.includes('.')) setDisplay(d => d + '.');
    };
    const pressOp = (o) => {
        const cur = parseFloat(display);
        if (prev !== null && !waitNext) {
            const res = calc(prev, cur, op);
            setDisplay(String(parseFloat(res.toFixed(8))));
            setPrev(parseFloat(res.toFixed(8)));
        } else { setPrev(cur); }
        setOp(o); setWaitNext(true);
    };
    const calc = (a, b, o) => { if (o === '+') return a + b; if (o === '-') return a - b; if (o === '×') return a * b; if (o === '÷') return b !== 0 ? a / b : 0; return b; };
    const pressEqual = () => {
        if (op === null || prev === null) return;
        const res = calc(prev, parseFloat(display), op);
        setDisplay(String(parseFloat(res.toFixed(8))));
        setPrev(null); setOp(null); setWaitNext(true);
    };
    const pressClear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaitNext(false); };
    const pressPi = () => { setDisplay(String(parseFloat(Math.PI.toFixed(8)))); setWaitNext(false); };
    const pressSqrt = () => { setDisplay(d => String(parseFloat(Math.sqrt(parseFloat(d)).toFixed(8)))); setWaitNext(true); };
    const pressSq = () => { const v = parseFloat(display); setDisplay(String(parseFloat((v * v).toFixed(8)))); setWaitNext(true); };

    const btn = (label, onClick, bg = '#f0f0f0', col = '#333') => (
        <button key={label} onClick={onClick} style={{ padding: '10px 0', background: bg, color: col, border: '1px solid #ddd', borderRadius: 8, fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', touchAction: 'manipulation' }}>
            {label}
        </button>
    );

    return (
        <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
            <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
            <div style={{ background: '#0d0d1f', color: '#f1c40f', fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'right', padding: '10px 12px', borderRadius: 10, marginBottom: 10, minHeight: 48, wordBreak: 'break-all' }}>
                {op && <span style={{ fontSize: '0.75rem', color: '#888', marginRight: 8 }}>{prev} {op}</span>}
                {display}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {btn('C', pressClear, '#e74c3c', 'white')}
                {btn('√', pressSqrt, '#3498db', 'white')}
                {btn('x²', pressSq, '#3498db', 'white')}
                {btn('÷', () => pressOp('÷'), '#f39c12', 'white')}
                {btn('7', () => pressNum('7'))}{btn('8', () => pressNum('8'))}{btn('9', () => pressNum('9'))}
                {btn('×', () => pressOp('×'), '#f39c12', 'white')}
                {btn('4', () => pressNum('4'))}{btn('5', () => pressNum('5'))}{btn('6', () => pressNum('6'))}
                {btn('-', () => pressOp('-'), '#f39c12', 'white')}
                {btn('1', () => pressNum('1'))}{btn('2', () => pressNum('2'))}{btn('3', () => pressNum('3'))}
                {btn('+', () => pressOp('+'), '#f39c12', 'white')}
                {btn('π', pressPi, '#9b59b6', 'white')}{btn('0', () => pressNum('0'))}{btn('.', pressDecimal)}
                {btn('=', pressEqual, '#2ecc71', 'white')}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS DE ANOTACIONES TÁCTIL/RATÓN
// ─────────────────────────────────────────────────────────────────────────────
function DrawingCanvas({ width, height, active }) {
    const cvRef = useRef(null);
    const drawing = useRef(false);
    const lastPos = useRef(null);
    const [color, setColor] = useState('#e74c3c');
    const [isEraser, setIsEraser] = useState(false);

    const getPos = (e) => {
        const rect = cvRef.current.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const startDraw = (e) => {
        if (!active) return;
        e.preventDefault();
        drawing.current = true;
        lastPos.current = getPos(e);
    };

    const doDraw = (e) => {
        if (!drawing.current || !active) return;
        e.preventDefault();
        const pos = getPos(e);
        const ctx = cvRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
        ctx.lineWidth = isEraser ? 22 : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        lastPos.current = pos;
    };

    const stopDraw = () => { drawing.current = false; };

    const clearCanvas = () => {
        const ctx = cvRef.current.getContext('2d');
        ctx.clearRect(0, 0, width, height);
    };

    const COLORS = ['#e74c3c', '#2c3e50', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

    return (
        <>
            <canvas
                ref={cvRef}
                width={width}
                height={height}
                style={{
                    position: 'absolute', top: 0, left: 0, zIndex: 6,
                    pointerEvents: active ? 'auto' : 'none',
                    cursor: active ? (isEraser ? 'cell' : 'crosshair') : 'default',
                    touchAction: 'none',
                }}
                onMouseDown={startDraw} onMouseMove={doDraw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={doDraw} onTouchEnd={stopDraw}
            />
            {active && (
                <div style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 10,
                    display: 'flex', gap: 4, alignItems: 'center',
                    background: 'rgba(255,255,255,0.93)', borderRadius: 10,
                    padding: '4px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}>
                    {COLORS.map(c => (
                        <button key={c} onClick={() => { setIsEraser(false); setColor(c); }}
                            style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: (!isEraser && color === c) ? '3px solid white' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', boxShadow: (!isEraser && color === c) ? `0 0 0 2px ${c}` : 'none', padding: 0 }} />
                    ))}
                    <button onClick={() => setIsEraser(e => !e)}
                        style={{ background: isEraser ? '#e0e0e0' : 'transparent', border: '1px solid #ccc', borderRadius: 6, padding: '2px 5px', cursor: 'pointer', fontSize: '0.85rem' }} title="Borrador">
                        ⬜
                    </button>
                    <button onClick={clearCanvas}
                        style={{ background: 'transparent', border: '1px solid #ccc', borderRadius: 6, padding: '2px 5px', cursor: 'pointer', fontSize: '0.85rem' }} title="Borrar todo">
                        🗑️
                    </button>
                </div>
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES COMPARTIDOS (Regla, Figuras, Podium, Timer)
// ─────────────────────────────────────────────────────────────────────────────
function PantallaCuentaAtras({ playSound, audioStart, onFinished }) {
    const [paso, setPaso] = useState(0); const [txt, setTxt] = useState('π');
    useEffect(() => { if (playSound) playSound(audioStart); const seq = async () => { setTxt("π"); setPaso(0); await new Promise(r => setTimeout(r, 1000)); setTxt("K"); setPaso(1); await new Promise(r => setTimeout(r, 1000)); setTxt("T"); setPaso(2); await new Promise(r => setTimeout(r, 1000)); setTxt("¡YA!"); setPaso(3); await new Promise(r => setTimeout(r, 1000)); onFinished(); }; seq(); }, []);
    return <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle,#2c3e50,#000)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}><div style={{ fontSize: '10rem', fontWeight: 'bold', color: paso === 0 ? '#3498db' : paso === 1 ? '#e74c3c' : paso === 2 ? '#f1c40f' : '#2ecc71', animation: 'zoomIn 0.5s', transform: paso === 3 ? 'scale(1.2)' : 'scale(1)' }}>{txt}</div><style>{`@keyframes zoomIn{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style></div>;
}

function PodiumDisplay({ jugadores, final }) {
    const sorted = [...jugadores].sort((a, b) => b.puntos - a.puntos);
    const top3 = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
    const rest = sorted.slice(3, 8);
    return (
        <div className="podium-container">
            <div className="podium-stage">
                {top3.map((j) => {
                    const realRank = sorted.indexOf(j) + 1;
                    let height = '100px'; if (realRank === 1) height = '160px'; if (realRank === 2) height = '120px';
                    return (
                        <div key={j.uid} className={`podium-pedestal rank-${realRank}`}>
                            <div className="podium-avatar">{realRank === 1 && <Trophy size={40} color="#f1c40f" />}{realRank === 2 && <Medal size={30} color="#bdc3c7" />}{realRank === 3 && <Medal size={30} color="#d35400" />}</div>
                            <div className="pedestal-bar" style={{ height }}><div className="p-rank">{realRank}º</div></div>
                            <div className="p-name">{j.nombre}</div>
                            <div className="p-score">{j.puntos}</div>
                        </div>
                    );
                })}
            </div>
            <div className="runners-up-grid">
                {rest.map((j, i) => (<div key={j.uid} className="runner-up-card"><span className="r-rank">{i + 4}º</span><span className="r-name">{j.nombre}</span><span className="r-score">{j.puntos}</span></div>))}
            </div>
        </div>
    );
}

const VirtualRuler = ({ canvasRef, canvasDim }) => {
    const [pos, setPos] = useState({ x: 10, y: canvasDim.h - 55 });
    const [angle, setAngle] = useState(0);
    const rulerRef = useRef(null);
    const draggingCenter = useRef(false);
    const draggingRotate = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const rulerCmLength = Math.max(5, Math.floor(canvasDim.w / SCALE) - 1);

    useEffect(() => {
        const getXY = (e) => e.touches && e.touches[0] ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : { clientX: e.clientX, clientY: e.clientY };
        const handleMove = (e) => {
            if (!draggingCenter.current && !draggingRotate.current) return;
            e.preventDefault();
            const { clientX, clientY } = getXY(e);
            if (draggingCenter.current && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const rulerW = rulerCmLength * SCALE;
                setPos({ x: Math.max(-rulerW + 20, Math.min(canvasDim.w - 20, clientX - rect.left - offset.current.x)), y: Math.max(-10, Math.min(canvasDim.h - 25, clientY - rect.top - offset.current.y)) });
            } else if (draggingRotate.current && rulerRef.current) {
                const rect = rulerRef.current.getBoundingClientRect();
                setAngle(Math.atan2(clientY - (rect.top + rect.height / 2), clientX - rect.left) * (180 / Math.PI));
            }
        };
        const handleUp = () => { draggingCenter.current = false; draggingRotate.current = false; };
        window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleUp);
        return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp); };
    }, [canvasRef, canvasDim, rulerCmLength]);

    const startDrag = (e, type) => {
        e.preventDefault(); e.stopPropagation();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        if (type === 'move' && canvasRef.current) { draggingCenter.current = true; const rect = canvasRef.current.getBoundingClientRect(); offset.current = { x: clientX - rect.left - pos.x, y: clientY - rect.top - pos.y }; }
        else if (type === 'rotate') { draggingRotate.current = true; }
    };

    const marks = [];
    for (let i = 0; i <= rulerCmLength; i++) {
        marks.push(<div key={i} style={{ position: 'absolute', left: `${i * SCALE}px`, top: 0, height: i % 5 === 0 ? '100%' : '50%', width: 1, background: '#333' }}>{i % 5 === 0 && <span style={{ position: 'absolute', bottom: -16, left: -4, fontSize: 11, fontWeight: 'bold', color: '#333', transform: `rotate(${-angle}deg)`, userSelect: 'none' }}>{i}</span>}</div>);
    }

    const angleFromHorizontal = (() => { const norm = ((angle % 180) + 180) % 180; return norm <= 90 ? norm : 180 - norm; })();
    const handleSnap = (e) => { e.preventDefault(); e.stopPropagation(); setAngle(angleFromHorizontal < 45 ? 90 : 0); };

    return (
        <div ref={rulerRef} style={{ position: 'absolute', left: pos.x, top: pos.y, width: `${rulerCmLength * SCALE}px`, height: 35, background: 'rgba(241,196,15,0.72)', border: '1px solid rgba(0,0,0,0.28)', borderRadius: 3, transform: `rotate(${angle}deg)`, transformOrigin: '0 50%', cursor: 'grab', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.18)', touchAction: 'none', userSelect: 'none' }} onMouseDown={e => startDrag(e, 'move')} onTouchStart={e => startDrag(e, 'move')}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>{marks}</div>
            <div title={angleFromHorizontal < 45 ? 'Poner vertical' : 'Poner horizontal'} style={{ position: 'absolute', left: -15, top: '50%', transform: `translateY(-50%) rotate(${-angle}deg)`, width: 32, height: 32, background: '#27ae60', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', touchAction: 'none', fontSize: 15, fontWeight: 'bold' }} onMouseDown={handleSnap} onTouchStart={handleSnap}>{angleFromHorizontal < 45 ? '↕' : '↔'}</div>
            <div style={{ position: 'absolute', right: -15, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, background: '#3498db', color: 'white', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'crosshair', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', touchAction: 'none', fontSize: 18 }} onMouseDown={e => { e.stopPropagation(); startDrag(e, 'rotate'); }} onTouchStart={e => { e.stopPropagation(); startDrag(e, 'rotate'); }}>↻</div>
        </div>
    );
};

const ShapeRenderer = ({ shape, params, unit, hideText, canvasDim, rulerMode }) => {
    const cx = canvasDim.w / 2, cy = canvasDim.h / 2;
    let activeScale = SCALE;
    if (!rulerMode) {
        const maxW = canvasDim.w - 60, maxH = canvasDim.h - 60;
        let shapeW = 1, shapeH = 1;
        switch (shape) {
            case 'CUADRADO': shapeW = params.l; shapeH = params.l; break;
            case 'RECTANGULO': shapeW = params.b; shapeH = params.h; break;
            case 'TRIANGULO': shapeW = params.b; shapeH = params.h; break;
            case 'CIRCULO': shapeW = params.r * 2; shapeH = params.r * 2; break;
            case 'ROMBO': shapeW = params.D || params.l * 2; shapeH = params.d || params.l * 2; break;
            case 'TRAPECIO': shapeW = params.B; shapeH = params.h || params.l_obl * 0.8; break;
            case 'CILINDRO': shapeW = params.r * 2; shapeH = params.h * 1.2; break;
            case 'CONO': shapeW = params.r * 2; shapeH = params.h * 1.1; break;
            case 'ESFERA': shapeW = params.r * 2; shapeH = params.r * 2; break;
            case 'PRISMA_RECT': shapeW = Math.max(params.l, params.w) * 1.5; shapeH = params.h * 1.2; break;
            default: shapeW = shapeH = 10;
        }
        activeScale = Math.min(maxW / shapeW, maxH / shapeH, 120);
    }
    const svgProps = rulerMode
        ? { width: canvasDim.w, height: canvasDim.h, viewBox: `0 0 ${canvasDim.w} ${canvasDim.h}`, fill: 'none', style: { display: 'block' } }
        : { width: '100%', height: '100%', viewBox: `0 0 ${canvasDim.w} ${canvasDim.h}`, fill: 'none', style: { display: 'block' } };
    const tP = { fill: '#e74c3c', fontSize: '16', fontWeight: 'bold', fontFamily: 'Arial', textAnchor: 'middle' };
    const s2D = { fill: '#e3f2fd', stroke: '#2c3e50', strokeWidth: '3' };
    const s3D = { fill: 'rgba(155,89,182,0.2)', stroke: '#9b59b6', strokeWidth: '3' };
    const T = (cfg, lbl) => !hideText && <text x={cfg.x} y={cfg.y} {...tP} transform={cfg.rot ? `rotate(${cfg.rot} ${cfg.x},${cfg.y})` : ''}>{lbl} {unit}</text>;

    switch (shape) {
        case 'CUADRADO': { const w = params.l * activeScale; return <svg {...svgProps}><rect x={cx - w / 2} y={cy - w / 2} width={w} height={w} {...s2D} fill="#e8f5e9" />{T({ x: cx, y: cy + w / 2 + 20 }, params.l)}{T({ x: cx - w / 2 - 15, y: cy, rot: -90 }, params.l)}</svg>; }
        case 'RECTANGULO': { const w = params.b * activeScale, h = params.h * activeScale; return <svg {...svgProps}><rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} {...s2D} fill="#e3f2fd" />{T({ x: cx, y: cy + h / 2 + 20 }, params.b)}{T({ x: cx - w / 2 - 15, y: cy, rot: -90 }, params.h)}</svg>; }
        case 'TRIANGULO': { const w = params.b * activeScale, h = params.h * activeScale; const pts = `${cx - w / 2},${cy + h / 2} ${cx + w / 2},${cy + h / 2} ${cx},${cy - h / 2}`; return <svg {...svgProps}><polygon points={pts} {...s2D} fill="#fcf3cf" />{T({ x: cx, y: cy + h / 2 + 20 }, params.b)}<line x1={cx} y1={cy - h / 2} x2={cx} y2={cy + h / 2} stroke="#f1c40f" strokeDasharray="6,6" strokeWidth="2" />{T({ x: cx + 20, y: cy }, params.h)}</svg>; }
        case 'CIRCULO': { const r = params.r * activeScale; return <svg {...svgProps}><circle cx={cx} cy={cy} r={r} {...s2D} fill="#fadbd8" /><line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#e74c3c" strokeDasharray="6,6" strokeWidth="2" />{T({ x: cx + r / 2, y: cy - 10 }, params.r)}</svg>; }
        case 'ROMBO': {
            if (params.D) { const W = params.D * activeScale, H = params.d * activeScale; const pts = `${cx},${cy - H / 2} ${cx + W / 2},${cy} ${cx},${cy + H / 2} ${cx - W / 2},${cy}`; return <svg {...svgProps}><polygon points={pts} {...s2D} fill="#fce4ec" /><line x1={cx - W / 2} y1={cy} x2={cx + W / 2} y2={cy} stroke="#e84393" strokeDasharray="6,6" strokeWidth="2" /><line x1={cx} y1={cy - H / 2} x2={cx} y2={cy + H / 2} stroke="#e84393" strokeDasharray="6,6" strokeWidth="2" />{T({ x: cx + W / 4, y: cy - 10 }, params.D)}{T({ x: cx + 15, y: cy + H / 4 }, params.d)}</svg>; }
            else { const L = params.l * activeScale; const pts = `${cx},${cy - L} ${cx + L},${cy} ${cx},${cy + L} ${cx - L},${cy}`; return <svg {...svgProps}><polygon points={pts} {...s2D} fill="#fce4ec" />{T({ x: cx + L / 2 + 15, y: cy - L / 2 - 15 }, params.l)}</svg>; }
        }
        case 'TRAPECIO': { const B = params.B * activeScale, b = params.b * activeScale; const h = params.h ? params.h * activeScale : (Math.sqrt(Math.pow(params.l_obl, 2) - Math.pow((params.B - params.b) / 2, 2)) || 5) * activeScale; const pts = `${cx - b / 2},${cy - h / 2} ${cx + b / 2},${cy - h / 2} ${cx + B / 2},${cy + h / 2} ${cx - B / 2},${cy + h / 2}`; return <svg {...svgProps}><polygon points={pts} {...s2D} fill="#e0f2f1" />{T({ x: cx, y: cy - h / 2 - 10 }, params.b)}{T({ x: cx, y: cy + h / 2 + 20 }, params.B)}{params.h ? <><line x1={cx - b / 2} y1={cy - h / 2} x2={cx - b / 2} y2={cy + h / 2} stroke="#00cec9" strokeDasharray="6,6" strokeWidth="2" />{T({ x: cx - b / 2 + 20, y: cy }, params.h)}</> : T({ x: cx - B / 2 + 15, y: cy, rot: -60 }, params.l_obl)}</svg>; }
        case 'CILINDRO': { const r = params.r * activeScale, h = params.h * activeScale, ry = r * 0.3; return <svg {...svgProps}><ellipse cx={cx} cy={cy - h / 2} rx={r} ry={ry} fill="#fbeee6" stroke="#e67e22" strokeWidth="3" /><line x1={cx - r} y1={cy - h / 2} x2={cx - r} y2={cy + h / 2} stroke="#e67e22" strokeWidth="3" /><line x1={cx + r} y1={cy - h / 2} x2={cx + r} y2={cy + h / 2} stroke="#e67e22" strokeWidth="3" /><path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 0 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#e67e22" strokeWidth="3" /><path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 1 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#e67e22" strokeWidth="3" strokeDasharray="6,6" /><line x1={cx - r} y1={cy - h / 2} x2={cx + r} y2={cy - h / 2} stroke="#e67e22" strokeDasharray="6,6" strokeWidth="2" />{T({ x: cx + 15, y: cy - h / 2 - ry - 5 }, params.r)}{T({ x: cx - r - 20, y: cy, rot: -90 }, params.h)}</svg>; }
        case 'CONO': { const r = params.r * activeScale, h = params.h * activeScale, ry = r * 0.3; return <svg {...svgProps}><line x1={cx - r} y1={cy + h / 2} x2={cx} y2={cy - h / 2} stroke="#d63031" strokeWidth="3" /><line x1={cx + r} y1={cy + h / 2} x2={cx} y2={cy - h / 2} stroke="#d63031" strokeWidth="3" /><path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 0 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#d63031" strokeWidth="3" /><path d={`M ${cx - r} ${cy + h / 2} A ${r} ${ry} 0 0 1 ${cx + r} ${cy + h / 2}`} fill="none" stroke="#d63031" strokeWidth="3" strokeDasharray="6,6" /><line x1={cx - r} y1={cy + h / 2} x2={cx + r} y2={cy + h / 2} stroke="#d63031" strokeDasharray="6,6" strokeWidth="2" /><line x1={cx} y1={cy - h / 2} x2={cx} y2={cy + h / 2} stroke="#d63031" strokeDasharray="6,6" strokeWidth="2" />{T({ x: cx + r / 2, y: cy + h / 2 + 20 }, params.r)}{T({ x: cx + 15, y: cy }, params.h)}</svg>; }
        case 'ESFERA': { const r = params.r * activeScale; return <svg {...svgProps}><circle cx={cx} cy={cy} r={r} fill="rgba(52,152,219,0.15)" stroke="#2980b9" strokeWidth="3" /><ellipse cx={cx} cy={cy} rx={r} ry={r * 0.3} fill="none" stroke="#2980b9" strokeWidth="2" strokeDasharray="6,4" /><line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#2980b9" strokeDasharray="5,4" strokeWidth="2" />{T({ x: cx + r / 2, y: cy - 10 }, params.r)}</svg>; }
        case 'PRISMA_RECT': { const w = params.l * activeScale, h = params.h * activeScale, d = params.w * activeScale * 0.5, off = d * 0.7; return <svg {...svgProps}><rect x={cx - w / 2 + off} y={cy - h / 2 - off} width={w} height={h} fill="none" stroke="#6c5ce7" strokeWidth="3" /><line x1={cx - w / 2} y1={cy - h / 2} x2={cx - w / 2 + off} y2={cy - h / 2 - off} stroke="#6c5ce7" strokeWidth="3" /><line x1={cx + w / 2} y1={cy - h / 2} x2={cx + w / 2 + off} y2={cy - h / 2 - off} stroke="#6c5ce7" strokeWidth="3" /><line x1={cx - w / 2} y1={cy + h / 2} x2={cx - w / 2 + off} y2={cy + h / 2 - off} stroke="#6c5ce7" strokeWidth="3" /><line x1={cx + w / 2} y1={cy + h / 2} x2={cx + w / 2 + off} y2={cy + h / 2 - off} stroke="#6c5ce7" strokeWidth="3" /><rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="rgba(108,92,231,0.2)" stroke="#6c5ce7" strokeWidth="3" />{T({ x: cx, y: cy + h / 2 + 20 }, params.l)}{T({ x: cx - w / 2 - 18, y: cy, rot: -90 }, params.h)}{T({ x: cx + w / 2 + off / 2 + 12, y: cy - h / 2 - off / 2 - 5 }, params.w)}</svg>; }
        default: return null;
    }
};

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const sLocal = {
    container: { minHeight: '100vh', background: '#e0f7fa', padding: 15, fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 },
    btnVolver: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    scoreBoard: { display: 'flex', gap: 12, background: 'white', padding: '8px 16px', borderRadius: 30, fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: 700, margin: '10px auto', padding: 30, borderRadius: 20, textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box', width: '100%' },
    btnPrimary: { color: 'white', border: 'none', padding: '13px 24px', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.18)', width: '100%', justifyContent: 'center', maxWidth: 320, boxSizing: 'border-box' },
    inputNum: { padding: 11, fontSize: '1.1rem', borderRadius: 8, border: '2px solid #bdc3c7', textAlign: 'center', outline: 'none' },
    inputSelect: { padding: 11, fontSize: '0.95rem', borderRadius: 8, border: '2px solid #bdc3c7', outline: 'none', background: 'white', cursor: 'pointer' },
    btnSuccess: { color: 'white', border: 'none', padding: '11px 20px', borderRadius: 8, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.25)' },
    formulaBox: { background: '#f0f4ff', border: '2px dashed #3498db', borderRadius: 12, padding: '14px 18px', margin: '14px 0', textAlign: 'left' },
    formulaLabel: { fontSize: '0.82rem', color: '#3498db', fontWeight: 'bold', marginBottom: 6 },
    formulaText: { fontSize: '1rem', color: '#2c3e50', fontFamily: "'Courier New', monospace", fontWeight: 'bold', wordBreak: 'break-word' },
};

const sLive = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: 'white', borderRadius: 20, padding: '26px 20px', maxWidth: 460, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' },
    section: { marginBottom: 20 },
    label: { fontWeight: 'bold', color: '#666', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, textAlign: 'center' },
    chip: { padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' },
    btnPri: { padding: '12px 26px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' },
    btnSec: { padding: '12px 22px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }
};

const EstilosLive = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Roboto:wght@400;700&display=swap');
        
        .game-container { width: 100vw; height: 100vh; background: #2c3e50; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; position: relative; font-family: 'Roboto', sans-serif; box-sizing: border-box; }
        .host-mode { background: #0d0d1f; color: white; }
        .client-mode { background: #2c3e50; color: white; }
        
        /* HEADER HOST */
        .host-hud { background: #1a1a2e; height: 60px; padding: 0 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.4); width: 100%; display: flex; justify-content: space-between; align-items: center; position: absolute; top: 0; left: 0; z-index: 100; }
        .room-code { font-size: 1.5rem; font-weight: bold; color: white; }
        .room-code span { color: #f1c40f; font-family: 'monospace'; letter-spacing: 2px; }
        .player-counter { color: white; display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
        .q-counter { background: rgba(241,196,15,0.14); color: #f1c40f; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
        .btn-exit { background: rgba(255,255,255,0.1); border: none; color: white; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; }
        
        /* HEADER ALUMNO */
        .client-header-container { position: absolute; top: 0; left: 0; width: 100%; padding: 15px; display: flex; justify-content: center; align-items: center; z-index: 3000; }
        .client-score-wrapper { display: flex; align-items: center; }
        .score-badge { background: #3498db; color: white; padding: 10px 20px; border-radius: 30px; font-weight: bold; font-size: 1.2rem; }
        
        /* AVATAR PI */
        .pi-avatar-container-host { position: absolute; top: 80px; left: 20px; z-index: 50; display: flex; flex-direction: column; align-items: center; transition: all 0.3s; }
        .pi-avatar-img { width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3)); }
        .pi-stats-badge { background: #f1c40f; color: #2c3e50; padding: 5px 10px; border-radius: 10px; font-weight: bold; font-family: 'Righteous'; margin-top: -10px; }
        .happy { animation: bounce 1s infinite; }
        .angry { animation: shake 0.5s; }

        /* HOST AREA */
        .game-area-host { flex: 1; display: flex; flex-direction: column; align-items: center; width: 100%; padding-top: 80px; overflow-y: auto; }
        .lobby-screen { text-align: center; background: rgba(255,255,255,0.05); padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); width: 90%; max-width: 600px; margin-top: 40px;}
        .big-code { font-size: 5rem; font-family: 'Righteous'; color: #f1c40f; letter-spacing: 5px; margin: 10px 0; text-shadow: 0 0 20px rgba(241,196,15,0.3); }
        .players-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 20px 0; min-height: 60px; }
        .player-chip { background: rgba(52,152,219,0.2); border: 1px solid #3498db; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
        .btn-start-big { background: #2ecc71; color: white; border: none; padding: 15px 40px; font-size: 1.5rem; border-radius: 50px; font-family: 'Righteous'; cursor: pointer; display: inline-flex; gap: 10px; }
        
        /* PREGUNTAS HOST */
        .question-card { background: white; border-radius: 20px; padding: 20px; text-align: center; color: #2c3e50; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .host-waiting { margin-top: 20px; color: #666; font-weight: bold; }
        .timer-big { font-size: 3.5rem; font-family: 'Righteous'; color: #e74c3c; animation: pulse 1s infinite; }
        .btn-force-timeout { background: rgba(231,76,60,0.1); color: #e74c3c; border: 1px solid #e74c3c; padding: 5px 15px; border-radius: 20px; cursor: pointer; margin-top: 10px; font-weight: bold; }
        .correct-answer-reveal { background: #2ecc71; padding: 40px; border-radius: 20px; text-align: center; color: white; width: 90%; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 5px solid #27ae60; }
        .reveal-text { font-size: 3rem; font-weight: bold; font-family: 'Righteous'; }

        /* CLIENT AREA */
        .lobby-wait { text-align: center; margin-top: 80px; }
        .client-question-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; }
        .timer-bar-container { height: 10px; background: rgba(0,0,0,0.3); border-radius: 5px; overflow: hidden; }
        .timer-bar-fill { height: 100%; transition: width 0.15s linear; }
        .blinking { animation: flashRed 0.5s infinite; }
        .btn-confirmar-amarillo { background: #f1c40f; border: none; border-radius: 12px; font-weight: bold; font-size: 1.2rem; cursor: pointer; box-shadow: 0 5px 0 #d4ac0d; transition: transform 0.1s; }
        .btn-confirmar-amarillo:active { transform: translateY(4px); box-shadow: none; }
        
        /* NEON FEEDBACK CLIENT */
        .feedback-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; position: absolute; inset: 0; background: rgba(44,62,80,0.95); z-index: 2000; }
        .pi-feedback-wrapper { margin-bottom: 20px; }
        .pi-feedback { width: 140px; height: 140px; object-fit: contain; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5)); }
        .neon-card { background: #1a1a1a; padding: 30px; border-radius: 20px; text-align: center; color: white; width: 85%; max-width: 400px; box-shadow: 0 0 30px rgba(0,0,0,0.6); }
        .neon-card.success { border: 3px solid #2ecc71; box-shadow: 0 0 20px #2ecc71, inset 0 0 10px #2ecc71; }
        .neon-card.error { border: 3px solid #ff003c; box-shadow: 0 0 20px #ff003c, inset 0 0 10px #ff003c; }
        .neon-card.neutral { border: 3px solid #f1c40f; box-shadow: 0 0 20px #f1c40f, inset 0 0 10px #f1c40f; }
        .neon-title { font-size: 2rem; font-family: 'Righteous'; margin: 15px 0; }
        .neon-card.success .neon-title { color: #2ecc71; text-shadow: 0 0 10px #2ecc71; }
        .neon-card.error .neon-title { color: #ff003c; text-shadow: 0 0 10px #ff003c; }
        .points-added { font-size: 2.5rem; font-weight: bold; color: #f1c40f; animation: bounce 1s infinite; }
        .neon-answer { font-size: 1.5rem; font-weight: bold; background: rgba(255,0,60,0.2); padding: 10px; border-radius: 10px; border: 1px solid #ff003c; margin-top: 10px; }

        /* PODIUM */
        .podium-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding-bottom: 50px; }
        .podium-container { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 600px; }
        .podium-stage { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin-bottom: 20px; }
        .podium-pedestal { display: flex; flex-direction: column; align-items: center; }
        .pedestal-bar { width: 75px; background: linear-gradient(to bottom, #f39c12, #d35400); border-radius: 10px 10px 0 0; display: flex; justify-content: center; align-items: flex-end; padding-bottom: 10px; }
        .rank-2 .pedestal-bar { background: linear-gradient(to bottom, #bdc3c7, #7f8c8d); }
        .rank-3 .pedestal-bar { background: linear-gradient(to bottom, #e67e22, #a0500d); }
        .p-rank { font-size: 2rem; font-weight: bold; color: rgba(0,0,0,0.3); }
        .p-name { margin-top: 8px; font-weight: bold; }
        .p-score { background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 10px; font-size: 0.85rem; margin-top: 5px; color: #f1c40f; }
        .runners-up-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .runner-up-card { background: rgba(255,255,255,0.1); padding: 8px 15px; border-radius: 10px; font-weight: bold; }
        .host-controls { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); }
        .btn-next-floating { background: linear-gradient(135deg, #3498db, #2980b9); color: white; border: 2px solid white; padding: 15px 40px; font-size: 1.3rem; border-radius: 50px; cursor: pointer; display: flex; gap: 10px; font-family: 'Righteous'; box-shadow: 0 5px 15px rgba(0,0,0,0.4); }

        /* FIN ALUMNO */
        .final-screen-client { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; z-index: 10; }
        .final-title { font-family: 'Righteous'; font-size: 3rem; color: #f1c40f; text-shadow: 0 5px 10px rgba(0,0,0,0.5); }
        .final-card-client { background: rgba(0,0,0,0.6); padding: 40px 20px; border-radius: 20px; width: 85%; border: 2px solid rgba(255,255,255,0.1); text-align: center; }
        .highlight-name { color: #2ecc71; font-family: 'Righteous'; font-size: 2rem; display: block; }
        .highlight-rank { color: #f1c40f; font-family: 'Righteous'; font-size: 3rem; display: block; animation: pulse 2s infinite; }
        .highlight-score { color: #3498db; font-family: 'Righteous'; font-size: 2rem; display: block; }

        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes flashRed { 0%, 100% { box-shadow: none; } 50% { box-shadow: 0 0 15px red; } }
        @media (max-width: 600px) { .pi-avatar-container-host { top: unset; bottom: 20px; left: 10px; transform: scale(0.6); transform-origin: bottom left; } .top-hud { height: 50px; font-size: 0.8rem; } .room-code { font-size: 1.1rem; } }
    `}</style>
);