"use client";
import Script from "next/script";
import { useEffect } from "react";
import { ehLinkWhatsApp } from "@/lib/site/contato";
import type { TagsSite } from "@/lib/site/tags";
import { CHAVE_CONSENTIMENTO, sinaisConsentimento } from "@/lib/site/consentimento";
import { useConsentimento } from "./useConsentimento";

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

/**
 * Tags de medição do site público com Modo de Consentimento do Google (LGPD): tudo começa
 * negado e só libera quando o visitante aceita no aviso de cookies. Pixel da Meta e pixel do
 * CRM só carregam com aceite. Todo clique em link de WhatsApp conta como conversão (beacon,
 * sem segurar a navegação).
 */
export function SiteTags({ tags }: { tags: TagsSite }) {
  const aceito = useConsentimento() === "aceito";

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || !ehLinkWhatsApp(a.getAttribute("href"))) return;
      try {
        const w = window as unknown as { gtag?: Gtag; fbq?: Fbq };
        w.gtag?.("event", "conversion", { send_to: tags.adsWhatsappSendTo, transport_type: "beacon" });
        if (tags.ga4Id) w.gtag?.("event", "whatsapp_click", { link_url: a.href, page_path: location.pathname, transport_type: "beacon" });
        w.fbq?.("track", "Contact");
      } catch {
        /* tag com problema não pode travar o WhatsApp */
      }
    }
    document.addEventListener("click", aoClicar, { capture: true });
    return () => document.removeEventListener("click", aoClicar, { capture: true });
  }, [tags]);

  const padrao = JSON.stringify({ ...sinaisConsentimento(null), wait_for_update: 500 });
  const aceitoTodos = JSON.stringify(sinaisConsentimento("aceito"));
  const configs = [`gtag('config','${tags.googleAdsId}');`, tags.ga4Id ? `gtag('config','${tags.ga4Id}');` : ""].join("");

  return (
    <>
      <Script id="gtag-consent" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',${padrao});try{if(localStorage.getItem('${CHAVE_CONSENTIMENTO}')==='aceito')gtag('consent','update',${aceitoTodos});}catch(e){}gtag('js',new Date());${configs}`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${tags.googleAdsId}`} strategy="afterInteractive" />
      {aceito && tags.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tags.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {aceito && tags.lyideCompanyId && (
        <Script src={`https://www.lyide.com.br/track.js?c=${encodeURIComponent(tags.lyideCompanyId)}`} strategy="afterInteractive" />
      )}
    </>
  );
}
