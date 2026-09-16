// Genera src/BibliotecaListeningFR.js a partir de los textos + palabras a ocultar.
import fs from 'fs';

const ITEMS = [
  {
    topic: 'les-vacances', titulo: 'Les vacances', nivel: 'A1-A2',
    texto: `J'adore les vacances. Chaque été, ma famille et moi partons au bord de la mer pendant deux semaines. Nous louons un petit appartement près de la plage. Le matin, je me lève tard et je prends mon petit-déjeuner sur le balcon. Ensuite, nous allons nager et nous jouons au volley sur le sable. Mon père préfère rester à l'ombre avec un livre. L'après-midi, nous visitons parfois un village ou un marché de la région. J'aime beaucoup goûter les plats typiques. Le soir, nous mangeons une glace et nous nous promenons dans les rues. L'année dernière, nous sommes allés à la montagne et c'était très différent, mais agréable aussi. Je crois que les vacances sont importantes parce qu'on oublie le stress de l'école et du travail.`,
    huecos: ['été', 'plage', 'matin', 'nager', 'livre', 'glace', 'montagne'],
  },
  {
    topic: 'le-petit-dejeuner', titulo: 'Le petit-déjeuner', nivel: 'A1-A2',
    texto: `Le matin, je n'ai jamais beaucoup de temps, mais je ne pars jamais sans petit-déjeuner. D'habitude, je bois un grand bol de chocolat chaud et je mange deux tartines avec du beurre et de la confiture. Le week-end, c'est différent : toute la famille mange ensemble et mon frère prépare des crêpes. Ma mère préfère le café et un yaourt avec des fruits. Elle dit que c'est meilleur pour la santé. En France, beaucoup de gens achètent des croissants à la boulangerie du quartier le dimanche. Moi, j'adore l'odeur du pain chaud. Quand j'étais petit, je ne mangeais rien avant l'école et j'avais toujours faim en classe. Maintenant, je sais que le petit-déjeuner est le repas le plus important de la journée.`,
    huecos: ['chocolat', 'tartines', 'crêpes', 'yaourt', 'boulangerie', 'pain', 'faim'],
  },
  {
    topic: 'mon-quartier', titulo: 'Mon quartier', nivel: 'A1-A2',
    texto: `J'habite dans un quartier tranquille, à vingt minutes du centre-ville. Il y a une grande place avec des arbres, une pharmacie, une boulangerie et un petit supermarché. En face de chez moi, il y a un parc où les enfants jouent au football après l'école. Le mardi, il y a un marché sur la place et tout le monde vient acheter des légumes et du fromage. Mes voisins sont sympathiques : ils se disent toujours bonjour. Le problème, c'est qu'il n'y a pas de cinéma et qu'il faut prendre le bus pour sortir le soir. Mon quartier a beaucoup changé depuis dix ans. Avant, il y avait moins de magasins, mais aussi moins de bruit. Malgré tout, je ne voudrais pas déménager.`,
    huecos: ['tranquille', 'pharmacie', 'parc', 'marché', 'voisins', 'bus', 'bruit'],
  },
  {
    topic: 'les-animaux', titulo: 'Les animaux de compagnie', nivel: 'A1-A2',
    texto: `Dans ma famille, nous avons toujours eu des animaux. En ce moment, nous avons un chien et deux chats. Le chien s'appelle Pepito et il est un peu bête, mais c'est le meilleur ami de ma petite sœur. Chaque soir, je dois le promener autour du parc, même quand il pleut. Les chats sont plus indépendants : ils dorment presque toute la journée sur le canapé. Beaucoup de gens pensent qu'un animal, c'est seulement pour jouer, mais c'est aussi une responsabilité. Il faut le nourrir, aller chez le vétérinaire et nettoyer la maison. Mes grands-parents ont un perroquet qui répète tous les mots qu'il entend. C'est drôle, mais parfois très fatigant. Je pense que vivre avec un animal rend les gens plus patients.`,
    huecos: ['chien', 'promener', 'canapé', 'responsabilité', 'vétérinaire', 'perroquet', 'patients'],
  },
  {
    topic: 'le-sport', titulo: 'Le sport', nivel: 'B1',
    texto: `Je fais du sport trois fois par semaine parce que ça me détend après les cours. Le lundi et le jeudi, je vais à la piscine avec une amie, et le samedi matin, je joue au basket dans un club de mon quartier. Avant, je courais dans le parc, mais je me suis blessé au genou l'hiver dernier. Le médecin m'a dit de faire de la natation pendant quelques mois. Je regarde aussi beaucoup de sport à la télévision, surtout le football et le tennis. Mon père dit que regarder le sport, ce n'est pas faire du sport, et il a raison. Ce que j'aime le plus dans le sport, ce n'est pas gagner : c'est l'ambiance de l'équipe et l'impression d'être en bonne forme.`,
    huecos: ['semaine', 'piscine', 'basket', 'genou', 'natation', 'tennis', 'équipe'],
  },
  {
    topic: 'les-reseaux-sociaux', titulo: 'Les réseaux sociaux', nivel: 'B1',
    texto: `Je passe beaucoup trop de temps sur les réseaux sociaux. Le soir, je regarde des vidéos pendant des heures et après, je n'ai plus le temps de lire ou de sortir. Ce n'est pas toujours négatif : grâce à internet, je parle avec des amis qui habitent dans un autre pays et j'apprends des choses intéressantes. Le problème, c'est que tout le monde montre seulement les bons moments de sa vie. On compare notre vie réelle avec des photos parfaites et on se sent mal. Mes parents ne comprennent pas ce monde et ils pensent que c'est dangereux pour les jeunes. Depuis le mois dernier, j'ai supprimé deux applications de mon téléphone et je dors beaucoup mieux. Je crois qu'il faut apprendre à utiliser ces outils sans devenir dépendant.`,
    huecos: ['vidéos', 'internet', 'pays', 'photos', 'dangereux', 'téléphone', 'dépendant'],
  },
];

