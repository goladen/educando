import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ─── Formato numérico (coma decimal, sin ceros sobrantes) ───
const fmt = (n) => {
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return r.toString();
  return r.toFixed(2).replace(/0$/, '').replace(/\.$/, '').replace('.', ',');
};

// ─── Definición de categorías de preguntas ───
// Cada build(i) genera una pregunta con dificultad creciente según i.
// Devuelve { q, val (respuesta correcta), dist (distractores), exp, unit }
const CAT_DEFS = {
  porcentajes: {
    label: '📊 Porcentajes',
    short: 'Porcentajes',
    count: 20,
    build: (i) => {
      const sub = i % 3;
      const p = [10, 20, 25, 5, 15, 50, 30, 40][i % 8];
      const base = 100 + i * 20;
      if (sub === 0) {
        const r = base * p / 100;
        return { q: `Hay ${base} sacos de pienso. ¿Cuánto es el ${p}% de ${base}?`, val: r, dist: [r + base * 0.1, r / 2], exp: `${p}% de ${base} = ${base} × ${p / 100} = ${fmt(r)}.`, unit: 'sacos' };
      }
      if (sub === 1) {
        const precio = base; const desc = precio * p / 100; const final = precio - desc;
        return { q: `Un comedero cuesta ${precio} €. Con un ${p}% de descuento, ¿cuánto pagas?`, val: final, dist: [desc, precio + desc], exp: `Descuento: ${fmt(desc)} €. Pagas ${precio} − ${fmt(desc)} = ${fmt(final)} €.`, unit: '€' };
      }
      const peso = base; const aum = peso * p / 100; const total = peso + aum;
      return { q: `La producción es de ${peso} kg y sube un ${p}%. ¿Cuál es la nueva producción?`, val: total, dist: [aum, peso - aum], exp: `Aumento: ${fmt(aum)} kg. Total: ${peso} + ${fmt(aum)} = ${fmt(total)} kg.`, unit: 'kg' };
    }
  },
  quimica: {
    label: '🧪 Química de los alimentos',
    short: 'Química alimentos',
    count: 20,
    build: (i) => {
      const sub = i % 4;
      const g = 10 + i * 5;
      if (sub === 0) return { q: `El pienso lleva ${g} g de grasa. Si 1 g de grasa aporta 9 kcal, ¿cuántas kcal son?`, val: g * 9, dist: [g * 4, g * 6], exp: `${g} g × 9 kcal/g = ${g * 9} kcal.`, unit: 'kcal' };
      if (sub === 1) return { q: `Una ración tiene ${g} g de proteína. Si 1 g de proteína aporta 4 kcal, ¿cuántas kcal aporta?`, val: g * 4, dist: [g * 9, g * 2], exp: `${g} g × 4 kcal/g = ${g * 4} kcal.`, unit: 'kcal' };
      if (sub === 2) {
        const N = 1000 + i * 100; const p = [18, 20, 22, 16][i % 4]; const pr = N * p / 100;
        return { q: `Un saco de ${N} g de pienso tiene un ${p}% de proteína. ¿Cuántos gramos de proteína contiene?`, val: pr, dist: [pr + 50, pr / 2], exp: `${p}% de ${N} g = ${fmt(pr)} g de proteína.`, unit: 'g' };
      }
      const pr = 20 + i; const hc = 30 + i; const gr = 5 + (i % 6);
      const tot = pr * 4 + hc * 4 + gr * 9;
      return { q: `Una ración tiene ${pr} g de proteína, ${hc} g de hidratos y ${gr} g de grasa. ¿Cuántas kcal aporta en total? (proteína e hidratos: 4 kcal/g; grasa: 9 kcal/g)`, val: tot, dist: [(pr + hc + gr) * 4, pr * 9 + hc * 4 + gr * 4], exp: `${pr}×4 + ${hc}×4 + ${gr}×9 = ${pr * 4} + ${hc * 4} + ${gr * 9} = ${tot} kcal.`, unit: 'kcal' };
    }
  },
  biologia: {
    label: '🧬 Biología',
    short: 'Biología',
    count: 20,
    build: (i) => {
      const sub = i % 4;
      if (sub === 0) {
        const m2 = 50 + i * 10; const dens = 12; const tot = m2 * dens;
        return { q: `La nave mide ${m2} m² y se recomiendan ${dens} pollos por m². ¿Cuántos pollos caben?`, val: tot, dist: [m2 + dens, tot / 2], exp: `${m2} m² × ${dens} pollos/m² = ${tot} pollos.`, unit: 'pollos' };
      }
      if (sub === 1) {
        const pollos = 1000 + i * 300; const p = [2, 3, 4, 5][i % 4]; const r = pollos * p / 100;
        return { q: `En un lote de ${pollos} pollos hay una mortalidad del ${p}%. ¿Cuántos pollos mueren?`, val: r, dist: [r + 30, r * 2], exp: `${p}% de ${pollos} = ${fmt(r)} pollos.`, unit: 'pollos' };
      }
      if (sub === 2) {
        const gd = 50 + i * 2; const d = 7 + (i % 4) * 7; const tot = gd * d;
        return { q: `Un pollito gana ${gd} g al día. ¿Cuánto peso ganará en ${d} días?`, val: tot, dist: [gd + d, tot / 2], exp: `${gd} g/día × ${d} días = ${tot} g.`, unit: 'g' };
      }
      const h1 = 2 + (i % 3); const d1 = 3; const d2 = 30; const r = h1 / d1 * d2;
      return { q: `Una gallina pone ${h1} huevos cada ${d1} días. ¿Cuántos huevos pondrá en ${d2} días?`, val: r, dist: [r + 5, r - 4], exp: `Regla de tres: ${h1} ÷ ${d1} × ${d2} = ${fmt(r)} huevos.`, unit: 'huevos' };
    }
  },
  proporcionalidad: {
    label: '⚖️ Proporcionalidad',
    short: 'Regla de tres',
    count: 20,
    build: (i) => {
      const sub = i % 3;
      if (sub === 0) {
        const kg1 = 5; const c1 = 3 + (i % 5); const kg2 = [10, 15, 20, 25][i % 4]; const r = c1 / kg1 * kg2;
        return { q: `Si ${kg1} kg de pienso cuestan ${c1} €, ¿cuánto cuestan ${kg2} kg? (regla de tres directa)`, val: r, dist: [r + c1, r - 2], exp: `Directa: ${c1} ÷ ${kg1} × ${kg2} = ${fmt(r)} €.`, unit: '€' };
      }
      if (sub === 1) {
        const com1 = 3; const po1 = 150; const po2 = [200, 250, 300, 400][i % 4]; const r = com1 / po1 * po2;
        return { q: `${com1} comederos abastecen a ${po1} pollos. ¿Cuántos comederos necesitas para ${po2} pollos?`, val: r, dist: [r + 2, com1], exp: `Directa: ${com1} ÷ ${po1} × ${po2} = ${fmt(r)} comederos.`, unit: 'comederos' };
      }
      const op1 = 4; const h1 = 6; const op2 = [2, 3, 8, 12][i % 4]; const r = op1 * h1 / op2;
      return { q: `Si ${op1} operarios limpian la nave en ${h1} horas, ¿cuánto tardarán ${op2} operarios? (proporcionalidad inversa)`, val: r, dist: [r + 2, op2], exp: `Inversa: ${op1} × ${h1} ÷ ${op2} = ${fmt(r)} horas.`, unit: 'horas' };
    }
  },
  economia: {
    label: '💶 Economía',
    short: 'Economía',
    count: 16,
    build: (i) => {
      const sub = i % 3;
      if (sub === 0) {
        const pollos = 900 + i * 20; const peso = 2; const precio = [1.5, 1.6, 1.65, 1.8][i % 4]; const r = pollos * peso * precio;
        return { q: `Vendes ${pollos} pollos de ${peso} kg a ${fmt(precio)} €/kg. ¿Cuánto ingresas?`, val: r, dist: [pollos * precio, r / 2], exp: `${pollos} × ${peso} kg × ${fmt(precio)} € = ${fmt(r)} €.`, unit: '€' };
      }
      if (sub === 1) {
        const ing = 5000 + i * 100; const cost = 3000 + i * 50; const r = ing - cost;
        return { q: `Ingresas ${ing} € y tus costes son ${cost} €. ¿Cuál es el beneficio?`, val: r, dist: [ing + cost, r / 2], exp: `${ing} − ${cost} = ${fmt(r)} €.`, unit: '€' };
      }
      const uds = [10, 12, 20, 24][i % 4]; const total = uds * (40 + i * 3); const r = total / uds;
      return { q: `Un pedido de ${uds} sacos cuesta ${total} €. ¿Cuánto cuesta cada saco?`, val: r, dist: [total - uds, r + 5], exp: `${total} ÷ ${uds} = ${fmt(r)} €/saco.`, unit: '€' };
    }
  },
  agua: {
    label: '💧 ODS: Agua',
    short: 'Agua y ODS',
    count: 16,
    build: (i) => {
      const sub = i % 2;
      if (sub === 0) {
        const agua = 5000 + i * 500; const p = [10, 15, 20, 25][i % 4]; const r = agua * p / 100;
        return { q: `Consumías ${agua} L de agua y ahorras un ${p}%. ¿Cuántos litros ahorras?`, val: r, dist: [agua - r, r + 200], exp: `${p}% de ${agua} L = ${fmt(r)} L ahorrados.`, unit: 'L' };
      }
      const litrosDia = 200 + i * 10; const dias = [7, 10, 30][i % 3]; const r = litrosDia * dias;
      return { q: `La nave gasta ${litrosDia} L de agua al día. ¿Cuánto gasta en ${dias} días?`, val: r, dist: [litrosDia + dias, r / 2], exp: `${litrosDia} L/día × ${dias} días = ${r} L.`, unit: 'L' };
    }
  },
};

