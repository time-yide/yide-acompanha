"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

const PERIODOS = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "Tudo", value: "0" },
];

export function MotorPeriodoFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = searchParams.get("dias") ?? "30";

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dias", value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1">
      {PERIODOS.map((p) => (
        <button
          key={p.value}
          onClick={() => handleClick(p.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            current === p.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
