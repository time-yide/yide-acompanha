import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listClientPaymentsForMonth, listPayrollForMonth } from "@/lib/pagamentos/queries";
import { ClientPaymentsTable } from "@/components/dashboard/adm/ClientPaymentsTable";
import { PayrollPaymentsTable } from "@/components/dashboard/adm/PayrollPaymentsTable";
import { Button } from "@/components/ui/button";

const MES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function currentMesRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMes(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMes(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
}

function fmtMes(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  return `${MES_LABEL[m - 1]}/${y}`;
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  // ADM e sócio têm acesso (ADM marca dia-a-dia; sócio vê e ajusta).
  if (user.role !== "socio" && user.role !== "adm") redirect("/");

  const mes = isValidMes(params.mes) ? params.mes : currentMesRef();
  const [clientPayments, payroll] = await Promise.all([
    listClientPaymentsForMonth(mes),
    listPayrollForMonth(mes),
  ]);

  const prev = shiftMes(mes, -1);
  const next = shiftMes(mes, +1);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/financeiro" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" />
            Voltar pro Financeiro
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Pagamentos do mês</h1>
          <p className="text-sm text-muted-foreground">
            Marca recebimentos de clientes e pagamentos de colaboradores referentes a um mês específico.
          </p>
        </div>
      </header>

      <div className="inline-flex items-center gap-1 rounded-md border bg-card">
        <Link href={`/financeiro/pagamentos?mes=${prev}`} aria-label="Mês anterior">
          <Button variant="ghost" size="icon" type="button">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <span className="px-3 text-sm font-medium tabular-nums">{fmtMes(mes)}</span>
        <Link href={`/financeiro/pagamentos?mes=${next}`} aria-label="Próximo mês">
          <Button variant="ghost" size="icon" type="button">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClientPaymentsTable rows={clientPayments} mesReferencia={mes} />
        <PayrollPaymentsTable rows={payroll} mesReferencia={mes} />
      </div>
    </div>
  );
}
