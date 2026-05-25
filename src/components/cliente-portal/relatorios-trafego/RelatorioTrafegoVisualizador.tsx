"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { baixarPdfClienteAction } from "@/lib/trafego/relatorios/actions";
import { SlidePreviewTrafego } from "@/components/trafego/relatorios/SlidePreviewTrafego";
import { Card } from "@/components/ui/card";
import type { RelatorioRow } from "@/lib/trafego/relatorios/tipos";

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  relatorio: RelatorioRow;
  clienteNome: string;
}

export function RelatorioTrafegoVisualizador({ relatorio, clienteNome }: Props) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    setErro(null);
    setLoading(true);
    try {
      const r = await baixarPdfClienteAction(relatorio.id);
      if ("error" in r) setErro(r.error);
      else window.open(r.url, "_blank", "noopener");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:py-8">
      <Link
        href="/cliente/relatorios-trafego"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar à lista
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{clienteNome}</h1>
          <p className="text-sm text-muted-foreground">
            Relatório de Tráfego · {formatBR(relatorio.periodo_inicio)} a {formatBR(relatorio.periodo_fim)}
          </p>
        </div>
        {relatorio.pdf_storage_path && (
          <button
            onClick={baixar}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Baixar PDF
          </button>
        )}
      </header>

      {erro && (
        <Card className="border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {erro}
        </Card>
      )}

      <div className="space-y-4">
        {relatorio.slides.map((slide, i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            <SlidePreviewTrafego slide={slide} />
          </div>
        ))}
      </div>
    </div>
  );
}
