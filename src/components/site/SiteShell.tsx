import { display, sans } from "@/fonts";
import { JsonLdOrganizacao } from "@/components/seo/JsonLdOrganizacao";
import { lerTags } from "@/lib/site/tags";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { SiteTags } from "./SiteTags";
import { WhatsAppFlutuante } from "./WhatsAppFlutuante";

/** Moldura única das páginas públicas: cabeçalho, rodapé, WhatsApp, tags e JSON-LD da Yide. */
export function SiteShell({ children, conteudoLargo = false }: { children: React.ReactNode; conteudoLargo?: boolean }) {
  const tags = lerTags(process.env);
  return (
    <div className={`${display.variable} ${sans.variable} min-h-screen bg-[#faf9f7] text-neutral-900 antialiased [font-family:var(--font-sans-blog)] [color-scheme:light]`}>
      <JsonLdOrganizacao />
      <SiteTags tags={tags} />
      <SiteHeader />
      {conteudoLargo ? <main>{children}</main> : <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">{children}</main>}
      <SiteFooter />
      <WhatsAppFlutuante />
    </div>
  );
}
