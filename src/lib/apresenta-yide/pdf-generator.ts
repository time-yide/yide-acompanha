// SERVER ONLY: do not import from client components

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

interface GenerateOptions {
  htmlUrl: string;
}

/**
 * Lança Chromium headless, abre a URL passada, gera PDF A4 landscape.
 * Retorna o PDF como Buffer.
 *
 * Importante: em Vercel, `chromium.executablePath()` retorna o binário
 * empacotado pelo @sparticuz/chromium. Em dev local, retorna o do
 * Puppeteer instalado (mais lento de baixar, mas só uma vez).
 */
export async function generatePdfFromUrl(opts: GenerateOptions): Promise<Buffer> {
  const isVercel = !!process.env.VERCEL;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    executablePath: isVercel
      ? await chromium.executablePath()
      : process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(opts.htmlUrl, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });
    // Pequeno settle pra Tailwind CDN aplicar todos os estilos.
    await new Promise((r) => setTimeout(r, 500));

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
