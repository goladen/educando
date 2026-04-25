// BIBLIOTECA DE FUNCIONES MATEMÁTICAS — 100 funciones con análisis gráfico
// Tolerancia de corrección: ±0.3 en valores numéricos
// Tipos: Polinómica (1-30), Racional (31-45), Logarítmica (46-60),
//        Exponencial (61-75), Trigonométrica (76-90), Irracional (91-100)

export const FUNCIONES_DB = [
  {
    id: 1, tipo: 'Polinómica', grado: 'Grado 1',
    latex: 'f(x) = 2x - 4',
    fn: (x) => 2*x - 4,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,4)', '(-∞,0)', '[0,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-4,∞)', '(-∞,-4)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(2,0), (0,-4)', incorrectas: ['(2,0)', '(0,4) y (2,0)', '(-2,0) y (0,-4)'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-4, ∞) D: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,-4)', 'Máx(2,0)', 'Mín(2,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 2, tipo: 'Polinómica', grado: 'Grado 1',
    latex: 'f(x) = -3x + 6',
    fn: (x) => -3*x + 6,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,6]', '(-3,∞)', '[0,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-6,∞)', '(-∞,0)', '[0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=6', 'Sí, T=π'] },
      cortes:    { correcta: '(2,0), (0,6)', incorrectas: ['(2,0)', '(-2,0) y (0,6)', '(0,2) y (6,0)'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,6)', 'Mín(2,0)', 'Máx(2,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 3, tipo: 'Polinómica', grado: 'Grado 1',
    latex: 'f(x) = x + 3',
    fn: (x) => x + 3,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0,∞)', '(-∞,3]', '(-3,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-3,∞)', '(-∞,0)', '[0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(-3,0), (0,3)', incorrectas: ['(3,0) y (0,3)', '(0,3)', '(-3,0)'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-3, ∞) D: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,3)', 'Mín(-3,0)', 'Mín(0,3)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 4, tipo: 'Polinómica', grado: 'Grado 1',
    latex: 'f(x) = -\\frac{x}{2} + 1',
    fn: (x) => -0.5*x + 1,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,1]', '(0,∞)', '(2,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-1,∞)', '(-∞,0)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=π', 'Sí, T=1'] },
      cortes:    { correcta: '(2,0), (0,1)', incorrectas: ['(2,0)', '(-2,0) y (0,1)', '(0,2) y (1,0)'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,1)', 'Mín(2,0)', 'Máx(2,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 5, tipo: 'Polinómica', grado: 'Grado 1',
    latex: 'f(x) = 3x + 3',
    fn: (x) => 3*x + 3,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-3,∞)', '[0,∞)', '(-∞,3)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(0,∞)', '(-∞,3)', '(-3,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(-1,0), (0,3)', incorrectas: ['(-1,0)', '(3,0) y (0,-1)', '(1,0) y (0,3)'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-3, ∞) D: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(-1,0)', 'Máx(0,3)', 'Mín(0,3)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 6, tipo: 'Polinómica', grado: 'Grado 1',
    latex: 'f(x) = -2x - 2',
    fn: (x) => -2*x - 2,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,∞)', '(-∞,2)', '[0,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,-2)', '(-2,∞)', '[0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=π', 'Sí, T=1'] },
      cortes:    { correcta: '(-1,0), (0,-2)', incorrectas: ['(-2,0) y (0,-2)', '(1,0) y (0,-2)', '(-1,0)'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-1, ∞) D: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(-1,0)', 'Máx(0,-2)', 'Mín(-1,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 7, tipo: 'Polinómica', grado: 'Grado 1',
    latex: 'f(x) = \\frac{x}{2} - 2',
    fn: (x) => 0.5*x - 2,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,∞)', '[0,∞)', '(-∞,0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,-2)', '[-2,∞)', '(-2,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=4', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(4,0), (0,-2)', incorrectas: ['(4,0)', '(-4,0) y (0,-2)', '(2,0) y (0,-1)'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (4, ∞) D: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,-2)', 'Máx(4,0)', 'Mín(4,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 8, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = -x^{2} + 4',
    fn: (x) => -x*x + 4,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-4,∞)', '(-∞,0)', '(-2,2)'] },
      recorrido: { correcta: '(-∞, 4]', incorrectas: ['(-∞,∞)', '[4,∞)', '[-2,2]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (2,0), (0,4)', incorrectas: ['(-2,0) y (2,0)', '(0,4)', '(0,-4) y (±2,0)'] },
      monotonia: { correcta: 'C: (-∞, 0) D: (0, ∞)', incorrectas: ['C: (0, ∞) D: (-∞, 0)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Máx(0,4)', incorrectas: ['Mín(0,4)', 'Máx(-2,0) Mín(2,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 9, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = x^{2} - 1',
    fn: (x) => x*x - 1,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,∞)', '(-∞,0)', '(-1,1)'] },
      recorrido: { correcta: '[-1, ∞)', incorrectas: ['(-∞,∞)', '(-∞,-1]', '[0,∞)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-1,0), (1,0), (0,-1)', incorrectas: ['(-1,0) y (1,0)', '(0,-1)', '(1,0) y (-1,0)'] },
      monotonia: { correcta: 'C: (0, ∞) D: (-∞, 0)', incorrectas: ['C: (-∞, 0) D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Mín(0,-1)', incorrectas: ['Máx(0,-1)', 'Máx(-1,0) Mín(1,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 10, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = (x-2)^{2}',
    fn: (x) => (x-2)*(x-2),
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[2,∞)', '(-∞,2]', '(-2,2)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '[2,∞)', '(-∞,0]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=π', 'Sí, T=4'] },
      cortes:    { correcta: '(2,0), (0,4)', incorrectas: ['(-2,0) y (0,4)', '(2,0)', '(0,2) y (4,0)'] },
      monotonia: { correcta: 'C: (2, ∞) D: (-∞, 2)', incorrectas: ['C: (-∞, 2) D: (2, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, ∞) D: ∅'] },
      extremos:  { correcta: 'Mín(2,0)', incorrectas: ['Máx(2,0)', 'Mín(0,4)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 11, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = -x^{2} - 2x + 3',
    fn: (x) => -x*x - 2*x + 3,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,3]', '[-4,∞)', '(-3,1)'] },
      recorrido: { correcta: '(-∞, 4]', incorrectas: ['(-∞,∞)', '[4,∞)', '(-∞,3]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-3,0), (1,0), (0,3)', incorrectas: ['(-3,0) y (1,0)', '(-1,4) y (0,3)', '(3,0) y (-1,0) y (0,3)'] },
      monotonia: { correcta: 'C: (-∞, -1) D: (-1, ∞)', incorrectas: ['C: (-1, ∞) D: (-∞, -1)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Máx(-1,4)', incorrectas: ['Mín(-1,4)', 'Máx(0,3)', 'Máx(-3,0) Mín(1,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 12, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = 2x^{2} - 8',
    fn: (x) => 2*x*x - 8,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,0)', '(-2,2)', '[-4,∞)'] },
      recorrido: { correcta: '[-8, ∞)', incorrectas: ['(-∞,∞)', '(-∞,-8]', '[0,∞)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (2,0), (0,-8)', incorrectas: ['(-2,0) y (2,0)', '(0,-8)', '(±4,0) y (0,-8)'] },
      monotonia: { correcta: 'C: (0, ∞) D: (-∞, 0)', incorrectas: ['C: (-∞, 0) D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Mín(0,-8)', incorrectas: ['Máx(0,-8)', 'Mín(-2,0) Máx(2,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 13, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = -x^{2} + 2x',
    fn: (x) => -x*x + 2*x,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,0)', '(-∞,2]', '(-1,1)'] },
      recorrido: { correcta: '(-∞, 1]', incorrectas: ['(-∞,∞)', '[1,∞)', '[-1,1]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=π', 'Sí, T=1'] },
      cortes:    { correcta: '(0,0), (2,0)', incorrectas: ['(0,0)', '(0,0) y (1,0)', '(2,0) y (0,2)'] },
      monotonia: { correcta: 'C: (-∞, 1) D: (1, ∞)', incorrectas: ['C: (1, ∞) D: (-∞, 1)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Máx(1,1)', incorrectas: ['Mín(1,1)', 'Máx(0,0)', 'Máx(2,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 14, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = x^{2} - 6x + 5',
    fn: (x) => x*x - 6*x + 5,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,3]', '[-5,∞)', '(1,5)'] },
      recorrido: { correcta: '[-4, ∞)', incorrectas: ['(-∞,∞)', '(-∞,-4]', '[0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=4', 'Sí, T=5', 'Sí, T=π'] },
      cortes:    { correcta: '(1,0), (5,0), (0,5)', incorrectas: ['(1,0) y (5,0)', '(0,5)', '(-1,0) y (5,0) y (0,5)'] },
      monotonia: { correcta: 'C: (3, ∞) D: (-∞, 3)', incorrectas: ['C: (-∞, 3) D: (3, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, ∞) D: ∅'] },
      extremos:  { correcta: 'Mín(3,-4)', incorrectas: ['Máx(3,-4)', 'Mín(1,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 15, tipo: 'Polinómica', grado: 'Grado 2',
    latex: 'f(x) = x^{2} + 4x + 3',
    fn: (x) => x*x + 4*x + 3,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,∞)', '[-1,∞)', '(-3,-1)'] },
      recorrido: { correcta: '[-1, ∞)', incorrectas: ['(-∞,∞)', '(-∞,-1]', '[0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-3,0), (-1,0), (0,3)', incorrectas: ['(-3,0) y (-1,0)', '(0,3)', '(-2,-1) y (0,3)'] },
      monotonia: { correcta: 'C: (-2, ∞) D: (-∞, -2)', incorrectas: ['C: (-∞, -2) D: (-2, ∞)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Mín(-2,-1)', incorrectas: ['Máx(-2,-1)', 'Mín(0,3)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 16, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = x^{3}',
    fn: (x) => x*x*x,
    range: 4,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,0]', '[-3,3]'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,0]', '[-1,1]'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['(1,1) y (-1,-1)', '(3,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,0)', 'Mín(0,0)', 'Punto inflexión (1,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 17, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = -x^{3} + 1',
    fn: (x) => -x*x*x + 1,
    range: 4,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-∞,1]', '[0,∞)', '[1,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,1)', '(-∞,0)', '[1,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=1', 'Sí, T=2'] },
      cortes:    { correcta: '(1,0), (0,1)', incorrectas: ['(-1,0) y (0,1)', '(0,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 1) D: (1, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,1)', 'Mín(1,0)', 'Mín(0,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 18, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = x^{3} - 3x + 2',
    fn: (x) => x*x*x - 3*x + 2,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,1)', '[0,∞)', '(-∞,0]'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,4]', '[-2,2]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (1,0), (0,2)', incorrectas: ['(-2,0) y (1,0)', '(-1,4) y (1,0)', '(0,0) y (2,0)'] },
      monotonia: { correcta: 'C: (-∞,-1) U (1,∞) D: (-1,1)', incorrectas: ['C: (-1,1) D: (-∞,-1) U (1,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(-1,4) Mín(1,0)', incorrectas: ['Mín(-1,4) Máx(1,0)', 'No tiene', 'Máx(-2,0) Mín(0,2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 19, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = x^{3} + 3x^{2} - 4',
    fn: (x) => x*x*x + 3*x*x - 4,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,1)', '[-4,∞)', '(-∞,0]'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,∞)', '[0,∞)', '(-∞,-4]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (1,0), (0,-4)', incorrectas: ['(-2,0) y (1,0)', '(0,-4)', '(-1,0) y (2,0) y (0,-4)'] },
      monotonia: { correcta: 'C: (-∞,-2) U (0,∞) D: (-2,0)', incorrectas: ['C: (-2,0) D: (-∞,-2) U (0,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(-2,0) Mín(0,-4)', incorrectas: ['Mín(-2,0) Máx(0,-4)', 'No tiene', 'Máx(1,0) Mín(-4,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 20, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = x^{3} - 6x^{2} + 9x',
    fn: (x) => x*x*x - 6*x*x + 9*x,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0,3)', '[0,∞)', '(-∞,0]'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,∞)', '[0,∞)', '[-4,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=6', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0), (3,0)', incorrectas: ['(0,0) y (3,0) y (4,0)', '(1,4) y (3,0)', '(0,0) y (9,0)'] },
      monotonia: { correcta: 'C: (-∞,1) U (3,∞) D: (1,3)', incorrectas: ['C: (1,3) D: (-∞,1) U (3,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(1,4) Mín(3,0)', incorrectas: ['Mín(1,4) Máx(3,0)', 'No tiene', 'Máx(0,0) Mín(3,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 21, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = x^{3} - 12x',
    fn: (x) => x*x*x - 12*x,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,2)', '[-16,∞)', '(-∞,0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,∞)', '[-16,16]', '[0,∞)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=12', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0), (±3.46,0)', incorrectas: ['(0,0)', '(0,0) y (±4,0)', '(±3.46,0)'] },
      monotonia: { correcta: 'C: (-∞,-2) U (2,∞) D: (-2,2)', incorrectas: ['C: (-2,2) D: (-∞,-2) U (2,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(-2,16) Mín(2,-16)', incorrectas: ['Mín(-2,16) Máx(2,-16)', 'No tiene', 'Máx(0,0) Mín(3.46,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 22, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = -x^{3} + 3x',
    fn: (x) => -x*x*x + 3*x,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-1.73,1.73)', '[-2,2]', '(-∞,0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,∞)', '[-2,2]', '[0,∞)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0), (±1.73,0)', incorrectas: ['(0,0) y (±3,0)', '(0,0)', '(±1,0)'] },
      monotonia: { correcta: 'C: (-1,1) D: (-∞,-1) U (1,∞)', incorrectas: ['C: (-∞,-1) U (1,∞) D: (-1,1)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(1,2) Mín(-1,-2)', incorrectas: ['Mín(1,2) Máx(-1,-2)', 'No tiene', 'Máx(-1,2) Mín(1,-2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 23, tipo: 'Polinómica', grado: 'Grado 3',
    latex: 'f(x) = x^{3} + x^{2} - 4x - 4',
    fn: (x) => x*x*x + x*x - 4*x - 4,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,2)', '[-6,∞)', '(-∞,0]'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,∞)', '[-6,1]', '[0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=3', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (-1,0), (2,0), (0,-4)', incorrectas: ['(-2,0) y (2,0)', '(-1,0) y (2,0)', '(0,0) y (-4,0)'] },
      monotonia: { correcta: 'C: (-∞,-1.54) U (0.87,∞) D: (-1.54,0.87)', incorrectas: ['C: (-1.54,0.87) D: (-∞,-1.54) U (0.87,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(-1.54,0.88) Mín(0.87,-6.06)', incorrectas: ['Mín(-1.54,0.88) Máx(0.87,-6.06)', 'No tiene', 'Máx(0,-4) Mín(-2,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 24, tipo: 'Polinómica', grado: 'Grado 4',
    latex: 'f(x) = x^{4}',
    fn: (x) => Math.pow(x,4),
    range: 4,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,0]', '[-1,1]'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(-∞,0)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['No tiene', '(1,0) y (-1,0)', '(0,0) y (1,0)'] },
      monotonia: { correcta: 'C: (0, ∞) D: (-∞, 0)', incorrectas: ['C: (-∞, 0) D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Mín(0,0)', incorrectas: ['Máx(0,0)', 'No tiene', 'Mín(1,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 25, tipo: 'Polinómica', grado: 'Grado 4',
    latex: 'f(x) = x^{4} - 5x^{2} + 4',
    fn: (x) => Math.pow(x,4)-5*x*x+4,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,2)', '[-4,∞)', '[-2,2]'] },
      recorrido: { correcta: '[-2.25, ∞)', incorrectas: ['(-∞,∞)', '(-∞,-2.25]', '[-5,4]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (-1,0), (1,0), (2,0), (0,4)', incorrectas: ['(-2,0) y (2,0)', '(-1,0) y (1,0)', '(0,0)'] },
      monotonia: { correcta: 'C: (-1.58,0) U (1.58,∞) D: (-∞,-1.58) U (0,1.58)', incorrectas: ['C: (-∞,-1.58) U (0,1.58) D: (-1.58,0) U (1.58,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(0,4) Mín(±1.58,-2.25)', incorrectas: ['Mín(0,4) Máx(±1.58,-2.25)', 'No tiene', 'Máx(±2,0) Mín(0,4)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 26, tipo: 'Polinómica', grado: 'Grado 4',
    latex: 'f(x) = x^{2}(x-2)^{2}',
    fn: (x) => Math.pow(x,2)*Math.pow(x-2,2),
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0,2)', '(-∞,1]', '[-1,1]'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '[1,∞)', '(-∞,0]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0), (2,0)', incorrectas: ['(0,0)', '(0,0) y (2,0) y (1,1)', '(1,1) y (2,0)'] },
      monotonia: { correcta: 'C: (0,1) U (2,∞) D: (-∞,0) U (1,2)', incorrectas: ['C: (-∞,0) U (1,2) D: (0,1) U (2,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Mín(0,0) Máx(1,1) Mín(2,0)', incorrectas: ['Máx(0,0) Mín(1,1) Máx(2,0)', 'No tiene', 'Mín(1,1) Máx(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 27, tipo: 'Polinómica', grado: 'Grado 4',
    latex: 'f(x) = -x^{4} + 4x^{2}',
    fn: (x) => -Math.pow(x,4)+4*x*x,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,2)', '[0,∞)', '[-4,4]'] },
      recorrido: { correcta: '(-∞, 4]', incorrectas: ['(-∞,∞)', '[0,4]', '(-∞,0]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (0,0), (2,0)', incorrectas: ['(-2,0) y (2,0)', '(0,0)', '(±1.41,4)'] },
      monotonia: { correcta: 'C: (-∞,-1.41) U (0,1.41) D: (-1.41,0) U (1.41,∞)', incorrectas: ['C: (-1.41,0) U (1.41,∞) D: (-∞,-1.41) U (0,1.41)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(-1.41,4) Mín(0,0) Máx(1.41,4)', incorrectas: ['Mín(±1.41,4) Máx(0,0)', 'No tiene', 'Máx(0,0) Mín(±2,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 28, tipo: 'Polinómica', grado: 'Grado 4',
    latex: 'f(x) = (x^{2}-4)^{2}',
    fn: (x) => Math.pow(x*x-4,2),
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,2)', '[-16,∞)', '(0,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '[-16,16]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (2,0), (0,16)', incorrectas: ['(-2,0) y (2,0)', '(0,16)', '(±4,0) y (0,16)'] },
      monotonia: { correcta: 'C: (-2,0) U (2,∞) D: (-∞,-2) U (0,2)', incorrectas: ['C: (-∞,-2) U (0,2) D: (-2,0) U (2,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Mín(-2,0) Máx(0,16) Mín(2,0)', incorrectas: ['Máx(-2,0) Mín(0,16) Máx(2,0)', 'No tiene', 'Mín(0,16) Máx(±2,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 29, tipo: 'Polinómica', grado: 'Grado 4',
    latex: 'f(x) = x^{4} - 8x^{2} + 7',
    fn: (x) => Math.pow(x,4)-8*x*x+7,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2,2)', '[-7,∞)', '[-9,7]'] },
      recorrido: { correcta: '[-9, ∞)', incorrectas: ['(-∞,∞)', '(-∞,-9]', '[-8,7]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-2.65,0), (-1,0), (1,0), (2.65,0), (0,7)', incorrectas: ['(-1,0) y (1,0)', '(0,7)', '(±2.65,0) y (±1,0)'] },
      monotonia: { correcta: 'C: (-2,0) U (2,∞) D: (-∞,-2) U (0,2)', incorrectas: ['C: (-∞,-2) U (0,2) D: (-2,0) U (2,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Mín(±2,-9) Máx(0,7)', incorrectas: ['Máx(±2,-9) Mín(0,7)', 'No tiene', 'Mín(0,7) Máx(±2,-9)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 30, tipo: 'Polinómica', grado: 'Grado 4',
    latex: 'f(x) = -x^{4} + 2x^{2} + 3',
    fn: (x) => -Math.pow(x,4)+2*x*x+3,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-1,1)', '[0,∞)', '[-4,4]'] },
      recorrido: { correcta: '(-∞, 4]', incorrectas: ['(-∞,∞)', '(-∞,3]', '[3,4]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-1.73,0), (1.73,0), (0,3)', incorrectas: ['(-2,0) y (2,0)', '(0,3)', '(±1,4) y (0,3)'] },
      monotonia: { correcta: 'C: (-∞,-1) U (0,1) D: (-1,0) U (1,∞)', incorrectas: ['C: (-1,0) U (1,∞) D: (-∞,-1) U (0,1)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(-1,4) Mín(0,3) Máx(1,4)', incorrectas: ['Mín(-1,4) Máx(0,3) Mín(1,4)', 'No tiene', 'Máx(0,3) Mín(±1,4)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 31, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{2}{x-1} + 1',
    fn: (x) => (x !== 1) ? 2/(x-(1)) + 1 : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 1) U (1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 2) U (2, ∞)', '(1, ∞)'] },
      recorrido: { correcta: '(-∞, 1) U (1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 2) U (2, ∞)', '(1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-1.0,0), (0,-1.0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 1) U (1, ∞)', incorrectas: ['C: (-∞, 1) U (1, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (-∞, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(1,1)', 'Mín(1,1)', 'Máx(0,-1.0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 32, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{1}{x}',
    fn: (x) => (x !== 0) ? 1/x + 0 : null,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      recorrido: { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene', incorrectas: ['(0,0)', '(0,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 0) U (0, ∞)', incorrectas: ['C: (-∞, 0) U (0, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,0)', 'Mín(0,0)', 'Máx(0,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 33, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{-1}{x+2}',
    fn: (x) => (x !== -2) ? -1/(x-(-2)) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, -2) U (-2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -3) U (-3, ∞)', '(-2, ∞)'] },
      recorrido: { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene corte X, (0,-0.5)', incorrectas: ['(0,0)', '(-2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, -2) U (-2, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, -2) U (-2, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (-2, ∞) D: (-∞, -2)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(-2,0)', 'Mín(-2,0)', 'Máx(0,-0.5)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 34, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{3}{x-2}',
    fn: (x) => (x !== 2) ? 3/(x-(2)) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 2) U (2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 3) U (3, ∞)', '(2, ∞)'] },
      recorrido: { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene corte X, (0,-1.5)', incorrectas: ['(0,0)', '(2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 2) U (2, ∞)', incorrectas: ['C: (-∞, 2) U (2, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (2, ∞) D: (-∞, 2)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(2,0)', 'Mín(2,0)', 'Máx(0,-1.5)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 35, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{1}{x} + 2',
    fn: (x) => (x !== 0) ? 1/x + 2 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      recorrido: { correcta: '(-∞, 2) U (2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 3) U (3, ∞)', '(2, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-0.5,0)', incorrectas: ['(0,0)', '(0,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 0) U (0, ∞)', incorrectas: ['C: (-∞, 0) U (0, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,2)', 'Mín(0,2)', 'Máx(0,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 36, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{-2}{x-1} + 3',
    fn: (x) => (x !== 1) ? -2/(x-(1)) + 3 : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 1) U (1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 2) U (2, ∞)', '(1, ∞)'] },
      recorrido: { correcta: '(-∞, 3) U (3, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 4) U (4, ∞)', '(3, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(1.67,0), (0,5.0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, 1) U (1, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, 1) U (1, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (-∞, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(1,3)', 'Mín(1,3)', 'Máx(0,5.0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 37, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{4}{x-3} - 1',
    fn: (x) => (x !== 3) ? 4/(x-(3)) + -1 : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 3) U (3, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 4) U (4, ∞)', '(3, ∞)'] },
      recorrido: { correcta: '(-∞, -1) U (-1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -2) U (-2, ∞)', '(-1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(7.0,0), (0,-2.33)', incorrectas: ['(0,0)', '(3,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 3) U (3, ∞)', incorrectas: ['C: (-∞, 3) U (3, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (3, ∞) D: (-∞, 3)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(3,-1)', 'Mín(3,-1)', 'Máx(0,-2.3)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 38, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{-1}{x} + 1',
    fn: (x) => (x !== 0) ? -1/x + 1 : null,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      recorrido: { correcta: '(-∞, 1) U (1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 2) U (2, ∞)', '(1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(-1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, 0) U (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, 0) U (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,1)', 'Mín(0,1)', 'Máx(0,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 39, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{2}{x+1}',
    fn: (x) => (x !== -1) ? 2/(x-(-1)) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, -1) U (-1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -2) U (-2, ∞)', '(-1, ∞)'] },
      recorrido: { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene corte X, (0,2.0)', incorrectas: ['(0,0)', '(-1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, -1) U (-1, ∞)', incorrectas: ['C: (-∞, -1) U (-1, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (-1, ∞) D: (-∞, -1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(-1,0)', 'Mín(-1,0)', 'Máx(0,2.0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 40, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{1}{x-2} - 2',
    fn: (x) => (x !== 2) ? 1/(x-(2)) + -2 : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 2) U (2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 3) U (3, ∞)', '(2, ∞)'] },
      recorrido: { correcta: '(-∞, -2) U (-2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -3) U (-3, ∞)', '(-2, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(2.5,0), (0,-2.5)', incorrectas: ['(0,0)', '(2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 2) U (2, ∞)', incorrectas: ['C: (-∞, 2) U (2, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (2, ∞) D: (-∞, 2)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(2,-2)', 'Mín(2,-2)', 'Máx(0,-2.5)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 41, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{-3}{x} + 2',
    fn: (x) => (x !== 0) ? -3/x + 2 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      recorrido: { correcta: '(-∞, 2) U (2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 3) U (3, ∞)', '(2, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(1.5,0)', incorrectas: ['(0,0)', '(3,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, 0) U (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, 0) U (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,2)', 'Mín(0,2)', 'Máx(0,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 42, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{2}{x} - 1',
    fn: (x) => (x !== 0) ? 2/x + -1 : null,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 0) U (0, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 1) U (1, ∞)', '(0, ∞)'] },
      recorrido: { correcta: '(-∞, -1) U (-1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -2) U (-2, ∞)', '(-1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(2.0,0)', incorrectas: ['(0,0)', '(-2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 0) U (0, ∞)', incorrectas: ['C: (-∞, 0) U (0, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,-1)', 'Mín(0,-1)', 'Máx(0,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 43, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{1}{x+3} + 1',
    fn: (x) => (x !== -3) ? 1/(x-(-3)) + 1 : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, -3) U (-3, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -4) U (-4, ∞)', '(-3, ∞)'] },
      recorrido: { correcta: '(-∞, 1) U (1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 2) U (2, ∞)', '(1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-4.0,0), (0,1.33)', incorrectas: ['(0,0)', '(-3,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, -3) U (-3, ∞)', incorrectas: ['C: (-∞, -3) U (-3, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (-3, ∞) D: (-∞, -3)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(-3,1)', 'Mín(-3,1)', 'Máx(0,1.3)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 44, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{-2}{x-2} + 1',
    fn: (x) => (x !== 2) ? -2/(x-(2)) + 1 : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 2) U (2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 3) U (3, ∞)', '(2, ∞)'] },
      recorrido: { correcta: '(-∞, 1) U (1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, 2) U (2, ∞)', '(1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(4.0,0), (0,2.0)', incorrectas: ['(0,0)', '(2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, 2) U (2, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, 2) U (2, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (2, ∞) D: (-∞, 2)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(2,1)', 'Mín(2,1)', 'Máx(0,2.0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 45, tipo: 'Racional', grado: 'Racional',
    latex: 'f(x) = \\frac{3}{x+1} - 2',
    fn: (x) => (x !== -1) ? 3/(x-(-1)) + -2 : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, -1) U (-1, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -2) U (-2, ∞)', '(-1, ∞)'] },
      recorrido: { correcta: '(-∞, -2) U (-2, ∞)', incorrectas: ['(-∞, ∞)', '(-∞, -3) U (-3, ∞)', '(-2, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0.5,0), (0,1.0)', incorrectas: ['(0,0)', '(-1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, -1) U (-1, ∞)', incorrectas: ['C: (-∞, -1) U (-1, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (-1, ∞) D: (-∞, -1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(-1,-2)', 'Mín(-1,-2)', 'Máx(0,1.0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 46, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\lnx',
    fn: (x) => (x > 0) ? Math.log(x+0) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 47, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\ln(x+2)',
    fn: (x) => (x > -2) ? Math.log(x+2) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-2, ∞)', incorrectas: ['(-∞, ∞)', '[-2, ∞)', '(0, ∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(-1.0,0), (0,0.69)', incorrectas: ['(1,0)', '(0,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-2, ∞) D: ∅', incorrectas: ['C: ∅ D: (-2, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(-1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 48, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\lnx + 1',
    fn: (x) => (x > 0) ? Math.log(x+0) + 1 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(0.37,0)', incorrectas: ['(0,0)', '(1,1)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(0.37,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 49, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = -\\lnx',
    fn: (x) => (x > 0) ? -(Math.log(x+0)) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (0, ∞)', incorrectas: ['C: (0, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 50, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\logx',
    fn: (x) => (x > 0) ? Math.log10(x+0) + 0 : null,
    range: 10,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 51, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\logx - 1',
    fn: (x) => (x > 0) ? Math.log10(x+0) + -1 : null,
    range: 12,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[-1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(10.0,0)', incorrectas: ['(0,0)', '(1,-1)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(10.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 52, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = 2·\\lnx',
    fn: (x) => (x > 0) ? 2*(Math.log(x+0)) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 53, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = -\\lnx - 1',
    fn: (x) => (x > 0) ? -(Math.log(x+0)) + -1 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[-1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(0.37,0)', incorrectas: ['(0,0)', '(1,-1)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (0, ∞)', incorrectas: ['C: (0, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(0.37,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 54, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\log_{2}x',
    fn: (x) => (x > 0) ? Math.log(x+0)/Math.log(2) + 0 : null,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 55, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\log_{2}x + 1',
    fn: (x) => (x > 0) ? Math.log(x+0)/Math.log(2) + 1 : null,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(0.5,0)', incorrectas: ['(0,0)', '(1,1)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(0.5,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 56, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\log_{3}x',
    fn: (x) => (x > 0) ? Math.log(x+0)/Math.log(3) + 0 : null,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 57, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = 2·\\logx',
    fn: (x) => (x > 0) ? 2*(Math.log10(x+0)) + 0 : null,
    range: 10,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 58, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = -\\logx',
    fn: (x) => (x > 0) ? -(Math.log10(x+0)) + 0 : null,
    range: 10,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(1.0,0)', incorrectas: ['(0,0)', '(1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (0, ∞)', incorrectas: ['C: (0, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 59, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\ln(x+1)',
    fn: (x) => (x > -1) ? Math.log(x+1) + 0 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-1, ∞)', incorrectas: ['(-∞, ∞)', '[-1, ∞)', '(0, ∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(0.0,0), (0,0.0)', incorrectas: ['(1,0)', '(0,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-1, ∞) D: ∅', incorrectas: ['C: ∅ D: (-1, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(0.0,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 60, tipo: 'Logarítmica', grado: 'Logarítmica',
    latex: 'f(x) = \\lnx + 2',
    fn: (x) => (x > 0) ? Math.log(x+0) + 2 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞, 0)', '[2, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=10', 'Sí, T=π'] },
      cortes:    { correcta: '(0.14,0)', incorrectas: ['(0,0)', '(1,2)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(0.14,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 61, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = e^{x}',
    fn: (x) => Math.exp(x) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 1)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,1)', incorrectas: ['(0,0)', '(1,2.72)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,1)', 'Máx(0,1)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 62, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = 2^{x}',
    fn: (x) => Math.pow(2,x) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 1)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,1)', incorrectas: ['(0,0)', '(1,2)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,1)', 'Máx(0,1)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 63, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = (\\frac{1}{2})^{x}',
    fn: (x) => Math.pow(0.5,x) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 1)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,1)', incorrectas: ['(0,0)', '(1,0.5)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,1)', 'Máx(0,1)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 64, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = -e^{x}',
    fn: (x) => -(Math.exp(x)) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, 0)', incorrectas: ['(-∞, ∞)', '(-∞, 0]', '(-1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,-1)', incorrectas: ['(0,0)', '(1,-2.72)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,-1)', 'Máx(0,-1)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 65, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = 2^{x} - 3',
    fn: (x) => Math.pow(2,x) + -3,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-3, ∞)', '(0, ∞)', '(-∞, -3)'] },
      recorrido: { correcta: '(-3, ∞)', incorrectas: ['(-∞, ∞)', '[-3, ∞)', '(-∞, -2)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(1.58,0), (0,-2)', incorrectas: ['(0,0)', '(1,-1)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,-2)', 'Máx(0,-2)', 'Mín(0,-3)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 66, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = e^{x} + 2',
    fn: (x) => Math.exp(x) + 2,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(2, ∞)', '(0, ∞)', '(-∞, 2)'] },
      recorrido: { correcta: '(2, ∞)', incorrectas: ['(-∞, ∞)', '[2, ∞)', '(-∞, 3)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,3)', incorrectas: ['(0,0)', '(1,4.72)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,3)', 'Máx(0,3)', 'Mín(0,2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 67, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = -2^{x}',
    fn: (x) => -(Math.pow(2,x)) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(-∞, 0)', incorrectas: ['(-∞, ∞)', '(-∞, 0]', '(-1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,-1)', incorrectas: ['(0,0)', '(1,-2)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,-1)', 'Máx(0,-1)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 68, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = 2·e^{x}',
    fn: (x) => 2*(Math.exp(x)) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 1)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,2)', incorrectas: ['(0,0)', '(1,5.44)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,2)', 'Máx(0,2)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 69, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = 3^{x}',
    fn: (x) => Math.pow(3,x) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 1)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,1)', incorrectas: ['(0,0)', '(1,3)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,1)', 'Máx(0,1)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 70, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = 3^{x} - 2',
    fn: (x) => Math.pow(3,x) + -2,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-2, ∞)', '(0, ∞)', '(-∞, -2)'] },
      recorrido: { correcta: '(-2, ∞)', incorrectas: ['(-∞, ∞)', '[-2, ∞)', '(-∞, -1)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0.63,0), (0,-1)', incorrectas: ['(0,0)', '(1,1)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,-1)', 'Máx(0,-1)', 'Mín(0,-2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 71, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = -e^{x} + 2',
    fn: (x) => -(Math.exp(x)) + 2,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(2, ∞)', '(0, ∞)', '(-∞, 2)'] },
      recorrido: { correcta: '(-∞, 2)', incorrectas: ['(-∞, ∞)', '(-∞, 2]', '(1, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0.69,0), (0,1)', incorrectas: ['(0,0)', '(1,-0.72)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,1)', 'Máx(0,1)', 'Mín(0,2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 72, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = 2^{x} + 1',
    fn: (x) => Math.pow(2,x) + 1,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(1, ∞)', '(0, ∞)', '(-∞, 1)'] },
      recorrido: { correcta: '(1, ∞)', incorrectas: ['(-∞, ∞)', '[1, ∞)', '(-∞, 2)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,2)', incorrectas: ['(0,0)', '(1,3)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,2)', 'Máx(0,2)', 'Mín(0,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 73, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = -2^{x} + 3',
    fn: (x) => -(Math.pow(2,x)) + 3,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(3, ∞)', '(0, ∞)', '(-∞, 3)'] },
      recorrido: { correcta: '(-∞, 3)', incorrectas: ['(-∞, ∞)', '(-∞, 3]', '(2, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(1.58,0), (0,2)', incorrectas: ['(0,0)', '(1,1)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, ∞)', incorrectas: ['C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,2)', 'Máx(0,2)', 'Mín(0,3)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 74, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = e^{x} - 1',
    fn: (x) => Math.exp(x) + -1,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-1, ∞)', '(0, ∞)', '(-∞, -1)'] },
      recorrido: { correcta: '(-1, ∞)', incorrectas: ['(-∞, ∞)', '[-1, ∞)', '(-∞, 0)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0.0,0), (0,0)', incorrectas: ['(0,0)', '(1,1.72)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,0)', 'Máx(0,0)', 'Mín(0,-1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 75, tipo: 'Exponencial', grado: 'Exponencial',
    latex: 'f(x) = 2·2^{x}',
    fn: (x) => 2*(Math.pow(2,x)) + 0,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '(0, ∞)', '(-∞, 0)'] },
      recorrido: { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞, 1)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=e', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(0,2)', incorrectas: ['(0,0)', '(1,4)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞, ∞) D: ∅', incorrectas: ['C: ∅ D: (-∞, ∞)', 'C: (0, ∞) D: (-∞, 0)', 'C: (-∞, 0) D: (0, ∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,2)', 'Máx(0,2)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 76, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\sin(x)',
    fn: (x) => Math.sin(x),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '[0,2π]', '(-∞,0) U (0,∞)'] },
      recorrido: { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '[0,1]', '(-1,1)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,0), (±kπ,0)', incorrectas: ['(0,1), (±kπ,0)', '(0,0), (±π/2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-π/2+2kπ, π/2+2kπ) D: (π/2+2kπ, 3π/2+2kπ)', incorrectas: ['C: (0,π) D: (π,2π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(π/2,1) Mín(-π/2,-1)', incorrectas: ['Máx(0,0)', 'Máx(π/2,2)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 77, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\cos(x)',
    fn: (x) => Math.cos(x),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '[0,2π]', '(-∞,0) U (0,∞)'] },
      recorrido: { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '[0,1]', '(-1,1)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,1), (π/2+kπ,0)', incorrectas: ['(0,0), (±kπ,0)', '(0,1), (±kπ,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (π+2kπ, 2π+2kπ) D: (0+2kπ, π+2kπ)', incorrectas: ['C: (0,π) D: (π,2π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(0,1) Mín(π,-1)', incorrectas: ['Mín(0,1)', 'Máx(π,-1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 78, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = 2\\sin(x)',
    fn: (x) => 2*Math.sin(x),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-2,2]', '[0,2π]', '(-∞,0) U (0,∞)'] },
      recorrido: { correcta: '[-2, 2]', incorrectas: ['(-∞,∞)', '[0,2]', '[-1,1]'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,0), (±kπ,0)', incorrectas: ['(0,2), (±kπ,0)', '(0,0), (±π/2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-π/2+2kπ, π/2+2kπ) D: (π/2+2kπ, 3π/2+2kπ)', incorrectas: ['C: (0,π) D: (π,2π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(π/2,2) Mín(-π/2,-2)', incorrectas: ['Máx(0,0)', 'Máx(π/2,1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 79, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\sin(2x)',
    fn: (x) => Math.sin(2*x),
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '[0,π]', '(-∞,0) U (0,∞)'] },
      recorrido: { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '[0,1]', '[-2,2]'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=π', incorrectas: ['Sí, T=2π', 'Sí, T=π/2', 'No'] },
      cortes:    { correcta: '(0,0), (kπ/2,0)', incorrectas: ['(0,0), (±kπ,0)', '(0,1), (kπ/2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-π/4+kπ, π/4+kπ) D: (π/4+kπ, 3π/4+kπ)', incorrectas: ['C: (0,π/2) D: (π/2,π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(π/4,1) Mín(-π/4,-1)', incorrectas: ['Máx(π/2,1)', 'Máx(π/4,2)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 80, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\cos(x) + 1',
    fn: (x) => Math.cos(x)+1,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[0,2]', '[0,2π]', '(-∞,∞)'] },
      recorrido: { correcta: '[0, 2]', incorrectas: ['(-∞,∞)', '[1,2]', '[-1,1]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,2), (π+2kπ,0)', incorrectas: ['(0,0), (±kπ,0)', '(0,2), (±kπ,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (π+2kπ, 2π+2kπ) D: (0+2kπ, π+2kπ)', incorrectas: ['C: (0,π) D: (π,2π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(0,2) Mín(π,0)', incorrectas: ['Mín(0,2)', 'Máx(π,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 81, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = -\\sin(x)',
    fn: (x) => -Math.sin(x),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '[0,2π]', '(-∞,0) U (0,∞)'] },
      recorrido: { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '[0,1]', '(-1,1)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,0), (±kπ,0)', incorrectas: ['(0,-1), (±kπ,0)', '(0,0), (±π/2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (π/2+2kπ, 3π/2+2kπ) D: (-π/2+2kπ, π/2+2kπ)', incorrectas: ['C: (-π/2,π/2) D: (π/2,3π/2)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Mín(π/2,-1) Máx(-π/2,1)', incorrectas: ['Máx(π/2,-1)', 'Mín(-π/2,1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 82, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\cos(2x)',
    fn: (x) => Math.cos(2*x),
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '[0,π]', '(-∞,∞)'] },
      recorrido: { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '[0,1]', '[-2,2]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'Sí, T=π', incorrectas: ['Sí, T=2π', 'Sí, T=π/2', 'No'] },
      cortes:    { correcta: '(0,1), (π/4+kπ/2,0)', incorrectas: ['(0,0), (±kπ,0)', '(0,1), (kπ,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (π/2+kπ, π+kπ) D: (0+kπ, π/2+kπ)', incorrectas: ['C: (0,π/2) D: (π/2,π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(0,1) Mín(π/2,-1)', incorrectas: ['Mín(0,1)', 'Máx(π/2,-1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 83, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\tan(x)',
    fn: (x) => Math.tan(x),
    range: 5,
    caracteristicas: {
      dominio:   { correcta: 'ℝ \ {π/2+kπ}', incorrectas: ['(-∞,∞)', 'ℝ \ {kπ}', '[-1,1]'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '(-∞,0) U (0,∞)', '[0,∞)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=π', incorrectas: ['Sí, T=2π', 'Sí, T=π/2', 'No'] },
      cortes:    { correcta: '(0,0), (kπ,0)', incorrectas: ['(0,1), (±π/2,0)', '(0,0)', 'No tiene'] },
      monotonia: { correcta: 'C: En cada intervalo D: ∅', incorrectas: ['C: ∅ D: En cada intervalo', 'C: (-∞,∞) D: ∅', 'Alterna'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(1,1)', 'Mín(0,0)', 'Máx(1) Mín(-1)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 84, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = 2\\cos(x)',
    fn: (x) => 2*Math.cos(x),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-2,2]', '[0,2π]', '(-∞,∞)'] },
      recorrido: { correcta: '[-2, 2]', incorrectas: ['(-∞,∞)', '[0,2]', '[-1,1]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,2), (π/2+kπ,0)', incorrectas: ['(0,0), (kπ,0)', '(0,2), (kπ,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (π+2kπ, 2π+2kπ) D: (0+2kπ, π+2kπ)', incorrectas: ['C: (0,π) D: (π,2π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(0,2) Mín(π,-2)', incorrectas: ['Mín(0,2)', 'Máx(π,-2)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 85, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\sin(x) + 1',
    fn: (x) => Math.sin(x)+1,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[0,2]', '[0,2π]', '(-∞,∞)'] },
      recorrido: { correcta: '[0, 2]', incorrectas: ['(-∞,∞)', '[1,2]', '[-1,1]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,1), (-π+2kπ,0) y (0+2kπ... ver gráfica)', incorrectas: ['(0,0), (±kπ,0)', '(0,1)', 'No tiene'] },
      monotonia: { correcta: 'C: (-π/2+2kπ, π/2+2kπ) D: (π/2+2kπ, 3π/2+2kπ)', incorrectas: ['C: (π/2,3π/2) D: (-π/2,π/2)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(π/2,2) Mín(-π/2,0)', incorrectas: ['Máx(0,1)', 'Mín(π/2,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 86, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\sin(x/2)',
    fn: (x) => Math.sin(x/2),
    range: 12,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '[0,4π]', '(-∞,0) U (0,∞)'] },
      recorrido: { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '[0,1]', '(-1,1)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=4π', incorrectas: ['Sí, T=2π', 'Sí, T=π', 'No'] },
      cortes:    { correcta: '(0,0), (±2kπ,0)', incorrectas: ['(0,0), (±kπ,0)', '(0,1), (±2kπ,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-π+4kπ, π+4kπ) D: (π+4kπ, 3π+4kπ)', incorrectas: ['C: (0,2π) D: (2π,4π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(π,1) Mín(-π,-1)', incorrectas: ['Máx(π/2,1)', 'Máx(2π,1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 87, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = 3\\sin(x)',
    fn: (x) => 3*Math.sin(x),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-3,3]', '[0,2π]', '(-∞,0) U (0,∞)'] },
      recorrido: { correcta: '[-3, 3]', incorrectas: ['(-∞,∞)', '[0,3]', '[-1,1]'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,0), (±kπ,0)', incorrectas: ['(0,3), (±kπ,0)', '(0,0), (±π/2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-π/2+2kπ, π/2+2kπ) D: (π/2+2kπ, 3π/2+2kπ)', incorrectas: ['C: (0,π) D: (π,2π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(π/2,3) Mín(-π/2,-3)', incorrectas: ['Máx(0,0)', 'Máx(π/2,1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 88, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = -\\cos(x)',
    fn: (x) => -Math.cos(x),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '[0,2π]', '(-∞,∞)'] },
      recorrido: { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '[-1,0]', '[0,1]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,-1), (π/2+kπ,0)', incorrectas: ['(0,0), (±kπ,0)', '(0,-1), (kπ,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (0+2kπ, π+2kπ) D: (π+2kπ, 2π+2kπ)', incorrectas: ['C: (π,2π) D: (0,π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Mín(0,-1) Máx(π,1)', incorrectas: ['Máx(0,-1)', 'Mín(π,1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 89, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = \\cos(x) - 1',
    fn: (x) => Math.cos(x)-1,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-2,0]', '[0,2π]', '(-∞,∞)'] },
      recorrido: { correcta: '[-2, 0]', incorrectas: ['(-∞,∞)', '[-1,1]', '[0,∞)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al origen'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,0), — solo toca eje X en x=2kπ', incorrectas: ['(0,-1), (π/2+kπ,0)', '(0,0), (kπ,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (π+2kπ, 2π+2kπ) D: (0+2kπ, π+2kπ)', incorrectas: ['C: (0,π) D: (π,2π)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(0,0) Mín(π,-2)', incorrectas: ['Mín(0,0)', 'Máx(π,-2)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 90, tipo: 'Trigonométrica', grado: 'Trigonométrica',
    latex: 'f(x) = 2\\sin(x) - 1',
    fn: (x) => 2*Math.sin(x)-1,
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-3,1]', '[0,2π]', '(-∞,∞)'] },
      recorrido: { correcta: '[-3, 1]', incorrectas: ['(-∞,∞)', '[-2,2]', '[-1,1]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'Sí, T=2π', incorrectas: ['Sí, T=π', 'Sí, T=2', 'No'] },
      cortes:    { correcta: '(0,-1), (±0.52+2kπ,0)', incorrectas: ['(0,0), (±kπ,0)', '(0,-1)', 'No tiene'] },
      monotonia: { correcta: 'C: (-π/2+2kπ, π/2+2kπ) D: (π/2+2kπ, 3π/2+2kπ)', incorrectas: ['C: (π/2,3π/2) D: (-π/2,π/2)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(π/2,1) Mín(-π/2,-3)', incorrectas: ['Máx(0,-1)', 'Mín(π/2,1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 91, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{x}',
    fn: (x) => (x >= 0) ? Math.sqrt(x) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['(1,0)', '(0,0) y (1,1)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,0)', 'Máx(0,0)', 'Mín(1,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 92, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = -\\sqrt{x}',
    fn: (x) => (x >= 0) ? -Math.sqrt(x) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '[0,∞)', '(0,∞)'] },
      recorrido: { correcta: '(-∞, 0]', incorrectas: ['[0,∞)', '(-∞,∞)', '(-∞,0)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['(1,0)', '(0,0) y (1,-1)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (0, ∞)', incorrectas: ['C: (0, ∞) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,0)', 'Mín(0,0)', 'Mín(1,-1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 93, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{x-1}',
    fn: (x) => (x >= 1) ? Math.sqrt(x-1) : null,
    range: 7,
    caracteristicas: {
      dominio:   { correcta: '[1, ∞)', incorrectas: ['(-∞,∞)', '(-∞,1]', '(1,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(1,0)', incorrectas: ['(0,1)', '(1,0) y (0,-1)', 'No tiene'] },
      monotonia: { correcta: 'C: (1, ∞) D: ∅', incorrectas: ['C: ∅ D: (1, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (2, ∞) D: (1, 2)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(1,0)', 'Máx(1,0)', 'Mín(0,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 94, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{x+2}',
    fn: (x) => (x >= -2) ? Math.sqrt(x+2) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '[-2, ∞)', incorrectas: ['(-∞,∞)', '[-2,∞)', '(0,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-2,0), (0,1.41)', incorrectas: ['(2,0)', '(-2,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-2, ∞) D: ∅', incorrectas: ['C: ∅ D: (-2, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (0, ∞) D: (-2, 0)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(-2,0)', 'Máx(-2,0)', 'Mín(0,1.41)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 95, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = 2\\sqrt{x}',
    fn: (x) => (x >= 0) ? 2*Math.sqrt(x) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['(2,0)', '(0,0) y (1,2)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,0)', 'Máx(0,0)', 'Mín(1,2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 96, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{4-x}',
    fn: (x) => (x <= 4) ? Math.sqrt(4-x) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, 4]', incorrectas: ['(-∞,∞)', '[-4,4]', '(0,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '[0,2]', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(4,0), (0,2)', incorrectas: ['(4,0)', '(0,4)', 'No tiene'] },
      monotonia: { correcta: 'C: ∅ D: (-∞, 4)', incorrectas: ['C: (-∞, 4) D: ∅', 'C: (-∞, ∞) D: ∅', 'C: (0, 4) D: (-∞, 0)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(4,0)', 'Máx(4,0)', 'Mín(0,2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 97, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{x^{2}}',
    fn: (x) => Math.abs(x),
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,0]', '(-∞,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['No tiene', '(1,0) y (-1,0)', '(0,0) y (±1,1)'] },
      monotonia: { correcta: 'C: (0, ∞) D: (-∞, 0)', incorrectas: ['C: (-∞, 0) D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Mín(0,0)', incorrectas: ['Máx(0,0)', 'No tiene', 'Mín(1,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 98, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{x} + 1',
    fn: (x) => (x >= 0) ? Math.sqrt(x)+1 : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '[0,∞)', '(0,∞)'] },
      recorrido: { correcta: '[1, ∞)', incorrectas: ['(-∞,∞)', '(-∞,1]', '(1,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(0,1)', incorrectas: ['(0,0)', '(1,0) y (0,1)', 'No tiene'] },
      monotonia: { correcta: 'C: (0, ∞) D: ∅', incorrectas: ['C: ∅ D: (0, ∞)', 'C: (-∞, ∞) D: ∅', 'C: (1, ∞) D: (0, 1)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,0)', 'Mín(0,1)', 'Máx(0,1)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 99, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{1-x^{2}}',
    fn: (x) => (Math.abs(x) <= 1) ? Math.sqrt(1-x*x) : null,
    range: 2,
    caracteristicas: {
      dominio:   { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '(-1,1)', '[0,1]'] },
      recorrido: { correcta: '[0, 1]', incorrectas: ['(-∞,∞)', '(-∞,1]', '[0,∞)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Sin simetría', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-1,0), (1,0), (0,1)', incorrectas: ['(0,1)', '(-1,0) y (1,0)', 'No tiene'] },
      monotonia: { correcta: 'C: (-1, 0) D: (0, 1)', incorrectas: ['C: (0, 1) D: (-1, 0)', 'C: (-∞, ∞) D: ∅', 'C: ∅ D: (-∞, ∞)'] },
      extremos:  { correcta: 'Máx(0,1)', incorrectas: ['Mín(0,1)', 'Máx(-1,0) Mín(1,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 100, tipo: 'Irracional', grado: 'Irracional',
    latex: 'f(x) = \\sqrt{x^{2}-1}',
    fn: (x) => (Math.abs(x) >= 1) ? Math.sqrt(x*x-1) : null,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞,-1] U [1, ∞)', incorrectas: ['(-∞,∞)', '[-1,1]', '(1,∞)'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Sin simetría', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: '(-1,0), (1,0)', incorrectas: ['(0,0)', '(-1,0) y (1,0) y (0,-1)', 'No tiene'] },
      monotonia: { correcta: 'C: (-∞,-1) U (1,∞) D: ∅', incorrectas: ['C: ∅ D: (-∞,-1) U (1,∞)', 'C: (-∞, ∞) D: ∅', 'C: (-1,1) D: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(-1,0) Mín(1,0)', 'Máx(-1,0) Máx(1,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 101, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'f(x) = 9 - 4x^{2}',
    fn: (x) => 9 - 4*x*x,
    range: 4,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(-3/2, 3/2)', '(0, ∞)', '[0, 9]'] },
      recorrido: { correcta: '(-∞, 9]', incorrectas: ['(-∞, ∞)', '[0, 9]', '(-∞, 0]'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al eje X'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=π', 'Sí, T=4'] },
      cortes:    { correcta: '(-1.5,0), (1.5,0), (0,9)', incorrectas: ['(0,9)', '(3,0) y (-3,0)', '(±3,0)'] },
      monotonia: { correcta: 'C: (-∞,0) D: (0,∞)', incorrectas: ['C: (-∞,∞) D: ∅', 'C: (0,∞) D: (-∞,0)', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'Máx(0,9)', incorrectas: ['Mín(0,9)', 'Máx(1.5,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 102, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'g(x) = \\frac{x}{7-x^{2}}',
    fn: (x) => (Math.abs(7 - x*x) > 0.001) ? x / (7 - x*x) : null,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: 'ℝ - {-√7, √7}', incorrectas: ['(-∞, ∞)', 'ℝ - {0}', '(-√7, √7)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(-∞,0)∪(0,∞)', '[-1,1]', '(0,∞)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=π', 'Sí, T=√7', 'Sí, T=2'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['(√7,0) y (-√7,0)', 'No tiene', '(0,7)'] },
      monotonia: { correcta: 'C: todo el dominio D: ∅', incorrectas: ['C: ∅ D: todo el dominio', 'C: (0,√7) D: fuera', 'C: (-√7,√7) D: resto'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,0)', 'Mín(√7,0)', 'Mín(0,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 103, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'h(x) = \\frac{x-1}{x^{3}-2x^{2}-5x+6}',
    fn: (x) => (Math.abs(x+2)>0.001 && Math.abs(x-1)>0.001 && Math.abs(x-3)>0.001) ? (x-1)/(Math.pow(x,3)-2*x*x-5*x+6) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: 'ℝ - {-2, 1, 3}', incorrectas: ['ℝ - {-3, 1, 2}', 'ℝ - {1, 3}', '(-∞, ∞)'] },
      recorrido: { correcta: 'ℝ - {0}', incorrectas: ['(-∞, ∞)', '(-∞,0)∪(0,∞) - {-1/6}', '[0, ∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene en x; (0,-1/6) en y', incorrectas: ['(1,0)', '(0,0)', 'No tiene'] },
      monotonia: { correcta: 'D: en cada intervalo C: ∅', incorrectas: ['C: (-∞,∞) D: ∅', 'C: (1,3) D: resto', 'C: ∅ D: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(0,-1/6)', 'Máx(1,0)', 'Mín(1,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 104, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'y = 1 + \\frac{1}{x} - \\frac{x}{x-1}',
    fn: (x) => (Math.abs(x)>0.001 && Math.abs(x-1)>0.001) ? -1/(x*(x-1)) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: 'ℝ - {0, 1}', incorrectas: ['(-∞, ∞)', 'ℝ - {1}', '(0, ∞)'] },
      recorrido: { correcta: '(-∞,0) ∪ [4,+∞)', incorrectas: ['(-∞, ∞)', '(-∞,0)∪(0,∞)', '[0,+∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene', incorrectas: ['(0,0)', '(1,0)', '(0,1)'] },
      monotonia: { correcta: 'C: (1/2,1)∪(1,∞) D: (-∞,0)∪(0,1/2)', incorrectas: ['C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,0)∪(0,∞)', 'C: (0,∞) D: (-∞,0)'] },
      extremos:  { correcta: 'Mín(1/2, 4)', incorrectas: ['Máx(1/2,4)', 'Mín(0,0)', 'No tiene'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 105, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'f(x) = ⁵√(\\frac{x}{7-x^{2}})',
    fn: (x) => { const d=7-x*x; if(Math.abs(d)<0.001) return null; const v=x/d; return v>=0 ? Math.pow(v,0.2) : -Math.pow(-v,0.2); },
    range: 5,
    caracteristicas: {
      dominio:   { correcta: 'ℝ - {-√7, √7}', incorrectas: ['(-∞, ∞)', '(0, ∞)', 'ℝ - {0}'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['(0, ∞)', '[-1,1]', '(-∞,0)∪(0,∞)'] },
      simetria:  { correcta: 'Impar', incorrectas: ['Par', 'Sin simetría', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=π', 'Sí, T=√7', 'Sí, T=2'] },
      cortes:    { correcta: '(0,0)', incorrectas: ['(√7,0) y (-√7,0)', 'No tiene', '(7,0)'] },
      monotonia: { correcta: 'C: todo el dominio D: ∅', incorrectas: ['C: ∅ D: todo el dominio', 'C: (-√7,√7) D: resto', 'C: ∅ D: (-∞,∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,0)', 'Mín(0,0)', 'Máx(√7,1)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 106, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'f(x) = x - \\frac{2}{√x}',
    fn: (x) => (x > 0.001) ? x - 2/Math.sqrt(x) : null,
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(0, ∞)', incorrectas: ['(-∞, ∞)', '[0, ∞)', '(-∞,0)∪(0,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0, ∞)', '(-∞,0)', '(-2,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(∛4, 0); no corta al eje Y', incorrectas: ['(0,0)', '(2,0)', '(4,0) y (0,-2)'] },
      monotonia: { correcta: 'C: (0,∞) D: ∅', incorrectas: ['C: ∅ D: (0,∞)', 'C: (∛4,∞) D: (0,∛4)', 'C: (0,2) D: (2,∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(∛4,0)', 'Máx(0,0)', 'Mín(0,-2)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 107, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'y = √(x^{2}-5x+6)',
    fn: (x) => { const v=x*x-5*x+6; return v>=0 ? Math.sqrt(v) : null; },
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞,2] ∪ [3,+∞)', incorrectas: ['(-∞,∞)', '(2,3)', '[2,3]'] },
      recorrido: { correcta: '[0, ∞)', incorrectas: ['(-∞,∞)', '(0,∞)', '(-∞,0]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto a x=2.5'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=3', 'Sí, T=π'] },
      cortes:    { correcta: '(2,0), (3,0), (0,√6)', incorrectas: ['(2,0) y (3,0)', '(0,0)', '(±√6,0)'] },
      monotonia: { correcta: 'C: [3,+∞) D: (-∞,2]', incorrectas: ['C: (-∞,∞) D: ∅', 'C: (-∞,2] D: [3,∞)', 'C: (2,3) D: resto'] },
      extremos:  { correcta: 'Mín(2,0) y Mín(3,0)', incorrectas: ['Máx(2.5,0)', 'Mín(2.5,0)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 108, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'y = \\frac{-2}{√(x^{2}-5x+6)}',
    fn: (x) => { const v=x*x-5*x+6; return v>0.001 ? -2/Math.sqrt(v) : null; },
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞,2) ∪ (3,+∞)', incorrectas: ['(-∞,∞)', '(-∞,2]∪[3,∞)', '[2,3]'] },
      recorrido: { correcta: '(-∞, 0)', incorrectas: ['(-∞,∞)', '(-∞,0]', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto a x=2.5'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=3', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene en x; (0,-2/√6) en y', incorrectas: ['(2,0) y (3,0)', 'No tiene', '(0,0)'] },
      monotonia: { correcta: 'C: (3,+∞) D: (-∞,2)', incorrectas: ['C: (-∞,2) D: (3,∞)', 'C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,2)∪(3,∞)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(2.5,-2)', 'Mín(2,-2)', 'Mín(3,-2)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 109, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'y = \\frac{-2}{∛(x^{2}-5x+6)}',
    fn: (x) => { const v=x*x-5*x+6; if(Math.abs(v)<0.001) return null; const cbrt=v>0?Math.pow(v,1/3):-Math.pow(-v,1/3); return -2/cbrt; },
    range: 6,
    caracteristicas: {
      dominio:   { correcta: 'ℝ - {2, 3}', incorrectas: ['(-∞,∞)', '(-∞,2)∪(3,∞)', 'ℝ - {2.5}'] },
      recorrido: { correcta: 'ℝ - {0}', incorrectas: ['(-∞,∞)', '(-∞,0)', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto a x=2.5'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=3', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene en x; (0,-2/∛6) en y', incorrectas: ['(2,0) y (3,0)', 'No tiene', '(0,0)'] },
      monotonia: { correcta: 'D: (-∞,2)∪(2,5/2) C: (5/2,3)∪(3,∞)', incorrectas: ['C: (-∞,∞) D: ∅', 'C: ∅ D: (-∞,2)∪(3,∞)', 'D: todo el dominio C: ∅'] },
      extremos:  { correcta: 'Mín(2.5, 2∛4)', incorrectas: ['Máx(2.5,0)', 'No tiene', 'Mín(2,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 110, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'f(x) = √(\\frac{x+2}{3x-5})',
    fn: (x) => { const d=3*x-5; if(Math.abs(d)<0.001) return null; const v=(x+2)/d; return v>=0 ? Math.sqrt(v) : null; },
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-∞,-2] ∪ (5/3,+∞)', incorrectas: ['(-∞,∞)', '(-2,5/3)', '[-2,5/3]'] },
      recorrido: { correcta: '[0,+∞)', incorrectas: ['(-∞,∞)', '(0,∞)', '[1/3,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=π', 'Sí, T=3'] },
      cortes:    { correcta: '(-2,0); no corta al eje Y', incorrectas: ['(5/3,0)', '(0,0)', '(-2,0) y (5/3,0)'] },
      monotonia: { correcta: 'D: (-∞,-2)∪(5/3,+∞) C: ∅', incorrectas: ['C: (-∞,-2)∪(5/3,∞) D: ∅', 'C: (5/3,∞) D: (-∞,-2)', 'C: (-∞,∞) D: ∅'] },
      extremos:  { correcta: 'Mín(-2,0)', incorrectas: ['Máx(-2,0)', 'No tiene', 'Mín(5/3,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 111, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'g(x) = ⁴√(x^{2}+5x+8)',
    fn: (x) => Math.pow(x*x+5*x+8, 0.25),
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['[-5/2,∞)', '[-2,-1/2]', '(0,∞)'] },
      recorrido: { correcta: '[⁴√(7/4), ∞) ≈ [1.15, ∞)', incorrectas: ['(-∞,∞)', '[0,∞)', '[1,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=1', 'Sí, T=2', 'Sí, T=π'] },
      cortes:    { correcta: 'No tiene en x; (0,⁴√8) en y', incorrectas: ['(0,0)', '(-2,0) y (-3,0)', 'No tiene'] },
      monotonia: { correcta: 'D: (-∞,-5/2) C: (-5/2,+∞)', incorrectas: ['C: (-∞,∞) D: ∅', 'C: (-∞,-5/2) D: (-5/2,∞)', 'D: (-∞,∞) C: ∅'] },
      extremos:  { correcta: 'Mín(-2.5, ⁴√(7/4))', incorrectas: ['Máx(-2.5,0)', 'No tiene', 'Mín(0,⁴√8)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 112, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'l(x) = √(3+2x-x^{2})',
    fn: (x) => { const v=3+2*x-x*x; return v>=0 ? Math.sqrt(v) : null; },
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '[-1, 3]', incorrectas: ['(-∞,∞)', '[-3,1]', '(-1,3)'] },
      recorrido: { correcta: '[0, 2]', incorrectas: ['(-∞,∞)', '[0,√3]', '[0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto a x=1'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2', 'Sí, T=4', 'Sí, T=π'] },
      cortes:    { correcta: '(-1,0), (3,0), (0,√3)', incorrectas: ['(0,0)', '(-1,0) y (3,0)', '(1,2) y (0,√3)'] },
      monotonia: { correcta: 'C: [-1,1] D: [1,3]', incorrectas: ['C: [-1,3] D: ∅', 'C: [1,3] D: [-1,1]', 'D: [-1,3] C: ∅'] },
      extremos:  { correcta: 'Máx(1,2)', incorrectas: ['Mín(1,2)', 'Máx(0,√3)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 113, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'm(x) = \\frac{√(9-x^{2})}{x+1}',
    fn: (x) => { const v=9-x*x; if(v<0 || Math.abs(x+1)<0.001) return null; return Math.sqrt(v)/(x+1); },
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '[-3,3] - {-1}', incorrectas: ['[-3,3]', '(-3,3)', '(-∞,∞) - {-1}'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-3,3)', '[-3,3]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2π', 'Sí, T=6', 'Sí, T=π'] },
      cortes:    { correcta: '(-3,0), (3,0), (0,3)', incorrectas: ['(0,3)', '(0,0)', '(-3,0) y (3,0) y (0,-3)'] },
      monotonia: { correcta: 'D: [-3,-1)∪(-1,3] C: ∅', incorrectas: ['C: [-3,3] D: ∅', 'C: (-1,3] D: [-3,-1)', 'C: ∅ D: [-3,3]'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,3)', 'Mín(-3,0)', 'Máx(-1,∞)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 114, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'y = e^{1/x} + 2^{-1/(x-7)}',
    fn: (x) => (Math.abs(x)>0.001 && Math.abs(x-7)>0.001) ? Math.exp(1/x) + Math.pow(2, -1/(x-7)) : null,
    range: 10,
    caracteristicas: {
      dominio:   { correcta: 'ℝ - {0, 7}', incorrectas: ['(-∞,∞)', 'ℝ - {0}', '(0,7)'] },
      recorrido: { correcta: '(0, ∞)', incorrectas: ['(-∞,∞)', '(-∞,0)', '[2,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=7', 'Sí, T=π', 'Sí, T=2'] },
      cortes:    { correcta: 'No tiene en x ni en y', incorrectas: ['(0,2)', '(7,2)', '(0,0)'] },
      monotonia: { correcta: 'D: (-∞,0)∪(0,7) C: (7,∞)', incorrectas: ['C: (-∞,∞) D: ∅', 'C: (0,7) D: resto', 'D: todo el dominio C: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(7,2)', 'Máx(0,2)', 'Mín(3.5,2)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 115, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'ñ(x) = ln(2x+3)',
    fn: (x) => (2*x+3 > 0) ? Math.log(2*x+3) : null,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-3/2, ∞)', incorrectas: ['(-∞,∞)', '(0,∞)', '(-3,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,0)', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2π', 'Sí, T=3', 'Sí, T=1'] },
      cortes:    { correcta: '(-1,0), (0,ln3)', incorrectas: ['(0,0)', '(-3/2,0)', '(-1,0) y (0,3)'] },
      monotonia: { correcta: 'C: (-3/2,∞) D: ∅', incorrectas: ['C: ∅ D: (-3/2,∞)', 'C: (0,∞) D: (-3/2,0)', 'D: (-3/2,∞) C: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(-1,0)', 'Mín(0,ln3)', 'Máx(-1,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 116, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'k(x) = ln(2x+3) + \\frac{1}{x}',
    fn: (x) => (2*x+3 > 0 && Math.abs(x)>0.001) ? Math.log(2*x+3) + 1/x : null,
    range: 5,
    caracteristicas: {
      dominio:   { correcta: '(-3/2,0) ∪ (0,+∞)', incorrectas: ['(-3/2,∞)', '(0,∞)', '(-∞,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,0)', '(0,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2π', 'Sí, T=3', 'Sí, T=1'] },
      cortes:    { correcta: 'No tiene corte con eje Y', incorrectas: ['(0,0)', '(0,ln3)', '(-1,0)'] },
      monotonia: { correcta: 'C: (0,∞) D: compleja en (-3/2,0)', incorrectas: ['C: (-3/2,∞) D: ∅', 'C: ∅ D: todo el dominio', 'C: (-3/2,0) D: (0,∞)'] },
      extremos:  { correcta: 'Posible mínimo en (-3/2,0)', incorrectas: ['No tiene', 'Mín(0,∞)', 'Máx(-1,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
,
  {
    id: 117, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'f(x) = sen(√(1-x^{2}))',
    fn: (x) => { const v=1-x*x; return v>=0 ? Math.sin(Math.sqrt(v)) : null; },
    range: 2,
    caracteristicas: {
      dominio:   { correcta: '[-1, 1]', incorrectas: ['(-∞,∞)', '(-1,1)', '[0,1]'] },
      recorrido: { correcta: '[0, sen(1)] ≈ [0, 0.84]', incorrectas: ['[-1,1]', '[0,1]', '(-∞,∞)'] },
      simetria:  { correcta: 'Par', incorrectas: ['Impar', 'Sin simetría', 'Respecto al eje X'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2π', 'Sí, T=1', 'Sí, T=π'] },
      cortes:    { correcta: '(-1,0), (1,0), (0,sen1)', incorrectas: ['(0,0)', '(0,1)', '(0,sen1) solo'] },
      monotonia: { correcta: 'C: [-1,0] D: [0,1]', incorrectas: ['C: [-1,1] D: ∅', 'C: [0,1] D: [-1,0]', 'D: [-1,1] C: ∅'] },
      extremos:  { correcta: 'Máx(0, sen1)', incorrectas: ['Mín(0,0)', 'Máx(0,1)', 'No tiene'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 118, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'f(x) = x^{2} - 3x + ln(5^{cos x})',
    fn: (x) => x*x - 3*x + Math.cos(x)*Math.log(5),
    range: 8,
    caracteristicas: {
      dominio:   { correcta: '(-∞, ∞)', incorrectas: ['(0,∞)', '[-1,1]', 'ℝ - {π/2+kπ}'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '[-9/4-ln5, ∞)', '[-1,1]'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto a x=3/2'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=2π', 'Sí, T=π', 'Sí, T=1'] },
      cortes:    { correcta: '(0, ln5) en y', incorrectas: ['(0,0)', '(0,1)', '(3/2,0)'] },
      monotonia: { correcta: 'Alterna: depende de x²-3x y cos', incorrectas: ['C: (-∞,∞) D: ∅', 'C: (3/2,∞) D: (-∞,3/2)', 'D: (-∞,∞) C: ∅'] },
      extremos:  { correcta: 'Mínimos locales múltiples', incorrectas: ['No tiene', 'Mín(3/2,-9/4)', 'Máx(0,ln5)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 119, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'h(x) = \\frac{log(25-x^{2})}{√(x^{2}+3x-4)}',
    fn: (x) => { const la=25-x*x; const sa=x*x+3*x-4; if(la<=0||sa<=0.001) return null; return Math.log10(la)/Math.sqrt(sa); },
    range: 6,
    caracteristicas: {
      dominio:   { correcta: '(-5,-4) ∪ (1,5)', incorrectas: ['(-5,5)', '(-4,1)', '(-∞,∞)'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[0,∞)', '(-∞,0)', '[log9,∞)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al eje Y'] },
      periodica: { correcta: 'No', incorrectas: ['Sí, T=5', 'Sí, T=π', 'Sí, T=2'] },
      cortes:    { correcta: '(±2√6, 0) ≈ (±4.9, 0); no corte en y', incorrectas: ['(0,0)', '(5,0) y (-5,0)', 'No tiene'] },
      monotonia: { correcta: 'Decreciente en cada intervalo del dominio', incorrectas: ['C: (-∞,∞) D: ∅', 'C: todo el dominio D: ∅', 'C: (1,5) D: (-5,-4)'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Máx(0,log25)', 'Mín(±5,0)', 'Mín(1,0)'] },
      continua:  { correcta: 'Sí', incorrectas: ['No'] }
    }
  }
,
  {
    id: 120, tipo: 'Compuesta', grado: 'Compuesta',
    latex: 'y = tg(2x-3)',
    fn: (x) => { const a=2*x-3; const c=Math.cos(a); return Math.abs(c)>0.01 ? Math.sin(a)/c : null; },
    range: 8,
    caracteristicas: {
      dominio:   { correcta: 'ℝ - {3/2+(2k+1)π/4, k∈ℤ}', incorrectas: ['(-∞,∞)', 'ℝ - {π/2+kπ}', 'ℝ - {3/2+kπ}'] },
      recorrido: { correcta: '(-∞, ∞)', incorrectas: ['[-1,1]', '(0,∞)', '(-π/2,π/2)'] },
      simetria:  { correcta: 'Sin simetría', incorrectas: ['Par', 'Impar', 'Respecto al origen'] },
      periodica: { correcta: 'Sí, T=π/2', incorrectas: ['Sí, T=π', 'Sí, T=2π', 'No'] },
      cortes:    { correcta: '(3/2,0) y (0,tg(-3)≈0.14)', incorrectas: ['(0,0)', '(3,0)', 'No tiene'] },
      monotonia: { correcta: 'C: en cada intervalo del dominio D: ∅', incorrectas: ['C: ∅ D: todo', 'C: (-∞,∞) D: ∅', 'D: en cada intervalo C: ∅'] },
      extremos:  { correcta: 'No tiene', incorrectas: ['Mín(3/2,0)', 'Máx(0,0.14)', 'Mín(0,0)'] },
      continua:  { correcta: 'No', incorrectas: ['Sí'] }
    }
  }
];