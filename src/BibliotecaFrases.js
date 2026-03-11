// ─────────────────────────────────────────────────────────────────────
// BIBLIOTECA DE SINTAXIS — editable por el profesor
// Importar en SintaxisGamen.jsx:
//   import { CATEGORIAS, NIVELES, FRASES } from './BibliotecaFrases';
// ─────────────────────────────────────────────────────────────────────

// CATEGORÍAS SINTÁCTICAS
const CATEGORIAS = {
    "Sujeto":                     { color: "#3498db", label: "Sujeto",            emoji: "👤", puntos: 15 },
    "Verbo":                      { color: "#e74c3c", label: "Verbo",              emoji: "⚡", puntos: 15 },
    "Complemento Directo":        { color: "#2ecc71", label: "C. Directo",         emoji: "🎯", puntos: 10 },
    "Complemento Indirecto":      { color: "#f39c12", label: "C. Indirecto",       emoji: "📬", puntos: 10 },
    "Complemento Circunstancial": { color: "#9b59b6", label: "C. Circunstancial",  emoji: "🌍", puntos: 10 },
    "Atributo":                   { color: "#1abc9c", label: "Atributo",           emoji: "✨", puntos: 10 },
    "Complemento Predicativo":    { color: "#e67e22", label: "C. Predicativo",     emoji: "🏷️", puntos: 10 },
    "Complemento de Régimen":     { color: "#c0392b", label: "C. Régimen",         emoji: "🔗", puntos: 10 },
    "Complemento Agente":         { color: "#16a085", label: "C. Agente",          emoji: "🧑‍💼", puntos: 10 },
};

const NIVELES = [
    { id: null,           label: "Todos",       emoji: "📚", color: "#7f8c8d" },
    { id: "primaria",     label: "Primaria",    emoji: "🌱", color: "#27ae60" },
    { id: "eso",          label: "ESO",         emoji: "📖", color: "#2980b9" },
    { id: "bachillerato", label: "Bachillerato",emoji: "🎓", color: "#8e44ad" },
];

