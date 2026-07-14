/**
 * Coluna "Edição" do painel — read-only. Derivada das tasks de vídeo/arte:
 * "Editado" quando alguma task do cliente passou pela edição no mês (step
 * `edicao` fica `pronto` via derivação em getMonthlyChecklists).
 */
export function EdicaoCell({ status }: { status: string }) {
  if (status === "pronto") {
    return <span className="text-[12px] text-foreground/80">Editado</span>;
  }
  return <span className="text-[12px] text-muted-foreground/60">Pendente</span>;
}
