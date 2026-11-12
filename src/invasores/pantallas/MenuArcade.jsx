// Menú de configuración: variante, contenido (cálculo rápido, Math World, materias o recurso),
// jugadores y ajustes. Estética arcade, botones grandes para pizarra.
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import PanelMandos from './PanelMandos';
import { VARIANTES } from '../variantes';
import { OPERACIONES_RAPIDAS, BANCOS, hojasDeRecurso, desdeRecurso, jugables } from '../preguntas';
import { BTN, chip, PANEL, TITULO_NEON, NEON, COLORES_JUGADOR } from '../tema';
import { AlienSVG, NaveSVG } from '../ui/Sprites';
import BuscadorRecursos from './BuscadorRecursos';
import ModalPdf from './ModalPdf';

// Los generadores de Math World pesan: solo se cargan al abrir esa pestaña
const SelectorMatesMandos = lazy(() => import('../../mandos/SelectorMatesMandos.jsx'));

const FUENTES = [
  { id: 'RAPIDAS', nombre: '⚡ CÁLCULO RÁPIDO' },
  { id: 'MATES', nombre: '📐 MATH WORLD' },
  { id: 'BANCO', nombre: '📚 MATERIAS' },
  { id: 'RECURSO', nombre: '🔎 RECURSO DEL PROFE' },
];

function Seccion({ n, titulo, children }) {
  return (
    <section className={`${PANEL} flex flex-col gap-3`}>
      <h2 className="font-arcade text-[10px] text-amber-300 sm:text-xs"><span className="text-slate-500">{n}.</span> {titulo}</h2>
      {children}
    </section>
  );
}

