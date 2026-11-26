// PhishingQuiz.jsx — pikt.es
// «¿Phishing o legítimo?»: dos tests (alumnos / profes) con mensajes simulados realistas:
// cliente de correo (detalles del remitente, adjuntos, barra de estado al pasar por enlaces),
// navegador (barra de direcciones) y móvil (SMS, WhatsApp, Instagram).
// Rutas públicas: /phishing, /phishing/alumnos, /phishing/profes (con y sin login).
// Registro local tipo PHISHING (icono Pi ×N). Los escenarios están en ./escenarios.js.
import React, { useState, useEffect, useRef, useContext, createContext } from "react";
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from "../utils/sonidosFeedback";
import { guardarRegistroLocal } from "../utils/registrosLocales";
import { ESCENARIOS_ALUMNOS, ESCENARIOS_PROFES, REGLAS } from "./escenarios";
import EnviarPhishing from "./EnviarPhishing";

const C = {
  bg: "#eef1f7",
  card: "#ffffff",
  ink: "#1d2433",
  soft: "#5b6478",
  line: "#e2e6ef",
  primary: "#5b5bd6",
  ok: "#1f9d55",
  okBg: "#e7f7ee",
  bad: "#d64545",
  badBg: "#fdecec",
  mark: "#ff9f0a",
};
const FUENTE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

const TESTS = {
  alumnos: {
    nombre: "Test para alumnos", emoji: "🎒", color: "#5b5bd6", escenarios: ESCENARIOS_ALUMNOS,
    desc: "Cuentas del instituto, redes sociales, videojuegos, WhatsApp y SMS.",
    nombreDef: "Alex", emailDef: "alex.garcia@alumnos.iesrioverde.es",
  },
  profes: {
    nombre: "Test para profes", emoji: "🍎", color: "#0f766e", escenarios: ESCENARIOS_PROFES,
    desc: "Correo del centro, Microsoft 365, familias, facturas, Hacienda y fraude del «director».",
    nombreDef: "Carmen", emailDef: "carmen.ruiz@iesrioverde.es",
  },
};

// ---------------------------------------------------------------------------
// Contexto: corregido (show), sustitución de {nombre}/{email}, barra de estado
// ---------------------------------------------------------------------------
const Ctx = createContext({ show: false, fx: (s) => s, peek: null, setPeek: () => {}, datos: {} });
const useCtx = () => useContext(Ctx);

function Badge({ n }) {
  return (
    <span style={{
      position: "absolute", top: -11, right: -11, width: 21, height: 21, borderRadius: "50%",
      background: C.mark, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 3, boxShadow: "0 1px 3px rgba(0,0,0,.25)",
      fontFamily: FUENTE, lineHeight: 1,
    }}>{n}</span>
  );
}

// Resalta un elemento con su número de pista cuando ya se ha respondido.
function Mark({ n, children, bloque }) {
  const { show } = useCtx();
  if (!n || !show) return <>{children}</>;
  return (
    <span style={{
      position: "relative", display: bloque ? "inline-block" : "inline",
      outline: `2px solid ${C.mark}`, outlineOffset: 1, background: "rgba(255,159,10,.15)", borderRadius: 4,
    }}>
      {children}
      <Badge n={n} />
    </span>
  );
}

// Elemento «pasable»: al pasar el ratón (o tocar) muestra info en la barra de estado.
function Hover({ info, children }) {
  const { setPeek } = useCtx();
  return (
    <span
      style={{ cursor: "pointer" }}
      onMouseEnter={() => setPeek(info)}
      onMouseLeave={() => setPeek(null)}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPeek(info); }}
    >
      {children}
    </span>
  );
}

// Fija abajo a la izquierda de la pantalla, como la barra de estado de un navegador.
function BarraEstado() {
  const { peek } = useCtx();
  if (!peek) return null;
  return (
    <div style={{
      position: "fixed", left: 0, bottom: 0, maxWidth: "min(92vw, 720px)", background: "#f1f3f4",
      border: "1px solid #c9ced6", borderLeft: "none", borderBottom: "none", borderTopRightRadius: 8,
      padding: "6px 12px", fontSize: 13.5, color: "#202124", fontFamily: FUENTE,
      wordBreak: "break-all", zIndex: 60, boxShadow: "0 -2px 8px rgba(0,0,0,.10)",
    }}>
      {peek}
    </div>
  );
}

