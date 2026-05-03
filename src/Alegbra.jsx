import React, { useState } from 'react';
import { RotateCcw, Brain, CheckCircle, ArrowLeft, PenTool, Calculator, PlusSquare, Layers, Box, Sigma, GitMerge } from 'lucide-react';
import Confetti from 'react-confetti';

// ─── Helpers Matemáticos y Formateo ───────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Convierte un objeto de términos {0: coef, 1: coefX, 2: coefX2...} a string LaTeX
const formatPoly = (terms) => {
    let parts = [];
    const degrees = Object.keys(terms).map(Number).sort((a, b) => b - a);
    
    degrees.forEach(deg => {
        let coef = terms[deg];
        if (coef === 0) return;
        
        let termStr = "";
        let absCoef = Math.abs(coef);
        let sign = coef > 0 ? "+" : "-";

        if (deg === 0) {
            termStr = `${absCoef}`;
        } else {
            let cStr = absCoef === 1 ? "" : `${absCoef}`;
            let varStr = deg === 1 ? "x" : `x^{${deg}}`;
            termStr = `${cStr}${varStr}`;
        }

        parts.push({ sign, termStr });
    });

    if (parts.length === 0) return "0";

    let result = "";
    parts.forEach((p, i) => {
        if (i === 0) {
            result += p.sign === "-" ? `-${p.termStr}` : p.termStr;
        } else {
            result += ` ${p.sign} ${p.termStr}`;
        }
    });
    return result;
};

// ─── Teclado Polinómico ───────────────────────────────────────────────────────
const TecladoPolinomico = ({ terminos, setTerminos }) => {
    const addTerm = (deg, val) => {
        setTerminos(prev => {
            const current = prev[deg] || 0;
            const next = { ...prev, [deg]: current + val };
            if (next[deg] === 0) delete next[deg];
            return next;
        });
    };

    const clear = () => setTerminos({});

    const Btn = ({ lbl, deg, val, color }) => (
        <button 
            onClick={() => addTerm(deg, val)}
            style={{ 
                flex: 1, padding: '10px 4px', fontSize: '1.1rem', fontWeight: 'bold', 
                color: 'white', background: color, border: 'none', borderRadius: 8, 
                cursor: 'pointer', boxShadow: `0 4px 0 rgba(0,0,0,0.2)`, transition: 'transform 0.1s'
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'translateY(4px)'}
            onMouseUp={e => e.currentTarget.style.transform = 'none'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
            {lbl}
        </button>
    );

    return (
        <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 14, border: '2px solid #e0e0e0', marginTop: 10 }}>
            <div style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: 16, minHeight: 36, color: '#2c3e50', fontFamily: 'serif' }}>
                $ {formatPoly(terminos)} $
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Btn lbl="+1" deg={0} val={1} color="#3498db" />
                    <Btn lbl="+x" deg={1} val={1} color="#3498db" />
                    <Btn lbl="+x²" deg={2} val={1} color="#3498db" />
                    <Btn lbl="+x³" deg={3} val={1} color="#3498db" />
                    <Btn lbl="+x⁴" deg={4} val={1} color="#3498db" />
                    <Btn lbl="+x⁵" deg={5} val={1} color="#3498db" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Btn lbl="-1" deg={0} val={-1} color="#e74c3c" />
                    <Btn lbl="-x" deg={1} val={-1} color="#e74c3c" />
                    <Btn lbl="-x²" deg={2} val={-1} color="#e74c3c" />
                    <Btn lbl="-x³" deg={3} val={-1} color="#e74c3c" />
                    <Btn lbl="-x⁴" deg={4} val={-1} color="#e74c3c" />
                    <Btn lbl="-x⁵" deg={5} val={-1} color="#e74c3c" />
                </div>
                <button onClick={clear} style={{ marginTop: 8, padding: '10px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                    Borrar Todo
                </button>
            </div>
        </div>
    );
};

