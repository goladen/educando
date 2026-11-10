// generadoresAlgebra.js — generadores puros compartidos por Álgebra (Algebra.jsx) y las fichas
// (fichas/fuentes/expresiones.jsx → también Invasión Pi y los mandos).
// Operaciones combinadas con monomios y polinomios: { expr, ans (coef. ascendentes), pasos }.
import { polyStr } from './motorFactorizacion';

const SUP = { 0:'', 1:'', 2:'²', 3:'³', 4:'⁴', 5:'⁵' };
const rInt = (lo, hi, ne) => { let v; do { v = Math.floor(Math.random()*(hi-lo+1))+lo; } while (ne !== undefined && v === ne); return v; };
const rItem = a => a[Math.floor(Math.random()*a.length)];
function normPoly(c) { const a=[...c]; while(a.length>1&&a[a.length-1]===0)a.pop(); return a; }
export function monoDisp(coef, deg) {
    if(deg===0) return `${coef<0?'−':''}${Math.abs(coef)}`;
    const sign=coef<0?'−':''; const ac=Math.abs(coef);
    const lit=deg===1?'x':`x${SUP[deg]||`^${deg}`}`;
    return ac===1?`${sign}${lit}`:`${sign}${ac}${lit}`;
}
function monoLit(deg) { if(deg===0)return '1'; return deg===1?'x':`x${SUP[deg]||`^${deg}`}`; }
function addPoly(a,b){const l=Math.max(a.length,b.length);return Array.from({length:l},(_,i)=>(a[i]||0)+(b[i]||0));}
function subPoly(a,b){const l=Math.max(a.length,b.length);return Array.from({length:l},(_,i)=>(a[i]||0)-(b[i]||0));}
function mulPoly(a,b){const r=Array(a.length+b.length-1).fill(0);a.forEach((ca,i)=>b.forEach((cb,j)=>{r[i+j]+=ca*cb;}));return r;}

// ═══════════════════════════════════════════════════════════════════════════════
// Operaciones combinadas (monomios y polinomios): primero potencias, luego
// productos y cocientes, y por último sumas y restas
// ═══════════════════════════════════════════════════════════════════════════════
const mono1 = (c, d) => { const a=Array(d+1).fill(0); a[d]=c; return a; };
const facM = (c, d) => c<0 ? `(${monoDisp(c,d)})` : monoDisp(c,d);          // factor entre paréntesis si es negativo
const masM = (c, d) => `${c<0?' − ':' + '}${monoDisp(Math.abs(c),d)}`;       // término con su signo
const parP = p => `(${polyStr(p)})`;
const sumaMonos = ts => ts.map(([c,d],i)=> i===0 ? monoDisp(c,d) : masM(c,d)).join('');
const numTxt = n => n<0 ? `−${-n}` : `${n}`;
const numP = n => n<0 ? `(−${-n})` : `${n}`;
const noNulo = gen => () => { let e; do { e = gen(); } while (normPoly(e.ans).every(v => v === 0)); return e; };

