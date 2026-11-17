"use client";
import { useRef } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useRevealOnView } from "./useRevealOnView";

interface PostItem {
  slug: string;
  titulo: string;
  resumo: string | null;
  cover_image_url: string | null;
}

export function BlogDestaque({ posts }: { posts: PostItem[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnView(rootRef, "[data-post]");
  if (posts.length === 0) return null;

  return (
    <section id="blog" className="bg-[#faf9f7]">
      <div ref={rootRef} className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-600">Blog do empresário</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 [font-family:var(--font-display)] sm:text-4xl">
              Para quem é dono de empresa e quer vender mais
            </h2>
          </div>
          <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700">
            Ver todos os artigos <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.slug}
              data-post
              href={`/blog/${p.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_18px_50px_-20px_rgba(13,148,136,0.35)]"
            >
              <div className="overflow-hidden bg-neutral-100">
                {p.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover_image_url} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                ) : (
                  <div className="aspect-[16/10] w-full bg-gradient-to-br from-teal-50 to-neutral-100" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-semibold leading-snug tracking-tight text-neutral-900 [font-family:var(--font-display)] group-hover:text-teal-700">{p.titulo}</h3>
                {p.resumo && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-500">{p.resumo}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
