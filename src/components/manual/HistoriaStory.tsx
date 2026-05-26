"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ILUSTRACAO_POR_CENA } from "./HistoriaIlustracoes";

/**
 * Página estilo quadrinho moderno — painéis arredondados com borda preta
 * fina, sombra na cor primary da Yide (teal #3DC4BC), tipografia limpa
 * e ilustrações SVG cartoon. Fade-in + scale-in via IntersectionObserver.
 */

interface SFX {
  text: string;
  /** Posição relativa ao painel: top/left/right/bottom em CSS válido. */
  pos: { top?: string; right?: string; bottom?: string; left?: string };
  /** Rotação visual do SFX em graus. */
  rotate: number;
  /** Cor de fundo do badge — tons mais modernos e harmoniosos. */
  tone: "primary" | "coral" | "violet" | "sunny";
}

interface Cena {
  numero: string;
  capitulo: string;
  /** Textos narrativos — viram caixinhas com fundo claro no painel. */
  narracao: ReadonlyArray<string>;
  /** Balão de fala opcional. */
  fala?: { texto: string; por: string };
  /** SFXs decorativos. */
  sfx?: ReadonlyArray<SFX>;
  /** Lista — pra cena de funções. */
  lista?: ReadonlyArray<string>;
  /** Rotação leve do painel. */
  rotation: number;
}

