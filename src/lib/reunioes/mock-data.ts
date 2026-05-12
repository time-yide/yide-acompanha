// Mock data pra Fase 0 — UI funciona com dados realistas enquanto a integração
// real (Google OAuth + Calendar + transcrição + IA) está em construção.
// Quando o backend de verdade entrar, removemos este arquivo e substituímos
// por queries reais em `src/lib/reunioes/queries.ts`.

import type {
  MeetingDetail,
  MeetingListItem,
  ParticipantSummary,
  TranscriptSegment,
} from "./tipos";

const AGORA = new Date();
function rel(minutos: number): string {
  return new Date(AGORA.getTime() - minutos * 60 * 1000).toISOString();
}
function relFuturo(minutos: number): string {
  return new Date(AGORA.getTime() + minutos * 60 * 1000).toISOString();
}

const PARTICIPANTES_FIXTURE: Record<string, ParticipantSummary[]> = {
  meet01: [
    { id: "p1", profile_id: null, nome: "Yasmin Monteiro", email: "yasmin@yidedigital.com.br", papel: "host", tempo_presenca_segundos: 2820, tempo_falando_segundos: 1240, avatar_url: null },
    { id: "p2", profile_id: null, nome: "Maria Helena Costa", email: "maria@costaassociados.com", papel: "attendee", tempo_presenca_segundos: 2820, tempo_falando_segundos: 980, avatar_url: null },
    { id: "p3", profile_id: null, nome: "Pedro Costa", email: "pedro@costaassociados.com", papel: "attendee", tempo_presenca_segundos: 2600, tempo_falando_segundos: 540, avatar_url: null },
  ],
  meet02: [
    { id: "p4", profile_id: null, nome: "Yasmin Monteiro", email: "yasmin@yidedigital.com.br", papel: "host", tempo_presenca_segundos: 1800, tempo_falando_segundos: 900, avatar_url: null },
    { id: "p5", profile_id: null, nome: "Dr. Tetilla", email: "dr.tetilla@clinica.com", papel: "attendee", tempo_presenca_segundos: 1800, tempo_falando_segundos: 820, avatar_url: null },
  ],
  meet03: [
    { id: "p6", profile_id: null, nome: "Pedro (interno)", email: "pedro@yidedigital.com.br", papel: "host", tempo_presenca_segundos: 3600, tempo_falando_segundos: 1500, avatar_url: null },
    { id: "p7", profile_id: null, nome: "Camila Werner", email: "camila@wernerimoveis.com", papel: "attendee", tempo_presenca_segundos: 3600, tempo_falando_segundos: 1700, avatar_url: null },
    { id: "p8", profile_id: null, nome: "Yasmin Monteiro", email: "yasmin@yidedigital.com.br", papel: "attendee", tempo_presenca_segundos: 3400, tempo_falando_segundos: 380, avatar_url: null },
  ],
};

