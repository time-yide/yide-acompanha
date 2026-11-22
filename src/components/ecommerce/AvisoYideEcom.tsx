interface Props {
  erro: "nao_configurado" | "falha";
  /** "as vendas", "as sugestões"... */
  oQue: string;
}

export function AvisoYideEcom({ erro, oQue }: Props) {
  return (
    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
      {erro === "nao_configurado"
        ? "Ligação com o Yide Ecom ainda não configurada."
        : `Não foi possível buscar ${oQue} do Yide Ecom agora. Tente de novo em alguns minutos.`}
    </p>
  );
}
