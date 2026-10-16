// « AUJOURD'HUI » = LA DATE LOCALE DE L'APPAREIL, À TOUTE HEURE (15/10, F7).
//
// ⚠️ Aucune connexion : ts() est extraite du VRAI index.html et tourne ici avec une horloge et un fuseau SIMULÉS
// (Europe/Paris, celui d'André), chaque cas dans un processus à part (TZ fixé au démarrage).
//
// LE DÉFAUT (F7, équipe du 15/10). ts() faisait new Date().toISOString() : l'heure UTC. Entre minuit et 1 h (l'hiver)
// ou 2 h (l'été), « aujourd'hui » était encore la VEILLE : le 1er novembre à 0 h 30, « Ce mois-ci » parlait d'octobre
// (Prévision « Mois terminé : c'est ton bilan d'octobre », Part de la modèle « dont octobre en cours ») pendant que le
// rappel, en heure locale, disait « Octobre est fini » ; le 16/10, la Prévision changeait à 2 h du matin.
// Contrôle du harnais : chaque processus enfant renvoie aussi l'HEURE locale qu'il voit ; si elle n'est pas l'heure
// simulée, le fuseau n'est pas en place et le banc ÉCHOUE au lieu de passer à vide.
//
// Lancer : node test_ts_local.js            Témoin (doit ÉCHOUER) : node test_ts_local.js ../../../final17.html
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');

function extraire(SRC, nom) {
  const i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) return null;
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  return null;
}

// ── processus ENFANT : une horloge figée à l'instant donné, le fuseau de l'environnement ──
if (process.env.__TS_INSTANT) {
  const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
  const T = Date.parse(process.env.__TS_INSTANT);
  const Vrai = Date;
  global.Date = class extends Vrai {
    constructor(...a) { if (a.length === 0) super(T); else super(...a); }
    static now() { return T; }
  };
  const code = ['ts', '_ymd', '_aujLocal'].map((f) => extraire(SRC, f) || '').join('\n');
  const f = new Function(code + '\nreturn { ts: ts, auj: (typeof _aujLocal === "function" ? _aujLocal : null) };')();
  const d = new Date();
  process.stdout.write(JSON.stringify({ ts: f.ts(), auj: f.auj ? f.auj() : null,
    heure: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), tz: process.env.TZ }));
  process.exit(0);
}

// ── processus PARENT : les cas ──
let echecs = 0, oks = 0;
function V(titre, cond, detail) {
  if (cond) { oks++; console.log('  OK  ' + titre); } else { echecs++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}
function enfant(instant) {
  const env = Object.assign({}, process.env, { TZ: 'Europe/Paris', __TS_INSTANT: instant });
  return JSON.parse(execFileSync(process.execPath, [__filename, CIBLE], { env, encoding: 'utf8' }));
}
// [ce que voit André (heure de Paris), instant UTC correspondant, date locale attendue, heure locale attendue]
const CAS = [
  ['16 oct. 2026, 0 h 30 (heure d\'été)', '2026-10-15T22:30:00Z', '2026-10-16', '00:30'],
  ['16 oct. 2026, 1 h 59', '2026-10-15T23:59:00Z', '2026-10-16', '01:59'],
  ['16 oct. 2026, 2 h 01', '2026-10-16T00:01:00Z', '2026-10-16', '02:01'],
  ['16 oct. 2026, 23 h 59', '2026-10-16T21:59:00Z', '2026-10-16', '23:59'],
  ['25 oct. 2026, 0 h 30 (nuit du changement d\'heure d\'octobre)', '2026-10-24T22:30:00Z', '2026-10-25', '00:30'],
  ['25 oct. 2026, 2 h 30 (1re fois, heure d\'été)', '2026-10-25T00:30:00Z', '2026-10-25', '02:30'],
  ['25 oct. 2026, 2 h 30 (2e fois, heure d\'hiver)', '2026-10-25T01:30:00Z', '2026-10-25', '02:30'],
  ['26 oct. 2026, 0 h 30 (lendemain du changement, UTC+1)', '2026-10-25T23:30:00Z', '2026-10-26', '00:30'],
  ['1er nov. 2026, 0 h 30 (1er du mois)', '2026-10-31T23:30:00Z', '2026-11-01', '00:30'],
  ['31 oct. 2026, 23 h 59 (dernier jour du mois)', '2026-10-31T22:59:00Z', '2026-10-31', '23:59'],
  ['1er janv. 2027, 0 h 30 (changement d\'année)', '2026-12-31T23:30:00Z', '2027-01-01', '00:30'],
  ['28 mars 2027, 0 h 30 (nuit du changement d\'heure de mars)', '2027-03-27T23:30:00Z', '2027-03-28', '00:30'],
  ['28 mars 2027, 1 h 59 (juste avant le saut)', '2027-03-28T00:59:00Z', '2027-03-28', '01:59'],
  ['28 mars 2027, 3 h 01 (juste après le saut)', '2027-03-28T01:01:00Z', '2027-03-28', '03:01'],
  ['29 mars 2027, 1 h 30 (heure d\'été, UTC+2)', '2027-03-28T23:30:00Z', '2027-03-29', '01:30'],
  ['29 févr. 2028, 0 h 15 (année bissextile)', '2028-02-28T23:15:00Z', '2028-02-29', '00:15'],
  ['5 mars 2027, 12 h (zéros de tête)', '2027-03-05T11:00:00Z', '2027-03-05', '12:00'],
];
const SRC = fs.readFileSync(CIBLE, 'utf8');
V('ts() est dans la page', SRC.indexOf('function ts(') >= 0);
for (const [qui, instant, date, heure] of CAS) {
  const r = enfant(instant);
  if (r.heure !== heure) { V('contrôle du harnais (' + qui + ') : l\'enfant voit ' + heure + ' heure de Paris', false, 'il voit ' + r.heure + ' (' + r.tz + ')'); continue; }
  V(qui + ' : ts() = ' + date, r.ts === date, 'ts() = ' + r.ts);
  if (r.auj) V(qui + ' : ts() = _aujLocal() (la date du rappel)', r.ts === r.auj, r.ts + ' / ' + r.auj);
}
console.log('\n' + (echecs ? echecs + ' ECHEC(S)' : 'TOUT PASSE (' + oks + ' contrôles)') + '\n');
process.exit(echecs ? 1 : 0);
