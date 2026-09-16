const App = () => {
    const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    const [gameState, setGameState] = useState('START'); // START, PLAYING, DEAD, WIN
    const [score, setScore] = useState(0);
    const [doll, setDoll] = useState('GREEN'); // GREEN, WARNING, RED
    const [problem, setProblem] = useState(null);
    const [scoreSent, setScoreSent] = useState(false);

    useEffect(() => {
        const updateSize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const toSuper = useCallback((n) => {
        const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
        return String(n).split('').map(c => map[c] || c).join('');
    }, []);

    const generateProblem = useCallback(() => {
        const ops = ['+', '-', '×'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let a, b, c, d, ansCoef, ansExp;

        if (op === '×') {
            const pairs = [[2, 2], [2, 3], [2, 4], [3, 2], [3, 3]];
            const pair = pairs[Math.floor(Math.random() * pairs.length)];
            a = pair[0]; c = pair[1];
            b = Math.floor(Math.random() * 4) + 2;
            d = Math.floor(Math.random() * 4) + 2;
            ansCoef = a * c;
            ansExp = b + d;
        } else if (op === '+') {
            b = Math.floor(Math.random() * 5) + 3;
            d = b;
            a = Math.floor(Math.random() * 5) + 1;
            c = Math.floor(Math.random() * 4) + 1;
            ansCoef = a + c;
            ansExp = b;
        } else {
            b = Math.floor(Math.random() * 5) + 3;
            d = b;
            a = Math.floor(Math.random() * 5) + 5;
            c = Math.floor(Math.random() * 4) + 1;
            ansCoef = a - c;
            ansExp = b;
        }

        const correctStr = `${ansCoef} × 10${toSuper(ansExp)}`;
        const text = `(${a} × 10${toSuper(b)}) ${op} (${c} × 10${toSuper(d)})`;

        const opts = new Set([correctStr]);
        while (opts.size < 4) {
            const wCoef = ansCoef + (Math.floor(Math.random() * 5) - 2);
            const safeWCoef = wCoef <= 0 ? 1 : wCoef;
            const wExp = ansExp + (Math.floor(Math.random() * 3) - 1);
            opts.add(`${safeWCoef} × 10${toSuper(wExp)}`);
        }
        return {
            text,
            correct: correctStr,
            options: Array.from(opts).sort(() => Math.random() - 0.5)
        };
    }, [toSuper]);

    useEffect(() => {
        if (gameState !== 'PLAYING') return;

        let timeoutId;
        if (doll === 'GREEN') {
            timeoutId = setTimeout(() => setDoll('WARNING'), Math.random() * 3000 + 2500);
        } else if (doll === 'WARNING') {
            timeoutId = setTimeout(() => setDoll('RED'), 1000);
        } else if (doll === 'RED') {
            timeoutId = setTimeout(() => setDoll('GREEN'), Math.random() * 2500 + 1500);
        }
        return () => clearTimeout(timeoutId);
    }, [gameState, doll]);

    useEffect(() => {
        if (gameState !== 'PLAYING') return;
        
        const handleMove = (e) => {
            if (doll === 'RED') {
                setGameState('DEAD');
            }
        };

        window.addEventListener('keydown', handleMove);
        window.addEventListener('pointerdown', handleMove, { capture: true });
        return () => {
            window.removeEventListener('keydown', handleMove);
            window.removeEventListener('pointerdown', handleMove, { capture: true });
        };
    }, [gameState, doll]);

    const startGame = () => {
        setScore(0);
        setScoreSent(false);
        setDoll('GREEN');
        setProblem(generateProblem());
        setGameState('PLAYING');
    };

    const handleAnswer = (ans, e) => {
        e.stopPropagation();
        if (doll === 'RED') {
            setGameState('DEAD');
            return;
        }
        if (ans === problem.correct) {
            const newScore = score + 1;
            setScore(newScore);
            if (newScore >= 20) {
                setGameState('WIN');
            } else {
                setProblem(generateProblem());
            }
        } else {
            setGameState('DEAD');
        }
    };

    const handleSend = () => {
        if (typeof enviarPuntuacion !== 'undefined') {
            enviarPuntuacion({ puntos: score });
        }
        setScoreSent(true);
    };

    const isMobile = size.w < 768;

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: gameState === 'PLAYING'
                ? (doll === 'GREEN' ? '#c8e6c9' : doll === 'WARNING' ? '#fff9c4' : '#ffcdd2')
                : '#1a1a1a',
            color: gameState === 'PLAYING' ? '#000' : '#fff',
            overflow: 'hidden',
            transition: 'background-color 0.2s ease',
            boxSizing: 'border-box',
            touchAction: 'none'
        }}>
            {gameState === 'START' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', color: '#ed1b76', margin: '0 0 20px 0', textTransform: 'uppercase' }}>El Juego del Calcular</h1>
                    <div style={{ fontSize: 'clamp(1.2rem, 4vw, 2.5rem)', maxWidth: '800px', marginBottom: '40px', lineHeight: '1.5' }}>
                        <p>1. Resuelve operaciones en notación científica para avanzar.</p>
                        <p>2. Necesitas 20 aciertos para cruzar la meta.</p>
                        <p style={{ color: '#ed1b76', fontWeight: 'bold' }}>3. Si respondes o tocas cualquier cosa durante la LUZ ROJA, serás eliminado.</p>
                    </div>
                    <button onClick={startGame} style={{
                        backgroundColor: '#00a859', color: 'white', border: 'none', padding: '20px 60px',
                        fontSize: 'clamp(2rem, 5vw, 4rem)', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold',
                        boxShadow: '0 8px 0 #007a41'
                    }}>JUGAR</button>
                </div>
            )}

            {gameState === 'PLAYING' && (
                <>
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 'bold', color: '#333' }}>
                            PASO: {score} / 20
                        </div>
                        <div style={{
                            width: '100%', maxWidth: '1000px', height: '40px', backgroundColor: 'rgba(0,0,0,0.1)',
                            borderRadius: '20px', overflow: 'hidden', position: 'relative'
                        }}>
                            <div style={{
                                width: `${(score / 20) * 100}%`, height: '100%', backgroundColor: '#00a859', transition: 'width 0.3s'
                            }} />
                            <span style={{
                                position: 'absolute', top: '2px', left: `${(score / 20) * 100}%`,
                                transition: 'left 0.3s', fontSize: '30px', transform: 'translateX(-50%)'
                            }}>🏃</span>
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ fontSize: 'clamp(6rem, 20vw, 15rem)', lineHeight: 1 }}>
                            {doll === 'GREEN' ? '👧🏻' : doll === 'WARNING' ? '👧🏻' : '👹'}
                        </div>
                        <div style={{
                            fontSize: 'clamp(2rem, 6vw, 5rem)', fontWeight: '900', textAlign: 'center', marginTop: '10px',
                            color: doll === 'RED' ? '#d32f2f' : '#333'
                        }}>
                            {doll === 'GREEN' ? '🟢 LUZ VERDE' : doll === 'WARNING' ? '🟡 ¡ATENCIÓN!' : '🔴 LUZ ROJA'}
                        </div>
                    </div>

                    <div style={{
                        padding: isMobile ? '20px 10px 40px 10px' : '30px 40px 50px 40px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px',
                        backgroundColor: 'rgba(255,255,255,0.9)', borderTopLeftRadius: '30px', borderTopRightRadius: '30px'
                    }}>
                        <div style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', fontWeight: 'bold', textAlign: 'center', color: '#000' }}>
                            {problem?.text}
                        </div>
                        <div style={{
                            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                            gap: '15px', width: '100%', maxWidth: '900px'
                        }}>
                            {problem?.options.map((opt, i) => (
                                <button
                                    key={i}
                                    onPointerDown={(e) => handleAnswer(opt, e)}
                                    style={{
                                        padding: '20px', fontSize: 'clamp(1.8rem, 5vw, 3.5rem)', fontWeight: 'bold',
                                        borderRadius: '15px', border: 'none', backgroundColor: '#ed1b76', color: 'white',
                                        cursor: 'pointer', minHeight: '80px', boxShadow: '0 8px 0 #b31257',
                                        touchAction: 'manipulation'
                                    }}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {(gameState === 'DEAD' || gameState === 'WIN') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 'clamp(5rem, 15vw, 10rem)' }}>{gameState === 'WIN' ? '🏆' : '💀'}</div>
                    <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', color: gameState === 'WIN' ? '#00a859' : '#ed1b76', margin: '20px 0' }}>
                        {gameState === 'WIN' ? '¡SOBREVIVISTE!' : '¡ELIMINADO!'}
                    </h1>
                    <p style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)', margin: '0 0 40px 0' }}>
                        Operaciones completadas: {score} / 20
                    </p>
                    
                    <button
                        onClick={handleSend}
                        disabled={scoreSent}
                        style={{
                            backgroundColor: scoreSent ? '#4caf50' : '#2196f3', color: '#fff', border: 'none', padding: '25px 50px',
                            fontSize: 'clamp(1.5rem, 4vw, 3rem)', borderRadius: '15px', cursor: scoreSent ? 'default' : 'pointer',
                            fontWeight: 'bold', marginBottom: '20px', width: '90%', maxWidth: '600px',
                            boxShadow: scoreSent ? 'none' : '0 8px 0 #1976d2'
                        }}
                    >
                        {scoreSent ? '✅ PUNTUACIÓN ENVIADA' : '📤 ENVIAR AL PROFESOR'}
                    </button>

                    <button onClick={startGame} style={{
                        backgroundColor: '#333', color: 'white', border: 'none', padding: '15px 40px',
                        fontSize: 'clamp(1.2rem, 3vw, 2rem)', borderRadius: '10px', cursor: 'pointer',
                        width: '90%', maxWidth: '400px'
                    }}>
                        Volver a intentar
                    </button>
                </div>
            )}
        </div>
    );
};