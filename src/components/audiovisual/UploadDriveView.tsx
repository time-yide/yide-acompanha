"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { formatShortDateTimeBR } from "@/lib/datetime/timezone";
import { CATEGORIAS_VIDEO, hrefPastaDrive } from "@/lib/google-drive/naming";
import type { DriveUploadRecente } from "@/lib/google-drive/actions";
import { DriveUploader, formatBytes } from "./DriveUploader";

interface Props {
  clients: SearchableOption[];
  /** "YYYY-MM-DD" de hoje no fuso do app — define a pasta do mês. */
  hoje: string;
  recentes: DriveUploadRecente[];
}

function labelCategoria(value: string): string {
  return CATEGORIAS_VIDEO.find((c) => c.value === value)?.pasta ?? value;
}

export function UploadDriveView({ clients, hoje, recentes }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Subir vídeos pro Drive</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o cliente e a categoria e arraste os vídeos. O sistema cria as pastas
          Cliente / Mês / Categoria e numera os arquivos (video-01, video-02…).
        </p>
      </header>

      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Cliente</label>
          <SearchableSelect
            options={clients}
            value={clientId}
            onChange={setClientId}
            placeholder="Buscar cliente…"
            emptyText="Nenhum cliente encontrado"
          />
        </div>
        <DriveUploader
          clientId={clientId}
          dataReferencia={hoje}
          notificarEditor
          onConcluido={() => router.refresh()}
        />
      </Card>

      {recentes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Envios recentes</h2>
          <Card className="max-h-96 divide-y overflow-y-auto">
            {recentes.map((u) => {
              const href = hrefPastaDrive(u.folder_url);
              return (
              <div key={u.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0 truncate">
                  <span className="font-medium">{u.client_nome ?? "—"}</span>
                  <span className="ml-2 text-muted-foreground">{labelCategoria(u.categoria)} · {u.nome_drive}</span>
                  <span className="ml-2 text-xs text-muted-foreground/70">{formatBytes(u.size_bytes)}</span>
                  {u.uploader_nome && <span className="ml-2 text-xs text-muted-foreground/70">por {u.uploader_nome}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatShortDateTimeBR(u.created_at)}</span>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer" title="Abrir pasta no Drive" aria-label="Abrir pasta no Drive">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </a>
                  )}
                </div>
              </div>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}
