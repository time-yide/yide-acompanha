import { getSynthesisHistory } from "@/lib/satisfacao/queries";
import type { SatisfactionColor } from "@/lib/satisfacao/schema";

interface Props {
  clientId: string;
  size?: "sm" | "md";
}

const colorMap: Record<SatisfactionColor, string> = {
  verde: "bg-green-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-red-500",
};

export async function SatisfactionSparkline({ clientId, size = "sm" }: Props) {
  const history = await getSynthesisHistory(clientId, 12);
  // Reverse pra mostrar mais antigo à esquerda
  const reversed = [...history].reverse();
  // Padding com vazios pra sempre ter 12 quadradinhos
  const slots: Array<{ cor: SatisfactionColor | null; semana: string | null; score: number | null }> = [];
  const missingCount = Math.max(0, 12 - reversed.length);
  for (let i = 0; i < missingCount; i++) slots.push({ cor: null, semana: null, score: null });
  for (const s of reversed) {
    slots.push({ cor: s.cor_final, semana: s.semana_iso, score: Number(s.score_final) });
  }
  const dim = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className="flex gap-0.5">
      {slots.map((slot, i) => (
        <span
          key={i}
          title={slot.semana ? `${slot.semana} — score ${slot.score?.toFixed(1)}` : "sem dados"}
          className={`${dim} rounded-sm ${slot.cor ? colorMap[slot.cor] : "bg-muted"}`}
        />
      ))}
    </div>
  );
}
