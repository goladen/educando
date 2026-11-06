// Placas multifunción en el Laboratorio: mientras está abierto, la antena repite MODO:X (los satélites e
// instrumentos se quedan como están) y aquí se reparte la función de cada placa por radio (ROL:<id>:<rol>).
// Al salir la antena vuelve a MODO:L y todas las placas vuelven solas a mando (programasLab.js → f_rol).
import { useEffect, useRef, useState } from 'react';
import { enviarAMandos, escucharInstrumentos, setModoMandos, MODO_LABORATORIO, MODOS } from '../mandos/mandosMicrobit.js';

const LS_ROLES = 'pikt_lab_roles'; // { [id]: 'S1' | … | 'I' | 'M' } reparto guardado en este ordenador
const CADA_REPASO = 6000; // se repite la función de cada placa (por si se encendió tarde o perdió el mensaje)
const CADA_BUSQUEDA = 12000; // «¿quién hay?» a todas

const leerRoles = () => {
  try { const r = JSON.parse(localStorage.getItem(LS_ROLES) || '{}'); return r && typeof r === 'object' ? r : {}; } catch { return {}; }
};
const guardarRoles = (r) => { try { localStorage.setItem(LS_ROLES, JSON.stringify(r)); } catch { /* nada */ } };

/**
 * `activa` = hay antena del laboratorio conectada. Devuelve:
 *   roles: reparto deseado { id: rol }, vistas: { id: { rol, t } } según su último «I:H»,
 *   asignar(id, rol), quitar(rol), repartir(), buscar().
 */
export function usePlacasLab(activa) {
  const [roles, setRoles] = useState(leerRoles);
  const [vistas, setVistas] = useState({});
  const rolesRef = useRef(roles);
  rolesRef.current = roles;

  // Antena en modo laboratorio mientras esto está montado
  useEffect(() => {
    setModoMandos(MODO_LABORATORIO);
    return () => setModoMandos(MODOS.LETRAS);
  }, []);

  useEffect(() => escucharInstrumentos((linea, t) => {
    const m = linea.match(/^I:H:(\d+):(M|S[1-4]|I)$/);
    if (m) setVistas((v) => ({ ...v, [m[1]]: { rol: m[2], t } }));
  }), []);

  const buscar = () => enviarAMandos('ROL:*:?');
  const repasar = () => Object.entries(rolesRef.current).forEach(([id, rol]) => enviarAMandos(`ROL:${id}:${rol}`));

  useEffect(() => {
    if (!activa) return undefined;
    buscar();
    const t1 = setTimeout(repasar, 1500);
    const r = setInterval(repasar, CADA_REPASO);
    const b = setInterval(buscar, CADA_BUSQUEDA);
    return () => { clearTimeout(t1); clearInterval(r); clearInterval(b); };
  }, [activa]);

  const fijar = (nuevo) => {
    // Las placas que cambian de función reciben la orden ya (luego la repite el repaso)
    Object.entries(nuevo).forEach(([id, rol]) => {
      if (rolesRef.current[id] !== rol || vistas[id]?.rol !== rol) enviarAMandos(`ROL:${id}:${rol}`);
    });
    rolesRef.current = nuevo;
    setRoles(nuevo);
    guardarRoles(nuevo);
  };

  /** Pone la placa `id` como `rol`; la que tuviera ese satélite o el instrumento pasa a mando. */
  const asignar = (id, rol) => {
    const nuevo = { ...rolesRef.current };
    if (rol !== 'M') Object.keys(nuevo).forEach((k) => { if (nuevo[k] === rol && k !== String(id)) nuevo[k] = 'M'; });
    nuevo[id] = rol;
    fijar(nuevo);
  };

  /** Nadie hace de `rol` (la placa que lo tenía vuelve a mando). */
  const quitar = (rol) => {
    const nuevo = { ...rolesRef.current };
    Object.keys(nuevo).forEach((k) => { if (nuevo[k] === rol) nuevo[k] = 'M'; });
    fijar(nuevo);
  };

  /** Reparto automático entre las placas encendidas: S1, S2, S3, instrumento y S4 (por número). */
  const repartir = () => {
    const ids = Object.keys(vistas).map(Number).sort((a, b) => a - b);
    const orden = ['S1', 'S2', 'S3', 'I', 'S4'];
    const nuevo = {};
    ids.forEach((id, i) => { nuevo[id] = orden[i] || 'M'; });
    fijar(nuevo);
  };

  return { roles, vistas, asignar, quitar, repartir, buscar };
}
