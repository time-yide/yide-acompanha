"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  de: string;
  ate: string;
}

export function FiltroPeriodo({ de, ate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "de" | "ate", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="de" className="text-xs">De</Label>
        <Input id="de" type="date" defaultValue={de} onChange={(e) => update("de", e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ate" className="text-xs">Até</Label>
        <Input id="ate" type="date" defaultValue={ate} onChange={(e) => update("ate", e.target.value)} className="h-9" />
      </div>
    </div>
  );
}
