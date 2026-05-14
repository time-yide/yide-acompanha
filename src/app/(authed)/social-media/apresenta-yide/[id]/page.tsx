import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Presentation } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getApresentacao } from "@/lib/apresenta-yide/queries";
import { ApresentacaoEditor } from "@/components/apresenta-yide/ApresentacaoEditor";
import { StreamingApresentacao } from "@/components/apresenta-yide/StreamingApresentacao";
import { DownloadPdfButton } from "@/components/apresenta-yide/DownloadPdfButton";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function ApresentacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const apresentacao = await getApresentacao(id);
  if (!apresentacao) notFound();

  const isPrivileged = user.role === "adm" || user.role === "socio";
  const canView = apresentacao.criado_por === user.id || isPrivileged;
  if (!canView) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/social-media/apresenta-yide" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="h-3 w-3" />
          <Presentation className="h-3 w-3" />
          Apresenta Yide
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{apresentacao.titulo}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prompt original
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
              {apresentacao.prompt}
            </p>
          </div>
          {apresentacao.objetivo && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Objetivo
              </h3>
              <p className="mt-2 text-sm text-foreground/90">{apresentacao.objetivo}</p>
            </div>
          )}
          {apresentacao.status === "pronta" && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Exportar
              </h3>
              <p className="mt-2 text-sm text-foreground/90">
                Gera o PDF da apresentação no padrão visual da Yide, pronto pra mandar pro cliente.
              </p>
              <div className="mt-3">
                <DownloadPdfButton
                  apresentacaoId={apresentacao.id}
                  hasExistingPdf={!!apresentacao.pdf_storage_path}
                />
              </div>
            </div>
          )}
        </aside>

        {apresentacao.status === "gerando" ? (
          <StreamingApresentacao
            apresentacaoId={apresentacao.id}
            titulo={apresentacao.titulo}
            initialSlides={apresentacao.slides}
            numSlidesAlvo={apresentacao.num_slides_alvo}
          />
        ) : apresentacao.status === "erro" ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Falha ao gerar essa apresentação. Tente criar uma nova com prompt diferente.
          </div>
        ) : (
          <ApresentacaoEditor
            slides={apresentacao.slides}
            titulo={apresentacao.titulo}
            editable={apresentacao.criado_por === user.id || isPrivileged}
            apresentacaoId={apresentacao.id}
          />
        )}
      </div>
    </div>
  );
}
