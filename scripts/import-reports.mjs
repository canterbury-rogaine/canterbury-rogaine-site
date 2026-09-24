import fs from "node:fs";
import path from "node:path";

const [sourceDirectory] = process.argv.slice(2);

if (!sourceDirectory) {
  console.error("Usage: node scripts/import-reports.mjs <report HTML directory>");
  process.exit(1);
}

const root = process.cwd();
const outputDirectory = path.join(root, "reports", "events");
const imageDirectory = path.join(root, "assets", "images", "reports");
fs.mkdirSync(outputDirectory, { recursive: true });

const entityMap = {
  amp: "&", apos: "'", copy: "©", gt: ">", hellip: "…", ldquo: "“",
  lsquo: "‘", lt: "<", mdash: "—", nbsp: " ", ndash: "–", quot: '"',
  rdquo: "”", rsquo: "’",
};

const decode = (value) => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&([a-z]+);/gi, (entity, name) => entityMap[name.toLowerCase()] ?? entity)
  .replace(/\s+/g, " ")
  .trim();

const plainText = (value) => decode(value.replace(/<[^>]+>/g, " "));
const yamlString = (value) => JSON.stringify(value.replace(/\uFFFD/g, "�"));
const escapeMarkdown = (value) => value
  .replace(/\\/g, "\\\\")
  .replace(/\|/g, "\\|")
  .replace(/([*_])/g, "\\$1");

const imageFiles = {
  "1": ["1-01.jpg", "1-02.jpg"],
  "15": ["15-01.jpg"],
  "16": ["16-01.png", "16-02.png"],
  "17": ["17-01.jpg"],
  "19": ["19-01.jpg", "19-02.jpg"],
  "21": ["21-01.jpg", "21-02.jpg", "21-03.jpg", "21-04.jpg"],
};

const convertInline = (html) => decode(html
  .replace(/<(strong|em)[^>]*>(?:\s|&nbsp;)*<\/\1>/gi, "")
  .replace(/<strong[^>]*>((?:\s|&nbsp;)*[.,;:!?](?:\s|&nbsp;)*)<\/strong>/gi, "$1")
  .replace(/<br\s*\/?>/gi, "  \n")
  .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "$1")
  .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
  .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
  .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const text = plainText(label);
    if (href.includes("email-protection")) return text;
    if (href === "../../") return `[${text}]({{ '/' | relative_url }})`;
    if (/canterburyrogaine\.com\/Results\.aspx/i.test(href)) return `[${text}]({{ '/results/' | relative_url }})`;
    return `[${text}](${decode(href)})`;
  })
  .replace(/<[^>]+>/g, " "));

const reports = [];

for (const sourceName of fs.readdirSync(sourceDirectory).filter((name) => /^\d+\.html$/.test(name))) {
  const id = path.basename(sourceName, ".html");
  const source = fs.readFileSync(path.join(sourceDirectory, sourceName), "utf8");
  const section = source.match(/<section id=["']mainContent["']>([\s\S]*?)<\/section>/i)?.[1];
  if (!section) throw new Error(`Could not find report content in ${sourceName}`);

  const titleMatch = section.match(/<h2>([\s\S]*?)<\/h2>/i);
  const dateMatch = section.match(/<p><em[^>]*>([\s\S]*?)<\/em><\/p>/i);
  if (!titleMatch || !dateMatch) throw new Error(`Could not find title/date in ${sourceName}`);

  const title = plainText(titleMatch[1]);
  const date = plainText(dateMatch[1]);
  const yearMatch = date.match(/(19|20)\d{2}/);
  if (!yearMatch) throw new Error(`Could not find year in ${sourceName}`);
  const year = Number(yearMatch[0]);

  let body = section.slice(dateMatch.index + dateMatch[0].length).replace(/\r\n?/g, "\n");
  const tables = [];
  body = body.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableHtml) => {
    const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => escapeMarkdown(plainText(cell[1]))))
      .filter((row) => row.some(Boolean));
    const width = Math.max(0, ...rows.map((row) => row.length));
    const headings = width === 4 ? ["Category", "Team", "Team members", "Score"] : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
    const markdown = `| ${headings.join(" | ")} |\n| ${headings.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${[...row, ...Array(width - row.length).fill("")].join(" | ")} |`).join("\n")}`;
    const index = tables.push(markdown) - 1;
    return `\n\n@@TABLE_${index}@@\n\n`;
  });

  const images = [];
  let imageIndex = 0;
  body = body.replace(/<img\b([^>]*)\/?\s*>/gi, (_, attributes) => {
    const src = attributes.match(/src=["']([^"']+)["']/i)?.[1] ?? "";
    const alt = decode(attributes.match(/alt=["']([^"']*)["']/i)?.[1] || `${title} event photograph`);
    const localName = imageFiles[id]?.[imageIndex];
    let markdown;
    if (localName && fs.existsSync(path.join(imageDirectory, localName))) {
      markdown = `![${alt}]({{ '/assets/images/reports/${localName}' | relative_url }})`;
    } else {
      markdown = `> **Historical image unavailable.** ${alt ? `${alt}. ` : ""}[Original image reference](${decode(src)})`;
    }
    const index = images.push(markdown) - 1;
    imageIndex += 1;
    return `@@IMAGE_${index}@@`;
  });

  body = body
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => {
      const imageTokens = content.match(/@@IMAGE_\d+@@/g) ?? [];
      const heading = convertInline(content.replace(/@@IMAGE_\d+@@/g, ""));
      return `\n\n${imageTokens.join("\n\n")}\n\n## ${heading}\n\n`;
    })
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
      const paragraph = convertInline(content);
      return paragraph.replace(/[\s*_]/g, "") ? `\n\n${paragraph}\n\n` : "";
    })
    .replace(/<div[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<[^>]+>/g, "");

  for (const [index, table] of tables.entries()) body = body.replace(`@@TABLE_${index}@@`, table);
  for (const [index, image] of images.entries()) body = body.replace(`@@IMAGE_${index}@@`, image);
  body = body
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const page = `---
layout: report
title: ${yamlString(title)}
description: ${yamlString(`Event report for ${title}, ${date}.`)}
date: ${yamlString(date)}
year: ${year}
---

${body}
`;

  fs.writeFileSync(path.join(outputDirectory, `${id}.md`), page);
  reports.push({ id, title, date, year, timestamp: Date.parse(`${date} UTC`) });
}

reports.sort((a, b) => b.timestamp - a.timestamp);
const years = Map.groupBy(reports, ({ year }) => year);
const earliest = Math.min(...reports.map(({ year }) => year));
const latest = Math.max(...reports.map(({ year }) => year));
const archiveRange = `${earliest}–${latest}`;
const archive = `---
layout: reports_archive
title: Event reports
description: Canterbury Rogaine Series event reports from ${archiveRange}.
permalink: /reports/
report_count: ${reports.length}
year_count: ${years.size}
archive_range: ${archiveRange}
---
${[...years.entries()].sort(([a], [b]) => b - a).map(([year, yearReports]) => `## ${year}\n\n${yearReports.map((report) => `- [${report.title}]({{ '/reports/events/${report.id}.html' | relative_url }})\n  *${report.date}*`).join("\n")}`).join("\n\n")}
`;

fs.writeFileSync(path.join(root, "reports.md"), archive);
console.log(`Imported ${reports.length} reports across ${years.size} years.`);
