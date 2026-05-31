"use client";

import { useState } from "react";
import { Phone, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Discador rápido sem dependência de provedor: abre o discador do aparelho
 * (tel:) ou o WhatsApp (wa.me) com o número preenchido. Funciona na hora,
 * sem configurar Zenvia. O webphone da Zenvia (ligar pelo computador) é o
 * upgrade, renderizado pelo componente Discador quando a conta estiver pronta.
 */
export function DiscadorRapido() {
  const [numero, setNumero] = useState("");
  const tel = numero.replace(/[^\d+]/g, "");
  const wa = numero.replace(/\D/g, "");
  const telValido = tel.replace(/\D/g, "").length >= 8;
  const waValido = wa.length >= 8;

  function ligar() {
    if (!telValido) return;
    window.location.href = `tel:${tel}`;
  }
  function whats() {
    if (!waValido) return;
    window.open(`https://wa.me/${wa}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Phone className="h-3.5 w-3.5 text-blue-500" /> Discar
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="tel"
          inputMode="tel"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="+55 11 99999-9999"
          className="sm:max-w-xs"
          onKeyDown={(e) => { if (e.key === "Enter") ligar(); }}
        />
        <div className="flex gap-2">
          <Button type="button" onClick={ligar} disabled={!telValido}>
            <Phone className="h-4 w-4" /> Ligar
          </Button>
          <Button type="button" variant="outline" onClick={whats} disabled={!waValido}>
            <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Abre o discador do seu aparelho. A ligação pelo computador (Zenvia) aparece aqui quando a conta estiver configurada.
      </p>
    </div>
  );
}