const CENAS: ReadonlyArray<Cena> = [
  {
    numero: "01",
    capitulo: "O começo",
    narracao: [
      "Tudo começou em 2020.",
      "Dois jovens de 19/20 anos.",
      "SEM estrutura. SEM escritório. SEM ideia.",
      "E o mais louco: eles nem se conheciam.",
    ],
    sfx: [
      { text: "2020", pos: { top: "-18px", right: "-12px" }, rotate: 6, tone: "sunny" },
    ],
    rotation: -0.8,
  },
  {
    numero: "02",
    capitulo: "A indicação mais aleatória possível",
    narracao: [
      "Lucas estava procurando um gestor de tráfego.",
      "Aí uma indicação inesperada apareceu.",
      "Não veio de empresário. Não veio de agência.",
      "Veio de um dono de barraca de lanche.",
    ],
    sfx: [
      { text: "Plot twist!", pos: { top: "-20px", left: "-16px" }, rotate: -8, tone: "coral" },
    ],
    rotation: 0.8,
  },
  {
    numero: "03",
    capitulo: "A call de 5 horas",
    narracao: [
      "A ideia era simples: contratar.",
      "A call que era pra ser minutos…",
      "DUROU MAIS DE 5 HORAS.",
      "Sem nunca terem se visto pessoalmente.",
    ],
    fala: {
      texto: "Cara… parece que a gente já se conhece há anos.",
      por: "em algum momento daquela call",
    },
    sfx: [
      { text: "tic-tac…", pos: { top: "-16px", right: "-12px" }, rotate: 4, tone: "primary" },
    ],
    rotation: -0.4,
  },
  {
    numero: "04",
    capitulo: "O primeiro encontro",
    narracao: [
      "Depois daquela call, decidiram se encontrar.",
      "O lugar? Cafeteria no Shopping Pantanal.",
      "Um encontro simples, sem imaginar o tamanho disso.",
      "Naquela mesa não nasceu só uma parceria.",
      "Nasceu algo que mudaria suas vidas.",
    ],
    sfx: [
      { text: "☕", pos: { top: "-22px", left: "-10px" }, rotate: -6, tone: "sunny" },
    ],
    rotation: 0.6,
  },
  {
    numero: "05",
    capitulo: "O começo da dupla",
    narracao: [
      "Parceria virou amizade.",
      "Amizade virou sociedade.",
      "Sociedade virou construção diária.",
      "Sem glamour. Sem caminho pronto. Só vontade.",
      "Lucas e Yasmin já foram TUDO:",
    ],
    lista: [
      "Designer",
      "Videomaker",
      "Gestor de tráfego",
      "Editor",
      "Social media",
      "Modelo",
      "Atendimento",
      "Vendedor",
    ],
    sfx: [
      { text: "tudo!", pos: { bottom: "-18px", right: "-14px" }, rotate: 10, tone: "violet" },
    ],
    rotation: -1,
  },
  {
    numero: "06",
    capitulo: "O caos",
    narracao: [
      "Nem tudo foi bonito.",
      "Teve MEDO de quebrar, de arriscar, de dar errado.",
      "Estrada longa pra captar cliente em outras cidades.",
      "Madrugada trabalhando.",
      "Fase onde o sonho parecia grande demais.",
    ],
    sfx: [
      { text: "uff…", pos: { top: "-20px", right: "-16px" }, rotate: -6, tone: "coral" },
    ],
    rotation: 1.2,
  },
  {
    numero: "07",
    capitulo: "O Eduardo",
    narracao: [
      "Antes da virada, teve um anjo no caminho.",
      "Lucas já trabalhava com o Eduardo, dentista bem conhecido na época.",
      "Ele ajudou MUITO na trajetória.",
      "Tanto que no início a Yide focou bastante em odontologia.",
      "Primeiros aprendizados. Erros, acertos.",
      "E o primeiro dindin empresarial veio dali.",
      "Valor que hoje não paga nem um salgado kkk (brincadeira… mas real).",
      "Eduardo é como um anjo na vida dos dois, principalmente do Lucas.",
      "Um grande parceiro.",
    ],
    sfx: [
      { text: "1º cliente", pos: { top: "-18px", left: "-18px" }, rotate: -8, tone: "primary" },
    ],
    rotation: -0.7,
  },
  {
    numero: "08",
    capitulo: "O Ícaro",
    narracao: [
      "Aí veio um amigo doido dos dois.",
      "Ele gostava de acompanhar as viagens só por acompanhar.",
      "Nome: Ícaro.",
      "Reparou que Lucas e Yasmin sozinhos não estavam dando conta.",
    ],
    fala: {
      texto: "Cara… e se eu começar a gravar?",
      por: "Ícaro, com a ideia que mudaria tudo",
    },
    sfx: [
      { text: "click!", pos: { top: "-18px", right: "-12px" }, rotate: 8, tone: "primary" },
    ],
    rotation: 0.7,
  },
  {
    numero: "09",
    capitulo: "A evolução",
    narracao: [
      "Foi assim que veio o primeiro colaborador.",
      "Que a gente ama e odeia ao mesmo tempo kkk (brincadeira).",
      "Mas marcou a Yide pra sempre.",
      "Entenderam algo cedo:",
      "Não dava pra vencer sendo iguais.",
      "Pegaram os pontos fortes um do outro…",
      "e potencializaram ao MÁXIMO.",
      "Sozinhos a gente não chegaria onde queria.",
    ],
    sfx: [
      { text: "level up!", pos: { top: "-18px", left: "-16px" }, rotate: 8, tone: "primary" },
    ],
    rotation: -0.6,
  },
  {
    numero: "10",
    capitulo: "O Rafael",
    narracao: [
      "Pegaram os pontos fortes um do outro e viram:",
      "precisava de MAIS gente.",
      "Como tudo na vida deles, foi aleatório.",
      "Um amigo da Yasmin: Rafael.",
      "Ela só encontrava ele em festas e bebidas.",
      "Yasmin propôs: “Ahh, tem Gestor de Tráfego. Topa?”",
      "“Pagamos R$ 50,00 por conta + um refri kkkk.”",
      "E ele topou. Largou tudo.",
      "Hoje ainda tá aqui com a gente.",
    ],
    fala: {
      texto: "Cara, quero trabalhar de casa. O que vc tem pra mim aí?",
      por: "Rafael, numa festa qualquer",
    },
    sfx: [
      { text: "topou!", pos: { bottom: "-18px", left: "-20px" }, rotate: -10, tone: "violet" },
    ],
    rotation: 0.6,
  },
  {
    numero: "11",
    capitulo: "O primeiro “escritório”",
    narracao: [
      "O primeiro espaço da Yide?",
      "Uma sala pequena no fundo da padaria dos pais do Lucas.",
      "Mal cabiam 5 pessoas.",
      "Sonho grande nunca precisou de espaço grande pra começar.",
    ],
    sfx: [
      { text: "🥖", pos: { top: "-22px", right: "-8px" }, rotate: 6, tone: "sunny" },
    ],
    rotation: 0.4,
  },
  {
    numero: "12",
    capitulo: "O primeiro passo grande",
    narracao: [
      "Mais um risco.",
      "Sala comercial dos pais do amigo Túlio.",
      "Pegaram DUAS salas.",
      "Em menos de um mês…",
      "já parecia pequeno demais pros sonhos.",
    ],
    sfx: [
      { text: "2x", pos: { bottom: "-16px", right: "-16px" }, rotate: -8, tone: "violet" },
    ],
    rotation: -0.8,
  },
  {
    numero: "13",
    capitulo: "A casa",
    narracao: [
      "Uma noite completamente aleatória.",
      "Decidiram procurar uma casa.",
      "Rodaram. Rodaram. Rodaram.",
      "E antes mesmo de entrar…",
    ],
    fala: {
      texto: "É essa.",
      por: "Yasmin, antes de pisar dentro",
    },
    sfx: [
      { text: "★", pos: { top: "-22px", left: "-10px" }, rotate: 0, tone: "sunny" },
    ],
    rotation: 0.8,
  },
  {
    numero: "14",
    capitulo: "A Yide de hoje",
    narracao: [
      "Hoje a Yide tem:",
      "+15 colaboradores presenciais.",
      "+5 pessoas no time online.",
      "Muita gente passou. Poucas continuaram.",
      "Mas todas deixaram marcas.",
    ],
    sfx: [
      { text: "time!", pos: { top: "-20px", right: "-12px" }, rotate: -6, tone: "primary" },
    ],
    rotation: -0.5,
  },
  {
    numero: "15",
    capitulo: "O que a Yide realmente é",
    narracao: [
      "A Yide nunca foi só uma agência.",
      "Foi construída na CORAGEM.",
      "Na tentativa. No risco. Na velocidade.",
      "Na vontade absurda de crescer.",
      "Medo não serve pra parar. Serve pra empurrar mais longe.",
      "Eduardo, Ícaro e Rafael ficam pra sempre registrados aqui.",
      "Esperamos que VOCÊ que está lendo seja o próximo…",
    ],
    sfx: [
      { text: "coragem!", pos: { bottom: "-20px", left: "-18px" }, rotate: -10, tone: "coral" },
    ],
    rotation: 0.7,
  },
];

