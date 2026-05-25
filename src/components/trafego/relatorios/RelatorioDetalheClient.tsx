"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Sparkles, FileDown, Send, Trash2, AlertCircle, RefreshCw,
} from "lucide-react";
import {
  gerarSlidesAction,
  gerarPdfRelatorioAction,
  publicarRelatorioAction,
  excluirRelatorioAction,
  baixarPdfAction,
} from "@/lib/trafego/relatorios/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SlidePreviewTrafego } from "./SlidePreviewTrafego";
import { SlideEditorInline } from "./SlideEditorInline";
import type { RelatorioRow, Slide } from "@/lib/trafego/relatorios/tipos";

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  relatorio: RelatorioRow;
  clienteNome: string;
}

export function RelatorioDetalheClient({ relatorio: initial, clienteNome }: Props) {
  const router = useRouter();
  const [relatorio, setRelatorio] = useState(initial);
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startGerar] = useTransition();
  const [, startPublicar] = useTransition();
  const [, startExcluir] = useTransition();

  // Autodispara geração se ainda não tem slides.
  useEffect(() => {
    if (relatorio.status === "rascunho" && relatorio.slides.length === 0) {
      startGerar(async () => {
        const r = await gerarSlidesAction(relatorio.id);
        if ("error" in r) setActionError(r.error);
        router.refresh();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling enquanto status='gerando'.
  useEffect(() => {
    if (relatorio.status !== "gerando") return;
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [relatorio.status, router]);

  // Sincroniza prop atualizada após refresh.
  useEffect(() => { setRelatorio(initial); }, [initial]);

  async function handleGerarPdf() {
    setActionError(null);
    setPdfLoading(true);
    try {
      const r = await gerarPdfRelatorioAction(relatorio.id);
      if ("error" in r) {
        setActionError(r.error);
      } else {
        window.open(r.signedUrl, "_blank", "noopener");
        router.refresh();
      }
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleBaixarPdf() {
    setActionError(null);
    const r = await baixarPdfAction(relatorio.id);
    if ("error" in r) setActionError(r.error);
    else window.open(r.url, "_blank", "noopener");
  }

  async function handlePublicar() {
    setActionError(null);
    const fd = new FormData();
    fd.set("id", relatorio.id);
    startPublicar(async () => {
      const r = await publicarRelatorioAction(fd);
      if ("error" in r) setActionError(r.error);
      else router.refresh();
    });
  }

  async function handleExcluir() {
    if (!confirm("Excluir este relatório? Não dá pra desfazer.")) return;
    setActionError(null);
    const fd = new FormData();
    fd.set("id", relatorio.id);
    startExcluir(async () => {
      const r = await excluirRelatorioAction(fd);
      if ("error" in r) setActionError(r.error);
      else router.push("/trafego/relatorios");
    });
  }

  async function handleRetentarGerar() {
    setActionError(null);
    startGerar(async () => {
      const r = await gerarSlidesAction(relatorio.id);
      if ("error" in r) setActionError(r.error);
      router.refresh();
    });
  }

  function onSlideAtualizado(updated: Slide, index: number) {
    setRelatorio((r) => {
      const copy = { ...r, slides: r.slides.slice() };
      copy.slides[index] = updated;
      return copy;
    });
    setEditandoIndex(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            onClick={() => router.push("/trafego/relatorios")}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
          <h1 className="text-2xl font-bold tracking-tight">
            {clienteNome}
          </h1>
          <p className="text-sm text-muted-foreground">
            Período: {formatBR(relatorio.periodo_inicio)} a {formatBR(relatorio.periodo_fim)}{" "}
            · Fonte: <Badge variant="outline">{relatorio.fonte_dados}</Badge>{" "}
            · Status: <Badge variant="outline">{relatorio.status}</Badge>
            {relatorio.publicado_em && (
              <> · <span className="text-emerald-700 dark:text-emerald-300">Publicado</span></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {relatorio.status === "pronta" && !relatorio.pdf_storage_path && (
            <button
              onClick={handleGerarPdf}
              disabled={pdfLoading}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted disabled:opacity-50"
            >
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Gerar PDF
            </button>
          )}
          {relatorio.pdf_storage_path && (
            <button
              onClick={handleBaixarPdf}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted"
            >
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </button>
          )}
          {relatorio.status === "pronta" && relatorio.pdf_storage_path && !relatorio.publicado_em && (
            <button
              onClick={handlePublicar}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
              Publicar pro cliente
            </button>
          )}
          <button
            onClick={handleExcluir}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 text-sm text-red-700 hover:bg-red-500/20 dark:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>
      </header>

      {actionError && (
        <Card className="border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          <p className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {actionError}
          </p>
        </Card>
      )}

      {relatorio.status === "gerando" && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-6 w-6 animate-pulse text-primary" />
          Gerando relatório com IA… (slides aparecem aqui conforme chegam)
        </Card>
      )}

      {relatorio.status === "erro" && (
        <Card className="border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="mb-2 text-red-700 dark:text-red-300">
            Falha na geração. Tente novamente.
          </p>
          <button
            onClick={handleRetentarGerar}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar de novo
          </button>
        </Card>
      )}

      {relatorio.slides.length > 0 && (
        <div className="space-y-4">
          {relatorio.slides.map((slide, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Slide {i + 1} · {slide.template}</span>
                {relatorio.status === "pronta" && !relatorio.publicado_em && (
                  <button
                    onClick={() => setEditandoIndex(i)}
                    className="text-primary hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border">
                <SlidePreviewTrafego slide={slide} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editandoIndex !== null && (
        <SlideEditorInline
          relatorioId={relatorio.id}
          index={editandoIndex}
          slide={relatorio.slides[editandoIndex]}
          onClose={() => setEditandoIndex(null)}
          onSaved={(s) => onSlideAtualizado(s, editandoIndex)}
        />
      )}
    </div>
  );
}
