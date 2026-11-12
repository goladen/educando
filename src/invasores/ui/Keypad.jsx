// Teclado virtual de la variante 1. Tres modos según la pregunta:
//   numerico → 0-9, ±, coma, DEL, CLR     opciones → botones A-D     letras → QWERTY con Ñ
// Todos los botones usan onPointerDown (no onClick) para que varios alumnos pulsen a la vez.
import React, { memo } from 'react';
import { BTN } from '../tema';

const ALTO = 'min-h-[clamp(38px,6.6vh,64px)]';
// tabIndex -1 + mousedown sin foco: si un botón se queda con el foco, el Intro/Espacio del
// otro jugador (su FUEGO en el teclado) lo «pulsaría» y le robaría la jugada.
const press = (fn) => ({
  tabIndex: -1,
  onPointerDown: (e) => { e.preventDefault(); fn(); },
  onMouseDown: (e) => e.preventDefault(),
  onContextMenu: (e) => e.preventDefault(),
});

function BotonFuego({ onFuego, deshabilitado }) {
  return (
    <button type="button" disabled={deshabilitado} {...press(onFuego)}
      className={`${BTN.fuego} ${ALTO} col-span-full text-[length:clamp(12px,2.6vh,20px)] tracking-widest`}>
      ▲ FUEGO
    </button>
  );
}

function Numerico({ onTecla, onFuego, deshabilitado, conComa }) {
  const t = (k, clase = BTN.tecla, extra = '') => (
    <button key={k} type="button" disabled={deshabilitado} {...press(() => onTecla(k))}
      className={`${clase} ${ALTO} text-[length:clamp(13px,2.8vh,22px)] ${extra}`}>{k}</button>
  );
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      {t('7')}{t('8')}{t('9')}{t('DEL', BTN.del, 'text-[length:clamp(9px,1.8vh,14px)]')}
      {t('4')}{t('5')}{t('6')}{t('CLR', BTN.borrar, 'text-[length:clamp(9px,1.8vh,14px)]')}
      {t('1')}{t('2')}{t('3')}{t('±')}
      {t('0', BTN.tecla, conComa ? 'col-span-2' : 'col-span-3')}
      {conComa && t(',')}
      {conComa && <span />}
      <BotonFuego onFuego={onFuego} deshabilitado={deshabilitado} />
    </div>
  );
}

function Opciones({ opciones, entrada, onTecla, onFuego, deshabilitado }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
      {opciones.map((o, k) => (
        <button key={`${k}-${o}`} type="button" disabled={deshabilitado} {...press(() => onTecla({ elegir: o }))}
          className={`${BTN.tecla} ${ALTO} flex items-center gap-2 px-2 text-left ${entrada === o ? 'bg-yellow-300! text-slate-950! ring-4 ring-yellow-200' : ''}`}>
          <span className={`font-arcade text-[10px] ${entrada === o ? 'text-slate-900' : 'text-yellow-300'}`}>{'ABCD'[k]}</span>
          <span className="font-pixel text-[length:clamp(17px,3vh,28px)] leading-none break-words">{o}</span>
        </button>
      ))}
      <BotonFuego onFuego={onFuego} deshabilitado={deshabilitado || !entrada} />
    </div>
  );
}

const FILAS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];

function Letras({ onTecla, onFuego, deshabilitado, conNumeros }) {
  const t = (k, clase = BTN.tecla, extra = '') => (
    <button key={k} type="button" disabled={deshabilitado} {...press(() => onTecla(k === 'ESPACIO' ? ' ' : k))}
      className={`${clase} min-h-[clamp(30px,5vh,48px)] px-0 text-[length:clamp(9px,1.7vh,14px)] ${extra}`}>{k === 'ESPACIO' ? '␣' : k}</button>
  );
  return (
    <div className="flex flex-col gap-1">
      {conNumeros && <div className="grid grid-cols-10 gap-1">{'1234567890'.split('').map((k) => t(k))}</div>}
      {FILAS.map((f, i) => (
        <div key={f} className={`grid gap-1 ${i === 2 ? 'grid-cols-[repeat(7,1fr)_2fr]' : 'grid-cols-10'}`}>
          {f.split('').map((k) => t(k))}
          {i === 2 && t('DEL', BTN.del)}
        </div>
      ))}
      <div className="grid grid-cols-[3fr_1fr] gap-1">{t('ESPACIO')}{t('CLR', BTN.borrar)}</div>
      <div className="grid"><BotonFuego onFuego={onFuego} deshabilitado={deshabilitado} /></div>
    </div>
  );
}

export default memo(function Keypad({ modo, opciones, entrada, onTecla, onFuego, deshabilitado, pregunta }) {
  if (modo === 'opciones') {
    return <Opciones opciones={opciones || []} entrada={entrada} onTecla={onTecla} onFuego={onFuego} deshabilitado={deshabilitado} />;
  }
  if (modo === 'letras') {
    return <Letras onTecla={onTecla} onFuego={onFuego} deshabilitado={deshabilitado} conNumeros={/\d/.test(pregunta?.correcta || '')} />;
  }
  return <Numerico onTecla={onTecla} onFuego={onFuego} deshabilitado={deshabilitado} conComa={/[.,]/.test(pregunta?.correcta || '')} />;
});
