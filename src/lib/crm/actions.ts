"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
] as const;

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

const CRM_TIPOS_VALIDOS = [
  "yide", "rd_station", "hubspot", "pipedrive", "ploomes", "kommo",
  "agendor", "salesforce", "zoho", "bitrix", "custom", "planilha", "nenhum",
] as const;

const updateClienteCrmSchema = z.object({
  client_id: uuidLike,
  crm_tipo: z.enum(CRM_TIPOS_VALIDOS).nullable(),
  crm_url: z.string().url("URL inválida").max(500).or(z.literal("")).optional().nullable(),
  crm_identifier: z.string().trim().max(200).optional().nullable(),
  crm_observacoes: z.string().trim().max(2000).optional().nullable(),
});

function fd(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updateClienteCrmAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!(ROLES_QUE_GERENCIAM as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const tipo = fd(formData, "crm_tipo");
  const parsed = updateClienteCrmSchema.safeParse({
    client_id: fd(formData, "client_id"),
    crm_tipo: tipo,
    crm_url: fd(formData, "crm_url"),
    crm_identifier: fd(formData, "crm_identifier"),
    crm_observacoes: fd(formData, "crm_observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("clients")
    .update({
      crm_tipo: parsed.data.crm_tipo,
      crm_url: parsed.data.crm_url,
      crm_identifier: parsed.data.crm_identifier,
      crm_observacoes: parsed.data.crm_observacoes,
    })
    .eq("id", parsed.data.client_id);
  if (error) return { error: error.message };

  revalidatePath("/crm");
  revalidatePath(`/crm/${parsed.data.client_id}`);
  return { success: true };
}
