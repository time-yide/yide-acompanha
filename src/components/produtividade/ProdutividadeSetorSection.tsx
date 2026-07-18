import type { BlocoSetor, PessoaSetor } from "@/lib/produtividade/setor-metricas-server";

interface Coluna {
  titulo: string;
  valor: (p: PessoaSetor) => string | number;
}

const COLUNAS: Record<string, Coluna[]> = {
  comercial: [
    { titulo: "Ligações", valor: (p) => p.ligacoes_feitas },
    { titulo: "Atendidas", valor: (p) => p.ligacoes_atendidas },
  ],
  ecommerce: [
    { titulo: "Anúncios", valor: (p) => p.anuncios },
  ],
  assessoria: [
    { titulo: "No prazo", valor: (p) => (p.tarefas_com_prazo > 0 ? `${Math.round((p.tarefas_no_prazo / p.tarefas_com_prazo) * 100)}%` : "—") },
    { titulo: "Entregues", valor: (p) => p.tarefas_entregues },
    { titulo: "Atrasadas", valor: (p) => p.tarefas_atrasadas },
    { titulo: "Postagens", valor: (p) => p.postagens },
  ],
  design: [
    { titulo: "Artes", valor: (p) => p.artes },
    { titulo: "No prazo", valor: (p) => (p.tarefas_com_prazo > 0 ? `${Math.round((p.tarefas_no_prazo / p.tarefas_com_prazo) * 100)}%` : "—") },
  ],
  programacao: [
    { titulo: "CRMs", valor: (p) => p.prog_crm },
    { titulo: "Usuários", valor: (p) => p.prog_usuarios },
    { titulo: "Sistemas", valor: (p) => p.prog_sistemas },
    { titulo: "Total", valor: (p) => p.prog_total },
  ],
};

export function ProdutividadeSetorSection({ setores }: { setores: BlocoSetor[] }) {
  if (setores.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Produtividade por setor
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {setores.map((bloco) => {
          const cols = COLUNAS[bloco.setor] ?? [];
          return (
            <div key={bloco.setor} className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {bloco.titulo}
              </div>
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Pessoa</th>
                    {cols.map((c) => (
                      <th key={c.titulo} className="px-4 py-2 text-right font-medium">{c.titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloco.pessoas.map((p) => (
                    <tr key={p.user_id} className="border-t last:border-b-0">
                      <td className="px-4 py-2 text-left truncate">{p.nome}</td>
                      {cols.map((c) => (
                        <td key={c.titulo} className="px-4 py-2 text-right tabular-nums">{c.valor(p)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}
