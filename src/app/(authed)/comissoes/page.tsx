import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";

export default async function ComissoesIndexPage() {
  const user = await requireAuth();
  // Financeiro não tem comissão própria: cai direto na visão geral da equipe.
  if (user.role === "socio" || user.role === "financeiro") redirect("/comissoes/visao-geral");
  redirect("/comissoes/minhas");
}
