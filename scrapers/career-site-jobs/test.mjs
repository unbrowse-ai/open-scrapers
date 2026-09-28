import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detectBoard, employmentType, htmlToText, makeFilter, parseBoard, parseTarget, salaryFromText, toIso, workplace } from "./parse.mjs";

// Fixtures: real board API responses (Greenhouse airbnb, Lever palantir, Ashby ramp), captured 2026-09-28.
const json = (n) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), "utf8"));
const CORE = ["title", "location", "url", "postedAt", "ats", "jobId", "descriptionText"];
function core(jobs, ats) {
  assert.ok(jobs.length > 0, ats);
  for (const j of jobs) {
    for (const k of CORE) assert.ok(j[k], `${ats} ${j.jobId} missing ${k}`);
    assert.equal(j.ats, ats);
    assert.match(j.postedAt, /^\d{4}-\d\d-\d\dT/);
    assert.ok(["remote", "hybrid", "onsite", null].includes(j.workplaceType));
    assert.ok(!("descriptionHtml" in j), "html only on request");
  }
}

test("career jobs: board URLs and names", () => {
  const cases = [
    ["https://boards.greenhouse.io/airbnb", "greenhouse", "airbnb"],
    ["https://job-boards.greenhouse.io/vercel/jobs/123", "greenhouse", "vercel"],
    ["https://boards.greenhouse.io/embed/job_board?for=figma&b=x", "greenhouse", "figma"],
    ["https://boards-api.greenhouse.io/v1/boards/duolingo/jobs", "greenhouse", "duolingo"],
    ["jobs.lever.co/palantir", "lever", "palantir"],
    ["https://api.lever.co/v0/postings/palantir?mode=json", "lever", "palantir"],
    ["https://jobs.ashbyhq.com/ramp/34413f8d", "ashby", "ramp"],
    ["https://api.ashbyhq.com/posting-api/job-board/notion", "ashby", "notion"],
  ];
  for (const [url, ats, slug] of cases) assert.deepEqual([detectBoard(url)?.ats, detectBoard(url)?.slug], [ats, slug], url);
  assert.equal(detectBoard("https://job-boards.eu.greenhouse.io/acme").region, "eu");
  assert.equal(detectBoard("https://www.airbnb.com/careers"), null);
  assert.deepEqual(parseTarget("lever:spotify"), { ats: "lever", slug: "spotify" });
  assert.deepEqual(parseTarget("Ashby/ramp"), { ats: "ashby", slug: "ramp" });
  assert.deepEqual(parseTarget("figma"), { ats: null, slug: "figma" });
  assert.equal(parseTarget("https://example.com/careers"), null);
  assert.equal(parseTarget("example.com"), null);
});

test("career jobs: greenhouse fields and pay-transparency salary", () => {
  const jobs = parseBoard("greenhouse", json("greenhouse"), { slug: "airbnb" });
  core(jobs, "greenhouse");
  const j = jobs[0];
  assert.deepEqual([j.company, j.jobId, j.title, j.department, j.location, j.workplaceType], ["Airbnb", "8232207", "Accountant", "Financial Planning and Analysis", "United States", "remote"]);
  assert.deepEqual(j.salary, { min: 87000, max: 102000, currency: "USD", period: "year", text: "Pay Range", source: "ats" });
  assert.equal(jobs[1].salary.currency, "GBP");
  assert.ok(!/&lt;|<div/.test(j.descriptionText), "entities decoded and tags stripped");
  assert.ok("descriptionHtml" in parseBoard("greenhouse", json("greenhouse"), { slug: "airbnb", includeHtml: true })[0]);
});

test("career jobs: lever fields, salary from description", () => {
  const jobs = parseBoard("lever", json("lever"), { slug: "palantir", company: "Palantir Technologies" });
  core(jobs, "lever");
  const j = jobs[0];
  assert.deepEqual([j.team, j.location, j.workplaceType, j.employmentType], ["Administrative", "Singapore, Singapore", "hybrid", "Full-time"]);
  assert.match(j.applyUrl, /\/apply$/);
  const paid = jobs.find((x) => x.salary);
  assert.deepEqual([paid.salary.min, paid.salary.max, paid.salary.period, paid.salary.source], [60000, 97000, "year", "description"]);
});

test("career jobs: ashby compensation, secondary locations, hybrid", () => {
  const jobs = parseBoard("ashby", json("ashby"), { slug: "ramp", company: "Ramp" });
  core(jobs, "ashby");
  const j = jobs[0];
  assert.deepEqual(j.salary, { min: 211400, max: 290600, currency: "USD", period: "year", text: "$211.4K - $290.6K", source: "ats" });
  assert.equal(j.locations.length, 4);
  assert.deepEqual([j.department, j.team, j.workplaceType, j.employmentType], ["Engineering", "Backend", "hybrid", "Full-time"]);
  assert.equal(jobs.at(-1).salary, null, "benefit amounts (Fertility HRA up to $10,000) are not pay");
});

test("career jobs: wrong shapes are null", () => {
  assert.equal(parseBoard("greenhouse", { status: 404 }, { slug: "x" }), null);
  assert.equal(parseBoard("lever", { ok: false }, { slug: "x" }), null);
  assert.deepEqual(parseBoard("ashby", { jobs: [] }, { slug: "x" }), []);
});

test("career jobs: salaryFromText", () => {
  const s = (t) => { const r = salaryFromText(t); return r && [r.min, r.max, r.currency, r.period]; };
  assert.deepEqual(s("Base pay: $120,000 - $200,000"), [120000, 200000, "USD", "year"]);
  assert.deepEqual(s("$25 - $35 per hour"), [25, 35, "USD", "hour"]);
  assert.deepEqual(s("compensation £40,000-£50,000 per annum"), [40000, 50000, "GBP", "year"]);
  assert.deepEqual(s("Salary: €65k"), [65000, 65000, "EUR", "year"]);
  assert.equal(salaryFromText("We raised $10M from top investors"), null);
  assert.equal(salaryFromText("travel budget: €1.5k after 2 years"), null);
  assert.equal(salaryFromText("$5 gift card"), null);
});

test("career jobs: helpers and filters", () => {
  assert.equal(htmlToText("<p>A&amp;B</p><ul><li>one</li><li>two</li></ul>"), "A&B\n• one\n• two");
  assert.equal(toIso(1786469891368), "2026-08-11T17:38:11.368Z");
  assert.equal(workplace(null, "Remote - US"), "remote");
  assert.equal(employmentType("FullTime"), "Full-time");
  const now = Date.parse("2026-09-28T00:00:00Z");
  const jobs = [
    { title: "Senior Software Engineer", locations: ["London"], workplaceType: "hybrid", postedAt: "2026-09-20T00:00:00Z", department: "Engineering" },
    { title: "Account Executive", locations: ["Remote (US)"], workplaceType: "remote", postedAt: "2026-06-01T00:00:00Z", department: "Sales" },
    { title: "Software Engineer Intern", locations: ["New York"], workplaceType: "onsite", postedAt: null, department: "Engineering" },
  ];
  const run = (f) => jobs.filter(makeFilter({ ...f, now })).map((j) => j.title);
  assert.deepEqual(run({ keywords: "engineer", excludeKeywords: ["intern"] }), ["Senior Software Engineer"]);
  assert.deepEqual(run({ remoteOnly: true }), ["Account Executive"]);
  assert.deepEqual(run({ postedWithinDays: 30 }), ["Senior Software Engineer"]);
  assert.deepEqual(run({ department: "sales" }), ["Account Executive"]);
});
