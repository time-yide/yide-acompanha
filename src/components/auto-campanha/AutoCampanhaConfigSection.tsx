"use client";

import { useActionState } from "react";
import { saveAutoCampanhaConfigAction } from "@/lib/auto-campanha/config-actions";
import { PhoneCall } from "lucide-react";

interface AutoCampanhaConfig {
  id: string;
  auto_campanha_ativo: boolean;
  auto_campanha_meta_atendidas: number;
  auto_campanha_max_tentativas: number;
  auto_campanha_horario_inicio: string;
  auto_campanha_horario_fim: string;
  power_dialer_colaborador_id: string | null;
}

interface Props {
  config: AutoCampanhaConfig | null;
  colaboradores: Array<{ id: string; nome: string }>;
}

export function AutoCampanhaConfigSection({ config, colaboradores }: Props) {
  const [state, action, pending] = useActionState(saveAutoCampanhaConfigAction, {});

  if (!config) return null;

  return (
    <div className="border-t pt-6 space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PhoneCall className="h-5 w-5" /> Campanha Automatica de Discagem
        </h2>
        <p className="text-sm text-muted-foreground">
          Liga automaticamente para leads a partir do horario configurado. O colaborador
          selecionado ja entra na ligacao quando o lead atende.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="auto_campanha_ativo"
            value="true"
            defaultChecked={config.auto_campanha_ativo}
            className="rounded"
          />
          Campanha automatica ativa
        </label>

        <div className="space-y-2">
          <label htmlFor="ac_colaborador" className="text-sm font-medium">
            Colaborador (quem atende as ligacoes)
          </label>
          <select
            id="ac_colaborador"
            name="power_dialer_colaborador_id"
            defaultValue={config.power_dialer_colaborador_id ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ac_meta" className="text-sm font-medium">
              Meta de atendidas por dia
            </label>
            <input
              id="ac_meta"
              name="auto_campanha_meta_atendidas"
              type="number"
              min={1}
              max={50}
              defaultValue={config.auto_campanha_meta_atendidas ?? 10}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ac_max" className="text-sm font-medium">
              Max tentativas por dia
            </label>
            <input
              id="ac_max"
              name="auto_campanha_max_tentativas"
              type="number"
              min={1}
              max={200}
              defaultValue={config.auto_campanha_max_tentativas ?? 50}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ac_inicio" className="text-sm font-medium">
              Horario de inicio
            </label>
            <input
              id="ac_inicio"
              name="auto_campanha_horario_inicio"
              type="time"
              defaultValue={config.auto_campanha_horario_inicio ?? "08:00"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ac_fim" className="text-sm font-medium">
              Horario de fim
            </label>
            <input
              id="ac_fim"
              name="auto_campanha_horario_fim"
              type="time"
              defaultValue={config.auto_campanha_horario_fim ?? "18:00"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-600">Salvo!</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
