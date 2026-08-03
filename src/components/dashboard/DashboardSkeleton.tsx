import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto da home mostrado ENQUANTO o dashboard do papel carrega. Aparece
 * na hora (streaming via <Suspense> em app/(authed)/page.tsx), então o celular
 * vê o "Olá" + placeholders em vez de tela branca por ~3s (melhora FCP/LCP).
 * Mantém a saudação real pra não dar "flash" quando o conteúdo chega.
 */
export function DashboardSkeleton({ nome }: { nome: string }) {
  const primeiroNome = nome.split(" ")[0];
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Carregando seu painel…</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
