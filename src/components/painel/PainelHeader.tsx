import { MesSelector } from "./MesSelector";

interface Props {
  mesAtual: string;
  mesesDisponiveis: string[];
}

export function PainelHeader({ mesAtual, mesesDisponiveis }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel mensal</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento de etapas por cliente</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Mês:</span>
        <MesSelector current={mesAtual} options={mesesDisponiveis} />
      </div>
    </div>
  );
}
