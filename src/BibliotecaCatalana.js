// ─────────────────────────────────────────────────────────────────────
// BIBLIOTECA DE SINTAXI CATALANA
// import { CATEGORIAS_CA, NIVELLS_CA, FRASES_CA } from './BibliotecaCatalana';
// ─────────────────────────────────────────────────────────────────────

const CATEGORIAS_CA = {
    "Subjecte":                { color: "#3498db", label: "Subjecte",       emoji: "👤", puntos: 15 },
    "Verb":                    { color: "#e74c3c", label: "Verb",            emoji: "⚡", puntos: 15 },
    "Complement Directe":      { color: "#2ecc71", label: "C. Directe",     emoji: "🎯", puntos: 10 },
    "Complement Indirecte":    { color: "#f39c12", label: "C. Indirecte",   emoji: "📬", puntos: 10 },
    "Complement Circumstancial":{ color: "#9b59b6", label: "C. Circumstancial", emoji: "🌍", puntos: 10 },
    "Atribut":                 { color: "#1abc9c", label: "Atribut",         emoji: "✨", puntos: 10 },
    "Complement Predicatiu":   { color: "#e67e22", label: "C. Predicatiu",  emoji: "🏷️", puntos: 10 },
    "Complement de Règim":     { color: "#c0392b", label: "C. Règim",        emoji: "🔗", puntos: 10 },
    "Complement Agent":        { color: "#16a085", label: "C. Agent",        emoji: "🧑‍💼", puntos: 10 },
};

const NIVELLS_CA = [
    { id: null,           label: "Tots",         emoji: "📚", color: "#7f8c8d" },
    { id: "primaria",     label: "Primària",     emoji: "🌱", color: "#27ae60" },
    { id: "eso",          label: "ESO",          emoji: "📖", color: "#2980b9" },
    { id: "batxillerat",  label: "Batxillerat",  emoji: "🎓", color: "#8e44ad" },
];

