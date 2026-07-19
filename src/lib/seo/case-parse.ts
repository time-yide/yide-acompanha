import { semTravessao } from "@/lib/blog/texto";
export interface CasePolido { conteudo_md: string; meta_title: string; meta_description: string }
export function parseCasePolido(raw: Record<string, unknown> | null): CasePolido | null {
  if (!raw || typeof raw.conteudo_md !== "string") return null;
  const conteudo_md = semTravessao(raw.conteudo_md.trim());
  if (!conteudo_md) return null;
  return {
    conteudo_md,
    meta_title: typeof raw.meta_title === "string" ? semTravessao(raw.meta_title.trim()).slice(0, 70) : "",
    meta_description: typeof raw.meta_description === "string" ? semTravessao(raw.meta_description.trim()).slice(0, 160) : "",
  };
}
