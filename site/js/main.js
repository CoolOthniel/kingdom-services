/* KINGDOM SERVICES — interactions, sans dépendance. */
(() => {
  "use strict";

  // Renseigner le numéro réel avant d'activer WhatsApp.
  const CONTACT = Object.freeze({
    whatsapp: "2250778068216",
    email: "contact@kingdomservices.com",
  });
  const WHATSAPP_READY = /^\d{8,15}$/.test(CONTACT.whatsapp)
    && CONTACT.whatsapp !== "2250000000000"
    && !/^\d{0,3}0{7,}$/.test(CONTACT.whatsapp);
  const WHATSAPP_NOTICE = "WhatsApp n’est pas encore disponible. Préparez votre demande ci-dessous puis choisissez l’e-mail pour ouvrir votre messagerie. Aucun message n’a été envoyé.";
  const QUOTE_KEY = "kingdom-devis";
  const MOTION_KEY = "kingdom-motion-paused";
  const QUOTE_MAX_AGE = 30 * 60 * 1000;

  // Les modes privés et les fichiers locaux peuvent interdire le stockage.
  function storage(kind, action, key, value) {
    try {
      const store = window[kind];
      if (action === "get") return store.getItem(key);
      if (action === "remove") store.removeItem(key);
      if (action === "set") store.setItem(key, value);
    } catch { /* Le site reste utilisable sans stockage. */ }
    return null;
  }

  function init() {
    const root = document.documentElement;
    const header = document.querySelector(".header");
    const form = document.querySelector("#devis-form");
    let status = document.querySelector("#form-status");
    if (form && !status) {
      status = document.createElement("p");
      status.id = "form-status";
      status.className = "form-status";
      form.append(status);
    }
    if (status) {
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
    }
    const announce = (message, type = "info") => {
      if (!status) return;
      status.textContent = message;
      status.dataset.state = type;
    };

    // Navigation mobile : boutons natifs, fermeture clavier et clic extérieur.
    const burger = document.querySelector(".burger");
    const nav = document.querySelector(".nav");
    const syncNavAccessibility = () => {
      if (!burger || !nav) return;
      // Les sous-menus ont leur propre visibility : inert protège aussi leurs liens.
      nav.inert = getComputedStyle(burger).display !== "none"
        && burger.getAttribute("aria-expanded") !== "true";
    };
    const closeMenu = (restoreFocus = false) => {
      if (!burger || !nav) return;
      nav.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Ouvrir le menu");
      syncNavAccessibility();
      if (restoreFocus) burger.focus();
    };
    if (burger && nav) {
      nav.id ||= "navigation-principale";
      burger.type = "button";
      burger.setAttribute("aria-controls", nav.id);
      closeMenu();
      burger.addEventListener("click", () => {
        const open = burger.getAttribute("aria-expanded") !== "true";
        nav.classList.toggle("is-open", open);
        burger.classList.toggle("is-open", open);
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
        syncNavAccessibility();
      });
      nav.addEventListener("click", (event) => {
        if (event.target.closest("a")) closeMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
          closeMenu(true);
        }
      });
      document.addEventListener("click", (event) => {
        if (!nav.contains(event.target) && !burger.contains(event.target)) closeMenu();
      });
      document.addEventListener("focusin", (event) => {
        if (!nav.contains(event.target) && !burger.contains(event.target)) closeMenu();
      });
    }

    // Une sélection est consommée une seule fois, uniquement à l'arrivée au devis.
    const quoteField = (name) => form?.elements.namedItem(name);
    const quoteText = (value) => typeof value === "string" ? value.trim().slice(0, 200) : "";
    const hasServiceSelection = () => (quoteField("pole")?.value === "Créative & Media"
      && quoteField("offre")?.value === "Media — À la carte")
      || (quoteField("pole")?.value === "Tech & Sécurité"
      && quoteField("offre")?.value === "Étude Tech & Sécurité");
    const syncServiceVisibility = () => {
      const wrapper = form?.querySelector("#prestation-field");
      if (wrapper) wrapper.hidden = !quoteText(quoteField("prestation")?.value);
    };
    const clearUnrelatedService = () => {
      const field = quoteField("prestation");
      if (field && !hasServiceSelection()) field.value = "";
      syncServiceVisibility();
    };
    ["pole", "offre"].forEach((name) => {
      quoteField(name)?.addEventListener("change", clearUnrelatedService);
    });
    document.querySelectorAll("[data-clear-service]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = quoteField("prestation");
        if (!field) return;
        field.value = "";
        syncServiceVisibility();
        quoteField("offre")?.focus();
        announce("Prestation retirée. Vous pouvez compléter votre demande.");
      });
    });
    syncServiceVisibility();
    function applyQuote(selection, notify = true) {
      if (!form || !selection) return;
      ["pole", "offre"].forEach((name) => {
        const field = quoteField(name);
        if (!field) return;
        let value = quoteText(selection[name]);
        if (name === "pole" && ["Creative & Media", "Media & Créative"].includes(value)) value = "Créative & Media";
        if (name === "offre") value = value.replace(/^Pack Media — /, "Pack Media ");
        field.value = field.options && !Array.from(field.options).some((option) => option.value === value)
          ? "" : value;
        field.removeAttribute("aria-invalid");
        if (field.dataset.trimError) {
          field.setCustomValidity("");
          delete field.dataset.trimError;
        }
        field.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const serviceField = quoteField("prestation");
      if (serviceField) {
        serviceField.value = hasServiceSelection() ? quoteText(selection.service) : "";
        serviceField.dispatchEvent(new Event("input", { bubbles: true }));
      }
      syncServiceVisibility();
      if (notify) {
        const selected = [quoteField("pole")?.value, quoteField("offre")?.value, serviceField?.value].filter(Boolean);
        announce(selected.length ? `Votre sélection : ${selected.join(" · ")}. Complétez votre demande.` : "Décrivez votre projet pour préparer votre demande de devis.");
      }
    }

    storage("sessionStorage", "remove", "devis"); // Ancien format sans expiration.
    if (form) {
      const saved = storage("sessionStorage", "get", QUOTE_KEY);
      storage("sessionStorage", "remove", QUOTE_KEY);
      if (saved && window.location.hash === "#devis") {
        try {
          const selection = JSON.parse(saved);
          const age = Date.now() - selection.createdAt;
          if (Number.isFinite(age) && age >= 0 && age <= QUOTE_MAX_AGE) applyQuote(selection);
        } catch { /* Une préférence invalide n'empêche pas le formulaire de fonctionner. */ }
      }
    }
    document.querySelectorAll("[data-devis]").forEach((link) => {
      link.addEventListener("click", () => {
        const [pole = "", offre = ""] = (link.dataset.devis || "").split("|");
        const selection = {
          pole: quoteText(pole),
          offre: quoteText(offre),
          service: quoteText(link.dataset.service),
          createdAt: Date.now(),
        };
        if (form) {
          storage("sessionStorage", "remove", QUOTE_KEY);
          applyQuote(selection);
        } else {
          storage("sessionStorage", "set", QUOTE_KEY, JSON.stringify(selection));
        }
      });
    });

    document.querySelectorAll("[data-whatsapp]").forEach((link) => {
      if (WHATSAPP_READY) {
        const message = link.dataset.whatsapp || "Bonjour KINGDOM SERVICES, je souhaite un renseignement.";
        link.href = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        return;
      }
      link.href = form ? "#devis" : "index.html?contact=whatsapp#devis";
      link.removeAttribute("target");
      link.title = "WhatsApp indisponible — préparer une demande par e-mail";
      link.setAttribute("aria-label", "WhatsApp indisponible : accéder au formulaire de devis");
      link.addEventListener("click", () => {
        // L'ancre conserve sa navigation native vers le formulaire.
        storage("sessionStorage", "remove", QUOTE_KEY);
        announce(WHATSAPP_NOTICE, "notice");
      });
    });
    document.querySelectorAll("[data-email]").forEach((link) => {
      link.href = `mailto:${CONTACT.email}`;
      if (!link.textContent.trim()) link.textContent = CONTACT.email;
    });
    document.querySelectorAll("[data-email-text]").forEach((element) => {
      element.textContent = CONTACT.email;
    });
    if (form && new URLSearchParams(window.location.search).get("contact") === "whatsapp" && !WHATSAPP_READY) {
      announce(WHATSAPP_NOTICE, "notice");
    }

    // Les ancres du catalogue révèlent leur contenu avant la navigation native.
    function openHashDetails(hash) {
      if (!hash || hash === "#") return;
      let target = null;
      try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
      for (let element = target; element; element = element.parentElement) {
        if (element.matches("details")) element.open = true;
      }
    }
    openHashDetails(window.location.hash);
    window.addEventListener("hashchange", () => openHashDetails(window.location.hash));
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest("a[href]");
      if (!link || link.target === "_blank") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) {
        openHashDetails(url.hash);
      }
    });

    // Aucune API d'envoi : l'utilisateur vérifie et envoie dans sa messagerie.
    if (form) {
      const controls = Array.from(form.elements).filter((field) => "checkValidity" in field);
      const clearTrimError = (field) => {
        if (field.dataset.trimError) {
          field.setCustomValidity("");
          delete field.dataset.trimError;
        }
        if (field.validity?.valid) field.removeAttribute("aria-invalid");
      };
      form.addEventListener("invalid", (event) => {
        event.target.setAttribute("aria-invalid", "true");
      }, true);
      form.addEventListener("input", (event) => clearTrimError(event.target));
      form.addEventListener("change", (event) => clearTrimError(event.target));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        controls.forEach((field) => {
          if (field.required && typeof field.value === "string" && !field.value.trim()) {
            field.setCustomValidity("Veuillez renseigner ce champ.");
            field.dataset.trimError = "true";
          }
        });
        if (!form.reportValidity()) {
          announce("Vérifiez les champs obligatoires et le format de votre adresse e-mail.", "error");
          return;
        }
        const via = event.submitter?.value === "whatsapp" ? "whatsapp" : "email";
        if (via === "whatsapp" && !WHATSAPP_READY) {
          announce(WHATSAPP_NOTICE, "notice");
          return;
        }
        const data = new FormData(form);
        const value = (name) => String(data.get(name) || "").trim();
        const message = [
          "Bonjour KINGDOM SERVICES, je souhaite un devis.",
          "",
          `Nom : ${value("nom")}`,
          `Téléphone : ${value("tel")}`,
          value("email") ? `E-mail : ${value("email")}` : null,
          `Pôle : ${value("pole")}`,
          value("offre") ? `Offre souhaitée : ${value("offre")}` : null,
          value("prestation") ? `Prestation : ${value("prestation")}` : null,
          value("lieu") ? `Lieu d’intervention : ${value("lieu")}` : null,
          "",
          `Besoin : ${value("message")}`,
        ].filter((line) => line !== null).join("\n");
        if (via === "email") {
          announce(`Votre messagerie va s’ouvrir avec le brouillon. Vérifiez-le puis envoyez-le. Si rien ne s’ouvre, écrivez à ${CONTACT.email}. Aucun e-mail n’est envoyé automatiquement.`, "info");
          window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Demande de devis — KINGDOM SERVICES")}&body=${encodeURIComponent(message)}`;
        } else {
          announce("WhatsApp va s’ouvrir avec votre demande. Vérifiez-la puis envoyez-la.", "info");
          window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
        }
      });
    }

    // Les effets restent une amélioration facultative : contenu visible par défaut.
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    let userPaused = storage("localStorage", "get", MOTION_KEY) === "true";
    let revealObserver = null;
    const reveals = Array.from(document.querySelectorAll(".reveal"));
    const tiltElements = Array.from(document.querySelectorAll("[data-tilt]"));
    const heroVisuals = Array.from(document.querySelectorAll(".hero-visual"));
    const motionButtons = Array.from(document.querySelectorAll("[data-motion-toggle]"));
    const motionPaused = () => userPaused || Boolean(reducedMotion?.matches);
    const effectsEnabled = () => !motionPaused() && !document.hidden && Boolean(finePointer?.matches);
    const showAll = () => {
      revealObserver?.disconnect();
      root.classList.remove("reveal-ready");
      reveals.forEach((element) => element.classList.add("is-visible"));
    };

    function setupReveals() {
      revealObserver?.disconnect();
      if (motionPaused() || !("IntersectionObserver" in window)) {
        showAll();
        return;
      }
      try {
        revealObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        }, { threshold: 0.08 });
        reveals.forEach((element) => {
          if (element.getBoundingClientRect().top < window.innerHeight) element.classList.add("is-visible");
          const siblings = Array.from(element.parentElement?.children || []).filter((item) => item.classList.contains("reveal"));
          element.style.setProperty("--i", String(Math.min(siblings.indexOf(element), 4)));
          if (!element.classList.contains("is-visible")) revealObserver.observe(element);
        });
        root.classList.add("reveal-ready");
      } catch {
        showAll();
      }
    }

    const pointerFrames = new Map();
    function resetPointerEffects() {
      pointerFrames.forEach((frame) => cancelAnimationFrame(frame));
      pointerFrames.clear();
      tiltElements.forEach((element) => {
        element.style.setProperty("--tilt-x", "0deg");
        element.style.setProperty("--tilt-y", "0deg");
      });
      heroVisuals.forEach((element) => {
        element.style.setProperty("--pointer-x", "0px");
        element.style.setProperty("--pointer-y", "0px");
      });
    }

    function syncMotion() {
      const paused = motionPaused();
      root.classList.toggle("motion-paused", paused);
      motionButtons.forEach((button) => {
        button.type = "button";
        button.setAttribute("aria-pressed", String(paused));
        const label = reducedMotion?.matches
          ? "Animations réduites selon vos préférences système"
          : paused ? "Activer les animations" : "Mettre les animations en pause";
        button.setAttribute("aria-label", label);
        button.title = label;
        button.disabled = Boolean(reducedMotion?.matches);
        const text = button.querySelector("[data-motion-label]");
        if (text) text.textContent = paused ? "Animations en pause" : "Animations activées";
        else if (!button.childElementCount) {
          button.textContent = reducedMotion?.matches ? "Animations réduites (système)"
            : paused ? "Réactiver les animations" : "Réduire les animations";
        }
      });
      if (paused) resetPointerEffects();
      setupReveals();
    }
    motionButtons.forEach((button) => button.addEventListener("click", () => {
      userPaused = !userPaused;
      storage("localStorage", "set", MOTION_KEY, String(userPaused));
      syncMotion();
    }));
    const listenMedia = (query, callback) => {
      if (query?.addEventListener) query.addEventListener("change", callback);
      else if (query?.addListener) query.addListener(callback);
    };
    listenMedia(reducedMotion, syncMotion);
    listenMedia(finePointer, resetPointerEffects);
    window.addEventListener("storage", (event) => {
      if (event.key === MOTION_KEY || event.key === null) {
        userPaused = storage("localStorage", "get", MOTION_KEY) === "true";
        syncMotion();
      }
    });
    document.addEventListener("visibilitychange", () => {
      root.classList.toggle("page-hidden", document.hidden);
      if (document.hidden) resetPointerEffects();
    });
    root.classList.toggle("page-hidden", document.hidden);
    syncMotion();

    function bindPointerEffect(element, tilt) {
      element.addEventListener("pointermove", (event) => {
        if (!effectsEnabled() || (event.pointerType && event.pointerType !== "mouse")) return;
        const { clientX, clientY } = event;
        if (pointerFrames.has(element)) cancelAnimationFrame(pointerFrames.get(element));
        pointerFrames.set(element, requestAnimationFrame(() => {
          pointerFrames.delete(element);
          if (!effectsEnabled()) return;
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const x = Math.max(-0.5, Math.min(0.5, (clientX - rect.left) / rect.width - 0.5));
          const y = Math.max(-0.5, Math.min(0.5, (clientY - rect.top) / rect.height - 0.5));
          element.style.setProperty(tilt ? "--tilt-x" : "--pointer-x", tilt ? `${(-y * 5).toFixed(2)}deg` : `${(x * 14).toFixed(2)}px`);
          element.style.setProperty(tilt ? "--tilt-y" : "--pointer-y", tilt ? `${(x * 5).toFixed(2)}deg` : `${(y * 14).toFixed(2)}px`);
        }));
      }, { passive: true });
      element.addEventListener("pointerleave", () => {
        if (pointerFrames.has(element)) cancelAnimationFrame(pointerFrames.get(element));
        pointerFrames.delete(element);
        element.style.setProperty(tilt ? "--tilt-x" : "--pointer-x", tilt ? "0deg" : "0px");
        element.style.setProperty(tilt ? "--tilt-y" : "--pointer-y", tilt ? "0deg" : "0px");
      });
    }
    tiltElements.forEach((element) => bindPointerEffect(element, true));
    heroVisuals.forEach((element) => bindPointerEffect(element, false));

    // Un seul rafraîchissement par frame pour progression et sous-navigation.
    const subItems = Array.from(document.querySelectorAll(".subnav a[href^='#']")).map((link) => {
      let target = null;
      try { target = document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch { /* Ancre invalide. */ }
      return { link, target };
    }).filter((item) => item.target);
    let scrollFrame = 0;
    function updateScroll() {
      scrollFrame = 0;
      header?.classList.toggle("is-scrolled", window.scrollY > 12);
      const available = root.scrollHeight - window.innerHeight;
      const progress = available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0;
      root.style.setProperty("--scroll-progress", String(progress));
      if (subItems.length) {
        let active = subItems[0];
        subItems.forEach((item) => {
          if (item.target.getBoundingClientRect().top <= window.innerHeight * 0.4) active = item;
        });
        subItems.forEach((item) => {
          const current = item === active;
          item.link.classList.toggle("is-active", current);
          if (current) item.link.setAttribute("aria-current", "location");
          else item.link.removeAttribute("aria-current");
        });
      }
    }
    const scheduleScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    };
    window.addEventListener("scroll", scheduleScroll, { passive: true });
    window.addEventListener("resize", () => {
      scheduleScroll();
      if (burger && getComputedStyle(burger).display === "none") closeMenu();
      else syncNavAccessibility();
    }, { passive: true });
    window.addEventListener("load", scheduleScroll, { once: true });
    window.addEventListener("pageshow", scheduleScroll);
    updateScroll();
    document.querySelectorAll("[data-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
