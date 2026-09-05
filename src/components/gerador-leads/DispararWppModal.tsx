"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Send, Plus, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listTemplatesAction,
  createTemplateAction,
  enqueueLeadsAction,
} from "@/lib/dispatch/actions";
import type { WppTemplate } from "@/lib/dispatch/types";
import { renderTemplate } from "@/lib/dispatch/render-template";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  leadsCount: number;
  baseFiltro: string | null;
  sampleLead: { empresa: string; decisor_nome?: string | null; categoria?: string | null; cidade?: string | null } | null;
}

const PLACEHOLDERS = ["{empresa}", "{nome}", "{categoria}", "{cidade}"];

export function DispararWppModal({
  open,
  onOpenChange,
  leadIds,
  leadsCount,
  baseFiltro,
  sampleLead,
}: Props) {
  const [templates, setTemplates] = useState<WppTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [twilioFrom, setTwilioFrom] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCorpo, setNewCorpo] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const list = await listTemplatesAction(baseFiltro);
    setTemplates(list);
    if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    setLoading(false);
  }, [baseFiltro, selectedId]);

  useEffect(() => {
    if (open) loadTemplates();
  }, [open, loadTemplates]);

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  const preview = selectedTemplate && sampleLead
    ? renderTemplate(selectedTemplate.corpo, sampleLead)
    : null;

  async function handleCreateTemplate() {
    if (!newNome.trim() || !newCorpo.trim()) return;
    setSavingTemplate(true);
    const res = await createTemplateAction(newNome, newCorpo, baseFiltro);
    setSavingTemplate(false);
    if ("error" in res) {
      alert(res.error);
      return;
    }
    setShowNew(false);
    setNewNome("");
    setNewCorpo("");
    setSelectedId(res.id);
    await loadTemplates();
  }

  async function handleDispatch() {
    if (!selectedId || !twilioFrom.trim()) return;
    setSending(true);
    const res = await enqueueLeadsAction(leadIds, selectedId, twilioFrom);
    setSending(false);
    if ("error" in res) {
      setResult(`Erro: ${res.error}`);
    } else {
      setResult(`${res.enqueued} leads adicionados à fila de disparo!`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            Disparar WhatsApp
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <p className="text-sm">{result}</p>
            <p className="text-xs text-muted-foreground">
              O cron processa a fila automaticamente (até 50 envios/dia).
            </p>
            <Button size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {leadsCount} lead{leadsCount !== 1 ? "s" : ""} com WhatsApp serão adicionados à fila.
              {baseFiltro && (
                <span className="ml-1 font-medium">
                  Base: {baseFiltro}
                </span>
              )}
            </p>

            {/* Template selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Template da mensagem</label>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                </div>
              ) : templates.length === 0 && !showNew ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Nenhum template encontrado. Crie um primeiro.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
                    <Plus className="h-3 w-3" /> Criar template
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedId ?? ""}
                    onChange={(e) => setSelectedId(e.target.value || null)}
                    className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setShowNew(!showNew)}
                  >
                    <Plus className="h-3 w-3" /> Novo template
                  </Button>
                </div>
              )}
            </div>

            {/* New template form */}
            {showNew && (
              <div className="space-y-2 rounded-md border p-3">
                <input
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Nome do template"
                  className="h-8 w-full rounded border bg-card px-2 text-sm"
                />
                <textarea
                  value={newCorpo}
                  onChange={(e) => setNewCorpo(e.target.value)}
                  placeholder="Mensagem — use {empresa}, {nome}, {categoria}, {cidade}"
                  className="min-h-[80px] w-full rounded border bg-card px-2 py-1.5 text-sm"
                  rows={3}
                />
                <div className="flex flex-wrap gap-1">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewCorpo((c) => c + p)}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateTemplate}
                    disabled={savingTemplate || !newNome.trim() || !newCorpo.trim()}
                  >
                    {savingTemplate && <Loader2 className="h-3 w-3 animate-spin" />}
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Pré-visualização (com dados do 1° lead)
                </label>
                <div className="rounded-md bg-emerald-500/10 p-3 text-sm whitespace-pre-wrap">
                  {preview}
                </div>
              </div>
            )}

            {/* Twilio From */}
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Número Twilio WhatsApp (de)
              </label>
              <input
                value={twilioFrom}
                onChange={(e) => setTwilioFrom(e.target.value)}
                placeholder="+5511999999999"
                className="h-9 w-full rounded-md border bg-card px-2 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Número habilitado pro WhatsApp no Twilio (sandbox ou produção).
              </p>
            </div>

            {/* Dispatch button */}
            <Button
              onClick={handleDispatch}
              disabled={sending || !selectedId || !twilioFrom.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Disparar para {leadsCount} lead{leadsCount !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
