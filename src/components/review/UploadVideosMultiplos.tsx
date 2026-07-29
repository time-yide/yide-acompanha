"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Check, AlertTriangle } from "lucide-react";
import { adicionarVideoAction } from "@/lib/review/tarefa-actions";
import { uploadVideoTus } from "@/lib/review/upload-tus";

type ItemState = { nome: string; prog: number; erro?: boolean; pronto?: boolean };

// Sobe 2 vídeos ao mesmo tempo: rápido sem saturar a rede/navegador.
const CONCORRENCIA = 2;

/**
 * Adiciona VÁRIOS vídeos de uma vez (antes era 1 por 1: adiciona → envia →
 * adiciona de novo). Seleciona N arquivos, cria cada review_video e sobe o
 * arquivo pro Bunny, 2 em paralelo, com progresso por arquivo. O status
 * "Processando…" de cada vídeo aparece na lista assim que o upload termina.
 */
export function UploadVideosMultiplos({ taskId, proximoNumero }: { taskId: string; proximoNumero: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<ItemState[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function enviar(files: File[]) {
    setEnviando(true);
    setItens(files.map((f) => ({ nome: f.name, prog: 0 })));

    let idx = 0;
    let enviados = 0;
    let falharam = 0;
    async function worker() {
      // JS é single-thread: `idx++` pega o próximo índice sem corrida.
      while (idx < files.length) {
        const i = idx++;
        const file = files[i];
        try {
          const r = await adicionarVideoAction(taskId, `Vídeo ${proximoNumero + i}`);
          if ("error" in r) throw new Error(r.error);
          await uploadVideoTus(file, r.upload, `video-${proximoNumero + i}`, (p) =>
            setItens((prev) => prev.map((it, j) => (j === i ? { ...it, prog: p } : it))),
          );
          enviados++;
          setItens((prev) => prev.map((it, j) => (j === i ? { ...it, prog: 100, pronto: true } : it)));
        } catch {
          falharam++;
          setItens((prev) => prev.map((it, j) => (j === i ? { ...it, erro: true } : it)));
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, files.length) }, worker));

    setEnviando(false);
    if (enviados > 0) toast.success(`${enviados} vídeo(s) enviado(s) — processando no Bunny.`);
    if (falharam > 0) toast.error(`${falharam} vídeo(s) falharam no envio.`);
    router.refresh();
    // Limpa a lista depois de dar tempo de ler.
    setTimeout(() => setItens([]), 4000);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          e.target.value = ""; // permite reescolher os mesmos arquivos depois
          if (fs.length) void enviar(fs);
        }}
        disabled={enviando}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
      >
        {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        {enviando ? "Enviando…" : "Adicionar vídeos"}
      </Button>

      {itens.length > 0 && (
        <ul className="mt-2 space-y-1">
          {itens.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.nome}</span>
              {it.erro ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" /> falhou
                </span>
              ) : it.pronto ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> enviado
                </span>
              ) : (
                <span className="tabular-nums text-muted-foreground">{it.prog}%</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
