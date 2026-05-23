import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { ConversasList } from "@/components/conversas/ConversasList";
import { ChatView } from "@/components/conversas/ChatView";
import { ContactInfoPanel } from "@/components/conversas/ContactInfoPanel";
import { MOCK_CONVERSAS, getConversaById } from "@/lib/conversas/mock-data";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];

type Filtro = "todas" | "nao_lidas" | "comerciais";

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; filtro?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const conversaSelecionadaId = params.c ?? null;
  const filtro: Filtro = params.filtro === "nao_lidas" || params.filtro === "comerciais"
    ? params.filtro
    : "todas";

  // Aplica filtro nas conversas (placeholder - quando vier do DB, mover pra query).
  const conversasFiltradas = MOCK_CONVERSAS.filter((c) => {
    if (c.arquivada) return false;
    if (filtro === "nao_lidas") return c.nao_lidas > 0;
    if (filtro === "comerciais") return c.canal === "whatsapp"; // simplificação
    return true;
  });

  const conversaAtual = conversaSelecionadaId
    ? getConversaById(conversaSelecionadaId)
    : null;

  return (
    // Quebra do padding do (authed)/layout pra ocupar a tela inteira.
    // 56px = altura do TopBar.
    <div className="-m-3 md:-m-6 flex h-[calc(100dvh-56px)] flex-col">
      {/* Banner discreto "Em construção" - não rouba espaço da UI */}
      <div className="flex items-center justify-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
        <Sparkles className="h-3 w-3" />
        <span>
          UI prévia. Conexão com Evolution API ainda em construção. Mensagens não são enviadas.
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar: visível sempre em desktop; em mobile, só quando nenhuma conversa selecionada */}
        <div
          className={`${
            conversaAtual ? "hidden md:flex" : "flex"
          } w-full md:w-auto`}
        >
          <ConversasList
            conversas={conversasFiltradas}
            conversaSelecionadaId={conversaSelecionadaId}
            filtroAtivo={filtro}
          />
        </div>

        {/* Chat: visível sempre em desktop; em mobile, só com conversa selecionada */}
        <div
          className={`${
            conversaAtual ? "flex" : "hidden md:flex"
          } min-w-0 flex-1`}
        >
          <ChatView conversa={conversaAtual} />
        </div>

        {/* Info do contato - só em viewports xl pra cima */}
        {conversaAtual && <ContactInfoPanel conversa={conversaAtual} />}
      </div>
    </div>
  );
}
