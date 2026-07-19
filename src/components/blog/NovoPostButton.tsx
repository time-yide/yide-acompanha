"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarPostAction } from "@/lib/blog/actions";

export function NovoPostButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function criar() {
    const titulo = window.prompt("Título do post:");
    if (!titulo || !titulo.trim()) return;
    const fd = new FormData();
    fd.set("titulo", titulo.trim());
    start(async () => {
      const r = await criarPostAction(fd);
      if ("error" in r) { window.alert(r.error); return; }
      if (r.id) router.push(`/programacao/blog/${r.id}`);
    });
  }
  return (
    <Button size="sm" onClick={criar} disabled={pending}>
      <Plus className="h-4 w-4" /> Novo post
    </Button>
  );
}
