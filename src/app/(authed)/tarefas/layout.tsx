/**
 * Layout do segmento /tarefas. Renderiza children (listagem e páginas de
 * detalhe normais) + slot paralelo @modal que captura navegação client-side
 * pra /tarefas/[id] e exibe como dialog em vez de troca de página.
 *
 * Navegação hard (refresh, link compartilhado) cai no /tarefas/[id]/page.tsx
 * regular e mostra a página completa — o slot renderiza @modal/default (null).
 */
export default function TarefasLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
