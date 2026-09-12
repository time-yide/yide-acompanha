import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getActiveConfig } from "@/lib/voz-ia/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ConfigVozIAForm } from "@/components/voz-ia/ConfigVozIAForm";
import { TestarLigacaoIA } from "@/components/voz-ia/TestarLigacaoIA";
import { ROLES_CONFIG_VOZ_IA } from "@/lib/voz-ia/types";
import { Bot } from "lucide-react";

export default async function ConfigVozIAPage() {
  const user = await requireAuth();
  if (!ROLES_CONFIG_VOZ_IA.includes(user.role)) notFound();

  const sb = createServiceRoleClient() as any;
  const { data: profile } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile) notFound();

  const config = await getActiveConfig(profile.organization_id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bot className="h-6 w-6" /> Voz IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure o agente de voz que liga para leads automaticamente.
        </p>
      </div>
      <ConfigVozIAForm config={config} />
      <TestarLigacaoIA />
    </div>
  );
}