const CAT_ORDER = ['porcentajes', 'quimica', 'biologia', 'proporcionalidad', 'economia', 'agua'];

// Construye una pregunta lista para mostrar a partir de una categoría
const makeQuestion = (def, i) => {
  const r = def.build(i);
  // Distractores distintos del correcto y entre sí
  const vals = [r.val, ...r.dist];
  for (let k = 1; k < vals.length; k++) {
    let guard = 0;
    while (vals.slice(0, k).some(o => Math.abs(o - vals[k]) < 0.001) && guard < 10) {
      vals[k] += Math.max(1, Math.abs(r.val) * 0.07);
      guard++;
    }
  }
  const u = r.unit ? ` ${r.unit}` : '';
  return {
    category: def.label,
    question: r.q,
    options: vals.map(v => `${fmt(v)}${u}`),
    correct: 0,
    explanation: r.exp,
  };
};

function GranjaInteractiva() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Game States: 'menu' → 'categorias' → 'playing' → 'summary'
  const [gameState, setGameState] = useState('menu');
  const [gameMode, setGameMode] = useState('sandbox');
  const [pendingMode, setPendingMode] = useState('sandbox');
  const [selectedCats, setSelectedCats] = useState([...CAT_ORDER]);

  const [day, setDay] = useState(1);
  const [targetDay, setTargetDay] = useState(1);
  const [chickens, setChickens] = useState(1000);
  const [weight, setWeight] = useState(0.04);
  const [money, setMoney] = useState(2000);
  const [feedTotal, setFeedTotal] = useState(0);
  const [waterTotal, setWaterTotal] = useState(0);

  // Controls
  const [temp, setTemp] = useState(22);
  const [humidity, setHumidity] = useState(60);
  const [feedType, setFeedType] = useState('premium');

  // History & Logs
  const [history, setHistory] = useState([{ day: 1, weight: 0.04, money: 2000, ic: 1.5, temp: 22 }]);
  const [log, setLog] = useState(['¡Granja iniciada! Mantén a los pollos en su zona de confort.']);
  const [challengeEvent, setChallengeEvent] = useState('');

  // Quiz State
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [quizScore, setQuizScore] = useState(0);

  // Banco de preguntas: alterna categorías seleccionadas (rotación) y mantiene
  // dificultad progresiva (índice i creciente dentro de cada categoría).
  const quizData = useMemo(() => {
    const cats = (selectedCats.length ? selectedCats : CAT_ORDER).filter(k => CAT_DEFS[k]);
    const perCat = cats.map(key => {
      const def = CAT_DEFS[key];
      return Array.from({ length: def.count }, (_, n) => makeQuestion(def, n + 1));
    });
    // Intercalar en rotación (1 de cada categoría por ronda)
    const qList = [];
    const maxLen = Math.max(0, ...perCat.map(a => a.length));
    for (let n = 0; n < maxLen; n++) {
      for (const arr of perCat) if (n < arr.length) qList.push(arr[n]);
    }
    // Barajar las opciones de respuesta de forma determinista
    return qList.map((q, idx) => {
      let opts = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correct }));
      for (let i = opts.length - 1; i > 0; i--) {
        const j = (idx + i) % (i + 1);
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      return { ...q, options: opts.map(o => o.text), correct: opts.findIndex(o => o.isCorrect) };
    });
  }, [selectedCats]);

  const optimalTemp = useMemo(() => {
    if (day < 10) return 32;
    if (day < 20) return 28;
    if (day < 35) return 24;
    return 20;
  }, [day]);

  const currentIC = useMemo(() => {
    let baseIC = 1.4;
    const tempDiff = Math.abs(temp - optimalTemp);
    if (tempDiff > 2) baseIC += tempDiff * 0.04;
    if (humidity < 50) baseIC += (50 - humidity) * 0.01;
    if (humidity > 70) baseIC += (humidity - 70) * 0.01;
    if (feedType === 'economico') baseIC += 0.25;
    if (feedType === 'estandar') baseIC += 0.1;
    return parseFloat(baseIC.toFixed(2));
  }, [temp, humidity, feedType, optimalTemp, day]);

  // Paso 1: elegir modo → ir a la pantalla de categorías
  const chooseMode = (mode) => {
    setPendingMode(mode);
    setGameState('categorias');
  };

  const toggleCat = (key) => {
    setSelectedCats(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const selectAllCats = () => setSelectedCats([...CAT_ORDER]);

  const startGame = (mode) => {
    setGameMode(mode);
    setDay(1);
    setTargetDay(1);
    setChickens(1000);
    setWeight(0.04);
    setFeedTotal(0);
    setWaterTotal(0);
    setTemp(32);
    setHumidity(60);
    setFeedType('premium');
    setHistory([{ day: 1, weight: 0.04, money: mode === 'sandbox' ? 5000 : 2000, ic: 1.4, temp: 32 }]);
    setGameState('playing');
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback(null);

    if (mode === 'challenge') {
      setMoney(1500);
      setChallengeEvent('¡OLA DE CALOR! Día 25: suben temperaturas y costes.');
      setLog(['Reto Activado.']);
    } else {
      setMoney(3000);
      setChallengeEvent('Modo Libre: Sin restricciones.');
      setLog(['Modo Sandbox.']);
    }
  };

  const executeDayLogic = useCallback(() => {
    if (day >= 50) {
      setGameState('summary');
      return;
    }

    let extraCost = 0;
    let newLog = [];

    if (gameMode === 'challenge' && day >= 25 && day <= 35) {
      newLog.push('⚠️ Calor extremo.');
      extraCost += Math.max(0, (optimalTemp - temp) * 1.5);
    }

    const dailyFeedPerChickenKg = (day * 4.2) / 1000;
    const totalDailyFeedKg = dailyFeedPerChickenKg * chickens;
    const totalDailyWaterL = totalDailyFeedKg * 2;

    let feedPricePerKg = 0.35;
    if (feedType === 'estandar') feedPricePerKg = 0.45;
    if (feedType === 'premium') feedPricePerKg = 0.60;

    const waterPricePerL = 0.02;
    const energyBaseCost = Math.abs(temp - optimalTemp) * 0.4 * (gameMode === 'challenge' && day >= 25 ? 3 : 1);
    const dailyExpense = (totalDailyFeedKg * feedPricePerKg) + (totalDailyWaterL * waterPricePerL) + energyBaseCost + extraCost;

    const dailyWeightGainKg = dailyFeedPerChickenKg / currentIC;
    const newWeight = Math.min(4.0, weight + dailyWeightGainKg);

    let currentChickens = chickens;
    const tempDiff = Math.abs(temp - optimalTemp);
    if (tempDiff > 7) {
      const casualties = Math.floor(chickens * (tempDiff * 0.01));
      currentChickens -= casualties;
      newLog.push(`💀 Han muerto ${casualties} pollos.`);
    }

    const newMoney = money - dailyExpense;
    const newDay = day + 1;

    setDay(newDay);
    setChickens(currentChickens);
    setWeight(parseFloat(newWeight.toFixed(3)));
    setFeedTotal(prev => prev + totalDailyFeedKg);
    setWaterTotal(prev => prev + totalDailyWaterL);
    setMoney(parseFloat(newMoney.toFixed(2)));

    setHistory(prev => [...prev, { day: newDay, weight: parseFloat(newWeight.toFixed(3)), money: parseFloat(newMoney.toFixed(2)), ic: currentIC, temp }]);

    if (newLog.length === 0) newLog.push(`Día ${day} completado.`);
    setLog(prev => [newLog.join(' | '), ...prev.slice(0, 4)]);

    if (newDay === 50) {
      const finalRevenue = currentChickens * newWeight * 1.65;
      setMoney(parseFloat((newMoney + finalRevenue).toFixed(2)));
      setGameState('summary');
    }
  }, [day, chickens, weight, money, temp, humidity, feedType, currentIC, optimalTemp, gameMode]);

  useEffect(() => {
    if (gameState === 'playing' && day < targetDay && day < 50) {
      const timer = setTimeout(() => {
        executeDayLogic();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [day, targetDay, gameState, executeDayLogic]);

  const handleQuizAnswer = (selectedIndex) => {
    const isCorrect = selectedIndex === quizData[currentQuizIndex].correct;
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
      setMoney(prev => prev + 150);
      setLog(prev => [`🌟 ¡Correcto! +150 € a la granja.`, ...prev.slice(0, 4)]);
    }

    setQuizFeedback({
      correct: isCorrect,
      text: quizData[currentQuizIndex].explanation
    });
  };

  const nextQuizQuestion = () => {
    setQuizFeedback(null);
    setCurrentQuizIndex(prev => (prev + 1) % quizData.length);
  };

  const getSvgPath = (key, minVal, maxVal) => {
    if (history.length < 2) return '';
    const width = 500, height = 120;
    return history.map((p, i) => {
      const x = (p.day / 50) * width;
      const y = height - ((p[key] - minVal) / (maxVal - minVal || 1)) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const getComfortColor = () => {
    const diff = Math.abs(temp - optimalTemp);
    if (diff <= 2) return '#22c55e';
    if (diff <= 5) return '#eab308';
    return '#ef4444';
  };

  return (
    <div style={{ fontFamily: '"Segoe UI", Roboto, sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: isMobile ? '10px' : '20px', boxSizing: 'border-box', userSelect: 'none' }}>

      {gameState === 'menu' && (
        <div style={{ maxWidth: '800px', margin: isMobile ? '10px auto' : '40px auto', backgroundColor: '#1e293b', borderRadius: '16px', padding: isMobile ? '20px' : '40px', textAlign: 'center', border: '4px solid #3b82f6' }}>
          <h1 style={{ fontSize: isMobile ? '2rem' : '3rem', color: '#3b82f6', margin: '0 0 10px 0' }}>🐔 Granja Interactiva</h1>
          <p style={{ fontSize: isMobile ? '1rem' : '1.2rem', color: '#94a3b8', marginBottom: '30px' }}>Gestiona una nave avícola mientras resuelves retos de porcentajes, química de los alimentos, biología, proporcionalidad y más.</p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#334155', padding: '20px', borderRadius: '12px', border: '2px solid #22c55e', cursor: 'pointer' }} onClick={() => chooseMode('sandbox')}>
              <h2 style={{ color: '#22c55e', marginTop: 0, fontSize: '1.4rem' }}>Modo Sandbox</h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Explora gráficas en tiempo real y responde a tu ritmo.</p>
            </div>
            <div style={{ backgroundColor: '#334155', padding: '20px', borderRadius: '12px', border: '2px solid #ef4444', cursor: 'pointer' }} onClick={() => chooseMode('challenge')}>
              <h2 style={{ color: '#ef4444', marginTop: 0, fontSize: '1.4rem' }}>Modo Desafío</h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Gestiona los recursos durante una ola de calor extrema.</p>
            </div>
          </div>
        </div>
      )}

      {gameState === 'categorias' && (
        <div style={{ maxWidth: '760px', margin: isMobile ? '10px auto' : '40px auto', backgroundColor: '#1e293b', borderRadius: '16px', padding: isMobile ? '20px' : '40px', border: '4px solid #f59e0b' }}>
          <h2 style={{ fontSize: isMobile ? '1.6rem' : '2.2rem', color: '#f59e0b', margin: '0 0 6px 0', textAlign: 'center' }}>🧠 Elige las preguntas</h2>
          <p style={{ color: '#94a3b8', textAlign: 'center', margin: '0 0 24px 0', fontSize: '0.95rem' }}>
            Modo seleccionado: <strong style={{ color: pendingMode === 'sandbox' ? '#22c55e' : '#ef4444' }}>{pendingMode === 'sandbox' ? 'Sandbox' : 'Desafío'}</strong>. Marca las categorías que quieras practicar.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <button onClick={selectAllCats} style={{ padding: '10px 18px', borderRadius: '20px', border: '2px solid #3b82f6', background: selectedCats.length === CAT_ORDER.length ? '#3b82f6' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>✅ Todas las categorías</button>
            <button onClick={() => setSelectedCats([])} style={{ padding: '10px 18px', borderRadius: '20px', border: '2px solid #475569', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>Ninguna</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {CAT_ORDER.map(key => {
              const def = CAT_DEFS[key];
              const active = selectedCats.includes(key);
              return (
                <button key={key} onClick={() => toggleCat(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontSize: '1rem', fontWeight: active ? 'bold' : 'normal', background: active ? '#1e3a8a' : '#334155', color: '#fff', border: active ? '2px solid #3b82f6' : '2px solid #475569', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '1.4rem', width: 28, textAlign: 'center', filter: active ? 'none' : 'grayscale(0.6)' }}>{def.label.split(' ')[0]}</span>
                  <span>{def.label.replace(/^\S+\s/, '')}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '1.1rem' }}>{active ? '☑️' : '⬜'}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setGameState('menu')} style={{ padding: '12px 22px', borderRadius: '8px', border: 'none', background: '#475569', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>← Atrás</button>
            <button onClick={() => startGame(pendingMode)} disabled={selectedCats.length === 0}
              style={{ padding: '12px 30px', borderRadius: '8px', border: 'none', background: selectedCats.length === 0 ? '#475569' : '#22c55e', color: '#fff', cursor: selectedCats.length === 0 ? 'not-allowed' : 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>▶ Comenzar</button>
          </div>
          {selectedCats.length === 0 && <p style={{ color: '#fca5a5', textAlign: 'center', marginTop: '12px', fontSize: '0.85rem' }}>Selecciona al menos una categoría.</p>}
        </div>
      )}

      {gameState === 'playing' && quizData.length > 0 && (
        <div style={{ maxWidth: '1350px', margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px' }}>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '10px', backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', borderRight: isMobile ? 'none' : '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>DÍA</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#3b82f6' }}>{day} / 50</div>
              </div>
              <div style={{ textAlign: 'center', borderRight: isMobile ? 'none' : '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>POBLACIÓN</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{chickens}</div>
              </div>
              <div style={{ textAlign: 'center', borderRight: isMobile ? 'none' : '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PESO MEDIO</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#a855f7' }}>{weight} kg</div>
              </div>
              <div style={{ textAlign: 'center', borderRight: isMobile ? 'none' : '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>IC</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: currentIC > 1.7 ? '#ef4444' : '#22c55e' }}>{currentIC}</div>
              </div>
              <div style={{ textAlign: 'center', gridColumn: isMobile ? 'span 2' : 'auto', borderTop: isMobile ? '1px solid #334155' : 'none', paddingTop: isMobile ? '10px' : '0' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>BALANCE</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: money >= 0 ? '#22c55e' : '#ef4444' }}>{money} €</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '15px', position: 'relative', minHeight: '180px', marginBottom: '20px', border: `3px solid ${getComfortColor()}` }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '15px', gap: isMobile ? '5px' : '0' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🏢 Interior de la Nave</h3>
                <div style={{ fontSize: '0.9rem' }}>Objetivo: <strong style={{ color: '#3b82f6' }}>{optimalTemp}°C</strong> | Actual: <strong style={{ color: getComfortColor() }}>{temp}°C</strong></div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                {[...Array(isMobile ? 12 : 20)].map((_, idx) => {
                  const size = Math.max(15, Math.min(isMobile ? 40 : 55, 15 + (weight * 10)));
                  return (
                    <svg key={idx} width={size} height={size} viewBox="0 0 100 100">
                      <circle cx="50" cy="60" r="35" fill={temp > optimalTemp + 3 ? '#f87171' : temp < optimalTemp - 3 ? '#93c5fd' : '#fde047'} />
                      <circle cx="65" cy="40" r="20" fill={temp > optimalTemp + 3 ? '#f87171' : temp < optimalTemp - 3 ? '#93c5fd' : '#fde047'} />
                      <circle cx="72" cy="35" r="4" fill="#000" />
                      <polygon points="82,35 72,42 72,30" fill="#f97316" />
                    </svg>
                  );
                })}
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: isMobile ? '10px' : '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#a855f7', fontWeight: 'bold' }}>Crecimiento (kg)</div>
                  <svg width="100%" height={isMobile ? "100" : "130"} viewBox="0 0 500 120">
                    <line x1="0" y1="17" x2="500" y2="17" stroke="#ef4444" strokeDasharray="2" />
                    <path d={getSvgPath('weight', 0, 3.5)} fill="none" stroke="#a855f7" strokeWidth="3" />
                  </svg>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 'bold' }}>Finanzas (€)</div>
                  <svg width="100%" height={isMobile ? "100" : "130"} viewBox="0 0 500 120">
                    <path d={getSvgPath('money', 0, 5000)} fill="none" stroke="#22c55e" strokeWidth="3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div style={{ width: isMobile ? '100%' : '380px', display: 'flex', flexDirection: 'column', gap: '15px', flexShrink: 0 }}>

            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #3b82f6', paddingBottom: '5px', fontSize: '1.1rem' }}>🎛️ Controles</h3>

              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Temp (°C):</span> <strong style={{ color: getComfortColor() }}>{temp} °C</strong>
                </div>
                <input type="range" min="15" max="38" value={temp} onChange={(e) => setTemp(parseInt(e.target.value))} style={{ width: '100%', accentColor: getComfortColor() }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Humedad (%):</span> <strong>{humidity} %</strong>
                </div>
                <input type="range" min="30" max="90" value={humidity} onChange={(e) => setHumidity(parseInt(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                {['economico', 'estandar', 'premium'].map((f) => (
                  <button key={f} onClick={() => setFeedType(f)} style={{ padding: '10px', borderRadius: '6px', backgroundColor: feedType === f ? '#1e3a8a' : '#334155', color: '#fff', border: feedType === f ? '2px solid #3b82f6' : '1px solid #475569', cursor: 'pointer', fontSize: '0.9rem' }}>
                    Pienso {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setTargetDay(prev => Math.min(50, prev + 1))}
                disabled={day !== targetDay}
                style={{ flex: 1, backgroundColor: day !== targetDay ? '#475569' : '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: day !== targetDay ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}
              >
                +1 Día
              </button>
              <button
                onClick={() => setTargetDay(prev => Math.min(50, prev + 5))}
                disabled={day !== targetDay}
                style={{ flex: 1, backgroundColor: day !== targetDay ? '#475569' : '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: day !== targetDay ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}
              >
                +5 Días
              </button>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '2px solid #f59e0b', padding: '15px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>🧠 Reto de clase</span>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Aciertos: {quizScore}</span>
              </h3>

              <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 'bold', textTransform: 'uppercase' }}>{quizData[currentQuizIndex].category} ({currentQuizIndex + 1}/{quizData.length})</span>
                <p style={{ margin: '5px 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{quizData[currentQuizIndex].question}</p>
              </div>

              {!quizFeedback ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {quizData[currentQuizIndex].options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuizAnswer(i)}
                      style={{ padding: '10px', backgroundColor: '#334155', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '6px', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ backgroundColor: quizFeedback.correct ? '#064e3b' : '#7f1d1d', padding: '12px', borderRadius: '8px' }}>
                  <strong style={{ color: quizFeedback.correct ? '#34d399' : '#fca5a5', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                    {quizFeedback.correct ? '¡Correcto! (+150€)' : 'Incorrecto'}
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{quizFeedback.text}</p>
                  <button onClick={nextQuizQuestion} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>Siguiente Pregunta</button>
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', fontSize: '0.75rem', height: '80px', overflowY: 'auto' }}>
              {log.map((l, idx) => <div key={idx} style={{ color: idx === 0 ? '#e2e8f0' : '#64748b', marginBottom: '4px' }}>• {l}</div>)}
            </div>

          </div>
        </div>
      )}

      {gameState === 'summary' && (
        <div style={{ maxWidth: '750px', margin: isMobile ? '10px auto' : '40px auto', backgroundColor: '#1e293b', borderRadius: '16px', padding: isMobile ? '20px' : '35px', textAlign: 'center', border: '4px solid #10b981' }}>
          <h2 style={{ fontSize: isMobile ? '2rem' : '2.5rem', color: '#10b981', marginTop: 0 }}>¡Ciclo Finalizado!</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px', backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', margin: '20px 0' }}>
            <div><div style={{ color: '#64748b', fontSize: '0.9rem' }}>Peso Medio</div><div style={{ fontSize: '1.5rem', color: '#22c55e' }}>{weight} kg</div></div>
            <div><div style={{ color: '#64748b', fontSize: '0.9rem' }}>Supervivencia</div><div style={{ fontSize: '1.5rem' }}>{chickens}</div></div>
            <div><div style={{ color: '#64748b', fontSize: '0.9rem' }}>Aciertos del reto</div><div style={{ fontSize: '1.5rem', color: '#f59e0b' }}>{quizScore}</div></div>
            <div><div style={{ color: '#64748b', fontSize: '0.9rem' }}>Balance Final</div><div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>{money} €</div></div>
          </div>
          <button onClick={() => setGameState('menu')} style={{ width: isMobile ? '100%' : 'auto', backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '8px', fontSize: '1.1rem', cursor: 'pointer' }}>Volver al Menú</button>
        </div>
      )}
    </div>
  );
}

export default GranjaInteractiva;
