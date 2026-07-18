import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId, getPagamentosPorMes } from "@/lib/freela-yide/queries";
import { Card } from "@/components/ui/card";
import { ROLES_GESTAO } from "@/lib/freela-yide/acesso";

export default async function PagamentosPage() {
  const user = await requireAuth();
  if (!ROLES_GESTAO.includes(user.role)) notFound(); // dado de pagamento: só gestão
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const meses = await getPagamentosPorMes(orgId);

  return (
    <div className="space-y-6">
      <Link href="/freela-yide/lancadas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Pagamentos por colaborador</h1>
        <p className="text-sm text-muted-foreground">Quanto pagar cada pessoa por mês — tudo que ela pegou, exceto canceladas.</p>
      </div>

      {meses.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Ninguém pegou freela ainda.</Card>
      ) : (
        meses.map((mes) => (
          <Card key={mes.chave} className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <h2 className="text-sm font-semibold">{mes.label}</h2>
              <span className="text-sm font-bold tabular-nums text-fuchsia-400">R$ {mes.total.toLocaleString("pt-BR")}</span>
            </div>
            <ul className="divide-y">
              {mes.colaboradores.map((c) => (
                <li key={c.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{c.qtd} freela{c.qtd === 1 ? "" : "s"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">R$ {c.total.toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
