// UN MONTANT S'ÉCRIT AU CENTIME, UNE SEULE FOIS ARRONDI (relecture du 16/10, J1).
//
// ⚠️ LE DÉFAUT : `fmtC` décidait « centimes nuls ? » avec Math.round(a × 100) mais écrivait avec toFixed(2) ; sur un
// demi-centime les deux ne tranchent pas pareil : fmtC(80.005) = « $80.00 » (centimes nuls écrits, contre la règle du
// site, au lieu de « $80.01 ») ; le suivi des impôts en tirait « Reste à payer $30 » au lieu de $30.01 ; la colonne
// « Brut OnlyFans » du Récap ne tombait plus sur sa ligne Total (somme de Math.round).
// La règle du site : le centime, demi-centime vers le haut = Math.round(a × 100) — celle de tous les totaux.
//
//     node test_fmtc_centimes.js [autre/index.html]      (sur final25.html : doit ÉCHOUER)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}
const ligne = (nom) => { const m = SRC.match(new RegExp('\\nconst ' + nom + '=(v=>[^\\n]*);\\n')); if (!m) throw new Error(nom + ' introuvable'); return m[1]; };
// les VRAIES fonctions de la page (fmt et fmtR servent à l'ancienne écriture)
const fmt = new Function('return ' + ligne('fmt'))();
const fmtR = new Function('return ' + ligne('fmtR'))();
const fmtC = new Function('fmtR', 'fmt', 'return ' + ligne('fmtC'))(fmtR, fmt);
// l'écriture d'AVANT (témoin, recopiée de la relecture) : sert à prouver que rien d'autre ne bouge
const ancien = (v) => { const a = Math.abs(Number(v) || 0); return (Math.round(a * 100) % 100 === 0) ? fmtR(a) : fmt(a); };
const centimesEcrits = (t) => Math.round(parseFloat(String(t).replace(/[^0-9.]/g, '')) * 100);

console.log('\n-- 1. le demi-centime s’écrit comme les totaux le comptent --');
for (const [v, att] of [[80.005, '$80.01'], [30.005, '$30.01'], [0.005, '$0.01'], [1000.625, '$1,000.63'], [12345.675, '$12,345.68'], [80.004999, '$80']]) {
  V(fmtC(v) === att, 'fmtC(' + v + ') = « ' + att + ' »', fmtC(v));
}
V(!/\.00$/.test(fmtC(80.005)), 'jamais de centimes nuls écrits (« $80.00 »)', fmtC(80.005));

console.log('\n-- 2. les écritures habituelles ne changent pas --');
for (const [v, att] of [[80, '$80'], [17.5, '$17.50'], [1234567.891, '$1,234,567.89'], [-4383.91, '$4,383.91'], [0, '$0'], [0.004, '$0'],
                         [3171.875, '$3,171.88'], [7310, '$7,310'], [999.999, '$1,000'], [259985.25, '$259,985.25']]) {
  V(fmtC(v) === att, 'fmtC(' + v + ') = « ' + att + ' »', fmtC(v));
}

console.log('\n-- 3. 200 000 montants : le centime écrit = Math.round(|v| × 100), et sans demi-centime rien ne bouge --');
{
  let g = 20261016; const alea = () => { g = (g * 16807) % 2147483647; return g / 2147483647; };
  let ecarts = 0, bouge = 0, ex = '', ex2 = '';
  for (let i = 0; i < 200000; i++) {
    const base = Math.round(alea() * 5e7) / 100;                                       // un montant au centime (0 → 500 000 $)
    const v = i % 3 === 0 ? base + 0.005 : (i % 3 === 1 ? base : base * 0.035 + base * 0.01 / 0.98);   // demi-centimes et frais OF
    const t = fmtC(v);
    if (centimesEcrits(t) !== Math.round(Math.abs(v) * 100) || /\.00$/.test(t)) { ecarts++; if (!ex) ex = v + ' -> ' + t; }
    if (i % 3 === 1 && t !== ancien(v)) { bouge++; if (!ex2) ex2 = v + ' : ' + ancien(v) + ' -> ' + t; }
  }
  V(ecarts === 0, '200 000 montants : centimes écrits = arrondi du site, jamais « .00 »', ecarts + ' écart(s), ex. ' + ex);
  V(bouge === 0, 'montants déjà au centime : même écriture qu’avant (rien ne bouge sans demi-centime)', bouge + ' changé(s), ex. ' + ex2);
}

console.log('\n-- 4. Récap, colonne « Brut OnlyFans » : la ligne Total = la somme des cases écrites --');
{
  const m = SRC.match(/'<td class="rc-brut">' \+ R\(([^\n]*?)\) \+ '<\/td>'   \/\*/);
  V(!!m, 'la ligne Total du tableau est trouvée dans la page', m ? m[1] : 'introuvable');
  if (m) {
    const total = new Function('data', 'return ' + m[1]);
    // bruts de bilans (net ÷ 0,80) sur 3 ans : un net qui finit par 2 ou 6 centimes donne un brut au demi-centime
    const data = []; for (let i = 0; i < 36; i++) data.push({ brut: Math.round((3000.02 + i * 137.04) * 100) / 100 / 0.8 });
    const cases = data.reduce((s, x) => s + centimesEcrits(fmtC(x.brut)), 0);
    const t = centimesEcrits(fmtC(total(data)));
    V(cases === t, 'somme des 36 cases = Total (' + (t / 100).toFixed(2) + ' $)', 'cases ' + cases + ' ≠ total ' + t);
    const d2 = [{ brut: 1000.625 }, { brut: 2000.625 }, { brut: 8209.94 }];
    V(d2.reduce((s, x) => s + centimesEcrits(fmtC(x.brut)), 0) === centimesEcrits(fmtC(total(d2))), 'trois mois à demi-centime : cases et Total tombent juste',
      d2.map((x) => fmtC(x.brut)).join(' + ') + ' ≠ ' + fmtC(total(d2)));
  }
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
process.exit(ko ? 1 : 0);
