// src/lib/freela-yide/acesso.ts
// Listas de papéis com acesso ao FreelaYide. Compartilhadas entre a página
// principal e a subpágina de lançadas.

export const ROLES_ALLOWED = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "fast_midia", "editor", "audiovisual_chefe",
  "programacao",
];

export const ROLES_GESTAO = ["adm", "socio"];

// Qualquer pessoa que vê o FreelaYide pode lançar. Lançamento de não-gestão
// entra como "pendente" e precisa de aprovação.
export const ROLES_PODE_CRIAR = ROLES_ALLOWED;

// Quem NÃO pega freela: gestão (adm/sócio) + coordenador. Eles gerenciam/
// delegam, não executam — não devem ocupar uma vaga de freela.
export const ROLES_NAO_PEGA = ["adm", "socio", "coordenador"];
