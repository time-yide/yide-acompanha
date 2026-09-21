"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveStyleGuideAction, type DesignStyleGuide } from "@/lib/clientes/marca-actions";

interface Props {
  clientId: string;
  initial: DesignStyleGuide;
}

export function MarcaForm({ clientId, initial }: Props) {
  const [guide, setGuide] = useState<DesignStyleGuide>(initial);
  const [pending, startTransition] = useTransition();

  function set(key: keyof DesignStyleGuide, value: string) {
    setGuide((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveStyleGuideAction(clientId, guide);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marca salva");
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cores_primarias">Cores primárias</Label>
          <Input
            id="cores_primarias"
            value={guide.cores_primarias ?? ""}
            onChange={(e) => set("cores_primarias", e.target.value)}
            placeholder="Ex: #FF6B35, #1A1A2E, azul marinho"
          />
          <p className="text-xs text-muted-foreground">Hex ou nomes. Separe por vírgula.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cores_secundarias">Cores secundárias</Label>
          <Input
            id="cores_secundarias"
            value={guide.cores_secundarias ?? ""}
            onChange={(e) => set("cores_secundarias", e.target.value)}
            placeholder="Ex: #F5F5F5, bege claro"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fontes">Fontes</Label>
        <Input
          id="fontes"
          value={guide.fontes ?? ""}
          onChange={(e) => set("fontes", e.target.value)}
          placeholder="Ex: Montserrat (títulos), Open Sans (corpo)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="logo_url">Link do logo</Label>
        <Input
          id="logo_url"
          value={guide.logo_url ?? ""}
          onChange={(e) => set("logo_url", e.target.value)}
          placeholder="URL do logo (Drive, Storage, etc.)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="referencias_instagram">Referências de Instagram</Label>
        <Input
          id="referencias_instagram"
          value={guide.referencias_instagram ?? ""}
          onChange={(e) => set("referencias_instagram", e.target.value)}
          placeholder="Ex: @conta1, @conta2 (perfis de referência visual)"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tom_voz">Tom de voz</Label>
          <Input
            id="tom_voz"
            value={guide.tom_voz ?? ""}
            onChange={(e) => set("tom_voz", e.target.value)}
            placeholder="Ex: profissional, descontraído, técnico"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mood">Mood / Estilo visual</Label>
          <Input
            id="mood"
            value={guide.mood ?? ""}
            onChange={(e) => set("mood", e.target.value)}
            placeholder="Ex: minimalista, vibrante, clean"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="evitar">O que evitar</Label>
        <Input
          id="evitar"
          value={guide.evitar ?? ""}
          onChange={(e) => set("evitar", e.target.value)}
          placeholder="Ex: cores neon, fontes cursivas, fotos genéricas"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações gerais</Label>
        <Textarea
          id="observacoes"
          value={guide.observacoes ?? ""}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
          placeholder="Qualquer detalhe extra sobre a identidade visual do cliente..."
        />
      </div>

      <Button onClick={handleSave} disabled={pending}>
        {pending ? "Salvando..." : "Salvar marca"}
      </Button>
    </div>
  );
}
