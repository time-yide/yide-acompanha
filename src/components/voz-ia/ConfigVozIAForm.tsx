"use client";

import { useActionState, useState } from "react";
import { saveVoiceConfigAction } from "@/lib/voz-ia/config-actions";
import { VOZES_OPENAI } from "@/lib/voz-ia/types";
import type { AIVoiceConfig } from "@/lib/voz-ia/types";
import { VoicePreviewButton } from "./VoicePreviewButton";

interface Props {
  config: AIVoiceConfig | null;
}

export function ConfigVozIAForm({ config }: Props) {
  const [state, action, pending] = useActionState(saveVoiceConfigAction, { success: true });
  const [selectedVoice, setSelectedVoice] = useState(config?.voz ?? "alloy");

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
          <div className="flex items-center gap-2">
            <select
              id="voz"
              name="voz"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {VOZES_OPENAI.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            <VoicePreviewButton voice={selectedVoice} />
          </div>
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

      {/* ─── Motor de Prospecção ─── */}
      <div className="border-t pt-6 space-y-4">
        <h2 className="text-lg font-semibold">Motor de Prospecção</h2>
        <p className="text-sm text-muted-foreground">
          Dispara WhatsApp personalizado para leads automaticamente em horário comercial.
        </p>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="motor_ativo"
            value="true"
            defaultChecked={config?.motor_ativo ?? false}
            className="rounded"
          />
          Motor ativo (liga o disparo automático)
        </label>

        <div className="space-y-2">
          <label htmlFor="twilio_wpp_from" className="text-sm font-medium">
            Número Twilio WhatsApp (ex: +5565999999999)
          </label>
          <input
            id="twilio_wpp_from"
            name="twilio_wpp_from"
            type="text"
            defaultValue={config?.twilio_wpp_from ?? ""}
            placeholder="+5565..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="horario_inicio" className="text-sm font-medium">
              Início (seg-sex)
            </label>
            <input
              id="horario_inicio"
              name="horario_inicio"
              type="time"
              defaultValue={config?.horario_inicio ?? "08:00"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="horario_fim" className="text-sm font-medium">
              Fim (seg-sex)
            </label>
            <input
              id="horario_fim"
              name="horario_fim"
              type="time"
              defaultValue={config?.horario_fim ?? "18:00"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="horario_inicio_fds" className="text-sm font-medium">
              Início (sáb-dom)
            </label>
            <input
              id="horario_inicio_fds"
              name="horario_inicio_fds"
              type="time"
              defaultValue={config?.horario_inicio_fds ?? "09:00"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="horario_fim_fds" className="text-sm font-medium">
              Fim (sáb-dom)
            </label>
            <input
              id="horario_fim_fds"
              name="horario_fim_fds"
              type="time"
              defaultValue={config?.horario_fim_fds ?? "17:00"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="max_wpp_dia" className="text-sm font-medium">
              Máx. WhatsApps/dia
            </label>
            <input
              id="max_wpp_dia"
              name="max_wpp_dia"
              type="number"
              min={1}
              max={200}
              defaultValue={config?.max_wpp_dia ?? 50}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="max_chamadas_dia" className="text-sm font-medium">
              Máx. chamadas IA/dia
            </label>
            <input
              id="max_chamadas_dia"
              name="max_chamadas_dia"
              type="number"
              min={1}
              max={100}
              defaultValue={config?.max_chamadas_dia ?? 30}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="wpp_primeiro_contato_prompt" className="text-sm font-medium">
            Prompt do primeiro contato WPP (opcional — tem um padrão bom)
          </label>
          <textarea
            id="wpp_primeiro_contato_prompt"
            name="wpp_primeiro_contato_prompt"
            rows={8}
            defaultValue={config?.wpp_primeiro_contato_prompt ?? ""}
            placeholder="Deixe vazio para usar o prompt padrão que adapta a mensagem por nicho automaticamente."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
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
