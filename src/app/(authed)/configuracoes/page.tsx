import Link from "next/link";
import { Bell } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfileAction } from "@/lib/profile/actions";
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

export default async function ConfiguracoesPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, telefone, tema_preferido")
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

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Notificações</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Configure quais notificações você recebe e por qual canal.
        </p>
        <Link
          href="/configuracoes/notificacoes"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Bell className="h-4 w-4" />
          Gerenciar notificações →
        </Link>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Senha</h2>
        <p className="text-sm text-muted-foreground">
          Para trocar a senha, use o link em &quot;Esqueceu a senha&quot; da tela de
          login.
        </p>
      </Card>
    </div>
  );
}
