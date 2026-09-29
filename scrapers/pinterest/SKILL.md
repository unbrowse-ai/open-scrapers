---
name: pinterest-scraper
description: Get Pinterest pins as JSON from a keyword search, a board, a profile's created pins or pin URLs, with title, description, full-size image, video file, outbound link, saves, comments, pinner and board. Use when the user asks for Pinterest pins, trends, images or ideas on a topic, or the contents of a Pinterest board or account.
---

# Pinterest scraper

## When to use
- "Top Pinterest pins for kitchen ideas", "download the images on this Pinterest board", "what has NYT Cooking pinned lately", "video pins about pasta".
- Public pins only; no login. Profiles give the pins the account created (not their saved pins).

## Run
Uses `UNBROWSE_API_KEY` when set (free at https://unbrowse.ai); without it, requests go straight to the site. From the repo root:

```bash
node scrapers/pinterest/index.mjs "kitchen ideas" --max 100 > out.json
node scrapers/pinterest/index.mjs "pasta recipe" --videos --max 30 > out.json
node scrapers/pinterest/index.mjs https://www.pinterest.com/<user>/<board>/ --max 200 > out.json
node scrapers/pinterest/index.mjs https://www.pinterest.com/<user>/ --details > out.json
```

Options: `--max N` (25 per request), `--videos` (keyword search, video pins only), `--details` (one extra request per pin: saves, comments, reactions, video files, outbound link).
Progress goes to stderr, the JSON array to stdout. Exit 1 on error, 2 on zero results.

## Output
Array of pins: `id, url, title, description, altText, imageUrl, imageWidth, imageHeight, images{orig,736x,474x,236x}, dominantColor, link, domain, isVideo, video{url,hlsUrl,durationSec,width,height,thumbnail}, isIdeaPin, saves, comments, reactions, shares, hashtags[], annotations[], createdAt, pinner{id,username,fullName,followers,profileUrl,avatar,isVerifiedMerchant}, board{id,name,url,pinCount}, isPromoted, isRepin, price, searchQuery?, boardInput?, source, sourceInput, scrapedAt`.

## Notes
- Search results carry few engagement counts; add `--details` when saves or comments matter.
- Saved pins (`/_saved/`) are not supported; use a board URL.
