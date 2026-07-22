import { Card } from "@/components/ui/card";
import {
  Zap, Star, Crown, MessageCircle, Users, Gem, Search, Handshake, Repeat,
  Video, Scissors, Camera, Images, Gauge, Film, AudioLines, PenTool, Palette,
  LayoutGrid, HeartHandshake, Target, Headphones, Radar, BadgeCheck, ClipboardList,
  Network, Eye, Code2, Cpu, Binary, ShoppingCart, Megaphone, Settings,
} from "lucide-react";
import type { SkillDerivada } from "@/lib/skills/derivar";

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown, Zap, MessageCircle, Users, Gem, Search, Handshake, Repeat, Video, Scissors,
  Camera, Images, Gauge, Film, AudioLines, PenTool, Palette, LayoutGrid, HeartHandshake,
  Target, Headphones, Radar, BadgeCheck, ClipboardList, Network, Eye, Code2, Cpu, Binary,
  ShoppingCart, Megaphone, Settings,
};

export function SkillsSecao({ skills }: { skills: SkillDerivada[] }) {
  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Zap className="h-4 w-4" />Skills</p>
      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem skills ainda.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {skills.map((s) => {
            const Icon = ICONES[s.icone] ?? Star;
            return (
              <div key={s.nome} className="rounded-lg border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="truncate text-xs font-medium">{s.nome}</span>
                  <span className="ml-auto whitespace-nowrap text-[10px] font-semibold text-primary">Nv {s.nivel}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${s.pctProx}%` }} /></div>
                <p className="mt-1 text-[10px] text-muted-foreground">{s.alvoProx === null ? "Nível máximo" : `${s.atual}/${s.alvoProx}`}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
