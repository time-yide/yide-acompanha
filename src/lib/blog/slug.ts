// Puro/testável — geração de slug pra URLs do blog.

/** "Título de Teste!" → "titulo-de-teste". Sem acento, minúsculo, hifens. */
export function slugify(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (diacríticos combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // só letras/números/espaço/hífen
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Garante slug único: se `base` já existe, sufixa -2, -3… */
export function slugUnico(base: string, existentes: Set<string>): string {
  const s = base || "post";
  if (!existentes.has(s)) return s;
  let i = 2;
  while (existentes.has(`${s}-${i}`)) i++;
  return `${s}-${i}`;
}
