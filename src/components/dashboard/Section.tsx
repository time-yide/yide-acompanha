import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  cta?: { href: string; label: string };
  children: React.ReactNode;
}

export function Section({ title, subtitle, cta, children }: Props) {
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {cta && (
          <Link href={cta.href} className="text-xs text-primary hover:underline">
            {cta.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
