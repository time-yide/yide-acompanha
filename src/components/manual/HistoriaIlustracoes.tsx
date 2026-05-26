// src/components/manual/HistoriaIlustracoes.tsx
//
// Ilustrações SVG inline estilo cartoon (Turma da Mônica vibes) pra cada
// cena da história da Yide. Tudo SVG vetorial — sem assets externos.
// Personagens são bonecos simplificados: cabeça grande, corpo pequeno,
// linhas pretas grossas, cores chapadas.
//
// Convenção:
// - Lucas: cabelo curto castanho, camisa azul
// - Yasmin: cabelo longo escuro com franja, camisa rosa
// - Linhas: 3px preto, bordas marcadas
// - Cores: paleta forte (amarelo, vermelho, azul, verde)

import type { ReactNode } from "react";

// Paleta moderna alinhada com a identidade Yide.
// Stroke: slate-900 (mais suave que preto puro).
// Lucas: camisa teal (cor primary da Yide).
// Yasmin: camisa coral (acento moderno harmonioso com teal).
const STROKE = "#0f172a";
const STROKE_W = 2.5;
const PELE = "#fde2c6";
const CABELO_LUCAS = "#4a3220";
const CABELO_YASMIN = "#1f1610";
const CAMISA_LUCAS = "#3DC4BC";
const CAMISA_YASMIN = "#fb7185";

// Cores de cenário modernas (paleta clean)
const BG_SOFT_TEAL = "#ccfbf1";
const BG_SOFT_CORAL = "#ffe4e6";
const BG_SOFT_VIOLET = "#ede9fe";
const BG_SOFT_AMBER = "#fef3c7";
const BG_NIGHT = "#1e293b";
const ACCENT_TEAL = "#3DC4BC";
const ACCENT_CORAL = "#fb7185";
const ACCENT_AMBER = "#fbbf24";
const ACCENT_VIOLET = "#a78bfa";

interface IlustracaoProps {
  className?: string;
}

/** Wrapper padrão pros SVGs — viewBox 200x140, mantém aspect ratio. */
function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={`block h-auto w-full ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

// Cores extras pra modernizar (sombras, blush, highlights)
const BLUSH = "#fda4af";
const CALCA = "#1e293b";
const SAPATO = "#334155";

/** Boneco Lucas modernizado — cabeça grande, blush, olhos brilhantes,
 *  braços visíveis. Centro = origem (cabeça em y=0). */
function Lucas({ x, y, scale = 1, flip = false }: { x: number; y: number; scale?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${flip ? -scale : scale},${scale})`}>
      {/* Cabelo - silhueta arredondada moderna */}
      <path d="M -11 -3 Q -12 -14 -2 -16 Q 11 -17 12 -6 L 12 -2 Q 8 -5 4 -4 Q 0 -6 -4 -4 Q -8 -5 -11 -2 Z" fill={CABELO_LUCAS} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Cabeça - mais redonda */}
      <circle cx="0" cy="0" r="10" fill={PELE} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Orelhas */}
      <ellipse cx="-10" cy="1" rx="1.5" ry="2.5" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="10" cy="1" rx="1.5" ry="2.5" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Bochechas (blush) */}
      <ellipse cx="-5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      <ellipse cx="5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      {/* Olhos com brilho */}
      <circle cx="-3.5" cy="-1" r="1.6" fill={STROKE} />
      <circle cx="-3" cy="-1.5" r="0.5" fill="#fff" />
      <circle cx="3.5" cy="-1" r="1.6" fill={STROKE} />
      <circle cx="4" cy="-1.5" r="0.5" fill="#fff" />
      {/* Sorriso */}
      <path d="M -3 4 Q 0 6.5 3 4" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Pescoço */}
      <rect x="-2" y="9" width="4" height="3" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Corpo (camiseta) com gola */}
      <path d="M -8 12 Q -9 14 -9 17 L -9 24 L 9 24 L 9 17 Q 9 14 8 12 Q 4 14 0 14 Q -4 14 -8 12 Z" fill={CAMISA_LUCAS} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Braços */}
      <path d="M -9 13 Q -13 18 -12 23" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <path d="M 9 13 Q 13 18 12 23" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      {/* Mãos */}
      <circle cx="-12" cy="23" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      <circle cx="12" cy="23" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Calça */}
      <rect x="-7" y="24" width="14" height="7" fill={CALCA} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Pernas + sapato */}
      <line x1="-4" y1="31" x2="-4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <line x1="4" y1="31" x2="4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="-4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
    </g>
  );
}

