import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseEditorIa, isEditorIaEnabled } from "@/lib/editor-ia/feature-flag";
import { getJob } from "@/lib/editor-ia/queries";
import { getSignedUrl } from "@/lib/editor-ia/storage";
import { EDITOR_IA_STATUS_LABELS, type EditPlan } from "@/lib/editor-ia/tipos";
import { TimelineRevisao } from "@/components/editor-ia/TimelineRevisao";

export const dynamic = "force-dynamic";

export default async function EditorIaJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const user = await requireAuth();
  if (!canUseEditorIa(user.role)) redirect("/audiovisual");
  if (!isEditorIaEnabled()) redirect("/audiovisual");

  const job = await getJob(jobId);
  if (!job) notFound();
  if (job.user_id !== user.id) redirect("/audiovisual/editor-ia");

  const videoUrl = job.video_url ? await getSignedUrl(job.video_url) : null;
  const outputUrl =
    job.status === "pronto" && job.output_url
      ? await getSignedUrl(job.output_url)
      : null;

  let stateMessage: string | null = null;
  if (job.status === "enviando") stateMessage = "Enviando vídeo...";
  else if (job.status === "transcrevendo") stateMessage = "Transcrevendo áudio...";
  else if (job.status === "planejando") stateMessage = "Planejando edição (IA)...";
  else if (job.status === "renderizando")
    stateMessage = "Renderizando... isso atualiza sozinho (recarregue em instantes).";
  else if (job.status === "pronto" && !outputUrl)
    stateMessage = "Pronto. O download estará disponível em breve.";
  else if (job.status === "erro") stateMessage = `Erro: ${job.erro ?? "falha desconhecida"}`;

  const showTimeline =
    job.status === "aguardando_revisao" && job.edit_plan != null;

  return (
    <div className="max-w-4xl space-y-4">
      <Link
        href="/audiovisual/editor-ia"
        prefetch={false}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          {job.instrucao
            ? job.instrucao.length > 120
              ? job.instrucao.slice(0, 120) + "..."
              : job.instrucao
            : "(sem instrução)"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {EDITOR_IA_STATUS_LABELS[job.status]} &middot;{" "}
          {new Date(job.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      {outputUrl && (
        <a
          href={outputUrl}
          download
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Baixar vídeo
        </a>
      )}

      {showTimeline ? (
        <TimelineRevisao
          jobId={job.id}
          videoUrl={videoUrl}
          editPlan={job.edit_plan as EditPlan}
        />
      ) : stateMessage ? (
        <p className="text-sm text-muted-foreground">{stateMessage}</p>
      ) : null}
    </div>
  );
}
