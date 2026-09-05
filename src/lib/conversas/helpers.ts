export function formatHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - d.getTime();
  const diffMin = diffMs / 60000;
  const diffDias = diffMs / (1000 * 60 * 60 * 24);

  if (diffMin < 1) return "agora";
  if (diffDias < 1 && agora.toDateString() === d.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDias < 2) return "ontem";
  if (diffDias < 7) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatHoraMsg(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
