import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { listChannelsWithUnread } from "@/lib/escritorio/queries";

export default async function EscritorioIndexPage() {
  const user = await requireAuth();
  const channels = await listChannelsWithUnread(user.id, user.role);
  if (channels.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Você não tem acesso a nenhum canal do Escritório Virtual no momento.
        </p>
      </div>
    );
  }
  // Redireciona pro canal com mensagens não lidas, ou pro primeiro
  const target = channels.find((c) => c.unread_count > 0) ?? channels[0];
  redirect(`/escritorio/${target.kind}`);
}
