// Career-site jobs: detect the applicant tracking system (ATS) behind a board URL and normalize Greenhouse,
// Lever and Ashby job-board JSON into one job shape. Pure functions, no I/O.

export const ATS_LIST = ["greenhouse", "lever", "ashby"];

const SLUG = "[A-Za-z0-9][A-Za-z0-9_.-]*";

/** Board reference from one ATS URL: { ats, slug, region? } or null. */
export function detectBoard(raw) {
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  const first = seg[0] && decodeURIComponent(seg[0]);
  const ok = (s) => s && new RegExp(`^${SLUG}$`).test(s);

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const region = /\.eu\.greenhouse\.io$/.test(host) ? "eu" : undefined;
    const forParam = u.searchParams.get("for");
    if (forParam && ok(forParam)) return { ats: "greenhouse", slug: forParam, ...(region && { region }) };
    if (/^boards-api\./.test(host)) {
      const i = seg.indexOf("boards");
      return ok(seg[i + 1]) ? { ats: "greenhouse", slug: seg[i + 1], ...(region && { region }) } : null;
    }
    if (/^(boards|job-boards|www)\./.test(host) && ok(first) && !["embed", "v1"].includes(first)) return { ats: "greenhouse", slug: first, ...(region && { region }) };
    return null;
  }
  if (/(^|\.)lever\.co$/.test(host)) {
    const region = /\.eu\.lever\.co$/.test(host) ? "eu" : undefined;
    if (/^api\./.test(host)) return ok(seg[2]) ? { ats: "lever", slug: seg[2], ...(region && { region }) } : null; // api.lever.co/v0/postings/<slug>
    return /^jobs\./.test(host) && ok(first) ? { ats: "lever", slug: first, ...(region && { region }) } : null;
  }
  if (/(^|\.)ashbyhq\.com$/.test(host)) {
    if (/^api\./.test(host)) return ok(seg[2]) ? { ats: "ashby", slug: seg[2] } : null; // api.ashbyhq.com/posting-api/job-board/<slug>
    return /^jobs\./.test(host) && ok(first) ? { ats: "ashby", slug: first } : null;
  }
  return null;
}

/** Human board URL (where a job seeker would browse). */
export function boardUrl({ ats, slug, region }) {
  switch (ats) {
    case "greenhouse": return `https://job-boards${region === "eu" ? ".eu" : ""}.greenhouse.io/${slug}`;
    case "lever": return `https://jobs${region === "eu" ? ".eu" : ""}.lever.co/${slug}`;
    case "ashby": return `https://jobs.ashbyhq.com/${slug}`;
    default: return null;
  }
}

// ---------- text helpers ----------

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•", middot: "·", euro: "€", pound: "£", copy: "©", reg: "®", trade: "™" };

