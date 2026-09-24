# Canterbury Rogaine website

A minimal Jekyll site hosted on GitHub Pages. Edit the homepage in `index.md`;
it contains HTML sections with Jekyll asset links, using `_layouts/default.html`.
No Node.js, JavaScript framework, paid hosting, or deployment secrets are needed.

## First deployment

The repository already uses `main` and has this origin:
`https://github.com/canterbury-rogaine/canterbury-rogaine-site.git`.

1. Commit these files and push them:

   ```sh
   git add .
   git commit -m "Set up Jekyll site and GitHub Pages deployment"
   git push -u origin main
   ```

2. In the GitHub repository, open **Settings → Pages → Build and deployment**
   and set **Source** to **GitHub Actions**. This requires repository admin or
   maintainer access and a repository/plan eligible for GitHub Pages.
3. Open **Actions → Build and deploy GitHub Pages**. If the initial deployment
   ran before Pages was enabled, rerun it or choose **Run workflow** on `main`.
4. After deployment succeeds, visit:
   <https://canterbury-rogaine.github.io/canterbury-rogaine-site/>.

Pushes to `main` build and deploy automatically. Pull requests targeting `main`
build and check the generated files without publishing. The workflow uses
GitHub's Pages actions and a temporary GitHub token with deployment permissions
limited to the deployment job. Generated HTML is an Actions artifact; it does
not need a `gh-pages` branch or a commit to this repository.

## Local preview (optional)

Install Ruby and Bundler (on Windows, use RubyInstaller with Devkit), then run:

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1
```

Visit <http://127.0.0.1:4000/canterbury-rogaine-site/>. Restart the server after
editing `_config.yml`. To check a production build locally:

```sh
bundle exec jekyll build --trace
```

`Gemfile` uses the GitHub Pages dependency set. The hosted build action supplies
its own dependencies and does not use a local `Gemfile.lock`; if you commit a
lockfile for local reproducibility, update it when the action's dependencies change.

## Editing the site

- `index.md`: homepage content and event details; retain the YAML front matter.
- `results.md`: easy-to-edit results list, with the latest years first.
- `results/events/`: 45 Markdown event pages containing the published results.
- `reports.md`: newest-first list of event reports.
- `reports/events/`: Markdown pages containing the event reports.
- `_config.yml`: site name, description, URL, and repository path.
- `_layouts/default.html`: shared HTML structure and metadata.
- `assets/css/style.css`: styling.
- `assets/images/logo.jpg`: supplied temporary logo; replace with a higher-quality asset later.
- `assets/images/reports/`: locally stored report photographs.
- `404.html`: missing-page content.
- `.github/workflows/pages.yml`: build validation and deployment.
- `scripts/import-results.mjs`: repeatable result importer.
- `scripts/import-reports.mjs`: repeatable report importer.

For another page, add a Markdown file with YAML front matter. Use Jekyll's
`relative_url` filter for internal links and assets so the repository path is
included. `.gitignore` excludes generated files and local dependencies;
`.gitattributes` and `.editorconfig` keep line endings and formatting consistent.

For a custom domain later, configure it in GitHub Pages, update `url`, set
`baseurl` to an empty string, and update the workflow's stylesheet path check.

## Why Jekyll?

The homepage content was adapted from <https://www.canterburyrogaine.com/Default.aspx>.
The next series is planned for January 2027. The displayed 2026 schedule and
fees are explicitly marked as placeholders until updated information is available.
The entry button is deliberately disabled and has no registration link or handler.

The initial results were imported from
<https://www.canterburyrogaine.com/Results.aspx> and its 45 linked event records.
It preserves every published division, team, placing, score and grade code from
2011–2025. Generated event pages are committed so deployment has no external
content dependency.

Add future events near the top of `results.md` using normal Markdown:

```md
## 2027

- [Event 1 – Location]({{ '/results/events/event-1.html' | relative_url }})
  *Summer Rogaine Series 2027*
```

To repeat the full import after downloading the summary and event HTML files:

```sh
node scripts/import-results.mjs path/to/Results.aspx path/to/event-html-directory
```

The event directory must contain one file per event named by its numeric
ID, such as `1078.html`. Review and commit the regenerated `results.md` and
`results/events/` files after running the importer.

Each event page uses `_layouts/result.html`; its file only needs metadata,
Markdown headings and tables. A new event result page can follow this structure:

```md
---
layout: result
title: Event 1 – Location – 13 January 2027
year: 2027
series: Summer Rogaine Series 2027
---

## 2hr event

*2 recorded teams*

| Place | Team | Score (penalty) | Grade Place |
| --- | --- | --- | --- |
| 1 | Team One | 1230 | X1 |
| 2 | Team Two | 1110 | F1 |
```

The initial reports were imported from
<https://www.canterburyrogaine.com/Reports.aspx>. To regenerate it from saved
copies of the individual report pages:

```sh
node scripts/import-reports.mjs path/to/report-html-directory
```

Each source file must use its numeric ID, such as `34.html`. The importer
generates `reports.md` and the Markdown files under `reports/events/`.

Plain HTML would be sufficient for one page. Jekyll adds Markdown editing and
shared layouts while keeping the infrastructure small. A larger JavaScript
framework is unnecessary for this starter.

Reference: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
