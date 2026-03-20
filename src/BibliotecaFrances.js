// ─────────────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE SYNTAXE FRANÇAISE — éditable par le professeur
// Importar en SintaxisGamen2.jsx:
//   import { CATEGORIAS_FR, NIVELES_FR, FRASES_FR } from './BibliotecaFrances';
// ─────────────────────────────────────────────────────────────────────

// CATÉGORIES SYNTAXIQUES
const CATEGORIAS_FR = {
    "Sujet":      { color: "#3498db", label: "Sujet",   emoji: "👤", puntos: 15 },
    "Verbe":      { color: "#e74c3c", label: "Verbe",   emoji: "⚡", puntos: 15 },
    "COD":        { color: "#2ecc71", label: "COD",     emoji: "🎯", puntos: 10 },
    "COI":        { color: "#f39c12", label: "COI",     emoji: "📬", puntos: 10 },
    "CC":         { color: "#9b59b6", label: "CC",      emoji: "🌍", puntos: 10 },
    "Attribut":   { color: "#1abc9c", label: "Attribut",emoji: "✨", puntos: 10 },
    "Pronom":     { color: "#e67e22", label: "Pronom",  emoji: "🔄", puntos: 10 },
};

const NIVELES_FR = [
    { id: null,          label: "Tous",         emoji: "📚", color: "#7f8c8d" },
    { id: "debutant",    label: "Débutant",     emoji: "🌱", color: "#27ae60" },
    { id: "intermediaire", label: "Intermédiaire", emoji: "📖", color: "#2980b9" },
    { id: "avance",      label: "Avancé",       emoji: "🎓", color: "#8e44ad" },
];

