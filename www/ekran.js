// Hamur — ekranlar: ana ekran, bölüm yolu, tepsi koleksiyonu, ayarlar. Oyun ekranı game.js'te.
// Görsellerde yazı yoktur; bütün metin ve sayılar buradan gelir. Görsel kaynakları docs/gorseller altındadır.
(() => {
'use strict';
const App = window.__hamur, O = App.oyun, save = App.save, $ = id => document.getElementById(id);
const N = O.ASIL, EKRAN = { ana: 'sAna', yol: 'sYol', tepsi: 'sTepsi', oyun: 'sOyun' };
let acik = '';

// Sıradaki bölüm: bitirilmemiş ilk bölüm. Açık bölümler: sıradakine kadar (ayarlardan "bütün bölümler açık" test seçeneği).
const bitti = n => (save.done || []).includes(n);
const siradaki = () => { for (let n = 1; n <= N; n++) if (!bitti(n)) return n; return N; };
const acikMi = n => save.hepsiAcik || n <= siradaki();

function goster(ad) {
  acik = ad;
  for (const [k, id] of Object.entries(EKRAN)) $(id).hidden = k !== ad;
  if (ad === 'ana') ana();
  if (ad === 'yol') yol();
  if (ad === 'tepsi') tepsi();
  window.Olcum?.event('screen_view', { screen_name: ad });
}
function oyna(n) { goster('oyun'); O.setup(Math.max(1, Math.min(N, n)) - 1); }

/* ---------- ana ekran ---------- */
function ana() {
  const n = siradaki(), hepsi = (save.done || []).length >= N;
  $('oynaNo').textContent = hepsi ? L('Hepsi tamam', 'All done') : L('Bölüm ', 'Level ') + n;
}

/* ---------- bölüm yolu ---------- */
// Bir karoda 11 kurabiye var (alttan üste yol sırası). Konumlar karonun eni ve boyuna göre oran (bolum-yolu-tekrar görselinden ölçüldü).
const DURAK = [[.4874, .8856], [.5009, .7703], [.335, .691], [.569, .643], [.5759, .5328], [.3443, .4906], [.4033, .3848], [.6404, .358], [.5544, .267], [.3539, .1776], [.4983, .0873]];
function yol() {
  const el = $('yol'), sira = siradaki(); el.innerHTML = '';
  const karoSay = Math.ceil(N / DURAK.length);
  let hedef = null;
  for (let k = 0; k < karoSay; k++) {
    const karo = document.createElement('div'); karo.className = 'karo';
    DURAK.forEach(([x, y], i) => {
      const n = k * DURAK.length + i + 1;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'durak'; b.style.left = x * 100 + '%'; b.style.top = y * 100 + '%';
      if (n > N) { b.classList.add('kilitli', 'yok'); b.disabled = true; b.setAttribute('aria-label', L('Yakında', 'Coming soon')); karo.appendChild(b); return; }
      const durum = bitti(n) ? 'tamam' : n === sira ? 'siradaki' : acikMi(n) ? 'bos' : 'kilitli';
      b.classList.add(durum); b.dataset.no = n;
      b.setAttribute('aria-label', L('Bölüm ', 'Level ') + n + (durum === 'tamam' ? L(', tamamlandı', ', completed') : durum === 'kilitli' ? L(', kilitli', ', locked') : ''));
      if (durum === 'kilitli') b.disabled = true; else { const s = document.createElement('span'); s.textContent = n; b.appendChild(s); b.onclick = () => oyna(n); }
      if (n % 10 === 0) b.classList.add('figurlu');   // her 10. bölüm bir figürü tamamlar
      if (n === sira) hedef = b;
      karo.appendChild(b);
    });
    el.appendChild(karo);
  }
  // sıradaki bölüm ekranın ortasına gelsin
  requestAnimationFrame(() => { if (hedef) { const r = hedef.getBoundingClientRect(), e = el.getBoundingClientRect(); el.scrollTop += r.top - e.top - e.height / 2 + r.height / 2; } else el.scrollTop = el.scrollHeight; });
}

/* ---------- tepsi koleksiyonu ---------- */
// Her 10 bölümde bir figür tamamlanır. Boş siluet görselin kendi alfa kanalından gelir (CSS: karartılmış, soluk).
const FIGUR = [['Kedi', 'Cat'], ['Ev', 'House'], ['Çiçek', 'Flower'], ['Balık', 'Fish'], ['Kalp', 'Heart'], ['Roket', 'Rocket']];
const figurDurum = k => { let v = 0; for (let n = k * 10 + 1; n <= k * 10 + 10; n++) if (bitti(n)) v++; return v; };
function tepsi() {
  const el = $('figurler'); el.innerHTML = '';
  FIGUR.forEach((ad, k) => {
    const v = figurDurum(k), kart = document.createElement('div'); kart.className = 'figur' + (v >= 10 ? ' tamam' : '');
    const im = document.createElement('img'); im.src = `img/figur-${k + 1}.webp`; im.alt = ''; im.width = im.height = 256;
    // tamamlanmamış figür: alttan yukarı doğru, biten bölüm sayısı kadar dolar
    if (v < 10) { const dolu = document.createElement('img'); dolu.src = im.src; dolu.alt = ''; dolu.className = 'dolu'; dolu.style.clipPath = `inset(${100 - v * 10}% 0 0 0)`; im.className = 'siluet'; kart.append(im, dolu); } else kart.append(im);
    const b = document.createElement('b'); b.textContent = L(...ad);
    const s = document.createElement('small'); s.textContent = v >= 10 ? L('Tamamlandı', 'Completed') : `${v} / 10`;
    kart.append(b, s); kart.setAttribute('role', 'img'); kart.setAttribute('aria-label', `${L(...ad)}: ${s.textContent}`);
    el.appendChild(kart);
  });
}

/* ---------- ayarlar ---------- */
const SECENEK = [
  ['sound', 'Efekt sesleri', 'Sound effects'], ['vib', 'Titreşim', 'Vibration'],
  ['damga', 'Renk damgaları (renk körlüğü)', 'Color stamps (color blindness)'],
  ['hepsiAcik', 'Bütün bölümler açık (test)', 'All levels open (test)'],
];
function ayar() {
  const el = $('secenekler'); el.innerHTML = '';
  for (const [k, tr, en] of SECENEK) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'secenek'; b.setAttribute('role', 'switch'); b.id = 'sec-' + k;
    const ciz = () => { b.setAttribute('aria-checked', String(!!save[k])); };
    b.append(Object.assign(document.createElement('span'), { textContent: L(tr, en) }), Object.assign(document.createElement('i'), { className: 'anahtar' }));
    b.onclick = () => { save[k] = !save[k]; App.persist(); ciz(); O.ayarDegisti?.(); if (acik === 'yol') yol(); Ses.buzz(8); };
    ciz(); el.appendChild(b);
  }
  // dil: değişince sayfa yenilenir (metinler yüklemede seçilir)
  const d = document.createElement('div'); d.className = 'secenek dil'; d.append(Object.assign(document.createElement('span'), { textContent: L('Dil', 'Language') }));
  const sel = document.createElement('select'); sel.id = 'sec-dil'; sel.setAttribute('aria-label', L('Dil', 'Language'));
  for (const [k, ad] of window.HAMUR_LANGS.filter(x => x[0] === 'tr' || x[0] === 'en')) sel.add(new Option(ad, k, false, k === window.HAMUR_LANG));
  sel.onchange = () => { save.lang = sel.value; App.persist(); location.reload(); };
  d.append(sel); el.appendChild(d);
  $('ayar').hidden = false;
}

/* ---------- bağlantılar ---------- */
$('bOyna').onclick = () => oyna(siradaki());
$('bYol').onclick = () => goster('yol'); $('bTepsi').onclick = () => goster('tepsi');
$('yolGeri').onclick = $('tepsiGeri').onclick = () => goster('ana');
$('bCik').onclick = () => goster('yol');
$('bAyar').onclick = ayar; $('ayarKapat').onclick = () => { $('ayar').hidden = true; };
$('ayar').addEventListener('click', e => { if (e.target === $('ayar')) $('ayar').hidden = true; });
// Android geri tuşu: oyun → bölüm yolu → ana ekran
window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => { if (!$('ayar').hidden) $('ayar').hidden = true; else if (acik === 'oyun') goster('yol'); else if (acik !== 'ana') goster('ana'); else window.Capacitor.Plugins.App.exitApp?.(); });

// Oyun bir figürü tamamlayan bölümü bildirir (kutlama yazısı için)
O.figurAdi = n => n % 10 === 0 && figurDurum(n / 10 - 1) >= 10 ? { ad: L(...FIGUR[n / 10 - 1]), resim: `img/figur-${n / 10}.webp` } : null;

// Açılış: ana ekran. Editörden gelen deneme bölümü (#bolum=) ve test robotu (window.__hamurEkran) doğrudan oyunu açar.
goster(window.__hamurEkran || (O.deneme ? 'oyun' : 'ana'));
App.ekran = { goster, oyna, siradaki, acikMi, get acik() { return acik; }, ayar };
})();
