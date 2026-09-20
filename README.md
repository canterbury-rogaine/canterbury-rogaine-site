# Canterbury Rogaine website

A minimal Jekyll site hosted on GitHub Pages. Edit the homepage in `index.md`;
Jekyll converts Markdown to HTML using `_layouts/default.html`.
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

- `index.md`: homepage content; retain the YAML front matter at the top.
- `_config.yml`: site name, description, URL, and repository path.
- `_layouts/default.html`: shared HTML structure and metadata.
- `assets/css/style.css`: styling.
- `404.html`: missing-page content.
- `.github/workflows/pages.yml`: build validation and deployment.

For another page, add a Markdown file with YAML front matter. Use Jekyll's
`relative_url` filter for internal links and assets so the repository path is
included. `.gitignore` excludes generated files and local dependencies;
`.gitattributes` and `.editorconfig` keep line endings and formatting consistent.

For a custom domain later, configure it in GitHub Pages, update `url`, set
`baseurl` to an empty string, and update the workflow's stylesheet path check.

## Why Jekyll?

Plain HTML would be sufficient for one page. Jekyll adds Markdown editing and
shared layouts while keeping the infrastructure small. A larger JavaScript
framework is unnecessary for this starter.

Reference: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
