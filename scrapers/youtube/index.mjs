#!/usr/bin/env node
// YouTube Scraper: search results and video details (views, likes, comments count, channel, tags) as JSON.
// Pages are read through the public Unbrowse tool public.youtube_com.read_page, sent from this machine;
// without a key, or when the tool is unavailable, the same page is requested directly.
import { fileURLToPath } from "node:url";
import { cli, mapLimit, readPage } from "../../lib/read-page.mjs";
import { parseSearch, parseVideo, videoId } from "./parse.mjs";

const CAPABILITY = "public.youtube_com.read_page";
const HOSTS = ["youtube.com"];
const get = (path) => readPage(CAPABILITY, { path }, { hosts: HOSTS, direct: { url: `https://www.youtube.com${path}` } });

/** Full details for one video (id or URL). */
export async function scrapeVideo(idOrUrl) {
  const id = videoId(idOrUrl);
  if (!id) throw new Error(`Not a YouTube video: ${idOrUrl}`);
  const page = await get(`/watch?v=${id}&hl=en&gl=US`);
  const v = parseVideo(page.body);
  if (!v) throw new Error(`${id}: no video on the page (removed, private or age-restricted)`);
  return { ...v, scrapedAt: new Date().toISOString() };
}

/**
 * Videos for a search query, in YouTube's order (the first results page: about 20 videos
 * plus Shorts). `details: true` reads each watch page for likes, comment count, tags, full description.
 */
export async function scrapeSearch(query, { max = 20, details = false, shorts = false, concurrency = 3 } = {}) {
  const page = await get(`/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`);
  const cards = parseSearch(page.body);
  if (!cards) throw new Error("YouTube did not return a results page");
  const list = cards.filter((c) => shorts || !c.isShort).slice(0, max);
  let items = list;
  if (details) {
    const full = await mapLimit(list, concurrency, (c) => scrapeVideo(c.id));
    items = list.map((c, i) => (full[i]?.error ? { ...c, detailsError: full[i].error.message } : { ...c, ...full[i] }));
  }
  const now = new Date().toISOString();
  return items.map((it, i) => ({ ...it, position: i + 1, searchQuery: query, scrapedAt: it.scrapedAt ?? now }));
}

/** Video URLs/ids become video details; anything else is a search. */
export async function scrape(inputs, opts = {}) {
  const out = [];
  for (const input of inputs) {
    if (videoId(input)) out.push(await scrapeVideo(input));
    else out.push(...(await scrapeSearch(input, opts)));
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli(
    (pos, f) => scrape(pos, { max: Number(f.max ?? 20), details: !!f.details, shorts: !!f.shorts }),
    `
Usage: node scrapers/youtube/index.mjs <search terms | video URL | video id>... [--max 20] [--details] [--shorts]

  "lofi hip hop"                                  search results (title, channel, views, duration, published)
  https://www.youtube.com/watch?v=dQw4w9WgXcQ     one video (views, likes, comments count, tags, description)
  --max N      videos per search (default 20; one results page, about 20 videos)
  --details    also read every video page (one extra call per video)
  --shorts     include Shorts in search results

Uses UNBROWSE_API_KEY when set (free at https://unbrowse.ai); without it, requests go straight to the site.`,
  );
}
