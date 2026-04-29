import { requireAuth } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/configuracoes/ChangePasswordForm";
import { Card } from "@/components/ui/card";

export default async function ChangePasswordPage() {
  await requireAuth();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Alterar senha</h1>
        <p className="text-sm text-muted-foreground">
          Sua senha será atualizada imediatamente. Você continuará logado.
        </p>
      </header>
      <Card className="p-6">
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
