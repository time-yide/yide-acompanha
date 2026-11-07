"use client";
import { useState } from "react";
import { whatsappComTexto } from "@/lib/site/contato";
import { montarMensagemDiagnostico, OBJETIVOS } from "@/lib/site/diagnostico";

export function FormDiagnostico() {
  const [erro, setErro] = useState<string | null>(null);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = montarMensagemDiagnostico({
      nome: String(f.get("nome") ?? ""),
      empresa: String(f.get("empresa") ?? ""),
      cidade: String(f.get("cidade") ?? ""),
      objetivo: String(f.get("objetivo") ?? ""),
    });
    if (!r.ok) { setErro(r.erro); return; }
    setErro(null);
    window.location.href = whatsappComTexto(r.texto);
  }

  const campo = "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";
  return (
    <form onSubmit={enviar} noValidate className="space-y-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <label className="block text-sm font-semibold text-neutral-800">Seu nome
        <input id="diag-nome" name="nome" autoComplete="name" className={campo} />
      </label>
      <label className="block text-sm font-semibold text-neutral-800">Empresa e segmento
        <input id="diag-empresa" name="empresa" placeholder="Ex.: Pizzaria, clínica, loja de roupas" className={campo} />
      </label>
      <label className="block text-sm font-semibold text-neutral-800">Cidade
        <input id="diag-cidade" name="cidade" defaultValue="Cuiabá" className={campo} />
      </label>
      <label className="block text-sm font-semibold text-neutral-800">O que você mais quer agora?
        <select id="diag-objetivo" name="objetivo" defaultValue="" className={campo}>
          <option value="" disabled>Escolha uma opção</option>
          {OBJETIVOS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      {erro && <p role="alert" className="text-sm font-medium text-red-700">{erro}</p>}
      <button type="submit" className="w-full rounded-full bg-teal-600 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-teal-700">
        Enviar pelo WhatsApp
      </button>
      <p className="text-center text-xs text-neutral-500">Ao enviar, o WhatsApp abre com a sua mensagem pronta.</p>
    </form>
  );
}
