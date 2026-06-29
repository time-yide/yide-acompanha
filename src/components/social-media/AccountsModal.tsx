"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, Check, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listarContasClienteAction, iniciarConexaoAction, capturarConexaoAction, desconectarPfmAction,
} from "@/lib/social-media/postforme-actions";
import {
  googleConectadoAction, iniciarConexaoGoogleAction, capturarConexaoGoogleAction, desconectarGoogleAction,
} from "@/lib/social-media/outstand-actions";

type Provider = "pfm" | "google";

interface RedeDef {
  key: string;
  nome: string;
  sigla: string;
  cor: string;
  provider: Provider;
  sub?: string;
}

const REDES: RedeDef[] = [
  { key: "instagram", nome: "Instagram", sigla: "IG", cor: "#E1306C", provider: "pfm" },
  { key: "facebook", nome: "Facebook", sigla: "f", cor: "#1877F2", provider: "pfm" },
  { key: "tiktok", nome: "TikTok", sigla: "TT", cor: "#111111", provider: "pfm" },
  { key: "youtube", nome: "YouTube", sigla: "YT", cor: "#FF0000", provider: "pfm" },
  { key: "linkedin", nome: "LinkedIn", sigla: "in", cor: "#0A66C2", provider: "pfm" },
  { key: "google", nome: "Google Meu Negócio", sigla: "G", cor: "#4285F4", provider: "google", sub: "via Outstand" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientNome: string;
  /** Mantido por compatibilidade — os IDs manuais saíram da UI. */
  initial?: unknown;
}

export function AccountsModal({ open, onOpenChange, clientId, clientNome }: Props) {
  const [pfmContas, setPfmContas] = useState<Record<string, string | null>>({});
  const [google, setGoogle] = useState<{ conectado: boolean; username: string | null }>({
    conectado: false,
    username: null,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const carregarPfm = useCallback(async () => {
    const r = await listarContasClienteAction(clientId);
    if ("contas" in r) {
      const map: Record<string, string | null> = {};
      for (const c of r.contas) map[c.plataforma] = c.username ?? null;
      setPfmContas(map);
    }
  }, [clientId]);

  const carregarGoogle = useCallback(async () => {
    const g = await googleConectadoAction(clientId);
    if (!("error" in g)) setGoogle({ conectado: g.conectado, username: g.username });
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
    void (async () => {
      const g = await googleConectadoAction(clientId);
      if (active && !("error" in g)) setGoogle({ conectado: g.conectado, username: g.username });
    })();
    return () => {
      active = false;
    };
  }, [open, clientId]);

  function conectado(rede: RedeDef): boolean {
    return rede.provider === "google" ? google.conectado : rede.key in pfmContas;
  }
  function username(rede: RedeDef): string | null {
    return rede.provider === "google" ? google.username : pfmContas[rede.key] ?? null;
  }

  async function conectar(rede: RedeDef) {
    setAviso(null);
    setBusy(rede.key);
    const r =
      rede.provider === "google"
        ? await iniciarConexaoGoogleAction(clientId)
        : await iniciarConexaoAction(clientId, rede.key);
    setBusy(null);
    if ("error" in r) {
      setAviso(r.error);
      return;
    }
    window.open(r.url, "_blank", "noopener");
    setAguardando((a) => ({ ...a, [rede.key]: true }));
  }

  async function confirmar(rede: RedeDef) {
    setAviso(null);
    setBusy(rede.key);
    const r =
      rede.provider === "google"
        ? await capturarConexaoGoogleAction(clientId)
        : await capturarConexaoAction(clientId, rede.key);
    setBusy(null);
    if ("error" in r) {
      setAviso(r.error);
      return;
    }
    setAguardando((a) => ({ ...a, [rede.key]: false }));
    if (rede.provider === "google") await carregarGoogle();
    else await carregarPfm();
  }

  async function desconectar(rede: RedeDef) {
    setBusy(rede.key);
    if (rede.provider === "google") await desconectarGoogleAction(clientId);
    else await desconectarPfmAction(clientId, rede.key);
    setBusy(null);
    if (rede.provider === "google") await carregarGoogle();
    else await carregarPfm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar redes · {clientNome}</DialogTitle>
          <DialogDescription>
            Conecte as contas do cliente. É só autorizar na aba que abrir — sem copiar ID.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {REDES.map((rede) => {
            const ok = conectado(rede);
            const user = username(rede);
            const esperando = aguardando[rede.key];
            const carregando = busy === rede.key;
            return (
              <div
                key={rede.key}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ background: rede.cor }}
                  >
                    {rede.sigla}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{rede.nome}</div>
                    {ok && user ? (
                      <div className="truncate text-xs text-green-600 dark:text-green-400">@{user}</div>
                    ) : rede.sub ? (
                      <div className="truncate text-[11px] text-muted-foreground">{rede.sub}</div>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0">
                  {ok ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-300">
                        <Check className="h-3 w-3" /> Conectado
                      </span>
                      <button
                        type="button"
                        onClick={() => desconectar(rede)}
                        disabled={carregando}
                        title="Desconectar"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                      >
                        {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : esperando ? (
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => confirmar(rede)} disabled={carregando}>
                        {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Já autorizei"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => conectar(rede)}
                        disabled={carregando}
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      >
                        abrir de novo
                      </button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => conectar(rede)} disabled={carregando}>
                      {carregando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Link2 className="h-3.5 w-3.5" /> Conectar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
