import { Globe, Search, MapPin, Camera, ThumbsUp, Megaphone, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { CANAL_LABEL, type CanalId, type ResultadoCanal } from "@/lib/dados/tipos";
import { cn } from "@/lib/utils";

const ICONE: Record<CanalId, LucideIcon> = {
  site: Globe, google: Search, gmn: MapPin, instagram: Camera, facebook: ThumbsUp,
  anuncios: Megaphone, ecommerce: ShoppingCart, crm: Users,
};
const COR: Record<ResultadoCanal["status"], string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  fraco: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  ausente: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  sem_acesso: "bg-white/5 text-white/35 border-white/10",
  nao_se_aplica: "hidden",
};
const STATUS_LABEL: Record<ResultadoCanal["status"], string> = {
  ok: "Indo bem", fraco: "Fraco ou parado", ausente: "Sem presença", sem_acesso: "Sem acesso ligado", nao_se_aplica: "",
};

export function CanalIcone({ canal, r, size = "md" }: { canal: CanalId; r: ResultadoCanal; size?: "sm" | "md" }) {
  const Icon = ICONE[canal];
  const titulo = `${CANAL_LABEL[canal]}: ${STATUS_LABEL[r.status]}${r.motivo ? ` — ${r.motivo}` : ""}`;
  return (
    <span title={titulo} aria-label={titulo}
      className={cn("inline-flex items-center justify-center rounded-md border", COR[r.status], size === "sm" ? "h-5 w-5" : "h-7 w-7")}>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
    </span>
  );
}

export function LegendaStatus() {
  const itens: Array<[ResultadoCanal["status"], string]> = [["ok", "indo bem"], ["fraco", "fraco ou parado"], ["ausente", "sem presença"], ["sem_acesso", "sem acesso ligado"]];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-white/60">
      {itens.map(([s, l]) => (
        <span key={s} className="inline-flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded border", COR[s])} />{l}</span>
      ))}
    </div>
  );
}
