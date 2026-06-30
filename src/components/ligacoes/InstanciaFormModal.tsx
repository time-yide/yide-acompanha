"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, Save, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInstanciaAction, updateInstanciaAction, type InstanciaRow } from "@/lib/ligacoes/instancia-actions";
import { env } from "@/lib/env";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instancia?: InstanciaRow | null;
  colaboradores: Array<{ id: string; nome: string }>;
}

export function InstanciaFormModal({ open, onOpenChange, instancia, colaboradores }: Props) {
  const isEdit = !!instancia;
  const router = useRouter();
  const [nome, setNome] = useState(instancia?.nome ?? "");
  const [tipo, setTipo] = useState<string>(instancia?.tipo ?? "whatsapp");
  const [numero, setNumero] = useState(instancia?.numero ?? "");
  const [ramal, setRamal] = useState(instancia?.ramal ?? "");
  const [colaboradorId, setColaboradorId] = useState(instancia?.colaborador_id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [provedor, setProvedor] = useState<string>(
    instancia?.provedor ?? (tipo === "whatsapp" ? "evolution" : "manual"),
  );
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    if (isEdit && instancia) fd.set("id", instancia.id);
    fd.set("nome", nome);
    fd.set("tipo", tipo);
    fd.set("provedor", provedor);
    fd.set("numero", numero);
    fd.set("ramal", ramal);
    if (colaboradorId) fd.set("colaborador_id", colaboradorId);
    fd.set("credenciais", JSON.stringify({}));

    startTransition(async () => {
      const r = isEdit ? await updateInstanciaAction(fd) : await createInstanciaAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar número" : "Cadastrar número"}</DialogTitle>
            <DialogDescription>
              Cada número é uma instância. Você pode ter quantos quiser, cada um
              atribuído a um colaborador diferente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome amigável *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ramal Yasmin, WPP Comercial 2"
              required
              minLength={2}
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => {
                const novo = v ?? "whatsapp";
                setTipo(novo);
                setProvedor(novo === "whatsapp" ? "evolution" : "manual");
              }}>
                <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3 text-emerald-500" /> WhatsApp
                    </span>
                  </SelectItem>
                  <SelectItem value="telefone">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-blue-500" /> Telefone
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="colaborador">Colaborador</Label>
              <Select value={colaboradorId || "_none"} onValueChange={(v) => setColaboradorId(v === "_none" ? "" : (v ?? ""))}>
                <SelectTrigger id="colaborador"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem responsável</SelectItem>
                  {colaboradores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="+5511999999999"
                maxLength={40}
              />
            </div>

            {tipo === "telefone" && (
              <div className="space-y-1.5">
                <Label htmlFor="ramal">Ramal (opcional)</Label>
                <Input
                  id="ramal"
                  value={ramal}
                  onChange={(e) => setRamal(e.target.value)}
                  placeholder="1001"
                  maxLength={40}
                />
              </div>
            )}
          </div>

          {tipo === "telefone" && (
            <div className="space-y-1.5">
              <Label htmlFor="provedor">Como vai ligar</Label>
              <Select value={provedor} onValueChange={(v) => setProvedor(v ?? "manual")}>
                <SelectTrigger id="provedor"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Registro manual (sem integração)</SelectItem>
                  <SelectItem value="totalvoice">Zenvia (ligar pelo sistema)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conexão - só pra WhatsApp, mostra placeholder de QR code */}
          {tipo === "whatsapp" && (
            <div className="rounded-md border bg-muted/20 p-4 text-center space-y-2">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium">Conectar via QR Code</p>
              <p className="text-[11px] text-muted-foreground">
                Cadastra o número primeiro. Depois aparece o QR Code aqui pra você
                escanear com o celular do colaborador (ainda em construção, disponível
                quando o servidor de WhatsApp estiver no ar).
              </p>
            </div>
          )}

          {tipo === "telefone" && provedor === "totalvoice" && isEdit && instancia?.webhook_secret && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
              <p className="text-sm font-medium">URL do webhook (cole no painel da Zenvia)</p>
              <code className="block break-all rounded bg-background px-2 py-1 text-[11px]">
                {`${appUrl}/api/webhooks/ligacoes/zenvia?secret=${instancia.webhook_secret}`}
              </code>
              <p className="text-[11px] text-muted-foreground">
                Zenvia → Desenvolvedores → Webhooks. Informe tambem o ramal acima. O token
                da conta vai na variavel ZENVIA_VOICE_TOKEN (configurada pela equipe).
              </p>
            </div>
          )}

          {tipo === "telefone" && provedor === "twilio" && isEdit && instancia?.webhook_secret && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
              <p className="text-sm font-medium">Webhook de status/gravação (cole no TwiML App da Twilio)</p>
              <code className="block break-all text-[11px]">
                {`${appUrl}/api/webhooks/ligacoes/twilio?secret=${instancia.webhook_secret}`}
              </code>
              <p className="text-[11px] text-muted-foreground">
                A Voice URL do TwiML App é <code>{`${appUrl}/api/ligacoes/twilio/voice`}</code>. No
                campo <strong>Número</strong> acima, informe o caller ID verificado na Twilio (o
                número que aparece pro lead). As chaves da conta ficam nas envs do Vercel.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !nome.trim()}>
              <Save className="h-4 w-4" /> {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
