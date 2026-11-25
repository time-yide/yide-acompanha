"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isYmd, prazoEdicaoPadrao, PRAZO_EDICAO_DIAS_UTEIS } from "@/lib/datas/dias-uteis";
import { formatYmdBr } from "@/lib/audiovisual/edicao-urgente";

interface Props {
  /** Data da gravação "YYYY-MM-DD" (pra mostrar o prazo normal). */
  dataGravacao: string;
  defaultUrgente?: boolean | null;
  defaultData?: string | null;
  defaultQtd?: number | null;
  /** Total de vídeos (só na captação) — limita a quantidade urgente. */
  qtdVideosMax?: number;
  /** Série recorrente: só aceita "Não". */
  somenteNao?: boolean;
  /** Texto extra abaixo da pergunta (ex.: "o assessor marcou Sim"). */
  hint?: string;
}

/**
 * Pergunta obrigatória "Tem edição que precisa sair antes do prazo?".
 * Envia `edicao_urgente` ("sim"/"nao"), `edicao_urgente_data`, `edicao_urgente_qtd`.
 */
export function EdicaoUrgenteField({
  dataGravacao,
  defaultUrgente = null,
  defaultData = null,
  defaultQtd = null,
  qtdVideosMax,
  somenteNao = false,
  hint,
}: Props) {
  const [urgente, setUrgente] = useState<boolean | null>(
    somenteNao && defaultUrgente ? false : defaultUrgente,
  );
  const prazo = isYmd(dataGravacao) ? prazoEdicaoPadrao(dataGravacao) : null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-4",
        urgente ? "border-orange-500/50 bg-orange-500/5" : "bg-muted/20",
      )}
    >
      <div className="space-y-1">
        <Label>Tem edição que precisa sair antes do prazo? *</Label>
        <p className="text-xs text-muted-foreground">
          O prazo normal de edição é {PRAZO_EDICAO_DIAS_UTEIS} dias úteis a partir da gravação
          {prazo ? <> (<strong>{formatYmdBr(prazo)}</strong>)</> : null}.
        </p>
        {hint && <p className="text-xs text-orange-700 dark:text-orange-400">{hint}</p>}
      </div>

      <div className="flex gap-4 text-sm">
        <label className={cn("flex items-center gap-2", somenteNao ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
          <input
            type="radio"
            name="edicao_urgente"
            value="sim"
            required
            disabled={somenteNao}
            checked={urgente === true}
            onChange={() => setUrgente(true)}
          />
          Sim
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="edicao_urgente"
            value="nao"
            required
            checked={urgente === false}
            onChange={() => setUrgente(false)}
          />
          Não
        </label>
      </div>

      {somenteNao && (
        <p className="text-xs text-muted-foreground">
          Em gravação que se repete, marque a urgência depois, abrindo a gravação do dia.
        </p>
      )}

      {urgente && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edicao_urgente_data">Precisa sair até *</Label>
            <Input
              id="edicao_urgente_data"
              name="edicao_urgente_data"
              type="date"
              required
              min={isYmd(dataGravacao) ? dataGravacao : undefined}
              defaultValue={defaultData ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edicao_urgente_qtd">Quantos vídeos são urgentes *</Label>
            <Input
              id="edicao_urgente_qtd"
              name="edicao_urgente_qtd"
              type="number"
              min={1}
              max={qtdVideosMax && qtdVideosMax > 0 ? qtdVideosMax : undefined}
              required
              defaultValue={defaultQtd ?? 1}
            />
          </div>
        </div>
      )}
    </div>
  );
}
