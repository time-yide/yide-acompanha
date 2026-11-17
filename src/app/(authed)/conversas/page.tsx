import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { ConversasList } from "@/components/conversas/ConversasList";
import { ChatView } from "@/components/conversas/ChatView";
import { ContactInfoPanel } from "@/components/conversas/ContactInfoPanel";
import { listarConversasLyide, listarMensagensLyide } from "@/lib/conversas/lyide";

const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor", "programacao"];

type Filtro = "todas" | "nao_lidas";

/**
 * Espelho das conversas do número da API da conta da agência no Lyide.
 * Só leitura: a resposta é feita no Lyide (botão "Responder no Lyide").
 */
export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; filtro?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const conversaSelecionadaId = params.c ?? null;
  const filtro: Filtro = params.filtro === "nao_lidas" ? "nao_lidas" : "todas";

  const [lista, msgs] = await Promise.all([
    listarConversasLyide(),
    conversaSelecionadaId ? listarMensagensLyide(conversaSelecionadaId) : Promise.resolve(null),
  ]);

  const allConversas = lista.ok ? lista.data.conversas : [];
  const conversasFiltradas = allConversas.filter((c) => (filtro === "nao_lidas" ? c.nao_lidas > 0 : true));
  const conversaAtual = conversaSelecionadaId
    ? allConversas.find((c) => c.id === conversaSelecionadaId) ?? null
    : null;
  const mensagens = conversaAtual && msgs?.ok ? msgs.data : [];

  const aviso = !lista.ok
    ? lista.erro === "nao_configurado"
      ? "Conversas ainda não conectadas ao Lyide (faltam LYIDE_API_URL e LYIDE_API_SECRET)."
      : "Não deu pra carregar as conversas do Lyide agora. Tente de novo em instantes."
    : allConversas.length === 0
      ? "Nenhuma conversa no número da agência ainda."
      : null;

  return (
    <div className="-m-3 md:-m-6 flex h-[calc(100dvh-56px)] flex-col">
      {aviso && (
        <div className="flex items-center justify-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <span>{aviso}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className={`${conversaAtual ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
          <ConversasList
            conversas={conversasFiltradas}
            conversaSelecionadaId={conversaSelecionadaId}
            filtroAtivo={filtro}
            conexaoNome={lista.ok ? lista.data.conexao?.nome ?? null : null}
          />
        </div>

        <div className={`${conversaAtual ? "flex" : "hidden md:flex"} min-w-0 flex-1`}>
          <ChatView key={conversaAtual?.id ?? "empty"} conversa={conversaAtual} initialMessages={mensagens} />
        </div>

        {conversaAtual && <ContactInfoPanel conversa={conversaAtual} />}
      </div>
    </div>
  );
}
