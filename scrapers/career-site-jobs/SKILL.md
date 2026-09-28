---
name: career-site-jobs-scraper
description: Get every open job from a company's Greenhouse, Lever or Ashby careers page as JSON with title, department, location, remote/hybrid, posted date, salary range and description. Use when the user asks what a company is hiring for, wants job postings exported, or wants to track new openings at specific companies.
---

# Career site jobs scraper (Greenhouse, Lever, Ashby)

## When to use
- "What is Figma hiring for?", "remote engineering jobs at Ramp", "export Spotify's open roles", "which of these companies posted jobs this week".
- The company's careers page runs on Greenhouse, Lever or Ashby (URLs like boards.greenhouse.io/x, jobs.lever.co/x, jobs.ashbyhq.com/x). Other job sites are out of scope.

## Run
Needs `UNBROWSE_API_KEY` (free at https://unbrowse.ai). From the repo root:

```bash
node scrapers/career-site-jobs/index.mjs https://boards.greenhouse.io/figma > out.json
node scrapers/career-site-jobs/index.mjs lever:spotify ashby:ramp > out.json
node scrapers/career-site-jobs/index.mjs notion --keywords engineer --remote --days 30 > out.json
```

A bare name (`notion`) tries Greenhouse, then Lever, then Ashby. Options: `--keywords`, `--exclude`, `--location`, `--department` (comma-separated), `--remote`, `--days N`, `--max N`, `--html`, `--no-description`.
Progress goes to stderr, the JSON array to stdout. Exit 1 on error, 2 on zero results.

## Output
Array of jobs: `company, ats, boardSlug, jobId, title, department, team, location, locations[], workplaceType, isRemote, employmentType, postedAt, updatedAt, url, applyUrl, salary{min,max,currency,period,text,source}, descriptionText, boardUrl, input, scrapedAt`.

## Notes
- "no Greenhouse, Lever or Ashby board is named X": ask the user for the careers-page URL.
- Salary comes from the ATS pay fields when present, else from the description text; null when neither states pay.
