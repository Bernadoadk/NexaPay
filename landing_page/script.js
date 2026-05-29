(function () {
  const root = document.documentElement;
  const storedTheme = localStorage.getItem("nexapay-landing-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = storedTheme || (prefersDark ? "dark" : "dark");
  const header = document.querySelector("[data-header]");
  const menu = document.querySelector("[data-mobile-menu]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const storeDialog = document.querySelector("[data-store-dialog]");
  const storeTriggers = document.querySelectorAll("[data-store-modal]");
  const storeClosers = document.querySelectorAll("[data-store-close]");
  const scrollLinks = document.querySelectorAll("[data-scroll]");
  const year = document.querySelector("[data-year]");
  let lastFocused = null;

  if (window.location.pathname.endsWith("/index.html")) {
    window.history.replaceState(null, "", "/");
  } else if (window.location.pathname.endsWith(".html")) {
    window.history.replaceState(null, "", window.location.pathname.replace(/\.html$/, ""));
  }

  if (window.location.hash) {
    const targetFromHash = window.location.hash.slice(1);
    sessionStorage.setItem("nexapay-scroll-target", targetFromHash);
    window.history.replaceState(null, "", window.location.pathname);
  }

  root.dataset.theme = initialTheme;
  if (year) year.textContent = String(new Date().getFullYear());

  function syncHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  function closeMenu() {
    if (!menu || !menuToggle || !header) return;
    menu.classList.remove("is-open");
    header.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  function openStoreDialog() {
    if (!storeDialog) return;
    lastFocused = document.activeElement;
    storeDialog.hidden = false;
    document.body.classList.add("modal-open");
    const closeButton = storeDialog.querySelector("[data-store-close]");
    if (closeButton) closeButton.focus();
  }

  function closeStoreDialog() {
    if (!storeDialog || storeDialog.hidden) return;
    storeDialog.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function isHomePage() {
    return window.location.pathname === "/" || window.location.pathname.endsWith("/index.html");
  }

  function scrollToTarget(target) {
    if (!target) return;
    if (target === "accueil") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.addEventListener("scroll", syncHeader, { passive: true });
  syncHeader();

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      localStorage.setItem("nexapay-landing-theme", next);
    });
  }

  if (menuToggle && menu && header) {
    menuToggle.addEventListener("click", function () {
      const isOpen = menu.classList.toggle("is-open");
      header.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("menu-open", isOpen);
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
  }

  scrollLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      const target = link.getAttribute("data-scroll");
      if (!target) return;
      event.preventDefault();
      closeMenu();
      if (isHomePage()) {
        scrollToTarget(target);
      } else {
        sessionStorage.setItem("nexapay-scroll-target", target);
        window.location.href = "/";
      }
    });
  });

  const pendingTarget = sessionStorage.getItem("nexapay-scroll-target");
  if (pendingTarget && isHomePage()) {
    sessionStorage.removeItem("nexapay-scroll-target");
    window.requestAnimationFrame(function () {
      scrollToTarget(pendingTarget);
    });
  }

  storeTriggers.forEach(function (button) {
    button.addEventListener("click", openStoreDialog);
  });

  storeClosers.forEach(function (button) {
    button.addEventListener("click", closeStoreDialog);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
      closeStoreDialog();
    }
  });

  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach(function (el, index) {
      el.style.transitionDelay = Math.min(index * 35, 210) + "ms";
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();
