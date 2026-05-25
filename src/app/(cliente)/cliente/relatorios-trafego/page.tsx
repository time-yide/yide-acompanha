// src/app/(cliente)/cliente/relatorios-trafego/page.tsx
//
// Página do portal do cliente que lista relatórios de tráfego publicados.
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { listarRelatoriosPublicadosPorCliente } from "@/lib/trafego/relatorios/queries";
import { Card } from "@/components/ui/card";

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function Page() {
  const session = await requireClientPortalAuth();
  const itens = await listarRelatoriosPublicadosPorCliente(session.clientId);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:py-8">
      <Link
        href="/cliente"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar ao painel
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Relatórios de Tráfego
        </h1>
        <p className="text-sm text-muted-foreground">
          Relatórios mensais publicados pela Yide. Clique pra visualizar ou baixar.
        </p>
      </header>

      {itens.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Ainda não há relatórios publicados.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {itens.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/cliente/relatorios-trafego/${r.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatBR(r.periodo_inicio)} a {formatBR(r.periodo_fim)}
                    </p>
                    {r.publicado_em && (
                      <p className="text-xs text-muted-foreground">
                        Publicado em {formatBR(r.publicado_em.slice(0, 10))}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-primary">Abrir →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
