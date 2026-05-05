// VERSÃO MINIMALISTA TEMPORÁRIA pra investigar crash em produção.
// Tudo removido: queries, charts, listas, KPIs.
// Só renderiza o greeting. Se isso funcionar, o bug está em algum
// dos componentes/queries que voltaremos um por um.

interface Props {
  nome: string;
}

export async function DashboardSocioAdm({ nome }: Props) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">
          Dashboard temporariamente em manutenção. Outras telas continuam funcionando.
        </p>
      </header>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        Estamos investigando um problema técnico no painel principal. Use o menu
        lateral pra acessar Tarefas, Clientes, Calendário, etc.
      </div>
    </div>
  );
}
