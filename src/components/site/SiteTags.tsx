"use client";
import Script from "next/script";
import { useEffect } from "react";
import { ehLinkWhatsApp } from "@/lib/site/contato";
import type { TagsSite } from "@/lib/site/tags";

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

/**
 * Tags de medição do site público: Google Ads (+ GA4 se configurado), pixel da Meta
 * e pixel do CRM. Todo clique em link de WhatsApp conta como conversão. O evento vai
 * por beacon e não segura a navegação.
 */
export function SiteTags({ tags }: { tags: TagsSite }) {
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

  const configs = [`gtag('config','${tags.googleAdsId}');`, tags.ga4Id ? `gtag('config','${tags.ga4Id}');` : ""].join("");

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${tags.googleAdsId}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${configs}`}
      </Script>
      {tags.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tags.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {tags.lyideCompanyId && (
        <Script src={`https://www.lyide.com.br/track.js?c=${encodeURIComponent(tags.lyideCompanyId)}`} strategy="afterInteractive" />
      )}
    </>
  );
}
