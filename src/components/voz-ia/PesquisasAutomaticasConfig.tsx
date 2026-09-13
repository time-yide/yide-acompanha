"use client";

import { useEffect, useState } from "react";

interface PesquisaAuto {
  id: string;
  nicho: string;
  cidade: string;
  quantidade: number;
  ativo: boolean;
  ultima_execucao: string | null;
  total_leads_gerados: number;
}

export function PesquisasAutomaticasConfig() {
  const [items, setItems] = useState<PesquisaAuto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [quantidade, setQuantidade] = useState(20);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/pesquisa-automatica")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleAdd() {
    if (!nicho.trim() || !cidade.trim()) return;
    setAdding(true);
    const resp = await fetch("/api/pesquisa-automatica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nicho: nicho.trim(), cidade: cidade.trim(), quantidade }),
    });
    if (resp.ok) {
      const created = await resp.json();
      setItems([...items, {
        id: created.id,
        nicho: nicho.trim(),
        cidade: cidade.trim(),
        quantidade,
        ativo: true,
        ultima_execucao: null,
        total_leads_gerados: 0,
      }]);
      setNicho("");
      setCidade("");
      setQuantidade(20);
    }
    setAdding(false);
  }

  async function handleRemove(id: string) {
    await fetch(`/api/pesquisa-automatica?id=${id}`, { method: "DELETE" });
    setItems(items.filter((i) => i.id !== id));
  }

  async function handleToggle(id: string, ativo: boolean) {
    await fetch("/api/pesquisa-automatica", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ativo }),
    });
    setItems(items.map((i) => (i.id === id ? { ...i, ativo } : i)));
  }

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Pesquisas Automáticas</h3>
      <p className="text-xs text-muted-foreground">
        O sistema busca leads novos todo dia de manhã pra cada nicho + cidade abaixo.
      </p>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded border p-2 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={item.ativo}
                  onChange={(e) => handleToggle(item.id, e.target.checked)}
                  className="rounded"
                />
              </label>
              <span className={`font-medium ${item.ativo ? "" : "text-muted-foreground line-through"}`}>
                {item.nicho}
              </span>
              <span className="text-muted-foreground">em</span>
              <span className={item.ativo ? "" : "text-muted-foreground line-through"}>
                {item.cidade}
              </span>
              <span className="text-muted-foreground">({item.quantidade}/dia)</span>
              {item.ultima_execucao && (
                <span className="text-muted-foreground">
                  Última: {new Date(item.ultima_execucao).toLocaleDateString("pt-BR")} ({item.total_leads_gerados} novos)
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="ml-auto text-red-500 hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">Nicho</label>
          <input
            type="text"
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
            placeholder="Ex: energia solar"
            className="w-40 rounded border bg-background px-2 py-1 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Cidade</label>
          <input
            type="text"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Cuiabá"
            className="w-40 rounded border bg-background px-2 py-1 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Qtd/dia</label>
          <input
            type="number"
            min={1}
            max={500}
            value={quantidade}
            onChange={(e) => setQuantidade(parseInt(e.target.value) || 20)}
            className="w-16 rounded border bg-background px-2 py-1 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !nicho.trim() || !cidade.trim()}
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {adding ? "Adicionando..." : "+ Adicionar"}
        </button>
      </div>
    </div>
  );
}
