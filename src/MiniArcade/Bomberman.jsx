import React, { useEffect, useRef, useState, useCallback } from 'react';
import SaveForm from './SaveForm';
import FullscreenBtn from './FullscreenBtn';

// ─── Constants ─────────────────────────────────────────────────────────────────
const COLS = 15, ROWS = 13, T = 32;
const GW = COLS * T, GH = ROWS * T;
const EMPTY = 0, HARD = 1, SOFT = 2;
const PU_BOMB = 1, PU_FIRE = 2, PU_SPEED = 3;
const HALF = 10;
const FUSE = 180;
const EXP_DUR = 40;

// ─── Audio ─────────────────────────────────────────────────────────────────────
let _ac = null;
function getAC() {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
}
function tone(freq, dur, type = 'square', vol = 0.25, delay = 0) {
    try {
        const a = getAC(), t = a.currentTime + delay;
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur + 0.01);
    } catch (_) {}
}
function sfxBomb() { tone(200, 0.08, 'square', 0.2); tone(300, 0.06, 'square', 0.1, 0.05); }
function sfxBlast() {
    try {
        const a = getAC(), t = a.currentTime;
        const len = Math.ceil(a.sampleRate * 0.5);
        const buf = a.createBuffer(1, len, a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const s = a.createBufferSource(); s.buffer = buf;
        const g = a.createGain(); s.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        s.start(t); s.stop(t + 0.52);
        const o = a.createOscillator(), g2 = a.createGain();
        o.connect(g2); g2.connect(a.destination);
        o.type = 'sawtooth'; o.frequency.setValueAtTime(100, t);
        o.frequency.exponentialRampToValueAtTime(25, t + 0.3);
        g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.start(t); o.stop(t + 0.37);
    } catch (_) {}
}
function sfxPowerup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 'sine', 0.2, i * 0.09)); }
function sfxDie() { [440, 330, 220, 110].forEach((f, i) => tone(f, 0.14, 'square', 0.28, i * 0.11)); }
function sfxWin() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.14, 'square', 0.28, i * 0.1)); }

// ─── Map builders ──────────────────────────────────────────────────────────────
function makeMap(level) {
    const map = Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
            if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) return HARD;
            if (r % 2 === 0 && c % 2 === 0) return HARD;
            return EMPTY;
        })
    );
    const density = Math.min(0.82, 0.62 + level * 0.05);
    const safe = new Set(['1,1', '1,2', '2,1', '1,3', '3,1']);
    for (let r = 1; r < ROWS - 1; r++)
        for (let c = 1; c < COLS - 1; c++) {
            if (map[r][c] === HARD || safe.has(`${r},${c}`)) continue;
            if (Math.random() < density) map[r][c] = SOFT;
        }
    return map;
}

function makePowerups(map) {
    const pu = {};
    const pool = [PU_BOMB, PU_FIRE, PU_FIRE, PU_SPEED];
    for (let r = 1; r < ROWS - 1; r++)
        for (let c = 1; c < COLS - 1; c++)
            if (map[r][c] === SOFT && Math.random() < 0.22)
                pu[`${r},${c}`] = pool[Math.floor(Math.random() * pool.length)];
    return pu;
}

function makeEnemies(map, level) {
    const count = 3 + level * 2;
    const enemies = [];
    for (let tries = 0; enemies.length < count && tries < 600; tries++) {
        const r = 1 + Math.floor(Math.random() * (ROWS - 2));
        const c = 1 + Math.floor(Math.random() * (COLS - 2));
        if (map[r][c] !== EMPTY) continue;
        if (r < 4 && c < 4) continue;
        enemies.push({
            id: enemies.length,
            px: c * T + T / 2, py: r * T + T / 2,
            dir: ['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)],
            type: enemies.length < Math.ceil(count / 2) ? 0 : 1,
            speed: 1.0 + level * 0.25 + Math.random() * 0.2,
            alive: true, dying: 0, animFrame: 0, animTick: 0,
        });
    }
    return enemies;
}

// ─── Physics ───────────────────────────────────────────────────────────────────
function canStep(map, bombs, r, c, throughBombs, escRow = -1, escCol = -1) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    if (map[r][c] !== EMPTY) return false;
    if (!throughBombs) {
        const isEscape = (r === escRow && c === escCol);
        if (!isEscape && bombs.some(b => b.row === r && b.col === c)) return false;
    }
    return true;
}

