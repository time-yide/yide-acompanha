import { Bell } from "lucide-react";
import { EnablePushButton } from "./EnablePushButton";

interface Props {
  vapidPublicKey: string | undefined;
}

/**
 * Card que oferece ativar push no portal. Some silenciosamente se VAPID
 * não estiver configurado (mesmo padrão do interno em /configuracoes).
 */
export function NotificacoesSection({ vapidPublicKey }: Props) {
  if (!vapidPublicKey) return null;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Notificações</h2>
            <p className="text-xs text-muted-foreground">
              Receba avisos da Yide direto no seu celular
            </p>
          </div>
        </header>

        <div className="mt-5">
          <EnablePushButton vapidPublicKey={vapidPublicKey} />
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          No iPhone: instale o app antes (Safari → ícone de compartilhar →
          &quot;Adicionar à Tela de Início&quot;).
        </p>
      </div>
    </section>
  );
}
