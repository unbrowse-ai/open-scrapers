#!/usr/bin/env node
// Medium Scraper: articles from a tag, an author, a publication, a keyword search or article URLs, as structured JSON,
// optionally with the full text as Markdown. Requests go to Medium's own GraphQL endpoint through public Unbrowse
// tools, sent from this machine; without a key, or when a tool is unavailable, that endpoint is called directly.
import { fileURLToPath } from "node:url";
import { cli, mapLimit, readPage } from "../../lib/read-page.mjs";
import { TAG_MODES, graphqlBody, parseContent, parseFeed, postId, publicationKey, responseData, tagSlug, toArticle, username } from "./parse.mjs";

const TOOL = {
  tag: "public.medium_com.post_tag_feed",
  author: "public.medium_com.post_user_posts",
  publication: "public.medium_com.post_publication_posts",
  search: "public.medium_com.post_search_posts",
  article: "public.medium_com.post_post_content",
};
const HOSTS = ["medium.com"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Medium's CDN refuses requests that do not look like a browser, so send a browser user agent with the tool's request.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const browserFetch = (url, init) => fetch(url, { ...init, headers: { ...init.headers, "user-agent": UA } });

async function call(kind, input) {
  // The request the tool stands for, sent straight to Medium's GraphQL endpoint when the tool cannot run.
  const direct = {
    url: "https://medium.com/_/graphql",
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "apollographql-client-name": "lite", origin: "https://medium.com", referer: "https://medium.com/" },
    body: graphqlBody(kind, input),
  };
  const p = await readPage(TOOL[kind], input, { hosts: HOSTS, minBytes: 20, fetch: browserFetch, direct });
  return responseData(p.body);
}

/** "tag:programming", "@karpathy", "pub:better-programming", "search:rust async", or a Medium URL → { type, key }. */
export function classify(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(tag|author|user|pub|publication|search|article):\s*(.+)$/i);
  if (m) {
    const t = m[1].toLowerCase();
    if (t === "tag") return { type: "tag", key: tagSlug(m[2]) };
    if (t === "author" || t === "user") return { type: "author", key: username(m[2]) };
    if (t === "pub" || t === "publication") return { type: "publication", key: publicationKey(m[2]) };
    if (t === "search") return { type: "search", key: m[2].trim() };
    return { type: "article", key: postId(m[2]) };
  }
  if (s.startsWith("@")) return { type: "author", key: username(s) };
  if (/medium\.com\/tag\//i.test(s)) return { type: "tag", key: tagSlug(s) };
  if (/^https?:\/\//i.test(s)) {
    const id = postId(s);
    if (id) return { type: "article", key: id };
    const u = username(s);
    if (u && /medium\.com\/@|^https?:\/\/(?!www\.)[a-z0-9_.-]+\.medium\.com/i.test(s)) return { type: "author", key: u };
    return { type: "publication", key: publicationKey(s) };
  }
  return { type: "search", key: s };
}

/**
 * Articles for one input (see classify). Options: max (default 50; 25 per request), sort (tags only: NEW, HOT,
 * TOP_WEEK, TOP_MONTH, TOP_YEAR, TOP_ALL_TIME), content (add the article body as Markdown and text; one extra request
 * per article; member-only articles give the free preview, flagged contentIsPreview).
 */
export async function scrape(input, { max = 50, sort = "NEW", content = false, log = () => {} } = {}) {
  const src = classify(input);
  if (!src.key) throw new Error(`Could not read a Medium ${src.type} from "${input}"`);
  const limit = Math.max(1, Math.min(Number(max) || 50, 5000));
  const mode = TAG_MODES.includes(String(sort).toUpperCase()) ? String(sort).toUpperCase() : "NEW";
  let articles = [];
  if (src.type === "article") {
    const data = await call("article", { id: src.key });
    if (!data.post?.id) throw new Error(`Article ${src.key} not found`);
    const a = toArticle(data.post);
    if (content) Object.assign(a, withContent(parseContent(data.post)));
    articles = [a];
    content = false;
  } else {
    const seen = new Set();
    let next = null;
    for (let page = 0; articles.length < limit && page < 400; page++) {
      if (page) await sleep(500 + Math.random() * 500);
      let data;
      if (src.type === "tag") data = await call("tag", { tag: src.key, mode, from: next?.from ?? "" });
      else if (src.type === "author") data = await call("author", { username: src.key, from: next?.from ?? "" });
      else if (src.type === "publication") data = await call("publication", { publication: src.key, from: next?.from ?? "" });
      else data = await call("search", { query: src.key, page: String(next?.page ?? 0) });
      if (src.type === "author" && data.user === null) throw new Error(`No Medium user "@${src.key}"`);
      if (src.type === "publication" && data.collectionByDomainOrSlug === null) throw new Error(`No Medium publication "${src.key}"`);
      const feed = parseFeed(src.type === "author" ? "user" : src.type, data);
      if (!feed) throw new Error("Medium returned no feed data");
      let fresh = 0;
      for (const p of feed.posts) if (!seen.has(p.id)) seen.add(p.id), fresh++, articles.length < limit && articles.push(toArticle(p));
      log(`${src.type} ${src.key}: page ${page + 1}: ${feed.posts.length} articles, ${articles.length} kept`);
      if (!feed.next || !fresh) break;
      next = feed.next;
    }
  }
  if (content && articles.length) {
    log(`reading ${articles.length} article bodies`);
    const bodies = await mapLimit(articles, 4, async (a) => parseContent((await call("article", { id: a.id })).post));
    articles = articles.map((a, i) => ({ ...a, ...withContent(bodies[i]?.error ? null : bodies[i]) }));
  }
  const now = new Date().toISOString();
  return articles.map((a) => ({ ...a, sourceType: src.type, sourceValue: src.key, scrapedAt: now }));
}

const withContent = (c) => ({ markdown: c?.markdown ?? null, text: c?.text ?? null, contentIsPreview: c ? c.contentIsPreview : null });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli(
    async (pos, f) => {
      const out = [];
      for (const q of pos) out.push(...(await scrape(q, { max: f.max, sort: f.sort, content: !!f.content, log: (m) => process.stderr.write(`${m}\n`) })));
      return out;
    },
    `
Usage: node scrapers/medium/index.mjs <input>... [options]

  tag:programming              https://medium.com/tag/machine-learning
  @karpathy                    https://medium.com/@dhh   https://karpathy.medium.com/
  pub:better-programming       pub:levelup.gitconnected.com
  "search:rust async"          (a bare phrase is a search too)
  https://medium.com/p/<id>    any article URL
  --max N        articles per input (default 50, 25 per request)
  --sort MODE    tags only: NEW (default), HOT, TOP_WEEK, TOP_MONTH, TOP_YEAR, TOP_ALL_TIME
  --content      add each article's body as Markdown and plain text (one request per article)

Uses UNBROWSE_API_KEY when set (free at https://unbrowse.ai); without it, requests go straight to the site.`,
  );
}
