import Link from "next/link";
import { GraduationCap, Plus, Trophy } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listMeusCursos, listAllCursos, getRanking } from "@/lib/academy/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CursoCard } from "@/components/academy/CursoCard";
import { RankingPanel } from "@/components/academy/RankingPanel";

function canCreate(role: string): boolean {
  return role === "adm" || role === "socio" || role === "coordenador";
}

export default async function AcademyPage() {
  const user = await requireAuth();

  // Sócio/adm/coordenador veem TODOS os cursos (pra acompanhar progresso da equipe).
  // Demais users só veem os cursos que estão atribuídos a eles.
  const cursosPromise = canCreate(user.role)
    ? listAllCursos(user.id)
    : listMeusCursos(user.id);

  const [cursos, ranking] = await Promise.all([cursosPromise, getRanking()]);

  const pendentes = cursos.filter((c) => c.meu_status === "pendente");
  const aprovados = cursos.filter((c) => c.meu_status === "aprovado");
  const naoAtribuidos = cursos.filter((c) => c.meu_status === "nao_atribuido");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Yide Academy</h1>
            <p className="text-sm text-muted-foreground">
              Treinamentos da equipe — finalize a prova pra desbloquear pontos.
            </p>
          </div>
        </div>
        {canCreate(user.role) && (
          <Link href="/academy/novo">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo treinamento
            </Button>
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {pendentes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                A fazer ({pendentes.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pendentes.map((c) => (
                  <CursoCard key={c.id} curso={c} />
                ))}
              </div>
            </section>
          )}

          {aprovados.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Concluídos ({aprovados.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {aprovados.map((c) => (
                  <CursoCard key={c.id} curso={c} />
                ))}
              </div>
            </section>
          )}

          {canCreate(user.role) && naoAtribuidos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Outros treinamentos ({naoAtribuidos.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {naoAtribuidos.map((c) => (
                  <CursoCard key={c.id} curso={c} />
                ))}
              </div>
            </section>
          )}

          {cursos.length === 0 && (
            <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium">
                  {canCreate(user.role)
                    ? "Nenhum treinamento criado ainda"
                    : "Você ainda não tem treinamentos atribuídos"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {canCreate(user.role)
                    ? "Crie o primeiro treinamento da equipe."
                    : "Quando o seu líder atribuir um treinamento, ele aparece aqui."}
                </p>
              </div>
              {canCreate(user.role) && (
                <Link href="/academy/novo">
                  <Button>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Criar treinamento
                  </Button>
                </Link>
              )}
            </Card>
          )}
        </div>

        <aside>
          <Card className="sticky top-4 space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold">Ranking geral</h2>
            </div>
            <RankingPanel ranking={ranking} currentUserId={user.id} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
