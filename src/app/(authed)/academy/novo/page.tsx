import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CursoForm } from "@/components/academy/CursoForm";
import { createCursoAction } from "@/lib/academy/actions";

function canCreate(role: string): boolean {
  return role === "adm" || role === "socio" || role === "coordenador";
}

export default async function NovoCursoPage() {
  const user = await requireAuth();
  if (!canCreate(user.role)) redirect("/academy");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/academy" className="inline-flex">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo treinamento</h1>
        <p className="text-sm text-muted-foreground">
          Descreva o material e crie 10 questões obrigatórias pra prova final.
        </p>
      </header>
      <Card className="p-6">
        <CursoForm action={createCursoAction} profiles={profiles ?? []} />
      </Card>
    </div>
  );
}
