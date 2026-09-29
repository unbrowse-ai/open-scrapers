# Career Site Jobs Scraper (Node.js): Greenhouse, Lever and Ashby jobs as JSON

Scrape every open job from a company's careers site into structured JSON: title, department, team, locations, remote/hybrid/onsite, employment type, posted and updated dates, job and apply URLs, a salary range with currency and period, and the full job description as clean text (HTML on request). One scraper covers the three applicant tracking systems most startups and tech companies use: **Greenhouse**, **Lever** and **Ashby**.

Paste a board URL (`boards.greenhouse.io/figma`, `jobs.lever.co/spotify`, `jobs.ashbyhq.com/ramp`), write `greenhouse:figma`, or just give a company's board name and the scraper finds which ATS hosts it. Each board is read from the ATS's own public job-board API through a public [Unbrowse](https://unbrowse.ai) tool; the request goes out from your machine and the JSON is parsed locally, so you get every job on the board, not a summary. Without an Unbrowse key, or when that tool is unavailable, the scraper sends the same request straight to the site and parses it the same way.

## Quick start

```bash
git clone https://github.com/unbrowse-ai/open-scrapers && cd open-scrapers && npm install
export UNBROWSE_API_KEY=ub_live_...        # optional; free key: https://unbrowse.ai

node scrapers/career-site-jobs/index.mjs https://boards.greenhouse.io/figma > figma.json
node scrapers/career-site-jobs/index.mjs lever:spotify ashby:ramp notion > jobs.json
node scrapers/career-site-jobs/index.mjs figma --keywords engineer --remote --days 30 > remote-eng.json
```

| Option | Default | Meaning |
|---|---|---|
| `<board>...` | | Board URL, `greenhouse:<name>`, `lever:<name>`, `ashby:<name>`, or a bare name (tries all three) |
| `--keywords` | | Comma-separated; the title must contain one |
| `--exclude` | | Comma-separated; the title must contain none |
| `--location` | | Comma-separated; any location (or "remote") matches |
| `--department` | | Department or team contains |
| `--remote` | off | Remote jobs only |
| `--days N` | | Posted in the last N days |
| `--max N` | 1000 | Jobs per board |
| `--html` / `--no-description` | | Add `descriptionHtml` / drop `descriptionText` |

From code:

```js
import { scrape } from "./scrapers/career-site-jobs/index.mjs";
const jobs = await scrape("https://jobs.ashbyhq.com/ramp", { keywords: "engineer", remoteOnly: false });
```

## Output

```json
{
  "company": "Figma",
  "ats": "greenhouse",
  "boardSlug": "figma",
  "jobId": "5426468004",
  "title": "Account Executive, Enterprise",
  "department": "Sales",
  "location": "San Francisco, CA • New York, NY • United States",
  "locations": ["San Francisco, CA • New York, NY • United States", "US"],
  "workplaceType": null,
  "isRemote": false,
  "postedAt": "2025-01-28T23:57:29.000Z",
  "updatedAt": "2026-07-22T09:37:08.000Z",
  "url": "https://boards.greenhouse.io/figma/jobs/5426468004?gh_jid=5426468004",
  "salary": { "min": 165000, "max": 190000, "currency": "USD", "period": "year", "text": "Annual Base Salary Range:", "source": "ats" },
  "descriptionText": "Figma is growing our team of passionate creatives and builders...",
  "boardUrl": "https://job-boards.greenhouse.io/figma"
}
```

## Fields

| Field | Notes |
|---|---|
| `company`, `ats`, `boardSlug`, `boardUrl` | Greenhouse sends the company name; for Lever and Ashby it is the board name, capitalised |
| `jobId`, `title`, `department`, `team` | As the ATS stores them |
| `location`, `locations[]` | First location, then every office or secondary location |
| `workplaceType`, `isRemote` | `remote`, `hybrid`, `onsite` or null, from the ATS field or the location text |
| `employmentType` | Full-time, Part-time, Contract, Internship, Temporary... |
| `postedAt`, `updatedAt` | ISO 8601 |
| `url`, `applyUrl` | Job page and application form |
| `salary` | `{ min, max, currency, period, text, source }`; `source` is `ats` (pay-transparency fields) or `description` (parsed from the text); benefits and funding amounts are ignored |
| `descriptionText`, `descriptionHtml` | Clean text; HTML with `--html` |
| `input`, `scrapedAt` | Context |

## FAQ

**Which companies work?** Any company whose careers page is hosted on Greenhouse, Lever or Ashby: most venture-backed tech companies. If a bare name is not found, open the company's careers page, click a job, and paste the board URL you land on.

**Do I need a key?** No. With a free [Unbrowse](https://unbrowse.ai) key, the scraper runs Unbrowse's public Greenhouse, Lever and Ashby tools first, which tell your machine which request to send. Without a key, or when a tool is unavailable, it sends the same request directly with a normal browser user agent (one `note:` line on stderr says so). Either way the request leaves from your IP, and your key is never sent to the site.

**How fresh is the data?** Live: each run reads the board as it is now. Run it on a schedule and diff by `ats` + `jobId` to catch new postings.

**EU-hosted boards?** `job-boards.eu.greenhouse.io` and `jobs.eu.lever.co` are not covered by the public tools yet.
