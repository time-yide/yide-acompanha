import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listCursosExternos } from "@/lib/cursos-externos/queries";
import { CursoOnlineCard } from "@/components/academy/CursoOnlineCard";
import { CursoOnlineNewButton } from "@/components/academy/CursoOnlineNewButton";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

function canManage(role: string): boolean {
  return role === "adm" || role === "socio" || role === "coordenador";
}

export default async function CursosOnlinePage() {
  const user = await requireAuth();
  const cursos = await listCursosExternos();
  const userCanManage = canManage(user.role);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/academy"
          className={buttonVariants({ variant: "ghost", size: "sm" }) + " -ml-2"}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar pra Academy
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cursos online</h1>
            <p className="text-sm text-muted-foreground">
              Acessos aos cursos externos da Yide (Hotmart, Udemy, etc.) compartilhados com a equipe.
            </p>
          </div>
        </div>
        {userCanManage && <CursoOnlineNewButton />}
      </header>

      {cursos.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">Nenhum curso cadastrado ainda</p>
            <p className="text-sm text-muted-foreground">
              {userCanManage
                ? "Clique em 'Novo curso' pra cadastrar o primeiro."
                : "Quando o sócio cadastrar cursos, eles aparecem aqui."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((curso) => (
            <CursoOnlineCard
              key={curso.id}
              curso={curso}
              canManage={userCanManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
