import { PlayCircle, ExternalLink, Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import {
  listTutoriais,
  toEmbedUrl,
  SETOR_LABEL,
  SETOR_ORDER,
  type TutorialSetor,
  type TutorialRow,
} from "@/lib/manual/tutoriais";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";
import { TutorialFormDialog } from "@/components/manual/TutorialFormDialog";
import { DeleteTutorialButton } from "@/components/manual/DeleteTutorialButton";

export default async function PassoAPassoPage() {
  const user = await requireAuth();
  const canManage = ["adm", "socio"].includes(user.role);

  const tutoriais = await listTutoriais();

  // Agrupa por setor. Null vira "Geral".
  const grupos = new Map<TutorialSetor | "geral", TutorialRow[]>();
  for (const t of tutoriais) {
    const key: TutorialSetor | "geral" = t.setor ?? "geral";
    const arr = grupos.get(key) ?? [];
    arr.push(t);
    grupos.set(key, arr);
  }

  // Ordem: geral primeiro, depois setores conforme SETOR_ORDER
  const setoresOrdenados: Array<{ key: TutorialSetor | "geral"; label: string; items: TutorialRow[] }> = [];
  if (grupos.has("geral")) {
    setoresOrdenados.push({ key: "geral", label: "Geral", items: grupos.get("geral")! });
  }
  for (const s of SETOR_ORDER) {
    if (grupos.has(s)) {
      setoresOrdenados.push({ key: s, label: SETOR_LABEL[s], items: grupos.get(s)! });
    }
  }

  return (
    <div className="space-y-6">
      <ManualBreadcrumb current="Passo a passo do sistema" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <PlayCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Passo a passo do sistema</h1>
            <p className="text-sm text-muted-foreground">
              Vídeos curtos ensinando cada setor a usar o sistema. Assista o do seu papel.
            </p>
          </div>
        </div>
        {canManage && <TutorialFormDialog />}
      </header>

      {tutoriais.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/10 px-6 py-12 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/40" />
          <div className="space-y-1">
            <p className="font-medium">Nenhum tutorial ainda</p>
            <p className="text-sm text-muted-foreground">
              {canManage
                ? 'Clica em "Novo tutorial" pra cadastrar o primeiro vídeo.'
                : "A equipe ainda não publicou tutoriais. Volta depois."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {setoresOrdenados.map((grupo) => (
            <section key={grupo.key} className="space-y-3">
              <header className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {grupo.label}
                </h2>
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold tabular-nums text-primary">
                  {grupo.items.length}
                </span>
              </header>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {grupo.items.map((t) => (
                  <TutorialCard key={t.id} tutorial={t} canManage={canManage} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TutorialCard({
  tutorial,
  canManage,
}: {
  tutorial: TutorialRow;
  canManage: boolean;
}) {
  const embedUrl = toEmbedUrl(tutorial.video_url);
  return (
    <article className="overflow-hidden rounded-xl border bg-card transition-colors hover:bg-card/80">
      {embedUrl ? (
        <div className="relative aspect-video bg-black/80">
          <iframe
            src={embedUrl}
            title={tutorial.titulo}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        <a
          href={tutorial.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex aspect-video items-center justify-center gap-2 bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir vídeo no link externo
        </a>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{tutorial.titulo}</h3>
          <a
            href={tutorial.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Abrir no link original"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {tutorial.descricao && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {tutorial.descricao}
          </p>
        )}
        {(tutorial.uploaded_by_nome || canManage) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">
              {tutorial.uploaded_by_nome ? `por ${tutorial.uploaded_by_nome}` : ""}
            </span>
            {canManage && (
              <div className="flex items-center gap-1">
                <TutorialFormDialog
                  edit={{
                    id: tutorial.id,
                    titulo: tutorial.titulo,
                    descricao: tutorial.descricao,
                    setor: tutorial.setor,
                    video_url: tutorial.video_url,
                    ordem: tutorial.ordem,
                  }}
                />
                <DeleteTutorialButton id={tutorial.id} titulo={tutorial.titulo} />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
