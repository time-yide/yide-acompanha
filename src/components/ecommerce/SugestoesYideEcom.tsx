import { ExternalLink, Lightbulb } from "lucide-react";
import { listSugestoesYideEcom } from "@/lib/ecommerce/yideecom";
import { linkSeguro, opcoesClientes } from "@/lib/ecommerce/yideecom-vendas";
import { FiltroYideEcom } from "./FiltroYideEcom";
import { AvisoYideEcom } from "./AvisoYideEcom";

// Cor por tipo de alerta do Yide Ecom (classes estáticas pro Tailwind enxergar)
const TOM: Record<string, string> = {
  infraction: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  promo_loss: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  fiscal: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
  question: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  catalog_eligible: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  stock: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  price_high: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  competitor: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400",
};
const TOM_PADRAO = "border-zinc-400/25 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300";

function tomNota(nota: number) {
  if (nota < 50) return "text-red-600 dark:text-red-400";
  if (nota < 80) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

/** Aba Sugestões: o que melhorar hoje em cada cliente (alertas e anúncios com nota baixa no ML). */
export async function SugestoesYideEcom({ clienteId }: { clienteId: string | null }) {
  const res = await listSugestoesYideEcom();
  if (!res.ok) return <AvisoYideEcom erro={res.erro} oQue="as sugestões" />;

  const dados = res.dados;
  const clientes = opcoesClientes(dados);
  const cliente = clienteId && clientes.some((c) => c.id === clienteId) ? clienteId : null;
  const lista = dados.filter((c) => !cliente || c.cliente_id === cliente);
  const total = lista.reduce((n, c) => n + c.alertas.reduce((m, a) => m + a.quantidade, 0) + c.anuncios.length, 0);
  const novosHoje = lista.reduce((n, c) => n + c.alertas.reduce((m, a) => m + a.novos_hoje, 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroYideEcom tab="sugestoes" clientes={clientes} clienteAtual={cliente} />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{total.toLocaleString("pt-BR")}</span> sugestões
          {novosHoje > 0 && (
            <>
              {" "}· <span className="font-semibold text-primary tabular-nums">{novosHoje.toLocaleString("pt-BR")}</span> novas hoje
            </>
          )}
        </p>
      </div>

      {lista.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Lightbulb className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nada para melhorar agora</p>
          <p className="text-xs text-muted-foreground">Nenhum alerta aberto e todos os anúncios com nota máxima.</p>
        </div>
      )}

      {lista.map((c) => (
        <section key={c.cliente_id} className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 font-semibold">{c.cliente_nome}</h2>

          {c.alertas.length > 0 && (
            <ul className="divide-y">
              {c.alertas.map((a) => (
                <li key={a.tipo} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TOM[a.tipo] ?? TOM_PADRAO}`}>
                      {a.rotulo}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {a.quantidade.toLocaleString("pt-BR")} {a.quantidade === 1 ? "item" : "itens"}
                    </span>
                    {a.novos_hoje > 0 && (
                      <span className="text-xs font-medium text-primary">{a.novos_hoje} de hoje</span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {a.exemplos.map((e, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{e.titulo}</span>
                          <span className="text-muted-foreground"> — {e.mensagem}</span>
                        </div>
                        {linkSeguro(e.link) && (
                          <a
                            href={linkSeguro(e.link)!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                          >
                            abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </li>
                    ))}
                    {a.quantidade > a.exemplos.length && (
                      <li className="text-xs text-muted-foreground">
                        e mais {(a.quantidade - a.exemplos.length).toLocaleString("pt-BR")} no Yide Ecom
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {c.anuncios.length > 0 && (
            <div className={c.alertas.length > 0 ? "border-t" : ""}>
              <h3 className="px-4 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Anúncios para melhorar (nota de qualidade do ML)
              </h3>
              <ul className="divide-y">
                {c.anuncios.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <span className={`w-9 shrink-0 text-right font-bold tabular-nums ${tomNota(p.nota)}`}>{p.nota}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.titulo}</div>
                      {p.melhorar.length > 0 && (
                        <ul className="mt-0.5 list-disc pl-4 text-xs text-muted-foreground">
                          {p.melhorar.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {linkSeguro(p.link) && (
                      <a
                        href={linkSeguro(p.link)!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                      >
                        anúncio <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        Conferido pelo Yide Ecom a cada 30 minutos. Some sozinho daqui quando o problema é resolvido.
      </p>
    </div>
  );
}
