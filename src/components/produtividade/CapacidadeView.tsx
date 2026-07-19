"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { AlertTriangle, Layers, Scale, Users } from "lucide-react";
import type { CapacidadePessoa, GargaloSetor, Concentracao } from "@/lib/produtividade/capacidade";

const SETOR_LABEL: Record<string, string> = {
  comercial: "Comercial", ecommerce: "E-commerce", assessoria: "Assessoria",
  design: "Design", audiovisual: "Audiovisual", programacao: "Programação",
};

// Cor por carga: verde = folga, amarelo = ok, vermelho = sobrecarregado.
function corWip(wip: number): string {
  if (wip >= 8) return "#f43f5e";
  if (wip >= 4) return "#f59e0b";
  return "#10b981";
}

function Bloco({ titulo, icon: Icon, hint, children }: { titulo: string; icon: typeof Layers; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{titulo}</h2>
      </div>
      {hint && <p className="mb-3 text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

export function CapacidadeView({ pessoas, gargalos, concentracao, diasParados }: {
  pessoas: CapacidadePessoa[];
  gargalos: GargaloSetor[];
  concentracao: Concentracao;
  diasParados: number;
}) {
  const cargaData = pessoas.map((p) => ({ nome: p.nome.split(" ")[0], wip: p.wip, entregues: p.entregues }));
  const gargaloData = gargalos.map((g) => ({ setor: SETOR_LABEL[g.setor] ?? g.setor, wip: g.wip }));
  const paradas = pessoas.filter((p) => p.travadas > 0).sort((a, b) => b.travadas - a.travadas);
  const alturaCarga = Math.max(120, cargaData.length * 34);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco titulo="Carga & folga por pessoa" icon={Scale} hint="Trabalho em aberto (WIP) por pessoa. Verde = folga · vermelho = sobrecarregado. Redistribua do vermelho pro verde.">
        {cargaData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ninguém com trabalho em aberto.</p>
        ) : (
          <div style={{ height: alturaCarga }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cargaData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={72} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n) => [v as number, n === "wip" ? "Em aberto" : "Entregues"]}
                />
                <Bar dataKey="wip" radius={[0, 4, 4, 0]}>
                  {cargaData.map((d, i) => <Cell key={i} fill={corWip(d.wip)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Gargalos por setor" icon={Layers} hint="Onde o trabalho empilha. A maior barra é o gargalo que limita o time.">
        {gargaloData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem filas por setor.</p>
        ) : (
          <div style={{ height: Math.max(120, gargaloData.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gargaloData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis type="category" dataKey="setor" width={84} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v as number, "Em aberto"]}
                />
                <Bar dataKey="wip" radius={[0, 4, 4, 0]}>
                  {gargaloData.map((_, i) => <Cell key={i} fill={i === 0 ? "#f43f5e" : "#6366f1"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Bloco>

      <Bloco titulo={`Trabalho parado (${diasParados}+ dias sem avançar)`} icon={AlertTriangle} hint="Tarefas em andamento presas — capacidade travada. Destravar é entrega grátis.">
        {paradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-emerald-500">Nada parado — o time está fluindo.</p>
        ) : (
          <ul className="divide-y">
            {paradas.map((p) => (
              <li key={p.user_id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate font-medium">{p.nome}</span>
                <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-500 tabular-nums">
                  {p.travadas} parada{p.travadas === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Concentração de entregas" icon={Users} hint="Se a produção está concentrada em poucos, o resto tem folga (e é um risco de dependência).">
        {concentracao.topShare === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem entregas no período.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              O top {concentracao.topNomes.length} (<strong>{concentracao.topNomes.join(", ")}</strong>) faz{" "}
              <strong className={concentracao.topShare >= 60 ? "text-rose-500" : "text-foreground"}>{concentracao.topShare}%</strong>{" "}
              das entregas do período.
            </p>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${concentracao.topShare >= 60 ? "bg-rose-500" : "bg-primary"}`}
                style={{ width: `${concentracao.topShare}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {concentracao.topShare >= 60
                ? "Muito concentrado — vale espalhar a carga pra quem tem folga."
                : "Distribuição saudável entre o time."}
            </p>
          </div>
        )}
      </Bloco>
    </div>
  );
}
