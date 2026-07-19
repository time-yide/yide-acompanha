"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renderiza markdown com estilo próprio (não depende do plugin typography). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="mb-3 mt-6 text-2xl font-bold tracking-tight" {...p} />,
          h2: (p) => <h2 className="mb-2 mt-6 text-xl font-bold tracking-tight" {...p} />,
          h3: (p) => <h3 className="mb-2 mt-5 text-lg font-semibold" {...p} />,
          p: (p) => <p className="mb-4" {...p} />,
          ul: (p) => <ul className="mb-4 list-disc space-y-1 pl-6" {...p} />,
          ol: (p) => <ol className="mb-4 list-decimal space-y-1 pl-6" {...p} />,
          li: (p) => <li className="marker:text-muted-foreground" {...p} />,
          a: (p) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          blockquote: (p) => <blockquote className="mb-4 border-l-2 border-primary/40 pl-4 italic text-muted-foreground" {...p} />,
          code: (p) => <code className="rounded bg-muted px-1 py-0.5 text-[13px]" {...p} />,
          hr: () => <hr className="my-6 border-border" />,
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          img: (p) => <img className="my-4 rounded-lg border" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
