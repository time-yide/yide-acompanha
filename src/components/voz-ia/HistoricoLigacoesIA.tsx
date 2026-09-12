import { Card } from "@/components/ui/card";
import { Bot, Calendar, XCircle, PhoneMissed, AlertCircle } from "lucide-react";
import { TranscricaoExpandivel } from "./TranscricaoExpandivel";
import type { AIVoiceCall } from "@/lib/voz-ia/types";

const STATUS_ICONS: Record<string, { icon: typeof Bot; color: string; label: string }> = {
  reuniao_agendada: { icon: Calendar, color: "text-green-600", label: "Reunião agendada" },
  sem_interesse: { icon: XCircle, color: "text-red-600", label: "Sem interesse" },
  nao_atendeu: { icon: PhoneMissed, color: "text-amber-600", label: "Não atendeu" },
  erro: { icon: AlertCircle, color: "text-red-600", label: "Erro" },
  em_andamento: { icon: Bot, color: "text-blue-600", label: "Em andamento" },
  chamando: { icon: Bot, color: "text-amber-600", label: "Chamando" },
  iniciando: { icon: Bot, color: "text-muted-foreground", label: "Iniciando" },
};

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m${sec > 0 ? ` ${sec}s` : ""}` : `${sec}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function HistoricoLigacoesIA({ calls }: { calls: AIVoiceCall[] }) {
  if (!calls.length) return null;

  return (
    <Card className="p-4 space-y-3">
      <h2 className="font-semibold text-sm flex items-center gap-2">
        <Bot className="h-4 w-4" /> Ligações IA ({calls.length})
      </h2>
      <div className="space-y-3">
        {calls.map((call) => {
          const st = STATUS_ICONS[call.status] ?? STATUS_ICONS.iniciando;
          const Icon = st.icon;
          return (
            <div key={call.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${st.color}`} />
                  <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDuration(call.duracao_segundos)}</span>
                  <span>{formatDate(call.criado_em)}</span>
                </div>
              </div>
              {call.resultado_detalhe && (
                <p className="text-xs text-muted-foreground">{call.resultado_detalhe}</p>
              )}
              {call.resumo_ia && (
                <p className="text-xs italic text-muted-foreground">{call.resumo_ia}</p>
              )}
              {call.gravacao_url && (
                <audio controls preload="none" className="w-full h-8">
                  <source src={call.gravacao_url} type="audio/mpeg" />
                </audio>
              )}
              {call.transcricao && (
                <TranscricaoExpandivel items={call.transcricao as any} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
