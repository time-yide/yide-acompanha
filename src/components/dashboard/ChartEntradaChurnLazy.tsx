"use client";

import dynamic from "next/dynamic";
import type { EntradaChurnPoint } from "@/lib/dashboard/queries";

const ChartEntradaChurn = dynamic(
  () => import("./ChartEntradaChurn").then((m) => ({ default: m.ChartEntradaChurn })),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full animate-pulse rounded-md bg-muted sm:h-64" />,
  },
);

export function ChartEntradaChurnLazy({ data }: { data: EntradaChurnPoint[] }) {
  return <ChartEntradaChurn data={data} />;
}
