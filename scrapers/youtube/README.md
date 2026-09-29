# YouTube Scraper (Node.js): search results and video stats as JSON

Scrape YouTube search results and video pages into JSON: title, channel, channel id, view count, likes, comment count, duration in seconds, publish date, category, tags, full description, subscriber count and thumbnail. No YouTube Data API quota, no Google Cloud project, no OAuth consent screen: the scraper reads the public pages and takes the data YouTube embeds in them.

Each page is requested from your own machine through a public [Unbrowse](https://unbrowse.ai) tool and parsed locally, so the numbers are exactly what YouTube served. Without an Unbrowse key, or when that tool is unavailable, the scraper sends the same request straight to the site and parses it the same way.

## Quick start

```bash
git clone https://github.com/unbrowse-ai/open-scrapers && cd open-scrapers && npm install
export UNBROWSE_API_KEY=ub_live_...        # optional; free key: https://unbrowse.ai

node scrapers/youtube/index.mjs "lofi hip hop" > lofi.json
node scrapers/youtube/index.mjs "home espresso review" --max 10 --details > espresso.json
node scrapers/youtube/index.mjs "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > video.json
```

| Option | Default | Meaning |
|---|---|---|
| `<input>...` | | Search terms, a video URL (watch, youtu.be, shorts) or an 11-character video id |
| `--max N` | 20 | Videos per search (the first results page holds about 20) |
| `--details` | off | Read each video page too: likes, comment count, tags, full description |
| `--shorts` | off | Keep Shorts in search results |

From code:

```js
import { scrapeSearch, scrapeVideo } from "./scrapers/youtube/index.mjs";
const results = await scrapeSearch("rust async tutorial", { max: 10, details: true });
const video = await scrapeVideo("dQw4w9WgXcQ");
```

## Output

With `--details` (description shortened):

```json
{
  "id": "n61ULEU7CO0",
  "url": "https://www.youtube.com/watch?v=n61ULEU7CO0",
  "title": "Best of lofi hip hop 2021 ✨ [beats to relax/study to]",
  "channelName": "Lofi Girl",
  "channelId": "UCSJ4gkVC6NrvII8umztf0Ow",
  "viewCount": 57666992,
  "publishedTimeText": "4y ago",
  "duration": "6:10:58",
  "durationSeconds": 22258,
  "description": "🎼 | Listen on Spotify, Apple music and more ...",
  "thumbnailUrl": "https://i.ytimg.com/vi/n61ULEU7CO0/maxresdefault.jpg?v=61cad87a",
  "likes": 497717,
  "commentsCount": 10000,
  "publishedAt": "2021-12-31T08:30:13-08:00",
  "category": "Music",
  "keywords": ["chilledcow", "chilled cow", "lofi"],
  "channelUrl": "http://www.youtube.com/@LofiGirl",
  "channelSubscribers": 15800000,
  "playability": "OK",
  "position": 1,
  "searchQuery": "lofi hip hop"
}
```

## Fields

| Field | From | Notes |
|---|---|---|
| `id`, `url`, `title` | search, video | |
| `channelName`, `channelId`, `channelUrl` | search, video | `channelUrl` from the video page |
| `viewCount` | search, video | Exact on the video page, from the view text in search |
| `publishedTimeText` | search | "2 years ago" |
| `duration`, `durationSeconds` | search, video | Live streams report 0 |
| `description` | search (snippet), video (full) | |
| `likes`, `commentsCount`, `channelSubscribers` | video | Parsed from YouTube's labels; large counts are rounded as YouTube shows them |
| `publishedAt`, `uploadedAt`, `category`, `keywords[]` | video | Dates as ISO 8601 |
| `isLive`, `isFamilySafe`, `playability` | video | `playability` is YouTube's own status (`OK`, `LOGIN_REQUIRED`, ...) |
| `thumbnailUrl`, `position`, `searchQuery`, `scrapedAt` | | |

## FAQ

**Why only about 20 results per search?** Further results load through a YouTube API call the public page tool does not cover. Use more specific queries, or several.

**Do I need a key?** No. With a free [Unbrowse](https://unbrowse.ai) key, the scraper runs Unbrowse's public `youtube.com` tool first, which tells your machine which request to send. Without a key, or when a tool is unavailable, it sends the same request directly with a normal browser user agent (one `note:` line on stderr says so). Either way the request leaves from your IP, and your key is never sent to the site.

**YouTube asked to "confirm you're not a bot".** The scraper closes the session without reporting the page and throws `RefusedError`. Wait, or use another network.

**Transcripts, comments, channels?** Not in this scraper yet. Contributions welcome: see [CONTRIBUTING](../../CONTRIBUTING.md).
