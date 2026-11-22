import { DollarSign, ShoppingCart, Receipt, Package, TrendingUp, XCircle } from "lucide-react";
import { listVendasYideEcom } from "@/lib/ecommerce/yideecom";
import {
  diasNoPeriodo,
  formatarReais,
  MAX_DIAS_VENDAS,
  opcoesClientes,
  soClientesDaOrg,
  resumirVendas,
  type CanalYideEcom,
} from "@/lib/ecommerce/yideecom-vendas";
import { marketplaceLabel, marketplaceStyle } from "@/lib/ecommerce/marketplaces";
import { FiltroYideEcom } from "./FiltroYideEcom";
import { VendasPorDiaChart } from "./VendasPorDiaChart";
import { AvisoYideEcom } from "./AvisoYideEcom";

interface Props {
  de: string;
  ate: string;
  clienteId: string | null;
  canal: CanalYideEcom | null;
  /** Lucro e tarifas só para a chefia. */
  mostrarLucro: boolean;
  /** Clientes e-commerce desta organização: só eles aparecem. */
  clientesOrg: { nome: string }[];
}

/** Aba Vendas: pedidos do Mercado Livre e da Tray vindos do Yide Ecom. */
export async function VendasYideEcom({ de, ate, clienteId, canal, mostrarLucro, clientesOrg }: Props) {
  const dias = diasNoPeriodo(de, ate);
  if (!Number.isFinite(dias) || dias < 1 || dias > MAX_DIAS_VENDAS) {
    return (
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        Escolha um período de até 3 meses (com &quot;De&quot; antes de &quot;Até&quot;) para ver as vendas.
      </p>
    );
  }
  const res = await listVendasYideEcom(de, ate);
  if (!res.ok) return <AvisoYideEcom erro={res.erro} oQue="as vendas" />;

  const { dados, semCliente } = soClientesDaOrg(res.dados, clientesOrg);
  const clientes = opcoesClientes(dados);
  const cliente = clienteId && clientes.some((c) => c.id === clienteId) ? clienteId : null;
  const r = resumirVendas(dados, { clienteId: cliente, canal }, { de, ate });

  const cards = [
    { label: "Faturamento", value: formatarReais(r.faturamento), icon: DollarSign, destaque: true },
    { label: "Pedidos", value: r.pedidos.toLocaleString("pt-BR"), icon: ShoppingCart },
    { label: "Ticket médio", value: formatarReais(r.ticketMedio), icon: Receipt },
    { label: "Unidades", value: r.unidades.toLocaleString("pt-BR"), icon: Package },
    ...(mostrarLucro ? [{ label: "Lucro estimado", value: formatarReais(r.lucro), icon: TrendingUp }] : []),
    { label: "Cancelados", value: r.cancelados.toLocaleString("pt-BR"), icon: XCircle },
  ];

  return (
    <div className="space-y-5">
      <FiltroYideEcom tab="vendas" clientes={clientes} clienteAtual={cliente} canalAtual={canal} />

      {mostrarLucro && semCliente.length > 0 && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Clientes do Yide Ecom sem cliente e-commerce com o mesmo nome aqui (as vendas deles não aparecem):{" "}
          <span className="font-medium">{semCliente.join(", ")}</span>. Deixe o nome igual nos dois sistemas.
        </p>
      )}
      {r.parcial && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Algum cliente passou de 1.000 pedidos no período: os números dele estão parciais. Diminua o período para ver tudo.
        </p>
      )}
      {r.erros.length > 0 && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não deu para buscar as vendas de:{" "}
          {r.erros.map((e, i) => (
            <span key={`${e.clienteNome}-${e.canal}`}>
              {i > 0 && "; "}
              <span className="font-medium">{e.clienteNome}</span> ({marketplaceLabel(e.canal)}: {e.erro})
            </span>
          ))}
          . Confira a conexão do cliente no Yide Ecom.
        </p>
      )}

      <div className={`grid grid-cols-2 gap-2.5 sm:gap-3 ${mostrarLucro ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`relative overflow-hidden rounded-xl border p-4 ${
                c.destaque ? "border-primary/30 bg-gradient-to-br from-primary/10 to-transparent" : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">{c.label}</p>
                <Icon className={`h-4 w-4 ${c.destaque ? "text-primary" : "text-muted-foreground/70"}`} />
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{c.value}</p>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Faturamento por dia</h2>
        <VendasPorDiaChart dados={r.porDia} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Por cliente</h2>
          {r.porCliente.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum cliente com Mercado Livre ou Tray conectado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Cliente</th>
                    <th className="px-2 py-2 text-right font-medium">Pedidos</th>
                    <th className="px-2 py-2 text-right font-medium">Faturamento</th>
                    <th className="px-2 py-2 text-right font-medium">Ticket</th>
                    {mostrarLucro && <th className="px-4 py-2 text-right font-medium">Lucro</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.porCliente.map((c) => {
                    const s = marketplaceStyle(c.canal);
                    return (
                      <tr key={`${c.clienteId}-${c.canal}`} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium">{c.clienteNome}</div>
                          <span className={`mt-0.5 inline-flex rounded-full border px-1.5 text-[10px] ${s.pill}`}>
                            {marketplaceLabel(c.canal)}
                          </span>
                          {c.erro && <span className="ml-1 text-[10px] text-amber-600">sem dados</span>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{c.pedidos.toLocaleString("pt-BR")}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatarReais(c.faturamento)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatarReais(c.ticketMedio)}</td>
                        {mostrarLucro && <td className="px-4 py-2 text-right tabular-nums">{formatarReais(c.lucro)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Produtos que mais venderam</h2>
          {r.produtos.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma venda no período.</p>
          ) : (
            <ol className="divide-y">
              {r.produtos.map((p, i) => (
                <li key={`${p.clienteNome}-${p.canal}-${p.titulo}-${i}`} className="flex items-start gap-3 px-4 py-2 text-sm">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" title={p.titulo}>{p.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.clienteNome} · {marketplaceLabel(p.canal)} · {p.unidades.toLocaleString("pt-BR")} un.
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums">{formatarReais(p.faturamento)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Pedidos pagos no período, direto do Mercado Livre e da Tray pelo Yide Ecom. Atualiza a cada 10 minutos.
      </p>
    </div>
  );
}
