"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Search, Link2, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { listMetaAccountsAction, updateClienteSocialAccountsAction } from "@/lib/social-media/actions";
import {
  listarContasClienteAction, iniciarConexaoAction, capturarConexaoAction, desconectarPfmAction,
} from "@/lib/social-media/postforme-actions";
import type { MetaAccount } from "@/lib/social-media/meta-publish";

const PFM_REDES: { plataforma: string; label: string }[] = [
  { plataforma: "tiktok", label: "TikTok" },
  { plataforma: "youtube", label: "YouTube" },
  { plataforma: "linkedin", label: "LinkedIn" },
];

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

  // "Buscar contas" — lista as Páginas/Instagram do token e preenche os IDs
  // automaticamente, sem copiar/colar na mão.
  const [accounts, setAccounts] = useState<MetaAccount[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [buscaError, setBuscaError] = useState<string | null>(null);

  // Post for Me (TikTok / YouTube / LinkedIn): conexão por rede.
  const [pfmContas, setPfmContas] = useState<Record<string, string | null>>({});
  const [pfmBusy, setPfmBusy] = useState<string | null>(null);
  const [pfmAviso, setPfmAviso] = useState<string | null>(null);

  const carregarPfm = useCallback(async () => {
    const r = await listarContasClienteAction(clientId);
    if ("contas" in r) {
      const map: Record<string, string | null> = {};
      for (const c of r.contas) map[c.plataforma] = c.username ?? null;
      setPfmContas(map);
    }
  }, [clientId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      const r = await listarContasClienteAction(clientId);
      if (!active || !("contas" in r)) return;
      const map: Record<string, string | null> = {};
      for (const c of r.contas) map[c.plataforma] = c.username ?? null;
      setPfmContas(map);
    })();
    return () => {
      active = false;
    };
  }, [open, clientId]);

  async function conectarPfm(plataforma: string) {
    setPfmAviso(null);
    setPfmBusy(plataforma);
    const r = await iniciarConexaoAction(clientId, plataforma);
    setPfmBusy(null);
    if ("error" in r) {
      setPfmAviso(r.error);
      return;
    }
    window.open(r.url, "_blank", "noopener");
    setPfmAviso(`Autorize na aba que abriu e depois clique "Já autorizei".`);
  }

  async function confirmarPfm(plataforma: string) {
    setPfmAviso(null);
    setPfmBusy(plataforma);
    const r = await capturarConexaoAction(clientId, plataforma);
    setPfmBusy(null);
    if ("error" in r) {
      setPfmAviso(r.error);
      return;
    }
    await carregarPfm();
  }

  async function desconectarPfm(plataforma: string) {
    setPfmBusy(plataforma);
    await desconectarPfmAction(clientId, plataforma);
    setPfmBusy(null);
    await carregarPfm();
  }

  async function buscarContas() {
    setBuscaError(null);
    setBuscando(true);
    const r = await listMetaAccountsAction();
    setBuscando(false);
    if ("error" in r) {
      setBuscaError(r.error);
      return;
    }
    setAccounts(r.accounts);
  }

  function escolherConta(pageId: string | null) {
    const conta = accounts?.find((a) => a.pageId === pageId);
    if (!conta) return;
    setFb(conta.pageId);
    setIg(conta.igId ?? "");
  }

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
          {/* Buscar contas conectadas (estilo mLabs) — evita copiar ID na mão */}
          <div className="space-y-2 rounded-md border border-dashed border-input bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Buscar contas conectadas</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={buscarContas}
                disabled={buscando}
              >
                <Search className="h-3.5 w-3.5" />
                {buscando ? "Buscando..." : accounts ? "Atualizar" : "Buscar contas"}
              </Button>
            </div>
            {accounts &&
              (accounts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma conta encontrada. Confira se as Páginas e contas do
                  Instagram foram atribuídas ao System User na Business Manager.
                </p>
              ) : (
                <>
                  <SearchableSelect
                    options={accounts.map((a) => ({
                      value: a.pageId,
                      label: a.igUsername
                        ? `${a.pageName} · @${a.igUsername}`
                        : `${a.pageName} · (sem Instagram)`,
                    }))}
                    value={accounts.some((a) => a.pageId === fb) ? fb : null}
                    onChange={escolherConta}
                    placeholder="Escolha a conta deste cliente..."
                    emptyText="Nenhuma conta encontrada"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Preenche o Instagram e o Facebook automaticamente. Dá pra
                    ajustar manualmente abaixo se precisar.
                  </p>
                </>
              ))}
            {buscaError && <p className="text-[11px] text-destructive">{buscaError}</p>}
          </div>

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

          {/* Post for Me — TikTok / YouTube / LinkedIn (conecta sem copiar ID) */}
          <div className="space-y-2 rounded-md border border-dashed border-input bg-muted/30 p-3">
            <p className="text-xs font-medium">Outras redes (TikTok / YouTube / LinkedIn)</p>
            <p className="text-[10px] text-muted-foreground">
              Conecta direto via Post for Me — sem copiar ID. Você autoriza a conta do cliente.
            </p>
            {PFM_REDES.map((rede) => {
              const conectado = rede.plataforma in pfmContas;
              const user = pfmContas[rede.plataforma];
              return (
                <div key={rede.plataforma} className="flex items-center justify-between gap-2">
                  <span className="text-xs">
                    {rede.label}
                    {conectado && (
                      <span className="ml-1 text-green-600 dark:text-green-400">
                        ✓ {user ? `@${user}` : "conectado"}
                      </span>
                    )}
                  </span>
                  {conectado ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pfmBusy === rede.plataforma}
                      onClick={() => desconectarPfm(rede.plataforma)}
                    >
                      <X className="h-3.5 w-3.5" /> Desconectar
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pfmBusy === rede.plataforma}
                        onClick={() => conectarPfm(rede.plataforma)}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Conectar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pfmBusy === rede.plataforma}
                        onClick={() => confirmarPfm(rede.plataforma)}
                      >
                        Já autorizei
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {pfmAviso && <p className="text-[11px] text-muted-foreground">{pfmAviso}</p>}
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
