// Medium: pure parsers (no I/O) for the answers of Medium's GraphQL endpoint (https://medium.com/_/graphql),
// which the public Unbrowse Medium tools call. Each answer is a JSON array with one { data } per query.

export const TAG_MODES = ["NEW", "HOT", "TOP_WEEK", "TOP_MONTH", "TOP_YEAR", "TOP_ALL_TIME"];

/** The raw answer → the first query's `data`, or throws with Medium's own error message. */
export function responseData(body) {
  const j = typeof body === "string" ? JSON.parse(body) : body;
  const first = Array.isArray(j) ? j[0] : j;
  if (first?.data) return first.data;
  throw new Error(`Medium answered without data${first?.errors?.[0]?.message ? `: ${first.errors[0].message}` : ""}`);
}

/** One page of a feed: { posts, next } where next is the paging object for the following page, or null. */
export function parseFeed(kind, data) {
  let conn;
  if (kind === "tag") conn = data?.tagFeed && { posts: (data.tagFeed.items ?? []).map((i) => i?.post), pagingInfo: data.tagFeed.pagingInfo };
  else if (kind === "user") conn = data?.user?.homepagePostsConnection;
  else if (kind === "publication") conn = (data?.collectionByDomainOrSlug ?? data?.collection)?.homepagePostsConnection;
  else if (kind === "search") conn = data?.search?.posts && { posts: data.search.posts.items, pagingInfo: data.search.posts.pagingInfo };
  if (!conn) return null;
  return { posts: (conn.posts ?? []).filter((p) => p?.id), next: conn.pagingInfo?.next ?? null };
}

const iso = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);
const imageUrl = (id) => (id ? `https://miro.medium.com/v2/resize:fit:1400/${id}` : null);

/** Flatten a GraphQL Post into the dataset shape. */
export function toArticle(p) {
  const author = p.creator ?? {};
  const pub = p.collection ?? null;
  const url = p.mediumUrl || (p.uniqueSlug ? `https://medium.com/p/${p.id}` : null);
  return {
    id: p.id,
    url: url ? url.split("?")[0] : `https://medium.com/p/${p.id}`,
    title: p.title || null,
    subtitle: p.extendedPreviewContent?.subtitle || null,
    authorName: author.name ?? null,
    authorUsername: author.username ?? null,
    authorUrl: author.username ? `https://medium.com/@${author.username}` : null,
    authorId: author.id ?? null,
    publicationName: pub?.name ?? null,
    publicationSlug: pub?.slug ?? null,
    publicationUrl: pub ? (pub.domain ? `https://${pub.domain}` : pub.slug ? `https://medium.com/${pub.slug}` : null) : null,
    publishedAt: iso(p.firstPublishedAt),
    updatedAt: iso(p.latestPublishedAt),
    readingTimeMinutes: Number.isFinite(p.readingTime) ? Math.round(p.readingTime * 10) / 10 : null,
    wordCount: p.wordCount ?? null,
    claps: p.clapCount ?? null,
    responses: p.postResponses?.count ?? null,
    tags: (p.tags ?? []).map((t) => t?.normalizedTagSlug || t?.id).filter(Boolean),
    imageUrl: imageUrl(p.previewImage?.id),
    isMemberOnly: p.isLocked === true || p.visibility === "LOCKED",
    language: p.detectedLanguage ?? null,
  };
}

// ---- body → Markdown / text ----

const MARK = { STRONG: ["**", "**"], EM: ["*", "*"], CODE: ["`", "`"] };

/** Apply Medium's offset-based markups (bold, italic, code, links) to one paragraph's text. */
export function applyMarkups(text, markups = []) {
  if (!text) return "";
  const chars = Array.from(text); // code points, matching Medium's offsets for most text
  const open = Array.from({ length: chars.length + 1 }, () => []);
  const close = Array.from({ length: chars.length + 1 }, () => []);
  for (const m of markups ?? []) {
    const s = Math.max(0, Math.min(chars.length, m.start ?? 0));
    const e = Math.max(s, Math.min(chars.length, m.end ?? 0));
    if (e <= s) continue;
    let pair = MARK[m.type];
    if (m.type === "A") {
      const href = m.href || (m.userId ? `https://medium.com/u/${m.userId}` : null);
      if (!href) continue;
      pair = ["[", `](${href})`];
    }
    if (!pair) continue;
    open[s].push({ tok: pair[0], len: e - s });
    close[e].unshift({ tok: pair[1] });
  }
  let out = "";
  for (let i = 0; i <= chars.length; i++) {
    for (const c of close[i]) out += c.tok;
    for (const o of open[i].sort((a, b) => b.len - a.len)) out += o.tok;
    if (i < chars.length) out += chars[i];
  }
  return out;
}

