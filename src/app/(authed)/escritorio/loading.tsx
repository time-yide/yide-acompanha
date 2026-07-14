import { ChannelSkeleton } from "@/components/escritorio/ChannelSkeleton";

/**
 * Loading da RAIZ do escritório. Cobre o índice (que calcula o canal alvo e
 * redireciona) e as rotas grupo/[id] e dm/[id] (que não têm loading próprio).
 * Sem isso, ao clicar em "Escritório Virtual" a tela anterior ficava congelada
 * durante o cálculo + redirect antes de qualquer esqueleto aparecer.
 */
export default function Loading() {
  return <ChannelSkeleton />;
}
