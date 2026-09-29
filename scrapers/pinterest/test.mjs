import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyUrl, hashtags, mergePin, parseResource, toolInput } from "./parse.mjs";

// Fixtures: real responses of Pinterest's resource API (search "kitchen ideas", a board and its pins, an image pin and a
// video pin), 2026-09-29; the per-visitor client_context and tracking fields are removed.

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), "utf8");

test("pinterest: search page: 24 pins with core fields and a bookmark", () => {
  const r = parseResource(fx("search"));
  assert.equal(r.pins.length, 24);
  assert.ok(r.bookmark && r.bookmark.length > 20);
  for (const p of r.pins) {
    assert.match(p.id, /^\d+$/);
    assert.equal(p.url, `https://www.pinterest.com/pin/${p.id}/`);
    assert.ok(p.imageUrl && p.createdAt && p.pinner?.username && p.board?.name, p.id);
    assert.match(p.images.orig, /^https:\/\/i\.pinimg\.com\/originals\//);
  }
  assert.equal(r.pins.filter((p) => p.title).length, 15);
  const first = r.pins[0];
  assert.deepEqual([first.id, first.title, first.dominantColor, first.pinner.username, first.pinner.followers, first.board.name], ["955607614711478483", "Chic Modern Kitchen Ideas for Smart Storage", "#8f765d", "heathheller706", 1217, "Kitchen ideas"]);
  assert.equal(first.createdAt, "2026-09-14T23:28:52.000Z");
  assert.equal(r.pins.filter((p) => p.link).length, 6);
  assert.ok(r.pins.filter((p) => p.domain).every((p) => !p.domain.includes("Uploaded")));
});

test("pinterest: board feed: pins carry saves", () => {
  const r = parseResource(fx("board-feed"));
  assert.equal(r.pins.length, 25);
  assert.ok(r.pins.every((p) => Number.isInteger(p.saves)));
  assert.ok(r.bookmark);
});

test("pinterest: pin detail: saves, comments; video pin gets mp4 + hls", () => {
  const img = parseResource(fx("pin")).pins[0];
  assert.equal(img.id, "24488391721379989");
  assert.equal(img.saves, 2472);
  assert.equal(img.comments, 0);
  assert.equal(img.isVideo, false);
  const vid = parseResource(fx("pin-video")).pins[0];
  assert.equal(vid.isVideo, true);
  assert.match(vid.video.url, /720p.*\.mp4$/);
  assert.match(vid.video.hlsUrl, /\.m3u8$/);
  assert.equal(vid.video.durationSec, 10.4);
  assert.equal(vid.saves, 16175);
  assert.equal(vid.domain, "goldengracekitchen.com");
  assert.equal(vid.pinner.followers, 4165);
});

test("pinterest: board resource", () => {
  const b = parseResource(fx("board")).data;
  assert.equal(b.id, "955607683372809098");
  assert.equal(b.url, "/heathheller706/kitchen-ideas/");
});

test("pinterest: merge keeps feed values the detail lacks", () => {
  const base = { id: "1", saves: 5, hashtags: ["#a"], pinner: { username: "x", followers: 10 } };
  const m = mergePin(base, { id: "1", saves: 7, comments: 2, hashtags: [], pinner: { username: "x", followers: null, fullName: "X" } });
  assert.deepEqual(m, { id: "1", saves: 7, comments: 2, hashtags: ["#a"], pinner: { username: "x", followers: 10, fullName: "X" } });
});

test("pinterest: hashtags from field and description", () => {
  assert.deepEqual(hashtags({ hashtags: ["#decor"], description: "Nice #kitchen and #decor ideas #2026" }), ["#decor", "#kitchen", "#2026"]);
});

test("pinterest: url classification", () => {
  assert.deepEqual(classifyUrl("https://www.pinterest.com/search/pins/?q=home%20decor"), { kind: "search", query: "home decor", scope: "pins" });
  assert.deepEqual(classifyUrl("https://pinterest.co.uk/search/videos/?q=pasta"), { kind: "search", query: "pasta", scope: "videos" });
  assert.deepEqual(classifyUrl("https://www.pinterest.com/pin/1083678729086891527/"), { kind: "pin", id: "1083678729086891527" });
  assert.deepEqual(classifyUrl("pinterest.com/pin/marry-me-shrimp--1083678729086891527/"), { kind: "pin", id: "1083678729086891527" });
  assert.deepEqual(classifyUrl("https://www.pinterest.com/heathheller706/kitchen-ideas/"), { kind: "board", username: "heathheller706", slug: "kitchen-ideas", section: undefined });
  assert.deepEqual(classifyUrl("https://www.pinterest.com/heathheller706/"), { kind: "user", username: "heathheller706", tab: "created" });
  assert.deepEqual(classifyUrl("https://www.pinterest.com/heathheller706/_saved/"), { kind: "user", username: "heathheller706", tab: "saved" });
  assert.equal(classifyUrl("https://pin.it/abc123").kind, "short");
  assert.equal(classifyUrl("https://example.com/x"), null);
  assert.equal(classifyUrl("https://www.pinterest.com/ideas/"), null);
});

test("pinterest: tool input carries options as the web app sends them", () => {
  const i = toolInput({ query: "a b", scope: "pins" }, "/search/pins/?q=a%20b");
  assert.deepEqual(JSON.parse(i.data), { options: { query: "a b", scope: "pins" }, context: {} });
  assert.equal(i.source_url, "/search/pins/?q=a%20b");
});
