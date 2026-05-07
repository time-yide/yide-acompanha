"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AREA_FILTERS, AREA_LABELS, AREA_CHIP_CLASSES, type AreaFilter } from "@/lib/painel/area-filter";
import { cn } from "@/lib/utils";

interface Props {
  current: AreaFilter;
}

export function AreaFilterChips({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setArea(area: AreaFilter) {
    const sp = new URLSearchParams(params.toString());
    if (area === "todos") sp.delete("area");
    else sp.set("area", area);
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {AREA_FILTERS.map((a) => {
        const active = current === a;
        return (
          <button
            key={a}
            type="button"
            onClick={() => setArea(a)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
              active
                ? AREA_CHIP_CLASSES[a]
                : "border-muted-foreground/20 bg-muted/40 text-muted-foreground hover:bg-muted/60",
            )}
          >
            {AREA_LABELS[a]}
          </button>
        );
      })}
    </div>
  );
}
