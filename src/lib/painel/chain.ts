import type { StepKey } from "./deadlines";

export interface ClienteRefs {
  id: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  designer_id: string | null;
  videomaker_id: string | null;
  editor_id: string | null;
}

const PARALLEL_STEPS: StepKey[] = ["tpg", "tpm", "valor_trafego", "gmn_post", "reuniao"];

export function isParallelStep(stepKey: StepKey): boolean {
  return PARALLEL_STEPS.includes(stepKey);
}

export function getResponsavelFor(stepKey: StepKey, cliente: ClienteRefs): string | null {
  switch (stepKey) {
    case "design":
      return cliente.designer_id;
    case "camera":
    case "mobile":
      return cliente.videomaker_id;
    case "edicao":
      return cliente.editor_id;
    case "cronograma":
    case "tpg":
    case "tpm":
    case "valor_trafego":
    case "gmn_post":
    case "reuniao":
    case "postagem":
      return cliente.assessor_id;
  }
}

interface ResolveContext {
  cameraAlreadyPronto?: boolean;
  mobileAlreadyPronto?: boolean;
}

export interface NextStepResult {
  next: StepKey;
  responsavel_id: string | null;
}

export function resolveNextStep(
  current: StepKey,
  cliente: ClienteRefs,
  ctx: ResolveContext = {},
): NextStepResult | null {
  if (isParallelStep(current)) return null;

  const mainChainKey = current as Exclude<StepKey, "tpg" | "tpm" | "valor_trafego" | "gmn_post" | "reuniao">;

  switch (mainChainKey) {
    case "cronograma":
      return { next: "design", responsavel_id: cliente.designer_id };
    case "design":
      return { next: "camera", responsavel_id: cliente.videomaker_id };
    case "camera":
      if (ctx.mobileAlreadyPronto) {
        return { next: "edicao", responsavel_id: cliente.editor_id };
      }
      return null;
    case "mobile":
      if (ctx.cameraAlreadyPronto) {
        return { next: "edicao", responsavel_id: cliente.editor_id };
      }
      return null;
    case "edicao":
      return { next: "postagem", responsavel_id: cliente.assessor_id };
    case "postagem":
      return null;
  }
}