export function decodeEntities(s) {
  return String(s ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

/** Readable plain text from job-description HTML (paragraphs and list items on their own lines). */
export function htmlToText(html) {
  if (!html) return null;
  const t = decodeEntities(
    String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|section)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+• /g, "\n• ")
    .trim();
  return t || null;
}

const clean = (s) => (s == null ? null : String(s).replace(/\s+/g, " ").trim() || null);
const uniq = (arr) => [...new Set(arr.map(clean).filter(Boolean))];

export function toIso(v) {
  if (v == null || v === "") return null;
  let d;
  if (typeof v === "number") d = new Date(v < 1e12 ? v * 1000 : v);
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(v)) d = new Date(v.replace(" ", "T").replace(" UTC", "Z"));
  else d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "remote" | "hybrid" | "onsite" | null from an ATS value, falling back to location/title text. */
export function workplace(value, ...texts) {
  const v = String(value ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (v === "remote") return "remote";
  if (v === "hybrid") return "hybrid";
  if (v === "onsite" || v === "inoffice" || v === "office") return "onsite";
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bremote\b|\bwork from home\b|\banywhere\b/.test(t)) return "remote";
  return null;
}

/** "FullTime" / "full_time" / "fulltime_permanent" / "Full-time" → "Full-time". */
export function employmentType(v) {
  if (!v) return null;
  const s = String(v).toLowerCase().replace(/[\s_-]/g, "");
  if (/^fulltime|permanent/.test(s)) return "Full-time";
  if (/^parttime/.test(s)) return "Part-time";
  if (/intern/.test(s)) return "Internship";
  if (/contract|freelance|consult/.test(s)) return "Contract";
  if (/temp/.test(s)) return "Temporary";
  if (/volunt/.test(s)) return "Volunteer";
  if (/apprentice|trainee/.test(s)) return "Apprenticeship";
  return clean(v);
}

// ---------- salary ----------

const CUR = "(?:US\\$|CA\\$|C\\$|A\\$|AU\\$|\\$|£|€|USD\\s?|GBP\\s?|EUR\\s?|CAD\\s?|AUD\\s?)";
const NUM = "\\d{1,3}(?:[,.]\\d{3})*(?:\\.\\d+)?\\s?[kK]?";
const RANGE = new RegExp(`${CUR}\\s?(${NUM})(?:\\s?(?:-|–|—|to)\\s?${CUR}?\\s?(${NUM}))?(?:\\s?(?:USD|CAD|GBP|EUR|AUD))?(?:\\s?(?:per|/|an|a)\\s?(hour|hr|year|yr|annum|month|week|day))?`, "g");

/** Best-effort pay range from free text (e.g. "Base pay: $120,000 - $200,000"). Null when none is stated. */
export function salaryFromText(text) {
  if (!text) return null;
  const hits = [];
  for (const m of text.matchAll(RANGE)) {
    const raw = m[0].trim();
    const toNum = (x) => {
      if (!x) return null;
      const k = /k$/i.test(x.trim());
      let t = x.replace(/[kK\s]/g, "");
      t = /\.\d{3}$/.test(t) && !/,/.test(t) ? t.replace(/\./g, "") : t.replace(/,/g, "");
      const n = parseFloat(t);
      return k ? n * 1000 : n;
    };
    const lo = toNum(m[1]);
    const hi = toNum(m[2]);
    const pre = text.slice(Math.max(0, m.index - 45), m.index).toLowerCase();
    const unit = m[3]?.toLowerCase() ?? (/monthly|per month|a month/.test(pre) ? "month" : /hourly|per hour/.test(pre) ? "hour" : /weekly/.test(pre) ? "week" : /daily|day rate/.test(pre) ? "day" : /annual|yearly|per year/.test(pre) ? "year" : undefined);
    // Skip amounts that are not pay (e.g. "$5 gift card", "$10B valuation") unless hourly.
    if (!unit && lo < 1000 && !(hi && hi >= 1000)) continue;
    if (!unit?.startsWith("h") && lo < 15) continue;
    if (hi && hi < lo) continue;
    if (/\d\s?[bm](?:n|illion)?\b/i.test(text.slice(m.index + m[0].length - 1, m.index + m[0].length + 9)) && !m[2]) continue;
    const ctx = text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12);
    if (/valuation|raised|funding|revenue|billion|million/i.test(ctx)) continue;
    // Benefits ("travel budget: €1.5k", "Fertility HRA (up to $10,000 per year)") are not pay.
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    if (/budget|stipend|allowance|\bhra\b|match|reimburs|up to\s*$|credit|relocation|gift|401|sign[- ]?on|referral|bonus of|per diem|learning|wellness|equipment|home office/i.test(before)) continue;
    // A single figure needs a pay word close before it; a range is pay unless flagged above.
    if (!hi && !/salary|pay|compensation|wage|base|\bote\b|earn|rate|remuneration|package/i.test(text.slice(Math.max(0, m.index - 80), m.index))) continue;
    if ((!unit || /^y|^a/.test(unit)) && (hi ?? lo) < 10000) continue;
    hits.push({
      min: lo,
      max: hi ?? lo,
      currency: /£|GBP/.test(raw) ? "GBP" : /€|EUR/.test(raw) ? "EUR" : /CA\$|C\$|CAD/.test(raw) ? "CAD" : /A\$|AU\$|AUD/.test(raw) ? "AUD" : "USD",
      period: unit ? (unit.startsWith("h") ? "hour" : unit.startsWith("m") ? "month" : unit.startsWith("w") ? "week" : unit.startsWith("d") ? "day" : "year") : lo >= 1000 ? "year" : null,
      text: raw,
      source: "description",
    });
  }
  // Prefer a range over a single figure.
  return hits.find((h) => h.max !== h.min) ?? hits[0] ?? null;
}

