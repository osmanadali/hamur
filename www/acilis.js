// Hamur — açılış animasyonu. Video yok: oyunun kendi parça çizimi ve karışım animasyonu kullanılır (game.js: App.oyun.sahne).
// İlk kare sistem açılış ekranıyla aynıdır (düz #c59af1 zemin, ortada ikon); animasyon o kareden devam eder.
// Olağan açılış (1,8 sn, dokununca geçilir): mavi ve sarı blok iki yandan gelir, değer, yeşil yayılır, hafif esner, un tozu çıkar;
//   sonra zemin solar, gökyüzü ve ana ekran görünür. Logo gelince blokların üstündeki boş yerde harf harf kabararak girecek.
// İlk açılış (hiç bölüm bitmemiş): animasyon kendiliğinden oynamaz. El maviyi gösterir, oyuncu sürükleyip sarıya değdirir,
//   karışım oynar ve doğrudan 1. bölüm başlar.
(() => {
'use strict';
const kap = document.getElementById('acilis'), App = window.__hamur, O = App && App.oyun, S = O && O.sahne;
const splashKapat = () => { try { window.Capacitor?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: 0 }); } catch {} };
if (!kap) return splashKapat();
let atla = false; try { atla = !!sessionStorage.getItem('hamurAcilisAtla'); sessionStorage.removeItem('hamurAcilisAtla'); } catch {}   // dil değişimi sayfayı yeniler: açılış yeniden oynamaz
if (!S || atla || window.__hamurEkran || window.__hamurAcilis === 0 || O.deneme) { kap.remove(); return splashKapat(); }
kap.dataset.canli = '1';
const ekranlar = [...document.querySelectorAll('.ekran')]; for (const e of ekranlar) e.inert = true;   // açılış sürerken alttaki düğmeler klavyeye kapalı
requestAnimationFrame(() => requestAnimationFrame(splashKapat));   // web'in ilk karesi çizildikten sonra sistem ekranı kalkar: sıçrama olmaz

