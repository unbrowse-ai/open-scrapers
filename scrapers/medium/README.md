# Medium Scraper (Node.js): articles by tag, author, publication or search as JSON

Scrape Medium articles into structured JSON: article id and URL, title, subtitle, author (name, username, profile URL), publication (name, slug, custom domain), publish and update dates, reading time, word count, claps, responses, tags, preview image, language and the member-only flag. Start from a tag (newest, hot or top of the week, month, year or all time), an author, a publication (by slug or custom domain), a keyword search or article URLs. Add `--content` for the full article body as Markdown and plain text, with headings, lists, code blocks, links, images and embeds; member-only articles return the free preview and are flagged. Paginates, 25 articles per request.

Requests go to Medium's own GraphQL endpoint (the API its website uses) through public [Unbrowse](https://unbrowse.ai) tools. Each request is sent from your machine and parsed locally: no login, no 10-item RSS limit, no browser.

## Quick start

```bash
git clone https://github.com/unbrowse-ai/open-scrapers && cd open-scrapers && npm install
export UNBROWSE_API_KEY=ub_live_...        # free key: https://unbrowse.ai

node scrapers/medium/index.mjs tag:programming --max 100 > programming.json
node scrapers/medium/index.mjs tag:machine-learning --sort TOP_MONTH --max 50 > ml-top.json
node scrapers/medium/index.mjs @karpathy pub:better-programming --max 60 > mixed.json
node scrapers/medium/index.mjs "search:rust async" --max 50 > rust.json
node scrapers/medium/index.mjs https://karpathy.medium.com/software-2-0-a64152b37c35 --content > article.json
```

| Input | Example |
|---|---|
| Tag | `tag:programming`, `https://medium.com/tag/llm` |
| Author | `@karpathy`, `https://medium.com/@dhh`, `https://karpathy.medium.com/` |
| Publication | `pub:better-programming`, `pub:levelup.gitconnected.com`, `https://medium.com/better-programming` |
| Search | `search:rust async` (any other phrase is a search too) |
| Article | Any article URL, or `article:<id>` |

| Option | Default | Meaning |
|---|---|---|
| `--max N` | 50 | Articles per input (25 per request) |
| `--sort MODE` | NEW | Tags: `NEW`, `HOT`, `TOP_WEEK`, `TOP_MONTH`, `TOP_YEAR`, `TOP_ALL_TIME` |
| `--content` | off | Add `markdown`, `text` and `contentIsPreview` (one request per article) |

From code:

```js
import { scrape } from "./scrapers/medium/index.mjs";
const top = await scrape("tag:startup", { sort: "TOP_YEAR", max: 30, content: true });
```

## Output

```json
{
  "id": "a64152b37c35",
  "url": "https://karpathy.medium.com/software-2-0-a64152b37c35",
  "title": "Software 2.0",
  "subtitle": "I sometimes see people refer to neural networks as just “another tool in your machine learning toolbox”...",
  "authorName": "Andrej Karpathy",
  "authorUsername": "karpathy",
  "authorUrl": "https://medium.com/@karpathy",
  "publicationName": null,
  "publishedAt": "2017-11-11T22:18:53.751Z",
  "updatedAt": "2021-03-13T18:18:43.264Z",
  "readingTimeMinutes": 8.8,
  "wordCount": 2146,
  "claps": 61028,
  "responses": 194,
  "tags": ["machine-learning", "artificial-intelligence", "programming", "software-development", "future"],
  "imageUrl": "https://miro.medium.com/v2/resize:fit:1400/1*CHcu2L0NmAZwCpQgmS1ByA.jpeg",
  "isMemberOnly": false,
  "language": "en",
  "markdown": "## Software 2.0\n\nI sometimes see people refer to neural networks as just “another tool in your machine learning toolbox”...",
  "contentIsPreview": false,
  "sourceType": "article"
}
```

## Fields

| Field | Notes |
|---|---|
| `id`, `url` | Post id (the hex suffix of every article URL) and canonical URL |
| `title`, `subtitle` | |
| `authorName`, `authorUsername`, `authorUrl`, `authorId` | |
| `publicationName`, `publicationSlug`, `publicationUrl` | `null` for articles outside a publication |
| `publishedAt`, `updatedAt` | ISO dates |
| `readingTimeMinutes`, `wordCount`, `claps`, `responses` | |
| `tags[]`, `imageUrl`, `language`, `isMemberOnly` | |
| `markdown`, `text`, `contentIsPreview` | With `--content`; a preview for member-only articles |
| `sourceType`, `sourceValue`, `scrapedAt` | Context |

## FAQ

**Full text of member-only articles?** No. Without a paid login Medium sends the free preview; those records have `contentIsPreview: true`.

**How far back does a tag go?** `NEW` pages back through the tag's history; the `TOP_*` modes rank a fixed window. Authors and publications page through everything they published.

**Why a key?** The requests go through Unbrowse's public Medium tools, which tell your machine which request to send. The key is free; the request leaves from your IP.
