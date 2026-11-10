// Hamur — açılış: yalın yükleme ekranı. İlk kare sistem açılış ekranıyla aynıdır (düz #c59af1, ortada ikon); logo üstten düşer,
// kısa bir an sonra zemin solar ve ana ekran görünür. Oyuncudan bir şey istenmez; dokununca hemen geçilir.
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
const yazi = kap.querySelector('p'); if (yazi) { yazi.textContent = L('Hoş geldin!', 'Welcome!'); yazi.hidden = false; }
let bitti = false;
const bitir = () => { if (bitti) return; bitti = true; kap.classList.add('ac'); setTimeout(() => kap.remove(), 300); };
setTimeout(bitir, 2300); kap.addEventListener('pointerdown', bitir);
})();
