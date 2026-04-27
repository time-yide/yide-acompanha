import { requireAuth } from "@/lib/auth/session";
import { listFiles } from "@/lib/client-folder/files-actions";
import { FileUploader } from "@/components/client-folder/FileUploader";
import { FilesList } from "@/components/client-folder/FilesList";

export default async function ArquivosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const files = await listFiles(id);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Arquivos</h2>
        <p className="text-xs text-muted-foreground">Briefings, contratos, criativos e outros arquivos do cliente.</p>
      </header>
      <FileUploader clientId={id} />
      <FilesList files={files} />
    </div>
  );
}
