# Contributing

New scrapers, parser fixes and fixtures are welcome. The bar: a scraper returns structured records (not page text), has a parser test on a real, trimmed fixture, and was run live at least once.

## Layout of a scraper

```
scrapers/<site>/
  index.mjs      CLI + importable functions. Fetches pages with lib/read-page.mjs, never parses.
  parse.mjs      Pure: HTML in, plain objects out. No network, no globals.
  test.mjs       node:test on fixtures/ (runs in `npm test`)
  fixtures/      Real pages, trimmed to what the parser reads. Under 200 KB each.
  README.md      "<Site> Scraper (Node.js): ..." usage, output example, fields table, FAQ
  SKILL.md       Agent skill: name/description frontmatter, when to use, exact command, output shape
```

Add a row to the root README and to `skills/README.md`.

## How pages are fetched

`lib/read-page.mjs` runs a public Unbrowse registry tool (for most sites `public.<host_with_underscores>.read_page`, input `{ path }`; check the input schema at `https://unbrowse.ai/api/v1/sites/<host>`) with **client egress**: Unbrowse tells your machine which request to send, your machine sends it to the site from its own IP, and the raw response goes back to Unbrowse so the run completes. `readPage` keeps that raw body and returns it, so `parse.mjs` can structure it.

```js
const page = await readPage("public.zillow_com.read_page", { path: "/austin-tx/" }, { hosts: ["zillow.com"] });
```

## The refusal rule (important)

When a site refuses your IP (HTTP 4xx/5xx, a captcha or "press and hold" page, a redirect to a bot wall or login, or a suspiciously tiny body), **nothing is posted back**. `readPage` calls `closeEgress(egressId)` and throws `RefusedError`.

Why: a public tool's health is shared by everyone who uses it. If a refused page (or an error) were reported as the tool's answer, a couple of blocked IPs would mark the tool as failing and hide it from every user, even though the tool is fine and only that one address was refused. Closing the session abandons the run instead of failing it.

That is also why the scrapers do not use the SDK's `runOnClient` helper: it posts whatever the site returned, and when your `fetch` throws it posts an `error`. `readPage` drives the same protocol with the SDK's lower-level calls (`run({ egress: "client" })`, `answerEgress`, `closeEgress`) so it can decide per response.

Rules for new scrapers:

1. Pass a `refused(page)` check for the site's own bot page if the generic one does not catch it (see `isBlocked` in `scrapers/amazon/parse.mjs`). Return a short reason string or `false`.
2. Pass `hosts: [...]` with the site's domains. A request for any other host is closed without being sent, so your IP is only ever pointed at the site you asked for.
3. Never retry a refused page in a tight loop. Back off, or stop and tell the user.

## Fixtures

Capture a real page, then trim it to the part the parser reads (embedded JSON, the result list). Keep a comment at the top saying where it came from. Keep each file under 200 KB. Do not commit pages that carry personal data.

## Checks before a pull request

```bash
npm test                                             # all parser tests
node scrapers/<site>/index.mjs <example> > out.json  # one live run, with UNBROWSE_API_KEY set
```

Say in the PR what the live run returned (item count, which fields were filled) and from which country you ran it.

## Style

Node 18+, ES modules, no build step. Dependencies: `@unbrowse/sdk` and `cheerio` only. Small functions, comments that say why.
