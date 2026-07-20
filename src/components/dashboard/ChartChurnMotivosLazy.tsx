"use client";

import dynamic from "next/dynamic";
import type { ChurnMotivoPoint } from "@/lib/dashboard/queries";

const ChartChurnMotivos = dynamic(
  () => import("./ChartChurnMotivos").then((m) => ({ default: m.ChartChurnMotivos })),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full animate-pulse rounded-md bg-muted sm:h-64" />,
  },
);

export function ChartChurnMotivosLazy({ data }: { data: ChurnMotivoPoint[] }) {
  return <ChartChurnMotivos data={data} />;
}
