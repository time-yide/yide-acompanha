import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Attempt {
  id: string;
  canal: string;
  resultado: string;
  observacao: string | null;
  proximo_passo: string | null;
  data_proximo_passo: string | null;
  created_at: string;
  // @ts-expect-error nested
  autor?: { nome: string } | null;
}

const canalLabel: Record<string, string> = {
  whatsapp: "WhatsApp", email: "Email", ligacao: "Ligação", presencial: "Presencial", outro: "Outro",
};

const resultadoLabel: Record<string, string> = {
  sem_resposta: "Sem resposta", agendou: "Agendou", recusou: "Recusou",
  pediu_proposta: "Pediu proposta", outro: "Outro",
};

export function LeadAttemptsTimeline({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhuma tentativa registrada.
      </Card>
    );
  }

  return (
    <ol className="space-y-2">
      {attempts.map((a) => (
        <li key={a.id}>
          <Card className="p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{canalLabel[a.canal]}</Badge>
              <Badge variant="outline">{resultadoLabel[a.resultado]}</Badge>
              <span>· {a.autor?.nome ?? "—"}</span>
              <span>· {new Date(a.created_at).toLocaleString("pt-BR")}</span>
            </div>
            {a.observacao && <p className="text-sm">{a.observacao}</p>}
            {a.proximo_passo && (
              <p className="text-xs">
                <strong>Próximo passo:</strong> {a.proximo_passo}
                {a.data_proximo_passo && ` · ${new Date(a.data_proximo_passo).toLocaleDateString("pt-BR")}`}
              </p>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}