const cv = kap.querySelector('canvas'), c = cv.getContext('2d'), ikon = kap.querySelector('img'), yazi = kap.querySelector('p');
const ilk = !(App.save.done || []).length, RM = S.RM, HUCRE = Math.max(40, Math.min(70, Math.floor((innerWidth / 2 - 8) / 2.5)));   // 70 px: birleşik iki kare, ikondaki figürle aynı genişlikte; dar ekranda küçülür
let W = 0, H = 0, dpr = 1, bitti = false, t0 = 0, son = 0, birlesti = 0, tutma = null, kendi = false;
const mavi = S.parca([[0, 0]], 'b'), sari = S.parca([[1, 0]], 'y'); let yesil = null;
mavi.ifade = 'sag'; sari.ifade = 'sol';
const uzak = () => W / 2 + HUCRE * 1.5, ARA = 1.5 * HUCRE;   // ilk açılışta mavi, sarıdan bu kadar uzakta bekler
const unlar = [];
function boyut() { dpr = Math.min(devicePixelRatio || 1, 3); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
boyut(); addEventListener('resize', boyut);

function birles(now) {
  birlesti = now; yesil = S.parca([[0, 0], [1, 0]], 'g'); yesil.ifade = 'mutlu'; S.karistir(yesil, ['b', 'y'], now);
  if (!RM) for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283, v = HUCRE * (.6 + Math.random()); unlar.push({ x: HUCRE, y: HUCRE * .5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - HUCRE * .3, l: 0, m: .6 + Math.random() * .3, k: i % 3, r: HUCRE * (.32 + Math.random() * .22), a }); }
  // tek kısa ses: yapışma, ardından küçük bir çınlama. Tarayıcı dokunuştan önce ses çalmaz (sonraya biriktirir): o durumda ses atlanır.
  const sesli = !!window.Capacitor?.isNativePlatform?.() || !!navigator.userActivation?.hasBeenActive;
  Ses.buzz([16, 40, 16]); if (sesli) Ses.fx(300, .16, 'sine', 150, .16); if (sesli) { Ses.fx(640, .09, 'triangle', 880, .05, .03); Ses.fx(1319, .22, 'triangle', 0, .06, .2); Ses.fx(1760, .3, 'triangle', 0, .05, .32); }
  yazi.hidden = true; kap.classList.add('logolu');   // logo yukarıdan düşer, bulutlar iki yana açılır
}
function bitir(hizli) {
  if (bitti) return; bitti = true;
  for (const e of ekranlar) e.inert = false;
  if (ilk && birlesti) App.ekran.oyna(1);   // ilk açılış: doğrudan 1. bölüm
  kap.style.transitionDuration = hizli || RM ? '.15s' : '.25s'; kap.classList.add('ac');   // zemin solar: gökyüzü açılır
  setTimeout(() => { kap.remove(); removeEventListener('resize', boyut); removeEventListener('keydown', tus); }, 300);
}
function kare(now) {
  if (bitti && !kap.isConnected) return;
  requestAnimationFrame(kare);
  try { ciz(now); } catch (e) { bitir(true); }   // çizim hatası uygulamayı kilitlemesin
}
function ciz(now) {
  if (!t0) { if (!S.hazir && now - son0 < 700) return; t0 = now; son = now; ikon.classList.add('git'); }
  const dt = Math.min(.05, (now - son) / 1000), t = now - t0; son = now;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); c.translate(W / 2 - HUCRE, H / 2 - HUCRE / 2);
  if (!birlesti) {
    if (ilk && !kendi) { if (!tutma) mavi.ox += (-ARA - mavi.ox) * Math.min(1, dt * 14); sari.ox = 0; }
    else {   // iki yandan gelir: hızlanarak yaklaşır, değer
      const u = RM ? 1 : Math.min(1, t / 520), e = u * u;
      if (kendi) mavi.ox += (0 - mavi.ox) * Math.min(1, dt * 12); else { mavi.ox = -uzak() * (1 - e); sari.ox = uzak() * (1 - e); }
      if (kendi ? mavi.ox > -HUCRE * .06 : u >= 1) birles(now);
    }
    if (ilk && mavi.ox > -HUCRE * .06) birles(now);
  }
  S.ciz(c, HUCRE, dpr, birlesti ? [yesil] : [mavi, sari], now, dt);
  const pim = S.parcacik();
  for (const q of unlar) {
    q.l += dt; q.x += q.vx * dt; q.y += q.vy * dt; const d = Math.exp(-dt * 4); q.vx *= d; q.vy *= d;
    const k = q.l / q.m; if (k >= 1 || !pim) continue;
    const r = q.r * (1 + 1.1 * k), hc = pim.height; c.globalAlpha = .6 * (1 - k) * Math.min(1, k * 8);
    c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.drawImage(pim, q.k * hc, 0, hc, hc, -r, -r, 2 * r, 2 * r); c.restore();
  }
  c.globalAlpha = 1;
  const el = S.el();
  if (ilk && !birlesti && !tutma && !kendi && el) {   // el maviyi gösterir ve sarıya doğru sürükler; işaret noktası parmak ucu
    const T = 2200, k = (now % T) / T, u = k < .15 ? 0 : k < .7 ? (k - .15) / .55 : 1, e = RM ? 0 : u * u * (3 - 2 * u), w = HUCRE * 1.7, bas = k > .08 && k < .8 ? .92 : 1;
    const x = -ARA + HUCRE * .5 + (ARA - HUCRE * .2) * e, y = HUCRE * .62;
    c.globalAlpha = RM ? 1 : Math.min(1, k * 12, (1 - k) * 7); c.drawImage(el, x - w * .23 * bas, y - w * .18 * bas, w * bas, w * bas * el.height / el.width); c.globalAlpha = 1;
  }
  if (birlesti && now - birlesti > S.MIXMS + (ilk ? 250 : RM ? 250 : 0) && (ilk || t >= 1550 || RM)) bitir();
}
const son0 = performance.now();

// Girdi. Olağan açılışta dokunmak geçer. İlk açılışta mavi blok parmakla sarıya sürüklenir (klavye: Enter ya da boşluk kendisi götürür).
const yer = e => [e.clientX - (W / 2 - HUCRE), e.clientY - (H / 2 - HUCRE / 2)];
kap.addEventListener('pointerdown', e => {
  if (!ilk) return bitir(true);
  if (birlesti || kendi) return;
  const [x, y] = yer(e);
  if (Math.abs(x - (mavi.ox + HUCRE / 2)) < HUCRE * 1.3 && Math.abs(y - HUCRE / 2) < HUCRE * 1.3) { tutma = { id: e.pointerId, x0: x - mavi.ox }; mavi.lift = 1; try { kap.setPointerCapture(e.pointerId); } catch {} Ses.fx(520, .07, 'sine', 700, .05); Ses.buzz(6); }
});
kap.addEventListener('pointermove', e => { if (tutma && tutma.id === e.pointerId && !birlesti) mavi.ox = Math.max(-ARA, Math.min(0, yer(e)[0] - tutma.x0)); });
const birak = e => { if (tutma && tutma.id === e.pointerId) { tutma = null; mavi.lift = 0; } };
kap.addEventListener('pointerup', birak); kap.addEventListener('pointercancel', birak);
function tus(e) { if (bitti) return; if (!ilk) return bitir(true); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!birlesti) kendi = true; } }
addEventListener('keydown', tus);
if (ilk) { yazi.textContent = L('Maviyi sarıya sürükle', 'Drag blue onto yellow'); yazi.hidden = false; mavi.ox = -ARA; }
else { mavi.ox = -uzak(); sari.ox = uzak(); }
requestAnimationFrame(kare);
})();