// ─── 1. Terminología ──────────────────────────────────────────────────────────
const TerminologiaApp = () => {
    const [monomios] = useState(() => Array.from({length: 5}, () => {
        let coef = rInt(-9, 9);
        if(coef === 0) coef = 1;
        let deg = rInt(1, 5);
        let literal = deg === 1 ? "x" : `x^{${deg}}`;
        return { latex: `${coef}${literal}`, c: coef, l: literal, g: deg };
    }));
    
    return (
        <div>
            <h3 style={{color: '#2c3e50', textAlign: 'center'}}>Rellena la tabla</h3>
            <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', textAlign: 'center', borderCollapse: 'collapse', marginTop: 10}}>
                    <thead>
                        <tr style={{background: '#3498db', color: 'white'}}>
                            <th style={{padding: 10, borderRadius: '8px 0 0 0'}}>Monomio</th>
                            <th>Coeficiente</th>
                            <th>Parte Literal</th>
                            <th style={{borderRadius: '0 8px 0 0'}}>Grado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monomios.map((m, i) => (
                            <tr key={i} style={{borderBottom: '1px solid #ddd'}}>
                                <td style={{padding: 15, fontSize: '1.2rem', fontFamily: 'serif'}}>$ {m.latex} $</td>
                                <td><input type="text" style={st.inputMini} /></td>
                                <td><input type="text" style={st.inputMini} /></td>
                                <td><input type="text" style={st.inputMini} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button style={{...st.btnSuccess, width: '100%', marginTop: 20}}><CheckCircle size={20}/> Comprobar</button>
        </div>
    );
};

// ─── 2. Valor Numérico ────────────────────────────────────────────────────────
const ValorNumericoApp = () => {
    const [poly] = useState(() => {
        const c2 = rInt(1, 4) * (Math.random() > 0.5 ? 1 : -1);
        const c1 = rInt(1, 5) * (Math.random() > 0.5 ? 1 : -1);
        const c0 = rInt(1, 6) * (Math.random() > 0.5 ? 1 : -1);
        return { 
            latex: `${c2}x^2 ${c1 > 0 ? '+' : ''}${c1}x ${c0 > 0 ? '+' : ''}${c0}`, 
            fn: (x) => c2 * x * x + c1 * x + c0 
        };
    });

    const [valores] = useState([0, rInt(1, 3), rInt(-3, -1)]);
    const [respuestas, setRespuestas] = useState(['', '', '']);
    const [evaluado, setEvaluado] = useState(false);

    const comprobar = () => setEvaluado(true);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center', fontSize: '1.2rem', color: '#2c3e50', padding: 15, background: '#f8f9fa', borderRadius: 10 }}>
                Dada la función: <br/><strong style={{fontSize: '1.5rem', fontFamily: 'serif'}}>$P(x) = {poly.latex}$</strong>
            </div>
            {valores.map((val, idx) => {
                const correct = poly.fn(val);
                const isOk = Number(respuestas[idx]) === correct;
                return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid #eee' }}>
                        <span style={{ fontSize: '1.2rem', fontFamily: 'serif' }}>$P({val}) =$</span>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input 
                                type="number" 
                                value={respuestas[idx]} 
                                onChange={e => {
                                    const newRes = [...respuestas];
                                    newRes[idx] = e.target.value;
                                    setRespuestas(newRes);
                                }}
                                disabled={evaluado}
                                style={{ width: 80, padding: '10px', textAlign: 'center', borderRadius: 8, fontSize: '1.1rem', border: `2px solid ${evaluado ? (isOk ? '#2ecc71' : '#e74c3c') : '#ddd'}`, outline: 'none' }}
                            />
                            {evaluado && !isOk && <span style={{ color: '#e74c3c', fontSize: '0.9rem', fontWeight: 'bold' }}>Era {correct}</span>}
                        </div>
                    </div>
                );
            })}
            <button onClick={comprobar} disabled={evaluado} style={{ ...st.btnSuccess, marginTop: 10 }}><CheckCircle size={20}/> Comprobar</button>
        </div>
    );
};

