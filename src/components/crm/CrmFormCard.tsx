"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateClienteCrmAction } from "@/lib/crm/actions";
import { CRM_DEFS, CRM_BY_VALUE, buildCrmOpenUrl, type CrmTipo } from "@/lib/crm/tipos";

interface Props {
  clientId: string;
  initial: {
    crm_tipo: string | null;
    crm_url: string | null;
    crm_identifier: string | null;
    crm_observacoes: string | null;
  };
  canEdit: boolean;
}

export function CrmFormCard({ clientId, initial, canEdit }: Props) {
  const [tipo, setTipo] = useState<string>(initial.crm_tipo ?? "nenhum");
  const [url, setUrl] = useState<string>(initial.crm_url ?? "");
  const [identifier, setIdentifier] = useState<string>(initial.crm_identifier ?? "");
  const [observacoes, setObservacoes] = useState<string>(initial.crm_observacoes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const def = CRM_BY_VALUE[tipo];
  const showUrl = tipo !== "nenhum" && tipo !== "planilha" && tipo !== "yide";
  const showIdentifier = tipo === "yide" || tipo === "custom";
  const openUrl = buildCrmOpenUrl(tipo, url, identifier);

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("crm_tipo", tipo);
    if (showUrl && url.trim()) fd.set("crm_url", url.trim());
    if (showIdentifier && identifier.trim()) fd.set("crm_identifier", identifier.trim());
    if (observacoes.trim()) fd.set("crm_observacoes", observacoes.trim());
    startTransition(async () => {
      const r = await updateClienteCrmAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSavedAt(new Date());
    });
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="crm_tipo">Qual CRM o cliente usa?</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v ?? "nenhum")} disabled={!canEdit}>
          <SelectTrigger id="crm_tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CRM_DEFS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.isYide ? "⭐ " : ""}{c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {def?.isYide && (
          <p className="text-[11px] text-muted-foreground">
            CRM próprio da Yide (multi-tenant). Quando o CRM estiver deployado, o
            <code className="mx-1 rounded bg-muted px-1">crm_identifier</code>vai ser usado pra abrir direto a empresa do cliente em modo agência.
          </p>
        )}
      </div>

      {showUrl && (
        <div className="space-y-1.5">
          <Label htmlFor="crm_url">URL do CRM</Label>
          <Input
            id="crm_url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={def?.urlPlaceholder ?? "https://..."}
            disabled={!canEdit}
            maxLength={500}
          />
          <p className="text-[11px] text-muted-foreground">
            Link direto pra abrir o CRM já no perfil/conta do cliente (não a homepage).
          </p>
        </div>
      )}

      {showIdentifier && (
        <div className="space-y-1.5">
          <Label htmlFor="crm_identifier">
            {tipo === "yide" ? "Tenant ID / Slug no CRM Yide" : "Identificador no CRM"}
          </Label>
          <Input
            id="crm_identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={def?.identifierPlaceholder ?? ""}
            disabled={!canEdit}
            maxLength={200}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="crm_observacoes">Observações (opcional)</Label>
        <Textarea
          id="crm_observacoes"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Login, contato comercial do CRM, particularidades, etc."
          disabled={!canEdit}
          maxLength={2000}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        {canEdit && (
          <Button type="button" onClick={onSave} disabled={pending}>
            <Save className="h-4 w-4" /> {pending ? "Salvando..." : "Salvar"}
          </Button>
        )}
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <ExternalLink className="h-4 w-4" /> Abrir CRM
          </a>
        )}
        {savedAt && !pending && (
          <span className="ml-auto text-[11px] text-emerald-600 dark:text-emerald-400">
            ✓ Salvo {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {!openUrl && tipo === "yide" && (
          <span className="ml-auto text-[11px] text-amber-600 dark:text-amber-400">
            ⚠️ CRM Yide ainda não está deployado (env <code>NEXT_PUBLIC_YIDE_CRM_URL</code> não configurada)
          </span>
        )}
      </div>
    </Card>
  );
}

export type { CrmTipo };
