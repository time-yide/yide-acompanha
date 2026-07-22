"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ConquistaNova } from "@/lib/conquistas/actions";

export function ConquistaToast({ novas }: { novas: ConquistaNova[] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || novas.length === 0) return;
    done.current = true;
    for (const n of novas) {
      toast.success(`Conquista desbloqueada: ${n.titulo}!`, { icon: "🏆", duration: 6000 });
    }
  }, [novas]);
  return null;
}
