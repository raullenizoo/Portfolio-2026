/* ==========================================================================
   Raul Lenizo — Portfolio
   Vanilla JS: theme toggle, scroll nav, reveal animations, typing effect,
   project filtering, contact form validation, back-to-top.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme toggle ---------- */
  function initTheme() {
    var toggle = document.getElementById("themeToggle");
    var stored = null;
    try { stored = localStorage.getItem("portfolio-theme"); } catch (e) { /* storage unavailable */ }

    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var initial = stored || (prefersDark ? "dark" : "light");
    root.setAttribute("data-theme", initial);
    if (toggle) toggle.setAttribute("aria-pressed", String(initial === "dark"));

    if (toggle) {
      toggle.addEventListener("click", function () {
        var current = root.getAttribute("data-theme");
        var next = current === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        toggle.setAttribute("aria-pressed", String(next === "dark"));
        try { localStorage.setItem("portfolio-theme", next); } catch (e) { /* storage unavailable */ }
      });
    }
  }

  /* ---------- Navbar: solid on scroll + active link tracking ---------- */
  function initNav() {
    var nav = document.getElementById("mainNav");
    var sections = Array.prototype.slice.call(document.querySelectorAll("section[id], header[id]"));
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link[data-section]"));

    function onScroll() {
      if (window.scrollY > 40) {
        nav.classList.add("scrolled");
      } else {
        nav.classList.remove("scrolled");
      }

      var scrollPos = window.scrollY + 140;
      var current = sections[0] ? sections[0].id : "";
      sections.forEach(function (sec) {
        if (scrollPos >= sec.offsetTop) current = sec.id;
      });

      navLinks.forEach(function (link) {
        link.classList.toggle("active", link.getAttribute("data-section") === current);
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Collapse mobile menu after a link is tapped
    var collapseEl = document.getElementById("navMenu");
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        if (collapseEl && collapseEl.classList.contains("show") && window.bootstrap) {
          var bsCollapse = window.bootstrap.Collapse.getOrCreateInstance(collapseEl);
          bsCollapse.hide();
        }
      });
    });
  }

  /* ---------- Scroll indicator ---------- */
  function initScrollIndicator() {
    var btn = document.getElementById("scrollIndicator");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var target = document.getElementById("skills");
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ---------- Reveal-on-scroll (Intersection Observer) ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    items.forEach(function (el, i) {
      el.style.transitionDelay = (i % 6) * 0.05 + "s";
      observer.observe(el);
    });
  }

  /* ---------- Typing effect in hero code block ---------- */
  function initTyping() {
    var el = document.getElementById("typedTitle");
    if (!el) return;
    var phrases = ["Aspiring Web Developer", "PHP & MySQL", "JavaScript Enthusiast"];
    var phraseIndex = 0, charIndex = 0, deleting = false;

    function tick() {
      var current = phrases[phraseIndex];
      if (!deleting) {
        charIndex++;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(tick, 1400);
          return;
        }
      } else {
        charIndex--;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
        }
      }
      setTimeout(tick, deleting ? 35 : 65);
    }
    tick();
  }

  /* ---------- Project filtering ---------- */
  function initProjectFilter() {
    var buttons = document.querySelectorAll(".filter-btn");
    var items = document.querySelectorAll(".project-item");
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var filter = btn.getAttribute("data-filter");

        items.forEach(function (item) {
          var match = filter === "all" || item.getAttribute("data-category") === filter;
          item.classList.toggle("hidden-filter", !match);
        });
      });
    });
  }

  /* ---------- Contact form validation ---------- */
  function initContactForm() {
    var form = document.getElementById("contactForm");
    if (!form) return;
    var successEl = document.getElementById("formSuccess");
    var errorEl = document.getElementById("formError");

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      successEl.classList.add("d-none");
      errorEl.classList.add("d-none");

      var fields = form.querySelectorAll("input[required], textarea[required]");
      var allValid = true;

      fields.forEach(function (field) {
        var valid = field.value.trim().length > 0;
        if (field.id === "fEmail") valid = valid && isValidEmail(field.value.trim());

        field.classList.toggle("is-invalid", !valid);
        field.classList.toggle("is-valid", valid);
        if (!valid) allValid = false;
      });

      if (allValid) {
        successEl.classList.remove("d-none");
        form.reset();
        fields.forEach(function (field) { field.classList.remove("is-valid"); });
      } else {
        errorEl.classList.remove("d-none");
      }
    });

    // Live re-validation as the user types
    form.querySelectorAll("input, textarea").forEach(function (field) {
      field.addEventListener("input", function () {
        if (field.classList.contains("is-invalid") && field.value.trim().length > 0) {
          field.classList.remove("is-invalid");
        }
      });
    });
  }

  /* ---------- Back to top ---------- */
  function initBackToTop() {
    var btn = document.getElementById("backToTop");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("visible", window.scrollY > 500);
    }, { passive: true });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Dynamic copyright year ---------- */
  function initYear() {
    var el = document.getElementById("currentYear");
    if (el) el.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initNav();
    initScrollIndicator();
    initReveal();
    initTyping();
    initProjectFilter();
    initContactForm();
    initBackToTop();
    initYear();
  });
})();
                              
