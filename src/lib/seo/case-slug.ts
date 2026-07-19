import { slugify } from "@/lib/blog/slug";
export function baseSlugCase(cliente: string, segmento: string): string {
  const s = segmento.trim() ? `${cliente} ${segmento}` : cliente;
  return slugify(s);
}
