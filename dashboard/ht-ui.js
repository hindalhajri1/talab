(function () {
    const THEME_KEY = "ht_theme"; // "light" | "dark"
    const LANG_KEY  = "ht_lang";  // "ar" | "en"
  
    const root = document.documentElement;
  
    function setTheme(theme) {
      const t = (theme === "dark") ? "dark" : "light";
      root.setAttribute("data-theme", t);
      localStorage.setItem(THEME_KEY, t);
  
      // sync checkbox (لو موجود)
      const themeInput = document.querySelector('[data-toggle-theme]');
      if (themeInput && themeInput.type === "checkbox") {
        themeInput.checked = (t === "dark");
      }
    }
  
    function setLang(lang) {
      const l = (lang === "en") ? "en" : "ar";
      root.lang = l;
      root.dir  = (l === "ar") ? "rtl" : "ltr";
      localStorage.setItem(LANG_KEY, l);
  
      // sync checkbox (لو موجود)
      const langInput = document.querySelector('[data-toggle-lang]');
      if (langInput && langInput.type === "checkbox") {
        // checked = EN (عشان يصير السحب لليسار عادة)
        langInput.checked = (l === "en");
      }
  
      // hook i18n إذا عندك
      if (window.HT_I18N && typeof window.HT_I18N.render === "function") {
        window.HT_I18N.render(l);
      }
    }
  
    function boot() {
      // load saved
      const savedTheme = localStorage.getItem(THEME_KEY) || "light";
      const savedLang  = localStorage.getItem(LANG_KEY)  || "ar";
      setTheme(savedTheme);
      setLang(savedLang);
  
      // theme toggle (checkbox)
      const themeInput = document.querySelector('[data-toggle-theme]');
      if (themeInput) {
        if (themeInput.type === "checkbox") {
          themeInput.addEventListener("change", () => {
            setTheme(themeInput.checked ? "dark" : "light");
          });
        } else {
          themeInput.addEventListener("click", () => {
            const next = (root.getAttribute("data-theme") === "dark") ? "light" : "dark";
            setTheme(next);
          });
        }
      }
  
      // lang toggle (checkbox)
      const langInput = document.querySelector('[data-toggle-lang]');
      if (langInput) {
        if (langInput.type === "checkbox") {
          langInput.addEventListener("change", () => {
            setLang(langInput.checked ? "en" : "ar");
          });
        } else {
          langInput.addEventListener("click", () => {
            const next = (root.lang === "en") ? "ar" : "en";
            setLang(next);
          });
        }
      }
    }
  
    document.addEventListener("DOMContentLoaded", boot);
  })();
  