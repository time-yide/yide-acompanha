"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderiza markdown com estilo próprio. `light` = tema claro editorial (post público);
 * sem `light` usa os tokens do app (preview no CMS, tema escuro).
 */
export function Markdown({ children, light = false }: { children: string; light?: boolean }) {
  const base = light ? "text-[1.0625rem] leading-[1.75] text-neutral-800" : "text-[15px] leading-relaxed text-foreground/90";
  const h = light ? "text-neutral-900" : "";
  const linkCls = light ? "text-teal-700 underline underline-offset-2 hover:text-teal-800" : "text-primary underline underline-offset-2";
  const strongCls = light ? "font-semibold text-neutral-900" : "font-semibold text-foreground";
  const quoteCls = light ? "border-teal-500/60 text-neutral-500" : "border-primary/40 text-muted-foreground";
  const codeCls = light ? "bg-neutral-100 text-neutral-800" : "bg-muted";
  const hrCls = light ? "border-neutral-200" : "border-border";
  const font = light ? "[font-family:var(--font-display)]" : "";

  return (
    <div className={base}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className={`mb-4 mt-8 text-3xl font-bold tracking-tight ${font} ${h}`} {...p} />,
          h2: (p) => <h2 className={`mb-3 mt-8 text-2xl font-bold tracking-tight ${font} ${h}`} {...p} />,
          h3: (p) => <h3 className={`mb-2 mt-6 text-xl font-semibold ${font} ${h}`} {...p} />,
          p: (p) => <p className="mb-5" {...p} />,
          ul: (p) => <ul className="mb-5 list-disc space-y-1.5 pl-6" {...p} />,
          ol: (p) => <ol className="mb-5 list-decimal space-y-1.5 pl-6" {...p} />,
          li: (p) => <li {...p} />,
          a: (p) => <a className={linkCls} target="_blank" rel="noopener noreferrer" {...p} />,
          strong: (p) => <strong className={strongCls} {...p} />,
          blockquote: (p) => <blockquote className={`mb-5 border-l-2 pl-4 italic ${quoteCls}`} {...p} />,
          code: (p) => <code className={`rounded px-1 py-0.5 text-[0.9em] ${codeCls}`} {...p} />,
          hr: () => <hr className={`my-8 ${hrCls}`} />,
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          img: (p) => <img className="my-6 rounded-lg" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
