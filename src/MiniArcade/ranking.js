const KEY      = 'arkade_rankings_v2';
const NAME_KEY = 'arkade_player_name';
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ─── storage helpers ──────────────────────────────────────────────────────────
function load()       { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function persist(d)   { localStorage.setItem(KEY, JSON.stringify(d)); }
export function getLastName()   { return localStorage.getItem(NAME_KEY) || ''; }
export function setLastName(n)  { localStorage.setItem(NAME_KEY, n); }

// ─── helpers ──────────────────────────────────────────────────────────────────
function isTime(key)  { return key.startsWith('BUSCAMINAS'); }

function sorted(list, key) {
    return [...list].sort((a, b) => isTime(key) ? a.s - b.s : b.s - a.s);
}

// Purge: keep entries that are < 30 days OLD  OR  are in all-time top 10
function purge(list, key) {
    const now = Date.now();
    const top10 = new Set(sorted(list, key).slice(0, 10));  // same object refs
    return list.filter(e => (now - e.t) <= MONTH_MS || top10.has(e));
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Save a score. Returns { monthly, allTime }
 *   monthly  = 1-based position in this month's ranking (all entries this month)
 *   allTime  = 1-based position in the all-time top 10, or null if outside
 */
export function saveScore(gameKey, score, name) {
    const clean = (name || 'Jugador').trim().slice(0, 16) || 'Jugador';
    setLastName(clean);
    const now = Date.now();

    const d = load();
    if (!d[gameKey]) d[gameKey] = [];
    const entry = { n: clean, s: score, t: now };
    d[gameKey].push(entry);
    d[gameKey] = purge(d[gameKey], gameKey);
    persist(d);

    // Read back (after purge) to get final positions
    const fresh = load()[gameKey] || [];
    const monthly = fresh.filter(e => (now - e.t) <= MONTH_MS);
    const sortedMonthly  = sorted(monthly, gameKey);
    const sortedAllTime  = sorted(fresh, gameKey).slice(0, 10);

    // Match by timestamp (unique per save call)
    const monthlyRank = sortedMonthly.findIndex(e => e.t === now) + 1;
    const allTimeIdx  = sortedAllTime.findIndex(e => e.t === now);

    return {
        monthly:  monthlyRank > 0 ? monthlyRank : null,
        allTime:  allTimeIdx >= 0 ? allTimeIdx + 1 : null,
    };
}

/** Top 10 of the last 30 days */
export function getScoresMonthly(key) {
    const now  = Date.now();
    const list = (load()[key] || []).filter(e => (now - e.t) <= MONTH_MS);
    return sorted(list, key).slice(0, 10);
}

/** Top 10 all-time (kept forever) */
export function getScoresAllTime(key) {
    return sorted(load()[key] || [], key).slice(0, 10);
}

// ─── formatting ───────────────────────────────────────────────────────────────
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
