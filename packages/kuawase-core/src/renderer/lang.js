// lang.js
(function () {
 let currentLang = localStorage.getItem("lang") || "ja";
 let translations = {};
 let langReady = Promise.resolve();

 async function loadLocale(lang) {
     langReady = (async () => {
       const res = await fetch(`locales/${lang}.json`);
       translations = await res.json();
       currentLang = lang;
       window.currentLang = lang;
       localStorage.setItem("lang", lang);
       applyTranslations();
       if (window.setupEventHandlers) window.setupEventHandlers();
        try {
          window.dispatchEvent(new CustomEvent("language:changed", { detail: { lang } }));
        } catch {}
       return lang;
     })();
     window.langReady = langReady;
     return langReady;
 }

 function t(key) {
     return translations[key] || key;
 }

 function applyTranslations() {
     document.querySelectorAll("[data-lang]").forEach(el => {
         const key = el.getAttribute("data-lang");
         el.textContent = t(key);
     });

     // placeholderの多言語対応
     document.querySelectorAll("[data-lang-placeholder]").forEach(el => {
         const key = el.getAttribute("data-lang-placeholder");
         el.placeholder = t(key);
     });
 }

 function getCurrentLang() {
    return (window.currentLang || localStorage.getItem("lang") || "ja");
}

 window.setLanguage = loadLocale;
 window.t = t;
 window.getCurrentLang = getCurrentLang;
 window.applyTranslations = applyTranslations;
 window.langReady = langReady;

document.addEventListener('DOMContentLoaded', () => {
  loadLocale(currentLang);
});
})();