export function HistoriaStory() {
  return (
    <div className="relative -mx-3 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 via-white to-teal-50 text-slate-900 md:-mx-6">
      {/* Grade sutil de pontos teal — versão clean do halftone clássico */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #3DC4BC 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* Glow ambiente teal nos cantos */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-teal-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-1/3 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl"
      />

      <CoverPanel />

      <div className="relative space-y-14 px-4 py-12 sm:px-8 sm:py-16">
        {CENAS.map((cena, i) => (
          <Panel key={cena.numero} cena={cena} index={i} />
        ))}
      </div>

      <FinalPanel />
    </div>
  );
}

/** Capa moderna: tipografia gigante com gradient teal + selo arredondado. */
function CoverPanel() {
  return (
    <section className="relative flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="inline-block rounded-full border border-slate-900/10 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-teal-700 shadow-sm backdrop-blur">
        Edição especial · Vol. 01
      </span>

      <h1 className="mt-8 text-7xl font-black leading-none tracking-tight sm:text-9xl">
        <span
          className="block bg-gradient-to-br from-teal-400 via-teal-500 to-teal-700 bg-clip-text text-transparent"
          style={{ paintOrder: "stroke fill" }}
        >
          Yide
        </span>
      </h1>
      <p className="mt-6 text-base font-semibold uppercase tracking-[0.2em] text-slate-600 sm:text-lg">
        a história
      </p>

      <SpeechBubble className="mt-10 max-w-md">
        Antes de ser empresa, foi escolha. Antes de ser equipe, foi coragem.
      </SpeechBubble>

      <div className="mt-12 flex flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-teal-700">
        <ArrowDown />
        role pra começar
      </div>
    </section>
  );
}

/** Painel individual de cena. */
function Panel({ cena, index }: { cena: Cena; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? `rotate(${cena.rotation}deg) scale(1)`
          : `rotate(${cena.rotation}deg) scale(0.96)`,
      }}
    >
      <article className="relative mx-auto max-w-2xl overflow-visible rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[10px_10px_0_rgba(61,196,188,0.55)] sm:p-8">
        {/* Selo numerado no canto */}
        <span className="absolute -left-3 -top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-900 bg-teal-400 text-sm font-black tabular-nums text-slate-900 shadow-[2px_2px_0_rgba(15,23,42,1)]">
          {cena.numero}
        </span>

        {/* Ilustração SVG da cena */}
        <CenaIlustracao numero={cena.numero} />

        {/* Título do capítulo */}
        <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.25em] text-teal-700">
          {cena.capitulo}
        </h2>

        {/* Caixas de narração — fundo claro neutro com borda teal */}
        <div className="space-y-3">
          {cena.narracao.map((linha, i) => (
            <div
              key={i}
              className="relative rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
                transitionDelay: visible ? `${250 + i * 100}ms` : "0ms",
              }}
            >
              <p className="text-[15px] font-semibold leading-snug text-slate-800">{linha}</p>
            </div>
          ))}
        </div>

        {/* Lista — chips modernos com fundo teal claro */}
        {cena.lista && (
          <ul
            className="mt-5 grid grid-cols-2 gap-2 transition-opacity duration-700"
            style={{
              opacity: visible ? 1 : 0,
              transitionDelay: visible ? `${250 + cena.narracao.length * 100}ms` : "0ms",
            }}
          >
            {cena.lista.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-full border border-teal-300 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
                {item}
              </li>
            ))}
          </ul>
        )}

        {/* Balão de fala */}
        {cena.fala && (
          <div
            className="mt-6 text-center transition-all duration-700"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(8px)",
              transitionDelay: visible ? `${400 + cena.narracao.length * 100}ms` : "0ms",
            }}
          >
            <SpeechBubble pointing={index % 2 === 0 ? "left" : "right"}>
              {cena.fala.texto}
            </SpeechBubble>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              {cena.fala.por}
            </p>
          </div>
        )}

        {/* SFX flutuantes */}
        {cena.sfx?.map((sfx, i) => (
          <span
            key={i}
            aria-hidden
            className={`pointer-events-none absolute z-10 inline-block whitespace-nowrap rounded-full border-2 border-slate-900 px-3 py-1 text-xs font-black uppercase tracking-wider shadow-[3px_3px_0_rgba(15,23,42,1)] transition-all duration-700 sm:text-sm ${sfxToneClass(sfx.tone)}`}
            style={{
              ...sfx.pos,
              transform: `rotate(${sfx.rotate}deg) scale(${visible ? 1 : 0.5})`,
              opacity: visible ? 1 : 0,
              transitionDelay: visible ? `${500 + cena.narracao.length * 100}ms` : "0ms",
            }}
          >
            {sfx.text}
          </span>
        ))}
      </article>
    </div>
  );
}

