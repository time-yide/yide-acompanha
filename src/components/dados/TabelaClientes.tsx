"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { CANAIS } from "@/lib/dados/tipos";
import type { LinhaDados } from "@/lib/dados/queries";
import { CanalIcone } from "./CanalIcone";
import { NotaBarra } from "./NotaBarra";

export function TabelaClientes({ linhas, mostrarAssessor }: { linhas: LinhaDados[]; mostrarAssessor: boolean }) {
  const [busca, setBusca] = useState("");
  const [assessor, setAssessor] = useState("");
  const [ordem, setOrdem] = useState<"risco" | "az">("risco");
  const [soPerdendo, setSoPerdendo] = useState(false);

  const assessores = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of linhas) if (l.assessorId && l.assessorNome) m.set(l.assessorId, l.assessorNome);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [linhas]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const r = linhas.filter((l) =>
      (!t || l.nome.toLowerCase().includes(t)) &&
      (!assessor || l.assessorId === assessor) &&
      (!soPerdendo || l.perdas.length > 0));
    return r.sort((a, b) => ordem === "az" ? a.nome.localeCompare(b.nome) : (a.nota ?? 101) - (b.nota ?? 101));
  }, [linhas, busca, assessor, ordem, soPerdendo]);

  const sel = "h-9 rounded-md border border-white/15 bg-white/5 px-2 text-sm";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        {mostrarAssessor && (
          <select className={sel} value={assessor} onChange={(e) => setAssessor(e.target.value)} aria-label="Assessor">
            <option value="">Todos assessores</option>
            {assessores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        )}
        <select className={sel} value={ordem} onChange={(e) => setOrdem(e.target.value as "risco" | "az")} aria-label="Ordenar">
          <option value="risco">Mais em risco</option>
          <option value="az">A–Z</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={soPerdendo} onChange={(e) => setSoPerdendo(e.target.checked)} /> Só quem está perdendo
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="w-40 px-4 py-3 text-left">Nota de presença</th>
              <th className="px-4 py-3 text-left">Canais</th>
              <th className="px-4 py-3 text-left">Principal perda</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.clientId} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link href={`/dados/${l.clientId}`} className="font-medium hover:underline">{l.nome}</Link>
                  {l.assessorNome && <div className="text-xs text-white/40">Assessor: {l.assessorNome}</div>}
                </td>
                <td className="px-4 py-3"><NotaBarra nota={l.nota} anterior={l.notaAnterior} /></td>
                <td className="px-4 py-3">
                  {l.canais
                    ? <div className="flex flex-wrap gap-1">{CANAIS.map((c) => <CanalIcone key={c} canal={c} r={l.canais![c]} />)}</div>
                    : <span className="text-xs text-white/40">Calculando…</span>}
                </td>
                <td className="px-4 py-3 text-white/80">{l.perdas[0]?.texto ?? <span className="text-white/40">—</span>}</td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-white/50">Nenhum cliente com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