function period(v) {
  const s = String(v ?? "").toLowerCase();
  if (/hour/.test(s)) return "hour";
  if (/day|daily/.test(s)) return "day";
  if (/week/.test(s)) return "week";
  if (/month/.test(s)) return "month";
  if (/year|annual|annum/.test(s)) return "year";
  return null;
}

// ---------- per-ATS normalizers ----------

function base(ctx, j) {
  return {
    company: ctx.company ?? null,
    ats: ctx.ats,
    boardSlug: ctx.slug,
    jobId: j.jobId != null ? String(j.jobId) : null,
    title: clean(j.title),
    department: clean(j.department),
    team: clean(j.team),
    location: j.locations?.[0] ?? null,
    locations: j.locations ?? [],
    workplaceType: j.workplaceType ?? null,
    isRemote: j.workplaceType === "remote",
    employmentType: employmentType(j.employmentType),
    postedAt: toIso(j.postedAt),
    updatedAt: toIso(j.updatedAt),
    url: j.url ?? null,
    applyUrl: j.applyUrl ?? j.url ?? null,
    salary: j.salary ?? salaryFromText(j.descriptionText),
    descriptionText: j.descriptionText ?? null,
    ...(ctx.includeHtml ? { descriptionHtml: j.descriptionHtml ?? null } : {}),
    boardUrl: boardUrl(ctx),
  };
}

export function parseGreenhouse(json, ctx) {
  const jobs = json?.jobs;
  if (!Array.isArray(jobs)) return null;
  return jobs.map((j) => {
    const meta = Object.fromEntries((j.metadata ?? []).map((m) => [String(m.name).toLowerCase(), Array.isArray(m.value) ? m.value.join(", ") : m.value]));
    const html = j.content ? decodeEntities(j.content) : null;
    const text = htmlToText(html);
    const locs = uniq([j.location?.name, ...(j.offices ?? []).map((o) => o.name)]);
    const pay = (j.pay_input_ranges ?? []).find((p) => p.min_cents || p.max_cents);
    const salary = pay
      ? { min: pay.min_cents != null ? pay.min_cents / 100 : null, max: pay.max_cents != null ? pay.max_cents / 100 : null, currency: pay.currency_type ?? null, period: period(pay.title) ?? ((pay.max_cents ?? pay.min_cents) >= 100000 ? "year" : "hour"), text: clean(pay.title), source: "ats" }
      : null;
    const wpKey = Object.keys(meta).find((k) => /workplace|remote|location type|work type/.test(k));
    const etKey = Object.keys(meta).find((k) => /employment type|job type|time type/.test(k));
    return base({ ...ctx, company: ctx.company ?? j.company_name }, {
      jobId: j.id,
      title: j.title,
      department: j.departments?.[0]?.name,
      team: j.departments?.[1]?.name ?? null,
      locations: locs,
      workplaceType: workplace(wpKey ? meta[wpKey] : null, j.location?.name, j.title),
      employmentType: etKey ? meta[etKey] : null,
      postedAt: j.first_published ?? j.updated_at,
      updatedAt: j.updated_at,
      url: j.absolute_url,
      applyUrl: j.absolute_url,
      salary: salary ?? salaryFromText(text),
      descriptionText: text,
      descriptionHtml: html,
    });
  });
}

