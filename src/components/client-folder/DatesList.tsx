import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";

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

  return (
    <ul className="space-y-2">
      {dates.map((d) => {
        const days = differenceInDays(parseISO(d.data), new Date());
        const past = days < 0;
        return (
          <li key={d.id}>
            <Card className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{d.descricao}</span>
                  <Badge variant="secondary">{tipoLabel[d.tipo] ?? d.tipo}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(d.data).toLocaleDateString("pt-BR")}
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
