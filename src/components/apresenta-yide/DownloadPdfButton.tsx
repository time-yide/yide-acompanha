"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { gerarPdfApresentacaoAction } from "@/lib/apresenta-yide/actions";

interface Props {
  apresentacaoId: string;
  /** Se já tem PDF gerado, mostra "Baixar PDF". Senão, "Gerar PDF". */
  hasExistingPdf: boolean;
}

export function DownloadPdfButton({ apresentacaoId, hasExistingPdf }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const r = await gerarPdfApresentacaoAction(apresentacaoId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      // Abre em nova aba pra download — signed URL é válido por 1h.
      window.open(r.signedUrl, "_blank", "noopener,noreferrer");
      toast.success("PDF aberto em nova aba");
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          {hasExistingPdf ? "Baixar PDF" : "Gerar PDF"}
        </>
      )}
    </Button>
  );
}
