// ─────────────────────────────────────────────────────────────────────────────
//  Preguntas por materia y NIVEL de Plataformas (Pikatron 2). { label, emoji, color, niveles: [[{ q, a, inc[3] }]] }.
//  Extraído de Plataformas2.jsx (que lo importa con el mismo nombre local) para
//  usarlo también en las «Preguntas de PiKT» de todos los juegos (bancoPreguntas/recursosPikt.js).
// ─────────────────────────────────────────────────────────────────────────────

export const MATERIAS_PLATAFORMAS = {
  INGLES: {
    label:'Inglés', emoji:'🇬🇧', color:'#0057a8',
    niveles: [
      [
        { q:'¿"Perro" en inglés?',   a:'Dog',    inc:['Cat','Bird','Cow']    },
        { q:'¿"Gato" en inglés?',    a:'Cat',    inc:['Dog','Mouse','Lion']  },
        { q:'¿"Rojo" en inglés?',    a:'Red',    inc:['Blue','Green','Yellow']},
        { q:'¿"Pájaro" en inglés?',  a:'Bird',   inc:['Fish','Snake','Horse']},
        { q:'¿"Azul" en inglés?',    a:'Blue',   inc:['Black','White','Red'] },
      ],
      [
        { q:'¿"Manzana" en inglés?', a:'Apple',  inc:['Banana','Orange','Grape']},
        { q:'¿"Pan" en inglés?',     a:'Bread',  inc:['Meat','Water','Milk']    },
        { q:'¿"Leche" en inglés?',   a:'Milk',   inc:['Juice','Coffee','Tea']   },
        { q:'¿"Queso" en inglés?',   a:'Cheese', inc:['Butter','Egg','Rice']    },
        { q:'¿"Agua" en inglés?',    a:'Water',  inc:['Wine','Beer','Soda']     },
      ],
      [
        { q:'¿"Madre" en inglés?',   a:'Mother',      inc:['Father','Sister','Aunt']  },
        { q:'¿"Hermano" en inglés?', a:'Brother',     inc:['Sister','Uncle','Cousin'] },
        { q:'¿"Abuelo" en inglés?',  a:'Grandfather', inc:['Uncle','Father','Son']    },
        { q:'¿"Hija" en inglés?',    a:'Daughter',    inc:['Son','Niece','Aunt']      },
        { q:'¿"Tío" en inglés?',     a:'Uncle',       inc:['Aunt','Brother','Cousin'] },
      ],
      [
        { q:'¿"Comer" en inglés?',  a:'Eat',   inc:['Drink','Sleep','Run']    },
        { q:'¿"Jugar" en inglés?',  a:'Play',  inc:['Work','Study','Read']    },
        { q:'¿"Leer" en inglés?',   a:'Read',  inc:['Write','Listen','Speak'] },
        { q:'¿"Correr" en inglés?', a:'Run',   inc:['Walk','Jump','Sit']      },
        { q:'¿"Dormir" en inglés?', a:'Sleep', inc:['Wake','Dream','Rest']    },
      ],
    ],
  },
  MATES: {
    label:'Mates', emoji:'🔢', color:'#e67e22',
    niveles: [
      [
        { q:'7 + 5 = ?',      a:'12', inc:['11','13','10'] },
        { q:'15 + 8 = ?',     a:'23', inc:['22','24','25'] },
        { q:'9 + 9 = ?',      a:'18', inc:['16','17','19'] },
        { q:'20 + 15 = ?',    a:'35', inc:['30','40','25'] },
        { q:'14 + 7 = ?',     a:'21', inc:['20','22','19'] },
      ],
      [
        { q:'15 − 6 = ?',     a:'9',  inc:['8','10','7']   },
        { q:'20 − 12 = ?',    a:'8',  inc:['7','9','6']    },
        { q:'50 − 25 = ?',    a:'25', inc:['20','30','15'] },
        { q:'34 − 10 = ?',    a:'24', inc:['23','25','26'] },
        { q:'100 − 45 = ?',   a:'55', inc:['65','45','50'] },
      ],
      [
        { q:'6 × 7 = ?',      a:'42', inc:['48','36','49'] },
        { q:'8 × 5 = ?',      a:'40', inc:['45','35','50'] },
        { q:'9 × 9 = ?',      a:'81', inc:['72','90','80'] },
        { q:'4 × 12 = ?',     a:'48', inc:['44','46','52'] },
        { q:'7 × 8 = ?',      a:'56', inc:['64','48','54'] },
      ],
      [
        { q:'45 ÷ 5 = ?',     a:'9',  inc:['8','10','7']   },
        { q:'100 ÷ 10 = ?',   a:'10', inc:['100','1','0']  },
        { q:'36 ÷ 6 = ?',     a:'6',  inc:['5','7','8']    },
        { q:'2+3×4 = ?',      a:'14', inc:['20','24','10'] },
        { q:'20÷4+1 = ?',     a:'6',  inc:['5','4','7']    },
      ],
    ],
  },
  FRANCES: {
    label:'Francés', emoji:'🇫🇷', color:'#8e44ad',
    niveles: [
      [
        { q:'"Hola" en francés',       a:'Bonjour',         inc:['Au revoir','Merci','Oui']       },
        { q:'"Gracias" en francés',    a:'Merci',           inc:["S'il vous plaît",'Pardon','Non'] },
        { q:'"Adiós" en francés',      a:'Au revoir',       inc:['Salut','À demain','Bonjour']     },
        { q:'"Sí" en francés',         a:'Oui',             inc:['Non','Peut-être','Bien']          },
        { q:'"Por favor" en francés',  a:"S'il vous plaît", inc:['Merci','De rien','Pardon']        },
      ],
      [
        { q:'"Perro" en francés',  a:'Chien',   inc:['Chat','Oiseau','Cheval']   },
        { q:'"Gato" en francés',   a:'Chat',    inc:['Souris','Lapin','Chien']   },
        { q:'"Casa" en francés',   a:'Maison',  inc:['Voiture','École','Rue']    },
        { q:'"Coche" en francés',  a:'Voiture', inc:['Vélo','Train','Avion']     },
        { q:'"Libro" en francés',  a:'Livre',   inc:['Cahier','Stylo','Crayon']  },
      ],
      [
        { q:'"Madre" en francés',  a:'Mère',   inc:['Père','Soeur','Fille']   },
        { q:'"Padre" en francés',  a:'Père',   inc:['Frère','Fils','Mère']    },
        { q:'"Niño" en francés',   a:'Garçon', inc:['Fille','Homme','Femme']  },
        { q:'"Niña" en francés',   a:'Fille',  inc:['Garçon','Femme','Mère']  },
        { q:'"Amigo" en francés',  a:'Ami',    inc:['Ennemi','Frère','Père']   },
      ],
      [
        { q:'"Rojo" en francés',  a:'Rouge', inc:['Bleu','Vert','Jaune']       },
        { q:'"Negro" en francés', a:'Noir',  inc:['Blanc','Gris','Marron']      },
        { q:'"Uno" en francés',   a:'Un',    inc:['Deux','Trois','Quatre']      },
        { q:'"Cinco" en francés', a:'Cinq',  inc:['Six','Sept','Huit']          },
        { q:'"Diez" en francés',  a:'Dix',   inc:['Neuf','Onze','Douze']        },
      ],
    ],
  },
  GEOGRAFIA: {
    label:'Geografía', emoji:'🌍', color:'#27ae60',
    niveles: [
      [
        { q:'Capital de Francia',     a:'París',   inc:['Lyon','Marsella','Burdeos']      },
        { q:'Capital de Italia',       a:'Roma',    inc:['Milán','Venecia','Nápoles']      },
        { q:'Capital de Alemania',     a:'Berlín',  inc:['Múnich','Hamburgo','Frankfurt']  },
        { q:'Capital de R. Unido',     a:'Londres', inc:['Manchester','Liverpool','Edimburgo'] },
        { q:'Capital de Portugal',     a:'Lisboa',  inc:['Oporto','Faro','Coímbra']        },
      ],
      [
        { q:'Río más largo',           a:'Amazonas', inc:['Nilo','Yangtsé','Misisipi']    },
        { q:'Montaña más alta',        a:'Everest',  inc:['K2','Mont Blanc','Teide']      },
        { q:'Río de Egipto',           a:'Nilo',     inc:['Congo','Níger','Zambeze']      },
        { q:'Cord. de Sudamérica',     a:'Andes',    inc:['Himalaya','Alpes','Pirineos']  },
        { q:'Río de París',            a:'Sena',     inc:['Ródano','Loira','Rin']          },
      ],
      [
        { q:'País con forma de bota',  a:'Italia',    inc:['Grecia','México','Chile']      },
        { q:'País más grande',         a:'Rusia',     inc:['Canadá','China','EEUU']         },
        { q:'País de los canguros',    a:'Australia', inc:['N.Zelanda','Sudáfrica','Brasil']},
        { q:'País del Taj Mahal',      a:'India',     inc:['Pakistán','Turquía','Egipto']   },
        { q:'País del Monte Fuji',     a:'Japón',     inc:['Corea del Sur','China','Vietnam']},
      ],
      [
        { q:'Océano más grande',       a:'Pacífico',  inc:['Atlántico','Índico','Ártico']   },
        { q:'Continente más poblado',  a:'Asia',      inc:['África','Europa','América']      },
        { q:'Océano Europa-América',   a:'Atlántico', inc:['Pacífico','Índico','Antártico']  },
        { q:'Continente del Sahara',   a:'África',    inc:['Asia','Oceanía','Europa']        },
        { q:'País más poblado',        a:'India',     inc:['China','EEUU','Indonesia']       },
      ],
    ],
  },
};
