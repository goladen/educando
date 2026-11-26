// Tarjeta ÚNICA de InformesJuegos2 para el test de phishing: agrupa todos los envíos
// tipo PHISHING (alumnos y profes) en una tabla con medias, mensajes que más engañan,
// detalle por persona, CSV y enlaces para compartir con el código ya puesto.
import React, { useMemo, useState } from "react";

const fecha = (f) => {
  const d = f?.toDate ? f.toDate() : f ? new Date(f) : null;
  if (!d || isNaN(d)) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
};
const ms = (f) => { const d = f?.toDate ? f.toDate() : f ? new Date(f) : null; return d && !isNaN(d) ? d.getTime() : 0; };
const colorPct = (p) => (p >= 80 ? "#1f9d55" : p >= 50 ? "#e67e22" : "#d64545");
const ROL = {
  alumno: { txt: "Alumno", emoji: "🎒", color: "#5b5bd6", bg: "#eef0ff" },
  profe: { txt: "Profe", emoji: "🍎", color: "#0f766e", bg: "#e6f6f3" },
};

export default function PhishingInformeCard({ infs, codigoProf, onBorrar, borrandoId, modoSeleccion, seleccionados, onSeleccionar, onBuscarJugador }) {
  const [abierta, setAbierta] = useState(true);
  const [filtro, setFiltro] = useState("todos"); // todos | alumno | profe
  const [orden, setOrden] = useState("fecha"); // fecha | nombre | nota
  const [detalle, setDetalle] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [copiado, setCopiado] = useState("");

  const filas = useMemo(() => infs.flatMap((inf) => (inf.jugadores || []).map((j, k) => {
    const rol = j.rol || (inf.test === "profes" ? "profe" : "alumno");
    const pct = j.porcentaje ?? (j.intentos > 0 ? Math.round((j.aciertos / j.intentos) * 100) : 0);
    return { key: `${inf.id}-${k}`, inf, j, rol, pct };
  })), [infs]);

  const resumen = (rol) => {
    const fs = filas.filter((f) => f.rol === rol);
    const media = fs.length ? Math.round(fs.reduce((s, f) => s + f.pct, 0) / fs.length) : null;
    const perfectos = fs.filter((f) => f.pct === 100).length;
    return { n: fs.length, media, perfectos };
  };
  const rA = resumen("alumno");
  const rP = resumen("profe");

  const visibles = useMemo(() => {
    const fs = filas.filter((f) => filtro === "todos" || f.rol === filtro);
    const c = [...fs];
    if (orden === "nombre") c.sort((a, b) => String(a.j.nombre || "").localeCompare(String(b.j.nombre || ""), "es"));
    else if (orden === "nota") c.sort((a, b) => b.pct - a.pct);
    else c.sort((a, b) => ms(b.inf.fecha) - ms(a.inf.fecha));
    return c;
  }, [filas, filtro, orden]);

  // Mensajes que más engañan (según el filtro)
  const engañan = useMemo(() => {
    const m = new Map();
    for (const f of filas) {
      if (filtro !== "todos" && f.rol !== filtro) continue;
      for (const r of f.j.repaso || []) {
        const k = `${f.rol}|${r.id || r.enunciado}`;
        const e = m.get(k) || { titulo: r.enunciado, rol: f.rol, correcta: r.correcta, fallos: 0, total: 0 };
        e.total += 1;
        if (!r.ok) e.fallos += 1;
        m.set(k, e);
      }
    }
    return [...m.values()].filter((e) => e.fallos > 0).sort((a, b) => b.fallos / b.total - a.fallos / a.total || b.fallos - a.fallos).slice(0, 8);
  }, [filas, filtro]);

  const descargarCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cab = ["Fecha", "Nombre", "Curso / departamento", "Test", "Aciertos", "Total", "%", "Mensajes fallados"];
    const lineas = visibles.map((f) => [
      fecha(f.inf.fecha), f.j.nombre, f.j.curso, ROL[f.rol].txt, f.j.aciertos ?? 0, f.j.intentos ?? 0, f.pct,
      (f.j.repaso || []).filter((r) => !r.ok).map((r) => r.enunciado).join(" | "),
    ].map(esc).join(";"));
    const blob = new Blob(["﻿" + [cab.map(esc).join(";"), ...lineas].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `phishing-resultados-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  const copiar = async (txt, cual) => {
    try { await navigator.clipboard.writeText(txt); setCopiado(cual); setTimeout(() => setCopiado(""), 1800); } catch { /* nada */ }
  };
  const base = typeof window !== "undefined" ? window.location.origin : "https://www.pikt.es";
  const enlaces = codigoProf ? [
    ["alumnos", "🎒 Alumnos", `${base}/phishing/alumnos?codigo=${encodeURIComponent(codigoProf)}`],
    ["profes", "🍎 Profes", `${base}/phishing/profes?codigo=${encodeURIComponent(codigoProf)}`],
  ] : [];

  const chip = (activo, color) => ({
    padding: "4px 11px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${activo ? color : "#dfe3ea"}`, background: activo ? color : "white", color: activo ? "white" : "#5b6478",
  });
  const caja = { flex: "1 1 150px", background: "#f8f9fc", borderRadius: 10, padding: "9px 12px", border: "1px solid #eef0f5" };

  return (
    <div style={{ background: "white", borderRadius: 13, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1.5px solid #dcdcf7" }}>
      {/* Cabecera */}
      <div onClick={() => setAbierta((v) => !v)} style={{ padding: "11px 15px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer" }}>
        <span style={{ fontSize: "1.5rem" }}>🎣</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, color: "#2c3e50", fontSize: "0.95rem" }}>¿Phishing o legítimo? · todos los resultados</div>
          <div style={{ fontSize: "0.75rem", color: "#95a5a6" }}>
            {filas.length} envío(s) · 🎒 {rA.n} alumno(s) · 🍎 {rP.n} profe(s) · último {fecha(infs.reduce((a, i) => (ms(i.fecha) > ms(a.fecha) ? i : a), infs[0])?.fecha)}
          </div>
        </div>
        {rA.media != null && <span style={{ padding: "2px 9px", borderRadius: 20, background: ROL.alumno.bg, fontWeight: 700, fontSize: "0.78rem", color: ROL.alumno.color }}>🎒 media {rA.media}%</span>}
        {rP.media != null && <span style={{ padding: "2px 9px", borderRadius: 20, background: ROL.profe.bg, fontWeight: 700, fontSize: "0.78rem", color: ROL.profe.color }}>🍎 media {rP.media}%</span>}
        <span style={{ color: "#95a5a6", fontSize: "0.9rem" }}>{abierta ? "▴" : "▾"}</span>
      </div>

      {abierta && (
        <div style={{ borderTop: "1px solid #f0f0f5", padding: "12px 15px 15px" }}>
          {/* Resumen */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {[["alumno", rA], ["profe", rP]].map(([rol, r]) => (
              <div key={rol} style={caja}>
                <div style={{ fontSize: "0.75rem", color: "#7f8c8d", fontWeight: 700 }}>{ROL[rol].emoji} {rol === "alumno" ? "Alumnos" : "Profes"}</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: r.media != null ? colorPct(r.media) : "#bbb" }}>{r.media != null ? `${r.media}%` : "—"}</div>
                <div style={{ fontSize: "0.72rem", color: "#95a5a6" }}>{r.n} resultado(s) · {r.perfectos} con todo bien</div>
              </div>
            ))}
            {enlaces.length > 0 && (
              <div style={{ ...caja, flex: "2 1 260px" }}>
                <div style={{ fontSize: "0.75rem", color: "#7f8c8d", fontWeight: 700, marginBottom: 4 }}>🔗 Enlaces con tu código ya puesto</div>
                {enlaces.map(([k, txt, url]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, minWidth: 74 }}>{txt}</span>
                    <span style={{ flex: 1, fontSize: "0.72rem", color: "#5b6478", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
                    <button onClick={() => copiar(url, k)} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #dfe3ea", background: "white", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>
                      {copiado === k ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controles */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <span style={chip(filtro === "todos", "#2c3e50")} onClick={() => setFiltro("todos")}>Todos ({filas.length})</span>
            <span style={chip(filtro === "alumno", ROL.alumno.color)} onClick={() => setFiltro("alumno")}>🎒 Alumnos ({rA.n})</span>
            <span style={chip(filtro === "profe", ROL.profe.color)} onClick={() => setFiltro("profe")}>🍎 Profes ({rP.n})</span>
            <span style={{ flex: 1 }} />
            <select value={orden} onChange={(e) => setOrden(e.target.value)} style={{ padding: "4px 8px", borderRadius: 7, border: "1px solid #dfe3ea", fontSize: "0.78rem" }}>
              <option value="fecha">Más recientes</option>
              <option value="nombre">Por nombre</option>
              <option value="nota">Por nota</option>
            </select>
            <button onClick={descargarCsv} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #dfe3ea", background: "white", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 }}>⬇️ CSV</button>
          </div>

          {/* Tabla */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#7f8c8d", fontSize: "0.74rem" }}>
                  {modoSeleccion && <th style={{ padding: "6px 4px" }} />}
                  <th style={{ padding: "6px 6px" }}>Nombre</th>
                  <th style={{ padding: "6px 6px" }}>Curso / dpto.</th>
                  <th style={{ padding: "6px 6px" }}>Test</th>
                  <th style={{ padding: "6px 6px", textAlign: "center" }}>Nota</th>
                  <th style={{ padding: "6px 6px" }}>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const fallados = (f.j.repaso || []).filter((r) => !r.ok);
                  const abierto = detalle === f.key;
                  return (
                    <React.Fragment key={f.key}>
                      <tr style={{ borderTop: "1px solid #f0f0f5", background: abierto ? "#fafbff" : "white" }}>
                        {modoSeleccion && (
                          <td style={{ padding: "6px 4px" }}>
                            <input type="checkbox" checked={seleccionados?.has(f.inf.id) || false} onChange={() => onSeleccionar?.(f.inf.id)} style={{ width: 16, height: 16, accentColor: "#1565C0" }} />
                          </td>
                        )}
                        <td style={{ padding: "6px 6px", fontWeight: 600, color: "#2c3e50" }}>
                          <span onClick={() => onBuscarJugador?.(f.j.nombre)} style={{ cursor: "pointer", borderBottom: "1px dotted #aaa" }}>{f.j.nombre || "—"}</span>
                        </td>
                        <td style={{ padding: "6px 6px", color: "#7f8c8d" }}>{f.j.curso || ""}</td>
                        <td style={{ padding: "6px 6px" }}>
                          <span style={{ padding: "1px 7px", borderRadius: 12, background: ROL[f.rol].bg, color: ROL[f.rol].color, fontWeight: 700, fontSize: "0.72rem", whiteSpace: "nowrap" }}>{ROL[f.rol].emoji} {ROL[f.rol].txt}</span>
                        </td>
                        <td style={{ padding: "6px 6px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <b style={{ color: colorPct(f.pct) }}>{f.j.aciertos ?? 0}/{f.j.intentos ?? 0}</b>
                          <span style={{ color: "#95a5a6", fontSize: "0.74rem" }}> · {f.pct}%</span>
                        </td>
                        <td style={{ padding: "6px 6px", color: "#95a5a6", fontSize: "0.76rem", whiteSpace: "nowrap" }}>{fecha(f.inf.fecha)}</td>
                        <td style={{ padding: "6px 4px", whiteSpace: "nowrap", textAlign: "right" }}>
                          {fallados.length > 0 && (
                            <button onClick={() => setDetalle(abierto ? null : f.key)} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #f3d3d3", background: "#fdf2f2", color: "#c0392b", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700, marginRight: 4 }}>
                              ✗ {fallados.length} {abierto ? "▴" : "▾"}
                            </button>
                          )}
                          {!modoSeleccion && (
                            <button onClick={() => setConfirmar(confirmar === f.inf.id ? null : f.inf.id)} title="Eliminar" style={{ padding: "2px 7px", borderRadius: 6, border: "1px solid #fdd", background: "#fdecea", color: "#e74c3c", cursor: "pointer", fontSize: "0.75rem" }}>🗑</button>
                          )}
                        </td>
                      </tr>
                      {confirmar === f.inf.id && (
                        <tr>
                          <td colSpan={modoSeleccion ? 7 : 6} style={{ background: "#fdecea", padding: "7px 10px", fontSize: "0.8rem" }}>
                            <span style={{ color: "#c0392b", marginRight: 10 }}>¿Eliminar el resultado de {f.j.nombre || "este jugador"}?</span>
                            <button onClick={() => { setConfirmar(null); onBorrar?.(f.inf.id); }} disabled={borrandoId === f.inf.id} style={{ padding: "3px 11px", borderRadius: 6, border: "none", background: "#e74c3c", color: "white", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem", marginRight: 6 }}>
                              {borrandoId === f.inf.id ? "Borrando…" : "Eliminar"}
                            </button>
                            <button onClick={() => setConfirmar(null)} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: "0.78rem" }}>Cancelar</button>
                          </td>
                        </tr>
                      )}
                      {abierto && (
                        <tr>
                          <td colSpan={modoSeleccion ? 7 : 6} style={{ padding: "4px 10px 10px", background: "#fafbff" }}>
                            {fallados.map((r, i) => (
                              <div key={i} style={{ fontSize: "0.8rem", padding: "3px 0", color: "#2c3e50" }}>
                                <span style={{ color: "#d64545", fontWeight: 800 }}>✗</span> {r.enunciado}
                                <span style={{ color: "#95a5a6" }}> — dijo «{r.dada}», era <b style={{ color: r.correcta === "Phishing" ? "#d64545" : "#1f9d55" }}>{r.correcta}</b></span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mensajes que más engañan */}
          {engañan.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, color: "#2c3e50", fontSize: "0.86rem", marginBottom: 6 }}>🪝 Los mensajes que más engañan</div>
              {engañan.map((e) => {
                const p = Math.round((e.fallos / e.total) * 100);
                return (
                  <div key={`${e.rol}-${e.titulo}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", padding: "3px 0" }}>
                    <span style={{ width: 18 }}>{ROL[e.rol].emoji}</span>
                    <span style={{ flex: "1 1 200px", minWidth: 0, color: "#2c3e50" }}>
                      {e.titulo} <span style={{ color: e.correcta === "Phishing" ? "#d64545" : "#1f9d55", fontSize: "0.72rem", fontWeight: 700 }}>({e.correcta})</span>
                    </span>
                    <span style={{ flex: "0 0 110px", height: 8, background: "#f0f0f5", borderRadius: 4, overflow: "hidden" }}>
                      <span style={{ display: "block", width: `${p}%`, height: "100%", background: colorPct(100 - p) }} />
                    </span>
                    <span style={{ width: 92, textAlign: "right", color: "#7f8c8d", fontSize: "0.74rem" }}>{e.fallos}/{e.total} fallan</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
