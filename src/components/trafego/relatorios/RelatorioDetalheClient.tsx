"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, FileDown, Send, Trash2, AlertCircle, Info,
} from "lucide-react";
import {
  gerarPdfRelatorioAction,
  publicarRelatorioAction,
  excluirRelatorioAction,
  baixarPdfAction,
} from "@/lib/trafego/relatorios/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RelatorioReportei, temDadosReportei } from "./RelatorioReportei";
import { dadosEfetivos } from "@/lib/trafego/relatorios/tipos";
import type { RelatorioRow } from "@/lib/trafego/relatorios/tipos";

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  relatorio: RelatorioRow;
  clienteNome: string;
}

export function RelatorioDetalheClient({ relatorio, clienteNome }: Props) {
  const router = useRouter();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const dados = dadosEfetivos(relatorio);
  const temDados = temDadosReportei(dados);

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
    setPublicando(true);
    const fd = new FormData();
    fd.set("id", relatorio.id);
    try {
      const r = await publicarRelatorioAction(fd);
      if ("error" in r) setActionError(r.error);
      else router.refresh();
    } finally {
      setPublicando(false);
    }
  }

  async function handleExcluir() {
    if (!confirm("Excluir este relatório? Não dá pra desfazer.")) return;
    setActionError(null);
    setExcluindo(true);
    const fd = new FormData();
    fd.set("id", relatorio.id);
    try {
      const r = await excluirRelatorioAction(fd);
      if ("error" in r) {
        setActionError(r.error);
        setExcluindo(false);
      } else {
        router.push("/trafego/relatorios");
      }
    } catch {
      setExcluindo(false);
    }
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
            · Fonte: <Badge variant="outline">{relatorio.fonte_dados}</Badge>
            {relatorio.publicado_em && (
              <> · <span className="text-emerald-700 dark:text-emerald-300">Publicado</span></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {temDados && !relatorio.pdf_storage_path && (
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
          {relatorio.pdf_storage_path && !relatorio.publicado_em && (
            <button
              onClick={handlePublicar}
              disabled={publicando}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publicar pro cliente
            </button>
          )}
          <button
            onClick={handleExcluir}
            disabled={excluindo}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 text-sm text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
          >
            {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

      {temDados && dados ? (
        <div className="overflow-hidden rounded-xl border">
          <RelatorioReportei
            dados={dados}
            clienteNome={clienteNome}
            periodoInicio={relatorio.periodo_inicio}
            periodoFim={relatorio.periodo_fim}
          />
        </div>
      ) : (
        <Card className="flex items-start gap-2 p-6 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Este relatório não tem dados de tráfego suficientes para exibir o dashboard.
            Isso costuma acontecer com relatórios antigos (formato de slides) ou com períodos
            sem investimento na Meta. Crie um novo relatório para o período desejado.
          </span>
        </Card>
      )}
    </div>
  );
}
