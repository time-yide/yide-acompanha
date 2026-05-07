"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, string> = {
  criada: "Tarefa criada com sucesso",
  atualizada: "Alterações salvas com sucesso",
};

export function TaskToastFlash() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key) return;
    if (fired.current) return;
    fired.current = true;

    const msg = MESSAGES[key];
    if (msg) toast.success(msg);

    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("toast");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  return null;
}
