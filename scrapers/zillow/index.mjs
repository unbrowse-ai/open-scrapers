#!/usr/bin/env node
// Zillow Scraper: for-sale, for-rent and recently-sold search results as structured JSON.
// Pages are read through the public Unbrowse tool public.zillow_com.read_page, sent from this machine;
// without a key, or when the tool is unavailable, the same page is requested directly.
import { fileURLToPath } from "node:url";
import { cli, readPage } from "../../lib/read-page.mjs";
import { MAX_PAGES, PER_PAGE, checkSearchUrl, hasFilters, locationUrl, parseSearch, stateUrl, withFilters } from "./parse.mjs";

const CAPABILITY = "public.zillow_com.read_page";
const HOSTS = ["zillow.com"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pathOf = (url) => {
  const u = new URL(url);
  return u.pathname + u.search;
};

async function results(url) {
  const page = await readPage(CAPABILITY, { path: pathOf(url) }, { hosts: HOSTS, direct: { url } });
  const parsed = parseSearch(page.body);
  if (!parsed) throw new Error(`Zillow did not return a results page for ${url}`);
  return parsed;
}

/**
 * Search Zillow by place ("Austin, TX", "78704") or a zillow.com search URL.
 * type: FOR_SALE | FOR_RENT | SOLD. Filters: minPrice, maxPrice, minBeds, maxBeds, minBaths.
 */
export async function scrape(locationOrUrl, { type = "FOR_SALE", max = 100, log = () => {}, ...filters } = {}) {
  const isUrl = /^https?:\/\//.test(locationOrUrl);
  const limit = Math.max(1, Math.min(Number(max) || 100, PER_PAGE * MAX_PAGES));
  let first = await results(isUrl ? checkSearchUrl(locationOrUrl) : locationUrl(locationOrUrl, type));
  let qs = first.queryState;
  if (!isUrl && hasFilters(filters) && qs) {
    qs = withFilters(qs, filters, type);
    first = await results(stateUrl(qs, 1));
  }
  const pages = Math.min(first.totalPages ?? MAX_PAGES, MAX_PAGES, Math.ceil(limit / (first.perPage || PER_PAGE)));
  log(`${first.total ?? "?"} results on Zillow, reading ${pages} page(s)`);
  const seen = new Set();
  const out = [];
  const now = new Date().toISOString();
  const push = (list) => {
    for (const l of list) {
      if (out.length >= limit || seen.has(l.id)) continue;
      seen.add(l.id);
      out.push({ ...l, searchQuery: locationOrUrl, totalResults: first.total ?? null, scrapedAt: now });
    }
  };
  push(first.listings);
  for (let n = 2; n <= pages && out.length < limit && qs; n++) {
    await sleep(800 + Math.random() * 800);
    try {
      const page = await results(stateUrl(qs, n));
      log(`page ${n}: ${page.listings.length} listings`);
      push(page.listings);
    } catch (err) {
      log(`page ${n}: ${err.message}`);
      break;
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const num = (v) => (v === undefined ? undefined : Number(v));
  cli(
    async (pos, f) => {
      const out = [];
      for (const q of pos) {
        out.push(
          ...(await scrape(q, {
            type: String(f.type ?? "FOR_SALE").toUpperCase(),
            max: num(f.max) ?? 100,
            minPrice: num(f["min-price"]),
            maxPrice: num(f["max-price"]),
            minBeds: num(f["min-beds"]),
            maxBeds: num(f["max-beds"]),
            minBaths: num(f["min-baths"]),
            log: (m) => process.stderr.write(`${q}: ${m}\n`),
          })),
        );
      }
      return out;
    },
    `
Usage: node scrapers/zillow/index.mjs <place | zillow.com search URL>... [options]

  "Austin, TX"   "78704"   https://www.zillow.com/austin-tx/rentals/
  --type FOR_SALE|FOR_RENT|SOLD   (default FOR_SALE)
  --max N                         listings per search (default 100, 41 per page, up to 820)
  --min-price --max-price --min-beds --max-beds --min-baths

Uses UNBROWSE_API_KEY when set (free at https://unbrowse.ai); without it, requests go straight to the site.`,
  );
}
