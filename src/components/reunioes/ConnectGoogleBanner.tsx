import Link from "next/link";
import { Calendar, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  connected: boolean;
  googleEmail?: string | null;
}

/**
 * Banner do topo da lista de reuniões. Quando não conectado, convida pra
 * conectar. Quando conectado, mostra estado discreto.
 */
export function ConnectGoogleBanner({ connected, googleEmail }: Props) {
  if (connected && googleEmail) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-500/15 p-2">
            <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Google Calendar conectado</p>
            <p className="text-xs text-muted-foreground">{googleEmail}</p>
          </div>
        </div>
        <Link
          href="/reunioes/conectar"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Gerenciar conexão
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
      {/* Decoração de background */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            Comece em 1 minuto
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            Conecte sua conta Google pra capturar reuniões automaticamente
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Suas reuniões do Google Meet aparecem aqui em tempo real. Depois da call, a IA gera resumo,
            tópicos, decisões e tarefas. Pronto pra revisar.
          </p>
        </div>
        <Link
          href="/reunioes/conectar"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Conectar Google
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
