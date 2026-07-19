// Quem pode gerenciar o blog interno da Yide.
export const ROLES_BLOG = ["adm", "socio", "programacao"];

export function podeGerenciarBlog(role: string): boolean {
  return ROLES_BLOG.includes(role);
}

export const BLOG_STATUS = ["rascunho", "publicado", "arquivado"] as const;
export type BlogStatus = (typeof BLOG_STATUS)[number];
