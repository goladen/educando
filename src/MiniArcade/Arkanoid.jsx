import React, { useState, useEffect, useCallback, useRef } from 'react';
import { arkanoidStart, arkanoidPaddle, arkanoidBrick, arkanoidBallLost } from './sounds';
import SaveForm from './SaveForm';
import FullscreenBtn from './FullscreenBtn';

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_W = 120;
const PADDLE_H = 15;
const BALL_R = 10;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_W = 80;
const BRICK_H = 25;
const BRICK_GAP = 12;
const COLORS = ['#ff0055','#ff4400','#ffea00','#00ffaa','#00aaff','#aa00ff'];

function initBricks() {
    const bricks = [];
    const offsetX = (WIDTH - (BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;
    for (let r = 0; r < BRICK_ROWS; r++)
        for (let c = 0; c < BRICK_COLS; c++)
            bricks.push({ id:`${r}-${c}`, x: offsetX + c*(BRICK_W+BRICK_GAP), y: 80 + r*(BRICK_H+BRICK_GAP), status:1, color:COLORS[r%COLORS.length] });
    return bricks;
}

export default function Arkanoid({ onExit }) {
    const containerRef = useRef(null);
    const requestRef = useRef(null);
    const moveDir = useRef(0);
    const [showInfo, setShowInfo] = useState(false);

    const stateRef = useRef({
        paddleX: WIDTH / 2 - PADDLE_W / 2,
        ball: { x: WIDTH / 2, y: HEIGHT - 40 - BALL_R, dx: 0, dy: 0 },
        bricks: initBricks(),
        status: 'idle', score: 0, multiplier: 1, lives: 3, lastStatus: 'idle',
    });

    const [, setTick] = useState(0);
    const [showSave, setShowSave] = useState(false);

    const update = useCallback(() => {
        const st = stateRef.current;
        let needs = false;

        if (moveDir.current !== 0 && st.status !== 'paused') {
            st.paddleX = Math.max(0, Math.min(st.paddleX + moveDir.current * 12, WIDTH - PADDLE_W));
            needs = true;
        }

        if (st.status === 'served') {
            st.ball.x = st.paddleX + PADDLE_W / 2;
            st.ball.y = HEIGHT - 40 - BALL_R;
            needs = true;
        } else if (st.status === 'playing') {
            st.ball.x += st.ball.dx;
            st.ball.y += st.ball.dy;
            needs = true;

            if (st.ball.x <= BALL_R)          { st.ball.x = BALL_R;          st.ball.dx *= -1; }
            if (st.ball.x >= WIDTH - BALL_R)  { st.ball.x = WIDTH - BALL_R;  st.ball.dx *= -1; }
            if (st.ball.y <= BALL_R)           { st.ball.y = BALL_R;          st.ball.dy *= -1; }

            if (st.ball.y >= HEIGHT - BALL_R) {
                arkanoidBallLost();
                st.lives--;
                if (st.lives <= 0) { st.status = 'gameover'; setTick(t=>t+1); return; }
                st.status = 'served'; st.multiplier = 1; setTick(t=>t+1);
                requestRef.current = requestAnimationFrame(update);
                return;
            }

            // Paddle collision
            const paddleY = HEIGHT - 40;
            if (st.ball.dy > 0 &&
                st.ball.y + BALL_R >= paddleY && st.ball.y - BALL_R <= paddleY + PADDLE_H &&
                st.ball.x >= st.paddleX - BALL_R && st.ball.x <= st.paddleX + PADDLE_W + BALL_R) {
                st.ball.y = paddleY - BALL_R;
                const norm = (st.ball.x - (st.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
                const angle = norm * Math.PI / 3;
                const speed = Math.min(14, 8 + st.score / 500);
                st.ball.dx = speed * Math.sin(angle);
                st.ball.dy = -speed * Math.cos(angle);
                st.multiplier = 1;
                arkanoidPaddle();
            }

            // Brick collision
            let active = 0, hit = false;
            for (const b of st.bricks) {
                if (b.status !== 1) continue;
                active++;
                if (hit) continue;
                const tx = Math.max(b.x, Math.min(st.ball.x, b.x + BRICK_W));
                const ty = Math.max(b.y, Math.min(st.ball.y, b.y + BRICK_H));
                const dx = st.ball.x - tx, dy = st.ball.y - ty;
                if (Math.sqrt(dx*dx + dy*dy) <= BALL_R) {
                    b.status = 0;
                    st.score += 10 * st.multiplier;
                    st.multiplier++;
                    hit = true;
                    arkanoidBrick();
                    if (Math.abs(dx) > Math.abs(dy)) { st.ball.dx *= -1; st.ball.x += st.ball.dx > 0 ? 2 : -2; }
                    else                              { st.ball.dy *= -1; st.ball.y += st.ball.dy > 0 ? 2 : -2; }
                }
            }
            if (active === 0) { st.status = 'won'; setTick(t=>t+1); return; }
        }

        if (needs) { setTick(t=>t+1); requestRef.current = requestAnimationFrame(update); }
    }, []);

    useEffect(() => {
        const st = stateRef.current;
        if (st.status === 'playing' || st.status === 'served')
            requestRef.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(requestRef.current);
    }, [update]);

    // Keyboard
    useEffect(() => {
        const keys = new Set();
        const sync = () => {
            moveDir.current = keys.has('ArrowLeft') ? -1 : (keys.has('ArrowRight') ? 1 : 0);
        };
        const down = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
            if ((e.key === ' ' || e.key === 'Enter') && stateRef.current.status === 'served') { e.preventDefault(); launchBall(); }
            keys.add(e.key); sync();
        };
        const up = (e) => { keys.delete(e.key); sync(); };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    }, []);

    const launchBall = () => {
        const st = stateRef.current;
        if (st.status !== 'served') return;
        arkanoidStart();
        st.status = 'playing';
        const angle = (Math.random() * Math.PI / 4) - Math.PI / 8;
        st.ball.dx = 8 * Math.sin(angle);
        st.ball.dy = -8 * Math.cos(angle);
        cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(update);
    };

    const initGame = () => {
        const st = stateRef.current;
        st.paddleX = WIDTH / 2 - PADDLE_W / 2;
        st.bricks = initBricks();
        st.status = 'served'; st.score = 0; st.multiplier = 1; st.lives = 3;
        setShowSave(false);
        setTick(t=>t+1);
        cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(update);
    };

    const handlePointerMove = (e) => {
        const st = stateRef.current;
        if ((st.status !== 'playing' && st.status !== 'served') || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
        st.paddleX = Math.max(0, Math.min(x - PADDLE_W / 2, WIDTH - PADDLE_W));
    };

    const toggleInfo = () => {
        setShowInfo(prev => {
            const st = stateRef.current;
            if (!prev && (st.status === 'playing' || st.status === 'served')) {
                st.lastStatus = st.status; st.status = 'paused';
            } else if (prev && st.status === 'paused') {
                st.status = st.lastStatus;
                if (st.status === 'playing' || st.status === 'served')
                    requestRef.current = requestAnimationFrame(update);
            }
            return !prev;
        });
    };

    const st = stateRef.current;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#050510', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Segoe UI", sans-serif', color: '#fff', padding: 10, boxSizing: 'border-box',
        }}>
            {/* Back */}
            <button onClick={onExit} style={{
                position: 'absolute', top: 12, left: 12,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem', zIndex: 110,
            }}>← Arkade</button>

            {/* Info button */}
            <button onClick={toggleInfo} style={{
                position: 'absolute', top: 12, right: 12,
                width: 44, height: 44, borderRadius: '50%',
                background: '#ffaa00', color: '#050510', fontSize: '1.4rem', fontWeight: 700,
                border: 'none', cursor: 'pointer', zIndex: 110, boxShadow: '0 0 15px #ffaa00',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>?</button>
            <FullscreenBtn style={{ position: 'absolute', top: 12, right: 64, zIndex: 110 }} />

            {showInfo && (
                <div style={{ position:'fixed', inset:0, background:'rgba(5,5,16,0.95)', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
                    <h2 style={{ color:'#00ffaa', fontSize:'2rem', marginBottom:20, textAlign:'center' }}>FÍSICA DEL REBOTE</h2>
                    <div style={{ maxWidth:700, background:'#1a1a3a', padding:30, borderRadius:15, fontSize:'1rem', lineHeight:1.7, border:'2px solid #00ffaa' }}>
                        <p>En este juego, el rebote depende de <strong>dónde golpees la bola</strong> con la pala.</p>
                        <h3 style={{ color:'#ffaa00' }}>Punto de Impacto</h3>
                        <p>Calculamos la posición relativa entre -1 (extremo izq.) y 1 (extremo der.): <code>x_rel = (x_bola − centro_pala) / (ancho/2)</code></p>
                        <h3 style={{ color:'#ffaa00' }}>Ángulo de Salida</h3>
                        <p>Lo multiplicamos por el ángulo máximo (60°): <code>θ = x_rel × 60°</code></p>
                        <h3 style={{ color:'#ffaa00' }}>Vectores de Velocidad</h3>
                        <p><code>vx = v · sin(θ)</code> &nbsp;·&nbsp; <code>vy = −v · cos(θ)</code></p>
                        <button onClick={toggleInfo} style={{ marginTop:24, width:'100%', padding:14, fontSize:'1.1rem', background:'#ff0055', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
                            Entendido / Volver al juego
                        </button>
                    </div>
                </div>
            )}

            {/* HUD */}
            <div style={{ marginBottom:8, textAlign:'center', width:'100%', maxWidth:800 }}>
                <h1 style={{ margin:0, fontSize:'2rem', letterSpacing:4, color:'#00ffaa', textShadow:'0 0 10px #00ffaa' }}>CYBER BREAK</h1>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6, fontSize:'1.3rem', fontWeight:700 }}>
                    <span style={{ width:140, textAlign:'left' }}>PUNTOS: {st.score}</span>
                    <span style={{ flex:1, textAlign:'center', fontSize:'1.5rem' }}>
                        {Array.from({length:3}).map((_,i)=>(
                            <span key={i} style={{ color: i < st.lives ? '#ff0055' : 'rgba(255,255,255,0.15)', margin:'0 4px' }}>♥</span>
                        ))}
                    </span>
                    <span style={{ width:140, textAlign:'right', color:'#ffaa00' }}>COMBO: x{st.multiplier}</span>
                </div>
            </div>

            {/* Canvas */}
            <div ref={containerRef} onPointerMove={handlePointerMove}
                style={{
                    width:'100%', maxWidth:WIDTH, aspectRatio:`${WIDTH}/${HEIGHT}`,
                    background:'#0a0a1a', position:'relative', overflow:'hidden',
                    borderRadius:12, border:'2px solid #1a1a3a',
                    boxShadow:'0 0 30px rgba(0,255,170,0.2)', touchAction:'none',
                    cursor:(st.status==='playing'||st.status==='served')?'none':'default',
                }}>

                {st.bricks.map(b => b.status===1 && (
                    <div key={b.id} style={{
                        position:'absolute',
                        left:`${(b.x/WIDTH)*100}%`, top:`${(b.y/HEIGHT)*100}%`,
                        width:`${(BRICK_W/WIDTH)*100}%`, height:`${(BRICK_H/HEIGHT)*100}%`,
                        background:b.color, borderRadius:4,
                        boxShadow:`0 0 10px ${b.color}, inset 0 0 5px rgba(255,255,255,0.5)`,
                        border:'1px solid rgba(255,255,255,0.2)',
                    }}/>
                ))}

                {(st.status==='playing'||st.status==='served'||st.status==='idle') && (<>
                    <div style={{ position:'absolute', left:`${(st.paddleX/WIDTH)*100}%`, top:`${((HEIGHT-40)/HEIGHT)*100}%`, width:`${(PADDLE_W/WIDTH)*100}%`, height:`${(PADDLE_H/HEIGHT)*100}%`, background:'#00ffaa', borderRadius:8, boxShadow:'0 0 15px #00ffaa' }}/>
                    <div style={{ position:'absolute', left:`${((st.ball.x-BALL_R)/WIDTH)*100}%`, top:`${((st.ball.y-BALL_R)/HEIGHT)*100}%`, width:`${(BALL_R*2/WIDTH)*100}%`, height:`${(BALL_R*2/HEIGHT)*100}%`, background:'#ff0055', borderRadius:'50%', boxShadow:'0 0 15px #ff0055, 0 0 30px #ff0055' }}/>
                </>)}

                {st.status==='served' && (
                    <div onPointerDown={launchBall} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:10 }}>
                        <h2 style={{ color:'#fff', textShadow:'0 0 15px #00ffaa', fontSize:'2rem', background:'rgba(0,0,0,0.5)', padding:'10px 20px', borderRadius:10 }}>PULSA PARA LANZAR</h2>
                    </div>
                )}

                {(st.status==='idle'||st.status==='gameover'||st.status==='won') && (
                    <div style={{ position:'absolute', inset:0, background:'rgba(5,5,16,0.88)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', zIndex:20, padding:16 }}>
                        <h2 style={{ fontSize:'2.5rem', color: st.status==='won'?'#00ffaa':st.status==='gameover'?'#ff0055':'#fff', textShadow:`0 0 20px ${st.status==='won'?'#00ffaa':'#ff0055'}`, margin:'0 0 10px', textTransform:'uppercase', textAlign:'center' }}>
                            {st.status==='idle'?'¿Listo?':st.status==='gameover'?'Game Over':'¡Completado!'}
                        </h2>
                        {st.status!=='idle' && <p style={{ fontSize:'1.4rem', color:'#ffaa00', margin:'0 0 12px' }}>Puntos: {st.score.toLocaleString()}</p>}
                        {(st.status==='gameover'||st.status==='won') && (
                            showSave
                                ? <SaveForm gameKey="ARKANOID" score={st.score} accentColor="#00ffaa" onDone={()=>setShowSave(false)} />
                                : <button onClick={()=>setShowSave(true)} style={{ background:'rgba(0,255,170,0.1)', color:'#00ffaa', border:'1px solid #00ffaa44', borderRadius:7, padding:'6px 16px', cursor:'pointer', fontSize:'0.82rem', marginBottom:12 }}>
                                    📋 Guardar puntuación
                                  </button>
                        )}
                        <button onClick={initGame} style={{ padding:'11px 32px', fontSize:'1.1rem', fontWeight:700, background:'transparent', color:'#00ffaa', border:'3px solid #00ffaa', borderRadius:8, cursor:'pointer', boxShadow:'0 0 15px rgba(0,255,170,0.4)' }}>
                            {st.status==='idle'?'Iniciar':'Reiniciar'}
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile buttons */}
            <div style={{ display:'flex', gap:12, marginTop:14, width:'100%', maxWidth:800, justifyContent:'center' }}>
                <button onPointerDown={e=>{e.preventDefault();moveDir.current=-1}} onPointerUp={()=>moveDir.current=0} onPointerLeave={()=>moveDir.current=0}
                    style={{ flex:1, maxWidth:160, padding:'16px 0', fontSize:'1.8rem', fontWeight:700, background:'#1a1a3a', color:'#00ffaa', border:'2px solid #00ffaa', borderRadius:10, cursor:'pointer', userSelect:'none', touchAction:'none', boxShadow:'0 4px 10px rgba(0,0,0,0.5)' }}>
                    ◀ IZQ
                </button>
                <button onPointerDown={e=>{e.preventDefault();if(stateRef.current.status==='served')launchBall()}}
                    style={{ flex:1, maxWidth:100, padding:'16px 0', fontSize:'1rem', fontWeight:700, background:'rgba(0,255,170,0.1)', color:'#00ffaa', border:'2px solid #00ffaa44', borderRadius:10, cursor:'pointer', userSelect:'none', touchAction:'none' }}>
                    LANZAR
                </button>
                <button onPointerDown={e=>{e.preventDefault();moveDir.current=1}} onPointerUp={()=>moveDir.current=0} onPointerLeave={()=>moveDir.current=0}
                    style={{ flex:1, maxWidth:160, padding:'16px 0', fontSize:'1.8rem', fontWeight:700, background:'#1a1a3a', color:'#00ffaa', border:'2px solid #00ffaa', borderRadius:10, cursor:'pointer', userSelect:'none', touchAction:'none', boxShadow:'0 4px 10px rgba(0,0,0,0.5)' }}>
                    DER ▶
                </button>
            </div>
            <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'0.75rem', marginTop:8 }}>← → Mover pala · Espacio / Enter: lanzar · Ratón: apuntar</p>
        </div>
    );
}
