// Hamur — dil sözlükleri: kaynaktaki L(tr, en) çağrılarından İngilizce anahtarları çıkarır, tools/diller/sozluk-*.txt'ten
// www/lang/<dil>.js sözlüklerini üretir, eksik ve artık anahtarları bildirir. Altyapı: docs/CEVIRI.md
// Kullanım: node tools/diller.cjs            → sözlükleri yazar, eksikleri listeler (eksik varsa çıkış kodu 1)
//           node tools/diller.cjs --keys     → yalnız anahtar listesini yazdırır
//           node tools/diller.cjs --skeleton → sozluk-*.txt'te olmayan anahtarları boş kalıp olarak yazdırır
'use strict';
const fs = require('fs'), path = require('path');
const WWW = path.join(__dirname, '..', 'www'), SRC = path.join(__dirname, 'diller');   // sozluk-*.txt (sırayla okunur)
const LANGS = ['de', 'es', 'pt-BR', 'fr'];

// ---------- JS taraması: yorum, dizgi, şablon (iç içe ${…}), düzenli ifade ----------
function lex(src) {
  const T = []; let i = 0, last = '';
  const reOk = () => !last || /[(,=:[!&|?{};+\-*%<>~^]$/.test(last) || /\b(return|typeof|case|of|in)$/.test(last);
  function tpl() {   // src[i] === '`' → { q: [metin…], e: [ifade kaynağı…], end }
    const q = [], e = []; let s = '', j = i + 1;
    while (j < src.length && src[j] !== '`') {
      if (src[j] === '\\') { s += src.slice(j, j + 2); j += 2; continue; }
      if (src[j] === '$' && src[j + 1] === '{') {
        q.push(s); s = ''; const a = j + 2; let d = 0, k = a;
        for (; k < src.length; k++) {
          const c = src[k];
          if (c === "'" || c === '"') { k = strEnd(k) - 1; continue; }
          if (c === '`') { const sv = i; i = k; k = tpl().end - 1; i = sv; continue; }
          if (c === '{') d++; else if (c === '}') { if (!d) break; d--; }
        }
        e.push(src.slice(a, k)); j = k + 1; continue;
      }
      s += src[j++];
    }
    q.push(s); return { q, e, end: j + 1 };
  }
  function strEnd(k) { const c = src[k]; let j = k + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } return j + 1; }
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" || c === '"') { const e = strEnd(i); T.push({ t: 's', at: i, end: e, v: unq(src.slice(i + 1, e - 1)) }); i = e; last = 's'; continue; }
    if (c === '`') { const r = tpl(); T.push({ t: 'tpl', at: i, end: r.end, q: r.q.map(unq), e: r.e }); i = r.end; last = 's'; continue; }
    if (c === '/' && reOk()) { let j = i + 1, cls = false; while (j < src.length && (src[j] !== '/' || cls)) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; } j++; while (/[a-z]/.test(src[j])) j++; T.push({ t: 're', at: i, end: j }); i = j; last = 're'; continue; }
    const m = /^[A-Za-z_$][\w$]*|^\d[\w.]*|^=>|^\.\.\.|^[^\s]/.exec(src.slice(i, i + 64));
    T.push({ t: 'p', at: i, end: i + m[0].length, v: m[0] }); i += m[0].length; last = m[0];
  }
  return T;
}
const unq = s => s.replace(/\\(u\{[\da-f]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|.)/g, (_, x) => x[0] === 'u' ? String.fromCodePoint(parseInt(x.replace(/[u{}]/g, ''), 16)) : x[0] === 'x' ? String.fromCharCode(parseInt(x.slice(1), 16)) : ({ n: '\n', t: '\t' })[x] ?? x);

// L( çağrılarının argümanları (üst düzey virgülle ayrılmış belirteç dizileri)
function calls(src, file) {
  const T = lex(src), out = [];
  const scan = (T, base) => {
    for (let k = 0; k < T.length; k++) {
      const t = T[k];
      if (t.t === 'tpl') { t.e.forEach(e => scan(lex(e), base)); continue; }
      if (!(t.t === 'p' && (t.v === 'L' || WRAP[t.v]) && T[k + 1]?.v === '(' && T[k - 1]?.v !== '.' && T[k - 1]?.v !== 'function' && T[k - 1]?.v !== 'const')) continue;
      const args = [[]]; let d = 0, j = k + 2;
      for (; j < T.length; j++) {
        const u = T[j];
        if (u.t === 'p' && '([{'.includes(u.v)) d++;
        if (u.t === 'p' && ')]}'.includes(u.v)) { if (!d) break; d--; }
        if (u.t === 'p' && u.v === ',' && !d) { args.push([]); continue; }
        args[args.length - 1].push(u);
      }
      out.push({ file, line: src.slice(0, t.at).split('\n').length, args: WRAP[t.v] ? args.slice(WRAP[t.v] - 1) : args });
    }
  };
  scan(T);
  return out;
}

const LETTER = /\p{L}/u, INNER = new Set(), norm = k => k.replace(/\s+/g, ' ');   // i18n.js de boşlukları böyle sıkıştırır
// L(tr, en)'yi değişkenle çağıran sarmalayıcılar: ad → Türkçe argümanın sırası (1'den başlar)
const WRAP = {}, NOT_TEXT = new Set(['tur']);   // ${…} içinde metin olmayan dizgiler (kimlik)
// İngilizce argümandan anahtarlar: dizgi → kendisi; şablon → ${…} yerine {0}, {1}…; dizi → her öğe; ?: → iki dal.
// ${…} içindeki düz İngilizce dizgiler de (tekil/çoğul: pl(n, 'move', 'moves')) ayrı anahtar olur: yakalanan değer sözlükte varsa çevrilir.
function keysOf(toks, where, keys, odd) {
  const add = k => { k = norm(k); if (k.trim().length > 1 && LETTER.test(k.replace(/\{\d+\}/g, ''))) (keys.get(k) || keys.set(k, []).get(k)).push(where); };
  const lits = toks.filter(t => t.t === 's' || t.t === 'tpl');
  const plain = toks.every(t => t.t === 's' || t.t === 'tpl' || (t.t === 'p' && /^[[\],?:]$/.test(t.v)) || (t.t === 'p' && /^(\w+|===|!==|[<>]=?|\d+)$/.test(t.v)));
  if (!lits.length || !plain || toks.some(t => t.v === '+')) odd.push(where + ': ' + toks.map(t => t.t === 'p' ? t.v : t.t === 's' ? `'${t.v}'` : '`…`').join(' ').slice(0, 90));
  for (const t of lits) {
    if (t.t === 's') { add(t.v); continue; }
    add(t.q.map((s, n) => n ? `{${n - 1}}` + s : s).join(''));
    for (const e of t.e) for (const u of lex(e)) {
      if (u.t === 's' && /^[A-Za-z][a-z' ]*$/.test(u.v) && !NOT_TEXT.has(u.v)) { add(u.v); INNER.add(u.v); }
      if (u.t === 'tpl') keysOf([u], where, keys, []);
    }
  }
}

function extract() {
  const js = d => fs.existsSync(path.join(WWW, d)) ? fs.readdirSync(path.join(WWW, d)).filter(f => f.endsWith('.js')).sort().map(f => (d ? d + '/' : '') + f) : [];
  const files = [...js('').filter(f => f !== 'i18n.js' && f !== 'sw.js'), ...js('rules')];   // www/*.js ve www/rules/*.js
  const keys = new Map(), odd = [];
  for (const f of files) for (const c of calls(fs.readFileSync(path.join(WWW, f), 'utf8'), f)) {
    if (c.args.length < 2) { odd.push(`${f}:${c.line}: tek argüman`); continue; }
    keysOf(c.args.slice(1).flat(), `${f}:${c.line}`, keys, odd);
  }
  const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
  for (const m of html.matchAll(/data-en(?:-label|-title)?="([^"]*)"/g)) { const k = norm(m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"')); if (LETTER.test(k)) (keys.get(k) || keys.set(k, []).get(k)).push('index.html'); }
  keys.delete('en-US');
  return { keys, odd };
}

// ---------- sozluk-*.txt: "@ anahtar" satırı (İngilizce, boşluklar sıkıştırılmış), ardından "de: …", "es: …", "pt: …", "fr: …" (pt = pt-BR) ----------
function readDict() {
  const D = Object.fromEntries(LANGS.map(l => [l, {}])), order = [];
  let key = null;
  const text = fs.readdirSync(SRC).filter(f => /^sozluk.*\.txt$/.test(f)).sort().map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.startsWith('#')) continue;
    if (line.startsWith('@ ')) { key = norm(line.slice(2).replace(/␣/g, ' ')); order.push(key); continue; }
    const m = /^(de|es|pt|fr): ?(.*)$/.exec(line);
    if (!m || key == null) throw new Error('sözlük: anlaşılmayan satır: ' + line);
    if (D[m[1] === 'pt' ? 'pt-BR' : m[1]][key] != null) throw new Error('sözlük: iki kez: ' + key);
    let v = m[2].replace(/␣/g, ' ');
    if (m[1] === 'fr') v = v.replace(/ ([:;!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');   // Fransızca: işaretten önce bölünmez boşluk
    D[m[1] === 'pt' ? 'pt-BR' : m[1]][key] = v;
  }
  return { D, order };
}

function build() {
  const { keys, odd } = extract(), { D, order } = readDict();
  const miss = {}, extra = order.filter(k => !keys.has(k));
  for (const l of LANGS) {
    miss[l] = [...keys.keys()].filter(k => D[l][k] == null);
    const ph = Object.entries(D[l]).filter(([k, v]) => [...v.matchAll(/\{(\d+)\}/g)].some(m => !k.includes(`{${m[1]}}`)));
    if (ph.length) miss[l].push(...ph.map(([k]) => 'YER TUTUCU: ' + k));
    const body = Object.keys(D[l]).sort().map(k => `${JSON.stringify(k)}:${JSON.stringify(D[l][k])}`).join(',\n');
    fs.mkdirSync(path.join(WWW, 'lang'), { recursive: true });
    fs.writeFileSync(path.join(WWW, 'lang', l + '.js'), `// Üretildi: node tools/diller.cjs (kaynak tools/diller/sozluk-*.txt) — elle düzenlenmez\nwindow.HAMUR_DICT={\n${body}};\n`);
  }
  return { keys, odd, miss, extra };
}

module.exports = { extract, readDict, build, lex, LANGS, INNER };

if (require.main === module) {
  const a = process.argv;
  if (a.includes('--keys')) { const { keys, odd } = extract(); for (const [k, w] of keys) console.log(JSON.stringify(k), w.slice(0, 2).join(' ')); console.error(`${keys.size} anahtar`); if (odd.length) console.error('Elle bakılacak:\n' + odd.join('\n')); return; }
  if (a.includes('--skeleton')) { const { keys } = extract(), { D } = readDict(); for (const k of keys.keys()) if (D.de[k] == null) console.log(`@ ${k}\nde: \nes: \npt: \nfr: \n`); return; }
  const r = build(), n = Object.values(r.miss).reduce((s, m) => s + m.length, 0);
  console.log(`${r.keys.size} anahtar · eksik: ${LANGS.map(l => `${l} ${r.miss[l].length}`).join(', ')} · kaynakta olmayan: ${r.extra.length}`);
  for (const l of LANGS) if (r.miss[l].length) console.log(`${l}: ` + r.miss[l].slice(0, 15).map(k => JSON.stringify(k).slice(0, 80)).join('\n  '));
  if (r.extra.length) console.log('kaynakta olmayan: ' + r.extra.slice(0, 10).map(k => JSON.stringify(k).slice(0, 60)).join(', '));
  if (r.odd.length && a.includes('-v')) console.log('Elle bakılacak:\n' + r.odd.join('\n'));
  process.exit(n ? 1 : 0);
}