const FRASES_CA = [

// ══════════════════════════════════════════════════════
// PRIMÀRIA (id 1-40) — Subjecte + Verb + CD / CC bàsics
// ══════════════════════════════════════════════════════

{ id:1, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"gat",funcion:["Subjecte"]},
  {text:"dorm",funcion:["Verb"]},
  {text:"al",funcion:["Complement Circumstancial"]},{text:"sofà",funcion:["Complement Circumstancial"]}
]},
{ id:2, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"meu",funcion:["Subjecte"]},{text:"germà",funcion:["Subjecte"]},
  {text:"llegeix",funcion:["Verb"]},
  {text:"un",funcion:["Complement Directe"]},{text:"llibre",funcion:["Complement Directe"]}
]},
{ id:3, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"nena",funcion:["Subjecte"]},
  {text:"dibuixa",funcion:["Verb"]},
  {text:"flors",funcion:["Complement Directe"]}
]},
{ id:4, nivel:"primaria", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"ocells",funcion:["Subjecte"]},
  {text:"volen",funcion:["Verb"]},
  {text:"molt",funcion:["Complement Circumstancial"]},{text:"alt",funcion:["Complement Circumstancial"]}
]},
{ id:5, nivel:"primaria", tokens:[
  {text:"En",funcion:["Subjecte"]},{text:"Pere",funcion:["Subjecte"]},
  {text:"menja",funcion:["Verb"]},
  {text:"una",funcion:["Complement Directe"]},{text:"poma",funcion:["Complement Directe"]}
]},
{ id:6, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"mestra",funcion:["Subjecte"]},
  {text:"explica",funcion:["Verb"]},
  {text:"la",funcion:["Complement Directe"]},{text:"lliçó",funcion:["Complement Directe"]}
]},
{ id:7, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"gos",funcion:["Subjecte"]},
  {text:"mou",funcion:["Verb"]},
  {text:"la",funcion:["Complement Directe"]},{text:"cua",funcion:["Complement Directe"]}
]},
{ id:8, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"meva",funcion:["Subjecte"]},{text:"mare",funcion:["Subjecte"]},
  {text:"cuina",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"sopar",funcion:["Complement Directe"]}
]},
{ id:9, nivel:"primaria", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"nens",funcion:["Subjecte"]},
  {text:"corren",funcion:["Verb"]},
  {text:"pel",funcion:["Complement Circumstancial"]},{text:"parc",funcion:["Complement Circumstancial"]}
]},
{ id:10, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"sol",funcion:["Subjecte"]},
  {text:"brilla",funcion:["Verb"]},
  {text:"al",funcion:["Complement Circumstancial"]},{text:"cel",funcion:["Complement Circumstancial"]}
]},
{ id:11, nivel:"primaria", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"Anna",funcion:["Subjecte"]},
  {text:"estudia",funcion:["Verb"]},
  {text:"molt",funcion:["Complement Circumstancial"]}
]},
{ id:12, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"meu",funcion:["Subjecte"]},{text:"avi",funcion:["Subjecte"]},
  {text:"pesca",funcion:["Verb"]},
  {text:"al",funcion:["Complement Circumstancial"]},{text:"riu",funcion:["Complement Circumstancial"]}
]},
{ id:13, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"iaia",funcion:["Subjecte"]},
  {text:"teixeix",funcion:["Verb"]},
  {text:"un",funcion:["Complement Directe"]},{text:"jersei",funcion:["Complement Directe"]}
]},
{ id:14, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"bebè",funcion:["Subjecte"]},
  {text:"dorm",funcion:["Verb"]},
  {text:"al",funcion:["Complement Circumstancial"]},{text:"bressol",funcion:["Complement Circumstancial"]}
]},
{ id:15, nivel:"primaria", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"alumnes",funcion:["Subjecte"]},
  {text:"escolten",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"mestre",funcion:["Complement Directe"]}
]},
{ id:16, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"Maria",funcion:["Subjecte"]},
  {text:"pinta",funcion:["Verb"]},
  {text:"un",funcion:["Complement Directe"]},{text:"quadre",funcion:["Complement Directe"]},{text:"bonic",funcion:["Complement Directe"]}
]},
{ id:17, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"meu",funcion:["Subjecte"]},{text:"pare",funcion:["Subjecte"]},
  {text:"condueix",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"cotxe",funcion:["Complement Directe"]}
]},
{ id:18, nivel:"primaria", tokens:[
  {text:"En",funcion:["Subjecte"]},{text:"Jordi",funcion:["Subjecte"]},
  {text:"dóna",funcion:["Verb"]},
  {text:"un",funcion:["Complement Directe"]},{text:"regal",funcion:["Complement Directe"]},
  {text:"a",funcion:["Complement Indirecte"]},{text:"la",funcion:["Complement Indirecte"]},{text:"seva",funcion:["Complement Indirecte"]},{text:"germana",funcion:["Complement Indirecte"]}
]},
{ id:19, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"flor",funcion:["Subjecte"]},
  {text:"creix",funcion:["Verb"]},
  {text:"al",funcion:["Complement Circumstancial"]},{text:"jardí",funcion:["Complement Circumstancial"]}
]},
{ id:20, nivel:"primaria", tokens:[
  {text:"Nosaltres",funcion:["Subjecte"]},
  {text:"mirem",funcion:["Verb"]},
  {text:"la",funcion:["Complement Directe"]},{text:"televisió",funcion:["Complement Directe"]},
  {text:"al",funcion:["Complement Circumstancial"]},{text:"vespre",funcion:["Complement Circumstancial"]}
]},
{ id:21, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"cuiner",funcion:["Subjecte"]},
  {text:"prepara",funcion:["Verb"]},
  {text:"un",funcion:["Complement Directe"]},{text:"pastís",funcion:["Complement Directe"]},
  {text:"per",funcion:["Complement Indirecte"]},{text:"als",funcion:["Complement Indirecte"]},{text:"convidats",funcion:["Complement Indirecte"]}
]},
{ id:22, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"directora",funcion:["Subjecte"]},
  {text:"parla",funcion:["Verb"]},
  {text:"als",funcion:["Complement Indirecte"]},{text:"pares",funcion:["Complement Indirecte"]}
]},
{ id:23, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"vent",funcion:["Subjecte"]},
  {text:"bufa",funcion:["Verb"]},
  {text:"fort",funcion:["Complement Circumstancial"]},
  {text:"avui",funcion:["Complement Circumstancial"]}
]},
{ id:24, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"meva",funcion:["Subjecte"]},{text:"germana",funcion:["Subjecte"]},
  {text:"juga",funcion:["Verb"]},
  {text:"al",funcion:["Complement Circumstancial"]},{text:"parc",funcion:["Complement Circumstancial"]}
]},
{ id:25, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"metge",funcion:["Subjecte"]},
  {text:"cura",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"malalt",funcion:["Complement Directe"]},
  {text:"amb",funcion:["Complement Circumstancial"]},{text:"cura",funcion:["Complement Circumstancial"]}
]},
{ id:26, nivel:"primaria", tokens:[
  {text:"En",funcion:["Subjecte"]},{text:"Lluc",funcion:["Subjecte"]},
  {text:"truca",funcion:["Verb"]},
  {text:"a",funcion:["Complement Indirecte"]},{text:"la",funcion:["Complement Indirecte"]},{text:"seva",funcion:["Complement Indirecte"]},{text:"mare",funcion:["Complement Indirecte"]},
  {text:"cada",funcion:["Complement Circumstancial"]},{text:"vespre",funcion:["Complement Circumstancial"]}
]},
{ id:27, nivel:"primaria", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"turistes",funcion:["Subjecte"]},
  {text:"visiten",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"museu",funcion:["Complement Directe"]}
]},
{ id:28, nivel:"primaria", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"meva",funcion:["Subjecte"]},{text:"germana",funcion:["Subjecte"]},
  {text:"toca",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"piano",funcion:["Complement Directe"]}
]},
{ id:29, nivel:"primaria", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"Emma",funcion:["Subjecte"]},
  {text:"escriu",funcion:["Verb"]},
  {text:"una",funcion:["Complement Directe"]},{text:"carta",funcion:["Complement Directe"]},
  {text:"al",funcion:["Complement Indirecte"]},{text:"seu",funcion:["Complement Indirecte"]},{text:"amic",funcion:["Complement Indirecte"]}
]},
{ id:30, nivel:"primaria", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"meu",funcion:["Subjecte"]},{text:"amic",funcion:["Subjecte"]},
  {text:"viu",funcion:["Verb"]},
  {text:"a",funcion:["Complement Circumstancial"]},{text:"Barcelona",funcion:["Complement Circumstancial"]}
]},

