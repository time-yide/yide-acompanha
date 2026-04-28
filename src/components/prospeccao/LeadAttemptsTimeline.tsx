import { MessageCircle, Mail, Phone, MapPin, MoreHorizontal } from "lucide-react";
import type { LeadAttemptRow } from "@/lib/prospeccao/queries";

interface Props {
  attempts: LeadAttemptRow[];
}

const CANAL_ICON = {
  whatsapp: MessageCircle,
  email: Mail,
  ligacao: Phone,
  presencial: MapPin,
  outro: MoreHorizontal,
};

const RESULTADO_LABEL = {
  sem_resposta: "Sem resposta",
  agendou: "Agendou",
  recusou: "Recusou",
  pediu_proposta: "Pediu proposta",
  outro: "Outro",
};

const RESULTADO_BADGE = {
  sem_resposta: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  agendou: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  recusou: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pediu_proposta: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  outro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export function LeadAttemptsTimeline({ attempts }: Props) {
  if (attempts.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhuma tentativa de contato registrada ainda.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {attempts.map((a) => {
        const Icon = CANAL_ICON[a.canal];
        return (
          <li key={a.id} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium capitalize">{a.canal}</span>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${RESULTADO_BADGE[a.resultado]}`}>
                {RESULTADO_LABEL[a.resultado]}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {a.observacao && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.observacao}</p>
            )}
            {a.proximo_passo && (
              <div className="text-xs">
                <span className="font-medium">Próximo passo:</span>{" "}
                <span className="text-muted-foreground">{a.proximo_passo}</span>
                {a.data_proximo_passo && (
                  <span className="ml-1 text-muted-foreground">
                    ({new Date(a.data_proximo_passo).toLocaleDateString("pt-BR")})
                  </span>
                )}
              </div>
            )}
            {a.autor && (
              <div className="text-[11px] text-muted-foreground">por {a.autor.nome}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
