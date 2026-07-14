/**
 * Coluna "Reunião" do painel — read-only. Derivada do calendário: "Agendada"
 * quando existe evento do tipo Assessores com o cliente no mês (step `reuniao`
 * fica `pronto` via derivação em getMonthlyChecklists).
 */
export function ReuniaoCell({ status }: { status: string }) {
  if (status === "pronto") {
    return <span className="text-[12px] text-foreground/80">Agendada</span>;
  }
  return <span className="text-[12px] text-muted-foreground/60">Sem reunião</span>;
}
