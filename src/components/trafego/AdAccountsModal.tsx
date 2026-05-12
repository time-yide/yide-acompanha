"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClienteAdAccountsAction } from "@/lib/trafego/actions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientNome: string;
  initial: {
    meta_ad_account_id: string | null;
    google_ads_customer_id: string | null;
  };
}

export function AdAccountsModal({ open, onOpenChange, clientId, clientNome, initial }: Props) {
  const [meta, setMeta] = useState<string>(initial.meta_ad_account_id ?? "");
  const [google, setGoogle] = useState<string>(initial.google_ads_customer_id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("meta_ad_account_id", meta.trim());
    fd.set("google_ads_customer_id", google.trim());
    startTransition(async () => {
      const r = await updateClienteAdAccountsAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contas de anúncios — {clientNome}</DialogTitle>
          <DialogDescription>
            Quando preenchido, a Fase 2 (sync automático) consegue puxar métricas direto das plataformas.
            E a Fase 3 (criação de anúncio direto pelo sistema) usa esses IDs pra subir na conta certa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meta_ad_account_id">Meta Ad Account ID</Label>
            <Input
              id="meta_ad_account_id"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="act_1234567890"
              maxLength={80}
            />
            <p className="text-[10px] text-muted-foreground">
              Pega na BM → Configurações → Contas de Anúncios. Geralmente começa com <code>act_</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="google_ads_customer_id">Google Ads Customer ID</Label>
            <Input
              id="google_ads_customer_id"
              value={google}
              onChange={(e) => setGoogle(e.target.value)}
              placeholder="123-456-7890"
              maxLength={80}
            />
            <p className="text-[10px] text-muted-foreground">
              No Google Ads, no canto superior direito. Formato <code>XXX-XXX-XXXX</code>.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
