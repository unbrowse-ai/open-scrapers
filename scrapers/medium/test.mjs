import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classify } from "./index.mjs";
import { applyMarkups, parseContent, parseFeed, postId, publicationKey, responseData, tagSlug, toArticle, username } from "./parse.mjs";

// Fixtures: real answers of Medium's GraphQL endpoint through the public Medium tools, 2026-09-30: tag "programming"
// (newest), author @karpathy, search "rust async", publication better-programming, and one free and one member-only article.
const fx = (k) => responseData(fs.readFileSync(new URL(`./fixtures/${k}.json`, import.meta.url), "utf8"));
const CORE = ["id", "url", "title", "authorName", "authorUsername", "publishedAt", "readingTimeMinutes", "claps", "responses"];

for (const [kind, file, count, next] of [["tag", "tag", 25, "from"], ["user", "user", 8, null], ["publication", "publication", 25, "from"], ["search", "search", 25, "page"]]) {
  test(`medium: ${kind} feed: ${count} articles with core fields${next ? " and a next cursor" : ""}`, () => {
    const feed = parseFeed(kind, fx(file));
    assert.equal(feed.posts.length, count);
    if (next) assert.ok(feed.next?.[next] !== undefined);
    else assert.equal(feed.next, null);
    for (const a of feed.posts.map(toArticle)) {
      for (const f of CORE) assert.notEqual(a[f], null, `${kind} ${a.id} ${f}`);
      assert.match(a.url, /^https:\/\//);
      assert.match(a.publishedAt, /^\d{4}-\d\d-\d\dT/);
      assert.equal(typeof a.isMemberOnly, "boolean");
      assert.ok(Array.isArray(a.tags));
    }
  });
}

test("medium: author feed article fields", () => {
  const a = toArticle(parseFeed("user", fx("user")).posts[0]);
  assert.deepEqual([a.id, a.title, a.authorUsername, a.url, a.publishedAt, a.isMemberOnly], ["a64152b37c35", "Software 2.0", "karpathy", "https://karpathy.medium.com/software-2-0-a64152b37c35", "2017-11-11T22:18:53.751Z", false]);
  assert.ok(a.claps > 60000);
});

test("medium: publication articles carry the publication", () => {
  const a = toArticle(parseFeed("publication", fx("publication")).posts[0]);
  assert.equal(a.publicationName, "Better Programming");
  assert.equal(a.publicationUrl, "https://betterprogramming.pub");
});

test("medium: free article content is full Markdown", () => {
  const post = fx("content-free").post;
  const c = parseContent(post);
  assert.equal(c.contentIsPreview, false);
  assert.ok(c.markdown.includes("## ECMAScript 2026: 5 Features That Finally Fix JavaScript’s Worst Problems"));
  assert.ok(c.markdown.includes("](https://miro.medium.com/"));
  assert.ok(c.text.length > 5000);
  assert.equal(toArticle(post).publicationUrl, "https://javascript.plainenglish.io");
});

test("medium: member-only content is a flagged preview", () => {
  const post = fx("content-locked").post;
  const c = parseContent(post);
  assert.equal(c.contentIsPreview, true);
  assert.equal(toArticle(post).isMemberOnly, true);
  assert.ok(c.markdown.length > 200 && c.markdown.length < 5000);
});

test("medium: errors and markups", () => {
  assert.throws(() => responseData('{"errors":[{"message":"bad"}]}'), /bad/);
  assert.deepEqual(responseData('[{"data":{"x":1}}]'), { x: 1 });
  assert.equal(applyMarkups("see the docs now", [{ type: "A", start: 4, end: 12, href: "https://x.y" }, { type: "STRONG", start: 8, end: 12 }]), "see [the **docs**](https://x.y) now");
  assert.equal(applyMarkups("run npm test", [{ type: "CODE", start: 4, end: 12 }]), "run `npm test`");
});

test("medium: inputs", () => {
  assert.equal(tagSlug("Machine Learning"), "machine-learning");
  assert.equal(username("https://karpathy.medium.com/"), "karpathy");
  assert.equal(publicationKey("https://levelup.gitconnected.com/"), "levelup.gitconnected.com");
  assert.equal(postId("https://medium.com/@dhh/i-m-done-with-medium-a9ae85f15ac5?source=rss"), "a9ae85f15ac5");
  assert.deepEqual(classify("tag:Machine Learning"), { type: "tag", key: "machine-learning" });
  assert.deepEqual(classify("https://medium.com/tag/llm/recommended"), { type: "tag", key: "llm" });
  assert.deepEqual(classify("@karpathy"), { type: "author", key: "karpathy" });
  assert.deepEqual(classify("https://karpathy.medium.com/"), { type: "author", key: "karpathy" });
  assert.deepEqual(classify("https://medium.com/@dhh"), { type: "author", key: "dhh" });
  assert.deepEqual(classify("pub:better-programming"), { type: "publication", key: "better-programming" });
  assert.deepEqual(classify("https://medium.com/better-programming"), { type: "publication", key: "better-programming" });
  assert.deepEqual(classify("https://karpathy.medium.com/software-2-0-a64152b37c35"), { type: "article", key: "a64152b37c35" });
  assert.deepEqual(classify("rust async"), { type: "search", key: "rust async" });
});
