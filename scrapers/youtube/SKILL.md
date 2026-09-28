---
name: youtube-scraper
description: Get YouTube search results or video stats (views, likes, comment count, duration, publish date, tags, description, channel) as JSON without the YouTube Data API. Use when the user asks to find, compare or collect YouTube videos or their metrics.
---

# YouTube scraper

## When to use
- "Top YouTube videos for X with view counts", "how many likes does this video have", "collect the videos about X with durations and dates".
- Not for transcripts, comments or full channel uploads (not covered).

## Run
Needs `UNBROWSE_API_KEY` (free at https://unbrowse.ai). From the repo root:

```bash
node scrapers/youtube/index.mjs "<search terms>" --max 20 > out.json            # search cards
node scrapers/youtube/index.mjs "<search terms>" --max 10 --details > out.json  # + likes, comments, tags
node scrapers/youtube/index.mjs "https://www.youtube.com/watch?v=<id>" > out.json
```

Options: `--max N` (≤ ~20, one results page), `--details`, `--shorts`.
Progress goes to stderr, the JSON array to stdout. Exit 1 on error, 2 on zero results.

## Output
Array of videos. Search: `id, url, title, channelName, channelId, viewCount, publishedTimeText, duration, durationSeconds, description, thumbnailUrl, position, searchQuery, scrapedAt`.
Video page (and `--details`) adds: `likes, commentsCount, publishedAt, uploadedAt, category, keywords[], isLive, isFamilySafe, channelUrl, channelSubscribers, playability`.
