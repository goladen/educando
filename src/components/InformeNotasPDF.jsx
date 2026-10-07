import React, { useMemo, useState } from 'react';
import { X, FileText } from 'lucide-react';

// ─── Informe PDF de un grupo ──────────────────────────────────────────────────
// Filtra alumnos por nota (< umbral) en uno o varios exámenes / notas finales,
// permite ajustar la selección a mano y añadir observaciones por alumno.
//
// Props:
//   grupo, hojas, hojaIdx, alumnos
//   valorDe(h, alumnoId, col, conRecup) → número (NaN si vacío)
//   notaFinalEnHoja(h, alumnoId) → string
//   observacionesIniciales: { [alumnoId]: string }
//   onGuardarObservaciones(obs) → Promise (opcional)

const aNum = (v) => parseFloat(String(v ?? '').trim().replace(',', '.'));
const fmt = (v) => isNaN(v) ? '—' : String(Math.round(v * 100) / 100).replace('.', ',');

export default function InformeNotasPDF({
    grupo, hojas, hojaIdx, alumnos, valorDe, notaFinalEnHoja,
    observacionesIniciales = {}, onGuardarObservaciones, onClose
}) {
    // Criterios disponibles: columnas no-recuperación de cada hoja + nota final de cada hoja
    const criteriosDisponibles = useMemo(() => hojas.flatMap(h => [
        ...h.columnas.filter(c => !c.recuperaDe).map(c => ({
            key: `${h.id}__${c.id}`, hoja: h, col: c,
            label: `#${c.num} ${c.header}`,
            tieneRecup: h.columnas.some(r => r.recuperaDe === c.id),
        })),
        { key: `${h.id}__FINAL`, hoja: h, col: null, label: 'Nota final', tieneRecup: false },
    ]), [hojas]);

    const hojaActiva = hojas[hojaIdx] || hojas[0];
    const [titulo,       setTitulo]       = useState(`Informe de notas — ${grupo.nombre}`);
    const [criterios,    setCriterios]    = useState({}); // key → umbral (string)
    const [mostrarCols,  setMostrarCols]  = useState({}); // key → true: columnas extra solo informativas
    const [modo,         setModo]         = useState('alguno'); // 'alguno' | 'todos'
    const [conRecup,     setConRecup]     = useState(true);
    const [vacioCuenta,  setVacioCuenta]  = useState(false);
    const [manual,       setManual]       = useState({}); // alumnoId → true/false (anula el filtro)
    const [obs,          setObs]          = useState(observacionesIniciales);
    const [obsGeneral,   setObsGeneral]   = useState('');
    const [generando,    setGenerando]    = useState(false);
    const [hojaFiltro,   setHojaFiltro]   = useState(hojaActiva?.id || 'TODAS');

    const valorCriterio = (c, alumnoId) => c.col
        ? valorDe(c.hoja, alumnoId, c.col, conRecup)
        : aNum(notaFinalEnHoja(c.hoja, alumnoId));

    const activos = criteriosDisponibles.filter(c => criterios[c.key] !== undefined);

    const cumpleFiltro = (alumnoId) => {
        if (!activos.length) return true; // sin criterios → todos
        const res = activos.map(c => {
            const u = aNum(criterios[c.key]);
            const v = valorCriterio(c, alumnoId);
            if (isNaN(v)) return vacioCuenta;
            return isNaN(u) ? false : v < u;
        });
        return modo === 'todos' ? res.every(Boolean) : res.some(Boolean);
    };

    const incluido = (a) => manual[a.id] !== undefined ? manual[a.id] : cumpleFiltro(a.id);
    const seleccionados = alumnos.filter(incluido);

    const columnasInforme = criteriosDisponibles.filter(c => criterios[c.key] !== undefined || mostrarCols[c.key]);

    const toggleCriterio = (key) => setCriterios(prev => {
        const n = { ...prev };
        if (n[key] !== undefined) delete n[key]; else n[key] = '5';
        return n;
    });

    // ── Generar PDF ───────────────────────────────────────────────────────────
    const generarPDF = async () => {
        if (!seleccionados.length) { alert('No hay alumnos seleccionados.'); return; }
        setGenerando(true);
        try {
            const { jsPDF } = await import('jspdf');
            const horizontal = columnasInforme.length > 5;
            const pdf = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();
            const M = 14;
            let y = M;

            const nuevaPagina = () => { pdf.addPage(); y = M; };
            const asegurar = (alto) => { if (y + alto > H - M) { nuevaPagina(); return true; } return false; };

            // Cabecera
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(21, 101, 192);
            pdf.splitTextToSize(titulo || 'Informe', W - 2 * M).forEach(l => { pdf.text(l, M, y + 5); y += 7; });
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(90);
            pdf.text(`Grupo: ${grupo.nombre}   ·   Fecha: ${new Date().toLocaleDateString('es-ES')}   ·   Alumnos en el informe: ${seleccionados.length} de ${alumnos.length}`, M, y + 3);
            y += 7;

            // Criterio
            if (activos.length) {
                const desc = activos.map(c => `${c.label}${hojas.length > 1 ? ` (${c.hoja.nombre})` : ''} < ${String(criterios[c.key]).replace('.', ',')}`)
                    .join(modo === 'todos' ? '  y  ' : '  o  ');
                const extra = [conRecup ? 'teniendo en cuenta la recuperación' : null, vacioCuenta ? 'sin nota cuenta como por debajo' : null].filter(Boolean).join('; ');
                pdf.setFontSize(9); pdf.setTextColor(110);
                pdf.splitTextToSize(`Criterio: ${desc}${extra ? ` (${extra})` : ''}`, W - 2 * M).forEach(l => { pdf.text(l, M, y + 3); y += 4.5; });
                y += 2;
            }

            if (obsGeneral.trim()) {
                pdf.setFontSize(10); pdf.setTextColor(40);
                pdf.splitTextToSize(obsGeneral.trim(), W - 2 * M).forEach(l => { asegurar(5); pdf.text(l, M, y + 3); y += 5; });
                y += 3;
            }

            // Tabla
            const anchoNombre = Math.min(70, Math.max(45, (W - 2 * M) * 0.35));
            const anchoCol = columnasInforme.length ? (W - 2 * M - anchoNombre) / columnasInforme.length : 0;
            const altoFila = 7;

            const cabeceraTabla = () => {
                pdf.setFillColor(21, 101, 192);
                const altoCab = hojas.length > 1 ? 10 : 8;
                pdf.rect(M, y, W - 2 * M, altoCab, 'F');
                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(255);
                pdf.text('Alumno/a', M + 2, y + 5.3);
                columnasInforme.forEach((c, i) => {
                    const x = M + anchoNombre + i * anchoCol + anchoCol / 2;
                    const txt = pdf.splitTextToSize(c.label, anchoCol - 2)[0];
                    pdf.text(txt, x, y + (hojas.length > 1 ? 4.2 : 5.3), { align: 'center' });
                    if (hojas.length > 1) {
                        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5);
                        pdf.text(pdf.splitTextToSize(c.hoja.nombre, anchoCol - 2)[0], x, y + 8, { align: 'center' });
                        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5);
                    }
                });
                y += altoCab;
            };
            cabeceraTabla();

            seleccionados.forEach((a, idx) => {
                const texto = (obs[a.id] || '').trim();
                const lineasObs = texto ? pdf.splitTextToSize(`Observaciones: ${texto}`, W - 2 * M - 6) : [];
                const altoTotal = altoFila + (lineasObs.length ? lineasObs.length * 4.2 + 2.5 : 0);
                if (asegurar(altoTotal)) cabeceraTabla();

                if (idx % 2 === 1) { pdf.setFillColor(245, 247, 250); pdf.rect(M, y, W - 2 * M, altoTotal, 'F'); }
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(30);
                pdf.text(pdf.splitTextToSize(a.nombre, anchoNombre - 3)[0], M + 2, y + 4.8);

                columnasInforme.forEach((c, i) => {
                    const x = M + anchoNombre + i * anchoCol + anchoCol / 2;
                    const v = valorCriterio(c, a.id);
                    const u = aNum(criterios[c.key]);
                    const bajo = !isNaN(v) && (!isNaN(u) ? v < u : v < 5);
                    pdf.setFont('helvetica', bajo ? 'bold' : 'normal');
                    if (isNaN(v)) pdf.setTextColor(160);
                    else if (bajo) pdf.setTextColor(200, 40, 40);
                    else pdf.setTextColor(30, 120, 60);
                    let txt = fmt(v);
                    // Si la recuperación ha cambiado la nota, indicar el examen original
                    if (conRecup && c.col && c.tieneRecup) {
                        const orig = valorDe(c.hoja, a.id, c.col, false);
                        if (!isNaN(orig) && orig !== v) txt += ` (ex. ${fmt(orig)})`;
                    }
                    pdf.text(txt, x, y + 4.8, { align: 'center' });
                });
                y += altoFila;

                if (lineasObs.length) {
                    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8.5); pdf.setTextColor(90, 70, 20);
                    lineasObs.forEach(l => { pdf.text(l, M + 4, y + 2.8); y += 4.2; });
                    y += 2.5;
                }
                pdf.setDrawColor(225); pdf.line(M, y, W - M, y);
            });

            // Pie con número de página
            const total = pdf.getNumberOfPages();
            for (let p = 1; p <= total; p++) {
                pdf.setPage(p);
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(150);
                pdf.text(`${grupo.nombre} · página ${p} de ${total}`, W - M, H - 6, { align: 'right' });
            }

            const nombreArchivo = (titulo || 'informe').replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
            pdf.save(`${nombreArchivo}.pdf`);

            if (onGuardarObservaciones) {
                try { await onGuardarObservaciones(obs); } catch (e) { console.error('Error guardando observaciones:', e); }
            }
        } catch (e) {
            alert('Error al generar el PDF: ' + e.message);
        }
        setGenerando(false);
    };

    // ── Copiar para correo (HTML con estilos en línea + texto plano) ──────────
    const [copiado, setCopiado] = useState(false);

    const textoCriterio = () => activos.length
        ? 'Criterio: ' + activos.map(c => `${c.label}${hojas.length > 1 ? ` (${c.hoja.nombre})` : ''} < ${String(criterios[c.key]).replace('.', ',')}`)
            .join(modo === 'todos' ? ' y ' : ' o ')
          + (conRecup ? ' (teniendo en cuenta la recuperación)' : '')
        : '';

    const celdaInforme = (c, alumnoId) => {
        const v = valorCriterio(c, alumnoId);
        const u = aNum(criterios[c.key]);
        const bajo = !isNaN(v) && (!isNaN(u) ? v < u : v < 5);
        let txt = fmt(v);
        if (conRecup && c.col && c.tieneRecup) {
            const orig = valorDe(c.hoja, alumnoId, c.col, false);
            if (!isNaN(orig) && orig !== v) txt += ` (ex. ${fmt(orig)})`;
        }
        return { txt, bajo, vacio: isNaN(v) };
    };

    const copiarCorreo = async () => {
        if (!seleccionados.length) { alert('No hay alumnos seleccionados.'); return; }
        const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        const etiqueta = (c) => `${c.label}${hojas.length > 1 ? ` (${c.hoja.nombre})` : ''}`;
        const td = 'padding:6px 10px;border:1px solid #d0d7e2;font-family:Arial,sans-serif;font-size:13px;';
        const nCols = 1 + columnasInforme.length;
        const fecha = new Date().toLocaleDateString('es-ES');

        const filasHtml = seleccionados.map((a, i) => {
            const bg = i % 2 ? '#f5f7fa' : '#ffffff';
            const celdas = columnasInforme.map(c => {
                const { txt, bajo, vacio } = celdaInforme(c, a.id);
                const color = vacio ? '#999999' : bajo ? '#c62828' : '#2e7d32';
                return `<td style="${td}text-align:center;color:${color};${bajo ? 'font-weight:bold;' : ''}">${esc(txt)}</td>`;
            }).join('');
            const o = (obs[a.id] || '').trim();
            return `<tr style="background:${bg};"><td style="${td}">${esc(a.nombre)}</td>${celdas}</tr>`
                + (o ? `<tr style="background:${bg};"><td colspan="${nCols}" style="${td}font-style:italic;color:#5a4614;">Observaciones: ${esc(o)}</td></tr>` : '');
        }).join('');

        const html = `<div style="font-family:Arial,sans-serif;">`
            + `<h2 style="color:#1565C0;font-size:18px;margin:0 0 4px;">${esc(titulo)}</h2>`
            + `<p style="color:#666;font-size:12px;margin:0 0 6px;">Grupo: ${esc(grupo.nombre)} · Fecha: ${fecha} · Alumnos: ${seleccionados.length} de ${alumnos.length}</p>`
            + (textoCriterio() ? `<p style="color:#777;font-size:12px;margin:0 0 8px;">${esc(textoCriterio())}</p>` : '')
            + (obsGeneral.trim() ? `<p style="font-size:13px;margin:0 0 10px;">${esc(obsGeneral.trim())}</p>` : '')
            + `<table style="border-collapse:collapse;"><thead><tr>`
            + `<th style="${td}background:#1565C0;color:#ffffff;text-align:left;">Alumno/a</th>`
            + columnasInforme.map(c => `<th style="${td}background:#1565C0;color:#ffffff;text-align:center;">${esc(etiqueta(c))}</th>`).join('')
            + `</tr></thead><tbody>${filasHtml}</tbody></table></div>`;

        const texto = [
            titulo,
            `Grupo: ${grupo.nombre} · Fecha: ${fecha} · Alumnos: ${seleccionados.length} de ${alumnos.length}`,
            textoCriterio(),
            obsGeneral.trim(),
            '',
            ...seleccionados.flatMap(a => {
                const notas = columnasInforme.map(c => `${etiqueta(c)}: ${celdaInforme(c, a.id).txt}`).join(' · ');
                const o = (obs[a.id] || '').trim();
                return [`- ${a.nombre}${notas ? ` — ${notas}` : ''}`, ...(o ? [`    Observaciones: ${o}`] : [])];
            }),
        ].filter((l, i) => l !== '' || i === 4).join('\n');

        try {
            if (window.ClipboardItem && navigator.clipboard?.write) {
                await navigator.clipboard.write([new ClipboardItem({
                    'text/html':  new Blob([html],  { type: 'text/html' }),
                    'text/plain': new Blob([texto], { type: 'text/plain' }),
                })]);
            } else {
                await navigator.clipboard.writeText(texto);
            }
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
            if (onGuardarObservaciones) onGuardarObservaciones(obs).catch(e => console.error('Error guardando observaciones:', e));
        } catch (e) {
            alert('No se pudo copiar al portapapeles: ' + e.message);
        }
    };

    // ── UI ────────────────────────────────────────────────────────────────────
    const hojasVisibles = hojaFiltro === 'TODAS' ? hojas : hojas.filter(h => h.id === hojaFiltro);

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={s.panel} onClick={e => e.stopPropagation()}>
                <div style={s.header}>
                    <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem' }}>
                        <FileText size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} color="#1565C0"/>
                        Informe PDF — {grupo.nombre}
                    </h3>
                    <button onClick={onClose} style={s.closeBtn}><X size={18}/></button>
                </div>

                <label style={s.label}>Título del informe</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} style={s.input}/>

                {/* ── Criterios ── */}
                <div style={s.seccion}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <strong style={{ color: '#1565C0', fontSize: '0.9rem' }}>1. ¿Qué alumnos?</strong>
                        {hojas.length > 1 && (
                            <select value={hojaFiltro} onChange={e => setHojaFiltro(e.target.value)} style={{ ...s.input, width: 'auto', padding: '4px 8px', marginBottom: 0 }}>
                                {hojas.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                                <option value="TODAS">Todas las hojas</option>
                            </select>
                        )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#7f8c8d', marginBottom: 8 }}>
                        Marca los exámenes por los que filtrar e indica la nota: entran los alumnos con nota <strong>menor que</strong> ese valor.
                        La casilla 👁 añade la columna al informe sin usarla para filtrar. Sin ningún filtro, entran todos.
                    </div>

                    {hojasVisibles.map(h => (
                        <div key={h.id} style={{ marginBottom: 6 }}>
                            {hojaFiltro === 'TODAS' && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', margin: '6px 0 3px' }}>{h.nombre}</div>}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {criteriosDisponibles.filter(c => c.hoja.id === h.id).map(c => {
                                    const on = criterios[c.key] !== undefined;
                                    return (
                                        <div key={c.key} style={{ ...s.chip, borderColor: on ? '#1565C0' : '#dfe4ee', background: on ? '#e8f0fe' : 'white' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                                                <input type="checkbox" checked={on} onChange={() => toggleCriterio(c.key)}/>
                                                <span style={{ fontWeight: c.col ? 500 : 700 }}>{c.label}{c.tieneRecup ? ' ♻' : ''}</span>
                                            </label>
                                            {on ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#555' }}>&lt;</span>
                                                    <input value={criterios[c.key]} inputMode="decimal"
                                                        onChange={e => setCriterios(p => ({ ...p, [c.key]: e.target.value }))}
                                                        style={s.umbral}/>
                                                </span>
                                            ) : (
                                                <label title="Mostrar esta columna en el informe sin filtrar por ella" style={{ cursor: 'pointer', fontSize: '0.75rem', opacity: mostrarCols[c.key] ? 1 : 0.45 }}>
                                                    <input type="checkbox" checked={!!mostrarCols[c.key]} style={{ display: 'none' }}
                                                        onChange={() => setMostrarCols(p => ({ ...p, [c.key]: !p[c.key] }))}/>
                                                    👁
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10, fontSize: '0.8rem', color: '#2c3e50' }}>
                        {activos.length > 1 && (
                            <span style={{ display: 'flex', gap: 10 }}>
                                <label><input type="radio" checked={modo === 'alguno'} onChange={() => setModo('alguno')}/> En alguno de ellos</label>
                                <label><input type="radio" checked={modo === 'todos'} onChange={() => setModo('todos')}/> En todos ellos</label>
                            </span>
                        )}
                        <label><input type="checkbox" checked={conRecup} onChange={e => setConRecup(e.target.checked)}/> Usar la nota de recuperación si es más alta</label>
                        <label><input type="checkbox" checked={vacioCuenta} onChange={e => setVacioCuenta(e.target.checked)}/> Sin nota cuenta como por debajo</label>
                    </div>
                </div>

                {/* ── Alumnos y observaciones ── */}
                <div style={s.seccion}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <strong style={{ color: '#1565C0', fontSize: '0.9rem' }}>
                            2. Alumnos en el informe: {seleccionados.length} de {alumnos.length}
                        </strong>
                        {Object.keys(manual).length > 0 && (
                            <button onClick={() => setManual({})} style={s.btnLink}>Restablecer selección del filtro</button>
                        )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#7f8c8d', marginBottom: 8 }}>
                        Puedes marcar o desmarcar alumnos a mano y escribir observaciones, que saldrán debajo de cada alumno en el PDF.
                    </div>
                    <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e0e4f0', borderRadius: 8 }}>
                        {alumnos.map((a, i) => {
                            const inc = incluido(a);
                            return (
                                <div key={a.id} style={{ padding: '6px 10px', background: inc ? (i % 2 ? '#f3f8ff' : '#eaf2ff') : (i % 2 ? '#fafafa' : 'white'), borderBottom: '1px solid #eef0f5' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 160, fontWeight: inc ? 600 : 400, color: inc ? '#2c3e50' : '#95a5a6' }}>
                                            <input type="checkbox" checked={inc} onChange={() => setManual(p => ({ ...p, [a.id]: !inc }))}/>
                                            {a.nombre}
                                            {manual[a.id] !== undefined && <span style={{ fontSize: '0.65rem', color: '#e67e22' }}>(manual)</span>}
                                        </label>
                                        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {columnasInforme.map(c => {
                                                const v = valorCriterio(c, a.id);
                                                const u = aNum(criterios[c.key]);
                                                const bajo = !isNaN(v) && (!isNaN(u) ? v < u : v < 5);
                                                return (
                                                    <span key={c.key} title={c.label} style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 10, background: isNaN(v) ? '#eee' : bajo ? '#fdecea' : '#e8f5e9', color: isNaN(v) ? '#999' : bajo ? '#c0392b' : '#2e7d32', fontWeight: 600 }}>
                                                        {c.label.replace(/^#\d+\s*/, '').slice(0, 10)}: {fmt(v)}
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    </div>
                                    {inc && (
                                        <textarea value={obs[a.id] || ''} rows={1}
                                            onChange={e => setObs(p => ({ ...p, [a.id]: e.target.value }))}
                                            placeholder="Observación (opcional)…"
                                            style={s.obs}/>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <label style={{ ...s.label, marginTop: 12 }}>Comentario general (aparece al principio del informe, opcional)</label>
                    <textarea value={obsGeneral} onChange={e => setObsGeneral(e.target.value)} rows={2} style={{ ...s.input, resize: 'vertical' }}/>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={onClose} style={s.btnSec}>Cancelar</button>
                    <button onClick={copiarCorreo} disabled={!seleccionados.length}
                        title="Copia el informe como tabla para pegarlo en un correo (Gmail, Outlook…)"
                        style={{ ...s.btnSec, borderColor: copiado ? '#27ae60' : '#d0d7e2', color: copiado ? '#27ae60' : '#2c3e50', opacity: !seleccionados.length ? 0.6 : 1 }}>
                        {copiado ? '✓ Copiado, pégalo en el correo' : '✉ Copiar para correo'}
                    </button>
                    <button onClick={generarPDF} disabled={generando || !seleccionados.length}
                        style={{ ...s.btnPri, opacity: generando || !seleccionados.length ? 0.6 : 1 }}>
                        <FileText size={15}/> {generando ? 'Generando…' : 'Descargar PDF'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const s = {
    overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    panel:    { background: 'white', borderRadius: 14, padding: 20, width: '100%', maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' },
    header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#7f8c8d' },
    label:    { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#555', marginBottom: 4 },
    input:    { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d7e2', fontSize: '0.88rem', boxSizing: 'border-box', marginBottom: 6, fontFamily: 'inherit' },
    seccion:  { border: '1px solid #e0e4f0', borderRadius: 10, padding: 12, margin: '12px 0' },
    chip:     { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8, border: '1.5px solid', fontSize: '0.8rem' },
    umbral:   { width: 42, padding: '2px 4px', borderRadius: 5, border: '1px solid #1565C0', textAlign: 'center', fontSize: '0.8rem' },
    obs:      { width: '100%', marginTop: 5, padding: '5px 8px', borderRadius: 6, border: '1px solid #e0c97a', background: '#fffdf2', fontSize: '0.8rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' },
    btnLink:  { background: 'none', border: 'none', color: '#1565C0', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' },
    btnSec:   { padding: '9px 16px', borderRadius: 9, border: '1px solid #d0d7e2', background: 'white', cursor: 'pointer', fontWeight: 600 },
    btnPri:   { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#1565C0', color: 'white', fontWeight: 700, cursor: 'pointer' },
};
