// Pure Pinterest helpers: input URL classification, resource tool inputs, and pin normalisation. No I/O.

export const ORIGIN = "https://www.pinterest.com";

/** Input for a Pinterest resource tool: the page the request is "for" and the resource options, as the web app sends them. */
export function toolInput(options, sourceUrl) {
  return { source_url: sourceUrl, data: JSON.stringify({ options, context: {} }) };
}

const RESERVED = new Set(["search", "pin", "ideas", "today", "categories", "topics", "explore", "business", "_", "resource", "settings", "login", "signup", "videos", "shopping"]);

/**
 * Classify a Pinterest URL. Returns one of
 * { kind: "search", query, scope } | { kind: "pin", id } | { kind: "board", username, slug, section? }
 * | { kind: "user", username, tab: "created" | "saved" } | { kind: "short", url } | null.
 */
export function classifyUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim().replace(/^(?!https?:)/, "https://"));
  } catch {
    return null;
  }
  if (/^pin\.it$/i.test(u.hostname)) return { kind: "short", url: u.toString() };
  if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
  if (!parts.length) return null;
  if (parts[0] === "search") {
    const q = u.searchParams.get("q");
    if (!q) return null;
    const scope = parts[1] === "videos" ? "videos" : "pins";
    return { kind: "search", query: q, scope };
  }
  if (parts[0] === "pin") {
    const id = parts[1]?.match(/(\d{5,})$/)?.[1] ?? parts[1];
    return id ? { kind: "pin", id } : null;
  }
  if (RESERVED.has(parts[0])) return null;
  const username = parts[0];
  if (parts.length === 1 || parts[1] === "_created" || parts[1] === "_pins") return { kind: "user", username, tab: "created" };
  if (parts[1] === "_saved" || parts[1] === "_profile" || parts[1] === "boards" || parts[1] === "pins") return { kind: "user", username, tab: "saved" };
  if (parts[1].startsWith("_")) return { kind: "user", username, tab: "created" };
  return { kind: "board", username, slug: parts[1], section: parts[2] && !parts[2].startsWith("_") ? parts[2] : undefined };
}

const clean = (s) => {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t || null;
};

/** Pinterest dates look like "Mon, 14 Sep 2026 23:28:52 +0000"; return ISO or null. */
export function isoDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function bestVideo(list) {
  if (!list || typeof list !== "object") return null;
  const mp4 = Object.entries(list)
    .filter(([, v]) => v?.url && /\.mp4(\?|$)/.test(v.url))
    .sort((a, b) => (b[1].width ?? 0) - (a[1].width ?? 0));
  const hls = Object.values(list).find((v) => v?.url && /\.m3u8(\?|$)/.test(v.url));
  const top = mp4[0]?.[1] ?? hls;
  if (!top) return null;
  return {
    url: top.url,
    hlsUrl: hls?.url ?? null,
    durationSec: top.duration ? Math.round(top.duration / 100) / 10 : null,
    width: top.width ?? null,
    height: top.height ?? null,
    thumbnail: top.thumbnail ?? null,
  };
}

/** Video from a regular video pin or from an idea (story) pin's video blocks. */
export function pinVideo(p) {
  const direct = bestVideo(p?.videos?.video_list);
  if (direct) return direct;
  for (const page of p?.story_pin_data?.pages ?? []) {
    for (const b of page?.blocks ?? []) {
      const v = bestVideo(b?.video?.video_list);
      if (v) return v;
    }
  }
  return null;
}

