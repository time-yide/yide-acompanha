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
  const rows = buildRows(accounts, adAccounts, clients);

  return new NextResponse(
    renderPage(rows, accounts, adAccounts, clients.length),
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
        facebook_page_id: u.pageId ?? null,
        instagram_business_id: u.igId ?? null,
        meta_ad_account_id: u.adAccountId ?? null,
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

interface Row {
  clientId: string;
  clientNome: string;
  pageId: string | null;
  pageName: string | null;
  igId: string | null;
  igUsername: string | null;
  pageMethod: string;
  adAccountId: string | null;
  adAccountName: string | null;
  adMethod: string;
  status: "new" | "already" | "unmatched";
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

function extractAdName(adName: string): string {
  return adName.replace(/^CA\s*[-–—]\s*/i, "").trim();
}

function matchAdAccount(
  client: Client,
  adAccounts: AdAccount[],
): { ad: AdAccount; method: string } | null {
  if (client.meta_ad_account_id) {
    const found = adAccounts.find((a) => a.id === client.meta_ad_account_id);
    if (found) return { ad: found, method: "Já salvo" };
  }

  const normClient = normalize(client.nome);
  if (normClient.length < 3) return null;

  const handle = extractHandle(client.instagram_url);

  for (const ad of adAccounts) {
    const cleanName = extractAdName(ad.name);
    const normAd = normalize(cleanName);
    if (normAd.length < 3) continue;

    if (normAd === normClient) return { ad, method: "Nome exato" };

    if (
      normAd.length >= 4 &&
      (normAd.includes(normClient) || normClient.includes(normAd))
    ) {
      return { ad, method: "Nome parcial" };
    }

    if (handle && handle.length >= 4 && normalize(cleanName).includes(normalize(handle))) {
      return { ad, method: "Handle" };
    }
  }

  return null;
}

function buildRows(
  accounts: MetaAccount[],
  adAccounts: AdAccount[],
  clients: Client[],
): Row[] {
  const rows: Row[] = [];

  for (const client of clients) {
    const handle = extractHandle(client.instagram_url);
    let bestPage: MetaAccount | null = null;
    let pageMethod = "";

    if (handle) {
      const found = accounts.find(
        (a) => a.igUsername?.toLowerCase() === handle,
      );
      if (found) {
        bestPage = found;
        pageMethod = "IG handle";
      }
    }

    if (!bestPage) {
      const normClient = normalize(client.nome);
      if (normClient.length >= 4) {
        const found = accounts.find((a) => {
          const normPage = normalize(a.pageName);
          return normPage.includes(normClient) || normClient.includes(normPage);
        });
        if (found) {
          bestPage = found;
          pageMethod = "Nome";
        }
      }
    }

    if (!bestPage && handle && handle.length >= 4) {
      const found = accounts.find(
        (a) =>
          a.igUsername &&
          (a.igUsername.toLowerCase().includes(handle) ||
            handle.includes(a.igUsername.toLowerCase())),
      );
      if (found) {
        bestPage = found;
        pageMethod = "Handle parcial";
      }
    }

    const adMatch = matchAdAccount(client, adAccounts);

    const pageAlreadyConnected = bestPage
      ? client.facebook_page_id === bestPage.pageId
      : false;
    const adAlreadyConnected = adMatch
      ? client.meta_ad_account_id === adMatch.ad.id
      : false;

    const hasPage = !!bestPage;
    const hasAd = !!adMatch;

    let status: Row["status"] = "unmatched";
    if (hasPage || hasAd) {
      const allAlready =
        (!hasPage || pageAlreadyConnected) && (!hasAd || adAlreadyConnected);
      status = allAlready ? "already" : "new";
    }

    rows.push({
      clientId: client.id,
      clientNome: client.nome,
      pageId: bestPage?.pageId ?? null,
      pageName: bestPage?.pageName ?? null,
      igId: bestPage?.igId ?? null,
      igUsername: bestPage?.igUsername ?? null,
      pageMethod,
      adAccountId: adMatch?.ad.id ?? null,
      adAccountName: adMatch ? `${adMatch.ad.name} (${adMatch.ad.accountId})` : null,
      adMethod: adMatch?.method ?? "",
      status,
    });
  }

  return rows;
}

function renderPage(
  rows: Row[],
  allAccounts: MetaAccount[],
  adAccounts: AdAccount[],
  totalClients: number,
): string {
  const newRows = rows.filter((r) => r.status === "new");
  const alreadyRows = rows.filter((r) => r.status === "already");
  const unmatchedRows = rows.filter(
    (r) => r.status === "unmatched" && !r.clientNome.toLowerCase().startsWith("ecommerce"),
  );

  const pageOptions = allAccounts
    .map(
      (a) =>
        `<option value="${esc(a.pageId)}" data-ig="${esc(a.igId ?? "")}">${esc(a.pageName)}${a.igUsername ? " (@" + esc(a.igUsername) + ")" : ""}</option>`,
    )
    .join("");

  const adOptions = adAccounts
    .map(
      (a) =>
        `<option value="${esc(a.id)}">${esc(a.name)} (${esc(a.accountId)})</option>`,
    )
    .join("");

  const newMatchHtml = newRows
    .map(
      (r, i) => `
    <tr>
      <td><input type="checkbox" checked data-idx="${i}"></td>
      <td><strong>${esc(r.clientNome)}</strong></td>
      <td>${r.pageName ? esc(r.pageName) + (r.igUsername ? " <small>@" + esc(r.igUsername) + "</small>" : "") : "<em>-</em>"}</td>
      <td><span class="tag auto">${esc(r.pageMethod)}</span></td>
      <td>${r.adAccountName ? esc(r.adAccountName) : `<select class="sel ad-new-sel" data-idx="${i}"><option value="">— Selecione —</option>${adOptions}</select>`}</td>
      <td>${r.adMethod ? `<span class="tag ${r.adMethod === "Nome exato" ? "auto" : "manual"}">${esc(r.adMethod)}</span>` : ""}</td>
    </tr>`,
    )
    .join("");

  const alreadyHtml = alreadyRows
    .map(
      (r) => `
    <tr class="dim">
      <td>✓</td>
      <td>${esc(r.clientNome)}</td>
      <td>${r.pageName ? esc(r.pageName) : "-"}</td>
      <td>-</td>
      <td>${r.adAccountName ? esc(r.adAccountName) : "-"}</td>
      <td>Já conectado</td>
    </tr>`,
    )
    .join("");

  const manualHtml = unmatchedRows
    .map(
      (r) => `
    <tr data-client-id="${esc(r.clientId)}">
      <td><strong>${esc(r.clientNome)}</strong></td>
      <td><select class="sel page-sel"><option value="">— Página —</option>${pageOptions}</select></td>
      <td><select class="sel ad-sel"><option value="">— Conta anúncio —</option>${adOptions}</select></td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar Meta</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; padding: 1rem; max-width: 1000px; margin: 0 auto; background: #fafaf9; color: #1a1916; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  .sub { color: #6b6860; font-size: .875rem; margin-bottom: 1rem; }
  .stats { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .stat { background: #fff; border: 1px solid #e5e2dd; border-radius: 8px; padding: .5rem .75rem; font-size: .8rem; flex: 1; min-width: 80px; text-align: center; }
  .stat strong { display: block; font-size: 1.3rem; }
  .green strong { color: #1da851; }
  .blue strong { color: #1877f2; }
  .purple strong { color: #7c3aed; }
  table { width: 100%; border-collapse: collapse; font-size: .8125rem; margin-bottom: 1rem; }
  th { text-align: left; padding: .5rem; border-bottom: 2px solid #e5e2dd; font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: #6b6860; }
  td { padding: .5rem; border-bottom: 1px solid #eee; vertical-align: middle; }
  small { color: #6b6860; }
  tr:hover { background: #f5f3f0; }
  tr.dim { opacity: .5; }
  input[type=checkbox] { width: 16px; height: 16px; accent-color: #1877f2; }
  .tag { font-size: .6rem; font-weight: 600; text-transform: uppercase; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
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
  .sel { width: 100%; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: .7rem; background: #fff; }
  @media (max-width: 700px) { table { font-size: .7rem; } td, th { padding: .3rem .2rem; } }
</style>
</head><body>
<h1>Conectar Meta</h1>
<p class="sub">${allAccounts.length} páginas + ${adAccounts.length} contas de anúncio &times; ${totalClients} clientes</p>
<div class="stats">
  <div class="stat green"><strong>${newRows.length}</strong>Novos matches</div>
  <div class="stat blue"><strong>${alreadyRows.length}</strong>Já conectados</div>
  <div class="stat purple"><strong>${adAccounts.length}</strong>Contas de anúncio</div>
  <div class="stat"><strong>${unmatchedRows.length}</strong>Sem match</div>
</div>

${newRows.length > 0 ? `
<div class="section">Matches automáticos — página + conta de anúncio</div>
<div style="overflow-x:auto">
<table id="matchTable">
  <thead><tr><th></th><th>Cliente</th><th>Página / IG</th><th>Via</th><th>Conta de anúncio</th><th>Via</th></tr></thead>
  <tbody>${newMatchHtml}</tbody>
</table>
</div>
<button class="btn" id="saveBtn" onclick="saveAuto()">Salvar ${newRows.length} matches</button>
<div id="result" hidden></div>
` : "<p>Nenhum match automático novo!</p>"}

${manualHtml ? `
<div class="section">Conectar manualmente</div>
<div style="overflow-x:auto">
<table id="manualTable">
  <thead><tr><th>Cliente</th><th>Página FB / IG</th><th>Conta de anúncio</th></tr></thead>
  <tbody>${manualHtml}</tbody>
</table>
</div>
<button class="btn green" id="saveManualBtn" onclick="saveManual()">Salvar manuais</button>
<div id="manualResult" hidden></div>
` : ""}

${alreadyHtml ? `
<div class="section">Já conectados</div>
<div style="overflow-x:auto">
<table>
  <thead><tr><th></th><th>Cliente</th><th>Página</th><th></th><th>Conta anúncio</th><th>Status</th></tr></thead>
  <tbody>${alreadyHtml}</tbody>
</table>
</div>` : ""}

<script>
const NEW_ROWS = ${JSON.stringify(newRows.map((r) => ({ clientId: r.clientId, pageId: r.pageId, igId: r.igId, adAccountId: r.adAccountId })))};

async function saveAuto() {
  const checks = document.querySelectorAll('#matchTable input[type=checkbox]');
  const updates = [];
  checks.forEach((c, i) => {
    if (!c.checked) return;
    const r = NEW_ROWS[i];
    const adSel = document.querySelector('.ad-new-sel[data-idx="' + i + '"]');
    updates.push({
      clientId: r.clientId,
      pageId: r.pageId,
      igId: r.igId,
      adAccountId: r.adAccountId || (adSel ? adSel.value || null : null),
    });
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
    if (!pageId && !adAccountId) return;
    const igId = pageSel && pageId ? pageSel.selectedOptions[0].dataset.ig || null : null;
    updates.push({ clientId, pageId: pageId || null, igId, adAccountId: adAccountId || null });
  });
  if (!updates.length) { alert('Selecione ao menos uma'); return; }
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
