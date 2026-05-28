// src/components/briefing/BriefingPrintView.tsx
import QRCode from "qrcode";
import type { BriefingPrintData } from "@/lib/briefing-gravacao/tipos";
import { PrintButton } from "./PrintButton";

interface Props {
  data: BriefingPrintData;
}

async function qrPngDataUrl(text: string): Promise<string> {
  // PNG data URL via <img> — safe, no raw HTML injection needed.
  return QRCode.toDataURL(text, { margin: 0, width: 280 });
}

function fmtData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function BriefingPrintView({ data }: Props) {
  const qrDataUrl = data.mapsUrl ? await qrPngDataUrl(data.mapsUrl) : null;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[210mm] bg-white p-8 text-black print:p-0">
        <div className="no-print mb-4 flex justify-end">
          <PrintButton />
        </div>

        <header className="border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">BRIEFING DE GRAVAÇÃO</h1>
          <p className="text-sm text-gray-600">Yide</p>
        </header>

        <section className="mt-5 space-y-2 text-sm">
          <div>
            <span className="font-semibold">Cliente:</span>{" "}
            {data.clienteNome ?? "—"}
          </div>
          <div>
            <span className="font-semibold">Data/Hora:</span> {fmtData(data.inicio)}
          </div>
          <div>
            <span className="font-semibold">Endereço:</span>{" "}
            {data.endereco ?? "(não informado)"}
          </div>
        </section>

        {qrDataUrl && (
          <section className="mt-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR code do Google Maps" width={140} height={140} />
            <p className="text-xs text-gray-700">
              Scaneie pra abrir o local no Google Maps
            </p>
          </section>
        )}

        {data.observacoes && (
          <section className="mt-6">
            <h2 className="border-b border-black text-sm font-bold uppercase">
              Observações da gravação
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {data.observacoes}
            </p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="border-b border-black text-sm font-bold uppercase">
            Roteiro
          </h2>
          {data.roteiroUrl ? (
            <p className="mt-2 text-sm">
              {data.roteiroTipo === "pdf"
                ? "PDF do roteiro: "
                : "Roteiro em: "}
              <a
                href={data.roteiroUrl}
                className="break-all text-blue-700 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {data.roteiroUrl}
              </a>
            </p>
          ) : (
            <p className="mt-2 text-sm italic text-gray-600">
              (Sem roteiro anexado)
            </p>
          )}
        </section>

        <footer className="mt-10 border-t pt-3 text-xs text-gray-500">
          Gerado em {new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })}{" "}
          por {data.geradoPorNome}
        </footer>
      </div>
    </>
  );
}
