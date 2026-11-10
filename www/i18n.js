// Dil seçimi: tr · en · de · es · pt-BR · fr. Kayıtta save.lang varsa o, yoksa cihaz dili (tr/de/es/pt/fr… → o dil, öteki → İngilizce).
// Metinler yüklemede bir kez seçilir: dil değişince sayfa yenilenir. Bütün betiklerden önce yüklenir.
// Kullanım: L('Türkçe', 'English') · durağan HTML: data-en="…" (yazı), data-en-label="…" (aria-label), data-en-title="…" (title).
// Öteki diller: anahtar İngilizce metindir. Seçili dilin sözlüğü (lang/<dil>.js, tools/diller.cjs üretir) burada eşzamanlı yüklenir;
// L() önce tam eşleşmeye, sonra {0} yer tutuculu kalıplara bakar (ör. "{0} moves left" → "Noch {0} Züge"); bulamazsa İngilizce kalır.
// Ayrıntı: docs/CEVIRI.md
(() => {
  const LOCALE = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', es: 'es-ES', 'pt-BR': 'pt-BR', fr: 'fr-FR' };
  let s = {};
  try { s = JSON.parse(localStorage.getItem('hamur') || '{}') || {}; } catch {}
  const devRaw = String((navigator.languages && navigator.languages[0]) || navigator.language || 'tr'), dev = devRaw.toLowerCase();
  const fromDev = dev.startsWith('tr') ? 'tr' : dev.startsWith('de') ? 'de' : dev.startsWith('es') ? 'es' : dev.startsWith('pt') ? 'pt-BR' : dev.startsWith('fr') ? 'fr' : 'en';
  const lang = LOCALE[s.lang] ? s.lang : fromDev;
  window.HAMUR_LANG = lang;
  window.HAMUR_LANGS = [['tr', 'Türkçe'], ['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'], ['pt-BR', 'Português'], ['fr', 'Français']];
  // tarih ve sayı biçimi: cihaz aynı dildeyse onun bölgesi (es-MX, fr-CA…), değilse dilin varsayılanı; Portekizce hep Brezilya
  window.HAMUR_LOCALE = lang !== 'pt-BR' && dev.split('-')[0] === lang.split('-')[0] && /^[a-z]{2}-[a-z]{2}$/.test(dev) ? devRaw : LOCALE[lang];
  document.documentElement.lang = lang;
  const pctF = new Intl.NumberFormat(window.HAMUR_LOCALE, { style: 'percent', maximumFractionDigits: 0 });
  window.LP = n => pctF.format(n / 100);   // yüzde: %30 · 30% · 30 %
  if (lang === 'tr' || lang === 'en') {
    window.L = (tr, en) => lang === 'en' ? en : tr;
  } else {
    document.write(`<script src="lang/${lang}.js"><\/script>`);   // ayrıştırıcıyı bekletir: sonraki betikler sözlükle başlar
    const norm = x => x.replace(/\s+/g, ' '), ANY = /\p{L}/u, miss = window.__L_MISS = new Set(), memo = new Map();
    let D = null, P = null;
    const init = () => {
      D = new Map(); P = [];
      const src = window.HAMUR_DICT || {};
      for (const k in src) {
        const n = norm(k);
        if (!/\{\d+\}/.test(n)) { D.set(n, src[k]); continue; }
        const idx = [], re = n.split(/\{(\d+)\}/).map((p, i) => i % 2 ? (idx.push(+p), '([\\s\\S]*?)') : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
        P.push({ re: new RegExp('^' + re + '$'), idx, out: src[k], w: n.replace(/\{\d+\}/g, '').length });
      }
      P.sort((a, b) => b.w - a.w);   // en uzun sabit metinli kalıp önce
    };
    const T = (x, quiet) => {
      if (Array.isArray(x)) return x.map(v => T(v, quiet));
      if (typeof x !== 'string' || x.trim().length < 2 || !ANY.test(x)) return x;   // tek harf: birim (s, h) ya da kimlik
      if (!D) init();
      const n = norm(x), hit = D.get(n);
      if (hit != null) return hit;
      if (memo.has(n)) return memo.get(n);
      let out = null;
      for (const p of P) {
        const m = p.re.exec(n); if (!m) continue;
        const cap = {}; p.idx.forEach((k, i) => { cap[k] = m[i + 1]; });
        // yakalanan parça İngilizce kalmışsa (ör. pl() ile "moves") o da çevrilir; zaten çevrilmiş parça sözlükte olmadığından aynen kalır
        out = p.out.replace(/\{(\d+)\}/g, (_, k) => T(cap[k] ?? '', true));
        break;
      }
      if (out == null) { if (!quiet) miss.add(n.slice(0, 160)); out = x; }
      if (memo.size < 4000) memo.set(n, out);
      return out;
    };
    window.L = (tr, en) => T(en);
    window.LT = T;
  }
  if (lang === 'tr') return;
  const tx = window.LT || (x => x);
  const apply = () => {
    for (const el of document.querySelectorAll('[data-en]')) el.textContent = tx(el.dataset.en);
    for (const el of document.querySelectorAll('[data-en-label]')) el.setAttribute('aria-label', tx(el.dataset.enLabel));
    for (const el of document.querySelectorAll('[data-en-title]')) el.title = tx(el.dataset.enTitle);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true }); else apply();
})();
