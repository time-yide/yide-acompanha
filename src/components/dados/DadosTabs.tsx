import Link from "next/link";
import { cn } from "@/lib/utils";

export function DadosTabs({ ativa, mostrarProgramacao }: { ativa: "dados" | "programacao"; mostrarProgramacao: boolean }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={cn("border-b-2 px-4 py-2 text-sm", on ? "border-teal-300 text-white" : "border-transparent text-white/50 hover:text-white/80")}>{label}</Link>
  );
  return (
    <nav className="flex border-b border-white/10">
      {tab("/dados", "Visão geral", ativa === "dados")}
      {mostrarProgramacao && tab("/programacao", "Programação", ativa === "programacao")}
    </nav>
  );
}
