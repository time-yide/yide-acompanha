import Link from "next/link";
import { Plus, Database, UserPlus, Boxes, Layers } from "lucide-react";
import { FixoCard } from "./personal/FixoCard";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { listLancamentos } from "@/lib/programacao/queries";
import { resumoLancamentos } from "@/lib/programacao/resumo";

interface Props {
  userId: string;
  nome: string;
}

function inicioDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function DashboardProgramacao({ userId, nome }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const orgId = await getOrganizationId(userId);
  const lancamentos = orgId
    ? await listLancamentos(orgId, "programacao", userId, { de: inicioDoMes(), ate: hoje() })
    : [];
  const resumo = resumoLancamentos(lancamentos);
  const recentes = lancamentos.slice(0, 5);

  const cards = [
    { label: "CRMs conectados", valor: resumo.crm, icon: Database },
    { label: "Usuários criados", valor: resumo.usuarios, icon: UserPlus },
    { label: "Sistemas feitos", valor: resumo.sistemas, icon: Boxes },
    { label: "Total", valor: resumo.total, icon: Layers },
  ];

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {primeiroNome}</h1>
            <p className="text-sm text-muted-foreground">Seus lançamentos deste mês.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/programacao"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Registrar
            </Link>
            <HiddenValueToggle />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-xl border bg-card p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{c.label}</p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums sm:mt-2 sm:text-3xl">{c.valor}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FixoCard userId={userId} />
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimos lançamentos</h2>
            <Link href="/programacao" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {recentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento este mês.</p>
          ) : (
            <div className="space-y-2">
              {recentes.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{l.client_nome ?? "—"}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="rounded-full border bg-muted px-2 py-0.5 tabular-nums">{l.quantidade}× {l.tipo_label}</span>
                    <span className="tabular-nums">{formatarDataBR(l.data)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </HiddenValuesProvider>
  );
}