// ─── 3 y 4. Operaciones con Monomios y Polinomios ─────────────────────────────
const OperacionesApp = ({ tipo }) => {
    const [terminos, setTerminos] = useState({});
    const [ejercicio] = useState(() => {
        if (tipo === 'monomios') {
            const coef1 = rInt(2, 6); const deg1 = rInt(1, 3);
            const coef2 = rInt(2, 6);
            return { text: `${coef1}x^{${deg1}} + ${coef2}x^{${deg1}}` };
        } else {
            const p = { 2: rInt(1,3), 1: rInt(-3,3), 0: rInt(-5,5) };
            const q = { 2: rInt(-2,2), 1: rInt(-4,4), 0: rInt(-3,3) };
            const isSuma = Math.random() > 0.5;
            let pLatex = `${p[2]}x^2 ${p[1]>0?'+':''}${p[1]}x ${p[0]>0?'+':''}${p[0]}`;
            let qLatex = `${q[2]}x^2 ${q[1]>0?'+':''}${q[1]}x ${q[0]>0?'+':''}${q[0]}`;
            return { latex: `(${pLatex}) ${isSuma ? '+' : '-'} (${qLatex})` };
        }
    });

    return (
        <div>
            <div style={{fontSize: '1.4rem', textAlign: 'center', margin: '20px 0', color: '#2c3e50', fontFamily: 'serif'}}>
                $ {ejercicio.text || ejercicio.latex} = $ ?
            </div>
            <TecladoPolinomico terminos={terminos} setTerminos={setTerminos} />
            <button style={{...st.btnSuccess, width: '100%', marginTop: 20}}><CheckCircle size={20}/> Comprobar</button>
        </div>
    );
};

// ─── 5. División Ruffini ──────────────────────────────────────────────────────
const RuffiniApp = () => {
    const [terminos, setTerminos] = useState({}); // Para el cociente C(x)
    const [resto, setResto] = useState('');

    const [ejercicio] = useState(() => {
        const root = rInt(-3, 3) || 1; 
        const p2 = rInt(1, 3);
        const p1 = rInt(-4, 4);
        const p0 = rInt(-5, 5);
        const rootSign = root > 0 ? `-${root}` : `+${Math.abs(root)}`;
        return { latex: `(${p2}x^2 ${p1>0?'+':''}${p1}x ${p0>0?'+':''}${p0}) : (x ${rootSign})` };
    });

    return (
        <div>
            <div style={{fontSize: '1.2rem', textAlign: 'center', margin: '15px 0', color: '#2c3e50'}}>
                Divide usando Ruffini:<br/><br/>
                <strong style={{fontSize: '1.4rem', fontFamily: 'serif'}}>${ejercicio.latex}$</strong>
            </div>
            
            <div style={{ marginBottom: 15 }}>
                <span style={{ fontWeight: 'bold', color: '#555' }}>Cociente $C(x)$:</span>
                <TecladoPolinomico terminos={terminos} setTerminos={setTerminos} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', background: '#f8f9fa', padding: 15, borderRadius: 10, border: '2px solid #e0e0e0' }}>
                <span style={{ fontWeight: 'bold', color: '#555', fontSize: '1.1rem' }}>Resto $R$:</span>
                <input 
                    type="number" 
                    value={resto} 
                    onChange={e => setResto(e.target.value)}
                    style={{ width: 80, padding: '10px', textAlign: 'center', borderRadius: 8, border: '2px solid #ddd', fontSize: '1.2rem', outline: 'none' }}
                />
            </div>
            
            <button style={{...st.btnSuccess, width: '100%', marginTop: 20}}><CheckCircle size={20}/> Comprobar</button>
        </div>
    );
};

