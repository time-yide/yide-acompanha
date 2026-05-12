interface Props {
  nomeContato: string | null;
  clientNome: string;
  dataEntrada: string;
}

function formatLongDate(iso: string): string {
  // dataEntrada vem como YYYY-MM-DD (DATE no postgres) — convertemos
  // no fuso APP (Cuiabá) pra evitar "off-by-one" em meses de borda.
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Cuiaba",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function HeroSection({ nomeContato, clientNome, dataEntrada }: Props) {
  const primeiroNome = (nomeContato ?? "").split(" ")[0] || clientNome;

  return (
    <section className="space-y-1.5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Olá, {primeiroNome} 👋
      </h1>
      <p className="text-sm text-muted-foreground">
        Sua conta com a <span className="font-medium text-foreground">Yide Digital</span>
        {" "}· Cliente desde {formatLongDate(dataEntrada)}
      </p>
    </section>
  );
}
