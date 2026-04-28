import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";

export default async function ComissoesIndexPage() {
  const user = await requireAuth();
  if (user.role === "socio") redirect("/comissoes/visao-geral");
  redirect("/comissoes/minhas");
}