function moveEntity(px, py, dir, speed, map, bombs, throughBombs = false, escRow = -1, escCol = -1) {
    const CORR = 8;
    const nx = px + (dir === 'left' ? -speed : dir === 'right' ? speed : 0);
    const ny = py + (dir === 'up' ? -speed : dir === 'down' ? speed : 0);
    const fc = v => Math.floor(v / T);
    const fr = v => Math.floor(v / T);

    if (dir === 'left' || dir === 'right') {
        const cx = dir === 'left' ? nx - HALF : nx + HALF;
        const r1 = fr(ny - HALF), r2 = fr(ny + HALF - 1);
        const cl = fc(cx);
        const ok1 = canStep(map, bombs, r1, cl, throughBombs, escRow, escCol);
        const ok2 = canStep(map, bombs, r2, cl, throughBombs, escRow, escCol);
        if (ok1 && ok2) return { px: nx, py };
        if (ok1 && !ok2) {
            const ctr = r2 * T + T / 2;
            if (ny - ctr < CORR && ny > ctr) return { px: nx, py: ny - speed };
        } else if (!ok1 && ok2) {
            const ctr = r1 * T + T / 2;
            if (ctr - ny < CORR && ny < ctr) return { px: nx, py: ny + speed };
        }
        return { px, py };
    } else {
        const cy = dir === 'up' ? ny - HALF : ny + HALF;
        const c1 = fc(nx - HALF), c2 = fc(nx + HALF - 1);
        const rw = fr(cy);
        const ok1 = canStep(map, bombs, rw, c1, throughBombs, escRow, escCol);
        const ok2 = canStep(map, bombs, rw, c2, throughBombs, escRow, escCol);
        if (ok1 && ok2) return { px, py: ny };
        if (ok1 && !ok2) {
            const ctr = c2 * T + T / 2;
            if (nx - ctr < CORR && nx > ctr) return { px: nx - speed, py: ny };
        } else if (!ok1 && ok2) {
            const ctr = c1 * T + T / 2;
            if (ctr - nx < CORR && nx < ctr) return { px: nx + speed, py: ny };
        }
        return { px, py };
    }
}

function calcExplosion(map, row, col, range) {
    const cells = [{ r: row, c: col, type: 'center' }];
    const arms = [
        { dr: 0, dc: 1, tip: 'tip_r', mid: 'h' },
        { dr: 0, dc: -1, tip: 'tip_l', mid: 'h' },
        { dr: -1, dc: 0, tip: 'tip_u', mid: 'v' },
        { dr: 1, dc: 0, tip: 'tip_d', mid: 'v' },
    ];
    for (const { dr, dc, tip, mid } of arms) {
        for (let i = 1; i <= range; i++) {
            const r = row + dr * i, c = col + dc * i;
            if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
            if (map[r][c] === HARD) break;
            const last = i === range || map[r][c] === SOFT;
            cells.push({ r, c, type: last ? tip : mid });
            if (map[r][c] === SOFT) break;
        }
    }
    return cells;
}

// ─── Sprites ───────────────────────────────────────────────────────────────────
function drawFloor(ctx, x, y) {
    ctx.fillStyle = '#c8a058';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#b09048';
    ctx.fillRect(x + T - 1, y, 1, T);
    ctx.fillRect(x, y + T - 1, T, 1);
}

function drawHard(ctx, x, y) {
    ctx.fillStyle = '#787878';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(x, y, T, 3);
    ctx.fillRect(x, y, 3, T);
    ctx.fillStyle = '#444';
    ctx.fillRect(x + T - 3, y + 3, 3, T - 3);
    ctx.fillRect(x + 3, y + T - 3, T - 6, 3);
    ctx.fillStyle = '#666';
    ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
}

function drawSoft(ctx, x, y) {
    ctx.fillStyle = '#c04818';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#e86030';
    ctx.fillRect(x, y, T, 3);
    ctx.fillRect(x, y, 2, T);
    ctx.fillStyle = '#903010';
    ctx.fillRect(x, y + T - 2, T, 2);
    ctx.fillRect(x + T - 2, y, 2, T);
    ctx.fillStyle = '#802808';
    const q = Math.floor(T / 4);
    for (let i = 1; i < 4; i++) ctx.fillRect(x + 2, y + i * q, T - 4, 2);
    ctx.fillRect(x + T / 2, y + 2, 2, q - 2);
    ctx.fillRect(x + T / 4, y + q + 2, 2, q - 2);
    ctx.fillRect(x + (T * 3) / 4, y + 2 * q + 2, 2, q - 2);
}

