---
name: medium-scraper
description: Get Medium articles as JSON from a tag, an author, a publication, a keyword search or article URLs, with title, author, publication, dates, reading time, claps, responses, tags and optionally the full text as Markdown. Use when the user asks what is being written on Medium about a topic, for an author's or publication's articles, or for an article's text.
---

# Medium scraper

## When to use
- "Top Medium articles on machine learning this month", "everything @karpathy published", "latest posts in Better Programming", "Medium articles about rust async with the full text".
- Member-only articles give the free preview only (flagged `contentIsPreview`).

## Run
Needs `UNBROWSE_API_KEY` (free at https://unbrowse.ai). From the repo root:

```bash
node scrapers/medium/index.mjs tag:machine-learning --sort TOP_MONTH --max 50 > out.json
node scrapers/medium/index.mjs @karpathy pub:better-programming --max 60 > out.json
node scrapers/medium/index.mjs "search:rust async" --max 30 --content > out.json
node scrapers/medium/index.mjs https://medium.com/p/<id> --content > out.json
```

Inputs: `tag:<slug>` or a /tag/ URL, `@user` or a profile URL, `pub:<slug|domain>` or a publication URL, `search:<phrase>` (a bare phrase also searches), any article URL.
Options: `--max N` (25 per request), `--sort NEW|HOT|TOP_WEEK|TOP_MONTH|TOP_YEAR|TOP_ALL_TIME` (tags), `--content` (one extra request per article).
Progress goes to stderr, the JSON array to stdout. Exit 1 on error, 2 on zero results.

## Output
Array of articles: `id, url, title, subtitle, authorName, authorUsername, authorUrl, authorId, publicationName, publicationSlug, publicationUrl, publishedAt, updatedAt, readingTimeMinutes, wordCount, claps, responses, tags[], imageUrl, isMemberOnly, language, markdown?, text?, contentIsPreview?, sourceType, sourceValue, scrapedAt`.
