import { getServerEnv } from "@/lib/env";

/** Editor IA disponível só com Shotstack + Groq configurados. */
export function isEditorIaEnabled(): boolean {
  const env = getServerEnv();
  return !!env.SHOTSTACK_API_KEY && !!env.GROQ_API_KEY;
}

export const EDITOR_IA_ALLOWED_ROLES = [
  "videomaker", "editor", "audiovisual_chefe", "assessor", "socio", "adm",
] as const;

export function canUseEditorIa(role: string): boolean {
  return (EDITOR_IA_ALLOWED_ROLES as readonly string[]).includes(role);
}