const colorDe = (txt = "") => {
  const cols = ["#1a73e8", "#d93025", "#188038", "#e37400", "#9334e6", "#00796b", "#c2185b", "#5f6368"];
  let h = 0;
  for (const ch of txt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return cols[h % cols.length];
};
const valor = (x) => (x && typeof x === "object" ? x.v : x);
const pistaDe = (x) => (x && typeof x === "object" ? x.pista : undefined);

// ---------------------------------------------------------------------------
// Cliente de correo
// ---------------------------------------------------------------------------
const EXT_INFO = {
  pdf: ["PDF", "#d93025", "Documento PDF"],
  zip: ["ZIP", "#5f6368", "Archivo comprimido"],
  xls: ["XLS", "#188038", "Hoja de cálculo de Excel"],
  htm: ["HTML", "#e37400", "Página web (HTML)"],
  exe: ["EXE", "#3c4043", "Aplicación"],
  doc: ["DOC", "#1a73e8", "Documento de Word"],
  img: ["IMG", "#9334e6", "Imagen"],
};
const descAdjunto = (a) => {
  const ext = (a.nombre.split(".").pop() || "").toLowerCase();
  if (ext === "xlsm") return "Libro de Excel habilitado para macros";
  return (EXT_INFO[a.tipo] || EXT_INFO.doc)[2];
};

function Adjunto({ a }) {
  const [etq, col] = EXT_INFO[a.tipo] || EXT_INFO.doc;
  return (
    <Mark n={a.pista} bloque>
      <Hover info={`📎 ${a.nombre} · ${descAdjunto(a)} · ${a.tamano}`}>
        <span style={{ display: "inline-flex", flexDirection: "column", width: 176, border: "1px solid #dadce0", borderRadius: 8, overflow: "hidden", background: "#fff", verticalAlign: "top" }}>
          <span style={{ height: 70, background: "#f1f3f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ background: col, color: "#fff", fontWeight: 800, fontSize: 13, padding: "6px 9px", borderRadius: 4 }}>{etq}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", fontSize: 13 }}>
            <span style={{ background: col, color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 4px", borderRadius: 2 }}>{etq}</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#3c4043" }}>{a.nombre}</span>
          </span>
        </span>
      </Hover>
    </Mark>
  );
}

const P = { margin: "0 0 12px", whiteSpace: "pre-line" };

function Bloque({ b }) {
  const { fx } = useCtx();
  if (typeof b === "string") return <p style={P}>{fx(b)}</p>;
  if (b.cabecera) {
    return (
      <div style={{ fontWeight: 800, fontSize: 19, color: b.color || C.ink, paddingBottom: 12, marginBottom: 16, borderBottom: "1px solid #eceff3", letterSpacing: 0.2 }}>
        {b.cabecera}
      </div>
    );
  }
  if (b.boton) {
    return (
      <div style={{ margin: "18px 0" }}>
        <Mark n={b.pista} bloque>
          <Hover info={b.url}>
            <span style={{ display: "inline-block", padding: "11px 22px", background: b.color || "#1a73e8", color: "#fff", borderRadius: 4, fontWeight: 600, fontSize: 14.5, userSelect: "none" }}>
              {b.boton}
            </span>
          </Hover>
        </Mark>
      </div>
    );
  }
  if (b.enlace) {
    return (
      <p style={P}>
        <Mark n={b.pista}>
          <Hover info={b.url}><span style={{ color: "#1a73e8", textDecoration: "underline", wordBreak: "break-all" }}>{b.enlace}</span></Hover>
        </Mark>
      </p>
    );
  }
  if (b.codigo) return <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, margin: "6px 0 16px" }}>{b.codigo}</div>;
  if (b.firma) return <p style={{ ...P, fontSize: 12.5, color: "#70757a", marginTop: 22 }}>{fx(b.firma)}</p>;
  if (b.p) return <p style={P}><Mark n={b.pista}>{fx(b.p)}</Mark></p>;
  return null;
}

function FilaDetalle({ k, v, pista }) {
  if (!v) return null;
  return (
    <tr>
      <td style={{ color: "#70757a", textAlign: "right", padding: "3px 10px 3px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}:</td>
      <td style={{ padding: "3px 0", wordBreak: "break-all" }}><Mark n={pista}>{v}</Mark></td>
    </tr>
  );
}

function Correo({ s }) {
  const { show, fx, datos } = useCtx();
  const [abierto, setAbierto] = useState(false);
  const d = s.detalles || {};
  const pistaEnDetalles = Object.values(d).some((x) => pistaDe(x));
  const verDetalles = abierto || (show && pistaEnDetalles);
  const ini = (s.de.nombre || "?").trim()[0].toUpperCase();

  return (
    <div style={{ position: "relative", background: "#fff", borderRadius: 14, border: "1px solid #d7dbe2", overflow: "hidden", boxShadow: "0 6px 24px rgba(30,40,70,.08)", fontFamily: FUENTE, color: "#202124" }}>
      {/* barra superior del cliente */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f6f8fc", borderBottom: "1px solid #e8eaed" }}>
        <span style={{ fontSize: 18, color: "#5f6368" }}>☰</span>
        <span style={{ fontWeight: 700, fontSize: 17, color: "#444" }}>✉️ Correo</span>
        <span style={{ flex: 1, background: "#e9eef6", borderRadius: 20, padding: "7px 14px", fontSize: 13.5, color: "#5f6368", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden" }}>🔍 Buscar en el correo</span>
        <span style={{ width: 30, height: 30, borderRadius: "50%", background: colorDe(datos.nombre), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
          {(datos.nombre || "?")[0].toUpperCase()}
        </span>
      </div>
      {/* acciones */}
      <div style={{ display: "flex", gap: 18, padding: "8px 18px", color: "#5f6368", fontSize: 16, borderBottom: "1px solid #f1f3f4" }}>
        <span>←</span><span title="Archivar">🗄️</span><span title="Spam">⚠️</span><span title="Eliminar">🗑️</span><span title="No leído">✉️</span><span title="Posponer">🕒</span><span>⋮</span>
      </div>

      <div style={{ padding: "16px 20px 22px" }}>
        {/* asunto */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontSize: 21, fontWeight: 500, lineHeight: 1.3 }}>
            <Mark n={s.asuntoPista}>{fx(s.asunto)}</Mark>
          </div>
          <span style={{ fontSize: 12, background: "#eceff1", color: "#444", padding: "2px 8px", borderRadius: 4 }}>Recibidos ×</span>
        </div>

        {/* remitente */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: colorDe(s.de.nombre), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>{ini}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14.5, minWidth: 0, wordBreak: "break-word" }}>
                <b>{fx(s.de.nombre)}</b>{" "}
                <Mark n={s.de.pista}><span style={{ color: "#5f6368", fontSize: 13 }}>&lt;{s.de.email}&gt;</span></Mark>
              </div>
              <div style={{ fontSize: 12.5, color: "#5f6368", whiteSpace: "nowrap" }}>{s.fecha} ☆ ↩ ⋮</div>
            </div>
            <button
              onClick={() => setAbierto((v) => !v)}
              style={{ background: "none", border: "none", padding: "2px 0", color: "#5f6368", fontSize: 12.5, cursor: "pointer", fontFamily: FUENTE }}
            >
              para mí {verDetalles ? "▴" : "▾"}
            </button>
            {verDetalles && (
              <div style={{ border: "1px solid #dadce0", borderRadius: 6, padding: "10px 12px", marginTop: 4, fontSize: 12.5, boxShadow: "0 2px 8px rgba(0,0,0,.08)", maxWidth: 560 }}>
                <table style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    <FilaDetalle k="de" v={`${fx(s.de.nombre)} <${s.de.email}>`} pista={s.de.pista} />
                    <FilaDetalle k="responder a" v={valor(d.responderA)} pista={pistaDe(d.responderA)} />
                    <FilaDetalle k="para" v={`${datos.nombre} <${datos.email}>`} />
                    <FilaDetalle k="fecha" v={s.fecha} />
                    <FilaDetalle k="asunto" v={fx(s.asunto)} />
                    <FilaDetalle k="enviado por" v={valor(d.enviadoPor)} pista={pistaDe(d.enviadoPor)} />
                    <FilaDetalle k="firmado por" v={valor(d.firmadoPor)} pista={pistaDe(d.firmadoPor)} />
                    <FilaDetalle k="seguridad" v={valor(d.seguridad)} pista={pistaDe(d.seguridad)} />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* cuerpo */}
        <div style={{ padding: "18px 0 0 52px", fontSize: 14.5, lineHeight: 1.6 }} className="phq-cuerpo">
          {s.cuerpo.map((b, i) => <Bloque key={i} b={b} />)}

          {s.adjuntos?.length > 0 && (
            <div style={{ borderTop: "1px solid #eceff1", marginTop: 18, paddingTop: 12 }}>
              <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 10 }}>
                {s.adjuntos.length === 1 ? "Un archivo adjunto" : `${s.adjuntos.length} archivos adjuntos`} · Analizado por el antivirus del correo
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {s.adjuntos.map((a) => <Adjunto key={a.nombre} a={a} />)}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            {["↩ Responder", "↪ Reenviar"].map((t) => (
              <span key={t} style={{ border: "1px solid #747775", borderRadius: 18, padding: "7px 16px", fontSize: 13.5, color: "#444" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
      <BarraEstado />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
function Navegador({ s }) {
  const { datos, setPeek } = useCtx();
  const sinEsquema = s.url.replace(/^https?:\/\//, "");
  const corte = sinEsquema.indexOf("/");
  const host = corte >= 0 ? sinEsquema.slice(0, corte) : sinEsquema;
  const ruta = corte >= 0 ? sinEsquema.slice(corte) : "";
  const https = s.url.startsWith("https://");
  const pg = s.pagina;
  const campo = { width: "100%", boxSizing: "border-box", border: "1px solid #c4c7c5", borderRadius: 6, padding: "13px 14px", fontSize: 15, marginBottom: 14, fontFamily: FUENTE, background: "#fff", color: "#202124" };

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #c9ced6", boxShadow: "0 6px 24px rgba(30,40,70,.10)", fontFamily: FUENTE, background: "#fff" }}>
      {/* pestañas */}
      <div style={{ background: "#dee1e6", padding: "8px 10px 0", display: "flex", alignItems: "flex-end", gap: 8 }}>
        <span style={{ display: "flex", gap: 6, padding: "0 6px 10px" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />)}
        </span>
        <span style={{ background: "#fff", borderRadius: "8px 8px 0 0", padding: "8px 12px", fontSize: 12.5, color: "#3c4043", display: "flex", gap: 8, alignItems: "center", maxWidth: 240, minWidth: 0 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: colorDe(pg.marca), flexShrink: 0 }} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.pestana}</span>
          <span style={{ color: "#777" }}>×</span>
        </span>
        <span style={{ color: "#555", paddingBottom: 8 }}>＋</span>
      </div>
      {/* barra de direcciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #e3e5e8" }}>
        <span style={{ color: "#5f6368", fontSize: 15, whiteSpace: "nowrap" }}>←&nbsp; →&nbsp; ⟳</span>
        <div style={{ flex: 1, minWidth: 0, background: "#f1f3f4", borderRadius: 18, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <Mark n={s.candadoPista}>
            <span title={https ? "La conexión es segura" : "No seguro"} style={{ fontSize: 13, color: https ? "#5f6368" : C.bad, whiteSpace: "nowrap" }}>
              {https ? "🔒" : "⚠️ No seguro"}
            </span>
          </Mark>
          <span style={{ minWidth: 0, overflow: "hidden", wordBreak: "break-all" }}>
            <Mark n={s.urlPista}>
              <span style={{ color: "#202124" }}>{host}</span>
              <span style={{ color: "#80868b" }}>{ruta}</span>
            </Mark>
          </span>
        </div>
      </div>
      {/* página */}
      <div style={{ background: "#f0f4f9", padding: "34px 16px 44px", display: "flex", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 24, padding: "30px 28px", width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#5f6368", marginBottom: 18, letterSpacing: 0.3 }}>{pg.marca}</div>
          <div style={{ fontSize: 26, color: "#1f1f1f", marginBottom: 6 }}>{pg.titulo}</div>
          <div style={{ fontSize: 14.5, color: "#444746", marginBottom: 22 }}>{pg.sub}</div>
          {pg.campos.includes("email") && <input readOnly value={datos.email} aria-label="Correo (simulación)" style={campo} />}
          {pg.campos.includes("password") && <input readOnly type="password" placeholder="Introduce tu contraseña" aria-label="Contraseña (simulación)" style={campo} />}
          <div style={{ fontSize: 13.5, color: "#0b57d0", fontWeight: 600, marginBottom: 26 }}>¿Has olvidado tu correo electrónico?</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span
              onClick={() => setPeek("Es una simulación: aquí no se envía nada. Decide abajo si te fiarías 😉")}
              style={{ background: "#0b57d0", color: "#fff", borderRadius: 20, padding: "10px 24px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
            >
              {pg.boton}
            </span>
          </div>
        </div>
      </div>
      <BarraEstado />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Móvil: SMS, WhatsApp, Instagram
// ---------------------------------------------------------------------------
const ESTILO_APP = {
  whatsapp: { cab: "#008069", cabTxt: "#fff", fondo: "#efeae2", ellos: "#ffffff", yo: "#d9fdd3", yoTxt: "#111", sub: "rgba(255,255,255,.85)" },
  sms:      { cab: "#f6f6f8", cabTxt: "#111", fondo: "#ffffff", ellos: "#e9e9eb", yo: "#0b84fe", yoTxt: "#fff", sub: "#8e8e93" },
  instagram:{ cab: "#ffffff", cabTxt: "#111", fondo: "#ffffff", ellos: "#efefef", yo: "#3797f0", yoTxt: "#fff", sub: "#737373" },
};

function Partes({ partes, colorEnlace }) {
  const { fx } = useCtx();
  return partes.map((p, i) => {
    if (typeof p === "string") return <span key={i}>{fx(p)}</span>;
    if (p.enlace) {
      return (
        <Mark key={i} n={p.pista}>
          <Hover info={p.url}><span style={{ color: colorEnlace, textDecoration: "underline", wordBreak: "break-all" }}>{p.enlace}</span></Hover>
        </Mark>
      );
    }
    return <Mark key={i} n={p.pista}>{fx(p.t)}</Mark>;
  });
}

function Movil({ s }) {
  const { fx } = useCtx();
  const st = ESTILO_APP[s.tipo];
  const c = s.contacto;
  const ini = c.nombre[0] === "+" ? "👤" : c.nombre[0].toUpperCase();
  const avatar = (
    <span style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 15, color: "#fff",
      background: s.tipo === "instagram" ? "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)" : s.tipo === "sms" ? "#a2a7b0" : colorDe(c.nombre),
    }}>{ini}</span>
  );

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", background: "#111", borderRadius: 42, padding: 10, boxShadow: "0 10px 30px rgba(20,30,60,.25)" }}>
      <div style={{ position: "relative", borderRadius: 33, overflow: "hidden", background: st.fondo, fontFamily: FUENTE, display: "flex", flexDirection: "column", minHeight: 560 }}>
        {/* barra de estado del móvil */}
        <div style={{ background: st.cab, color: st.cabTxt, display: "flex", justifyContent: "space-between", padding: "10px 22px 4px", fontSize: 13, fontWeight: 600 }}>
          <span>10:42</span><span>📶 🔋</span>
        </div>
        {/* cabecera de la app */}
        {s.tipo === "sms" ? (
          <div style={{ background: st.cab, textAlign: "center", padding: "6px 12px 10px", borderBottom: "1px solid #e1e1e6", position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 14, color: "#0b84fe", fontSize: 20 }}>‹</span>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{avatar}</div>
            <div style={{ fontSize: 13, color: "#111" }}><Mark n={c.pista}>{fx(c.nombre)}</Mark> ›</div>
          </div>
        ) : (
          <div style={{ background: st.cab, color: st.cabTxt, display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 10px", borderBottom: s.tipo === "instagram" ? "1px solid #efefef" : "none" }}>
            <span style={{ fontSize: 20 }}>‹</span>
            {avatar}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <Mark n={c.pista}>{fx(c.nombre)}</Mark>
              </div>
              <div style={{ fontSize: 12, color: st.sub }}>{c.sub}</div>
            </div>
            <span style={{ fontSize: 16, opacity: 0.9 }}>{s.tipo === "whatsapp" ? "📹 📞 ⋮" : "📞 📹"}</span>
          </div>
        )}
        {/* mensajes */}
        <div style={{ flex: 1, padding: "16px 12px 70px", display: "flex", flexDirection: "column", gap: 8 }}>
          {s.tipo === "whatsapp" && (
            <div style={{ alignSelf: "center", background: "#fff8c4", color: "#54656f", fontSize: 11.5, padding: "5px 10px", borderRadius: 8, textAlign: "center", maxWidth: "90%" }}>
              🔒 Los mensajes están cifrados de extremo a extremo.
            </div>
          )}
          {s.tipo === "whatsapp" && c.nombre[0] === "+" && (
            <div style={{ alignSelf: "center", background: "#fff", color: "#54656f", fontSize: 11.5, padding: "5px 10px", borderRadius: 8 }}>
              Este número no está en tus contactos · Bloquear · Añadir
            </div>
          )}
          {s.mensajes.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.yo ? "flex-end" : "flex-start", maxWidth: "82%",
              background: m.yo ? st.yo : st.ellos, color: m.yo ? st.yoTxt : "#111",
              borderRadius: 16, padding: "8px 12px 5px", fontSize: 14.5, lineHeight: 1.45,
              boxShadow: s.tipo === "whatsapp" ? "0 1px 0.5px rgba(0,0,0,.13)" : "none",
            }}>
              <Partes partes={m.partes} colorEnlace={m.yo ? "#fff" : s.tipo === "whatsapp" ? "#027eb5" : "#0b63ce"} />
              <div style={{ fontSize: 10.5, opacity: 0.6, textAlign: "right", marginTop: 2 }}>{m.hora}</div>
            </div>
          ))}
        </div>
        {/* caja de escribir */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "8px 10px 12px", display: "flex", gap: 8, alignItems: "center", background: s.tipo === "whatsapp" ? "#efeae2" : "#fff" }}>
          <span style={{ flex: 1, background: s.tipo === "whatsapp" ? "#fff" : "#f2f2f5", borderRadius: 20, padding: "9px 14px", fontSize: 14, color: "#8e8e93", border: s.tipo === "sms" ? "1px solid #e1e1e6" : "none" }}>
            {s.tipo === "sms" ? "Mensaje de texto" : s.tipo === "instagram" ? "Envía un mensaje…" : "Mensaje"}
          </span>
          <span style={{ fontSize: 18 }}>🎤</span>
        </div>
        <BarraEstado />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Botón genérico
// ---------------------------------------------------------------------------
function Btn({ children, onClick, color = C.primary, outline, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 140, padding: "14px 18px", fontSize: 16, fontWeight: 700, borderRadius: 12,
        cursor: "pointer", border: `2px solid ${color}`, background: outline ? "#fff" : color,
        color: outline ? color : "#fff", fontFamily: FUENTE, ...style,
      }}
    >
      {children}
    </button>
  );
}

function barajar(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const modoDeUrl = () => {
  try {
    const p = window.location.pathname.toLowerCase();
    if (p.startsWith("/phishing/profes")) return "profes";
    if (p.startsWith("/phishing/alumnos")) return "alumnos";
  } catch { /* nada */ }
  return null;
};
const ponerUrl = (modo) => {
  try {
    if (!window.location.pathname.toLowerCase().startsWith("/phishing")) return;
    // Conserva ?codigo= (enlace del profe con su código ya puesto)
    window.history.replaceState({}, "", (modo ? `/phishing/${modo}` : "/phishing") + window.location.search);
  } catch { /* nada */ }
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function PhishingQuiz({ onExit, modoInicial = null }) {
  const [modo, setModo] = useState(() => modoInicial || modoDeUrl());
  const [etapa, setEtapa] = useState("inicio"); // inicio | jugar | fin
  const [form, setForm] = useState({ nombre: "", email: "" });
  const [datos, setDatos] = useState({ nombre: "", email: "" });
  const [orden, setOrden] = useState([]);
  const [idx, setIdx] = useState(0);
  const [eleccion, setEleccion] = useState(null); // "phishing" | "legit"
  const [resultados, setResultados] = useState([]); // [{ s, ok }]
  const [peek, setPeek] = useState(null);
  const [verEnvio, setVerEnvio] = useState(false);
  const refPanel = useRef(null);

  const test = modo ? TESTS[modo] : null;
  const s = orden[idx];
  const respondido = eleccion !== null;
  const acierto = respondido && s && eleccion === s.respuesta;

  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* nada */ } }, [idx, etapa, modo]);
  useEffect(() => {
    if (respondido && refPanel.current) {
      try { refPanel.current.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch { /* nada */ }
    }
  }, [respondido]);

  const elegirModo = (m) => { setModo(m); ponerUrl(m); setEtapa("inicio"); };

  const empezar = (m = modo) => {
    const t = TESTS[m];
    setDatos({
      nombre: form.nombre.trim().slice(0, 40) || t.nombreDef,
      email: form.email.trim().slice(0, 60) || t.emailDef,
    });
    setOrden(barajar(t.escenarios));
    setIdx(0);
    setEleccion(null);
    setResultados([]);
    setPeek(null);
    setVerEnvio(false);
    setEtapa("jugar");
  };

  const responder = (c) => {
    if (respondido) return;
    setEleccion(c);
    setPeek(null);
    const ok = c === s.respuesta;
    setResultados((r) => [...r, { s, ok }]);
    if (ok) sonidoCorrecto(); else sonidoIncorrecto();
  };

  const siguiente = () => {
    setPeek(null);
    setEleccion(null);
    if (idx + 1 >= orden.length) {
      const aciertos = resultados.filter((r) => r.ok).length;
      guardarRegistroLocal("PHISHING", {
        titulo: `¿Phishing o legítimo? · ${modo === "profes" ? "Profes" : "Alumnos"}`,
        aciertos, intentos: resultados.length, nombre: datos.nombre, via: "juego",
      });
      sonidoFinal();
      setEtapa("fin");
    } else setIdx(idx + 1);
  };

  const fx = (txt) => String(txt ?? "").replace(/\{nombre\}/g, datos.nombre).replace(/\{email\}/g, datos.email);

  const wrap = { fontFamily: FUENTE, background: C.bg, color: C.ink, minHeight: "100vh", boxSizing: "border-box", padding: onExit ? "62px 16px 48px" : "24px 16px 48px" };
  const tarjeta = { background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, boxShadow: "0 4px 18px rgba(30,40,70,.06)" };
  const botonVolver = onExit ? (
    <button
      onClick={onExit}
      style={{ position: "fixed", top: 12, left: 12, zIndex: 50, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.08)", fontFamily: FUENTE }}
    >
      ← Volver
    </button>
  ) : null;

  // ---------------- ELEGIR TEST ----------------
  if (etapa === "inicio" && !modo) {
    return (
      <div style={wrap}>
        {botonVolver}
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 58 }}>🎣</div>
          <h1 style={{ margin: "6px 0 8px", fontSize: 32 }}>¿Phishing o legítimo?</h1>
          <p style={{ color: C.soft, fontSize: 17, lineHeight: 1.6, maxWidth: 600, margin: "0 auto 26px" }}>
            El <b>phishing</b> es un engaño: alguien se hace pasar por una empresa, tu centro o un conocido para quedarse con tus contraseñas, tus cuentas o tu dinero. ¿Sabrías detectarlo?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            {Object.entries(TESTS).map(([k, t]) => (
              <button
                key={k}
                onClick={() => elegirModo(k)}
                style={{ ...tarjeta, padding: "26px 22px", cursor: "pointer", textAlign: "center", borderTop: `6px solid ${t.color}`, fontFamily: FUENTE, color: C.ink }}
              >
                <div style={{ fontSize: 46 }}>{t.emoji}</div>
                <div style={{ fontSize: 21, fontWeight: 800, margin: "6px 0" }}>{t.nombre}</div>
                <div style={{ color: C.soft, fontSize: 15, lineHeight: 1.5 }}>{t.desc}</div>
                <div style={{ marginTop: 12, fontWeight: 700, color: t.color }}>{t.escenarios.length} mensajes →</div>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: C.soft, marginTop: 24 }}>
            Todos los mensajes son simulaciones educativas con personas y centros inventados. Ningún enlace lleva a ninguna parte.
          </p>
        </div>
      </div>
    );
  }

  // ---------------- DATOS DEL JUGADOR ----------------
  if (etapa === "inicio") {
    const inp = { width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 16, borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: FUENTE, marginTop: 6 };
    return (
      <div style={wrap}>
        {botonVolver}
        <div style={{ ...tarjeta, maxWidth: 560, margin: "0 auto", padding: "30px 28px", borderTop: `6px solid ${test.color}` }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 50 }}>{test.emoji}</div>
            <h1 style={{ margin: "4px 0 6px", fontSize: 27 }}>{test.nombre}</h1>
            <p style={{ color: C.soft, fontSize: 15.5, lineHeight: 1.6, margin: "0 0 20px" }}>
              Vas a ver <b>{test.escenarios.length} mensajes</b> como los que llegan de verdad. Decide en cada uno si te fiarías.
            </p>
          </div>
          <label style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
            Tu nombre
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={test.nombreDef} maxLength={40} style={inp} />
          </label>
          <label style={{ display: "block", fontWeight: 700, fontSize: 14 }}>
            Tu correo <span style={{ fontWeight: 400, color: C.soft }}>(vale uno inventado)</span>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={test.emailDef} maxLength={60} style={inp} />
          </label>
          <p style={{ fontSize: 12.5, color: C.soft, margin: "8px 0 20px" }}>
            🔒 No se guardan ni se envían: solo sirven para que los mensajes parezcan dirigidos a ti.
          </p>
          <div style={{ background: "#f5f6ff", borderRadius: 12, padding: "12px 16px", fontSize: 14.5, lineHeight: 1.6, marginBottom: 20 }}>
            <b>Mira como un detective:</b>
            <div>🖱️ Pasa el ratón (o toca) por enlaces, botones y adjuntos: abajo verás adónde llevan.</div>
            <div>▾ En los correos, pulsa «para mí ▾» para ver los detalles del remitente.</div>
            <div>🌐 En las webs, lee bien la barra de direcciones.</div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Btn outline color={C.soft} onClick={() => { setModo(null); ponerUrl(null); }} style={{ flex: "0 0 auto", minWidth: 0 }}>← Otro test</Btn>
            <Btn color={test.color} onClick={() => empezar()}>Empezar el test</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- FINAL ----------------
  if (etapa === "fin") {
    const score = resultados.filter((r) => r.ok).length;
    const total = resultados.length;
    const nivel =
      score === total ? ["🏆", "¡Detective digital!", "No se te escapa ni una. Comparte estos trucos con los tuyos."]
        : score >= total * 0.75 ? ["🛡️", "¡Muy bien!", "Tienes buen ojo. Repasa los que fallaste para cerrar el último hueco."]
        : score >= total * 0.5 ? ["🔍", "Vas por buen camino", "Algunos engaños son muy realistas. Repasa las reglas de oro y vuelve a intentarlo."]
        : ["🎣", "¡Te han pescado!", "Tranquilidad: para eso sirve practicar. Lee las reglas de oro y repite el test."];
    const otro = modo === "profes" ? "alumnos" : "profes";
    return (
      <div style={wrap}>
        {botonVolver}
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ ...tarjeta, padding: 28, textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 52 }}>{nivel[0]}</div>
            <div style={{ fontSize: 46, fontWeight: 800, color: test.color }}>{score} / {total}</div>
            <h2 style={{ margin: "4px 0 8px" }}>{nivel[1]}{datos.nombre ? `, ${datos.nombre}` : ""}</h2>
            <p style={{ color: C.soft, margin: 0, fontSize: 16 }}>{nivel[2]}</p>
            <button
              onClick={() => setVerEnvio(true)}
              style={{ marginTop: 18, padding: "13px 26px", fontSize: 16, fontWeight: 800, border: "none", borderRadius: 14, cursor: "pointer", color: "#fff", background: "linear-gradient(135deg,#f1c40f,#e67e22)", fontFamily: FUENTE }}
            >
              📤 Enviar al profesor
            </button>
          </div>
          {verEnvio && (
            <EnviarPhishing
              modo={modo}
              nombreInicial={form.nombre.trim()}
              resultados={resultados}
              color={test.color}
              onClose={() => setVerEnvio(false)}
            />
          )}

          <div style={{ ...tarjeta, padding: "20px 22px", marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Tus respuestas</h3>
            {resultados.map((r, i) => (
              <div key={r.s.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: r.ok ? C.ok : C.bad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                  {r.ok ? "✓" : "✗"}
                </span>
                <span style={{ flex: 1, fontSize: 15 }}>{r.s.titulo}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: r.s.respuesta === "phishing" ? C.bad : C.ok, whiteSpace: "nowrap" }}>
                  {r.s.respuesta === "phishing" ? "🎣 Phishing" : "✅ Legítimo"}
                </span>
              </div>
            ))}
          </div>

          <div style={{ ...tarjeta, padding: "20px 22px", marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Las 5 reglas de oro</h3>
            {REGLAS[modo].map(([ico, t, d]) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 24 }}>{ico}</div>
                <div><b>{t}</b><div style={{ color: C.soft, fontSize: 15 }}>{d}</div></div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Btn color={test.color} onClick={() => empezar()}>🔁 Volver a jugar</Btn>
            <Btn outline color={TESTS[otro].color} onClick={() => { setModo(otro); ponerUrl(otro); setEtapa("inicio"); }}>
              {TESTS[otro].emoji} Hacer el {TESTS[otro].nombre.toLowerCase()}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- JUEGO ----------------
  const pctAvance = ((idx + (respondido ? 1 : 0)) / orden.length) * 100;
  return (
    <Ctx.Provider value={{ show: respondido, fx, peek, setPeek, datos }}>
      <div style={wrap} onClick={() => setPeek(null)}>
        {botonVolver}
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          {/* progreso */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontWeight: 800, color: test.color, fontSize: 14, whiteSpace: "nowrap" }}>{test.emoji} {idx + 1} / {orden.length}</span>
            <div style={{ flex: 1, height: 8, background: C.line, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pctAvance}%`, height: "100%", background: test.color, transition: "width .3s" }} />
            </div>
            <span style={{ fontSize: 13, color: C.soft, whiteSpace: "nowrap" }}>✓ {resultados.filter((r) => r.ok).length}</span>
          </div>

          {s.contexto && (
            <div style={{ background: "#fff8e6", border: "1px solid #f5dfa6", borderRadius: 12, padding: "10px 14px", fontSize: 14.5, marginBottom: 14, lineHeight: 1.5 }}>
              🧭 <b>Situación:</b> <Mark n={s.contextoPista}>{fx(s.contexto)}</Mark>
            </div>
          )}

          <div key={s.id} onClick={(e) => e.stopPropagation()}>
            {s.tipo === "email" && <Correo s={s} />}
            {s.tipo === "web" && <Navegador s={s} />}
            {(s.tipo === "sms" || s.tipo === "whatsapp" || s.tipo === "instagram") && <Movil s={s} />}
          </div>

          {!respondido ? (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                <Btn color={C.bad} onClick={(e) => { e.stopPropagation(); responder("phishing"); }}>🎣 Es phishing</Btn>
                <Btn color={C.ok} onClick={(e) => { e.stopPropagation(); responder("legit"); }}>✅ Es legítimo</Btn>
              </div>
              <p style={{ textAlign: "center", fontSize: 13, color: C.soft, marginTop: 12 }}>
                Pasa el ratón o toca enlaces, botones y adjuntos{s.tipo === "email" ? " · pulsa «para mí ▾» para ver los detalles" : ""}.
              </p>
            </>
          ) : (
            <div ref={refPanel} style={{ marginTop: 18, background: acierto ? C.okBg : C.badBg, border: `2px solid ${acierto ? C.ok : C.bad}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 21, fontWeight: 800, color: acierto ? C.ok : C.bad, marginBottom: 4 }}>
                {acierto ? "¡Correcto!" : "¡Uy, no!"}
              </div>
              <div style={{ fontSize: 16, marginBottom: 12 }}>
                Este mensaje <b>{s.respuesta === "phishing" ? "es phishing" : "es legítimo"}</b>.
                {s.respuesta === "phishing" ? " Mira las pistas marcadas en el mensaje:" : " Por qué podemos fiarnos (mira las marcas):"}
              </div>
              <ol style={{ margin: "0 0 12px", paddingLeft: 0, listStyle: "none" }}>
                {s.pistas.map((c, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, marginBottom: 9, fontSize: 15, lineHeight: 1.5 }}>
                    <span style={{ flex: "0 0 22px", height: 22, borderRadius: "50%", background: C.mark, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
              <div style={{ background: "rgba(255,255,255,.75)", borderRadius: 10, padding: "10px 14px", fontSize: 15 }}>
                💡 <b>Consejo:</b> {s.consejo}
              </div>
              <div style={{ display: "flex", marginTop: 14 }}>
                <Btn color={test.color} onClick={siguiente}>{idx + 1 >= orden.length ? "Ver resultado" : "Siguiente mensaje →"}</Btn>
              </div>
            </div>
          )}
        </div>
        <style>{`@media (max-width: 560px) { .phq-cuerpo { padding-left: 0 !important; } }`}</style>
      </div>
    </Ctx.Provider>
  );
}
