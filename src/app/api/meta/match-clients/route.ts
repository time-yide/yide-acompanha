import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listAvailableAccounts, metaFetch } from "@/lib/social-media/meta-publish";

const ALLOWED_ROLES = ["adm", "socio"];

interface AdAccount {
  id: string;
  name: string;
  accountId: string;
}

async function fetchAdAccounts(): Promise<AdAccount[]> {
  const accounts: AdAccount[] = [];
  let after: string | undefined;

  for (let i = 0; i < 10; i++) {
    const res = await metaFetch<{
      data?: Array<{ id: string; name?: string; account_id?: string }>;
      paging?: { cursors?: { after?: string }; next?: string };
    }>("/me/adaccounts", {
      body: {
        fields: "id,name,account_id",
        limit: 100,
        ...(after ? { after } : {}),
      },
    });
    if (res.error) break;
    for (const a of res.data?.data ?? []) {
      accounts.push({
        id: a.id,
        name: a.name ?? a.id,
        accountId: a.account_id ?? a.id.replace("act_", ""),
      });
    }
    const next = res.data?.paging?.next;
    after = res.data?.paging?.cursors?.after;
    if (!next || !after) break;
  }

  return accounts;
}

export async function GET() {
  const actor = await requireAuth();
  if (!ALLOWED_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const [metaResult, adAccounts, clients] = await Promise.all([
    listAvailableAccounts(),
    fetchAdAccounts(),
    fetchActiveClients(),
  ]);

  if (metaResult.error) {
    return NextResponse.json({ error: metaResult.error }, { status: 500 });
  }

  const accounts = metaResult.accounts ?? [];
  const matches = matchAccountsToClients(accounts, clients);

  return new NextResponse(
    renderPage(matches, accounts, adAccounts, clients.length),
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function POST(req: Request) {
  const actor = await requireAuth();
  if (!ALLOWED_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = (await req.json()) as {
    updates: {
      clientId: string;
      pageId: string | null;
      igId: string | null;
      adAccountId: string | null;
    }[];
  };

  const sb = createServiceRoleClient();
  let success = 0;
  let fail = 0;

  for (const u of body.updates) {
    const { error } = await sb
      .from("clients")
      .update({
        facebook_page_id: u.pageId,
        instagram_business_id: u.igId,
        meta_ad_account_id: u.adAccountId,
      })
      .eq("id", u.clientId);

    if (error) {
      fail++;
      console.error("Meta match update error:", u.clientId, error.message);
    } else {
      success++;
    }
  }

  return NextResponse.json({ success, fail });
}

interface Client {
  id: string;
  nome: string;
  instagram_url: string | null;
  facebook_page_id: string | null;
  instagram_business_id: string | null;
  meta_ad_account_id: string | null;
}

async function fetchActiveClients(): Promise<Client[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("clients")
    .select(
      "id, nome, instagram_url, facebook_page_id, instagram_business_id, meta_ad_account_id",
    )
    .eq("status", "ativo")
    .order("nome");
  return data ?? [];
}

interface MetaAccount {
  pageId: string;
  pageName: string;
  igId: string | null;
  igUsername: string | null;
}

interface Match {
  clientId: string;
  clientNome: string;
  pageId: string;
  pageName: string;
  igId: string | null;
  igUsername: string | null;
  method: string;
  alreadyConnected: boolean;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractHandle(url: string | null): string {
  if (!url) return "";
  return (
    url
      .replace(/\/$/, "")
      .split("/")
      .pop()
      ?.split("?")[0]
      ?.replace(/^@/, "")
      .toLowerCase() ?? ""
  );
}

function matchAccountsToClients(
  accounts: MetaAccount[],
  clients: Client[],
): {
  matched: Match[];
  unmatched: Client[];
} {
  const matched: Match[] = [];
  const usedClients = new Set<string>();

  for (const client of clients) {
    const handle = extractHandle(client.instagram_url);
    let bestMatch: MetaAccount | null = null;
    let method = "";

    if (handle) {
      const found = accounts.find(
        (a) => a.igUsername?.toLowerCase() === handle,
      );
      if (found) {
        bestMatch = found;
        method = "Instagram handle";
      }
    }

    if (!bestMatch) {
      const normClient = normalize(client.nome);
      if (normClient.length >= 4) {
        const found = accounts.find((a) => {
          const normPage = normalize(a.pageName);
          return normPage.includes(normClient) || normClient.includes(normPage);
        });
        if (found) {
          bestMatch = found;
          method = "Nome";
        }
      }
    }

    if (!bestMatch && handle && handle.length >= 4) {
      const found = accounts.find(
        (a) =>
          a.igUsername &&
          (a.igUsername.toLowerCase().includes(handle) ||
            handle.includes(a.igUsername.toLowerCase())),
      );
      if (found) {
        bestMatch = found;
        method = "Handle parcial";
      }
    }

    if (bestMatch) {
      const alreadyConnected =
        client.facebook_page_id === bestMatch.pageId &&
        (!bestMatch.igId || client.instagram_business_id === bestMatch.igId);

      matched.push({
        clientId: client.id,
        clientNome: client.nome,
        pageId: bestMatch.pageId,
        pageName: bestMatch.pageName,
        igId: bestMatch.igId,
        igUsername: bestMatch.igUsername,
        method,
        alreadyConnected,
      });
      usedClients.add(client.id);
    }
  }

  const unmatched = clients.filter((c) => !usedClients.has(c.id));
  return { matched, unmatched };
}

function renderPage(
  result: { matched: Match[]; unmatched: Client[] },
  allAccounts: MetaAccount[],
  adAccounts: AdAccount[],
  totalClients: number,
): string {
  const { matched, unmatched } = result;
  const newMatches = matched.filter((m) => !m.alreadyConnected);
  const already = matched.filter((m) => m.alreadyConnected);

  const matchRows = newMatches
    .map(
      (m, i) => `
    <tr>
      <td><input type="checkbox" checked data-idx="${i}"></td>
      <td><strong>${esc(m.clientNome)}</strong></td>
      <td>${esc(m.pageName)}</td>
      <td>${m.igUsername ? "@" + esc(m.igUsername) : "-"}</td>
      <td><span class="tag ${m.method === "Instagram handle" ? "auto" : "manual"}">${esc(m.method)}</span></td>
    </tr>`,
    )
    .join("");

  const alreadyRows = already
    .map(
      (m) => `
    <tr class="dim">
      <td>✓</td>
      <td>${esc(m.clientNome)}</td>
      <td>${esc(m.pageName)}</td>
      <td>${m.igUsername ? "@" + esc(m.igUsername) : "-"}</td>
      <td>Já conectado</td>
    </tr>`,
    )
    .join("");

  const pageOptions = allAccounts
    .map((a) => `<option value="${esc(a.pageId)}" data-ig="${esc(a.igId ?? "")}">${esc(a.pageName)}${a.igUsername ? " (@" + esc(a.igUsername) + ")" : ""}</option>`)
    .join("");

  const adOptions = adAccounts
    .map((a) => `<option value="${esc(a.id)}">${esc(a.name)} (${esc(a.accountId)})</option>`)
    .join("");

  const unmatchedRows = unmatched
    .filter((c) => !c.nome.toLowerCase().startsWith("ecommerce"))
    .map(
      (c) => `
    <tr data-client-id="${esc(c.id)}">
      <td><strong>${esc(c.nome)}</strong></td>
      <td>
        <select class="sel page-sel">
          <option value="">— Selecione página —</option>
          ${pageOptions}
        </select>
      </td>
      <td>
        <select class="sel ad-sel">
          <option value="">— Conta de anúncio —</option>
          ${adOptions}
        </select>
      </td>
    </tr>`,
    )
    .join("");

  const adMatchRows = matched
    .filter((m) => !m.alreadyConnected)
    .map(
      (m) => `
    <tr>
      <td>${esc(m.clientNome)}</td>
      <td>${esc(m.pageName)}</td>
      <td>
        <select class="sel ad-auto-sel" data-client-id="${esc(m.clientId)}">
          <option value="">— Conta de anúncio —</option>
          ${adOptions}
        </select>
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar Meta</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; padding: 1rem; max-width: 960px; margin: 0 auto; background: #fafaf9; color: #1a1916; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  .sub { color: #6b6860; font-size: .875rem; margin-bottom: 1rem; }
  .stats { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .stat { background: #fff; border: 1px solid #e5e2dd; border-radius: 8px; padding: .5rem .75rem; font-size: .8rem; flex: 1; min-width: 80px; text-align: center; }
  .stat strong { display: block; font-size: 1.3rem; }
  .green strong { color: #1da851; }
  .blue strong { color: #1877f2; }
  .purple strong { color: #7c3aed; }
  table { width: 100%; border-collapse: collapse; font-size: .8125rem; margin-bottom: 1rem; }
  th { text-align: left; padding: .5rem; border-bottom: 2px solid #e5e2dd; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #6b6860; }
  td { padding: .5rem; border-bottom: 1px solid #eee; vertical-align: middle; }
  tr:hover { background: #f5f3f0; }
  tr.dim { opacity: .5; }
  input[type=checkbox] { width: 16px; height: 16px; accent-color: #1877f2; }
  .tag { font-size: .625rem; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; }
  .tag.auto { background: #dbeafe; color: #1d4ed8; }
  .tag.manual { background: #fef3c7; color: #92400e; }
  .section { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #6b6860; margin: 1.5rem 0 .5rem; padding-bottom: .25rem; border-bottom: 1px solid #e5e2dd; }
  .btn { display: block; width: 100%; padding: .75rem; background: #1877f2; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1rem; }
  .btn:hover { background: #1565d8; }
  .btn:disabled { background: #ccc; cursor: not-allowed; }
  .btn.green { background: #1da851; }
  .btn.green:hover { background: #178c43; }
  .result { padding: 1rem; background: #e8faf0; border-radius: 8px; margin-top: 1rem; font-weight: 600; }
  .result.error { background: #fef2f2; color: #dc3545; }
  .sel { width: 100%; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: .75rem; background: #fff; }
  @media (max-width: 600px) { table { font-size: .75rem; } td, th { padding: .375rem .25rem; } .sel { font-size: .7rem; } }
</style>
</head><body>
<h1>Conectar Meta</h1>
<p class="sub">${allAccounts.length} páginas + ${adAccounts.length} contas de anúncio no Meta &times; ${totalClients} clientes ativos</p>
<div class="stats">
  <div class="stat green"><strong>${newMatches.length}</strong>Novos matches</div>
  <div class="stat blue"><strong>${already.length}</strong>Já conectados</div>
  <div class="stat purple"><strong>${adAccounts.length}</strong>Contas de anúncio</div>
  <div class="stat"><strong>${unmatched.length}</strong>Sem match</div>
</div>

${newMatches.length > 0 ? `
<div class="section">Matches automáticos (confirme e salve)</div>
<div style="overflow-x:auto">
<table id="matchTable">
  <thead><tr><th></th><th>Cliente</th><th>Página FB</th><th>Instagram</th><th>Como</th></tr></thead>
  <tbody>${matchRows}</tbody>
</table>
</div>

${adAccounts.length > 0 && adMatchRows ? `
<div class="section">Conta de anúncio para os matches acima</div>
<div style="overflow-x:auto">
<table id="adTable">
  <thead><tr><th>Cliente</th><th>Página</th><th>Conta de anúncio</th></tr></thead>
  <tbody>${adMatchRows}</tbody>
</table>
</div>
` : ""}

<button class="btn" id="saveBtn" onclick="saveAuto()">Salvar matches selecionados</button>
<div id="result" hidden></div>
` : "<p>Nenhum match automático novo!</p>"}

${unmatchedRows ? `
<div class="section">Conectar manualmente</div>
<p style="font-size:.8rem;color:#6b6860;margin-bottom:.5rem">Escolha a página e/ou conta de anúncio pra cada cliente:</p>
<div style="overflow-x:auto">
<table id="manualTable">
  <thead><tr><th>Cliente</th><th>Página FB / Instagram</th><th>Conta de anúncio</th></tr></thead>
  <tbody>${unmatchedRows}</tbody>
</table>
</div>
<button class="btn green" id="saveManualBtn" onclick="saveManual()">Salvar conexões manuais</button>
<div id="manualResult" hidden></div>
` : ""}

${already.length > 0 ? `
<div class="section">Já conectados</div>
<div style="overflow-x:auto">
<table>
  <thead><tr><th></th><th>Cliente</th><th>Página FB</th><th>Instagram</th><th>Status</th></tr></thead>
  <tbody>${alreadyRows}</tbody>
</table>
</div>` : ""}

<script>
const NEW_MATCHES = ${JSON.stringify(newMatches.map((m) => ({ clientId: m.clientId, pageId: m.pageId, igId: m.igId })))};

async function saveAuto() {
  const checks = document.querySelectorAll('#matchTable input[type=checkbox]');
  const updates = [];
  checks.forEach((c, i) => {
    if (c.checked) {
      const m = NEW_MATCHES[i];
      const adSel = document.querySelector('.ad-auto-sel[data-client-id="' + m.clientId + '"]');
      updates.push({
        clientId: m.clientId,
        pageId: m.pageId,
        igId: m.igId,
        adAccountId: adSel ? adSel.value || null : null,
      });
    }
  });
  if (!updates.length) { alert('Nenhum selecionado'); return; }
  await doSave(updates, 'saveBtn', 'result');
}

async function saveManual() {
  const rows = document.querySelectorAll('#manualTable tbody tr');
  const updates = [];
  rows.forEach(r => {
    const clientId = r.dataset.clientId;
    const pageSel = r.querySelector('.page-sel');
    const adSel = r.querySelector('.ad-sel');
    const pageId = pageSel ? pageSel.value : '';
    const adAccountId = adSel ? adSel.value : '';
    if (pageId || adAccountId) {
      const igId = pageSel && pageId ? pageSel.selectedOptions[0].dataset.ig || null : null;
      updates.push({ clientId, pageId: pageId || null, igId, adAccountId: adAccountId || null });
    }
  });
  if (!updates.length) { alert('Selecione ao menos uma página ou conta'); return; }
  await doSave(updates, 'saveManualBtn', 'manualResult');
}

async function doSave(updates, btnId, resultId) {
  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    const res = await fetch('/api/meta/match-clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    const data = await res.json();
    const el = document.getElementById(resultId);
    el.hidden = false;
    if (data.success > 0) {
      el.className = 'result';
      el.textContent = data.success + ' clientes atualizados!' + (data.fail ? ' (' + data.fail + ' erros)' : '');
    } else {
      el.className = 'result error';
      el.textContent = 'Erro ao salvar';
    }
    btn.textContent = 'Salvo!';
  } catch (e) {
    const el = document.getElementById(resultId);
    el.hidden = false;
    el.className = 'result error';
    el.textContent = 'Erro: ' + e.message;
    btn.disabled = false;
    btn.textContent = 'Tentar novamente';
  }
}
</script>
</body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