export const MOCK_MEETINGS: MeetingListItem[] = [
  {
    id: "meet-04",
    titulo: "Discovery — Loja Bruno Marçal",
    status: "scheduled",
    source: "google_meet",
    starts_at: relFuturo(60 * 24), // amanhã
    ends_at: null,
    duracao_segundos: null,
    owner_user_id: "user-yasmin",
    owner_nome: "Yasmin Monteiro",
    owner_avatar: null,
    participantes_count: 3,
    participantes_preview: [
      { id: "px1", profile_id: null, nome: "Yasmin Monteiro", email: null, papel: "host", tempo_presenca_segundos: null, tempo_falando_segundos: null },
      { id: "px2", profile_id: null, nome: "Bruno Marçal", email: null, papel: "attendee", tempo_presenca_segundos: null, tempo_falando_segundos: null },
      { id: "px3", profile_id: null, nome: "Pedro Yide", email: null, papel: "attendee", tempo_presenca_segundos: null, tempo_falando_segundos: null },
    ],
    recording_ready: false,
    transcript_ready: false,
    summary_ready: false,
    insights_ready: false,
    lead_id: null,
    lead_nome: null,
    client_id: null,
    client_nome: null,
    tags: ["discovery", "varejo"],
    resumo_preview: null,
    tasks_geradas_count: 0,
  },
  {
    id: "meet-03",
    titulo: "Kickoff — Werner Imóveis",
    status: "processing",
    source: "google_meet",
    starts_at: rel(45),
    ends_at: rel(0),
    duracao_segundos: 2700,
    owner_user_id: "user-pedro",
    owner_nome: "Pedro Yide",
    owner_avatar: null,
    participantes_count: 3,
    participantes_preview: PARTICIPANTES_FIXTURE.meet03.slice(0, 4),
    recording_ready: true,
    transcript_ready: true,
    summary_ready: false,
    insights_ready: false,
    lead_id: null,
    lead_nome: null,
    client_id: "client-werner",
    client_nome: "Werner Imóveis",
    tags: ["kickoff", "imobiliario"],
    resumo_preview: "Resumo IA sendo gerado…",
    tasks_geradas_count: 0,
  },
  {
    id: "meet-02",
    titulo: "Follow-up — Dr. Tetilla (Clínica)",
    status: "completed",
    source: "google_meet",
    starts_at: rel(720),
    ends_at: rel(690),
    duracao_segundos: 1800,
    owner_user_id: "user-yasmin",
    owner_nome: "Yasmin Monteiro",
    owner_avatar: null,
    participantes_count: 2,
    participantes_preview: PARTICIPANTES_FIXTURE.meet02,
    recording_ready: true,
    transcript_ready: true,
    summary_ready: true,
    insights_ready: true,
    lead_id: "lead-tetilla",
    lead_nome: "Dr Tetilla — Clínica",
    client_id: null,
    client_nome: null,
    tags: ["follow-up", "saude"],
    resumo_preview: "Dr. Tetilla aprovou o escopo da proposta. Quer revisar valores na próxima semana antes do fechamento.",
    tasks_geradas_count: 3,
  },
  {
    id: "meet-01",
    titulo: "Apresentação de proposta — Costa & Associados",
    status: "completed",
    source: "google_meet",
    starts_at: rel(1440 * 2),
    ends_at: rel(1440 * 2 - 47),
    duracao_segundos: 2820,
    owner_user_id: "user-yasmin",
    owner_nome: "Yasmin Monteiro",
    owner_avatar: null,
    participantes_count: 3,
    participantes_preview: PARTICIPANTES_FIXTURE.meet01,
    recording_ready: true,
    transcript_ready: true,
    summary_ready: true,
    insights_ready: true,
    lead_id: "lead-001",
    lead_nome: "Costa & Associados",
    client_id: null,
    client_nome: null,
    tags: ["proposta", "juridico"],
    resumo_preview: "Maria Helena demonstrou interesse no plano de 6 meses. Pediu revisão pra incluir mais 2 vídeos por mês. Vai conversar com o sócio e dar retorno em 24h.",
    tasks_geradas_count: 4,
  },
];

const TRANSCRIPT_MEET01: TranscriptSegment[] = [
  { speaker_id: "p1", speaker: "Yasmin", start: 0, end: 8, text: "Oi Maria, oi Pedro! Tudo bem? Vamos começar então." },
  { speaker_id: "p2", speaker: "Maria Helena", start: 8, end: 15, text: "Tudo ótimo Yasmin, prontos pra ver a proposta." },
  { speaker_id: "p1", speaker: "Yasmin", start: 16, end: 45, text: "Perfeito. Hoje vou apresentar o plano completo de gestão de redes que a gente desenhou pra Costa & Associados. São 4 grandes pilares: estratégia, criação de conteúdo, gestão de tráfego e relatórios mensais." },
  { speaker_id: "p2", speaker: "Maria Helena", start: 45, end: 58, text: "Ótimo. Antes da gente entrar nos pilares — quanto de produção de vídeo vai entrar? Esse foi o ponto que mais me preocupou no orçamento anterior." },
  { speaker_id: "p1", speaker: "Yasmin", start: 58, end: 90, text: "Boa pergunta. No plano de 6 meses entram 2 vídeos por mês inclusos: pode ser reels ou stories. Acima disso, R$ 200 por peça extra. Vocês vinham fazendo quantos por mês antes?" },
  { speaker_id: "p3", speaker: "Pedro Costa", start: 90, end: 105, text: "A gente tava fazendo uns 4 a 5 por mês com a outra agência, mas a qualidade variava muito." },
  { speaker_id: "p1", speaker: "Yasmin", start: 105, end: 150, text: "Entendi. Olha, com 2 fixos mais 2 extras vocês ficariam em R$ 400/mês adicional, dá um total de R$ 3.900. Ainda fica abaixo da concorrência e com qualidade controlada por um diretor de arte dedicado." },
  { speaker_id: "p2", speaker: "Maria Helena", start: 150, end: 175, text: "Mmm. E sobre o relatório — vocês fazem mensal? Quero algo que eu possa apresentar pro nosso conselho." },
  { speaker_id: "p1", speaker: "Yasmin", start: 175, end: 220, text: "Sim, relatório mensal com dashboard executivo e uma reunião de alinhamento de 1 hora por mês. Posso te enviar um exemplo do que entregamos pra outros clientes do setor." },
  { speaker_id: "p2", speaker: "Maria Helena", start: 220, end: 245, text: "Adorei. A gente precisa fechar em 24 horas. Vou apresentar pro meu sócio hoje à noite. Pode mandar tudo por e-mail?" },
  { speaker_id: "p1", speaker: "Yasmin", start: 245, end: 270, text: "Claro, mando ainda hoje. Mando a proposta atualizada com os 2 vídeos extras incluídos no valor combinado e o exemplo de relatório do setor." },
];

