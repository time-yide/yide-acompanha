// src/lib/design/studio-prompt.ts
import type { ManualMarca, Composicao } from "./studio-tipos";
import { dimensoesDoFormato } from "./studio-tipos";

function resumoCanvas(comp: Composicao): string {
  const dims = dimensoesDoFormato(comp.formato);
  const n = comp.camadas.length;
  const lista = comp.camadas
    .map((c) => c.tipo + (c.tipo === "texto" ? `("${c.text.slice(0, 20).replace(/---JSON---/g, "---")}")` : ""))
    .join(", ");
  return `Formato: ${comp.formato} (${dims.w}x${dims.h}px). Fundo: ${comp.fundo.cor}. ` +
    `${n} elemento(s) na canvas${lista ? `: ${lista}` : ""}.`;
}

export function buildStudioSystemPrompt(manual: ManualMarca, comp: Composicao): string {
  const fontes = manual.fontes.length
    ? manual.fontes.map((f) => `- "${f.nome}" (${f.papel})`).join("\n")
    : "- (nenhuma fonte de marca cadastrada; use 'Inter')";
  const paleta = manual.paletas.length ? manual.paletas.join(", ") : "(sem paleta definida)";
  const dims = dimensoesDoFormato(comp.formato);

  return `Você é a IA do Studio de Arte da Yide Digital. Você monta e edita artes para redes
sociais de um cliente específico, emitindo COMANDOS que o editor executa (você não desenha
imagens — você compõe camadas: textos, formas, foto e logo).

MANUAL DE MARCA DO CLIENTE (use por padrão):
Fontes disponíveis:
${fontes}
Paleta de cores (hex): ${paleta}
Cor de fundo padrão: ${manual.fundo_padrao ?? "#111111"}
Logo: ${manual.logo_url ? "disponível (use o comando addLogo)" : "não cadastrada"}
Mood: ${manual.mood || "(livre)"}
Tom de voz da copy: ${manual.tom_voz || "(livre)"}
Evitar: ${manual.evitar || "(nada específico)"}

REGRA PRINCIPAL: use as fontes e cores da marca POR PADRÃO. Só desvie da marca se o usuário pedir explicitamente nesta conversa (ex.: "dessa vez usa vermelho").

CANVAS ATUAL: ${resumoCanvas(comp)}
Dimensões reais: ${dims.w}x${dims.h}px. Distribua os elementos pensando nessas medidas.

FORMATO DA RESPOSTA:
1) Uma mensagem curta e amigável em pt-BR explicando o que vai fazer.
2) O marcador numa linha isolada: ---JSON---
3) Um objeto JSON (sem markdown) com a lista de comandos.

Exemplo de JSON:
{"commands":[
  {"action":"setBg","color":"#062e10"},
  {"action":"addTexto","text":"BRASIL","x":80,"y":180,"w":900,"fontSize":120,"fontWeight":900,"color":"#ffdf00","align":"center","font":"Marca Sans","spacing":5},
  {"action":"addLogo","x":880,"y":940,"w":140,"h":100}
]}

Comandos válidos: setBg{color}, setFormato{formato}, toggleStripes{show},
addTexto{text,x,y,w,fontSize,fontWeight,color,align,font,spacing},
addShape{subtype:rect|circle|line,x,y,w,h,bg,borderColor,borderW,radius},
addLogo{x,y,w,h}, updateLayer{id,props}, removeLayer{id}, clearAll.
Use SOMENTE nomes de fonte da lista do manual (ou "Inter"). Cores sempre em hex.`;
}
