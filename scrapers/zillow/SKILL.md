---
name: zillow-scraper
description: Get Zillow listings (for sale, for rent, recently sold) for a city, ZIP or Zillow search URL as JSON with price, beds, baths, sqft, coordinates, Zestimate and photos. Use when the user asks about homes, rentals, house prices or comps in a US area.
---

# Zillow scraper

## When to use
- "Homes for sale in Austin under $600k", "2-bed rentals in 78704", "what sold in Denver recently", "export this Zillow search".
- US listings only (zillow.com).

## Run
Uses `UNBROWSE_API_KEY` when set (free at https://unbrowse.ai); without it, requests go straight to the site. From the repo root:

```bash
node scrapers/zillow/index.mjs "Austin, TX" --max 100 > out.json
node scrapers/zillow/index.mjs "78704" --type FOR_RENT --min-beds 2 --max-price 3000 > out.json
node scrapers/zillow/index.mjs "Denver, CO" --type SOLD --max 200 > out.json
node scrapers/zillow/index.mjs "https://www.zillow.com/austin-tx/rentals/" > out.json
```

Options: `--type FOR_SALE|FOR_RENT|SOLD`, `--max N` (41 per page, ≤820), `--min-price --max-price --min-beds --max-beds --min-baths`.
Progress goes to stderr, the JSON array to stdout. Exit 1 on error, 2 on zero results.

## Output
Array of listings: `zpid, id, url, status, statusText, homeType, address, street, unit, city, state, zipcode, price, priceText, priceMax, currency, beds, bedsMax, baths, livingArea, livingAreaUnit, lotArea, lotAreaUnit, latitude, longitude, zestimate, rentZestimate, taxAssessedValue, daysOnZillow, dateSold, brokerName, isBuilding, buildingName, units[], availableUnits, openHouse, flexText, isNewConstruction, isForeclosure, isFsbo, isComingSoon, has3DModel, hasVideo, imgSrc, photos[], searchQuery, totalResults, scrapedAt`.

## Notes
- `RefusedError` = Zillow showed this IP a bot check; nothing was reported. Wait and retry with a smaller `--max`.
