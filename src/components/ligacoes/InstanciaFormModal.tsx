"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, AlertCircle, Save } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createInstanciaAction, updateInstanciaAction, type InstanciaRow } from "@/lib/ligacoes/instancia-actions";
import { PROVEDOR_DEFS, PROVEDOR_BY_VALUE } from "@/lib/ligacoes/instancias";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pra edit. */
  instancia?: InstanciaRow | null;
  colaboradores: Array<{ id: string; nome: string }>;
}

export function InstanciaFormModal({ open, onOpenChange, instancia, colaboradores }: Props) {
  const isEdit = !!instancia;
  const router = useRouter();
  const [nome, setNome] = useState(instancia?.nome ?? "");
  const [tipo, setTipo] = useState<string>(instancia?.tipo ?? "telefone");
  const [provedor, setProvedor] = useState<string>(instancia?.provedor ?? "manual");
  const [numero, setNumero] = useState(instancia?.numero ?? "");
  const [ramal, setRamal] = useState(instancia?.ramal ?? "");
  const [colaboradorId, setColaboradorId] = useState(instancia?.colaborador_id ?? "");
  const [credenciais, setCredenciais] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(instancia?.credenciais ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const provedorDef = PROVEDOR_BY_VALUE[provedor];
  const provedoresFiltrados = PROVEDOR_DEFS.filter((p) => p.tipo === "ambos" || p.tipo === tipo);

  function setCred(key: string, value: string) {
    setCredenciais((prev) => ({ ...prev, [key]: value }));
  }

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
    fd.set("credenciais", JSON.stringify(credenciais));

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar número" : "Cadastrar número"}</DialogTitle>
            <DialogDescription>
              Cada número/ramal é uma &quot;instância&quot;. Você pode ter quantos quiser, cada
              um atribuído a um colaborador diferente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
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
              <p className="text-[10px] text-muted-foreground">Aparece nos filtros e relatórios.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? "telefone")}>
                <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telefone">
                    <Phone className="h-3 w-3 inline mr-1" /> Telefone
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <MessageCircle className="h-3 w-3 inline mr-1" /> WhatsApp
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="colaborador">Colaborador responsável</Label>
              <Select value={colaboradorId || "_none"} onValueChange={(v) => setColaboradorId(v === "_none" ? "" : (v ?? ""))}>
                <SelectTrigger id="colaborador"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Sem responsável —</SelectItem>
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

          {/* Provedor */}
          <div className="space-y-1.5 border-t pt-4">
            <Label htmlFor="provedor">Provedor</Label>
            <Select value={provedor} onValueChange={(v) => setProvedor(v ?? "manual")}>
              <SelectTrigger id="provedor"><SelectValue /></SelectTrigger>
              <SelectContent>
                {provedoresFiltrados.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      {p.label}
                      {p.status === "em_construcao" && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                          em construção
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {provedorDef && provedorDef.status === "em_construcao" && provedor !== "manual" && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p><strong className="text-foreground">Integração ainda não implementada.</strong></p>
                  <p className="mt-1 text-muted-foreground">
                    Você pode cadastrar agora as credenciais, mas a captura automática de ligações
                    só vai funcionar depois que a gente implementar o handler do webhook desse provedor.
                    Por enquanto, as ligações desse número precisam ser registradas manualmente.
                  </p>
                </div>
              </div>
            )}

            {provedorDef && provedor === "manual" && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px]">
                <p><strong className="text-foreground">✓ Modo manual.</strong></p>
                <p className="mt-1 text-muted-foreground">
                  Você cadastra as ligações desse número manualmente. Sem integração automática.
                </p>
              </div>
            )}

            {/* Campos de credencial do provedor */}
            {provedorDef && provedorDef.campos.length > 0 && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Credenciais do {provedorDef.label}
                </h4>
                {provedorDef.campos.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label htmlFor={c.key}>
                      {c.label}
                      {c.obrigatorio && <span className="text-destructive"> *</span>}
                    </Label>
                    <Input
                      id={c.key}
                      type={c.type === "password" ? "password" : c.type}
                      value={credenciais[c.key] ?? ""}
                      onChange={(e) => setCred(c.key, e.target.value)}
                      placeholder={c.placeholder}
                      required={c.obrigatorio}
                    />
                    {c.helper && (
                      <p className="text-[10px] text-muted-foreground">{c.helper}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Webhook URL info */}
            {isEdit && instancia?.webhook_secret && provedor !== "manual" && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                <p className="text-[11px] font-semibold">Webhook URL pra colar no provedor:</p>
                <code className="block break-all rounded bg-background p-2 text-[10px]">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  /api/webhooks/ligacoes/{provedor}/{instancia.webhook_secret}
                </code>
                {provedorDef?.webhookHint && (
                  <p className="text-[10px] text-muted-foreground italic">
                    💡 {provedorDef.webhookHint}
                  </p>
                )}
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px]">
                  Endpoint ainda não implementado — gravado pra futuro
                </Badge>
              </div>
            )}
          </div>

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
