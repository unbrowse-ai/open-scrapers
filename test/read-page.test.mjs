// The refusal path: a refused page is never posted back; the egress session is closed instead.
import test from "node:test";
import assert from "node:assert/strict";
import { RefusedError, capabilityFor, isRefused, readPage } from "../lib/read-page.mjs";

/** A fake SDK client that records what readPage sends to Unbrowse. */
function fakeClient(requests) {
  const calls = [];
  return {
    calls,
    run: async (req) => (calls.push(["run", req]), { status: "egress_required", egressId: "eg_1", requests }),
    answerEgress: async (id, rid, answer) => (calls.push(["answer", rid, answer.response?.status]), { status: "succeeded", runId: "r1" }),
    closeEgress: async (id) => (calls.push(["close", id]), { egressId: id, status: "closed" }),
  };
}
const req = (url) => ({ id: "rq_1", method: "GET", url, headers: {}, redirect: "manual" });
const site = (status, body, headers = {}) => async () => new Response(body, { status, headers });
const big = "<html>" + "x".repeat(5000) + "</html>";

test("a 200 page is posted back and returned", async () => {
  const ub = fakeClient([req("https://www.example.com/a")]);
  const page = await readPage("public.example_com.read_page", { path: "/a" }, { client: ub, fetch: site(200, big), hosts: ["example.com"] });
  assert.equal(page.status, 200);
  assert.deepEqual(ub.calls.map((c) => c[0]), ["run", "answer"]);
});

for (const [name, status, body, headers] of [
  ["403", 403, big],
  ["429", 429, big],
  ["503 bot page", 503, "<html>Type the characters you see in this image</html>"],
  ["captcha body", 200, "<html><div class=g-recaptcha></div>" + "x".repeat(3000) + "</html>"],
  ["tiny body", 200, "<html></html>"],
  ["redirect to google sorry", 302, "", { location: "https://www.google.com/sorry/index?continue=x" }],
]) {
  test(`refused (${name}): session closed, nothing posted`, async () => {
    const ub = fakeClient([req("https://www.example.com/a")]);
    await assert.rejects(readPage("c", {}, { client: ub, fetch: site(status, body, headers), hosts: ["example.com"] }), RefusedError);
    assert.deepEqual(ub.calls.map((c) => c[0]), ["run", "close"]);
  });
}

test("a request outside the site's hosts is never sent, and is retried", async () => {
  const ub = fakeClient([req("http://store.internal/x")]);
  let sent = false;
  await assert.rejects(readPage("c", {}, { client: ub, fetch: async () => ((sent = true), new Response(big)), hosts: ["example.com"], retryDelayMs: 1 }), /outside example\.com/);
  assert.equal(sent, false);
  // Nothing reached the site, so it is tried again (twice by default), each time closed unsent.
  assert.deepEqual(ub.calls.map((c) => c[0]), ["run", "close", "run", "close", "run", "close"]);
});

test("our own network error closes the session without posting", async () => {
  const ub = fakeClient([req("https://www.example.com/a")]);
  await assert.rejects(readPage("c", {}, { client: ub, fetch: async () => { throw new TypeError("fetch failed"); } }));
  assert.deepEqual(ub.calls.map((c) => c[0]), ["run", "close"]);
});

test("helpers", () => {
  assert.equal(capabilityFor("www.news.google.com"), "public.news_google_com.read_page");
  assert.equal(isRefused({ status: 301, location: "https://www.zillow.com/austin-tx/", body: "" }), false);
});