const PARTICIPANT_COLORS = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-pink-500", "bg-purple-500"];

export function getParticipantColor(speakerId: string | null): string {
  if (!speakerId) return PARTICIPANT_COLORS[0];
  const idx = speakerId.charCodeAt(speakerId.length - 1) % PARTICIPANT_COLORS.length;
  return PARTICIPANT_COLORS[idx];
}

export const MOCK_MEETING_DETAILS: Record<string, MeetingDetail> = {
  "meet-01": {
    ...MOCK_MEETINGS.find((m) => m.id === "meet-01")!,
    descricao: "Apresentação da proposta consolidada de gestão de redes sociais + produção de conteúdo pro escritório de advocacia Costa & Associados.",
    external_url: "https://meet.google.com/abc-defg-hij",
    participantes: PARTICIPANTES_FIXTURE.meet01,
    recording: {
      id: "rec-01",
      audio_url: "/api/placeholder-audio.mp3",
      video_url: null,
      duracao_segundos: 2820,
      size_bytes: 48_000_000,
      formato: "mp3",
      provider: "recall",
    },
    transcript: {
      texto_completo: TRANSCRIPT_MEET01.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
      segments: TRANSCRIPT_MEET01,
      idioma: "pt-BR",
      provider: "assemblyai",
    },
    summary: {
      resumo_geral:
        "Reunião de apresentação da proposta consolidada pra Costa & Associados. A Yasmin apresentou os 4 pilares (estratégia, conteúdo, tráfego e relatórios) e respondeu às principais dúvidas de Maria Helena (sócia decisora) e Pedro (diretor). Maria Helena demonstrou interesse claro, especialmente quando confirmamos a inclusão de produção de vídeo (2 fixos + flexibilidade pra extras). Maior preocupação dela foi com a qualidade de vídeo — a Yasmin contornou apresentando o histórico de outros clientes do setor jurídico. A reunião terminou com Maria Helena pedindo material consolidado em 24h pra apresentar ao sócio.",
      decisoes: [
        "Plano de 6 meses com 2 vídeos fixos + 2 extras virou a versão padrão da proposta (R$ 3.900/mês total)",
        "Yasmin envia hoje à noite a proposta atualizada + exemplo de relatório do setor jurídico",
        "Decisão de fechamento será comunicada em 24 horas",
      ],
      proximos_passos: [
        "Yasmin: enviar proposta consolidada + exemplo de relatório por e-mail hoje (até 22h)",
        "Maria Helena: apresentar pro sócio hoje à noite",
        "Acompanhamento: Yasmin liga amanhã 14h se não tiver retorno",
      ],
      topicos: [
        { titulo: "Abertura e contexto", start_seconds: 0, end_seconds: 45, resumo: "Yasmin abre a reunião e apresenta a estrutura dos 4 pilares." },
        { titulo: "Produção de vídeo", start_seconds: 45, end_seconds: 150, resumo: "Discussão sobre quantidade de vídeos inclusos. Acordado 2 fixos + extras a R$ 200/peça." },
        { titulo: "Relatórios mensais", start_seconds: 150, end_seconds: 220, resumo: "Maria Helena pediu relatório apresentável pro conselho. Yasmin confirmou dashboard executivo + reunião mensal." },
        { titulo: "Fechamento e próximos passos", start_seconds: 220, end_seconds: 270, resumo: "Combinado envio da proposta hoje à noite e retorno em 24h." },
      ],
      insights: [
        { tipo: "sinal_compra", texto: "Maria Helena pediu fechamento em 24h — sinal forte de intenção", timestamp_segundos: 220, citacao: "A gente precisa fechar em 24 horas. Vou apresentar pro meu sócio hoje à noite." },
        { tipo: "objecao", texto: "Cliente trouxe a memória da agência anterior (qualidade variável). Importante reforçar diferencial na proposta final", timestamp_segundos: 90, citacao: "A gente tava fazendo uns 4 a 5 por mês com a outra agência, mas a qualidade variava muito." },
        { tipo: "oportunidade", texto: "Cliente menciona conselho/sócio — vale enviar uma versão executiva (1 página) da proposta junto", timestamp_segundos: 175, citacao: "Quero algo que eu possa apresentar pro nosso conselho." },
        { tipo: "decisao", texto: "Plano de 6 meses com 4 vídeos/mês ficou como versão oficial da proposta", timestamp_segundos: 105, citacao: "vocês ficariam em R$ 400/mês adicional, dá um total de R$ 3.900" },
      ],
      sentimento_score: 0.72,
      provider: "claude",
      modelo: "claude-sonnet-4-5-20250929",
    },
    extracted_tasks: [
      {
        id: "et-1",
        titulo_sugerido: "Enviar proposta consolidada Costa & Associados (versão 6m + 2 vídeos extras)",
        descricao_sugerida: "Anexar exemplo de relatório do setor jurídico. Prazo: hoje 22h.",
        atribuido_a_sugestao: "user-yasmin",
        atribuido_a_nome: "Yasmin Monteiro",
        due_date_sugestao: new Date(AGORA.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10),
        estado: "aceita",
        task_id: "task-real-001",
        citacao_origem: "Yasmin: Claro, mando ainda hoje. Mando a proposta atualizada com os 2 vídeos extras incluídos…",
        timestamp_origem_segundos: 245,
      },
      {
        id: "et-2",
        titulo_sugerido: "Criar versão executiva 1-pager da proposta pra conselho",
        descricao_sugerida: "Cliente vai apresentar pra conselho — vale ter formato resumido.",
        atribuido_a_sugestao: "user-yasmin",
        atribuido_a_nome: "Yasmin Monteiro",
        due_date_sugestao: new Date(AGORA.getTime() + 18 * 60 * 60 * 1000).toISOString().slice(0, 10),
        estado: "aceita",
        task_id: "task-real-002",
        citacao_origem: "Maria Helena: Quero algo que eu possa apresentar pro nosso conselho.",
        timestamp_origem_segundos: 175,
      },
      {
        id: "et-3",
        titulo_sugerido: "Follow-up ligação amanhã 14h se não houver retorno",
        descricao_sugerida: "Tentativa direta de fechamento.",
        atribuido_a_sugestao: "user-yasmin",
        atribuido_a_nome: "Yasmin Monteiro",
        due_date_sugestao: new Date(AGORA.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        estado: "aceita",
        task_id: "task-real-003",
        citacao_origem: null,
        timestamp_origem_segundos: null,
      },
      {
        id: "et-4",
        titulo_sugerido: "Avaliar parceria com diretor de arte pra reforçar qualidade dos vídeos como diferencial",
        descricao_sugerida: "Cliente trouxe a dor de qualidade variável da agência anterior.",
        atribuido_a_sugestao: null,
        atribuido_a_nome: null,
        due_date_sugestao: null,
        estado: "sugerida",
        task_id: null,
        citacao_origem: "Pedro Costa: a qualidade variava muito",
        timestamp_origem_segundos: 90,
      },
    ],
    processing_jobs: [
      { step: "recording", status: "done", last_error: null, finished_at: rel(1440 * 2 - 50) },
      { step: "transcription", status: "done", last_error: null, finished_at: rel(1440 * 2 - 48) },
      { step: "summarization", status: "done", last_error: null, finished_at: rel(1440 * 2 - 47) },
      { step: "insights", status: "done", last_error: null, finished_at: rel(1440 * 2 - 47) },
      { step: "tasks_extraction", status: "done", last_error: null, finished_at: rel(1440 * 2 - 47) },
      { step: "follow_up", status: "skipped", last_error: null, finished_at: null },
    ],
  },
};

export function getMockMeetingById(id: string): MeetingDetail | null {
  return MOCK_MEETING_DETAILS[id] ?? null;
}
