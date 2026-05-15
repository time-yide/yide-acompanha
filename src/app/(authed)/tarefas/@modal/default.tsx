// Fallback do slot paralelo @modal pra navegação hard (refresh, link direto).
// Retorna null → nada é renderizado no slot, e o /tarefas/[id]/page.tsx
// regular toma conta da view completa.
export default function ModalDefault() {
  return null;
}
