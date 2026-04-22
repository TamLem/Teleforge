import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";

const workspaceRoot = process.cwd();
const outputDir = path.join(workspaceRoot, "dist", "docs-site");
const repoUrl = "https://github.com/TamLem/Teleforge";

const pages = [
  {
    id: "home",
    source: "docs/README.md",
    output: "index.html",
    navLabel: "Docs Home",
    section: "Start"
  },
  {
    id: "telegram-basics",
    source: "docs/telegram-basics.md",
    output: "telegram-basics.html",
    navLabel: "Telegram Basics",
    section: "Start"
  },
  {
    id: "getting-started",
    source: "docs/getting-started.md",
    output: "getting-started.html",
    navLabel: "Getting Started",
    section: "Start"
  },
  {
    id: "developer-guide",
    source: "docs/developer-guide.md",
    output: "developer-guide.html",
    navLabel: "Developer Guide",
    section: "Guides"
  },
  {
    id: "first-feature",
    source: "docs/first-feature.md",
    output: "first-feature.html",
    navLabel: "First Feature",
    section: "Guides"
  },
  {
    id: "flow-coordination",
    source: "docs/flow-coordination.md",
    output: "flow-coordination.html",
    navLabel: "Flow Coordination",
    section: "Guides"
  },
  {
    id: "server-hooks",
    source: "docs/server-hooks.md",
    output: "server-hooks.html",
    navLabel: "Server Hooks",
    section: "Guides"
  },
  {
    id: "miniapp-architecture",
    source: "docs/miniapp-architecture.md",
    output: "miniapp-architecture.html",
    navLabel: "Mini App Architecture",
    section: "Reference"
  },
  {
    id: "flow-state-design",
    source: "docs/flow-state-design.md",
    output: "flow-state-design.html",
    navLabel: "Flow State",
    section: "Reference"
  },
  {
    id: "testing",
    source: "docs/testing.md",
    output: "testing.html",
    navLabel: "Testing",
    section: "Guides"
  },
  {
    id: "deployment",
    source: "docs/deployment.md",
    output: "deployment.html",
    navLabel: "Deployment",
    section: "Guides"
  },
  {
    id: "environment-variables",
    source: "docs/environment-variables.md",
    output: "environment-variables.html",
    navLabel: "Environment Variables",
    section: "Reference"
  },
  {
    id: "framework-model",
    source: "docs/framework-model.md",
    output: "framework-model.html",
    navLabel: "Framework Model",
    section: "Reference"
  },
  {
    id: "config-reference",
    source: "docs/config-reference.md",
    output: "config-reference.html",
    navLabel: "Config Reference",
    section: "Reference"
  },
  {
    id: "troubleshooting",
    source: "docs/troubleshooting.md",
    output: "troubleshooting.html",
    navLabel: "Troubleshooting",
    section: "Reference"
  },
  {
    id: "starter-app",
    source: "examples/starter-app/README.md",
    output: "starter-app.html",
    navLabel: "Starter App",
    section: "Examples"
  },
  {
    id: "task-shop",
    source: "apps/task-shop/README.md",
    output: "task-shop.html",
    navLabel: "Task Shop",
    section: "Examples"
  }
];

const sectionOrder = ["Start", "Guides", "Reference", "Examples"];
const sourceToPage = new Map();

for (const page of pages) {
  sourceToPage.set(resolveSource(page.source), page);
  for (const alias of page.aliases ?? []) {
    sourceToPage.set(resolveSource(alias), page);
  }
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const siteCss = await readFile(path.join(workspaceRoot, "docs", "site.css"), "utf8");
const siteJs = await readFile(path.join(workspaceRoot, "docs", "site.js"), "utf8");
await writeFile(path.join(outputDir, "site.css"), siteCss);
await writeFile(path.join(outputDir, "site.js"), siteJs);

for (const [index, page] of pages.entries()) {
  const markdownSource = await readFile(resolveSource(page.source), "utf8");
  const previousPage = pages[index - 1] ?? null;
  const nextPage = pages[index + 1] ?? null;
  const title = extractTitle(markdownSource) ?? page.navLabel;
  const toc = [];
  const md = createMarkdownRenderer(page, toc);
  const contentHtml = md.render(markdownSource);

  const html = renderDocument({
    page,
    title,
    toc,
    contentHtml,
    previousPage,
    nextPage
  });

  const pageOutput = path.join(outputDir, page.output);
  await mkdir(path.dirname(pageOutput), { recursive: true });
  await writeFile(pageOutput, html);
}

function resolveSource(relativePath) {
  return path.resolve(workspaceRoot, relativePath);
}

function extractTitle(markdownSource) {
  const match = markdownSource.match(/^#\s+(.+)$/m);
  return match?.[1].trim() ?? null;
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+={}[\]|\\:;"'<>,.?/]+/g, "")
    .replace(/\s+/g, "-");
}

function createMarkdownRenderer(page, toc) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  });

  md.use(markdownItAnchor, {
    level: [2, 3],
    slugify,
    callback(token, info) {
      toc.push({
        level: Number.parseInt(token.tag.slice(1), 10),
        slug: info.slug,
        title: info.title
      });
    }
  });

  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href");

    if (href) {
      tokens[idx].attrSet("href", rewriteHref(page, href));
    }

    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

