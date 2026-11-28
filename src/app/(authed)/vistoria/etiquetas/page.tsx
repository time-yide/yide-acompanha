import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireAuth } from "@/lib/auth/session";
import { podeGerenciarVistoria, CATEGORIA_LABEL, type CategoriaEquipamento } from "@/lib/vistoria/core";
import { listEtiquetas } from "@/lib/vistoria/queries";
import { BotaoImprimir } from "@/components/vistoria/BotaoImprimir";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default async function EtiquetasPage() {
  const user = await requireAuth();
  if (!podeGerenciarVistoria(user.role)) notFound();

  const itens = await listEtiquetas();
  const comQr = await Promise.all(
    itens.map(async (it) => ({
      ...it,
      qr: await QRCode.toDataURL(it.codigo, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
    })),
  );

  return (
    <div className="space-y-6">
      {/* Na impressão, sai só a grade de etiquetas (sem menu nem botões). */}
      <style>{`@media print { body * { visibility: hidden !important; } #etiquetas, #etiquetas * { visibility: visible !important; } #etiquetas { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/vistoria" className="text-sm text-primary underline">← Voltar pra Vistoria</Link>
          <h1 className="text-2xl font-bold tracking-tight">Etiquetas QR</h1>
          <p className="text-sm text-muted-foreground">
            {itens.length} etiqueta(s). Imprima e cole o QR em cada equipamento. Equipamentos baixados não entram.
          </p>
        </div>
        <div className="flex gap-2">
          <BotaoImprimir />
          <Link href="/vistoria" className={buttonVariants({ variant: "ghost" })}>Fechar</Link>
        </div>
      </div>

      {comQr.length === 0 ? (
        <p className="text-sm text-muted-foreground print:hidden">Nenhum equipamento cadastrado ainda.</p>
      ) : (
        <div id="etiquetas" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
          {comQr.map((it) => (
            <div key={it.codigo} className="flex flex-col items-center rounded-lg border p-3 text-center print:break-inside-avoid print:border-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.qr} alt={`QR ${it.codigo}`} className="h-32 w-32" />
              <p className="mt-2 font-mono text-sm font-bold">{it.codigo}</p>
              <p className="text-xs leading-tight">{it.nome}</p>
              <p className="text-[10px] text-muted-foreground print:text-black">
                {CATEGORIA_LABEL[it.categoria as CategoriaEquipamento] ?? it.categoria}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
