import Link from "next/link";
import { ArrowLeft, Mic, Calendar, Clock, CheckCircle2, ChevronRight, ListChecks } from "lucide-react";
import { RecordingPlayer } from "@/components/reunioes/RecordingPlayer";
import { urlAudioReuniaoClienteAction } from "@/lib/cliente-portal/reuniao-actions";
import { formatDuracao } from "@/lib/reunioes/tipos";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import { SolicitarSobreReuniaoButton } from "./SolicitarSobreReuniaoButton";
import type { ReuniaoDetalheCliente } from "@/lib/cliente-portal/queries";

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Detalhe da reunião no portal do cliente — "versão cliente": gravação +
 *  resumo + decisões + próximos passos + tarefas + tópicos. Sem transcrição
 *  crua e sem insights internos (isso nem chega do servidor). */
export function ReuniaoClienteView({ reuniao }: { reuniao: ReuniaoDetalheCliente }) {
  const dataFmt = fmtData(reuniao.starts_at);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link href="/cliente" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao portal
      </Link>

      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mic className="h-6 w-6 shrink-0 text-primary" />
          {reuniao.titulo}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{dataFmt}</span>
          {reuniao.duracao_segundos != null && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuracao(reuniao.duracao_segundos)}</span>
          )}
        </div>
      </header>

      {reuniao.recording && (
        <RecordingPlayer
          recording={reuniao.recording}
          meetingId={reuniao.id}
          fetchUrlAction={urlAudioReuniaoClienteAction}
        />
      )}

      <SolicitarSobreReuniaoButton tituloReuniao={reuniao.titulo} dataReuniao={dataFmt} />

      {reuniao.resumo_geral && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resumo</h2>
          <p className="text-sm leading-relaxed">{reuniao.resumo_geral}</p>
        </section>
      )}

      {reuniao.decisoes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Decisões</h2>
          <ul className="space-y-1.5">
            {reuniao.decisoes.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reuniao.proximos_passos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Próximos passos</h2>
          <ul className="space-y-1.5">
            {reuniao.proximos_passos.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reuniao.tarefas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tarefas</h2>
          <ul className="space-y-1.5">
            {reuniao.tarefas.map((t, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  {t.titulo}
                  {t.due_date && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (até {new Date(t.due_date).toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE })})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reuniao.topicos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tópicos</h2>
          <ul className="space-y-2">
            {reuniao.topicos.map((t, i) => (
              <li key={i} className="rounded-md border p-3">
                <p className="text-sm font-medium">{t.titulo}</p>
                {t.resumo && <p className="mt-0.5 text-xs text-muted-foreground">{t.resumo}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
