// Motor three.js del «Partido con mandos micro:bit»: cada mando es un jugador de campo
// (equipo rojo ataca hacia +x, azul hacia -x) y los porteros los lleva el ordenador.
// Controles (los traduce montarMotorMandos().evento a partir de los eventos del mando, modo F):
//   A mantenido = corre hacia donde mira · B / logo mantenidos = gira a la derecha / izquierda
//   agitar = tiro a puerta (sin balón: arrancada) · inclinar = pase (izquierda/derecha/delante/detrás)
// Cuando un rival alcanza al que lleva el balón se para el partido y se avisa con cb().onDuelo:
// React plantea una pregunta y llama a resolverDuelo(idGanador | null).
import * as THREE from 'three';
import {
    L, W, GOAL_W, GOAL_H, GOAL_D, BALL_R, GRAV, PR, MURO_Z, MURO_X, VEL_BASE, VEL_SPRINT,
    texturaBalon, crearGeometriasJugador, crearMallaJugador, crearAudio, construirEstadio,
} from './motorFutbol3D';

const GIRO = 2.8;            // rad/s al mantener B o el logo
const TOQUE_GIRO = 0.3;      // giro inmediato al pulsar
const LATIDO_MAX = 1300;     // ms sin latido del mando → se da el botón por soltado
const DISTANCIA_DUELO = 0.85;
const ESPERA_DUELO = 3;      // s sin nuevos duelos para esos dos jugadores
const PORTERO = { vel: 4.8, parada: 0.72 };
const COLORES = {
    red: { camiseta: 0xe53935, short: 0xffffff, media: 0xe53935 },
    blue: { camiseta: 0x1e66d0, short: 0x0f1f3a, media: 0x1e66d0 },
    redGK: { camiseta: 0xf1c40f, short: 0x111111, media: 0xf1c40f },
    blueGK: { camiseta: 0x22c55e, short: 0x111111, media: 0x22c55e },
};
const CSS_EQUIPO = { red: '#dc2626', blue: '#2563eb' };
// Colocación en el saque (mitad propia, en coordenadas del equipo rojo: x negativa)
const FORMACION = [[-3, 0], [-6.5, -5], [-6.5, 5], [-10, -2.5], [-10, 2.5], [-3.5, -9], [-3.5, 9], [-13, 0], [-8, -9], [-8, 9], [-14, -5], [-14, 5]];

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, z) => Math.hypot(x, z);

function etiqueta(texto, team) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = CSS_EQUIPO[team] || '#334155';
    g.beginPath(); g.roundRect(4, 6, 248, 52, 26); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#ffffff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(texto).slice(0, 14), 128, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.set(1.9, 0.48, 1); s.renderOrder = 20;
    return s;
}

