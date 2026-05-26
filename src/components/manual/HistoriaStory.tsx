"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

interface Cena {
  numero: string;
  capitulo: string;
  /** Bloco de linhas curtas, renderizadas em sequência com stagger. */
  blocos: ReadonlyArray<string>;
  /** Quando true, último bloco vira citação destacada. */
  quote?: boolean;
  /** Lista vertical animada — pra cena da montagem de funções. */
  lista?: ReadonlyArray<string>;
  /** Visual hint do roteiro original — descritivo, exibido como legenda muted. */
  visual?: string;
}

const CENAS: ReadonlyArray<Cena> = [
  {
    numero: "01",
    capitulo: "O começo",
    blocos: [
      "Tudo começou em 2020.",
      "Dois jovens de 19/20 anos.",
      "Sem estrutura.",
      "Sem escritório.",
      "Sem ideia do que estavam construindo.",
      "E o mais louco: eles nem se conheciam.",
    ],
    visual: "Tela dividida — Lucas e Yasmin trabalhando separados em espaços improvisados.",
  },
  {
    numero: "02",
    capitulo: "A indicação mais aleatória possível",
    blocos: [
      "Lucas estava procurando um gestor de tráfego.",
      "Até que uma indicação inesperada apareceu.",
      "Não veio de empresário.",
      "Não veio de agência.",
      "Nem de networking sofisticado.",
      "Veio de um dono de barraca de lanche.",
    ],
    visual: "Barraca simples de lanche. Clima nostálgico e cinematográfico.",
  },
  {
    numero: "03",
    capitulo: "A call de 5 horas",
    blocos: [
      "A ideia era simples: “Vou contratar ela.”",
      "Mas a call que era pra durar alguns minutos…",
      "durou mais de 5 horas.",
      "Sem nunca terem se visto pessoalmente.",
      "E em algum momento daquela conversa, deixou de parecer uma entrevista.",
      "Parecia que os dois já se conheciam há anos.",
    ],
    visual: "Tela de call, relógio acelerando, energia intensa.",
  },
  {
    numero: "04",
    capitulo: "O primeiro encontro",
    blocos: [
      "Depois daquela call, decidiram se encontrar.",
      "O lugar? Uma cafeteria no Shopping Pantanal.",
      "Um encontro simples.",
      "Sem imaginar o tamanho da história que começaria ali.",
      "Até hoje, toda vez que passam naquele lugar…",
      "lembram exatamente de como tudo começou.",
      "Porque naquela mesa não nasceu só uma parceria.",
      "Nasceu algo que mudaria completamente suas vidas.",
    ],
    visual: "Cafeteria do shopping com clima cinematográfico e emocional.",
  },
  {
    numero: "05",
    capitulo: "O começo da dupla",
    blocos: [
      "A parceria virou amizade.",
      "A amizade virou sociedade.",
      "E a sociedade virou uma construção diária.",
      "Sem glamour. Sem caminho pronto. Só vontade de crescer.",
      "Lucas e Yasmin já foram tudo que você pode imaginar.",
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
      "Realmente… tudo.",
    ],
    visual: "Montagem dinâmica mostrando eles fazendo várias funções.",
  },
  {
    numero: "06",
    capitulo: "O caos",
    blocos: [
      "Nem tudo foi bonito.",
      "Teve medo.",
      "Medo de quebrar. Medo de arriscar. Medo de dar errado.",
      "Teve estrada longa pra captar cliente em outras cidades.",
      "Teve madrugada trabalhando.",
      "Teve fase onde o sonho parecia grande demais.",
    ],
    visual: "Estradas, madrugada, notebooks ligados, cansaço, chuva, tensão.",
  },
  {
    numero: "07",
    capitulo: "A evolução",
    blocos: [
      "Mas eles entenderam uma coisa cedo:",
      "Não dava pra vencer sendo iguais.",
      "Então pegaram os pontos fortes um do outro…",
      "e potencializaram ao máximo.",
      "Enquanto muitos desistiam, eles evoluíam.",
      "Errando. Aprendendo. Tentando de novo.",
    ],
    visual: "Clima de evolução e crescimento.",
  },
  {
    numero: "08",
    capitulo: "O primeiro “escritório”",
    blocos: [
      "O primeiro espaço da Yide?",
      "Uma pequena sala no fundo da padaria dos pais do Lucas.",
      "Mal cabiam 5 pessoas.",
      "Mas sonho grande nunca precisou de espaço grande pra começar.",
    ],
    visual: "Sala apertada, computadores, clima humilde e real.",
  },
  {
    numero: "09",
    capitulo: "O primeiro passo grande",
    blocos: [
      "Depois veio mais um risco.",
      "Uma sala comercial dos pais de um grande amigo: Túlio.",
      "Pegaram duas salas.",
      "E em menos de um mês…",
      "já parecia pequeno demais pros sonhos que tinham.",
    ],
    visual: "Equipe crescendo rapidamente.",
  },
  {
    numero: "10",
    capitulo: "A casa",
    blocos: [
      "Então, numa noite completamente aleatória…",
      "decidiram procurar uma casa.",
      "Rodaram. Rodaram. Rodaram.",
      "E antes mesmo de entrar…",
      "Yasmin falou: “É essa.”",
      "Como se já soubesse.",
      "E realmente era.",
    ],
    visual: "Noite, carro rodando pela cidade, sensação de destino.",
  },
  {
    numero: "11",
    capitulo: "A Yide de hoje",
    blocos: [
      "Hoje, a Yide tem:",
      "+15 colaboradores presenciais.",
      "+5 pessoas no time online.",
      "Muita gente passou por aqui.",
      "Poucas continuaram.",
      "Mas todas deixaram marcas.",
    ],
    visual: "Equipe trabalhando, clima forte de time e construção.",
  },
  {
    numero: "12",
    capitulo: "O que a Yide realmente é",
    blocos: [
      "A Yide nunca foi só uma agência.",
      "Foi construída na coragem. Na tentativa. No risco.",
      "Na velocidade. Na vontade absurda de crescer.",
      "E principalmente…",
      "na ideia de que o medo não serve pra parar alguém.",
      "Serve pra empurrar mais longe.",
    ],
    visual: "Lucas e Yasmin olhando o time trabalhando.",
  },
];

