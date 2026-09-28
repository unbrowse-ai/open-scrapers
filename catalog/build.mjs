#!/usr/bin/env node
// Builds catalog/sites.json, catalog/README.md and catalog/sites/<letter>.md from the public Unbrowse registry (no key needed).
//
// GET /api/v1/sites lists a sample and GET /api/v1/sites?q= returns the best matches for a query,
// so the full list is gathered by sweeping queries: seed words, then every word seen in the hosts
// found so far, until a sweep turns up nothing new. Then GET /api/v1/sites/<host> for each host's tools.
//
//   node catalog/build.mjs [--max-queries 1500] [--concurrency 8]
import fs from "node:fs";
import { parseArgs } from "../lib/read-page.mjs";

const API = process.env.UNBROWSE_BASE_URL?.replace(/\/+$/, "").replace(/(\/api\/v1)?$/, "/api/v1") ?? "https://unbrowse.ai/api/v1";
const ORIGIN = API.replace(/\/api\/v1$/, "");
const { flags } = parseArgs(process.argv.slice(2));
const MAX_QUERIES = Number(flags["max-queries"] ?? 1500);
const CONCURRENCY = Number(flags.concurrency ?? 8);
const OUT = new URL(".", import.meta.url);

// Not listed: adult sites, and hosts that are only an IP, localhost or an internal name.
const SKIP = /porn|xxx|sex|hentai|adult|escort|nsfw|onlyfans|xvideo|xhamster|redtube|brazzers|camgirl|chaturbate|nude|erotic|fetish|^\d+\.\d+\.\d+\.\d+$|localhost|\.internal$|\.local$/i;

const SEEDS = `a e i o u com org net io ai co app dev gov edu news shop store search jobs travel flights hotels
finance bank crypto stock market weather food recipe health medical government education school university code api
docs blog video music movie tv sports football game games book books library science research data map maps real estate
rent car cars auto bike fashion beauty home garden pets kids law legal tax insurance energy climate space tech software
cloud security social forum community events tickets concert art photo design marketing ads analytics email calendar
chat translate dictionary wiki encyclopedia history museum police court transport train bus airline airport ship
shipping package tracking price compare deals coupon review reviews rating restaurant delivery grocery pharmacy doctor
hospital clinic dentist gym fitness yoga sport golf tennis nba nfl soccer cricket esports twitch stream podcast radio
anime manga comic novel poetry quote quotes jokes fun random fact facts trivia quiz test exam course learn tutorial
programming python javascript rust go java npm package registry github git linux docker kubernetes ai model llm
dataset statistics census election vote parliament congress senate city state country world europe asia africa america
uk us india china japan korea germany france spain italy brazil mexico canada australia singapore indonesia vietnam
thailand philippines malaysia russia turkey nigeria kenya egypt israel uae saudi pakistan bangladesh`.split(/\s+/).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      if (res.ok) return await res.json();
      if (i >= tries || (res.status < 500 && res.status !== 429)) throw new Error(`${url}: HTTP ${res.status}`);
    } catch (err) {
      if (i >= tries) throw err;
    }
    await sleep(1000 * 2 ** i);
  }
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// 1. Hosts: the plain list, then query sweeps until nothing new turns up.
const hosts = new Set();
const first = await getJson(`${API}/sites?limit=5000`);
const total = first.total;
for (const s of first.sites ?? []) hosts.add(s.host);
const asked = new Set();
let queue = [...SEEDS];
while (queue.length && asked.size < MAX_QUERIES) {
  const batch = queue.filter((q) => !asked.has(q)).slice(0, MAX_QUERIES - asked.size);
  batch.forEach((q) => asked.add(q));
  const before = hosts.size;
  await pool(batch, CONCURRENCY, async (q) => {
    const d = await getJson(`${API}/sites?q=${encodeURIComponent(q)}`).catch(() => null);
    for (const s of d?.sites ?? []) hosts.add(s.host);
  });
  process.stderr.write(`swept ${asked.size} queries: ${hosts.size} hosts (+${hosts.size - before})\n`);
  // Next sweep: every word in the hosts found so far that has not been asked yet.
  const words = new Set();
  for (const h of hosts) for (const w of h.split(/[.\-_]/)) if (w.length >= 3 && !/^\d+$/.test(w) && !asked.has(w)) words.add(w);
  queue = [...words];
  if (hosts.size === before && asked.size > SEEDS.length) break;
}

