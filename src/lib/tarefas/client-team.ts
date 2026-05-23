// SERVER ONLY
import { createClient } from "@/lib/supabase/server";

export interface ClienteEquipe {
  assessor_id: string | null;
  coordenador_id: string | null;
  designer_id: string | null;
}

/** Puxa os 3 papéis-chave do cliente pra preencher equipe na criação de tarefa. */
export async function getClienteEquipe(clientId: string): Promise<ClienteEquipe | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("assessor_id, coordenador_id, designer_id")
    .eq("id", clientId)
    .single();
  return (data as ClienteEquipe | null) ?? null;
}

/**
 * Retorna IDs de todos os coordenadores audiovisuais ativos. Usado pra
 * auto-incluir o coordenador como participante quando assessor cria/delega
 * uma demanda de vídeo - pra ele acompanhar a entrega independente de quem
 * vai executar.
 */
export async function getCoordenadoresAudiovisualIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "audiovisual_chefe")
    .eq("ativo", true);
  return (data ?? []).map((p) => p.id as string);
}
