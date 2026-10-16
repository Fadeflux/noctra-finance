// RECORDS : UNE SEULE RÈGLE D'ÉVOLUTION (J2, relecture du 16/10). Prouvé sur le VRAI code de index.html.
//  Avant, dans le même panneau : « Tes 3 derniers mois −102 % » (écart ÷ |avant|, la règle de l'accueil et du Récap) à
//  côté de « Dernier mois terminé +$443.46 » (en dollars dès que le mois d'avant est en perte). Maintenant les deux
//  suivent evolutionPct, arrondie au pour cent, « stable » à 0 % ; mois d'avant à zéro : l'écart en dollars.
//  (L'élision « d'octobre », J5 : test_elision_mois.js.)
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec des mois FICTIFS et
// un faux document en mémoire. (Règle de la maison : jamais la base réelle.)
//
// Lancer : node test_records_evolution.js            (ou : node test_records_evolution.js <autre_page.html>)
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

let CODE, R_3M, R_AN, DE_NOM = null;
try {
  R_3M = extraire('_rk3Mois'); R_AN = extraire('renderAnnee');
  try { DE_NOM = extraire('_deNomMois'); } catch (e) { DE_NOM = null; }   // (absente d'une page sans J5 : on le dira plus bas)
  CODE = [ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/const fmtPct=n=>[^\n]*/, 'fmtPct'), ligneDe(/const _ESC=[^\n]*/, '_ESC'), ligneDe(/const esc=s=>[^\n]*/, 'esc'),
    extraire('evolutionPct'), extraire('_chEvo'), extraire('_chPct'), extraire('_chCts'), extraire('_chMoisAvant'), extraire('_chNom'),
    extraire('_chNomMin'), extraire('_chMoisSeul'), extraire('_chCause'), extraire('chRecords'), extraire('renderRecords'), extraire('_rcMois'),
    extraire('grafMoisLong'), extraire('grafCap'), extraire('_rcPct'), extraire('_mS'), extraire('_pl'), extraire('_chNb'),
    DE_NOM || 'var _deNomMois = null;'].join('\n');
} catch (e) {
  console.error('  KO  Records (J2 / J5) : fonction absente de la page -> ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

function charger(mois, cour) {
  const el = { hidden: false, className: '', innerHTML: '' };
  const document = { getElementById: (id) => (id === 'records-panel' ? el : null) };
  const F = new Function('document', 'MOIS', 'COUR',
    CODE + '\nfunction getMonthlyRecap(){ return MOIS; } function _pgMoisCourant(){ return COUR; } function _moisAFinaliser(){ return null; }\n' +
    'function _pgIco(n){ return "[" + n + "]"; } function _pillIco(){ return ""; } function grafMoisCourt(m){ return grafMoisLong(m).slice(0, 4); }\n' +
    'function _rk3Mois(R, tuile){ return tuile("rk-prog rk-3m", "Tes 3 derniers mois", "—", ""); }\n' +
    'return { evo: _chEvo, pct: evolutionPct, rec: chRecords, rendre: renderRecords, de: _deNomMois };')(document, mois, cour);
  F.el = el;
  return F;
}
const texte = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
function m(key, profit) { return { key: key, profit: profit, net: Math.max(profit, 0) + 1000, tg: 0, va: 500, mo: 0, ci: 100, ch: 0, al: 400, fr: 0 }; }

// ── J2 ───────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- J2 : une seule règle d’évolution dans Records (celle de l’accueil et du Récap) --');
const F0 = charger([], '2026-10');
const paires = [[-659.68, -1103.14], [4383.91, 7786.48], [100, 100], [-2644.2, 7786.48], [500, -1000], [0, 0], [5, 0], [1234.56, 1000.01], [-10, -10]];
let memes = true; const vus = [];
for (const [a, b] of paires) {
  const e = F0.evo(a, b), p = F0.pct(a, b), att = isFinite(p) ? Math.round(p) : null;
  vus.push(a + ' / ' + b + ' -> ' + e);
  if (e !== att) memes = false;
}
V(memes, '« Dernier mois terminé » (_chEvo) = Math.round(evolutionPct), la règle de « Tes 3 derniers mois »', vus.join(' ; '));
V(F0.evo(-659.68, -1103.14) === 40, 'mois d’avant en perte : −$659.68 contre −$1,103.14 = +40 % (et non « +$443.46 »)', F0.evo(-659.68, -1103.14));
V(F0.evo(5, 0) === null && F0.evo(0, 0) === 0, 'mois d’avant à zéro : pas de pourcentage (écart en dollars) ; zéro contre zéro : stable');
V(/var ev = evolutionPct\(s3, sa\)/.test(R_3M) && /Math\.round\(ev\)/.test(R_3M), '« Tes 3 derniers mois » : evolutionPct, arrondi au pour cent (inchangé)');
// le panneau, dans un faux document
const MOIS = [m('2026-10', 500), m('2026-09', -659.68), m('2026-08', -1103.14), m('2026-07', 3000), m('2026-06', 3528.7), m('2026-05', 4000), m('2026-04', 3057.4)];
let F = charger(MOIS, '2026-10');
const R = F.rec();
V(R.evo === 40 && !R.baisse && !R.stable, 'chRecords : septembre contre août (en perte) → évolution 40, en hausse', JSON.stringify({ evo: R.evo, baisse: R.baisse, stable: R.stable }));
F.rendre();
const t = texte(F.el.innerHTML);
const der = t.slice(t.indexOf('Dernier mois terminé'));
V(/Dernier mois terminé \[up\]\s*\+40 %/.test(der) && !/\+\$443\.46/.test(t), 'le panneau écrit « +40 % » (avec la flèche), plus « +$443.46 »', der.slice(0, 120));
V(/Septembre 2026 : −\$659\.68\s*, contre −\$1,103\.14 en août/.test(der), 'les deux bénéfices restent écrits en dessous (inchangés)', der.slice(0, 160));
F = charger([m('2026-10', 500), m('2026-09', 900), m('2026-08', 1000)], '2026-10');
F.rendre();
V(/Dernier mois terminé \[dn\]\s*−10 %/.test(texte(F.el.innerHTML)) && /Septembre en baisse de 10 %/.test(texte(F.el.innerHTML)),'mois d’avant positif : « −10 % » et « Septembre en baisse de 10 % » (inchangé)', texte(F.el.innerHTML).slice(0, 300));
F = charger([m('2026-10', 500), m('2026-09', 250), m('2026-08', 0)], '2026-10');
F.rendre();
V(/Dernier mois terminé \[up\] \+\$250/.test(texte(F.el.innerHTML)), 'mois d’avant à zéro : « +$250 » (comme « Tes 3 derniers mois » à zéro)', texte(F.el.innerHTML).slice(0, 300));

// (J5, l'élision des mois : test_elision_mois.js)

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
