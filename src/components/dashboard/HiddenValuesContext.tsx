"use client";

/**
 * Esconde valores monetários no dashboard por privacidade (escritório aberto).
 * Padrão estilo banco: tudo `R$ ••••••` por default, click no olhinho revela.
 *
 * Persiste a preferência em localStorage por sessão. Cada dashboard precisa
 * ser envolto em <HiddenValuesProvider> e ter um <HiddenValueToggle> no header.
 * Onde antes era `formatBRL(n)`, usar `<Money value={n} />`.
 */

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "yide:dashboard-values-hidden";
const STORAGE_EVENT = "yide:dashboard-values-changed";

interface Ctx {
  hidden: boolean;
  toggle: () => void;
}

const HiddenValuesCtx = createContext<Ctx>({ hidden: true, toggle: () => {} });

// useSyncExternalStore: padrão React pra sincronizar com state externo
// (localStorage). Evita SSR/client mismatch e a regra react-hooks/set-state-in-effect.
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Reage tanto a outras tabs (event "storage" nativo) quanto ao toggle local
  // (custom event despachado em setHiddenStored).
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "false";
}

function getServerSnapshot(): boolean {
  return true;
}

function setHiddenStored(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function HiddenValuesProvider({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => setHiddenStored(!hidden), [hidden]);
  return (
    <HiddenValuesCtx.Provider value={{ hidden, toggle }}>
      {children}
    </HiddenValuesCtx.Provider>
  );
}

export function useHiddenValues(): Ctx {
  return useContext(HiddenValuesCtx);
}

export function HiddenValueToggle({ className }: { className?: string }) {
  const { hidden, toggle } = useHiddenValues();
  const Icon = hidden ? Eye : EyeOff;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={hidden ? "Mostrar valores" : "Esconder valores"}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        className,
      )}
      title={hidden ? "Mostrar valores" : "Esconder valores"}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{hidden ? "Mostrar valores" : "Esconder valores"}</span>
    </button>
  );
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const BRL_NO_DECIMALS = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface MoneyProps {
  value: number;
  /** Quando true, esconde decimais (ex: KpiRow). Default false. */
  noDecimals?: boolean;
}

export function Money({ value, noDecimals = false }: MoneyProps) {
  const { hidden } = useHiddenValues();
  if (hidden) {
    return <span className="select-none tracking-wider">R$ ••••••</span>;
  }
  const formatted = noDecimals ? BRL_NO_DECIMALS(value) : BRL(value);
  return <span>{formatted}</span>;
}
