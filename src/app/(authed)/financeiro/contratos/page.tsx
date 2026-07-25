import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FileSignature, Check, Clock } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listContratosForFinance } from "@/lib/contratos/queries";

export const dynamic = "force-dynamic";

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ContratosPage() {
  const user = await requireAuth();
  // Contratos é do financeiro/administrativo: sócio e adm.
  if (user.role !== "socio" && user.role !== "adm") redirect("/");

  const rows = await listContratosForFinance();
  const preenchidos = rows.filter((r) => r.info?.razao_social);
  const pendentes = rows.filter((r) => !r.info?.razao_social);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/financeiro" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Voltar pro Financeiro
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileSignature className="h-6 w-6 text-primary" /> Contratos
        </h1>
        <p className="text-sm text-muted-foreground">
          Informações que os clientes preencheram no portal · {preenchidos.length} de {rows.length} preenchidos
        </p>
      </header>

      {preenchidos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {preenchidos.map((r) => (
            <div key={r.clientId} className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="truncate text-sm font-semibold">{r.clientNome}</h2>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> Preenchido
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <Campo label="Razão social / Nome" valor={r.info!.razao_social} />
                <Campo label="CNPJ / CPF" valor={r.info!.cnpj_cpf} />
                <Campo label="Endereço" valor={r.info!.endereco} full />
                <Campo label="E-mail" valor={r.info!.email} />
                <Campo label="Telefone" valor={r.info!.telefone} />
              </dl>
              <p className="mt-2 text-[10px] text-muted-foreground">Atualizado em {fmtData(r.info!.updated_at)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" /> Pendentes ({pendentes.length})
        </h2>
        {pendentes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todos os clientes ativos preencheram 🎉</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {pendentes.map((r) => (
              <li key={r.clientId} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                {r.clientNome}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Campo({ label, valor, full }: { label: string; valor: string | null; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{valor || "—"}</dd>
    </div>
  );
}
