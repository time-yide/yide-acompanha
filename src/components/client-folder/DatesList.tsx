import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

interface DateRow {
  id: string;
  tipo: string;
  data: string;
  descricao: string;
}

const tipoLabel: Record<string, string> = {
  aniversario_socio: "Aniversário sócio",
  renovacao: "Renovação",
  kickoff: "Kickoff",
  custom: "Outro",
};

export function DatesList({ dates }: { dates: DateRow[] }) {
  if (dates.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma data cadastrada.
      </Card>
    );
  }

  // "Hoje" calculado no fuso da app pra comparar diferença em dias-calendário
  // contra `d.data` (coluna DATE pura).
  const todayParts = getDatePartsInAppTz(new Date());
  const todayUtc = Date.UTC(
    parseInt(todayParts.year, 10),
    parseInt(todayParts.month, 10) - 1,
    parseInt(todayParts.day, 10),
  );

  return (
    <ul className="space-y-2">
      {dates.map((d) => {
        // `d.data` é coluna DATE pura (YYYY-MM-DD). Parse manual evita
        // `new Date(...)` UTC midnight → D-1 em Cuiabá.
        const datePart = d.data.length === 10 ? d.data : d.data.slice(0, 10);
        const [y, m, d_] = datePart.split("-").map(Number);
        const validParts = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d_);
        const dataUtc = validParts ? Date.UTC(y, m - 1, d_) : null;
        const days = dataUtc !== null
          ? Math.round((dataUtc - todayUtc) / 86400000)
          : 0;
        const past = days < 0;
        const dataLabel = validParts
          ? new Date(y, m - 1, d_).toLocaleDateString("pt-BR")
          : d.data;
        return (
          <li key={d.id}>
            <Card className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{d.descricao}</span>
                  <Badge variant="secondary">{tipoLabel[d.tipo] ?? d.tipo}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {dataLabel}
                  {past ? ` · há ${Math.abs(days)} dias` : ` · em ${days} dias`}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
