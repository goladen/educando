/**
 * BibliotecaGeometria.js
 * Base de datos de 30 cuerpos geométricos compuestos.
 * Diseñado para aplicaciones educativas.
 */

const bibliotecaGeometria = [
  // =========================================================
  // TIPO 1: SILOS (Cilindro + Cono encima)
  // =========================================================
  {
    id: "fig_001",
    nombre: "Silo Estándar",
    componentes: ["Cilindro", "Cono"],
    medidas: { radio: 3, alturaCilindro: 8, alturaCono: 4, generatrizCono: 5 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCono) / 3); },
    get area() { return (Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (Math.PI * this.medidas.radio * this.medidas.generatrizCono); },
    feedback: {
      pasosVolumen: "1. V cilindro = A circulo base * altura. \n2. V cono = (A circulo base * altura) / 3. \n3. Sumar ambos volúmenes.",
      pasosArea: "1. Base inferior: A circulo. \n2. Pared del cilindro: area lateral cilindro. \n3. Techo: area lateral cono. \n4. Sumar las tres áreas (la unión interna NO se suma)."
    }
  },
  {
    id: "fig_002",
    nombre: "Silo Industrial",
    componentes: ["Cilindro", "Cono"],
    medidas: { radio: 6, alturaCilindro: 10, alturaCono: 8, generatrizCono: 10 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCono) / 3); },
    get area() { return (Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (Math.PI * this.medidas.radio * this.medidas.generatrizCono); },
    feedback: {
      pasosVolumen: "1. Calcular V cilindro. 2. Calcular V cono. 3. Sumar ambos.",
      pasosArea: "1. A circulo (base inferior) + area lateral cilindro + area lateral cono. No se suma el círculo central oculto."
    }
  },
  {
    id: "fig_003",
    nombre: "Torre de Grano",
    componentes: ["Cilindro", "Cono"],
    medidas: { radio: 5, alturaCilindro: 12, alturaCono: 12, generatrizCono: 13 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCono) / 3); },
    get area() { return (Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (Math.PI * this.medidas.radio * this.medidas.generatrizCono); },
    feedback: {
      pasosVolumen: "1. V cilindro + V cono.",
      pasosArea: "1. Sumar A circulo (base), area lateral cilindro y area lateral cono."
    }
  },

  // =========================================================
  // TIPO 2: CASAS (Prisma Cuadrangular + Pirámide)
  // =========================================================
  {
    id: "fig_004",
    nombre: "Casa Pequeña",
    componentes: ["Prisma Cuadrangular", "Pirámide"],
    medidas: { lado: 6, alturaPrisma: 6, alturaPiramide: 4, alturaTrianguloCara: 5 },
    get volumen() { return (Math.pow(this.medidas.lado, 2) * this.medidas.alturaPrisma) + ((Math.pow(this.medidas.lado, 2) * this.medidas.alturaPiramide) / 3); },
    get area() { return (Math.pow(this.medidas.lado, 2)) + (4 * this.medidas.lado * this.medidas.alturaPrisma) + (4 * (this.medidas.lado * this.medidas.alturaTrianguloCara) / 2); },
    feedback: {
      pasosVolumen: "1. V prisma = área base * altura. \n2. V pirámide = (área base * altura) / 3. \n3. Sumar ambos.",
      pasosArea: "1. Suelo: A rectangulo (cuadrado). \n2. Paredes: 4 veces el A rectangulo. \n3. Techo: 4 veces el A triangulo. \n4. Sumar todo (el techo del prisma está oculto)."
    }
  },
  {
    id: "fig_005",
    nombre: "Casa Mediana",
    componentes: ["Prisma Cuadrangular", "Pirámide"],
    medidas: { lado: 10, alturaPrisma: 8, alturaPiramide: 12, alturaTrianguloCara: 13 },
    get volumen() { return (Math.pow(this.medidas.lado, 2) * this.medidas.alturaPrisma) + ((Math.pow(this.medidas.lado, 2) * this.medidas.alturaPiramide) / 3); },
    get area() { return (Math.pow(this.medidas.lado, 2)) + (4 * this.medidas.lado * this.medidas.alturaPrisma) + (4 * (this.medidas.lado * this.medidas.alturaTrianguloCara) / 2); },
    feedback: {
      pasosVolumen: "1. V prisma + V pirámide.",
      pasosArea: "1. A rectangulo (base) + 4 * A rectangulo (paredes) + 4 * A triangulo (caras pirámide)."
    }
  },
  {
    id: "fig_006",
    nombre: "Mansión",
    componentes: ["Prisma Cuadrangular", "Pirámide"],
    medidas: { lado: 16, alturaPrisma: 10, alturaPiramide: 15, alturaTrianguloCara: 17 },
    get volumen() { return (Math.pow(this.medidas.lado, 2) * this.medidas.alturaPrisma) + ((Math.pow(this.medidas.lado, 2) * this.medidas.alturaPiramide) / 3); },
    get area() { return (Math.pow(this.medidas.lado, 2)) + (4 * this.medidas.lado * this.medidas.alturaPrisma) + (4 * (this.medidas.lado * this.medidas.alturaTrianguloCara) / 2); },
    feedback: {
      pasosVolumen: "1. Sumar el V del prisma y el V de la pirámide superior.",
      pasosArea: "1. A rectangulo (base) + 4 * A rectangulo (paredes) + 4 * A triangulo (techo). No sumar el área de contacto interior."
    }
  },

  // =========================================================
  // TIPO 3: OBSERVATORIOS (Cilindro + Semiesfera)
  // =========================================================
  {
    id: "fig_007",
    nombre: "Observatorio Astronómico",
    componentes: ["Cilindro", "Semiesfera"],
    medidas: { radio: 4, alturaCilindro: 5 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)); },
    get area() { return (Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (2 * Math.PI * Math.pow(this.medidas.radio, 2)); },
    feedback: {
      pasosVolumen: "1. V cilindro. \n2. V esfera dividido entre 2. \n3. Sumar ambos.",
      pasosArea: "1. Base: A circulo. \n2. Pared: area lateral cilindro. \n3. Cúpula: area esfera dividida entre 2. \n4. Sumar. (El círculo intermedio está oculto)."
    }
  },
  {
    id: "fig_008",
    nombre: "Observatorio Grande",
    componentes: ["Cilindro", "Semiesfera"],
    medidas: { radio: 6, alturaCilindro: 8 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)); },
    get area() { return (Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (2 * Math.PI * Math.pow(this.medidas.radio, 2)); },
    feedback: {
      pasosVolumen: "1. V cilindro + V semiesfera.",
      pasosArea: "1. A circulo + area lateral cilindro + (area esfera / 2)."
    }
  },
  {
    id: "fig_009",
    nombre: "Planetario",
    componentes: ["Cilindro", "Semiesfera"],
    medidas: { radio: 9, alturaCilindro: 12 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)); },
    get area() { return (Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (2 * Math.PI * Math.pow(this.medidas.radio, 2)); },
    feedback: {
      pasosVolumen: "1. V cilindro + V semiesfera.",
      pasosArea: "1. A circulo (base) + area lateral cilindro + (area esfera / 2)."
    }
  },

  // =========================================================
  // TIPO 4: TANQUES (Prisma Rectangular + Cilindro encima)
  // =========================================================
  {
    id: "fig_010",
    nombre: "Tanque Estación",
    componentes: ["Prisma Rectangular", "Cilindro"],
    medidas: { largo: 10, ancho: 8, alturaPrisma: 4, radioCilindro: 2, alturaCilindro: 5 },
    get volumen() { return (this.medidas.largo * this.medidas.ancho * this.medidas.alturaPrisma) + (Math.PI * Math.pow(this.medidas.radioCilindro, 2) * this.medidas.alturaCilindro); },
    get area() { 
      // Área de un prisma rectangular completo + área lateral del cilindro. (Los círculos de contacto y tapa se cancelan matemáticamente).
      return (2 * (this.medidas.largo * this.medidas.ancho + this.medidas.largo * this.medidas.alturaPrisma + this.medidas.ancho * this.medidas.alturaPrisma)) + (2 * Math.PI * this.medidas.radioCilindro * this.medidas.alturaCilindro); 
    },
    feedback: {
      pasosVolumen: "1. V prisma = largo * ancho * alto. \n2. V cilindro. \n3. Sumar ambos.",
      pasosArea: "1. Caras del prisma: Sumar el A rectangulo de sus 6 caras. \n2. Restar el A circulo donde se apoya el cilindro. \n3. Del cilindro: area lateral cilindro y el A circulo de la tapa superior. \n4. Nota: Al sumar la tapa y restar el apoyo, matemáticamente es igual al área total del prisma + area lateral cilindro."
    }
  },
  {
    id: "fig_011",
    nombre: "Estación de Bombeo",
    componentes: ["Prisma Rectangular", "Cilindro"],
    medidas: { largo: 12, ancho: 10, alturaPrisma: 5, radioCilindro: 3, alturaCilindro: 6 },
    get volumen() { return (this.medidas.largo * this.medidas.ancho * this.medidas.alturaPrisma) + (Math.PI * Math.pow(this.medidas.radioCilindro, 2) * this.medidas.alturaCilindro); },
    get area() { return (2 * (this.medidas.largo * this.medidas.ancho + this.medidas.largo * this.medidas.alturaPrisma + this.medidas.ancho * this.medidas.alturaPrisma)) + (2 * Math.PI * this.medidas.radioCilindro * this.medidas.alturaCilindro); },
    feedback: {
      pasosVolumen: "1. V prisma + V cilindro.",
      pasosArea: "1. Sumar los A rectangulo de las caras exteriores + area lateral cilindro + A circulo (tapa). Restar A circulo interno."
    }
  },
  {
    id: "fig_012",
    nombre: "Planta Purificadora",
    componentes: ["Prisma Rectangular", "Cilindro"],
    medidas: { largo: 15, ancho: 15, alturaPrisma: 6, radioCilindro: 5, alturaCilindro: 10 },
    get volumen() { return (this.medidas.largo * this.medidas.ancho * this.medidas.alturaPrisma) + (Math.PI * Math.pow(this.medidas.radioCilindro, 2) * this.medidas.alturaCilindro); },
    get area() { return (2 * (this.medidas.largo * this.medidas.ancho + this.medidas.largo * this.medidas.alturaPrisma + this.medidas.ancho * this.medidas.alturaPrisma)) + (2 * Math.PI * this.medidas.radioCilindro * this.medidas.alturaCilindro); },
    feedback: {
      pasosVolumen: "1. V prisma + V cilindro.",
      pasosArea: "1. Áreas expuestas del prisma (A rectangulo) + area lateral cilindro + A circulo superior."
    }
  },

  // =========================================================
  // TIPO 5: BIPIRÁMIDES CÓNICAS (Cono + Cono unidos por la base)
  // =========================================================
  {
    id: "fig_013",
    nombre: "Peonza Geométrica",
    componentes: ["Cono", "Cono"],
    medidas: { radio: 3, alturaConos: 4, generatriz: 5 },
    get volumen() { return 2 * ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaConos) / 3); },
    get area() { return 2 * (Math.PI * this.medidas.radio * this.medidas.generatriz); },
    feedback: {
      pasosVolumen: "1. V cono = (A circulo * altura) / 3. \n2. Al ser simétrica, multiplicar por 2.",
      pasosArea: "1. area lateral cono superior. \n2. area lateral cono inferior. \n3. Sumar ambas. (Las bases A circulo están totalmente ocultas)."
    }
  },
  {
    id: "fig_014",
    nombre: "Boya Cónica",
    componentes: ["Cono", "Cono"],
    medidas: { radio: 5, alturaConos: 12, generatriz: 13 },
    get volumen() { return 2 * ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaConos) / 3); },
    get area() { return 2 * (Math.PI * this.medidas.radio * this.medidas.generatriz); },
    feedback: {
      pasosVolumen: "1. 2 * V cono.",
      pasosArea: "1. 2 * area lateral cono. Círculos ocultos."
    }
  },
  {
    id: "fig_015",
    nombre: "Péndulo Doble",
    componentes: ["Cono", "Cono"],
    medidas: { radio: 8, alturaConos: 15, generatriz: 17 },
    get volumen() { return 2 * ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaConos) / 3); },
    get area() { return 2 * (Math.PI * this.medidas.radio * this.medidas.generatriz); },
    feedback: {
      pasosVolumen: "1. 2 * V cono.",
      pasosArea: "1. 2 * area lateral cono."
    }
  },

  // =========================================================
  // TIPO 6: LÁPICES (Semiesfera + Cilindro + Cono)
  // =========================================================
  {
    id: "fig_016",
    nombre: "Lápiz Estándar",
    componentes: ["Semiesfera", "Cilindro", "Cono"],
    medidas: { radio: 3, alturaCilindro: 10, alturaCono: 4, generatrizCono: 5 },
    get volumen() { return ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)) + (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCono) / 3); },
    get area() { return (2 * Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (Math.PI * this.medidas.radio * this.medidas.generatrizCono); },
    feedback: {
      pasosVolumen: "1. V semiesfera + V cilindro + V cono.",
      pasosArea: "1. Base redonda: area esfera / 2. \n2. Cuerpo: area lateral cilindro. \n3. Punta: area lateral cono. \n4. Ningún A circulo interno se suma."
    }
  },
  {
    id: "fig_017",
    nombre: "Lápiz Gigante",
    componentes: ["Semiesfera", "Cilindro", "Cono"],
    medidas: { radio: 5, alturaCilindro: 15, alturaCono: 12, generatrizCono: 13 },
    get volumen() { return ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)) + (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCono) / 3); },
    get area() { return (2 * Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (Math.PI * this.medidas.radio * this.medidas.generatrizCono); },
    feedback: {
      pasosVolumen: "1. Sumar volúmenes de semiesfera, cilindro y cono.",
      pasosArea: "1. (area esfera / 2) + area lateral cilindro + area lateral cono."
    }
  },
  {
    id: "fig_018",
    nombre: "Misil Decorativo",
    componentes: ["Semiesfera", "Cilindro", "Cono"],
    medidas: { radio: 6, alturaCilindro: 20, alturaCono: 8, generatrizCono: 10 },
    get volumen() { return ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)) + (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCono) / 3); },
    get area() { return (2 * Math.PI * Math.pow(this.medidas.radio, 2)) + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (Math.PI * this.medidas.radio * this.medidas.generatrizCono); },
    feedback: {
      pasosVolumen: "1. V semiesfera + V cilindro + V cono.",
      pasosArea: "1. Sumar mitad de area esfera, area lateral cilindro y area lateral cono."
    }
  },

  // =========================================================
  // TIPO 7: CABAÑAS (Prisma Rectangular + Prisma Triangular)
  // =========================================================
  {
    id: "fig_019",
    nombre: "Cabaña de Campaña",
    componentes: ["Prisma Rectangular", "Prisma Triangular"],
    medidas: { largo: 10, ancho: 6, alturaPrisma: 5, alturaTriangulo: 4, hipotenusaTecho: 5 },
    get volumen() { return (this.medidas.largo * this.medidas.ancho * this.medidas.alturaPrisma) + (((this.medidas.ancho * this.medidas.alturaTriangulo) / 2) * this.medidas.largo); },
    get area() { 
      let suelo = this.medidas.largo * this.medidas.ancho;
      let paredesLaterales = 2 * (this.medidas.largo * this.medidas.alturaPrisma);
      let paredesFrontales = 2 * (this.medidas.ancho * this.medidas.alturaPrisma);
      let techosInclinados = 2 * (this.medidas.largo * this.medidas.hipotenusaTecho);
      let triangulosTecho = 2 * ((this.medidas.ancho * this.medidas.alturaTriangulo) / 2);
      return suelo + paredesLaterales + paredesFrontales + techosInclinados + triangulosTecho;
    },
    feedback: {
      pasosVolumen: "1. V prisma rectangular (base). \n2. V prisma triangular (techo). \n3. Sumar ambos.",
      pasosArea: "1. A rectangulo (suelo y 4 paredes). \n2. A rectangulo (2 paneles del techo inclinado). \n3. A triangulo (2 frontones del techo). \n4. Sumar las partes externas."
    }
  },
  {
    id: "fig_020",
    nombre: "Refugio",
    componentes: ["Prisma Rectangular", "Prisma Triangular"],
    medidas: { largo: 15, ancho: 10, alturaPrisma: 8, alturaTriangulo: 12, hipotenusaTecho: 13 },
    get volumen() { return (this.medidas.largo * this.medidas.ancho * this.medidas.alturaPrisma) + (((this.medidas.ancho * this.medidas.alturaTriangulo) / 2) * this.medidas.largo); },
    get area() { 
      return (this.medidas.largo * this.medidas.ancho) + (2 * this.medidas.largo * this.medidas.alturaPrisma) + (2 * this.medidas.ancho * this.medidas.alturaPrisma) + (2 * this.medidas.largo * this.medidas.hipotenusaTecho) + (this.medidas.ancho * this.medidas.alturaTriangulo);
    },
    feedback: {
      pasosVolumen: "1. V prisma base + V prisma triangular techo.",
      pasosArea: "1. Sumar los A rectangulo expuestos y los 2 A triangulo frontales del techo."
    }
  },
  {
    id: "fig_021",
    nombre: "Nave Industrial",
    componentes: ["Prisma Rectangular", "Prisma Triangular"],
    medidas: { largo: 20, ancho: 16, alturaPrisma: 10, alturaTriangulo: 15, hipotenusaTecho: 17 },
    get volumen() { return (this.medidas.largo * this.medidas.ancho * this.medidas.alturaPrisma) + (((this.medidas.ancho * this.medidas.alturaTriangulo) / 2) * this.medidas.largo); },
    get area() { 
      return (this.medidas.largo * this.medidas.ancho) + (2 * this.medidas.largo * this.medidas.alturaPrisma) + (2 * this.medidas.ancho * this.medidas.alturaPrisma) + (2 * this.medidas.largo * this.medidas.hipotenusaTecho) + (this.medidas.ancho * this.medidas.alturaTriangulo);
    },
    feedback: {
      pasosVolumen: "1. V base rectangular + V techo triangular.",
      pasosArea: "1. Suelo, 4 paredes y 2 techos inclinados (A rectangulo) + 2 caras frontales (A triangulo)."
    }
  },

  // =========================================================
  // TIPO 8: TORRES COMPLEJAS (Prisma Cuad. + Cilindro + Semiesfera)
  // =========================================================
  {
    id: "fig_022",
    nombre: "Torre Castillo",
    componentes: ["Prisma Cuadrangular", "Cilindro", "Semiesfera"],
    medidas: { ladoPrisma: 8, alturaPrisma: 6, radio: 3, alturaCilindro: 5 },
    get volumen() { return (Math.pow(this.medidas.ladoPrisma, 2) * this.medidas.alturaPrisma) + (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)); },
    get area() { 
      let baseTorre = 2 * Math.pow(this.medidas.ladoPrisma, 2) + 4 * (this.medidas.ladoPrisma * this.medidas.alturaPrisma);
      let areaExpuestaTorre = baseTorre - (Math.PI * Math.pow(this.medidas.radio, 2));
      let areaLatCilindro = 2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro;
      let areaSemiesfera = 2 * Math.PI * Math.pow(this.medidas.radio, 2);
      return areaExpuestaTorre + areaLatCilindro + areaSemiesfera;
    },
    feedback: {
      pasosVolumen: "1. V prisma + V cilindro + V semiesfera.",
      pasosArea: "1. Base: A rectangulo de sus caras. \n2. Al A rectangulo de la cara superior, restamos el A circulo del cilindro. \n3. Cuerpo: area lateral cilindro. \n4. Cúpula: area esfera / 2."
    }
  },
  {
    id: "fig_023",
    nombre: "Faro Geométrico",
    componentes: ["Prisma Cuadrangular", "Cilindro", "Semiesfera"],
    medidas: { ladoPrisma: 12, alturaPrisma: 8, radio: 4, alturaCilindro: 6 },
    get volumen() { return (Math.pow(this.medidas.ladoPrisma, 2) * this.medidas.alturaPrisma) + (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)); },
    get area() { 
      let baseTorre = 2 * Math.pow(this.medidas.ladoPrisma, 2) + 4 * (this.medidas.ladoPrisma * this.medidas.alturaPrisma);
      let areaExpuestaTorre = baseTorre - (Math.PI * Math.pow(this.medidas.radio, 2));
      return areaExpuestaTorre + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (2 * Math.PI * Math.pow(this.medidas.radio, 2));
    },
    feedback: {
      pasosVolumen: "1. V prisma + V cilindro + V semiesfera.",
      pasosArea: "1. A rectangulo prisma (restando apoyo A circulo) + area lateral cilindro + mitad de area esfera."
    }
  },
  {
    id: "fig_024",
    nombre: "Antena Base",
    componentes: ["Prisma Cuadrangular", "Cilindro", "Semiesfera"],
    medidas: { ladoPrisma: 15, alturaPrisma: 10, radio: 5, alturaCilindro: 8 },
    get volumen() { return (Math.pow(this.medidas.ladoPrisma, 2) * this.medidas.alturaPrisma) + (Math.PI * Math.pow(this.medidas.radio, 2) * this.medidas.alturaCilindro) + ((2/3) * Math.PI * Math.pow(this.medidas.radio, 3)); },
    get area() { 
      let baseTorre = 2 * Math.pow(this.medidas.ladoPrisma, 2) + 4 * (this.medidas.ladoPrisma * this.medidas.alturaPrisma);
      let areaExpuestaTorre = baseTorre - (Math.PI * Math.pow(this.medidas.radio, 2));
      return areaExpuestaTorre + (2 * Math.PI * this.medidas.radio * this.medidas.alturaCilindro) + (2 * Math.PI * Math.pow(this.medidas.radio, 2));
    },
    feedback: {
      pasosVolumen: "1. Sumar V prisma, cilindro y semiesfera.",
      pasosArea: "1. Sumar caras externas (A rectangulo, area lateral cilindro, area esfera / 2). Descontar apoyo interno."
    }
  },

  // =========================================================
  // TIPO 9: PASTELES (Cilindro mayor + Cilindro menor)
  // =========================================================
  {
    id: "fig_025",
    nombre: "Pastel 2 Pisos Estándar",
    componentes: ["Cilindro", "Cilindro"],
    medidas: { radioMayor: 6, alturaMayor: 4, radioMenor: 4, alturaMenor: 4 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radioMayor, 2) * this.medidas.alturaMayor) + (Math.PI * Math.pow(this.medidas.radioMenor, 2) * this.medidas.alturaMenor); },
    get area() { 
      // Matemáticamente: Las tapas se complementan. Área total = 2 * BaseMayor + LatMayor + LatMenor.
      return (2 * Math.PI * Math.pow(this.medidas.radioMayor, 2)) + (2 * Math.PI * this.medidas.radioMayor * this.medidas.alturaMayor) + (2 * Math.PI * this.medidas.radioMenor * this.medidas.alturaMenor);
    },
    feedback: {
      pasosVolumen: "1. V cilindro grande + V cilindro pequeño.",
      pasosArea: "1. Base inferior: A circulo mayor. \n2. area lateral cilindro grande. \n3. Corona expuesta: A circulo mayor menos A circulo menor. \n4. area lateral cilindro menor. \n5. Tapa superior: A circulo menor. \n6. Al sumar, equivale a: 2*(A circulo mayor) + áreas laterales."
    }
  },
  {
    id: "fig_026",
    nombre: "Pastel Nupcial",
    componentes: ["Cilindro", "Cilindro"],
    medidas: { radioMayor: 10, alturaMayor: 5, radioMenor: 6, alturaMenor: 5 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radioMayor, 2) * this.medidas.alturaMayor) + (Math.PI * Math.pow(this.medidas.radioMenor, 2) * this.medidas.alturaMenor); },
    get area() { return (2 * Math.PI * Math.pow(this.medidas.radioMayor, 2)) + (2 * Math.PI * this.medidas.radioMayor * this.medidas.alturaMayor) + (2 * Math.PI * this.medidas.radioMenor * this.medidas.alturaMenor); },
    feedback: {
      pasosVolumen: "1. Sumar los 2 V cilindro.",
      pasosArea: "1. Calcular A circulo inferiores y superiores (descontando uniones) + ambos area lateral cilindro."
    }
  },
  {
    id: "fig_027",
    nombre: "Podio Circular",
    componentes: ["Cilindro", "Cilindro"],
    medidas: { radioMayor: 8, alturaMayor: 6, radioMenor: 5, alturaMenor: 6 },
    get volumen() { return (Math.PI * Math.pow(this.medidas.radioMayor, 2) * this.medidas.alturaMayor) + (Math.PI * Math.pow(this.medidas.radioMenor, 2) * this.medidas.alturaMenor); },
    get area() { return (2 * Math.PI * Math.pow(this.medidas.radioMayor, 2)) + (2 * Math.PI * this.medidas.radioMayor * this.medidas.alturaMayor) + (2 * Math.PI * this.medidas.radioMenor * this.medidas.alturaMenor); },
    feedback: {
      pasosVolumen: "1. Sumar los 2 V cilindro.",
      pasosArea: "1. Sumar partes externas usando A circulo y area lateral cilindro."
    }
  },

  // =========================================================
  // TIPO 10: PEDESTALES (Prisma Rect. grande + Prisma Rect. pequeño)
  // =========================================================
  {
    id: "fig_028",
    nombre: "Pedestal Museo",
    componentes: ["Prisma Rectangular", "Prisma Rectangular"],
    medidas: { l1: 10, w1: 10, h1: 2, l2: 6, w2: 6, h2: 4 },
    get volumen() { return (this.medidas.l1 * this.medidas.w1 * this.medidas.h1) + (this.medidas.l2 * this.medidas.w2 * this.medidas.h2); },
    get area() { 
      return (2 * (this.medidas.l1 * this.medidas.w1)) + (2 * this.medidas.l1 * this.medidas.h1) + (2 * this.medidas.w1 * this.medidas.h1) + (2 * this.medidas.l2 * this.medidas.h2) + (2 * this.medidas.w2 * this.medidas.h2); 
    },
    feedback: {
      pasosVolumen: "1. V prisma base + V prisma superior.",
      pasosArea: "1. Caras del prisma mayor (A rectangulo). \n2. Escalón superior: A rectangulo mayor menos A rectangulo menor. \n3. Caras y tapa del prisma superior (A rectangulo). \n4. Sumar todo."
    }
  },
  {
    id: "fig_029",
    nombre: "Monumento Escalonado",
    componentes: ["Prisma Rectangular", "Prisma Rectangular"],
    medidas: { l1: 12, w1: 12, h1: 3, l2: 8, w2: 8, h2: 6 },
    get volumen() { return (this.medidas.l1 * this.medidas.w1 * this.medidas.h1) + (this.medidas.l2 * this.medidas.w2 * this.medidas.h2); },
    get area() { return (2 * (this.medidas.l1 * this.medidas.w1)) + (2 * this.medidas.l1 * this.medidas.h1) + (2 * this.medidas.w1 * this.medidas.h1) + (2 * this.medidas.l2 * this.medidas.h2) + (2 * this.medidas.w2 * this.medidas.h2); },
    feedback: {
      pasosVolumen: "1. Sumar los 2 V prisma.",
      pasosArea: "1. Sumar todos los A rectangulo externos descontando el área de contacto interna."
    }
  },
  {
    id: "fig_030",
    nombre: "Base Trofeo",
    componentes: ["Prisma Rectangular", "Prisma Rectangular"],
    medidas: { l1: 8, w1: 8, h1: 2, l2: 4, w2: 4, h2: 5 },
    get volumen() { return (this.medidas.l1 * this.medidas.w1 * this.medidas.h1) + (this.medidas.l2 * this.medidas.w2 * this.medidas.h2); },
    get area() { return (2 * (this.medidas.l1 * this.medidas.w1)) + (2 * this.medidas.l1 * this.medidas.h1) + (2 * this.medidas.w1 * this.medidas.h1) + (2 * this.medidas.l2 * this.medidas.h2) + (2 * this.medidas.w2 * this.medidas.h2); },
    feedback: {
      pasosVolumen: "1. Sumar los 2 V prisma.",
      pasosArea: "1. Sumar las áreas exteriores (A rectangulo). Las superficies de contacto internas se omiten."
    }
  }
];