export function montarMotorMandos({ host, cb }) {
    const audio = crearAudio();

    // --- Render ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x86b9e8);
    scene.fog = new THREE.Fog(0x86b9e8, 80, 150);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a3a, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.6);
    sol.position.set(-12, 30, 18); scene.add(sol);

    const { gradas, redesFondo, crearSombra } = construirEstadio(scene);

    // Balón
    const matBalon = new THREE.MeshLambertMaterial({ map: texturaBalon() });
    const balonMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), matBalon);
    scene.add(balonMesh);
    const sombraBalon = crearSombra(0.6);

    // Aro amarillo bajo quien lleva el balón y aros rojos bajo los dos del duelo
    const anillo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 28), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95, depthWrite: false }));
    anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.03; anillo.visible = false; scene.add(anillo);
    const arosDuelo = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 28), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.9, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.035; m.visible = false; scene.add(m); return m;
    });

    // --- Jugadores ---
    const GEO = crearGeometriasJugador();
    let todos = [];
    const humanos = new Map(); // id de mando → jugador
    const porteros = ['red', 'blue'].map(team => {
        const malla = crearMallaJugador(GEO, COLORES[team + 'GK']);
        scene.add(malla.root);
        return nuevoJugador({ team, role: 'GK', malla });
    });

    function nuevoJugador({ team, role, malla, id = null, nombre = '' }) {
        return {
            id, nombre, team, role, s: team === 'red' ? 1 : -1,
            x: 0, z: 0, vx: 0, vz: 0, tvx: 0, tvz: 0, face: 0,
            malla, sombra: crearSombra(1.1), etiqueta: null,
            stun: 0, kickCd: 0, protect: 0, duelCd: 0, patada: 0, dive: 0, diveDir: 0, hold: 0,
            receptor: 0, ultimoTiro: -1, arrancada: 0, fase: Math.random() * 6,
            botones: { A: false, B: false, L: false, tA: 0, tB: 0, tL: 0 },
        };
    }

    function quitarJugador(p) {
        scene.remove(p.malla.root); scene.remove(p.sombra);
        if (p.etiqueta) { scene.remove(p.etiqueta); p.etiqueta.material.map.dispose(); p.etiqueta.material.dispose(); }
    }

    function recalcularTodos() { todos = [...humanos.values(), ...porteros]; }
    recalcularTodos();

    const campo = (t) => todos.filter(p => p.team === t && p.role !== 'GK');
    const portero = (t) => porteros.find(p => p.team === t);
    const rivales = (t) => todos.filter(p => p.team !== t);

    const ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastKicker: null, shotId: 0, dentro: false, receptor: null };
    let estado = 'PARADO';   // PARADO | JUEGO | DUELO | GOL
    let pausado = false;
    let tCelebra = 0, equipoGol = null, tiempo = 0, shake = 0;
    let duelo = null;        // { a, b } durante una pregunta

    // ------------------------------------------------------------------
    // Acciones con el balón
    // ------------------------------------------------------------------
    function patear(p, vx, vy, vz, opts = {}) {
        ball.owner = null;
        ball.vx = vx; ball.vy = vy; ball.vz = vz;
        ball.lastKicker = p; ball.shotId++;
        ball.receptor = opts.receptor || null;
        p.kickCd = 0.3; p.patada = 0.25; p.hold = 0;
        audio.patada(len(vx, vz) > 20);
    }

    const rivalMasCerca = (team, x, z) => {
        let d = 1e9;
        for (const r of rivales(team)) d = Math.min(d, len(r.x - x, r.z - z));
        return d;
    };

    function mejorCompanero(p, pref, exigir) {
        let best = null, bs = -1e9;
        for (const m of campo(p.team)) {
            if (m === p) continue;
            const dx = m.x - p.x, dz = m.z - p.z, d = len(dx, dz);
            if (d < 2 || d > 30) continue;
            const cos = (dx * pref.x + dz * pref.z) / d;
            if (exigir && cos < 0.2) continue;
            const libre = Math.min(6, rivalMasCerca(p.team, m.x, m.z));
            const sc = cos * (exigir ? 5 : 1.5) + libre * 0.6 - d * 0.05;
            if (sc > bs) { bs = sc; best = m; }
        }
        return best;
    }

    function pase(p, pref) {
        const m = mejorCompanero(p, pref, true);
        if (!m) { patear(p, pref.x * 12, 0.4, pref.z * 12); return; }
        const tx = m.x + m.vx * 0.45, tz = m.z + m.vz * 0.45;
        const dx = tx - ball.x, dz = tz - ball.z, d = len(dx, dz) || 1;
        const v = clamp(7 + d * 0.85, 9, 21);
        patear(p, dx / d * v, 0.5, dz / d * v, { receptor: m });
        m.receptor = 1.6;
    }

    function paseElevado(p, m) {
        const dx = m.x - ball.x, dz = m.z - ball.z, d = len(dx, dz) || 1;
        const T = clamp(d / 13, 0.5, 1.4);
        patear(p, dx / T, (GRAV / 2) * T, dz / T, { receptor: m });
        m.receptor = T + 0.8;
    }

    // Tiro al agitar: a portería si mira más o menos hacia ella; si no, despeje hacia donde mira.
    function tiro(p) {
        const gx = p.s * L;
        const dg = len(gx - ball.x, -ball.z) || 1;
        const fx = Math.cos(p.face), fz = Math.sin(p.face);
        let dx, dz;
        if ((fx * (gx - ball.x) + fz * (-ball.z)) / dg < -0.1) { dx = fx; dz = fz; }
        else {
            const aimZ = rnd(-1, 1) * (GOAL_W - 0.5);
            dx = gx - ball.x; dz = aimZ - ball.z;
            const l = len(dx, dz) || 1; dx /= l; dz /= l;
            const err = dg * 0.006 * rnd(-1, 1);
            const c = Math.cos(err), s = Math.sin(err);
            [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
        }
        const v = dg > 18 ? 25 : 22;
        patear(p, dx * v, dg < 6 ? 1.6 : rnd(1.8, 3.4), dz * v);
        shake = 0.2;
    }

    function ganarBalon(p) {
        ball.owner = p; ball.receptor = null;
        p.protect = 1.0; p.receptor = 0;
    }

    function atrapar(gk) {
        ball.owner = gk; ball.vx = ball.vy = ball.vz = 0; ball.receptor = null;
        gk.hold = 1.2;
    }

    // ------------------------------------------------------------------
    // Entrada de los mandos
    // ------------------------------------------------------------------
    function evento({ id, accion, on, dir }) {
        const p = humanos.get(id);
        if (!p) return;
        audio.asegurar();
        const ahora = performance.now();
        if (accion === 'A' || accion === 'B' || accion === 'L') {
            const antes = p.botones[accion];
            p.botones[accion] = !!on;
            p.botones['t' + accion] = ahora;
            if (on && !antes && estado === 'JUEGO' && !pausado && p.stun <= 0) {
                if (accion === 'B') p.face += TOQUE_GIRO;
                if (accion === 'L') p.face -= TOQUE_GIRO;
            }
            return;
        }
        if (estado !== 'JUEGO' || pausado || p.stun > 0) return;
        if (accion === 'S') {
            if (ball.owner === p) tiro(p);
            else p.arrancada = 1.2;
        } else if (accion === 'P' && ball.owner === p) {
            const ang = p.face + ({ F: 0, T: Math.PI, I: -Math.PI / 2, D: Math.PI / 2 }[dir] ?? 0);
            pase(p, { x: Math.cos(ang), z: Math.sin(ang) });
        }
    }

    function controlHumano(p, dt) {
        const b = p.botones, ahora = performance.now();
        for (const k of ['A', 'B', 'L']) if (b[k] && ahora - b['t' + k] > LATIDO_MAX) b[k] = false;
        if (p.stun > 0) { p.tvx = p.tvz = 0; return; }
        if (b.B) p.face += GIRO * dt;
        if (b.L) p.face -= GIRO * dt;
        const tiene = ball.owner === p;
        const v = b.A ? (p.arrancada > 0 ? VEL_SPRINT : VEL_BASE) * (tiene ? 0.9 : 1) : 0;
        p.tvx = Math.cos(p.face) * v; p.tvz = Math.sin(p.face) * v;
    }

    // ------------------------------------------------------------------
    // Porteros (ordenador)
    // ------------------------------------------------------------------
    function irA(p, tx, tz, v) {
        const dx = tx - p.x, dz = tz - p.z, d = len(dx, dz);
        if (d < 0.25) { p.tvx = 0; p.tvz = 0; return; }
        const k = v * Math.min(1, d / 1.2);
        p.tvx = dx / d * k; p.tvz = dz / d * k;
    }

    function iaPortero(p, dt) {
        const own = -p.s * L;
        const linea = own + p.s * 0.7;
        p.face = p.s > 0 ? 0 : Math.PI;
        if (ball.owner === p) {
            p.tvx = p.tvz = 0;
            p.hold -= dt;
            if (p.hold <= 0) {
                const m = mejorCompanero(p, { x: p.s, z: 0 }, false);
                if (m && Math.random() < 0.5) paseElevado(p, m);
                else if (m) pase(p, { x: (m.x - p.x) / (len(m.x - p.x, m.z - p.z) || 1), z: (m.z - p.z) / (len(m.x - p.x, m.z - p.z) || 1) });
                else patear(p, p.s * 16, 6, rnd(-4, 4));
            }
            return;
        }
        let tx = linea, tz = clamp(ball.z * 0.4, -GOAL_W + 0.4, GOAL_W - 0.4);
        const libre = !ball.owner;
        const haciaMi = -ball.vx * p.s;
        if (libre && haciaMi > 3) {
            const t = (linea - ball.x) / ball.vx;
            if (t > 0 && t < 1.5) tz = clamp(ball.z + ball.vz * t, -GOAL_W - 0.5, GOAL_W + 0.5);
        }
        const enArea = Math.abs(ball.x - own) < 5 && Math.abs(ball.z) < 6;
        if (libre && enArea && len(ball.vx, ball.vz) < 7) { tx = ball.x; tz = ball.z; }
        irA(p, tx, tz, PORTERO.vel);
        if (libre && p.kickCd <= 0) {
            const dBall = len(ball.x - p.x, ball.z - p.z);
            const alcance = 0.75 + (haciaMi > 6 ? 0.55 : 0);
            if (dBall < alcance && ball.y < 2.35) {
                const sp = Math.hypot(ball.vx, ball.vy, ball.vz);
                if (sp < 7) { atrapar(p); return; }
                if (ball.lastKicker !== p && ball.shotId !== p.ultimoTiro) {
                    p.ultimoTiro = ball.shotId;
                    p.dive = 0.55; p.diveDir = Math.sign(ball.z - p.z) || 1;
                    if (Math.random() < clamp(1.08 - sp / 40, 0.3, 0.92) * PORTERO.parada) {
                        if (sp < 16) atrapar(p);
                        else {
                            ball.vx = p.s * rnd(5, 9); ball.vz = rnd(-6, 6); ball.vy = rnd(2, 5);
                            ball.lastKicker = p; ball.shotId++; p.ultimoTiro = ball.shotId; p.kickCd = 0.5;
                            audio.patada(false);
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Física
    // ------------------------------------------------------------------
    function moverJugadores(dt) {
        for (const p of todos) {
            if (p.stun > 0 || p.dive > 0.2) { const f = Math.exp(-8 * dt); p.vx *= f; p.vz *= f; }
            else { const k = Math.min(1, 10 * dt); p.vx += (p.tvx - p.vx) * k; p.vz += (p.tvz - p.vz) * k; }
            p.x += p.vx * dt; p.z += p.vz * dt;
            if (p.role === 'GK') {
                const own = -p.s * L;
                p.x = p.s > 0 ? clamp(p.x, own + 0.3, own + 5) : clamp(p.x, own - 5, own - 0.3);
                p.z = clamp(p.z, -7, 7);
            } else {
                p.x = clamp(p.x, -L + 0.2, L - 0.2);
                p.z = clamp(p.z, -W - 0.2, W + 0.2);
            }
        }
        for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) {
            const a = todos[i], b = todos[j];
            const dx = b.x - a.x, dz = b.z - a.z, d = len(dx, dz), min = PR * 2;
            if (d < min && d > 0.001) {
                const e = (min - d) / 2, nx = dx / d, nz = dz / d;
                a.x -= nx * e; a.z -= nz * e; b.x += nx * e; b.z += nz * e;
            }
        }
    }

    function fisicaBalon(dt) {
        if (ball.owner) return;
        ball.vy -= GRAV * dt;
        const drag = Math.exp(-0.08 * dt);
        ball.vx *= drag; ball.vz *= drag;
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
        if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = ball.vy < -1.2 ? -ball.vy * 0.5 : 0; }
        if (ball.y <= BALL_R + 0.01) { const f = Math.exp(-0.9 * dt); ball.vx *= f; ball.vz *= f; }
        if (Math.abs(ball.z) > MURO_Z - BALL_R) { ball.z = Math.sign(ball.z) * (MURO_Z - BALL_R); ball.vz = -ball.vz * 0.6; }
        const ax = Math.abs(ball.x), sx = Math.sign(ball.x);
        const enBoca = Math.abs(ball.z) < GOAL_W - 0.05 && ball.y < GOAL_H - 0.05;
        if (!ball.dentro && ax > MURO_X - BALL_R) {
            if (enBoca) ball.dentro = true;
            else { ball.x = sx * (MURO_X - BALL_R); ball.vx = -ball.vx * 0.6; }
        }
        if (ball.dentro) {
            const fondo = L + GOAL_D - BALL_R;
            if (Math.abs(ball.x) > fondo) { ball.x = sx * fondo; ball.vx = -ball.vx * 0.15; }
            if (Math.abs(ball.z) > GOAL_W - BALL_R) { ball.z = Math.sign(ball.z) * (GOAL_W - BALL_R); ball.vz *= -0.2; }
            if (ball.y > GOAL_H - BALL_R) { ball.y = GOAL_H - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.2; }
            const f = Math.exp(-3 * dt); ball.vx *= f; ball.vz *= f;
        }
        const min = BALL_R + 0.07;
        for (const s of [-1, 1]) {
            if (ball.y < GOAL_H + 0.1) {
                for (const pz of [-GOAL_W, GOAL_W]) {
                    const dx = ball.x - s * L, dz = ball.z - pz, d = len(dx, dz);
                    if (d < min && d > 0.0001) {
                        const nx = dx / d, nz = dz / d;
                        ball.x = s * L + nx * min; ball.z = pz + nz * min;
                        const vn = ball.vx * nx + ball.vz * nz;
                        if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vz -= 1.7 * vn * nz; if (vn < -4) audio.poste(); }
                    }
                }
            }
            if (Math.abs(ball.z) < GOAL_W) {
                const dx = ball.x - s * L, dy = ball.y - GOAL_H, d = len(dx, dy);
                if (d < min && d > 0.0001) {
                    const nx = dx / d, ny = dy / d;
                    ball.x = s * L + nx * min; ball.y = GOAL_H + ny * min;
                    const vn = ball.vx * nx + ball.vy * ny;
                    if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vy -= 1.7 * vn * ny; if (vn < -4) audio.poste(); }
                }
            }
        }
    }

    function posesion(dt) {
        const o = ball.owner;
        if (o) {
            if (o.role === 'GK') {
                ball.x = o.x + Math.cos(o.face) * 0.4; ball.z = o.z; ball.y = 1.1;
                ball.vx = ball.vy = ball.vz = 0;
                return;
            }
            const fx = Math.cos(o.face), fz = Math.sin(o.face);
            const k = Math.min(1, 16 * dt);
            ball.x += (o.x + fx * 0.58 - ball.x) * k;
            ball.z += (o.z + fz * 0.58 - ball.z) * k;
            ball.y = BALL_R; ball.vx = o.vx; ball.vz = o.vz; ball.vy = 0;
            // ¿Le alcanza un rival? → duelo de preguntas
            if (o.protect <= 0 && o.duelCd <= 0) {
                for (const p of campo(o.team === 'red' ? 'blue' : 'red')) {
                    if (p.duelCd > 0 || p.stun > 0) continue;
                    if (len(p.x - ball.x, p.z - ball.z) < DISTANCIA_DUELO || len(p.x - o.x, p.z - o.z) < DISTANCIA_DUELO) {
                        empezarDuelo(o, p);
                        return;
                    }
                }
            }
            return;
        }
        // balón suelto
        let mejor = null, md = 1e9;
        for (const p of todos) {
            if (p.role === 'GK' || p.kickCd > 0 || p.stun > 0) continue;
            const d = len(p.x - ball.x, p.z - ball.z);
            if (d < 0.65 && ball.y < 0.95 && d < md) { mejor = p; md = d; }
        }
        if (mejor) ganarBalon(mejor);
    }

    function empezarDuelo(a, b) {
        estado = 'DUELO';
        duelo = { a, b };
        for (const p of todos) { p.tvx = p.tvz = 0; p.vx = p.vz = 0; }
        audio.poste();
        cb().onDuelo?.({ conBalon: a.id, rival: b.id });
    }

    function resolverDuelo(idGanador) {
        if (!duelo) return;
        const { a, b } = duelo;
        duelo = null;
        a.duelCd = b.duelCd = ESPERA_DUELO;
        const ganador = idGanador === a.id ? a : idGanador === b.id ? b : null;
        if (ganador) {
            const perdedor = ganador === a ? b : a;
            ganarBalon(ganador);
            ganador.protect = 1.6;
            perdedor.stun = 1.0;
            // el perdedor se aparta un poco para no volver a chocar al instante
            const dx = perdedor.x - ganador.x, dz = perdedor.z - ganador.z, d = len(dx, dz) || 1;
            perdedor.x += dx / d * 0.8; perdedor.z += dz / d * 0.8;
        } else {
            ball.owner = null;
            const ang = rnd(0, Math.PI * 2);
            ball.vx = Math.cos(ang) * 6; ball.vz = Math.sin(ang) * 6; ball.vy = 2;
            ball.lastKicker = null; ball.shotId++;
            a.kickCd = b.kickCd = 0.5;
        }
        estado = 'JUEGO';
    }

    function comprobarGol() {
        if (estado !== 'JUEGO') return;
        if (Math.abs(ball.x) > L + BALL_R && Math.abs(ball.z) < GOAL_W && ball.y < GOAL_H) {
            const team = ball.x > 0 ? 'red' : 'blue';
            estado = 'GOL'; equipoGol = team; tCelebra = 2.8;
            redesFondo[team].t = 1;
            const k = ball.lastKicker;
            cb().onGol?.(team, k && k.team === team && k.id != null ? k.id : null);
        }
    }

    function paso(dt) {
        tiempo += dt;
        for (const p of todos) {
            p.stun -= dt; p.kickCd -= dt; p.protect -= dt; p.duelCd -= dt; p.dive -= dt; p.patada -= dt; p.receptor -= dt; p.arrancada -= dt;
        }
        for (const p of todos) {
            if (p.role === 'GK') iaPortero(p, dt);
            else controlHumano(p, dt);
        }
        moverJugadores(dt);
        fisicaBalon(dt);
        if (estado === 'JUEGO') posesion(dt);
        comprobarGol();
    }

    function celebrar(dt) {
        tiempo += dt;
        for (const p of todos) { p.tvx = 0; p.tvz = 0; p.stun = 0; }
        moverJugadores(dt);
        fisicaBalon(dt);
        tCelebra -= dt;
        if (tCelebra <= 0) { estado = 'PARADO'; cb().onFinCelebracion?.(equipoGol); }
    }

    function prepararSaque(saca) {
        for (const team of ['red', 'blue']) {
            const lista = campo(team).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
            lista.forEach((p, i) => {
                const [fx, fz] = FORMACION[i % FORMACION.length];
                const extra = Math.floor(i / FORMACION.length) * 1.2;
                p.x = (fx - extra) * p.s; p.z = fz;
                if (team === saca && i === 0) { p.x = -p.s * 0.6; p.z = 0; }
            });
        }
        for (const p of todos) {
            if (p.role === 'GK') { p.x = -p.s * (L - 0.7); p.z = 0; }
            p.vx = p.vz = p.tvx = p.tvz = 0;
            p.face = p.s > 0 ? 0 : Math.PI;
            p.stun = p.kickCd = p.protect = p.duelCd = p.dive = p.hold = p.patada = p.receptor = p.arrancada = 0;
        }
        Object.assign(ball, { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastKicker: null, dentro: false, receptor: null });
        ball.shotId++;
        duelo = null;
        estado = 'PARADO';
    }

    /** Lista de jugadores con mando: [{ id, nombre, team: 'red'|'blue' }]. Reutiliza las mallas que ya existan. */
    function ponerJugadores(lista) {
        const nuevos = new Set(lista.map(j => j.id));
        for (const [id, p] of humanos) {
            if (!nuevos.has(id)) { quitarJugador(p); humanos.delete(id); }
        }
        for (const j of lista) {
            let p = humanos.get(j.id);
            if (p && p.team !== j.team) { quitarJugador(p); humanos.delete(j.id); p = null; }
            if (!p) {
                const malla = crearMallaJugador(GEO, COLORES[j.team]);
                scene.add(malla.root);
                p = nuevoJugador({ team: j.team, role: 'CAMPO', malla, id: j.id, nombre: j.nombre });
                humanos.set(j.id, p);
            }
            if (!p.etiqueta || p.nombre !== j.nombre) {
                if (p.etiqueta) { scene.remove(p.etiqueta); p.etiqueta.material.map.dispose(); p.etiqueta.material.dispose(); }
                p.nombre = j.nombre;
                p.etiqueta = etiqueta(j.nombre, j.team);
                scene.add(p.etiqueta);
            }
        }
        recalcularTodos();
    }

    // ------------------------------------------------------------------
    // Visuales
    // ------------------------------------------------------------------
    const cam = { x: 0, z: 0 };
    let aspecto = 1;
    const ajustarTam = () => {
        const w = host.clientWidth || 1, h = host.clientHeight || 1;
        aspecto = w / h;
        renderer.setSize(w, h, false);
        camera.aspect = aspecto;
        camera.fov = aspecto < 1 ? 60 : 47;
        camera.updateProjectionMatrix();
    };
    ajustarTam();
    const ro = new ResizeObserver(ajustarTam);
    ro.observe(host);

    const ejeTmp = new THREE.Vector3();
    function visuales(dt) {
        for (const p of todos) {
            const m = p.malla;
            m.root.position.set(p.x, 0, p.z);
            m.root.rotation.y = -p.face;
            const sp = len(p.vx, p.vz);
            p.fase += dt * (4 + sp * 1.6);
            const amp = clamp(sp / 7, 0, 1) * 0.9;
            const sw = Math.sin(p.fase) * amp;
            m.piernaI.rotation.z = sw; m.piernaD.rotation.z = -sw;
            m.brazoI.rotation.z = -sw * 0.8; m.brazoD.rotation.z = sw * 0.8;
            m.brazoI.rotation.x = 0; m.brazoD.rotation.x = 0;
            if (p.patada > 0) m.piernaD.rotation.z = 1.3 * (p.patada / 0.25);
            m.cuerpo.rotation.set(0, 0, 0);
            m.cuerpo.position.y = 0;
            if (p.stun > 0 && p.role !== 'GK') m.cuerpo.rotation.x = Math.sin(tiempo * 30) * 0.08;
            if (p.dive > 0) {
                const k = Math.sin(clamp(p.dive / 0.55, 0, 1) * Math.PI);
                m.cuerpo.rotation.x = p.diveDir * Math.cos(p.face) * 1.3 * k;
                m.brazoI.rotation.x = 2.8; m.brazoD.rotation.x = -2.8;
            } else if (p.role === 'GK' && ball.owner === p) m.brazoI.rotation.z = m.brazoD.rotation.z = 1.4;
            if (estado === 'GOL' && p.team === equipoGol) {
                m.cuerpo.position.y = Math.abs(Math.sin(tiempo * 9 + p.fase)) * 0.45;
                m.brazoI.rotation.x = 2.8; m.brazoD.rotation.x = -2.8;
            }
            p.sombra.position.x = p.x; p.sombra.position.z = p.z;
            if (p.etiqueta) p.etiqueta.position.set(p.x, 2.45, p.z);
        }
        balonMesh.position.set(ball.x, ball.y, ball.z);
        const vb = len(ball.vx, ball.vz);
        if (vb > 0.05) { ejeTmp.set(ball.vz, 0, -ball.vx).normalize(); balonMesh.rotateOnWorldAxis(ejeTmp, vb * dt / BALL_R); }
        sombraBalon.position.set(ball.x, 0.016, ball.z);
        const sh = clamp(1 - ball.y / 6, 0.3, 1);
        sombraBalon.scale.set(0.65 * sh, 0.65 * sh, 1);

        const o = ball.owner;
        anillo.visible = !!o && o.role !== 'GK';
        if (anillo.visible) anillo.position.set(o.x, 0.03, o.z);
        const enDuelo = estado === 'DUELO' && duelo;
        arosDuelo.forEach((a, i) => {
            a.visible = !!enDuelo;
            if (enDuelo) {
                const p = i === 0 ? duelo.a : duelo.b;
                a.position.set(p.x, 0.035, p.z);
                a.scale.setScalar(1 + Math.sin(tiempo * 8) * 0.12);
            }
        });
        if (enDuelo) tiempo += dt;
        for (const k in redesFondo) {
            const r = redesFondo[k];
            if (r.t > 0) { r.t = Math.max(0, r.t - dt * 1.2); r.mesh.position.x = r.x0 + r.s * Math.sin(r.t * 20) * r.t * 0.35; }
        }
        for (const g of gradas) g.m.position.y = g.y0 + (estado === 'GOL' ? Math.abs(Math.sin(tiempo * 10)) * 0.25 : 0);

        // cámara: más abierta que en el modo 1 jugador para ver a todos; en el duelo se acerca a los dos
        const vertical = aspecto < 1;
        const margen = vertical ? 4 : 8;
        let objX = clamp(ball.x * 0.85, -L + margen, L - margen), objZ = clamp(ball.z * 0.3, -4, 4);
        let alto = vertical ? 27 : 19, dist = vertical ? 23 : 20;
        if (enDuelo) { objX = (duelo.a.x + duelo.b.x) / 2; objZ = (duelo.a.z + duelo.b.z) / 2; alto = 9; dist = 10; }
        const k = Math.min(1, 3 * dt);
        cam.x += (objX - cam.x) * k; cam.z += (objZ - cam.z) * k;
        cam.alto = (cam.alto ?? alto) + (alto - (cam.alto ?? alto)) * k;
        cam.dist = (cam.dist ?? dist) + (dist - (cam.dist ?? dist)) * k;
        let sx = 0, sy = 0;
        if (shake > 0) { shake -= dt; sx = rnd(-0.2, 0.2); sy = rnd(-0.2, 0.2); }
        camera.position.set(cam.x + sx, cam.alto + sy, cam.z + cam.dist);
        camera.lookAt(cam.x, 0, cam.z - 1.5);
    }

    // ------------------------------------------------------------------
    // Bucle
    // ------------------------------------------------------------------
    let raf = 0, last = performance.now();
    const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!pausado) {
            if (estado === 'JUEGO') { paso(dt / 2); paso(dt / 2); }
            else if (estado === 'GOL') celebrar(dt);
        }
        visuales(dt);
        renderer.render(scene, camera);
    };
    const onPointer = () => audio.asegurar();
    window.addEventListener('pointerdown', onPointer);
    prepararSaque('red');
    raf = requestAnimationFrame(frame);

    return {
        ponerJugadores,
        evento,
        prepararSaque,
        saque() { estado = 'JUEGO'; },
        pausar(v) { pausado = !!v; },
        resolverDuelo,
        enJuego() { return estado === 'JUEGO' && !pausado; },
        destroy() {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('pointerdown', onPointer);
            const texturas = new Set();
            scene.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
                mats.forEach(m => { if (m.map) texturas.add(m.map); m.dispose(); });
            });
            texturas.forEach(t => t.dispose());
            renderer.dispose();
            renderer.domElement.remove();
            audio.cerrar();
        },
    };
}
