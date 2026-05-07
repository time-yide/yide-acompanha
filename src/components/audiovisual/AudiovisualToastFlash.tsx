"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function AudiovisualToastFlash() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key) return;
    if (fired.current) return;
    fired.current = true;

    if (key === "entregue") toast.success("Captação entregue com sucesso");

    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("toast");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  return null;
}
