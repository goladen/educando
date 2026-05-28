import React, { useState, useEffect, useRef } from 'react';

export default function JuegoFeriaOAOA() {
  // Estados del juego
  const [pantalla, setPantalla] = useState('inicio'); // 'inicio' | 'jugando' | 'gameover'
  const [puntos, setPuntos] = useState(0);
  const [vidas, setVidas] = useState(3);
  const [operacionActual, setOperacionActual] = useState({ texto: '', respuesta: 0 });
  const [opciones, setOpciones] = useState([]);
  const [historialOAOA, setHistorialOAOA] = useState('');

  // Temporizadores y referencias
  const intervaloRef = useRef(null);

  // Operaciones disponibles para la feria
  const tiposOperaciones = ['suma', 'resta', 'multi', 'div'];

  // 1. Iniciar el juego
  const iniciarJuego = () => {
    setPuntos(0);
    setVidas(3);
    setPantalla('jugando');
    generarNuevaOperacion();
  };

  // 2. Generar una operación al estilo OAOA (con números amigables)
  const generarNuevaOperacion = () => {
    const tipo = tiposOperaciones[Math.floor(Math.random() * tiposOperaciones.length)];
    let n1 = 0, n2 = 0, txt = '', ans = 0, pista = '';

    if (tipo === 'suma') {
      n1 = Math.floor(Math.random() * 50) + 15;
      n2 = Math.floor(Math.random() * 40) + 11;
      ans = n1 + n2;
      txt = `${n1} + ${n2}`;
      // Pista visual de cómo lo pensaría un niño OAOA
      pista = `💡 Piensa: (${Math.floor(n1/10)*10} + ${Math.floor(n2/10)*10}) y luego (${n1%10} + ${n2%10})`;
    } else if (tipo === 'resta') {
      n1 = Math.floor(Math.random() * 60) + 35;
      n2 = Math.floor(Math.random() * (n1 - 15)) + 10;
      ans = n1 - n2;
      txt = `${n1} - ${n2}`;
      pista = `💡 Piensa: Quítale primero ${Math.floor(n2/10)*10} a ${n1}, y luego quita ${n2%10}`;
    } else if (tipo === 'multi') {
      n1 = Math.floor(Math.random() * 25) + 11; // ej. 15
      n2 = Math.floor(Math.random() * 6) + 3;   // ej. 4
      ans = n1 * n2;
      txt = `${n1} × ${n2}`;
      pista = `💡 Piensa: ${Math.floor(n1/10)*10} × ${n2} es ${Math.floor(n1/10)*10 * n2}. ¡Luego suma el resto!`;
    } else if (tipo === 'div') {
      n2 = Math.floor(Math.random() * 5) + 3; // Divisor amigo
      const cociente = Math.floor(Math.random() * 12) + 5;
      n1 = n2 * cociente; // Exacta
      ans = cociente;
      txt = `${n1} ÷ ${n2}`;
      pista = `💡 Piensa: ¿Qué número multiplicado por ${n2} se acerca o da ${n1}?`;
    }

    setOperacionActual({ texto: txt, respuesta: ans });
    setHistorialOAOA(pista);
    generarOpcionesFlotantes(ans);
  };

  // 3. Crear las opciones mezcladas (el resultado real + respuestas falsas cercanas)
  const generarOpcionesFlotantes = (respuestaCorrecta) => {
    const respuestas = new Set([respuestaCorrecta]);
    
    // Generar 3 respuestas incorrectas pero lógicas (típicos errores de cálculo)
    while (respuestas.size < 4) {
      const desvio = (Math.floor(Math.random() * 3) + 1) * (Math.random() > 0.5 ? 1 : -1);
      const falsa = respuestaCorrecta + desvio;
      // Añadir también errores por decenas (común en descomposiciones)
      const falsaDecena = respuestaCorrecta + (Math.random() > 0.5 ? 10 : -10);
      
      if (falsa > 0) respuestas.add(falsa);
      if (falsaDecena > 0 && respuestas.size < 4) respuestas.add(falsaDecena);
    }

    // Convertir a array y desordenar
    const arrayOpciones = Array.from(respuestas).map(val => ({
      id: Math.random(),
      valor: val,
      // Posición horizontal aleatoria para simular puestos de feria
      posicionX: Math.floor(Math.random() * 70) + 5 
    }));

    setOpciones(arrayOpciones.sort(() => Math.random() - 0.5));
  };

  // 4. Validar el disparo/clic del usuario
  const dispararOpcion = (valorSeleccionado) => {
    if (valorSeleccionado === operacionActual.respuesta) {
      setPuntos(prev => prev + 10);
      generarNuevaOperacion();
    } else {
      const nuevasVidas = vidas - 1;
      setVidas(nuevasVidas);
      if (nuevasVidas <= 0) {
        setPantalla('gameover');
      } else {
        generarNuevaOperacion(); // Pasa a la siguiente aunque falle
      }
    }
  };

  // 5. Efecto de "Feria viva": Cambia los globos cada 5 segundos si el usuario no responde
  useEffect(() => {
    if (pantalla === 'jugando') {
      intervaloRef.current = setInterval(() => {
        // Pierde una vida por lento si los globos cambian y no respondió
        setVidas(v => {
          if (v - 1 <= 0) {
            setPantalla('gameover');
            return 0;
          }
          return v - 1;
        });
        generarNuevaOperacion();
      }, 6000); // 6 segundos por operación
    }

    return () => clearInterval(intervaloRef.current);
  }, [pantalla, operacionActual]);

  return (
    <div className="max-w-xl mx-auto my-6 bg-gradient-to-b from-red-600 via-red-700 to-amber-800 rounded-3xl p-4 shadow-2xl border-4 border-amber-400 text-white font-sans relative overflow-hidden select-none">
      
      {/* Guirnaldas / Adornos de la feria superiores */}
      <div className="flex justify-between px-4 text-amber-300 font-black tracking-widest text-xs opacity-80 uppercase">
        <span>🎪 GRAN FERIA OAOA 🎪</span>
        <span>🎯 TIRO MATEMÁTICO</span>
      </div>

      {/* --- PANTALLA DE INICIO --- */}
      {pantalla === 'inicio' && (
        <div className="text-center py-12 px-4 space-y-6">
          <div className="bg-amber-400 text-red-950 font-black text-3xl py-3 px-6 rounded-xl shadow-lg border-2 border-white inline-block uppercase tracking-tight transform -rotate-1">
            ¡Apunta al Resultado!
          </div>
          <p className="text-amber-100 text-sm max-w-sm mx-auto">
            Las operaciones irán apareciendo en la carpa. ¡Calcula mentalmente usando la descomposición y revienta el globo correcto antes de que se acabe el tiempo!
          </p>
          <button
            onClick={iniciarJuego}
            className="bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black text-xl px-8 py-4 rounded-2xl shadow-xl border-b-4 border-green-700 transition-all uppercase tracking-wide block mx-auto"
          >
            ¡Jugar ahora! 🎟️
          </button>
        </div>
      )}

      {/* --- PANTALLA DE JUEGO --- */}
      {pantalla === 'jugando' && (
        <div className="space-y-4">
          
          {/* Marcador superior de feria */}
          <div className="bg-red-950/60 rounded-xl p-3 flex justify-between items-center border border-red-500/30 text-sm font-bold">
            <div className="flex items-center gap-1">
              <span className="text-amber-400">PUNTOS:</span> 
              <span className="bg-amber-400 text-red-950 px-2.5 py-0.5 rounded font-black text-base">{puntos}</span>
            </div>
            <div className="flex items-center gap-1 text-base">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={`transition-opacity ${i < vidas ? 'opacity-100' : 'opacity-20'}`}>❤️</span>
              ))}
            </div>
          </div>

          {/* El Panel Central / La Carpa del Problema */}
          <div className="bg-slate-900 border-4 border-amber-500 rounded-2xl p-6 text-center shadow-inner relative min-h-[110px] flex flex-col justify-center items-center">
            <span className="absolute top-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Calcula Mentalmente</span>
            <div className="text-4xl font-black text-amber-300 tracking-wide font-mono">
              {operacionActual.texto} = ?
            </div>
          </div>

          {/* Zona de Objetivos / Globos de la feria que aparecen */}
          <div className="bg-sky-900/40 border border-sky-400/20 rounded-2xl h-48 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/60 to-slate-950">
            {/* Línea de fondo del stand */}
            <div className="absolute bottom-4 w-full h-1 bg-amber-600/40"></div>

            {/* Render dinámico de los globos/opciones */}
            {opciones.map((opc) => (
              <button
                key={opc.id}
                onClick={() => dispararOpcion(opc.valor)}
                style={{ left: `${opc.posicionX}%` }}
                className="absolute bottom-6 bg-gradient-to-t from-amber-400 to-yellow-300 hover:from-yellow-300 hover:to-white text-red-950 font-black text-xl w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 active:scale-90 transition-all animate-bounce"
              >
                {opc.valor}
                {/* Cuerda del globo virtual */}
                <span className="absolute -bottom-3 left-1/2 w-0.5 h-3 bg-white/40 -translate-x-1/2"></span>
              </button>
            ))}
          </div>

          {/* Pista Pedagógica del Método OAOA */}
          <div className="bg-amber-950/40 rounded-xl p-2.5 text-center border border-amber-500/20">
            <p className="text-xs text-amber-200/90 italic font-medium">
              {historialOAOA}
            </p>
          </div>

          {/* Barra de tiempo visual (cuenta atrás de 6 segundos) */}
          <div className="w-full bg-red-950 h-2 rounded-full overflow-hidden border border-red-900">
            <div key={operacionActual.texto} className="bg-gradient-to-r from-amber-400 to-green-400 h-full w-full animate-shrinkWidth"></div>
          </div>
        </div>
      )}

      {/* --- PANTALLA GAME OVER --- */}
      {pantalla === 'gameover' && (
        <div className="text-center py-10 px-4 space-y-5">
          <div className="text-5xl">😭</div>
          <h3 className="text-2xl font-black text-amber-300 uppercase tracking-tight">¡Se acabó el tiempo o las vidas!</h3>
          <div className="bg-red-950/60 p-4 rounded-xl inline-block border border-red-500/30">
            <p className="text-sm text-slate-300 font-bold">Puntuación Final:</p>
            <p className="text-3xl font-black text-amber-400">{puntos} Puntos</p>
          </div>
          <p className="text-xs text-amber-200/70 max-w-xs mx-auto">
            ¡No te preocupes! El cerebro aprende equivocándose. Descomponer números requiere práctica diaria.
          </p>
          <button
            onClick={iniciarJuego}
            className="bg-amber-400 hover:bg-amber-500 active:scale-95 text-red-950 font-black text-md px-6 py-3 rounded-xl transition-all shadow-md block mx-auto uppercase"
          >
            Intentar Otra Vez 🔄
          </button>
        </div>
      )}

    </div>
  );
}