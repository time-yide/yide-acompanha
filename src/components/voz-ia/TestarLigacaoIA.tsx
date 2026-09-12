"use client";

import { useState, useTransition } from "react";
import { Phone, Loader2 } from "lucide-react";
import { testarVozIAAction } from "@/lib/voz-ia/actions";

export function TestarLigacaoIA() {
  const [telefone, setTelefone] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleTestar() {
    if (!telefone.trim()) return;
    setResult(null);
    startTransition(async () => {
      const res = await testarVozIAAction(telefone);
      if ("error" in res) {
        setResult({ ok: false, msg: res.error });
      } else {
        setResult({ ok: true, msg: "Ligando pra você agora! Atende o telefone." });
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Phone className="h-4 w-4" /> Testar ligação
      </h2>
      <p className="text-xs text-muted-foreground">
        Coloque seu número pra ouvir como a IA vai falar. Usa o prompt e a voz configurados acima.
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="11999999999"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        />
        <button
          type="button"
          onClick={handleTestar}
          disabled={pending || !telefone.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          {pending ? "Ligando..." : "Testar"}
        </button>
      </div>
      {result && (
        <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
          {result.msg}
        </p>
      )}
    </div>
  );
}
