// Panel lateral con las propiedades de los elementos seleccionados (uno o varios).
// Los cambios se aplican a TODOS los seleccionados; los valores mostrados son los del último.
import { ColorPicker, Seccion, Deslizador, Segmentado, BotonMini, NumInput, CampoDegradado, ETIQ } from './ui';
import { FUENTES, SOMBRAS, FILTRO_PRESETS, FILTROS_DEF, MASCARAS, ANIMACIONES, BUCLES, LISTAS, PX_X, PX_Y } from './render';
import { DEGRADADOS } from './plantillas';

const TIPO_LABEL = {
  text: '📝 Texto', shape: '⬟ Forma', image: '🖼️ Imagen', youtube: '▶ YouTube', webview: '🌐 Web',
  equation: '∑ Ecuación', music: '🎵 Música',
};

// Propiedades que se copian con «Copiar estilo»
export const CLAVES_ESTILO = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'textAlign', 'vAlign', 'color', 'lineHeight',
  'letterSpacing', 'uppercase', 'lista', 'listaColor', 'gradient', 'textStrokeW', 'textStrokeColor', 'bgColor', 'bgRadius',
  'shadow', 'shadowColor', 'fill', 'fillGradient', 'stroke', 'strokeWidth', 'strokeDash', 'borderRadius', 'opacity',
  'filters', 'mask', 'borderW', 'borderColor', 'anim',
];

