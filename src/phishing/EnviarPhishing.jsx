// Modal «Enviar al profesor» del test de phishing.
// Guarda en informes_juegos (tipo PHISHING). En InformesJuegos2 todos los envíos de
// PHISHING (alumnos y profes) se agrupan en una sola tarjeta: PhishingInformeCard.
import React, { useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { validarNombre } from "../utils/filtroNombres";

export const codigoDeUrl = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return (p.get("codigo") || p.get("profe") || "").trim().toUpperCase().slice(0, 12);
  } catch { return ""; }
};

export default function EnviarPhishing({ modo, nombreInicial = "", resultados, color = "#5b5bd6", onClose }) {
  const esProfe = modo === "profes";
  const [nombre, setNombre] = useState(nombreInicial);
  const [curso, setCurso] = useState("");
  const [codigo, setCodigo] = useState(codigoDeUrl());
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const aciertos = resultados.filter((r) => r.ok).length;
  const intentos = resultados.length;

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    const v = validarNombre(nombre);
    if (!v.ok) { setError(v.mensaje); return; }
    if (!code) { setError("Escribe el código del profesor."); return; }
    setEnviando(true); setError("");
    try {
      const snap = await getDoc(doc(db, "codigos_profesor", code));
      if (!snap.exists()) { setError("Código no encontrado. Revísalo con tu profesor o coordinador."); setEnviando(false); return; }
      await addDoc(collection(db, "informes_juegos"), {
        tipo: "PHISHING",
        modalidad: "Individual",
        fecha: new Date(),
        codigoProfesor: code,
        test: esProfe ? "profes" : "alumnos",
        jugadores: [{
          nombre: nombre.trim().slice(0, 60),
          curso: curso.trim().slice(0, 60),
          rol: esProfe ? "profe" : "alumno",
          aciertos,
          intentos,
          porcentaje: Math.round((aciertos / Math.max(1, intentos)) * 100),
          repaso: resultados.map((r) => ({
            id: r.s.id,
            enunciado: r.s.titulo,
            ok: r.ok,
            correcta: r.s.respuesta === "phishing" ? "Phishing" : "Legítimo",
            dada: r.ok ? (r.s.respuesta === "phishing" ? "Phishing" : "Legítimo") : (r.s.respuesta === "phishing" ? "Legítimo" : "Phishing"),
          })),
        }],
      });
      setEnviado(true);
    } catch (e) {
      setError("No se ha podido enviar: " + (e?.message || e));
    }
    setEnviando(false);
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "11px 13px", fontSize: 15, borderRadius: 10, border: "1px solid #d6dbe6", fontFamily: "inherit", marginTop: 5 };
  const lab = { display: "block", fontWeight: 700, fontSize: 13.5, color: "#1d2433", marginBottom: 12 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,20,35,.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 400, padding: "24px 24px 20px", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", boxShadow: "0 20px 50px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 19 }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 800, color: "#1f9d55", fontSize: 18 }}>¡Resultado enviado!</div>
            <div style={{ color: "#5b6478", marginTop: 6 }}>{aciertos} / {intentos} aciertos</div>
            <button onClick={onClose} style={{ marginTop: 18, padding: "10px 26px", borderRadius: 10, border: "none", background: color, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
          </div>
        ) : (
          <>
            <div style={{ background: "#f5f6fb", borderRadius: 10, padding: "9px 12px", fontSize: 14, marginBottom: 14 }}>
              {esProfe ? "🍎 Test para profes" : "🎒 Test para alumnos"} · <b>{aciertos} / {intentos}</b> aciertos
            </div>
            <label style={lab}>Nombre y apellido
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Tu nombre completo" style={inp} />
            </label>
            <label style={lab}>{esProfe ? "Departamento o centro" : "Curso"}
              <input value={curso} onChange={(e) => setCurso(e.target.value)} maxLength={60} placeholder={esProfe ? "Ej: Matemáticas · IES Río Verde" : "Ej: 2.º ESO B"} style={inp} />
            </label>
            <label style={lab}>Código del profesor
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={12} placeholder="Ej: PROF01" style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
            </label>
            {error && <div style={{ color: "#d64545", fontSize: 13.5, marginBottom: 10 }}>⚠ {error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid #d6dbe6", background: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 11, borderRadius: 10, border: "none", background: enviando ? "#9aa1b2" : color, color: "#fff", fontWeight: 800, cursor: enviando ? "default" : "pointer", fontSize: 15 }}>
                {enviando ? "Enviando…" : "📤 Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
