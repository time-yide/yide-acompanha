// IDs das tags de medição do site público. Google Ads tem padrão (conta Yide);
// GA4, pixel da Meta e pixel do CRM só carregam se a variável estiver definida.
export interface TagsSite {
  googleAdsId: string;
  adsWhatsappSendTo: string;
  ga4Id: string | null;
  metaPixelId: string | null;
  lyideCompanyId: string | null;
}

type Env = Record<string, string | undefined>;

function valor(env: Env, chave: string): string | null {
  const v = env[chave]?.trim();
  return v ? v : null;
}

export function lerTags(env: Env): TagsSite {
  return {
    googleAdsId: valor(env, "NEXT_PUBLIC_GOOGLE_ADS_ID") ?? "AW-18562196515",
    adsWhatsappSendTo: valor(env, "NEXT_PUBLIC_ADS_WHATSAPP_SEND_TO") ?? "AW-18562196515/pEfDCJ7KkLQdEKPIkpNF",
    ga4Id: valor(env, "NEXT_PUBLIC_GA4_ID"),
    metaPixelId: valor(env, "NEXT_PUBLIC_META_PIXEL_ID"),
    lyideCompanyId: valor(env, "NEXT_PUBLIC_LYIDE_COMPANY_ID"),
  };
}
