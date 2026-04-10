// BibliotecaVideoQuizz.js — Recursos VideoQuizz de ejemplo
// Cada ejercicio tiene un campo `tiempo` (segundos) que indica
// el momento del vídeo en que debe aparecer la pregunta.

export const BIBLIOTECA_VQ = [

  // ──────────────────────────────────────────────────────────────────
  // VQ1 — Passive Voice  (3 ESO · English)
  // Vídeo: "The Passive: When, why, and how to use it" — engVid
  // https://www.youtube.com/watch?v=C6pHfjH0Efg  (~10 min)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'vq001',
    titulo: 'Passive Voice – Video Lesson',
    nivel: '3 ESO',
    asignatura: 'English',
    tema: 'Grammar',
    color: '#6D28D9',
    descripcion: 'Watch the lesson and answer questions about active vs passive voice at key moments.',
    tags: ['passive', 'grammar', 'present simple', 'past simple', 'video'],
    youtubeUrl: 'https://www.youtube.com/watch?v=C6pHfjH0Efg',
    isFinished: true,
    soloUnIntento: false,
    ejercicios: [
      {
        id: 'vqex01a', tipo: 'truefalse',
        titulo: 'Active vs Passive – basics',
        enunciado: 'After the introduction: decide if each statement is true or false.',
        tiempo: 90,   // 1:30 – tras explicación inicial
        items: [
          { id: 1, lbl: '1.', statement: 'In a passive sentence the subject receives the action of the verb.', ans: 'true' },
          { id: 2, lbl: '2.', statement: 'The passive is formed with "be" + the base form of the verb.', ans: 'false' },
          { id: 3, lbl: '3.', statement: 'We use the passive when the agent (who does the action) is unknown or unimportant.', ans: 'true' },
          { id: 4, lbl: '4.', statement: 'Active: "The cake was eaten by Tom." — Passive: "Tom ate the cake."', ans: 'false' },
        ]
      },
      {
        id: 'vqex01b', tipo: 'choice',
        titulo: 'Identify the passive',
        enunciado: 'Choose the sentence that is in the passive voice.',
        tiempo: 240,  // 4:00 – tras ejemplos de Present Simple Passive
        items: [
          { id: 1, lbl: '1.', parts: ['', ''], opts: ['The students study every day.', 'English is taught in this school.'], ans: 'English is taught in this school.' },
          { id: 2, lbl: '2.', parts: ['', ''], opts: ['The chef cooks the meal.', 'The meal is cooked by the chef.'], ans: 'The meal is cooked by the chef.' },
          { id: 3, lbl: '3.', parts: ['', ''], opts: ['Cars are made in Japan.', 'Japan makes many cars.'], ans: 'Cars are made in Japan.' },
          { id: 4, lbl: '4.', parts: ['', ''], opts: ['Somebody stole my bag.', 'My bag was stolen.'], ans: 'My bag was stolen.' },
        ]
      },
      {
        id: 'vqex01c', tipo: 'fill',
        titulo: 'Complete – Present Simple Passive',
        enunciado: 'Complete each sentence with the correct Present Simple Passive form.',
        tiempo: 390,  // 6:30 – tras sección Present Passive
        items: [
          { id: 1, lbl: '1.', parts: ['English ', ' all over the world.'], hint: '(speak)', ans: ['is spoken'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['The letters ', ' every morning.'], hint: '(deliver)', ans: ['are delivered'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['This car ', ' in Germany.'], hint: '(manufacture)', ans: ['is manufactured'], alts: [['is made']] },
          { id: 4, lbl: '4.', parts: ['The windows ', ' twice a year.'], hint: '(clean)', ans: ['are cleaned'], alts: [[]] },
        ]
      },
      {
        id: 'vqex01d', tipo: 'fill',
        titulo: 'Complete – Past Simple Passive',
        enunciado: 'Complete with the correct Past Simple Passive form.',
        tiempo: 555,  // 9:15 – tras sección Past Passive
        items: [
          { id: 1, lbl: '1.', parts: ['The Eiffel Tower ', ' in 1889.'], hint: '(build)', ans: ['was built'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['Several people ', ' to the awards ceremony.'], hint: '(not invite)', ans: ["weren't invited"], alts: [['were not invited']] },
          { id: 3, lbl: '3.', parts: ['The letters ', ' yesterday.'], hint: '(not send)', ans: ["weren't sent"], alts: [['were not sent']] },
          { id: 4, lbl: '4.', parts: ['The painting ', ' by Picasso.'], hint: '(paint)', ans: ['was painted'], alts: [[]] },
        ]
      },
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // VQ2 — Present Perfect  (3 ESO · English)
  // Vídeo: "The Present Perfect Tense | English Grammar Lesson"
  // https://www.youtube.com/watch?v=XGw2-p2WuJk  (~9 min)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'vq002',
    titulo: 'Present Perfect – Video Lesson',
    nivel: '3 ESO',
    asignatura: 'English',
    tema: 'Grammar',
    color: '#1D4ED8',
    descripcion: 'Watch the explanation and practise the Present Perfect tense at key moments.',
    tags: ['present perfect', 'past simple', 'grammar', 'tenses', 'video'],
    youtubeUrl: 'https://www.youtube.com/watch?v=XGw2-p2WuJk',
    isFinished: true,
    soloUnIntento: false,
    ejercicios: [
      {
        id: 'vqex02a', tipo: 'truefalse',
        titulo: 'Formation – True or False?',
        enunciado: 'After the introduction: decide if each statement about the Present Perfect is true or false.',
        tiempo: 80,   // 1:20
        items: [
          { id: 1, lbl: '1.', statement: 'The Present Perfect is formed with HAVE/HAS + past participle.', ans: 'true' },
          { id: 2, lbl: '2.', statement: 'We use "has" with I, you, we, they.', ans: 'false' },
          { id: 3, lbl: '3.', statement: 'The verb "go" has the past participle "gone".', ans: 'true' },
          { id: 4, lbl: '4.', statement: 'The Present Perfect is used to talk about a finished action with a specific past time.', ans: 'false' },
        ]
      },
      {
        id: 'vqex02b', tipo: 'choice',
        titulo: 'Present Perfect or Past Simple?',
        enunciado: 'Choose the correct tense for each sentence.',
        tiempo: 240,  // 4:00
        items: [
          { id: 1, lbl: '1.', parts: ['I ', ' that film last night.'], opts: ['have seen', 'saw'], ans: 'saw' },
          { id: 2, lbl: '2.', parts: ['She ', ' here since 2019.'], opts: ['has lived', 'lived'], ans: 'has lived' },
          { id: 3, lbl: '3.', parts: ['We ', ' the project yesterday.'], opts: ['have finished', 'finished'], ans: 'finished' },
          { id: 4, lbl: '4.', parts: ['They ', ' to Australia three times.'], opts: ['have been', 'were'], ans: 'have been' },
          { id: 5, lbl: '5.', parts: ['He ', ' his keys. He cannot find them!'], opts: ['has lost', 'lost'], ans: 'has lost' },
        ]
      },
      {
        id: 'vqex02c', tipo: 'fill',
        titulo: 'already, just, yet, ever, never',
        enunciado: 'Complete with the correct adverb: already, just, yet, ever or never.',
        tiempo: 380,  // 6:20
        items: [
          { id: 1, lbl: '1.', parts: ['Have you ', ' eaten sushi?'], ans: ['ever'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['I have ', ' finished! I started two minutes ago.'], ans: ['just'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['She has ', ' visited Japan. She loves it!'], ans: ['already'], alts: [[]] },
          { id: 4, lbl: '4.', parts: ['I have ', ' tried coffee. I hate the smell.'], ans: ['never'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ["They haven't arrived ", '.'], ans: ['yet'], alts: [[]] },
        ]
      },
      {
        id: 'vqex02d', tipo: 'error',
        titulo: 'Find the mistake',
        enunciado: 'Each sentence has one mistake. Identify it and write the correction.',
        tiempo: 510,  // 8:30
        items: [
          { id: 1, lbl: '1.', sentence: 'She have worked here for ten years.', errorWord: 'have', correction: 'has' },
          { id: 2, lbl: '2.', sentence: 'I have saw him at the station.', errorWord: 'saw', correction: 'seen' },
          { id: 3, lbl: '3.', sentence: 'They has never visited Paris.', errorWord: 'has', correction: 'have' },
          { id: 4, lbl: '4.', sentence: 'He has already ate his breakfast.', errorWord: 'ate', correction: 'eaten' },
        ]
      },
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // VQ3 — Comparatives & Superlatives  (2 ESO · English)
  // Vídeo: "Comparatives and Superlatives + TEST | Advanced English Grammar"
  // https://www.youtube.com/watch?v=-GPPZzvY37Q  (~12 min)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'vq003',
    titulo: 'Comparatives & Superlatives – Video Lesson',
    nivel: '2 ESO',
    asignatura: 'English',
    tema: 'Grammar',
    color: '#0F766E',
    descripcion: 'Learn how to form and use comparatives and superlatives watching this lesson.',
    tags: ['comparatives', 'superlatives', 'adjectives', 'grammar', 'video'],
    youtubeUrl: 'https://www.youtube.com/watch?v=-GPPZzvY37Q',
    isFinished: true,
    soloUnIntento: false,
    ejercicios: [
      {
        id: 'vqex03a', tipo: 'truefalse',
        titulo: 'Comparative rules – True or False?',
        enunciado: 'After the introduction, decide if each rule is true or false.',
        tiempo: 90,   // 1:30
        items: [
          { id: 1, lbl: '1.', statement: 'Short adjectives (1 syllable) add -er to form the comparative.', ans: 'true' },
          { id: 2, lbl: '2.', statement: 'Long adjectives (3+ syllables) add -er to form the comparative.', ans: 'false' },
          { id: 3, lbl: '3.', statement: 'The comparative of "good" is "gooder".', ans: 'false' },
          { id: 4, lbl: '4.', statement: 'We use "than" after a comparative adjective.', ans: 'true' },
        ]
      },
      {
        id: 'vqex03b', tipo: 'fill',
        titulo: 'Complete with the comparative form',
        enunciado: 'Write the comparative form of the adjective in brackets.',
        tiempo: 240,  // 4:00
        items: [
          { id: 1, lbl: '1.', parts: ['London is ', ' than Madrid.'], hint: '(big)', ans: ['bigger'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['This exercise is ', ' than the last one.'], hint: '(difficult)', ans: ['more difficult'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['She speaks ', ' than her brother.'], hint: '(fast)', ans: ['faster'], alts: [[]] },
          { id: 4, lbl: '4.', parts: ['My new phone is ', ' than the old one.'], hint: '(good)', ans: ['better'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ['This path is ', ' than the other one.'], hint: '(dangerous)', ans: ['more dangerous'], alts: [[]] },
        ]
      },
      {
        id: 'vqex03c', tipo: 'fill',
        titulo: 'Complete with the superlative form',
        enunciado: 'Write the superlative form of the adjective.',
        tiempo: 420,  // 7:00
        items: [
          { id: 1, lbl: '1.', parts: ['This is the ', ' building in the city.'], hint: '(tall)', ans: ['tallest'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['She is the ', ' student in the class.'], hint: '(good)', ans: ['best'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['That was the ', ' film I have ever seen.'], hint: '(scary)', ans: ['scariest'], alts: [['most scary']] },
          { id: 4, lbl: '4.', parts: ['It is the ', ' car in the shop.'], hint: '(expensive)', ans: ['most expensive'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ['January is the ', ' month of the year.'], hint: '(cold)', ans: ['coldest'], alts: [[]] },
        ]
      },
      {
        id: 'vqex03d', tipo: 'multichoice',
        titulo: 'Choose the correct option',
        enunciado: 'Choose the correct comparative or superlative form.',
        tiempo: 580,  // 9:40 – tras los ejemplos finales y antes del test
        items: [
          { id: 1, lbl: '1.', question: 'She is _______ than her sister.', opts: ['more tall', 'taller', 'tallest', 'the tallest'], ans: 'taller' },
          { id: 2, lbl: '2.', question: 'This is _______ film I have ever seen.', opts: ['the gooder', 'better', 'the best', 'more good'], ans: 'the best' },
          { id: 3, lbl: '3.', question: 'My bag is _______ than yours.', opts: ['heavier', 'more heavy', 'the heaviest', 'most heavy'], ans: 'heavier' },
          { id: 4, lbl: '4.', question: 'He speaks English _______ of the whole class.', opts: ['better', 'the best', 'more good', 'most well'], ans: 'the best' },
        ]
      },
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // VQ4 — Modal Verbs  (4 ESO · English)
  // Vídeo: "Complete Guide to English Modal Verbs – English Grammar Lesson"
  // https://www.youtube.com/watch?v=4GMU08J98MQ  (~11 min)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'vq004',
    titulo: 'Modal Verbs – Video Lesson',
    nivel: '4 ESO',
    asignatura: 'English',
    tema: 'Grammar',
    color: '#B45309',
    descripcion: 'Watch and answer questions about can, could, must, should and might at key moments.',
    tags: ['modal verbs', 'can', 'must', 'should', 'might', 'grammar', 'video'],
    youtubeUrl: 'https://www.youtube.com/watch?v=4GMU08J98MQ',
    isFinished: true,
    soloUnIntento: false,
    ejercicios: [
      {
        id: 'vqex04a', tipo: 'match',
        titulo: 'Match the modal to its meaning',
        enunciado: 'After the introduction, match each modal verb to its main use.',
        tiempo: 90,   // 1:30
        items: [
          { id: 1, lbl: '1.', left: 'can',    right: 'ability or permission' },
          { id: 2, lbl: '2.', left: 'must',   right: 'strong obligation or necessity' },
          { id: 3, lbl: '3.', left: 'should', right: 'advice or recommendation' },
          { id: 4, lbl: '4.', left: 'might',  right: 'possibility (not certain)' },
          { id: 5, lbl: '5.', left: 'could',  right: 'past ability or polite request' },
        ]
      },
      {
        id: 'vqex04b', tipo: 'choice',
        titulo: 'Choose the correct modal – CAN / MUST',
        enunciado: 'Choose the best modal verb for each sentence.',
        tiempo: 250,  // 4:10 – tras sección can/must
        items: [
          { id: 1, lbl: '1.', parts: ['You ', " wear a seatbelt. It's the law."], opts: ['must', 'can'], ans: 'must' },
          { id: 2, lbl: '2.', parts: ['She ', " speak French. She learnt it at school."], opts: ['can', 'must'], ans: 'can' },
          { id: 3, lbl: '3.', parts: ["You ", " smoke in the hospital. It's forbidden."], opts: ["mustn't", "shouldn't"], ans: "mustn't" },
          { id: 4, lbl: '4.', parts: ['He ', " play the guitar. He learned when he was five."], opts: ['can', 'must'], ans: 'can' },
        ]
      },
      {
        id: 'vqex04c', tipo: 'truefalse',
        titulo: 'True or False – Modal Verbs rules',
        enunciado: 'Decide if each statement about modal verbs is true or false.',
        tiempo: 420,  // 7:00 – tras sección should / might
        items: [
          { id: 1, lbl: '1.', statement: "'Should' is used for strong obligations like laws.", ans: 'false' },
          { id: 2, lbl: '2.', statement: "'Might' expresses possibility.", ans: 'true' },
          { id: 3, lbl: '3.', statement: "'Mustn't' means you don't have to do something.", ans: 'false' },
          { id: 4, lbl: '4.', statement: "Modal verbs are followed by the infinitive without 'to'.", ans: 'true' },
          { id: 5, lbl: '5.', statement: "'Could' is the past form of 'can' and can also be used for polite requests.", ans: 'true' },
        ]
      },
      {
        id: 'vqex04d', tipo: 'multichoice',
        titulo: 'Modals in context',
        enunciado: 'Choose the best modal verb for each situation.',
        tiempo: 570,  // 9:30 – práctica final
        items: [
          { id: 1, lbl: '1.', question: 'It _______ rain later. Take an umbrella just in case.', opts: ['must', 'might', 'can', 'shall'], ans: 'might' },
          { id: 2, lbl: '2.', question: "You _______ pay. It's completely free!", opts: ["mustn't", "can't", "don't have to", "shouldn't"], ans: "don't have to" },
          { id: 3, lbl: '3.', question: "You _______ touch that wire! It's extremely dangerous.", opts: ["shouldn't", "might not", "can't", "mustn't"], ans: "mustn't" },
          { id: 4, lbl: '4.', question: "I _______ swim when I was four years old.", opts: ['might', 'can', 'could', 'must'], ans: 'could' },
        ]
      },
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // VQ5 — The Environment  (3 ESO · English)
  // Vídeo: "How to Talk About the Environment in English – Spoken English Lesson"
  // https://www.youtube.com/watch?v=zKAYAnLsoUk  (~10 min)
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'vq005',
    titulo: 'The Environment – Video Lesson',
    nivel: '3 ESO',
    asignatura: 'English',
    tema: 'Vocabulary',
    color: '#047857',
    descripcion: 'Watch the lesson about environmental vocabulary and answer questions at key points.',
    tags: ['environment', 'vocabulary', 'ecology', 'climate', 'pollution', 'video'],
    youtubeUrl: 'https://www.youtube.com/watch?v=zKAYAnLsoUk',
    isFinished: true,
    soloUnIntento: false,
    ejercicios: [
      {
        id: 'vqex05a', tipo: 'match',
        titulo: 'Match vocabulary to definition',
        enunciado: 'After the vocabulary introduction, match each word to its definition.',
        tiempo: 100,  // 1:40
        items: [
          { id: 1, lbl: '1.', left: 'recycle',          right: 'to process materials to make new products' },
          { id: 2, lbl: '2.', left: 'pollution',        right: 'harmful substances released into the environment' },
          { id: 3, lbl: '3.', left: 'deforestation',    right: 'the cutting down of large areas of forest' },
          { id: 4, lbl: '4.', left: 'renewable energy', right: 'energy from natural sources that will not run out' },
          { id: 5, lbl: '5.', left: 'endangered',       right: 'at risk of dying out completely' },
        ]
      },
      {
        id: 'vqex05b', tipo: 'wordbank',
        titulo: 'Complete the sentences',
        enunciado: 'Complete with the correct word from the box.',
        tiempo: 240,  // 4:00 – tras sección de vocabulario de contaminación
        wordbank: ['pollution', 'recycle', 'energy', 'Climate', 'Forests', 'carbon footprint'],
        items: [
          { id: 1, lbl: '1.', parts: ['Cars produce ', ' that damages the air we breathe.'], ans: ['pollution'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['', ' change is one of the biggest challenges of our time.'], ans: ['Climate'], alts: [['climate']] },
          { id: 3, lbl: '3.', parts: ['We should use renewable ', ' like solar or wind power.'], ans: ['energy'], alts: [[]] },
          { id: 4, lbl: '4.', parts: ['We must ', ' paper, glass and plastic to reduce waste.'], ans: ['recycle'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ['Your ', ' is the total amount of CO₂ you produce.'], ans: ['carbon footprint'], alts: [[]] },
        ]
      },
      {
        id: 'vqex05c', tipo: 'truefalse',
        titulo: 'True or False – Environmental facts',
        enunciado: 'Decide if each statement is true or false based on the lesson.',
        tiempo: 380,  // 6:20 – tras sección sobre causas y efectos
        items: [
          { id: 1, lbl: '1.', statement: 'Greenhouse gases trap heat in the atmosphere.', ans: 'true' },
          { id: 2, lbl: '2.', statement: 'Deforestation helps increase biodiversity.', ans: 'false' },
          { id: 3, lbl: '3.', statement: 'Solar power is a type of renewable energy.', ans: 'true' },
          { id: 4, lbl: '4.', statement: 'The greenhouse effect is entirely caused by humans.', ans: 'false' },
          { id: 5, lbl: '5.', statement: 'Reducing emissions means producing less CO₂.', ans: 'true' },
        ]
      },
      {
        id: 'vqex05d', tipo: 'multichoice',
        titulo: 'Environmental vocabulary in context',
        enunciado: 'Choose the best word or phrase to complete each sentence.',
        tiempo: 520,  // 8:40 – wrap-up / vocabulary in context
        items: [
          { id: 1, lbl: '1.', question: 'The _______ of the Amazon is destroying the habitat of thousands of species.', opts: ['recycling', 'deforestation', 'pollution', 'greenhouse effect'], ans: 'deforestation' },
          { id: 2, lbl: '2.', question: 'We can reduce our _______ by using public transport instead of cars.', opts: ['biodiversity', 'carbon footprint', 'ozone layer', 'acid rain'], ans: 'carbon footprint' },
          { id: 3, lbl: '3.', question: "Wind power and solar energy are examples of _______ energy.", opts: ['fossil', 'nuclear', 'renewable', 'polluting'], ans: 'renewable' },
          { id: 4, lbl: '4.', question: "Many animals are _______ because humans are destroying their natural habitats.", opts: ['recycled', 'endangered', 'polluted', 'deforested'], ans: 'endangered' },
        ]
      },
    ]
  },

];
