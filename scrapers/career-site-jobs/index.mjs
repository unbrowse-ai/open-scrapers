#!/usr/bin/env node
// Career Site Jobs Scraper: every open job on a company's Greenhouse, Lever or Ashby job board as structured JSON.
// Boards are read through public Unbrowse tools that call each ATS's own job-board API, sent from this machine.
import { fileURLToPath } from "node:url";
import { RefusedError, cli, readPage } from "../../lib/read-page.mjs";
import { ATS_LIST, makeFilter, parseBoard, parseTarget, prettySlug } from "./parse.mjs";

// One public tool per ATS; each takes the board name as its only required input.
export const TOOLS = {
  greenhouse: { capability: "public.boards_api_greenhouse_io.get_anthropic_jobs", input: (slug) => ({ board: slug }), hosts: ["boards-api.greenhouse.io"] },
  lever: { capability: "public.api_lever_co.get_postings_ro", input: (slug) => ({ company: slug }), hosts: ["api.lever.co"] },
  ashby: { capability: "public.api_ashbyhq_com.get_job_board_notion", input: (slug) => ({ organization: slug }), hosts: ["api.ashbyhq.com"] },
};

class NotFound extends Error {}

/** Raw board JSON for one { ats, slug }. A 404 from the ATS means "no such board" (nothing is reported). */
async function fetchBoard({ ats, slug }) {
  const t = TOOLS[ats];
  try {
    // An empty board is a tiny but valid JSON body, so the generic "tiny body" check is off here.
    const page = await readPage(t.capability, t.input(slug), { hosts: t.hosts, minBytes: 2 });
    return JSON.parse(page.body);
  } catch (err) {
    if (err instanceof RefusedError && err.page?.status === 404) throw new NotFound(`no ${ats} board named "${slug}"`);
    throw err;
  }
}

/** A bare name: try each ATS in turn and keep the first board that exists. */
async function findBoard(slug, log) {
  for (const ats of ATS_LIST) {
    try {
      const json = await fetchBoard({ ats, slug });
      log(`${slug}: found on ${ats}`);
      return { board: { ats, slug }, json };
    } catch (err) {
      if (!(err instanceof NotFound)) throw err;
    }
  }
  throw new NotFound(`no Greenhouse, Lever or Ashby board is named "${slug}". Paste the careers-page URL instead.`);
}

/**
 * Open jobs for one company: a board URL, "greenhouse:figma", or a bare board name.
 * Filters: keywords, excludeKeywords, location, department, remoteOnly, postedWithinDays. includeHtml adds descriptionHtml.
 */
export async function scrape(target, { max = 1000, includeHtml = false, includeDescription = true, log = () => {}, ...filters } = {}) {
  const t = parseTarget(target);
  if (!t) throw new Error(`Not a Greenhouse, Lever or Ashby board: ${target}`);
  if (t.region === "eu") throw new Error(`EU-hosted boards (${target}) are not covered by the public tools yet`);
  const { board, json } = t.ats ? { board: t, json: await fetchBoard(t) } : await findBoard(t.slug, log);
  let jobs = parseBoard(board.ats, json, { slug: board.slug, includeHtml });
  if (!jobs) throw new Error(`${board.ats} answered with an unexpected shape for ${board.slug}`);
  const all = jobs.length;
  jobs = jobs.filter(makeFilter(filters)).slice(0, Math.max(1, Number(max) || 1000));
  log(`${board.ats}/${board.slug}: ${all} open, ${jobs.length} kept`);
  const now = new Date().toISOString();
  return jobs.map((j) => {
    const out = { ...j, company: j.company ?? prettySlug(board.slug), input: String(target), scrapedAt: now };
    if (!includeDescription) delete out.descriptionText;
    return out;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli(
    async (pos, f) => {
      const out = [];
      for (const q of pos) {
        try {
          out.push(
            ...(await scrape(q, {
              max: f.max,
              keywords: f.keywords,
              excludeKeywords: f.exclude,
              location: f.location,
              department: f.department,
              remoteOnly: !!f.remote,
              postedWithinDays: f.days ? Number(f.days) : undefined,
              includeHtml: !!f.html,
              includeDescription: !f["no-description"],
              log: (m) => process.stderr.write(`${m}\n`),
            })),
          );
        } catch (err) {
          // One missing board should not lose the others.
          if (pos.length === 1) throw err;
          process.stderr.write(`${q}: ${err.message}\n`);
        }
      }
      return out;
    },
    `
Usage: node scrapers/career-site-jobs/index.mjs <board>... [options]

  https://boards.greenhouse.io/figma   https://jobs.lever.co/spotify   https://jobs.ashbyhq.com/ramp
  greenhouse:figma   lever:spotify   ashby:ramp   figma (tries Greenhouse, Lever, Ashby)

  --keywords "engineer,designer"   title must contain one (comma-separated)
  --exclude "intern,senior"        title must contain none
  --location "london,remote"       any location matches
  --department "engineering"       department or team contains
  --remote                         remote jobs only
  --days N                         posted in the last N days
  --max N                          jobs per board (default 1000)
  --html                           add descriptionHtml
  --no-description                 drop descriptionText

Needs UNBROWSE_API_KEY (free at https://unbrowse.ai).`,
  );
}