// ─── 6. Identidades Notables ──────────────────────────────────────────────────
const IdentidadesNotablesApp = () => {
    const [terminos, setTerminos] = useState({});
    const [ejercicio] = useState(() => {
        const a = rInt(1, 3);
        const b = rInt(1, 5);
        const type = rInt(1, 3); 
        
        if (type === 1) return { latex: `(${a===1?'':a}x + ${b})^2` };
        if (type === 2) return { latex: `(${a===1?'':a}x - ${b})^2` };
        return { latex: `(${a===1?'':a}x + ${b})(${a===1?'':a}x - ${b})` };
    });

    return (
        <div>
            <div style={{fontSize: '1.2rem', textAlign: 'center', margin: '15px 0', color: '#2c3e50'}}>
                Desarrolla la identidad:<br/><br/>
                <strong style={{fontSize: '1.5rem', fontFamily: 'serif'}}>${ejercicio.latex}$</strong>
            </div>
            <TecladoPolinomico terminos={terminos} setTerminos={setTerminos} />
            <button style={{...st.btnSuccess, width: '100%', marginTop: 20}}><CheckCircle size={20}/> Comprobar</button>
        </div>
    );
};

// ─── 7. Factorización ─────────────────────────────────────────────────────────
const FactorizacionApp = () => {
    const [ejercicio] = useState(() => {
        // Generamos un polinomio cuadrático a partir de sus raíces para asegurar que sean exactas
        const r1 = rInt(-4, 4);
        const r2 = rInt(-4, 4);
        const b = -(r1 + r2);
        const c = r1 * r2;
        return {
            latex: `x^2 ${b > 0 ? '+' : ''}${b === 0 ? '' : b + 'x'} ${c > 0 ? '+' : ''}${c === 0 ? '' : c}`,
            r1: r1, r2: r2
        };
    });

    const [raiz1, setRaiz1] = useState('');
    const [raiz2, setRaiz2] = useState('');
    const [factorizado, setFactorizado] = useState('');

    return (
        <div>
            <div style={{fontSize: '1.2rem', textAlign: 'center', margin: '15px 0', color: '#2c3e50'}}>
                Encuentra las raíces y factoriza:<br/><br/>
                <strong style={{fontSize: '1.5rem', fontFamily: 'serif'}}>${ejercicio.latex}$</strong>
            </div>

            <div style={{ display: 'flex', gap: 15, justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#555', marginBottom: 5 }}>Raíz 1</div>
                    <input type="number" value={raiz1} onChange={e => setRaiz1(e.target.value)} style={{ width: 80, padding: '10px', textAlign: 'center', borderRadius: 8, border: '2px solid #ddd', fontSize: '1.1rem', outline: 'none' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#555', marginBottom: 5 }}>Raíz 2</div>
                    <input type="number" value={raiz2} onChange={e => setRaiz2(e.target.value)} style={{ width: 80, padding: '10px', textAlign: 'center', borderRadius: 8, border: '2px solid #ddd', fontSize: '1.1rem', outline: 'none' }} />
                </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: 15, borderRadius: 10, border: '2px solid #e0e0e0', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#555', marginBottom: 10 }}>Expresión Factorizada</div>
                <input 
                    type="text" 
                    placeholder="Ej: (x-2)(x+3)"
                    value={factorizado} 
                    onChange={e => setFactorizado(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', textAlign: 'center', borderRadius: 8, border: '2px solid #3498db', fontSize: '1.2rem', outline: 'none', fontFamily: 'serif' }}
                />
            </div>
            
            <button style={{...st.btnSuccess, width: '100%', marginTop: 20}}><CheckCircle size={20}/> Comprobar</button>
        </div>
    );
};

// ─── Componente Principal (Menú) ──────────────────────────────────────────────
export default function AlgebraSuite({ onExit }) {
    const [appActiva, setAppActiva] = useState(null);

    const apps = [
        { id: 'term', icon: <PenTool size={30}/>, title: 'Terminología', desc: 'Coeficientes, partes literales y grados.', color: '#3498db' },
        { id: 'val', icon: <Calculator size={30}/>, title: 'Valor Numérico', desc: 'Evalúa polinomios en +, - y 0.', color: '#2ecc71' },
        { id: 'mono', icon: <PlusSquare size={30}/>, title: 'Monomios', desc: 'Sumas, restas y multiplicaciones.', color: '#e74c3c' },
        { id: 'poli', icon: <Layers size={30}/>, title: 'Polinomios', desc: 'Operaciones con varios términos.', color: '#f39c12' },
        { id: 'ruff', icon: <Box size={30}/>, title: 'División Ruffini', desc: 'Divide polinomios entre (x ± a).', color: '#9b59b6' },
        { id: 'ident', icon: <Sigma size={30}/>, title: 'Identidades Notables', desc: 'Desarrolla cuadrados y productos.', color: '#1abc9c' },
        { id: 'fact', icon: <GitMerge size={30}/>, title: 'Factorización', desc: 'Encuentra raíces y factoriza.', color: '#34495e' },
    ];

    return (
        <div style={st.container}>
            {/* Cabecera compartida */}
            <div style={st.header}>
                <button onClick={appActiva ? () => setAppActiva(null) : onExit} style={st.btnVolver}>
                    <ArrowLeft size={16} /> Volver
                </button>
                <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1.2rem' }}>
                    {appActiva ? apps.find(a => a.id === appActiva).title : 'Laboratorio de Álgebra'}
                </div>
            </div>

            {!appActiva ? (
                // Menú Principal
                <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                    <div style={{gridColumn: '1 / -1', textAlign: 'center', marginBottom: 20}}>
                        <Brain size={52} color="#9b59b6" style={{ marginBottom: 10 }} />
                        <h1 style={{ color: '#2c3e50', fontSize: '2.3rem', margin: '6px 0 4px' }}>Álgebra Interactiva</h1>
                        <p style={{ color: '#999', fontSize: '1rem' }}>Selecciona una herramienta para practicar</p>
                    </div>

                    {apps.map(app => (
                        <button key={app.id}
                            onClick={() => setAppActiva(app.id)}
                            style={{ 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 18px',
                                background: 'white', border: `2px solid ${app.color}`, borderRadius: 16,
                                cursor: 'pointer', textAlign: 'center', transition: 'transform 0.15s, box-shadow 0.15s',
                                boxShadow: '0 3px 10px rgba(0,0,0,0.07)'
                            }}
                        >
                            <div style={{ background: `${app.color}22`, color: app.color, borderRadius: 12, padding: 16 }}>
                                {app.icon}
                            </div>
                            <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1.2rem' }}>{app.title}</div>
                            <div style={{ color: '#888', fontSize: '0.85rem' }}>{app.desc}</div>
                        </button>
                    ))}
                </div>
            ) : (
                // Contenedor de la App Activa
                <div style={{ ...st.centerCard, maxWidth: 650 }}>
                    {appActiva === 'term' && <TerminologiaApp />}
                    {appActiva === 'val' && <ValorNumericoApp />}
                    {appActiva === 'mono' && <OperacionesApp tipo="monomios" />}
                    {appActiva === 'poli' && <OperacionesApp tipo="polinomios" />}
                    {appActiva === 'ruff' && <RuffiniApp />}
                    {appActiva === 'ident' && <IdentidadesNotablesApp />}
                    {appActiva === 'fact' && <FactorizacionApp />}
                </div>
            )}
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const st = {
    container: { minHeight: '100vh', background: '#fce4ec', padding: '15px', fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
    btnVolver: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    centerCard: { background: 'white', margin: '10px auto', padding: '22px 20px', borderRadius: 20, boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box' },
    btnSuccess: { background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '14px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 0 #1e8449', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 },
    inputMini: { width: '100%', padding: '10px 8px', textAlign: 'center', border: '2px solid #ddd', borderRadius: 8, fontSize: '1.1rem', outline: 'none', boxSizing: 'border-box' }
};