# Pinterest Scraper (Node.js): pins from search, boards and profiles as JSON

Scrape Pinterest pins into structured JSON: pin id and URL, title, description, alt text, full-size image URL and every image size, dominant colour, outbound link and its domain, video file (MP4 and HLS, with duration) for video pins, saves, comments, reactions, shares, hashtags, Pinterest's own visual annotations ("Kitchen Large Windows"), created date, the pinner (username, name, followers) and the board. Start from a keyword search, a board URL, a profile URL (the pins that account created) or single pin URLs. Paginates past the first page, 25 pins per request.

Requests go to Pinterest's own resource API (the JSON its web app loads) through public [Unbrowse](https://unbrowse.ai) tools. Each request is sent from your machine and parsed locally, with no login, no cookies and no browser.

## Quick start

```bash
git clone https://github.com/unbrowse-ai/open-scrapers && cd open-scrapers && npm install
export UNBROWSE_API_KEY=ub_live_...        # free key: https://unbrowse.ai

node scrapers/pinterest/index.mjs "kitchen ideas" --max 100 > kitchen.json
node scrapers/pinterest/index.mjs "pasta recipe" --videos --max 30 > pasta-videos.json
node scrapers/pinterest/index.mjs https://www.pinterest.com/nytcooking/ --max 50 --details > nytcooking.json
node scrapers/pinterest/index.mjs https://www.pinterest.com/johannalynch625/modern-kitchens/ https://www.pinterest.com/pin/1083678729086891527/ > mixed.json
```

| Option | Default | Meaning |
|---|---|---|
| `<input>...` | | A keyword, or a Pinterest search, board, profile or pin URL (`pin.it` short links too) |
| `--max N` | 50 | Pins per input (25 per request) |
| `--videos` | off | Keyword searches: video pins only |
| `--details` | off | Open every pin for saves, comments, reactions, video files and the outbound link (one request per pin) |

From code:

```js
import { scrape } from "./scrapers/pinterest/index.mjs";
const pins = await scrape("fall outfits", { max: 75, details: true });
```

## Output

```json
{
  "id": "463870830398969176",
  "url": "https://www.pinterest.com/pin/463870830398969176/",
  "title": "Lemon Olive Oil Muffins",
  "description": "These light, fluffy muffins get a double dose of lemon...",
  "imageUrl": "https://i.pinimg.com/originals/73/dd/c3/73ddc37c2c185dfe82f0c51229f367b2.jpg",
  "imageWidth": 735, "imageHeight": 1102,
  "dominantColor": "#c7a679",
  "link": "https://cooking.nytimes.com/recipes/790603105-lemon-olive-oil-muffins",
  "domain": "cooking.nytimes.com",
  "isVideo": false,
  "saves": 1, "comments": 0, "reactions": 0, "shares": 0,
  "createdAt": "2026-09-29T04:44:28.000Z",
  "pinner": { "username": "nytcooking", "fullName": "NYT Cooking", "followers": 273539, "profileUrl": "https://www.pinterest.com/nytcooking/" },
  "board": { "id": "463870899059185439", "name": "Newest Recipes", "url": "https://www.pinterest.com/nytcooking/newest-recipes/" },
  "source": "user",
  "sourceInput": "https://www.pinterest.com/nytcooking/"
}
```

## Fields

| Field | Notes |
|---|---|
| `id`, `url` | Pin id and page |
| `title`, `description`, `altText` | Title falls back to the grid or SEO title |
| `imageUrl`, `imageWidth`, `imageHeight`, `images{orig, 736x, 474x, 236x}`, `dominantColor` | Largest image first |
| `link`, `domain` | Outbound link; `null` for uploads |
| `isVideo`, `video{url, hlsUrl, durationSec, width, height, thumbnail}`, `isIdeaPin` | Best MP4 plus the HLS stream |
| `saves`, `comments`, `reactions`, `shares` | Search results carry few counts; `--details` fills them |
| `hashtags[]`, `annotations[]` | Hashtags from the pin text; Pinterest's visual labels |
| `createdAt` | ISO date |
| `pinner{id, username, fullName, followers, profileUrl, avatar, isVerifiedMerchant}` | |
| `board{id, name, url, pinCount}`, `boardInput` | `boardInput` describes the board you asked for |
| `isPromoted`, `isRepin`, `price` | |
| `searchQuery`, `source`, `sourceInput`, `scrapedAt` | Context |

## FAQ

**Saved pins of a profile?** Not yet: a profile URL returns the pins the account created. Scrape one of its boards instead.

**Private boards or my own feed?** No. Only public pins, without logging in.

**Other Pinterest domains?** `pinterest.co.uk`, `.de`, `.fr` and the rest are read as the same pins on pinterest.com.

**Why a key?** The requests go through Unbrowse's public Pinterest tools, which tell your machine which request to send. The key is free; the request leaves from your IP.
