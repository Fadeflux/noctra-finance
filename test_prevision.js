// La « Prévision fin de mois » doit suivre le RYTHME de saisie.
//
// ⚠️ LE DÉFAUT (12/10)
// Deux façons de remplir ce site appellent deux calculs différents :
//   - une ligne par JOUR  -> moyenne des jours saisis × jours du mois ;
//   - UN BILAN par mois, mis à jour au fil du mois (l'usage réel : une seule
//     ligne au 1er, modifiée des dizaines de fois) -> la ligne EST le cumul du
//     mois à date, on la prolonge sur les jours ÉCOULÉS.
// Le site n'appliquait que la première règle. Avec un bilan mensuel, il
// prenait le mois entier pour UNE journée et le multipliait par 31 : il
// affichait en gros un chiffre trente fois trop haut, et criait en plus
// « ⚠ 11 jours sans saisie » à quelqu'un qui saisit exprès une fois par mois.
//
// Montants FABRIQUÉS (ce dépôt est public) : aucune donnée réelle ici.
//
//     node test_prevision.js
//     node test_prevision.js vieux.html     (doit ÉCHOUER sur l'ancienne version)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

function extraire(nom) {
  const i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('fonction non fermee : ' + nom);
}

// --- Faux monde : juste ce que lit la fonction ---
const EL = {};
const el = (id) => (EL[id] = EL[id] || { id, style: {}, textContent: '', innerHTML: '', value: '' });
global.document = { getElementById: el };
global.fmtR = (v) => '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
global.fmtS = (v) => (v < 0 ? '-' : '') + global.fmtR(v);
global.fmt = (v) => '$' + Math.abs(v).toFixed(2);
// (15/10, benefice AU CENTIME) renderForecast ecrit le bilan du mois avec fmtC (centimes s'il y en a) : on prend fmt et
// fmtC DANS la page quand ils y sont (une valeur recopiee a la main derive) ; une ancienne page reste testable.
for (const nom of ['fmt', 'fmtC']) {
  const m = SRC.match(new RegExp('\\nconst ' + nom + '=(v=>[^\\n]*);\\n'));
  if (m) global[nom] = new Function('fmtR', 'fmt', 'return ' + m[1])(global.fmtR, global.fmt);
}
Object.assign(global, new Function(extraire('renderForecast') + ';return{renderForecast};')());

function lancer({ ents, acd = null, acdEnd = null, auj = '2026-10-12' }) {
  for (const k of Object.keys(EL)) delete EL[k];
  global.ents = ents; global.acd = acd; global.acdEnd = acdEnd; global.ts = () => auj;
  global.renderForecast();
  const v = el('forecast-val').textContent;
  return {
    affichee: el('forecast-card').style.display !== 'none',
    valeur: v ? Number(v.replace(/[^0-9-]/g, '')) * (v.trim().startsWith('-') ? -1 : 1) : null,
    base: String(el('forecast-sub').innerHTML).replace(/<[^>]+>/g, ''),
  };
}

const ligne = (date, profit) => ({ date, profit, brut: 0, tgNet: 0 });
// Un BILAN par mois (comme l'usage reel), le dernier au 1er octobre.
const BILANS = [ligne('2026-06-30', 100), ligne('2026-07-30', 3000), ligne('2026-08-30', 7000),
                ligne('2026-09-30', 6000), ligne('2026-10-01', 6200)];
// Une ligne par JOUR : 25 jours saisis par mois passe, puis 7 jours en octobre.
const QUOTIDIEN = [];
for (const m of ['07', '08', '09']) for (let j = 1; j <= 25; j++) QUOTIDIEN.push(ligne('2026-' + m + '-' + String(j).padStart(2, '0'), 300));
for (let j = 1; j <= 7; j++) QUOTIDIEN.push(ligne('2026-10-' + String(j).padStart(2, '0'), 100));

let ko = 0;
function V(cond, quoi, detail) {
  if (cond) console.log('  OK  ' + quoi);
  else { ko++; console.error('  KO  ' + quoi + (detail ? '  -> ' + detail : '')); }
}