const genCombMonomios = noNulo(genCombMonomios0);
const genCombPolinomios = noNulo(genCombPolinomios0);
function genCombMonomios0() {
    const c = () => rInt(-6,6,0);
    const forma = rInt(1,7);
    if(forma===1) { // a·b ± c (mismo grado)
        const a=rInt(1,2), b=rInt(1,3-a+1), c1=c(), c2=c(), c3=c();
        const prod=c1*c2;
        return { expr:`${monoDisp(c1,a)} · ${facM(c2,b)}${masM(c3,a+b)}`, ans:normPoly(mono1(prod+c3,a+b)),
            pasos:[`Primero el producto: ${monoDisp(c1,a)} · ${facM(c2,b)} = ${monoDisp(prod,a+b)}`, `Después la suma: ${monoDisp(prod,a+b)}${masM(c3,a+b)} = ${polyStr(mono1(prod+c3,a+b))}`] };
    }
    if(forma===2) { // tres términos semejantes
        const d=rInt(1,4), ts=[[c(),d],[c(),d],[c(),d]];
        const s=ts.reduce((x,[k])=>x+k,0);
        return { expr:sumaMonos(ts), ans:normPoly(mono1(s,d)),
            pasos:[`Son semejantes: se suman los coeficientes ${ts.map(([k])=>numP(k)).join(' + ')} = ${numTxt(s)}`, `Resultado: ${polyStr(mono1(s,d))}`] };
    }
    if(forma===3) { // potencia ± término
        const a=rInt(1,2), c1=rInt(-4,4,0), c2=c();
        const pot=c1*c1;
        return { expr:`(${monoDisp(c1,a)})²${masM(c2,2*a)}`, ans:normPoly(mono1(pot+c2,2*a)),
            pasos:[`Primero la potencia: (${monoDisp(c1,a)})² = ${monoDisp(pot,2*a)}`, `Después: ${monoDisp(pot,2*a)}${masM(c2,2*a)} = ${polyStr(mono1(pot+c2,2*a))}`] };
    }
    if(forma===4) { // a·b − c·d con el mismo grado total
        const g=rInt(2,5), a=rInt(1,g-1), b=g-a, e=rInt(1,g-1), f=g-e;
        const c1=c(),c2=c(),c3=c(),c4=c(); const p1=c1*c2, p2=c3*c4;
        return { expr:`${monoDisp(c1,a)} · ${facM(c2,b)} − ${monoDisp(c3,e)} · ${facM(c4,f)}`, ans:normPoly(mono1(p1-p2,g)),
            pasos:[`Productos: ${monoDisp(c1,a)} · ${facM(c2,b)} = ${monoDisp(p1,g)}  y  ${monoDisp(c3,e)} · ${facM(c4,f)} = ${monoDisp(p2,g)}`, `Resta: ${monoDisp(p1,g)} − ${facM(p2,g)} = ${polyStr(mono1(p1-p2,g))}`] };
    }
    if(forma===5) { // cociente ± término
        const a=rInt(1,3), b=rInt(1,2), q=rInt(-5,5,0), c2=rInt(-4,4,0), c3=c();
        const num=q*c2;
        return { expr:`(${monoDisp(num,a+b)}) : (${monoDisp(c2,b)})${masM(c3,a)}`, ans:normPoly(mono1(q+c3,a)),
            pasos:[`Primero el cociente: (${monoDisp(num,a+b)}) : (${monoDisp(c2,b)}) = ${monoDisp(q,a)}  (se dividen coeficientes y se restan exponentes)`, `Después: ${monoDisp(q,a)}${masM(c3,a)} = ${polyStr(mono1(q+c3,a))}`] };
    }
    if(forma===6) { // producto de tres monomios ± término
        const a=1, b=1, e=rInt(0,2), c1=rInt(-3,3,0), c2=rInt(-3,3,0), c3=rInt(-3,3,0), c4=c();
        const g=a+b+e, prod=c1*c2*c3;
        return { expr:`${monoDisp(c1,a)} · ${facM(c2,b)} · ${facM(c3,e)}${masM(c4,g)}`, ans:normPoly(mono1(prod+c4,g)),
            pasos:[`Producto: ${monoDisp(c1,a)} · ${facM(c2,b)} · ${facM(c3,e)} = ${monoDisp(prod,g)}`, `Después: ${monoDisp(prod,g)}${masM(c4,g)} = ${polyStr(mono1(prod+c4,g))}`] };
    }
    // forma 7: el resultado tiene términos no semejantes
    const a=rInt(1,2), b=rInt(1,2), e=rItem([1,2,3,4].filter(x=>x!==a+b)), c1=c(), c2=c(), c3=c(), c4=c();
    const prod=c1*c2;
    const ans=addPoly(mono1(prod,a+b), addPoly(mono1(c3,e), mono1(c4,a+b)));
    return { expr:`${monoDisp(c1,a)} · ${facM(c2,b)}${masM(c3,e)}${masM(c4,a+b)}`, ans:normPoly(ans),
        pasos:[`Producto: ${monoDisp(c1,a)} · ${facM(c2,b)} = ${monoDisp(prod,a+b)}`, `Se agrupan solo los semejantes (${monoLit(a+b)}): ${polyStr(ans)}  — ${monoLit(e)} no es semejante y se queda igual`] };
}

