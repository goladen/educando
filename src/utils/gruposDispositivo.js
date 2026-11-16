// Grupos de alumnos guardados en ESTE dispositivo (el grupo con el que trabaja el profe todo el curso).
// Se eligen desde las comunidades (cursos, grupos del centro), «Mis grupos» o a mano, y se usan en:
// ruleta, creador de grupos, sorteos (GruposPizarras: pizarras verticales, dinámicas…), el nombre al
// enviar resultados (SelectorNombresGlobal) y los nombres de los mandos micro:bit.
//
// localStorage:
//   pikt_grupos_dispositivo_v1 → [{ id, nombre, curso?, origen?, alumnos: [string], fecha }]
//   pikt_grupo_activo_v1       → id del grupo en uso
// Evento window 'pikt-grupos-dispositivo' al cambiar (para refrescar otras pantallas).
import { useEffect, useState } from 'react';

const LS = 'pikt_grupos_dispositivo_v1';
const LS_ACTIVO = 'pikt_grupo_activo_v1';
const LS_PV = 'pv_listas_v1'; // listas antiguas de Pizarras verticales (se migran una vez)
const LS_MANDOS = 'pikt_mandos_nombres';
const EVENTO = 'pikt-grupos-dispositivo';

const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const avisar = () => { try { window.dispatchEvent(new Event(EVENTO)); } catch { /* */ } };
export const nuevoIdGrupo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const limpiarNombres = (arr) => {
    const vistos = new Set(); const out = [];
    (arr || []).forEach(n => { const s = String(n ?? '').trim(); const k = s.toLowerCase(); if (s && !vistos.has(k)) { vistos.add(k); out.push(s); } });
    return out;
};

export function listarGruposDispositivo() {
    let gs = leer(LS, null);
    if (!Array.isArray(gs)) {
        // Primera vez: traer las listas que ya había en Pizarras verticales
        const pv = leer(LS_PV, null) || (() => { // versión más antigua: un único textarea
            const t = String(leer('pv_alumnos_v1', '') || '').split(/\n/).map(x => x.trim()).filter(Boolean);
            return t.length ? [{ nombre: 'Mi lista', alumnos: t }] : [];
        })();
        gs = Array.isArray(pv) ? pv.filter(l => l && Array.isArray(l.alumnos)).map(l => ({ id: l.id || nuevoIdGrupo(), nombre: l.nombre || 'Mi lista', alumnos: limpiarNombres(l.alumnos), fecha: l.fecha || new Date().toISOString(), origen: { tipo: 'manual' } })) : [];
        escribir(LS, gs);
    }
    return gs;
}

function guardarTodos(gs) { escribir(LS, gs); avisar(); }
/** Sustituye la lista completa (lo usa GruposPizarras al editar sus listas). */
export function reemplazarGruposDispositivo(gs) { guardarTodos(gs.map(g => ({ ...g, alumnos: limpiarNombres(g.alumnos) }))); }

/** Crea o actualiza (si trae id existente). Devuelve el grupo guardado. */
export function guardarGrupoDispositivo(g, { activar = false } = {}) {
    const gs = listarGruposDispositivo();
    const limpio = { ...g, id: g.id || nuevoIdGrupo(), nombre: String(g.nombre || '').trim() || `Grupo ${gs.length + 1}`, alumnos: limpiarNombres(g.alumnos), fecha: new Date().toISOString() };
    const i = gs.findIndex(x => x.id === limpio.id);
    const nuevos = i >= 0 ? gs.map(x => (x.id === limpio.id ? { ...x, ...limpio } : x)) : [...gs, limpio];
    guardarTodos(nuevos);
    if (activar || nuevos.length === 1) setGrupoActivo(limpio.id);
    return limpio;
}

export function borrarGrupoDispositivo(id) {
    guardarTodos(listarGruposDispositivo().filter(g => g.id !== id));
    if (leer(LS_ACTIVO, '') === id) { escribir(LS_ACTIVO, ''); avisar(); }
}

export function añadirMiembro(id, nombre) {
    const g = listarGruposDispositivo().find(x => x.id === id);
    if (g) guardarGrupoDispositivo({ ...g, alumnos: [...g.alumnos, nombre] });
}
export function quitarMiembro(id, nombre) {
    const g = listarGruposDispositivo().find(x => x.id === id);
    if (g) guardarGrupoDispositivo({ ...g, alumnos: g.alumnos.filter(n => n !== nombre) });
}

export function setGrupoActivo(id) { escribir(LS_ACTIVO, id || ''); avisar(); }
export function grupoActivo() {
    const id = leer(LS_ACTIVO, '');
    const gs = listarGruposDispositivo();
    return gs.find(g => g.id === id) || null;
}
export const nombresGrupoActivo = () => grupoActivo()?.alumnos || [];

/** Pone los nombres a los mandos micro:bit por orden: mando 1 = 1.er alumno, mando 2 = 2.º… */
export function nombresAMandos(alumnos, desde = 1) {
    const actuales = leer(LS_MANDOS, {}) || {};
    const n = { ...actuales };
    (alumnos || []).forEach((a, i) => { n[desde + i] = a; });
    escribir(LS_MANDOS, n);
    return n;
}

/** Hook: { grupos, activo } siempre al día (también si se cambia en otra pantalla o pestaña). */
export function useGruposDispositivo() {
    const [estado, setEstado] = useState(() => ({ grupos: listarGruposDispositivo(), activo: grupoActivo() }));
    useEffect(() => {
        const refrescar = () => setEstado({ grupos: listarGruposDispositivo(), activo: grupoActivo() });
        const alStorage = (e) => { if (!e.key || e.key === LS || e.key === LS_ACTIVO) refrescar(); };
        window.addEventListener(EVENTO, refrescar);
        window.addEventListener('storage', alStorage);
        return () => { window.removeEventListener(EVENTO, refrescar); window.removeEventListener('storage', alStorage); };
    }, []);
    return estado;
}