// ─────────────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE PHRASES
// Chaque token: { text: string, funcion: string[] }
// nivel: 'debutant' | 'intermediaire' | 'avance'
//
// Structures travaillées :
//  - Débutant    : S + V + COD / COI / CC simples
//  - Intermédiaire: passé composé, pronoms y et en
//  - Avancé      : causales (parce que/car), finalité (pour/afin de),
//                  conséquence (donc/alors/si bien que), constructions complexes
// ─────────────────────────────────────────────────────────────────────
const FRASES_FR = [

// ══════════════════════════════════════════════════════
// DÉBUTANT (id 1-30) — Sujet + Verbe + COD / COI / CC
// ══════════════════════════════════════════════════════

{ id:1, nivel:"debutant", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"chat",funcion:["Sujet"]},
  {text:"dort",funcion:["Verbe"]},
  {text:"sur",funcion:["CC"]},{text:"le",funcion:["CC"]},{text:"canapé",funcion:["CC"]}
]},
{ id:2, nivel:"debutant", tokens:[
  {text:"Mon",funcion:["Sujet"]},{text:"frère",funcion:["Sujet"]},
  {text:"lit",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"livre",funcion:["COD"]}
]},
{ id:3, nivel:"debutant", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"fille",funcion:["Sujet"]},
  {text:"dessine",funcion:["Verbe"]},
  {text:"des",funcion:["COD"]},{text:"fleurs",funcion:["COD"]}
]},
{ id:4, nivel:"debutant", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"oiseaux",funcion:["Sujet"]},
  {text:"volent",funcion:["Verbe"]},
  {text:"très",funcion:["CC"]},{text:"haut",funcion:["CC"]}
]},
{ id:5, nivel:"debutant", tokens:[
  {text:"Pierre",funcion:["Sujet"]},
  {text:"mange",funcion:["Verbe"]},
  {text:"une",funcion:["COD"]},{text:"pomme",funcion:["COD"]}
]},
{ id:6, nivel:"debutant", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"maîtresse",funcion:["Sujet"]},
  {text:"explique",funcion:["Verbe"]},
  {text:"la",funcion:["COD"]},{text:"leçon",funcion:["COD"]}
]},
{ id:7, nivel:"debutant", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"chien",funcion:["Sujet"]},
  {text:"remue",funcion:["Verbe"]},
  {text:"la",funcion:["COD"]},{text:"queue",funcion:["COD"]}
]},
{ id:8, nivel:"debutant", tokens:[
  {text:"Ma",funcion:["Sujet"]},{text:"mère",funcion:["Sujet"]},
  {text:"cuisine",funcion:["Verbe"]},
  {text:"le",funcion:["COD"]},{text:"dîner",funcion:["COD"]}
]},
{ id:9, nivel:"debutant", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"enfants",funcion:["Sujet"]},
  {text:"courent",funcion:["Verbe"]},
  {text:"dans",funcion:["CC"]},{text:"le",funcion:["CC"]},{text:"parc",funcion:["CC"]}
]},
{ id:10, nivel:"debutant", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"soleil",funcion:["Sujet"]},
  {text:"brille",funcion:["Verbe"]},
  {text:"dans",funcion:["CC"]},{text:"le",funcion:["CC"]},{text:"ciel",funcion:["CC"]}
]},
{ id:11, nivel:"debutant", tokens:[
  {text:"Anne",funcion:["Sujet"]},
  {text:"étudie",funcion:["Verbe"]},
  {text:"beaucoup",funcion:["CC"]}
]},
{ id:12, nivel:"debutant", tokens:[
  {text:"Mon",funcion:["Sujet"]},{text:"grand-père",funcion:["Sujet"]},
  {text:"pêche",funcion:["Verbe"]},
  {text:"au",funcion:["CC"]},{text:"bord",funcion:["CC"]},{text:"de",funcion:["CC"]},{text:"la",funcion:["CC"]},{text:"rivière",funcion:["CC"]}
]},
{ id:13, nivel:"debutant", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"grand-mère",funcion:["Sujet"]},
  {text:"tricote",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"pull",funcion:["COD"]}
]},
{ id:14, nivel:"debutant", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"élèves",funcion:["Sujet"]},
  {text:"écoutent",funcion:["Verbe"]},
  {text:"le",funcion:["COD"]},{text:"professeur",funcion:["COD"]}
]},
{ id:15, nivel:"debutant", tokens:[
  {text:"Marie",funcion:["Sujet"]},
  {text:"peint",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"joli",funcion:["COD"]},{text:"tableau",funcion:["COD"]}
]},
{ id:16, nivel:"debutant", tokens:[
  {text:"Mon",funcion:["Sujet"]},{text:"père",funcion:["Sujet"]},
  {text:"conduit",funcion:["Verbe"]},
  {text:"la",funcion:["COD"]},{text:"voiture",funcion:["COD"]}
]},
{ id:17, nivel:"debutant", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"bébé",funcion:["Sujet"]},
  {text:"pleure",funcion:["Verbe"]},
  {text:"la",funcion:["CC"]},{text:"nuit",funcion:["CC"]}
]},
{ id:18, nivel:"debutant", tokens:[
  {text:"Julien",funcion:["Sujet"]},
  {text:"donne",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"cadeau",funcion:["COD"]},
  {text:"à",funcion:["COI"]},{text:"sa",funcion:["COI"]},{text:"sœur",funcion:["COI"]}
]},
{ id:19, nivel:"debutant", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"cuisinier",funcion:["Sujet"]},
  {text:"prépare",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"gâteau",funcion:["COD"]},
  {text:"pour",funcion:["COI"]},{text:"les",funcion:["COI"]},{text:"invités",funcion:["COI"]}
]},
{ id:20, nivel:"debutant", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"directrice",funcion:["Sujet"]},
  {text:"parle",funcion:["Verbe"]},
  {text:"aux",funcion:["COI"]},{text:"parents",funcion:["COI"]}
]},
{ id:21, nivel:"debutant", tokens:[
  {text:"Nous",funcion:["Sujet"]},
  {text:"regardons",funcion:["Verbe"]},
  {text:"la",funcion:["COD"]},{text:"télévision",funcion:["COD"]},
  {text:"le",funcion:["CC"]},{text:"soir",funcion:["CC"]}
]},
{ id:22, nivel:"debutant", tokens:[
  {text:"Mon",funcion:["Sujet"]},{text:"ami",funcion:["Sujet"]},
  {text:"habite",funcion:["Verbe"]},
  {text:"à",funcion:["CC"]},{text:"Paris",funcion:["CC"]}
]},
{ id:23, nivel:"debutant", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"fleur",funcion:["Sujet"]},
  {text:"pousse",funcion:["Verbe"]},
  {text:"dans",funcion:["CC"]},{text:"le",funcion:["CC"]},{text:"jardin",funcion:["CC"]}
]},
{ id:24, nivel:"debutant", tokens:[
  {text:"Vous",funcion:["Sujet"]},
  {text:"chantez",funcion:["Verbe"]},
  {text:"très",funcion:["CC"]},{text:"bien",funcion:["CC"]}
]},
{ id:25, nivel:"debutant", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"médecin",funcion:["Sujet"]},
  {text:"soigne",funcion:["Verbe"]},
  {text:"le",funcion:["COD"]},{text:"malade",funcion:["COD"]},
  {text:"avec",funcion:["CC"]},{text:"soin",funcion:["CC"]}
]},
{ id:26, nivel:"debutant", tokens:[
  {text:"Luc",funcion:["Sujet"]},
  {text:"téléphone",funcion:["Verbe"]},
  {text:"à",funcion:["COI"]},{text:"sa",funcion:["COI"]},{text:"mère",funcion:["COI"]},
  {text:"tous",funcion:["CC"]},{text:"les",funcion:["CC"]},{text:"soirs",funcion:["CC"]}
]},
{ id:27, nivel:"debutant", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"touristes",funcion:["Sujet"]},
  {text:"visitent",funcion:["Verbe"]},
  {text:"le",funcion:["COD"]},{text:"musée",funcion:["COD"]}
]},
{ id:28, nivel:"debutant", tokens:[
  {text:"Ma",funcion:["Sujet"]},{text:"sœur",funcion:["Sujet"]},
  {text:"joue",funcion:["Verbe"]},
  {text:"du",funcion:["COD"]},{text:"piano",funcion:["COD"]}
]},
{ id:29, nivel:"debutant", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"vent",funcion:["Sujet"]},
  {text:"souffle",funcion:["Verbe"]},
  {text:"fort",funcion:["CC"]},
  {text:"aujourd'hui",funcion:["CC"]}
]},
{ id:30, nivel:"debutant", tokens:[
  {text:"Emma",funcion:["Sujet"]},
  {text:"écrit",funcion:["Verbe"]},
  {text:"une",funcion:["COD"]},{text:"lettre",funcion:["COD"]},
  {text:"à",funcion:["COI"]},{text:"son",funcion:["COI"]},{text:"ami",funcion:["COI"]}
]},

