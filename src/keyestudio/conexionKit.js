// Conexión del Laboratorio Smart Home: una sola fuente de datos para todos los experimentos.
//   fuente 'sim'   → casa simulada (sliders para los sensores; el ventilador enfría, la lámpara
//                    ilumina según la distancia…), para probar sin placa.
//   fuente 'placa' → ESP32 o micro:bit por USB (Web Serial). Se le envía programasKit.js por el
//                    raw REPL y se ejecuta en RAM (no se borra el main.py de la placa).
// Estado global (como la antena de los mandos) + suscriptores: useKit() en useKit.js.

import { PLACAS } from './placasKit';
import { programaEsp32, programaMicrobit } from './programasKit';

const ENC = new TextEncoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const soportaSerial = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const ERROR_SIN_MICROPYTHON = 'SIN_MICROPYTHON';
const FIRMWARE_ESP32 = '/firmware/esp32-micropython-v1.29.0.bin';

const NEGRO = [0, 0, 0];
const SALIDAS_INICIALES = {
  puerta: 0, ventana: 0, vent: 0, led: 0, led2: 0, rgb: NEGRO, rgbs: [NEGRO, NEGRO, NEGRO, NEGRO],
  lcd: ['PiKT Smart Home', 'Laboratorio'], lcdLuz: 1, // lo mismo que pinta la placa al arrancar
};

/** Texto que entiende la LCD1602: sin tildes, ASCII, 16 caracteres; «°» viaja como «`». */
export const textoLCD = (t) => String(t ?? '')
  .replace(/°/g, '`').replace(/[¿]/g, '?').replace(/[¡]/g, '!').replace(/€/g, 'E')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\x20-\x7e]/g, '?').slice(0, 16);

let snap = {
  fuente: 'sim',
  placa: 'esp32',
  estado: 'desconectada', // 'conectando' | 'conectada' | 'error'
  mensaje: '',
  lectura: null,          // { temp, hum, luz, vapor, suelo, gas, pir, boton1, boton2, t }
  salidas: { ...SALIDAS_INICIALES },
  reaccion: 'parada',     // 'esperando' | 'encendido' (solo para pintar el LED del gemelo)
};
const oyentesEstado = new Set();
const oyentesEventos = new Set();
const cambiar = (parcial) => { snap = { ...snap, ...parcial }; oyentesEstado.forEach((fn) => fn()); };
const emitir = (ev) => oyentesEventos.forEach((fn) => { try { fn(ev); } catch { /* oyente roto */ } });

export const getSnap = () => snap;
export function suscribir(fn) { oyentesEstado.add(fn); return () => oyentesEstado.delete(fn); }
/** Eventos: { tipo: 'K', lectura } en cada lectura · { tipo: 'R', ms } al acabar un tiempo de reacción ·
 *  { tipo: 'C', orden, valor } cada vez que se manda una orden a la placa. */
export function escuchar(fn) { oyentesEventos.add(fn); return () => oyentesEventos.delete(fn); }

/* ── Órdenes (puerta, ventana, ventilador, LED, RGB, zumbador, reacción) ── */

export function enviar(orden, valor) {
  const s = { ...snap.salidas };
  let linea;
  if (orden === 'rgb') { s.rgb = valor; s.rgbs = [valor, valor, valor, valor]; linea = `C:rgb:${valor.join(',')}`; }
  else if (orden === 'rgbi') { const [i, ...c] = valor; s.rgbs = s.rgbs.map((v, k) => (k === i ? c : v)); linea = `C:rgbi:${valor.join(',')}`; }
  else if (orden === 'lcd') { const [fila, txt] = valor; const t = textoLCD(txt); s.lcd = s.lcd.map((v, k) => (k === fila ? t : v)); linea = `C:lcd:${fila},${t}`; }
  else if (orden === 'lcdBorrar') { s.lcd = ['', '']; linea = 'C:lcdb'; }
  else if (orden === 'lcdLuz') { s.lcdLuz = valor ? 1 : 0; linea = `C:lcdl:${valor ? 1 : 0}`; }
  else if (orden === 'pita') { linea = `C:pita:${Math.round(valor[0])},${Math.round(valor[1])}`; }
  else if (orden === 'reac') { linea = 'C:reac'; s.led = 0; }
  else { s[orden] = Math.round(valor); linea = `C:${orden}:${Math.round(valor)}`; }
  cambiar({ salidas: s });
  emitir({ tipo: 'C', orden, valor }); // p. ej. el gemelo 3D anima el zumbador al pitar
  if (orden === 'reac') iniciarReaccion();
  if (snap.fuente === 'placa' && con) con.escribir(linea + '\n').catch(() => {});
  else if (orden === 'pita') pitarNavegador(valor[0], valor[1]);
}

