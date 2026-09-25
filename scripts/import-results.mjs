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
const markdownCell = (value) => decodeText(value)
  .replace(/\\/g, "\\\\")
  .replace(/\|/g, "\\|")
  .replace(/\*/g, "\\*")
  .replace(/_/g, "\\_");
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
    const sourceRows = [...tableMatch[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => markdownCell(cell[1])));
    const headers = sourceRows.shift();
    const rows = sourceRows
      .map((row) => row.slice(0, headers.length))
      .filter((row) => row.some(Boolean));

    if (!headers || !rows.length) throw new Error(`Empty result table for ${event.id}: ${division}`);
    tables.push({ division, headers, rows });
  }

  if (!tables.length) throw new Error(`No result tables found for ${event.id}: ${title}`);

  const page = `---
layout: result
title: ${yamlString(title)}
description: ${yamlString(`Results for ${title}.`)}
year: ${event.year}
series: ${yamlString(event.series)}
---
${tables.map(({ division, headers, rows }) => `## ${division}\n\n*${rows.length} recorded teams*\n\n| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}`).join("\n\n")}
`;

  const oldHtmlPage = path.join(outputDirectory, `${event.id}.html`);
  if (fs.existsSync(oldHtmlPage)) fs.unlinkSync(oldHtmlPage);
  fs.writeFileSync(path.join(outputDirectory, `${event.id}.md`), page);
}

const years = Map.groupBy(events, ({ year }) => year);
const latestImportedYear = Math.max(...years.keys());
const resultsFile = path.join(root, "results.md");
let newerSections = [];

if (fs.existsSync(resultsFile)) {
  const currentResults = fs.readFileSync(resultsFile, "utf8");
  const headings = [...currentResults.matchAll(/^## (\d{4})\s*$/gm)];
  newerSections = headings
    .map((heading, index) => ({
      year: Number(heading[1]),
      content: currentResults.slice(
        heading.index,
        headings[index + 1]?.index ?? currentResults.length,
      ).trim(),
    }))
    .filter(({ year }) => year > latestImportedYear)
    .map(({ content }) => content);
}

const importedSections = [...years.entries()].sort(([a], [b]) => b - a).map(([year, yearEvents]) => `## ${year}\n\n${yearEvents.map((event) => `- [${event.title.replace(/ - (?:\d{1,2} )?[A-Za-z]+ \d{4}$/, "")}]({{ '/results/events/${event.id}.html' | relative_url }})\n  *${event.series}*`).join("\n")}`).join("\n\n");
const archive = `---
layout: results_archive
title: Results
description: Canterbury Rogaine Series event results.
permalink: /results/
---
${[...newerSections, importedSections].filter(Boolean).join("\n\n")}
`;

fs.writeFileSync(resultsFile, archive);
console.log(`Imported ${events.length} events across ${years.size} years.`);