// ─────────────────────────────────────────────────────────────────────
// BIBLIOTECA DE FRASES
// Cada token: { text: string, funcion: string[] }
// nivel: 'primaria' | 'eso' | 'bachillerato'
// ─────────────────────────────────────────────────────────────────────
const FRASES = [

// ══════════════════════════════════════════════
// PRIMARIA (id 1-150) — S + V + CD / CC básicos
// ══════════════════════════════════════════════

{ id:1, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"gato",funcion:["Sujeto"]},
  {text:"duerme",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"sofá",funcion:["Complemento Circunstancial"]}
]},
{ id:2, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"hermano",funcion:["Sujeto"]},
  {text:"lee",funcion:["Verbo"]},
  {text:"un",funcion:["Complemento Directo"]},{text:"libro",funcion:["Complemento Directo"]}
]},
{ id:3, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"niña",funcion:["Sujeto"]},
  {text:"dibuja",funcion:["Verbo"]},
  {text:"flores",funcion:["Complemento Directo"]}
]},
{ id:4, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"pájaros",funcion:["Sujeto"]},
  {text:"vuelan",funcion:["Verbo"]},
  {text:"muy",funcion:["Complemento Circunstancial"]},{text:"alto",funcion:["Complemento Circunstancial"]}
]},
{ id:5, nivel:"primaria", tokens:[
  {text:"Pedro",funcion:["Sujeto"]},
  {text:"come",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"manzana",funcion:["Complemento Directo"]}
]},
{ id:6, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"maestra",funcion:["Sujeto"]},
  {text:"explica",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"lección",funcion:["Complemento Directo"]}
]},
{ id:7, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"perro",funcion:["Sujeto"]},
  {text:"mueve",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"cola",funcion:["Complemento Directo"]}
]},
{ id:8, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"madre",funcion:["Sujeto"]},
  {text:"cocina",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"cena",funcion:["Complemento Directo"]}
]},
{ id:9, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"niños",funcion:["Sujeto"]},
  {text:"corren",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"parque",funcion:["Complemento Circunstancial"]}
]},
{ id:10, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"sol",funcion:["Sujeto"]},
  {text:"brilla",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"cielo",funcion:["Complemento Circunstancial"]}
]},
{ id:11, nivel:"primaria", tokens:[
  {text:"Ana",funcion:["Sujeto"]},
  {text:"estudia",funcion:["Verbo"]},
  {text:"mucho",funcion:["Complemento Circunstancial"]}
]},
{ id:12, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"abuelo",funcion:["Sujeto"]},
  {text:"pesca",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"río",funcion:["Complemento Circunstancial"]}
]},
{ id:13, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"abuela",funcion:["Sujeto"]},
  {text:"teje",funcion:["Verbo"]},
  {text:"un",funcion:["Complemento Directo"]},{text:"jersey",funcion:["Complemento Directo"]}
]},
{ id:14, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"bebé",funcion:["Sujeto"]},
  {text:"duerme",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"cuna",funcion:["Complemento Circunstancial"]}
]},
{ id:15, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"alumnos",funcion:["Sujeto"]},
  {text:"escuchan",funcion:["Verbo"]},
  {text:"al",funcion:["Complemento Directo"]},{text:"maestro",funcion:["Complemento Directo"]}
]},
{ id:16, nivel:"primaria", tokens:[
  {text:"María",funcion:["Sujeto"]},
  {text:"pinta",funcion:["Verbo"]},
  {text:"un",funcion:["Complemento Directo"]},{text:"cuadro",funcion:["Complemento Directo"]},{text:"bonito",funcion:["Complemento Directo"]}
]},
{ id:17, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"padre",funcion:["Sujeto"]},
  {text:"conduce",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"coche",funcion:["Complemento Directo"]}
]},
{ id:18, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"gato",funcion:["Sujeto"]},
  {text:"persigue",funcion:["Verbo"]},
  {text:"al",funcion:["Complemento Directo"]},{text:"ratón",funcion:["Complemento Directo"]}
]},
{ id:19, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"niños",funcion:["Sujeto"]},
  {text:"juegan",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"jardín",funcion:["Complemento Circunstancial"]}
]},
{ id:20, nivel:"primaria", tokens:[
  {text:"Rosa",funcion:["Sujeto"]},
  {text:"toca",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"piano",funcion:["Complemento Directo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"las",funcion:["Complemento Circunstancial"]},{text:"tardes",funcion:["Complemento Circunstancial"]}
]},
{ id:21, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"hermana",funcion:["Sujeto"]},
  {text:"bebe",funcion:["Verbo"]},
  {text:"leche",funcion:["Complemento Directo"]}
]},
{ id:22, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"peces",funcion:["Sujeto"]},
  {text:"nadan",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"agua",funcion:["Complemento Circunstancial"]}
]},
{ id:23, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"cartero",funcion:["Sujeto"]},
  {text:"reparte",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"cartas",funcion:["Complemento Directo"]}
]},
{ id:24, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"mariposa",funcion:["Sujeto"]},
  {text:"vuela",funcion:["Verbo"]},
  {text:"entre",funcion:["Complemento Circunstancial"]},{text:"las",funcion:["Complemento Circunstancial"]},{text:"flores",funcion:["Complemento Circunstancial"]}
]},
{ id:25, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"conejo",funcion:["Sujeto"]},
  {text:"come",funcion:["Verbo"]},
  {text:"zanahorias",funcion:["Complemento Directo"]}
]},
{ id:26, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"bomberos",funcion:["Sujeto"]},
  {text:"apagan",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"fuego",funcion:["Complemento Directo"]}
]},
{ id:27, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"primo",funcion:["Sujeto"]},
  {text:"juega",funcion:["Verbo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"balón",funcion:["Complemento Circunstancial"]}
]},
{ id:28, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"tren",funcion:["Sujeto"]},
  {text:"llega",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"estación",funcion:["Complemento Circunstancial"]}
]},
{ id:29, nivel:"primaria", tokens:[
  {text:"Lucía",funcion:["Sujeto"]},
  {text:"recoge",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"flores",funcion:["Complemento Directo"]},
  {text:"del",funcion:["Complemento Circunstancial"]},{text:"campo",funcion:["Complemento Circunstancial"]}
]},
{ id:30, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"cocinero",funcion:["Sujeto"]},
  {text:"prepara",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"paella",funcion:["Complemento Directo"]}
]},
{ id:31, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"astronautas",funcion:["Sujeto"]},
  {text:"viajan",funcion:["Verbo"]},
  {text:"al",funcion:["Complemento Circunstancial"]},{text:"espacio",funcion:["Complemento Circunstancial"]}
]},
{ id:32, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"niña",funcion:["Sujeto"]},
  {text:"abraza",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Directo"]},{text:"su",funcion:["Complemento Directo"]},{text:"muñeca",funcion:["Complemento Directo"]}
]},
{ id:33, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"jardinero",funcion:["Sujeto"]},
  {text:"riega",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"plantas",funcion:["Complemento Directo"]}
]},
{ id:34, nivel:"primaria", tokens:[
  {text:"Pedro",funcion:["Sujeto"]},
  {text:"ganó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"partido",funcion:["Complemento Directo"]},
  {text:"ayer",funcion:["Complemento Circunstancial"]}
]},
{ id:35, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"maestra",funcion:["Sujeto"]},
  {text:"corrige",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"exámenes",funcion:["Complemento Directo"]}
]},
{ id:36, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"panadero",funcion:["Sujeto"]},
  {text:"vende",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"pan",funcion:["Complemento Directo"]}
]},
{ id:37, nivel:"primaria", tokens:[
  {text:"Las",funcion:["Sujeto"]},{text:"flores",funcion:["Sujeto"]},
  {text:"huelen",funcion:["Verbo"]},
  {text:"muy",funcion:["Complemento Circunstancial"]},{text:"bien",funcion:["Complemento Circunstancial"]}
]},
{ id:38, nivel:"primaria", tokens:[
  {text:"Carlos",funcion:["Sujeto"]},
  {text:"escribe",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"carta",funcion:["Complemento Directo"]}
]},
{ id:39, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"policía",funcion:["Sujeto"]},
  {text:"dirige",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"tráfico",funcion:["Complemento Directo"]}
]},
{ id:40, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"hermano",funcion:["Sujeto"]},
  {text:"toca",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"guitarra",funcion:["Complemento Directo"]}
]},
{ id:41, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"niños",funcion:["Sujeto"]},
  {text:"cantan",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"coro",funcion:["Complemento Circunstancial"]}
]},
{ id:42, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"agua",funcion:["Sujeto"]},
  {text:"fluye",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"río",funcion:["Complemento Circunstancial"]}
]},
{ id:43, nivel:"primaria", tokens:[
  {text:"Papá",funcion:["Sujeto"]},
  {text:"trabaja",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"ciudad",funcion:["Complemento Circunstancial"]}
]},
{ id:44, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"abuela",funcion:["Sujeto"]},
  {text:"cuenta",funcion:["Verbo"]},
  {text:"cuentos",funcion:["Complemento Directo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"noche",funcion:["Complemento Circunstancial"]}
]},
{ id:45, nivel:"primaria", tokens:[
  {text:"Ana",funcion:["Sujeto"]},
  {text:"bebe",funcion:["Verbo"]},
  {text:"agua",funcion:["Complemento Directo"]},
  {text:"todos",funcion:["Complemento Circunstancial"]},{text:"los",funcion:["Complemento Circunstancial"]},{text:"días",funcion:["Complemento Circunstancial"]}
]},
{ id:46, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"médico",funcion:["Sujeto"]},
  {text:"atiende",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Directo"]},{text:"los",funcion:["Complemento Directo"]},{text:"enfermos",funcion:["Complemento Directo"]}
]},
{ id:47, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"árboles",funcion:["Sujeto"]},
  {text:"crecen",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"bosque",funcion:["Complemento Circunstancial"]}
]},
{ id:48, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"lluvia",funcion:["Sujeto"]},
  {text:"cae",funcion:["Verbo"]},
  {text:"del",funcion:["Complemento Circunstancial"]},{text:"cielo",funcion:["Complemento Circunstancial"]}
]},
{ id:49, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"carpintero",funcion:["Sujeto"]},
  {text:"fabrica",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"mesa",funcion:["Complemento Directo"]},{text:"grande",funcion:["Complemento Directo"]}
]},
{ id:50, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"amigo",funcion:["Sujeto"]},
  {text:"vive",funcion:["Verbo"]},
  {text:"cerca",funcion:["Complemento Circunstancial"]},{text:"del",funcion:["Complemento Circunstancial"]},{text:"colegio",funcion:["Complemento Circunstancial"]}
]},
{ id:51, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"bomberos",funcion:["Sujeto"]},
  {text:"rescatan",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Directo"]},{text:"las",funcion:["Complemento Directo"]},{text:"personas",funcion:["Complemento Directo"]}
]},
{ id:52, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"toro",funcion:["Sujeto"]},
  {text:"corre",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"pradera",funcion:["Complemento Circunstancial"]}
]},
{ id:53, nivel:"primaria", tokens:[
  {text:"Mamá",funcion:["Sujeto"]},
  {text:"compra",funcion:["Verbo"]},
  {text:"fruta",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"mercado",funcion:["Complemento Circunstancial"]}
]},
{ id:54, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"niño",funcion:["Sujeto"]},
  {text:"monta",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"bicicleta",funcion:["Complemento Circunstancial"]}
]},
{ id:55, nivel:"primaria", tokens:[
  {text:"Las",funcion:["Sujeto"]},{text:"vacas",funcion:["Sujeto"]},
  {text:"pastan",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"prado",funcion:["Complemento Circunstancial"]}
]},
{ id:56, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"profesor",funcion:["Sujeto"]},
  {text:"pone",funcion:["Verbo"]},
  {text:"deberes",funcion:["Complemento Directo"]}
]},
{ id:57, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"paloma",funcion:["Sujeto"]},
  {text:"bebe",funcion:["Verbo"]},
  {text:"agua",funcion:["Complemento Directo"]},
  {text:"de",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"fuente",funcion:["Complemento Circunstancial"]}
]},
{ id:58, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"tío",funcion:["Sujeto"]},
  {text:"arregla",funcion:["Verbo"]},
  {text:"coches",funcion:["Complemento Directo"]}
]},
{ id:59, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"delfines",funcion:["Sujeto"]},
  {text:"saltan",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"mar",funcion:["Complemento Circunstancial"]}
]},
{ id:60, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"maestro",funcion:["Sujeto"]},
  {text:"escribe",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"pizarra",funcion:["Complemento Circunstancial"]}
]},
{ id:61, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"cocinera",funcion:["Sujeto"]},
  {text:"prepara",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"menú",funcion:["Complemento Directo"]}
]},
{ id:62, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"alumnos",funcion:["Sujeto"]},
  {text:"recogen",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"mochilas",funcion:["Complemento Directo"]}
]},
{ id:63, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"barco",funcion:["Sujeto"]},
  {text:"navega",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"océano",funcion:["Complemento Circunstancial"]}
]},
{ id:64, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"perro",funcion:["Sujeto"]},
  {text:"ladra",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"las",funcion:["Complemento Circunstancial"]},{text:"noches",funcion:["Complemento Circunstancial"]}
]},
{ id:65, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"patitos",funcion:["Sujeto"]},
  {text:"siguen",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Directo"]},{text:"su",funcion:["Complemento Directo"]},{text:"madre",funcion:["Complemento Directo"]}
]},
{ id:66, nivel:"primaria", tokens:[
  {text:"Papá",funcion:["Sujeto"]},
  {text:"lee",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"periódico",funcion:["Complemento Directo"]},
  {text:"cada",funcion:["Complemento Circunstancial"]},{text:"mañana",funcion:["Complemento Circunstancial"]}
]},
{ id:67, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"hormiga",funcion:["Sujeto"]},
  {text:"carga",funcion:["Verbo"]},
  {text:"comida",funcion:["Complemento Directo"]}
]},
{ id:68, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"electricista",funcion:["Sujeto"]},
  {text:"repara",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"luz",funcion:["Complemento Directo"]}
]},
{ id:69, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"leones",funcion:["Sujeto"]},
  {text:"cazan",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"sabana",funcion:["Complemento Circunstancial"]}
]},
{ id:70, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"enfermera",funcion:["Sujeto"]},
  {text:"cuida",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Directo"]},{text:"los",funcion:["Complemento Directo"]},{text:"pacientes",funcion:["Complemento Directo"]}
]},
{ id:71, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"futbolista",funcion:["Sujeto"]},
  {text:"chuta",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"balón",funcion:["Complemento Directo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"fuerza",funcion:["Complemento Circunstancial"]}
]},
{ id:72, nivel:"primaria", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"gata",funcion:["Sujeto"]},
  {text:"duerme",funcion:["Verbo"]},
  {text:"sobre",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"alfombra",funcion:["Complemento Circunstancial"]}
]},
{ id:73, nivel:"primaria", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"pingüinos",funcion:["Sujeto"]},
  {text:"viven",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"Antártida",funcion:["Complemento Circunstancial"]}
]},
{ id:74, nivel:"primaria", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"costurera",funcion:["Sujeto"]},
  {text:"cose",funcion:["Verbo"]},
  {text:"un",funcion:["Complemento Directo"]},{text:"vestido",funcion:["Complemento Directo"]}
]},
{ id:75, nivel:"primaria", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"viento",funcion:["Sujeto"]},
  {text:"mueve",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"hojas",funcion:["Complemento Directo"]}
]},