let audio = null;
function pitarNavegador(hz, ms) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = hz; g.gain.value = 0.08;
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + ms / 1000);
  } catch { /* sin audio */ }
}

/* ── Simulación ── */

let sim = { gas: 0, vapor: 0, suelo: 45, pir: 0, boton1: 0, boton2: 0, distanciaLuz: 0.5, luzAmbiente: 2, pot: 30, mic: 5 };
let simTemp = 22;
let simTimer = null;
let reac = null; // simulación del tiempo de reacción: { fase, t }
const ruido = (s) => (Math.random() * 2 - 1) * s;
const lim = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));

export const getSim = () => sim;
export function setSim(parcial) {
  sim = { ...sim, ...parcial };
  if (parcial.calentar) { simTemp = 34; delete sim.calentar; }
  if (parcial.boton1 === 1 && reac && snap.fuente === 'sim') pulsarReaccionSim();
  cambiar({}); // los paneles de simulación se repintan
}
/** Luz (%) que vería la fotorresistencia a d metros de la lámpara: inversa del cuadrado. */
export const luzSimulada = (d) => lim(sim.luzAmbiente + 3.6 / Math.max(0.05, d) ** 2);

function iniciarReaccion() {
  if (snap.fuente !== 'sim') return;
  reac = { fase: 1, t: performance.now() + 1500 + Math.random() * 2500 };
  cambiar({ reaccion: 'esperando' });
}
function pulsarReaccionSim() {
  if (reac.fase === 1) fin(-1);
  else fin(Math.round(performance.now() - reac.t));
  function fin(ms) { reac = null; cambiar({ reaccion: 'parada', salidas: { ...snap.salidas, led: 0 } }); emitir({ tipo: 'R', ms }); }
}

function pasoSim() {
  const dt = 0.25;
  const k = 0.012 * (1 + snap.salidas.vent / 30); // ley de enfriamiento de Newton
  simTemp += (22 - simTemp) * k * dt;
  const lectura = {
    temp: Math.round(simTemp + ruido(0.15)),
    tempExacta: simTemp,
    hum: Math.round(lim(48 + sim.vapor * 0.3 + ruido(0.8))),
    luz: lim(luzSimulada(sim.distanciaLuz) + ruido(0.6)),
    vapor: lim(sim.vapor + ruido(0.5)),
    suelo: lim(sim.suelo + ruido(0.5)),
    gas: lim(sim.gas + ruido(0.4)),
    pir: sim.pir, boton1: sim.boton1, boton2: sim.boton2,
    pot: sim.pot,
    mic: lim(sim.mic + Math.abs(ruido(2))),
    tempLM: Math.round((simTemp + ruido(0.2)) * 10) / 10,
    t: performance.now() / 1000,
  };
  if (reac) {
    if (reac.fase === 1 && performance.now() >= reac.t) { reac = { fase: 2, t: performance.now() }; cambiar({ reaccion: 'encendido', salidas: { ...snap.salidas, led: 1 } }); }
    else if (reac.fase === 2 && performance.now() - reac.t > 3000) { reac = null; cambiar({ reaccion: 'parada', salidas: { ...snap.salidas, led: 0 } }); emitir({ tipo: 'R', ms: -2 }); }
  }
  cambiar({ lectura });
  emitir({ tipo: 'K', lectura });
}

export function usarSimulacion() {
  if (simTimer) return;
  simTimer = setInterval(pasoSim, 250);
  pasoSim();
}
function pararSimulacion() { clearInterval(simTimer); simTimer = null; reac = null; }

/* ── Placa por USB ── */

