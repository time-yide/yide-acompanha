import { requireAuth } from "@/lib/auth/session";
import { listMyNotifications } from "@/lib/notificacoes/queries";
import { markAllNotificationsReadAction } from "@/lib/notificacoes/actions";
import { NotificationItem } from "@/components/notificacoes/NotificationItem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function NotificacoesPage() {
  await requireAuth();
  const items = await listMyNotifications(100);

  async function markAll() {
    "use server";
    await markAllNotificationsReadAction();
  }

  const unreadCount = items.filter((i) => !i.lida).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} no total · {unreadCount} não lidas
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAll}>
            <Button type="submit" variant="outline" size="sm">
              Marcar todas como lidas
            </Button>
          </form>
        )}
      </header>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Você não tem notificações.
        </Card>
      ) : (
        <Card className="divide-y p-2">
          {items.map((it) => (
            <NotificationItem key={it.id} {...it} />
          ))}
        </Card>
      )}
    </div>
  );
}