// LCG determinista para que el fichero generado sea reproducible
const mkRand = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

const limpiar = (w) => w.replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, '');

function construir(item, idx) {
  const rand = mkRand(idx * 7919 + 13);
  const palabras = item.texto.split(/\s+/);

  // Candidatos a distractores: palabras "de contenido" del propio texto
  const candidatos = [...new Set(palabras.map(limpiar).filter(w =>
    w.length >= 4 && !w.includes("'") && !item.huecos.includes(w) && /^\p{Ll}/u.test(w)
  ))];

  let gapped = item.texto;
  let desde = 0;
  const gaps = item.huecos.map((answer, i) => {
    const gapNum = i + 1;
    // Índice de palabra en el texto original (para position_in_text)
    const coincide = (w) => { const c = limpiar(w); return c === answer || c.split("'").pop() === answer; };
  const posPalabra = palabras.findIndex((w, k) => k >= desde && coincide(w));
    if (posPalabra === -1) throw new Error(`"${answer}" no encontrado en ${item.topic}`);
    desde = posPalabra + 1;

    // Sustituir esa ocurrencia exacta en el texto con huecos
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u');
    if (!re.test(gapped)) throw new Error(`regex falla para "${answer}" en ${item.topic}`);
    gapped = gapped.replace(re, `[___${gapNum}___]`);

    // 3 distractores del propio texto + la respuesta, barajados
    const pool = candidatos.filter(w => w !== answer);
    const opciones = [answer];
    while (opciones.length < 4 && pool.length) {
      const w = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      if (!opciones.includes(w)) opciones.push(w);
    }
    for (let k = opciones.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [opciones[k], opciones[j]] = [opciones[j], opciones[k]];
    }
    return { gap_number: gapNum, answer, position_in_text: posPalabra + 1, multiple_choice_options: opciones };
  });

  return {
    id: `fr-${idx + 1}`,
    letter: item.titulo[0].toUpperCase(),
    nivel: item.nivel,
    topic: item.topic,
    titulo: item.titulo,
    audioUrl: `/audio/fr/${item.topic}.mp3`,
    pageUrl: null,
    fullTranscript: item.texto,
    gappedTranscript: gapped,
    gaps,
  };
}

const construidos = ITEMS.map(construir);

const cab = `// BIBLIOTECA DE LISTENING EN FRANÇAIS — textos propios (piloto)
//
// Generado por scripts/generar-listening-fr.mjs — no editar a mano los huecos:
// cambia el texto o las palabras en el script y vuelve a ejecutarlo.
//
// audioUrl apunta a public/audio/fr/<topic>.mp3. Si el archivo no existe todavía,
// el reproductor lee el texto con la voz del navegador (fr-FR) automáticamente.

export const NIVELES_LISTENING_FR = [
    { id: null,      label: 'Tous les sujets', emoji: '📚', color: '#7f8c8d' },
    { id: 'A1-A2',   label: 'Débutant',        emoji: '🌱', color: '#27ae60' },
    { id: 'B1',      label: 'Intermédiaire',   emoji: '📖', color: '#2980b9' },
    { id: 'B2',      label: 'Avancé',          emoji: '🎓', color: '#8e44ad' },
];

export const LISTENING_ITEMS_FR = [
`;

const cuerpo = construidos.map(it => `  {
    id: ${JSON.stringify(it.id)},
    letter: ${JSON.stringify(it.letter)},
    nivel: ${JSON.stringify(it.nivel)},
    topic: ${JSON.stringify(it.topic)},
    titulo: ${JSON.stringify(it.titulo)},
    audioUrl: ${JSON.stringify(it.audioUrl)},
    pageUrl: null,
    fullTranscript: \`${it.fullTranscript.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\`,
    gappedTranscript: \`${it.gappedTranscript.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\`,
    gaps: ${JSON.stringify(it.gaps)},
  },`).join('\n');

fs.writeFileSync('src/BibliotecaListeningFR.js', cab + cuerpo + '\n];\n');
console.log('OK — ' + construidos.length + ' temas, huecos por tema: ' + construidos.map(i => i.gaps.length).join(','));
