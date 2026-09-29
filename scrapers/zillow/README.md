# Zillow Scraper (Node.js): for-sale, rental and sold listings as JSON

Scrape Zillow search results for any city, ZIP code or neighbourhood into structured JSON: price, beds, baths, square feet, lot size, address parts, coordinates, Zestimate, rent Zestimate, tax assessed value, days on Zillow, sold date, broker, photos, and unit ranges for apartment buildings. Works for homes for sale, rentals and recently sold homes, with price and bedroom filters, up to 820 listings per search.

The scraper reads the same results page you see in a browser and takes the listing data Zillow embeds in it. Each page is requested from your own machine through a public [Unbrowse](https://unbrowse.ai) tool; parsing happens locally, so you get every field Zillow sends, not a text summary. Without an Unbrowse key, or when that tool is unavailable, the scraper sends the same request straight to the site and parses it the same way.

## Quick start

```bash
git clone https://github.com/unbrowse-ai/open-scrapers && cd open-scrapers && npm install
export UNBROWSE_API_KEY=ub_live_...        # optional; free key: https://unbrowse.ai

node scrapers/zillow/index.mjs "Austin, TX" --max 100 > austin.json
node scrapers/zillow/index.mjs "78704" --type FOR_RENT --min-beds 2 --max-price 3000 > rentals.json
node scrapers/zillow/index.mjs "Denver, CO" --type SOLD --max 200 > sold.json
node scrapers/zillow/index.mjs "https://www.zillow.com/austin-tx/rentals/" > from-url.json
```

| Option | Default | Meaning |
|---|---|---|
| `<place or URL>...` | | "City, ST", a ZIP code, a neighbourhood, or any zillow.com search URL |
| `--type` | FOR_SALE | `FOR_SALE`, `FOR_RENT` or `SOLD` |
| `--max N` | 100 | Listings per search (41 per page, 20 pages at most) |
| `--min-price`, `--max-price` | | Sale price, or monthly rent for rentals |
| `--min-beds`, `--max-beds`, `--min-baths` | | Room filters |

From code:

```js
import { scrape } from "./scrapers/zillow/index.mjs";
const homes = await scrape("Brooklyn, NY", { type: "FOR_RENT", max: 50, minBeds: 1 });
```

## Output

```json
{
  "zpid": "58307080",
  "url": "https://www.zillow.com/homedetails/12301-Meuse-Cv-Austin-TX-78727/58307080_zpid/",
  "status": "FOR_SALE",
  "homeType": "SINGLE_FAMILY",
  "address": "12301 Meuse Cv, Austin, TX 78727",
  "city": "Austin", "state": "TX", "zipcode": "78727",
  "price": 560000, "priceText": "$560,000", "currency": "USD",
  "beds": 4, "baths": 3, "livingArea": 2188, "livingAreaUnit": "sqft",
  "lotArea": 10746.252, "lotAreaUnit": "sqft",
  "latitude": 30.420174, "longitude": -97.721825,
  "taxAssessedValue": 468295, "daysOnZillow": 2,
  "brokerName": "Christies Intl Real Estate Lone Star",
  "has3DModel": true,
  "photos": ["https://photos.zillowstatic.com/fp/5025df2ba7801c49db694840a82a7e84-p_e.jpg", "..."],
  "searchQuery": "Austin, TX", "totalResults": 5753
}
```

## Fields

| Field | Notes |
|---|---|
| `zpid`, `id`, `url` | `zpid` is Zillow's property id; buildings without one get `id` from their lot id |
| `status`, `statusText`, `homeType` | `FOR_SALE` / `FOR_RENT` / `SOLD`; `SINGLE_FAMILY`, `CONDO`, `APARTMENT_BUILDING`, ... |
| `address`, `street`, `unit`, `city`, `state`, `zipcode` | Split address |
| `price`, `priceText`, `priceMax`, `currency` | `priceMax` for buildings with a rent range |
| `beds`, `bedsMax`, `baths`, `livingArea`, `lotArea` (+ units) | |
| `latitude`, `longitude` | |
| `zestimate`, `rentZestimate`, `taxAssessedValue` | When Zillow shows them |
| `daysOnZillow`, `dateSold`, `openHouse` | `dateSold` as YYYY-MM-DD for sold homes |
| `brokerName`, `flexText` | Listing broker, the card's highlight text |
| `isBuilding`, `buildingName`, `units[]`, `availableUnits` | Apartment buildings: one record with its units |
| `isNewConstruction`, `isForeclosure`, `isFsbo`, `isComingSoon`, `has3DModel`, `hasVideo` | Flags |
| `imgSrc`, `photos[]` | Photo URLs |
| `searchQuery`, `totalResults`, `scrapedAt` | Context |

## FAQ

**Do I need a key?** No. With a free [Unbrowse](https://unbrowse.ai) key, the scraper runs Unbrowse's public `zillow.com` tool first, which tells your machine which request to send. Without a key, or when a tool is unavailable, it sends the same request directly with a normal browser user agent (one `note:` line on stderr says so). Either way the request leaves from your IP, and your key is never sent to the site.

**Zillow showed a "press and hold" check.** The scraper closes the session without reporting the page and throws `RefusedError`. Slow down (`--max` smaller), wait, or use another network.

**Can I get more than 820 results?** Zillow itself stops at 20 pages. Split the area: search ZIP codes or add price bands.

**Property detail pages?** Not yet. The search cards already carry most of the numbers; detail pages are a good first contribution.
