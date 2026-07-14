/**
 * Coluna "Gravação" do painel — read-only. Mostra quantas vezes o cliente foi
 * gravado no mês (conta linhas de audiovisual_capturas). Substitui as antigas
 * colunas Câmera + Mobile.
 */
export function GravacaoCell({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-[12px] text-muted-foreground/60">Não gravado</span>;
  }
  return (
    <span className="text-[12px] text-foreground/80">
      Gravado · {count}×
    </span>
  );
}
