import { FolderOpen, FileText, Download, Calendar } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listMateriais, getMaterialSignedUrl } from "@/lib/manual/queries";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";
import { UploadMaterialDialog } from "@/components/manual/UploadMaterialDialog";
import { DeleteMaterialButton } from "@/components/manual/DeleteMaterialButton";
import { Button } from "@/components/ui/button";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function MateriaisPage() {
  const user = await requireAuth();
  const canManage = ["adm", "socio"].includes(user.role);

  const materiais = await listMateriais();

  // Pré-resolve signed URLs no server pra simplificar o link no client.
  const withUrl = await Promise.all(
    materiais.map(async (m) => ({
      ...m,
      signedUrl: await getMaterialSignedUrl(m.storage_path),
    })),
  );

  return (
    <div className="space-y-6">
      <ManualBreadcrumb current="Materiais" />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Materiais</h1>
            <p className="text-sm text-muted-foreground">
              {materiais.length === 0
                ? "Nenhum material ainda"
                : `${materiais.length} ${materiais.length === 1 ? "material" : "materiais"}`}
            </p>
          </div>
        </div>
        {canManage && <UploadMaterialDialog />}
      </header>

      {withUrl.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/10 px-6 py-12 text-center text-sm text-muted-foreground">
          {canManage
            ? 'Sem materiais ainda. Clica em "Novo material" pra subir o primeiro.'
            : "A equipe ainda não publicou materiais aqui. Volta depois."}
        </div>
      ) : (
        <ul className="space-y-2">
          {withUrl.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-card/80"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{m.nome}</h3>
                {m.descricao && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{m.descricao}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatSize(m.size_bytes)}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(m.created_at)}
                  </span>
                  {m.uploaded_by_nome && (
                    <>
                      <span>·</span>
                      <span>por {m.uploaded_by_nome}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {m.signedUrl ? (
                  <a
                    href={m.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={m.nome}
                  >
                    <Button size="sm" variant="outline">
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Baixar
                    </Button>
                  </a>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    Link indisponível
                  </Button>
                )}
                {canManage && <DeleteMaterialButton id={m.id} nome={m.nome} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
