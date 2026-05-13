import { Sparkles } from "lucide-react";

interface Props {
  nomeContato: string | null;
  clientNome: string;
}

export function HeroSection({ nomeContato, clientNome }: Props) {
  const primeiroNome = (nomeContato ?? "").split(" ")[0] || clientNome;

  return (
    <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          Portal do cliente · Yide Digital
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Olá, {primeiroNome} 👋
        </h1>
      </div>
    </section>
  );
}
