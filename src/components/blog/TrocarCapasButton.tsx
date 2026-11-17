"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trocarCapasPorFotosReaisAction } from "@/lib/blog/actions";

export function TrocarCapasButton({ total }: { total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function trocar() {
    if (!window.confirm(`Trocar a capa de ${total} post(s) por fotos reais do Pexels? Vale também pros já publicados. Pode levar 1-2 min.`)) return;
    start(async () => {
      const r = await trocarCapasPorFotosReaisAction();
      if ("error" in r) { toast.error(r.error); return; }
      const msg = `${r.trocadas} capa(s) trocada(s).`;
      if (r.limitePexels) toast.warning(`${msg} O Pexels limitou as buscas: clique de novo daqui a 1 hora pras ${r.faltam} restantes.`);
      else if (r.faltam > 0) toast.warning(`${msg} Faltam ${r.faltam}: clique de novo pra continuar.`);
      else toast.success(msg);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={trocar} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Trocar capas por fotos reais ({total})
    </Button>
  );
}
