"use client";

import { useState, useTransition } from "react";
import { Save, X, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLeadAction } from "@/lib/gerador-leads/actions";
import type { LeadGeradoRow } from "@/lib/gerador-leads/queries";

interface Props {
  lead: LeadGeradoRow;
  canEdit: boolean;
}

export function LeadEditCard({ lead, canEdit }: Props) {
  const [empresa, setEmpresa] = useState(lead.empresa);
  const [telefone, setTelefone] = useState(lead.telefone ?? "");
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [website, setWebsite] = useState(lead.website ?? "");
  const [instagram, setInstagram] = useState(lead.instagram ?? "");
  const [observacoes, setObservacoes] = useState(lead.observacoes ?? "");
  const [tags, setTags] = useState<string[]>(lead.tags);
  const [tagInput, setTagInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.includes(v) || tags.length >= 20) {
      setTagInput("");
      return;
    }
    setTags([...tags, v]);
    setTagInput("");
  }
  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("id", lead.id);
    fd.set("empresa", empresa);
    fd.set("telefone", telefone);
    fd.set("whatsapp", whatsapp);
    fd.set("email", email);
    fd.set("website", website);
    fd.set("instagram", instagram);
    fd.set("observacoes", observacoes);
    fd.set("tags", JSON.stringify(tags));
    startTransition(async () => {
      const r = await updateLeadAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSavedAt(new Date());
    });
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold">Dados editáveis</h2>
        <p className="text-[11px] text-muted-foreground">
          Você pode corrigir/atualizar qualquer campo. Mudanças aqui não são
          sobrescritas se rodar a pesquisa de novo.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="empresa">Empresa</Label>
        <Input
          id="empresa"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          disabled={!canEdit}
          maxLength={200}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            disabled={!canEdit}
            placeholder="+5511999999999"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            disabled={!canEdit}
            placeholder="+5511999999999"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canEdit}
            placeholder="contato@empresa.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram (@)</Label>
          <Input
            id="instagram"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            disabled={!canEdit}
            placeholder="empresa_oficial"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          disabled={!canEdit}
          placeholder="https://empresa.com.br"
        />
      </div>

      <div className="space-y-1.5 border-t pt-4">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px]"
            >
              {t}
              {canEdit && (
                <button type="button" onClick={() => removeTag(t)}>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-1.5">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addTag(); }
              }}
              placeholder="Adicionar tag (ex: hot lead)"
              maxLength={40}
            />
            <Button type="button" size="sm" variant="outline" onClick={addTag}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Observações internas</Label>
        <Textarea
          id="observacoes"
          rows={4}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          disabled={!canEdit}
          maxLength={4000}
          placeholder="Notas pra equipe comercial..."
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canEdit && (
        <div className="flex items-center gap-2 border-t pt-4">
          <Button type="button" onClick={onSave} disabled={pending}>
            <Save className="h-4 w-4" /> {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
          {savedAt && !pending && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              ✓ Salvo {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
