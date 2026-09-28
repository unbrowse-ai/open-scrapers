import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { durationToSeconds, parseCount, parseSearch, parseVideo, videoId } from "./parse.mjs";

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

test("youtube watch page: video details", () => {
  const v = parseVideo(fx("youtube-video.html"));
  assert.equal(v.id, "dQw4w9WgXcQ");
  assert.match(v.title, /Never Gonna Give You Up/);
  assert.equal(v.channelName, "Rick Astley");
  assert.equal(v.durationSeconds, 213);
  assert.ok(v.viewCount > 1e9 && v.likes > 1e7 && v.commentsCount > 1e6);
  assert.ok(v.keywords.length > 0 && v.publishedAt && v.category && v.channelSubscribers > 1e6);
});

test("youtube search page: video cards in order", () => {
  const cards = parseSearch(fx("youtube-search.html"));
  assert.equal(cards.length, 18);
  for (const c of cards) assert.ok(c.id && c.title && c.channelName && c.url.endsWith(c.id), JSON.stringify(c));
  assert.ok(cards.filter((c) => c.viewCount > 0 && c.durationSeconds > 0).length >= 15);
});

test("youtube: not a video page", () => {
  assert.equal(parseVideo("<html>Sign in to confirm you're not a bot</html>"), null);
  assert.equal(parseSearch("<html></html>"), null);
});

test("youtube helpers", () => {
  assert.equal(parseCount("1,234,567 views"), 1234567);
  assert.equal(parseCount("2.4K"), 2400);
  assert.equal(durationToSeconds("1:02:03"), 3723);
  assert.equal(videoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("lofi hip hop"), null);
});
