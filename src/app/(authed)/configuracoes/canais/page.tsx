import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ChannelIconRow } from "@/components/escritorio/ChannelIconRow";

interface ChannelRow {
  id: string;
  kind: string;
  nome: string;
  descricao: string | null;
  icon_url: string | null;
}

export default async function CanaisAdminPage() {
  const user = await requireAuth();
  if (user.role !== "socio" && user.role !== "adm") {
    redirect("/configuracoes");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, icon_url")
    .neq("kind", "direct")
    .order("ordem", { ascending: true });
  const channels = (data ?? []) as ChannelRow[];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Foto dos canais</h1>
        <p className="text-sm text-muted-foreground">
          Sobe uma imagem por canal. Aparece na sidebar do Escritório virtual no lugar do
          ícone padrão. Conversas diretas (DM) usam a foto da pessoa, não dessa lista.
        </p>
      </header>

      <div className="space-y-2">
        {channels.map((c) => (
          <ChannelIconRow
            key={c.id}
            channelId={c.id}
            nome={c.nome}
            descricao={c.descricao}
            initialIconUrl={c.icon_url}
          />
        ))}
      </div>
    </div>
  );
}
