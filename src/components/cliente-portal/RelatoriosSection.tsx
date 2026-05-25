import Link from "next/link";
import { BarChart3, Construction, FileText, Sparkles } from "lucide-react";
import { listarRelatoriosPublicadosPorCliente } from "@/lib/trafego/relatorios/queries";

/**
 * Seção Relatórios do portal do cliente. Se houver pelo menos um relatório
 * de tráfego publicado, mostra link pra `/cliente/relatorios-trafego`.
 * Senão, mantém o visual "Em breve" pros futuros tipos de relatório.
 */
export async function RelatoriosSection({ clientId }: { clientId: string }) {
  const relatorios = await listarRelatoriosPublicadosPorCliente(clientId);
  const temRelatorios = relatorios.length > 0;

  if (temRelatorios) {
    const ultimo = relatorios[0];
    return (
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider">Relatórios</h2>
                <p className="text-xs text-muted-foreground">Performance da sua conta</p>
              </div>
            </div>
            <Link
              href="/cliente/relatorios-trafego"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver todos →
            </Link>
          </header>

          <Link
            href={`/cliente/relatorios-trafego/${ultimo.id}`}
            className="mt-5 flex items-center gap-3 rounded-lg border bg-card p-4 hover:bg-muted/40"
          >
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Relatório de Tráfego</p>
              <p className="text-xs text-muted-foreground">
                Período {formatBR(ultimo.periodo_inicio)} a {formatBR(ultimo.periodo_fim)}
              </p>
            </div>
            <span className="text-xs text-primary">Abrir →</span>
          </Link>

          {relatorios.length > 1 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              + {relatorios.length - 1} relatório{relatorios.length - 1 === 1 ? "" : "s"} anterior{relatorios.length - 1 === 1 ? "" : "es"}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Relatórios</h2>
              <p className="text-xs text-muted-foreground">Performance da sua conta</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Construction className="h-3 w-3" />
            Em breve
          </span>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ComingSoonItem text="Performance de campanhas (Google + Meta)" />
          <ComingSoonItem text="Engajamento das redes" />
          <ComingSoonItem text="Conversões e leads gerados" />
          <ComingSoonItem text="Download em PDF mensal" />
        </div>
      </div>
    </section>
  );
}

function ComingSoonItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-primary/20 bg-primary/5 p-3">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
