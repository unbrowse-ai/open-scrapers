#!/usr/bin/env node
// Pinterest Scraper: pins from a keyword search, a board, a user's created pins or single pin URLs, as structured JSON.
// Requests go to Pinterest's own resource API (the JSON its web app loads) through public Unbrowse tools, sent from this machine;
// without a key, or when a tool is unavailable, that API is called directly.
import { fileURLToPath } from "node:url";
import { cli, mapLimit, readPage } from "../../lib/read-page.mjs";
import { ORIGIN, classifyUrl, mergePin, parseResource, toolInput } from "./parse.mjs";

const TOOL = {
  search: "public.pinterest_com.get_base_search_resource_get",
  pin: "public.pinterest_com.get_pin_resource_get",
  board: "public.pinterest_com.get_board_resource_get",
  boardFeed: "public.pinterest_com.get_board_feed_resource_get",
  userPins: "public.pinterest_com.get_user_activity_pins_resource_get",
};
const HOSTS = ["pinterest.com"];
// The request each tool stands for: Pinterest's resource API with the page handler its web app sends
// (without x-pinterest-pws-handler it answers 403). Used directly when a tool cannot run. No cookies.
const RESOURCE = {
  [TOOL.search]: ["BaseSearchResource", "www/search/[scope].js"],
  [TOOL.pin]: ["PinResource", "www/pin/[id].js"],
  [TOOL.board]: ["BoardResource", "www/[username]/[slug].js"],
  [TOOL.boardFeed]: ["BoardFeedResource", "www/[username]/[slug].js"],
  [TOOL.userPins]: ["UserActivityPinsResource", "www/[username]/_created.js"],
};
function directRequest(tool, input) {
  const [name, handler] = RESOURCE[tool];
  return {
    url: `${ORIGIN}/resource/${name}/get/?${new URLSearchParams(input)}`,
    headers: { accept: "application/json, text/javascript, */*, q=0.01", "x-requested-with": "XMLHttpRequest", "x-pinterest-pws-handler": handler, "x-pinterest-source-url": input.source_url, "x-pinterest-appstate": "active", referer: `${ORIGIN}/` },
  };
}
const PAGE_SIZE = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One resource call → parseResource(). A 404 (pin, board or user gone) is "not found", not a refusal of this IP. */
async function resource(tool, options, sourceUrl) {
  try {
    const input = toolInput(options, sourceUrl);
    const p = await readPage(tool, input, { hosts: HOSTS, minBytes: 50, direct: directRequest(tool, input) });
    return parseResource(p.body);
  } catch (err) {
    if (err.page?.status === 404) return { status: "not_found", pins: [], data: null, bookmark: null };
    throw err;
  }
}

/** Page through a feed until `limit` pins or the end. */
async function feed(tool, baseOptions, sourceUrl, limit, log) {
  const out = [];
  const seen = new Set();
  let bookmark = null;
  for (let page = 0; out.length < limit && page < 200; page++) {
    if (page) await sleep(700 + Math.random() * 700);
    const r = await resource(tool, { ...baseOptions, page_size: PAGE_SIZE, bookmarks: bookmark ? [bookmark] : [] }, sourceUrl);
    if (r.status === "not_found") break;
    let fresh = 0;
    for (const p of r.pins) if (!seen.has(p.id)) seen.add(p.id), fresh++, out.length < limit && out.push(p);
    log(`${sourceUrl}: page ${page + 1}: ${r.pins.length} pins, ${out.length} kept`);
    if (!r.bookmark || !fresh) break;
    bookmark = r.bookmark;
  }
  return out;
}

async function pinDetail(id) {
  const r = await resource(TOOL.pin, { id: String(id), field_set_key: "detailed" }, `/pin/${id}/`);
  return r.pins[0] ?? null;
}

async function resolveShort(url) {
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
  const loc = res.headers.get("location");
  return loc ? classifyUrl(new URL(loc, url).toString()) : null;
}

