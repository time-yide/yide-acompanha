import Link from "next/link";
import { getFileSignedUrl } from "@/lib/client-folder/files-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";

interface FileRow {
  id: string;
  categoria: string;
  nome_arquivo: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  uploader?: { nome: string } | null;
}

const catLabels: Record<string, string> = {
  briefing: "Briefing", contrato: "Contrato", criativo: "Criativo", outro: "Outro",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function FilesList({ files }: { files: FileRow[] }) {
  if (files.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhum arquivo enviado.
      </Card>
    );
  }

  const filesWithUrls = await Promise.all(
    files.map(async (f) => ({ ...f, signedUrl: await getFileSignedUrl(f.storage_path) })),
  );

  return (
    <ul className="space-y-2">
      {filesWithUrls.map((f) => (
        <li key={f.id}>
          <Card className="flex items-center gap-3 p-3">
            <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{f.nome_arquivo}</span>
                <Badge variant="secondary" className="flex-shrink-0">{catLabels[f.categoria]}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {f.uploader?.nome ?? "—"} · {new Date(f.created_at).toLocaleDateString("pt-BR")} · {formatSize(f.size_bytes)}
              </div>
            </div>
            {f.signedUrl && (
              <Link href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-primary hover:text-primary/80">
                <Download className="h-4 w-4" />
              </Link>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
