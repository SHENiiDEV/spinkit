/*
 * SpinKit game i18n — tiny dictionary loader shared by the SpinKit Exclusive clients.
 *
 *   await I18N.init('apple_shooter', session.lang)   // loads /games/<game>/lang/<code>.json (+ en fallback)
 *   I18N.t('hud.level')                              // "LEVEL"
 *   I18N.t('pop.cashed', { win: '$4.10' })           // "{win}" placeholders
 *   I18N.apply(root)                                 // fills [data-i18n], [data-i18n-html], [data-i18n-title], [data-i18n-ph], [data-i18n-aria]
 *
 * Language: ?lang= in the URL → operator / session language → the player's last choice → browser → English.
 */
(function () {
  const LANGS = {
    en: 'English', ru: 'Русский', lv: 'Latviešu', lt: 'Lietuvių', et: 'Eesti', uk: 'Українська', de: 'Deutsch',
    es: 'Español', pt: 'Português', fr: 'Français', it: 'Italiano', tr: 'Türkçe', pl: 'Polski'
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };
  const norm = (l) => (l ? String(l).toLowerCase().slice(0, 2) : null);
  const ok = (l) => (l && LANGS[l] ? l : null);

  const I18N = {
    LANGS,
    lang: 'en',
    game: null,
    dict: {},
    base: {},

    pick(sessionLang) {
      const url = ok(norm(new URLSearchParams(location.search).get('lang')));
      const chosen = ok(norm(store.get('spinkit_lang')));
      const browser = (navigator.languages || [navigator.language]).map(norm).find(ok);
      // a player's own choice wins over the operator default, but not over an explicit ?lang=
      return url || chosen || ok(norm(sessionLang)) || browser || 'en';
    },

    async load(lang) {
      const get = async (l) => {
        const res = await fetch(`/games/${this.game}/lang/${l}.json`, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`no ${l}`);
        return res.json();
      };
      if (!Object.keys(this.base).length) this.base = await get('en').catch(() => ({}));
      this.dict = lang === 'en' ? this.base : await get(lang).catch(() => this.base);
      this.lang = this.dict === this.base ? 'en' : lang; // a missing dictionary falls back to English
      document.documentElement.lang = this.lang;
    },

    async init(game, sessionLang) {
      this.game = game;
      await this.load(this.pick(sessionLang));
      return this.lang;
    },

    /** Switches language at runtime (remembered for this player in this browser). */
    async set(lang) {
      if (!LANGS[lang]) return this.lang;
      store.set('spinkit_lang', lang);
      await this.load(lang);
      return this.lang;
    },

    has(key) { return this.dict[key] != null || this.base[key] != null; },

    t(key, vars) {
      let s = this.dict[key];
      if (s == null) s = this.base[key];
      if (s == null) return key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
      return s;
    },

    /**
     * Plural form: looks up `${key}.${category}` (Intl.PluralRules: zero / one / two / few / many / other),
     * falling back to `${key}.other`. {n} is filled in.
     */
    p(key, n, vars = {}) {
      let cat = 'other';
      try { cat = new Intl.PluralRules(this.locale).select(n); } catch { /* old browser */ }
      const k = this.dict[`${key}.${cat}`] != null || (this.lang === 'en' && this.base[`${key}.${cat}`] != null) ? `${key}.${cat}` : `${key}.other`;
      return this.t(k, { n, ...vars });
    },

    /** Locale for Intl number / currency formatting. */
    get locale() {
      return { en: 'en-US', pt: 'pt-PT', uk: 'uk-UA' }[this.lang] || this.lang;
    },

    apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = this.t(el.dataset.i18n); });
      root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = this.t(el.dataset.i18nHtml); });
      root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = this.t(el.dataset.i18nTitle); });
      root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = this.t(el.dataset.i18nPh); });
      root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', this.t(el.dataset.i18nAria)); });
    },

    /** <select> with every language, wired to onChange(lang). */
    select(el, onChange) {
      el.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === this.lang ? 'selected' : ''}>${v}</option>`).join('');
      el.onchange = async () => { await this.set(el.value); onChange(this.lang); };
    }
  };

  window.I18N = I18N;
})();