// Cambia el orden de capas de los elementos `ids`: 'frente' | 'adelante' | 'atras' | 'fondo'
export function ordenarEls(els, ids, modo) {
  const es = e => ids.includes(e.id);
  if (modo === 'frente') return [...els.filter(e => !es(e)), ...els.filter(es)];
  if (modo === 'fondo') return [...els.filter(es), ...els.filter(e => !es(e))];
  const a = [...els];
  if (modo === 'adelante') { for (let i = a.length - 2; i >= 0; i--) if (es(a[i]) && !es(a[i + 1])) [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
  else { for (let i = 1; i < a.length; i++) if (es(a[i]) && !es(a[i - 1])) [a[i], a[i - 1]] = [a[i - 1], a[i]]; }
  return a;
}

const caja = s => ({
  x0: Math.min(...s.map(e => e.x)), y0: Math.min(...s.map(e => e.y)),
  x1: Math.max(...s.map(e => e.x + e.w)), y1: Math.max(...s.map(e => e.y + e.h)),
});

const fila = { display: 'flex', gap: 4, marginBottom: 6 };
const selectSt = { width: '100%', background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '5px 8px', color: '#fff', fontSize: 11, outline: 'none', marginBottom: 8 };
const check = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#d1d5db', cursor: 'pointer', marginBottom: 6 };

export default function PanelPropiedades({ elementos, selIds, t, numSlides, onCambiarEls, onAccion, estiloCopiado }) {
  const sel = elementos.filter(e => selIds.includes(e.id));
  if (!sel.length) return null;
  const el = sel.find(e => e.id === selIds[selIds.length - 1]) || sel[0];
  const multi = sel.length > 1;
  const bloqueado = sel.every(e => e.locked);

  const upd = (u) => onCambiarEls(els => els.map(e => (selIds.includes(e.id) ? { ...e, ...(typeof u === 'function' ? u(e) : u) } : e)));
  const updAnim = (u) => upd(e => ({ anim: { ...(e.anim || {}), ...u } }));
  const updFiltro = (u) => upd(e => ({ filters: { ...(e.filters || {}), ...u } }));

  const esTexto = el.type === 'text';
  const esForma = el.type === 'shape';
  const esLinea = esForma && el.shapeType === 'line';
  const conTexto = esTexto || (esForma && !esLinea);
  const esImg = el.type === 'image';
  const esEq = el.type === 'equation';

  // ── Alinear / distribuir / ordenar ──
  const alinear = (modo) => onCambiarEls(els => {
    const s = els.filter(e => selIds.includes(e.id) && !e.locked);
    if (!s.length) return els;
    const c = s.length > 1 ? caja(s) : { x0: 0, y0: 0, x1: 100, y1: 100 };
    return els.map(e => {
      if (!s.includes(e)) return e;
      switch (modo) {
        case 'izq': return { ...e, x: c.x0 };
        case 'ch': return { ...e, x: (c.x0 + c.x1) / 2 - e.w / 2 };
        case 'der': return { ...e, x: c.x1 - e.w };
        case 'arr': return { ...e, y: c.y0 };
        case 'cv': return { ...e, y: (c.y0 + c.y1) / 2 - e.h / 2 };
        case 'aba': return { ...e, y: c.y1 - e.h };
        default: return e;
      }
    });
  });
  const distribuir = (eje) => onCambiarEls(els => {
    const s = els.filter(e => selIds.includes(e.id) && !e.locked);
    if (s.length < 3) return els;
    const P = eje === 'h' ? 'x' : 'y', D = eje === 'h' ? 'w' : 'h';
    const ord = [...s].sort((a, b) => a[P] - b[P]);
    const ini = ord[0][P], fin = Math.max(...ord.map(e => e[P] + e[D]));
    const hueco = (fin - ini - ord.reduce((a, e) => a + e[D], 0)) / (ord.length - 1);
    const pos = new Map();
    let p = ini;
    ord.forEach(e => { pos.set(e.id, p); p += e[D] + hueco; });
    return els.map(e => (pos.has(e.id) ? { ...e, [P]: pos.get(e.id) } : e));
  });
  const ordenar = (modo) => onCambiarEls(els => ordenarEls(els, selIds, modo));
  const enSecuencia = () => onCambiarEls(els => {
    const ord = els.filter(e => selIds.includes(e.id)).sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const delay = new Map(ord.map((e, i) => [e.id, Math.round(i * 0.25 * 100) / 100]));
    return els.map(e => (delay.has(e.id) ? { ...e, anim: { tipo: 'up', dur: 0.6, ...(e.anim || {}), delay: delay.get(e.id) } } : e));
  });
  const pegarEstilo = () => {
    if (!estiloCopiado) return;
    upd(Object.fromEntries(Object.entries(estiloCopiado).filter(([, v]) => v !== undefined)));
  };

  const linkTipo = !el.link ? '' : String(el.link).startsWith('slide:') ? 'slide' : 'url';
  const filtros = { ...FILTROS_DEF, ...(el.filters || {}) };

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ ...ETIQ, color: '#e5e7eb', fontSize: 11 }}>{multi ? `🔲 ${sel.length} elementos` : (TIPO_LABEL[el.type] || el.type)}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => upd({ locked: !bloqueado })} title={bloqueado ? 'Desbloquear' : 'Bloquear (no se podrá mover)'}
            style={{ background: bloqueado ? '#b45309' : '#374151', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>{bloqueado ? '🔒' : '🔓'}</button>
          <button onClick={() => onAccion('duplicar')} title="Duplicar (Ctrl+D)" style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>⧉</button>
          <button onClick={() => onAccion('borrar')} title="Eliminar (Supr)" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>🗑</button>
        </div>
      </div>

      {/* POSICIÓN */}
      <Seccion titulo="Posición y tamaño">
        {!multi && <>
          <div style={fila}>
            <NumInput label="X" value={el.x * PX_X} onChange={v => upd({ x: v / PX_X })} />
            <NumInput label="Y" value={el.y * PX_Y} onChange={v => upd({ y: v / PX_Y })} />
          </div>
          <div style={fila}>
            <NumInput label="AN" value={el.w * PX_X} min={4} onChange={v => upd({ w: Math.max(0.5, v / PX_X) })} />
            <NumInput label="AL" value={el.h * PX_Y} min={4} onChange={v => upd({ h: Math.max(0.5, v / PX_Y) })} />
          </div>
          <div style={{ ...fila, alignItems: 'center' }}>
            <NumInput label="⟳" value={el.rotation || 0} sufijo="°" onChange={v => upd({ rotation: ((v % 360) + 540) % 360 - 180 })} />
            <BotonMini ancho={44} onClick={() => upd({ rotation: 0 })} title="Quitar giro">0°</BotonMini>
            <BotonMini ancho={44} onClick={() => upd(e => ({ rotation: (((e.rotation || 0) + 90 + 180) % 360) - 180 }))} title="Girar 90°">↻90</BotonMini>
          </div>
        </>}
        <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>{multi ? 'ALINEAR ENTRE SÍ' : 'ALINEAR EN LA PÁGINA'}</div>
        <div style={fila}>
          {[['izq', '⇤', 'Izquierda'], ['ch', '⇔', 'Centro horizontal'], ['der', '⇥', 'Derecha'], ['arr', '⤒', 'Arriba'], ['cv', '⇕', 'Centro vertical'], ['aba', '⤓', 'Abajo']].map(([m, i, ti]) => (
            <BotonMini key={m} title={ti} onClick={() => alinear(m)}>{i}</BotonMini>
          ))}
        </div>
        {sel.length >= 3 && (
          <div style={fila}>
            <BotonMini onClick={() => distribuir('h')} title="Mismo espacio en horizontal">↔ Distribuir</BotonMini>
            <BotonMini onClick={() => distribuir('v')} title="Mismo espacio en vertical">↕ Distribuir</BotonMini>
          </div>
        )}
        <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>ORDEN DE CAPAS</div>
        <div style={fila}>
          <BotonMini onClick={() => ordenar('frente')} title="Delante del todo (Ctrl+Mayús+])">⏫</BotonMini>
          <BotonMini onClick={() => ordenar('adelante')} title="Hacia delante (Ctrl+])">🔼</BotonMini>
          <BotonMini onClick={() => ordenar('atras')} title="Hacia atrás (Ctrl+[)">🔽</BotonMini>
          <BotonMini onClick={() => ordenar('fondo')} title="Detrás del todo (Ctrl+Mayús+[)">⏬</BotonMini>
        </div>
        {(esImg || (esForma && !esLinea)) && (
          <div style={fila}>
            <BotonMini activo={!!el.flipH} onClick={() => upd({ flipH: !el.flipH })} title="Voltear en horizontal">⇋ Voltear H</BotonMini>
            <BotonMini activo={!!el.flipV} onClick={() => upd({ flipV: !el.flipV })} title="Voltear en vertical">⥮ Voltear V</BotonMini>
          </div>
        )}
      </Seccion>

      {/* TEXTO */}
      {conTexto && (
        <Seccion titulo={esForma ? 'Texto dentro de la forma' : 'Texto'}>
          {esForma && !el.text && <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>Doble clic en la forma para escribir dentro.</div>}
          <select value={el.fontFamily || FUENTES[0].value} onChange={e => upd({ fontFamily: e.target.value })} style={{ ...selectSt, fontFamily: el.fontFamily || FUENTES[0].value, fontSize: 13 }}>
            {[...new Set(FUENTES.map(f => f.cat))].map(cat => (
              <optgroup key={cat} label={cat}>
                {FUENTES.filter(f => f.cat === cat).map(f => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
              </optgroup>
            ))}
          </select>
          <div style={{ ...fila, alignItems: 'center' }}>
            <BotonMini ancho={28} onClick={() => upd(e => ({ fontSize: Math.max(6, Math.round((e.fontSize || 16) / 1.12)) }))} title="Más pequeño">A−</BotonMini>
            <NumInput label="TAM" value={el.fontSize || 16} min={6} max={400} onChange={v => upd({ fontSize: Math.max(6, Math.min(400, v)) })} sufijo="px" />
            <BotonMini ancho={28} onClick={() => upd(e => ({ fontSize: Math.min(400, Math.round((e.fontSize || 16) * 1.12)) }))} title="Más grande">A+</BotonMini>
          </div>
          <Segmentado valor={null} onChange={k => {
            if (k === 'b') upd(e => ({ fontWeight: ['bold', '700', '800', '900'].includes(String(e.fontWeight)) ? 'normal' : 'bold' }));
            if (k === 'i') upd(e => ({ fontStyle: e.fontStyle === 'italic' ? 'normal' : 'italic' }));
            if (k === 'u') upd(e => ({ textDecoration: e.textDecoration === 'underline' ? 'none' : 'underline' }));
            if (k === 's') upd(e => ({ textDecoration: e.textDecoration === 'line-through' ? 'none' : 'line-through' }));
            if (k === 'aa') upd(e => ({ uppercase: !e.uppercase }));
          }} opciones={[
            ['b', <b style={{ color: ['bold', '700', '800', '900'].includes(String(el.fontWeight)) ? '#a78bfa' : '#fff' }}>B</b>, 'Negrita'],
            ['i', <i style={{ color: el.fontStyle === 'italic' ? '#a78bfa' : '#fff' }}>I</i>, 'Cursiva'],
            ['u', <u style={{ color: el.textDecoration === 'underline' ? '#a78bfa' : '#fff' }}>U</u>, 'Subrayado'],
            ['s', <s style={{ color: el.textDecoration === 'line-through' ? '#a78bfa' : '#fff' }}>S</s>, 'Tachado'],
            ['aa', <span style={{ color: el.uppercase ? '#a78bfa' : '#fff', fontSize: 10 }}>AA</span>, 'Mayúsculas'],
          ]} />
          <select value={String(el.fontWeight || 'normal')} onChange={e => upd({ fontWeight: e.target.value })} style={selectSt}>
            {[['normal', 'Grosor normal'], ['600', 'Seminegrita'], ['bold', 'Negrita'], ['900', 'Extra negrita']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Segmentado valor={el.textAlign || (esForma ? 'center' : 'left')} onChange={v => upd({ textAlign: v })}
            opciones={[['left', '⫷', 'Izquierda'], ['center', '≡', 'Centrado'], ['right', '⫸', 'Derecha'], ['justify', '☰', 'Justificado']]} />
          <Segmentado valor={el.vAlign || (esForma ? 'middle' : 'top')} onChange={v => upd({ vAlign: v })}
            opciones={[['top', '⬆', 'Arriba'], ['middle', '⬍', 'Centro'], ['bottom', '⬇', 'Abajo']]} />
          <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>LISTA</div>
          <Segmentado valor={el.lista || ''} onChange={v => upd({ lista: v || undefined })} opciones={LISTAS.map(l => [l.id, l.icon, l.label])} />
          {el.lista && <ColorPicker label="Color de las viñetas" value={el.listaColor ?? null} allowNull onChange={c => upd({ listaColor: c || undefined })} />}
          <Deslizador label="Interlineado" value={el.lineHeight || (esForma ? 1.25 : 1.5)} min={0.8} max={2.6} step={0.05} onChange={v => upd({ lineHeight: v })} />
          <Deslizador label="Espaciado de letras" value={el.letterSpacing ?? 0} min={-0.08} max={0.6} step={0.01} formato={v => `${Math.round(v * 100)}`} onChange={v => upd({ letterSpacing: v })} />
          <ColorPicker label="Color del texto" value={el.color ?? null} allowNull onChange={c => upd({ color: c, gradient: null })} />

          <label style={check}>
            <input type="checkbox" checked={!!el.gradient} onChange={e => upd({ gradient: e.target.checked ? DEGRADADOS[0] : null })} />
            Texto con degradado
          </label>
          {el.gradient && <CampoDegradado valor={el.gradient} onChange={g => upd({ gradient: g })} />}

          <label style={check}>
            <input type="checkbox" checked={!!el.textStrokeW} onChange={e => upd({ textStrokeW: e.target.checked ? 2 : 0 })} />
            Contorno de letra
          </label>
          {!!el.textStrokeW && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}><Deslizador label="Grosor" value={el.textStrokeW} min={0.5} max={10} step={0.5} unidad="px" onChange={v => upd({ textStrokeW: v })} /></div>
              <input type="color" value={el.textStrokeColor || '#000000'} onChange={e => upd({ textStrokeColor: e.target.value })} style={{ width: 30, height: 26, border: 'none', background: 'transparent', padding: 0 }} />
            </div>
          )}
          {esTexto && <>
            <label style={check}>
              <input type="checkbox" checked={!!el.bgColor} onChange={e => upd({ bgColor: e.target.checked ? t.accent : null })} />
              Fondo resaltado (etiqueta)
            </label>
            {el.bgColor && <>
              <ColorPicker value={el.bgColor} onChange={c => upd({ bgColor: c })} />
              <Deslizador label="Redondeo del fondo" value={el.bgRadius ?? 8} min={0} max={60} unidad="px" onChange={v => upd({ bgRadius: v })} />
            </>}
          </>}
        </Seccion>
      )}

      {/* RELLENO DE FORMAS */}
      {esForma && !esLinea && (
        <Seccion titulo="Relleno y borde">
          <Segmentado valor={el.fillGradient ? 'g' : 's'} onChange={v => upd(v === 'g' ? { fillGradient: el.fillGradient || DEGRADADOS[0] } : { fillGradient: null })}
            opciones={[['s', 'Color sólido'], ['g', 'Degradado']]} />
          {el.fillGradient
            ? <CampoDegradado valor={el.fillGradient} onChange={g => upd({ fillGradient: g })} />
            : <ColorPicker value={el.fill} onChange={c => upd({ fill: c })} />}
          {el.shapeType === 'rect' && (
            <Deslizador label="Esquinas redondeadas" value={el.borderRadius || 0} min={0} max={120} unidad="px" onChange={v => upd({ borderRadius: v })} />
          )}
          <ColorPicker label="Borde" value={el.stroke === 'none' ? null : el.stroke ?? null} allowNull onChange={c => upd({ stroke: c || 'none' })} />
          {el.stroke && el.stroke !== 'none' && <>
            <Deslizador label="Grosor del borde" value={el.strokeWidth ?? 2} min={1} max={20} unidad="px" onChange={v => upd({ strokeWidth: v })} />
            <Segmentado valor={el.strokeDash || 'solid'} onChange={v => upd({ strokeDash: v === 'solid' ? undefined : v })}
              opciones={[['solid', '━', 'Continuo'], ['dashed', '╍', 'Discontinuo'], ['dotted', '┅', 'Punteado']]} />
          </>}
        </Seccion>
      )}

      {/* LÍNEA */}
      {esLinea && (
        <Seccion titulo="Línea">
          <ColorPicker label="Color" value={el.fill} onChange={c => upd({ fill: c })} />
          <Deslizador label="Grosor" value={el.strokeWidth || 3} min={1} max={24} unidad="px" onChange={v => upd({ strokeWidth: v })} />
          <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>EXTREMOS</div>
          <Segmentado valor={el.lineEnd || ''} onChange={v => upd({ lineEnd: v || undefined })}
            opciones={[['', '—', 'Sin flecha'], ['arrow', '→', 'Flecha'], ['both', '↔', 'Doble flecha']]} />
          <Segmentado valor={el.strokeDash || 'solid'} onChange={v => upd({ strokeDash: v === 'solid' ? undefined : v })}
            opciones={[['solid', '━', 'Continua'], ['dashed', '╍', 'Discontinua'], ['dotted', '┅', 'Punteada']]} />
        </Seccion>
      )}

      {/* IMAGEN */}
      {esImg && (
        <Seccion titulo="Imagen">
          <Segmentado valor={el.objectFit || 'cover'} onChange={v => upd({ objectFit: v })}
            opciones={[['cover', 'Rellenar'], ['contain', 'Encajar'], ['fill', 'Estirar']]} />
          {(el.objectFit || 'cover') === 'cover' && (
            <select value={el.objPos || 'center'} onChange={e => upd({ objPos: e.target.value })} style={selectSt}>
              {[['center', 'Encuadre: centro'], ['top', 'Encuadre: arriba'], ['bottom', 'Encuadre: abajo'], ['left', 'Encuadre: izquierda'], ['right', 'Encuadre: derecha']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
          <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>FILTROS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 8 }}>
            {FILTRO_PRESETS.map(p => (
              <button key={p.id} onClick={() => upd({ filters: p.f })}
                style={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: 2, cursor: 'pointer', color: '#d1d5db', fontSize: 9, fontWeight: 700 }}>
                <img src={el.src} alt="" style={{ width: '100%', height: 30, objectFit: 'cover', borderRadius: 4, display: 'block', filter: p.f ? Object.entries(p.f).map(([k, v]) => ({ brillo: `brightness(${v}%)`, contraste: `contrast(${v}%)`, saturacion: `saturate(${v}%)`, gris: `grayscale(${v}%)`, sepia: `sepia(${v}%)`, matiz: `hue-rotate(${v}deg)`, desenfoque: `blur(${v}px)` }[k])).join(' ') : 'none' }} />
                {p.label}
              </button>
            ))}
          </div>
          <Seccion titulo="Ajustes finos" abierta={false}>
            <Deslizador label="Brillo" value={filtros.brillo} min={20} max={200} unidad="%" onChange={v => updFiltro({ brillo: v })} />
            <Deslizador label="Contraste" value={filtros.contraste} min={20} max={200} unidad="%" onChange={v => updFiltro({ contraste: v })} />
            <Deslizador label="Saturación" value={filtros.saturacion} min={0} max={250} unidad="%" onChange={v => updFiltro({ saturacion: v })} />
            <Deslizador label="Blanco y negro" value={filtros.gris} min={0} max={100} unidad="%" onChange={v => updFiltro({ gris: v })} />
            <Deslizador label="Sepia" value={filtros.sepia} min={0} max={100} unidad="%" onChange={v => updFiltro({ sepia: v })} />
            <Deslizador label="Tono" value={filtros.matiz} min={-180} max={180} unidad="°" onChange={v => updFiltro({ matiz: v })} />
            <Deslizador label="Desenfoque" value={filtros.desenfoque} min={0} max={12} step={0.5} unidad="px" onChange={v => updFiltro({ desenfoque: v })} />
            <BotonMini onClick={() => upd({ filters: null })}>↺ Restablecer</BotonMini>
          </Seccion>
          <div style={{ fontSize: 9, color: '#6b7280', margin: '6px 0 3px' }}>FORMA (MÁSCARA)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginBottom: 8 }}>
            {MASCARAS.map(m => (
              <button key={m.id} title={m.label} onClick={() => upd({ mask: m.id || undefined })}
                style={{ background: (el.mask || '') === m.id ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 0', cursor: 'pointer', fontSize: 14 }}>{m.icon}</button>
            ))}
          </div>
          {!el.mask && <Deslizador label="Esquinas redondeadas" value={el.borderRadius || 0} min={0} max={120} unidad="px" onChange={v => upd({ borderRadius: v })} />}
          <Deslizador label="Marco" value={el.borderW || 0} min={0} max={24} unidad="px" onChange={v => upd({ borderW: v })} />
          {!!el.borderW && <ColorPicker value={el.borderColor || '#ffffff'} onChange={c => upd({ borderColor: c })} />}
          {!multi && (
            <div style={fila}>
              <BotonMini onClick={() => onAccion('reemplazarImagen', el.id)}>🔁 Reemplazar</BotonMini>
              <BotonMini onClick={() => onAccion('comoFondo', el.id)} title="Poner la imagen como fondo de la diapositiva">🖼 Como fondo</BotonMini>
            </div>
          )}
        </Seccion>
      )}

      {/* ECUACIÓN */}
      {esEq && (
        <Seccion titulo="Ecuación">
          <Deslizador label="Tamaño" value={el.fontSize || 28} min={10} max={140} unidad="px" onChange={v => upd({ fontSize: v })} />
          <ColorPicker label="Color" value={el.color ?? null} allowNull onChange={c => upd({ color: c })} />
          {!multi && <BotonMini onClick={() => onAccion('editarEcuacion', el.id)}>✏️ Editar ecuación</BotonMini>}
        </Seccion>
      )}

      {/* EFECTOS */}
      <Seccion titulo="Efectos">
        <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 3 }}>SOMBRA</div>
        <Segmentado valor={el.shadow || ''} onChange={v => upd({ shadow: v || undefined })} opciones={SOMBRAS.map(s => [s.id, <span style={{ fontSize: 9 }}>{s.label}</span>, s.label])} />
        {el.shadow && <ColorPicker label="Color de la sombra" value={el.shadowColor ?? null} allowNull onChange={c => upd({ shadowColor: c || undefined })} />}
        <Deslizador label="Transparencia" value={el.opacity ?? 1} min={0.05} max={1} step={0.05} formato={v => `${Math.round(v * 100)}%`} onChange={v => upd({ opacity: v })} />
      </Seccion>

      {/* ANIMACIÓN */}
      <Seccion titulo="Animación" abierta={!!el.anim?.tipo || !!el.anim?.bucle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 8 }}>
          {ANIMACIONES.map(a => (
            <button key={a.id} onClick={() => updAnim({ tipo: a.id || undefined })}
              style={{ background: (el.anim?.tipo || '') === a.id ? '#6c63ff' : '#111827', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 6, padding: '5px 2px', cursor: 'pointer', fontSize: 9, fontWeight: 700, lineHeight: 1.3 }}>
              <div style={{ fontSize: 14 }}>{a.icon}</div>{a.label}
            </button>
          ))}
        </div>
        {el.anim?.tipo && <>
          <Deslizador label="Empieza a los" value={el.anim.delay ?? 0} min={0} max={6} step={0.1} unidad=" s" onChange={v => updAnim({ delay: v })} />
          <Deslizador label="Duración" value={el.anim.dur ?? 0.7} min={0.2} max={3} step={0.1} unidad=" s" onChange={v => updAnim({ dur: v })} />
        </>}
        <select value={el.anim?.bucle || ''} onChange={e => updAnim({ bucle: e.target.value || undefined })} style={selectSt}>
          {BUCLES.map(b => <option key={b.id} value={b.id}>{b.id ? `Movimiento continuo: ${b.label}` : 'Sin movimiento continuo'}</option>)}
        </select>
        <div style={fila}>
          <BotonMini onClick={() => onAccion('probarAnim')}>▶ Probar</BotonMini>
          {multi && <BotonMini onClick={enSecuencia} title="Aparecen uno detrás de otro (de arriba abajo)">🪜 En secuencia</BotonMini>}
        </div>
      </Seccion>

      {/* ENLACE */}
      <Seccion titulo="Enlace al pulsar" abierta={!!el.link}>
        <Segmentado valor={linkTipo} onChange={v => upd({ link: v === 'url' ? 'https://' : v === 'slide' ? 'slide:1' : undefined })}
          opciones={[['', 'Nada'], ['url', '🌐 Web'], ['slide', '📑 Diapositiva']]} />
        {linkTipo === 'url' && (
          <input value={el.link} onChange={e => upd({ link: e.target.value })} placeholder="https://…"
            style={{ ...selectSt, boxSizing: 'border-box' }} />
        )}
        {linkTipo === 'slide' && (
          <select value={el.link} onChange={e => upd({ link: e.target.value })} style={selectSt}>
            {Array.from({ length: numSlides }, (_, i) => <option key={i} value={`slide:${i + 1}`}>Ir a la diapositiva {i + 1}</option>)}
          </select>
        )}
        {linkTipo && <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>Funciona al presentar (vista previa / enlace compartido).</div>}
      </Seccion>

      {/* ESTILO */}
      <Seccion titulo="Copiar formato" abierta={false}>
        <div style={fila}>
          <BotonMini onClick={() => onAccion('copiarEstilo', el.id)} title="Copia colores, fuente, efectos y animación">🖌 Copiar estilo</BotonMini>
          <BotonMini disabled={!estiloCopiado} onClick={pegarEstilo}>📋 Pegar estilo</BotonMini>
        </div>
      </Seccion>
    </div>
  );
}
