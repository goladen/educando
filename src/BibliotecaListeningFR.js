// BIBLIOTECA DE LISTENING EN FRANÇAIS — textos propios (piloto)
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
  {
    id: "fr-1",
    letter: "L",
    nivel: "A1-A2",
    topic: "les-vacances",
    titulo: "Les vacances",
    audioUrl: "/audio/fr/les-vacances.mp3",
    pageUrl: null,
    fullTranscript: `J'adore les vacances. Chaque été, ma famille et moi partons au bord de la mer pendant deux semaines. Nous louons un petit appartement près de la plage. Le matin, je me lève tard et je prends mon petit-déjeuner sur le balcon. Ensuite, nous allons nager et nous jouons au volley sur le sable. Mon père préfère rester à l'ombre avec un livre. L'après-midi, nous visitons parfois un village ou un marché de la région. J'aime beaucoup goûter les plats typiques. Le soir, nous mangeons une glace et nous nous promenons dans les rues. L'année dernière, nous sommes allés à la montagne et c'était très différent, mais agréable aussi. Je crois que les vacances sont importantes parce qu'on oublie le stress de l'école et du travail.`,
    gappedTranscript: `J'adore les vacances. Chaque [___1___], ma famille et moi partons au bord de la mer pendant deux semaines. Nous louons un petit appartement près de la [___2___]. Le [___3___], je me lève tard et je prends mon petit-déjeuner sur le balcon. Ensuite, nous allons [___4___] et nous jouons au volley sur le sable. Mon père préfère rester à l'ombre avec un [___5___]. L'après-midi, nous visitons parfois un village ou un marché de la région. J'aime beaucoup goûter les plats typiques. Le soir, nous mangeons une [___6___] et nous nous promenons dans les rues. L'année dernière, nous sommes allés à la [___7___] et c'était très différent, mais agréable aussi. Je crois que les vacances sont importantes parce qu'on oublie le stress de l'école et du travail.`,
    gaps: [{"gap_number":1,"answer":"été","position_in_text":5,"multiple_choice_options":["prends","visitons","dernière","été"]},{"gap_number":2,"answer":"plage","position_in_text":27,"multiple_choice_options":["plage","semaines","région","oublie"]},{"gap_number":3,"answer":"matin","position_in_text":29,"multiple_choice_options":["matin","nous","stress","prends"]},{"gap_number":4,"answer":"nager","position_in_text":45,"multiple_choice_options":["petit-déjeuner","appartement","nager","marché"]},{"gap_number":5,"answer":"livre","position_in_text":62,"multiple_choice_options":["région","livre","très","vacances"]},{"gap_number":6,"answer":"glace","position_in_text":86,"multiple_choice_options":["partons","crois","glace","travail"]},{"gap_number":7,"answer":"montagne","position_in_text":101,"multiple_choice_options":["montagne","soir","aussi","sommes"]}],
  },
  {
    id: "fr-2",
    letter: "L",
    nivel: "A1-A2",
    topic: "le-petit-dejeuner",
    titulo: "Le petit-déjeuner",
    audioUrl: "/audio/fr/le-petit-dejeuner.mp3",
    pageUrl: null,
    fullTranscript: `Le matin, je n'ai jamais beaucoup de temps, mais je ne pars jamais sans petit-déjeuner. D'habitude, je bois un grand bol de chocolat chaud et je mange deux tartines avec du beurre et de la confiture. Le week-end, c'est différent : toute la famille mange ensemble et mon frère prépare des crêpes. Ma mère préfère le café et un yaourt avec des fruits. Elle dit que c'est meilleur pour la santé. En France, beaucoup de gens achètent des croissants à la boulangerie du quartier le dimanche. Moi, j'adore l'odeur du pain chaud. Quand j'étais petit, je ne mangeais rien avant l'école et j'avais toujours faim en classe. Maintenant, je sais que le petit-déjeuner est le repas le plus important de la journée.`,
    gappedTranscript: `Le matin, je n'ai jamais beaucoup de temps, mais je ne pars jamais sans petit-déjeuner. D'habitude, je bois un grand bol de [___1___] chaud et je mange deux [___2___] avec du beurre et de la confiture. Le week-end, c'est différent : toute la famille mange ensemble et mon frère prépare des [___3___]. Ma mère préfère le café et un [___4___] avec des fruits. Elle dit que c'est meilleur pour la santé. En France, beaucoup de gens achètent des croissants à la [___5___] du quartier le dimanche. Moi, j'adore l'odeur du [___6___] chaud. Quand j'étais petit, je ne mangeais rien avant l'école et j'avais toujours [___7___] en classe. Maintenant, je sais que le petit-déjeuner est le repas le plus important de la journée.`,
    gaps: [{"gap_number":1,"answer":"chocolat","position_in_text":23,"multiple_choice_options":["repas","chocolat","dimanche","beurre"]},{"gap_number":2,"answer":"tartines","position_in_text":29,"multiple_choice_options":["tartines","santé","fruits","confiture"]},{"gap_number":3,"answer":"crêpes","position_in_text":52,"multiple_choice_options":["crêpes","pars","temps","croissants"]},{"gap_number":4,"answer":"yaourt","position_in_text":60,"multiple_choice_options":["dimanche","yaourt","fruits","grand"]},{"gap_number":5,"answer":"boulangerie","position_in_text":82,"multiple_choice_options":["croissants","grand","toujours","boulangerie"]},{"gap_number":6,"answer":"pain","position_in_text":91,"multiple_choice_options":["pain","différent","frère","grand"]},{"gap_number":7,"answer":"faim","position_in_text":105,"multiple_choice_options":["faim","frère","plus","deux"]}],
  },
  {
    id: "fr-3",
    letter: "M",
    nivel: "A1-A2",
    topic: "mon-quartier",
    titulo: "Mon quartier",
    audioUrl: "/audio/fr/mon-quartier.mp3",
    pageUrl: null,
    fullTranscript: `J'habite dans un quartier tranquille, à vingt minutes du centre-ville. Il y a une grande place avec des arbres, une pharmacie, une boulangerie et un petit supermarché. En face de chez moi, il y a un parc où les enfants jouent au football après l'école. Le mardi, il y a un marché sur la place et tout le monde vient acheter des légumes et du fromage. Mes voisins sont sympathiques : ils se disent toujours bonjour. Le problème, c'est qu'il n'y a pas de cinéma et qu'il faut prendre le bus pour sortir le soir. Mon quartier a beaucoup changé depuis dix ans. Avant, il y avait moins de magasins, mais aussi moins de bruit. Malgré tout, je ne voudrais pas déménager.`,
    gappedTranscript: `J'habite dans un quartier [___1___], à vingt minutes du centre-ville. Il y a une grande place avec des arbres, une [___2___], une boulangerie et un petit supermarché. En face de chez moi, il y a un [___3___] où les enfants jouent au football après l'école. Le mardi, il y a un [___4___] sur la place et tout le monde vient acheter des légumes et du fromage. Mes [___5___] sont sympathiques : ils se disent toujours bonjour. Le problème, c'est qu'il n'y a pas de cinéma et qu'il faut prendre le [___6___] pour sortir le soir. Mon quartier a beaucoup changé depuis dix ans. Avant, il y avait moins de magasins, mais aussi moins de [___7___]. Malgré tout, je ne voudrais pas déménager.`,
    gaps: [{"gap_number":1,"answer":"tranquille","position_in_text":5,"multiple_choice_options":["tranquille","quartier","place","après"]},{"gap_number":2,"answer":"pharmacie","position_in_text":21,"multiple_choice_options":["place","prendre","sympathiques","pharmacie"]},{"gap_number":3,"answer":"parc","position_in_text":37,"multiple_choice_options":["petit","parc","depuis","place"]},{"gap_number":4,"answer":"marché","position_in_text":52,"multiple_choice_options":["dans","supermarché","marché","aussi"]},{"gap_number":5,"answer":"voisins","position_in_text":68,"multiple_choice_options":["mais","voisins","moins","mardi"]},{"gap_number":6,"answer":"bus","position_in_text":91,"multiple_choice_options":["changé","bus","avait","vient"]},{"gap_number":7,"answer":"bruit","position_in_text":115,"multiple_choice_options":["prendre","avec","face","bruit"]}],
  },
  {
    id: "fr-4",
    letter: "L",
    nivel: "A1-A2",
    topic: "les-animaux",
    titulo: "Les animaux de compagnie",
    audioUrl: "/audio/fr/les-animaux.mp3",
    pageUrl: null,
    fullTranscript: `Dans ma famille, nous avons toujours eu des animaux. En ce moment, nous avons un chien et deux chats. Le chien s'appelle Pepito et il est un peu bête, mais c'est le meilleur ami de ma petite sœur. Chaque soir, je dois le promener autour du parc, même quand il pleut. Les chats sont plus indépendants : ils dorment presque toute la journée sur le canapé. Beaucoup de gens pensent qu'un animal, c'est seulement pour jouer, mais c'est aussi une responsabilité. Il faut le nourrir, aller chez le vétérinaire et nettoyer la maison. Mes grands-parents ont un perroquet qui répète tous les mots qu'il entend. C'est drôle, mais parfois très fatigant. Je pense que vivre avec un animal rend les gens plus patients.`,
    gappedTranscript: `Dans ma famille, nous avons toujours eu des animaux. En ce moment, nous avons un [___1___] et deux chats. Le chien s'appelle Pepito et il est un peu bête, mais c'est le meilleur ami de ma petite sœur. Chaque soir, je dois le [___2___] autour du parc, même quand il pleut. Les chats sont plus indépendants : ils dorment presque toute la journée sur le [___3___]. Beaucoup de gens pensent qu'un animal, c'est seulement pour jouer, mais c'est aussi une [___4___]. Il faut le nourrir, aller chez le [___5___] et nettoyer la maison. Mes grands-parents ont un [___6___] qui répète tous les mots qu'il entend. C'est drôle, mais parfois très fatigant. Je pense que vivre avec un animal rend les gens plus [___7___].`,
    gaps: [{"gap_number":1,"answer":"chien","position_in_text":16,"multiple_choice_options":["quand","dorment","chien","autour"]},{"gap_number":2,"answer":"promener","position_in_text":44,"multiple_choice_options":["nourrir","animaux","pour","promener"]},{"gap_number":3,"answer":"canapé","position_in_text":66,"multiple_choice_options":["parc","jouer","canapé","seulement"]},{"gap_number":4,"answer":"responsabilité","position_in_text":81,"multiple_choice_options":["responsabilité","nettoyer","plus","faut"]},{"gap_number":5,"answer":"vétérinaire","position_in_text":89,"multiple_choice_options":["vétérinaire","moment","animal","rend"]},{"gap_number":6,"answer":"perroquet","position_in_text":98,"multiple_choice_options":["dois","perroquet","parc","aller"]},{"gap_number":7,"answer":"patients","position_in_text":123,"multiple_choice_options":["patients","avons","chats","pleut"]}],
  },
  {
    id: "fr-5",
    letter: "L",
    nivel: "B1",
    topic: "le-sport",
    titulo: "Le sport",
    audioUrl: "/audio/fr/le-sport.mp3",
    pageUrl: null,
    fullTranscript: `Je fais du sport trois fois par semaine parce que ça me détend après les cours. Le lundi et le jeudi, je vais à la piscine avec une amie, et le samedi matin, je joue au basket dans un club de mon quartier. Avant, je courais dans le parc, mais je me suis blessé au genou l'hiver dernier. Le médecin m'a dit de faire de la natation pendant quelques mois. Je regarde aussi beaucoup de sport à la télévision, surtout le football et le tennis. Mon père dit que regarder le sport, ce n'est pas faire du sport, et il a raison. Ce que j'aime le plus dans le sport, ce n'est pas gagner : c'est l'ambiance de l'équipe et l'impression d'être en bonne forme.`,
    gappedTranscript: `Je fais du sport trois fois par [___1___] parce que ça me détend après les cours. Le lundi et le jeudi, je vais à la [___2___] avec une amie, et le samedi matin, je joue au [___3___] dans un club de mon quartier. Avant, je courais dans le parc, mais je me suis blessé au [___4___] l'hiver dernier. Le médecin m'a dit de faire de la [___5___] pendant quelques mois. Je regarde aussi beaucoup de sport à la télévision, surtout le football et le [___6___]. Mon père dit que regarder le sport, ce n'est pas faire du sport, et il a raison. Ce que j'aime le plus dans le sport, ce n'est pas gagner : c'est l'ambiance de l'[___7___] et l'impression d'être en bonne forme.`,
    gaps: [{"gap_number":1,"answer":"semaine","position_in_text":8,"multiple_choice_options":["blessé","suis","semaine","médecin"]},{"gap_number":2,"answer":"piscine","position_in_text":26,"multiple_choice_options":["cours","parc","faire","piscine"]},{"gap_number":3,"answer":"basket","position_in_text":37,"multiple_choice_options":["parc","joue","basket","sport"]},{"gap_number":4,"answer":"genou","position_in_text":56,"multiple_choice_options":["dans","père","jeudi","genou"]},{"gap_number":5,"answer":"natation","position_in_text":67,"multiple_choice_options":["trois","natation","football","jeudi"]},{"gap_number":6,"answer":"tennis","position_in_text":85,"multiple_choice_options":["tennis","mois","beaucoup","plus"]},{"gap_number":7,"answer":"équipe","position_in_text":119,"multiple_choice_options":["équipe","regarder","médecin","dernier"]}],
  },
  {
    id: "fr-6",
    letter: "L",
    nivel: "B1",
    topic: "les-reseaux-sociaux",
    titulo: "Les réseaux sociaux",
    audioUrl: "/audio/fr/les-reseaux-sociaux.mp3",
    pageUrl: null,
    fullTranscript: `Je passe beaucoup trop de temps sur les réseaux sociaux. Le soir, je regarde des vidéos pendant des heures et après, je n'ai plus le temps de lire ou de sortir. Ce n'est pas toujours négatif : grâce à internet, je parle avec des amis qui habitent dans un autre pays et j'apprends des choses intéressantes. Le problème, c'est que tout le monde montre seulement les bons moments de sa vie. On compare notre vie réelle avec des photos parfaites et on se sent mal. Mes parents ne comprennent pas ce monde et ils pensent que c'est dangereux pour les jeunes. Depuis le mois dernier, j'ai supprimé deux applications de mon téléphone et je dors beaucoup mieux. Je crois qu'il faut apprendre à utiliser ces outils sans devenir dépendant.`,
    gappedTranscript: `Je passe beaucoup trop de temps sur les réseaux sociaux. Le soir, je regarde des [___1___] pendant des heures et après, je n'ai plus le temps de lire ou de sortir. Ce n'est pas toujours négatif : grâce à [___2___], je parle avec des amis qui habitent dans un autre [___3___] et j'apprends des choses intéressantes. Le problème, c'est que tout le monde montre seulement les bons moments de sa vie. On compare notre vie réelle avec des [___4___] parfaites et on se sent mal. Mes parents ne comprennent pas ce monde et ils pensent que c'est [___5___] pour les jeunes. Depuis le mois dernier, j'ai supprimé deux applications de mon [___6___] et je dors beaucoup mieux. Je crois qu'il faut apprendre à utiliser ces outils sans devenir [___7___].`,
    gaps: [{"gap_number":1,"answer":"vidéos","position_in_text":16,"multiple_choice_options":["vidéos","compare","crois","jeunes"]},{"gap_number":2,"answer":"internet","position_in_text":40,"multiple_choice_options":["comprennent","mieux","réelle","internet"]},{"gap_number":3,"answer":"pays","position_in_text":51,"multiple_choice_options":["regarde","pays","compare","monde"]},{"gap_number":4,"answer":"photos","position_in_text":79,"multiple_choice_options":["sociaux","pensent","toujours","photos"]},{"gap_number":5,"answer":"dangereux","position_in_text":98,"multiple_choice_options":["montre","faut","dangereux","soir"]},{"gap_number":6,"answer":"téléphone","position_in_text":112,"multiple_choice_options":["sociaux","négatif","téléphone","pendant"]},{"gap_number":7,"answer":"dépendant","position_in_text":129,"multiple_choice_options":["supprimé","passe","dépendant","sent"]}],
  },
];