function genLin() { return [rInt(-5,5), rItem([1,1,2,3,-1,-2])]; }
function genCombPolinomios0() {
    const forma = rInt(1,6);
    const P=genLin(), Q=genLin(), S=genLin();
    const R=[rInt(-5,5), rInt(-4,4,0), rInt(-2,3)];
    if(forma===1 || forma===2) { // P·Q ± R
        const PQ=mulPoly(P,Q), ans=forma===1?addPoly(PQ,R):subPoly(PQ,R);
        return { expr:`${parP(P)} · ${parP(Q)} ${forma===1?'+':'−'} ${parP(R)}`, ans:normPoly(ans),
            pasos:[`Primero el producto: ${parP(P)} · ${parP(Q)} = ${polyStr(PQ)}`, `${forma===1?'Suma':'Resta (cambia el signo de cada término de R)'}: ${polyStr(ans)}`] };
    }
    if(forma===3) { // k·P − Q·S
        const k=rInt(-4,5,0), kP=mulPoly([k],P), QS=mulPoly(Q,S), ans=subPoly(kP,QS);
        return { expr:`${numP(k)} · ${parP(P)} − ${parP(Q)} · ${parP(S)}`, ans:normPoly(ans),
            pasos:[`Productos: ${numP(k)} · ${parP(P)} = ${polyStr(kP)}  y  ${parP(Q)} · ${parP(S)} = ${polyStr(QS)}`, `Resta: (${polyStr(kP)}) − (${polyStr(QS)}) = ${polyStr(ans)}`] };
    }
    if(forma===4) { // P² − R
        const P2=mulPoly(P,P), ans=subPoly(P2,R);
        return { expr:`${parP(P)}² − ${parP(R)}`, ans:normPoly(ans),
            pasos:[`Primero la potencia (identidad notable): ${parP(P)}² = ${polyStr(P2)}`, `Resta: (${polyStr(P2)}) − ${parP(R)} = ${polyStr(ans)}`] };
    }
    if(forma===5) { // x·P + Q·S
        const k=rItem([1,2,-1,-3]), xm=mono1(k,1), xP=mulPoly(xm,R.slice(0,2)), QS=mulPoly(Q,S), ans=addPoly(xP,QS);
        return { expr:`${monoDisp(k,1)} · ${parP(R.slice(0,2))} + ${parP(Q)} · ${parP(S)}`, ans:normPoly(ans),
            pasos:[`Productos: ${monoDisp(k,1)} · ${parP(R.slice(0,2))} = ${polyStr(xP)}  y  ${parP(Q)} · ${parP(S)} = ${polyStr(QS)}`, `Suma: ${polyStr(ans)}`] };
    }
    // forma 6: R − P·(Q + S)
    const QmS=addPoly(Q,S), PQS=mulPoly(P,QmS), ans=subPoly(R,PQS);
    return { expr:`${parP(R)} − ${parP(P)} · [${parP(Q)} + ${parP(S)}]`, ans:normPoly(ans),
        pasos:[`Primero el corchete: ${parP(Q)} + ${parP(S)} = ${polyStr(QmS)}`, `Producto: ${parP(P)} · ${parP(QmS)} = ${polyStr(PQS)}`, `Resta: ${parP(R)} − (${polyStr(PQS)}) = ${polyStr(ans)}`] };
}

export { genCombMonomios, genCombPolinomios };
