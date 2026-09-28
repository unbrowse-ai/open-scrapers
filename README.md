# open-scrapers: structured scrapers and 1,000+ site APIs for agents and code

Open-source web scrapers that return clean JSON records, not page text: Amazon products, Zillow listings and YouTube videos. Plus a catalog of 2,000+ websites you can call as an API or an MCP server. Node.js, MIT licensed, built on the [Unbrowse](https://unbrowse.ai) SDK.

- **No headless browser, no proxy pool.** Each page is requested from your own machine and parsed locally.
- **Structured output.** Prices as numbers, dates as ISO strings, flags as booleans, with a documented field table per scraper.
- **Agent-ready.** Every scraper has a `SKILL.md` for Claude Code and other agents; every catalog site has an MCP URL.

## Quick start

1. Get a free API key at [unbrowse.ai](https://unbrowse.ai).
2. Install and run:

```bash
git clone https://github.com/unbrowse-ai/open-scrapers && cd open-scrapers
npm install
export UNBROWSE_API_KEY=ub_live_...

node scrapers/amazon/index.mjs "wireless earbuds" --max 40 > earbuds.json
node scrapers/zillow/index.mjs "Austin, TX" --type FOR_SALE --max 100 > austin.json
node scrapers/youtube/index.mjs "lofi hip hop" --details > lofi.json
```

JSON goes to stdout, progress to stderr. Each scraper is also an importable module:

```js
import { scrape } from "./scrapers/zillow/index.mjs";
const rentals = await scrape("78704", { type: "FOR_RENT", minBeds: 2, max: 50 });
```

## Scrapers

| Scraper | What you get | Live check (2026-09-28) |
|---|---|---|
| [Amazon Scraper](scrapers/amazon) | Search results and product pages: price, currency, rating, reviews, bought-last-month, sponsored flag, seller, Best Sellers Rank, images, specs | 40 search results (3 pages) + 1 product; 37 priced, all USD |
| [Zillow Scraper](scrapers/zillow) | For-sale, rental and sold listings: price, beds, baths, sqft, lot, coordinates, Zestimate, tax value, days on Zillow, photos; filters | 60 for sale (Austin, TX) and 60 rentals (78704, 2+ beds) |
| [YouTube Scraper](scrapers/youtube) | Search results and video stats: views, likes, comment count, duration, publish date, tags, description, channel | 16 search results; 5 with details + 1 video page |

Not here yet: Airbnb, Google News, Medium. Their public tools do not yet return the raw page a structured parser needs from every network; they will be added when they do.

## Site API catalog

[`catalog/`](catalog) lists every site in the public Unbrowse registry that a query sweep reaches (2,400+ sites, 2,990+ tools, regenerated with `npm run catalog`): what each site's tools do, its OpenAPI document and its MCP URL. Any of them can be called from code:

```js
import { Unbrowse } from "@unbrowse/sdk";
const ub = new Unbrowse();
const run = await ub.callTool("arxiv.org", "arxiv_org__get_search", { query: "attention is all you need" });
```

[catalog/USING.md](catalog/USING.md) covers the SDK (`site`, `callTool`, `openapi`, `siteMcpUrl`), plain REST, and MCP.

## Use from agents

**Claude Code skills.** Link the scrapers' `SKILL.md` files into `~/.claude/skills` and ask for the data in plain words ("2-bed rentals in 78704 under $3,000"). See [skills/](skills).

**MCP.** Give any MCP client every catalog site at once; the agent finds the right tool itself:

```bash
claude mcp add --transport http unbrowse https://unbrowse.ai/mcp
```

Or one site only: `https://unbrowse.ai/api/v1/sites/<host>/mcp` with an `Authorization: Bearer $UNBROWSE_API_KEY` header.

## How it works

Each scraper asks a public Unbrowse tool (for example `public.zillow_com.read_page`) which request to make, sends that request from your machine, and parses the raw response with its own tested parser (`parse.mjs`). If the site refuses your IP (captcha, 403, 429, bot page), the session is closed without reporting anything, so one blocked address never counts against a tool other people use. Details in [CONTRIBUTING.md](CONTRIBUTING.md).

```
lib/read-page.mjs        fetch one page through a public tool, from your IP; refusal handling
scrapers/<site>/         index.mjs (CLI + API), parse.mjs, test.mjs, fixtures/, README.md, SKILL.md
catalog/                 build.mjs, README.md, sites/<letter>.md, sites.json, USING.md
skills/                  index of agent skills
```

## Tests

```bash
npm test
```

Parser tests run offline on trimmed real pages in each `fixtures/` folder, plus tests of the refusal path.

## Contributing

New scrapers and parser fixes are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Every scraper needs a parser test on a real fixture and one live run.

## License

[MIT](LICENSE) © Unbrowse. Scrape responsibly: public pages, a human pace, no personal data, and respect each site's terms.
