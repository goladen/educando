// «Enviar por correo» para Documentos personalizados: cada documento se abre como un correo ya escrito
// en Gmail (web) o en el programa de correo del equipo. Sin permisos de Google: el profesor revisa y envía.
import { useEffect, useMemo, useState } from 'react';
import { columnaCorreo, correosDe, enlaceCorreo, LIMITE_URL } from '../utils/combinarDocs';

const LS = 'pikt_docs_correo';
const leer = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };

export default function EnviarCorreosDocs({ docs, filas, columnas }) {
  const pref = useMemo(leer, []);
  const auto = columnaCorreo(columnas, filas);
  const [colElegida, setColElegida] = useState(null);       // null = la detectada
  const [cliente, setCliente] = useState(pref.cliente || 'gmail');
  const [cuenta, setCuenta] = useState(pref.cuenta || '');
  const [asuntoDef, setAsuntoDef] = useState(pref.asunto || '');
  const [abiertos, setAbiertos] = useState(() => new Set());

  useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify({ cliente, cuenta, asunto: asuntoDef })); } catch { /* sin almacenamiento */ }
  }, [cliente, cuenta, asuntoDef]);

  const col = colElegida !== null && colElegida < columnas.length ? colElegida : auto;
  const lista = useMemo(() => docs.map(d => {
    const { validos, invalidos } = col >= 0 ? correosDe(filas[d.n - 1]?.[col]) : { validos: [], invalidos: [] };
    const asunto = d.titulo || asuntoDef || 'Documento';
    const url = enlaceCorreo({ para: validos, asunto, cuerpo: d.texto.trim(), cliente, cuenta });
    return { d, validos, invalidos, asunto, url, largo: url.length > LIMITE_URL[cliente] };
  }), [docs, filas, col, cliente, cuenta, asuntoDef]);

  const enviables = lista.filter(x => x.validos.length);
  const pendientes = enviables.filter(x => !abiertos.has(x.d.n));
  const sinCorreo = lista.length - enviables.length;
  const largos = lista.filter(x => x.largo).length;

  const abrir = (x) => {
    if (cliente === 'gmail') {
      const w = window.open(x.url, '_blank');
      if (!w) { alert('El navegador ha bloqueado la ventana. Permite las ventanas emergentes de pikt.es.'); return; }
      try { w.opener = null; } catch { /* nada */ }
    } else {
      window.location.href = x.url;     // mailto: abre el programa de correo sin dejar pestañas vacías
    }
    setAbiertos(s => new Set(s).add(x.d.n));
  };
  const copiar = async (x) => {
    const t = `${x.asunto}\n\n${x.d.texto.trim()}`;
    try { await navigator.clipboard.writeText(t); } catch { window.prompt('Copia el texto:', t); }
  };

  return (
    <div style={st.caja}>
      <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>✉️ Enviar por correo</h4>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
        Cada documento se abre como un correo ya escrito (destinatario, asunto = título y texto). Solo tienes que revisarlo y pulsar «Enviar».
        Sale desde tu propia cuenta. No admite adjuntos: el documento va en el cuerpo del correo.
      </p>

      <div style={st.fila}>
        <label style={st.mini}>Columna con el correo
          <select value={col} onChange={e => setColElegida(Number(e.target.value))} style={st.sel}>
            <option value={-1}>— ninguna —</option>
            {columnas.map((c, i) => <option key={i} value={i}>{c}</option>)}
          </select>
        </label>
        <label style={st.mini}>Abrir con
          <select value={cliente} onChange={e => setCliente(e.target.value)} style={st.sel}>
            <option value="gmail">Gmail (en el navegador)</option>
            <option value="mailto">Mi programa de correo (Outlook, Mail…)</option>
          </select>
        </label>
        {cliente === 'gmail' && (
          <label style={st.mini}>Tu cuenta de Gmail <span style={{ fontWeight: 400 }}>(si tienes varias)</span>
            <input value={cuenta} onChange={e => setCuenta(e.target.value)} placeholder="profe@centro.es" style={{ ...st.sel, width: 190 }} />
          </label>
        )}
        {docs.some(d => !d.titulo) && (
          <label style={st.mini}>Asunto <span style={{ fontWeight: 400 }}>(no hay título)</span>
            <input value={asuntoDef} onChange={e => setAsuntoDef(e.target.value)} placeholder="Documento" style={{ ...st.sel, width: 190 }} />
          </label>
        )}
      </div>

      {col < 0 ? (
        <div style={st.alerta}>Añade a la tabla una columna <b>«Correo»</b> con la dirección de cada destinatario (puedes poner varias separadas por «;»), o elige aquí qué columna la tiene.</div>
      ) : (
        <>
          {sinCorreo > 0 && <div style={st.alerta}>⚠️ {sinCorreo} {sinCorreo === 1 ? 'documento no tiene' : 'documentos no tienen'} un correo válido en «{columnas[col]}».</div>}
          {largos > 0 && <div style={st.alerta}>⚠️ {largos === 1 ? 'Un texto es' : `${largos} textos son`} muy {largos === 1 ? 'largo' : 'largos'} para abrirse en un correo y {largos === 1 ? 'puede' : 'pueden'} cortarse{cliente === 'mailto' ? ' (prueba con Gmail, que admite textos más largos)' : ''}. Usa «Copiar» y pégalo en el correo.</div>}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0 10px' }}>
            <button onClick={() => pendientes[0] && abrir(pendientes[0])} disabled={!pendientes.length}
              style={{ ...st.btn, background: pendientes.length ? '#0E7490' : '#BBB' }}>
              {pendientes.length ? `✉️ Abrir el siguiente (${enviables.length - pendientes.length + 1} de ${enviables.length})` : '✓ Todos abiertos'}
            </button>
            <span style={{ fontSize: 12, color: '#64748B', flex: 1 }}>{abiertos.size} de {enviables.length} abiertos</span>
            {abiertos.size > 0 && <button onClick={() => setAbiertos(new Set())} style={st.link}>Reiniciar marcas</button>}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
            {lista.map((x, k) => {
              const hecho = abiertos.has(x.d.n);
              return (
                <div key={x.d.n} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderTop: k ? '1px solid #F1F5F9' : 'none', background: hecho ? '#F0FDF4' : 'white', flexWrap: 'wrap' }}>
                  <span style={{ width: 22, color: hecho ? '#059669' : '#94A3B8', fontWeight: 700, fontSize: 13 }}>{hecho ? '✓' : x.d.n}</span>
                  <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.asunto}</span>
                    <span style={{ display: 'block', fontSize: 12, color: x.validos.length ? '#64748B' : '#B91C1C' }}>
                      {x.validos.length ? x.validos.join(', ') : 'Sin correo válido'}
                      {x.invalidos.length > 0 && <span style={{ color: '#B91C1C' }}> · no válido: {x.invalidos.join(', ')}</span>}
                      {x.largo && <span style={{ color: '#B45309' }}> · texto largo</span>}
                    </span>
                  </span>
                  <button onClick={() => copiar(x)} style={st.btnSec} title="Copiar asunto y texto">Copiar</button>
                  <button onClick={() => abrir(x)} disabled={!x.validos.length}
                    style={{ ...st.btn, padding: '6px 12px', background: x.validos.length ? (hecho ? '#64748B' : '#0E7490') : '#CBD5E1' }}>
                    {hecho ? 'Abrir otra vez' : 'Abrir ✉️'}
                  </button>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '8px 0 0' }}>
            Si quieres adjuntar el PDF, descárgalo «por separado» y adjunta cada archivo en su correo.
          </p>
        </>
      )}
    </div>
  );
}

const st = {
  caja: { marginTop: 14, padding: 14, border: '1px solid #A5F3FC', borderRadius: 12, background: '#F0FDFF' },
  fila: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  mini: { display: 'flex', flexDirection: 'column', fontSize: 11, color: '#64748B', fontWeight: 600, gap: 2 },
  sel: { padding: '6px 8px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', background: 'white' },
  alerta: { margin: '6px 0', padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, fontSize: 13, color: '#92400E' },
  btn: { padding: '9px 14px', color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSec: { padding: '6px 10px', background: 'white', border: '1px solid #CBD5E1', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155' },
  link: { border: 'none', background: 'none', color: '#0E7490', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' },
};