console.log('\n-- un BILAN par mois, mis a jour au fil du mois --');
{
  // 6 200 $ au 12 octobre -> 6 200 / 12 x 31 ≈ 16 017 $ (et surtout pas 6 200 x 31 = 192 200 $)
  const r = lancer({ ents: BILANS });
  V(r.affichee, 'la prevision s affiche');
  V(r.valeur !== null && Math.abs(r.valeur - 16017) <= 2, 'cumul du mois prolonge sur les jours ECOULES (≈ 16 017 $)',
    'obtenu ' + r.valeur + (r.valeur > 100000 ? ' : le bilan a ete pris pour UNE journee et multiplie par 31' : ''));
  V(/12 jours/.test(r.base), 'on DIT sur quoi repose le chiffre (12 jours ecoules)', r.base);
  V(!/sans saisie/.test(r.base), 'pas de « jours sans saisie » pour un bilan mensuel', r.base);
}
{
  // Bouton « Ce mois-ci » : la plage finit le 31, mais on est le 12.
  const r = lancer({ ents: BILANS, acd: '2026-10-01', acdEnd: '2026-10-31' });
  V(r.valeur !== null && Math.abs(r.valeur - 16017) <= 2, 'avec la plage « Ce mois-ci », toujours 12 jours ecoules et pas 31',
    'obtenu ' + r.valeur);
}
{
  const r = lancer({ ents: BILANS, acd: '2026-09-01', acdEnd: '2026-09-30' });
  V(r.valeur === 6000, 'mois TERMINE : la prevision est le bilan lui-meme', 'obtenu ' + r.valeur);
  V(/termin/i.test(r.base), '... et le texte le dit', r.base);
}
if (/\nconst fmtC=/.test(SRC) && /forecast=modeBilan&&moisFini\?profitCumule:/.test(SRC)) {
  // (15/10) le bilan est enregistre AU CENTIME : un mois termine affiche le bilan exact, centimes compris
  const B2 = BILANS.map((x) => Object.assign({}, x)); B2[3].profit = 6000.55;
  lancer({ ents: B2, acd: '2026-09-01', acdEnd: '2026-09-30' });
  V(el('forecast-val').textContent === '$6,000.55', 'mois TERMINE au centime : « $6,000.55 » (pas « $6,001 »)', el('forecast-val').textContent);
  // ... et en cours de mois, « ton bilan a ce jour » garde ses centimes ; la prevision reste une estimation au dollar
  const B3 = BILANS.map((x) => Object.assign({}, x)); B3[4].profit = 6200.4;
  const r3 = lancer({ ents: B3 });
  V(/6,200\.40 en 12 jours/.test(r3.base) && /^≈ \$[\d,]+$/.test(el('forecast-val').textContent),
    'en cours : « ton bilan a ce jour » au centime ($6,200.40), prevision « ≈ » au dollar', r3.base + ' | ' + el('forecast-val').textContent);
}
{
  const r = lancer({ ents: [ligne('2026-10-01', 1200)] });
  V(r.valeur !== null && Math.abs(r.valeur - 3100) <= 2, 'tout premier mois, un seul bilan : meme regle', 'obtenu ' + r.valeur);
}

console.log('\n-- une ligne par JOUR : la regle du 25/09 reste en place --');
{
  // 7 jours saisis a 100 $ -> 100 $/jour x 31 = 3 100 $, et 5 jours manquent (12 - 7).
  const r = lancer({ ents: QUOTIDIEN });
  V(r.valeur === 3100, 'moyenne des jours SAISIS x jours du mois (3 100 $)', 'obtenu ' + r.valeur);
  V(/7 jours saisis/.test(r.base), '... sur 7 jours saisis', r.base);
  V(/5 jours sans saisie/.test(r.base), '... et l alerte « 5 jours sans saisie » reste', r.base);
}
{
  // Debut d'usage quotidien sans historique : 3 jours saisis = deja du quotidien.
  const r = lancer({ ents: [ligne('2026-10-01', 200), ligne('2026-10-02', 200), ligne('2026-10-03', 200)] });
  V(r.valeur === 6200, 'premier mois en quotidien (3 jours saisis) : 200 $/jour x 31', 'obtenu ' + r.valeur);
}

console.log('\n-- le controle sait echouer --');
{
  // TEMOIN : si la fonction etait muette (rien d'affiche), tout ce qui precede
  // pourrait passer pour de mauvaises raisons. Un mois sans aucune saisie doit
  // cacher la carte, et un mois avec saisie doit la montrer.
  V(lancer({ ents: [] }).affichee === false, 'sans saisie, la carte est cachee (la fonction agit bien)');
  V(lancer({ ents: BILANS }).affichee === true, '... et avec saisie, elle est montree');
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