function rewriteHref(page, href) {
  if (
    href.startsWith("#") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  const [rawPath, hash = ""] = href.split("#");

  if (!rawPath) {
    return href;
  }

  const currentSourceDir = path.dirname(resolveSource(page.source));
  const resolvedTarget = path.resolve(currentSourceDir, rawPath);
  const mappedPage = sourceToPage.get(resolvedTarget);

  if (mappedPage) {
    return toRelativeHref(page.output, mappedPage.output, hash);
  }

  if (
    rawPath.endsWith("/api/index.html") ||
    rawPath === "./api/index.html" ||
    rawPath === "api/index.html"
  ) {
    return toRelativeHref(page.output, "api/index.html", hash);
  }

  if (rawPath.endsWith(".md")) {
    return href.replace(/\.md$/, ".html");
  }

  return href;
}

function toRelativeHref(fromOutput, toOutput, hash = "") {
  const fromDir = path.posix.dirname(fromOutput);
  const relativePath = path.posix.relative(fromDir, toOutput) || path.posix.basename(toOutput);
  return `${relativePath}${hash ? `#${hash}` : ""}`;
}

function renderDocument({ page, title, toc, contentHtml, previousPage, nextPage }) {
  const pageTitle =
    title === "Teleforge Documentation" ? title : `${title} | Teleforge Documentation`;
  const tocItems = toc
    .map(
      (entry) =>
        `<a class="toc-link toc-level-${entry.level}" href="#${escapeHtml(entry.slug)}">${escapeHtml(entry.title)}</a>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta
      name="description"
      content="Teleforge documentation for Telegram-native bots, Mini Apps, coordination flows, and local simulator-first development."
    />
    <link rel="stylesheet" href="${toRelativeHref(page.output, "site.css")}" />
    <script defer src="${toRelativeHref(page.output, "site.js")}"></script>
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-sidebar" data-nav-toggle>
          Menu
        </button>
        <a class="brand" href="${toRelativeHref(page.output, "index.html")}">Teleforge</a>
        <div class="site-header__links">
          <a href="${toRelativeHref(page.output, "api/index.html")}">API Reference</a>
          <a href="${repoUrl}">GitHub</a>
        </div>
      </div>
    </header>
    <div class="site-shell">
      <aside class="sidebar" id="site-sidebar" data-sidebar>
        <div class="sidebar-card">
          <p class="sidebar-kicker">Documentation</p>
          <h1>${escapeHtml(title === "Teleforge Documentation" ? title : page.navLabel)}</h1>
          <p>Narrative guides are primary. API reference stays available, but separate.</p>
        </div>
        ${renderSidebar(page)}
        <div class="sidebar-card sidebar-card--api">
          <p class="sidebar-kicker">API</p>
          <a class="sidebar-api-link" href="${toRelativeHref(page.output, "api/index.html")}">Open TypeDoc reference</a>
        </div>
      </aside>
      <main class="content">
        <article class="prose">
          ${contentHtml}
        </article>
        ${renderPageNav(page, previousPage, nextPage)}
      </main>
      <aside class="toc">
        <div class="toc-card">
          <p class="sidebar-kicker">On This Page</p>
          ${tocItems || '<p class="toc-empty">No section anchors on this page.</p>'}
        </div>
      </aside>
    </div>
  </body>
</html>`;
}

function renderSidebar(currentPage) {
  const sections = sectionOrder
    .map((section) => {
      const items = pages.filter((page) => page.section === section);

      if (items.length === 0) {
        return "";
      }

      return `<section class="sidebar-section">
        <h2>${escapeHtml(section)}</h2>
        <nav class="sidebar-nav">
          ${items
            .map((page) => {
              const href = toRelativeHref(currentPage.output, page.output);
              const current = page.id === currentPage.id ? " current" : "";
              const aria = page.id === currentPage.id ? ' aria-current="page"' : "";
              return `<a class="sidebar-link${current}" href="${href}"${aria}>${escapeHtml(page.navLabel)}</a>`;
            })
            .join("")}
        </nav>
      </section>`;
    })
    .join("");

  return sections;
}

function renderPageNav(currentPage, previousPage, nextPage) {
  if (!previousPage && !nextPage) {
    return "";
  }

  const previous = previousPage
    ? `<a class="page-nav__link" href="${toRelativeHref(currentPage.output, previousPage.output)}">
        <span class="page-nav__eyebrow">Previous</span>
        <span>${escapeHtml(previousPage.navLabel)}</span>
      </a>`
    : '<span class="page-nav__spacer"></span>';

  const next = nextPage
    ? `<a class="page-nav__link page-nav__link--next" href="${toRelativeHref(currentPage.output, nextPage.output)}">
        <span class="page-nav__eyebrow">Next</span>
        <span>${escapeHtml(nextPage.navLabel)}</span>
      </a>`
    : "";

  return `<nav class="page-nav">${previous}${next}</nav>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
