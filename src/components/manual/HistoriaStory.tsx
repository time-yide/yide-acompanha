"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ILUSTRACAO_POR_CENA } from "./HistoriaIlustracoes";

/**
 * Página estilo HQ — painéis com borda preta grossa, balões de fala,
 * caixas de narração, SFX coloridos (POW! BAM!) e textura halftone.
 * Cada painel entra com leve fade-in + scale-in via IntersectionObserver.
 */

interface SFX {
  text: string;
  /** Posição relativa ao painel: top/left/right/bottom em CSS válido. */
  pos: { top?: string; right?: string; bottom?: string; left?: string };
  /** Rotação visual do SFX em graus. */
  rotate: number;
  /** Cor de fundo do badge (cores fortes estilo HQ). */
  tone: "yellow" | "red" | "blue" | "pink";
}

interface Cena {
  numero: string;
  capitulo: string;
  /** Textos narrativos — viram caixinhas amarelas no topo do painel. */
  narracao: ReadonlyArray<string>;
  /** Balão de fala opcional. */
  fala?: { texto: string; por: string };
  /** SFXs (POW!, ZAP!, etc) decorativos. */
  sfx?: ReadonlyArray<SFX>;
  /** Lista vertical com bullets — pra cena de funções. */
  lista?: ReadonlyArray<string>;
  /** Rotação leve do painel inteiro pra dar dinamismo. */
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
      { text: "2020", pos: { top: "-20px", right: "-12px" }, rotate: 8, tone: "yellow" },
    ],
    rotation: -1,
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
      { text: "PLOT!", pos: { top: "-24px", left: "-20px" }, rotate: -12, tone: "red" },
    ],
    rotation: 1,
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
      { text: "TIC-TAC", pos: { top: "-18px", right: "-12px" }, rotate: 6, tone: "blue" },
    ],
    rotation: -0.5,
  },
  {
    numero: "04",
    capitulo: "O primeiro encontro",
    narracao: [
      "Depois daquela call, decidiram se encontrar.",
      "O lugar? Cafeteria no Shopping Pantanal.",
      "Um encontro simples — sem imaginar o tamanho disso.",
      "Naquela mesa não nasceu só uma parceria.",
      "Nasceu algo que mudaria suas vidas.",
    ],
    sfx: [
      { text: "☕", pos: { top: "-30px", left: "-10px" }, rotate: -8, tone: "yellow" },
    ],
    rotation: 0.8,
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
      { text: "TUDO!", pos: { bottom: "-20px", right: "-16px" }, rotate: 14, tone: "pink" },
    ],
    rotation: -1.2,
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
      { text: "BAM!", pos: { top: "-24px", right: "-18px" }, rotate: -10, tone: "red" },
    ],
    rotation: 1.5,
  },
  {
    numero: "07",
    capitulo: "A evolução",
    narracao: [
      "Mas entenderam algo cedo:",
      "Não dava pra vencer sendo iguais.",
      "Pegaram os pontos fortes um do outro…",
      "e potencializaram ao MÁXIMO.",
      "Errando. Aprendendo. Tentando de novo.",
    ],
    sfx: [
      { text: "ZAP!", pos: { top: "-22px", left: "-18px" }, rotate: 10, tone: "yellow" },
    ],
    rotation: -0.8,
  },
  {
    numero: "08",
    capitulo: "O primeiro “escritório”",
    narracao: [
      "O primeiro espaço da Yide?",
      "Uma sala pequena no fundo da padaria dos pais do Lucas.",
      "Mal cabiam 5 pessoas.",
      "Sonho grande nunca precisou de espaço grande pra começar.",
    ],
    sfx: [
      { text: "🍞", pos: { top: "-30px", right: "-8px" }, rotate: 8, tone: "yellow" },
    ],
    rotation: 0.5,
  },
  {
    numero: "09",
    capitulo: "O primeiro passo grande",
    narracao: [
      "Mais um risco.",
      "Sala comercial dos pais do amigo Túlio.",
      "Pegaram DUAS salas.",
      "Em menos de um mês…",
      "já parecia pequeno demais pros sonhos.",
    ],
    sfx: [
      { text: "BOOM!", pos: { bottom: "-18px", right: "-20px" }, rotate: -12, tone: "blue" },
    ],
    rotation: -1,
  },
  {
    numero: "10",
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
      { text: "★", pos: { top: "-26px", left: "-12px" }, rotate: 0, tone: "yellow" },
    ],
    rotation: 1,
  },
  {
    numero: "11",
    capitulo: "A Yide de hoje",
    narracao: [
      "Hoje a Yide tem:",
      "+15 colaboradores presenciais.",
      "+5 pessoas no time online.",
      "Muita gente passou. Poucas continuaram.",
      "Mas todas deixaram marcas.",
    ],
    sfx: [
      { text: "TIME!", pos: { top: "-22px", right: "-14px" }, rotate: -8, tone: "pink" },
    ],
    rotation: -0.6,
  },
  {
    numero: "12",
    capitulo: "O que a Yide realmente é",
    narracao: [
      "A Yide nunca foi só uma agência.",
      "Foi construída na CORAGEM.",
      "Na tentativa. No risco. Na velocidade.",
      "Na vontade absurda de crescer.",
      "Medo não serve pra parar. Serve pra empurrar mais longe.",
    ],
    sfx: [
      { text: "POW!", pos: { bottom: "-22px", left: "-22px" }, rotate: -14, tone: "red" },
    ],
    rotation: 0.9,
  },
];