/** Paragraph list → { markdown, text }. */
export function bodyToMarkdown(paragraphs = []) {
  const md = [];
  const txt = [];
  let olIndex = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i] ?? {};
    const raw = p.text ?? "";
    const rich = applyMarkups(raw, p.markups);
    if (p.type !== "OLI") olIndex = 0;
    switch (p.type) {
      case "H2": md.push(`# ${rich}`); break;
      case "H3": md.push(`## ${rich}`); break;
      case "H4": md.push(`### ${rich}`); break;
      case "BQ": case "PQ": md.push(`> ${rich}`); break;
      case "ULI": md.push(`- ${rich}`); break;
      case "OLI": md.push(`${++olIndex}. ${rich}`); break;
      case "PRE": md.push("```" + (p.codeBlockMetadata?.lang ?? "") + "\n" + raw + "\n```"); break;
      case "IMG": {
        const src = imageUrl(p.metadata?.id);
        if (src) md.push(`![${raw.replace(/[[\]]/g, "")}](${src})`);
        break;
      }
      case "IFRAME": {
        const href = p.iframe?.mediaResource?.href || p.iframe?.mediaResource?.iframeSrc;
        if (href) md.push(`[${p.iframe?.mediaResource?.title || "Embedded content"}](${href})`);
        break;
      }
      case "MIXTAPE_EMBED": {
        const href = p.mixtapeMetadata?.href || p.href;
        const label = raw.split("\n")[0].trim() || href;
        md.push(href ? `[${label}](${href})` : rich);
        break;
      }
      case "HR": md.push("---"); break;
      default: if (rich) md.push(rich);
    }
    if (raw && p.type !== "IMG") txt.push(raw);
  }
  // Consecutive list items share a block; everything else is separated by a blank line.
  let markdown = "";
  for (let i = 0; i < md.length; i++) {
    const isList = /^(- |\d+\. )/.test(md[i]);
    const prevList = i > 0 && /^(- |\d+\. )/.test(md[i - 1]);
    markdown += i === 0 ? md[i] : (isList && prevList ? "\n" : "\n\n") + md[i];
  }
  return { markdown, text: txt.join("\n\n") };
}

/** Content from a post(id){content} response: { markdown, text, contentIsPreview } or null. */
export function parseContent(post) {
  const paragraphs = post?.content?.bodyModel?.paragraphs;
  if (!Array.isArray(paragraphs) || !paragraphs.length) return null;
  const { markdown, text } = bodyToMarkdown(paragraphs);
  return { markdown, text, contentIsPreview: post.content.isLockedPreviewOnly === true };
}

// ---- inputs ----

const clean = (s) => String(s ?? "").trim();

