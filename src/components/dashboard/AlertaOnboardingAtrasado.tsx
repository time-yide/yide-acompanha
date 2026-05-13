import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { getEtapasAtrasadasParaUser, type EtapaAtrasadaResumo } from "@/lib/d0-d30/queries";

/**
 * Banner persistente no topo do dashboard que avisa sobre etapas D0-D30
 * atrasadas dos clientes do user. Some sozinho quando todas forem concluídas
 * (sem botão de "dismissar" — Yasmin pediu que não saia até parar de estar
 * atrasado).
 */
export async function AlertaOnboardingAtrasadoSection({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const atrasadas = await getEtapasAtrasadasParaUser(userId, role);
  if (atrasadas.length === 0) return null;

  // Agrupa por cliente
  const porCliente = new Map<
    string,
    {
      client_nome: string;
      client_id: string;
      client_dia_atual: number;
      etapas: EtapaAtrasadaResumo[];
    }
  >();
  for (const a of atrasadas) {
    const cur = porCliente.get(a.client_id) ?? {
      client_nome: a.client_nome,
      client_id: a.client_id,
      client_dia_atual: a.client_dia_atual,
      etapas: [],
    };
    cur.etapas.push(a);
    porCliente.set(a.client_id, cur);
  }
  const clientes = Array.from(porCliente.values()).sort((a, b) => {
    // Ordena por: maior atraso máximo desc
    const maxA = Math.max(...a.etapas.map((e) => e.dias_atrasado));
    const maxB = Math.max(...b.etapas.map((e) => e.dias_atrasado));
    return maxB - maxA;
  });

  const totalClientes = porCliente.size;
  const totalEtapas = atrasadas.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-card to-card">
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-red-500/20 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold tracking-wide text-red-900 dark:text-red-100">
            Onboarding atrasado
          </h3>
          <p className="text-xs text-red-800/70 dark:text-red-200/70">
            <strong>{totalEtapas}</strong>{" "}
            {totalEtapas === 1 ? "etapa em atraso" : "etapas em atraso"} ·{" "}
            <strong>{totalClientes}</strong>{" "}
            {totalClientes === 1 ? "cliente" : "clientes"}
          </p>
        </div>
      </header>

      {/* Lista por cliente */}
      <ul className="divide-y divide-red-500/10">
        {clientes.map((c) => (
          <li key={c.client_id}>
            <Link
              href={`/d0-d30/${c.client_id}`}
              className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-red-500/5"
            >
              {/* Nome + Dia atual */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {c.client_nome}
                  </span>
                  <span className="rounded-full bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    Hoje · D{c.client_dia_atual}
                  </span>
                </div>

                {/* Pills das etapas atrasadas */}
                <div className="flex flex-wrap gap-1.5">
                  {c.etapas.map((e) => (
                    <EtapaPill key={e.etapa_id} etapa={e} />
                  ))}
                </div>
              </div>

              {/* Seta de "abrir" */}
              <span className="mt-1.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted/30 text-muted-foreground transition-colors group-hover:bg-red-500/15 group-hover:text-red-700 dark:group-hover:text-red-300">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EtapaPill({ etapa }: { etapa: EtapaAtrasadaResumo }) {
  // Cor da pill: vermelho mais intenso quando mais dias atrasada
  const isCritica = etapa.dias_atrasado >= 7;
  const pillCls = isCritica
    ? "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ring-1 px-2 py-0.5 text-[11px] ${pillCls}`}
      title={`Etapa ${etapa.etapa_numero} · prazo era ${etapa.date_range}`}
    >
      <Clock className="h-2.5 w-2.5" />
      <span className="font-medium">
        {etapa.etapa_numero}. {etapa.etapa_nome}
      </span>
      <span className="opacity-70">·</span>
      <span className="font-mono tabular-nums">{etapa.dias_atrasado}d</span>
    </span>
  );
}
