// SERVER ONLY: não importar de client components
import { getDRE } from "./queries";
import { getFluxoCaixa, getMesesComCaixa } from "./caixa";
import { diasNoMes } from "@/lib/painel/stories-queries";

export interface ProjecaoDia {
  dia: number;
  saldo: number;
}

export interface ProjecaoCaixaMes {
  mesRef: string;
  /** Caixa acumulado que entra no mês (dos meses anteriores com dado). */
  saldoInicial: number;
  /** Salários — saem no dia 5. */
  salarios: number;
  /** Demais saídas (despesas, comissões, tráfego) — saem no dia 15 (janela 10–20). */
  outrasSaidas: number;
  /** Recebido + aportes — entram no último dia (clientes pagam no fim do mês). */
  entradas: number;
  dias: ProjecaoDia[];
  /** Menor saldo do mês (o "vale" do giro) e o dia em que acontece. */
  saldoMinimo: number;
  diaMinimo: number;
  saldoFinal: number;
}

const DIA_SALARIOS = 5;
const DIA_CONTAS = 15;

/**
 * Projeção do caixa DENTRO de um mês, respeitando o timing real: salários saem
 * cedo (dia 5), contas no meio (dia 15), e o recebido dos clientes só entra no
 * último dia. Mostra o "vale" (saldo mínimo) — o momento de aperto do giro.
 * saldoInicial é uma estimativa (caixa acumulado do modelo até o mês anterior).
 */
export async function getProjecaoCaixaMes(mesRef: string): Promise<ProjecaoCaixaMes> {
  // Saldo inicial = acumulado até o mês anterior (meses com dado, ordenados).
  const meses = await getMesesComCaixa();
  const anteriores = meses.filter((m) => m < mesRef);
  const serieAnt = anteriores.length ? await getFluxoCaixa(anteriores) : [];
  const saldoInicial = serieAnt.length ? serieAnt[serieAnt.length - 1].saldoAcumulado : 0;

  // O mês em si: recebido/aportes/saídas do fluxo + split de salários via DRE.
  const [pt] = await getFluxoCaixa([mesRef]);
  const dre = await getDRE(mesRef);
  const salarios = dre.salarios;
  const outrasSaidas = Math.max(0, pt.saidas - salarios);
  const entradas = pt.recebido + pt.aportes;

  const nd = diasNoMes(mesRef);
  const dias: ProjecaoDia[] = [];
  let saldo = saldoInicial;
  let saldoMinimo = saldo;
  let diaMinimo = 1;
  for (let d = 1; d <= nd; d++) {
    if (d === DIA_SALARIOS) saldo -= salarios;
    if (d === DIA_CONTAS) saldo -= outrasSaidas;
    if (d === nd) saldo += entradas;
    dias.push({ dia: d, saldo });
    if (saldo < saldoMinimo) {
      saldoMinimo = saldo;
      diaMinimo = d;
    }
  }

  return {
    mesRef,
    saldoInicial,
    salarios,
    outrasSaidas,
    entradas,
    dias,
    saldoMinimo,
    diaMinimo,
    saldoFinal: saldo,
  };
}