/**
 * Pins for a keyword ("kitchen ideas") or a Pinterest URL: search (/search/pins/?q=), board (/user/board/),
 * profile (/user/ or /user/_created/: the pins they created) or a single pin (/pin/123/, pin.it/...).
 * Options: max (default 50), videos (search video pins only), details (open every pin for saves, comments,
 * video files and outbound link; one extra request per pin).
 */
export async function scrape(input, { max = 50, videos = false, details = false, log = () => {} } = {}) {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("Give a keyword or a Pinterest URL");
  let src = /^(https?:\/\/)?([a-z0-9-]+\.)*(pinterest\.[a-z.]+|pin\.it)\//i.test(raw) ? classifyUrl(raw) : { kind: "search", query: raw, scope: videos ? "videos" : "pins" };
  if (src?.kind === "short") src = await resolveShort(src.url);
  if (!src || src.kind === "short") throw new Error(`Use a keyword or a Pinterest search, board, profile or pin URL, got "${raw}"`);
  const limit = Math.max(1, Math.min(Number(max) || 50, 5000));
  let pins = [];
  let extra = {};
  if (src.kind === "pin") {
    const p = await pinDetail(src.id);
    if (!p) throw new Error(`Pin ${src.id} not found or not public`);
    pins = [p];
    details = false;
  } else if (src.kind === "search") {
    const path = `/search/${src.scope}/?q=${encodeURIComponent(src.query)}`;
    pins = await feed(TOOL.search, { query: src.query, scope: src.scope, auto_correction_disabled: false }, path, limit, log);
    extra = { searchQuery: src.query };
  } else if (src.kind === "board") {
    const path = `/${src.username}/${src.slug}/`;
    const b = await resource(TOOL.board, { username: src.username, slug: src.slug, field_set_key: "detailed" }, path);
    const board = b.data;
    if (!board?.id) throw new Error(`Board ${path} not found or not public`);
    extra = { boardInput: { id: board.id, name: board.name ?? null, url: ORIGIN + (board.url ?? path), pinCount: board.pin_count ?? null, followers: board.follower_count ?? null } };
    pins = await feed(TOOL.boardFeed, { board_id: board.id, board_url: board.url ?? path, field_set_key: "react_grid_pin", filter_section_pins: false, sort: "default", layout: "default", redux_normalize_feed: true }, path, limit, log);
  } else {
    if (src.tab === "saved") throw new Error("Saved pins are not supported yet; use the profile's /_created/ pins or one of its boards");
    pins = await feed(TOOL.userPins, { username: src.username, field_set_key: "grid_item" }, `/${src.username}/_created/`, limit, log);
  }
  if (details && pins.length) {
    log(`opening ${pins.length} pins for details`);
    const more = await mapLimit(pins, 4, (p) => pinDetail(p.id));
    pins = pins.map((p, i) => (more[i] && !more[i].error ? mergePin(p, more[i]) : p));
  }
  const now = new Date().toISOString();
  return pins.map((p) => ({ ...p, ...extra, source: src.kind, sourceInput: raw, scrapedAt: now }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli(
    async (pos, f) => {
      const out = [];
      for (const q of pos) out.push(...(await scrape(q, { max: f.max, videos: !!f.videos, details: !!f.details, log: (m) => process.stderr.write(`${m}\n`) })));
      return out;
    },
    `
Usage: node scrapers/pinterest/index.mjs <keyword | Pinterest URL>... [options]

  "kitchen ideas"   https://www.pinterest.com/search/pins/?q=fall%20outfits
  https://www.pinterest.com/<user>/<board>/   https://www.pinterest.com/<user>/   https://www.pinterest.com/pin/<id>/
  --max N        pins per input (default 50, 25 per request)
  --videos       keyword search: video pins only
  --details      open every pin: saves, comments, reactions, video files, outbound link (one request per pin)

Uses UNBROWSE_API_KEY when set (free at https://unbrowse.ai); without it, requests go straight to the site.`,
  );
}
