// BibliotecaOmni.js — Biblioteca de recursos interactivos para Omninteractive
// Tipos: fill | choice | wordbank | construct | match | order | truefalse | multichoice | error

export const BIBLIOTECA = [

  // ─────────────────────────────────────────────────────────────────
  // R1 – Passive Voice / Shopping  (3 ESO) — ejercicios de la foto
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'r001', titulo: 'Passive Voice – Shopping', nivel: '3 ESO',
    asignatura: 'English', tema: 'Grammar', color: '#6D28D9',
    descripcion: 'Present and Past Simple Passive voice in shopping contexts.',
    tags: ['passive', 'shopping', 'grammar', 'present simple', 'past simple'],
    ejercicios: [
      {
        id: 'ex0', tipo: 'fill', imagen: null,
        titulo: 'Complete – Present Simple Passive',
        enunciado: 'Complete the answers with the verbs in brackets. Use the Present Simple Passive.',
        items: [
          { id: 1, lbl: 'a.', parts: ['Because the prices there ', ' very cheap.'], hint: '(consider)', ans: ['are considered'], alts: [[]] },
          { id: 2, lbl: 'b.', parts: ['No, this bag ', ' using plastic.'], hint: '(not make)', ans: ["isn't made"], alts: [['is not made']] },
          { id: 3, lbl: 'c.', parts: ['Yes, fashion design ', ' by many students here every year.'], hint: '(learn)', ans: ['is learned'], alts: [['is learnt']] },
          { id: 4, lbl: 'd.', parts: ['They ', " anywhere now. My mother bought them 20 years ago."], hint: '(not sell)', ans: ["aren't sold"], alts: [['are not sold']] },
        ]
      },
      {
        id: 'ex1', tipo: 'choice', imagen: null,
        titulo: 'Choose the correct answers',
        enunciado: 'Choose the correct form for each sentence.',
        items: [
          { id: 1, lbl: '1.', parts: ['I ', ' £50, but these trousers only cost £40!'], opts: ['were charged', 'was charged'], ans: 'was charged' },
          { id: 2, lbl: '2.', parts: ['All the computer games ', ' for half off last week.'], opts: ['was sold', 'were sold'], ans: 'were sold' },
          { id: 3, lbl: '3.', parts: ['A new shoe shop ', ' in the shopping centre a week ago.'], opts: ['was opened', 'were opened'], ans: 'was opened' },
          { id: 4, lbl: '4.', parts: ['Fiona ', ' a watch for her birthday.'], opts: ['were given', 'was given'], ans: 'was given' },
          { id: 5, lbl: '5.', parts: ['My flip flops ', ' while I was at the beach last Saturday.'], opts: ['were stolen', 'was stolen'], ans: 'were stolen' },
          { id: 6, lbl: '6.', parts: ['The prices ', ' on the website last week.'], opts: ['was changed', 'were changed'], ans: 'were changed' },
        ]
      },
      {
        id: 'ex2', tipo: 'fill', imagen: null,
        titulo: 'Complete – Past Simple Passive',
        enunciado: 'Complete the sentences with the verbs in brackets. Use the Past Simple Passive.',
        items: [
          { id: 1, lbl: '1.', parts: ['Several people ', ' special offers by e-mail yesterday.'], hint: '(send)', ans: ['were sent'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['The hats ', ' in the shop window.'], hint: '(not show)', ans: ["weren't shown"], alts: [['were not shown']] },
          { id: 3, lbl: '3.', parts: ['This outfit ', ' by a famous writer.'], hint: '(wear)', ans: ['was worn'], alts: [[]] },
          { id: 4, lbl: '4.', parts: ['The dress ', ' for two shirts.'], hint: '(not exchange)', ans: ["wasn't exchanged"], alts: [['was not exchanged']] },
          { id: 5, lbl: '5.', parts: ['We ', ' to the shopping centre by my mum.'], hint: '(drive)', ans: ['were driven'], alts: [[]] },
          { id: 6, lbl: '6.', parts: ['The customer ', ' by a salesperson, so he left the shop.'], hint: '(not help)', ans: ["wasn't helped"], alts: [['was not helped']] },
        ]
      },
      {
        id: 'ex3', tipo: 'wordbank', imagen: null,
        titulo: 'Complete with verbs from the list',
        enunciado: 'Complete the sentences with the verbs below. Use the Past Simple Passive.',
        wordbank: ['not build', 'take', 'write', 'not invite', 'tell'],
        items: [
          { id: 1, lbl: '1.', parts: ['This article ', ' by a businessperson.'], ans: ['was written'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['Where ', ' these photos ', '?'], ans: ['were', 'taken'], alts: [[], []] },
          { id: 3, lbl: '3.', parts: ['This shop ', ' in the year 1995.'], ans: ["wasn't built"], alts: [['was not built']] },
          { id: 4, lbl: '4.', parts: ['When ', ' you ', ' about the sale?'], ans: ['were', 'told'], alts: [[], []] },
          { id: 5, lbl: '5.', parts: ['Some designers ', ' to the fashion event.'], ans: ["weren't invited"], alts: [['were not invited']] },
        ]
      },
      {
        id: 'ex4', tipo: 'construct', imagen: null,
        titulo: 'Write sentences',
        enunciado: 'Write sentences with the words below. Use the Past Simple Passive.',
        items: [
          { id: 1, lbl: '1.', prompt: 'these socks / not buy / by my mum /.', ans: "These socks weren't bought by my mum.", alts: ['These socks were not bought by my mum.'] },
          { id: 2, lbl: '2.', prompt: 'your bags / find / by the shop owner / ?', ans: 'Were your bags found by the shop owner?', alts: [] },
          { id: 3, lbl: '3.', prompt: 'the game shop / rob / last week /.', ans: 'The game shop was robbed last week.', alts: [] },
          { id: 4, lbl: '4.', prompt: 'twenty computers / donate / to the school /.', ans: 'Twenty computers were donated to the school.', alts: [] },
          { id: 5, lbl: '5.', prompt: 'I / not give / the correct change /.', ans: "I wasn't given the correct change.", alts: ['I was not given the correct change.'] },
          { id: 6, lbl: '6.', prompt: 'the customers / ask / to leave the shop /.', ans: 'The customers were asked to leave the shop.', alts: [] },
          { id: 7, lbl: '7.', prompt: 'this checkout counter / use / yesterday / ?', ans: 'Was this checkout counter used yesterday?', alts: [] },
          { id: 8, lbl: '8.', prompt: 'these flip flops / not make / by a big company /.', ans: "These flip flops weren't made by a big company.", alts: ['These flip flops were not made by a big company.'] },
        ]
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // R2 – Present Perfect (3 ESO)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'r002', titulo: 'Present Perfect', nivel: '3 ESO',
    asignatura: 'English', tema: 'Grammar', color: '#1D4ED8',
    descripcion: 'Formation and use of the Present Perfect tense.',
    tags: ['present perfect', 'past simple', 'grammar', 'verbs'],
    ejercicios: [
      {
        id: 'ex0', tipo: 'fill', imagen: null,
        titulo: 'Present Perfect or Past Simple?',
        enunciado: 'Complete the sentences with the correct form of the verb in brackets.',
        items: [
          { id: 1, lbl: '1.', parts: ['I ', ' Rome twice.'], hint: '(visit)', ans: ['have visited'], alts: [["'ve visited"]] },
          { id: 2, lbl: '2.', parts: ['She ', ' to Japan last year.'], hint: '(travel)', ans: ['travelled'], alts: [['traveled']] },
          { id: 3, lbl: '3.', parts: ['They ', " their project yet."], hint: '(not finish)', ans: ["haven't finished"], alts: [['have not finished']] },
          { id: 4, lbl: '4.', parts: ['We ', ' the manager in 2022.'], hint: '(meet)', ans: ['met'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ['He has already ', ' his dinner.'], hint: '(eat)', ans: ['eaten'], alts: [[]] },
          { id: 6, lbl: '6.', parts: ['She ', " the report yet."], hint: '(not write)', ans: ["hasn't written"], alts: [['has not written']] },
        ]
      },
      {
        id: 'ex1', tipo: 'choice', imagen: null,
        titulo: 'Choose the correct form',
        enunciado: 'Choose the correct tense for each sentence.',
        items: [
          { id: 1, lbl: '1.', parts: ['I ', ' that film last night.'], opts: ['have seen', 'saw'], ans: 'saw' },
          { id: 2, lbl: '2.', parts: ['She ', ' here since 2010.'], opts: ['has lived', 'lived'], ans: 'has lived' },
          { id: 3, lbl: '3.', parts: ['We ', ' the test an hour ago.'], opts: ['have finished', 'finished'], ans: 'finished' },
          { id: 4, lbl: '4.', parts: ['They ', ' to Africa.'], opts: ['have never been', 'never went'], ans: 'have never been' },
          { id: 5, lbl: '5.', parts: ['He ', ' in London for five years.'], opts: ['has worked', 'worked'], ans: 'has worked' },
          { id: 6, lbl: '6.', parts: ['I ', ' my keys. I cannot find them!'], opts: ['have lost', 'lost'], ans: 'have lost' },
        ]
      },
      {
        id: 'ex2', tipo: 'error', imagen: null,
        titulo: 'Find and correct the mistake',
        enunciado: 'Each sentence has one mistake. Find the wrong word and write the correction.',
        items: [
          { id: 1, lbl: '1.', sentence: 'She have worked here for ten years.', errorWord: 'have', correction: 'has' },
          { id: 2, lbl: '2.', sentence: 'I have saw him at the station.', errorWord: 'saw', correction: 'seen' },
          { id: 3, lbl: '3.', sentence: 'They has never visited Paris.', errorWord: 'has', correction: 'have' },
          { id: 4, lbl: '4.', sentence: 'We have went to that restaurant before.', errorWord: 'went', correction: 'gone' },
          { id: 5, lbl: '5.', sentence: 'He has already ate his breakfast.', errorWord: 'ate', correction: 'eaten' },
        ]
      },
      {
        id: 'ex3', tipo: 'construct', imagen: null,
        titulo: 'Write sentences using Present Perfect',
        enunciado: 'Use the words to write sentences in the Present Perfect.',
        items: [
          { id: 1, lbl: '1.', prompt: 'I / never / eat / sushi /.', ans: 'I have never eaten sushi.', alts: ["I've never eaten sushi."] },
          { id: 2, lbl: '2.', prompt: 'she / just / finish / her homework /.', ans: 'She has just finished her homework.', alts: ["She's just finished her homework."] },
          { id: 3, lbl: '3.', prompt: 'they / live / here / for 5 years /.', ans: 'They have lived here for five years.', alts: ["They've lived here for five years.", 'They have lived here for 5 years.'] },
          { id: 4, lbl: '4.', prompt: 'you / ever / be / to London / ?', ans: 'Have you ever been to London?', alts: [] },
        ]
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // R3 – Comparatives & Superlatives (2 ESO)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'r003', titulo: 'Comparatives & Superlatives', nivel: '2 ESO',
    asignatura: 'English', tema: 'Grammar', color: '#0F766E',
    descripcion: 'Practice forming and using comparative and superlative adjectives.',
    tags: ['comparatives', 'superlatives', 'adjectives', 'grammar'],
    ejercicios: [
      {
        id: 'ex0', tipo: 'fill', imagen: null,
        titulo: 'Comparative forms',
        enunciado: 'Complete the sentences with the comparative form of the adjective in brackets.',
        items: [
          { id: 1, lbl: '1.', parts: ['London is ', ' than Madrid.'], hint: '(big)', ans: ['bigger'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['This exercise is ', ' than the last one.'], hint: '(difficult)', ans: ['more difficult'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['An elephant is ', ' than a dog.'], hint: '(heavy)', ans: ['heavier'], alts: [[]] },
          { id: 4, lbl: '4.', parts: ['She speaks ', ' than her teacher.'], hint: '(fast)', ans: ['faster'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ['This book is ', ' than that one.'], hint: '(interesting)', ans: ['more interesting'], alts: [[]] },
          { id: 6, lbl: '6.', parts: ['My new phone is ', ' than the old one.'], hint: '(good)', ans: ['better'], alts: [[]] },
        ]
      },
      {
        id: 'ex1', tipo: 'fill', imagen: null,
        titulo: 'Superlative forms',
        enunciado: 'Complete the sentences with the superlative form of the adjective in brackets.',
        items: [
          { id: 1, lbl: '1.', parts: ['This is the ', ' building in the city.'], hint: '(tall)', ans: ['tallest'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['She is the ', ' student in the class.'], hint: '(good)', ans: ['best'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['January is the ', " month of the year."], hint: '(cold)', ans: ['coldest'], alts: [[]] },
          { id: 4, lbl: '4.', parts: ['That was the ', " film I have ever seen."], hint: '(scary)', ans: ['scariest'], alts: [['most scary']] },
          { id: 5, lbl: '5.', parts: ['He is the ', ' player in the team.'], hint: '(bad)', ans: ['worst'], alts: [[]] },
          { id: 6, lbl: '6.', parts: ["It is the ", ' car in the shop.'], hint: '(expensive)', ans: ['most expensive'], alts: [[]] },
        ]
      },
      {
        id: 'ex2', tipo: 'order', imagen: null,
        titulo: 'Order the words',
        enunciado: 'Put the words in the correct order to make sentences.',
        items: [
          { id: 1, lbl: '1.', shuffled: ['than', 'London', 'bigger', 'is', 'Madrid.'], answer: 'London is bigger than Madrid.' },
          { id: 2, lbl: '2.', shuffled: ['the', 'Everest', 'highest', 'is', 'mountain', 'the', 'world.', 'in'], answer: 'Everest is the highest mountain in the world.' },
          { id: 3, lbl: '3.', shuffled: ['more', 'than', 'is', 'English', 'maths.', 'difficult'], answer: 'English is more difficult than maths.' },
          { id: 4, lbl: '4.', shuffled: ['the', 'He', 'player', 'best', 'is', 'team.', 'in', 'the'], answer: 'He is the best player in the team.' },
        ]
      },
      {
        id: 'ex3', tipo: 'multichoice', imagen: null,
        titulo: 'Multiple choice',
        enunciado: 'Choose the correct option.',
        items: [
          { id: 1, lbl: '1.', question: 'She is _______ than her sister.', opts: ['more tall', 'taller', 'tallest', 'the tallest'], ans: 'taller' },
          { id: 2, lbl: '2.', question: 'This is _______ film I have ever seen.', opts: ['the gooder', 'better', 'the best', 'more good'], ans: 'the best' },
          { id: 3, lbl: '3.', question: 'My bag is _______ than yours.', opts: ['heavier', 'more heavy', 'the heaviest', 'most heavy'], ans: 'heavier' },
          { id: 4, lbl: '4.', question: 'She speaks English _______ of the whole class.', opts: ['better', 'the best', 'more well', 'most well'], ans: 'the best' },
        ]
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // R4 – Modal Verbs (4 ESO)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'r004', titulo: 'Modal Verbs', nivel: '4 ESO',
    asignatura: 'English', tema: 'Grammar', color: '#B45309',
    descripcion: 'Use of can, could, must, should, might and other modal verbs.',
    tags: ['modal verbs', 'can', 'must', 'should', 'might', 'grammar'],
    ejercicios: [
      {
        id: 'ex0', tipo: 'choice', imagen: null,
        titulo: 'Choose the correct modal',
        enunciado: 'Choose the correct modal verb for each sentence.',
        items: [
          { id: 1, lbl: '1.', parts: ['You ', ' wear a seatbelt. It\'s the law.'], opts: ['must', 'should'], ans: 'must' },
          { id: 2, lbl: '2.', parts: ['She ', ' speak French. She learnt it at school.'], opts: ['can', 'must'], ans: 'can' },
          { id: 3, lbl: '3.', parts: ['You ', ' eat more vegetables. It\'s good for you.'], opts: ['should', 'must'], ans: 'should' },
          { id: 4, lbl: '4.', parts: ['You ', " smoke in the hospital. It's forbidden."], opts: ["mustn't", "shouldn't"], ans: "mustn't" },
          { id: 5, lbl: '5.', parts: ['I ', " come to the party. I'm not sure yet."], opts: ['might', 'must'], ans: 'might' },
          { id: 6, lbl: '6.', parts: ['Students ', " be late. It's the school rule."], opts: ["mustn't", "shouldn't"], ans: "mustn't" },
        ]
      },
      {
        id: 'ex1', tipo: 'truefalse', imagen: null,
        titulo: 'True or false?',
        enunciado: "Read each statement about modal verbs and decide if it's true (T) or false (F).",
        items: [
          { id: 1, lbl: '1.', statement: "'Can' is used to express ability.", ans: 'true' },
          { id: 2, lbl: '2.', statement: "'Must' and 'have to' always have exactly the same meaning.", ans: 'false' },
          { id: 3, lbl: '3.', statement: "'Should' is used for strong obligations like laws.", ans: 'false' },
          { id: 4, lbl: '4.', statement: "'Might' expresses possibility.", ans: 'true' },
          { id: 5, lbl: '5.', statement: "'Mustn't' means you don't have to do something.", ans: 'false' },
          { id: 6, lbl: '6.', statement: "'Could' is the past form of 'can'.", ans: 'true' },
        ]
      },
      {
        id: 'ex2', tipo: 'multichoice', imagen: null,
        titulo: 'Modal verbs in context',
        enunciado: 'Choose the best answer for each situation.',
        items: [
          { id: 1, lbl: '1.', question: "It _______ rain later. Take an umbrella just in case.", opts: ['must', 'might', 'can', 'need'], ans: 'might' },
          { id: 2, lbl: '2.', question: "You _______ pay for the ticket. It's completely free!", opts: ["mustn't", "can't", "don't have to", "shouldn't"], ans: "don't have to" },
          { id: 3, lbl: '3.', question: "She _______ drive. She passed her test yesterday.", opts: ['might', 'can', 'must', 'should'], ans: 'can' },
          { id: 4, lbl: '4.', question: "You _______ touch that! It's extremely dangerous.", opts: ["shouldn't", "might not", "can't", "mustn't"], ans: "mustn't" },
        ]
      },
      {
        id: 'ex3', tipo: 'construct', imagen: null,
        titulo: 'Rewrite with modals',
        enunciado: 'Rewrite each sentence using the modal verb given in brackets.',
        items: [
          { id: 1, lbl: '1.', prompt: 'It\'s possible that he will call tonight. (might)', ans: 'He might call tonight.', alts: [] },
          { id: 2, lbl: '2.', prompt: "I'm able to swim very fast. (can)", ans: 'I can swim very fast.', alts: [] },
          { id: 3, lbl: '3.', prompt: "It's necessary to wear a helmet. (must)", ans: 'You must wear a helmet.', alts: [] },
          { id: 4, lbl: '4.', prompt: "It's a good idea to study every day. (should)", ans: 'You should study every day.', alts: [] },
          { id: 5, lbl: '5.', prompt: "He is not allowed to park here. (can't)", ans: "He can't park here.", alts: ['He cannot park here.'] },
        ]
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // R5 – The Environment (3 ESO)  → includes MATCH type
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'r005', titulo: 'The Environment', nivel: '3 ESO',
    asignatura: 'English', tema: 'Vocabulary', color: '#047857',
    descripcion: 'Vocabulary and topics related to the environment and ecology.',
    tags: ['environment', 'vocabulary', 'ecology', 'climate', 'green'],
    ejercicios: [
      {
        id: 'ex0', tipo: 'match', imagen: null,
        titulo: 'Match the vocabulary',
        enunciado: 'Match each word or phrase with its correct definition.',
        items: [
          { id: 1, lbl: '1.', left: 'recycle', right: 'to process used materials to make new products' },
          { id: 2, lbl: '2.', left: 'pollution', right: 'harmful substances released into the environment' },
          { id: 3, lbl: '3.', left: 'deforestation', right: 'the cutting down of large areas of forest' },
          { id: 4, lbl: '4.', left: 'renewable energy', right: 'energy from natural sources that will not run out' },
          { id: 5, lbl: '5.', left: 'endangered', right: 'at risk of dying out completely' },
          { id: 6, lbl: '6.', left: 'greenhouse effect', right: 'the warming of the Earth caused by trapped gases' },
        ]
      },
      {
        id: 'ex1', tipo: 'wordbank', imagen: null,
        titulo: 'Complete the text',
        enunciado: 'Complete the sentences with the correct word from the box.',
        wordbank: ['pollution', 'recycle', 'energy', 'Climate', 'Forests', 'planet'],
        items: [
          { id: 1, lbl: '1.', parts: ['We need to protect our ', ' from global warming.'], ans: ['planet'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['Cars produce ', ' that damages the air we breathe.'], ans: ['pollution'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['', ' change is one of the biggest challenges of our time.'], ans: ['Climate'], alts: [['climate']] },
          { id: 4, lbl: '4.', parts: ['We should use renewable ', ' like solar or wind power.'], ans: ['energy'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ['We must ', ' paper, glass, and plastic to reduce waste.'], ans: ['recycle'], alts: [[]] },
          { id: 6, lbl: '6.', parts: ['', ' are essential habitats for millions of species.'], ans: ['Forests'], alts: [['forests']] },
        ]
      },
      {
        id: 'ex2', tipo: 'truefalse', imagen: null,
        titulo: 'True or false?',
        enunciado: 'Read the sentences about the environment and decide: True (T) or False (F).',
        items: [
          { id: 1, lbl: '1.', statement: 'Recycling can help reduce landfill waste.', ans: 'true' },
          { id: 2, lbl: '2.', statement: 'Fossil fuels are a type of renewable energy.', ans: 'false' },
          { id: 3, lbl: '3.', statement: 'Deforestation can contribute to climate change.', ans: 'true' },
          { id: 4, lbl: '4.', statement: 'Electric cars produce more CO₂ than petrol cars.', ans: 'false' },
          { id: 5, lbl: '5.', statement: 'Solar panels use sunlight to generate electricity.', ans: 'true' },
          { id: 6, lbl: '6.', statement: 'The greenhouse effect is entirely caused by humans.', ans: 'false' },
        ]
      },
      {
        id: 'ex3', tipo: 'multichoice', imagen: null,
        titulo: 'Multiple choice',
        enunciado: 'Choose the correct answer.',
        items: [
          { id: 1, lbl: '1.', question: 'Which gas is mainly responsible for the greenhouse effect?', opts: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], ans: 'Carbon dioxide' },
          { id: 2, lbl: '2.', question: "What does 'biodiversity' mean?", opts: ['Air pollution', 'Variety of life forms', 'Climate change', 'Energy saving'], ans: 'Variety of life forms' },
          { id: 3, lbl: '3.', question: 'Which is an example of renewable energy?', opts: ['Coal', 'Oil', 'Wind', 'Natural gas'], ans: 'Wind' },
          { id: 4, lbl: '4.', question: "What is 'deforestation'?", opts: ['Planting more trees', 'Protecting animals', 'Cutting down forests', 'Cleaning the ocean'], ans: 'Cutting down forests' },
        ]
      },
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  // R6 – Reported Speech (4 ESO)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'r006', titulo: 'Reported Speech', nivel: '4 ESO',
    asignatura: 'English', tema: 'Grammar', color: '#C2410C',
    descripcion: 'Transform direct speech into reported speech with correct backshift.',
    tags: ['reported speech', 'indirect speech', 'grammar', 'verbs'],
    ejercicios: [
      {
        id: 'ex0', tipo: 'fill', imagen: null,
        titulo: 'Complete the reported sentences',
        enunciado: "Complete the reported sentences. Change the verb tense correctly.",
        items: [
          { id: 1, lbl: '1.', parts: ['"I like pizza," he said. → He said that he ', ' pizza.'], hint: '(like)', ans: ['liked'], alts: [[]] },
          { id: 2, lbl: '2.', parts: ['"She is studying," they said. → They said that she ', ' studying.'], hint: '(is→)', ans: ['was'], alts: [[]] },
          { id: 3, lbl: '3.', parts: ['"I will come tomorrow," she said. → She said she ', ' come the next day.'], hint: '(will→)', ans: ['would'], alts: [[]] },
          { id: 4, lbl: '4.', parts: ['"We are watching TV," they said. → They said they ', ' watching TV.'], hint: '(are→)', ans: ['were'], alts: [[]] },
          { id: 5, lbl: '5.', parts: ['"He has finished," she said. → She said he ', ' finished.'], hint: '(has→)', ans: ['had'], alts: [[]] },
        ]
      },
      {
        id: 'ex1', tipo: 'error', imagen: null,
        titulo: 'Find and correct the mistake',
        enunciado: 'Each reported sentence has one mistake. Find the wrong word and correct it.',
        items: [
          { id: 1, lbl: '1.', sentence: 'He said that he likes pizza.', errorWord: 'likes', correction: 'liked' },
          { id: 2, lbl: '2.', sentence: 'She told me that she will come the next day.', errorWord: 'will', correction: 'would' },
          { id: 3, lbl: '3.', sentence: 'They said they are ready to leave.', errorWord: 'are', correction: 'were' },
          { id: 4, lbl: '4.', sentence: 'He told me that he had went there before.', errorWord: 'went', correction: 'gone' },
          { id: 5, lbl: '5.', sentence: 'She said she can help me with the project.', errorWord: 'can', correction: 'could' },
        ]
      },
      {
        id: 'ex2', tipo: 'construct', imagen: null,
        titulo: 'Report what they said',
        enunciado: 'Write the reported speech for each sentence.',
        items: [
          { id: 1, lbl: '1.', prompt: '"I love chocolate," Anna said.', ans: 'Anna said that she loved chocolate.', alts: ['Anna said she loved chocolate.'] },
          { id: 2, lbl: '2.', prompt: '"We are playing football," the boys said.', ans: 'The boys said that they were playing football.', alts: ['The boys said they were playing football.'] },
          { id: 3, lbl: '3.', prompt: '"I will help you," Tom told me.', ans: 'Tom told me that he would help me.', alts: ['Tom told me he would help me.'] },
          { id: 4, lbl: '4.', prompt: '"She has passed the exam," the teacher said.', ans: 'The teacher said that she had passed the exam.', alts: ['The teacher said she had passed the exam.'] },
        ]
      },
      {
        id: 'ex3', tipo: 'order', imagen: null,
        titulo: 'Order the words',
        enunciado: 'Put the words in the correct order to form reported sentences.',
        items: [
          { id: 1, lbl: '1.', shuffled: ['said', 'that', 'She', 'was', 'she', 'tired.'], answer: 'She said that she was tired.' },
          { id: 2, lbl: '2.', shuffled: ['told', 'he', 'me', 'He', 'working.', 'was'], answer: 'He told me he was working.' },
          { id: 3, lbl: '3.', shuffled: ['that', 'said', 'would', 'She', 'come.', 'she'], answer: 'She said that she would come.' },
          { id: 4, lbl: '4.', shuffled: ['that', 'had', 'They', 'they', 'said', 'won.'], answer: 'They said that they had won.' },
        ]
      },
    ]
  },
];
