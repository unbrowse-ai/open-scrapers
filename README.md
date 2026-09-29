# open-scrapers: structured scrapers and 1,000+ site APIs for agents and code

Open-source web scrapers that return clean JSON records, not page text: Amazon products, Zillow listings, YouTube videos, Redfin homes, Airbnb stays, Pinterest pins, Medium articles, Craigslist posts, Google News articles, and jobs from Greenhouse, Lever and Ashby career sites. Plus a catalog of 2,000+ websites you can call as an API or an MCP server. Node.js, MIT licensed, built on the [Unbrowse](https://unbrowse.ai) SDK.

- **No headless browser, no proxy pool.** Each page is requested from your own machine and parsed locally.
- **Structured output.** Prices as numbers, dates as ISO strings, flags as booleans, with a documented field table per scraper.
- **Agent-ready.** Every scraper has a `SKILL.md` for Claude Code and other agents; every catalog site has an MCP URL.

## Quick start

1. Optional: get a free API key at [unbrowse.ai](https://unbrowse.ai). With a key, each scraper runs the shared Unbrowse site tool first; without one, it requests the site directly from your machine (you'll see a one-line note on stderr).
2. Install and run:

```bash
git clone https://github.com/unbrowse-ai/open-scrapers && cd open-scrapers
npm install
export UNBROWSE_API_KEY=ub_live_...   # optional

node scrapers/amazon/index.mjs "wireless earbuds" --max 40 > earbuds.json
node scrapers/zillow/index.mjs "Austin, TX" --type FOR_SALE --max 100 > austin.json
node scrapers/youtube/index.mjs "lofi hip hop" --details > lofi.json
node scrapers/career-site-jobs/index.mjs https://boards.greenhouse.io/figma lever:spotify > jobs.json
node scrapers/craigslist/index.mjs austin --category apa --max-price 1500 > apartments.json
node scrapers/google-news/index.mjs "nvidia" --when 7d > news.json
node scrapers/redfin/index.mjs https://www.redfin.com/city/30818/TX/Austin --max 500 > redfin.json
node scrapers/airbnb/index.mjs Lisbon --checkin 2026-11-10 --checkout 2026-11-14 --adults 2 > lisbon.json
node scrapers/pinterest/index.mjs "kitchen ideas" --max 100 > pins.json
node scrapers/medium/index.mjs tag:programming @karpathy --max 50 > medium.json
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
| [Career Site Jobs Scraper](scrapers/career-site-jobs) | Every open job on a Greenhouse, Lever or Ashby board: title, department, location, remote/hybrid, posted date, salary range, description | 530 jobs from 4 boards (Figma, Spotify, Ramp, Notion); salary on 374 |
| [Craigslist Scraper](scrapers/craigslist) | Search results for any city and category: price, location, coordinates, photos, posted date, beds/sqft, odometer, job fields | 270 posts from 3 searches (Austin apartments, Seattle bikes, New York cars) |
| [Redfin Scraper](scrapers/redfin) | Homes for sale in a city, county or neighbourhood: price, beds, baths, sqft, year built, days on market, coordinates, MLS id, photo | 500 homes (Austin, TX, 2 requests) + 50 (King County, WA, by price) |
| [Airbnb Scraper](scrapers/airbnb) | Stays for any location: total and nightly price (USD), discount, rating, reviews, Guest Favourite, Superhost, bedrooms, beds, coordinates, photos; dates, guests, filters | 40 stays (Lisbon, 4 nights, 3 pages, 2026-09-30); price, rating, coordinates on all 40 |
| [Pinterest Scraper](scrapers/pinterest) | Pins from a search, board, profile or pin URL: title, description, full-size image, video file, outbound link, saves, comments, pinner, board | 50 search pins + 41 from a board, a profile and a pin with details (2026-09-30); saves on 39 of 41 |
| [Medium Scraper](scrapers/medium) | Articles by tag (newest or top), author, publication or search: author, publication, dates, reading time, claps, responses, tags; full text as Markdown | 188 articles from a tag, an author, a publication and a search + 9 with full text (2026-09-30) |
| [Google News Scraper](scrapers/google-news) | Keyword search: headline, publisher, publisher site, publish date, link, related coverage; time filters; past the 100-result cap | 150 articles for "nvidia" (last 7 days, 3 requests) |

Each scraper also lives in its own repo, if you only need one: [amazon-scraper](https://github.com/unbrowse-ai/amazon-scraper) · [zillow-scraper](https://github.com/unbrowse-ai/zillow-scraper) · [youtube-scraper](https://github.com/unbrowse-ai/youtube-scraper) · [career-site-jobs-scraper](https://github.com/unbrowse-ai/career-site-jobs-scraper) · [craigslist-scraper](https://github.com/unbrowse-ai/craigslist-scraper) · [google-news-scraper](https://github.com/unbrowse-ai/google-news-scraper) · [redfin-scraper](https://github.com/unbrowse-ai/redfin-scraper) · [airbnb-scraper](https://github.com/unbrowse-ai/airbnb-scraper) · [pinterest-scraper](https://github.com/unbrowse-ai/pinterest-scraper) · [medium-scraper](https://github.com/unbrowse-ai/medium-scraper).

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

Each scraper asks a public Unbrowse tool (for example `public.youtube_com.read_page`, or a site's own JSON API such as Craigslist search) which request to make, sends that request from your machine, and parses the raw response with its own tested parser (`parse.mjs`). If the site refuses your IP (captcha, 403, 429, bot page), the session is closed without reporting anything, so one blocked address never counts against a tool other people use.

Unbrowse is used when it's available (free key); otherwise the scraper falls back to a direct request. Every call also knows the exact request its tool stands for. When there is no API key, or Unbrowse can't run the tool before anything reached the site (the tool left the registry, needs a browser, the service is unreachable, or the tool now asks for a different page), that request goes straight to the site from your machine with a normal browser user agent. It gets the same refusal checks, and the same parser reads the answer. One line on stderr says so the first time, and the summary line counts requests by path (`requests: 3 via Unbrowse, 2 direct`). Your Unbrowse key is never sent to the site. Details in [CONTRIBUTING.md](CONTRIBUTING.md).

```
lib/read-page.mjs        fetch one page through a public tool (or directly), from your IP; refusal handling
scrapers/<site>/         index.mjs (CLI + API), parse.mjs, test.mjs, fixtures/, README.md, SKILL.md
catalog/                 build.mjs, README.md, sites/<letter>.md, sites.json, USING.md
skills/                  index of agent skills
```

## Tests

```bash
npm test
```

Parser tests run offline on trimmed real pages in each `fixtures/` folder, plus tests of the refusal path and the direct fallback.

## Contributing

New scrapers and parser fixes are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Every scraper needs a parser test on a real fixture and one live run.

## License

[MIT](LICENSE) © Unbrowse. Scrape responsibly: public pages, a human pace, no personal data, and respect each site's terms.
