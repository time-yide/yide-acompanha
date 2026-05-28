import Link from "next/link";
import { Bell, Hash, Lock } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfileAction } from "@/lib/profile/actions";
import { env } from "@/lib/env";
import { EnablePushButton } from "@/components/pwa/EnablePushButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { AvatarUpload } from "@/components/colaboradores/AvatarUpload";
import { NotificacoesGravacaoToggle } from "@/components/configuracoes/NotificacoesGravacaoToggle";

export default async function ConfiguracoesPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb
    .from("profiles")
    .select("nome, telefone, tema_preferido, avatar_url, notif_alerta_gravacao_pendente")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seu perfil e preferências.
        </p>
      </header>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Foto de perfil</h2>
        <AvatarUpload
          userId={user.id}
          nome={user.nome}
          currentUrl={profile?.avatar_url ?? null}
        />
      </Card>

      <Card className="p-6">
        <form action={updateOwnProfileAction} className="space-y-4">
          <h2 className="text-lg font-semibold">Perfil</h2>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={profile?.nome ?? ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              name="telefone"
              defaultValue={profile?.telefone ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tema_preferido">Tema preferido</Label>
            <Select
              name="tema_preferido"
              defaultValue={profile?.tema_preferido ?? "system"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Seguir sistema</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Salvar</Button>
        </form>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Notificações</h2>
          <p className="text-sm text-muted-foreground">
            Configure quais notificações você recebe e por qual canal.
          </p>
        </div>
        {env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Notificações no dispositivo</p>
            <p className="text-xs text-muted-foreground">
              Recebe notificação do SO (Mac/Windows/iPhone) mesmo com a aba do sistema em segundo plano. Ative em cada dispositivo que você quiser receber.
            </p>
            <EnablePushButton vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
          </div>
        )}
        <Link
          href="/configuracoes/notificacoes"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Bell className="h-4 w-4" />
          Gerenciar tipos de notificação →
        </Link>
        {(user.role === "adm" || user.role === "socio") && (
          <NotificacoesGravacaoToggle
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            defaultAtivo={(profile as any)?.notif_alerta_gravacao_pendente ?? true}
          />
        )}
      </Card>

      {(user.role === "socio" || user.role === "adm") && (
        <Card className="p-6">
          <h2 className="mb-2 text-lg font-semibold">Escritório virtual</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Personaliza a foto dos canais de grupo (sidebar do chat).
          </p>
          <Link
            href="/configuracoes/canais"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Hash className="h-4 w-4" />
            Foto dos canais →
          </Link>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Senha</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Atualize sua senha de acesso. A senha atual será solicitada para
          confirmação.
        </p>
        <Link
          href="/configuracoes/senha"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Lock className="h-4 w-4" />
          Alterar senha →
        </Link>
      </Card>
    </div>
  );
}
