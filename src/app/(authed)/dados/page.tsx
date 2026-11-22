import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessDados, dadosVeTodos, podeEditarConexoes } from "@/lib/dados/access";
import { canAccessProgramacao } from "@/lib/programacao/access";
import { listVisaoGeral } from "@/lib/dados/queries";
import { ResumoCards } from "@/components/dados/ResumoCards";
import { TabelaClientes } from "@/components/dados/TabelaClientes";
import { DadosTabs } from "@/components/dados/DadosTabs";
import { LegendaStatus } from "@/components/dados/CanalIcone";
import { ConectarAutomaticoButton } from "@/components/dados/ConectarAutomaticoButton";

export const dynamic = "force-dynamic";

const HEADER_BG = "radial-gradient(120% 140% at 0% 0%, rgba(20,184,166,.28), transparent 55%), radial-gradient(120% 140% at 100% 0%, rgba(6,182,212,.18), transparent 55%), linear-gradient(180deg,#07110f,#0b1a17)";

export default async function DadosPage() {
  const user = await requireAuth();
  if (!canAccessDados(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();
  const visao = await listVisaoGeral(orgId, user);
  const ultima = visao.ok ? visao.linhas.map((l) => l.calculadoEm).filter(Boolean).sort().at(-1) : null;

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 p-6" style={{ background: HEADER_BG }}>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-200">
          <BarChart3 className="h-3.5 w-3.5" /> Inteligência de clientes
        </div>
        <h1 className="mt-3 bg-gradient-to-r from-white via-teal-200 to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">Dados</h1>
        <p className="mt-1 text-sm text-white/70">
          Tudo de cada cliente num lugar só: onde está indo bem e onde está perdendo presença.
          {ultima && <span className="text-white/40"> · Atualizado {new Date(ultima).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · últimos 30 dias</span>}
        </p>
        {podeEditarConexoes(user.role) && (
          <div className="mt-4 sm:absolute sm:right-6 sm:top-6 sm:mt-0">
            <ConectarAutomaticoButton />
          </div>
        )}
      </header>

      <DadosTabs ativa="dados" mostrarProgramacao={canAccessProgramacao(user.role)} />

      {!visao.ok ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/60">Painel em preparação. Volte em alguns minutos.</div>
      ) : (
        <>
          <ResumoCards linhas={visao.linhas} />
          <TabelaClientes linhas={visao.linhas} mostrarAssessor={dadosVeTodos(user.role)} />
          <LegendaStatus />
        </>
      )}
    </div>
  );
}
