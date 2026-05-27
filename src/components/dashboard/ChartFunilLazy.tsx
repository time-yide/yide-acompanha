"use client";

import dynamic from "next/dynamic";
import type { FunnelStage } from "@/lib/dashboard/comercial-queries";

const ChartFunil = dynamic(
  () => import("./ChartFunil").then((m) => ({ default: m.ChartFunil })),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full animate-pulse rounded-md bg-muted sm:h-64" />,
  },
);

export function ChartFunilLazy({ data }: { data: FunnelStage[] }) {
  return <ChartFunil data={data} />;
}
