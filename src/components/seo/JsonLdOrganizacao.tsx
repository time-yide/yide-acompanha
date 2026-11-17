import { jsonLdOrganizacao } from "@/lib/seo/schema";

export function JsonLdOrganizacao() {
  // Conteúdo 100% da nossa config; escapa `<` pra impedir quebra de </script>.
  const json = JSON.stringify(jsonLdOrganizacao()).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
