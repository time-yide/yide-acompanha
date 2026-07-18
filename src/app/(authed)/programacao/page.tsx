import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessProgramacao } from "@/lib/programacao/access";
import { listClientesAtivos, listLancamentos, veTudo } from "@/lib/programacao/queries";
import { NovoLancamentoButton } from "@/components/programacao/NovoLancamentoButton";
import { LancamentosList } from "@/components/programacao/LancamentosList";
import { FiltroPeriodo } from "@/components/programacao/FiltroPeriodo";

export const dynamic = "force-dynamic";

function inicioDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProgramacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccessProgramacao(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const sp = await searchParams;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const de = sp.de && DATE_RE.test(sp.de) ? sp.de : inicioDoMes();
  const ate = sp.ate && DATE_RE.test(sp.ate) ? sp.ate : hoje();
  const chefia = veTudo(user.role);

  const [clientes, lancamentos] = await Promise.all([
    listClientesAtivos(orgId),
    listLancamentos(orgId, user.role, user.id, { de, ate }),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programação</h1>
          <p className="text-sm text-muted-foreground">
            Registre CRM conectados, usuários criados e sistemas feitos por cliente.
          </p>
        </div>
        <NovoLancamentoButton clientes={clientes} />
      </header>

      {clientes.length === 0 && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Nenhum cliente ativo cadastrado ainda.
        </p>
      )}

      <FiltroPeriodo de={de} ate={ate} />

      <LancamentosList lancamentos={lancamentos} clientes={clientes} mostrarColaborador={chefia} />
    </div>
  );
}
