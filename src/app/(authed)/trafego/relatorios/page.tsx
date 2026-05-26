// src/app/(authed)/trafego/relatorios/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listarRelatorios } from "@/lib/trafego/relatorios/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsTrafego } from "@/components/trafego/TabsTrafego";

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  rascunho: { label: "Rascunho", class: "bg-muted text-muted-foreground" },
  gerando: { label: "Gerando…", class: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  pronta: { label: "Pronta", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  erro: { label: "Erro", class: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:trafego_relatorios")) redirect("/trafego");
  const { cliente } = await searchParams;
  const itens = await listarRelatorios({ clienteId: cliente });

  const clienteIds = Array.from(new Set(itens.map((i) => i.cliente_id)));
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: clientes } = clienteIds.length
    ? await sbAny.from("clients").select("id, nome").in("id", clienteIds)
    : { data: [] };
  const nomePorCliente = new Map(
    ((clientes ?? []) as Array<{ id: string; nome: string }>).map((c) => [c.id, c.nome]),
  );

  return (
    <div className="space-y-5">
      <TabsTrafego active="relatorios" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Relatórios de Tráfego
          </h1>
          <p className="text-sm text-muted-foreground">
            Relatórios mensais com identidade Yide pra entregar ao cliente.
          </p>
        </div>
        <Link
          href="/trafego/relatorios/nova"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo relatório
        </Link>
      </header>

      {itens.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum relatório ainda. Clique em <strong>Novo relatório</strong> pra começar.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Período</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Publicado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itens.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.rascunho;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">
                      {nomePorCliente.get(r.cliente_id) ?? r.cliente_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatBR(r.periodo_inicio)} a {formatBR(r.periodo_fim)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={badge.class}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.publicado_em ? formatBR(r.publicado_em.slice(0, 10)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/trafego/relatorios/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
