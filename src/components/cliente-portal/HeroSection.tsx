import { Sparkles } from "lucide-react";

interface Props {
  nomeContato: string | null;
  clientNome: string;
  dataEntrada: string;
}

function formatLongDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function monthsBetween(iso: string): number {
  const start = new Date(`${iso}T12:00:00`);
  const now = new Date();
  const diff =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return Math.max(0, diff);
}

export function HeroSection({ nomeContato, clientNome, dataEntrada }: Props) {
  const primeiroNome = (nomeContato ?? "").split(" ")[0] || clientNome;
  const meses = monthsBetween(dataEntrada);
  const tempoLabel =
    meses === 0
      ? "menos de um mês"
      : meses === 1
      ? "1 mês"
      : meses < 12
      ? `${meses} meses`
      : meses < 24
      ? "1 ano"
      : `${Math.floor(meses / 12)} anos`;

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
        <p className="text-sm text-muted-foreground">
          Você é cliente da Yide há{" "}
          <span className="font-medium text-foreground">{tempoLabel}</span>{" "}
          · desde {formatLongDate(dataEntrada)}
        </p>
      </div>
    </section>
  );
}
