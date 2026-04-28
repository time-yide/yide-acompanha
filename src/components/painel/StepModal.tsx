"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, X } from "lucide-react";
import { markStepProntoAction } from "@/lib/painel/actions";
import type { StepStatus, StepKey } from "@/lib/painel/deadlines";

interface StepInfo {
  id: string;
  step_key: StepKey;
  status: StepStatus;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  iniciado_em: string | null;
  completed_at: string | null;
}

interface Props {
  step: StepInfo;
  clientNome: string;
  clientId: string;
  userRole: string;
  userId: string;
  children: React.ReactNode;
}

const STEP_LABELS: Record<StepKey, string> = {
  cronograma: "Cronograma",
  design: "Design",
  tpg: "Tráfego Pago Google",
  tpm: "Tráfego Pago Meta",
  valor_trafego: "Valor de Tráfego",
  gmn_post: "Google Meu Negócio",
  camera: "Câmera",
  mobile: "Mobile",
  edicao: "Edição",
  reuniao: "Reunião com Cliente",
  postagem: "Postagem",
};

function canMarkPronto(_stepKey: StepKey, userRole: string, userId: string, step: StepInfo): boolean {
  if (["socio", "adm", "coordenador"].includes(userRole)) return true;
  return step.responsavel_id === userId;
}

export function StepModal({ step, clientNome, userRole, userId, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleMarkPronto() {
    setError(null);
    const fd = new FormData();
    fd.set("step_id", step.id);
    startTransition(async () => {
      const result = await markStepProntoAction(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  const podeMarcar = canMarkPronto(step.step_key, userRole, userId, step) && step.status !== "pronto";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-block">
        {children}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{STEP_LABELS[step.step_key]}</h3>
                <p className="text-xs text-muted-foreground">{clientNome}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{step.status.replace("_", " ")}</dd>
              </div>
              {step.responsavel_nome && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Responsável</dt>
                  <dd>{step.responsavel_nome}</dd>
                </div>
              )}
              {step.iniciado_em && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Iniciado</dt>
                  <dd>{new Date(step.iniciado_em).toLocaleDateString("pt-BR")}</dd>
                </div>
              )}
              {step.completed_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Concluído</dt>
                  <dd>{new Date(step.completed_at).toLocaleDateString("pt-BR")}</dd>
                </div>
              )}
            </dl>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {podeMarcar && (
              <button
                onClick={handleMarkPronto}
                disabled={pending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {pending ? "Marcando..." : "Marcar como pronto"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
