"use client";

import { useState } from "react";
import { Loader2, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarBriefing } from "@/lib/content-calendar/types";

const PERGUNTAS: { field: keyof CalendarBriefing; label: string; placeholder: string }[] = [
  {
    field: "temas_cliente",
    label: "Quais temas ou ideias o cliente quer abordar neste mês?",
    placeholder: "Ex: lançamento de produto novo, conteúdo sobre bastidores, depoimentos de clientes...",
  },
  {
    field: "promocoes_eventos",
    label: "Tem alguma promoção, evento ou data importante?",
    placeholder: "Ex: Black Friday, aniversário da loja, semana de descontos...",
  },
  {
    field: "ideias_assessor",
    label: "Suas ideias e sugestões como assessor",
    placeholder: "Ex: apostar em reels curtos com antes/depois, explorar trend do momento...",
  },
  {
    field: "evitar",
    label: "O que NÃO fazer / evitar neste mês?",
    placeholder: "Ex: não falar de concorrente X, evitar tom muito formal, não usar humor...",
  },
  {
    field: "observacoes",
    label: "Observações extras",
    placeholder: "Qualquer contexto adicional que ajude na geração do cronograma...",
  },
];

interface Props {
  onSubmit: (briefing: CalendarBriefing) => void;
  loading?: boolean;
  initialBriefing?: CalendarBriefing | null;
  submitLabel?: string;
}

export function BriefingForm({ onSubmit, loading, initialBriefing, submitLabel }: Props) {
  const [values, setValues] = useState<CalendarBriefing>({
    temas_cliente: initialBriefing?.temas_cliente ?? "",
    promocoes_eventos: initialBriefing?.promocoes_eventos ?? "",
    ideias_assessor: initialBriefing?.ideias_assessor ?? "",
    evitar: initialBriefing?.evitar ?? "",
    observacoes: initialBriefing?.observacoes ?? "",
  });

  function handleChange(field: keyof CalendarBriefing, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  const hasContent = Object.values(values).some((v) => v.trim().length > 0);

  return (
    <div className="mx-auto max-w-3xl rounded-lg border bg-card shadow-sm">
      <div className="border-b px-8 py-5">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            Briefing do Mês
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha as informações abaixo antes de gerar o cronograma. Quanto mais
          detalhes, melhor será o resultado da IA.
        </p>
      </div>

      <div className="space-y-6 px-8 py-6">
        {PERGUNTAS.map(({ field, label, placeholder }) => (
          <div key={field}>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {label}
            </label>
            <Textarea
              value={values[field]}
              onChange={(e) =>
                handleChange(field, (e.target as HTMLTextAreaElement).value)
              }
              placeholder={placeholder}
              rows={3}
              className="text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t px-8 py-4">
        <Button
          onClick={() => onSubmit(values)}
          disabled={!hasContent || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {submitLabel ?? "Gerar cronograma"}
            </>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          Preencha ao menos um campo para gerar
        </span>
      </div>
    </div>
  );
}