// ══════════════════════════════════════════════════════
// INTERMÉDIAIRE (id 31-70) — Passé composé + pronoms y/en
// ══════════════════════════════════════════════════════

{ id:31, nivel:"intermediaire", tokens:[
  {text:"Marie",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"mangé",funcion:["Verbe"]},
  {text:"une",funcion:["COD"]},{text:"pomme",funcion:["COD"]}
]},
{ id:32, nivel:"intermediaire", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"enfants",funcion:["Sujet"]},
  {text:"ont",funcion:["Verbe"]},{text:"joué",funcion:["Verbe"]},
  {text:"dans",funcion:["CC"]},{text:"le",funcion:["CC"]},{text:"jardin",funcion:["CC"]}
]},
{ id:33, nivel:"intermediaire", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"est",funcion:["Verbe"]},{text:"parti",funcion:["Verbe"]},
  {text:"à",funcion:["CC"]},{text:"huit",funcion:["CC"]},{text:"heures",funcion:["CC"]}
]},
{ id:34, nivel:"intermediaire", tokens:[
  {text:"Nous",funcion:["Sujet"]},
  {text:"avons",funcion:["Verbe"]},{text:"visité",funcion:["Verbe"]},
  {text:"le",funcion:["COD"]},{text:"château",funcion:["COD"]},
  {text:"hier",funcion:["CC"]}
]},
{ id:35, nivel:"intermediaire", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"s'est",funcion:["Verbe"]},{text:"levée",funcion:["Verbe"]},
  {text:"tôt",funcion:["CC"]}
]},
{ id:36, nivel:"intermediaire", tokens:[
  {text:"Mon",funcion:["Sujet"]},{text:"père",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"acheté",funcion:["Verbe"]},
  {text:"une",funcion:["COD"]},{text:"nouvelle",funcion:["COD"]},{text:"voiture",funcion:["COD"]}
]},
{ id:37, nivel:"intermediaire", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"élèves",funcion:["Sujet"]},
  {text:"ont",funcion:["Verbe"]},{text:"terminé",funcion:["Verbe"]},
  {text:"leurs",funcion:["COD"]},{text:"devoirs",funcion:["COD"]},
  {text:"à",funcion:["CC"]},{text:"temps",funcion:["CC"]}
]},
{ id:38, nivel:"intermediaire", tokens:[
  {text:"Vous",funcion:["Sujet"]},
  {text:"êtes",funcion:["Verbe"]},{text:"arrivés",funcion:["Verbe"]},
  {text:"en",funcion:["CC"]},{text:"retard",funcion:["CC"]}
]},
{ id:39, nivel:"intermediaire", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"professeur",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"corrigé",funcion:["Verbe"]},
  {text:"les",funcion:["COD"]},{text:"copies",funcion:["COD"]},
  {text:"avec",funcion:["CC"]},{text:"soin",funcion:["CC"]}
]},
{ id:40, nivel:"intermediaire", tokens:[
  {text:"Ils",funcion:["Sujet"]},
  {text:"se",funcion:["COI"]},
  {text:"sont",funcion:["Verbe"]},{text:"parlé",funcion:["Verbe"]},
  {text:"au",funcion:["CC"]},{text:"téléphone",funcion:["CC"]}
]},
{ id:41, nivel:"intermediaire", tokens:[
  {text:"Jules",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"va",funcion:["Verbe"]},
  {text:"chaque",funcion:["CC"]},{text:"matin",funcion:["CC"]}
]},
{ id:42, nivel:"intermediaire", tokens:[
  {text:"Nous",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"avons",funcion:["Verbe"]},{text:"passé",funcion:["Verbe"]},
  {text:"une",funcion:["COD"]},{text:"semaine",funcion:["COD"]}
]},
{ id:43, nivel:"intermediaire", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"pense",funcion:["Verbe"]},
  {text:"souvent",funcion:["CC"]}
]},
{ id:44, nivel:"intermediaire", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"enfants",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"jouent",funcion:["Verbe"]},
  {text:"tous",funcion:["CC"]},{text:"les",funcion:["CC"]},{text:"jours",funcion:["CC"]}
]},
{ id:45, nivel:"intermediaire", tokens:[
  {text:"Tu",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"as",funcion:["Verbe"]},{text:"répondu",funcion:["Verbe"]},
  {text:"correctement",funcion:["CC"]}
]},
{ id:46, nivel:"intermediaire", tokens:[
  {text:"Paul",funcion:["Sujet"]},
  {text:"en",funcion:["Pronom"]},
  {text:"mange",funcion:["Verbe"]},
  {text:"chaque",funcion:["CC"]},{text:"jour",funcion:["CC"]}
]},
{ id:47, nivel:"intermediaire", tokens:[
  {text:"Je",funcion:["Sujet"]},
  {text:"n'",funcion:["CC"]},{text:"en",funcion:["Pronom"]},
  {text:"veux",funcion:["Verbe"]},
  {text:"plus",funcion:["CC"]}
]},
{ id:48, nivel:"intermediaire", tokens:[
  {text:"Ils",funcion:["Sujet"]},
  {text:"en",funcion:["Pronom"]},
  {text:"ont",funcion:["Verbe"]},{text:"parlé",funcion:["Verbe"]},
  {text:"hier",funcion:["CC"]}
]},
{ id:49, nivel:"intermediaire", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"en",funcion:["Pronom"]},
  {text:"a",funcion:["Verbe"]},{text:"acheté",funcion:["Verbe"]},
  {text:"beaucoup",funcion:["CC"]}
]},
{ id:50, nivel:"intermediaire", tokens:[
  {text:"Nous",funcion:["Sujet"]},
  {text:"en",funcion:["Pronom"]},
  {text:"avons",funcion:["Verbe"]},{text:"besoin",funcion:["Verbe"]}
]},
{ id:51, nivel:"intermediaire", tokens:[
  {text:"Lucie",funcion:["Sujet"]},
  {text:"lui",funcion:["COI"]},
  {text:"a",funcion:["Verbe"]},{text:"donné",funcion:["Verbe"]},
  {text:"son",funcion:["COD"]},{text:"numéro",funcion:["COD"]}
]},
{ id:52, nivel:"intermediaire", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"directeur",funcion:["Sujet"]},
  {text:"leur",funcion:["COI"]},
  {text:"a",funcion:["Verbe"]},{text:"expliqué",funcion:["Verbe"]},
  {text:"les",funcion:["COD"]},{text:"règles",funcion:["COD"]}
]},
{ id:53, nivel:"intermediaire", tokens:[
  {text:"Ma",funcion:["Sujet"]},{text:"mère",funcion:["Sujet"]},
  {text:"me",funcion:["COI"]},
  {text:"a",funcion:["Verbe"]},{text:"préparé",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"bon",funcion:["COD"]},{text:"repas",funcion:["COD"]}
]},
{ id:54, nivel:"intermediaire", tokens:[
  {text:"Mon",funcion:["Sujet"]},{text:"ami",funcion:["Sujet"]},
  {text:"m'",funcion:["COI"]},
  {text:"a",funcion:["Verbe"]},{text:"prêté",funcion:["Verbe"]},
  {text:"son",funcion:["COD"]},{text:"vélo",funcion:["COD"]}
]},
{ id:55, nivel:"intermediaire", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"garçon",funcion:["Sujet"]},
  {text:"est",funcion:["Verbe"]},{text:"intelligent",funcion:["Attribut"]}
]},
{ id:56, nivel:"intermediaire", tokens:[
  {text:"Paris",funcion:["Sujet"]},
  {text:"est",funcion:["Verbe"]},
  {text:"une",funcion:["Attribut"]},{text:"belle",funcion:["Attribut"]},{text:"ville",funcion:["Attribut"]}
]},
{ id:57, nivel:"intermediaire", tokens:[
  {text:"Cette",funcion:["Sujet"]},{text:"soupe",funcion:["Sujet"]},
  {text:"semble",funcion:["Verbe"]},
  {text:"délicieuse",funcion:["Attribut"]}
]},
{ id:58, nivel:"intermediaire", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"maison",funcion:["Sujet"]},
  {text:"est",funcion:["Verbe"]},
  {text:"grande",funcion:["Attribut"]},
  {text:"et",funcion:["Attribut"]},{text:"lumineuse",funcion:["Attribut"]}
]},
{ id:59, nivel:"intermediaire", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"résultats",funcion:["Sujet"]},
  {text:"paraissent",funcion:["Verbe"]},
  {text:"encourageants",funcion:["Attribut"]}
]},
{ id:60, nivel:"intermediaire", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"est",funcion:["Verbe"]},{text:"allé",funcion:["Verbe"]},
  {text:"à",funcion:["CC"]},{text:"pied",funcion:["CC"]}
]},

