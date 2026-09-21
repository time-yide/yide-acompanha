"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { saveStyleGuideAction, type DesignStyleGuide } from "@/lib/clientes/marca-actions";

interface Props {
  clientId: string;
  initial: DesignStyleGuide;
}

const fields: { key: keyof DesignStyleGuide; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: "cores_primarias", label: "Cores primárias", placeholder: "#1a73e8, #ff6b35" },
  { key: "cores_secundarias", label: "Cores secundárias", placeholder: "#f5f5f5, #333333" },
  { key: "fontes", label: "Fontes", placeholder: "Montserrat, Playfair Display" },
  { key: "logo_url", label: "URL do logo", placeholder: "https://..." },
  { key: "referencias_instagram", label: "Instagram de referência", placeholder: "@perfil" },
  { key: "tom_voz", label: "Tom de voz", placeholder: "profissional, acolhedor" },
  { key: "mood", label: "Mood / estilo visual", placeholder: "moderno, clean, minimalista" },
  { key: "evitar", label: "Evitar", placeholder: "cores neon, fontes decorativas" },
  { key: "observacoes", label: "Observações", placeholder: "Notas sobre a identidade visual...", multiline: true },
];

export function MarcaForm({ clientId, initial }: Props) {
  const [guide, setGuide] = useState<DesignStyleGuide>(initial);
  const [pending, startTransition] = useTransition();

  function onChange(key: keyof DesignStyleGuide, value: string) {
    setGuide((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveStyleGuideAction(clientId, guide);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Identidade visual salva");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.multiline ? "md:col-span-2" : ""}>
            <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
            {f.multiline ? (
              <Textarea
                id={f.key}
                value={guide[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className="mt-1"
              />
            ) : (
              <Input
                id={f.key}
                value={guide[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1"
              />
            )}
          </div>
        ))}
      </div>

      {guide.cores_primarias && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          {guide.cores_primarias.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
            <div
              key={c}
              className="h-6 w-6 rounded-full border"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          {guide.cores_secundarias?.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
            <div
              key={c}
              className="h-5 w-5 rounded-full border opacity-70"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      )}

      <Button onClick={handleSave} disabled={pending} size="sm">
        {pending ? "Salvando..." : "Salvar identidade visual"}
      </Button>
    </div>
  );
}
