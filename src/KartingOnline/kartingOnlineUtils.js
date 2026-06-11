import { db, auth } from '../firebase';
import {
  collection, doc, setDoc, addDoc, updateDoc, getDocs,
  query, where, onSnapshot, serverTimestamp, arrayUnion, increment,
} from 'firebase/firestore';

const COLL = 'karting_online';

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Crear partida ────────────────────────────────────────────────────────────
export async function createRace({ circuitType='CUSTOM', circuitId, circuitNombre, circuitData, recursoId, recursoNombre, hojasSel, laps }) {
  const user = auth.currentUser; // puede ser null — no es obligatorio

  // Find unique code among active races
  let code;
  for (let i = 0; i < 10; i++) {
    code = genCode();
    const existing = await getDocs(query(
      collection(db, COLL),
      where('code', '==', code),
      where('status', 'in', ['LOBBY', 'RACING'])
    ));
    if (existing.empty) break;
  }

  const ref = await addDoc(collection(db, COLL), {
    code,
    profesorId:     user?.uid    || null,
    profesorNombre: user?.displayName || user?.email || 'Profesor',
    circuitType:    circuitType,
    circuitId:      circuitId    || null,
    circuitNombre:  circuitNombre || 'Circuito',
    circuitData:    circuitData  || null,
    recursoId:      recursoId    || null,
    recursoNombre:  recursoNombre || '',
    hojasSel:       hojasSel     || [],
    laps,
    status:    'LOBBY',
    startTime: null,
    createdAt: serverTimestamp(),
  });

  return { raceId: ref.id, code };
}

// ─── Buscar partida por código ────────────────────────────────────────────────
export async function findRaceByCode(code) {
  const snap = await getDocs(query(
    collection(db, COLL), where('code', '==', code.toUpperCase().trim())
  ));
  if (snap.empty) return null;
  // prefer active races
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return docs.find(d => d.status !== 'FINISHED') || docs[0];
}

// ─── Alumno se une ────────────────────────────────────────────────────────────
export async function joinRace(raceId, nombre) {
  const playerId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, COLL, raceId, 'players', playerId), {
    nombre: nombre.trim().slice(0, 24) || 'Jugador',
    status:       'LOBBY',
    lapsCompleted: 0,
    checkpoints:  [],
    aciertos:     0,
    fallos:       0,
    finishTime:   null,
    joinedAt:     Date.now(),
    lastSeen:     Date.now(),
  });
  return playerId;
}

// ─── Iniciar carrera (profesor) ───────────────────────────────────────────────
export async function startRace(raceId) {
  const startTime = Date.now() + 4500; // 4.5 s countdown buffer
  await updateDoc(doc(db, COLL, raceId), { status: 'RACING', startTime });
  return startTime;
}

// ─── Terminar carrera (profesor) ──────────────────────────────────────────────
export async function finishRace(raceId) {
  await updateDoc(doc(db, COLL, raceId), { status: 'FINISHED' });
}

// ─── Alumno reporta checkpoint ────────────────────────────────────────────────
export async function reportCheckpoint(raceId, playerId, { cpIdx, lap, tMs, ok }) {
  const ref = doc(db, COLL, raceId, 'players', playerId);
  await updateDoc(ref, {
    checkpoints: arrayUnion({ cpIdx, lap, tMs, ok }),
    ...(ok ? { aciertos: increment(1) } : { fallos: increment(1) }),
    lastSeen: Date.now(),
  });
}

// ─── Alumno reporta vuelta completada ────────────────────────────────────────
export async function reportLap(raceId, playerId, lapsCompleted) {
  await updateDoc(doc(db, COLL, raceId, 'players', playerId), {
    lapsCompleted,
    lastSeen: Date.now(),
  });
}

// ─── Alumno termina la carrera ────────────────────────────────────────────────
export async function reportFinish(raceId, playerId, { finishTime, aciertos, fallos }) {
  await updateDoc(doc(db, COLL, raceId, 'players', playerId), {
    status:     'FINISHED',
    finishTime,
    aciertos,
    fallos,
    lastSeen:   Date.now(),
  });
}

// ─── Listeners ───────────────────────────────────────────────────────────────
export function listenRace(raceId, cb) {
  return onSnapshot(doc(db, COLL, raceId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() });
  });
}

export function listenPlayers(raceId, cb) {
  return onSnapshot(collection(db, COLL, raceId, 'players'), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── Guardar informe al terminar ──────────────────────────────────────────────
export async function saveRaceReport(race, players) {
  const user = auth.currentUser; // puede ser null
  // Try to find professor's code (only if authenticated)
  let codigoProfesor = '';
  try {
    if (user) {
      const cSnap = await getDocs(query(collection(db, 'codigos_profesor'), where('uid', '==', user.uid)));
      if (!cSnap.empty) codigoProfesor = cSnap.docs[0].id;
    }
  } catch (_) {}

  const jugadores = players
    .filter(p => p.status === 'FINISHED' || p.lapsCompleted > 0)
    .map((p, i) => ({
      nombre:    p.nombre,
      aciertos:  p.aciertos  || 0,
      fallos:    p.fallos    || 0,
      vueltas:   p.lapsCompleted || 0,
      tiempo:    p.finishTime != null ? p.finishTime : null,
      tiempoStr: p.finishTime != null ? fmtMs(p.finishTime) : '--',
    }));

  await addDoc(collection(db, 'informes_juegos'), {
    tipo:          'KARTINGED_ONLINE',
    modalidad:     'Online Karting',
    fecha:         new Date(),
    recursoId:     race.recursoId  || null,
    recursoTitulo: race.recursoNombre || '',
    circuitoNombre: race.circuitNombre || '',
    codigoProfesor,
    profesorId:    user.uid,
    jugadores,
    totalJugadores: players.length,
    laps:          race.laps,
  });
}

// ─── Helpers de formato ───────────────────────────────────────────────────────
export function fmtMs(ms) {
  if (ms == null) return '--:--';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function sortByTime(players) {
  return [...players].sort((a, b) => {
    const aF = a.status === 'FINISHED', bF = b.status === 'FINISHED';
    if (aF && bF)  return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
    if (aF)        return -1;
    if (bF)        return 1;
    const aL = a.lapsCompleted || 0, bL = b.lapsCompleted || 0;
    if (aL !== bL) return bL - aL;
    const aCps = a.checkpoints || [], bCps = b.checkpoints || [];
    const aLast = aCps.length ? aCps[aCps.length - 1].tMs : Infinity;
    const bLast = bCps.length ? bCps[bCps.length - 1].tMs : Infinity;
    return aLast - bLast;
  });
}

export function sortByScore(players) {
  return [...players].sort((a, b) => {
    if ((b.aciertos || 0) !== (a.aciertos || 0)) return (b.aciertos || 0) - (a.aciertos || 0);
    return (a.fallos || 0) - (b.fallos || 0);
  });
}
