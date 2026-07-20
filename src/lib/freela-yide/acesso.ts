// src/lib/freela-yide/acesso.ts
// Listas de papéis com acesso ao FreelaYide. Compartilhadas entre a página
// principal e a subpágina de lançadas.

export const ROLES_ALLOWED = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "fast_midia", "editor", "audiovisual_chefe",
  "programacao",
];

export const ROLES_GESTAO = ["adm", "socio"];

// Quem pode subir/criar freela: gestão + coordenador audiovisual + assessor.
export const ROLES_PODE_CRIAR = ["adm", "socio", "audiovisual_chefe", "assessor"];

// Quem NÃO pega freela: gestão (adm/sócio) + coordenador. Eles gerenciam/
// delegam, não executam — não devem ocupar uma vaga de freela.
export const ROLES_NAO_PEGA = ["adm", "socio", "coordenador"];