// 2. Each host's tools.
const sites = [];
await pool([...hosts].filter((h) => !SKIP.test(h)).sort(), CONCURRENCY, async (host) => {
  const d = await getJson(`${API}/sites/${host}`).catch(() => null);
  const tools = (d?.tools ?? []).filter((t) => t.public !== false).map((t) => ({
    name: t.name,
    title: t.title ?? t.name,
    inputs: Object.keys(t.inputSchema?.properties ?? {}),
    readOnly: t.readOnly ?? null,
  }));
  if (!tools.length) return;
  sites.push({ host, tools, openapi: `${ORIGIN}/api/v1/sites/${host}/openapi.json`, mcp: `${ORIGIN}/api/v1/sites/${host}/mcp` });
});
sites.sort((a, b) => a.host.localeCompare(b.host));
const toolCount = sites.reduce((n, s) => n + s.tools.length, 0);
const builtAt = new Date().toISOString().slice(0, 10);

// One site per line: small diffs when the catalog is regenerated.
fs.writeFileSync(new URL("sites.json", OUT), `{"builtAt":"${builtAt}","registryTools":${total},"sites":${sites.length},"tools":${toolCount},"items":[\n${sites.map((x) => JSON.stringify(x)).join(",\n")}\n]}\n`);

// 3. Markdown: README (usage, the sites with the most tools, the index) and one table page per letter.
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const HEAD = "| Site | Tools | What they do | API |\n|---|---:|---|---|";
const row = (s) => {
  const titles = [...new Set(s.tools.map((t) => t.title))];
  const shown = cut(titles.slice(0, 3).join("; "), 110) + (titles.length > 3 ? ` (+${titles.length - 3} more)` : "");
  return `| [${s.host}](https://${s.host}) | ${s.tools.length} | ${esc(shown)} | [OpenAPI](${s.openapi}) · [MCP](${s.mcp}) |`;
};
const letter = (h) => (/^[a-z]/.test(h) ? h[0] : "0-9");
const groups = new Map();
for (const s of sites) groups.set(letter(s.host), [...(groups.get(letter(s.host)) ?? []), s]);
fs.rmSync(new URL("sites/", OUT), { recursive: true, force: true });
fs.mkdirSync(new URL("sites/", OUT), { recursive: true });
for (const [l, list] of groups) {
  fs.writeFileSync(new URL(`sites/${l}.md`, OUT), `# Sites: ${l.toUpperCase()}\n\n${list.length} sites. Back to the [catalog](../README.md).\n\n${HEAD}\n${list.map(row).join("\n")}\n`);
}
const index = [...groups.keys()].sort().map((l) => `[${l.toUpperCase()}](sites/${l}.md) (${groups.get(l).length})`).join(" · ");
const top = [...sites].sort((a, b) => b.tools.length - a.tools.length || a.host.localeCompare(b.host)).slice(0, 100);
const readme = `# Site API catalog

${sites.length.toLocaleString("en-US")} websites with ${toolCount.toLocaleString("en-US")} ready-made tools, generated ${builtAt} from the public [Unbrowse](https://unbrowse.ai) registry (${total.toLocaleString("en-US")} tools registry-wide; this list holds the sites a query sweep reaches). Every site is callable from code as a REST API (OpenAPI 3.1) or as its own MCP server.

Regenerate with \`npm run catalog\` (reading the registry needs no key; calling a tool needs a free key from https://unbrowse.ai).

## Use a catalog site

\`\`\`js
import { Unbrowse } from "@unbrowse/sdk";
const ub = new Unbrowse(); // reads UNBROWSE_API_KEY

const site = await ub.site("arxiv.org");      // tools and their input schemas
const spec = await ub.openapi("arxiv.org");   // OpenAPI 3.1, for code generators
const run = await ub.callTool("arxiv.org", "arxiv_org__get_search", { query: "attention is all you need" });
console.log(run.status, run.result);          // "succeeded", { title, text, links, ... }
console.log(ub.siteMcpUrl("arxiv.org"));      // https://unbrowse.ai/api/v1/sites/arxiv.org/mcp
\`\`\`

As an MCP server (Claude Code shown; any MCP client that speaks streamable HTTP works):

\`\`\`bash
claude mcp add --transport http arxiv https://unbrowse.ai/api/v1/sites/arxiv.org/mcp \\
  --header "Authorization: Bearer $UNBROWSE_API_KEY"
\`\`\`

Or every site at once through the hosted MCP at \`https://unbrowse.ai/mcp\`. More in [USING.md](USING.md).

Machine-readable: [sites.json](sites.json) (host, tools with name, title and input names, OpenAPI and MCP URLs).

## All sites by letter

${index}

## Sites with the most tools

${HEAD}
${top.map(row).join("\n")}
`;
fs.writeFileSync(new URL("README.md", OUT), readme);
process.stderr.write(`catalog: ${sites.length} sites, ${toolCount} tools (registry total ${total})\n`);
