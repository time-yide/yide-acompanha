const FRASES = [
  "Cada oportunidade pega é dinheiro na mesa. Vai buscar. 💸",
  "Quem corre atrás, fecha. Quem espera, assiste. 🏆",
  "Seu próximo contrato tá num card aí em cima. 🎯",
  "Performance não é sorte, é repetição. 🔥",
  "O ranking não mente: bora subir. 📈",
  "Comissão boa é a que você fechou hoje. 🤑",
  "Time que capta junto, cresce junto. 🚀",
  "Não existe lead pequeno pra quem pensa grande. 💪",
];

/** Frase estável por dia (não muda a cada refresh do mesmo dia). */
export function fraseDoDia(d: Date = new Date()): string {
  const dia = Math.floor(d.getTime() / 86_400_000);
  return FRASES[dia % FRASES.length];
}
