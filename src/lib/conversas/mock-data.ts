// Mock data temporário pra UI de Conversas funcionar enquanto a Evolution API
// não tá conectada. Quando o backend entrar (Fase 1 do roadmap), substitui isso
// por queries reais em `conversas`/`mensagens` no Supabase.

export type CanalConversa = "whatsapp" | "instagram";
export type StatusMensagem = "enviando" | "enviada" | "entregue" | "lida" | "falhou";
export type AutorMensagem = "lead" | "comercial";

export interface MensagemMock {
  id: string;
  autor: AutorMensagem;
  texto: string;
  timestamp: string; // ISO
  status: StatusMensagem; // só relevante pra autor=comercial
}

export interface ConversaMock {
  id: string;
  contato_nome: string;
  contato_telefone: string;
  canal: CanalConversa;
  avatar_url: string | null;
  ultima_mensagem: string;
  ultima_mensagem_em: string; // ISO
  nao_lidas: number;
  comercial_nome: string;
  comercial_avatar: string | null;
  lead_vinculado_id: string | null;
  lead_vinculado_nome: string | null;
  instancia_nome: string; // "WPP Comercial 1" etc
  arquivada: boolean;
  fixada: boolean;
  online: boolean;
  ultima_vez_visto: string | null; // ISO ou null se online
  mensagens: MensagemMock[];
}

const HOJE = new Date();
function rel(minutos: number): string {
  return new Date(HOJE.getTime() - minutos * 60 * 1000).toISOString();
}

