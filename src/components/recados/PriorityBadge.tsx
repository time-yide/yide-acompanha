import { cn } from "@/lib/utils";
import { roleToTier, type Tier } from "@/lib/recados/tiers";

const ROLE_LABEL: Record<string, string> = {
  socio: "Sócio",
  adm: "ADM",
  coordenador: "Coordenador",
  assessor: "Assessor",
  comercial: "Comercial",
  audiovisual_chefe: "Chefe Audiovisual",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
};

const TIER_BG: Record<Tier, string> = {
  socios: "bg-sky-900 text-white",
  coordenadores: "bg-sky-700 text-white",
  assessores: "bg-cyan-400 text-cyan-950",
  geral: "bg-muted text-foreground",
};

export function PriorityBadge({ role }: { role: string }) {
  const tier = roleToTier(role);
  const label = ROLE_LABEL[role] ?? role;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", TIER_BG[tier])}>
      {label}
    </span>
  );
}
