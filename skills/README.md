# Agent skills

Each scraper ships a `SKILL.md`: a short file an agent (Claude Code, Codex, Cursor and other skill-aware agents) reads to know when to use the scraper, the exact command, and the shape of the output.

| Skill | Use it for |
|---|---|
| [amazon-scraper](../scrapers/amazon/SKILL.md) | Amazon.com search results and product details: price, rating, reviews, seller, rank, specs |
| [zillow-scraper](../scrapers/zillow/SKILL.md) | Zillow listings for sale, for rent and recently sold, with filters |
| [youtube-scraper](../scrapers/youtube/SKILL.md) | YouTube search results and video stats without the Data API |
| [career-site-jobs-scraper](../scrapers/career-site-jobs/SKILL.md) | Open jobs on Greenhouse, Lever and Ashby career sites, with salary ranges and filters |
| [craigslist-scraper](../scrapers/craigslist/SKILL.md) | Craigslist search results in any city and category |
| [google-news-scraper](../scrapers/google-news/SKILL.md) | Google News articles for a keyword, with time filters |

## Install in Claude Code

Clone the repo once, then link the skills into your skills folder so they stay up to date:

```bash
git clone https://github.com/unbrowse-ai/open-scrapers ~/open-scrapers && cd ~/open-scrapers && npm install
for s in amazon zillow youtube career-site-jobs craigslist google-news; do
  mkdir -p ~/.claude/skills/$s-scraper && ln -sf ~/open-scrapers/scrapers/$s/SKILL.md ~/.claude/skills/$s-scraper/SKILL.md
done
export UNBROWSE_API_KEY=ub_live_...   # free at https://unbrowse.ai
```

The commands in each skill run from the repo root (`cd ~/open-scrapers`).

## Any other site

For sites without a scraper here, give the agent the Unbrowse MCP server instead. It searches the registry of 1,000+ sites for a tool that fits the task and calls it:

```bash
claude mcp add --transport http unbrowse https://unbrowse.ai/mcp
```

See [catalog/USING.md](../catalog/USING.md) for per-site MCP servers, OpenAPI and the SDK.
