// « D' » DEVANT UN MOIS QUI COMMENCE PAR UNE VOYELLE (J5, relecture du 16/10). Avant : « …apparaîtront ici à la fin
// de octobre » (Records sans mois terminé) ; dans L'année, « connu une fois le bilan de … finalisé » avait la même
// tournure. Maintenant : « à la fin d'octobre », « d'avril », « d'août » — la règle de _deMois. Prouvé sur le VRAI code
// de index.html.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec des mois FICTIFS et
// un faux document en mémoire. (Règle de la maison : jamais la base réelle.)
//
// Lancer : node test_elision_mois.js            (ou : node test_elision_mois.js <autre_page.html>)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

let ko = 0;
function V(cond, quoi, detail) {
  if (cond) console.log('  OK  ' + quoi);
  else { ko++; console.error('  KO  ' + quoi + (detail !== undefined ? ' -> ' + String(detail).slice(0, 400) : '')); }
}
function extraire(nom) {
  const i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('fin introuvable : ' + nom);
}
function ligneDe(re, quoi) { const m = SRC.match(re); if (!m) throw new Error('introuvable : ' + quoi); return m[0]; }

let CODE, R_AN, DE_NOM = null;
try {
  R_AN = extraire('renderAnnee');
  try { DE_NOM = extraire('_deNomMois'); } catch (e) { DE_NOM = null; }
  CODE = [ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/const fmtPct=n=>[^\n]*/, 'fmtPct'), ligneDe(/const _ESC=[^\n]*/, '_ESC'), ligneDe(/const esc=s=>[^\n]*/, 'esc'),
    extraire('evolutionPct'), extraire('_chEvo'), extraire('_chPct'), extraire('_chCts'), extraire('_chMoisAvant'), extraire('_chNom'),
    extraire('_chNomMin'), extraire('_chMoisSeul'), extraire('_chCause'), extraire('chRecords'), extraire('renderRecords'), extraire('_rcMois'),
    extraire('grafMoisLong'), extraire('grafCap'), extraire('_rcPct'), extraire('_mS'), extraire('_pl'), extraire('_chNb'),
    extraire('_nomMois'), extraire('_deMois'), ligneDe(/var _MOIS_FR=\[[^\]]*\];/, '_MOIS_FR'), DE_NOM || 'var _deNomMois = null;'].join('\n');
} catch (e) {
  console.error('  KO  Records : fonction absente de la page -> ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

function charger(mois, cour) {
  const el = { hidden: false, className: '', innerHTML: '' };
  const document = { getElementById: (id) => (id === 'records-panel' ? el : null) };
  const F = new Function('document', 'MOIS', 'COUR', 'Date',
    CODE + '\nfunction getMonthlyRecap(){ return MOIS; } function _pgMoisCourant(){ return COUR; } function _moisAFinaliser(){ return null; }\n' +
    'function _pgIco(n){ return "[" + n + "]"; } function _pillIco(){ return ""; } function grafMoisCourt(m){ return grafMoisLong(m).slice(0, 4); }\n' +
    'function _rk3Mois(R, tuile){ return tuile("rk-prog rk-3m", "Tes 3 derniers mois", "—", ""); }\n' +
    'return { rendre: renderRecords, de: _deNomMois, deMois: _deMois };')(document, mois, cour, function FD(...a) { return a.length ? new Date(...a) : new Date(cour + '-16T10:00:00'); });
  F.el = el;
  return F;
}
const texte = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
function m(key, profit) { return { key: key, profit: profit, net: Math.max(profit, 0) + 1000, tg: 0, va: 500, mo: 0, ci: 100, ch: 0, al: 400, fr: 0 }; }

console.log('\n-- J5 : Records sans mois terminé --');
for (const [k, att] of [['2026-10', "à la fin d'octobre."], ['2026-04', "à la fin d'avril."], ['2026-08', "à la fin d'août."], ['2026-09', 'à la fin de septembre.'], ['2026-01', 'à la fin de janvier.'], ['2026-12', 'à la fin de décembre.']]) {
  const F = charger([m(k, 300)], k);
  F.rendre();
  V(texte(F.el.innerHTML).includes(att), 'Records sans mois terminé (' + k + ') : « ' + att + ' »', texte(F.el.innerHTML).slice(-140));
}
console.log('\n-- J5 : la même règle que _deMois, partout où un mois suit « de » --');
const F = charger([], '2026-10');
V(typeof F.de === 'function', '_deNomMois existe (l’élision pour un NOM de mois déjà écrit)', DE_NOM ? '' : 'absente');
if (typeof F.de === 'function') {
  const noms = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const pareil = noms.every((n, i) => F.de(n) === F.deMois('2026-' + String(i + 1).padStart(2, '0')));
  V(pareil, '_deNomMois(nom) = _deMois(mois) pour les 12 mois (« d’avril », « d’août », « d’octobre », « de mai »…)', noms.map((n) => F.de(n)).join(', '));
}
V(/'Meilleur trimestre : connu une fois le bilan ' \+ _deNomMois\(moisAFin\) \+ ' finalisé'/.test(R_AN) && !/le bilan de ' \+ moisAFin/.test(R_AN),
  'L’année : « connu une fois le bilan d’… finalisé » passe par la même élision');
V(!/à la fin de '\s*\+\s*esc\(_chMoisSeul/.test(SRC), 'plus aucun « à la fin de » + nom de mois sans élision dans la page');
// (garde-fou) aucune AUTRE concaténation « de » + nom de mois sans élision : la recherche de outils/chercher_de_mois.py
const restes = [];
const re = /\bde\s?(['"`])\s*\+\s*([^;\n]{0,90})/g;
let x;
while ((x = re.exec(SRC))) {
  const e = x[2].split('+')[0].trim();          // le nom qui suit « de » (pas la suite de la phrase)
  if (/_chMoisSeul|_nomMois|grafMoisLong|_MOIS_FR|_lmNomComplet|_msMoisNom|moisAFin|moisCour/.test(e)) restes.push(e.slice(0, 60));
}
V(!restes.length, 'aucune autre concaténation « de » + nom de mois sans élision (recherche dans toute la page)', restes.join(' | '));

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