class ConexionSerie {
  constructor(onTexto) { this.onTexto = onTexto; this.port = null; this.writer = null; this.reader = null; this.accum = ''; this.cerrando = false; this.onPerdida = null; }
  async abrir(port, { esp32 = false } = {}) {
    await port.open({ baudRate: 115200 });
    // ESP32: DTR y RTS a reposo para que el circuito de auto-reset no la deje reiniciando
    if (esp32) await port.setSignals({ dataTerminalReady: false, requestToSend: false }).catch(() => {});
    this.port = port;
    this.writer = port.writable.getWriter();
    this._leer();
  }
  async _leer() {
    const dec = new TextDecoder();
    const reader = this.port.readable.getReader();
    this.reader = reader;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) { const txt = dec.decode(value, { stream: true }); this.accum = (this.accum + txt).slice(-4000); this.onTexto?.(txt); }
      }
    } catch { /* desenchufada o cancelada */ } finally {
      try { reader.releaseLock(); } catch { /* ya liberado */ }
      this.reader = null;
      if (!this.cerrando) { await this.cerrar(); this.onPerdida?.(); }
    }
  }
  async escribir(str) { if (this.writer) await this.writer.write(ENC.encode(str)); }
  esperar(re, timeout = 3000) {
    return new Promise((resolve) => {
      const inicio = Date.now();
      const tick = () => { const m = this.accum.match(re); if (m) return resolve(m); if (Date.now() - inicio > timeout) return resolve(null); setTimeout(tick, 50); };
      tick();
    });
  }
  async cerrar() {
    this.cerrando = true;
    try {
      if (this.reader) await this.reader.cancel().catch(() => {});
      if (this.writer) { await this.writer.close().catch(() => {}); try { this.writer.releaseLock(); } catch { /* ya liberado */ } this.writer = null; }
      await sleep(60);
      if (this.port) await this.port.close().catch(() => {});
    } finally { this.port = null; }
  }
}

let con = null;
let pendiente = '';
let ultimoError = '';

function normalizar(campos, placa) {
  // Los 3 últimos (potenciómetro, micrófono y LM35 en décimas de °C) solo los manda la versión ≥ 2
  const [t, h, luz, vap, sue, gas, pir, b1, b2, pot = -1, mic = -1, lm35 = -1] = campos;
  const { adcMax: max, esp32 } = PLACAS[placa];
  const pc = (v) => (v < 0 ? null : lim((v / max) * 100));
  return {
    temp: t < 0 && h < 0 && esp32 ? null : t,
    hum: h < 0 ? null : h,
    luz: pc(luz), vapor: pc(vap), suelo: pc(sue),
    gas: gas < 0 ? null : esp32 ? gas * 100 : pc(gas),
    pot: pc(pot),
    mic: mic < 0 ? null : lim((mic / max) * 200), // pico a pico: la mitad del rango ya es muy fuerte
    tempLM: lm35 < 0 ? null : lm35 / 10,
    pir: pir < 0 ? null : pir, boton1: b1 < 0 ? null : b1, boton2: b2 < 0 ? null : b2,
    t: performance.now() / 1000,
  };
}

function alTexto(txt) {
  pendiente += txt;
  let i;
  while ((i = pendiente.indexOf('\n')) >= 0) {
    const linea = pendiente.slice(0, i).replace(/\r$/, '').replace(/^OK/, '');
    pendiente = pendiente.slice(i + 1);
    if (linea.startsWith('K:')) {
      const campos = linea.slice(2).split(',').map(Number);
      if (campos.length >= 9 && campos.every(Number.isFinite)) {
        const lectura = normalizar(campos, snap.placa);
        if (snap.estado !== 'conectada') cambiar({ estado: 'conectada', mensaje: '' });
        cambiar({ lectura });
        emitir({ tipo: 'K', lectura });
      }
    } else if (linea.startsWith('LCD:')) {
      cambiar({ lcdDir: Number(linea.slice(4)) || 0 });
    } else if (linea.startsWith('R:')) {
      emitir({ tipo: 'R', ms: Number(linea.slice(2)) });
    } else if (/Error|Traceback/.test(linea)) {
      ultimoError = linea.trim();
    }
  }
  if (pendiente.length > 2000) pendiente = '';
}

async function pedirPuerto(placa) {
  if (!soportaSerial()) throw new Error('Tu navegador no admite Web Serial. Usa Chrome o Edge en un ordenador.');
  const filtros = PLACAS[placa].usb;
  const ya = (await navigator.serial.getPorts()).find((p) => {
    const info = p.getInfo?.() || {};
    return filtros.some((f) => f.usbVendorId === info.usbVendorId);
  });
  if (ya) return ya;
  try { return await navigator.serial.requestPort({ filters: filtros }); }
  catch (e) {
    if (e?.name === 'NotFoundError') throw new Error('No se eligió ninguna placa.');
    throw e;
  }
}