// ══════════════════════════════════════════════════════
// ESO (id 101-160) — CD + CI + CC + Atribut + C. Règim
// ══════════════════════════════════════════════════════

{ id:101, nivel:"eso", tokens:[
  {text:"En",funcion:["Subjecte"]},{text:"Marc",funcion:["Subjecte"]},
  {text:"li",funcion:["Complement Indirecte"]},
  {text:"ha",funcion:["Verb"]},{text:"explicat",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"problema",funcion:["Complement Directe"]},
  {text:"al",funcion:["Complement Indirecte"]},{text:"seu",funcion:["Complement Indirecte"]},{text:"amic",funcion:["Complement Indirecte"]}
]},
{ id:102, nivel:"eso", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"professora",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"donat",funcion:["Verb"]},
  {text:"els",funcion:["Complement Directe"]},{text:"deures",funcion:["Complement Directe"]},
  {text:"als",funcion:["Complement Indirecte"]},{text:"alumnes",funcion:["Complement Indirecte"]}
]},
{ id:103, nivel:"eso", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"directora",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"comunicat",funcion:["Verb"]},
  {text:"la",funcion:["Complement Directe"]},{text:"notícia",funcion:["Complement Directe"]},
  {text:"a",funcion:["Complement Indirecte"]},{text:"les",funcion:["Complement Indirecte"]},{text:"famílies",funcion:["Complement Indirecte"]}
]},
{ id:104, nivel:"eso", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"noi",funcion:["Subjecte"]},
  {text:"és",funcion:["Verb"]},{text:"intel·ligent",funcion:["Atribut"]}
]},
{ id:105, nivel:"eso", tokens:[
  {text:"Barcelona",funcion:["Subjecte"]},
  {text:"és",funcion:["Verb"]},
  {text:"una",funcion:["Atribut"]},{text:"ciutat",funcion:["Atribut"]},{text:"meravellosa",funcion:["Atribut"]}
]},
{ id:106, nivel:"eso", tokens:[
  {text:"Aquesta",funcion:["Subjecte"]},{text:"sopa",funcion:["Subjecte"]},
  {text:"sembla",funcion:["Verb"]},
  {text:"deliciosa",funcion:["Atribut"]}
]},
{ id:107, nivel:"eso", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"alumnes",funcion:["Subjecte"]},
  {text:"han",funcion:["Verb"]},{text:"fet",funcion:["Verb"]},
  {text:"els",funcion:["Complement Directe"]},{text:"experiments",funcion:["Complement Directe"]},
  {text:"a",funcion:["Complement Circumstancial"]},{text:"classe",funcion:["Complement Circumstancial"]}
]},
{ id:108, nivel:"eso", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"capità",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"donat",funcion:["Verb"]},
  {text:"les",funcion:["Complement Directe"]},{text:"instruccions",funcion:["Complement Directe"]},
  {text:"a",funcion:["Complement Indirecte"]},{text:"la",funcion:["Complement Indirecte"]},{text:"tripulació",funcion:["Complement Indirecte"]}
]},
{ id:109, nivel:"eso", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"empresa",funcion:["Subjecte"]},
  {text:"ofereix",funcion:["Verb"]},
  {text:"descomptes",funcion:["Complement Directe"]},
  {text:"als",funcion:["Complement Indirecte"]},{text:"seus",funcion:["Complement Indirecte"]},{text:"clients",funcion:["Complement Indirecte"]}
]},
{ id:110, nivel:"eso", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"meu",funcion:["Subjecte"]},{text:"veí",funcion:["Subjecte"]},
  {text:"em",funcion:["Complement Indirecte"]},
  {text:"ha",funcion:["Verb"]},{text:"tornat",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"llibre",funcion:["Complement Directe"]},{text:"prestat",funcion:["Complement Directe"]}
]},
{ id:111, nivel:"eso", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"tècnic",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"reparat",funcion:["Verb"]},
  {text:"l'",funcion:["Complement Directe"]},{text:"ordinador",funcion:["Complement Directe"]},
  {text:"en",funcion:["Complement Circumstancial"]},{text:"poc",funcion:["Complement Circumstancial"]},{text:"temps",funcion:["Complement Circumstancial"]}
]},
{ id:112, nivel:"eso", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"artista",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"exposat",funcion:["Verb"]},
  {text:"les",funcion:["Complement Directe"]},{text:"seves",funcion:["Complement Directe"]},{text:"obres",funcion:["Complement Directe"]},
  {text:"a",funcion:["Complement Circumstancial"]},{text:"la",funcion:["Complement Circumstancial"]},{text:"galeria",funcion:["Complement Circumstancial"]}
]},
{ id:113, nivel:"eso", tokens:[
  {text:"En",funcion:["Subjecte"]},{text:"Joan",funcion:["Subjecte"]},
  {text:"parla",funcion:["Verb"]},
  {text:"de",funcion:["Complement de Règim"]},{text:"política",funcion:["Complement de Règim"]},
  {text:"sempre",funcion:["Complement Circumstancial"]}
]},
{ id:114, nivel:"eso", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"Marta",funcion:["Subjecte"]},
  {text:"confia",funcion:["Verb"]},
  {text:"en",funcion:["Complement de Règim"]},{text:"els",funcion:["Complement de Règim"]},{text:"seus",funcion:["Complement de Règim"]},{text:"amics",funcion:["Complement de Règim"]}
]},
{ id:115, nivel:"eso", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"govern",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"parlat",funcion:["Verb"]},
  {text:"de",funcion:["Complement de Règim"]},{text:"les",funcion:["Complement de Règim"]},{text:"noves",funcion:["Complement de Règim"]},{text:"mesures",funcion:["Complement de Règim"]}
]},
{ id:116, nivel:"eso", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"soldats",funcion:["Subjecte"]},
  {text:"han",funcion:["Verb"]},{text:"defensat",funcion:["Verb"]},
  {text:"la",funcion:["Complement Directe"]},{text:"ciutat",funcion:["Complement Directe"]},
  {text:"durant",funcion:["Complement Circumstancial"]},{text:"el",funcion:["Complement Circumstancial"]},{text:"setge",funcion:["Complement Circumstancial"]}
]},
{ id:117, nivel:"eso", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"casa",funcion:["Subjecte"]},
  {text:"és",funcion:["Verb"]},
  {text:"gran",funcion:["Atribut"]},
  {text:"i",funcion:["Atribut"]},{text:"lluminosa",funcion:["Atribut"]}
]},
{ id:118, nivel:"eso", tokens:[
  {text:"En",funcion:["Subjecte"]},{text:"Pau",funcion:["Subjecte"]},
  {text:"es",funcion:["Complement Circumstancial"]},{text:"queixa",funcion:["Verb"]},
  {text:"de",funcion:["Complement de Règim"]},{text:"tot",funcion:["Complement de Règim"]}
]},
{ id:119, nivel:"eso", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"noia",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"sortit",funcion:["Verb"]},
  {text:"de",funcion:["Complement Circumstancial"]},{text:"casa",funcion:["Complement Circumstancial"]},
  {text:"aviat",funcion:["Complement Circumstancial"]}
]},
{ id:120, nivel:"eso", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"nens",funcion:["Subjecte"]},
  {text:"semblen",funcion:["Verb"]},
  {text:"cansats",funcion:["Atribut"]}
]},

