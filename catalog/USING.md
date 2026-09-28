# Using any catalog site

Every site in the [catalog](README.md) is a set of tools compiled from the site's own requests. You can call them three ways. All three need a free API key from [unbrowse.ai](https://unbrowse.ai) (reading the registry itself needs none).

```bash
npm install @unbrowse/sdk
export UNBROWSE_API_KEY=ub_live_...
```

## 1. From code, with the SDK

```js
import { Unbrowse } from "@unbrowse/sdk";
const ub = new Unbrowse();

// What can this site do? Tool names, titles and JSON input schemas.
const { tools } = await ub.site("arxiv.org");
for (const t of tools) console.log(t.name, "-", t.title, Object.keys(t.inputSchema.properties ?? {}));

// Call one. The result is the page the tool read: title, text, links.
const run = await ub.callTool("arxiv.org", "arxiv_org__get_search", { query: "diffusion transformers" });
if (run.status === "succeeded") console.log(run.result.text.slice(0, 500));
```

A call is billed like a run, and only when it succeeds (`verified: true`). `input_required` is not a failure: answer it with `ub.answer(run.runId, { field: value })`.

### Search the registry

```js
const found = await ub.sites("flight prices");   // hosts whose tools match
const caps = await ub.discover("flight prices"); // capabilities, ranked, with how to call each
```

### Run from your own IP

Most sites answer your machine better than a data centre. `runOnClient` (or the lower-level `egress` / `answerEgress` / `closeEgress`, which this repo's scrapers use) sends each site request from your machine and gives you the raw response, so you can parse it yourself:

```js
import { readPage } from "./lib/read-page.mjs"; // from this repo (copy it into yours)
const page = await readPage("public.zillow_com.read_page", { path: "/austin-tx/" }, { hosts: ["zillow.com"] });
console.log(page.status, page.body.length);
```

Public page readers are named `public.<host with dots as underscores>.read_page` (for example `public.amazon_com.read_page`). Check a tool's inputs first: some take `{ path }`, others a search term.

## 2. As a REST API (OpenAPI)

Each site publishes an OpenAPI 3.1 document at `https://unbrowse.ai/api/v1/sites/<host>/openapi.json`. Feed it to any code generator, Postman, or an agent framework that loads OpenAPI tools. Calls are plain HTTPS:

```bash
curl -X POST https://unbrowse.ai/api/v1/sites/arxiv.org/call/arxiv_org__get_search \
  -H "Authorization: Bearer $UNBROWSE_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"diffusion transformers"}'
```

## 3. As an MCP server

One site as its own MCP server, with only that site's tools:

```bash
claude mcp add --transport http arxiv https://unbrowse.ai/api/v1/sites/arxiv.org/mcp \
  --header "Authorization: Bearer $UNBROWSE_API_KEY"
```

Every site at once, with discovery (the agent searches for the right tool itself). Leave out the header to sign in with OAuth instead:

```bash
claude mcp add --transport http unbrowse https://unbrowse.ai/mcp
```

Other clients (Cursor, VS Code, Codex, Claude Desktop) take the same URL; the JSON form is:

```json
{ "mcpServers": { "unbrowse": { "url": "https://unbrowse.ai/mcp" } } }
```

## Which to pick

| You want | Use |
|---|---|
| Structured records (prices, listings, jobs) you can store | a scraper in [`scrapers/`](../scrapers) |
| One site's data inside your app | `callTool`, or the site's OpenAPI |
| An agent that can use any site it needs | the hosted MCP, `https://unbrowse.ai/mcp` |
| An agent limited to one site | that site's MCP URL |
