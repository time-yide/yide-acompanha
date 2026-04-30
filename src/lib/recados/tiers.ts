export const TIER_ORDER = ["socios", "coordenadores", "assessores", "geral"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export const TIER_LABELS: Record<Tier, string> = {
  socios: "Sócios",
  coordenadores: "Coordenadores",
  assessores: "Assessores",
  geral: "Geral",
};

export function roleToTier(role: string): Tier {
  if (role === "socio") return "socios";
  if (role === "coordenador") return "coordenadores";
  if (role === "assessor") return "assessores";
  return "geral";
}

export interface RecadoForTier {
  id: string;
  autor_role_snapshot: string;
  permanente: boolean;
}

export interface TierGroups<T extends RecadoForTier> {
  fixados: T[];
  socios: T[];
  coordenadores: T[];
  assessores: T[];
  geral: T[];
}

export function groupByTier<T extends RecadoForTier>(recados: T[]): TierGroups<T> {
  const groups: TierGroups<T> = {
    fixados: [],
    socios: [],
    coordenadores: [],
    assessores: [],
    geral: [],
  };
  for (const r of recados) {
    if (r.permanente) {
      groups.fixados.push(r);
      continue;
    }
    groups[roleToTier(r.autor_role_snapshot)].push(r);
  }
  return groups;
}
