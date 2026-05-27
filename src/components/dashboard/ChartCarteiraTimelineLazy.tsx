"use client";

import dynamic from "next/dynamic";
import type { TimelinePoint } from "@/lib/dashboard/queries";

// recharts é ~110KB gzipped — fica num chunk separado, baixado só
// quando este wrapper hidrata. Em mobile com 4G, evita travar o first
// paint do dashboard.
const ChartCarteiraTimeline = dynamic(
  () => import("./ChartCarteiraTimeline").then((m) => ({ default: m.ChartCarteiraTimeline })),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full animate-pulse rounded-md bg-muted sm:h-64" />,
  },
);

export function ChartCarteiraTimelineLazy({ data }: { data: TimelinePoint[] }) {
  return <ChartCarteiraTimeline data={data} />;
}
