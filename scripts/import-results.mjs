import fs from "node:fs";
import path from "node:path";

const [summaryFile, eventsDirectory] = process.argv.slice(2);

if (!summaryFile || !eventsDirectory) {
  console.error("Usage: node scripts/import-results.mjs <Results.aspx HTML> <event HTML directory>");
  process.exit(1);
}

const root = process.cwd();
const outputDirectory = path.join(root, "results", "events");
fs.mkdirSync(outputDirectory, { recursive: true });

const decodeText = (value) => value
  .replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();

const yamlString = (value) => JSON.stringify(value.replace(/\uFFFD/g, "�"));
const summaryHtml = fs.readFileSync(summaryFile, "utf8");
const tokenPattern = /<h3>([\s\S]*?)<\/h3>|eventResults\.aspx\?id=(\d+)[\s\S]*?<\/a>/gi;
const events = [];
let series = "Other events";
let token;

while ((token = tokenPattern.exec(summaryHtml))) {
  if (token[1]) {
    series = decodeText(token[1]);
    continue;
  }

  const id = token[2];
  const anchorStart = summaryHtml.lastIndexOf(">", tokenPattern.lastIndex - 5) + 1;
  const anchorEnd = summaryHtml.indexOf("</a>", anchorStart);
  const title = decodeText(summaryHtml.slice(anchorStart, anchorEnd));
  const yearMatch = title.match(/(20\d{2}|19\d{2})(?!.*\d)/);

  if (!title || !yearMatch) {
    throw new Error(`Could not extract title/year for result ${id}`);
  }

  events.push({ id, series, title, year: Number(yearMatch[1]) });
}

if (events.length !== 45) {
  throw new Error(`Expected 45 event records, found ${events.length}`);
}

for (const event of events) {
  const sourceFile = path.join(eventsDirectory, `${event.id}.html`);
  const eventHtml = fs.readFileSync(sourceFile, "utf8");
  const titleMatch = eventHtml.match(/<h2>Results<\/h2>\s*<h3>([\s\S]*?)<\/h3>/i);
  const title = titleMatch ? decodeText(titleMatch[1]) : event.title;
  const tables = [];
  const resultsContent = titleMatch ? eventHtml.slice(titleMatch.index + titleMatch[0].length) : eventHtml;
  const tablePattern = /<h3>([\s\S]*?)<\/h3>\s*<table class=['"]resultsTable['"]>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tablePattern.exec(resultsContent))) {
    const division = decodeText(tableMatch[1]);
    let table = tableMatch[2]
      .replace(/\sstyle=['"][^'"]*['"]/gi, "")
      .replace(/<tr class=['"]resultsHeader['"]>([\s\S]*?)<\/tr>/i, (_, row) => {
        const headers = row.replace(/<td[^>]*>/gi, '<th scope="col">').replace(/<\/td>/gi, "</th>");
        return `<thead><tr>${headers}</tr></thead><tbody>`;
      })
      .replace(/<tr><td>\s*<\/td><td>\s*<\/td><td>\s*<\/td><td>\s*<\/td><\/tr>/gi, "")
      .trim();
    if (table.includes("<tbody>")) table += "</tbody>";
    tables.push({ division, table });
  }

  if (!tables.length) throw new Error(`No result tables found for ${event.id}: ${title}`);

  const page = `---
title: ${yamlString(title)}
description: ${yamlString(`Historical results for ${title}.`)}
---
<header class="site-header container archive-header">
  <a class="brand" href="{{ '/' | relative_url }}" aria-label="Canterbury Rogaine Series home"><img src="{{ '/assets/images/logo.jpg' | relative_url }}" alt="Canterbury Rogaine Series" width="200" height="200"></a>
  <nav aria-label="Main navigation"><a href="{{ '/' | relative_url }}">Home</a><a href="{{ '/results/' | relative_url }}" aria-current="page">Results</a></nav>
  <span class="header-location">Christchurch, NZ <span aria-hidden="true">↗</span></span>
</header>

<article class="result-page container">
  <a class="breadcrumb" href="{{ '/results/' | relative_url }}">← All results</a>
  <div class="result-title">
    <p class="eyebrow">Results archive · ${event.year}</p>
    <h1>${title}</h1>
    <p>${event.series}</p>
  </div>
  ${tables.map(({ division, table }, divisionIndex) => `<section class="result-division" aria-labelledby="division-${event.id}-${divisionIndex}">
    <div class="result-division-heading"><h2 id="division-${event.id}-${divisionIndex}">${division}</h2><span>${(table.match(/<tr>/g) || []).length - 1} recorded teams</span></div>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${division} results table"><table class="results-table">${table}</table></div>
  </section>`).join("\n  ")}
  <p class="archive-source">Archived from the former Canterbury Rogaine Series website. Names, placings, scores and grade codes are reproduced as originally published.</p>
</article>

<footer class="site-footer"><div class="container footer-inner"><div><strong>Canterbury Rogaine Series</strong><p>Find your way. Together.</p></div><a href="{{ '/results/' | relative_url }}">Results archive</a><a href="#main" class="back-top">Back to top ↑</a></div></footer>
`;

  fs.writeFileSync(path.join(outputDirectory, `${event.id}.html`), page);
}

const years = Map.groupBy(events, ({ year }) => year);
const archive = `---
layout: results_archive
title: Results archive
description: Historical Canterbury Rogaine Series results from 2011 to 2025.
permalink: /results/
event_count: ${events.length}
year_count: ${years.size}
archive_range: 2011–2025
---
${[...years.entries()].sort(([a], [b]) => b - a).map(([year, yearEvents]) => `## ${year}\n\n${yearEvents.map((event) => `- [${event.title.replace(/ - (?:\d{1,2} )?[A-Za-z]+ \d{4}$/, "")}]({{ '/results/events/${event.id}.html' | relative_url }})\n  *${event.series}*`).join("\n")}`).join("\n\n")}
`;

fs.writeFileSync(path.join(root, "results.md"), archive);
console.log(`Imported ${events.length} events across ${years.size} years.`);
