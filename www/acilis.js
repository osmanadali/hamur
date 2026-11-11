// Hamur — açılış: yalın yükleme ekranı. İlk kare sistem açılış ekranıyla aynıdır (düz #c59af1, ortada ikon); logo üstten düşer,
// kısa bir an sonra zemin solar ve ana ekran görünür. Oyuncudan bir şey istenmez; dokununca geçilmez.
(() => {
'use strict';
const kap = document.getElementById('acilis'), O = window.__hamur && window.__hamur.oyun;
const splashKapat = () => { try { window.Capacitor?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: 0 }); } catch {} };
if (!kap) return splashKapat();
let atla = false; try { atla = !!sessionStorage.getItem('hamurAcilisAtla'); sessionStorage.removeItem('hamurAcilisAtla'); } catch {}
if (!O || atla || window.__hamurEkran || window.__hamurAcilis === 0 || O.deneme) { kap.remove(); return splashKapat(); }
kap.dataset.canli = '1';
requestAnimationFrame(() => requestAnimationFrame(splashKapat));
kap.classList.add('logolu');   // logo düşer, altı hamur bir araya gelip kendi huyuna göre selam verir
const yazi = kap.querySelector('p'); if (yazi) {   // "Yükleniyor" ve sırayla beliren üç nokta (. .. ...)
  const m = L('Yükleniyor', 'Loading'); let n = 0; yazi.hidden = false;
  const ciz = () => { yazi.innerHTML = m + '<span>' + '.'.repeat(n) + '</span><span style="visibility:hidden">' + '.'.repeat(3 - n) + '</span>'; n = (n + 1) % 4; };
  ciz(); const z = setInterval(() => { if (!kap.isConnected) return clearInterval(z); ciz(); }, 380);
}
let bitti = false;
const bitir = () => { if (bitti) return; bitti = true; kap.classList.add('ac'); setTimeout(() => kap.remove(), 300); };
// Yükleme: mavi ve kırmızı hamuru iki yana çeker; hamurun uzaması yükleme çubuğudur (--y: 0 → 1)
const t0 = performance.now(), SURE = 2750;
(function ilerle(now) { if (!kap.isConnected) return; const y = Math.min(1, (now - t0) / SURE); kap.style.setProperty('--y', (y * y * (3 - 2 * y)).toFixed(4)); if (y < 1) requestAnimationFrame(ilerle); else setTimeout(bitir, 250); })(t0);   // dokununca geçilmez
})();
