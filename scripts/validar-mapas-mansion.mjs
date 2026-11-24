// Comprueba los mapas de La Mansión Pitagórica: node scripts/validar-mapas-mansion.mjs
import { ESCENARIOS } from '../src/mansion/escenarios.js';
for (const e of Object.values(ESCENARIOS)) {
  const m = e.mapa, H = m.length, W = m[0].length, err = [];
  m.forEach((f, z) => { if (f.length !== W) err.push(`fila ${z} mide ${f.length} (≠${W})`); });
  const at = (x, z) => (m[z] && m[z][x]) || '#';
  let S, E; const D = [], P = [], T = []; let L;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = at(x, z);
    if (c === 'S') S = [x, z]; if (c === 'E') E = [x, z]; if (c === 'L') L = [x, z];
    if (c === 'D' || c === 'L') { const h = at(x-1,z)==='#'&&at(x+1,z)==='#', v = at(x,z-1)==='#'&&at(x,z+1)==='#'; if (!(h^v)) err.push(`puerta ${c} en ${x},${z} mal colocada`); if (c==='D') D.push([x,z]); }
    if (/[1-9]/.test(c)) P.push([x, z, +c]); if (c === 'T') T.push([x, z]);
  }
  const bfs = (from, pasa) => { const vis = new Set([from+'']); const q=[from]; while(q.length){const [x,z]=q.shift(); for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=[x+dx,z+dz]; if(vis.has(n+''))continue; const c=at(...n); if(!pasa(c))continue; vis.add(n+''); q.push(n);} } return vis; };
  const todo = bfs(S, c => c !== '#');
  const sinL = bfs(S, c => c !== '#' && c !== 'L');
  const sinPuertas = bfs(S, c => c !== '#' && c !== 'L' && c !== 'D');
  if (!todo.has(E+'')) err.push('salida inalcanzable');
  if (sinL.has(E+'')) err.push('se llega a la salida sin pasar por el candado');
  P.forEach(p => { if (!sinL.has([p[0],p[1]]+'')) err.push(`pista ${p[2]} inalcanzable sin candado`); if (sinPuertas.has([p[0],p[1]]+'')) err.push(`pista ${p[2]} sin puertas delante`); });
  const nums = P.map(p=>p[2]).sort(); nums.forEach((n,i)=>{ if(n!==i+1) err.push('pistas no consecutivas '+nums); });
  e.rutas.forEach((r, i) => r.forEach((w, j) => { if (at(...w) === '#' || at(...w)==='D') err.push(`ruta ${i} punto ${j} en ${at(...w)}`); const sig = r[(j+1)%r.length]; const zona = bfs(w, c => c!=='#'&&c!=='D'&&c!=='L'); if(!zona.has(sig+'')) err.push(`ruta ${i}: ${w}→${sig} cruza puerta`); if (zona.has(S+'')) err.push(`ruta ${i} llega a la salida del jugador sin puertas`); }));
  if (e.inicio2) { const [x2, z2] = e.inicio2; if (at(x2, z2) === '#') err.push('inicio2 en pared'); if (!todo.has(e.inicio2 + '')) err.push('inicio2 inalcanzable'); if (sinPuertas.has(e.inicio2 + '')) err.push('inicio2 en la misma zona que el jugador 1'); e.rutas.forEach((r, i) => { const zona = bfs(r[0], c => c !== '#' && c !== 'D' && c !== 'L'); if (zona.has(e.inicio2 + '')) err.push(`inicio2 en la zona del enemigo ${i}`); }); } else err.push('falta inicio2 (modo dual)');
  console.log(`${e.id}: ${W}x${H}, ${D.length} puertas, ${P.length} pistas, ${T.length} trampas → ${err.length ? 'ERRORES:\n  ' + [...new Set(err)].join('\n  ') : 'OK'}`);
}
