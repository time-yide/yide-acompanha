import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listNichos } from "@/lib/nichos/queries";
import { NichosManager } from "@/components/nichos/NichosManager";

export default async function NichosPage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) redirect("/");

  // Pega a org do user logado (RLS garante acesso só à própria)
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();
  if (!org) redirect("/");

  const nichos = await listNichos(org.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nichos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os nichos de atuação. Datas comemorativas e palavras-chave
          alimentam a automação de conteúdo.
        </p>
      </header>
      <NichosManager nichos={nichos} />
    </div>
  );
}
