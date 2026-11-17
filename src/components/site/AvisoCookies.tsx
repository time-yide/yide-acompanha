"use client";
import Link from "next/link";
import { CHAVE_CONSENTIMENTO, EVENTO_CONSENTIMENTO, sinaisConsentimento, type Consentimento } from "@/lib/site/consentimento";
import { useConsentimento } from "./useConsentimento";

type Gtag = (...args: unknown[]) => void;

export function AvisoCookies() {
  const atual = useConsentimento();

  function escolher(c: Consentimento) {
    try { localStorage.setItem(CHAVE_CONSENTIMENTO, c); } catch { /* segue sem salvar */ }
    (window as unknown as { gtag?: Gtag }).gtag?.("consent", "update", sinaisConsentimento(c));
    window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));
  }

  if (atual !== "sem-resposta") return null;
  return (
    <div role="dialog" aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-neutral-950/95 text-white backdrop-blur"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))", paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm text-white/75">
          Usamos cookies para medir as visitas e melhorar nossos anúncios. Você escolhe.{" "}
          <Link href="/politica-de-privacidade" className="font-semibold text-cyan-300 underline-offset-2 hover:underline">Política de privacidade</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => escolher("essencial")}
            className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white/85 hover:border-white/50">Só o essencial</button>
          <button type="button" onClick={() => escolher("aceito")}
            className="rounded-full bg-teal-500 px-5 py-2 text-sm font-semibold text-neutral-950 hover:bg-cyan-400">Aceitar</button>
        </div>
      </div>
    </div>
  );
}
