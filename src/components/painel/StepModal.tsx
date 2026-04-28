// Stub — será substituído em Task C3
"use client";
import type { StepKey, StepStatus } from "@/lib/painel/deadlines";

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

export function StepModal(_props: Props) {
  return <span className="inline-block">{_props.children}</span>;
}
