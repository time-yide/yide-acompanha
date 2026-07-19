import { describe, it, expect } from "vitest";
import { slugify, slugUnico } from "@/lib/blog/slug";
import { metaDoPost, jsonLdArtigo, stripMarkdown, type PostSeoInput } from "@/lib/blog/seo";

describe("slugify", () => {
  it("remove acento, caixa e especiais; vira hifens", () => {
    expect(slugify("Título de Teste!")).toBe("titulo-de-teste");
    expect(slugify("  IA & Marketing: o futuro  ")).toBe("ia-marketing-o-futuro");
    expect(slugify("Ação/Reação — 2026")).toBe("acaoreacao-2026");
  });
});

describe("slugUnico", () => {
  it("sufixa quando colide", () => {
    const ex = new Set(["post", "post-2"]);
    expect(slugUnico("novo", ex)).toBe("novo");
    expect(slugUnico("post", ex)).toBe("post-3");
  });
  it("base vazia => 'post'", () => {
    expect(slugUnico("", new Set())).toBe("post");
  });
});

const base: PostSeoInput = {
  titulo: "Como a IA muda o marketing",
  resumo: null,
  conteudo_md: "# Título\n\nA **IA** está mudando tudo. Veja [aqui](https://x.com).",
  meta_title: null,
  meta_description: null,
  cover_image_url: null,
  published_at: "2026-07-18T10:00:00.000Z",
  updated_at: "2026-07-18T12:00:00.000Z",
};

describe("metaDoPost", () => {
  it("usa meta quando existe, senão título/resumo/conteúdo", () => {
    expect(metaDoPost({ ...base, meta_title: "SEO Title", meta_description: "SEO desc" }))
      .toEqual({ title: "SEO Title", description: "SEO desc" });
    const semMeta = metaDoPost(base);
    expect(semMeta.title).toBe("Como a IA muda o marketing");
    expect(semMeta.description.length).toBeLessThanOrEqual(155);
    expect(semMeta.description).not.toContain("#");
    expect(semMeta.description).not.toContain("**");
  });
});

describe("stripMarkdown", () => {
  it("tira símbolos, imagens e vira texto de link", () => {
    expect(stripMarkdown("# Oi\n**forte** ![img](u) [texto](l)")).toBe("Oi forte texto");
  });
});

describe("jsonLdArtigo", () => {
  it("monta Article com campos obrigatórios e opcionais", () => {
    const ld = jsonLdArtigo({ ...base, cover_image_url: "https://x/c.jpg", autor_nome: "Ana" }, "https://y/blog/x");
    expect(ld["@type"]).toBe("Article");
    expect(ld.headline).toBe("Como a IA muda o marketing");
    expect(ld.datePublished).toBe("2026-07-18T10:00:00.000Z");
    expect(ld.image).toEqual(["https://x/c.jpg"]);
    expect(ld.author).toEqual({ "@type": "Person", name: "Ana" });
    expect((ld.publisher as { name: string }).name).toBe("Yide Digital");
  });
  it("omite image/author quando não há", () => {
    const ld = jsonLdArtigo(base, "https://y/blog/x");
    expect(ld.image).toBeUndefined();
    expect(ld.author).toBeUndefined();
  });
});