/** Conecta la placa, le envía el programa del laboratorio y espera a que mande lecturas. */
export async function conectarPlaca({ placa, pines, elegirOtra = false }) {
  await desconectar();
  pararSimulacion();
  cambiar({ fuente: 'placa', placa, estado: 'conectando', mensaje: 'Abriendo el puerto…', lectura: null, lcdDir: null, salidas: { ...SALIDAS_INICIALES } });
  try {
    let port;
    if (elegirOtra) port = await navigator.serial.requestPort({ filters: PLACAS[placa].usb }).catch((e) => { throw e?.name === 'NotFoundError' ? new Error('No se eligió ninguna placa.') : e; });
    else port = await pedirPuerto(placa);
    con = new ConexionSerie(alTexto);
    const esp32 = !!PLACAS[placa].esp32;
    try { await con.abrir(port, { esp32 }); }
    catch (e) {
      con = null;
      throw new Error(e?.name === 'InvalidStateError'
        ? 'Ese puerto ya lo está usando otra cosa: cierra ArduinoBlocks Connector, Thonny, Mind+ u otra pestaña de PiKT.'
        : 'No se pudo abrir el puerto: ' + (e?.message || e));
    }
    con.onPerdida = () => { con = null; cambiar({ estado: 'error', mensaje: 'Se ha perdido la conexión con la placa (¿se ha desenchufado?).' }); };
    if (esp32) {
      await sleep(900); // por si el puerto la ha reiniciado: deja que arranque
      // ¿Lleva ya el programa Arduino del laboratorio (public/firmware/laboratorio_smarthome.ino)?
      // Entonces habla el mismo protocolo: no hace falta MicroPython ni enviar nada.
      await con.escribir('?\n');
      if (await con.esperar(/KIT:arduino|(^|\n)K:-?\d+,/, 1500)) {
        cambiar({ estado: 'conectada', mensaje: '', modo: 'arduino' });
        return;
      }
    }
    cambiar({ mensaje: 'Enviando el programa del laboratorio…', modo: 'micropython' });
    for (let i = 0; i < 5; i++) { await con.escribir('\x03'); await sleep(80); }
    let enRaw = false;
    for (let i = 0; i < 3 && !enRaw; i++) {
      con.accum = '';
      await con.escribir(i === 0 ? '\r\x01' : '\r\x03\x03\x01');
      enRaw = !!(await con.esperar(/raw REPL/, 1500));
    }
    if (!enRaw) {
      const e = new Error(esp32
        ? 'La placa todavía tiene un programa de Arduino (el de fábrica o uno de ArduinoBlocks). Pulsa «⚡ Instalar MicroPython»: se hace desde aquí, tarda 1-2 minutos y después se conecta sola.'
        : 'La micro:bit no responde: no tiene MicroPython (pasa si antes usó MakeCode). Pulsa «⚡ Instalar MicroPython» y vuelve a conectar.');
      e.code = ERROR_SIN_MICROPYTHON;
      throw e;
    }
    const codigo = esp32 ? programaEsp32(pines) : programaMicrobit(pines);
    pendiente = ''; ultimoError = ''; con.accum = '';
    for (let i = 0; i < codigo.length; i += 128) { await con.escribir(codigo.slice(i, i + 128)); await sleep(12); }
    await con.escribir('\x04'); // Ctrl-D: ejecutar en RAM
    const ok = await con.esperar(/KIT:(esp32|mb):\d+/, 6000);
    if (!ok) throw new Error('La placa no ha arrancado el programa' + (ultimoError ? ': ' + ultimoError : '.') + ' Revisa los pines en «⚙️ Pines».');
    cambiar({ estado: 'conectada', mensaje: '' });
  } catch (e) {
    if (con) { await con.cerrar().catch(() => {}); con = null; }
    cambiar({ estado: 'error', mensaje: e.message || String(e) });
    throw e;
  }
}

/** Para el programa de la placa y libera el puerto (para usar otra herramienta). */
export async function desconectar() {
  if (!con) return;
  const c = con; con = null;
  try { await c.escribir('\x03'); await sleep(100); await c.escribir('\x03\x02'); await sleep(100); } catch { /* ya cerrada */ }
  await c.cerrar().catch(() => {});
  cambiar({ estado: 'desconectada', mensaje: '' });
}

/** Vuelve a la casa simulada (suelta la placa si estaba conectada). */
export async function volverASimulacion() {
  await desconectar();
  cambiar({ fuente: 'sim', estado: 'desconectada', mensaje: '', salidas: { ...SALIDAS_INICIALES } });
  usarSimulacion();
}