// ══════════════════════════════════════════════
// ESO (id 101-275) — CD, CI y CC variados
// ══════════════════════════════════════════════

{ id:101, nivel:"eso", tokens:[
  {text:"María",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"regaló",funcion:["Verbo"]},
  {text:"un",funcion:["Complemento Directo"]},{text:"libro",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"su",funcion:["Complemento Indirecto"]},{text:"amigo",funcion:["Complemento Indirecto"]},
  {text:"ayer",funcion:["Complemento Circunstancial"]}
]},
{ id:102, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"profesor",funcion:["Sujeto"]},
  {text:"explica",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"tema",funcion:["Complemento Directo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"mucha",funcion:["Complemento Circunstancial"]},{text:"paciencia",funcion:["Complemento Circunstancial"]}
]},
{ id:103, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"estudiantes",funcion:["Sujeto"]},
  {text:"entregaron",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"deberes",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"profesor",funcion:["Complemento Indirecto"]}
]},
{ id:104, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"abuela",funcion:["Sujeto"]},
  {text:"me",funcion:["Complemento Indirecto"]},
  {text:"manda",funcion:["Verbo"]},
  {text:"cartas",funcion:["Complemento Directo"]},
  {text:"desde",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"pueblo",funcion:["Complemento Circunstancial"]}
]},
{ id:105, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"secretaria",funcion:["Sujeto"]},
  {text:"envía",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"documentos",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"clientes",funcion:["Complemento Indirecto"]}
]},
{ id:106, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"médico",funcion:["Sujeto"]},
  {text:"recetó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"medicamento",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"paciente",funcion:["Complemento Indirecto"]}
]},
{ id:107, nivel:"eso", tokens:[
  {text:"Mis",funcion:["Sujeto"]},{text:"padres",funcion:["Sujeto"]},
  {text:"me",funcion:["Complemento Indirecto"]},
  {text:"compraron",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"bicicleta",funcion:["Complemento Directo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"mi",funcion:["Complemento Circunstancial"]},{text:"cumpleaños",funcion:["Complemento Circunstancial"]}
]},
{ id:108, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"cocinera",funcion:["Sujeto"]},
  {text:"preparó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"menú",funcion:["Complemento Directo"]},
  {text:"para",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"invitados",funcion:["Complemento Indirecto"]}
]},
{ id:109, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"científicos",funcion:["Sujeto"]},
  {text:"descubrieron",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"nueva",funcion:["Complemento Directo"]},{text:"especie",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"selva",funcion:["Complemento Circunstancial"]}
]},
{ id:110, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"profesora",funcion:["Sujeto"]},
  {text:"devolvió",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"exámenes",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"alumnos",funcion:["Complemento Indirecto"]}
]},
{ id:111, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"hermana",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"dejó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"coche",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"su",funcion:["Complemento Indirecto"]},{text:"novio",funcion:["Complemento Indirecto"]}
]},
{ id:112, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"bomberos",funcion:["Sujeto"]},
  {text:"rescataron",funcion:["Verbo"]},
  {text:"al",funcion:["Complemento Directo"]},{text:"niño",funcion:["Complemento Directo"]},
  {text:"del",funcion:["Complemento Circunstancial"]},{text:"incendio",funcion:["Complemento Circunstancial"]}
]},
{ id:113, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"escritor",funcion:["Sujeto"]},
  {text:"publicó",funcion:["Verbo"]},
  {text:"su",funcion:["Complemento Directo"]},{text:"nueva",funcion:["Complemento Directo"]},{text:"novela",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"otoño",funcion:["Complemento Circunstancial"]}
]},
{ id:114, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"madre",funcion:["Sujeto"]},
  {text:"me",funcion:["Complemento Indirecto"]},
  {text:"prepara",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"merienda",funcion:["Complemento Directo"]},
  {text:"todos",funcion:["Complemento Circunstancial"]},{text:"los",funcion:["Complemento Circunstancial"]},{text:"días",funcion:["Complemento Circunstancial"]}
]},
{ id:115, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"atletas",funcion:["Sujeto"]},
  {text:"entrenaron",funcion:["Verbo"]},
  {text:"durante",funcion:["Complemento Circunstancial"]},{text:"horas",funcion:["Complemento Circunstancial"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"estadio",funcion:["Complemento Circunstancial"]}
]},
{ id:116, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"periodista",funcion:["Sujeto"]},
  {text:"entrevistó",funcion:["Verbo"]},
  {text:"al",funcion:["Complemento Directo"]},{text:"político",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"televisión",funcion:["Complemento Circunstancial"]}
]},
{ id:117, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"cocinero",funcion:["Sujeto"]},
  {text:"sirvió",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"cena",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"comensales",funcion:["Complemento Indirecto"]}
]},
{ id:118, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"orquesta",funcion:["Sujeto"]},
  {text:"interpretó",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"sinfonía",funcion:["Complemento Directo"]},
  {text:"para",funcion:["Complemento Indirecto"]},{text:"el",funcion:["Complemento Indirecto"]},{text:"público",funcion:["Complemento Indirecto"]}
]},
{ id:119, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"alumnos",funcion:["Sujeto"]},
  {text:"resolvieron",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"problema",funcion:["Complemento Directo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"dificultad",funcion:["Complemento Circunstancial"]}
]},
{ id:120, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"tío",funcion:["Sujeto"]},
  {text:"me",funcion:["Complemento Indirecto"]},
  {text:"prestó",funcion:["Verbo"]},
  {text:"dinero",funcion:["Complemento Directo"]},
  {text:"para",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"viaje",funcion:["Complemento Circunstancial"]}
]},
{ id:121, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"policía",funcion:["Sujeto"]},
  {text:"detuvo",funcion:["Verbo"]},
  {text:"al",funcion:["Complemento Directo"]},{text:"ladrón",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"centro",funcion:["Complemento Circunstancial"]}
]},
{ id:122, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"niños",funcion:["Sujeto"]},
  {text:"contaron",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"secreto",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"sus",funcion:["Complemento Indirecto"]},{text:"amigos",funcion:["Complemento Indirecto"]}
]},
{ id:123, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"pintor",funcion:["Sujeto"]},
  {text:"decoró",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"sala",funcion:["Complemento Directo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"cuadros",funcion:["Complemento Circunstancial"]},{text:"hermosos",funcion:["Complemento Circunstancial"]}
]},
{ id:124, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"cartero",funcion:["Sujeto"]},
  {text:"entregó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"paquete",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"la",funcion:["Complemento Indirecto"]},{text:"vecina",funcion:["Complemento Indirecto"]}
]},
{ id:125, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"turistas",funcion:["Sujeto"]},
  {text:"visitaron",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"museo",funcion:["Complemento Directo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"gran",funcion:["Complemento Circunstancial"]},{text:"interés",funcion:["Complemento Circunstancial"]}
]},
{ id:126, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"profesora",funcion:["Sujeto"]},
  {text:"nos",funcion:["Complemento Indirecto"]},
  {text:"explicó",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"gramática",funcion:["Complemento Directo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"ejemplos",funcion:["Complemento Circunstancial"]}
]},
{ id:127, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"empresa",funcion:["Sujeto"]},
  {text:"pagó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"salario",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"sus",funcion:["Complemento Indirecto"]},{text:"empleados",funcion:["Complemento Indirecto"]}
]},
{ id:128, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"árbitro",funcion:["Sujeto"]},
  {text:"mostró",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"tarjeta",funcion:["Complemento Directo"]},{text:"roja",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"jugador",funcion:["Complemento Indirecto"]}
]},
{ id:129, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"madre",funcion:["Sujeto"]},
  {text:"leyó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"cuento",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"su",funcion:["Complemento Indirecto"]},{text:"hijo",funcion:["Complemento Indirecto"]},{text:"pequeño",funcion:["Complemento Indirecto"]}
]},
{ id:130, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"investigadores",funcion:["Sujeto"]},
  {text:"analizaron",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"muestras",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"laboratorio",funcion:["Complemento Circunstancial"]}
]},
{ id:131, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"hermano",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"dio",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"regalo",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"mamá",funcion:["Complemento Indirecto"]}
]},
{ id:132, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"soldados",funcion:["Sujeto"]},
  {text:"defendieron",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"ciudad",funcion:["Complemento Directo"]},
  {text:"durante",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"asedio",funcion:["Complemento Circunstancial"]}
]},
{ id:133, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"directora",funcion:["Sujeto"]},
  {text:"comunicó",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"noticia",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"las",funcion:["Complemento Indirecto"]},{text:"familias",funcion:["Complemento Indirecto"]}
]},
{ id:134, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"capitán",funcion:["Sujeto"]},
  {text:"dio",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"instrucciones",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"la",funcion:["Complemento Indirecto"]},{text:"tripulación",funcion:["Complemento Indirecto"]}
]},
{ id:135, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"alumnos",funcion:["Sujeto"]},
  {text:"hicieron",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"experimentos",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"clase",funcion:["Complemento Circunstancial"]}
]},
{ id:136, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"técnico",funcion:["Sujeto"]},
  {text:"reparó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"ordenador",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"poco",funcion:["Complemento Circunstancial"]},{text:"tiempo",funcion:["Complemento Circunstancial"]}
]},
{ id:137, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"artista",funcion:["Sujeto"]},
  {text:"expuso",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"obras",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"galería",funcion:["Complemento Circunstancial"]}
]},
{ id:138, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"vecino",funcion:["Sujeto"]},
  {text:"me",funcion:["Complemento Indirecto"]},
  {text:"devolvió",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"libro",funcion:["Complemento Directo"]},{text:"prestado",funcion:["Complemento Directo"]}
]},
{ id:139, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"alcalde",funcion:["Sujeto"]},
  {text:"inauguró",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"nuevo",funcion:["Complemento Directo"]},{text:"parque",funcion:["Complemento Directo"]},
  {text:"esta",funcion:["Complemento Circunstancial"]},{text:"mañana",funcion:["Complemento Circunstancial"]}
]},
{ id:140, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"empresa",funcion:["Sujeto"]},
  {text:"ofrece",funcion:["Verbo"]},
  {text:"descuentos",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"sus",funcion:["Complemento Indirecto"]},{text:"clientes",funcion:["Complemento Indirecto"]},{text:"fieles",funcion:["Complemento Indirecto"]}
]},
{ id:141, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"director",funcion:["Sujeto"]},
  {text:"convocó",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Directo"]},{text:"los",funcion:["Complemento Directo"]},{text:"alumnos",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"patio",funcion:["Complemento Circunstancial"]}
]},
{ id:142, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"trabajadores",funcion:["Sujeto"]},
  {text:"construyen",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"puente",funcion:["Complemento Directo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"mucho",funcion:["Complemento Circunstancial"]},{text:"esfuerzo",funcion:["Complemento Circunstancial"]}
]},
{ id:143, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"estudiante",funcion:["Sujeto"]},
  {text:"presentó",funcion:["Verbo"]},
  {text:"su",funcion:["Complemento Directo"]},{text:"trabajo",funcion:["Complemento Directo"]},
  {text:"ante",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"clase",funcion:["Complemento Circunstancial"]}
]},
{ id:144, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"guía",funcion:["Sujeto"]},
  {text:"mostró",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"monumentos",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"visitantes",funcion:["Complemento Indirecto"]}
]},
{ id:145, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"abuela",funcion:["Sujeto"]},
  {text:"nos",funcion:["Complemento Indirecto"]},
  {text:"enseñó",funcion:["Verbo"]},
  {text:"recetas",funcion:["Complemento Directo"]},{text:"de",funcion:["Complemento Directo"]},{text:"cocina",funcion:["Complemento Directo"]}
]},
{ id:146, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"juez",funcion:["Sujeto"]},
  {text:"leyó",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"sentencia",funcion:["Complemento Directo"]},
  {text:"ante",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"acusado",funcion:["Complemento Circunstancial"]}
]},
{ id:147, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"escritor",funcion:["Sujeto"]},
  {text:"firmó",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"libros",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"aficionados",funcion:["Complemento Indirecto"]}
]},
{ id:148, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"marineros",funcion:["Sujeto"]},
  {text:"avistaron",funcion:["Verbo"]},
  {text:"tierra",funcion:["Complemento Directo"]},
  {text:"después",funcion:["Complemento Circunstancial"]},{text:"de",funcion:["Complemento Circunstancial"]},{text:"semanas",funcion:["Complemento Circunstancial"]}
]},
{ id:149, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"editorial",funcion:["Sujeto"]},
  {text:"publicó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"libro",funcion:["Complemento Directo"]},{text:"del",funcion:["Complemento Directo"]},{text:"poeta",funcion:["Complemento Directo"]}
]},
{ id:150, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"vecinos",funcion:["Sujeto"]},
  {text:"protestaron",funcion:["Verbo"]},
  {text:"contra",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"ruido",funcion:["Complemento Circunstancial"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"noche",funcion:["Complemento Circunstancial"]}
]},
{ id:151, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"abuelo",funcion:["Sujeto"]},
  {text:"nos",funcion:["Complemento Indirecto"]},
  {text:"contó",funcion:["Verbo"]},
  {text:"historias",funcion:["Complemento Directo"]},
  {text:"de",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"guerra",funcion:["Complemento Circunstancial"]}
]},
{ id:152, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"monitora",funcion:["Sujeto"]},
  {text:"enseñó",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"normas",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"participantes",funcion:["Complemento Indirecto"]}
]},
{ id:153, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"banco",funcion:["Sujeto"]},
  {text:"prestó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"dinero",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"la",funcion:["Complemento Indirecto"]},{text:"familia",funcion:["Complemento Indirecto"]}
]},
{ id:154, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"expedicionarios",funcion:["Sujeto"]},
  {text:"alcanzaron",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"cima",funcion:["Complemento Directo"]},
  {text:"tras",funcion:["Complemento Circunstancial"]},{text:"varios",funcion:["Complemento Circunstancial"]},{text:"días",funcion:["Complemento Circunstancial"]}
]},
{ id:155, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"cocinero",funcion:["Sujeto"]},
  {text:"añadió",funcion:["Verbo"]},
  {text:"sal",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"caldo",funcion:["Complemento Indirecto"]}
]},
{ id:156, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"actriz",funcion:["Sujeto"]},
  {text:"dedicó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"premio",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"su",funcion:["Complemento Indirecto"]},{text:"familia",funcion:["Complemento Indirecto"]}
]},
{ id:157, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"voluntarios",funcion:["Sujeto"]},
  {text:"repartieron",funcion:["Verbo"]},
  {text:"comida",funcion:["Complemento Directo"]},
  {text:"entre",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"necesitados",funcion:["Complemento Indirecto"]}
]},
{ id:158, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"entrenador",funcion:["Sujeto"]},
  {text:"explicó",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"táctica",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"jugadores",funcion:["Complemento Indirecto"]}
]},
{ id:159, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"enfermera",funcion:["Sujeto"]},
  {text:"puso",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"inyección",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"paciente",funcion:["Complemento Indirecto"]}
]},
{ id:160, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"fontanero",funcion:["Sujeto"]},
  {text:"arregló",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"tubería",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"una",funcion:["Complemento Circunstancial"]},{text:"hora",funcion:["Complemento Circunstancial"]}
]},
{ id:161, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"estudiantes",funcion:["Sujeto"]},
  {text:"organizaron",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"fiesta",funcion:["Complemento Directo"]},
  {text:"para",funcion:["Complemento Indirecto"]},{text:"el",funcion:["Complemento Indirecto"]},{text:"profesor",funcion:["Complemento Indirecto"]}
]},
{ id:162, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"arquitecta",funcion:["Sujeto"]},
  {text:"diseñó",funcion:["Verbo"]},
  {text:"un",funcion:["Complemento Directo"]},{text:"edificio",funcion:["Complemento Directo"]},{text:"moderno",funcion:["Complemento Directo"]},
  {text:"para",funcion:["Complemento Indirecto"]},{text:"el",funcion:["Complemento Indirecto"]},{text:"ayuntamiento",funcion:["Complemento Indirecto"]}
]},
{ id:163, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"dependiente",funcion:["Sujeto"]},
  {text:"cobró",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"pedido",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"cliente",funcion:["Complemento Indirecto"]}
]},
{ id:164, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"bomberos",funcion:["Sujeto"]},
  {text:"extinguieron",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"incendio",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"pocas",funcion:["Complemento Circunstancial"]},{text:"horas",funcion:["Complemento Circunstancial"]}
]},
{ id:165, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"diseñadora",funcion:["Sujeto"]},
  {text:"presentó",funcion:["Verbo"]},
  {text:"su",funcion:["Complemento Directo"]},{text:"colección",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"París",funcion:["Complemento Circunstancial"]}
]},
{ id:166, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"maestro",funcion:["Sujeto"]},
  {text:"felicitó",funcion:["Verbo"]},
  {text:"al",funcion:["Complemento Directo"]},{text:"alumno",funcion:["Complemento Directo"]},
  {text:"delante",funcion:["Complemento Circunstancial"]},{text:"de",funcion:["Complemento Circunstancial"]},{text:"todos",funcion:["Complemento Circunstancial"]}
]},
{ id:167, nivel:"eso", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"científicos",funcion:["Sujeto"]},
  {text:"publicaron",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"hallazgos",funcion:["Complemento Directo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"una",funcion:["Complemento Circunstancial"]},{text:"revista",funcion:["Complemento Circunstancial"]}
]},
{ id:168, nivel:"eso", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"jueza",funcion:["Sujeto"]},
  {text:"dictó",funcion:["Verbo"]},
  {text:"la",funcion:["Complemento Directo"]},{text:"sentencia",funcion:["Complemento Directo"]},
  {text:"tras",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"juicio",funcion:["Complemento Circunstancial"]}
]},
{ id:169, nivel:"eso", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"mecánico",funcion:["Sujeto"]},
  {text:"revisó",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"frenos",funcion:["Complemento Directo"]},
  {text:"del",funcion:["Complemento Circunstancial"]},{text:"coche",funcion:["Complemento Circunstancial"]}
]},
{ id:170, nivel:"eso", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"prima",funcion:["Sujeto"]},
  {text:"me",funcion:["Complemento Indirecto"]},
  {text:"envió",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"postal",funcion:["Complemento Directo"]},
  {text:"desde",funcion:["Complemento Circunstancial"]},{text:"Roma",funcion:["Complemento Circunstancial"]}
]},

