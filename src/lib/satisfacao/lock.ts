// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { currentIsoWeek } from "./iso-week";
import type { SatisfactionColor } from "./schema";

export interface LockClientRow {
  id: string;
  nome: string;
  cor: SatisfactionColor | null;
  comentario: string | null;
}

export interface SatisfactionLockState {
  blocked: boolean;
  weekIso: string;
  clients: LockClientRow[];
  filled: number;
  total: number;
}

const ROLES_QUE_TRAVAM = ["assessor", "coordenador"] as const;
type RoleQueTrava = (typeof ROLES_QUE_TRAVAM)[number];

function isRoleQueTrava(role: string): role is RoleQueTrava {
  return (ROLES_QUE_TRAVAM as readonly string[]).includes(role);
}

/**
 * Verifica se o usuário precisa ser bloqueado pra avaliar a satisfação dos
 * clientes desta semana. Bootstrap idempotente das entries pendentes.
 *
 * Regra:
 * - Apenas `assessor` e `coordenador` são travados (sócio/adm/etc são livres).
 * - Assessor: trava se tiver clientes onde é assessor_id e algum sem cor.
 * - Coordenador: trava se tiver clientes onde é coordenador_id e algum sem cor.
 * - Sem clientes (ex: coord novo) = não trava.
 */
export async function checkSatisfactionLock(
  userId: string,
  role: string,
): Promise<SatisfactionLockState> {
  const weekIso = currentIsoWeek();

  if (!isRoleQueTrava(role)) {
    return { blocked: false, weekIso, clients: [], filled: 0, total: 0 };
  }

  const admin = createServiceRoleClient();

  // 1) Lista os clientes ativos do usuário (estrito por papel)
  const filterColumn = role === "assessor" ? "assessor_id" : "coordenador_id";
  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nome")
    .eq("status", "ativo")
    .eq(filterColumn, userId)
    .order("nome");
  const clients = (clientsRaw ?? []) as Array<{ id: string; nome: string }>;

  if (clients.length === 0) {
    return { blocked: false, weekIso, clients: [], filled: 0, total: 0 };
  }

  // 2) Bootstrap: cria entries pendentes (cor=null) pros clientes que ainda não tem
  const { data: existing } = await admin
    .from("satisfaction_entries")
    .select("client_id, cor, comentario")
    .eq("autor_id", userId)
    .eq("semana_iso", weekIso);
  const existingMap = new Map(
    ((existing ?? []) as Array<{ client_id: string; cor: SatisfactionColor | null; comentario: string | null }>).map((e) => [e.client_id, e]),
  );

  const missing = clients.filter((c) => !existingMap.has(c.id));
  if (missing.length > 0) {
    await admin.from("satisfaction_entries").insert(
      missing.map((c) => ({
        client_id: c.id,
        autor_id: userId,
        papel_autor: role,
        semana_iso: weekIso,
        cor: null,
        comentario: null,
      })),
    );
    // Adiciona como pendente no map pra contagem coerente sem nova query
    for (const c of missing) {
      existingMap.set(c.id, { client_id: c.id, cor: null, comentario: null });
    }
  }

  // 3) Monta a lista pra UI + conta preenchidos
  const rows: LockClientRow[] = clients.map((c) => {
    const e = existingMap.get(c.id);
    return {
      id: c.id,
      nome: c.nome,
      cor: e?.cor ?? null,
      comentario: e?.comentario ?? null,
    };
  });

  const filled = rows.filter((r) => r.cor !== null).length;
  const total = rows.length;

  return {
    blocked: filled < total,
    weekIso,
    clients: rows,
    filled,
    total,
  };
}