export function hashtags(p) {
  const out = new Set();
  for (const h of p?.hashtags ?? []) if (typeof h === "string" && h.replace(/^#/, "")) out.add("#" + h.replace(/^#/, ""));
  const text = [p?.description, p?.closeup_unified_description, p?.title].filter((x) => typeof x === "string").join(" ");
  for (const m of text.matchAll(/(?:^|\s)#([\p{L}\p{N}_]{2,60})/gu)) out.add("#" + m[1]);
  return [...out];
}

function user(u) {
  if (!u || typeof u !== "object" || !u.username) return null;
  return {
    id: u.id ?? null,
    username: u.username,
    fullName: clean(u.full_name) ?? clean(u.first_name),
    followers: Number.isFinite(u.follower_count) ? u.follower_count : null,
    profileUrl: `${ORIGIN}/${u.username}/`,
    avatar: u.image_large_url ?? u.image_medium_url ?? null,
    isVerifiedMerchant: !!u.is_verified_merchant,
  };
}

function hostOf(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Normalise one pin object from any resource (search, board feed, user pins, pin detail). */
export function normalizePin(p) {
  if (!p || p.type !== "pin" || !p.id) return null;
  const imgs = p.images ?? {};
  const orig = imgs.orig ?? imgs["originals"] ?? null;
  const largest = orig ?? imgs["736x"] ?? imgs["474x"] ?? imgs["236x"] ?? null;
  const video = pinVideo(p);
  const stats = p.aggregated_pin_data?.aggregated_stats;
  const saves = Number.isFinite(stats?.saves) ? stats.saves : Number.isFinite(p.repin_count) && p.repin_count > 0 ? p.repin_count : null;
  const reactions = p.reaction_counts && typeof p.reaction_counts === "object" ? Object.values(p.reaction_counts).reduce((a, b) => a + (Number(b) || 0), 0) : null;
  const link = p.link || p.tracked_link || null;
  const title = clean(p.title) ?? clean(p.grid_title) ?? clean(p.seo_title) ?? clean(p.story_pin_data?.metadata?.pin_title);
  const description = clean(p.description) ?? clean(p.closeup_unified_description) ?? clean(p.seo_description);
  const board = p.board && p.board.url
    ? { id: p.board.id ?? null, name: clean(p.board.name), url: ORIGIN + p.board.url, pinCount: p.board.pin_count ?? null }
    : null;
  return {
    id: String(p.id),
    url: `${ORIGIN}/pin/${p.id}/`,
    title,
    description,
    altText: clean(p.auto_alt_text) ?? clean(p.seo_alt_text) ?? clean(p.alt_text),
    imageUrl: largest?.url ?? null,
    imageWidth: largest?.width ?? null,
    imageHeight: largest?.height ?? null,
    images: {
      orig: orig?.url ?? null,
      "736x": imgs["736x"]?.url ?? null,
      "474x": imgs["474x"]?.url ?? null,
      "236x": imgs["236x"]?.url ?? null,
    },
    dominantColor: p.dominant_color ?? null,
    link,
    domain: p.link_domain?.official_name ?? hostOf(link) ?? (p.domain && p.domain !== "Uploaded by user" ? p.domain : null),
    isVideo: !!video || !!p.is_video,
    video,
    isIdeaPin: !!p.story_pin_data_id || !!p.story_pin_data,
    saves,
    comments: Number.isFinite(p.comment_count) ? p.comment_count : null,
    reactions,
    shares: Number.isFinite(p.share_count) ? p.share_count : null,
    hashtags: hashtags(p),
    annotations: Array.isArray(p.pin_join?.visual_annotation) ? p.pin_join.visual_annotation.slice(0, 20) : [],
    createdAt: isoDate(p.created_at),
    pinner: user(p.pinner) ?? user(p.native_creator) ?? user(p.board?.owner),
    board,
    isPromoted: !!p.is_promoted,
    isRepin: typeof p.is_repin === "boolean" ? p.is_repin : null,
    price: p.price_value ? { value: p.price_value, currency: p.price_currency ?? null } : null,
  };
}

/** Merge a detail pin into a feed pin: detail wins where it has a value. */
export function mergePin(base, detail) {
  if (!detail) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(detail)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && !v.length && Array.isArray(base[k]) && base[k].length) continue;
    if (k === "pinner" && base.pinner) {
      out.pinner = { ...base.pinner, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null)) };
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Parse a resource API response body. Returns { status, pins, raw, data, bookmark } or throws on non-JSON. */
export function parseResource(body) {
  const j = typeof body === "string" ? JSON.parse(body) : body;
  const r = j?.resource_response;
  if (!r) throw new Error("Unexpected response (no resource_response).");
  const data = r.data;
  const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : null;
  const pins = (list ?? (data?.type === "pin" ? [data] : [])).map(normalizePin).filter(Boolean);
  const bm = r.bookmark ?? (Array.isArray(r.bookmarks) ? r.bookmarks[0] : null);
  const bookmark = bm && bm !== "-end-" && !String(bm).startsWith("Y2JOb25lO") ? bm : null;
  return { status: r.status, message: r.message ?? null, code: r.code ?? null, data, pins, bookmark };
}

/** Profile summary from UserResource. */
export function parseUser(data) {
  if (!data?.username) return null;
  return { id: data.id ?? null, username: data.username, fullName: clean(data.full_name), followers: data.follower_count ?? null, pinCount: data.pin_count ?? null };
}
