"use client";

import { useEffect, useState } from "react";

interface Step {
  canal: "whatsapp" | "ligacao";
  dias_apos_anterior: number;
  template_tipo: string;
  ativo: boolean;
}

interface Props {
  configId: string | null;
}

const DEFAULT_STEPS: Step[] = [
  { canal: "whatsapp", dias_apos_anterior: 0, template_tipo: "primeiro_contato", ativo: true },
  { canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { canal: "ligacao", dias_apos_anterior: 2, template_tipo: "auto", ativo: true },
  { canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { canal: "ligacao", dias_apos_anterior: 3, template_tipo: "auto", ativo: true },
  { canal: "whatsapp", dias_apos_anterior: 3, template_tipo: "ultimo", ativo: true },
];

export function CadenciaConfig({ configId }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!configId) return;
    fetch(`/api/voz-ia/cadencia?configId=${configId}`)
      .then((r) => r.json())
      .then((data) => {
        setSteps(data.length > 0 ? data : DEFAULT_STEPS);
        setLoaded(true);
      })
      .catch(() => {
        setSteps(DEFAULT_STEPS);
        setLoaded(true);
      });
  }, [configId]);

  async function handleSave() {
    if (!configId) return;
    setSaving(true);
    await fetch("/api/voz-ia/cadencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, steps }),
    });
    setSaving(false);
  }

  function addStep() {
    setSteps([...steps, { canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true }]);
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateStep(idx: number, field: string, value: any) {
    const updated = [...steps];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[idx] as any)[field] = value;
    setSteps(updated);
  }

  function restoreDefault() {
    setSteps([...DEFAULT_STEPS]);
  }

  if (!configId || !loaded) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Steps da cadência</h3>
        <button
          type="button"
          onClick={restoreDefault}
          className="text-xs text-muted-foreground hover:underline"
        >
          Restaurar padrão
        </button>
      </div>

      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 rounded border p-2">
          <span className="text-xs font-medium text-muted-foreground w-6">{i + 1}.</span>
          <select
            value={step.canal}
            onChange={(e) => updateStep(i, "canal", e.target.value)}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="ligacao">Ligação</option>
          </select>
          <label className="flex items-center gap-1 text-xs">
            após
            <input
              type="number"
              min={0}
              max={30}
              value={step.dias_apos_anterior}
              onChange={(e) => updateStep(i, "dias_apos_anterior", parseInt(e.target.value) || 0)}
              className="w-12 rounded border bg-background px-1 py-1 text-xs"
            />
            dias
          </label>
          <select
            value={step.template_tipo}
            onChange={(e) => updateStep(i, "template_tipo", e.target.value)}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="primeiro_contato">1º contato</option>
            <option value="followup">Follow-up</option>
            <option value="ultimo">Último</option>
            <option value="auto">Auto</option>
          </select>
          <button
            type="button"
            onClick={() => removeStep(i)}
            className="ml-auto text-xs text-red-500 hover:underline"
          >
            Remover
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addStep}
          className="rounded border px-3 py-1 text-xs hover:bg-muted"
        >
          + Adicionar step
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar cadência"}
        </button>
      </div>
    </div>
  );
}
