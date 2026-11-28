"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** Recebe o texto cru do QR (o servidor normaliza). */
  onCode: (texto: string) => void;
}

/**
 * Câmera traseira via html5-qrcode (funciona no iPhone e no Android, ao contrário
 * do BarcodeDetector). Carregada sob demanda pra não pesar a página.
 * Tem campo de digitação como plano B (câmera negada, código rasgado).
 */
export function QrScanner({ onCode }: Props) {
  const regionId = `qr-${useId().replace(/:/g, "")}`;
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let cancelado = false;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelado) return;
        const qr = new Html5Qrcode(regionId);
        scanner = qr;
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (texto) => onCodeRef.current(texto),
          () => {},
        );
      } catch {
        if (!cancelado) {
          setErroCamera("Não consegui abrir a câmera. Permita o acesso nas configurações do navegador ou digite o código abaixo.");
        }
      }
    })();

    return () => {
      cancelado = true;
      if (scanner) {
        const s = scanner;
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {
              // já limpo
            }
          });
      }
    };
  }, [regionId]);

  return (
    <div className="space-y-3">
      <div id={regionId} className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-black" />
      {erroCamera && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{erroCamera}</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!manual.trim()) return;
          onCode(manual.trim());
          setManual("");
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Ou digite o código (ex: YD-7K3QP2)"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <Button type="submit" variant="outline">Confirmar</Button>
      </form>
    </div>
  );
}
