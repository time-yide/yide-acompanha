import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { TabsNav } from "@/components/prospeccao/TabsNav";

const ALLOWED_ROLES = ["socio", "adm", "comercial"];

export default async function ProspeccaoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Prospecção</h1>
        <p className="text-sm text-muted-foreground">Ferramentas do setor Comercial</p>
      </header>
      <TabsNav />
      <div>{children}</div>
    </div>
  );
}
