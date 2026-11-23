"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { criarFluxoGa4Action, criarGa4Action, gerarVerificacaoGscAction, verificarGscAction } from "@/lib/dados/actions";
import { GA4_PENDENTE, MSG_PLATAFORMA, mensagemVerificacaoDns, plataformaDoSite, snippetGa4 } from "@/lib/dados/site";

interface Props {
  clientId: string;
  siteUrl: string;
  ga4PropertyId: string | null;
  ga4MeasurementId: string | null;
  gscSiteUrl: string | null;
}

function BlocoCopiavel({ texto, rotulo }: { texto: string; rotulo: string }) {
  return (
    <div className="relative rounded-md border border-white/10 bg-black/30">
      <pre className="max-h-48 overflow-x-auto whitespace-pre-wrap break-all p-3 pr-10 text-xs text-white/80">{texto}</pre>
      <button
        type="button" aria-label={rotulo} title={rotulo}
        className="absolute right-2 top-2 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
        onClick={() => { navigator.clipboard.writeText(texto).then(() => toast.success("Copiado"), () => toast.error("Não deu pra copiar")); }}
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Criar GA4 e verificar Search Console pela conta de serviço (só quem edita conexões, só com site cadastrado). */
export function SiteGoogleCard({ clientId, siteUrl, ga4PropertyId, ga4MeasurementId, gscSiteUrl }: Props) {
  const router = useRouter();
  const [measurementId, setMeasurementId] = useState<string | null>(ga4MeasurementId);
  const [verificacao, setVerificacao] = useState<{ dominio: string; nome: string; txt: string } | null>(null);
  const [pendGa4, startGa4] = useTransition();
  const [pendTxt, startTxt] = useTransition();
  const [pendVer, startVer] = useTransition();

  const pendente = measurementId === GA4_PENDENTE;
  const snippet = snippetGa4(measurementId);
  const plataforma = plataformaDoSite(siteUrl);
  const semFluxo = !!ga4PropertyId && !measurementId;
  if (ga4PropertyId && !snippet && !pendente && !semFluxo && gscSiteUrl) return null;

  const criar = (acao: typeof criarGa4Action) => startGa4(async () => {
    const r = await acao(clientId);
    if ("error" in r) { toast.error(r.error); router.refresh(); return; }
    setMeasurementId(r.measurementId);
    toast.success("Google Analytics criado. Agora instale o código no site.");
    router.refresh();
  });

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-medium">Google do site</div>

      {pendente ? (
        <p className="text-xs text-amber-200/80">
          Google Analytics: criando… (atualize em instantes). Se ficar preso, clique em Salvar conexões pra liberar.
        </p>
      ) : !ga4PropertyId && !snippet ? (
        <div className="space-y-2">
          <p className="text-xs text-white/60">Cria uma propriedade do Google Analytics na conta da Yide para o site deste cliente.</p>
          <Button size="sm" disabled={pendGa4} onClick={() => criar(criarGa4Action)}>
            {pendGa4 ? "Criando…" : "Criar Google Analytics"}
          </Button>
        </div>
      ) : semFluxo ? (
        <div className="space-y-2">
          <p className="text-xs text-white/60">A propriedade do Google Analytics existe, mas falta o fluxo do site (é ele que gera o código).</p>
          <Button size="sm" disabled={pendGa4} onClick={() => criar(criarFluxoGa4Action)}>
            {pendGa4 ? "Criando…" : "Criar fluxo do site"}
          </Button>
        </div>
      ) : null}

      {snippet && (
        <div className="space-y-2">
          <p className="text-xs text-white/60">
            Código do Google Analytics ({measurementId}). Cole no &lt;head&gt; do site do cliente (ou envie pra quem cuida do site).
          </p>
          <BlocoCopiavel texto={snippet} rotulo="Copiar código" />
        </div>
      )}

      {!gscSiteUrl && plataforma && (
        <p className="text-xs text-white/60">{MSG_PLATAFORMA}</p>
      )}

      {!gscSiteUrl && !plataforma && (
        <div className="space-y-2">
          {!verificacao ? (
            <>
              <p className="text-xs text-white/60">Gera o registro TXT que o cliente precisa colocar no DNS do domínio dele.</p>
              <Button size="sm" variant="outline" disabled={pendTxt} onClick={() => startTxt(async () => {
                const r = await gerarVerificacaoGscAction(clientId);
                if ("error" in r) { toast.error(r.error); return; }
                setVerificacao({ dominio: r.dominioExibicao, nome: r.nomeRegistro, txt: r.txt });
              })}>{pendTxt ? "Gerando…" : "Gerar verificação do Search Console"}</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-white/60">Mensagem pronta pra enviar ao cliente:</p>
              <BlocoCopiavel texto={mensagemVerificacaoDns(verificacao)} rotulo="Copiar mensagem" />
            </>
          )}
          <div>
            <Button size="sm" variant={verificacao ? "default" : "ghost"} disabled={pendVer} onClick={() => startVer(async () => {
              const r = await verificarGscAction(clientId);
              if ("error" in r) { toast.error(r.error); return; }
              toast.success("Search Console conectado. Clique em Atualizar agora pra ver os dados.");
              setVerificacao(null);
              router.refresh();
            })}>{pendVer ? "Verificando…" : "Já adicionaram — verificar agora"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