/** Boneca Yasmin modernizada. */
function Yasmin({ x, y, scale = 1, flip = false }: { x: number; y: number; scale?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${flip ? -scale : scale},${scale})`}>
      {/* Cabelo longo atrás (envolve a cabeça e desce até os ombros) */}
      <path d="M -12 -3 Q -14 8 -11 16 L 11 16 Q 14 8 12 -3 Q 11 -16 0 -17 Q -11 -16 -12 -3 Z" fill={CABELO_YASMIN} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Brilho/highlight no cabelo */}
      <path d="M -8 -10 Q -3 -14 3 -13" stroke="#4a3128" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7" />
      {/* Cabeça */}
      <circle cx="0" cy="0" r="10" fill={PELE} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Franja arredondada */}
      <path d="M -10 -4 Q -8 -11 0 -11 Q 8 -11 10 -4 L 8 -1 Q 4 -4 0 -3 Q -4 -4 -8 -1 Z" fill={CABELO_YASMIN} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Orelhas (com brinquinhos) */}
      <ellipse cx="-10" cy="2" rx="1.3" ry="2.2" fill={PELE} stroke={STROKE} strokeWidth="1.2" />
      <ellipse cx="10" cy="2" rx="1.3" ry="2.2" fill={PELE} stroke={STROKE} strokeWidth="1.2" />
      <circle cx="-10" cy="4.5" r="1" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="1" />
      <circle cx="10" cy="4.5" r="1" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="1" />
      {/* Bochechas */}
      <ellipse cx="-5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.7" />
      <ellipse cx="5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.7" />
      {/* Olhos com brilho e cílios */}
      <circle cx="-3.5" cy="0" r="1.8" fill={STROKE} />
      <circle cx="-3" cy="-0.5" r="0.5" fill="#fff" />
      <line x1="-5" y1="-1.5" x2="-5.5" y2="-2.5" stroke={STROKE} strokeWidth="1" strokeLinecap="round" />
      <circle cx="3.5" cy="0" r="1.8" fill={STROKE} />
      <circle cx="4" cy="-0.5" r="0.5" fill="#fff" />
      <line x1="5" y1="-1.5" x2="5.5" y2="-2.5" stroke={STROKE} strokeWidth="1" strokeLinecap="round" />
      {/* Sorriso */}
      <path d="M -3 5 Q 0 7 3 5" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Pescoço */}
      <rect x="-2" y="9" width="4" height="3" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Corpo (camiseta) */}
      <path d="M -8 12 Q -9 14 -9 17 L -9 24 L 9 24 L 9 17 Q 9 14 8 12 Q 4 14 0 14 Q -4 14 -8 12 Z" fill={CAMISA_YASMIN} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Braços */}
      <path d="M -9 13 Q -13 18 -12 23" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <path d="M 9 13 Q 13 18 12 23" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <circle cx="-12" cy="23" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      <circle cx="12" cy="23" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Calça */}
      <rect x="-7" y="24" width="14" height="7" fill={CALCA} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Pernas + sapato */}
      <line x1="-4" y1="31" x2="-4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <line x1="4" y1="31" x2="4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="-4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
    </g>
  );
}

/** Ícaro — primeiro colaborador. Usa boné e segura câmera. */
function Icaro({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Cabelo escuro curto */}
      <path d="M -10 -4 Q -11 -14 0 -16 Q 11 -14 10 -4 L 9 -2 Q 5 -5 0 -4 Q -5 -5 -9 -2 Z" fill="#1a0f08" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Cabeça */}
      <circle cx="0" cy="0" r="10" fill={PELE} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Boné/bandana */}
      <path d="M -11 -7 Q -3 -12 8 -10 L 13 -8 Q 12 -3 7 -3 L -10 -3 Q -12 -5 -11 -7 Z" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <ellipse cx="-1" cy="-7" rx="2.5" ry="1" fill={STROKE} opacity="0.3" />
      {/* Orelhas */}
      <ellipse cx="-10" cy="1" rx="1.3" ry="2.2" fill={PELE} stroke={STROKE} strokeWidth="1.2" />
      <ellipse cx="10" cy="1" rx="1.3" ry="2.2" fill={PELE} stroke={STROKE} strokeWidth="1.2" />
      {/* Bochechas */}
      <ellipse cx="-5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      <ellipse cx="5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      {/* Olhos */}
      <circle cx="-3.5" cy="0" r="1.6" fill={STROKE} />
      <circle cx="-3" cy="-0.5" r="0.5" fill="#fff" />
      <circle cx="3.5" cy="0" r="1.6" fill={STROKE} />
      <circle cx="4" cy="-0.5" r="0.5" fill="#fff" />
      {/* Sorriso bem aberto, ele é o doido alegre */}
      <path d="M -4 4 Q 0 8 4 4" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Pescoço */}
      <rect x="-2" y="9" width="4" height="3" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Corpo */}
      <path d="M -8 12 Q -9 14 -9 17 L -9 24 L 9 24 L 9 17 Q 9 14 8 12 Q 4 14 0 14 Q -4 14 -8 12 Z" fill="#10b981" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Braços segurando câmera na frente */}
      <path d="M -9 14 Q -8 20 -4 22" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <path d="M 9 14 Q 8 20 4 22" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      {/* Câmera nas mãos */}
      <rect x="-6" y="20" width="12" height="8" rx="1" fill="#1e293b" stroke={STROKE} strokeWidth={STROKE_W} />
      <circle cx="0" cy="24" r="3" fill="#475569" stroke={STROKE} strokeWidth="1.5" />
      <circle cx="0" cy="24" r="1.5" fill={ACCENT_TEAL} />
      <rect x="-3" y="18.5" width="3" height="2" fill="#1e293b" stroke={STROKE} strokeWidth="1.2" />
      {/* Calça */}
      <rect x="-7" y="28" width="14" height="3" fill={CALCA} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Pernas */}
      <line x1="-4" y1="31" x2="-4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <line x1="4" y1="31" x2="4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="-4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
    </g>
  );
}

/** Laptop moderno — bezel fino, tela teal claro, base arredondada. */
function Laptop({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Tela (outer) */}
      <rect x="-11" y="-8" width="22" height="14" rx="1.5" fill="#0f172a" stroke={STROKE} strokeWidth="2" />
      {/* Tela inner (display teal claro) */}
      <rect x="-9" y="-6" width="18" height="10" rx="0.5" fill={ACCENT_TEAL} opacity="0.85" />
      {/* Linhas de código fake */}
      <line x1="-7" y1="-3" x2="-2" y2="-3" stroke="#0f172a" strokeWidth="0.8" opacity="0.4" />
      <line x1="-7" y1="-1" x2="4" y2="-1" stroke="#0f172a" strokeWidth="0.8" opacity="0.4" />
      <line x1="-7" y1="1" x2="1" y2="1" stroke="#0f172a" strokeWidth="0.8" opacity="0.4" />
      {/* Base */}
      <path d="M -13 6 L 13 6 Q 14 6 14 7 L 12 9 Q 11 10 10 10 L -10 10 Q -11 10 -12 9 L -14 7 Q -14 6 -13 6 Z" fill="#cbd5e1" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      <line x1="-3" y1="8" x2="3" y2="8" stroke={STROKE} strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}

// ============================================================
// Cenas
// ============================================================

export function CenaCeu({ className }: IlustracaoProps) {
  // Cena 1 — Tela dividida: Lucas no quarto + Yasmin no quarto separados
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill="#f8fafc" />
      {/* Divisória central */}
      <line x1="100" y1="0" x2="100" y2="140" stroke={STROKE} strokeWidth="2.5" strokeDasharray="6 4" />
      {/* Lado Lucas */}
      <rect x="0" y="0" width="100" height="140" fill={BG_SOFT_TEAL} />
      {/* Janela */}
      <rect x="15" y="20" width="30" height="30" rx="2" fill="#7dd3fc" stroke={STROKE} strokeWidth="2" />
      <line x1="30" y1="20" x2="30" y2="50" stroke={STROKE} strokeWidth="1.5" />
      <line x1="15" y1="35" x2="45" y2="35" stroke={STROKE} strokeWidth="1.5" />
      {/* Mesa */}
      <rect x="55" y="85" width="40" height="4" rx="1" fill="#92400e" stroke={STROKE} strokeWidth="1.5" />
      <line x1="60" y1="89" x2="60" y2="120" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <line x1="90" y1="89" x2="90" y2="120" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <Laptop x={75} y={82} scale={0.7} />
      <Lucas x={75} y={65} scale={0.9} />

      {/* Lado Yasmin */}
      <rect x="100" y="0" width="100" height="140" fill={BG_SOFT_CORAL} />
      {/* Quadrinho moderno na parede */}
      <rect x="135" y="20" width="25" height="20" rx="2" fill={ACCENT_VIOLET} stroke={STROKE} strokeWidth="2" />
      <path d="M 140 28 L 145 23 L 150 28 L 155 25" stroke={STROKE} strokeWidth="1.5" fill="none" />
      {/* Mesa */}
      <rect x="115" y="85" width="40" height="4" rx="1" fill="#92400e" stroke={STROKE} strokeWidth="1.5" />
      <line x1="120" y1="89" x2="120" y2="120" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <line x1="150" y1="89" x2="150" y2="120" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <Laptop x={135} y={82} scale={0.7} />
      <Yasmin x={135} y={65} scale={0.9} />

      {/* Selo "2020" pill moderno */}
      <g transform="translate(100, 14) rotate(-3)">
        <rect x="-24" y="-9" width="48" height="18" rx="9" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill={STROKE} fontFamily="system-ui">2020</text>
      </g>
    </Frame>
  );
}

export function CenaBarraca({ className }: IlustracaoProps) {
  // Cena 2 — Barraca de lanche
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_AMBER} />
      {/* Chão */}
      <rect x="0" y="110" width="200" height="30" fill="#92400e" />
      <line x1="0" y1="110" x2="200" y2="110" stroke={STROKE} strokeWidth="2.5" />

      {/* Barraca */}
      <rect x="50" y="55" width="100" height="55" rx="2" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2.5" />
      {/* Toldo listrado */}
      <path d="M 40 55 L 160 55 L 155 40 L 45 40 Z" fill="#fff" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M 60 40 L 55 55" stroke={ACCENT_CORAL} strokeWidth="6" />
      <path d="M 80 40 L 75 55" stroke={ACCENT_CORAL} strokeWidth="6" />
      <path d="M 100 40 L 95 55" stroke={ACCENT_CORAL} strokeWidth="6" />
      <path d="M 120 40 L 115 55" stroke={ACCENT_CORAL} strokeWidth="6" />
      <path d="M 140 40 L 135 55" stroke={ACCENT_CORAL} strokeWidth="6" />
      {/* Balcão */}
      <rect x="50" y="80" width="100" height="6" rx="1" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      {/* Placa "LANCHES" pill moderno */}
      <rect x="70" y="62" width="60" height="14" rx="7" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <text x="100" y="73" textAnchor="middle" fontSize="9" fontWeight="900" fill={STROKE} fontFamily="system-ui">LANCHES</text>

      {/* Dono atrás do balcão */}
      <Lucas x={100} y={95} scale={0.7} />

      {/* Sol moderno no canto */}
      <circle cx="170" cy="25" r="12" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <line x1="170" y1="8" x2="170" y2="3" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="170" y1="42" x2="170" y2="47" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="153" y1="25" x2="148" y2="25" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="187" y1="25" x2="192" y2="25" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
    </Frame>
  );
}

export function CenaCall({ className }: IlustracaoProps) {
  // Cena 3 — Call de 5h: duas telas de computador conectadas
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_VIOLET} />
      {/* Tela do Lucas */}
      <g transform="translate(50, 70)">
        <rect x="-25" y="-22" width="50" height="35" rx="2" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
        <rect x="-22" y="-19" width="44" height="29" fill="#dbeafe" />
        <Lucas x={0} y={-5} scale={0.5} />
      </g>
      {/* Tela da Yasmin */}
      <g transform="translate(150, 70)">
        <rect x="-25" y="-22" width="50" height="35" rx="2" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
        <rect x="-22" y="-19" width="44" height="29" fill="#fce7f3" />
        <Yasmin x={0} y={-5} scale={0.5} />
      </g>
      {/* Onda de sinal entre as telas */}
      <path d="M 80 75 Q 100 60 120 75" stroke={ACCENT_TEAL} strokeWidth="2.5" fill="none" strokeDasharray="4 3" />
      <path d="M 80 80 Q 100 95 120 80" stroke={ACCENT_CORAL} strokeWidth="2.5" fill="none" strokeDasharray="4 3" />

      {/* Relógio */}
      <g transform="translate(100, 22)">
        <circle cx="0" cy="0" r="14" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
        <circle cx="0" cy="0" r="1.5" fill={STROKE} />
        <line x1="0" y1="0" x2="0" y2="-9" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="0" x2="7" y2="2" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
        {/* Marcas */}
        <line x1="0" y1="-13" x2="0" y2="-10" stroke={STROKE} strokeWidth="1.5" />
        <line x1="0" y1="10" x2="0" y2="13" stroke={STROKE} strokeWidth="1.5" />
        <line x1="-13" y1="0" x2="-10" y2="0" stroke={STROKE} strokeWidth="1.5" />
        <line x1="10" y1="0" x2="13" y2="0" stroke={STROKE} strokeWidth="1.5" />
      </g>

      {/* "5h" no canto */}
      <g transform="translate(170, 22) rotate(8)">
        <rect x="-12" y="-7" width="24" height="14" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2.5" />
        <text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff" fontFamily="system-ui">5h!</text>
      </g>

      {/* Mesa embaixo */}
      <rect x="0" y="110" width="200" height="30" fill={ACCENT_AMBER} />
      <line x1="0" y1="110" x2="200" y2="110" stroke={STROKE} strokeWidth="2.5" />
    </Frame>
  );
}

export function CenaCafe({ className }: IlustracaoProps) {
  // Cena 4 — Cafeteria: dois personagens em mesa redonda
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_AMBER} />
      {/* Chão */}
      <rect x="0" y="105" width="200" height="35" fill="#a16207" />
      <line x1="0" y1="105" x2="200" y2="105" stroke={STROKE} strokeWidth="2.5" />
      {/* Janela atrás */}
      <rect x="20" y="15" width="160" height="40" fill={BG_SOFT_TEAL} stroke={STROKE} strokeWidth="2.5" />
      <line x1="100" y1="15" x2="100" y2="55" stroke={STROKE} strokeWidth="2" />
      {/* Plantinha decorativa */}
      <circle cx="35" cy="40" r="8" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2" />
      <circle cx="42" cy="33" r="7" fill="#16a34a" stroke={STROKE} strokeWidth="2" />

      {/* Mesa redonda (visão lateral elíptica) */}
      <ellipse cx="100" cy="100" rx="55" ry="10" fill="#92400e" stroke={STROKE} strokeWidth="2.5" />
      <ellipse cx="100" cy="98" rx="55" ry="9" fill="#a16207" stroke={STROKE} strokeWidth="2.5" />
      {/* Pé da mesa */}
      <line x1="100" y1="105" x2="100" y2="130" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
      <line x1="92" y1="130" x2="108" y2="130" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />

      {/* Personagens nos lados da mesa */}
      <Lucas x={60} y={75} scale={0.85} />
      <Yasmin x={140} y={75} scale={0.85} />

      {/* Xícaras */}
      <g transform="translate(75, 96)">
        <rect x="-4" y="-4" width="8" height="6" fill="#fff" stroke={STROKE} strokeWidth="2" />
        <path d="M 4 -3 Q 7 -3 7 0 Q 7 2 4 2" fill="none" stroke={STROKE} strokeWidth="2" />
        {/* Fumacinha */}
        <path d="M -1 -7 Q 1 -10 -1 -13" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 2 -7 Q 4 -10 2 -13" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
      <g transform="translate(125, 96)">
        <rect x="-4" y="-4" width="8" height="6" fill="#fff" stroke={STROKE} strokeWidth="2" />
        <path d="M 4 -3 Q 7 -3 7 0 Q 7 2 4 2" fill="none" stroke={STROKE} strokeWidth="2" />
        <path d="M -1 -7 Q 1 -10 -1 -13" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M 2 -7 Q 4 -10 2 -13" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Coração entre eles */}
      <g transform="translate(100, 60)">
        <path d="M 0 4 Q -5 -2 -5 -5 Q -5 -8 -2 -8 Q 0 -8 0 -6 Q 0 -8 2 -8 Q 5 -8 5 -5 Q 5 -2 0 4 Z" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

export function CenaDupla({ className }: IlustracaoProps) {
  // Cena 5 — Dupla: Lucas e Yasmin lado a lado com várias ferramentas/funções flutuando
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_AMBER} />
      {/* Chão */}
      <rect x="0" y="115" width="200" height="25" fill="#a16207" />
      <line x1="0" y1="115" x2="200" y2="115" stroke={STROKE} strokeWidth="2.5" />

      {/* Personagens */}
      <Lucas x={75} y={80} scale={1.1} />
      <Yasmin x={125} y={80} scale={1.1} />

      {/* Ícones flutuantes */}
      {/* Pincel (designer) */}
      <g transform="translate(30, 30) rotate(-15)">
        <rect x="-2" y="-12" width="4" height="14" fill="#a16207" stroke={STROKE} strokeWidth="2" />
        <ellipse cx="0" cy="-15" rx="3" ry="5" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2" />
      </g>
      {/* Câmera (videomaker) */}
      <g transform="translate(170, 30)">
        <rect x="-9" y="-6" width="18" height="12" rx="1" fill="#1e293b" stroke={STROKE} strokeWidth="2" />
        <circle cx="0" cy="0" r="3.5" fill="#475569" stroke={STROKE} strokeWidth="1.5" />
        <circle cx="0" cy="0" r="1.5" fill="#0ea5e9" />
        <rect x="-6" y="-9" width="4" height="3" fill="#1e293b" stroke={STROKE} strokeWidth="1.5" />
      </g>
      {/* Megafone (social media) */}
      <g transform="translate(25, 70) rotate(-20)">
        <path d="M -8 -5 L 8 -8 L 8 8 L -8 5 Z" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
        <rect x="-12" y="-3" width="4" height="6" fill="#a16207" stroke={STROKE} strokeWidth="2" />
        <line x1="11" y1="-10" x2="13" y2="-13" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="13" y1="0" x2="16" y2="0" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="11" y1="10" x2="13" y2="13" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      </g>
      {/* $ (vendedor) */}
      <g transform="translate(175, 70) rotate(10)">
        <circle cx="0" cy="0" r="10" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2.5" />
        <text x="0" y="4" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="system-ui">$</text>
      </g>
      {/* Tela/play (editor) */}
      <g transform="translate(100, 25) rotate(5)">
        <rect x="-10" y="-7" width="20" height="14" rx="1" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2.5" />
        <path d="M -2 -3 L 4 0 L -2 3 Z" fill="#fff" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

export function CenaCaos({ className }: IlustracaoProps) {
  // Cena 6 — Caos: noite, estrada, personagem cansado dirigindo
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_NIGHT} />
      {/* Estrelas */}
      <circle cx="30" cy="20" r="1.5" fill="#fff" />
      <circle cx="60" cy="35" r="1" fill="#fff" />
      <circle cx="160" cy="15" r="1.5" fill="#fff" />
      <circle cx="180" cy="40" r="1" fill="#fff" />
      <circle cx="140" cy="50" r="1" fill="#fff" />

      {/* Lua */}
      <circle cx="160" cy="30" r="14" fill={BG_SOFT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      <circle cx="156" cy="27" r="2" fill={ACCENT_AMBER} opacity="0.5" />
      <circle cx="164" cy="33" r="1.5" fill={ACCENT_AMBER} opacity="0.5" />

      {/* Chão/estrada */}
      <path d="M 0 100 L 200 100 L 200 140 L 0 140 Z" fill="#374151" />
      <line x1="0" y1="100" x2="200" y2="100" stroke={STROKE} strokeWidth="2.5" />
      {/* Linhas tracejadas da estrada */}
      <line x1="30" y1="120" x2="50" y2="120" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="80" y1="120" x2="100" y2="120" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="130" y1="120" x2="150" y2="120" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="180" y1="120" x2="200" y2="120" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />

      {/* Carro vindo de frente — visão simples */}
      <g transform="translate(100, 95)">
        <path d="M -30 5 L -30 -2 Q -25 -10 -15 -12 L 15 -12 Q 25 -10 30 -2 L 30 5 Z" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
        {/* Janelas */}
        <path d="M -22 -2 L -18 -10 L 18 -10 L 22 -2 Z" fill="#0ea5e9" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="0" y1="-10" x2="0" y2="-2" stroke={STROKE} strokeWidth="2" />
        {/* Rodas */}
        <circle cx="-18" cy="6" r="5" fill={STROKE} />
        <circle cx="-18" cy="6" r="2" fill="#fff" />
        <circle cx="18" cy="6" r="5" fill={STROKE} />
        <circle cx="18" cy="6" r="2" fill="#fff" />
        {/* Faróis acessos */}
        <circle cx="-25" cy="0" r="3" fill={BG_SOFT_AMBER} />
        <circle cx="25" cy="0" r="3" fill={BG_SOFT_AMBER} />
      </g>

      {/* Nuvem de cansaço com Zzz */}
      <g transform="translate(40, 50)">
        <text x="0" y="0" fontSize="14" fontWeight="900" fill="#fff" fontFamily="system-ui">Zzz</text>
      </g>
    </Frame>
  );
}

export function CenaEvolucao({ className }: IlustracaoProps) {
  // Cena 7 — Evolução: seta crescente com personagens em diferentes alturas
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_TEAL} />
      {/* Chão */}
      <rect x="0" y="120" width="200" height="20" fill="#16a34a" />
      <line x1="0" y1="120" x2="200" y2="120" stroke={STROKE} strokeWidth="2.5" />

      {/* Linha de crescimento */}
      <path d="M 20 110 L 70 90 L 120 60 L 170 30" stroke={ACCENT_TEAL} strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* Pontos */}
      <circle cx="20" cy="110" r="5" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      <circle cx="70" cy="90" r="5" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      <circle cx="120" cy="60" r="5" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      {/* Seta no topo */}
      <g transform="translate(170, 30) rotate(-30)">
        <path d="M 0 0 L 10 0 L 10 -5 L 18 3 L 10 11 L 10 6 L 0 6 Z" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      </g>

      {/* Personagens no topo (vitoriosos) */}
      <Lucas x={140} y={45} scale={0.7} />
      <Yasmin x={165} y={50} scale={0.7} />

      {/* Estrelas decorativas */}
      <g transform="translate(40, 30)">
        <path d="M 0 -7 L 2 -2 L 7 -2 L 3 1 L 5 6 L 0 3 L -5 6 L -3 1 L -7 -2 L -2 -2 Z" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      </g>
      <g transform="translate(180, 80)">
        <path d="M 0 -5 L 1.5 -1.5 L 5 -1.5 L 2 1 L 3.5 5 L 0 2.5 L -3.5 5 L -2 1 L -5 -1.5 L -1.5 -1.5 Z" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

export function CenaPadaria({ className }: IlustracaoProps) {
  // Cena 8 — Padaria com salinha no fundo
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_AMBER} />
      {/* Chão */}
      <rect x="0" y="110" width="200" height="30" fill="#a16207" />
      <line x1="0" y1="110" x2="200" y2="110" stroke={STROKE} strokeWidth="2.5" />

      {/* Padaria — fachada */}
      <rect x="20" y="30" width="160" height="80" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      {/* Telhado */}
      <path d="M 15 30 L 100 8 L 185 30 Z" fill="#92400e" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Letreiro */}
      <rect x="50" y="38" width="100" height="16" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
      <text x="100" y="50" textAnchor="middle" fontSize="11" fontWeight="900" fill={STROKE} fontFamily="system-ui">PADARIA</text>

      {/* Porta principal */}
      <rect x="85" y="75" width="30" height="35" fill="#92400e" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="108" cy="92" r="1.5" fill={ACCENT_AMBER} />

      {/* Janela com pãezinhos */}
      <rect x="35" y="65" width="35" height="35" fill={BG_SOFT_TEAL} stroke={STROKE} strokeWidth="2.5" />
      <ellipse cx="45" cy="85" rx="4" ry="3" fill="#a16207" stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="55" cy="85" rx="4" ry="3" fill="#a16207" stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="50" cy="92" rx="4" ry="3" fill="#a16207" stroke={STROKE} strokeWidth="1.5" />

      {/* Indicação fundo — seta apontando pra trás */}
      <g transform="translate(150, 80)">
        <rect x="-15" y="-12" width="30" height="24" fill={BG_SOFT_TEAL} stroke={STROKE} strokeWidth="2.5" />
        {/* Janelinha do "escritório" no fundo da padaria */}
        <line x1="-15" y1="0" x2="15" y2="0" stroke={STROKE} strokeWidth="2" />
        <line x1="0" y1="-12" x2="0" y2="12" stroke={STROKE} strokeWidth="2" />
      </g>
      <g transform="translate(150, 100)">
        <path d="M 0 5 L -8 -5 L -4 -5 L -4 -10 L 4 -10 L 4 -5 L 8 -5 Z" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      </g>

      {/* Texto YIDE pequeninho */}
      <text x="150" y="135" textAnchor="middle" fontSize="6" fontWeight="900" fill="#fff" fontFamily="system-ui">↑ Yide tava aqui</text>
    </Frame>
  );
}

export function CenaSala({ className }: IlustracaoProps) {
  // Cena 9 — Sala comercial / prédio crescendo
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_TEAL} />
      {/* Nuvens */}
      <ellipse cx="40" cy="25" rx="14" ry="6" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <ellipse cx="170" cy="18" rx="16" ry="7" fill="#fff" stroke={STROKE} strokeWidth="2" />
      {/* Chão */}
      <rect x="0" y="120" width="200" height="20" fill="#16a34a" />
      <line x1="0" y1="120" x2="200" y2="120" stroke={STROKE} strokeWidth="2.5" />

      {/* Prédio comercial — 2 salas (lado a lado) */}
      <rect x="50" y="50" width="100" height="70" fill="#fff" stroke={STROKE} strokeWidth="2.5" />
      <line x1="100" y1="50" x2="100" y2="120" stroke={STROKE} strokeWidth="2.5" />

      {/* Janelas sala 1 */}
      <rect x="60" y="60" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <rect x="78" y="60" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <rect x="60" y="80" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <rect x="78" y="80" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />

      {/* Janelas sala 2 */}
      <rect x="108" y="60" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <rect x="126" y="60" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <rect x="108" y="80" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <rect x="126" y="80" width="14" height="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />

      {/* Porta */}
      <rect x="92" y="100" width="16" height="20" fill="#92400e" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="103" cy="111" r="1.5" fill={ACCENT_AMBER} />

      {/* Seta "2x" */}
      <g transform="translate(170, 70)">
        <circle cx="0" cy="0" r="14" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
        <text x="0" y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill={STROKE} fontFamily="system-ui">2×</text>
      </g>
    </Frame>
  );
}

export function CenaCasa({ className }: IlustracaoProps) {
  // Cena 10 — Casa à noite
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_NIGHT} />
      {/* Estrelas */}
      <circle cx="30" cy="20" r="1.5" fill="#fff" />
      <circle cx="80" cy="25" r="1" fill="#fff" />
      <circle cx="160" cy="20" r="1.5" fill="#fff" />
      <circle cx="180" cy="35" r="1" fill="#fff" />
      {/* Lua */}
      <circle cx="170" cy="30" r="10" fill={BG_SOFT_AMBER} stroke={STROKE} strokeWidth="2.5" />

      {/* Chão/grama */}
      <rect x="0" y="115" width="200" height="25" fill="#15803d" />
      <line x1="0" y1="115" x2="200" y2="115" stroke={STROKE} strokeWidth="2.5" />

      {/* Casa */}
      <rect x="55" y="65" width="90" height="55" fill={BG_SOFT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      {/* Telhado */}
      <path d="M 48 65 L 100 35 L 152 65 Z" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Chaminé */}
      <rect x="125" y="40" width="10" height="18" fill="#a16207" stroke={STROKE} strokeWidth="2" />

      {/* Porta */}
      <rect x="88" y="85" width="24" height="35" fill="#92400e" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="105" cy="102" r="1.5" fill={ACCENT_AMBER} />

      {/* Janelas iluminadas */}
      <rect x="65" y="75" width="18" height="18" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      <line x1="74" y1="75" x2="74" y2="93" stroke={STROKE} strokeWidth="1.5" />
      <line x1="65" y1="84" x2="83" y2="84" stroke={STROKE} strokeWidth="1.5" />

      <rect x="117" y="75" width="18" height="18" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      <line x1="126" y1="75" x2="126" y2="93" stroke={STROKE} strokeWidth="1.5" />
      <line x1="117" y1="84" x2="135" y2="84" stroke={STROKE} strokeWidth="1.5" />

      {/* Personagem em frente */}
      <Yasmin x={30} y={100} scale={0.7} />
    </Frame>
  );
}

export function CenaTime({ className }: IlustracaoProps) {
  // Cena 11 — Time: vários personagens em fileira
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="140" fill={BG_SOFT_AMBER} />
      {/* Chão */}
      <rect x="0" y="115" width="200" height="25" fill="#a16207" />
      <line x1="0" y1="115" x2="200" y2="115" stroke={STROKE} strokeWidth="2.5" />

      {/* Linha de personagens — variando cores e tamanhos */}
      <g>
        <circle cx="25" cy="65" r="8" fill={PELE} stroke={STROKE} strokeWidth="2.5" />
        <circle cx="25" cy="63" r="1" fill={STROKE} /><circle cx="29" cy="63" r="1" fill={STROKE} />
        <path d="M 23 67 Q 25 69 28 67" stroke={STROKE} strokeWidth="1.5" fill="none" />
        <path d="M 18 -6 Q 16 -2 17 2 L 33 2 Q 34 -2 32 -6 Z" transform="translate(25, 65)" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2.5" />
        <path d="M 18 70 L 18 90 L 32 90 L 32 70 Z" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2.5" />
        <line x1="22" y1="90" x2="22" y2="105" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="28" y1="90" x2="28" y2="105" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <Yasmin x={60} y={75} scale={0.95} />
      <Lucas x={95} y={75} scale={0.95} />

      <g>
        <circle cx="130" cy="65" r="8" fill={PELE} stroke={STROKE} strokeWidth="2.5" />
        <circle cx="128" cy="63" r="1" fill={STROKE} /><circle cx="132" cy="63" r="1" fill={STROKE} />
        <path d="M 128 67 Q 130 69 133 67" stroke={STROKE} strokeWidth="1.5" fill="none" />
        <path d="M -6 9 L -8 22 L 8 22 L 6 9 Z" transform="translate(130, 65)" fill="#a855f7" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="127" y1="87" x2="127" y2="105" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="133" y1="87" x2="133" y2="105" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <g>
        <circle cx="165" cy="65" r="8" fill={PELE} stroke={STROKE} strokeWidth="2.5" />
        <circle cx="163" cy="63" r="1" fill={STROKE} /><circle cx="167" cy="63" r="1" fill={STROKE} />
        <path d="M 163 67 Q 165 69 168 67" stroke={STROKE} strokeWidth="1.5" fill="none" />
        <path d="M -6 9 L -8 22 L 8 22 L 6 9 Z" transform="translate(165, 65)" fill="#f97316" stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="162" y1="87" x2="162" y2="105" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="168" y1="87" x2="168" y2="105" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Coração no topo */}
      <g transform="translate(100, 25)">
        <path d="M 0 12 Q -14 0 -14 -8 Q -14 -16 -7 -16 Q 0 -16 0 -10 Q 0 -16 7 -16 Q 14 -16 14 -8 Q 14 0 0 12 Z" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

export function CenaCoragem({ className }: IlustracaoProps) {
  // Cena 12 — Lucas e Yasmin olhando o sol nascendo, símbolo da coragem
  return (
    <Frame className={className}>
      <rect x="0" y="0" width="200" height="80" fill="#fb923c" />
      <rect x="0" y="80" width="200" height="60" fill={ACCENT_AMBER} />
      {/* Sol nascendo */}
      <circle cx="100" cy="80" r="35" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2.5" />
      <line x1="100" y1="30" x2="100" y2="22" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="60" y1="55" x2="55" y2="50" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="140" y1="55" x2="145" y2="50" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="80" x2="32" y2="80" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="160" y1="80" x2="168" y2="80" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />

      {/* Chão */}
      <rect x="0" y="115" width="200" height="25" fill="#15803d" />
      <line x1="0" y1="115" x2="200" y2="115" stroke={STROKE} strokeWidth="2.5" />

      {/* Lucas e Yasmin de costas, olhando o sol */}
      <Lucas x={80} y={90} scale={0.9} />
      <Yasmin x={120} y={90} scale={0.9} />

      {/* Pássaros */}
      <path d="M 30 30 Q 35 27 40 30 Q 45 27 50 30" stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 150 25 Q 155 22 160 25 Q 165 22 170 25" stroke={STROKE} strokeWidth="2" fill="none" strokeLinecap="round" />
    </Frame>
  );
}

/** Rafael — segundo colaborador. Cabelo encaracolado, camisa roxa. */
function Rafael({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Cabelo crespo/encaracolado (silhueta texturizada) */}
      <path d="M -12 -3 Q -14 -10 -10 -14 Q -3 -18 4 -16 Q 13 -15 13 -7 Q 14 -2 12 0 L 10 -3 Q 7 -5 4 -4 Q 0 -7 -4 -5 Q -8 -7 -11 -4 Z" fill="#2a1810" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Cachinhos extras */}
      <circle cx="-9" cy="-12" r="2.5" fill="#2a1810" stroke={STROKE} strokeWidth="1.5" />
      <circle cx="-4" cy="-15" r="2.5" fill="#2a1810" stroke={STROKE} strokeWidth="1.5" />
      <circle cx="3" cy="-15" r="2.5" fill="#2a1810" stroke={STROKE} strokeWidth="1.5" />
      <circle cx="9" cy="-12" r="2.5" fill="#2a1810" stroke={STROKE} strokeWidth="1.5" />
      {/* Cabeça */}
      <circle cx="0" cy="0" r="10" fill={PELE} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Orelhas */}
      <ellipse cx="-10" cy="1" rx="1.3" ry="2.2" fill={PELE} stroke={STROKE} strokeWidth="1.2" />
      <ellipse cx="10" cy="1" rx="1.3" ry="2.2" fill={PELE} stroke={STROKE} strokeWidth="1.2" />
      {/* Bochechas */}
      <ellipse cx="-5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      <ellipse cx="5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      {/* Olhos */}
      <circle cx="-3.5" cy="0" r="1.6" fill={STROKE} />
      <circle cx="-3" cy="-0.5" r="0.5" fill="#fff" />
      <circle cx="3.5" cy="0" r="1.6" fill={STROKE} />
      <circle cx="4" cy="-0.5" r="0.5" fill="#fff" />
      {/* Sorriso */}
      <path d="M -3 4 Q 0 6.5 3 4" stroke={STROKE} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Pescoço */}
      <rect x="-2" y="9" width="4" height="3" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Corpo (camisa roxa) */}
      <path d="M -8 12 Q -9 14 -9 17 L -9 24 L 9 24 L 9 17 Q 9 14 8 12 Q 4 14 0 14 Q -4 14 -8 12 Z" fill={ACCENT_VIOLET} stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Braços */}
      <path d="M -9 13 Q -13 18 -12 23" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <path d="M 9 13 Q 13 18 12 23" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <circle cx="-12" cy="23" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      <circle cx="12" cy="23" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Calça */}
      <rect x="-7" y="24" width="14" height="7" fill={CALCA} stroke={STROKE} strokeWidth={STROKE_W} />
      <line x1="-4" y1="31" x2="-4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <line x1="4" y1="31" x2="4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="-4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
    </g>
  );
}

export function CenaRafael({ className }: IlustracaoProps) {
  // Cena do Rafael — festa/balada onde a Yasmin encontrou ele.
  // Yasmin segurando copo, Rafael chegando, vibe noturna mas casual.
  return (
    <Frame className={className}>
      {/* Céu noite */}
      <rect x="0" y="0" width="200" height="100" fill={BG_NIGHT} />
      {/* Bola de luz/disco ball */}
      <circle cx="100" cy="20" r="8" fill="#fff" stroke={STROKE} strokeWidth="2" opacity="0.9" />
      <line x1="92" y1="20" x2="108" y2="20" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="100" y1="12" x2="100" y2="28" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="94" y1="14" x2="106" y2="26" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
      <line x1="106" y1="14" x2="94" y2="26" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
      {/* Raios de luz da disco ball */}
      <line x1="100" y1="28" x2="60" y2="65" stroke={ACCENT_AMBER} strokeWidth="1.5" opacity="0.5" />
      <line x1="100" y1="28" x2="140" y2="65" stroke={ACCENT_CORAL} strokeWidth="1.5" opacity="0.5" />
      <line x1="100" y1="28" x2="100" y2="80" stroke={ACCENT_VIOLET} strokeWidth="1.5" opacity="0.5" />

      {/* Luzes piscantes no fundo */}
      <circle cx="25" cy="30" r="2" fill={ACCENT_CORAL} />
      <circle cx="175" cy="40" r="2" fill={ACCENT_AMBER} />
      <circle cx="40" cy="55" r="1.5" fill={ACCENT_TEAL} />
      <circle cx="160" cy="60" r="1.5" fill={ACCENT_VIOLET} />

      {/* Chão de balada */}
      <rect x="0" y="100" width="200" height="40" fill="#1e293b" />
      <line x1="0" y1="100" x2="200" y2="100" stroke={STROKE} strokeWidth="2.5" />
      {/* Quadrados de pista de dança */}
      <rect x="10" y="110" width="20" height="20" fill={ACCENT_CORAL} opacity="0.4" />
      <rect x="30" y="110" width="20" height="20" fill={ACCENT_AMBER} opacity="0.4" />
      <rect x="150" y="110" width="20" height="20" fill={ACCENT_TEAL} opacity="0.4" />
      <rect x="170" y="110" width="20" height="20" fill={ACCENT_VIOLET} opacity="0.4" />

      {/* Yasmin e Rafael conversando */}
      <Yasmin x={70} y={80} scale={0.85} />
      <Rafael x={130} y={80} scale={0.85} />

      {/* Copos nas mãos */}
      <g transform="translate(58, 100)">
        <path d="M -3 0 L -2.5 6 L 2.5 6 L 3 0 Z" fill={ACCENT_AMBER} opacity="0.8" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
        <ellipse cx="0" cy="0" rx="3" ry="0.8" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="1.5" />
      </g>
      <g transform="translate(142, 100)">
        <path d="M -3 0 L -2.5 6 L 2.5 6 L 3 0 Z" fill={ACCENT_CORAL} opacity="0.8" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
        <ellipse cx="0" cy="0" rx="3" ry="0.8" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="1.5" />
      </g>

      {/* Selo "R$50 + 1 refri" */}
      <g transform="translate(100, 50) rotate(-4)">
        <rect x="-32" y="-9" width="64" height="18" rx="9" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="900" fill={STROKE} fontFamily="system-ui">R$50 + refri 🥤</text>
      </g>
    </Frame>
  );
}

/** Eduardo — dentista, primeiro cliente. Jaleco branco, óculos, simpático. */
function Eduardo({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Cabelo curto grisalho */}
      <path d="M -11 -3 Q -12 -14 -2 -16 Q 11 -17 12 -6 L 12 -2 Q 8 -5 4 -4 Q 0 -6 -4 -4 Q -8 -5 -11 -2 Z" fill="#64748b" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Cabeça */}
      <circle cx="0" cy="0" r="10" fill={PELE} stroke={STROKE} strokeWidth={STROKE_W} />
      {/* Orelhas */}
      <ellipse cx="-10" cy="1" rx="1.5" ry="2.5" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="10" cy="1" rx="1.5" ry="2.5" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Bochechas */}
      <ellipse cx="-5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      <ellipse cx="5" cy="3" rx="2" ry="1.2" fill={BLUSH} opacity="0.6" />
      {/* Óculos — lentes redondas conectadas */}
      <circle cx="-3.5" cy="-0.5" r="3" fill="none" stroke={STROKE} strokeWidth="1.8" />
      <circle cx="3.5" cy="-0.5" r="3" fill="none" stroke={STROKE} strokeWidth="1.8" />
      <line x1="-0.5" y1="-0.5" x2="0.5" y2="-0.5" stroke={STROKE} strokeWidth="1.8" />
      {/* Olhos atrás dos óculos */}
      <circle cx="-3.5" cy="-0.5" r="1.2" fill={STROKE} />
      <circle cx="-3" cy="-1" r="0.4" fill="#fff" />
      <circle cx="3.5" cy="-0.5" r="1.2" fill={STROKE} />
      <circle cx="4" cy="-1" r="0.4" fill="#fff" />
      {/* Sorriso amigável (dentes — afinal é dentista) */}
      <path d="M -4 4 Q 0 7 4 4" stroke={STROKE} strokeWidth="1.5" fill="#fff" strokeLinejoin="round" />
      <line x1="-1.5" y1="4.5" x2="-1.5" y2="6.5" stroke={STROKE} strokeWidth="0.6" />
      <line x1="1.5" y1="4.5" x2="1.5" y2="6.5" stroke={STROKE} strokeWidth="0.6" />
      {/* Pescoço */}
      <rect x="-2" y="9" width="4" height="3" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Jaleco branco */}
      <path d="M -9 12 Q -10 14 -10 17 L -10 26 L 10 26 L 10 17 Q 10 14 9 12 Q 5 14 0 14 Q -5 14 -9 12 Z" fill="#fff" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      {/* Detalhe gola V do jaleco */}
      <path d="M -3 14 L 0 18 L 3 14" stroke={STROKE} strokeWidth="1.5" fill="none" />
      {/* Bolsinho do jaleco com caneta */}
      <rect x="3" y="19" width="5" height="5" fill="none" stroke={STROKE} strokeWidth="1.2" />
      <line x1="5.5" y1="17" x2="5.5" y2="22" stroke={ACCENT_TEAL} strokeWidth="1.5" strokeLinecap="round" />
      {/* Braços */}
      <path d="M -10 14 Q -14 19 -13 24" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <path d="M 10 14 Q 14 19 13 24" stroke={STROKE} strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      <circle cx="-13" cy="24" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      <circle cx="13" cy="24" r="1.8" fill={PELE} stroke={STROKE} strokeWidth="1.5" />
      {/* Calça */}
      <rect x="-7" y="26" width="14" height="5" fill={CALCA} stroke={STROKE} strokeWidth={STROKE_W} />
      <line x1="-4" y1="31" x2="-4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <line x1="4" y1="31" x2="4" y2="35" stroke={CALCA} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="-4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
      <ellipse cx="4" cy="36" rx="2.5" ry="1.5" fill={SAPATO} stroke={STROKE} strokeWidth="1.5" />
    </g>
  );
}

export function CenaEduardo({ className }: IlustracaoProps) {
  // Cena do Eduardo — consultório odontológico. Lucas conversando com
  // Eduardo (dentista), com elementos do consultório no fundo.
  return (
    <Frame className={className}>
      {/* Parede do consultório */}
      <rect x="0" y="0" width="200" height="100" fill={BG_SOFT_TEAL} />
      {/* Chão azulejo */}
      <rect x="0" y="100" width="200" height="40" fill="#cbd5e1" />
      <line x1="0" y1="100" x2="200" y2="100" stroke={STROKE} strokeWidth="2.5" />
      <line x1="50" y1="100" x2="50" y2="140" stroke={STROKE} strokeWidth="1" opacity="0.4" />
      <line x1="100" y1="100" x2="100" y2="140" stroke={STROKE} strokeWidth="1" opacity="0.4" />
      <line x1="150" y1="100" x2="150" y2="140" stroke={STROKE} strokeWidth="1" opacity="0.4" />
      <line x1="0" y1="120" x2="200" y2="120" stroke={STROKE} strokeWidth="1" opacity="0.4" />

      {/* Cadeira de dentista estilizada à direita */}
      <g transform="translate(160, 70)">
        {/* Base */}
        <rect x="-5" y="20" width="10" height="6" rx="1" fill="#475569" stroke={STROKE} strokeWidth="2" />
        {/* Haste vertical */}
        <rect x="-2" y="-5" width="4" height="25" fill="#94a3b8" stroke={STROKE} strokeWidth="2" />
        {/* Encosto */}
        <rect x="-10" y="-10" width="20" height="18" rx="3" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2" />
        {/* Apoio cabeça */}
        <ellipse cx="0" cy="-13" rx="6" ry="4" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2" />
        {/* Luminária */}
        <line x1="0" y1="-13" x2="-12" y2="-24" stroke={STROKE} strokeWidth="2" />
        <circle cx="-15" cy="-26" r="4" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      </g>

      {/* Quadro decorativo na parede esquerda — dente sorrindo */}
      <g transform="translate(30, 30)">
        <rect x="-12" y="-10" width="24" height="20" rx="2" fill="#fff" stroke={STROKE} strokeWidth="2" />
        {/* Dente */}
        <path d="M -5 -4 Q -6 4 -3 6 L 3 6 Q 6 4 5 -4 Q 3 -6 0 -5 Q -3 -6 -5 -4 Z" fill="#fff" stroke={STROKE} strokeWidth="1.8" strokeLinejoin="round" />
        {/* Olhinhos */}
        <circle cx="-2" cy="-1" r="0.7" fill={STROKE} />
        <circle cx="2" cy="-1" r="0.7" fill={STROKE} />
        {/* Sorriso */}
        <path d="M -1.5 2 Q 0 3 1.5 2" stroke={STROKE} strokeWidth="0.8" fill="none" />
      </g>

      {/* Lucas conversando com Eduardo no centro/esquerda */}
      <Lucas x={75} y={80} scale={0.82} />
      <Eduardo x={115} y={80} scale={0.82} />

      {/* Aperto de mãos / linha sutil de conexão */}
      <path d="M 87 102 Q 100 100 103 102" stroke={STROKE} strokeWidth="1.5" fill="none" opacity="0.5" strokeDasharray="2 2" />

      {/* Selo "primeiro $" */}
      <g transform="translate(100, 25) rotate(-3)">
        <rect x="-30" y="-9" width="60" height="18" rx="9" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="900" fill={STROKE} fontFamily="system-ui">1º dindin 💰</text>
      </g>

      {/* Coração entre Lucas e Eduardo (gratidão) */}
      <g transform="translate(95, 58)">
        <path d="M 0 5 Q -6 -1 -6 -5 Q -6 -8 -3 -8 Q 0 -8 0 -6 Q 0 -8 3 -8 Q 6 -8 6 -5 Q 6 -1 0 5 Z" fill={ACCENT_CORAL} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </Frame>
  );
}

export function CenaIcaro({ className }: IlustracaoProps) {
  // Cena nova — Ícaro chega com câmera, a estrada de fundo conecta com
  // a cena anterior (caos / viagens).
  return (
    <Frame className={className}>
      {/* Céu (dia, depois da noite) */}
      <rect x="0" y="0" width="200" height="80" fill={BG_SOFT_TEAL} />
      {/* Sol */}
      <circle cx="170" cy="22" r="11" fill={ACCENT_AMBER} stroke={STROKE} strokeWidth="2" />
      <line x1="170" y1="6" x2="170" y2="3" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="186" y1="22" x2="190" y2="22" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="154" y1="22" x2="150" y2="22" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="159" y1="33" x2="156" y2="36" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="181" y1="33" x2="184" y2="36" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      {/* Nuvens */}
      <ellipse cx="35" cy="20" rx="14" ry="6" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <ellipse cx="90" cy="15" rx="12" ry="5" fill="#fff" stroke={STROKE} strokeWidth="2" />

      {/* Estrada (chão) */}
      <rect x="0" y="80" width="200" height="60" fill="#475569" />
      <line x1="0" y1="80" x2="200" y2="80" stroke={STROKE} strokeWidth="2.5" />
      {/* Linhas tracejadas */}
      <line x1="20" y1="130" x2="40" y2="130" stroke={ACCENT_AMBER} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="65" y1="130" x2="85" y2="130" stroke={ACCENT_AMBER} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="115" y1="130" x2="135" y2="130" stroke={ACCENT_AMBER} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="160" y1="130" x2="180" y2="130" stroke={ACCENT_AMBER} strokeWidth="2.5" strokeLinecap="round" />

      {/* Personagens */}
      <Yasmin x={40} y={90} scale={0.78} />
      <Lucas x={75} y={90} scale={0.78} />
      <Icaro x={130} y={90} scale={0.85} />

      {/* Onda "click" da câmera saindo */}
      <g transform="translate(135, 80)">
        <path d="M 0 0 Q 6 -5 12 -3" stroke={ACCENT_CORAL} strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 2" />
      </g>

      {/* Selo "+1" no canto */}
      <g transform="translate(180, 50) rotate(8)">
        <rect x="-12" y="-8" width="24" height="16" rx="8" fill={ACCENT_TEAL} stroke={STROKE} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill={STROKE} fontFamily="system-ui">+1</text>
      </g>
    </Frame>
  );
}

/** Mapeia número da cena (01-15) para o componente de ilustração. */
export const ILUSTRACAO_POR_CENA: Record<string, (props: IlustracaoProps) => ReactNode> = {
  "01": CenaCeu,
  "02": CenaBarraca,
  "03": CenaCall,
  "04": CenaCafe,
  "05": CenaDupla,
  "06": CenaCaos,
  "07": CenaEduardo,
  "08": CenaIcaro,
  "09": CenaEvolucao,
  "10": CenaRafael,
  "11": CenaPadaria,
  "12": CenaSala,
  "13": CenaCasa,
  "14": CenaTime,
  "15": CenaCoragem,
};
