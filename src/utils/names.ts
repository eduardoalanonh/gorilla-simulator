import { mulberry32 } from "./random";

const NOMES = [
  "Cleiton", "Robson", "Uederson", "Jefinho", "Marcos Paulo", "Gilvan",
  "Adenilson", "Creisson", "Wellington", "Juraci", "Valdir", "Baltazar",
  "Erisvaldo", "Josimar", "Nivaldo", "Reginaldo", "Sidnei", "Waldemar",
  "Zé Carlos", "Tonho", "Dudu", "Betão", "Serjão", "Naldo", "Adilson",
  "Ronivaldo", "Clebinho", "Maicon", "Wesley", "Jailson", "Edcarlos",
  "Vanderlei", "Gerson", "Ademir", "Luizão", "Peixe", "Careca", "Bira",
  "Cabeção", "Russo", "Pantera", "Formiga", "Sombra", "Tremidão",
  "Girafales", "Xandão", "Bidu", "Fumaça",
];

const FRASES = [
  "achou que dava",
  "veio direto do CrossFit",
  "só veio pelo churrasco",
  "apostou R$ 50 que ganhava",
  "disse que treinava MMA",
  "trouxe até lanche",
  "é primo do Robson",
  "viu num tutorial do YouTube",
  "calçou a chuteira nova",
  "prometeu voltar pro almoço",
  "desceu no ponto errado",
  "tava só passando",
  "acredita em si mesmo",
  "fez alongamento antes",
  "assistiu todos os Rocky",
  "veio no lugar do irmão",
  "disse 'segura meu boné'",
  "tem faixa amarela de judô",
];

const NECROS = [
  "Deixa 3 boletos.",
  "A academia sente sua falta.",
  "O churrasco ficou pra próxima.",
  "Avaliou a experiência: 0/10.",
  "O grupo do zap está de luto.",
  "Voltou pro lobby.",
  "O boné ficou órfão.",
  "Pelo menos tentou.",
  "A mãe avisou.",
  "Respawn negado.",
];

/** Identidade cômica determinística de um homem (por índice + run). */
export function manIdentity(index: number, runId: number) {
  const rng = mulberry32(index * 2654435761 + runId * 97 + 11);
  return {
    name: NOMES[Math.floor(rng() * NOMES.length)],
    age: 18 + Math.floor(rng() * 45),
    phrase: FRASES[Math.floor(rng() * FRASES.length)],
    necro: NECROS[Math.floor(rng() * NECROS.length)],
  };
}
