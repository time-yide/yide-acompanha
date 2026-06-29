"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { baixarPdfClienteSocialAction } from "@/lib/social-media/relatorios/actions";

export function BaixarRelatorioSocialButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    setErro(null);
    setBusy(true);
    const r = await baixarPdfClienteSocialAction(id);
    setBusy(false);
    if ("error" in r) {
      setErro(r.error);
      return;
    }
    window.open(r.url, "_blank", "noopener");
  }

  return (
    <div>
      <Button type="button" size="sm" onClick={baixar} disabled={busy}>
        {busy ? "Abrindo..." : "Baixar PDF"}
      </Button>
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}
