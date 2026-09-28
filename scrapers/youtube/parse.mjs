// YouTube search results and video details from the JSON embedded in YouTube's own pages
// (ytInitialData, ytInitialPlayerResponse). Pure: HTML in, plain objects out.

export function walk(o, key, out = []) {
  if (o && typeof o === "object") {
    if (key in o) out.push(o[key]);
    for (const v of Object.values(o)) walk(v, key, out);
  }
  return out;
}

const text = (t) => (t == null ? null : typeof t === "string" ? t : t.simpleText ?? t.content ?? t.runs?.map((r) => r.text).join("") ?? null);

/** "1,234,567 views" / "9M views" / "2.4K" → number (approximate for abbreviated counts). */
export function parseCount(s) {
  if (s == null) return null;
  const m = String(s).replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return /no views/i.test(s) ? 0 : null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase()] ?? 1;
  return Math.round(parseFloat(m[1]) * mult);
}

export function durationToSeconds(s) {
  if (!s || !/^\d+(:\d+)*$/.test(s)) return null;
  return s.split(":").map(Number).reduce((a, n) => a * 60 + n, 0);
}

/** A video id from a URL (watch, youtu.be, shorts, live, embed) or a bare 11-character id. */
export function videoId(raw) {
  const s = String(raw ?? "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (!/(^|\.)youtube\.com$/.test(host)) return null;
  if (u.pathname === "/watch") return u.searchParams.get("v");
  return u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1] ?? null;
}

/** Pull `var name = {...};` JSON out of a YouTube page. */
export function embeddedJson(html, name) {
  const m = String(html ?? "").match(new RegExp(`(?:var |window\\[")${name}(?:"\\])? = `));
  if (!m) return null;
  const start = m.index + m[0].length;
  // Walk braces to find the end of the object literal (strings may contain "};").
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function fromVideoRenderer(v) {
  const duration = text(v.lengthText);
  return {
    id: v.videoId,
    url: `https://www.youtube.com/watch?v=${v.videoId}`,
    title: text(v.title),
    channelName: text(v.ownerText) ?? text(v.longBylineText),
    channelId: v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null,
    viewCount: parseCount(text(v.viewCountText)),
    publishedTimeText: text(v.publishedTimeText),
    duration,
    durationSeconds: durationToSeconds(duration),
    description: v.detailedMetadataSnippets?.map((s) => text(s.snippetText)).join(" ") || null,
    thumbnailUrl: v.thumbnail?.thumbnails?.at(-1)?.url ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
  };
}

function fromLockup(l) {
  if (l.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return null;
  const parts = walk(l.metadata, "metadataParts").flat().map((p) => p?.text?.content).filter(Boolean);
  const badge = walk(l.contentImage, "thumbnailBadgeViewModel")[0]?.text;
  const duration = badge && /\d:\d/.test(badge) ? badge : null;
  return {
    id: l.contentId,
    url: `https://www.youtube.com/watch?v=${l.contentId}`,
    title: l.metadata?.lockupMetadataViewModel?.title?.content ?? null,
    viewCount: parseCount(parts.find((p) => /view/i.test(p))),
    publishedTimeText: parts.find((p) => /ago|streamed|premiere/i.test(p)) ?? null,
    duration,
    durationSeconds: durationToSeconds(duration),
  };
}

function fromShortsLockup(s) {
  const id = s.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ?? walk(s, "videoId")[0];
  if (!id) return null;
  return { id, url: `https://www.youtube.com/shorts/${id}`, title: s.overlayMetadata?.primaryText?.content ?? null, viewCount: parseCount(s.overlayMetadata?.secondaryText?.content), isShort: true };
}

/** A search results page (/results?search_query=...) → video cards in page order. Null when not a results page. */
export function parseSearch(html) {
  const data = embeddedJson(html, "ytInitialData");
  if (!data) return null;
  const seen = new Set();
  const out = [];
  const add = (x) => { if (x?.id && !seen.has(x.id)) { seen.add(x.id); out.push(x); } };
  walk(data, "videoRenderer").forEach((v) => add(fromVideoRenderer(v)));
  walk(data, "lockupViewModel").forEach((l) => add(fromLockup(l)));
  walk(data, "shortsLockupViewModel").forEach((s) => add(fromShortsLockup(s)));
  return out;
}

/** A watch page → full video details. Null when the page carries no video (removed, private, bot check). */
export function parseVideo(html) {
  const player = embeddedJson(html, "ytInitialPlayerResponse");
  const next = embeddedJson(html, "ytInitialData");
  const vd = player?.videoDetails;
  if (!vd?.videoId) return null;
  const mf = player?.microformat?.playerMicroformatRenderer ?? {};
  const likeText = walk(next, "likeButtonViewModel")[0]?.likeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel?.defaultButtonViewModel?.buttonViewModel?.accessibilityText;
  const commentsText = walk(next, "engagementPanelTitleHeaderRenderer").map((x) => text(x.contextualInfo)).find(Boolean);
  const owner = walk(next, "videoOwnerRenderer")[0];
  return {
    id: vd.videoId,
    url: `https://www.youtube.com/watch?v=${vd.videoId}`,
    title: vd.title ?? null,
    description: vd.shortDescription ?? null,
    viewCount: vd.viewCount ? Number(vd.viewCount) : null,
    likes: likeText ? parseCount(likeText.match(/([\d,]+) other/)?.[1] ?? likeText) : null,
    commentsCount: parseCount(commentsText),
    durationSeconds: vd.lengthSeconds ? Number(vd.lengthSeconds) : null,
    publishedAt: mf.publishDate ?? null,
    uploadedAt: mf.uploadDate ?? null,
    category: mf.category ?? null,
    keywords: vd.keywords ?? [],
    isLive: !!vd.isLiveContent,
    isFamilySafe: mf.isFamilySafe ?? null,
    channelName: vd.author ?? null,
    channelId: vd.channelId ?? null,
    channelUrl: mf.ownerProfileUrl ?? (vd.channelId ? `https://www.youtube.com/channel/${vd.channelId}` : null),
    channelSubscribers: parseCount(text(owner?.subscriberCountText)),
    thumbnailUrl: vd.thumbnail?.thumbnails?.at(-1)?.url ?? `https://i.ytimg.com/vi/${vd.videoId}/hqdefault.jpg`,
    playability: player?.playabilityStatus?.status ?? null,
  };
}
