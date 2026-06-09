import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const COLL     = 'arkade_rankings';
const NAME_KEY = 'arkade_player_name';
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ─── nombre local del jugador ─────────────────────────────────────────────────
export function getLastName() { return localStorage.getItem(NAME_KEY) || ''; }
export function setLastName(n) { localStorage.setItem(NAME_KEY, n); }

// ─── helpers ──────────────────────────────────────────────────────────────────
function isTime(key) { return key.startsWith('BUSCAMINAS'); }

function sortList(list, key) {
    return [...list].sort((a, b) => isTime(key) ? a.s - b.s : b.s - a.s);
}

async function fetchAll(gameKey) {
    const snap = await getDocs(query(collection(db, COLL), where('gameKey', '==', gameKey)));
    return snap.docs.map(d => d.data());
}

// ─── API pública (async) ──────────────────────────────────────────────────────

/**
 * Guarda una puntuación en Firestore.
 * Devuelve { monthly: número de posición este mes, allTime: posición top-10 o null }
 */
export async function saveScore(gameKey, score, name) {
    const clean = (name || 'Jugador').trim().slice(0, 16) || 'Jugador';
    setLastName(clean);
    const now = Date.now();

    await addDoc(collection(db, COLL), { gameKey, n: clean, s: score, t: now });

    const all     = await fetchAll(gameKey);
    const sorted  = sortList(all, gameKey);
    const monthly = sortList(all.filter(e => e.t >= now - MONTH_MS), gameKey);

    const monthlyRank = monthly.findIndex(e => e.t === now) + 1;
    const allTimeIdx  = sorted.slice(0, 10).findIndex(e => e.t === now);

    return {
        monthly: monthlyRank > 0 ? monthlyRank : null,
        allTime: allTimeIdx >= 0 ? allTimeIdx + 1 : null,
    };
}

/** Top 10 del último mes */
export async function getScoresMonthly(gameKey) {
    const now = Date.now();
    const all = await fetchAll(gameKey);
    return sortList(all.filter(e => e.t >= now - MONTH_MS), gameKey).slice(0, 10);
}

/** Top 10 histórico */
export async function getScoresAllTime(gameKey) {
    const all = await fetchAll(gameKey);
    return sortList(all, gameKey).slice(0, 10);
}

// ─── formateo ─────────────────────────────────────────────────────────────────
export function fmtScore(key, score) {
    if (isTime(key)) {
        const m = Math.floor(score / 60), s = score % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }
    return score.toLocaleString();
}

export function fmtDate(ts) {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}
