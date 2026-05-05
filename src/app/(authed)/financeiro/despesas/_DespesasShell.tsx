"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/components/financeiro/ExpenseForm";

export default function DespesasShell({ children }: { children: React.ReactNode }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Despesas</h2>
          <p className="text-xs text-muted-foreground">Cadastro de despesas fixas e avulsas</p>
        </div>
        <div className="flex gap-2">
          <Link href="/financeiro/despesas/importar">
            <Button variant="outline">Importar em lote</Button>
          </Link>
          <Button onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />Nova despesa
          </Button>
        </div>
      </div>

      {children}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Nova despesa</h3>
            <ExpenseForm onClose={() => setAdding(false)} />
          </div>
        </div>
      )}
    </>
  );
}