/** "machine-learning", "Machine Learning", "https://medium.com/tag/machine-learning/recommended" → "machine-learning". */
export function tagSlug(v) {
  const s = clean(v);
  const m = s.match(/medium\.com\/tag\/([^/?#]+)/i);
  const slug = (m ? decodeURIComponent(m[1]) : s).toLowerCase().replace(/^#/, "").replace(/[\s_]+/g, "-");
  return slug || null;
}

/** "@dhh", "dhh", "https://medium.com/@dhh", "https://dhh.medium.com/" → "dhh". */
export function username(v) {
  const s = clean(v);
  let m = s.match(/medium\.com\/@([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  m = s.match(/^(?:https?:\/\/)?([a-z0-9_.-]+)\.medium\.com/i);
  if (m && m[1].toLowerCase() !== "www") return m[1];
  if (/^https?:\/\//i.test(s)) return null;
  return s.replace(/^@/, "") || null;
}

/** "better-programming", "https://medium.com/better-programming", "levelup.gitconnected.com" → slug or domain. */
export function publicationKey(v) {
  const s = clean(v);
  let m = s.match(/^(?:https?:\/\/)?(?:www\.)?medium\.com\/([^/?#@]+)/i);
  if (m) return decodeURIComponent(m[1]).toLowerCase();
  m = s.match(/^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[/?#]|$)/i);
  if (m) return m[1].toLowerCase().replace(/^www\./, "");
  return s ? s.toLowerCase() : null;
}

/** Article URL → post id (the hex suffix of the last path segment, or /p/<id>). */
export function postId(v) {
  const s = clean(v);
  if (/^[0-9a-f]{8,12}$/i.test(s)) return s.toLowerCase();
  let path;
  try {
    path = new URL(s).pathname;
  } catch {
    return null;
  }
  const seg = path.split("/").filter(Boolean);
  if (!seg.length) return null;
  if (seg[seg.length - 2] === "p" && /^[0-9a-f]{8,12}$/i.test(seg.at(-1))) return seg.at(-1).toLowerCase();
  const m = seg.at(-1).match(/(?:^|-)([0-9a-f]{8,12})$/i);
  return m ? m[1].toLowerCase() : null;
}

// The GraphQL operations the public tools send, rebuilt here so the same request can go straight to Medium
// when a tool cannot run. Keyed by the scraper's call kinds; `input` is the tool input.
const POST_FIELDS = "id title mediumUrl uniqueSlug firstPublishedAt latestPublishedAt readingTime wordCount clapCount isLocked visibility detectedLanguage postResponses { count } tags { id displayTitle normalizedTagSlug } creator { id name username } collection { id name slug domain } previewImage { id } extendedPreviewContent { subtitle }";
const CONTENT_FIELDS = "content(postMeteringOptions: {}) { isLockedPreviewOnly bodyModel { paragraphs { name type text href layout markups { type start end href anchorType userId } metadata { id } codeBlockMetadata { lang } mixtapeMetadata { href } iframe { mediaResource { href iframeSrc title } } } } }";
const PAGED = `posts { ${POST_FIELDS} } pagingInfo { next { from limit } }`;
const OPERATIONS = {
  tag: ["TagFeed", `query TagFeed($t: String!, $m: TagFeedMode, $p: PagingOptions) { tagFeed(tagSlug: $t, mode: $m, paging: $p) { items { post { ${POST_FIELDS} } } pagingInfo { next { from limit } } } }`, (i) => ({ t: i.tag, m: i.mode, p: { limit: 25, from: i.from ?? "" } })],
  author: ["UserPosts", `query UserPosts($u: ID!, $p: PagingOptions) { user(username: $u) { id name homepagePostsConnection(paging: $p) { ${PAGED} } } }`, (i) => ({ u: i.username, p: { limit: 25, from: i.from ?? "" } })],
  publication: ["PublicationPosts", `query PublicationPosts($s: ID!, $p: PagingOptions) { collectionByDomainOrSlug(domainOrSlug: $s) { id name slug domain homepagePostsConnection(paging: $p) { ${PAGED} } } }`, (i) => ({ s: i.publication, p: { limit: 25, from: i.from ?? "" } })],
  search: ["SearchPosts", `query SearchPosts($q: String!, $p: SearchPagingOptions) { search(query: $q) { ... on Search { posts(pagingOptions: $p) { ... on SearchPost { items { ${POST_FIELDS} } pagingInfo { next { page limit } } } } } } }`, (i) => ({ q: i.query, p: { limit: 25, page: Number(i.page) || 0 } })],
  article: ["PostContent", `query PostContent($id: ID!) { post(id: $id) { ${POST_FIELDS} ${CONTENT_FIELDS} } }`, (i) => ({ id: i.id })],
};

/** JSON body for Medium's GraphQL endpoint (https://medium.com/_/graphql) for one call kind and tool input. */
export function graphqlBody(kind, input) {
  const [operationName, query, vars] = OPERATIONS[kind];
  return JSON.stringify({ operationName, query, variables: vars(input) });
}
