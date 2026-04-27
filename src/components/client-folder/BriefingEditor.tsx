"use client";

import { useState } from "react";
import { saveBriefingAction } from "@/lib/client-folder/briefing-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function BriefingEditor({ clientId, initial }: { clientId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("texto_markdown", text);
    const result = await saveBriefingAction(fd);
    setSaving(false);
    if ("success" in result) setSavedAt(new Date().toLocaleTimeString("pt-BR"));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        className="font-mono text-sm"
        placeholder="# Objetivos&#10;&#10;# Persona&#10;&#10;# Tom de voz&#10;&#10;# KPIs..."
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{savedAt && `Salvo às ${savedAt}`}</span>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar briefing"}</Button>
      </div>
    </form>
  );
}
