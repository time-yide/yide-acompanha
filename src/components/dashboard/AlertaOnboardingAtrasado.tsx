import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { getEtapasAtrasadasParaUser } from "@/lib/d0-d30/queries";

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

  // Agrupa por cliente pra mostrar de forma compacta
  const porCliente = new Map<
    string,
    { client_nome: string; client_id: string; etapas: typeof atrasadas }
  >();
  for (const a of atrasadas) {
    const cur = porCliente.get(a.client_id) ?? {
      client_nome: a.client_nome,
      client_id: a.client_id,
      etapas: [],
    };
    cur.etapas.push(a);
    porCliente.set(a.client_id, cur);
  }

  const totalClientes = porCliente.size;
  const totalEtapas = atrasadas.length;

  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-sm font-bold text-red-900 dark:text-red-100">
              {totalEtapas === 1
                ? "1 etapa do onboarding D0→D30 está atrasada"
                : `${totalEtapas} etapas do onboarding D0→D30 estão atrasadas`}
              {totalClientes > 1 && ` em ${totalClientes} clientes`}
            </h3>
            <p className="text-xs text-red-800/80 dark:text-red-200/80">
              Esses prazos já passaram. Marque como concluída quando entregar,
              ou abre pra rever o que falta.
            </p>
          </div>

          <ul className="space-y-1 text-sm">
            {Array.from(porCliente.values()).map((c) => (
              <li key={c.client_id}>
                <Link
                  href={`/d0-d30/${c.client_id}`}
                  className="group inline-flex items-center gap-1.5 text-red-900 dark:text-red-100 hover:underline"
                >
                  <span className="font-medium">{c.client_nome}</span>
                  <span className="text-xs text-red-800/70 dark:text-red-200/70">
                    {c.etapas
                      .map(
                        (e) =>
                          `${e.etapa_numero}. ${e.etapa_nome} (vencia ${e.date_range}, ${e.dias_atrasado}d atrasada)`,
                      )
                      .join(" · ")}
                  </span>
                  <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