// ══════════════════════════════════════════════════════
// AVANCÉ (id 71-120) — Causales, finalité, conséquence
// ══════════════════════════════════════════════════════

{ id:71, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"reste",funcion:["Verbe"]},
  {text:"chez",funcion:["CC"]},{text:"lui",funcion:["CC"]},
  {text:"parce",funcion:["CC"]},{text:"qu'",funcion:["CC"]},{text:"il",funcion:["CC"]},{text:"est",funcion:["CC"]},{text:"malade",funcion:["CC"]}
]},
{ id:72, nivel:"avance", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"réussi",funcion:["Verbe"]},
  {text:"car",funcion:["CC"]},{text:"elle",funcion:["CC"]},{text:"a",funcion:["CC"]},{text:"travaillé",funcion:["CC"]},{text:"dur",funcion:["CC"]}
]},
{ id:73, nivel:"avance", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"routes",funcion:["Sujet"]},
  {text:"sont",funcion:["Verbe"]},{text:"bloquées",funcion:["Verbe"]},
  {text:"parce",funcion:["CC"]},{text:"qu'",funcion:["CC"]},{text:"il",funcion:["CC"]},{text:"a",funcion:["CC"]},{text:"neigé",funcion:["CC"]}
]},
{ id:74, nivel:"avance", tokens:[
  {text:"Je",funcion:["Sujet"]},
  {text:"suis",funcion:["Verbe"]},{text:"fatigué",funcion:["Attribut"]},
  {text:"car",funcion:["CC"]},{text:"je",funcion:["CC"]},{text:"n'",funcion:["CC"]},{text:"ai",funcion:["CC"]},{text:"pas",funcion:["CC"]},{text:"dormi",funcion:["CC"]}
]},
{ id:75, nivel:"avance", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"match",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"été",funcion:["Verbe"]},{text:"annulé",funcion:["Verbe"]},
  {text:"en",funcion:["CC"]},{text:"raison",funcion:["CC"]},{text:"de",funcion:["CC"]},{text:"la",funcion:["CC"]},{text:"pluie",funcion:["CC"]}
]},
{ id:76, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"travaille",funcion:["Verbe"]},
  {text:"pour",funcion:["CC"]},{text:"réussir",funcion:["CC"]},
  {text:"ses",funcion:["COD"]},{text:"examens",funcion:["COD"]}
]},
{ id:77, nivel:"avance", tokens:[
  {text:"Nous",funcion:["Sujet"]},
  {text:"partons",funcion:["Verbe"]},
  {text:"tôt",funcion:["CC"]},
  {text:"afin",funcion:["CC"]},{text:"d'",funcion:["CC"]},{text:"éviter",funcion:["CC"]},{text:"les",funcion:["CC"]},{text:"embouteillages",funcion:["CC"]}
]},
{ id:78, nivel:"avance", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"étudie",funcion:["Verbe"]},
  {text:"beaucoup",funcion:["CC"]},
  {text:"pour",funcion:["CC"]},{text:"obtenir",funcion:["CC"]},{text:"une",funcion:["CC"]},{text:"bonne",funcion:["CC"]},{text:"note",funcion:["CC"]}
]},
{ id:79, nivel:"avance", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"médecins",funcion:["Sujet"]},
  {text:"travaillent",funcion:["Verbe"]},
  {text:"sans",funcion:["CC"]},{text:"relâche",funcion:["CC"]},
  {text:"afin",funcion:["CC"]},{text:"de",funcion:["CC"]},{text:"sauver",funcion:["CC"]},{text:"des",funcion:["CC"]},{text:"vies",funcion:["CC"]}
]},
{ id:80, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"pris",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"parapluie",funcion:["COD"]},
  {text:"pour",funcion:["CC"]},{text:"ne",funcion:["CC"]},{text:"pas",funcion:["CC"]},{text:"se",funcion:["CC"]},{text:"mouiller",funcion:["CC"]}
]},
{ id:81, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"trop",funcion:["Verbe"]},{text:"mangé",funcion:["Verbe"]},
  {text:"donc",funcion:["CC"]},{text:"il",funcion:["CC"]},{text:"est",funcion:["CC"]},{text:"malade",funcion:["CC"]}
]},
{ id:82, nivel:"avance", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"travaillé",funcion:["Verbe"]},
  {text:"dur",funcion:["CC"]},
  {text:"alors",funcion:["CC"]},{text:"elle",funcion:["CC"]},{text:"a",funcion:["CC"]},{text:"réussi",funcion:["CC"]}
]},
{ id:83, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"plu",funcion:["Verbe"]},
  {text:"toute",funcion:["CC"]},{text:"la",funcion:["CC"]},{text:"nuit",funcion:["CC"]},
  {text:"si",funcion:["CC"]},{text:"bien",funcion:["CC"]},{text:"que",funcion:["CC"]},{text:"la",funcion:["CC"]},{text:"rue",funcion:["CC"]},{text:"était",funcion:["CC"]},{text:"inondée",funcion:["CC"]}
]},
{ id:84, nivel:"avance", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"tempête",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"été",funcion:["Verbe"]},{text:"violente",funcion:["Attribut"]},
  {text:"de",funcion:["CC"]},{text:"sorte",funcion:["CC"]},{text:"que",funcion:["CC"]},{text:"les",funcion:["CC"]},{text:"arbres",funcion:["CC"]},{text:"sont",funcion:["CC"]},{text:"tombés",funcion:["CC"]}
]},
{ id:85, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"était",funcion:["Verbe"]},{text:"épuisé",funcion:["Attribut"]},
  {text:"donc",funcion:["CC"]},{text:"il",funcion:["CC"]},{text:"s'",funcion:["CC"]},{text:"est",funcion:["CC"]},{text:"couché",funcion:["CC"]},{text:"tôt",funcion:["CC"]}
]},
{ id:86, nivel:"avance", tokens:[
  {text:"Les",funcion:["Sujet"]},{text:"enfants",funcion:["Sujet"]},
  {text:"ont",funcion:["Verbe"]},{text:"fait",funcion:["Verbe"]},
  {text:"du",funcion:["CC"]},{text:"bruit",funcion:["CC"]},
  {text:"alors",funcion:["CC"]},{text:"le",funcion:["CC"]},{text:"voisin",funcion:["CC"]},{text:"s'est",funcion:["CC"]},{text:"plaint",funcion:["CC"]}
]},
{ id:87, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"est",funcion:["Verbe"]},{text:"allé",funcion:["Verbe"]},
  {text:"parce",funcion:["CC"]},{text:"qu'",funcion:["CC"]},{text:"on",funcion:["CC"]},{text:"l'",funcion:["CC"]},{text:"avait",funcion:["CC"]},{text:"invité",funcion:["CC"]}
]},
{ id:88, nivel:"avance", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"en",funcion:["Pronom"]},
  {text:"a",funcion:["Verbe"]},{text:"acheté",funcion:["Verbe"]},
  {text:"plusieurs",funcion:["CC"]},
  {text:"car",funcion:["CC"]},{text:"c'",funcion:["CC"]},{text:"était",funcion:["CC"]},{text:"en",funcion:["CC"]},{text:"promotion",funcion:["CC"]}
]},
{ id:89, nivel:"avance", tokens:[
  {text:"Je",funcion:["Sujet"]},
  {text:"lui",funcion:["COI"]},
  {text:"ai",funcion:["Verbe"]},{text:"écrit",funcion:["Verbe"]},
  {text:"pour",funcion:["CC"]},{text:"qu'",funcion:["CC"]},{text:"il",funcion:["CC"]},{text:"comprenne",funcion:["CC"]},{text:"la",funcion:["CC"]},{text:"situation",funcion:["CC"]}
]},
{ id:90, nivel:"avance", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"gouvernement",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"pris",funcion:["Verbe"]},
  {text:"des",funcion:["COD"]},{text:"mesures",funcion:["COD"]},
  {text:"afin",funcion:["CC"]},{text:"de",funcion:["CC"]},{text:"réduire",funcion:["CC"]},{text:"la",funcion:["CC"]},{text:"pollution",funcion:["CC"]}
]},
{ id:91, nivel:"avance", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"chaleur",funcion:["Sujet"]},
  {text:"était",funcion:["Verbe"]},{text:"insupportable",funcion:["Attribut"]},
  {text:"si",funcion:["CC"]},{text:"bien",funcion:["CC"]},{text:"que",funcion:["CC"]},{text:"personne",funcion:["CC"]},{text:"ne",funcion:["CC"]},{text:"sortait",funcion:["CC"]}
]},
{ id:92, nivel:"avance", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"bruit",funcion:["Sujet"]},
  {text:"était",funcion:["Verbe"]},{text:"insupportable",funcion:["Attribut"]},
  {text:"alors",funcion:["CC"]},{text:"nous",funcion:["CC"]},{text:"avons",funcion:["CC"]},{text:"fermé",funcion:["CC"]},{text:"les",funcion:["CC"]},{text:"fenêtres",funcion:["CC"]}
]},
{ id:93, nivel:"avance", tokens:[
  {text:"Ils",funcion:["Sujet"]},
  {text:"se",funcion:["COI"]},
  {text:"sont",funcion:["Verbe"]},{text:"disputés",funcion:["Verbe"]},
  {text:"parce",funcion:["CC"]},{text:"qu'",funcion:["CC"]},{text:"ils",funcion:["CC"]},{text:"ne",funcion:["CC"]},{text:"s'",funcion:["CC"]},{text:"entendaient",funcion:["CC"]},{text:"pas",funcion:["CC"]}
]},
{ id:94, nivel:"avance", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"a",funcion:["Verbe"]},{text:"renoncé",funcion:["Verbe"]},
  {text:"car",funcion:["CC"]},{text:"c'",funcion:["CC"]},{text:"était",funcion:["CC"]},{text:"trop",funcion:["CC"]},{text:"difficile",funcion:["CC"]}
]},
{ id:95, nivel:"avance", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"professeur",funcion:["Sujet"]},
  {text:"en",funcion:["Pronom"]},
  {text:"a",funcion:["Verbe"]},{text:"parlé",funcion:["Verbe"]},
  {text:"afin",funcion:["CC"]},{text:"que",funcion:["CC"]},{text:"les",funcion:["CC"]},{text:"élèves",funcion:["CC"]},{text:"comprennent",funcion:["CC"]}
]},
{ id:96, nivel:"avance", tokens:[
  {text:"Le",funcion:["Sujet"]},{text:"train",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"été",funcion:["Verbe"]},{text:"annulé",funcion:["Verbe"]},
  {text:"donc",funcion:["CC"]},{text:"nous",funcion:["CC"]},{text:"avons",funcion:["CC"]},{text:"pris",funcion:["CC"]},{text:"l'",funcion:["CC"]},{text:"autobus",funcion:["CC"]}
]},
{ id:97, nivel:"avance", tokens:[
  {text:"Elle",funcion:["Sujet"]},
  {text:"lui",funcion:["COI"]},
  {text:"a",funcion:["Verbe"]},{text:"envoyé",funcion:["Verbe"]},
  {text:"un",funcion:["COD"]},{text:"message",funcion:["COD"]},
  {text:"pour",funcion:["CC"]},{text:"s'",funcion:["CC"]},{text:"excuser",funcion:["CC"]}
]},
{ id:98, nivel:"avance", tokens:[
  {text:"Nous",funcion:["Sujet"]},
  {text:"y",funcion:["Pronom"]},
  {text:"sommes",funcion:["Verbe"]},{text:"restés",funcion:["Verbe"]},
  {text:"afin",funcion:["CC"]},{text:"de",funcion:["CC"]},{text:"tout",funcion:["CC"]},{text:"vérifier",funcion:["CC"]}
]},
{ id:99, nivel:"avance", tokens:[
  {text:"Il",funcion:["Sujet"]},
  {text:"en",funcion:["Pronom"]},
  {text:"a",funcion:["Verbe"]},{text:"repris",funcion:["Verbe"]},
  {text:"deux",funcion:["CC"]},
  {text:"car",funcion:["CC"]},{text:"c'",funcion:["CC"]},{text:"était",funcion:["CC"]},{text:"délicieux",funcion:["CC"]}
]},
{ id:100, nivel:"avance", tokens:[
  {text:"La",funcion:["Sujet"]},{text:"réunion",funcion:["Sujet"]},
  {text:"a",funcion:["Verbe"]},{text:"été",funcion:["Verbe"]},{text:"reportée",funcion:["Verbe"]},
  {text:"de",funcion:["CC"]},{text:"sorte",funcion:["CC"]},{text:"que",funcion:["CC"]},{text:"tout",funcion:["CC"]},{text:"le",funcion:["CC"]},{text:"monde",funcion:["CC"]},{text:"a",funcion:["CC"]},{text:"pu",funcion:["CC"]},{text:"participer",funcion:["CC"]}
]},

];

// Exportations
export { CATEGORIAS_FR, NIVELES_FR, FRASES_FR };
