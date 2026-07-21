import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { getPesquisaComPerguntas, podeResponder } from "@/lib/pesquisas/queries";
import { ResponderForm } from "@/components/pesquisas/ResponderForm";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function ResponderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const data = await getPesquisaComPerguntas(id);
  if (!data) notFound();

  const pode = await podeResponder(id, user.id);
  if (!pode) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
          <p className="text-base font-medium text-foreground">{data.pesquisa.titulo}</p>
          <p>
            {data.pesquisa.status !== "aberta"
              ? "Esta pesquisa não está mais aberta."
              : "Você já respondeu ou não é destinatário desta pesquisa."}
          </p>
          <Link href="/pesquisas" className={buttonVariants({ variant: "outline" })}>Voltar</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ResponderForm
        pesquisaId={id}
        titulo={data.pesquisa.titulo}
        descricao={data.pesquisa.descricao}
        perguntas={data.perguntas}
      />
    </div>
  );
}