/** Painel final — fechamento com logo + frase + selo continua. */
function FinalPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div
        className="relative rounded-3xl border-2 border-slate-900 bg-white p-10 shadow-[12px_12px_0_rgba(61,196,188,0.55)] transition-all duration-1000"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.92)",
        }}
      >
        <Image
          src="/brand/logo-yide.png"
          alt="Yide Digital"
          width={811}
          height={450}
          sizes="180px"
          className="mx-auto h-auto w-32 sm:w-40"
        />
        <p className="mt-8 text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
          Essa ainda não é
          <br />
          a nossa chegada.
        </p>
        <p className="mt-3 bg-gradient-to-r from-teal-500 to-teal-700 bg-clip-text text-base font-bold text-transparent sm:text-lg">
          é só o começo da história.
        </p>
      </div>

      <span
        className="mt-10 rounded-full border-2 border-slate-900 bg-teal-400 px-5 py-1.5 text-xs font-black uppercase tracking-[0.25em] text-slate-900 shadow-[3px_3px_0_rgba(15,23,42,1)] transition-all duration-1000"
        style={{
          opacity: visible ? 1 : 0,
          transitionDelay: visible ? "500ms" : "0ms",
        }}
      >
        continua…
      </span>
    </section>
  );
}

/** Balão de fala moderno — cantos arredondados, borda fina, cauda discreta. */
function SpeechBubble({
  children,
  className = "",
  pointing = "down",
}: {
  children: React.ReactNode;
  className?: string;
  pointing?: "left" | "right" | "down";
}) {
  // Cauda dupla (slate-900 atrás, branco na frente) — fica fina e elegante
  const tail =
    pointing === "left"
      ? "before:left-6 before:-bottom-[7px] before:border-t-[10px] before:border-r-[10px] before:border-r-transparent before:border-t-white after:left-5 after:-bottom-[9px] after:border-t-[12px] after:border-r-[12px] after:border-r-transparent after:border-t-slate-900"
      : pointing === "right"
        ? "before:right-6 before:-bottom-[7px] before:border-t-[10px] before:border-l-[10px] before:border-l-transparent before:border-t-white after:right-5 after:-bottom-[9px] after:border-t-[12px] after:border-l-[12px] after:border-l-transparent after:border-t-slate-900"
        : "before:left-1/2 before:-bottom-[7px] before:-translate-x-1/2 before:border-t-[10px] before:border-x-[7px] before:border-x-transparent before:border-t-white after:left-1/2 after:-bottom-[9px] after:-translate-x-1/2 after:border-t-[12px] after:border-x-[9px] after:border-x-transparent after:border-t-slate-900";

  return (
    <div
      className={`relative inline-block rounded-2xl border-2 border-slate-900 bg-white px-5 py-3 text-base font-semibold text-slate-900 shadow-[4px_4px_0_rgba(15,23,42,0.85)] before:absolute before:h-0 before:w-0 after:absolute after:-z-[1] after:h-0 after:w-0 ${tail} ${className}`}
    >
      {children}
    </div>
  );
}

function ArrowDown() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className="animate-bounce"
      aria-hidden
    >
      <path
        d="M10 3v12m0 0l-5-5m5 5l5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function sfxToneClass(tone: SFX["tone"]): string {
  switch (tone) {
    case "primary":
      return "bg-teal-400 text-slate-900";
    case "coral":
      return "bg-rose-400 text-white";
    case "violet":
      return "bg-violet-400 text-white";
    case "sunny":
      return "bg-amber-300 text-slate-900";
  }
}

/** Renderiza a ilustração SVG da cena dentro de uma moldura arredondada. */
function CenaIlustracao({ numero }: { numero: string }) {
  const Ilustracao = ILUSTRACAO_POR_CENA[numero];
  if (!Ilustracao) return null;
  return (
    <div className="mb-6 overflow-hidden rounded-xl border-2 border-slate-900 bg-white">
      <Ilustracao />
    </div>
  );
}