export function parseLever(json, ctx) {
  if (!Array.isArray(json)) return null;
  return json.map((j) => {
    const c = j.categories ?? {};
    const listsHtml = (j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
    const html = [j.description, listsHtml, j.additional].filter(Boolean).join("");
    const text = htmlToText(html) ?? clean([j.descriptionPlain, j.additionalPlain].filter(Boolean).join("\n"));
    const sr = j.salaryRange;
    const salary = sr && (sr.min || sr.max) ? { min: sr.min ?? null, max: sr.max ?? null, currency: sr.currency ?? null, period: period(sr.interval), text: clean(j.salaryDescriptionPlain) ?? null, source: "ats" } : null;
    return base(ctx, {
      jobId: j.id,
      title: j.text,
      department: c.department ?? null,
      team: c.team,
      locations: uniq([c.location, ...(c.allLocations ?? [])]),
      workplaceType: workplace(j.workplaceType === "unspecified" ? null : j.workplaceType, c.location, j.text),
      employmentType: c.commitment,
      postedAt: j.createdAt,
      updatedAt: j.updatedAt ?? null,
      url: j.hostedUrl,
      applyUrl: j.applyUrl,
      salary: salary ?? salaryFromText([text, j.salaryDescriptionPlain].filter(Boolean).join("\n")),
      descriptionText: text,
      descriptionHtml: html || null,
    });
  });
}

export function parseAshby(json, ctx) {
  const jobs = json?.jobs;
  if (!Array.isArray(jobs)) return null;
  return jobs.filter((j) => j.isListed !== false).map((j) => {
    const comp = j.compensation ?? {};
    const sal = [...(comp.summaryComponents ?? []), ...(comp.compensationTiers ?? []).flatMap((t) => t.components ?? [])].find((c) => c.compensationType === "Salary" && (c.minValue || c.maxValue));
    const salary = sal ? { min: sal.minValue ?? null, max: sal.maxValue ?? null, currency: sal.currencyCode ?? null, period: period(sal.interval), text: clean(comp.scrapeableCompensationSalarySummary ?? comp.compensationTierSummary), source: "ats" } : null;
    const text = j.descriptionPlain ? j.descriptionPlain.trim() : htmlToText(j.descriptionHtml);
    return base(ctx, {
      jobId: j.id,
      title: j.title,
      department: j.department,
      team: j.team,
      locations: uniq([j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)]),
      workplaceType: workplace(j.workplaceType, j.isRemote ? "remote" : null, j.location),
      employmentType: j.employmentType,
      postedAt: j.publishedAt,
      updatedAt: j.updatedAt ?? null,
      url: j.jobUrl,
      applyUrl: j.applyUrl,
      salary: salary ?? salaryFromText(text),
      descriptionText: text,
      descriptionHtml: j.descriptionHtml,
    });
  });
}

/** Normalized jobs from one ATS API response. Null when the shape is wrong. */
export function parseBoard(ats, json, ctx) {
  const c = { ...ctx, ats };
  switch (ats) {
    case "greenhouse": return parseGreenhouse(json, c);
    case "lever": return parseLever(json, c);
    case "ashby": return parseAshby(json, c);
    default: return null;
  }
}

export function prettySlug(slug) {
  return String(slug).replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// ---------- filters ----------

/** Compile user filters into a predicate over normalized jobs. */
export function makeFilter({ keywords, excludeKeywords, location, department, remoteOnly, postedWithinDays, now = Date.now() } = {}) {
  const list = (v) => (Array.isArray(v) ? v : String(v ?? "").split(/[,\n]/)).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const kw = list(keywords);
  const nkw = list(excludeKeywords);
  const locs = list(location);
  const deps = list(department);
  const since = postedWithinDays > 0 ? now - postedWithinDays * 86400000 : null;
  return (j) => {
    const title = (j.title ?? "").toLowerCase();
    if (kw.length && !kw.some((k) => title.includes(k))) return false;
    if (nkw.length && nkw.some((k) => title.includes(k))) return false;
    if (locs.length) {
      const hay = [...(j.locations ?? []), j.location, j.workplaceType === "remote" ? "remote" : ""].filter(Boolean).join(" | ").toLowerCase();
      if (!locs.some((l) => hay.includes(l))) return false;
    }
    if (deps.length && !deps.some((d) => `${j.department ?? ""} ${j.team ?? ""}`.toLowerCase().includes(d))) return false;
    if (remoteOnly && j.workplaceType !== "remote") return false;
    if (since && !(j.postedAt && Date.parse(j.postedAt) >= since)) return false;
    return true;
  };
}

// ---------- inputs ----------

/**
 * What a user typed → { ats, slug } (ats null = try each ATS). Accepts a board URL
 * (boards.greenhouse.io/figma, jobs.lever.co/spotify, jobs.ashbyhq.com/ramp, their API URLs),
 * "greenhouse:figma" / "lever/spotify", or a bare board name ("figma").
 */
export function parseTarget(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(greenhouse|lever|ashby)\s*[:/]\s*([A-Za-z0-9][A-Za-z0-9_.-]*)$/i);
  if (m) return { ats: m[1].toLowerCase(), slug: m[2] };
  const b = detectBoard(s);
  if (b) return b;
  if (/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s) && !/\.[a-z]{2,}$/i.test(s)) return { ats: null, slug: s };
  return null;
}
