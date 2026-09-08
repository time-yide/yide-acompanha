import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { ConversasList } from "@/components/conversas/ConversasList";
import { ChatView } from "@/components/conversas/ChatView";
import { ContactInfoPanel } from "@/components/conversas/ContactInfoPanel";
import {
  listConversations,
  getConversation,
  listMessages,
  getOrganizationIdByUser,
} from "@/lib/conversas/queries";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor", "programacao"];

type Filtro = "todas" | "nao_lidas";

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; filtro?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const orgId = await getOrganizationIdByUser(user.id);
  if (!orgId) notFound();

  const conversaSelecionadaId = params.c ?? null;
  const filtro: Filtro = params.filtro === "nao_lidas" ? "nao_lidas" : "todas";

  const allConversas = await listConversations(orgId);

  // Filtro
  const conversasFiltradas = allConversas.filter((c) => {
    if (filtro === "nao_lidas") return c.nao_lidas > 0;
    return true;
  });

  const conversaAtual = conversaSelecionadaId
    ? await getConversation(conversaSelecionadaId)
    : null;

  const mensagens = conversaAtual
    ? await listMessages(conversaAtual.id)
    : [];

  return (
    <div className="-m-3 md:-m-6 flex h-[calc(100dvh-56px)] flex-col">
      {allConversas.length === 0 && (
        <div className="flex items-center justify-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <span>
            Nenhuma conversa ainda. Configure o webhook do Twilio WhatsApp para começar a receber mensagens.
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
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

        <div
          className={`${
            conversaAtual ? "flex" : "hidden md:flex"
          } min-w-0 flex-1`}
        >
          <ChatView key={conversaAtual?.id ?? "empty"} conversa={conversaAtual} initialMessages={mensagens} />
        </div>

        {conversaAtual && <ContactInfoPanel conversa={conversaAtual} />}
      </div>
    </div>
  );
}