// =========================================================
// FUNCIÓN INTEGRADORA PARA TU APLICACIÓN
// =========================================================

/**
 * Valida la respuesta del usuario y devuelve el feedback.
 * @param {string} id - ID de la figura.
 * @param {number} respuestaVolumen - Volumen introducido por el estudiante.
 * @param {number} respuestaArea - Área introducida por el estudiante.
 * @param {number} tolerancia - Margen de error para redondeos (ej: 0.1).
 * @returns {object} - Contiene estado (verde/rojo) y los pasos.
 */
function corregirFigura(id, respuestaVolumen, respuestaArea, tolerancia = 0.5) {
  const figura = bibliotecaGeometria.find(f => f.id === id);
  if (!figura) return { error: "Figura no encontrada" };

  const volumenCorrecto = figura.volumen;
  const areaCorrecta = figura.area;

  const volEsCorrecto = Math.abs(respuestaVolumen - volumenCorrecto) <= tolerancia;
  const areaEsCorrecta = Math.abs(respuestaArea - areaCorrecta) <= tolerancia;

  return {
    volumen: {
      valorEsperado: volumenCorrecto.toFixed(2),
      correcto: volEsCorrecto,
      color: volEsCorrecto ? "verde" : "rojo",
      pasos: figura.feedback.pasosVolumen
    },
    area: {
      valorEsperado: areaCorrecta.toFixed(2),
      correcto: areaEsCorrecta,
      color: areaEsCorrecta ? "verde" : "rojo",
      pasos: figura.feedback.pasosArea
    }
  };
}

// Exportamos si se usa en un entorno de módulos (opcional)
export { bibliotecaGeometria, corregirFigura };