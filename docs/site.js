/* eslint-env browser */
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector("[data-nav-toggle]");

  if (!toggle) {
    return;
  }

  toggle.addEventListener("click", () => {
    const isOpen = document.body.dataset.navOpen === "true";
    document.body.dataset.navOpen = isOpen ? "false" : "true";
    toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
});
