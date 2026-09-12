"use client";

import { useActionState } from "react";
import { saveVoiceConfigAction } from "@/lib/voz-ia/config-actions";
import { VOZES_OPENAI } from "@/lib/voz-ia/types";
import type { AIVoiceConfig } from "@/lib/voz-ia/types";

interface Props {
  config: AIVoiceConfig | null;
}

export function ConfigVozIAForm({ config }: Props) {
  const [state, action, pending] = useActionState(saveVoiceConfigAction, { success: true });

  return (
    <form action={action} className="space-y-6">
      {config?.id && <input type="hidden" name="id" value={config.id} />}

      <div className="space-y-2">
        <label htmlFor="system_prompt" className="text-sm font-medium">
          Prompt do agente (instruções da IA)
        </label>
        <textarea
          id="system_prompt"
          name="system_prompt"
          rows={12}
          defaultValue={config?.system_prompt ?? ""}
          placeholder="Você é Ana, da Yide Digital..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="voz" className="text-sm font-medium">Voz</label>
          <select
            id="voz"
            name="voz"
            defaultValue={config?.voz ?? "alloy"}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {VOZES_OPENAI.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="duracao_max_segundos" className="text-sm font-medium">
            Duração máxima (segundos)
          </label>
          <input
            id="duracao_max_segundos"
            name="duracao_max_segundos"
            type="number"
            min={60}
            max={300}
            defaultValue={config?.duracao_max_segundos ?? 180}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="max_tentativas" className="text-sm font-medium">
            Máx. tentativas por lead
          </label>
          <input
            id="max_tentativas"
            name="max_tentativas"
            type="number"
            min={1}
            max={20}
            defaultValue={config?.max_tentativas ?? 7}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="tentativas_por_semana" className="text-sm font-medium">
            Tentativas por semana
          </label>
          <input
            id="tentativas_por_semana"
            name="tentativas_por_semana"
            type="number"
            min={1}
            max={7}
            defaultValue={config?.tentativas_por_semana ?? 2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="wpp_followup_ativo"
            value="true"
            defaultChecked={config?.wpp_followup_ativo ?? true}
            className="rounded"
          />
          WhatsApp automático quando não atender
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor="wpp_followup_template" className="text-sm font-medium">
          Mensagem do WhatsApp (use {"{empresa}"} como placeholder)
        </label>
        <textarea
          id="wpp_followup_template"
          name="wpp_followup_template"
          rows={3}
          defaultValue={config?.wpp_followup_template ?? ""}
          placeholder="Oi! Tentei ligar pra você agora da Yide Digital. Somos uma agência de marketing e queria conversar sobre como podemos ajudar a {empresa} a crescer nas redes sociais. Posso te explicar por aqui?"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      {"error" in state && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {"success" in state && state.success && config?.id && (
        <p className="text-sm text-green-600">Salvo!</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Salvar configuração"}
      </button>
    </form>
  );
}
