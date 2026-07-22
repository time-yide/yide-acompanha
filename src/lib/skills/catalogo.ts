export type FonteSkill = "entregasAudiovisual" | "tarefasConcluidas" | "ligacoesSaida" | "xpGeral";

export interface SkillDef {
  nome: string;
  icone: string; // nome lucide
  fonte: FonteSkill;
}

export const DEGRAUS: Record<FonteSkill, number[]> = {
  entregasAudiovisual: [0, 5, 20, 50, 120],
  tarefasConcluidas: [0, 10, 40, 120, 300],
  ligacoesSaida: [0, 30, 120, 300, 700],
  xpGeral: [0, 15, 50, 120, 300],
};

const AV: FonteSkill = "entregasAudiovisual";
const T: FonteSkill = "tarefasConcluidas";
const L: FonteSkill = "ligacoesSaida";
const X: FonteSkill = "xpGeral";

export const SKILLS_POR_TEMPERAMENTO: Record<string, SkillDef[]> = {
  "Colérico": [ { nome: "Liderança", icone: "Crown", fonte: X }, { nome: "Decisão", icone: "Zap", fonte: X } ],
  "Sanguíneo": [ { nome: "Comunicação", icone: "MessageCircle", fonte: X }, { nome: "Networking", icone: "Users", fonte: X } ],
  "Melancólico": [ { nome: "Qualidade", icone: "Gem", fonte: X }, { nome: "Análise", icone: "Search", fonte: X } ],
  "Fleumático": [ { nome: "Diplomacia", icone: "Handshake", fonte: X }, { nome: "Consistência", icone: "Repeat", fonte: X } ],
};

export const SKILLS_POR_CARGO: Record<string, SkillDef[]> = {
  videomaker: [ { nome: "Gravação", icone: "Video", fonte: AV }, { nome: "Edição", icone: "Scissors", fonte: AV }, { nome: "Enquadramento", icone: "Camera", fonte: AV } ],
  fast_midia: [ { nome: "Stories", icone: "Images", fonte: AV }, { nome: "Captação", icone: "Camera", fonte: AV }, { nome: "Agilidade", icone: "Gauge", fonte: T } ],
  editor: [ { nome: "Edição", icone: "Scissors", fonte: T }, { nome: "Montagem", icone: "Film", fonte: T }, { nome: "Ritmo", icone: "AudioLines", fonte: T } ],
  designer: [ { nome: "Design", icone: "PenTool", fonte: T }, { nome: "Identidade Visual", icone: "Palette", fonte: T }, { nome: "Composição", icone: "LayoutGrid", fonte: T } ],
  assessor: [ { nome: "Relacionamento", icone: "HeartHandshake", fonte: T }, { nome: "Estratégia", icone: "Target", fonte: T }, { nome: "Atendimento", icone: "Headphones", fonte: T } ],
  comercial: [ { nome: "Prospecção", icone: "Radar", fonte: L }, { nome: "Negociação", icone: "Handshake", fonte: L }, { nome: "Fechamento", icone: "BadgeCheck", fonte: L } ],
  coordenador: [ { nome: "Gestão", icone: "ClipboardList", fonte: T }, { nome: "Coordenação", icone: "Network", fonte: T }, { nome: "Visão", icone: "Eye", fonte: X } ],
  audiovisual_chefe: [ { nome: "Gestão", icone: "ClipboardList", fonte: T }, { nome: "Coordenação", icone: "Network", fonte: T }, { nome: "Visão", icone: "Eye", fonte: X } ],
  socio: [ { nome: "Gestão", icone: "ClipboardList", fonte: T }, { nome: "Liderança", icone: "Crown", fonte: X }, { nome: "Visão", icone: "Eye", fonte: X } ],
  adm: [ { nome: "Gestão", icone: "ClipboardList", fonte: T }, { nome: "Liderança", icone: "Crown", fonte: X }, { nome: "Visão", icone: "Eye", fonte: X } ],
  programacao: [ { nome: "Código", icone: "Code2", fonte: T }, { nome: "Automação", icone: "Cpu", fonte: T }, { nome: "Lógica", icone: "Binary", fonte: T } ],
  assessor_ecommerce: [ { nome: "E-commerce", icone: "ShoppingCart", fonte: T }, { nome: "Anúncios", icone: "Megaphone", fonte: T }, { nome: "Operação", icone: "Settings", fonte: T } ],
  assistente_ecommerce: [ { nome: "E-commerce", icone: "ShoppingCart", fonte: T }, { nome: "Anúncios", icone: "Megaphone", fonte: T }, { nome: "Operação", icone: "Settings", fonte: T } ],
};
