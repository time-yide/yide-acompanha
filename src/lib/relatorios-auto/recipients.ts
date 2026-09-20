import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { roleParaSetor, type Setor } from "@/lib/produtividade/setor-metricas";
import { normalizeTelefone } from "@/lib/dispatch/render-template";

export interface Recipient {
  userId: string;
  nome: string;
  telefone: string;
  role: string;
  setor: Setor | null;
}

export interface ReportRecipients {
  gestao: Recipient[];
  porSetor: Record<Setor, Recipient[]>;
  twilioFrom: string | null;
}

const ROLES_GESTAO = new Set(["adm", "socio"]);

const ROLES_COORDENADOR_SETOR: Record<string, Setor> = {
  audiovisual_chefe: "audiovisual",
};

export async function getReportRecipients(orgId: string): Promise<ReportRecipients> {
  const sb = createServiceRoleClient();

  const [{ data: profilesData }, { data: configData }] = await Promise.all([
    sb
      .from("profiles")
      .select("id, nome, role, telefone, especialidade")
      .eq("organization_id", orgId)
      .eq("ativo", true),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any)
      .from("ai_voice_configs")
      .select("twilio_wpp_from")
      .eq("organization_id", orgId)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const profiles = (profilesData ?? []) as Array<{
    id: string;
    nome: string;
    role: string;
    telefone: string | null;
    especialidade: string | null;
  }>;

  const twilioFrom = (configData as { twilio_wpp_from?: string } | null)?.twilio_wpp_from ?? null;

  const gestao: Recipient[] = [];
  const porSetor: Record<string, Recipient[]> = {};

  for (const p of profiles) {
    if (!p.telefone) continue;
    const tel = normalizeTelefone(p.telefone);
    if (!tel) continue;

    const recipient: Recipient = {
      userId: p.id,
      nome: p.nome,
      telefone: tel,
      role: p.role,
      setor: roleParaSetor(p.role, p.especialidade),
    };

    if (ROLES_GESTAO.has(p.role)) {
      gestao.push(recipient);
    }

    const coordSetor = ROLES_COORDENADOR_SETOR[p.role];
    if (coordSetor) {
      const arr = porSetor[coordSetor] ?? [];
      arr.push(recipient);
      porSetor[coordSetor] = arr;
    }
  }

  return {
    gestao,
    porSetor: porSetor as Record<Setor, Recipient[]>,
    twilioFrom,
  };
}

export async function getActiveOrgIds(): Promise<string[]> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("ai_voice_configs")
    .select("organization_id")
    .eq("ativo", true);

  const ids = new Set<string>();
  for (const row of (data ?? []) as Array<{ organization_id: string }>) {
    ids.add(row.organization_id);
  }
  return [...ids];
}
