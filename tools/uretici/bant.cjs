// Tek bandı üretir ve seçimi JSON olarak yazar (uzun üretimi bantlara bölüp paralel koşmak için).
// Kullanım: node tools/uretici/bant.cjs 6 cikti.json
'use strict';
const fs = require('fs'), U = require('../uretici.cjs');
const no = +process.argv[2], out = process.argv[3], t0 = Date.now();
const [{ S }] = U.uret(no);
fs.writeFileSync(out, JSON.stringify(S.sort((a, b) => a.no - b.no).map(x => ({ no: x.no, puan: x.R.puan, hamle: x.R.hamle, yanlis: x.R.yanlis, ritim: x.ritim, t: U.sure(x), hint: (x.elle && x.L.hint) || U.IPUCU[x.no] || ['', ''], map: x.L.map, molds: x.L.molds }))));
console.log('bant', no, S.length, 'bölüm', ((Date.now() - t0) / 1000).toFixed(0), 'sn');
