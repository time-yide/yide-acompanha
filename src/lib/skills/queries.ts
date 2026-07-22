import { getStatsDoUsuario, type StatsUsuario } from "@/lib/conquistas/stats";
import { derivarSkills, type SkillDerivada } from "./derivar";

export async function getSkillsDoUsuario(
  userId: string,
  role: string,
  classe: string | null,
  stats?: StatsUsuario,
): Promise<SkillDerivada[]> {
  const s = stats ?? (await getStatsDoUsuario(userId, role));
  return derivarSkills(role, classe, s);
}
