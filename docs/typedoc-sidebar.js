(function () {
  const guideLinks = [
    { href: "index.html", label: "Docs Home" },
    { href: "documents/docs_getting-started.html", label: "Getting Started" },
    { href: "documents/docs_developer-guide.html", label: "Developer Guide" },
    { href: "documents/docs_first-feature.html", label: "First Feature" },
    { href: "documents/docs_flow-coordination.html", label: "Flow Coordination" },
    { href: "documents/docs_bff-guide.html", label: "BFF Guide" },
    { href: "documents/docs_testing.html", label: "Testing" },
    { href: "documents/docs_deployment.html", label: "Deployment" },
    { href: "documents/docs_architecture.html", label: "Architecture" },
    { href: "documents/docs_manifest-reference.html", label: "Manifest Reference" },
    { href: "documents/docs_troubleshooting.html", label: "Troubleshooting" },
    { href: "documents/examples_starter-app_README.html", label: "Starter App" },
    { href: "documents/apps_task-shop_README.html", label: "Task Shop" }
  ];

  function currentDocumentPath(base) {
    const currentUrl = new URL(window.location.href);
    const rootUrl = new URL(base, currentUrl);
    return currentUrl.href.replace(rootUrl.href, "") || "index.html";
  }

  function buildSection(title, links, base, currentPath) {
    const section = document.createElement("nav");
    section.className = "tsd-navigation teleforge-sidebar-section";

    const heading = document.createElement("h3");
    heading.className = "teleforge-sidebar-heading";
    heading.textContent = title;
    section.appendChild(heading);

    for (const link of links) {
      const anchor = document.createElement("a");
      anchor.href = base + link.href;
      anchor.textContent = link.label;

      if (currentPath === link.href) {
        anchor.classList.add("current");
        anchor.setAttribute("aria-current", "page");
      }

      section.appendChild(anchor);
    }

    return section;
  }

  function initSidebar() {
    const sidebar = document.querySelector(".col-sidebar");
    const siteMenu = sidebar?.querySelector(".site-menu");
    const base = document.documentElement.dataset.base || "./";

    if (!sidebar || !siteMenu || sidebar.querySelector(".teleforge-sidebar-section")) {
      return;
    }

    const currentPath = currentDocumentPath(base);
    const docsSection = buildSection("Guides", guideLinks, base, currentPath);
    const apiSection = buildSection(
      "API Reference",
      [{ href: "modules.html", label: "Modules" }],
      base,
      currentPath
    );

    sidebar.insertBefore(docsSection, siteMenu);
    sidebar.insertBefore(apiSection, siteMenu);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar, { once: true });
  } else {
    initSidebar();
  }
})();
