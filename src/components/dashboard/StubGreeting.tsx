interface Props {
  nome: string;
}

export function StubGreeting({ nome }: Props) {
  const primeiroNome = nome.split(" ")[0];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">
          O dashboard do seu papel chega na próxima fase.
        </p>
      </header>
    </div>
  );
}
