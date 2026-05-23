import { getEtapasAtrasadasParaUser, type EtapaAtrasadaResumo } from "@/lib/d0-d30/queries";
import { AlertaOnboardingAtrasadoClient } from "./AlertaOnboardingAtrasadoClient";

/**
 * Banner persistente no topo do dashboard que avisa sobre etapas D0-D30
 * atrasadas dos clientes do user. Some sozinho quando todas forem concluídas
 * (sem botão de "dismissar" - Yasmin pediu que não saia até parar de estar
 * atrasado).
 *
 * Server component só busca dados; renderização (com collapse/expand) é
 * delegada pro AlertaOnboardingAtrasadoClient.
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

  return (
    <AlertaOnboardingAtrasadoClient
      clientes={clientes}
      totalClientes={porCliente.size}
      totalEtapas={atrasadas.length}
    />
  );
}
