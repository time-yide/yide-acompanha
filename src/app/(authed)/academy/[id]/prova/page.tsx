import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getCursoById, listQuestoes, listResponsaveisDoCurso } from "@/lib/academy/queries";
import { submitProvaAction } from "@/lib/academy/actions";
import { NOTA_MINIMA, QUESTOES_POR_CURSO } from "@/lib/academy/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProvaForm } from "@/components/academy/ProvaForm";

export default async function ProvaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const curso = await getCursoById(id);
  if (!curso) notFound();

  const responsaveis = await listResponsaveisDoCurso(id);
  const isResponsavel = responsaveis.some((r) => r.participante_id === user.id);
  if (!isResponsavel) redirect(`/academy/${id}`);

  // SEM `correta` - gabarito fica só no servidor
  const questoes = await listQuestoes(id, false);
  if (questoes.length !== QUESTOES_POR_CURSO) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/academy/${id}`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <Card className="p-6">
          <p className="text-sm text-destructive">
            Este curso não tem as 10 questões cadastradas. Avise o criador.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href={`/academy/${id}`}>
          <Button variant="ghost" size="sm" className="-ml-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar pro treinamento
          </Button>
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{curso.titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prova final · {QUESTOES_POR_CURSO} questões · acerto mínimo: {NOTA_MINIMA}/{QUESTOES_POR_CURSO}
        </p>
      </header>
      <Card className="p-6">
        <ProvaForm
          cursoId={id}
          questoes={questoes.map((q) => ({
            ordem: q.ordem,
            enunciado: q.enunciado,
            alternativas: q.alternativas,
          }))}
          action={submitProvaAction}
        />
      </Card>
    </div>
  );
}