/** Un intento de tiempo de reacción con la placa: LED tras una espera al azar → ms hasta el botón 1
 *  (-1 se adelantó, -2 no pulsó a tiempo). Lo usa la competición de src/estadistica/ReaccionJugadores. */
export function medirReaccion() {
  return new Promise((resolve) => {
    const quitar = escuchar((ev) => { if (ev.tipo === 'R') { quitar(); resolve(ev.ms); } });
    enviar('reac');
  });
}

/** Placa elegida en «Conectar»: en simulación decide qué sensores y experimentos se ven. */
export function elegirPlacaKit(placa) {
  if (snap.fuente === 'sim' && snap.placa !== placa) cambiar({ placa });
}

/** Al salir del laboratorio: suelta la placa y para la simulación. */
export async function cerrarLaboratorio() {
  pararSimulacion();
  await desconectar();
  cambiar({ fuente: 'sim', estado: 'desconectada', mensaje: '', lectura: null, salidas: { ...SALIDAS_INICIALES } });
}

/* ── Instalar MicroPython ── */

/** ESP32 (chip clásico): borra la memoria y graba MicroPython con esptool-js. onProgreso(0-100). */
export async function instalarMicropythonEsp32(onProgreso, onLog = () => {}) {
  if (!soportaSerial()) throw new Error('Tu navegador no admite Web Serial. Usa Chrome o Edge en un ordenador.');
  await desconectar();
  // bundle.js y no 'esptool-js': la entrada normal carga los «stubs» de cada chip con import()
  // dinámicos de JSON que el pre-empaquetado de Vite rompe; el bundle los lleva dentro.
  const [{ ESPLoader, Transport }, resp] = await Promise.all([import('esptool-js/bundle.js'), fetch(FIRMWARE_ESP32)]);
  if (!resp.ok) throw new Error('No se pudo descargar el firmware de MicroPython.');
  const bin = new Uint8Array(await resp.arrayBuffer());
  let port;
  try { port = await navigator.serial.requestPort({ filters: PLACAS.esp32.usb }); }
  catch (e) { throw new Error(e?.name === 'NotFoundError' ? 'No se eligió ninguna placa.' : e?.message || String(e)); }
  const transport = new Transport(port, false);
  const terminal = { clean() {}, writeLine: (s) => onLog(s), write: (s) => onLog(s) };
  try {
    const loader = new ESPLoader({ transport, baudrate: 460800, romBaudrate: 115200, terminal });
    onLog('Conectando con el chip (si no responde, mantén pulsado el botón BOOT de la placa)…');
    const chip = await loader.main();
    onLog('Chip: ' + chip);
    if (loader.chip?.CHIP_NAME !== 'ESP32') throw new Error(`Esta placa es un ${loader.chip?.CHIP_NAME || 'chip desconocido'}, no una ESP32 clásica: necesita otro firmware de MicroPython.`);
    onLog('Borrando la memoria y grabando MicroPython (1-2 minutos)…');
    await loader.writeFlash({
      fileArray: [{ data: bin, address: 0x1000 }],
      flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep', eraseAll: true, compress: true,
      reportProgress: (_i, escrito, total) => onProgreso?.(Math.round((escrito / total) * 100)),
    });
    await loader.after('hard_reset');
    onLog('¡Listo! MicroPython instalado.');
  } catch (e) {
    const msg = e?.message || String(e);
    // Probado con la ESP32 del kit montada en la casa: el reset automático funciona (IO0 baja), pero
    // algo del montaje mantiene IO2 en alto y el chip arranca en HSPI_FLASH_BOOT en vez de en descarga.
    if (/Failed to connect/i.test(msg)) {
      throw new Error('No se pudo instalar MicroPython: la placa no entra en modo de programación porque el pin IO2 está en alto. En la Imagina TdR STEAM: gira el potenciómetro a cero (la flecha al punto rojo) y pon el interruptor de Bluetooth hacia el borde de la placa. En otras placas: desconecta lo que vaya a IO2, IO12 o IO15. Después vuelve a pulsar «⚡ Instalar MicroPython».');
    }
    throw new Error('No se pudo instalar MicroPython: ' + msg + '. Prueba otro cable USB (de datos) o mantén pulsado BOOT al empezar.');
  } finally {
    await transport.disconnect().catch(() => {});
  }
}

/** micro:bit: el mismo instalador de los mandos (WebUSB). */
export async function instalarMicropythonMicrobit(onProgreso) {
  await desconectar();
  const { flashearMicropython } = await import('../mandos/mandosMicrobit.js');
  return flashearMicropython(onProgreso);
}