export function HistoriaStory() {
  return (
    <div className="relative -mx-3 overflow-hidden rounded-2xl bg-zinc-950 text-zinc-100 md:-mx-6">
      {/* Glow ambiente — pontos de luz suaves de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_top,theme(colors.primary.DEFAULT)/0.18,transparent_60%),radial-gradient(ellipse_at_bottom,theme(colors.violet.500)/0.10,transparent_60%)]"
      />

      <HeroIntro />

      {CENAS.map((cena) => (
        <Scene key={cena.numero} cena={cena} />
      ))}

      <FinalScene />
    </div>
  );
}

/**
 * Hero de abertura — primeira tela que aparece, ainda sem precisar do
 * scroll. Setup do clima "filme começando".
 */
function HeroIntro() {
  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 py-24 text-center">
      <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
        A história
      </span>
      <h1 className="mt-6 text-5xl font-bold leading-none tracking-tight sm:text-7xl md:text-8xl">
        <span className="block bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
          Yide
        </span>
      </h1>
      <p className="mt-8 max-w-md text-base text-zinc-400">
        Antes de ser empresa, foi escolha. Antes de ser equipe, foi coragem.
        Essa é a história de como a Yide nasceu.
      </p>
      <div className="mt-16 flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
        <ChevronDown className="h-4 w-4 animate-bounce" />
        Role pra começar
      </div>
    </section>
  );
}

/** Cena individual — fade-in + slide-up via IntersectionObserver. */
function Scene({ cena }: { cena: Cena }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // useEffect só roda no client — IntersectionObserver sempre disponível
    // em browsers modernos. Sem fallback necessário.
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

  const blocos = cena.blocos;

  return (
    <section
      ref={ref}
      className="relative flex min-h-[85vh] flex-col justify-center border-t border-zinc-800/60 px-6 py-24 sm:px-12"
    >
      <div className="mx-auto w-full max-w-2xl">
        <div
          className={`mb-10 flex items-baseline gap-4 transition-all duration-1000 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="text-5xl font-bold tracking-tight text-primary/80 tabular-nums sm:text-6xl">
            {cena.numero}
          </span>
          <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
            {cena.capitulo}
          </span>
        </div>

        <div className="space-y-5 text-2xl font-medium leading-snug sm:text-3xl md:text-4xl">
          {blocos.map((b, i) => (
            <p
              key={i}
              className="transition-all duration-700"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(16px)",
                transitionDelay: visible ? `${150 + i * 120}ms` : "0ms",
              }}
            >
              {b}
            </p>
          ))}
        </div>

        {cena.lista && (
          <ul className="mt-8 space-y-2 text-lg font-semibold text-zinc-300 sm:text-xl">
            {cena.lista.map((item, i) => (
              <li
                key={item}
                className="flex items-center gap-3 transition-all duration-700"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateX(0)" : "translateX(-12px)",
                  transitionDelay: visible
                    ? `${150 + (blocos.length + i) * 100}ms`
                    : "0ms",
                }}
              >
                <span className="h-px w-6 bg-primary/60" />
                {item}
              </li>
            ))}
          </ul>
        )}

        {cena.visual && (
          <p
            className="mt-12 max-w-md text-[11px] uppercase tracking-[0.2em] text-zinc-600 transition-opacity duration-700"
            style={{
              opacity: visible ? 1 : 0,
              transitionDelay: visible
                ? `${300 + (blocos.length + (cena.lista?.length ?? 0)) * 100}ms`
                : "0ms",
            }}
          >
            <span className="text-zinc-500">Cena —</span> {cena.visual}
          </p>
        )}
      </div>
    </section>
  );
}

/** Cena final — fechamento com logo + frase. */
function FinalScene() {
  const ref = useRef<HTMLElement>(null);
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
      className="relative flex min-h-[90vh] flex-col items-center justify-center border-t border-zinc-800/60 px-6 py-24 text-center"
    >
      <div
        className={`transition-all duration-[1200ms] ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <Image
          src="/brand/logo-yide.png"
          alt="Yide Digital"
          width={811}
          height={450}
          sizes="180px"
          className="mx-auto h-auto w-32 sm:w-40"
        />
      </div>

      <p
        className="mt-12 text-3xl font-medium tracking-tight sm:text-5xl transition-all duration-1000"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transitionDelay: visible ? "400ms" : "0ms",
        }}
      >
        Essa ainda não é a nossa chegada.
      </p>

      <p
        className="mt-3 text-lg text-zinc-400 sm:text-xl transition-all duration-1000"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transitionDelay: visible ? "700ms" : "0ms",
        }}
      >
        É só o começo da história.
      </p>

      <span
        className="mt-16 text-[10px] uppercase tracking-[0.4em] text-zinc-600 transition-opacity duration-1000"
        style={{
          opacity: visible ? 1 : 0,
          transitionDelay: visible ? "1100ms" : "0ms",
        }}
      >
        — fim do capítulo um —
      </span>
    </section>
  );
}
