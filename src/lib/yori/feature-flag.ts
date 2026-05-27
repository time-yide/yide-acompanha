import { getServerEnv } from "@/lib/env";

/**
 * Retorna true se o Yori está disponível pra uso (todas as vars setadas + YORI_ENABLED=true).
 */
export function isYoriEnabled(): boolean {
  const env = getServerEnv();
  return (
    env.YORI_ENABLED === "true"
    && !!env.GROQ_API_KEY
    && !!env.AWS_ACCESS_KEY_ID
    && !!env.AWS_SECRET_ACCESS_KEY
    && !!env.AWS_REGION
    && !!env.REMOTION_LAMBDA_FUNCTION_NAME
    && !!env.REMOTION_LAMBDA_SITE_NAME
  );
}

export const YORI_ALLOWED_ROLES = [
  "videomaker", "editor", "audiovisual_chefe", "assessor", "socio", "adm"
] as const;

export function canUseYori(role: string): boolean {
  return (YORI_ALLOWED_ROLES as readonly string[]).includes(role);
}
