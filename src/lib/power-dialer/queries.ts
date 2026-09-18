import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PowerDialerConfig, PDBatch, PDBatchCall } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export async function getPowerDialerConfig(
  orgId: string,
): Promise<(PowerDialerConfig & { id: string }) | null> {
  const { data } = await sb()
    .from("ai_voice_configs")
    .select("id, power_dialer_ativo, power_dialer_batch_size, power_dialer_timeout_s, power_dialer_colaborador_id, power_dialer_greeting, power_dialer_goodbye")
    .eq("organization_id", orgId)
    .eq("ativo", true)
    .maybeSingle();
  return data ?? null;
}

export async function getActiveBatchForColaborador(
  colaboradorId: string,
): Promise<PDBatch | null> {
  const { data } = await sb()
    .from("power_dialer_batches")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .in("status", ["discando", "conectado"])
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getBatchById(batchId: string): Promise<PDBatch | null> {
  const { data } = await sb()
    .from("power_dialer_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  return data ?? null;
}

export async function getBatchCalls(batchId: string): Promise<PDBatchCall[]> {
  const { data } = await sb()
    .from("power_dialer_batch_calls")
    .select("*")
    .eq("batch_id", batchId);
  return data ?? [];
}

export async function getBatchCallBySid(
  callSid: string,
): Promise<(PDBatchCall & { batch_id: string }) | null> {
  const { data } = await sb()
    .from("power_dialer_batch_calls")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  return data ?? null;
}