function TarjetaVariante({ v, activa, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-3 rounded-xl border-4 p-4 text-center transition-all ${activa
        ? 'border-cyan-300 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.45)]'
        : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}`}>
      <div className="flex h-14 items-end justify-center gap-2">
        {v.id === 'DISPARA' ? (
          <>
            <AlienSVG sprite={0} color="#f472b6" className="h-9 w-12" />
            <span className="font-pixel text-3xl text-cyan-200">7×8=?</span>
          </>
        ) : (
          ['15', '20', '24'].map((t, k) => (
            <div key={t} className="flex flex-col items-center">
              <AlienSVG sprite={k} color={['#f472b6', '#4ade80', '#60a5fa'][k]} className="h-7 w-9" />
              <span className="font-pixel text-xl leading-none text-slate-100">{t}</span>
            </div>
          ))
        )}
      </div>
      <NaveSVG color={activa ? '#22d3ee' : '#64748b'} className="h-6 w-10" />
      <div className={`font-arcade text-[10px] sm:text-xs ${activa ? 'text-cyan-200' : 'text-slate-300'}`}>{v.emoji} {v.nombre.toUpperCase()}</div>
      <p className="font-pixel text-lg leading-tight text-slate-400">{v.resumen}</p>
    </button>
  );
}

/** Fila de aliens que marcha en la cabecera (pantalla de título de recreativa). */
function DesfileAliens() {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF((x) => x + 1), 500); return () => clearInterval(t); }, []);
  const dx = [0, 6, 12, 6][f % 4];
  return (
    <div className="flex justify-center gap-3 overflow-hidden sm:gap-5" style={{ transform: `translateX(${dx - 6}px)` }}>
      {['#f472b6', '#4ade80', '#60a5fa', '#facc15', '#c084fc', '#fb923c', '#22d3ee'].map((c, k) => (
        <AlienSVG key={c} sprite={k % 3} frame={(f + k) % 2} color={c} className="h-6 w-8 sm:h-8 sm:w-11" />
      ))}
    </div>
  );
}

/** Partida vinculada a una ficha PDF impresa (mismas preguntas, mismo orden). */
function BannerFicha({ ficha, onQuitar }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border-2 border-fuchsia-400 bg-fuchsia-500/10 p-3 shadow-[0_0_18px_rgba(232,121,249,0.35)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-arcade text-[10px] text-fuchsia-300 sm:text-xs">🖨️ VINCULADA A LA FICHA PDF</span>
        <span className="flex-1" />
        <button type="button" onClick={onQuitar} className={`${BTN.menu} text-[9px]`}>✕ DESVINCULAR</button>
      </div>
      <span className="font-pixel text-2xl leading-tight text-slate-100">{ficha.titulo || 'Preguntas de la ficha'}</span>
      <span className="font-pixel text-lg leading-tight text-slate-400">
        Salen las {ficha.preguntas.length} preguntas de la ficha en el mismo orden (#01, #02…). Si se acaban, vuelven a empezar.
        Para jugar con otro contenido, desvincula o elige otro modo.
      </span>
    </div>
  );
}

/** Fichas descargadas en este equipo: un toque y la partida queda vinculada otra vez. */
function FichasImpresas({ fichas, cargando, onAbrir, onOlvidar }) {
  if (!fichas?.length) return null;
  return (
    <div className="flex flex-col gap-2 border-t-2 border-slate-800 pt-3">
      <span className="font-arcade text-[9px] text-slate-400">🖨️ ¿YA LA IMPRIMISTE? JUEGA LAS PREGUNTAS DE UNA FICHA (MISMO ORDEN)</span>
      <div className="flex flex-wrap gap-2">
        {fichas.map((f) => (
          <span key={f.codigo} className="flex items-stretch">
            <button type="button" disabled={cargando} onClick={() => onAbrir(f.codigo)}
              title={`Descargada el ${new Date(f.fecha).toLocaleDateString()}`}
              className={`${chip(false)} rounded-r-none disabled:opacity-50`}>
              {f.titulo || 'Ficha'} · {f.n}
            </button>
            <button type="button" onClick={() => onOlvidar(f.codigo)} title="Quitar de la lista"
              className={`${chip(false)} rounded-l-none border-l-0 px-2`}>✕</button>
          </span>
        ))}
      </div>
      {cargando && <span className="font-pixel text-lg text-amber-300">Cargando la ficha…</span>}
    </div>
  );
}

export default function MenuArcade({
  config, setConfig, maxJugadores, pantallaJusta = false, apiMatesRef, onJugar, onRapida, onSalir, error, ctrlMandos, onPdf, maxPreguntasPdf,
  fichas = [], cargandoFicha = false, onAbrirFicha, onQuitarFicha, onOlvidarFicha,
}) {
  const [buscando, setBuscando] = useState(false);
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const { variante, fuente, ficha } = config;
  const setFuente = (patch) => setConfig({ fuente: { ...fuente, ...patch } });
  const cambiarTipo = (tipo) => {
    if (tipo === fuente.tipo) return;
    if (tipo === 'RAPIDAS') setConfig({ fuente: { tipo, operaciones: ['suma', 'resta'], nivel: 1 } });
    else if (tipo === 'BANCO') setConfig({ fuente: { tipo, clave: 'INGLES' } });
    else if (tipo === 'RECURSO') { setConfig({ fuente: { tipo, recurso: null } }); setBuscando(true); }
    else setConfig({ fuente: { tipo } });
  };
  const alternarOp = (id) => {
    const ops = fuente.operaciones || [];
    const nuevas = ops.includes(id) ? ops.filter((o) => o !== id) : [...ops, id];
    setFuente({ operaciones: nuevas.length ? nuevas : [id] });
  };
  // Hojas del recurso con cuántas preguntas sirven en la variante elegida
  const hojasRecurso = useMemo(() => (fuente.tipo === 'RECURSO' && fuente.recurso
    ? hojasDeRecurso(fuente.recurso)
      .map((h) => ({ ...h, n: jugables(desdeRecurso(fuente.recurso, [h.indice]), variante).length }))
    : []), [fuente.tipo, fuente.recurso, variante]);
  const hojasSel = fuente.hojas || [];
  const alternarHoja = (i) => {
    const nuevas = hojasSel.includes(i) ? hojasSel.filter((x) => x !== i) : [...hojasSel, i];
    setFuente({ hojas: nuevas.length && nuevas.length < hojasRecurso.length ? nuevas : null });
  };
  const n = Math.min(config.numJugadores, maxJugadores);
  const permiteEscribir = variante === 'DISPARA' && (fuente.tipo === 'BANCO' || fuente.tipo === 'RECURSO');

  return (
    <div className="inv-estrellas min-h-0 w-full flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:py-8">
        <header className="flex items-center justify-between gap-3">
          <button type="button" onClick={onSalir} className={`${BTN.menu} text-[10px]`}>← SALIR</button>
          <h1 className={`${TITULO_NEON} text-center text-lg sm:text-3xl`}>INVASIÓN <span className="text-fuchsia-300 drop-shadow-[0_0_8px_rgba(232,121,249,0.9)]">π</span></h1>
          <span className="w-[72px]" />
        </header>
        <DesfileAliens />
        <p className="text-center font-pixel text-xl text-slate-300 sm:text-2xl">
          Los aliens invaden la Tierra… <span className="text-cyan-300">¡solo los detiene quien sabe la respuesta!</span>
        </p>
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={onRapida} className={`${BTN.fuego} px-6 py-4 text-xs sm:text-sm`}>⚡ PARTIDA RÁPIDA</button>
          <span className="font-pixel text-lg text-slate-500">Sumas y restas, 1 jugador… ¡ya! (o configúralo abajo a tu gusto)</span>
        </div>

        <Seccion n={1} titulo="MODO DE JUEGO">
          <div className="flex flex-col gap-3 sm:flex-row">
            {Object.values(VARIANTES).map((v) => (
              <TarjetaVariante key={v.id} v={v} activa={variante === v.id} onClick={() => setConfig({ variante: v.id })} />
            ))}
          </div>
        </Seccion>

        <Seccion n={2} titulo="¿QUÉ SE PREGUNTA?">
          {ficha && <BannerFicha ficha={ficha} onQuitar={onQuitarFicha} />}
          {cargandoFicha && !ficha && <p className="font-pixel text-2xl text-amber-300">🖨️ Cargando las preguntas de la ficha…</p>}
          {!ficha && (<>
          <div className="flex flex-wrap gap-2">
            {FUENTES.map((f) => (
              <button key={f.id} type="button" onClick={() => cambiarTipo(f.id)} className={chip(fuente.tipo === f.id)}>{f.nombre}</button>
            ))}
          </div>

          {fuente.tipo === 'RAPIDAS' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {OPERACIONES_RAPIDAS.map((o) => (
                  <button key={o.id} type="button" onClick={() => alternarOp(o.id)} className={chip(fuente.operaciones?.includes(o.id))}>
                    {o.emoji} {o.nombre.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-arcade text-[9px] text-slate-400">DIFICULTAD</span>
                {[[1, 'FÁCIL'], [2, 'MEDIA'], [3, 'DIFÍCIL']].map(([k, t]) => (
                  <button key={k} type="button" onClick={() => setFuente({ nivel: k })} className={chip(fuente.nivel === k)}>{t}</button>
                ))}
              </div>
            </div>
          )}

          {fuente.tipo === 'MATES' && (
            <div className="rounded-lg border-2 border-slate-700 bg-slate-950/60 p-3">
              <p className="mb-2 font-pixel text-lg leading-tight text-slate-400">
                {variante === 'DISPARA'
                  ? 'Ejercicios de las fichas de Math World con resultado entero: se responden con el teclado numérico.'
                  : 'Ejercicios de las fichas de Math World: cada respuesta posible viaja en una nave.'}
              </p>
              <Suspense fallback={<p className="font-arcade text-[10px] text-slate-400">CARGANDO EJERCICIOS…</p>}>
                <SelectorMatesMandos numerico={variante === 'DISPARA'} apiRef={apiMatesRef} temasIniciales={fuente.temas} nivelInicial={fuente.nivel} />
              </Suspense>
            </div>
          )}

          {fuente.tipo === 'BANCO' && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(BANCOS).map(([k, b]) => (
                <button key={k} type="button" onClick={() => setFuente({ clave: k })} className={chip(fuente.clave === k)}>
                  {b.emoji} {b.nombre.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {fuente.tipo === 'RECURSO' && (
            <div className="flex flex-wrap items-center gap-3">
              {fuente.recurso
                ? <span className="font-pixel text-2xl text-cyan-200">📘 {fuente.recurso.titulo || 'Recurso'}</span>
                : <span className="font-pixel text-xl text-slate-400">Elige un recurso público o escribe su código.</span>}
              <button type="button" onClick={() => setBuscando(true)} className={`${BTN.menu} text-[10px]`}>
                {fuente.recurso ? 'CAMBIAR' : 'BUSCAR RECURSO'}
              </button>
            </div>
          )}

          {fuente.tipo === 'RECURSO' && hojasRecurso.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="font-arcade text-[9px] text-slate-400">📑 HOJAS CON LAS QUE SE JUEGA</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setFuente({ hojas: null })} className={chip(!hojasSel.length)}>
                  TODAS ({hojasRecurso.reduce((s, h) => s + h.n, 0)})
                </button>
                {hojasRecurso.map((h) => (
                  <button key={h.indice} type="button" disabled={!h.n} onClick={() => alternarHoja(h.indice)}
                    title={h.n ? '' : 'Esta hoja no tiene preguntas que sirvan en este modo'}
                    className={`${chip(hojasSel.includes(h.indice))} disabled:cursor-not-allowed disabled:opacity-30`}>
                    {h.nombre} ({h.n})
                  </button>
                ))}
              </div>
              <span className="font-pixel text-lg text-slate-500">Pulsa una o varias hojas; sin elegir ninguna se juega con todas.</span>
            </div>
          )}

          <FichasImpresas fichas={fichas} cargando={cargandoFicha} onAbrir={onAbrirFicha} onOlvidar={onOlvidarFicha} />
          </>)}

          {permiteEscribir && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-arcade text-[9px] text-slate-400">RESPONDER</span>
              <button type="button" onClick={() => setConfig({ escribir: false })} className={chip(!config.escribir)}>ELEGIR A-D</button>
              <button type="button" onClick={() => setConfig({ escribir: true })} className={chip(config.escribir)}>⌨️ ESCRIBIR</button>
            </div>
          )}
        </Seccion>

        <Seccion n={3} titulo="JUGADORES">
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4].map((k) => (
              <button key={k} type="button" disabled={k > maxJugadores} onClick={() => setConfig({ numJugadores: k })}
                title={k > maxJugadores ? 'La pantalla es demasiado pequeña para tantos jugadores' : ''}
                className={`${chip(n === k)} min-w-[52px] disabled:cursor-not-allowed disabled:opacity-30`}>{k}P</button>
            ))}
            {maxJugadores < 4 && (
              <span className="font-pixel text-lg text-slate-500">
                {maxJugadores === 1 ? 'En el móvil se juega de 1 en 1.' : 'Hasta 4 jugadores en un ordenador, pizarra o proyector.'}
              </span>
            )}
            {maxJugadores === 4 && pantallaJusta && n >= 3 && (
              <span className="font-pixel text-lg text-amber-300">Pantalla justa: pon el navegador a pantalla completa (F11) para que cada zona se vea más grande.</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: n }, (_, i) => {
              const c = NEON[COLORES_JUGADOR[i]];
              return (
                <label key={i} className={`flex items-center gap-2 rounded-md border-2 ${c.borde} bg-slate-950/70 px-2 py-1.5`}>
                  <NaveSVG color={c.hex} className="h-5 w-8 shrink-0" />
                  <input value={config.nombres[i]} maxLength={14}
                    onChange={(e) => { const nombres = [...config.nombres]; nombres[i] = e.target.value; setConfig({ nombres }); }}
                    className={`min-w-0 flex-1 bg-transparent font-arcade text-[11px] outline-none ${c.text}`} />
                </label>
              );
            })}
          </div>
          {n > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-arcade text-[9px] text-slate-400">MODO</span>
              <button type="button" onClick={() => setConfig({ modo: 'competitivo' })} className={chip(config.modo === 'competitivo')}>⚔️ COMPETIR</button>
              <button type="button" onClick={() => setConfig({ modo: 'cooperativo' })} className={chip(config.modo === 'cooperativo')}>🤝 COOPERAR</button>
              <span className="font-pixel text-lg text-slate-500">
                {config.modo === 'cooperativo' ? 'Vidas compartidas: si el equipo se queda sin vidas, se acaba.' : 'Todos reciben las mismas preguntas; gana quien sume más puntos.'}
              </span>
            </div>
          )}
        </Seccion>

        <Seccion n={4} titulo="🎮 MANDOS MICRO:BIT (OPCIONAL)">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setConfig({ mandos: false })} className={chip(!config.mandos)}>📱 PANTALLA / TECLADO</button>
            <button type="button" onClick={() => setConfig({ mandos: true })} className={chip(config.mandos)}>🎮 CON MANDOS MICRO:BIT</button>
            {!config.mandos && <span className="font-pixel text-lg text-slate-500">Con la antena USB, cada zona se juega con un mando (Chrome o Edge).</span>}
          </div>
          {config.mandos && ctrlMandos && (
            <PanelMandos ctrl={ctrlMandos} config={config} setConfig={setConfig} numJugadores={n}
              permiteNumero={fuente.tipo === 'RAPIDAS' || fuente.tipo === 'MATES'} />
          )}
        </Seccion>

        <Seccion n={5} titulo="AJUSTES">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-arcade text-[9px] text-slate-400">VIDAS</span>
            {[3, 5, 7].map((v) => <button key={v} type="button" onClick={() => setConfig({ vidas: v })} className={chip(config.vidas === v)}>{v} ♥</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-arcade text-[9px] text-slate-400">TIEMPO</span>
            {[[0, 'LIBRE'], [120, '2 MIN'], [180, '3 MIN'], [300, '5 MIN']].map(([v, t]) => (
              <button key={v} type="button" onClick={() => setConfig({ duracion: v })} className={chip(config.duracion === v)}>{t}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-arcade text-[9px] text-slate-400">VELOCIDAD</span>
            {[[0.7, '🐢 LENTA'], [1, 'NORMAL'], [1.35, '🚀 RÁPIDA']].map(([v, t]) => (
              <button key={v} type="button" onClick={() => setConfig({ velocidad: v })} className={chip(config.velocidad === v)}>{t}</button>
            ))}
          </div>
          {variante === 'FILTRO' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-arcade text-[9px] text-slate-400">SI SE CUELA UNA FALSA</span>
              <button type="button" onClick={() => setConfig({ falsaEscapaQuitaVida: true })} className={chip(config.falsaEscapaQuitaVida)}>−1 ♥</button>
              <button type="button" onClick={() => setConfig({ falsaEscapaQuitaVida: false })} className={chip(!config.falsaEscapaQuitaVida)}>SIN CASTIGO</button>
            </div>
          )}
        </Seccion>

        <details className="rounded-lg border-2 border-slate-800 bg-slate-950/60 px-4 py-3 font-pixel text-lg text-slate-400">
          <summary className="cursor-pointer font-arcade text-[9px] text-slate-300">⌨️ CONTROLES CON TECLADO</summary>
          {variante === 'DISPARA' ? (
            <ul className="mt-2 list-disc pl-5">
              <li>1 jugador: números, «−» cambia el signo, Retroceso borra, Intro o Espacio = FUEGO (A-D o 1-4 para elegir opción).</li>
              <li>2 jugadores: J1 fila de números + Espacio · J2 teclado numérico + Intro («+» borra).</li>
              <li>J3 y J4 juegan con la pantalla táctil. Todos pueden tocar a la vez.</li>
            </ul>
          ) : (
            <ul className="mt-2 list-disc pl-5">
              <li>J1: A / D para moverse, W o Espacio para disparar.</li>
              <li>J2: ← / → para moverse, ↑ o Intro para disparar.</li>
              <li>En pantalla táctil: botones ◀ ▶ (mantener pulsado) o arrastra el dedo por el cielo.</li>
            </ul>
          )}
        </details>

        {error && <p className="text-center font-pixel text-2xl text-rose-400">⚠ {error}</p>}
        <div className="flex flex-wrap items-center justify-center gap-3 pb-6">
          <button type="button" onClick={onJugar} className={`${BTN.primario} animate-inv-latido text-sm sm:text-lg`}>▶ JUGAR</button>
          {onPdf && (
            <button type="button" onClick={() => setPdfAbierto(true)} disabled={maxPreguntasPdf === 0}
              title={maxPreguntasPdf === 0 ? 'Elige primero un contenido con preguntas' : 'Las mismas preguntas en una ficha imprimible'}
              className={`${BTN.menu} text-[10px] disabled:cursor-not-allowed disabled:opacity-40`}>🖨️ FICHA PDF</button>
          )}
        </div>
      </div>

      {pdfAbierto && (
        <ModalPdf maxPreguntas={maxPreguntasPdf} vinculada={!!ficha} onGenerar={onPdf} onCerrar={() => setPdfAbierto(false)} />
      )}

      {buscando && (
        <BuscadorRecursos variante={variante} onCerrar={() => setBuscando(false)}
          onPick={(r) => { setFuente({ recurso: r, hojas: null }); setBuscando(false); }} />
      )}
    </div>
  );
}