function drawBreaking(ctx, x, y, frame) {
    ctx.globalAlpha = Math.max(0, 1 - frame / 10);
    const sc = 1 + frame * 0.07;
    ctx.save();
    ctx.translate(x + T / 2, y + T / 2);
    ctx.scale(sc, sc);
    drawSoft(ctx, -T / 2, -T / 2);
    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawPowerup(ctx, x, y, type) {
    ctx.fillStyle = '#ffdd00';
    ctx.fillRect(x + 4, y + 4, T - 8, T - 8);
    ctx.fillStyle = '#ffff88';
    ctx.fillRect(x + 4, y + 4, T - 8, 3);
    ctx.fillRect(x + 4, y + 4, 3, T - 8);
    ctx.fillStyle = '#cc9900';
    ctx.fillRect(x + T - 8, y + 4, 4, T - 8);
    ctx.fillRect(x + 4, y + T - 8, T - 8, 4);
    if (type === PU_BOMB) {
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(x + T / 2, y + T / 2 + 2, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#553300'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + T / 2 + 4, y + T / 2 - 5);
        ctx.quadraticCurveTo(x + T / 2 + 9, y + T / 2 - 13, x + T / 2 + 5, y + T / 2 - 17);
        ctx.stroke();
        ctx.fillStyle = '#ffaa00'; ctx.fillRect(x + T / 2 + 3, y + T / 2 - 19, 4, 4);
    } else if (type === PU_FIRE) {
        const fx = x + T / 2, fy = y + T - 7;
        ctx.fillStyle = '#ff2200';
        ctx.beginPath(); ctx.moveTo(fx, y + 8); ctx.lineTo(fx + 7, fy); ctx.lineTo(fx - 7, fy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8800';
        ctx.beginPath(); ctx.moveTo(fx, y + 12); ctx.lineTo(fx + 4, fy); ctx.lineTo(fx - 4, fy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffee00';
        ctx.beginPath(); ctx.moveTo(fx, y + 16); ctx.lineTo(fx + 2, fy); ctx.lineTo(fx - 2, fy); ctx.closePath(); ctx.fill();
    } else {
        ctx.fillStyle = '#0099ff';
        ctx.beginPath();
        ctx.moveTo(x + T / 2 - 1, y + 6); ctx.lineTo(x + T / 2 + 6, y + T / 2 - 1);
        ctx.lineTo(x + T / 2 + 2, y + T / 2 - 1); ctx.lineTo(x + T / 2 + 3, y + T - 7);
        ctx.lineTo(x + T / 2 - 1, y + T - 7); ctx.lineTo(x + T / 2 - 7, y + T / 2 + 1);
        ctx.lineTo(x + T / 2 - 3, y + T / 2 + 1); ctx.closePath(); ctx.fill();
    }
}

function drawBomb(ctx, x, y, timer, tick) {
    const blink = timer < 60 && tick % 8 < 4;
    const cx = x + T / 2, cy = y + T / 2 + 2;
    ctx.fillStyle = blink ? '#ff4400' : '#111';
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#444'; ctx.fillRect(cx - 4, cy - 8, 7, 4);
    ctx.strokeStyle = '#6b3300'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx + 4, cy - 8);
    ctx.quadraticCurveTo(cx + 10, cy - 16, cx + 6, cy - 20); ctx.stroke();
    if (tick % 6 < 3) {
        ctx.fillStyle = '#ffee44'; ctx.fillRect(cx + 4, cy - 22, 4, 4);
        ctx.fillStyle = '#ff9900'; ctx.fillRect(cx + 5, cy - 25, 3, 3);
    }
}

function drawExplosion(ctx, x, y, type, frame) {
    const t = 1 - frame / EXP_DUR;
    ctx.globalAlpha = Math.max(0, t);
    const c1 = `rgb(255,${Math.floor(150 * t)},0)`;
    const c2 = `rgb(255,${Math.floor(220 * t)},${Math.floor(80 * t)})`;
    const c3 = `rgb(255,255,${Math.floor(200 * t)})`;
    if (type === 'center') {
        ctx.fillStyle = c1; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = c2; ctx.fillRect(x + 6, y + 6, T - 12, T - 12);
        ctx.fillStyle = c3; ctx.fillRect(x + 11, y + 11, T - 22, T - 22);
    } else if (type === 'h') {
        ctx.fillStyle = c1; ctx.fillRect(x, y + 11, T, T - 22);
        ctx.fillStyle = c2; ctx.fillRect(x, y + 14, T, T - 28);
    } else if (type === 'v') {
        ctx.fillStyle = c1; ctx.fillRect(x + 11, y, T - 22, T);
        ctx.fillStyle = c2; ctx.fillRect(x + 14, y, T - 28, T);
    } else if (type === 'tip_r') {
        ctx.fillStyle = c1; ctx.fillRect(x, y + 11, T - 2, T - 22);
        ctx.fillStyle = c3; ctx.fillRect(x + T - 12, y + 8, 12, T - 16);
    } else if (type === 'tip_l') {
        ctx.fillStyle = c1; ctx.fillRect(x + 2, y + 11, T - 2, T - 22);
        ctx.fillStyle = c3; ctx.fillRect(x, y + 8, 12, T - 16);
    } else if (type === 'tip_d') {
        ctx.fillStyle = c1; ctx.fillRect(x + 11, y, T - 22, T - 2);
        ctx.fillStyle = c3; ctx.fillRect(x + 8, y + T - 12, T - 16, 12);
    } else if (type === 'tip_u') {
        ctx.fillStyle = c1; ctx.fillRect(x + 11, y + 2, T - 22, T - 2);
        ctx.fillStyle = c3; ctx.fillRect(x + 8, y, T - 16, 12);
    }
    ctx.globalAlpha = 1;
}

function drawBomberman(ctx, x, y, dir, frame, invincible, tick) {
    if (invincible > 0 && tick % 8 < 4) return;
    const cx = x + T / 2, cy = y + T / 2;
    const wk = (frame >> 2) % 2;
    const la = wk ? 3 : -3;

    // Shoes
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 9, cy + 10 + la, 9, 4);
    ctx.fillRect(cx + 0, cy + 10 - la, 9, 4);
    // Legs
    ctx.fillStyle = '#2244bb';
    ctx.fillRect(cx - 8, cy + 4, 7, 8);
    ctx.fillRect(cx + 1, cy + 4, 7, 8);
    // Body
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(cx - 8, cy - 5, 16, 11);
    // Belt
    ctx.fillStyle = '#2244bb';
    ctx.fillRect(cx - 8, cy + 4, 16, 3);
    // Arms
    ctx.fillStyle = '#eeeeee';
    if (dir === 'left') {
        ctx.fillRect(cx - 13, cy - 3, 7, 7);
    } else if (dir === 'right') {
        ctx.fillRect(cx + 6, cy - 3, 7, 7);
    } else {
        ctx.fillRect(cx - 13, cy - 3, 6, 7);
        ctx.fillRect(cx + 7, cy - 3, 6, 7);
    }
    // Head
    ctx.fillStyle = '#f0c882';
    ctx.fillRect(cx - 7, cy - 18, 14, 14);
    // Hat brim
    ctx.fillStyle = '#2244bb';
    ctx.fillRect(cx - 9, cy - 20, 18, 4);
    // Hat top
    ctx.fillRect(cx - 6, cy - 27, 12, 9);
    // Eyes
    ctx.fillStyle = '#111';
    if (dir === 'down' || dir === 'left' || dir === 'right') {
        const ey = cy - 14;
        if (dir === 'right') {
            ctx.fillRect(cx + 2, ey, 3, 3);
        } else if (dir === 'left') {
            ctx.fillRect(cx - 5, ey, 3, 3);
        } else {
            ctx.fillRect(cx - 5, ey, 3, 3);
            ctx.fillRect(cx + 2, ey, 3, 3);
            // mouth
            ctx.fillRect(cx - 3, ey + 5, 6, 1);
        }
    }
}

function drawEnemy(ctx, x, y, type, frame, dying, tick) {
    if (dying > 0) {
        ctx.globalAlpha = Math.max(0, 1 - dying / 10);
        if (dying > 10) { ctx.globalAlpha = 1; return; }
    }
    const cx = x + T / 2, cy = y + T / 2;
    const wk = (frame >> 2) % 2;
    const la = wk ? 3 : -3;

    if (type === 0) {
        // Balloom – blue ghost blob
        ctx.fillStyle = '#3366ff';
        ctx.beginPath(); ctx.ellipse(cx, cy - 1, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6699ff';
        ctx.beginPath(); ctx.ellipse(cx - 3, cy - 7, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 8, cy - 7, 6, 5); ctx.fillRect(cx + 2, cy - 7, 6, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 7, cy - 6, 4, 4); ctx.fillRect(cx + 3, cy - 6, 4, 4);
        // Feet
        ctx.fillStyle = '#2244cc';
        ctx.fillRect(cx - 9, cy + 10, 5, 5 + la);
        ctx.fillRect(cx - 2, cy + 10, 5, 5);
        ctx.fillRect(cx + 4, cy + 10, 5, 5 - la);
    } else {
        // Oneal – red tomato
        ctx.fillStyle = '#dd1111';
        ctx.beginPath(); ctx.ellipse(cx, cy - 2, 11, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.beginPath(); ctx.ellipse(cx - 3, cy - 8, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Stem
        ctx.fillStyle = '#228800';
        ctx.fillRect(cx - 2, cy - 13, 4, 3);
        ctx.fillRect(cx - 5, cy - 15, 4, 3);
        ctx.fillRect(cx + 1, cy - 15, 4, 3);
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 7, cy - 8, 5, 4); ctx.fillRect(cx + 2, cy - 8, 5, 4);
        ctx.fillStyle = '#000';
        const eo = wk ? 1 : 0;
        ctx.fillRect(cx - 6 + eo, cy - 7, 3, 3); ctx.fillRect(cx + 3 + eo, cy - 7, 3, 3);
        // Angry brow
        ctx.fillStyle = '#880000';
        ctx.fillRect(cx - 8, cy - 10, 6, 2); ctx.fillRect(cx + 2, cy - 10, 6, 2);
        // Feet
        ctx.fillStyle = '#991100';
        ctx.fillRect(cx - 9, cy + 8, 5, 5 + la);
        ctx.fillRect(cx - 2, cy + 8, 4, 5);
        ctx.fillRect(cx + 3, cy + 8, 5, 5 - la);
    }
    if (dying > 0) ctx.globalAlpha = 1;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Bomberman({ onExit }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const keysRef = useRef(new Set());
    const gRef = useRef(null);
    const mobileDir = useRef(null);
    const mobileBomb = useRef(false);
    const [ui, setUi] = useState({ status: 'idle', score: 0, lives: 3, level: 1 });
    const [showSave, setShowSave] = useState(false);

    const initLevel = useCallback((level, lives, score) => {
        const map = makeMap(level);
        gRef.current = {
            map,
            powerups: makePowerups(map),
            enemies: makeEnemies(map, level),
            bombs: [],
            explosions: {},
            breaking: {},
            player: {
                px: T + T / 2, py: T + T / 2,
                dir: 'down', animFrame: 0, animTick: 0,
                invincible: 0, alive: true, dying: 0,
                bombsDown: 0, maxBombs: 1, fireRange: 1, speed: 1.8,
                escRow: -1, escCol: -1,
            },
            score, lives, level, status: 'playing', tick: 0, bombWasDown: false,
        };
        setUi({ status: 'playing', score, lives, level });
        setShowSave(false);
    }, []);

    const startGame = useCallback(() => initLevel(1, 3, 0), [initLevel]);

    // ── Game loop ────────────────────────────────────────────────────────────
    const loop = useCallback(() => {
        const canvas = canvasRef.current;
        const g = gRef.current;
        rafRef.current = requestAnimationFrame(loop);
        if (!canvas || !g) return;
        const ctx = canvas.getContext('2d');
        g.tick++;
        const tick = g.tick;

        // ── Update ──────────────────────────────────────────────────────────
        if (g.status === 'playing') {
            const p = g.player;

            if (p.alive) {
                // Movement
                const dir = mobileDir.current ||
                    (keysRef.current.has('ArrowLeft') ? 'left' :
                        keysRef.current.has('ArrowRight') ? 'right' :
                            keysRef.current.has('ArrowUp') ? 'up' :
                                keysRef.current.has('ArrowDown') ? 'down' : null);
                if (dir) {
                    p.dir = dir;
                    const nxt = moveEntity(p.px, p.py, dir, p.speed, g.map, g.bombs, false, p.escRow, p.escCol);
                    if (nxt.px !== p.px || nxt.py !== p.py) {
                        p.px = nxt.px; p.py = nxt.py;
                        p.animTick++;
                        if (p.animTick % 6 === 0) p.animFrame++;
                    }
                }
                // Clear escape tile once the player has left it
                if (p.escRow >= 0) {
                    const curR = Math.floor(p.py / T), curC = Math.floor(p.px / T);
                    if (curR !== p.escRow || curC !== p.escCol) { p.escRow = -1; p.escCol = -1; }
                }

                // Bomb placement
                const bombDown = keysRef.current.has(' ') || keysRef.current.has('x') ||
                    keysRef.current.has('X') || mobileBomb.current;
                if (bombDown && !g.bombWasDown && p.bombsDown < p.maxBombs) {
                    const bc = Math.floor(p.px / T), br = Math.floor(p.py / T);
                    if (!g.bombs.some(b => b.row === br && b.col === bc)) {
                        g.bombs.push({ row: br, col: bc, timer: FUSE, range: p.fireRange });
                        p.bombsDown++;
                        p.escRow = br; p.escCol = bc; // puede escapar de esta celda
                        sfxBomb();
                    }
                }
                g.bombWasDown = bombDown;

                // Invincibility
                if (p.invincible > 0) p.invincible--;

                // Explosion vs player
                if (p.invincible === 0) {
                    const pc = Math.floor(p.px / T), pr = Math.floor(p.py / T);
                    if (g.explosions[`${pr},${pc}`]) { p.alive = false; sfxDie(); }
                }

                // Enemy vs player
                if (p.alive) {
                    for (const e of g.enemies) {
                        if (!e.alive) continue;
                        if (Math.abs(e.px - p.px) < HALF + 10 && Math.abs(e.py - p.py) < HALF + 10) {
                            p.alive = false; sfxDie(); break;
                        }
                    }
                }
            }

            // Player death sequence
            if (!p.alive) {
                p.dying++;
                if (p.dying > 80) {
                    g.lives--;
                    if (g.lives <= 0) {
                        g.status = 'gameover';
                        setUi(u => ({ ...u, status: 'gameover', lives: 0, score: g.score }));
                    } else {
                        p.px = T + T / 2; p.py = T + T / 2;
                        p.alive = true; p.dying = 0; p.invincible = 150; p.bombsDown = 0;
                        setUi(u => ({ ...u, lives: g.lives }));
                    }
                }
            }

            // Bombs countdown
            for (let i = g.bombs.length - 1; i >= 0; i--) {
                const b = g.bombs[i];
                b.timer--;
                if (b.timer <= 0) {
                    const cells = calcExplosion(g.map, b.row, b.col, b.range);
                    for (const cell of cells) {
                        const key = `${cell.r},${cell.c}`;
                        g.explosions[key] = { type: cell.type, frame: 0 };
                        if (g.map[cell.r][cell.c] === SOFT) {
                            g.breaking[key] = 0;
                            g.map[cell.r][cell.c] = EMPTY;
                        }
                    }
                    g.bombs.splice(i, 1);
                    g.player.bombsDown = Math.max(0, g.player.bombsDown - 1);
                    sfxBlast();
                    // Chain reaction
                    for (const ob of g.bombs)
                        if (g.explosions[`${ob.row},${ob.col}`]) ob.timer = Math.min(ob.timer, 3);
                }
            }

            // Explosions advance
            for (const key of Object.keys(g.explosions)) {
                g.explosions[key].frame++;
                if (g.explosions[key].frame >= EXP_DUR) delete g.explosions[key];
            }

            // Breaking walls advance
            for (const key of Object.keys(g.breaking)) {
                g.breaking[key]++;
                if (g.breaking[key] >= 10) delete g.breaking[key];
            }

            // Powerup pickup
            if (p.alive) {
                const pc = Math.floor(p.px / T), pr2 = Math.floor(p.py / T);
                const puKey = `${pr2},${pc}`;
                if (g.powerups[puKey] && g.map[pr2][pc] === EMPTY) {
                    const pu = g.powerups[puKey];
                    delete g.powerups[puKey];
                    if (pu === PU_BOMB)  p.maxBombs = Math.min(p.maxBombs + 1, 5);
                    if (pu === PU_FIRE)  p.fireRange = Math.min(p.fireRange + 1, 6);
                    if (pu === PU_SPEED) p.speed = Math.min(p.speed + 0.4, 3.5);
                    g.score += 200;
                    sfxPowerup();
                    setUi(u => ({ ...u, score: g.score }));
                }
            }

            // Enemies update
            for (const e of g.enemies) {
                if (!e.alive) { if (e.dying < 12) e.dying++; continue; }

                // Explosion hit
                const ec = Math.floor(e.px / T), er = Math.floor(e.py / T);
                if (g.explosions[`${er},${ec}`]) {
                    e.alive = false; e.dying = 1;
                    g.score += e.type === 1 ? 300 : 100;
                    setUi(u => ({ ...u, score: g.score }));
                    continue;
                }

                // Animate
                e.animTick++;
                if (e.animTick % 8 === 0) e.animFrame++;

                // Move
                const tryMove = (dir) => {
                    const r = moveEntity(e.px, e.py, dir, e.speed, g.map, g.bombs, true);
                    return (r.px !== e.px || r.py !== e.py) ? r : null;
                };

                let moved = tryMove(e.dir);
                if (!moved || tick % 80 === (e.id * 19) % 80) {
                    const dirs = ['left', 'right', 'up', 'down'].filter(d => tryMove(d));
                    if (dirs.length > 0) {
                        if (e.type === 1 && dirs.length > 1 && p.alive) {
                            const dx = p.px - e.px, dy = p.py - e.py;
                            const pref = Math.abs(dx) > Math.abs(dy)
                                ? (dx > 0 ? 'right' : 'left')
                                : (dy > 0 ? 'down' : 'up');
                            e.dir = dirs.includes(pref) && Math.random() < 0.6
                                ? pref : dirs[Math.floor(Math.random() * dirs.length)];
                        } else {
                            e.dir = dirs[Math.floor(Math.random() * dirs.length)];
                        }
                        moved = tryMove(e.dir);
                    }
                }
                if (moved) { e.px = moved.px; e.py = moved.py; }
            }

            // Win condition
            if (g.enemies.every(e => !e.alive) && g.status === 'playing') {
                g.score += g.level * 1000 + 500;
                g.status = 'levelclear';
                sfxWin();
                setUi(u => ({ ...u, status: 'levelclear', score: g.score }));
            }
        }

        // ── Draw ────────────────────────────────────────────────────────────
        const scale = canvas.width / GW;
        ctx.save();
        ctx.scale(scale, scale);

        // BG
        ctx.fillStyle = '#1a1a3a';
        ctx.fillRect(0, 0, GW, GH);

        // Floor
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                if (g.map[r][c] !== HARD) drawFloor(ctx, c * T, r * T);

        // Powerups (only on empty tiles)
        for (const [key, pu] of Object.entries(g.powerups)) {
            const [r, c] = key.split(',').map(Number);
            if (g.map[r][c] === EMPTY) drawPowerup(ctx, c * T, r * T, pu);
        }

        // Walls
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++) {
                if (g.map[r][c] === HARD) drawHard(ctx, c * T, r * T);
                else if (g.map[r][c] === SOFT) drawSoft(ctx, c * T, r * T);
            }

        // Breaking wall animations
        for (const [key, frame] of Object.entries(g.breaking)) {
            const [r, c] = key.split(',').map(Number);
            drawBreaking(ctx, c * T, r * T, frame);
        }

        // Explosions
        for (const [key, exp] of Object.entries(g.explosions)) {
            const [r, c] = key.split(',').map(Number);
            drawExplosion(ctx, c * T, r * T, exp.type, exp.frame);
        }

        // Bombs
        for (const b of g.bombs)
            drawBomb(ctx, b.col * T, b.row * T, b.timer, tick);

        // Enemies
        for (const e of g.enemies)
            drawEnemy(ctx, e.px - T / 2, e.py - T / 2, e.type, e.animFrame, e.dying, tick);

        // Player
        const p = g.player;
        if (p.dying > 0) {
            ctx.save();
            ctx.translate(p.px, p.py);
            ctx.rotate((p.dying / 80) * Math.PI * 5);
            ctx.globalAlpha = Math.max(0, 1 - p.dying / 80);
            drawBomberman(ctx, -T / 2, -T / 2, p.dir, p.animFrame, 0, tick);
            ctx.restore();
        } else if (p.alive) {
            drawBomberman(ctx, p.px - T / 2, p.py - T / 2, p.dir, p.animFrame, p.invincible, tick);
        }

        ctx.restore();
    }, []);

    // RAF
    useEffect(() => {
        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [loop]);

    // Keyboard
    useEffect(() => {
        const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);
        const dn = e => { if (PREVENT.has(e.key)) e.preventDefault(); keysRef.current.add(e.key); };
        const up = e => keysRef.current.delete(e.key);
        window.addEventListener('keydown', dn);
        window.addEventListener('keyup', up);
        return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
    }, []);

    // Canvas resize
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const p = canvas.parentElement;
            const s = Math.min(p.clientWidth / GW, p.clientHeight / GH, 2);
            canvas.style.width = `${GW * s}px`;
            canvas.style.height = `${GH * s}px`;
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Auto-advance level
    useEffect(() => {
        if (ui.status !== 'levelclear') return;
        const t = setTimeout(() => {
            const g = gRef.current;
            if (!g || g.status !== 'levelclear') return;
            if (g.level >= 3) { g.status = 'won'; setUi(u => ({ ...u, status: 'won' })); }
            else initLevel(g.level + 1, g.lives, g.score);
        }, 3000);
        return () => clearTimeout(t);
    }, [ui.status, initLevel]);

    const nextLevel = () => {
        const g = gRef.current;
        if (!g) return;
        if (g.level >= 3) { g.status = 'won'; setUi(u => ({ ...u, status: 'won' })); }
        else initLevel(g.level + 1, g.lives, g.score);
    };

    const ACC = '#ffdd00';

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: '#080814',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Courier New', monospace", color: '#fff',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 520, padding: '4px 8px', boxSizing: 'border-box' }}>
                <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>← Arkade</button>
                <span style={{ color: ACC, fontWeight: 700, fontSize: '1.1rem', letterSpacing: 3, textShadow: `0 0 12px ${ACC}` }}>💣 BOMBERMAN</span>
                <FullscreenBtn />
            </div>

            {/* HUD */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 520, padding: '2px 10px', boxSizing: 'border-box', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                <span>SCORE: <b style={{ color: ACC }}>{ui.score.toLocaleString()}</b></span>
                <span>{Array.from({ length: 3 }).map((_, i) => (<span key={i} style={{ color: i < ui.lives ? '#ff4444' : 'rgba(255,255,255,0.1)', margin: '0 1px', fontSize: '1rem' }}>♥</span>))}</span>
                <span>NIVEL: <b style={{ color: ACC }}>{ui.level}/3</b></span>
            </div>

            {/* Canvas area */}
            <div style={{ position: 'relative', flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <canvas ref={canvasRef} width={GW} height={GH}
                    style={{ imageRendering: 'pixelated', display: 'block', border: '3px solid #333' }} />

                {/* Overlays */}
                {(ui.status === 'idle' || ui.status === 'gameover' || ui.status === 'won') && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)' }}>
                        <div style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: 4, color: ui.status === 'gameover' ? '#ff4444' : ACC, textShadow: '0 0 20px currentColor', marginBottom: 10 }}>
                            {ui.status === 'idle' ? '💣 BOMBERMAN' : ui.status === 'gameover' ? 'GAME OVER' : '¡VICTORIA!'}
                        </div>
                        {ui.status !== 'idle' && <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 14, fontSize: '1rem' }}>Puntos: {ui.score.toLocaleString()}</div>}
                        {(ui.status === 'gameover' || ui.status === 'won') && (
                            showSave
                                ? <SaveForm gameKey="BOMBERMAN" score={ui.score} accentColor={ACC} onDone={() => setShowSave(false)} />
                                : <button onClick={() => setShowSave(true)} style={{ background: 'rgba(255,221,0,0.1)', color: ACC, border: `1px solid ${ACC}44`, borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: '0.8rem', marginBottom: 10 }}>📋 Guardar puntuación</button>
                        )}
                        <button onClick={startGame} style={{ padding: '10px 30px', fontSize: '1rem', fontWeight: 700, background: 'transparent', color: ACC, border: `3px solid ${ACC}`, borderRadius: 8, cursor: 'pointer', boxShadow: `0 0 15px ${ACC}44`, letterSpacing: 2, marginTop: 4 }}>
                            {ui.status === 'idle' ? 'INICIAR' : 'REINICIAR'}
                        </button>
                    </div>
                )}
                {ui.status === 'levelclear' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00ff88', textShadow: '0 0 20px #00ff88', marginBottom: 8 }}>NIVEL {ui.level} COMPLETADO!</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 18 }}>Puntos: {ui.score.toLocaleString()}</div>
                        <button onClick={nextLevel} style={{ padding: '10px 30px', fontSize: '1rem', fontWeight: 700, background: 'transparent', color: '#00ff88', border: '3px solid #00ff88', borderRadius: 8, cursor: 'pointer' }}>
                            {gRef.current?.level >= 3 ? 'VER FINAL' : 'NIVEL SIGUIENTE →'}
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile controls */}
            <div style={{ width: '100%', maxWidth: 520, padding: '8px 10px', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                {/* D-Pad */}
                <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
                    {[
                        { label: '▲', dir: 'up', top: 0, left: 42 },
                        { label: '▼', dir: 'down', top: 82, left: 42 },
                        { label: '◀', dir: 'left', top: 41, left: 0 },
                        { label: '▶', dir: 'right', top: 41, left: 82 },
                    ].map(({ label, dir, top, left }) => (
                        <button key={dir}
                            onPointerDown={e => { e.preventDefault(); mobileDir.current = dir; }}
                            onPointerUp={() => { mobileDir.current = null; }}
                            onPointerLeave={() => { mobileDir.current = null; }}
                            style={{ position: 'absolute', top, left, width: 42, height: 42, background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', userSelect: 'none' }}>
                            {label}
                        </button>
                    ))}
                    <div style={{ position: 'absolute', top: 41, left: 42, width: 42, height: 42, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.7 }}>
                    <div>← → ↑ ↓ Mover</div>
                    <div>X / ESPACIO Bomba</div>
                </div>

                {/* Bomb button */}
                <button
                    onPointerDown={e => { e.preventDefault(); mobileBomb.current = true; }}
                    onPointerUp={() => { mobileBomb.current = false; }}
                    onPointerLeave={() => { mobileBomb.current = false; }}
                    style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,70,0,0.25)', border: '3px solid #ff4600', color: 'white', fontSize: '2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', userSelect: 'none', boxShadow: '0 0 20px rgba(255,70,0,0.35)', flexShrink: 0 }}>
                    💣
                </button>
            </div>
        </div>
    );
}
