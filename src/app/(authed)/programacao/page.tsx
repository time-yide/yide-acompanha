import { notFound } from "next/navigation";
import Link from "next/link";
import { Code2, Newspaper, ArrowRight, Globe, Megaphone } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessProgramacao } from "@/lib/programacao/access";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { listClientesAtivos, listLancamentos, veTudo } from "@/lib/programacao/queries";
import { resumoLancamentos } from "@/lib/programacao/resumo";
import { NovoLancamentoButton } from "@/components/programacao/NovoLancamentoButton";
import { ResumoProgramacao } from "@/components/programacao/ResumoProgramacao";
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
  const resumo = resumoLancamentos(lancamentos);

  return (
    <div className="space-y-5">
      <header
        className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 p-6"
        style={{ background: "radial-gradient(120% 140% at 0% 0%, rgba(20,184,166,.28), transparent 55%), radial-gradient(120% 140% at 100% 0%, rgba(6,182,212,.18), transparent 55%), linear-gradient(180deg,#07110f,#0b1a17)" }}
      >
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-200">
            <Code2 className="h-3.5 w-3.5" /> Programação
          </div>
          <h1 className="mt-3 bg-gradient-to-r from-white via-teal-200 to-cyan-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">Programação</h1>
          <p className="mt-1 text-sm text-white/70">Registre CRM conectados, usuários criados e sistemas feitos por cliente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeGerenciarBlog(user.role) && (
            <Link href="/programacao/blog" className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
              <Newspaper className="h-4 w-4" /> Blog <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {podeGerenciarBlog(user.role) && (
            <Link href="/programacao/seo" className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
              <Globe className="h-4 w-4" /> Serviços & SEO Local <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {podeGerenciarBlog(user.role) && (
            <Link href="/programacao/presenca" className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
              <Megaphone className="h-4 w-4" /> Presença & Autoridade <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <NovoLancamentoButton clientes={clientes} />
        </div>
      </header>

      {clientes.length === 0 && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Nenhum cliente ativo cadastrado ainda.
        </p>
      )}

      <ResumoProgramacao resumo={resumo} />

      <FiltroPeriodo de={de} ate={ate} />

      <LancamentosList lancamentos={lancamentos} clientes={clientes} mostrarColaborador={chefia} />
    </div>
  );
}