// ══════════════════════════════════════════════════════
// BATXILLERAT (id 201-240) — C. Predicatiu + C. Agent + passiva
// ══════════════════════════════════════════════════════

{ id:201, nivel:"batxillerat", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"novel·la",funcion:["Subjecte"]},
  {text:"va",funcion:["Verb"]},{text:"ser",funcion:["Verb"]},{text:"escrita",funcion:["Verb"]},
  {text:"per",funcion:["Complement Agent"]},{text:"un",funcion:["Complement Agent"]},{text:"autor",funcion:["Complement Agent"]},{text:"anònim",funcion:["Complement Agent"]}
]},
{ id:202, nivel:"batxillerat", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"edifici",funcion:["Subjecte"]},
  {text:"va",funcion:["Verb"]},{text:"ser",funcion:["Verb"]},{text:"construït",funcion:["Verb"]},
  {text:"per",funcion:["Complement Agent"]},{text:"un",funcion:["Complement Agent"]},{text:"arquitecte",funcion:["Complement Agent"]},{text:"famós",funcion:["Complement Agent"]}
]},
{ id:203, nivel:"batxillerat", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"premi",funcion:["Subjecte"]},
  {text:"va",funcion:["Verb"]},{text:"ser",funcion:["Verb"]},{text:"atorgat",funcion:["Verb"]},
  {text:"per",funcion:["Complement Agent"]},{text:"un",funcion:["Complement Agent"]},{text:"jurat",funcion:["Complement Agent"]},{text:"internacional",funcion:["Complement Agent"]}
]},
{ id:204, nivel:"batxillerat", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"han",funcion:["Verb"]},{text:"elegit",funcion:["Verb"]},
  {text:"president",funcion:["Complement Predicatiu"]},
  {text:"per",funcion:["Complement Circumstancial"]},{text:"majoria",funcion:["Complement Circumstancial"]}
]},
{ id:205, nivel:"batxillerat", tokens:[
  {text:"Han",funcion:["Verb"]},{text:"nomenat",funcion:["Verb"]},
  {text:"l'",funcion:["Complement Directe"]},{text:"arquitecta",funcion:["Complement Directe"]},
  {text:"directora",funcion:["Complement Predicatiu"]},
  {text:"del",funcion:["Complement Circumstancial"]},{text:"projecte",funcion:["Complement Circumstancial"]}
]},
{ id:206, nivel:"batxillerat", tokens:[
  {text:"Els",funcion:["Subjecte"]},{text:"científics",funcion:["Subjecte"]},
  {text:"han",funcion:["Verb"]},{text:"considerat",funcion:["Verb"]},
  {text:"el",funcion:["Complement Directe"]},{text:"descobriment",funcion:["Complement Directe"]},
  {text:"revolucionari",funcion:["Complement Predicatiu"]}
]},
{ id:207, nivel:"batxillerat", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"jutge",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"declarat",funcion:["Verb"]},
  {text:"l'",funcion:["Complement Directe"]},{text:"acusat",funcion:["Complement Directe"]},
  {text:"innocent",funcion:["Complement Predicatiu"]}
]},
{ id:208, nivel:"batxillerat", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"crisi",funcion:["Subjecte"]},
  {text:"ha",funcion:["Verb"]},{text:"afectat",funcion:["Verb"]},
  {text:"greument",funcion:["Complement Circumstancial"]},
  {text:"l'",funcion:["Complement Directe"]},{text:"economia",funcion:["Complement Directe"]},
  {text:"del",funcion:["Complement Circumstancial"]},{text:"país",funcion:["Complement Circumstancial"]}
]},
{ id:209, nivel:"batxillerat", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"empresa",funcion:["Subjecte"]},
  {text:"depèn",funcion:["Verb"]},
  {text:"de",funcion:["Complement de Règim"]},{text:"la",funcion:["Complement de Règim"]},{text:"inversió",funcion:["Complement de Règim"]},{text:"estrangera",funcion:["Complement de Règim"]}
]},
{ id:210, nivel:"batxillerat", tokens:[
  {text:"La",funcion:["Subjecte"]},{text:"sala",funcion:["Subjecte"]},
  {text:"va",funcion:["Verb"]},{text:"ser",funcion:["Verb"]},{text:"decorada",funcion:["Verb"]},
  {text:"per",funcion:["Complement Agent"]},{text:"l'",funcion:["Complement Agent"]},{text:"equip",funcion:["Complement Agent"]},{text:"de",funcion:["Complement Agent"]},{text:"disseny",funcion:["Complement Agent"]}
]},
{ id:211, nivel:"batxillerat", tokens:[
  {text:"El",funcion:["Subjecte"]},{text:"govern",funcion:["Subjecte"]},
  {text:"insisteix",funcion:["Verb"]},
  {text:"en",funcion:["Complement de Règim"]},{text:"la",funcion:["Complement de Règim"]},{text:"necessitat",funcion:["Complement de Règim"]},{text:"de",funcion:["Complement de Règim"]},{text:"reformes",funcion:["Complement de Règim"]}
]},
{ id:212, nivel:"batxillerat", tokens:[
  {text:"L'",funcion:["Subjecte"]},{text:"estudiant",funcion:["Subjecte"]},
  {text:"es",funcion:["Complement Predicatiu"]},{text:"va",funcion:["Verb"]},{text:"graduar",funcion:["Verb"]},
  {text:"el",funcion:["Complement Predicatiu"]},{text:"primer",funcion:["Complement Predicatiu"]},
  {text:"de",funcion:["Complement Circumstancial"]},{text:"la",funcion:["Complement Circumstancial"]},{text:"seva",funcion:["Complement Circumstancial"]},{text:"promoció",funcion:["Complement Circumstancial"]}
]},
];

export { CATEGORIAS_CA, NIVELLS_CA, FRASES_CA };
