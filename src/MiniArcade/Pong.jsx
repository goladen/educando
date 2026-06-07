import React, { useState, useEffect, useCallback, useRef } from 'react';
import { pongPaddle, pongWall, pongPoint } from './sounds';
import FullscreenBtn from './FullscreenBtn';

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_W = 15;
const PADDLE_H = 100;
const BALL_R = 10;
const PADDLE_OFFSET = 30;
const WIN_SCORE = 7;

export default function Pong({ onExit }) {
    const containerRef = useRef(null);
    const requestRef = useRef(null);
    const p1Move = useRef(0);
    const p2Move = useRef(0);

    const stateRef = useRef({
        p1Y: HEIGHT / 2 - PADDLE_H / 2,
        p2Y: HEIGHT / 2 - PADDLE_H / 2,
        ball: { x: WIDTH / 2, y: HEIGHT / 2, dx: 0, dy: 0 },
        score1: 0, score2: 0,
        status: 'menu', mode: 'pve', winner: null, lastWinner: 1,
    });

    const [, setTick] = useState(0);

    const resetBall = (server) => {
        const st = stateRef.current;
        st.ball = { x: WIDTH / 2, y: HEIGHT / 2, dx: 0, dy: 0 };
        st.p1Y = HEIGHT / 2 - PADDLE_H / 2;
        st.p2Y = HEIGHT / 2 - PADDLE_H / 2;
        st.status = 'served';
        st.lastWinner = server;
    };

    const update = useCallback(() => {
        const st = stateRef.current;
        if (st.status !== 'playing' && st.status !== 'served') return;

        const pSpeed = 10;
        if (p1Move.current !== 0) {
            st.p1Y = Math.max(0, Math.min(st.p1Y + p1Move.current * pSpeed, HEIGHT - PADDLE_H));
        }
        if (st.mode === 'pvp') {
            if (p2Move.current !== 0)
                st.p2Y = Math.max(0, Math.min(st.p2Y + p2Move.current * pSpeed, HEIGHT - PADDLE_H));
        } else if (st.status === 'playing') {
            const target = st.ball.y - PADDLE_H / 2;
            if (target < st.p2Y - 5) st.p2Y -= 6;
            else if (target > st.p2Y + 5) st.p2Y += 6;
            st.p2Y = Math.max(0, Math.min(st.p2Y, HEIGHT - PADDLE_H));
        }

        if (st.status === 'playing') {
            st.ball.x += st.ball.dx;
            st.ball.y += st.ball.dy;

            if (st.ball.y <= BALL_R)          { st.ball.y = BALL_R;          st.ball.dy *= -1; pongWall(); }
            if (st.ball.y >= HEIGHT - BALL_R) { st.ball.y = HEIGHT - BALL_R; st.ball.dy *= -1; pongWall(); }

            // P1 paddle
            const p1R = PADDLE_OFFSET + PADDLE_W;
            if (st.ball.dx < 0 && st.ball.x - BALL_R <= p1R && st.ball.x + BALL_R >= PADDLE_OFFSET &&
                st.ball.y + BALL_R >= st.p1Y && st.ball.y - BALL_R <= st.p1Y + PADDLE_H) {
                st.ball.x = p1R + BALL_R;
                const norm = (st.ball.y - (st.p1Y + PADDLE_H / 2)) / (PADDLE_H / 2);
                const angle = norm * Math.PI / 3;
                const speed = Math.min(18, Math.sqrt(st.ball.dx ** 2 + st.ball.dy ** 2) + 0.5);
                st.ball.dx = speed * Math.cos(angle);
                st.ball.dy = speed * Math.sin(angle);
                pongPaddle();
            }

            // P2 paddle
            const p2L = WIDTH - PADDLE_OFFSET - PADDLE_W;
            if (st.ball.dx > 0 && st.ball.x + BALL_R >= p2L && st.ball.x - BALL_R <= WIDTH - PADDLE_OFFSET &&
                st.ball.y + BALL_R >= st.p2Y && st.ball.y - BALL_R <= st.p2Y + PADDLE_H) {
                st.ball.x = p2L - BALL_R;
                const norm = (st.ball.y - (st.p2Y + PADDLE_H / 2)) / (PADDLE_H / 2);
                const angle = norm * Math.PI / 3;
                const speed = Math.min(18, Math.sqrt(st.ball.dx ** 2 + st.ball.dy ** 2) + 0.5);
                st.ball.dx = -speed * Math.cos(angle);
                st.ball.dy = speed * Math.sin(angle);
                pongPaddle();
            }

            if (st.ball.x < 0) {
                pongPoint();
                st.score2++;
                if (st.score2 >= WIN_SCORE) { st.status = 'gameover'; st.winner = st.mode === 'pve' ? 'CPU' : 'PLAYER 2'; }
                else resetBall(2);
            } else if (st.ball.x > WIDTH) {
                pongPoint();
                st.score1++;
                if (st.score1 >= WIN_SCORE) { st.status = 'gameover'; st.winner = 'PLAYER 1'; }
                else resetBall(1);
            }
        }

        setTick(t => t + 1);
        requestRef.current = requestAnimationFrame(update);
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
            p1Move.current = keys.has('w') || keys.has('W') ? -1 : (keys.has('s') || keys.has('S') ? 1 : 0);
            p2Move.current = keys.has('ArrowUp') ? -1 : (keys.has('ArrowDown') ? 1 : 0);
        };
        const down = (e) => {
            const st = stateRef.current;
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (st.status === 'served') launchBall();
            }
            keys.add(e.key);
            sync();
        };
        const up = (e) => { keys.delete(e.key); sync(); };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    }, []);

    const launchBall = () => {
        const st = stateRef.current;
        if (st.status !== 'served') return;
        st.status = 'playing';
        const angle = (Math.random() * Math.PI / 6) - Math.PI / 12;
        const speed = 8;
        const dir = st.lastWinner === 1 ? 1 : -1;
        st.ball.dx = speed * dir * Math.cos(angle);
        st.ball.dy = speed * Math.sin(angle);
        setTick(t => t + 1);
        cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(update);
    };

    const startGame = (mode) => {
        stateRef.current = {
            p1Y: HEIGHT / 2 - PADDLE_H / 2, p2Y: HEIGHT / 2 - PADDLE_H / 2,
            ball: { x: WIDTH / 2, y: HEIGHT / 2, dx: 0, dy: 0 },
            score1: 0, score2: 0, status: 'served', mode, winner: null, lastWinner: 1,
        };
        setTick(t => t + 1);
        cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(update);
    };

    const handlePointerMove = (e) => {
        const st = stateRef.current;
        if ((st.status !== 'playing' && st.status !== 'served') || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
        y = Math.max(0, Math.min(y - PADDLE_H / 2, HEIGHT - PADDLE_H));
        const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
        if (x < WIDTH / 2) st.p1Y = y;
        else if (st.mode === 'pvp') st.p2Y = y;
    };

    const st = stateRef.current;
    const btnStyle = (color) => ({
        flex: 1, padding: '18px 0', fontSize: '1.8rem', fontWeight: 700,
        background: '#1a1a3a', color, border: `2px solid ${color}`,
        borderRadius: 10, cursor: 'pointer', userSelect: 'none', touchAction: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '6px 0', boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#050510', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Segoe UI", sans-serif', color: '#fff', padding: 10, boxSizing: 'border-box',
        }}>
            {/* Back button */}
            <button onClick={onExit} style={{
                position: 'absolute', top: 12, left: 12,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem', zIndex: 10,
            }}>← Arkade</button>
            <FullscreenBtn style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }} />

            {st.status !== 'menu' && (
                <div style={{ marginBottom: 8, textAlign: 'center', width: '100%', maxWidth: 1000 }}>
                    <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: 4, color: '#00ffaa', textShadow: '0 0 10px #00ffaa' }}>CYBER PONG</h1>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: '1.6rem', fontWeight: 700 }}>
                        <span style={{ width: 140, textAlign: 'left', color: '#00aaff' }}>P1: {st.score1}</span>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: '1rem', color: '#ff0055' }}>PRIMERO EN {WIN_SCORE}</span>
                        <span style={{ width: 140, textAlign: 'right', color: st.mode === 'pve' ? '#ff0055' : '#aa00ff' }}>
                            {st.mode === 'pve' ? 'CPU' : 'P2'}: {st.score2}
                        </span>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', width: '100%', maxWidth: 1000, gap: 12 }}>
                {/* P1 mobile buttons */}
                {st.status !== 'menu' && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: 70 }}>
                        <button onPointerDown={e=>{e.preventDefault();p1Move.current=-1}} onPointerUp={()=>p1Move.current=0} onPointerLeave={()=>p1Move.current=0} style={btnStyle('#00aaff')}>▲</button>
                        <button onPointerDown={e=>{e.preventDefault();p1Move.current=1}} onPointerUp={()=>p1Move.current=0} onPointerLeave={()=>p1Move.current=0} style={btnStyle('#00aaff')}>▼</button>
                    </div>
                )}

                {/* Canvas */}
                <div ref={containerRef} onPointerMove={handlePointerMove}
                    style={{
                        flex: 1, maxWidth: WIDTH, aspectRatio: `${WIDTH}/${HEIGHT}`,
                        background: '#0a0a1a', position: 'relative', overflow: 'hidden',
                        borderRadius: 12, border: '2px solid #1a1a3a',
                        boxShadow: '0 0 30px rgba(0,255,170,0.2)', touchAction: 'none',
                        cursor: (st.status==='playing'||st.status==='served') ? 'none' : 'default',
                    }}>

                    {/* Center line */}
                    {st.status !== 'menu' && (
                        <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:4, marginLeft:-2, borderLeft:'4px dashed rgba(0,255,170,0.3)' }} />
                    )}

                    {(st.status==='playing'||st.status==='served'||st.status==='gameover') && (<>
                        {/* P1 paddle */}
                        <div style={{ position:'absolute', left:`${(PADDLE_OFFSET/WIDTH)*100}%`, top:`${(st.p1Y/HEIGHT)*100}%`, width:`${(PADDLE_W/WIDTH)*100}%`, height:`${(PADDLE_H/HEIGHT)*100}%`, background:'#00aaff', borderRadius:8, boxShadow:'0 0 15px #00aaff' }} />
                        {/* P2 paddle */}
                        <div style={{ position:'absolute', left:`${((WIDTH-PADDLE_OFFSET-PADDLE_W)/WIDTH)*100}%`, top:`${(st.p2Y/HEIGHT)*100}%`, width:`${(PADDLE_W/WIDTH)*100}%`, height:`${(PADDLE_H/HEIGHT)*100}%`, background: st.mode==='pve'?'#ff0055':'#aa00ff', borderRadius:8, boxShadow:`0 0 15px ${st.mode==='pve'?'#ff0055':'#aa00ff'}` }} />
                        {/* Ball */}
                        <div style={{ position:'absolute', left:`${((st.ball.x-BALL_R)/WIDTH)*100}%`, top:`${((st.ball.y-BALL_R)/HEIGHT)*100}%`, width:`${(BALL_R*2/WIDTH)*100}%`, height:`${(BALL_R*2/HEIGHT)*100}%`, background:'#00ffaa', borderRadius:'50%', boxShadow:'0 0 15px #00ffaa, 0 0 30px #00ffaa' }} />
                    </>)}

                    {st.status==='served' && (
                        <div onPointerDown={launchBall} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:10 }}>
                            <h2 style={{ color:'#fff', textShadow:'0 0 15px #00ffaa', fontSize:'2rem', background:'rgba(0,0,0,0.5)', padding:'10px 20px', borderRadius:10, textAlign:'center' }}>PULSA PARA SACAR</h2>
                        </div>
                    )}

                    {st.status==='menu' && (
                        <div style={{ position:'absolute', inset:0, background:'rgba(5,5,16,0.9)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:20 }}>
                            <h1 style={{ fontSize:'3.5rem', color:'#00ffaa', textShadow:'0 0 20px #00ffaa', margin:'0 0 30px', letterSpacing:6 }}>CYBER PONG</h1>
                            <button onClick={()=>startGame('pve')} style={{ padding:'14px 36px', fontSize:'1.4rem', fontWeight:700, background:'transparent', color:'#00ffaa', border:'2px solid #00ffaa', borderRadius:8, cursor:'pointer', marginBottom:16, width:280 }}>1 JUGADOR vs CPU</button>
                            <button onClick={()=>startGame('pvp')} style={{ padding:'14px 36px', fontSize:'1.4rem', fontWeight:700, background:'transparent', color:'#aa00ff', border:'2px solid #aa00ff', borderRadius:8, cursor:'pointer', width:280 }}>2 JUGADORES</button>
                        </div>
                    )}

                    {st.status==='gameover' && (
                        <div style={{ position:'absolute', inset:0, background:'rgba(5,5,16,0.85)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:20 }}>
                            <h2 style={{ fontSize:'3.5rem', color:'#ffaa00', textShadow:'0 0 20px #ffaa00', margin:'0 0 16px', textTransform:'uppercase' }}>{st.winner} WINS!</h2>
                            <p style={{ fontSize:'1.8rem', color:'#fff', margin:'0 0 30px' }}>{st.score1} - {st.score2}</p>
                            <button onClick={()=>{st.status='menu';setTick(t=>t+1);}} style={{ padding:'14px 36px', fontSize:'1.3rem', fontWeight:700, background:'transparent', color:'#00ffaa', border:'2px solid #00ffaa', borderRadius:8, cursor:'pointer', width:280 }}>MENÚ</button>
                        </div>
                    )}
                </div>

                {/* P2 mobile buttons */}
                {st.status !== 'menu' && (
                    <div style={{ display:'flex', flexDirection:'column', width:70, visibility: st.mode==='pvp'?'visible':'hidden' }}>
                        <button onPointerDown={e=>{e.preventDefault();p2Move.current=-1}} onPointerUp={()=>p2Move.current=0} onPointerLeave={()=>p2Move.current=0} style={btnStyle('#aa00ff')}>▲</button>
                        <button onPointerDown={e=>{e.preventDefault();p2Move.current=1}} onPointerUp={()=>p2Move.current=0} onPointerLeave={()=>p2Move.current=0} style={btnStyle('#aa00ff')}>▼</button>
                    </div>
                )}
            </div>

            {st.status !== 'menu' && (
                <p style={{ marginTop:10, color:'rgba(255,255,255,0.3)', fontSize:'0.8rem', textAlign:'center' }}>
                    P1: W/S · P2: ↑/↓ · ESPACIO: sacar · Arrastra el ratón sobre tu mitad
                </p>
            )}
        </div>
    );
}
