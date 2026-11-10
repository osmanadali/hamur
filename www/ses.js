// Ses, müzik ve titreşim (Ray'in game.js'indeki ses bölümünden ayrı modül olarak alındı).
// Kısa efektler ve ambiyans cihazda Web Audio ile üretilir (dosya yok, internetsiz). Dokulu efektler (yapışma, sünme, kalıba oturma)
// 4. aşamada ElevenLabs dosyaları olarak eklenir; ses kapalıyken aynı bilgiyi titreşim taşır (yol haritası › Ses ve titreşim).
// Ayarlar oyundan okunur: Ses.init(() => ({ sound, music, vib })). Müzik şimdilik Ray'in bestesidir, görsel kimlikle birlikte Hamur'a göre yeniden yazılır.
window.Ses = (() => {
  let A = () => ({ sound: true, music: true, vib: true });
  let ac;
  function ensureAC() { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
  // yumuşak çan tınısı: sinüs + hafif üst oktav, üstel sönüm (sert tık yok)
  function tone(f, dur = .08, vol = .05, type = 'sine', at = 0) {
    if (!A().sound) return;
    try {
      ensureAC();
      const t = ac.currentTime + at, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
      o.type = type; o.frequency.value = f; o2.frequency.value = f * 2; g2.gain.value = .18;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t + Math.max(dur, .06) * 1.6);
      o.connect(g); o2.connect(g2).connect(g); g.connect(ac.destination);
      const end = t + Math.max(dur, .06) * 1.6 + .02;
      o.start(t); o2.start(t); o.stop(end); o2.stop(end);
    } catch {}
  }
  // ---------- arka plan müziği: cihazda üretilen sakin ambiyans (dosya yok, internetsiz) ----------
  const Music = (() => {
    // MENÜ: Re majör müzik kutusu (D – Bm – G – A), sakin.
    const MENU = [[50, 62, 66, 69, 74], [47, 59, 62, 66, 71], [43, 55, 59, 62, 67], [45, 57, 61, 64, 69]];
    const MPAT = [[1, 2, 3, 4, 3, 2, 3, 2], [1, 3, 2, 4, 2, 3, 1, 3]];
    // OYUN: Re minör (Dm – B♭ – F – C). Gerilim (0–1) arttıkça tempo hızlanır, katmanlar eklenir.
    const GAME = [[50, 62, 65, 69, 74], [46, 58, 62, 65, 70], [41, 57, 60, 65, 69], [48, 60, 64, 67, 72]];
    const ALARM = [[50, 62, 65, 69, 74], [45, 61, 64, 67, 73]];   // son saniyeler: Dm ↔ A7
    const GPAT = [1, 2, 3, 2, 4, 2, 3, 2];
    const VOL = .55, hz = m => 440 * Math.pow(2, (m - 69) / 12);
    let on = false, mode = 'menu', tension = 0, alarm = false, barT = 0, barAlarm = false, master, lp, noise, timer = 0, next = 0, step = 0;
    function setup() {
      master = ac.createGain(); master.gain.value = 0;
      lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      master.connect(lp).connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate * .06, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function bell(m, t, v, len) {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
      o.frequency.value = hz(m); o2.frequency.value = hz(m) * 2; g2.gain.value = .22;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .015); g.gain.exponentialRampToValueAtTime(.0005, t + len);
      o.connect(g); o2.connect(g2).connect(g); g.connect(master);
      o.start(t); o2.start(t); o.stop(t + len + .05); o2.stop(t + len + .05);
    }
    function hat(t, v) {
      const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 7000;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
      src.connect(hp).connect(g).connect(master); src.start(t); src.stop(t + .06);
    }
    function thump(t, v) {   // kalp atışı
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(g).connect(master); o.start(t); o.stop(t + .25);
    }
    function sched() {
      while (next < ac.currentTime + .6) {
        const beat = step % 8, bar = step / 8 | 0;
        let dt = .45;
        if (mode === 'menu') {
          const c = MENU[bar % 4], cycle = (bar / 4 | 0) % 4;
          if (beat === 0) bell(c[0], next, .1, 3.2);
          if (cycle !== 3 || beat < 4) bell(c[MPAT[cycle % 2][beat]], next, beat % 2 ? .045 : .06, 1.8);
        } else if (mode === 'game') {
          // tempo, akor ve ses rengi yalnızca ölçü başında değişir → geçişler pürüzsüz
          if (beat === 0) { barT = tension; barAlarm = alarm; lp.frequency.setTargetAtTime(1600 + 3200 * barT, next, .6); }
          const T = barT, prog = barAlarm ? ALARM : GAME, c = prog[bar % prog.length];
          dt = .36 - .14 * T;                                                     // 8'lik: ~83 → ~136 bpm
          if (beat === 0) bell(c[0], next, .09, 2.4);                              // bas
          if (T > .2 && (T > .5 || beat % 2 === 0)) bell(c[0] + 12, next, .03 + .05 * T, .3);   // bas nabzı
          bell(c[GPAT[beat]] + (T > .7 ? 12 : 0), next, .035 + .02 * T, .9);       // arpej
          if (T > .45 && beat % 2) hat(next, .012 + .03 * T);                      // tıkırtı
          if (T > .8 && beat % 2 === 0) hat(next, .008 + .012 * T);
          if (barAlarm && beat % 4 === 0) { thump(next, .2); thump(next + .14, .12); }   // son 10 sn: kalp atışı
        }                                                                          // 'rest': sessiz
        next += dt; step++;
      }
    }
    function start() {
      if (on || !A().music) return;
      try {
        ensureAC(); if (!master) setup();
        on = true; next = Math.max(next, ac.currentTime + .1);
        master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime);
        master.gain.linearRampToValueAtTime(VOL, ac.currentTime + 2.5);
        clearInterval(timer); timer = setInterval(sched, 250); sched();
      } catch {}
    }
    function stop() {
      if (!on) return; on = false; clearInterval(timer);
      try { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, .3); } catch {}
    }
    function setMode(m) { if (m === mode) return; mode = m; step = 0; if (m !== 'game') { tension = barT = 0; alarm = barAlarm = false; } }
    function setTension(x, a = false) { tension = Math.max(0, Math.min(1, x)); alarm = a; }
    return { start, stop, setMode, setTension, state: () => ({ on, mode, tension, alarm }) };
  })();
  function haptic(kind) {
    if (!A().vib) return;
    try {
      const H = window.Capacitor?.Plugins?.Haptics;
      if (H) { kind === 'win' ? H.notification({ type: 'SUCCESS' }) : H.impact({ style: kind === 'heavy' ? 'MEDIUM' : 'LIGHT' }); return; }
      navigator.vibrate?.(kind === 'win' ? [15, 50, 25] : kind === 'heavy' ? 16 : 7);
    } catch {}
  }
  // Oyun efektleri (prototipin sesi): tek osilatör, isteğe bağlı perde kayması. fx(frekans, süre, dalga, bitiş frekansı, ses düzeyi, gecikme)
  function fx(f, d, type, f2, v, dl) {
    if (!A().sound) return;
    try {
      ensureAC();
      const t = ac.currentTime + (dl || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v || .1, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .03);
    } catch {}
  }
  // Titreşim deseni (ms ya da [titreşim, ara, titreşim…]). Cihazda Capacitor Haptics, tarayıcıda navigator.vibrate.
  // Ses kapalıyken oyundaki her bilgi bu titreşimle de verilir.
  function buzz(p) {
    if (!A().vib) return;
    try {
      const H = window.Capacitor?.Plugins?.Haptics, n = Array.isArray(p) ? p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) : p;
      if (H) { n >= 60 ? H.notification({ type: n >= 100 ? 'ERROR' : 'SUCCESS' }) : H.impact({ style: n >= 30 ? 'HEAVY' : n >= 12 ? 'MEDIUM' : 'LIGHT' }); return; }
      navigator.vibrate?.(p);
    } catch {}
  }
  // Hamur sesi: kısa gürültü patlaması, alçak geçiren süzgeç f1'den f2'ye kayar (şlap, pıt, makas). pat(süre, f1, f2, ses düzeyi, gecikme)
  let gurultu = null;
  function pat(d, f1, f2, v, dl) {
    if (!A().sound) return;
    try {
      ensureAC();
      if (!gurultu) { gurultu = ac.createBuffer(1, ac.sampleRate * .5, ac.sampleRate); const b = gurultu.getChannelData(0); for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1; }
      const t = ac.currentTime + (dl || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = gurultu; f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + d);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v || .2, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t, Math.random() * .3, d + .05);
    } catch {}
  }
  return { init: f => { A = f; }, tone, fx, pat, buzz, haptic, Music, ctx: () => ac };
})();
