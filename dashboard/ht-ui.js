(() => {
    const THEME_KEY = "ht_theme";
    const LANG_KEY  = "ht_lang";
  
    const root = document.documentElement;
  
    function getSavedTheme() {
      // default light
      return (localStorage.getItem(THEME_KEY) === "dark") ? "dark" : "light";
    }
  
    function applyTheme(theme) {
      const t = (theme === "dark") ? "dark" : "light";
      root.setAttribute("data-theme", t);
      localStorage.setItem(THEME_KEY, t);
  
      // sync checkbox إن وجد
      const themeInput = document.querySelector('[data-toggle-theme]');
      if (themeInput && themeInput.type === "checkbox") {
        themeInput.checked = (t === "dark");
      }
    }
  
    function getSavedLang() {
      return (localStorage.getItem(LANG_KEY) === "en") ? "en" : "ar";
    }
  
    function applyLang(lang) {
      const l = (lang === "en") ? "en" : "ar";
      root.lang = l;
      root.dir  = (l === "ar") ? "rtl" : "ltr";
      localStorage.setItem(LANG_KEY, l);
  
      // لو عندك i18n لاحقًا
      if (window.HT_I18N && typeof window.HT_I18N.render === "function") {
        window.HT_I18N.render(l);
      }
    }
  
    function toggleLang() {
      const current = getSavedLang();
      applyLang(current === "ar" ? "en" : "ar");
    }
  
    function boot() {
      // init theme + lang
      applyTheme(getSavedTheme());
      applyLang(getSavedLang());
  
      // theme toggles (checkbox أو زر)
      document.querySelectorAll("[data-toggle-theme]").forEach(el => {
        if (el.type === "checkbox") {
          el.addEventListener("change", () => {
            applyTheme(el.checked ? "dark" : "light");
          });
        } else {
          el.addEventListener("click", () => {
            const next = (getSavedTheme() === "dark") ? "light" : "dark";
            applyTheme(next);
          });
        }
      });
  
      // lang toggle (اختياري)
      document.querySelectorAll("[data-toggle-lang]").forEach(el => {
        el.addEventListener("click", toggleLang);
      });
    }
  
    document.addEventListener("DOMContentLoaded", boot);
  })();
  