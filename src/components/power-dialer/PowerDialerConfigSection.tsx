"use client";

import { useActionState } from "react";
import { savePowerDialerConfigAction } from "@/lib/power-dialer/config-actions";
import { Phone } from "lucide-react";

interface PowerDialerConfig {
  id: string;
  power_dialer_ativo: boolean;
  power_dialer_batch_size: number;
  power_dialer_timeout_s: number;
  power_dialer_colaborador_id: string | null;
  power_dialer_greeting: string;
  power_dialer_goodbye: string;
}

interface Props {
  config: PowerDialerConfig | null;
  colaboradores: Array<{ id: string; nome: string }>;
}

export function PowerDialerConfigSection({ config, colaboradores }: Props) {
  const [state, action, pending] = useActionState(savePowerDialerConfigAction, {});

  if (!config) return null;

  return (
    <div className="border-t pt-6 space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Phone className="h-5 w-5" /> Power Dialer — Modo Lucas
        </h2>
        <p className="text-sm text-muted-foreground">
          Disca automaticamente vários leads em paralelo e conecta o colaborador na primeira chamada atendida.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="power_dialer_ativo"
            value="true"
            defaultChecked={config.power_dialer_ativo}
            className="rounded"
          />
          Power Dialer ativo
        </label>

        <div className="space-y-2">
          <label htmlFor="power_dialer_colaborador_id" className="text-sm font-medium">
            Colaborador
          </label>
          <select
            id="power_dialer_colaborador_id"
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
            <label htmlFor="power_dialer_batch_size" className="text-sm font-medium">
              Batch size (leads simultâneos)
            </label>
            <input
              id="power_dialer_batch_size"
              name="power_dialer_batch_size"
              type="number"
              min={1}
              max={5}
              defaultValue={config.power_dialer_batch_size ?? 3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="power_dialer_timeout_s" className="text-sm font-medium">
              Timeout (segundos)
            </label>
            <input
              id="power_dialer_timeout_s"
              name="power_dialer_timeout_s"
              type="number"
              min={5}
              max={30}
              defaultValue={config.power_dialer_timeout_s ?? 15}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="power_dialer_greeting" className="text-sm font-medium">
            Saudação (quando o lead atende antes de conectar)
          </label>
          <textarea
            id="power_dialer_greeting"
            name="power_dialer_greeting"
            rows={2}
            defaultValue={config.power_dialer_greeting ?? "Olá, tudo bem? Só um momento..."}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="power_dialer_goodbye" className="text-sm font-medium">
            Despedida (quando o lead é dropado)
          </label>
          <textarea
            id="power_dialer_goodbye"
            name="power_dialer_goodbye"
            rows={2}
            defaultValue={config.power_dialer_goodbye ?? "Desculpe, vamos retornar em breve, obrigada!"}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
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
