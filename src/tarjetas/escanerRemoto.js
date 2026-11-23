// 📱 El móvil del profe como cámara de las tarjetas.
// La pizarra (QuizTarjetas) crea una sesión en live_games/{codigo} y enseña un QR;
// el móvil abre pikt.es/?escaner=CODIGO, lee las tarjetas con su cámara y escribe
// las lecturas en el mismo documento. No se sube ninguna imagen: solo «tarjeta → letra».
//
// Documento live_games/{codigo}:
//   tipoJuego: 'TARJETAS_ESCANER', codigo, createdAt
//   fase: 'lobby' | 'pregunta' | 'resultado' | 'final'   (lo escribe la pizarra)
//   ronda: 0 en la sala, n.º de pregunta (1…) después   (lo escribe la pizarra)
//   nOpciones, maxTarjeta, indice, total, texto, respondidas, presentes
//   (sin nombres de alumnos: live_games es de lectura abierta)
//   lecturas: { [tarjeta]: { l: 'A'…'D', r: ronda } }   (lo escribe el móvil; la pizarra
//             lo vacía al cambiar de ronda y descarta las que no sean de la ronda actual)
//   movil: ms del último latido del móvil
//   orden: { tipo: 'empezar' | 'corregir' | 'siguiente', t }   (botones del móvil)
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

export const TIPO_ESCANER = 'TARJETAS_ESCANER';
const ref = (codigo) => doc(db, 'live_games', codigo);

// Sin letras ni números que se confundan (0/O, 1/I/L)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codigoAzar = () => 'T' + Array.from({ length: 4 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');

export const urlEscaner = (codigo) => `${window.location.origin}/?escaner=${encodeURIComponent(codigo)}`;

/** Crea la sesión (sin pisar una sala que ya exista) y devuelve el código. */
export async function crearSesionEscaner(datos) {
  for (let i = 0; i < 6; i++) {
    const codigo = codigoAzar();
    const snap = await getDoc(ref(codigo));
    if (snap.exists()) continue;
    await setDoc(ref(codigo), { tipoJuego: TIPO_ESCANER, codigo, createdAt: serverTimestamp(), fase: 'lobby', ronda: 0, lecturas: {}, movil: 0, orden: null, ...datos });
    return codigo;
  }
  throw new Error('No se pudo crear la sesión');
}

export const escucharSesion = (codigo, fn, onError) =>
  onSnapshot(ref(codigo), (s) => fn(s.exists() ? s.data() : null), (e) => onError?.(e));

export const actualizarSesion = (codigo, datos) => updateDoc(ref(codigo), datos).catch(() => {});
export const cerrarSesion = (codigo) => deleteDoc(ref(codigo)).catch(() => {});

/** Móvil: envía varias lecturas de golpe (campos con punto → no pisa las de otras tarjetas). */
export function enviarLecturas(codigo, lecturas, ronda) {
  const datos = { movil: Date.now() };
  for (const { tarjeta, letra } of lecturas) datos[`lecturas.${tarjeta}`] = { l: letra, r: ronda };
  return updateDoc(ref(codigo), datos);
}

export const latidoMovil = (codigo) => updateDoc(ref(codigo), { movil: Date.now() }).catch(() => {});
// `t` solo sirve para distinguir una orden de la anterior (los relojes del móvil y del
// ordenador pueden no coincidir: la pizarra mide la conexión con su propio reloj).
export const ordenMovil = (codigo, tipo) => updateDoc(ref(codigo), { orden: { tipo, t: Date.now() }, movil: Date.now() }).catch(() => {});