// ══════════════════════════════════════════════════════
// BACHILLERATO (id 301-500) — Atributo, C. Predicativo,
// C. Régimen, C. Agente, estructuras complejas
// ══════════════════════════════════════════════════════

{ id:301, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"cielo",funcion:["Sujeto"]},
  {text:"estaba",funcion:["Verbo"]},
  {text:"muy",funcion:["Atributo"]},{text:"azul",funcion:["Atributo"]},
  {text:"aquella",funcion:["Complemento Circunstancial"]},{text:"tarde",funcion:["Complemento Circunstancial"]}
]},
{ id:302, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"alumnos",funcion:["Sujeto"]},
  {text:"parecen",funcion:["Verbo"]},
  {text:"cansados",funcion:["Atributo"]},
  {text:"después",funcion:["Complemento Circunstancial"]},{text:"del",funcion:["Complemento Circunstancial"]},{text:"examen",funcion:["Complemento Circunstancial"]}
]},
{ id:303, nivel:"bachillerato", tokens:[
  {text:"Mi",funcion:["Sujeto"]},{text:"amiga",funcion:["Sujeto"]},
  {text:"es",funcion:["Verbo"]},
  {text:"médica",funcion:["Atributo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"un",funcion:["Complemento Circunstancial"]},{text:"hospital",funcion:["Complemento Circunstancial"]}
]},
{ id:304, nivel:"bachillerato", tokens:[
  {text:"Sus",funcion:["Sujeto"]},{text:"argumentos",funcion:["Sujeto"]},
  {text:"parecían",funcion:["Verbo"]},
  {text:"bastante",funcion:["Atributo"]},{text:"convincentes",funcion:["Atributo"]}
]},
{ id:305, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"película",funcion:["Sujeto"]},
  {text:"resultó",funcion:["Verbo"]},
  {text:"muy",funcion:["Atributo"]},{text:"aburrida",funcion:["Atributo"]},
  {text:"para",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"público",funcion:["Complemento Circunstancial"]}
]},
{ id:306, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"candidato",funcion:["Sujeto"]},
  {text:"resultó",funcion:["Verbo"]},
  {text:"elegido",funcion:["Atributo"]},
  {text:"por",funcion:["Complemento Circunstancial"]},{text:"unanimidad",funcion:["Complemento Circunstancial"]}
]},
{ id:307, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"reforma",funcion:["Sujeto"]},{text:"educativa",funcion:["Sujeto"]},
  {text:"resultó",funcion:["Verbo"]},
  {text:"polémica",funcion:["Atributo"]},
  {text:"para",funcion:["Complemento Circunstancial"]},{text:"muchos",funcion:["Complemento Circunstancial"]},{text:"sectores",funcion:["Complemento Circunstancial"]}
]},
{ id:308, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"economistas",funcion:["Sujeto"]},
  {text:"resultaron",funcion:["Verbo"]},
  {text:"equivocados",funcion:["Atributo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"sus",funcion:["Complemento Circunstancial"]},{text:"predicciones",funcion:["Complemento Circunstancial"]}
]},
{ id:309, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"acusado",funcion:["Sujeto"]},
  {text:"parecía",funcion:["Verbo"]},
  {text:"arrepentido",funcion:["Atributo"]},
  {text:"durante",funcion:["Complemento Circunstancial"]},{text:"todo",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"juicio",funcion:["Complemento Circunstancial"]}
]},
{ id:310, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"solución",funcion:["Sujeto"]},{text:"planteada",funcion:["Sujeto"]},
  {text:"resultó",funcion:["Verbo"]},
  {text:"ser",funcion:["Verbo"]},
  {text:"la",funcion:["Atributo"]},{text:"más",funcion:["Atributo"]},{text:"eficaz",funcion:["Atributo"]}
]},
{ id:311, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"análisis",funcion:["Sujeto"]},{text:"clínicos",funcion:["Sujeto"]},
  {text:"resultaron",funcion:["Verbo"]},
  {text:"totalmente",funcion:["Atributo"]},{text:"normales",funcion:["Atributo"]}
]},
{ id:312, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"tratado",funcion:["Sujeto"]},{text:"de",funcion:["Sujeto"]},{text:"paz",funcion:["Sujeto"]},
  {text:"resultó",funcion:["Verbo"]},
  {text:"inaplicable",funcion:["Atributo"]},
  {text:"en",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"práctica",funcion:["Complemento Circunstancial"]}
]},
{ id:313, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"presidente",funcion:["Sujeto"]},
  {text:"apareció",funcion:["Verbo"]},
  {text:"nervioso",funcion:["Atributo"]},
  {text:"ante",funcion:["Complemento Circunstancial"]},{text:"los",funcion:["Complemento Circunstancial"]},{text:"medios",funcion:["Complemento Circunstancial"]}
]},
{ id:314, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"profesora",funcion:["Sujeto"]},
  {text:"parecía",funcion:["Verbo"]},
  {text:"agotada",funcion:["Atributo"]},
  {text:"después",funcion:["Complemento Circunstancial"]},{text:"de",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"reunión",funcion:["Complemento Circunstancial"]}
]},
{ id:315, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"nuevo",funcion:["Sujeto"]},{text:"gobierno",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"mostró",funcion:["Verbo"]},
  {text:"dispuesto",funcion:["Atributo"]},
  {text:"al",funcion:["Complemento Circunstancial"]},{text:"diálogo",funcion:["Complemento Circunstancial"]}
]},
{ id:316, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"niño",funcion:["Sujeto"]},
  {text:"llegó",funcion:["Verbo"]},
  {text:"llorando",funcion:["Complemento Predicativo"]},
  {text:"a",funcion:["Complemento Circunstancial"]},{text:"casa",funcion:["Complemento Circunstancial"]}
]},
{ id:317, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"soldados",funcion:["Sujeto"]},
  {text:"volvieron",funcion:["Verbo"]},
  {text:"agotados",funcion:["Complemento Predicativo"]},
  {text:"del",funcion:["Complemento Circunstancial"]},{text:"combate",funcion:["Complemento Circunstancial"]}
]},
{ id:318, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"alumnos",funcion:["Sujeto"]},
  {text:"salieron",funcion:["Verbo"]},
  {text:"contentos",funcion:["Complemento Predicativo"]},
  {text:"del",funcion:["Complemento Circunstancial"]},{text:"examen",funcion:["Complemento Circunstancial"]}
]},
{ id:319, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"manifestantes",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"mostraron",funcion:["Verbo"]},
  {text:"muy",funcion:["Atributo"]},{text:"indignados",funcion:["Atributo"]},
  {text:"ante",funcion:["Complemento Circunstancial"]},{text:"las",funcion:["Complemento Circunstancial"]},{text:"cámaras",funcion:["Complemento Circunstancial"]}
]},
{ id:320, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"conferenciante",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"mostró",funcion:["Verbo"]},
  {text:"muy",funcion:["Atributo"]},{text:"seguro",funcion:["Atributo"]},
  {text:"ante",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"auditorio",funcion:["Complemento Circunstancial"]}
]},
{ id:321, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"descubrimiento",funcion:["Sujeto"]},{text:"del",funcion:["Sujeto"]},{text:"científico",funcion:["Sujeto"]},
  {text:"resultó",funcion:["Verbo"]},
  {text:"fundamental",funcion:["Atributo"]},
  {text:"para",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"medicina",funcion:["Complemento Circunstancial"]}
]},
{ id:322, nivel:"bachillerato", tokens:[
  {text:"Sus",funcion:["Sujeto"]},{text:"propuestas",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"manifestaron",funcion:["Verbo"]},
  {text:"claramente",funcion:["Atributo"]},{text:"insuficientes",funcion:["Atributo"]}
]},
{ id:323, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"acuerdo",funcion:["Sujeto"]},{text:"internacional",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"volvió",funcion:["Verbo"]},
  {text:"imprescindible",funcion:["Atributo"]},
  {text:"tras",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"crisis",funcion:["Complemento Circunstancial"]}
]},
{ id:324, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"proyecto",funcion:["Sujeto"]},
  {text:"resultó",funcion:["Verbo"]},
  {text:"mucho",funcion:["Atributo"]},{text:"más",funcion:["Atributo"]},{text:"costoso",funcion:["Atributo"]},
  {text:"de",funcion:["Complemento Circunstancial"]},{text:"lo",funcion:["Complemento Circunstancial"]},{text:"previsto",funcion:["Complemento Circunstancial"]}
]},
{ id:325, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"datos",funcion:["Sujeto"]},{text:"del",funcion:["Sujeto"]},{text:"informe",funcion:["Sujeto"]},
  {text:"parecen",funcion:["Verbo"]},
  {text:"contradictorios",funcion:["Atributo"]},
  {text:"con",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"realidad",funcion:["Complemento Circunstancial"]}
]},
{ id:326, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"poeta",funcion:["Sujeto"]},
  {text:"donó",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"manuscritos",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"la",funcion:["Complemento Indirecto"]},{text:"biblioteca",funcion:["Complemento Indirecto"]},{text:"nacional",funcion:["Complemento Indirecto"]}
]},
{ id:327, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"empresa",funcion:["Sujeto"]},
  {text:"les",funcion:["Complemento Indirecto"]},
  {text:"comunicó",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"cambios",funcion:["Complemento Directo"]},{text:"laborales",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"empleados",funcion:["Complemento Indirecto"]}
]},
{ id:328, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"investigadores",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"enviaron",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"resultados",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"ministerio",funcion:["Complemento Indirecto"]}
]},
{ id:329, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"filósofo",funcion:["Sujeto"]},
  {text:"dedicó",funcion:["Verbo"]},
  {text:"su",funcion:["Complemento Directo"]},{text:"vida",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"estudio",funcion:["Complemento Indirecto"]},{text:"de",funcion:["Complemento Indirecto"]},{text:"la",funcion:["Complemento Indirecto"]},{text:"ética",funcion:["Complemento Indirecto"]}
]},
{ id:330, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"delegados",funcion:["Sujeto"]},
  {text:"propusieron",funcion:["Verbo"]},
  {text:"una",funcion:["Complemento Directo"]},{text:"solución",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"consejo",funcion:["Complemento Indirecto"]},{text:"de",funcion:["Complemento Indirecto"]},{text:"seguridad",funcion:["Complemento Indirecto"]}
]},
{ id:331, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"investigadora",funcion:["Sujeto"]},
  {text:"presentó",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"conclusiones",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"la",funcion:["Complemento Indirecto"]},{text:"comunidad",funcion:["Complemento Indirecto"]},{text:"científica",funcion:["Complemento Indirecto"]}
]},
{ id:332, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"rector",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"concedió",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"título",funcion:["Complemento Directo"]},{text:"honorífico",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"científico",funcion:["Complemento Indirecto"]}
]},
{ id:333, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"expertos",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"atribuyeron",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"fracaso",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"mal",funcion:["Complemento Indirecto"]},{text:"diseño",funcion:["Complemento Indirecto"]}
]},
{ id:334, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"academia",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"concedió",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"máximo",funcion:["Complemento Directo"]},{text:"galardón",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"la",funcion:["Complemento Indirecto"]},{text:"escritora",funcion:["Complemento Indirecto"]}
]},
{ id:335, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"comisión",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"otorgó",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"primer",funcion:["Complemento Directo"]},{text:"premio",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"joven",funcion:["Complemento Indirecto"]},{text:"compositor",funcion:["Complemento Indirecto"]}
]},
// C. de Régimen
{ id:336, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"director",funcion:["Sujeto"]},
  {text:"confía",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento de Régimen"]},{text:"sus",funcion:["Complemento de Régimen"]},{text:"empleados",funcion:["Complemento de Régimen"]}
]},
{ id:337, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"médicos",funcion:["Sujeto"]},
  {text:"insistieron",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento de Régimen"]},{text:"el",funcion:["Complemento de Régimen"]},{text:"tratamiento",funcion:["Complemento de Régimen"]}
]},
{ id:338, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"empresa",funcion:["Sujeto"]},
  {text:"depende",funcion:["Verbo"]},
  {text:"de",funcion:["Complemento de Régimen"]},{text:"las",funcion:["Complemento de Régimen"]},{text:"exportaciones",funcion:["Complemento de Régimen"]}
]},
{ id:339, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"jóvenes",funcion:["Sujeto"]},
  {text:"sueñan",funcion:["Verbo"]},
  {text:"con",funcion:["Complemento de Régimen"]},{text:"un",funcion:["Complemento de Régimen"]},{text:"futuro",funcion:["Complemento de Régimen"]},{text:"mejor",funcion:["Complemento de Régimen"]}
]},
{ id:340, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"estudiante",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"olvidó",funcion:["Verbo"]},
  {text:"de",funcion:["Complemento de Régimen"]},{text:"los",funcion:["Complemento de Régimen"]},{text:"deberes",funcion:["Complemento de Régimen"]}
]},
{ id:341, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"sociedad",funcion:["Sujeto"]},
  {text:"carece",funcion:["Verbo"]},
  {text:"de",funcion:["Complemento de Régimen"]},{text:"referentes",funcion:["Complemento de Régimen"]},{text:"éticos",funcion:["Complemento de Régimen"]}
]},
{ id:342, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"ministro",funcion:["Sujeto"]},
  {text:"habló",funcion:["Verbo"]},
  {text:"de",funcion:["Complemento de Régimen"]},{text:"las",funcion:["Complemento de Régimen"]},{text:"reformas",funcion:["Complemento de Régimen"]}
]},
{ id:343, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"ciudadanos",funcion:["Sujeto"]},
  {text:"aspiran",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento de Régimen"]},{text:"una",funcion:["Complemento de Régimen"]},{text:"vida",funcion:["Complemento de Régimen"]},{text:"digna",funcion:["Complemento de Régimen"]}
]},
{ id:344, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"directora",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"quejó",funcion:["Verbo"]},
  {text:"de",funcion:["Complemento de Régimen"]},{text:"la",funcion:["Complemento de Régimen"]},{text:"falta",funcion:["Complemento de Régimen"]},{text:"de",funcion:["Complemento de Régimen"]},{text:"recursos",funcion:["Complemento de Régimen"]}
]},
{ id:345, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"investigadores",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"especializan",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento de Régimen"]},{text:"genética",funcion:["Complemento de Régimen"]}
]},
// C. Agente (pasivas)
{ id:346, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"novela",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"escrita",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"Cervantes",funcion:["Complemento Agente"]}
]},
{ id:347, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"cuadro",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"pintado",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"Velázquez",funcion:["Complemento Agente"]}
]},
{ id:348, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"premios",funcion:["Sujeto"]},
  {text:"fueron",funcion:["Verbo"]},{text:"entregados",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"el",funcion:["Complemento Agente"]},{text:"rector",funcion:["Complemento Agente"]}
]},
{ id:349, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"ley",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"aprobada",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"el",funcion:["Complemento Agente"]},{text:"parlamento",funcion:["Complemento Agente"]}
]},
{ id:350, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"edificio",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"diseñado",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"un",funcion:["Complemento Agente"]},{text:"famoso",funcion:["Complemento Agente"]},{text:"arquitecto",funcion:["Complemento Agente"]}
]},
{ id:351, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"ciudad",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"fundada",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"los",funcion:["Complemento Agente"]},{text:"romanos",funcion:["Complemento Agente"]}
]},
{ id:352, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"heridos",funcion:["Sujeto"]},
  {text:"fueron",funcion:["Verbo"]},{text:"atendidos",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"los",funcion:["Complemento Agente"]},{text:"médicos",funcion:["Complemento Agente"]}
]},
{ id:353, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"informe",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"redactado",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"el",funcion:["Complemento Agente"]},{text:"comité",funcion:["Complemento Agente"]}
]},
{ id:354, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"decisión",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"tomada",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"la",funcion:["Complemento Agente"]},{text:"junta",funcion:["Complemento Agente"]},{text:"directiva",funcion:["Complemento Agente"]}
]},
{ id:355, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"discurso",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"pronunciado",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"el",funcion:["Complemento Agente"]},{text:"presidente",funcion:["Complemento Agente"]}
]},
// Frases complejas variadas
{ id:356, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"poeta",funcion:["Sujeto"]},
  {text:"llegó",funcion:["Verbo"]},
  {text:"exhausto",funcion:["Complemento Predicativo"]},
  {text:"tras",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"largo",funcion:["Complemento Circunstancial"]},{text:"viaje",funcion:["Complemento Circunstancial"]}
]},
{ id:357, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"delegada",funcion:["Sujeto"]},
  {text:"regresó",funcion:["Verbo"]},
  {text:"satisfecha",funcion:["Complemento Predicativo"]},
  {text:"de",funcion:["Complemento Circunstancial"]},{text:"la",funcion:["Complemento Circunstancial"]},{text:"negociación",funcion:["Complemento Circunstancial"]}
]},
{ id:358, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"obreros",funcion:["Sujeto"]},
  {text:"terminaron",funcion:["Verbo"]},
  {text:"el",funcion:["Complemento Directo"]},{text:"trabajo",funcion:["Complemento Directo"]},
  {text:"cansados",funcion:["Complemento Predicativo"]}
]},
{ id:359, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"empresa",funcion:["Sujeto"]},
  {text:"contrató",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento Directo"]},{text:"los",funcion:["Complemento Directo"]},{text:"ingenieros",funcion:["Complemento Directo"]},
  {text:"recién",funcion:["Complemento Predicativo"]},{text:"graduados",funcion:["Complemento Predicativo"]}
]},
{ id:360, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"historiador",funcion:["Sujeto"]},
  {text:"presentó",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"documentos",funcion:["Complemento Directo"]},
  {text:"como",funcion:["Complemento Predicativo"]},{text:"pruebas",funcion:["Complemento Predicativo"]},{text:"irrefutables",funcion:["Complemento Predicativo"]}
]},
{ id:361, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"filósofo",funcion:["Sujeto"]},{text:"griego",funcion:["Sujeto"]},
  {text:"sentó",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"bases",funcion:["Complemento Directo"]},{text:"del",funcion:["Complemento Directo"]},{text:"pensamiento",funcion:["Complemento Directo"]},{text:"occidental",funcion:["Complemento Directo"]}
]},
{ id:362, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"ministro",funcion:["Sujeto"]},
  {text:"anunció",funcion:["Verbo"]},
  {text:"las",funcion:["Complemento Directo"]},{text:"nuevas",funcion:["Complemento Directo"]},{text:"medidas",funcion:["Complemento Directo"]},
  {text:"ante",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"parlamento",funcion:["Complemento Circunstancial"]}
]},
{ id:363, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"novela",funcion:["Sujeto"]},{text:"más",funcion:["Sujeto"]},{text:"premiada",funcion:["Sujeto"]},{text:"del",funcion:["Sujeto"]},{text:"año",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},
  {text:"un",funcion:["Atributo"]},{text:"gran",funcion:["Atributo"]},{text:"éxito",funcion:["Atributo"]}
]},
{ id:364, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"escritor",funcion:["Sujeto"]},
  {text:"les",funcion:["Complemento Indirecto"]},
  {text:"narró",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"experiencias",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"jóvenes",funcion:["Complemento Indirecto"]},{text:"lectores",funcion:["Complemento Indirecto"]}
]},
{ id:365, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"organización",funcion:["Sujeto"]},
  {text:"les",funcion:["Complemento Indirecto"]},
  {text:"envió",funcion:["Verbo"]},
  {text:"los",funcion:["Complemento Directo"]},{text:"informes",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"todos",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"socios",funcion:["Complemento Indirecto"]}
]},
{ id:366, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"embajador",funcion:["Sujeto"]},
  {text:"presentó",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"credenciales",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"jefe",funcion:["Complemento Indirecto"]},{text:"de",funcion:["Complemento Indirecto"]},{text:"estado",funcion:["Complemento Indirecto"]}
]},
{ id:367, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"ciudadanos",funcion:["Sujeto"]},
  {text:"reclamaron",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"derechos",funcion:["Complemento Directo"]},
  {text:"ante",funcion:["Complemento Circunstancial"]},{text:"el",funcion:["Complemento Circunstancial"]},{text:"ayuntamiento",funcion:["Complemento Circunstancial"]}
]},
{ id:368, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"empresa",funcion:["Sujeto"]},
  {text:"les",funcion:["Complemento Indirecto"]},
  {text:"ofreció",funcion:["Verbo"]},
  {text:"un",funcion:["Complemento Directo"]},{text:"aumento",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"sus",funcion:["Complemento Indirecto"]},{text:"trabajadores",funcion:["Complemento Indirecto"]}
]},
{ id:369, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"periodista",funcion:["Sujeto"]},
  {text:"le",funcion:["Complemento Indirecto"]},
  {text:"hizo",funcion:["Verbo"]},
  {text:"preguntas",funcion:["Complemento Directo"]},{text:"difíciles",funcion:["Complemento Directo"]},
  {text:"al",funcion:["Complemento Indirecto"]},{text:"ministro",funcion:["Complemento Indirecto"]}
]},
{ id:370, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"conferenciante",funcion:["Sujeto"]},
  {text:"les",funcion:["Complemento Indirecto"]},
  {text:"expuso",funcion:["Verbo"]},
  {text:"sus",funcion:["Complemento Directo"]},{text:"ideas",funcion:["Complemento Directo"]},
  {text:"a",funcion:["Complemento Indirecto"]},{text:"los",funcion:["Complemento Indirecto"]},{text:"alumnos",funcion:["Complemento Indirecto"]},{text:"de",funcion:["Complemento Indirecto"]},{text:"posgrado",funcion:["Complemento Indirecto"]}
]},
{ id:371, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"alcalde",funcion:["Sujeto"]},
  {text:"confió",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento de Régimen"]},{text:"la",funcion:["Complemento de Régimen"]},{text:"gestión",funcion:["Complemento de Régimen"]},{text:"municipal",funcion:["Complemento de Régimen"]}
]},
{ id:372, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"investigadora",funcion:["Sujeto"]},
  {text:"se",funcion:["Verbo"]},{text:"interesó",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento de Régimen"]},{text:"los",funcion:["Complemento de Régimen"]},{text:"nuevos",funcion:["Complemento de Régimen"]},{text:"descubrimientos",funcion:["Complemento de Régimen"]}
]},
{ id:373, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"estudiante",funcion:["Sujeto"]},
  {text:"aspira",funcion:["Verbo"]},
  {text:"a",funcion:["Complemento de Régimen"]},{text:"una",funcion:["Complemento de Régimen"]},{text:"beca",funcion:["Complemento de Régimen"]}
]},
{ id:374, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"sindicatos",funcion:["Sujeto"]},
  {text:"abogaron",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento de Régimen"]},{text:"mejores",funcion:["Complemento de Régimen"]},{text:"condiciones",funcion:["Complemento de Régimen"]}
]},
{ id:375, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"filósofa",funcion:["Sujeto"]},
  {text:"insistió",funcion:["Verbo"]},
  {text:"en",funcion:["Complemento de Régimen"]},{text:"la",funcion:["Complemento de Régimen"]},{text:"importancia",funcion:["Complemento de Régimen"]},{text:"del",funcion:["Complemento de Régimen"]},{text:"diálogo",funcion:["Complemento de Régimen"]}
]},
{ id:376, nivel:"bachillerato", tokens:[
  {text:"Los",funcion:["Sujeto"]},{text:"presos",funcion:["Sujeto"]},
  {text:"fueron",funcion:["Verbo"]},{text:"liberados",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"el",funcion:["Complemento Agente"]},{text:"tribunal",funcion:["Complemento Agente"]}
]},
{ id:377, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"teoría",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"desarrollada",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"Darwin",funcion:["Complemento Agente"]}
]},
{ id:378, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"acuerdo",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"firmado",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"ambos",funcion:["Complemento Agente"]},{text:"presidentes",funcion:["Complemento Agente"]}
]},
{ id:379, nivel:"bachillerato", tokens:[
  {text:"El",funcion:["Sujeto"]},{text:"poema",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"recitado",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"la",funcion:["Complemento Agente"]},{text:"ganadora",funcion:["Complemento Agente"]}
]},
{ id:380, nivel:"bachillerato", tokens:[
  {text:"La",funcion:["Sujeto"]},{text:"sala",funcion:["Sujeto"]},
  {text:"fue",funcion:["Verbo"]},{text:"decorada",funcion:["Verbo"]},
  {text:"por",funcion:["Complemento Agente"]},{text:"el",funcion:["Complemento Agente"]},{text:"equipo",funcion:["Complemento Agente"]},{text:"de",funcion:["Complemento Agente"]},{text:"diseño",funcion:["Complemento Agente"]}
]},
];

// Exportaciones
export { CATEGORIAS, NIVELES, FRASES };
