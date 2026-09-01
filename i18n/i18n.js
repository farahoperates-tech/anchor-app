/* ============ Anchor — i18n helper ============
   Plain dictionary lookup, no libraries. Dictionaries live in
   i18n/en.js and i18n/de.js (loaded before this file).

   t("setup.person.name")            → string for the current language
   t("panic.callName", {name: "X"})  → "{name}" placeholders filled in
   t("panic.phrases")                → arrays/objects come back as-is
   A key missing in the current language falls back to English and logs
   one console warning per key. */
"use strict";

const AnchorI18n = (() => {
  const DICTS = window.ANCHOR_I18N || {};
  const FALLBACK = "en";
  const warned = new Set();
  const listeners = [];
  let lang = FALLBACK;

  function lookup(dict, key) {
    return key.split(".").reduce((o, k) => (o != null && o[k] !== undefined ? o[k] : undefined), dict);
  }

  function t(key, vars) {
    let v = lookup(DICTS[lang], key);
    if (v === undefined) {
      const tag = `${lang}:${key}`;
      if (!warned.has(tag)) {
        warned.add(tag);
        console.warn(`[Anchor i18n] missing "${key}" in "${lang}" — falling back to ${FALLBACK}`);
      }
      v = lookup(DICTS[FALLBACK], key);
      if (v === undefined) {
        console.warn(`[Anchor i18n] "${key}" missing in ${FALLBACK} too`);
        return key;
      }
    }
    if (typeof v === "string" && vars) {
      v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    }
    return v;
  }

  /* de* → German, everything else → English */
  function detect() {
    const l = String(navigator.language || (navigator.languages && navigator.languages[0]) || "").toLowerCase();
    return l.startsWith("de") ? "de" : "en";
  }

  function available() { return Object.keys(DICTS); }
  function current() { return lang; }

  /* fill text into a node, honouring "\n" as line breaks when asked */
  function setText(el, value, withBreaks) {
    el.textContent = "";
    if (!withBreaks) { el.textContent = value; return; }
    String(value).split("\n").forEach((line, i) => {
      if (i) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(line));
    });
  }

  /* every element carrying data-i18n / data-i18n-ph / data-i18n-aria,
     plus the document-level bits (title, description, manifest link) */
  function applyStatic(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      setText(el, t(el.dataset.i18n), el.hasAttribute("data-i18n-br"));
    });
    scope.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    if (!root) {
      document.title = t("meta.title");
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", t("meta.description"));
      const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appTitle) appTitle.setAttribute("content", t("meta.title"));
      // NOTE: the manifest is read by the browser at install time only —
      // a language change takes effect on the home-screen name/description
      // only after removing and re-adding the app.
      const manifest = document.querySelector('link[rel="manifest"]');
      if (manifest) manifest.setAttribute("href", t("meta.manifest"));
    }
  }

  function setLanguage(next) {
    lang = DICTS[next] ? next : FALLBACK;
    document.documentElement.lang = lang;
    applyStatic();
    listeners.forEach((fn) => { try { fn(lang); } catch (err) { console.warn(err); } });
    return lang;
  }

  function onChange(fn) { listeners.push(fn); }

  return { t, detect, available, current, setLanguage, applyStatic, onChange, setText };
})();

const t = AnchorI18n.t;