export const MOCK_CONVERSAS: ConversaMock[] = [
  {
    id: "c-001",
    contato_nome: "Maria Helena Costa",
    contato_telefone: "+55 11 98765-4321",
    canal: "whatsapp",
    avatar_url: null,
    ultima_mensagem: "Perfeito, vou conversar com meu sócio e te dou um retorno até amanhã 👍",
    ultima_mensagem_em: rel(3),
    nao_lidas: 2,
    comercial_nome: "Yasmin",
    comercial_avatar: null,
    lead_vinculado_id: "lead-001",
    lead_vinculado_nome: "Costa & Associados",
    instancia_nome: "WPP Comercial 1",
    arquivada: false,
    fixada: true,
    online: true,
    ultima_vez_visto: null,
    mensagens: [
      { id: "m-001-1", autor: "lead", texto: "Oi Yasmin! Tudo bem?", timestamp: rel(180), status: "lida" },
      { id: "m-001-2", autor: "lead", texto: "Vi sua proposta, achei interessante. Pode me explicar melhor o plano de 6 meses?", timestamp: rel(178), status: "lida" },
      { id: "m-001-3", autor: "comercial", texto: "Oi Maria, tudo ótimo e contigo? Claro! O plano de 6 meses inclui gestão completa de redes sociais + 4 reuniões de alinhamento + relatórios mensais", timestamp: rel(60), status: "lida" },
      { id: "m-001-4", autor: "comercial", texto: "O valor é R$ 3.500/mês, e a partir do 4º mês a gente revisa juntos pra ajustar o foco", timestamp: rel(58), status: "lida" },
      { id: "m-001-5", autor: "lead", texto: "Show. E vocês trabalham com produção de vídeo também?", timestamp: rel(20), status: "lida" },
      { id: "m-001-6", autor: "comercial", texto: "Sim! Inclui 2 vídeos por mês (reels ou stories), e dá pra adicionar mais por R$ 200 cada", timestamp: rel(18), status: "lida" },
      { id: "m-001-7", autor: "lead", texto: "Perfeito, vou conversar com meu sócio e te dou um retorno até amanhã 👍", timestamp: rel(3), status: "lida" },
    ],
  },
  {
    id: "c-002",
    contato_nome: "Dr. Tetilla",
    contato_telefone: "+55 21 99988-7766",
    canal: "whatsapp",
    avatar_url: null,
    ultima_mensagem: "Vocês podem mandar o link do portfólio?",
    ultima_mensagem_em: rel(35),
    nao_lidas: 1,
    comercial_nome: "Yasmin",
    comercial_avatar: null,
    lead_vinculado_id: "lead-002",
    lead_vinculado_nome: "Dr Tetilla (Clínica)",
    instancia_nome: "WPP Comercial 1",
    arquivada: false,
    fixada: false,
    online: false,
    ultima_vez_visto: rel(15),
    mensagens: [
      { id: "m-002-1", autor: "comercial", texto: "Bom dia, doutor! Aqui é a Yasmin da Yide Digital. Tudo bem?", timestamp: rel(720), status: "lida" },
      { id: "m-002-2", autor: "lead", texto: "Bom dia! Tudo bem sim", timestamp: rel(700), status: "lida" },
      { id: "m-002-3", autor: "lead", texto: "Sobre o que era mesmo?", timestamp: rel(700), status: "lida" },
      { id: "m-002-4", autor: "comercial", texto: "Você tinha pedido uma proposta de gestão de redes pra clínica, lembra?", timestamp: rel(680), status: "lida" },
      { id: "m-002-5", autor: "lead", texto: "Ahh sim! Manda aí", timestamp: rel(660), status: "lida" },
      { id: "m-002-6", autor: "comercial", texto: "Acabei de te mandar por e-mail. Qualquer dúvida me chama!", timestamp: rel(120), status: "lida" },
      { id: "m-002-7", autor: "lead", texto: "Vocês podem mandar o link do portfólio?", timestamp: rel(35), status: "lida" },
    ],
  },
  {
    id: "c-003",
    contato_nome: "Bruno Marçal",
    contato_telefone: "+55 47 99123-4567",
    canal: "instagram",
    avatar_url: null,
    ultima_mensagem: "Combinado então, semana que vem a gente fala 🤝",
    ultima_mensagem_em: rel(120),
    nao_lidas: 0,
    comercial_nome: "Yasmin",
    comercial_avatar: null,
    lead_vinculado_id: null,
    lead_vinculado_nome: null,
    instancia_nome: "Instagram @yidedigital",
    arquivada: false,
    fixada: false,
    online: false,
    ultima_vez_visto: rel(90),
    mensagens: [
      { id: "m-003-1", autor: "lead", texto: "Oi, vi o post de vocês sobre tráfego pago", timestamp: rel(1440), status: "lida" },
      { id: "m-003-2", autor: "lead", texto: "Trabalham com loja física também?", timestamp: rel(1438), status: "lida" },
      { id: "m-003-3", autor: "comercial", texto: "Oi Bruno! Sim, trabalhamos. Pode me contar um pouco sobre sua loja?", timestamp: rel(1400), status: "lida" },
      { id: "m-003-4", autor: "lead", texto: "É uma loja de roupas em Balneário Camboriú, faturamento médio 80k/mês", timestamp: rel(1380), status: "lida" },
      { id: "m-003-5", autor: "comercial", texto: "Show! A gente já trabalhou com varejo. Bora marcar uma call?", timestamp: rel(1300), status: "lida" },
      { id: "m-003-6", autor: "lead", texto: "Combinado então, semana que vem a gente fala 🤝", timestamp: rel(120), status: "lida" },
    ],
  },
  {
    id: "c-004",
    contato_nome: "Camila Werner",
    contato_telefone: "+55 11 91234-5678",
    canal: "whatsapp",
    avatar_url: null,
    ultima_mensagem: "Você",
    ultima_mensagem_em: rel(360),
    nao_lidas: 0,
    comercial_nome: "Pedro",
    comercial_avatar: null,
    lead_vinculado_id: "lead-004",
    lead_vinculado_nome: "Werner Imóveis",
    instancia_nome: "WPP Comercial 2",
    arquivada: false,
    fixada: false,
    online: false,
    ultima_vez_visto: rel(200),
    mensagens: [
      { id: "m-004-1", autor: "lead", texto: "Oi, recebi indicação da Marcela", timestamp: rel(2880), status: "lida" },
      { id: "m-004-2", autor: "comercial", texto: "Oi Camila! Que bom! Como posso te ajudar?", timestamp: rel(2860), status: "lida" },
      { id: "m-004-3", autor: "lead", texto: "Preciso reformular minha estratégia de Instagram pra imobiliária", timestamp: rel(2800), status: "lida" },
      { id: "m-004-4", autor: "comercial", texto: "Perfeito, vou te mandar um questionário rápido pra entender melhor seu nicho", timestamp: rel(2700), status: "entregue" },
      { id: "m-004-5", autor: "comercial", texto: "[Questionário Diagnóstico Inicial.pdf]", timestamp: rel(360), status: "entregue" },
    ],
  },
  {
    id: "c-005",
    contato_nome: "Lucas Andrade",
    contato_telefone: "+55 31 98876-5432",
    canal: "whatsapp",
    avatar_url: null,
    ultima_mensagem: "Vou pensar e te aviso",
    ultima_mensagem_em: rel(2880),
    nao_lidas: 0,
    comercial_nome: "Yasmin",
    comercial_avatar: null,
    lead_vinculado_id: null,
    lead_vinculado_nome: null,
    instancia_nome: "WPP Comercial 1",
    arquivada: false,
    fixada: false,
    online: false,
    ultima_vez_visto: rel(1800),
    mensagens: [
      { id: "m-005-1", autor: "comercial", texto: "Oi Lucas, conseguiu ver a proposta?", timestamp: rel(3000), status: "lida" },
      { id: "m-005-2", autor: "lead", texto: "Vou pensar e te aviso", timestamp: rel(2880), status: "lida" },
    ],
  },
  {
    id: "c-006",
    contato_nome: "Fernanda Lima",
    contato_telefone: "+55 85 99765-1122",
    canal: "instagram",
    avatar_url: null,
    ultima_mensagem: "Quanto custa o plano starter?",
    ultima_mensagem_em: rel(10),
    nao_lidas: 3,
    comercial_nome: "Yasmin",
    comercial_avatar: null,
    lead_vinculado_id: null,
    lead_vinculado_nome: null,
    instancia_nome: "Instagram @yidedigital",
    arquivada: false,
    fixada: false,
    online: true,
    ultima_vez_visto: null,
    mensagens: [
      { id: "m-006-1", autor: "lead", texto: "Oi! Vi o anúncio de vocês", timestamp: rel(12), status: "lida" },
      { id: "m-006-2", autor: "lead", texto: "Vocês atendem dropshipping?", timestamp: rel(11), status: "lida" },
      { id: "m-006-3", autor: "lead", texto: "Quanto custa o plano starter?", timestamp: rel(10), status: "lida" },
    ],
  },
];

export function getConversaById(id: string): ConversaMock | null {
  return MOCK_CONVERSAS.find((c) => c.id === id) ?? null;
}

export function formatHora(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - d.getTime();
  const diffMin = diffMs / 60000;
  const diffDias = diffMs / (1000 * 60 * 60 * 24);

  if (diffMin < 1) return "agora";
  if (diffDias < 1 && agora.toDateString() === d.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDias < 2) return "ontem";
  if (diffDias < 7) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatHoraMsg(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
