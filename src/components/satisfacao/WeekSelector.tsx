"use client";

import { useRouter } from "next/navigation";

interface Props {
  current: string;
  options: string[];
}

export function WeekSelector({ current, options }: Props) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/satisfacao?semana=${e.target.value}`)}
      className="h-8 rounded-md border bg-card px-2 text-sm"
    >
      {options.map((w) => (
        <option key={w} value={w}>{w}</option>
      ))}
    </select>
  );
}
