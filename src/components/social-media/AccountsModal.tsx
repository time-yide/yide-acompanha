"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClienteSocialAccountsAction } from "@/lib/social-media/actions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientNome: string;
  initial: {
    instagram_business_id: string | null;
    facebook_page_id: string | null;
    linkedin_company_id: string | null;
    gmn_location_id: string | null;
  };
}

export function AccountsModal({ open, onOpenChange, clientId, clientNome, initial }: Props) {
  const [ig, setIg] = useState(initial.instagram_business_id ?? "");
  const [fb, setFb] = useState(initial.facebook_page_id ?? "");
  const [li, setLi] = useState(initial.linkedin_company_id ?? "");
  const [gmn, setGmn] = useState(initial.gmn_location_id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("instagram_business_id", ig.trim());
    fd.set("facebook_page_id", fb.trim());
    fd.set("linkedin_company_id", li.trim());
    fd.set("gmn_location_id", gmn.trim());
    startTransition(async () => {
      const r = await updateClienteSocialAccountsAction(fd);
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
          <DialogTitle>Contas de redes sociais · {clientNome}</DialogTitle>
          <DialogDescription>
            Necessário pra Fase 2 publicar automático. Cada cliente precisa do
            Instagram Business vinculado a uma Facebook Page dentro da sua BM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ig">Instagram Business ID</Label>
            <Input
              id="ig"
              value={ig}
              onChange={(e) => setIg(e.target.value)}
              placeholder="17841401234567890"
              maxLength={80}
            />
            <p className="text-[10px] text-muted-foreground">
              No Meta Business Suite → Configurações → Contas → Instagram → ID da conta.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb">Facebook Page ID</Label>
            <Input
              id="fb"
              value={fb}
              onChange={(e) => setFb(e.target.value)}
              placeholder="1234567890123456"
              maxLength={80}
            />
            <p className="text-[10px] text-muted-foreground">
              Na página do Facebook → Sobre → ID da página.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="li" className="flex items-center gap-1">
              LinkedIn Company ID
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                Fase 4
              </span>
            </Label>
            <Input
              id="li"
              value={li}
              onChange={(e) => setLi(e.target.value)}
              placeholder="12345678"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gmn" className="flex items-center gap-1">
              Google Meu Negócio Location ID
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                Fase 4
              </span>
            </Label>
            <Input
              id="gmn"
              value={gmn}
              onChange={(e) => setGmn(e.target.value)}
              placeholder="locations/12345"
              maxLength={80}
            />
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