export function HistoriaStory() {
  return (
    <div className="relative -mx-3 overflow-hidden rounded-2xl border-4 border-black bg-amber-50 text-zinc-900 md:-mx-6">
      {/* Textura halftone — pontinhos pretos sobre o fundo amarelo. Pattern
          tradicional de quadrinho dos anos 60-70. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, #000 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />

      <CoverPanel />

      <div className="relative space-y-12 px-4 py-12 sm:px-8 sm:py-16">
        {CENAS.map((cena, i) => (
          <Panel key={cena.numero} cena={cena} index={i} />
        ))}
      </div>

      <FinalPanel />
    </div>
  );
}

/** Capa estilo HQ: título grande + balão + selo. */
function CoverPanel() {
  return (
    <section className="relative flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative">
        <span className="absolute -top-12 left-1/2 inline-block -translate-x-1/2 rotate-[-6deg] border-2 border-black bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-[3px_3px_0_#000]">
          Edição especial — Vol. 01
        </span>
        <h1 className="text-7xl font-black uppercase leading-none tracking-tight sm:text-9xl">
          <span
            className="block"
            style={{
              WebkitTextStroke: "2px black",
              color: "#fef3c7",
              textShadow: "6px 6px 0 #000",
            }}
          >
            Yide
          </span>
        </h1>
        <p className="mt-6 text-lg font-bold uppercase tracking-wide">
          A história em quadrinhos
        </p>
      </div>

      <SpeechBubble className="mt-10 max-w-md">
        Antes de ser empresa, foi escolha. Antes de ser equipe, foi coragem.
      </SpeechBubble>

      <div className="mt-12 flex flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
        <ArrowDown />
        Vire a página
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
      <article className="relative mx-auto max-w-2xl border-4 border-black bg-white p-6 shadow-[8px_8px_0_#000] sm:p-8">
        {/* Número do painel — selo redondo no canto */}
        <span className="absolute -left-3 -top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-black bg-amber-300 font-black tabular-nums shadow-[3px_3px_0_#000]">
          {cena.numero}
        </span>

        {/* Ilustração SVG da cena — desenho estilo cartoon */}
        <CenaIlustracao numero={cena.numero} />

        {/* Título do capítulo */}
        <h2 className="mb-5 ml-9 text-xs font-black uppercase tracking-[0.2em] text-zinc-700">
          {cena.capitulo}
        </h2>

        {/* Caixas de narração (estilo "MEANWHILE..." dos quadrinhos) */}
        <div className="space-y-3">
          {cena.narracao.map((linha, i) => (
            <div
              key={i}
              className="relative border-2 border-black bg-amber-100 px-3 py-2 transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
                transitionDelay: visible ? `${250 + i * 100}ms` : "0ms",
              }}
            >
              <p className="font-bold leading-snug">{linha}</p>
            </div>
          ))}
        </div>

        {/* Lista (quando tem) — bullets pretos */}
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
                className="flex items-center gap-2 border-2 border-black bg-white px-2 py-1 text-sm font-bold"
              >
                <span className="inline-block h-2 w-2 bg-black" />
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
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              — {cena.fala.por}
            </p>
          </div>
        )}

        {/* SFX flutuantes ao redor do painel — overflow visível pra eles
            "saírem" da borda do painel, estilo gibi mesmo. */}
        {cena.sfx?.map((sfx, i) => (
          <span
            key={i}
            aria-hidden
            className={`pointer-events-none absolute z-10 inline-block whitespace-nowrap border-4 border-black px-3 py-1 text-xs font-black uppercase tracking-wider shadow-[3px_3px_0_#000] transition-all duration-700 sm:text-sm ${sfxToneClass(sfx.tone)}`}
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

/** Painel final — última página com fechamento. */
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
        className="relative border-4 border-black bg-white p-8 shadow-[10px_10px_0_#000] transition-all duration-1000"
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
        <p className="mt-6 text-2xl font-black uppercase leading-tight tracking-tight sm:text-3xl">
          Essa ainda não é
          <br />
          a nossa chegada.
        </p>
        <p className="mt-3 text-base font-bold sm:text-lg">
          É só o começo da história.
        </p>
      </div>

      <span
        className="mt-10 rotate-[-3deg] border-4 border-black bg-red-500 px-4 py-1.5 text-sm font-black uppercase tracking-widest text-white shadow-[4px_4px_0_#000] transition-all duration-1000"
        style={{
          opacity: visible ? 1 : 0,
          transitionDelay: visible ? "500ms" : "0ms",
        }}
      >
        Continua…
      </span>
    </section>
  );
}

/** Balão de fala estilo HQ — retângulo com cantos arredondados + cauda. */
function SpeechBubble({
  children,
  className = "",
  pointing = "down",
}: {
  children: React.ReactNode;
  className?: string;
  pointing?: "left" | "right" | "down";
}) {
  // Cauda dupla (preto atrás, branco na frente) pra parecer outline real.
  const tail =
    pointing === "left"
      ? "before:left-6 before:-bottom-3 before:border-t-[12px] before:border-r-[12px] before:border-r-transparent before:border-t-white after:left-5 after:-bottom-4 after:border-t-[14px] after:border-r-[14px] after:border-r-transparent after:border-t-black"
      : pointing === "right"
        ? "before:right-6 before:-bottom-3 before:border-t-[12px] before:border-l-[12px] before:border-l-transparent before:border-t-white after:right-5 after:-bottom-4 after:border-t-[14px] after:border-l-[14px] after:border-l-transparent after:border-t-black"
        : "before:left-1/2 before:-bottom-3 before:-translate-x-1/2 before:border-t-[12px] before:border-x-[8px] before:border-x-transparent before:border-t-white after:left-1/2 after:-bottom-4 after:-translate-x-1/2 after:border-t-[14px] after:border-x-[10px] after:border-x-transparent after:border-t-black";

  return (
    <div
      className={`relative inline-block rounded-2xl border-4 border-black bg-white px-5 py-3 text-base font-bold shadow-[4px_4px_0_#000] before:absolute before:h-0 before:w-0 after:absolute after:-z-[1] after:h-0 after:w-0 ${tail} ${className}`}
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
    case "yellow":
      return "bg-amber-300 text-black";
    case "red":
      return "bg-red-500 text-white";
    case "blue":
      return "bg-sky-400 text-black";
    case "pink":
      return "bg-pink-400 text-black";
  }
}

/** Renderiza a ilustração SVG da cena dentro de uma "moldura" preta. */
function CenaIlustracao({ numero }: { numero: string }) {
  const Ilustracao = ILUSTRACAO_POR_CENA[numero];
  if (!Ilustracao) return null;
  return (
    <div className="mb-5 overflow-hidden border-4 border-black bg-white">
      <Ilustracao />
    </div>
  );
}
