"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

type ActionResult = { error?: string; success?: boolean };

function isPriv(role: string) {
  return role === "socio" || role === "adm";
}

const togglePaymentSchema = z.object({
  client_id: z.string().uuid(),
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/),
  to_status: z.enum(["pago", "pendente"]),
});

export async function toggleClientPaymentAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!isPriv(actor.role)) return { error: "Apenas sócio ou ADM" };

  const parsed = togglePaymentSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    mes_referencia: String(formData.get("mes_referencia") ?? ""),
    to_status: String(formData.get("to_status") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const paid_at = parsed.data.to_status === "pago" ? new Date().toISOString() : null;

  const { error } = await sb
    .from("client_payments")
    .upsert(
      {
        organization_id: org.id,
        client_id: parsed.data.client_id,
        mes_referencia: parsed.data.mes_referencia,
        status: parsed.data.to_status,
        paid_at,
        marked_by: actor.id,
      },
      { onConflict: "client_id,mes_referencia" },
    );
  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

const togglePayrollSchema = z.object({
  user_id: z.string().uuid(),
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/),
  to_status: z.enum(["pago", "pendente"]),
});

export async function togglePayrollPaymentAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!isPriv(actor.role)) return { error: "Apenas sócio ou ADM" };

  const parsed = togglePayrollSchema.safeParse({
    user_id: String(formData.get("user_id") ?? ""),
    mes_referencia: String(formData.get("mes_referencia") ?? ""),
    to_status: String(formData.get("to_status") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const paid_at = parsed.data.to_status === "pago" ? new Date().toISOString() : null;

  const { error } = await sb
    .from("payroll_payments")
    .upsert(
      {
        organization_id: org.id,
        user_id: parsed.data.user_id,
        mes_referencia: parsed.data.mes_referencia,
        status: parsed.data.to_status,
        paid_at,
        marked_by: actor.id,
      },
      { onConflict: "user_id,mes_referencia" },
    );
  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
